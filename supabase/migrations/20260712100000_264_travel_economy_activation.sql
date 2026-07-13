-- Migration 264: DRIFT Fun-Kern — travel_economy_activation (Welle 1, Schritt 1.1)
--
-- Plan: docs/plans/drift-fun-core-implementation-plan.md §3 Schritt 1.1.
-- Concept: docs/concepts/drift-gameplay-redesign-concept.md (D1 "die Ökonomie ist tot",
--          M4 Reward-Kern, M6 Rangleiter).
--
-- THE P0 HOLE THIS CLOSES
-- -----------------------
-- P0 shipped the full run loop — but nothing it produced was ever WRITTEN anywhere the
-- player keeps: `traveler_profiles.vp`, `.siegel`, `.clearance_rank` and `.zerfaserung_count`
-- are columns no RPC has ever touched (verified: no UPDATE against them exists in migrations
-- 239–263). fn_quest_advance fires the world effects and pays the traveller NOTHING;
-- fn_travel_complete lodges the haul into a qualities counter that no surface reads. A run
-- was therefore literally unrewarded: the diagnosis D1 of the redesign concept.
--
-- This migration turns the existing loop into an economy:
--   * Ablieferung (fn_quest_advance)  → deterministic Siegel roll + flat VP.
--   * Entladung   (fn_travel_complete) → Haul → VP (1:1) + Siegel (ratio), plus a
--                                        per-honor Erstvermessungs-Bonus.
--   * Kollaps     (fn_travel_move)     → zerfaserung_count finally increments.
--   * Rangleiter  (fn_clearance_exam)  → VP threshold + Siegel fee → clearance_rank.
--
-- THE GATE (plan §2.4, §9)
-- -----------------------
-- Everything above sits behind the NEW platform_settings key `drift_fun_core_enabled`
-- (jsonb false, seeded here, fail-closed). Gate off ⇒ every RPC behaves EXACTLY as its P0
-- predecessor: no ledger write, no extra response key, no counter bump. That is the
-- regression net protecting the live P0 system (drift_p0_enabled=true on prod) until the
-- flip. The SQL-side check (drift_gate_enabled) mirrors the Python `parse_setting_bool`
-- semantics — positive-match {true, "true", "1", "yes", "on"}, everything else false — so a
-- jsonb-null round-trip or a typo can never silently arm the economy (F32 precedent).
--
-- DETERMINISM (plan §2.7)
-- ----------------------
-- All new randomness is drawn from drift_rand(seed) = hashtext(seed) mapped into [0,1),
-- with the seed built from run/entity/takt. No random() in a payout path: a payout must be
-- replayable in CI and reproducible in a bug report. (fn_travel_move's legacy deep-surge
-- random() is left untouched here — it is retired wholesale in migration 266 when the
-- Störungs-Signalklasse absorbs it, plan §4 Schritt 2.2.)
--
-- GRANT CLASSES (ADR-006, plan §2.2)
--   PLAYER-class (auth.uid() = p_user guard, GRANT authenticated + service_role):
--       fn_clearance_exam  — new; joins fn_travel_move/complete/quest_* which keep theirs
--                            (CREATE OR REPLACE preserves the ACL; re-asserted at the foot).
--   EFFECT/INTERNAL-class (service_role only, explicit anon+authenticated REVOKE):
--       drift_gate_enabled, drift_rand, drift_rand_int, fn_drift_award.
--   fn_drift_award is the SINGLE writer of the Siegel/VP ledger — one audit shape, one
--   place to change, no payout arithmetic duplicated across three RPCs.
--
-- Active-view refresh: none (no agents/buildings/simulations/events column changes).


