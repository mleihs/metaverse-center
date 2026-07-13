-- Migration 265: DRIFT Fun-Kern — travel_havarie (Welle 1, Schritt 1.3)
--
-- Plan: docs/plans/drift-fun-core-implementation-plan.md §3 Schritt 1.3 (M3).
-- Concept: docs/concepts/drift-gameplay-redesign-concept.md (D5 "der Kollaps ist ein Snap").
--
-- THE P0 HOLE THIS CLOSES
-- -----------------------
-- In P0 the run's failure floor is a SNAP: Kohärenz hits 0 (or the Aufenthaltsfenster
-- runs out far from home) and fn_travel_move silently teleports the traveller home,
-- forfeits the haul, scatters the cargo and closes the run 'abandoned' — all inside the
-- move the player just made, with no decision, no reading, no agency. The single most
-- dramatic moment of a run was the one moment the player was not allowed to play.
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
-- ARCHITECTURE: one banking path, not two
-- ---------------------------------------
-- `rueckruf` banks a run at 70 % — which is the Entladung with a multiplier. Rather than
-- duplicating (lodge haul → deliver surveys → close dangling Depeschen → award → close
-- run) a second time, the Entladung CORE is extracted into `fn_travel_bank_run(user, run,
-- haul_mult, source)`. fn_travel_complete becomes its guards + the at-home check + a call
-- at 1.0; rueckruf calls it at 0.7. One place banks a run. (The extraction is behavior-
-- preserving: fn_travel_complete's semantics at mult=1.0 are byte-identical to 264/256.)
--
-- THE SCAR MOVES
-- --------------
-- 264 incremented `zerfaserung_count` in the collapse floor. With the floor now a CHOICE,
-- the counter belongs where the run ACTUALLY unravels: the `zerfaserung` resolution (and
-- the TTL finalisation). A Havarie survived is not a Zerfaserung — counting it as one
-- would make the scar a lie.
--
-- TTL WITHOUT A SCHEDULER (plan §3.3)
-- -----------------------------------
-- A run parked in `havarie` forever would hold the single-active-run slot hostage. The
-- checkpoint carries `expires_at` (48 h, tuning); expiry is finalised LAZILY on the next
-- access — fn_travel_havarie_resolve forces zerfaserung on an expired run whatever the
-- player picked, and fn_travel_run_open sweeps an expired Havarie before it opens the next
-- run. No new scheduler process (P0.5 does not need one), no zombie slot.
--
-- ALSO: `havarie` joins the single-active-run partial index — without it a stranded
-- traveller could open a SECOND run and stack two live runs on one profile.
--
-- GATE: everything here is behind `drift_fun_core_enabled` (264). Gate closed ⇒
-- fn_travel_move performs the exact P0 snap, `havarie` never occurs, and
-- fn_travel_havarie_resolve is unreachable (GATE_CLOSED).


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
-- 3. fn_travel_bank_run — the ONE banking path (Entladung core, extracted)
-- ═══════════════════════════════════════════════════════════════════
-- Everything fn_travel_complete did after its guards, parameterised by a haul multiplier
-- so the Havarie's `rueckruf` (0.7) and a clean Entladung (1.0) cannot drift apart.
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
    v_haul_raw   INT;
    v_haul       INT;
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
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;

    -- The haul the run accrued, after the multiplier (floor — the Bureau never rounds in
    -- the traveller's favour, and an integer haul keeps every downstream payout exact).
    v_haul_raw := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    v_haul     := floor(v_haul_raw * p_haul_mult)::int;

    -- Lodge into the lifetime survey stat (the P0 counter).
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Deliver every FIRST-arrival node of this run to the shared chart + claim the
    -- Erstvermessung honors first-write-wins (253). Honors are NOT scaled by the
    -- multiplier: you either charted the node or you did not.
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    -- Close out any Depesche still aboard (delivered cargo was consumed at delivery, so
    -- whatever is left is undelivered → its instance must not stay 'active' on a closed
    -- run, or the next fn_quest_accept hits QUEST_ACTIVE forever — the 256 lockout).
    UPDATE travel_quest_instances qi
       SET status = 'failed'
      FROM travel_cargo c
     WHERE c.run_id = p_run AND c.quest_instance_id = qi.id AND qi.status = 'active';
    DELETE FROM travel_cargo WHERE run_id = p_run;

    -- Fun-Kern: the haul and the honors pay (264).
    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    IF v_fun_core THEN
        v_honors := COALESCE((v_survey ->> 'honors_won')::int, 0);
        v_erstv  := drift_tuning_value('reward_erstvermessung');
        v_vp     := v_haul * COALESCE((drift_tuning_value('reward_survey_vp_per_haul'))::int, 1)
                    + v_honors * COALESCE((v_erstv ->> 'vp')::int, 25);
        v_siegel := floor(v_haul * COALESCE((drift_tuning_value('reward_survey_siegel_ratio'))::numeric, 0.5))::int
                    + v_honors * COALESCE((v_erstv ->> 'siegel')::int, 40);
        v_earnings := fn_drift_award(p_user, p_source, v_siegel, v_vp, p_run);
    END IF;

    v_checkpoint := jsonb_build_object(
        'haul_banked', v_haul,
        'surveys_delivered', v_survey -> 'surveys_delivered',
        'honors_won', v_survey -> 'honors_won',
        'honor_keys', v_survey -> 'honor_keys');
    -- A recalled run says so, and says what the recall cost — the receipt must never
    -- present a 70 % haul as if it were the full one.
    IF p_source <> 'entladung' THEN
        v_checkpoint := v_checkpoint || jsonb_build_object(
            'close_reason', p_source, 'haul_before', v_haul_raw, 'haul_mult', p_haul_mult);
    END IF;
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
                           'source', p_source, 'honors_won', v_survey -> 'honors_won'));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) IS
    'The single banking path for a DRIFT run (extracted from fn_travel_complete in migration 265). Lodges the (multiplier-scaled) haul, delivers the surveyed nodes + claims Erstvermessung honors (fn_survey_deliver — honors are NOT scaled: you charted the node or you did not), fails/forfeits any Depesche still aboard, pays via fn_drift_award when the Fun-Kern gate is open, and closes the run ''completed''. p_haul_mult: 1.0 for a clean Entladung, 0.7 for a Havarie-Rückruf — so the two can never drift apart. INTERNAL-class: assumes the caller locked the run and validated ownership + the run_version CAS. REVOKE anon+authenticated, GRANT service_role.';

