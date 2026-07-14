-- Migration 265: DRIFT Fun-Kern — der Lebenszyklus eines Runs: die Havarie und die
--                 vier Wege hinaus
--
-- Plan:    docs/plans/drift-fun-core-implementation-plan.md §3 Schritt 1.3 (M3)
--          docs/plans/drift-w25-architecture-consolidation-plan.md (C, D, E)
-- Concept: docs/concepts/drift-gameplay-redesign-concept.md (D5 "der Kollaps ist ein Snap").
--
-- THE P0 HOLE THIS CLOSES
-- -----------------------
-- In P0 the run's failure floor is a SNAP: Kohärenz hits 0 (or the Aufenthaltsfenster runs
-- out far from home) and fn_travel_move silently teleports the traveller home, forfeits the
-- haul, scatters the cargo and closes the run 'abandoned' — all inside the move the player
-- just made, with no decision, no reading, no agency. The single most dramatic moment of a
-- run was the one moment the player was not allowed to play.
--
-- 265 turns the floor into a SCENE: the run enters the new status `havarie` and STOPS.
-- Nothing is lost yet. The traveller chooses:
--
--   Kohärenz on the floor  → notabwurf   (jettison chosen cargo as ballast: Kohärenz back,
--                                         two Takte of the window gone, the rest stays aboard)
--                          → notruf      (keep everything, but the Bureau tows you home:
--                                         half the haul, a 10-Siegel debt on your record)
--                          → zerfaserung (the P0 ending, now CHOSEN: cargo scatters as
--                                         echoes into the worlds it was headed for)
--   Window expired away    → ueberziehen (stay past your permit: every further Takt costs
--                                         +5 Dissonanz — the Bleed notices you overstaying)
--                          → rueckruf    (an orderly recall: the haul survives at 70 %)
--
-- Every option is a real trade with a real cost. None of them is a punishment screen.
--
-- ── This file owns THE END OF A RUN, in all five of its forms ────────────────
-- W2.6/C: every function is defined exactly ONCE, in its final form. Before the
-- consolidation `fn_travel_bank_run`, `fn_travel_zerfasern` and `fn_travel_havarie_resolve`
-- each existed twice across the unmerged 264–268, so reading one meant diffing three files —
-- and re-applying an EARLIER migration silently reverted a LATER fix (measured: three tests
-- went red exactly that way).
--
--   fn_travel_bank_run       — the ONE banking path (Entladung 1.0, Rückruf 0.7)
--   fn_travel_complete       — guards + the at-home check + bank(1.0)
--   fn_travel_zerfasern      — the ONE unravelling (chosen, TTL-expired, gate-drained)
--   fn_travel_abandon        — the Rückzug
--   fn_travel_havarie_resolve— the decision
--   fn_travel_run_open       — the start (+ the lazy TTL sweep of a wreck left standing)
--   fn_drift_emergency_return— the admin kill-switch
--   drift_closing_payload    — the closing RECEIPT, built in ONE place
--   drift_havarie_payload    — the wreck's option catalogue, built in ONE place
--
-- ── The receipt has one author (W2.6/B) ─────────────────────────────────────
-- Four functions end a run, and each used to hand-build its own flat set of checkpoint keys
-- (`haul_banked`, `haul_lost`, `close_reason`, `honors_won`, `scattered`, …). A key name in
-- that jsonb IS the API contract — the Pydantic model lifts it into a typed field — and four
-- hand-built copies of a contract is how the copies diverge. They now all call
-- `drift_closing_payload()`, and the checkpoint of a closed run is exactly one block:
-- `closing` (plus the `earnings` receipt, when money moved).
--
-- ── One deliberate asymmetry, and it is not a bug ────────────────────────────
-- With the gate CLOSED a run still pays out its Funkboje reserve (haul_safe): a transmitted
-- reserve is not Fun-Kern residue, it is money the traveller already brought ashore under an
-- OPEN gate — and it can be non-zero no other way, so a run that never saw the Fun-Kern is
-- untouched and rollback parity holds where it can be held. W2.6 makes the RECEIPT follow the
-- money on every such path: if an award happened, `earnings` is written. (fn_travel_zerfasern
-- did this; fn_travel_bank_run hid it, so a gate-off Entladung credited real Siegel with no
-- ceremony and a HUD that kept showing the old balance. A receipt for money that actually
-- moved is not residue — hiding it is just a lie.)
--
-- TTL WITHOUT A SCHEDULER (plan §3.3)
-- -----------------------------------
-- A run parked in `havarie` forever would hold the single-active-run slot hostage. The
-- checkpoint carries `expires_at` (48 h, tuning); expiry is finalised LAZILY on the next
-- access — fn_travel_havarie_resolve forces zerfaserung on an expired run whatever the player
-- picked, and fn_travel_run_open sweeps an expired Havarie before it opens the next run. No
-- new scheduler process, no zombie slot.
--
-- THE SCAR
-- --------
-- `zerfaserung_count` is incremented where the run ACTUALLY unravels — never when the Havarie
-- merely opens. A Havarie survived is not a Zerfaserung; a counter that says otherwise is a
-- lie about the traveller's record.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Schema: the new status + the single-active-run invariant
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE travel_runs DROP CONSTRAINT IF EXISTS travel_runs_status_check;
ALTER TABLE travel_runs ADD CONSTRAINT travel_runs_status_check
    CHECK (status = ANY (ARRAY[
        'active', 'frozen', 'distress',
        'havarie',      -- NEW: stranded, awaiting the traveller's choice (265)
        'finalizing', 'completed', 'abandoned'
    ]));

-- A Havarie is an OPEN run: it must occupy the single-active slot, or a stranded traveller
-- could simply open a second run and walk away from the wreck.
DROP INDEX IF EXISTS uq_travel_runs_single_active;
CREATE UNIQUE INDEX uq_travel_runs_single_active
    ON travel_runs (user_id)
    WHERE status IN ('active', 'frozen', 'distress', 'havarie');


