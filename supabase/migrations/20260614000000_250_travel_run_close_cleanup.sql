-- Migration 250: DRIFT — travel_run_close_cleanup (recall/Rückzug forfeits cargo + quests)
--
-- Playtest finding (P0c): when a run ABANDONS, the carried Depesche cargo + the bound
-- quest instance must be forfeited. Two abandon paths existed and only one cleaned up:
--   * Rückzug (fn_travel_abandon) DELETEd the run's cargo — but left the bound quest
--     instance status='active', so the next fn_quest_accept hit QUEST_ACTIVE forever.
--   * The §19.4 recall floor inside fn_travel_move (KH 0 OR window expired away from home)
--     set status='abandoned' but touched NEITHER cargo NOR the quest → orphaned cargo on a
--     dead run AND a dangling active quest. Surfaced live: a window-expiry recall while
--     carrying a deliver Depesche left the traveler permanently unable to accept another.
--
-- Fix: one AFTER-UPDATE trigger on travel_runs that fires on the transition INTO
-- 'abandoned' and does the forfeit in ONE place — so every current and future close path
-- (move-recall, Rückzug, and any later abandon route) cleans up identically (DRY). The
-- quest-fail must run while the cargo→quest link still exists (the only run→quest link is
-- travel_cargo.quest_instance_id), so fn_travel_abandon is slimmed to drop its own early
-- cargo DELETE and let the trigger handle both — the status UPDATE it already does is the
-- trigger's firing edge.
--
-- Scope: only 'abandoned' (forfeit). 'completed' (Entladung) re-anchors Andenken cargo
-- (run_id→NULL) and is the deferred P0c cargo-redemption path — deliberately NOT swept
-- here. The §19.4 echo-SCATTER of forfeited cargo (vs plain delete) through the hospitality
-- gate stays the richer P0c+ enrichment; this migration removes the dangling-state bug.
--
-- All behind drift_p0_enabled=false — no runtime change until the gate is raised.


-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_travel_run_close_cleanup() — the forfeit trigger
-- ═══════════════════════════════════════════════════════════════════
-- Fires only on the edge INTO 'abandoned'. Fails the quest instances bound to this run
-- (via the cargo link, while it still exists), then forfeits the run's cargo. SECURITY
-- DEFINER + pinned search_path: the trigger writes quest/cargo rows as the table owner
-- (it only ever fires from a DEFINER RPC or a service_role write — players cannot UPDATE
-- travel_runs directly under RLS).

CREATE OR REPLACE FUNCTION public.fn_travel_run_close_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Fail the Depeschen bound to this run (resolved through the cargo link, which the
    -- DELETE below then clears). Owner-scoped + active-only so a re-used instance id can
    -- never be touched.
    UPDATE travel_quest_instances
       SET status = 'failed'
     WHERE owner_user_id = NEW.user_id
       AND status = 'active'
       AND id IN (SELECT quest_instance_id FROM travel_cargo
                   WHERE run_id = NEW.id AND quest_instance_id IS NOT NULL);

    -- Forfeit the run's cargo (Rückzug + recall semantics; discoveries are kept).
    DELETE FROM travel_cargo WHERE run_id = NEW.id;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_travel_run_close_cleanup() IS
    'AFTER-UPDATE trigger on travel_runs: on the transition into status=''abandoned'' (recall floor in fn_travel_move OR Rückzug in fn_travel_abandon), forfeits the run''s travel_cargo and fails the bound travel_quest_instances. The single cargo-forfeit chokepoint so every abandon path cleans up identically (DRY). Does NOT fire on ''completed'' (Entladung re-anchors Andenken cargo — the deferred P0c redemption path).';

DROP TRIGGER IF EXISTS trg_travel_run_close_cleanup ON travel_runs;
CREATE TRIGGER trg_travel_run_close_cleanup
    AFTER UPDATE OF status ON travel_runs
    FOR EACH ROW
    WHEN (NEW.status = 'abandoned' AND OLD.status IS DISTINCT FROM 'abandoned')
    EXECUTE FUNCTION fn_travel_run_close_cleanup();


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_travel_abandon — slimmed to let the trigger forfeit the cargo
-- ═══════════════════════════════════════════════════════════════════
-- Identical to migration 246 except the explicit `DELETE FROM travel_cargo` is removed:
-- the status UPDATE now fires trg_travel_run_close_cleanup, which forfeits the cargo AND
-- fails the bound quest (the early delete used to sever the cargo→quest link before the
-- trigger could read it). Player-class grants are unchanged by CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.fn_travel_abandon(
    p_user UUID, p_run UUID, p_run_version INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run travel_runs%ROWTYPE;
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

    -- Rückzug: the status flip fires trg_travel_run_close_cleanup, which forfeits the
    -- run's unanchored cargo + fails the bound Depeschen; discoveries are kept.
    UPDATE travel_runs
       SET status = 'abandoned', closed_at = now(), run_version = run_version + 1
     WHERE id = p_run
     RETURNING * INTO v_run;

    INSERT INTO travel_telemetry_events (user_id, event_key, run_id)
    VALUES (p_user, 'drift_run_closed', p_run);
    PERFORM travel_audit(p_user, 'travel_abandon', 'travel_run', p_run, NULL, '{}'::jsonb);

    RETURN to_jsonb(v_run);
END;
$$;
