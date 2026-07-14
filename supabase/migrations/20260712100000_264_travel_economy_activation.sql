-- Migration 264: DRIFT Fun-Kern — das Fundament: die FORM eines Runs und seine ÖKONOMIE
--
-- Plan:    docs/plans/drift-fun-core-implementation-plan.md §3 Schritt 1.1
--          docs/plans/drift-w25-architecture-consolidation-plan.md (D, E, C)
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
--   * Entladung   (fn_travel_bank_run) → Haul → VP (1:1) + Siegel (ratio), plus a
--                                        per-honor Erstvermessungs-Bonus.
--   * Kollaps     (fn_travel_zerfasern) → zerfaserung_count finally increments.
--   * Rangleiter  (fn_clearance_exam)  → VP threshold + Siegel fee → clearance_rank.
--
--
-- ════════════════════════════════════════════════════════════════════════════════
-- W2.6: THE CHECKPOINT GETS A FORM (§3 below) — the change that made this file
--       worth re-reading
-- ════════════════════════════════════════════════════════════════════════════════
-- Until W2.6 the run's whole live state lived in an untyped multi-writer jsonb
-- (`travel_runs.checkpoint`) with 42 direct writes across five migrations. It was the source
-- of almost every P0/P1 this project has had:
--
--   * `last_signal.class` vs `signal_class`  — a key name IS a silent API contract → 500 on
--                                              every GET, with a green RPC suite
--   * two mirrored snapshot bugs             — caller overwrites helper's write, and back
--   * the `drift_checkpoint_carry` whitelist — a key not listed there vanished on the next
--                                              move (a marker stack that silently emptied)
--   * `haul` / `haul_safe` / `haul_banked`   — three near-identical names, three meanings
--   * sub-ledger staleness (the Funkboje)    — three bookings of the SAME money, no owner:
--                                              banking emptied one and left two standing,
--                                              which cut BOTH ways (over-confiscation on a
--                                              later bust, and a free bust that deleted the
--                                              push-your-luck of the entire wave)
--
-- The carry-whitelist was itself only a workaround for `fn_travel_move` rebuilding the
-- checkpoint from scratch on every advance.
--
-- So the load-bearing keys become COLUMNS (§3.1): `haul_survey`, `haul_safe`, `overstay`,
-- `markers`, `sondierung`, `visited` — with types and CHECKs. What stays in the checkpoint is
-- only the genuinely polymorphic part: the SCENE PAYLOADS (`pending_signal`, `last_signal`,
-- `last_sondierung`, `last_bank`, `havarie`, `earnings`, `last_move`, `last_havarie`,
-- `closing`). A scene is "what just happened"; a column is "what is true".
--
-- Dead as of this migration: the rebuild, the carry whitelist (`drift_checkpoint_carry`),
-- the snapshot trap, and `fn_travel_jettison_haul`. fn_travel_move can rebuild the checkpoint
-- as freely as it likes now — there is nothing run-level left in there to forget.
--
--
-- ════════════════════════════════════════════════════════════════════════════════
-- W2.6: `haul` HAS AN OWNER (§3.2) — and the owner is arithmetic, not a writer
-- ════════════════════════════════════════════════════════════════════════════════
-- The same money used to be booked three times, by three different functions:
--     checkpoint.haul          — the loose take
--     sondierung[node].yield   — what a Resonanzriss at that node confiscates
--     travel_cargo.haul_value  — what a Notabwurf of that freight deducts
-- Nobody owned the set. That is precisely how the Funkboje could empty one and leave the
-- other two standing.
--
-- So the loose haul is not STORED as an independent number at all. It is DERIVED:
--
--     haul  =  haul_survey  +  Σ sondierung[*].yield  +  Σ travel_cargo.haul_value
--
-- stated exactly once, in `drift_haul_of()`. There is no partial booking left that could go
-- stale, because there is no partial booking: a Riss zeroes one node's yield and the haul
-- falls out of the arithmetic; a Notabwurf deletes cargo rows and the haul falls with them.
-- Nobody has to REMEMBER to debit any more.
--
-- Why it is nevertheless a materialised COLUMN (a trigger, §3.3) and not a view: every run
-- RPC answers with `to_jsonb(travel_runs)`, INCLUDING RPCs outside this migration set
-- (fn_quest_accept lives in 249 and is deployed). A view-only derivation would have forced a
-- redefinition of those functions here purely to reshape their return value — trading one
-- multi-definition problem for another, which is exactly what W2.6/C exists to end. The
-- trigger makes `haul` a materialised view of the three ledgers instead: NO writer may set it
-- (every write to travel_runs recomputes it from NEW, every write to travel_cargo.haul_value
-- recomputes it on the run), so staleness is not "avoided by discipline" — it is unreachable.
--
-- The one place that ever CONSUMES the loose haul (banking it, forfeiting it, halving it on a
-- Notruf) is `drift_haul_settle()` (§3.4): the single function that collapses all three
-- sub-ledgers at once. Three ledgers, one consumer, no way to settle half of them.
--
--
-- THE GATE (plan §2.4, §9)
-- -----------------------
-- The economy sits behind the platform_settings key `drift_fun_core_enabled` (jsonb false,
-- seeded here, fail-closed). Gate off ⇒ no ledger write, no scar, no signal, no Sondierung.
-- The SQL-side check (drift_gate_enabled) mirrors the Python `parse_setting_bool` semantics —
-- positive-match {true, "true", "1", "yes", "on"}, everything else false — so a jsonb-null
-- round-trip or a typo can never silently arm the economy (F32 precedent).
--
-- The gate lives HERE and nowhere else (W2.6/A): every RPC re-reads it in-transaction and
-- knows what a closed gate means for its own state — refuse to CREATE, but DRAIN what the
-- Fun-Kern already created. There is deliberately no HTTP twin: a 404 before the RPC runs
-- cannot make that distinction, and it once made the Havarie drain unreachable.
--
-- NOTE ON THE ROLLBACK CONTRACT. "Gate off = P0" is a contract about BEHAVIOUR (no ledger
-- write, no scar, no scene), not about the byte-layout of a jsonb column. §3 changes where
-- the run's state lives in BOTH gate states — the P0 survey economy is preserved exactly, it
-- simply lives in columns now — and §3.5 backfills every in-flight run so nothing is lost at
-- deploy. What the gate-off suites pin is the behaviour and the absence of every Fun-Kern
-- key; that is what a rollback has to restore, and it still does.
--
-- DETERMINISM (plan §2.7)
-- ----------------------
-- All randomness is drawn from drift_rand(seed) = hashtext(seed) → [0,1), seeded from a
-- per-run SECRET salt (§2b) plus run/entity/takt. No random() in a payout path: a payout must
-- be replayable in CI, reproducible in a bug report, and unforgeable by the player.
--
-- GRANT CLASSES (ADR-006, plan §2.2)
--   PLAYER-class (auth.uid() = p_user guard, GRANT authenticated + service_role):
--       fn_clearance_exam, fn_quest_advance, fn_travel_move, fn_travel_complete
--   INTERNAL-class (service_role only, explicit anon+authenticated REVOKE):
--       drift_gate_enabled, drift_rand, drift_rand_int, drift_run_salt, drift_haul_of,
--       drift_haul_settle, fn_drift_award
--
-- Active-view refresh: none (no agents/buildings/simulations/events column changes).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. The gate key (fail-closed) — one flip, one rollback
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('drift_fun_core_enabled', 'false'::jsonb,
     'DRIFT Fun-Kern gate (P0.5: economy, Havarie, signals, Sondierung, requisition). Off → every DRIFT RPC behaves exactly as its P0 predecessor: no ledger write, no scar, no scene. Enforced in SQL only (drift_gate_enabled), never as an HTTP pre-check — a 404 before the RPC runs cannot tell "refuse to create state" from "refuse to drain state", and it once jailed every wrecked run for 48 h. Cumulative: requires drift_p0_enabled on.')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2. Zahlenwerk — every constant is DATA (plan §2.3), never a literal in a body
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO drift_tuning (setting_key, value, description) VALUES
    ('reward_dispatch_tier1', '{"siegel_min": 8, "siegel_max": 12, "vp": 10}'::jsonb,
        'Payout for a delivered Depesche (tier 1 = the only tier in W1). Siegel is a deterministic roll in [min,max] (drift_rand, salted run:instance:takt) so the reward has texture without being forgeable; VP is flat — the rank ladder must not be gambled.'),
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
-- 2a. drift_gate_enabled(key) — the SQL twin of parse_setting_bool (fail-closed)
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
    'Fail-closed SQL read of a platform_settings boolean gate — the twin of backend/utils/settings.parse_setting_bool (F32 positive-match semantics: only jsonb true / "true" / "1" / "yes" / "on" are ON; missing row, jsonb null, anything else → FALSE). THE single enforcement point of the DRIFT Fun-Kern gate: every Fun-Kern RPC calls it in-transaction, because only the RPC knows whether a closed gate should refuse (it would CREATE state) or drain (state the Fun-Kern already created). INTERNAL-class: SECURITY DEFINER (platform_settings is service_role-only), REVOKEd from anon+authenticated; the player RPCs reach it DEFINER→DEFINER as owner.';