-- ═══════════════════════════════════════════════════════════════════
-- 2. Zahlenwerk (plan §2.3 — data, never literals)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO drift_tuning (setting_key, value, description) VALUES
    ('havarie_options',
     '{"notabwurf":   {"kh_restore": 30, "window_cost": 2},
       "notruf":      {"kh_restore": 20, "haul_mult": 0.5, "siegel_debt": 10},
       "zerfaserung": {},
       "ueberziehen": {"dz_per_takt": 5},
       "rueckruf":    {"haul_mult": 0.7}}'::jsonb,
        'The Havarie option catalogue (M3). Kohärenz-Havarie: notabwurf (jettison cargo as ballast → +30 KH, −2 Takte), notruf (keep the manifest, the Bureau tows you home → half the haul + a 10-Siegel debt on the record), zerfaserung (the P0 ending, now chosen). Fenster-Havarie: ueberziehen (stay past the permit → +5 DZ per further Takt), rueckruf (orderly recall → 70 % of the haul survives). Every option is a trade; none is a punishment screen.'),
    ('havarie_ttl_hours', '48'::jsonb,
        'How long a Havarie waits for its decision before the Drift decides for you (auto-zerfaserung). Finalised lazily on the next access (resolve / run_open) — no scheduler process in P0.5.')