-- ═══════════════════════════════════════════════════════════════════
-- 1. The gate key (fail-closed) — one flip, one rollback
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('drift_fun_core_enabled', 'false'::jsonb,
     'DRIFT Fun-Kern gate (P0.5: economy, Havarie, signals, Sondierung, requisition). Off → every DRIFT RPC behaves exactly as its P0 predecessor. Cumulative: requires drift_p0_enabled on.')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2. Zahlenwerk — every constant is DATA (plan §2.3), never a literal in a body
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO drift_tuning (setting_key, value, description) VALUES
    ('reward_dispatch_tier1', '{"siegel_min": 8, "siegel_max": 12, "vp": 10}'::jsonb,
        'Payout for a delivered Depesche (tier 1 = the only tier in W1). Siegel is a deterministic roll in [min,max] (drift_rand, seeded run:instance:takt) so the reward has texture without being forgeable; VP is flat — the rank ladder must not be gambled.'),
    ('reward_survey_vp_per_haul', '1'::jsonb,
        'VP per point of banked Vermessung on Entladung (1:1). Haul is the survey economy''s base income; the Depesche is the premium on top.'),
    ('reward_survey_siegel_ratio', '0.5'::jsonb,
        'Siegel per point of banked Vermessung on Entladung (floor-rounded). Deliberately below the VP rate: surveying builds RANK faster than it builds PURCHASING POWER — Depeschen and (from W3) requisition are what Siegel is for.'),
    ('reward_erstvermessung', '{"siegel": 40, "vp": 25}'::jsonb,
        'Bonus per Erstvermessung honor won on this Entladung (first traveller ever to chart that node, arbitrated first-write-wins in fn_survey_deliver/253). The single largest payout in W1 — being first on the map is the prestige act.'),
    ('clearance_thresholds', '{"feldkartograph": 100}'::jsonb,
        'Lifetime VP needed to sit the clearance exam for each rank (M6). W1 exposes the first rung only; the higher ranks arrive with the vectors they unlock.'),
    ('clearance_exam_fee', '{"feldkartograph": 25}'::jsonb,
        'Siegel fee charged by fn_clearance_exam on a successful promotion. A rank costs BOTH kinds of currency: proof of survey (VP) and proof of standing (Siegel).')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 3. drift_gate_enabled(key) — the SQL twin of parse_setting_bool (fail-closed)
-- ═══════════════════════════════════════════════════════════════════
-- Python reads the gate via backend/utils/settings.parse_setting_bool; the RPCs need the
-- same answer without a round trip. Positive-match semantics, deliberately identical to the
-- F32 helper: only jsonb `true` or the strings true/1/yes/on read as ON. A missing row, a
-- jsonb null, a "False", a typo → OFF. platform_settings is service_role-only under RLS, so
-- the helper is SECURITY DEFINER (it runs as owner and is unreachable for anon/authenticated).

CREATE OR REPLACE FUNCTION public.drift_gate_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT CASE jsonb_typeof(ps.setting_value)
                   WHEN 'boolean' THEN (ps.setting_value)::boolean
                   WHEN 'string'  THEN lower(ps.setting_value #>> '{}') IN ('true', '1', 'yes', 'on')
                   ELSE FALSE
               END
          FROM public.platform_settings ps
         WHERE ps.setting_key = p_key
    ), FALSE);
$$;

COMMENT ON FUNCTION public.drift_gate_enabled(TEXT) IS
    'Fail-closed SQL read of a platform_settings boolean gate — the twin of backend/utils/settings.parse_setting_bool (F32 positive-match semantics: only jsonb true / "true" / "1" / "yes" / "on" are ON; missing row, jsonb null, anything else → FALSE). Used by the DRIFT RPCs to gate the Fun-Kern (drift_fun_core_enabled) in-transaction, so the SQL and Python answers can never disagree. INTERNAL-class: SECURITY DEFINER (platform_settings is service_role-only), REVOKEd from anon+authenticated; the player RPCs reach it DEFINER→DEFINER as owner.';