REVOKE ALL    ON FUNCTION public.drift_gate_enabled(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_gate_enabled(TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 2b. drift_rand / drift_rand_int / the per-run salt — the deterministic dice
-- ═══════════════════════════════════════════════════════════════════
-- hashtext(seed) is IMMUTABLE and stable across sessions/backends; shifting its int4 range
-- into [0, 2^32) and dividing yields a uniform-enough [0,1) for game payouts. The point is
-- not cryptographic quality — it is that the SAME (run, entity, takt) ALWAYS produces the
-- same roll: replayable in CI, reproducible in a bug report, and retry-safe (a repeated call
-- recomputes the identical value instead of re-rolling).

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
    'Deterministic DRIFT dice (plan §2.7): hashtext(seed) → [0,1). Every Fun-Kern seed is prefixed with the run''s SECRET salt (drift_run_salt), so a roll stays perfectly replayable server-side while being unforgeable client-side. INTERNAL-class: service_role only.';

COMMENT ON FUNCTION public.drift_rand_int(TEXT, INT, INT) IS
    'Deterministic integer roll in the inclusive range [p_lo, p_hi], drawn from drift_rand(p_seed). INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.drift_rand(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_rand(TEXT) TO service_role;
REVOKE ALL    ON FUNCTION public.drift_rand_int(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_rand_int(TEXT, INT, INT) TO service_role;

-- The half of the seed the traveller cannot see.
--
-- drift_rand is deterministic BY DESIGN, and its other inputs (run_id, instance_id, takt) are
-- values the client already holds; hashtext is open source. Without a server-only term a
-- player could precompute every roll and simply wait for the takt on which the dice land well
-- — and in W2 (the signal draw, the Sondierungs-Bust) a precomputable roll deletes the
-- push-your-luck entirely: there is no luck to push if you can read the next card.
--
-- The salt must NOT live on travel_runs: `travel_runs_owner_select` (RLS, 246) lets the owner
-- read their own run row straight through PostgREST — i.e. exactly the adversary would hold
-- the secret. Its own table, no anon/authenticated grant, no policy for them.

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
    'Per-run secret salt for the DRIFT dice (migration 264). Deliberately NOT a travel_runs column: RLS lets a traveller read their own run row, which would hand the secret to the one party it is kept from. No anon/authenticated grant, no RLS policy for them; read only through drift_run_salt() (SECURITY DEFINER) and service_role.';

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
    'The server-only term of every DRIFT seed (migration 264): returns the run''s secret salt, creating it on first use (so runs opened before the migration get one on their first roll, with no backfill). INTERNAL-class: service_role only.';

REVOKE ALL    ON FUNCTION public.drift_run_salt(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_run_salt(UUID) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. THE SHAPE OF A RUN (W2.6/D+E) — columns, one derivation, one consumer
-- ═══════════════════════════════════════════════════════════════════
-- The full reasoning is in the header. In short: the load-bearing run state stops being
-- untyped keys in a multi-writer jsonb and becomes columns with CHECKs; the loose haul stops
-- being a fourth, independent booking of money that is already recorded in two other places,
-- and becomes the SUM of those places.

-- ── 3.1 The columns ──────────────────────────────────────────────────────────

-- A Fund's freight remembers what it was worth. This is not a second booking of the haul —
-- since §3.2 it IS one of the haul's three sources, so removing the freight (a Notabwurf, a
-- fenced sale in W3) removes its haul by arithmetic, not by anyone remembering to debit it.
-- Quest cargo carries 0: its value is the Depesche's payout, not survey points.
ALTER TABLE public.travel_cargo
    ADD COLUMN IF NOT EXISTS haul_value INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.travel_cargo.haul_value IS
    'Survey points this freight is worth (Fund cargo, migration 264/W2.6). One of the three sources of travel_runs.haul (drift_haul_of) — NOT a copy of it. Deleting the row therefore removes its haul automatically; nothing has to remember to debit. Quest cargo carries 0.';

ALTER TABLE public.travel_runs
    -- The loose haul, DERIVED (§3.2/§3.3). No writer may set it: every write recomputes it.
    ADD COLUMN IF NOT EXISTS haul        INTEGER NOT NULL DEFAULT 0,
    -- Source 1 of the loose haul: the Erstvermessung a move pays for a first arrival. It has
    -- no other ledger, so it needs a column of its own.
    ADD COLUMN IF NOT EXISTS haul_survey INTEGER NOT NULL DEFAULT 0,
    -- The Funkboje's transmitted reserve. NOT part of `haul`: it is already ashore, and
    -- nothing after it — Havarie, Riss, Zerfaserung, Rückzug — can take it (that promise is
    -- the whole reason the Funkboje is a decision and not a formality).
    ADD COLUMN IF NOT EXISTS haul_safe   INTEGER NOT NULL DEFAULT 0,
    -- The Havarie's `ueberziehen` permit: every further Takt costs extra Dissonanz, and the
    -- expired window no longer collapses the run.
    ADD COLUMN IF NOT EXISTS overstay    BOOLEAN NOT NULL DEFAULT FALSE,
    -- {node_id: [marker_class, …]} — the open, countable Störungs-/Sondierungs-stack (R4).
    ADD COLUMN IF NOT EXISTS markers     JSONB   NOT NULL DEFAULT '{}'::jsonb,
    -- {node_id: {digs, yield, rissig}} — source 2 of the loose haul.
    ADD COLUMN IF NOT EXISTS sondierung  JSONB   NOT NULL DEFAULT '{}'::jsonb,
    -- The first-arrival set the Entladung delivers to the shared chart (Erstvermessung).
    ADD COLUMN IF NOT EXISTS visited     JSONB   NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_haul_check;
ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_haul_survey_check;
ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_haul_safe_check;
ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_markers_check;
ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_sondierung_check;
ALTER TABLE public.travel_runs DROP CONSTRAINT IF EXISTS travel_runs_visited_check;

ALTER TABLE public.travel_runs
    ADD CONSTRAINT travel_runs_haul_check        CHECK (haul        >= 0),
    ADD CONSTRAINT travel_runs_haul_survey_check CHECK (haul_survey >= 0),
    ADD CONSTRAINT travel_runs_haul_safe_check   CHECK (haul_safe   >= 0),
    ADD CONSTRAINT travel_runs_markers_check     CHECK (jsonb_typeof(markers)    = 'object'),
    ADD CONSTRAINT travel_runs_sondierung_check  CHECK (jsonb_typeof(sondierung) = 'object'),
    ADD CONSTRAINT travel_runs_visited_check     CHECK (jsonb_typeof(visited)    = 'array');

COMMENT ON COLUMN public.travel_runs.haul IS
    'The LOOSE haul — DERIVED, never written by hand (W2.6/E). haul = haul_survey + Σ sondierung[*].yield + Σ travel_cargo.haul_value, stated once in drift_haul_of() and materialised by trg_travel_runs_haul / trg_travel_cargo_haul: every write to any source recomputes it, so a direct UPDATE of this column is silently overwritten and a stale partial booking is unreachable. Consumed (banked, forfeited, halved) only through drift_haul_settle().';
COMMENT ON COLUMN public.travel_runs.haul_safe IS
    'The Funkboje''s transmitted reserve — already ashore. NOT part of `haul`, and untouched by the recall multiplier, a Resonanzriss, a Zerfaserung or a Rückzug: what you sent home, arrived. (Distinct from checkpoint.closing.haul_banked, which is the CLOSING RECEIPT of a finished run.)';
COMMENT ON COLUMN public.travel_runs.markers IS
    '{node_id: [marker_class, …]}. The open Sondierungs-/Störungs-marker stack — laid OPEN so the traveller can always COUNT it (R4: the odds are never numbered, the evidence always is). A Störung''s marker_add lands here too, so the Drift can poison a dig site.';
COMMENT ON COLUMN public.travel_runs.sondierung IS
    '{node_id: {digs, yield, rissig}}. `yield` is the LOOSE take dug at that node (a source of `haul`); `digs` places the node in the yield table; `rissig` marks it torn (the signal draw sends more Störungen through the tear). Banking zeroes `yield` and keeps the other two — banking does not un-dig a hole.';

COMMENT ON TABLE public.travel_runs IS
    'A DRIFT expedition in flight. Since W2.6 the run''s LIVE STATE lives in columns (haul/haul_survey/haul_safe/overstay/markers/sondierung/visited) and `checkpoint` holds ONLY the polymorphic SCENE PAYLOADS: pending_signal, last_signal, last_sondierung, last_bank, last_move, last_havarie, last_delivery, havarie, earnings, closing. The distinction is the load-bearing one: a column is WHAT IS TRUE, a checkpoint key is WHAT JUST HAPPENED. fn_travel_move rebuilds the checkpoint on every advance — which is safe precisely because nothing run-level is left in there to forget (the drift_checkpoint_carry whitelist that used to paper over this is gone).';

-- ── 3.2 drift_haul_of — THE definition of the loose haul, in one place ───────

CREATE OR REPLACE FUNCTION public.drift_haul_of(
    p_survey     INT,
    p_sondierung JSONB,
    p_run        UUID
) RETURNS INT
LANGUAGE sql
STABLE
AS $$
    -- The three sources, added. GREATEST(0, …) is belt and braces: the CHECKs already
    -- forbid a negative component, and a negative haul would be a lie in either direction.
    SELECT GREATEST(0,
        COALESCE(p_survey, 0)
      + COALESCE((SELECT sum((e.value ->> 'yield')::int)::int
                    FROM jsonb_each(COALESCE(p_sondierung, '{}'::jsonb)) AS e), 0)
      + COALESCE((SELECT sum(c.haul_value)::int
                    FROM public.travel_cargo c WHERE c.run_id = p_run), 0));
$$;

COMMENT ON FUNCTION public.drift_haul_of(INT, JSONB, UUID) IS
    'THE definition of a run''s loose haul (W2.6/E): haul_survey + Σ sondierung[*].yield + Σ travel_cargo.haul_value. Takes the first two as VALUES rather than reading them from the row, so the BEFORE trigger can compute from NEW (an uncommitted row is not readable from the table). Everything that needs the haul goes through this or through the column it materialises — there is exactly one place where the arithmetic is written down. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_haul_of(INT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_haul_of(INT, JSONB, UUID) TO service_role;

-- ── 3.3 The materialisation — no writer may set `haul` ──────────────────────
-- Two triggers, because the haul has two kinds of source: the run's own columns, and the
-- manifest. Together they make staleness UNREACHABLE rather than merely unlikely.

CREATE OR REPLACE FUNCTION public.trg_drift_run_haul()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Unconditional: whatever the statement tried to write into `haul` is discarded and the
    -- derivation put in its place. That is deliberate — it means an accidental (or a
    -- well-meaning) direct write cannot re-open the stale-booking bug class by hand.
    NEW.haul := drift_haul_of(NEW.haul_survey, NEW.sondierung, NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_travel_runs_haul ON public.travel_runs;
CREATE TRIGGER trg_travel_runs_haul
    BEFORE INSERT OR UPDATE ON public.travel_runs
    FOR EACH ROW EXECUTE FUNCTION public.trg_drift_run_haul();

CREATE OR REPLACE FUNCTION public.trg_drift_cargo_haul()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_run UUID := COALESCE(NEW.run_id, OLD.run_id);
BEGIN
    IF v_run IS NOT NULL THEN
        UPDATE travel_runs r
           SET haul = drift_haul_of(r.haul_survey, r.sondierung, r.id)
         WHERE r.id = v_run;
    END IF;
    RETURN NULL;   -- AFTER trigger: the return value is ignored
END;
$$;

-- The WHEN guards are not an optimisation, they are what keeps this from re-entering: the
-- close-cleanup trigger (250) DELETEs the manifest during a travel_runs UPDATE, and without
-- the guard every such close would fire a nested UPDATE back onto the row being updated.
-- Every closing path settles the haul to zero BEFORE the status flip (drift_haul_settle), so
-- by the time the cleanup runs there is no haul_value left to be relevant — and the guard
-- says so out loud.
DROP TRIGGER IF EXISTS trg_travel_cargo_haul_ins ON public.travel_cargo;
CREATE TRIGGER trg_travel_cargo_haul_ins
    AFTER INSERT ON public.travel_cargo
    FOR EACH ROW WHEN (NEW.haul_value <> 0)
    EXECUTE FUNCTION public.trg_drift_cargo_haul();

DROP TRIGGER IF EXISTS trg_travel_cargo_haul_upd ON public.travel_cargo;
CREATE TRIGGER trg_travel_cargo_haul_upd
    AFTER UPDATE ON public.travel_cargo
    FOR EACH ROW WHEN (NEW.haul_value IS DISTINCT FROM OLD.haul_value
                       OR NEW.run_id IS DISTINCT FROM OLD.run_id)
    EXECUTE FUNCTION public.trg_drift_cargo_haul();

DROP TRIGGER IF EXISTS trg_travel_cargo_haul_del ON public.travel_cargo;
CREATE TRIGGER trg_travel_cargo_haul_del
    AFTER DELETE ON public.travel_cargo
    FOR EACH ROW WHEN (OLD.haul_value <> 0)
    EXECUTE FUNCTION public.trg_drift_cargo_haul();

-- ── 3.4 drift_haul_settle — the ONE consumer of the loose haul ───────────────
-- Banking it (Funkboje, Entladung, Rückruf), forfeiting it (Zerfaserung, Rückzug, the
-- gate-off collapse) and halving it (Notruf) are the same act: the three sub-ledgers are
-- collapsed into ONE number, all at once. There is no way to settle half of them — which is
-- exactly the bug the Funkboje shipped with.
--
-- `digs` and `rissig` deliberately SURVIVE: they describe the NODE (its place in the yield
-- table, its torn state), not the haul. Banking does not un-dig a hole.

CREATE OR REPLACE FUNCTION public.drift_haul_settle(p_run UUID, p_keep NUMERIC)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total INT;
BEGIN
    SELECT r.haul INTO v_total FROM travel_runs r WHERE r.id = p_run;
    IF v_total IS NULL THEN
        RAISE EXCEPTION 'drift_haul_settle: run not found' USING ERRCODE = 'P0002';
    END IF;

    -- Both sub-ledgers to zero, and whatever survives the settlement lands in the one column
    -- that has no other ledger behind it. floor(): the Bureau never rounds in the traveller's
    -- favour, and an integer haul keeps every downstream payout exact.
    UPDATE travel_cargo SET haul_value = 0 WHERE run_id = p_run AND haul_value <> 0;

    UPDATE travel_runs r SET
        haul_survey = floor(v_total * p_keep)::int,
        sondierung  = COALESCE((
            SELECT jsonb_object_agg(e.key, e.value || jsonb_build_object('yield', 0))
              FROM jsonb_each(r.sondierung) AS e), '{}'::jsonb)
     WHERE r.id = p_run;

    RETURN v_total;   -- the loose haul as it stood BEFORE the settlement
END;
$$;

COMMENT ON FUNCTION public.drift_haul_settle(UUID, NUMERIC) IS
    'The single CONSUMER of a run''s loose haul (W2.6/E). Collapses all three sub-ledgers at once — travel_cargo.haul_value → 0, sondierung[*].yield → 0, and floor(haul × p_keep) into haul_survey — and returns the loose haul as it stood BEFORE. p_keep: 0 for a bank/forfeit (Funkboje, Entladung, Zerfaserung, Rückzug, Kollaps), the notruf multiplier for a rescue. Nothing else may empty a sub-ledger: the Funkboje once emptied ONE of the three and left two standing, which over-confiscated on a later bust AND made the bust free (dig → bank → dig → bank, the Funkboje costs no Takt), deleting the push-your-luck of the whole wave. `digs`/`rissig` survive — they describe the node, not the haul. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_haul_settle(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_haul_settle(UUID, NUMERIC) TO service_role;

-- ── 3.5 Backfill — an in-flight run must not lose what it has earned ─────────
-- On prod, DRIFT P0 is LIVE (drift_p0_enabled = true) and travellers are mid-run with their
-- accrued haul and their visited set in the checkpoint. Deploying the new shape without this
-- would silently confiscate both.
--
-- Guarded by `checkpoint ?| ARRAY[…]` so it is idempotent: a re-apply finds no row still
-- carrying the old keys and touches nothing. (Without the guard, a second run would read the
-- already-stripped checkpoint as zero and wipe the columns it had just filled.)
--
-- haul_survey gets the haul MINUS the two sub-ledgers, so nothing is double-counted: on prod
-- both are empty (the Fun-Kern never ran there) and this reduces to checkpoint.haul, but on a
-- dev database mid-W2 it is the only correct answer.

UPDATE public.travel_runs r SET
    haul_survey = GREATEST(0,
        COALESCE((r.checkpoint ->> 'haul')::int, 0)
      - COALESCE((SELECT sum((e.value ->> 'yield')::int)::int
                    FROM jsonb_each(COALESCE(r.checkpoint -> 'sondierung', '{}'::jsonb)) AS e), 0)
      - COALESCE((SELECT sum(c.haul_value)::int
                    FROM travel_cargo c WHERE c.run_id = r.id), 0)),
    haul_safe   = COALESCE((r.checkpoint ->> 'haul_safe')::int, 0),
    overstay    = COALESCE((r.checkpoint ->> 'overstay')::boolean, FALSE),
    markers     = COALESCE(r.checkpoint -> 'markers', '{}'::jsonb),
    sondierung  = COALESCE(r.checkpoint -> 'sondierung', '{}'::jsonb),
    visited     = COALESCE(r.checkpoint -> 'visited', '[]'::jsonb),
    -- The keys have moved out. Leaving copies behind would be worse than useless: two places
    -- claiming the same fact is how this whole class of bug started.
    checkpoint  = r.checkpoint - 'haul' - 'haul_safe' - 'overstay' - 'markers'
                              - 'sondierung' - 'visited' - 'position_node_id'
 WHERE r.checkpoint ?| ARRAY['haul', 'haul_safe', 'overstay', 'markers', 'sondierung',
                            'visited', 'position_node_id'];

-- ── 3.6 The dead ────────────────────────────────────────────────────────────
-- Both existed only in unmerged iterations of this wave; a fresh database never creates them.
-- Dropped explicitly so a development database that ran the earlier drafts converges on the
-- same schema as CI — and so nobody finds them and wonders what they are for.
--
--   drift_checkpoint_carry  — the whitelist of checkpoint keys that survived a move. It only
--                             existed because fn_travel_move rebuilt the checkpoint; with the
--                             run-level state in columns there is nothing left to carry.
--   fn_travel_jettison_haul — subtracted a jettisoned Fund's haul from checkpoint.haul.
--                             Deleting the cargo row now does that by arithmetic (§3.2).
DROP FUNCTION IF EXISTS public.drift_checkpoint_carry(JSONB);
DROP FUNCTION IF EXISTS public.fn_travel_jettison_haul(UUID, UUID[]);


-- ═══════════════════════════════════════════════════════════════════
-- 3b. travel_log_entries — das Logbuch (R12)
-- ═══════════════════════════════════════════════════════════════════
-- Every signal, every revealed rumour, every dig, every bank and every Havarie writes one
-- line. It is the "resuming is free" anchor: a traveller who comes back after a week reads
-- three lines and knows where they were and what they know.
--
-- It lives in the FOUNDATION, not with the signals that were its first writer, because by the
-- end of the wave four different files write to it (Havarie 265, signals 267, Sondierung +
-- Funkboje 268) — and a table whose DDL sits downstream of half its writers is a migration
-- ordering accident waiting to happen.
--
-- Rows OUTLIVE their run (run_id ON DELETE SET NULL, no TTL, no cleanup): deleting a run must
-- not delete what the traveller LEARNED on it. The run is the journey, the logbook is the
-- career — and knowledge is the one thing a courier carries home that a Havarie cannot
-- scatter.

CREATE TABLE IF NOT EXISTS public.travel_log_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id     UUID REFERENCES travel_runs(id) ON DELETE SET NULL,
    takt       INTEGER NOT NULL DEFAULT 0,
    kind       TEXT NOT NULL,
    node_id    UUID REFERENCES drift_chart_nodes(id) ON DELETE SET NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT travel_log_entries_kind_check CHECK (
        kind IN ('signal', 'rumor', 'bank', 'havarie', 'sondierung')
    )
);

COMMENT ON TABLE public.travel_log_entries IS
    'The traveller''s logbook (M1/R12): one line per signal, revealed rumour, dig, bank and Havarie. Owner-read, RPC-written. Outlives its run (run_id ON DELETE SET NULL) — knowledge is the only thing a courier carries home that a Havarie cannot scatter, and it is what makes coming back after a week free.';

CREATE INDEX IF NOT EXISTS idx_travel_log_entries_user_time
    ON public.travel_log_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_log_entries_run
    ON public.travel_log_entries (run_id);

ALTER TABLE public.travel_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_log_entries_owner_select ON public.travel_log_entries;
CREATE POLICY travel_log_entries_owner_select
    ON public.travel_log_entries FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS travel_log_entries_service_role ON public.travel_log_entries;
CREATE POLICY travel_log_entries_service_role
    ON public.travel_log_entries FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON public.travel_log_entries TO authenticated;
GRANT ALL    ON public.travel_log_entries TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3c. Telemetry vocabulary (KPI F1/F5)
-- ═══════════════════════════════════════════════════════════════════
-- Same reasoning as the logbook: the CHECK constrains a column written from four files, so it
-- belongs where the shape is defined, not where the first writer happens to live.

ALTER TABLE public.travel_telemetry_events
    DROP CONSTRAINT IF EXISTS travel_telemetry_events_event_key_check;
ALTER TABLE public.travel_telemetry_events
    ADD CONSTRAINT travel_telemetry_events_event_key_check CHECK (
        event_key IN (
            'drift_first_session_start', 'drift_first_foreign_dock', 'drift_run_opened',
            'drift_run_closed', 'drift_quest_completed', 'drift_decision',
            'drift_zerfaserung', 'drift_rescue',
            -- Welle 2: the decision counters KPI F1 ("median >= 4 decisions per run") and
            -- F5 (the bust that feels good) are measured from.
            'drift_signal_shown', 'drift_signal_resolved', 'drift_sondierung', 'drift_bank'
        )
    );


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_drift_award — the SINGLE writer of the Siegel/VP ledger
-- ═══════════════════════════════════════════════════════════════════
-- Credits only (a debit has different failure semantics — see fn_clearance_exam's guarded
-- CAS). One atomic increment (no fetch-compute-update, ADR-007), one audit row, one return
-- shape that every payer reuses. Callers pass a source tag; the audit row carries it, so a
-- ledger movement is always traceable to the act that caused it.

CREATE OR REPLACE FUNCTION public.fn_drift_award(
    p_user    UUID,
    p_source  TEXT,     -- 'dispatch' | 'entladung' | 'rueckruf' | 'signal:…' | …_transmitted
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
    'The single writer of the DRIFT Siegel/VP ledger (plan §3 Schritt 1.1). Atomic increment on traveler_profiles (no read-modify-write, ADR-007), one travel_award audit row carrying the source tag, one return shape {source, siegel_earned, vp_earned, siegel_balance, vp_total, clearance_rank} reused by every payer — it is the EarningsBlock the HUD''s count-up ceremony reads. Credits only — 22023 on a negative delta; debits use their own guarded CAS (fn_clearance_exam) because an insufficient balance must fail, not clamp. A zero award is a legitimate no-op and writes no audit noise. INTERNAL-class: REVOKE anon+authenticated, GRANT service_role.';

REVOKE ALL    ON FUNCTION public.fn_drift_award(UUID, TEXT, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_award(UUID, TEXT, INT, INT, UUID) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_quest_advance — the Depesche finally pays (M4)
-- ═══════════════════════════════════════════════════════════════════
-- Body of migration 249, plus: after the effects fire and the cargo is consumed, a gated
-- payout. Siegel is a deterministic roll in [siegel_min, siegel_max] seeded with
-- salt:run:instance:takt — the same delivery always pays the same, but two deliveries in a
-- run differ. VP is flat (the rank ladder is not a slot machine).
--
-- Gate off ⇒ byte-identical to 249: no award, no 'earnings' key.

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
        -- Seed = SECRET : run : instance : takt. Without the salt (§2b) the roll would be
        -- precomputable and the dice pointless.
        v_siegel := drift_rand_int(
            drift_run_salt(p_run) || ':' || p_run::text || ':' || p_instance::text
                || ':' || v_run.takt_count::text,
            COALESCE((v_reward ->> 'siegel_min')::int, 8),
            COALESCE((v_reward ->> 'siegel_max')::int, 12));
        v_vp := COALESCE((v_reward ->> 'vp')::int, 10);
        v_earnings := fn_drift_award(p_user, 'dispatch', v_siegel, v_vp, p_run);
    END IF;

    -- Consume the delivered cargo + close the instance. (Quest cargo carries haul_value 0,
    -- so this DELETE moves no haul — see the WHEN guard on trg_travel_cargo_haul_del.)
    DELETE FROM travel_cargo WHERE id = v_cargo_id;
    UPDATE travel_quest_instances SET status = 'completed' WHERE id = p_instance RETURNING * INTO v_inst;

    UPDATE travel_runs
       SET run_version = run_version + 1, event_seq = event_seq + 1,
           checkpoint = v_run.checkpoint
               || jsonb_build_object('last_delivery',
                      jsonb_build_object('instance', p_instance, 'target_sim', v_target_sim))
               -- The receipt rides the checkpoint too, so a refetch (or a second device) can
               -- still stage the Zeremonie without replaying the RPC. TOP level, because that
               -- is where the one reader looks: TravelRunResponse lifts `checkpoint.earnings`
               -- into its typed `earnings` field (models/drift.py).
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
-- 6. fn_clearance_exam — the rank ladder gets its first rung (M6)
-- ═══════════════════════════════════════════════════════════════════
-- PLAYER-class. No run required: the exam is sat at the Bureau, between expeditions.
--
-- The promotion is ONE guarded UPDATE — the WHERE clause IS the compare-and-swap (rank
-- unchanged AND vp >= threshold AND siegel >= fee). Two concurrent exam clicks: the first
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

    -- The gate refuses to CREATE state — and a promotion is nothing but new state. There is
    -- nothing here to drain (a rank already held is not Fun-Kern residue in flight), so this
    -- is the plain refusal, and the router no longer duplicates it (W2.6/A).
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
    'Sit the Bureau clearance exam for p_rank (M6, plan §3 Schritt 1.1). PLAYER-class: auth.uid() = p_user guard, GRANT authenticated + service_role. Gate-checked in SQL — and ONLY in SQL (W2.6/A): GATE_CLOSED/22023 while the Fun-Kern is down. Requires vp >= clearance_thresholds[rank] and siegel >= clearance_exam_fee[rank]; the promotion + fee is ONE guarded UPDATE whose WHERE clause is the CAS, so two concurrent clicks can never double-charge (ADR-007). On a miss it re-reads the row and raises the TRUE reason: RANK_ALREADY_HELD (22023), VP_TOO_LOW / SIEGEL_TOO_LOW (P0001). Audited travel_clearance_exam. From W3 it also unlocks the architecture vector.';


-- ═══════════════════════════════════════════════════════════════════
-- 7. Grants — player-class posture (CREATE OR REPLACE preserves ACLs; explicit for intent)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_clearance_exam(uuid, text)',
        'fn_quest_advance(uuid, uuid, integer, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;

COMMIT;