ON CONFLICT (setting_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 3. drift_havarie_payload — the wreck's option catalogue, in ONE place
-- ═══════════════════════════════════════════════════════════════════
-- Three functions can now end a run in a Havarie (a move, a resolved Störung, a dig that
-- spends the last Takt), and three hand-built catalogues is how the notabwurf rules silently
-- diverge. Pure builder; each caller still does its own UPDATE (they touch different columns)
-- and its own audit.

CREATE OR REPLACE FUNCTION public.drift_havarie_payload(
    p_run UUID, p_cause TEXT, p_haul INT, p_window INT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opts    JSONB := drift_tuning_value('havarie_options');
    v_cargo_n INT;
    v_options JSONB;
BEGIN
    SELECT count(*) INTO v_cargo_n FROM travel_cargo WHERE run_id = p_run;

    -- Notabwurf is offered only when there is cargo to throw AND at least one Takt survives
    -- its price — otherwise the run returns to 'active' with 0 Takte and drops straight back
    -- into the same Havarie: cargo gone, Depeschen failed, nothing bought. (W1/1.5 P1.
    -- A dead option is worse than no option — it promises an out the traveller cannot take.)
    v_options := CASE
        WHEN p_cause = 'kohaerenz' AND v_cargo_n > 0
             AND p_window > COALESCE((v_opts #>> '{notabwurf,window_cost}')::int, 2)
            THEN '["notabwurf","notruf","zerfaserung"]'::jsonb
        WHEN p_cause = 'kohaerenz'
            THEN '["notruf","zerfaserung"]'::jsonb
        ELSE '["ueberziehen","rueckruf"]'::jsonb
    END;

    RETURN jsonb_build_object(
        'cause', p_cause,
        'options', v_options,
        'cargo_aboard', v_cargo_n,
        'haul_at_risk', p_haul,
        'catalogue', v_opts,     -- the numbers, so the panel can state them
        'expires_at', (now() + make_interval(
            hours => COALESCE((drift_tuning_value('havarie_ttl_hours'))::int, 48)))
    );
END;
$$;

COMMENT ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) IS
    'Builds the Havarie checkpoint block (cause, option catalogue, cargo aboard, haul at risk, the tuning numbers so the panel can STATE them, and the 48 h TTL). One builder, because three different functions can now strand a run — a move, a resolved Störung, a dig that spends the last Takt — and three hand-built catalogues is how the notabwurf rules diverge. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_havarie_payload(UUID, TEXT, INT, INT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4. drift_closing_payload — the closing RECEIPT, built in ONE place (W2.6/B)
-- ═══════════════════════════════════════════════════════════════════
-- Five ways a run ends, one shape for the debriefing. The key names here ARE the API
-- contract: models/drift.ClosingReceipt lifts this block into a typed field, and the HUD's
-- Bureau debriefing reads nothing else. Four hand-built copies of that contract is exactly
-- what W2.6 exists to end.
--
-- `haul_transmitted` is the one Fun-Kern-only key: with the gate shut the receipt must carry
-- no Fun-Kern fact at all (the rollback contract). The MONEY still moves in that case (a
-- transmitted reserve is not residue — see the file header) and the `earnings` block the
-- caller writes alongside says so.

CREATE OR REPLACE FUNCTION public.drift_closing_payload(
    p_reason      TEXT,      -- entladung | rueckruf | zerfaserung | rueckzug | kollaps
    p_cause       TEXT,      -- kohaerenz | window | NULL (it did not end badly)
    p_detail      TEXT,      -- choice | ttl_expired | gate_closed | NULL
    p_banked      INT,       -- what was lodged into the lifetime survey stat
    p_lost        INT,       -- the loose haul the Drift kept
    p_transmitted INT,       -- the Funkboje reserve that arrived anyway
    p_before      INT,       -- the loose haul BEFORE a multiplier (recall) | NULL
    p_mult        NUMERIC,   -- the multiplier that was applied | NULL
    p_survey      JSONB,     -- fn_survey_deliver's return | NULL (nothing was delivered)
    p_scatter     JSONB,     -- fn_drift_scatter_cargo's return | NULL (nothing scattered)
    p_fun_core    BOOLEAN
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
               'reason',      p_reason,
               'haul_banked', COALESCE(p_banked, 0),
               'haul_lost',   COALESCE(p_lost, 0))
        -- jsonb_build_object EMITS a null-valued key rather than omitting it, so every
        -- optional field is merged conditionally: a receipt full of "cause": null would be
        -- noise, and a stray key is exactly how a contract rots.
        || CASE WHEN p_cause   IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('cause', p_cause) END
        || CASE WHEN p_detail  IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('detail', p_detail) END
        || CASE WHEN p_before  IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('haul_before', p_before) END
        || CASE WHEN p_mult    IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('haul_mult', p_mult) END
        || CASE WHEN p_survey  IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
               'surveys_delivered', p_survey -> 'surveys_delivered',
               'honors_won',        p_survey -> 'honors_won',
               'honor_keys',        p_survey -> 'honor_keys') END
        || CASE WHEN p_scatter IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('scattered', p_scatter) END
        || CASE WHEN p_fun_core THEN jsonb_build_object('haul_transmitted', COALESCE(p_transmitted, 0))
                ELSE '{}'::jsonb END;
$$;

COMMENT ON FUNCTION public.drift_closing_payload(TEXT, TEXT, TEXT, INT, INT, INT, INT, NUMERIC, JSONB, JSONB, BOOLEAN) IS
    'The closing receipt of a DRIFT run (W2.6/B), in ONE place. Five endings (entladung, rueckruf, zerfaserung, rueckzug, kollaps) write the same block into checkpoint.closing, which models/drift.ClosingReceipt lifts into a typed field and the HUD''s Bureau debriefing reads. Before the consolidation four functions hand-built four flat key sets for the same contract. Optional fields are merged conditionally, never emitted as null-valued keys. `haul_transmitted` is the only gated key: with the gate shut the receipt carries no Fun-Kern fact — while the reserve itself still pays (money already brought ashore is not residue), and the caller''s `earnings` block says so. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.drift_closing_payload(TEXT, TEXT, TEXT, INT, INT, INT, INT, NUMERIC, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drift_closing_payload(TEXT, TEXT, TEXT, INT, INT, INT, INT, NUMERIC, JSONB, JSONB, BOOLEAN) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_travel_bank_run — the ONE banking path
-- ═══════════════════════════════════════════════════════════════════
-- Everything an Entladung does after its guards, parameterised by a haul multiplier so the
-- Havarie's `rueckruf` (0.7) and a clean Entladung (1.0) cannot drift apart. The LOOSE haul
-- takes the multiplier; the Funkboje reserve does NOT — it is already ashore, and that
-- promise has to hold on every closing path or banking would be a hedge against a rounding
-- decision rather than a gamble.
--
-- INTERNAL-class: the caller has already locked the run and validated the CAS + ownership.

CREATE OR REPLACE FUNCTION public.fn_travel_bank_run(
    p_user      UUID,
    p_run       UUID,
    p_haul_mult NUMERIC,
    p_source    TEXT      -- 'entladung' | 'rueckruf'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_anchor     UUID;
    v_loose      INT;
    v_kept       INT;
    v_safe       INT;
    v_haul       INT;
    v_keys       TEXT[];
    v_survey     JSONB;
    v_fun_core   BOOLEAN;
    v_honors     INT := 0;
    v_erstv      JSONB;
    v_siegel     INT := 0;
    v_vp         INT := 0;
    v_earnings   JSONB := NULL;
BEGIN
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;

    v_safe := v_run.haul_safe;

    -- Consume the loose haul: all three sub-ledgers at once (drift_haul_settle, 264/§3.4),
    -- and BEFORE the manifest is deleted below — the cargo rows are one of the three, so
    -- reading them afterwards would read zero.
    v_loose := drift_haul_settle(p_run, 0);
    v_kept  := floor(v_loose * p_haul_mult)::int;   -- floor: the Bureau never rounds your way
    v_haul  := v_kept + v_safe;

    -- Lodge into the lifetime survey stat (the P0 counter).
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Deliver every FIRST-arrival node of this run to the shared chart + claim the
    -- Erstvermessung honors first-write-wins (253). Honors are NOT scaled by the multiplier:
    -- you either charted the node or you did not.
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_run.visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    -- Close out any Depesche still aboard (delivered cargo was consumed at delivery, so
    -- whatever is left is undelivered → its instance must not stay 'active' on a closed run,
    -- or the next fn_quest_accept hits QUEST_ACTIVE forever — the 256 lockout).
    UPDATE travel_quest_instances qi
       SET status = 'failed'
      FROM travel_cargo c
     WHERE c.run_id = p_run AND c.quest_instance_id = qi.id AND qi.status = 'active';
    DELETE FROM travel_cargo WHERE run_id = p_run;

    -- ── The payout ───────────────────────────────────────────────────────────
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    IF v_fun_core THEN
        v_honors := COALESCE((v_survey ->> 'honors_won')::int, 0);
        v_erstv  := drift_tuning_value('reward_erstvermessung');
        v_vp     := v_haul * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1)
                    + v_honors * COALESCE((v_erstv ->> 'vp')::int, 25);
        v_siegel := floor(v_haul * COALESCE((drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int
                    + v_honors * COALESCE((v_erstv ->> 'siegel')::int, 40);
        v_earnings := fn_drift_award(p_user, p_source, v_siegel, v_vp, p_run);
    ELSIF v_safe > 0 THEN
        -- GATE CLOSED, BUT THE RESERVE STILL PAYS. Same ruling as fn_travel_zerfasern and
        -- fn_travel_abandon: a transmitted reserve is not Fun-Kern residue, it is money the
        -- traveller already brought ashore under an OPEN gate (haul_safe can be non-zero no
        -- other way, so a run that never saw the Fun-Kern is untouched and parity holds).
        -- This is the likeliest closing path of all — the traveller simply walks home and
        -- files the Entladung — and it was the one that had not been told: a rollback flipped
        -- mid-run would have let the haul flow into vermessung_lodged while paying 0 Siegel,
        -- and a Rückzug would have paid better than arriving. The LOOSE haul and the honors
        -- stay gated (they are earned by the wave's mechanics); only the reserve is settled.
        v_vp     := v_safe * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1);
        v_siegel := floor(v_safe * COALESCE(
            (drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int;
        v_earnings := fn_drift_award(p_user, p_source || '_transmitted', v_siegel, v_vp, p_run);
    END IF;

    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           -- On a closed run the checkpoint IS the receipt. Nothing else in there outlives
           -- the journey, and a stale scene block on a finished run is only ever a bug
           -- waiting for a HUD to render it.
           checkpoint = jsonb_build_object('closing', drift_closing_payload(
                   p_source,                                        -- entladung | rueckruf
                   NULL, NULL,
                   v_haul, v_loose - v_kept, v_safe,
                   CASE WHEN p_source <> 'entladung' THEN v_loose      END,
                   CASE WHEN p_source <> 'entladung' THEN p_haul_mult  END,
                   v_survey, NULL, v_fun_core))
               -- The receipt follows the money: if an award happened — gated OR the ungated
               -- reserve settlement above — the HUD gets its ceremony. Hiding a payment that
               -- actually happened is not parity, it is a lie (W2.6).
               || CASE WHEN v_earnings IS NULL THEN '{}'::jsonb
                       ELSE jsonb_build_object('earnings', v_earnings) END
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_complete', 'travel_run', p_run, NULL,
        jsonb_build_object('takt_count', v_run.takt_count, 'haul_banked', v_haul,
                           'haul_transmitted', v_safe,
                           'source', p_source, 'honors_won', v_survey -> 'honors_won'));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) IS
    'The single banking path for a DRIFT run. The LOOSE haul (drift_haul_settle) takes the multiplier — 1.0 for a clean Entladung, 0.7 for a Havarie-Rückruf, so the two can never drift apart; the Funkboje reserve (travel_runs.haul_safe) does NOT: it is already ashore, and that promise has to hold on every closing path. Lodges the total into the lifetime survey stat, delivers the surveyed nodes + claims Erstvermessung honors (never scaled: you charted the node or you did not), fails/forfeits any Depesche still aboard, pays through fn_drift_award, and closes the run ''completed'' with checkpoint.closing as its receipt. With the gate SHUT the reserve still pays (money brought ashore under an open gate is not residue) and the earnings receipt says so; the loose haul and the honors stay gated. INTERNAL-class: assumes the caller locked the run and validated ownership + the run_version CAS.';

REVOKE ALL    ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_travel_complete — guards + the at-home check + bank(1.0)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_travel_complete(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run     travel_runs%ROWTYPE;
    v_anchor  UUID;
    v_is_home BOOLEAN;
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

    RETURN fn_travel_bank_run(p_user, p_run, 1.0, 'entladung');
END;
$$;

COMMENT ON FUNCTION public.fn_travel_complete(UUID, UUID, INT) IS
    'Entladung — close the run at the home broadcast edge. PLAYER-class (auth.uid() guard, run_version CAS). Guards + the at-home check; everything after that is fn_travel_bank_run at multiplier 1.0, so a clean arrival and a Havarie-Rückruf can never bank differently. NOT gate-checked: the Entladung of a run that is already in flight must remain possible after a rollback — the gate lives inside fn_travel_bank_run, where it decides what is PAID, not whether the traveller may come home.';


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_travel_zerfasern — the unravelling, in ONE place
-- ═══════════════════════════════════════════════════════════════════
-- Reached from the chosen `zerfaserung` option, from the TTL sweep, and from the gate-closed
-- drain. INTERNAL-class.

CREATE OR REPLACE FUNCTION public.fn_travel_zerfasern(
    p_user   UUID,
    p_run    UUID,
    p_reason TEXT      -- 'choice' | 'ttl_expired' | 'gate_closed'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_anchor    UUID;
    v_home      UUID;
    v_cause     TEXT;
    v_loose     INT;
    v_safe      INT;
    v_scatter   JSONB;
    v_fun_core  BOOLEAN;
    v_earnings  JSONB := NULL;
    v_siegel    INT := 0;
    v_vp        INT := 0;
BEGIN
    -- FOR UPDATE + open-status guard = idempotency. Two concurrent callers CAN reach this
    -- (fn_travel_run_open's TTL sweep is reachable from a double-clicked Aufbruch), and an
    -- unravelling is not repeatable: it would scatter the manifest twice, audit twice, and —
    -- worst — add TWO scars to a record that can never be cleared. The second caller finds
    -- the run already closed and returns it untouched.
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_zerfasern: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status NOT IN ('active', 'frozen', 'distress', 'havarie') THEN
        RETURN to_jsonb(v_run);
    END IF;

    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    v_cause    := COALESCE(v_run.checkpoint #>> '{havarie,cause}', 'kohaerenz');
    v_safe     := v_run.haul_safe;
    v_loose    := drift_haul_settle(p_run, 0);   -- the loose haul is forfeit, in full
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');

    -- Scatter BEFORE the status flip: the 250 close-cleanup trigger deletes the cargo on the
    -- transition into 'abandoned', so the manifest must be read first. (After the settle, so
    -- the freight carries no haul over the side with it — it was already forfeited above.)
    v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

    -- The scar is recorded HERE, not when the Havarie opened: a Havarie survived is not a
    -- Zerfaserung. Gated, like every Fun-Kern write: with the gate off the build is P0 again,
    -- and P0 never counted scars. Zero residue is the price of a one-line rollback.
    IF v_fun_core THEN
        UPDATE traveler_profiles
           SET zerfaserung_count = zerfaserung_count + 1
         WHERE user_id = p_user;
    END IF;

    -- What the Funkboje transmitted, ARRIVES — even though the traveller did not, and even if
    -- the gate closed in between. Deliberately ungated (see the file header): a reserve is not
    -- residue, it is money the player already banked, and a rollback that silently confiscates
    -- it is the worse failure by a wide margin. Without this line, banking would only ever
    -- have been a hedge against a recall multiplier, and the push-your-luck of the whole wave
    -- would collapse into arithmetic.
    IF v_safe > 0 THEN
        v_vp     := v_safe * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1);
        v_siegel := floor(v_safe * COALESCE(
            (drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int;
        v_earnings := fn_drift_award(p_user, 'zerfaserung_transmitted', v_siegel, v_vp, p_run);

        UPDATE traveler_profiles
           SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
                 to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_safe))
         WHERE user_id = p_user;
    END IF;

    UPDATE travel_runs SET
        position_node_id = COALESCE(v_home, position_node_id),
        status           = 'abandoned',
        closed_at        = now(),
        run_version      = run_version + 1,
        checkpoint       = jsonb_build_object('closing', drift_closing_payload(
                'zerfaserung', v_cause, p_reason,
                v_safe,        -- what was lodged: only what had already come ashore
                v_loose,       -- what the Drift kept
                v_safe,
                NULL, NULL, NULL, v_scatter, v_fun_core))
            || CASE WHEN v_earnings IS NULL THEN '{}'::jsonb
                    ELSE jsonb_build_object('earnings', v_earnings) END
    WHERE id = p_run
    RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_zerfaserung', p_run,
            jsonb_build_object('reason', p_reason, 'haul_transmitted', v_safe));
    PERFORM travel_audit(p_user, 'travel_zerfaserung', 'travel_run', p_run, NULL,
        jsonb_build_object('reason', p_reason, 'haul_lost', v_loose,
                           'haul_transmitted', v_safe,
                           'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) IS
    'The DRIFT unravelling, in one place: scatters the manifest as echoes into the worlds it was headed for (fn_drift_scatter_cargo, hospitality-gated), counts the scar (gated — P0 never counted scars), forfeits the LOOSE haul (drift_haul_settle) and closes the run ''abandoned''. PAYS the Funkboje reserve (travel_runs.haul_safe) UNGATED: what the traveller transmitted arrives even though they did not — without that, banking would be a hedge against a rounding multiplier and the push-your-luck would collapse into arithmetic. Reached from the CHOSEN zerfaserung option, from the Havarie TTL sweep and from the gate-closed drain (p_reason distinguishes them in the receipt, the audit and the telemetry). Idempotent: FOR UPDATE + an open-status guard, because a double-clicked Aufbruch can race the TTL sweep and a second scar can never be cleared. INTERNAL-class.';

REVOKE ALL    ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 8. fn_travel_abandon — der Rückzug
-- ═══════════════════════════════════════════════════════════════════
-- The one closing path that is neither a failure nor a success — just a traveller walking
-- away. Which is exactly why the Funkboje's promise was missed here: "not a Havarie, not a
-- Resonanzriss, not even a Zerfaserung" listed the three dramatic endings and forgot the
-- quiet one. Banking 60 points at a foreign dock and then withdrawing used to evaporate 42
-- points of already-transmitted, already-guaranteed haul. The reserve is not the run's — it
-- is ashore.

CREATE OR REPLACE FUNCTION public.fn_travel_abandon(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run      travel_runs%ROWTYPE;
    v_safe     INT;
    v_loose    INT;
    v_fun_core BOOLEAN;
    v_siegel   INT := 0;
    v_vp       INT := 0;
    v_earnings JSONB := NULL;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_abandon: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_abandon: run not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status NOT IN ('active', 'frozen') THEN
        RAISE EXCEPTION 'fn_travel_abandon: run is %, not abandonable', v_run.status USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    v_safe     := v_run.haul_safe;
    -- The loose haul is left behind (a Rückzug banks nothing), and settling it BEFORE the
    -- status flip is also what keeps the close-cleanup trigger's cargo DELETE from having to
    -- move any haul at all.
    v_loose    := drift_haul_settle(p_run, 0);

    IF v_safe > 0 THEN
        v_vp     := v_safe * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1);
        v_siegel := floor(v_safe * COALESCE(
            (drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int;
        v_earnings := fn_drift_award(p_user, 'rueckzug_transmitted', v_siegel, v_vp, p_run);

        UPDATE traveler_profiles
           SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
                 to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_safe))
         WHERE user_id = p_user;
    END IF;

    -- The status flip fires trg_travel_run_close_cleanup (250), which forfeits the run's
    -- unanchored cargo + fails the bound Depeschen; discoveries are kept.
    UPDATE travel_runs
       SET status = 'abandoned', closed_at = now(), run_version = run_version + 1,
           checkpoint = jsonb_build_object('closing', drift_closing_payload(
                   'rueckzug', NULL, NULL,
                   v_safe, v_loose, v_safe,
                   NULL, NULL, NULL, NULL, v_fun_core))
               || CASE WHEN v_earnings IS NULL THEN '{}'::jsonb
                       ELSE jsonb_build_object('earnings', v_earnings) END
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_abandon', 'travel_run', p_run, NULL,
        jsonb_build_object('haul_lost', v_loose, 'haul_transmitted', v_safe));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_abandon(UUID, UUID, INT) IS
    'Rückzug — walk away from an active run. PLAYER-class (auth.uid() guard, run_version CAS). The loose haul is forfeit; the status flip fires the close-cleanup trigger (unanchored cargo forfeited, bound Depeschen failed, discoveries kept). PAYS the Funkboje reserve UNGATED, for the same reason fn_travel_zerfasern does: what the traveller transmitted arrives even from a run they walked away from. This was the closing path the Funkboje''s promise forgot — it is neither a failure nor a success, which is exactly why.';


-- ═══════════════════════════════════════════════════════════════════
-- 9. fn_travel_havarie_resolve — the decision (PLAYER-class)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_travel_havarie_resolve(
    p_user               UUID,
    p_run                UUID,
    p_run_version        INT,
    p_choice             TEXT,
    p_jettison_cargo_ids UUID[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run        travel_runs%ROWTYPE;
    v_hav        JSONB;
    v_opts       JSONB;
    v_cfg        JSONB;
    v_expires    TIMESTAMPTZ;
    v_home       UUID;
    v_anchor     UUID;
    v_haul       INT;
    v_jett_n     INT := 0;
    v_valid_n    INT := 0;
    v_haul_lost  INT := 0;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_havarie_resolve: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_havarie_resolve: run not found' USING ERRCODE = 'P0002';
    END IF;

    -- ── The gate, and the one thing it must never do ─────────────────────────────
    -- A closed gate refuses to CREATE Fun-Kern state. It must not refuse to DRAIN state the
    -- Fun-Kern already created — that is the difference between a rollback and a trap.
    --
    -- The trap this replaces: flip the gate off while a traveller sits in `havarie`, and
    -- EVERY exit is locked. move/complete demand 'active', abandon does not accept 'havarie',
    -- run_open hands the wreck straight back, and even the admin kill-switch skipped the
    -- status. The run was un-actionable for 48 h until the TTL swept it — while the plan's
    -- whole rollback story is "one flip, and the build is P0 again".
    --
    -- So: with the gate closed, a wreck unravels — the P0 ending, which is exactly what P0
    -- would have done to this run at the moment of collapse. Whatever the player picked is
    -- moot (the options were Fun-Kern promises the build no longer keeps), and the CAS token
    -- is not demanded either: the only exit from a trap must not be blocked by a stale version
    -- from the tab that was open when the gate flipped.
    --
    -- This drain is ALSO why there is no HTTP gate on the endpoint (W2.6/A): a router-level
    -- 404 answers before the RPC runs and made every line of it dead code.
    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        IF v_run.status = 'havarie' THEN
            RETURN fn_travel_zerfasern(p_user, p_run, 'gate_closed')
                || jsonb_build_object('gate_drained', TRUE);
        END IF;
        RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
    END IF;

    IF v_run.status <> 'havarie' THEN
        RAISE EXCEPTION 'NOT_IN_HAVARIE' USING ERRCODE = '22023';
    END IF;
    IF v_run.run_version <> p_run_version THEN
        RAISE EXCEPTION 'RUN_STALE' USING ERRCODE = 'P0001';
    END IF;

    v_hav     := v_run.checkpoint -> 'havarie';
    v_opts    := COALESCE(v_hav -> 'options', '[]'::jsonb);
    v_expires := NULLIF(v_hav ->> 'expires_at', '')::timestamptz;
    v_cfg     := drift_tuning_value('havarie_options');
    v_haul    := v_run.haul;

    -- TTL: a Havarie left standing decides itself. Whatever the player picked, an expired
    -- wreck unravels — otherwise the single-active-run slot could be held hostage forever.
    IF v_expires IS NOT NULL AND now() > v_expires THEN
        RETURN fn_travel_zerfasern(p_user, p_run, 'ttl_expired')
            || jsonb_build_object('expired', TRUE);
    END IF;

    IF NOT (v_opts @> to_jsonb(p_choice)) THEN
        RAISE EXCEPTION 'INVALID_CHOICE' USING ERRCODE = '22023';
    END IF;

    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- ── zerfaserung: the P0 ending, now chosen ───────────────────────────────────
    IF p_choice = 'zerfaserung' THEN
        RETURN fn_travel_zerfasern(p_user, p_run, 'choice');
    END IF;

    -- ── notabwurf: cargo as ballast ──────────────────────────────────────────────
    IF p_choice = 'notabwurf' THEN
        IF p_jettison_cargo_ids IS NULL OR array_length(p_jettison_cargo_ids, 1) IS NULL THEN
            RAISE EXCEPTION 'NOTHING_SELECTED' USING ERRCODE = '22023';
        END IF;
        -- Only this run's own cargo may be thrown overboard (a forged id must not be able to
        -- fail someone else's Depesche).
        SELECT count(*) INTO v_valid_n FROM travel_cargo
         WHERE id = ANY(p_jettison_cargo_ids) AND run_id = p_run AND owner_user_id = p_user;
        IF v_valid_n <> array_length(p_jettison_cargo_ids, 1) THEN
            RAISE EXCEPTION 'CARGO_NOT_ABOARD' USING ERRCODE = '22023';
        END IF;

        -- Salvage thrown overboard stops paying. Read what it was worth for the RECEIPT — the
        -- haul itself needs no correction: travel_cargo.haul_value IS one of the three sources
        -- of `haul` (264/§3.2), so the DELETE below takes it out of the sum by arithmetic.
        -- (Before W2.6 this needed its own function, fn_travel_jettison_haul, and a comment
        -- explaining why the checkpoint COLUMN and not the row snapshot had to be written.)
        SELECT COALESCE(sum(haul_value), 0)::int INTO v_haul_lost
          FROM travel_cargo WHERE run_id = p_run AND id = ANY(p_jettison_cargo_ids);

        -- A jettisoned Depesche fails its instance — else it stays 'active' with no cargo and
        -- the next fn_quest_accept hits QUEST_ACTIVE forever (the 250/256 lockout). The
        -- jettisoned freight does NOT scatter as echoes: it was cut loose deliberately and
        -- sinks into the Drift unsent. Only an unravelling scatters.
        UPDATE travel_quest_instances qi
           SET status = 'failed'
          FROM travel_cargo c
         WHERE c.id = ANY(p_jettison_cargo_ids) AND c.quest_instance_id = qi.id
           AND qi.status = 'active';
        DELETE FROM travel_cargo
         WHERE id = ANY(p_jettison_cargo_ids) AND run_id = p_run AND owner_user_id = p_user;
        v_jett_n := v_valid_n;

        UPDATE travel_runs SET
            status           = 'active',
            kohaerenz        = LEAST(100, kohaerenz
                                 + COALESCE((v_cfg #>> '{notabwurf,kh_restore}')::int, 30)),
            window_remaining = GREATEST(0, window_remaining
                                 - COALESCE((v_cfg #>> '{notabwurf,window_cost}')::int, 2)),
            run_version      = run_version + 1,
            event_seq        = event_seq + 1,
            checkpoint       = (checkpoint - 'havarie') || jsonb_build_object(
                'last_havarie', jsonb_build_object('choice', 'notabwurf',
                                                   'jettisoned', v_jett_n,
                                                   'haul_lost', v_haul_lost))
        WHERE id = p_run
        RETURNING * INTO v_run;
        v_haul := v_run.haul;

    -- ── notruf: the Bureau tows you home, and remembers that it had to ───────────
    ELSIF p_choice = 'notruf' THEN
        -- Half the haul — through the ONE consumer, so all three sub-ledgers are halved at
        -- once instead of one of them going stale (264/§3.4).
        PERFORM drift_haul_settle(
            p_run, COALESCE((v_cfg #>> '{notruf,haul_mult}')::numeric, 0.5));

        -- The debt is a MARK ON THE RECORD, not a balance deduction: siegel has a CHECK
        -- (>= 0), and a rescue must never be able to drive a traveller's purse negative or
        -- silently clamp. W3's requisition reads the mark; the Bureau does not forget.
        UPDATE traveler_profiles
           SET qualities = jsonb_set(qualities, '{siegel_debt}',
                 to_jsonb(COALESCE((qualities ->> 'siegel_debt')::int, 0)
                          + COALESCE((v_cfg #>> '{notruf,siegel_debt}')::int, 10)))
         WHERE user_id = p_user;

        UPDATE travel_runs SET
            status           = 'active',
            position_node_id = COALESCE(v_home, position_node_id),
            kohaerenz        = LEAST(100, GREATEST(kohaerenz,
                                 COALESCE((v_cfg #>> '{notruf,kh_restore}')::int, 20))),
            run_version      = run_version + 1,
            event_seq        = event_seq + 1,
            checkpoint       = (checkpoint - 'havarie') || jsonb_build_object(
                'last_havarie', jsonb_build_object('choice', 'notruf',
                                                   'haul_before', v_haul))
        WHERE id = p_run
        RETURNING * INTO v_run;
        v_haul := v_run.haul;   -- the halved figure, straight off the derivation

    -- ── ueberziehen: stay past the permit; every Takt now costs Dissonanz ────────
    ELSIF p_choice = 'ueberziehen' THEN
        UPDATE travel_runs SET
            status      = 'active',
            overstay    = TRUE,     -- a COLUMN since W2.6: it is what is TRUE of the run, not
                                    -- what just happened, and a checkpoint rebuild used to be
                                    -- able to forget it
            run_version = run_version + 1,
            event_seq   = event_seq + 1,
            checkpoint  = (checkpoint - 'havarie') || jsonb_build_object(
                'last_havarie', jsonb_build_object('choice', 'ueberziehen'))
        WHERE id = p_run
        RETURNING * INTO v_run;

    -- ── rueckruf: an orderly recall — the haul survives at 70 % ──────────────────
    ELSIF p_choice = 'rueckruf' THEN
        -- Snap home first, so the banking path sees the same position a clean Entladung would
        -- (the survey delivery excludes the home node by anchor, not by history).
        UPDATE travel_runs
           SET position_node_id = COALESCE(v_home, position_node_id),
               checkpoint       = checkpoint - 'havarie'
         WHERE id = p_run;

        PERFORM travel_audit(p_user, 'travel_havarie_resolve', 'travel_run', p_run, NULL,
            jsonb_build_object('choice', 'rueckruf', 'haul_before', v_haul));
        RETURN fn_travel_bank_run(
            p_user, p_run,
            COALESCE((v_cfg #>> '{rueckruf,haul_mult}')::numeric, 0.7),
            'rueckruf');

    ELSE
        RAISE EXCEPTION 'INVALID_CHOICE' USING ERRCODE = '22023';
    END IF;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_decision', p_run,
        jsonb_build_object('kind', 'havarie_resolved', 'choice', p_choice));
    INSERT INTO travel_log_entries (user_id, run_id, takt, kind, node_id, payload)
    VALUES (p_user, p_run, v_run.takt_count, 'havarie', v_run.position_node_id,
        jsonb_build_object('choice', p_choice, 'jettisoned', v_jett_n,
                           'haul_lost', v_haul_lost, 'haul', v_haul));
    PERFORM travel_audit(p_user, 'travel_havarie_resolve', 'travel_run', p_run, NULL,
        jsonb_build_object('choice', p_choice, 'jettisoned', v_jett_n,
                           'haul_lost', v_haul_lost, 'haul', v_haul));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_havarie_resolve(UUID, UUID, INT, TEXT, UUID[]) IS
    'Resolve a DRIFT Havarie (M3). PLAYER-class: auth.uid() = p_user guard, run_version CAS, gate-checked — but a CLOSED gate does not refuse a run that is ALREADY in havarie: it DRAINS it (forced zerfaserung, {gate_drained: true}, no CAS demanded). A gate must refuse to CREATE Fun-Kern state, never to drain it; refusing here would strand the traveller for the full 48 h TTL with no legal action left, which would break the very rollback the gate exists for. (This drain is also why the endpoint carries no HTTP gate — a router 404 answers before the RPC runs and made it dead code.) The choice must be one the Havarie actually offered (INVALID_CHOICE); notabwurf only appears when there IS cargo aboard AND a Takt survives its price. notabwurf: jettison the SELECTED cargo (validated to be this run''s own — CARGO_NOT_ABOARD otherwise), fail its bound Depeschen, restore Kohärenz, pay two Takte; the freight sinks unsent, and its haul goes with it by arithmetic (travel_cargo.haul_value is a source of travel_runs.haul). notruf: the Bureau tows you home — the haul is HALVED through drift_haul_settle (all three sub-ledgers at once) and a Siegel debt is marked in qualities (a mark, never a negative balance). ueberziehen: the overstay permit (a COLUMN — a checkpoint rebuild used to be able to forget it). rueckruf: an orderly recall through fn_travel_bank_run at 70 %. An EXPIRED Havarie (TTL) unravels regardless of the choice and returns {expired: true} — the lazy finalisation that lets P0.5 skip a scheduler.';

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_travel_havarie_resolve(uuid, uuid, integer, text, uuid[]) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_travel_havarie_resolve(uuid, uuid, integer, text, uuid[]) TO authenticated, service_role';
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 10. fn_travel_run_open — and the lazy sweep of a wreck left standing
-- ═══════════════════════════════════════════════════════════════════
-- A traveller who walks away from a wreck and comes back three days later finds it
-- unravelled (and gets a fresh run), rather than a permanently blocked single-active slot.
-- A NON-expired Havarie is still returned as the open run — the decision is still theirs.

CREATE OR REPLACE FUNCTION public.fn_travel_run_open(
    p_user        UUID,
    p_anchor_sim  UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing       travel_runs%ROWTYPE;
    v_run            travel_runs%ROWTYPE;
    v_class          INT;
    v_bb_max         INT;
    v_chart_version  INT;
    v_home_node      UUID;
    v_first_run      BOOLEAN;
    v_expires        TIMESTAMPTZ;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_run_open: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

    INSERT INTO traveler_profiles (user_id, anchor_simulation_id)
    VALUES (p_user, p_anchor_sim)
    ON CONFLICT (user_id) DO NOTHING;

    -- Single-active-run CAS (including 'havarie' — a wreck holds the slot).
    -- FOR UPDATE: this lookup can fall through into the TTL sweep below, and a double-clicked
    -- Aufbruch would otherwise let two transactions sweep the SAME expired wreck (fn_travel_
    -- zerfasern is idempotent as well — belt and braces, since only the lock makes the
    -- read-then-write here atomic).
    SELECT * INTO v_existing FROM travel_runs
     WHERE user_id = p_user AND status IN ('active', 'frozen', 'distress', 'havarie')
     LIMIT 1
     FOR UPDATE;
    IF FOUND THEN
        IF v_existing.status = 'havarie' THEN
            v_expires := NULLIF(v_existing.checkpoint #>> '{havarie,expires_at}', '')::timestamptz;
            IF v_expires IS NOT NULL AND now() > v_expires THEN
                -- The Drift decided for you. The slot is freed; fall through and open anew.
                PERFORM fn_travel_zerfasern(p_user, v_existing.id, 'ttl_expired');
            ELSE
                RETURN to_jsonb(v_existing);   -- the decision is still yours
            END IF;
        ELSE
            RETURN to_jsonb(v_existing);
        END IF;
    END IF;

    SELECT max(version) INTO v_chart_version FROM chart_versions;
    IF v_chart_version IS NULL THEN
        RAISE EXCEPTION 'fn_travel_run_open: no chart version exists (seed not applied)'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT id INTO v_home_node FROM drift_chart_nodes
     WHERE chart_version = v_chart_version
       AND node_type = 'broadcast_rand'
       AND simulation_id = p_anchor_sim
     LIMIT 1;
    IF v_home_node IS NULL THEN
        RAISE EXCEPTION 'fn_travel_run_open: anchor simulation % has no broadcast node on the chart', p_anchor_sim
            USING ERRCODE = 'P0002';
    END IF;

    SELECT bandwidth_class INTO v_class FROM traveler_profiles WHERE user_id = p_user;
    v_bb_max := COALESCE((drift_tuning_value('bandwidth_class_bb_max') ->> v_class::text)::int, 60);

    BEGIN
        -- The Fun-Kern columns take their defaults: a fresh run has no haul, no markers, no
        -- dig sites, no permit and an empty visited set. (That they are DEFAULTS and not a
        -- hand-written jsonb literal is the point of W2.6/D.)
        INSERT INTO travel_runs (
            user_id, status, kohaerenz, bandbreite, dissonanz, frequency,
            position_node_id, scale, window_remaining, chart_version
        ) VALUES (
            p_user, 'active',
            COALESCE((drift_tuning_value('kh_start'))::int, 100),
            v_bb_max, 0, 'memory',
            v_home_node, 'drift',
            COALESCE((drift_tuning_value('window_base'))::int, 12),
            v_chart_version
        )
        RETURNING * INTO v_run;
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_run FROM travel_runs
         WHERE user_id = p_user AND status IN ('active', 'frozen', 'distress', 'havarie')
         LIMIT 1;
        RETURN to_jsonb(v_run);
    END;

    SELECT NOT EXISTS (
        SELECT 1 FROM travel_telemetry_events
         WHERE user_id = p_user AND event_key = 'drift_first_session_start'
    ) INTO v_first_run;
    IF v_first_run THEN
        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_first_session_start', v_run.id);
    END IF;
    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_opened', v_run.id);

    PERFORM travel_audit(p_user, 'travel_run_open', 'travel_run', v_run.id, p_anchor_sim,
        jsonb_build_object('home_node', v_home_node, 'chart_version', v_chart_version));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 11. fn_drift_emergency_return — the kill-switch, and what it may NOT confiscate
-- ═══════════════════════════════════════════════════════════════════
-- The admin kill-switch repatriates every open run to its home node. It also sees 'havarie'
-- — a wreck is exactly the state an operator needs to be able to rescue a traveller out of.
-- 'frozen' stays excluded: a gate-flip freeze is already a safe suspended state that thaws on
-- re-enable (239).
--
-- The checkpoint is reset (so no stale wreck panel greets the rescued traveller) and the
-- overstay permit with it. The run's EARNED state — haul, reserve, markers, dig sites, the
-- visited set — is deliberately NOT touched. Before W2.6 all of it lived in the checkpoint,
-- so a rescue silently confiscated the traveller's whole run; now the rescue moves them home
-- and nothing else, which is what a rescue is.

CREATE OR REPLACE FUNCTION public.fn_drift_emergency_return()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    WITH homed AS (
        UPDATE travel_runs r SET
            position_node_id = n.id,
            status           = 'active',
            overstay         = FALSE,
            run_version      = r.run_version + 1,
            checkpoint       = jsonb_build_object('emergency_return', true)
        FROM traveler_profiles p
        JOIN drift_chart_nodes n
          ON n.simulation_id = p.anchor_simulation_id
         AND n.node_type = 'broadcast_rand'
        WHERE r.user_id = p.user_id
          AND n.chart_version = r.chart_version
          AND r.status IN ('active', 'distress', 'havarie')
        RETURNING r.id, r.user_id
    )
    SELECT count(*) INTO v_count FROM homed;

    PERFORM travel_audit(NULL, 'travel_emergency_return', 'travel_run', NULL, NULL,
        jsonb_build_object('runs_returned', v_count));

    RETURN jsonb_build_object('runs_returned', v_count);
END;
$$;

COMMENT ON FUNCTION public.fn_drift_emergency_return() IS
    'DRIFT kill-switch: repatriates every open run to its home broadcast node, clears the checkpoint (no stale wreck panel greets the rescued traveller) and the overstay permit, and sees ''havarie'' — a wreck is exactly the state an operator needs to rescue a traveller out of. ''frozen'' stays excluded (a gate freeze thaws on re-enable, 239). Since W2.6 it does NOT confiscate the run''s earned state (haul, reserve, markers, dig sites, visited): that all used to live in the checkpoint, so a rescue quietly cost the traveller their whole expedition. ADMIN-class: service_role only, called from the platform-admin router.';

REVOKE ALL    ON FUNCTION public.fn_drift_emergency_return() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_drift_emergency_return() TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 12. Player-class posture re-asserted (CREATE OR REPLACE preserves ACLs)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_travel_run_open(uuid, uuid)',
        'fn_travel_complete(uuid, uuid, integer)',
        'fn_travel_abandon(uuid, uuid, integer)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;

COMMIT;
