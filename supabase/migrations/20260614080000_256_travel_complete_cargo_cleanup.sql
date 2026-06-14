-- Migration 256: DRIFT — travel_complete_cargo_cleanup (close an undelivered Depesche on Entladung)
--
-- BUG (found in the pre-merge bug-hunt): fn_travel_complete (246, last replaced in 253) banks
-- the haul, delivers surveys, and sets status='completed' — but never touches the run's
-- travel_cargo or the bound travel_quest_instances. The migration-250 close-cleanup trigger
-- only fires on the transition INTO 'abandoned' (recall / Rückzug), NOT 'completed'. So a
-- traveller who banks at home while STILL CARRYING an undelivered Depesche leaves the bound
-- quest instance status='active' forever → the next fn_quest_accept raises QUEST_ACTIVE
-- permanently (a hard lockout — the same dangling-quest class 250 fixed, but on the complete
-- path it doesn't cover). Delivered cargo is already consumed by fn_quest_advance, so any cargo
-- still bound to the run at completion is, by construction, undelivered.
--
-- FIX: fail the bound active quest instance(s) and forfeit the run's remaining cargo BEFORE the
-- status flip — the same close-out the 250 trigger performs on abandon, inline here for the
-- 'completed' path. P0 forfeits (no Andenken re-anchor yet — that is the deferred P0c
-- cargo-redemption path the header at 253:153 references). Everything else (haul lodging,
-- survey delivery, honors, telemetry, audit, the CAS + auth guards) is reproduced verbatim.
--
-- Behind drift_p0_enabled=false — no runtime change until the gate is raised.


CREATE OR REPLACE FUNCTION public.fn_travel_complete(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run       travel_runs%ROWTYPE;
    v_is_home   BOOLEAN;
    v_haul      INT;
    v_anchor    UUID;
    v_visited   JSONB;
    v_keys      TEXT[];
    v_survey    JSONB;
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
    -- (qualities.vermessung_lodged). (P0c: cargo redemption lands here too.)
    v_haul := COALESCE((v_run.checkpoint ->> 'haul')::int, 0);
    UPDATE traveler_profiles
       SET qualities = jsonb_set(qualities, '{vermessung_lodged}',
             to_jsonb(COALESCE((qualities ->> 'vermessung_lodged')::int, 0) + v_haul))
     WHERE user_id = p_user;

    -- Survey delivery: resolve every FIRST-arrival node this run (checkpoint.visited),
    -- minus the traveller's own home (trivially theirs — it lands in visited on the
    -- return move), to its stable_key, then claim Erstvermessung honors first-write-wins.
    -- This only ever runs on a clean bank; a recall/Rückzug closed the run abandoned.
    v_visited := COALESCE(v_run.checkpoint -> 'visited', '[]'::jsonb);
    SELECT array_agg(n.stable_key)
      INTO v_keys
      FROM drift_chart_nodes n
     WHERE n.chart_version = v_run.chart_version
       AND n.id::text IN (SELECT jsonb_array_elements_text(v_visited))
       AND n.simulation_id IS DISTINCT FROM v_anchor;
    v_survey := fn_survey_deliver(p_user, COALESCE(v_keys, ARRAY[]::text[]), v_run.chart_version);

    -- Close out an undelivered Depesche the traveller banked while still carrying it. Delivered
    -- cargo was already consumed by fn_quest_advance, so any travel_cargo still bound to this run
    -- is undelivered: fail its bound active quest instance (else it stays 'active' on a closed
    -- run and the next fn_quest_accept hits QUEST_ACTIVE forever), then forfeit the cargo. The
    -- 250 trigger does this on the 'abandoned' transition; the 'completed' transition is not
    -- covered by it, so it is done inline here. (P0 forfeit — Andenken re-anchor is P0c.)
    UPDATE travel_quest_instances qi
       SET status = 'failed'
      FROM travel_cargo c
     WHERE c.run_id = p_run AND c.quest_instance_id = qi.id AND qi.status = 'active';
    DELETE FROM travel_cargo WHERE run_id = p_run;

    UPDATE travel_runs
       SET status = 'completed', closed_at = now(), run_version = run_version + 1,
           checkpoint = jsonb_build_object(
               'haul_banked', v_haul,
               'surveys_delivered', v_survey -> 'surveys_delivered',
               'honors_won', v_survey -> 'honors_won',
               'honor_keys', v_survey -> 'honor_keys')
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

-- Player-class posture re-asserted (CREATE OR REPLACE preserves the ACL; explicit for intent).
REVOKE ALL    ON FUNCTION public.fn_travel_complete(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_travel_complete(uuid, uuid, integer) TO authenticated, service_role;