REVOKE ALL    ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_bank_run(UUID, UUID, NUMERIC, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_travel_complete — now just guards + the at-home check + bank(1.0)
-- ═══════════════════════════════════════════════════════════════════
-- Behavior-identical to 264/256; the body below the guards moved into fn_travel_bank_run.

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


-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_travel_move — the floor becomes a scene (gate on), stays a snap (gate off)
-- ═══════════════════════════════════════════════════════════════════
-- Diff vs. 264: (a) an overstaying run (checkpoint.overstay, granted by the Havarie option
-- `ueberziehen`) pays +dz_per_takt every Takt and is NOT collapsed by the expired window —
-- the Bleed, not the clock, is what ends an overstay; (b) with the Fun-Kern gate open the
-- collapse does not scatter/close anything: it parks the run in `havarie` with a catalogue
-- of options (notabwurf only appears if there is cargo to jettison — a dead option is worse
-- than none) and an expiry stamp; (c) the P0 snap (scatter → abandoned) survives verbatim
-- as the gate-off path.

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
    v_fun_core   BOOLEAN;
    v_overstay   BOOLEAN;
    v_opts       JSONB;
    v_cause      TEXT;
    v_options    JSONB;
    v_cargo_n    INT;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_move: caller is not the run owner' USING ERRCODE = '42501';
    END IF;

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

    v_fun_core := drift_gate_enabled('drift_fun_core_enabled');
    v_overstay := COALESCE((v_run.checkpoint ->> 'overstay')::boolean, FALSE);

    -- Adjacency.
    SELECT weight, permeability INTO v_weight, v_perm FROM drift_chart_edges
     WHERE chart_version = v_run.chart_version
       AND ((from_node = v_run.position_node_id AND to_node = p_to_node)
         OR (to_node   = v_run.position_node_id AND from_node = p_to_node))
     LIMIT 1;
    IF v_weight IS NULL THEN
        RAISE EXCEPTION 'NOT_ADJACENT' USING ERRCODE = '22023';
    END IF;

    -- Frequency multiplier (on-vector vs the affinity-banded off-vector penalty).
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

    -- Pay: Bandbreite if affordable, else Notfrequenz (Kohärenz per edge).
    IF v_run.bandbreite >= v_bb_cost THEN
        v_run.bandbreite := v_run.bandbreite - v_bb_cost;
    ELSE
        v_notfreq := TRUE;
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz
            - COALESCE((drift_tuning_value('notfreq_kh_per_edge'))::int, 2));
    END IF;

    SELECT distance_band, simulation_id, node_type INTO v_band, v_to_sim, v_to_type
      FROM drift_chart_nodes WHERE id = p_to_node AND chart_version = v_run.chart_version;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;

    -- One Takt of the Aufenthaltsfenster (an overstaying run has none left to spend).
    v_run.window_remaining := GREATEST(0, v_run.window_remaining - 1);

    -- Dissonanz by band, capped; above the bleed threshold it erodes Kohärenz.
    v_dz_add := COALESCE((drift_tuning_value('dz_per_move_by_band') ->> COALESCE(v_band, 'near'))::int, 1);
    v_dz_cap := COALESCE((drift_tuning_value('dz_p0_cap'))::int, 74);

    -- Overstay tax (M3): staying past the permit is not free — the Bleed notices. This is
    -- what eventually ends an overstay, and it ends it through Kohärenz, not a clock.
    IF v_fun_core AND v_overstay THEN
        v_dz_add := v_dz_add
            + COALESCE((drift_tuning_value('havarie_options') #>> '{ueberziehen,dz_per_takt}')::int, 5);
    END IF;

    v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + v_dz_add);
    v_dz_bleed := drift_tuning_value('dz_kh_bleed');
    IF v_dz_bleed IS NOT NULL AND v_run.dissonanz >= (v_dz_bleed ->> 'threshold')::int THEN
        v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_dz_bleed ->> 'amount')::int);
    END IF;

    -- Deep-Drift surge (retired into the Störungs-Signalklasse in migration 266/W2).
    IF v_band = 'deep' THEN
        v_surge_cfg := drift_tuning_value('deep_surge');
        IF v_surge_cfg IS NOT NULL AND random() < (v_surge_cfg ->> 'chance')::numeric THEN
            v_surge := TRUE;
            v_run.dissonanz := LEAST(v_dz_cap, v_run.dissonanz + (v_surge_cfg ->> 'dz')::int);
            v_run.kohaerenz := GREATEST(0, v_run.kohaerenz - (v_surge_cfg ->> 'kh')::int);
        END IF;
    END IF;

    -- Vermessung on first arrival (band value + the foreign-dock prize).
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

    -- ── The floor ────────────────────────────────────────────────────────────────
    -- Kohärenz 0 unravels you anywhere. An expired window only strands you if this move did
    -- not bring you home — and not at all if you hold an overstay permit (its cost is the
    -- Dissonanz tax above, not a collapse).
    IF v_run.kohaerenz <= 0
       OR (v_run.window_remaining <= 0
           AND NOT (v_fun_core AND v_overstay)
           AND p_to_node IS DISTINCT FROM v_home) THEN

        v_cause := CASE WHEN v_run.kohaerenz <= 0 THEN 'kohaerenz' ELSE 'window' END;

        IF v_fun_core THEN
            -- HAVARIE: the run stops where it is. Nothing is lost yet — the cargo is still
            -- aboard, the haul is still on the books, and the traveller decides.
            SELECT count(*) INTO v_cargo_n FROM travel_cargo WHERE run_id = p_run;
            v_opts := drift_tuning_value('havarie_options');
            v_options := CASE
                WHEN v_cause = 'kohaerenz' AND v_cargo_n > 0
                    THEN '["notabwurf","notruf","zerfaserung"]'::jsonb
                WHEN v_cause = 'kohaerenz'
                    -- No cargo → nothing to jettison. A dead option on the panel is worse
                    -- than no option: it promises an out the traveller cannot take.
                    THEN '["notruf","zerfaserung"]'::jsonb
                ELSE '["ueberziehen","rueckruf"]'::jsonb
            END;

            UPDATE travel_runs SET
                position_node_id = p_to_node,          -- you are stranded WHERE YOU ARE
                status           = 'havarie',
                bandbreite       = v_run.bandbreite,
                kohaerenz        = v_run.kohaerenz,
                dissonanz        = v_run.dissonanz,
                window_remaining = GREATEST(0, v_run.window_remaining),
                takt_count       = takt_count + 1,
                event_seq        = event_seq + 1,
                run_version      = run_version + 1,
                checkpoint       = v_run.checkpoint || jsonb_build_object(
                    'position_node_id', p_to_node,
                    'haul', v_haul, 'visited', v_visited,
                    'havarie', jsonb_build_object(
                        'cause', v_cause,
                        'options', v_options,
                        'cargo_aboard', v_cargo_n,
                        'haul_at_risk', v_haul,
                        'catalogue', v_opts,     -- the numbers, so the panel can state them
                        'expires_at', (now() + make_interval(
                            hours => COALESCE((drift_tuning_value('havarie_ttl_hours'))::int, 48)))
                    ))
            WHERE id = p_run
            RETURNING * INTO v_run;

            INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
            VALUES (p_user, 'drift_decision', p_run,
                jsonb_build_object('kind', 'havarie_opened', 'cause', v_cause));
            PERFORM travel_audit(p_user, 'travel_havarie_open', 'travel_run', p_run, NULL,
                jsonb_build_object('cause', v_cause, 'haul_at_risk', v_haul,
                                   'cargo_aboard', v_cargo_n, 'options', v_options));
            RETURN to_jsonb(v_run);
        END IF;

        -- Gate closed → the exact P0 snap (scatter → abandoned, haul forfeit).
        v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

        UPDATE travel_runs SET
            position_node_id = COALESCE(v_home, position_node_id),
            status           = 'abandoned',
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
                'recall', v_cause,
                'haul', 0, 'haul_lost', v_haul, 'visited', v_visited,
                'scattered', v_scatter)
        WHERE id = p_run
        RETURNING * INTO v_run;

        INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
        VALUES (p_user, 'drift_zerfaserung', p_run);
        PERFORM travel_audit(p_user, 'travel_recall', 'travel_run', p_run, NULL,
            jsonb_build_object('reason', v_cause, 'haul_lost', v_haul,
                               'attempted_to', p_to_node,
                               'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));
        RETURN to_jsonb(v_run);
    END IF;

    -- Advance.
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
                                            'surge', v_surge, 'survey', v_survey))
            -- An overstay permit survives the move that uses it (it is a run-level state,
            -- not a one-shot), so it must be re-carried into the rewritten checkpoint.
            || CASE WHEN v_overstay THEN jsonb_build_object('overstay', TRUE) ELSE '{}'::jsonb END
    WHERE id = p_run
    RETURNING * INTO v_run;

    PERFORM travel_audit(p_user, 'travel_move', 'travel_run', p_run, NULL,
        jsonb_build_object('to_node', p_to_node, 'bb_cost', v_bb_cost, 'notfrequenz', v_notfreq,
                           'surge', v_surge, 'haul', v_haul, 'takt', v_run.takt_count,
                           'overstay', v_overstay));

    RETURN to_jsonb(v_run);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_travel_zerfasern — the unravelling, in ONE place
