-- Migration 168: Allow retreat during loot distribution phase
--
-- fn_abandon_dungeon_run only accepted ('active', 'combat', 'exploring')
-- but missed 'distributing'. Players who defeat the elite/boss and enter
-- loot distribution could not retreat — RPC raised exception.

CREATE OR REPLACE FUNCTION fn_abandon_dungeon_run(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_outcome       JSONB,
    p_depth         INT,
    p_room_index    INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    -- 1. Update run status
    UPDATE resonance_dungeon_runs
    SET status       = 'abandoned',
        outcome      = p_outcome,
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring', 'distributing');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- 2. Log abandonment event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'dungeon_abandoned',
        'The party retreats from the darkness.',
        'Die Gruppe zieht sich aus der Dunkelheit zurück.',
        p_outcome
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INT, INT) TO service_role;