REVOKE ALL    ON FUNCTION public.drift_gate_enabled(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_gate_enabled(TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4. drift_rand / drift_rand_int — the deterministic dice (plan §2.7)
-- ═══════════════════════════════════════════════════════════════════
-- hashtext(seed) is IMMUTABLE and stable across sessions/backends; shifting its int4 range
-- into [0, 2^32) and dividing yields a uniform-enough [0,1) for game payouts. The point is
-- not cryptographic quality — it is that the SAME (run, entity, takt) ALWAYS produces the
-- same roll: a payout is replayable in CI, reproducible in a bug report, and cannot be
-- re-rolled by a client retry (a retried call recomputes the identical value).

CREATE OR REPLACE FUNCTION public.drift_rand(p_seed TEXT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (hashtext(p_seed)::bigint + 2147483648)::numeric / 4294967296::numeric;
$$;

CREATE OR REPLACE FUNCTION public.drift_rand_int(p_seed TEXT, p_lo INT, p_hi INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
    -- Inclusive [lo, hi]. LEAST() guards the (measure-zero) rand = 1 - epsilon rounding edge.
    SELECT LEAST(p_hi, p_lo + floor(public.drift_rand(p_seed) * (p_hi - p_lo + 1))::int);
$$;

COMMENT ON FUNCTION public.drift_rand(TEXT) IS
    'Deterministic DRIFT dice (plan §2.7): hashtext(seed) → [0,1). Seeds are built from run_id/entity/takt, so every roll is replayable (CI), reproducible (bug reports) and retry-safe (a repeated call recomputes the same value instead of re-rolling). INTERNAL-class: service_role only.';

COMMENT ON FUNCTION public.drift_rand_int(TEXT, INT, INT) IS
    'Deterministic integer roll in the inclusive range [p_lo, p_hi], drawn from drift_rand(p_seed). INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.drift_rand(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_rand(TEXT) TO service_role;
REVOKE ALL    ON FUNCTION public.drift_rand_int(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_rand_int(TEXT, INT, INT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4b. travel_run_seeds — the half of the seed the traveller cannot see
-- ═══════════════════════════════════════════════════════════════════
-- drift_rand is deterministic BY DESIGN, and its inputs (run_id, instance_id, takt) are all
-- values the client already holds. hashtext is open source. Without a server-only term a
-- player can therefore precompute every roll and simply wait for the takt on which the dice
-- land well — the reward loses its texture, and in W2 (signal draw, Sondierungs-Bust) a
-- precomputable roll would delete the push-your-luck entirely: there is no luck to push if
-- you can read the next card.
--
-- The salt must NOT live on travel_runs: `travel_runs_owner_select` (RLS, 246) lets the
-- owner read their own run row straight through PostgREST — i.e. exactly the adversary would
-- hold the secret. It lives in its own table with NO anon/authenticated grant and no RLS
-- policy for them; only the SECURITY DEFINER dice-callers (and service_role) ever see it.
--
-- Lazily created per run (ON CONFLICT DO NOTHING), so runs opened before this migration get
-- a salt on their first roll instead of needing a backfill.

CREATE TABLE IF NOT EXISTS public.travel_run_seeds (
    run_id     UUID PRIMARY KEY REFERENCES travel_runs(id) ON DELETE CASCADE,
    salt       TEXT NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_run_seeds ENABLE ROW LEVEL SECURITY;

-- service_role only. No owner-select policy: the point of the row is that its owner must not
-- be able to read it.
DROP POLICY IF EXISTS travel_run_seeds_service_role ON public.travel_run_seeds;
CREATE POLICY travel_run_seeds_service_role ON public.travel_run_seeds
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON TABLE public.travel_run_seeds FROM PUBLIC, anon, authenticated;
GRANT ALL  ON TABLE public.travel_run_seeds TO service_role;

COMMENT ON TABLE public.travel_run_seeds IS
    'Per-run secret salt for the DRIFT dice (migration 264). drift_rand is deterministic and its other seed terms (run_id, instance_id, takt) are all client-visible, so without this salt every roll would be precomputable by the player — fatal for W2''s push-your-luck. Deliberately NOT a travel_runs column: RLS lets a traveller read their own run row, which would hand the secret to the one party it is kept from. No anon/authenticated grant, no RLS policy for them; read only through drift_run_salt() (SECURITY DEFINER) and service_role.';

CREATE OR REPLACE FUNCTION public.drift_run_salt(p_run UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_salt TEXT;
BEGIN
    INSERT INTO travel_run_seeds (run_id) VALUES (p_run) ON CONFLICT (run_id) DO NOTHING;
    SELECT salt INTO v_salt FROM travel_run_seeds WHERE run_id = p_run;
    RETURN v_salt;
END;
$$;

COMMENT ON FUNCTION public.drift_run_salt(UUID) IS
    'The server-only term of every DRIFT seed (migration 264): returns the run''s secret salt, creating it on first use. Every drift_rand seed in the Fun-Kern is prefixed with it, so a roll stays perfectly replayable server-side (CI, bug reports, retry-safety) while being unforgeable client-side. INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.drift_run_salt(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_run_salt(UUID) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_drift_award — the SINGLE writer of the Siegel/VP ledger
-- ═══════════════════════════════════════════════════════════════════
-- Credits only (a debit has different failure semantics — see fn_clearance_exam's guarded
-- CAS). One atomic increment (no fetch-compute-update, ADR-007), one audit row, one return
-- shape that every payer reuses. Callers pass a source tag; the audit row carries it so a
-- ledger movement is always traceable to the act that caused it.

CREATE OR REPLACE FUNCTION public.fn_drift_award(
    p_user    UUID,
    p_source  TEXT,     -- 'dispatch' | 'survey' | 'erstvermessung' | (later: signal, sondierung …)
    p_siegel  INT,
    p_vp      INT,
    p_run     UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile traveler_profiles%ROWTYPE;
BEGIN
    IF p_siegel < 0 OR p_vp < 0 THEN
        RAISE EXCEPTION 'fn_drift_award: credits only (got siegel=%, vp=%) — debits go through their own guarded CAS', p_siegel, p_vp
            USING ERRCODE = '22023';
    END IF;

    -- A zero award is a legitimate no-op (a run that banked nothing) — return the current
    -- balances without touching the row or writing audit noise.
    IF p_siegel = 0 AND p_vp = 0 THEN
        SELECT * INTO v_profile FROM traveler_profiles WHERE user_id = p_user;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'fn_drift_award: no traveler profile for %', p_user USING ERRCODE = 'P0002';
        END IF;
    ELSE
        UPDATE traveler_profiles
           SET siegel = siegel + p_siegel,
               vp     = vp + p_vp
         WHERE user_id = p_user
        RETURNING * INTO v_profile;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'fn_drift_award: no traveler profile for %', p_user USING ERRCODE = 'P0002';
        END IF;

        PERFORM travel_audit(p_user, 'travel_award', 'traveler_profile', p_user, NULL,
            jsonb_build_object('source', p_source, 'siegel', p_siegel, 'vp', p_vp,
                               'run', p_run,
                               'siegel_balance', v_profile.siegel, 'vp_total', v_profile.vp));
    END IF;

    -- vp_total IS the lifetime total by construction: VP is a rank score and is never spent
    -- (only Siegel is). siegel_balance is spendable and will fall again from W3 (requisition).
    RETURN jsonb_build_object(
        'source',         p_source,
        'siegel_earned',  p_siegel,
        'vp_earned',      p_vp,
        'siegel_balance', v_profile.siegel,
        'vp_total',       v_profile.vp,
        'clearance_rank', v_profile.clearance_rank
    );
END;
$$;

COMMENT ON FUNCTION public.fn_drift_award(UUID, TEXT, INT, INT, UUID) IS
    'The single writer of the DRIFT Siegel/VP ledger (plan §3 Schritt 1.1). Atomic increment on traveler_profiles (no read-modify-write, ADR-007), one travel_award audit row carrying the source tag, one return shape {source, siegel_earned, vp_earned, siegel_balance, vp_total, clearance_rank} reused by every payer. Credits only — 22023 on a negative delta; debits use their own guarded CAS (fn_clearance_exam) because an insufficient balance must fail, not clamp. A zero award is a legitimate no-op (a run that banked nothing) and writes no audit noise. EFFECT-class: REVOKE anon+authenticated, GRANT service_role; reached DEFINER→DEFINER from fn_quest_advance / fn_travel_complete.';

REVOKE ALL    ON FUNCTION public.fn_drift_award(UUID, TEXT, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_award(UUID, TEXT, INT, INT, UUID) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_quest_advance — the Depesche finally pays (M4)
-- ═══════════════════════════════════════════════════════════════════
-- Body of migration 249 verbatim, plus: after the effects fire and the cargo is consumed,
-- a gated payout. Siegel is a deterministic roll in [siegel_min, siegel_max] seeded with
-- run:instance:takt — the same delivery always pays the same, but two deliveries in a run
-- differ. VP is flat (the rank ladder is not a slot machine).
--
-- Gate off ⇒ byte-identical to 249: no award, no 'earnings' key, no checkpoint field.

CREATE OR REPLACE FUNCTION public.fn_quest_advance(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_instance      UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run         travel_runs%ROWTYPE;
    v_inst        travel_quest_instances%ROWTYPE;
    v_tmpl        travel_quest_templates%ROWTYPE;
    v_target_node UUID;
    v_target_sim  UUID;
    v_target_ag   UUID;
    v_cargo_id    UUID;
    v_effects_in  JSONB := '[]'::jsonb;
    v_effect      JSONB;
    v_result      JSONB;
    v_fun_core    BOOLEAN;
    v_reward      JSONB;
    v_siegel      INT := 0;
    v_vp          INT := 0;
    v_earnings    JSONB;
    v_out         JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_quest_advance: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_advance: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_quest_advance: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_inst FROM travel_quest_instances WHERE id = p_instance AND owner_user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_quest_advance: quest instance not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_inst.status <> 'active' THEN
        RAISE EXCEPTION 'fn_quest_advance: quest is %, not active', v_inst.status USING ERRCODE = '22023';
    END IF;

    v_target_node := NULLIF(v_inst.slots #>> '{target_node}', '')::uuid;
    v_target_sim  := NULLIF(v_inst.slots #>> '{target_sim}', '')::uuid;
    v_target_ag   := NULLIF(v_inst.slots #>> '{target_agent}', '')::uuid;

    -- Must stand on the target world's broadcast edge to deliver.
    IF v_run.position_node_id IS DISTINCT FROM v_target_node THEN
        RAISE EXCEPTION 'NOT_AT_TARGET' USING ERRCODE = '22023';
    END IF;

    -- The bound cargo must still be aboard.
    SELECT id INTO v_cargo_id FROM travel_cargo
     WHERE quest_instance_id = p_instance AND owner_user_id = p_user AND run_id = p_run
     LIMIT 1;
    IF v_cargo_id IS NULL THEN
        RAISE EXCEPTION 'CARGO_MISSING' USING ERRCODE = '22023';
    END IF;

    -- Annotate every effect with the resolved deliver targets; the gate picks what each
    -- kind needs (target_sim for echo/event, target_agent for memory, neither for the self
    -- fragment). Uniform annotation keeps advance free of per-effect knowledge.
    SELECT * INTO v_tmpl FROM travel_quest_templates WHERE template_key = v_inst.template_key;
    FOR v_effect IN SELECT * FROM jsonb_array_elements(COALESCE(v_tmpl.definition -> 'effects', '[]'::jsonb))
    LOOP
        v_effects_in := v_effects_in
            || (v_effect || jsonb_build_object('target_sim', v_target_sim, 'target_agent', v_target_ag));
    END LOOP;

    -- Fire through the single hospitality gate (internal DEFINER call). Exactly-once inside.
    v_result := fn_apply_quest_effects(p_instance, v_effects_in);

    -- ── Fun-Kern (M4): the Depesche pays ──────────────────────────────────────────
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    IF v_fun_core THEN
        v_reward := drift_tuning_value('reward_dispatch_tier1');
        -- Seed = SECRET : run : instance : takt. The salt (4b) is the term the traveller
        -- cannot read; without it the roll would be precomputable and the dice pointless.
        v_siegel := drift_rand_int(
            drift_run_salt(p_run) || ':' || p_run::text || ':' || p_instance::text
                || ':' || v_run.takt_count::text,
            COALESCE((v_reward ->> 'siegel_min')::int, 8),
            COALESCE((v_reward ->> 'siegel_max')::int, 12));
        v_vp := COALESCE((v_reward ->> 'vp')::int, 10);
        v_earnings := fn_drift_award(p_user, 'dispatch', v_siegel, v_vp, p_run);
    END IF;

    -- Consume the delivered cargo + close the instance.
    DELETE FROM travel_cargo WHERE id = v_cargo_id;
    UPDATE travel_quest_instances SET status = 'completed' WHERE id = p_instance RETURNING * INTO v_inst;

    UPDATE travel_runs
       SET run_version = run_version + 1, event_seq = event_seq + 1,
           checkpoint = v_run.checkpoint
               || jsonb_build_object('last_delivery',
                      jsonb_build_object('instance', p_instance, 'target_sim', v_target_sim))
               -- The receipt rides the checkpoint too, so a refetch (or a second device) can
               -- still stage the Zeremonie without replaying the RPC. It sits at the TOP
               -- level because that is where the one reader looks: TravelRunResponse lifts
               -- `checkpoint.earnings` into its typed `earnings` field (models/drift.py). It
               -- was nested under last_delivery before (jsonb `||` binds inside the argument),
               -- so the lift silently found nothing and the promise in this comment was false.
               || CASE WHEN v_fun_core THEN jsonb_build_object('earnings', v_earnings)
                       ELSE '{}'::jsonb END
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_quest_completed', p_run,
        jsonb_build_object('instance', p_instance, 'template_key', v_inst.template_key, 'family', 'deliver')
        || CASE WHEN v_fun_core THEN jsonb_build_object('siegel', v_siegel, 'vp', v_vp)
                ELSE '{}'::jsonb END);
    PERFORM travel_audit(p_user, 'travel_quest_advance', 'travel_quest', p_instance, v_target_sim,
        jsonb_build_object('delivered', TRUE, 'effects', v_result));

    -- Gate off → the exact 249 shape (three keys). Gate on → one additive key.
    v_out := jsonb_build_object('run', to_jsonb(v_run), 'instance', to_jsonb(v_inst), 'effects', v_result);
    IF v_fun_core THEN
        v_out := v_out || jsonb_build_object('earnings', v_earnings);
    END IF;
    RETURN v_out;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_travel_complete — the Entladung finally pays (M4)
-- ═══════════════════════════════════════════════════════════════════
-- Body of migration 256 verbatim, plus a gated payout computed from what the run actually
-- produced: banked Vermessung → VP (1:1) + Siegel (ratio, floored), and a per-honor bonus
-- for every Erstvermessung this Entladung won (fn_survey_deliver already arbitrated them —
-- the honor count is read from ITS return value, so the bonus can never be double-claimed
-- by a re-run: a second delivery of the same node returns honors_won = 0).
--
-- Gate off ⇒ byte-identical to 256: the completion checkpoint keeps its 4 keys, no award.

CREATE OR REPLACE FUNCTION public.fn_travel_complete(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_is_home    BOOLEAN;
    v_haul       INT;
    v_anchor     UUID;
    v_visited    JSONB;
    v_keys       TEXT[];
    v_survey     JSONB;
    v_fun_core   BOOLEAN;
    v_honors     INT := 0;
    v_erstv      JSONB;
    v_siegel     INT := 0;
    v_vp         INT := 0;
    v_earnings   JSONB;
    v_checkpoint JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_complete: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_complete: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_complete: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Must be standing on the anchor's home broadcast node.
    SELECT p.anchor_simulation_id INTO v_anchor FROM traveler_profiles p WHERE p.user_id = p_user;
    SELECT EXISTS (
        SELECT 1 FROM drift_chart_nodes n
        WHERE n.id = v_run.position_node_id
          AND n.node_type = 'broadcast_rand'
          AND n.simulation_id = v_anchor
    ) INTO v_is_home;
    IF NOT v_is_home THEN
        RAISE EXCEPTION 'NOT_AT_HOME' USING ERRCODE = '22023';
    END IF;

    -- Entladung: lodge the run's accrued Vermessung into the traveler's lifetime total
    -- (qualities.vermessung_lodged — the P0 stat; the ledger below is what the player SEES).
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Survey delivery: resolve every FIRST-arrival node this run (checkpoint.visited),
    -- minus the traveller's own home, to its stable_key, then claim Erstvermessung honors
    -- first-write-wins. Only ever runs on a clean bank (a recall closed the run abandoned).
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    -- Close out an undelivered Depesche the traveller banked while still carrying it (256).
    UPDATE travel_quest_instances qi
       SET status = 'failed'
      FROM travel_cargo c
     WHERE c.run_id = p_run AND c.quest_instance_id = qi.id AND qi.status = 'active';
    DELETE FROM travel_cargo WHERE run_id = p_run;

    -- ── Fun-Kern (M4): the haul and the honors finally pay ────────────────────────
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    IF v_fun_core THEN
        v_honors := COALESCE((v_survey ->> 'honors_won')::int, 0);
        v_erstv  := drift_tuning_value('reward_erstvermessung');
        v_vp     := v_haul * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1)
                    + v_honors * COALESCE((v_erstv ->> 'vp')::int, 25);
        v_siegel := floor(v_haul * COALESCE((drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int
                    + v_honors * COALESCE((v_erstv ->> 'siegel')::int, 40);
        v_earnings := fn_drift_award(p_user, 'entladung', v_siegel, v_vp, p_run);
    END IF;

    v_checkpoint := jsonb_build_object(
        'haul_banked', v_haul,
        'surveys_delivered', v_survey -> 'surveys_delivered',
        'honors_won', v_survey -> 'honors_won',
        'honor_keys', v_survey -> 'honor_keys');
    IF v_fun_core THEN
        v_checkpoint := v_checkpoint || jsonb_build_object('earnings', v_earnings);
    END IF;

    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           checkpoint = v_checkpoint
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_complete', 'travel_run', p_run, NULL,
        jsonb_build_object('takt_count', v_run.takt_count, 'haul_banked', v_haul,
                           'honors_won', v_survey -> 'honors_won'));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 8. fn_travel_move — the collapse counter finally counts
-- ═══════════════════════════════════════════════════════════════════
-- Body of migration 255 verbatim, plus one gated statement on the recall floor:
-- traveler_profiles.zerfaserung_count (a column that has existed since 239 and was never
-- written) increments on every involuntary collapse. It is the scar count the Bureau HUD
-- reads — and, from W2, the input to the Havarie escalation.
--
-- Why gated: the plan's rollback contract is "gate off = EXACTLY P0" (§9.1). A counter the
-- P0 build never wrote is still a write; keeping it inside the gate means a rollback flip
-- restores P0 semantics with zero residue. It arms with the rest of the Fun-Kern.

CREATE OR REPLACE FUNCTION public.fn_travel_move(
    p_user          UUID,
    p_run           UUID,
    p_run_version   INT,
    p_to_node       UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_weight     INT;
    v_perm       JSONB;
    v_affinity   INT;
    v_mult       NUMERIC;
    v_bb_cost    INT;
    v_band       TEXT;
    v_dz_add     INT;
    v_dz_cap     INT;
    v_notfreq    BOOLEAN := FALSE;
    v_surge      BOOLEAN := FALSE;
    v_home       UUID;
    v_anchor     UUID;
    v_to_sim     UUID;
    v_to_type    TEXT;
    v_haul       INT;
    v_visited    JSONB;
    v_survey     INT := 0;
    v_dz_bleed   JSONB;
    v_surge_cfg  JSONB;
    v_scatter    JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    -- Lock + load the run; run_version CAS (concurrent move from a 2nd client loses).
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_move: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status <> 'active' THEN
        RAISE EXCEPTION 'fn_travel_move: run is %, not active', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    -- Adjacency: an edge between the current position and the target in this chart.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier: on-vector if the edge is permeable on the current frequency
    -- (≥1); else the affinity-banded off-vector penalty (§2.2).
    IF COALESCE((v_perm ->> v_run.frequency)::numeric, 0) >= 1 THEN
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> 'on')::numeric;
    ELSE
        v_affinity := COALESCE((SELECT (affinities ->> v_run.frequency)::int
                                FROM traveler_profiles WHERE user_id = p_user), 0);
        v_mult := (drift_tuning_value('freq_offvector_mult') ->> (
            CASE WHEN v_affinity <= 1 THEN 'aff_0_1'
                 WHEN v_affinity <= 3 THEN 'aff_2_3'
                 ELSE 'aff_4_5' END))::numeric;
    END IF;
    v_bb_cost := ceil(v_weight * v_mult)::int;

    -- Pay: Bandbreite if affordable, else Notfrequenz (KH per edge, BB stays 0).
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    -- Target node band + identity (Dissonanz scaling, survey value, foreign-dock bonus).
    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster spent (§2.6) — the time pressure.
    v_run.window_remaining := v_run.window_remaining - 1;

    -- Dissonanz by the target band, capped. Above the bleed threshold it erodes Kohärenz.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);
    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- Deep-Drift surge (variance / push-your-luck). NB: still random() — the deterministic
    -- rewrite happens when migration 266 folds this into the Störungs-Signalklasse (plan
    -- §4/2.2); pulling it forward here would change P0 behavior under a closed gate.
    IF v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung: first arrival at this node this run → survey value (band + foreign dock).
    v_haul    := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    IF NOT (v_visited @> to_jsonb(p_to_node::text)) THEN
        v_survey := COALESCE((drift_tuning_value('survey_value_by_band') ->> COALESCE(v_band, 'near'))::int, 0);
        IF v_to_type = 'broadcast_rand' AND v_to_sim IS DISTINCT FROM v_anchor THEN
            v_survey := v_survey + COALESCE((drift_tuning_value('foreign_dock_bonus'))::int, 0);
        END IF;
        v_haul := v_haul + v_survey;
        v_visited := v_visited || to_jsonb(p_to_node::text);
    END IF;

    -- Recall floor: depleted Kohärenz (§19.4) or an expired Aufenthaltsfenster away from
    -- home collapses the excursion — cargo scatters as echoes, the un-lodged Vermessung is
    -- lost. (W1 keeps this snap; migration 265 turns it into the Havarie CHOICE, plan §3.3.)
    IF v_run.kohaerenz <= 0 OR (v_run.window_remaining <= 0 AND p_to_node IS DISTINCT FROM v_home) THEN
        v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

        -- Fun-Kern: the scar is finally recorded (the column has been dead since 239).
        IF drift_gate_enabled('drift_fun_core_enabled') THEN
            UPDATE traveler_profiles
               SET zerfaserung_count = zerfaserung_count + 1
             WHERE user_id = p_user;
        END IF;

        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',   -- the expedition collapsed (terminal)
            closed_at        = now(),
            bandbreite       = v_run.bandbreite,
            kohaerenz        = v_run.kohaerenz,
            dissonanz        = v_run.dissonanz,
            window_remaining = GREATEST(0, v_run.window_remaining),
            takt_count       = takt_count + 1,
            event_seq        = event_seq + 1,
            run_version      = run_version + 1,
            checkpoint       = jsonb_build_object(
                'position_node_id', COALESCE(v_home, v_run.position_node_id),
                'recall', CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END,
                'haul', 0, 'haul_lost', v_haul, 'visited', v_visited,
                'scattered', v_scatter)
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_run.checkpoint ->> 'recall',
                               'haul_lost', v_haul, 'attempted_to', p_to_node,
                               'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));
        RETURN to_jsonb(v_run);
    END IF;

    -- Advance: position + counters + the spent window; rewrite the checkpoint carrying
    -- the accrued Vermessung haul + the visited set.
    UPDATE travel_runs SET
        position_node_id = p_to_node,
        bandbreite       = v_run.bandbreite,
        kohaerenz        = v_run.kohaerenz,
        dissonanz        = v_run.dissonanz,
        window_remaining = v_run.window_remaining,
        takt_count       = takt_count + 1,
        event_seq        = event_seq + 1,
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object(
            'position_node_id', p_to_node, 'haul', v_haul, 'visited', v_visited,
            'last_move', jsonb_build_object('from', v_run.position_node_id, 'bb_cost', v_bb_cost,
                                            'notfrequenz', v_notfreq, 'dz_add', v_dz_add,
                                            'surge', v_surge, 'survey', v_survey)
        )
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_haul, 'takt', v_run.takt_count));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 9. fn_clearance_exam — the rank ladder gets its first rung (M6)
-- ═══════════════════════════════════════════════════════════════════
-- PLAYER-class. No run required: the exam is sat at the Bureau, between expeditions.
-- W1 exposes it as a plain button; W2 dresses it as a storylet (plan §3.1 note).
--
-- The promotion is ONE guarded UPDATE — the WHERE clause IS the compare-and-swap (rank
-- unchanged AND vp ≥ threshold AND siegel ≥ fee). Two concurrent exam clicks: the first
-- flips the rank and takes the fee, the second matches no row and reports the true reason
-- after a re-read. No fetch-compute-update, no double charge (ADR-007).

CREATE OR REPLACE FUNCTION public.fn_clearance_exam(
    p_user UUID,
    p_rank TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_threshold INT;
    v_fee       INT;
    v_profile   traveler_profiles%ROWTYPE;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_clearance_exam: caller is not the profile owner' USING ERRCODE = '42501';
    END IF;

    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
    END IF;

    v_threshold := (drift_tuning_value('clearance_thresholds') ->> p_rank)::int;
    v_fee       := (drift_tuning_value('clearance_exam_fee')   ->> p_rank)::int;
    IF v_threshold IS NULL OR v_fee IS NULL THEN
        RAISE EXCEPTION 'fn_clearance_exam: no exam is offered for rank %', p_rank USING ERRCODE = '22023';
    END IF;

    -- The guarded CAS. rank = 'aspirant' is the W1 precondition: exactly one rung exists, so
    -- "not yet promoted" and "eligible for THIS rank" are the same predicate. When the ladder
    -- grows (W3+), this becomes a rank-order comparison against the previous rung.
    UPDATE traveler_profiles
       SET siegel         = siegel - v_fee,
           clearance_rank = p_rank
     WHERE user_id = p_user
       AND clearance_rank = 'aspirant'
       AND vp >= v_threshold
       AND siegel >= v_fee
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        -- Re-read to tell the player the TRUTH about why (a generic "denied" would be a lie
        -- in three different ways). The row is only read here, never written — no race.
        SELECT * INTO v_profile FROM traveler_profiles WHERE user_id = p_user;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'fn_clearance_exam: no traveler profile for %', p_user USING ERRCODE = 'P0002';
        END IF;
        IF v_profile.clearance_rank <> 'aspirant' THEN
            RAISE EXCEPTION 'RANK_ALREADY_HELD' USING ERRCODE = '22023';
        END IF;
        IF v_profile.vp < v_threshold THEN
            RAISE EXCEPTION 'VP_TOO_LOW' USING ERRCODE = 'P0001';
        END IF;
        RAISE EXCEPTION 'SIEGEL_TOO_LOW' USING ERRCODE = 'P0001';
    END IF;

    PERFORM travel_audit(p_user, 'travel_clearance_exam', 'traveler_profile', p_user, NULL,
        jsonb_build_object('rank', p_rank, 'fee', v_fee, 'vp_at_exam', v_profile.vp,
                           'siegel_balance', v_profile.siegel));

    RETURN jsonb_build_object(
        'clearance_rank', v_profile.clearance_rank,
        'fee_paid',       v_fee,
        'siegel_balance', v_profile.siegel,
        'vp_total',       v_profile.vp
    );
END;
$$;

COMMENT ON FUNCTION public.fn_clearance_exam(UUID, TEXT) IS
    'Sit the Bureau clearance exam for p_rank (M6, plan §3 Schritt 1.1). PLAYER-class: auth.uid() = p_user guard, GRANT authenticated + service_role. Gate-checked (drift_fun_core_enabled → GATE_CLOSED/22023 while closed). Requires vp ≥ clearance_thresholds[rank] and siegel ≥ clearance_exam_fee[rank]; the promotion + fee is ONE guarded UPDATE whose WHERE clause is the CAS, so two concurrent clicks can never double-charge (ADR-007). On a miss it re-reads the row and raises the TRUE reason: RANK_ALREADY_HELD (22023), VP_TOO_LOW / SIEGEL_TOO_LOW (P0001). Audited travel_clearance_exam. From W3 it also unlocks the architecture vector (migration 269).';


-- ═══════════════════════════════════════════════════════════════════
-- 10. Grants — player-class posture (CREATE OR REPLACE preserves ACLs; explicit for intent)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_clearance_exam(uuid, text)',
        'fn_quest_advance(uuid, uuid, integer, uuid)',
        'fn_travel_complete(uuid, uuid, integer)',
        'fn_travel_move(uuid, uuid, integer, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;