-- ═══════════════════════════════════════════════════════════════════
-- Reached from the chosen `zerfaserung` option and from the TTL sweep. INTERNAL-class.

CREATE OR REPLACE FUNCTION public.fn_travel_zerfasern(
    p_user   UUID,
    p_run    UUID,
    p_reason TEXT      -- 'choice' | 'ttl_expired'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run     travel_runs%ROWTYPE;
    v_anchor  UUID;
    v_home    UUID;
    v_haul    INT;
    v_scatter JSONB;
BEGIN
    SELECT * INTO v_run FROM travel_runs WHERE id = p_run;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = p_user;
    SELECT n.id INTO v_home FROM drift_chart_nodes n
     WHERE n.simulation_id = v_anchor AND n.node_type = 'broadcast_rand'
       AND n.chart_version = v_run.chart_version;
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);

    -- Scatter BEFORE the status flip: the 250 close-cleanup trigger deletes the cargo on
    -- the transition into 'abandoned', so the manifest must be read first.
    v_scatter := fn_drift_scatter_cargo(p_run, p_user, v_anchor);

    -- The scar is recorded HERE, not when the Havarie opened: a Havarie survived is not a
    -- Zerfaserung, and a counter that says otherwise is a lie about the traveller's record.
    UPDATE traveler_profiles
       SET zerfaserung_count = zerfaserung_count + 1
     WHERE user_id = p_user;

    UPDATE travel_runs SET
        position_node_id = COALESCE(v_home, position_node_id),
        status           = 'abandoned',
        closed_at        = now(),
        run_version      = run_version + 1,
        checkpoint       = v_run.checkpoint || jsonb_build_object(
            'position_node_id', COALESCE(v_home, v_run.position_node_id),
            'recall', COALESCE(v_run.checkpoint #>> '{havarie,cause}', 'kohaerenz'),
            'zerfaserung', jsonb_build_object('reason', p_reason),
            'haul', 0, 'haul_lost', v_haul,
            'scattered', v_scatter)
    WHERE id = p_run
    RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id, payload)
    VALUES (p_user, 'drift_zerfaserung', p_run, jsonb_build_object('reason', p_reason));
    PERFORM travel_audit(p_user, 'travel_zerfaserung', 'travel_run', p_run, NULL,
        jsonb_build_object('reason', p_reason, 'haul_lost', v_haul,
                           'scattered', COALESCE((v_scatter ->> 'scattered')::int, 0)));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) IS
    'The DRIFT unravelling, in one place (migration 265): scatters the manifest as echoes into the worlds it was headed for (fn_drift_scatter_cargo, hospitality-gated), increments traveler_profiles.zerfaserung_count, forfeits the haul and closes the run ''abandoned'' (which fires the 250 cargo-forfeit trigger). Reached from the CHOSEN zerfaserung option and from the Havarie TTL sweep (p_reason distinguishes them in audit + telemetry). The scar is counted here and NOT when the Havarie opened — a Havarie survived is not a Zerfaserung. INTERNAL-class: REVOKE anon+authenticated, GRANT service_role.';

