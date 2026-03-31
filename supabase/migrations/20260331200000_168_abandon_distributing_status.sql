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

-- Also update available_dungeons VIEW to treat 'distributing' as an active/blocking status.
-- Previously only ('active', 'combat', 'exploring') blocked new runs, so a stuck distributing
-- run would make the dungeon permanently unavailable.
CREATE OR REPLACE VIEW available_dungeons AS
SELECT
    sr.archetype,
    sr.resonance_signature AS signature,
    sr.id AS resonance_id,
    ri.simulation_id,
    sr.magnitude,
    ri.susceptibility,
    ri.effective_magnitude,
    LEAST(5, GREATEST(1, ROUND(ri.effective_magnitude * 5)::INT)) AS suggested_difficulty,
    CASE LEAST(5, GREATEST(1, ROUND(ri.effective_magnitude * 5)::INT))
        WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 5 WHEN 4 THEN 6 WHEN 5 THEN 7
    END AS suggested_depth,
    (SELECT MAX(dr.created_at) FROM resonance_dungeon_runs dr
     WHERE dr.simulation_id = ri.simulation_id AND dr.archetype = sr.archetype) AS last_run_at,
    NOT EXISTS (
        SELECT 1 FROM resonance_dungeon_runs dr
        WHERE dr.simulation_id = ri.simulation_id
        AND dr.archetype = sr.archetype
        AND dr.status IN ('active', 'combat', 'exploring', 'distributing')
    ) AS available
FROM resonance_impacts ri
LEFT JOIN substrate_resonances sr ON sr.id = ri.resonance_id
WHERE ri.status IN ('completed', 'generating')
AND sr.id IS NOT NULL
AND sr.status IN ('detected', 'impacting')
AND sr.deleted_at IS NULL
AND ri.effective_magnitude >= 0.3;

GRANT SELECT ON available_dungeons TO authenticated;