REVOKE ALL    ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_travel_zerfasern(UUID, UUID, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_travel_havarie_resolve — the decision (PLAYER-class)
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
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'fn_travel_havarie_resolve: caller is not the run owner' USING ERRCODE = '42501';
    END IF;
    IF NOT drift_gate_enabled('drift_fun_core_enabled') THEN
        RAISE EXCEPTION 'GATE_CLOSED' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run FROM travel_runs WHERE id = p_run AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fn_travel_havarie_resolve: run not found' USING ERRCODE = 'P0002';
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
    v_haul    := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);

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
        -- Only this run's own cargo may be thrown overboard (a forged id must not be able
        -- to fail someone else's Depesche).
        SELECT count(*) INTO v_valid_n FROM travel_cargo
         WHERE id = ANY(p_jettison_cargo_ids) AND run_id = p_run AND owner_user_id = p_user;
        IF v_valid_n <> array_length(p_jettison_cargo_ids, 1) THEN
            RAISE EXCEPTION 'CARGO_NOT_ABOARD' USING ERRCODE = '22023';
        END IF;

        -- A jettisoned Depesche fails its instance — else it stays 'active' with no cargo
        -- and the next fn_quest_accept hits QUEST_ACTIVE forever (the 250/256 lockout).
        -- The jettisoned freight does NOT scatter as echoes: it was cut loose deliberately
        -- and sinks into the Drift unsent. Only an unravelling scatters.
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
            checkpoint       = (v_run.checkpoint - 'havarie') || jsonb_build_object(
                'last_havarie', jsonb_build_object('choice', 'notabwurf', 'jettisoned', v_jett_n))
        WHERE id = p_run
        RETURNING * INTO v_run;

    -- ── notruf: the Bureau tows you home, and remembers that it had to ───────────
    ELSIF p_choice = 'notruf' THEN
        v_haul := floor(v_haul * COALESCE((v_cfg #>> '{notruf,haul_mult}')::numeric, 0.5))::int;

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
            checkpoint       = (v_run.checkpoint - 'havarie') || jsonb_build_object(
                'position_node_id', COALESCE(v_home, v_run.position_node_id),
                'haul', v_haul,
                'last_havarie', jsonb_build_object('choice', 'notruf', 'haul_after', v_haul))
        WHERE id = p_run
        RETURNING * INTO v_run;

    -- ── ueberziehen: stay past the permit; every Takt now costs Dissonanz ────────
    ELSIF p_choice = 'ueberziehen' THEN
        UPDATE travel_runs SET
            status      = 'active',
            run_version = run_version + 1,
            event_seq   = event_seq + 1,
            checkpoint  = (v_run.checkpoint - 'havarie') || jsonb_build_object(
                'overstay', TRUE,
                'last_havarie', jsonb_build_object('choice', 'ueberziehen'))
        WHERE id = p_run
        RETURNING * INTO v_run;

    -- ── rueckruf: an orderly recall — the haul survives at 70 % ──────────────────
    ELSIF p_choice = 'rueckruf' THEN
        -- Snap home first, so the banking path sees the same position a clean Entladung
        -- would (the survey delivery excludes the home node by anchor, not by history).
        UPDATE travel_runs
           SET position_node_id = COALESCE(v_home, position_node_id),
               checkpoint = (v_run.checkpoint - 'havarie')
                            || jsonb_build_object('position_node_id', COALESCE(v_home, v_run.position_node_id))
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
    PERFORM travel_audit(p_user, 'travel_havarie_resolve', 'travel_run', p_run, NULL,
        jsonb_build_object('choice', p_choice, 'jettisoned', v_jett_n, 'haul', v_haul));

    RETURN to_jsonb(v_run);
END;
$$;

COMMENT ON FUNCTION public.fn_travel_havarie_resolve(UUID, UUID, INT, TEXT, UUID[]) IS
    'Resolve a DRIFT Havarie (M3, migration 265). PLAYER-class: auth.uid() = p_user guard, run_version CAS, gate-checked (GATE_CLOSED while drift_fun_core_enabled is off). The choice must be one the Havarie actually offered (INVALID_CHOICE) — the option list is written into the checkpoint when the Havarie opens, and notabwurf only appears when there IS cargo aboard. notabwurf: jettison the SELECTED cargo (validated to be this run''s own — CARGO_NOT_ABOARD otherwise), fail its bound Depeschen, restore Kohärenz, pay two Takte of the window; the freight sinks unsent (only an unravelling scatters echoes). notruf: the Bureau tows you home — half the haul and a Siegel debt marked in qualities (a mark, never a negative balance). ueberziehen: an overstay permit — every further Takt costs +Dissonanz (fn_travel_move applies it). rueckruf: an orderly recall through fn_travel_bank_run at 70 %. zerfaserung: fn_travel_zerfasern. An EXPIRED Havarie (TTL, checkpoint.expires_at) unravels regardless of the choice and returns {expired: true} — the lazy finalisation that lets P0.5 skip a scheduler.';

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_travel_havarie_resolve(uuid, uuid, integer, text, uuid[]) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_travel_havarie_resolve(uuid, uuid, integer, text, uuid[]) TO authenticated, service_role';
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- 8. fn_travel_run_open — sweep an expired Havarie before opening the next run
-- ═══════════════════════════════════════════════════════════════════
-- Body of migration 246 verbatim, plus the lazy TTL sweep: a traveller who walks away from
-- a wreck and comes back three days later finds it unravelled (and gets a fresh run),
-- rather than a permanently blocked single-active slot. A NON-expired Havarie is still
-- returned as the open run — the decision is still theirs to make.

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

    -- Single-active-run CAS (now including 'havarie' — a wreck holds the slot).
    SELECT * INTO v_existing FROM travel_runs
     WHERE user_id = p_user AND status IN ('active', 'frozen', 'distress', 'havarie')
     LIMIT 1;
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
-- 9. Player-class posture re-asserted (CREATE OR REPLACE preserves ACLs)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'fn_travel_run_open(uuid, uuid)',
        'fn_travel_move(uuid, uuid, integer, uuid)',
        'fn_travel_complete(uuid, uuid, integer)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
    END LOOP;
END $$;
