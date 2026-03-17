-- Migration 128: Auto-draft RPC — replace N per-participant queries with 1 SQL call.
--
-- fn_auto_draft_participants(p_epoch_id, p_max_agents)
-- For each participant without drafted_agent_ids, picks up to p_max_agents
-- agents from their simulation (ordered by created_at) and sets
-- drafted_agent_ids + draft_completed_at in a single UPDATE.

CREATE OR REPLACE FUNCTION fn_auto_draft_participants(
    p_epoch_id   UUID,
    p_max_agents INT DEFAULT 6
)
RETURNS SETOF epoch_participants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH undrafted AS (
        SELECT ep.id, ep.simulation_id
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
          AND ep.drafted_agent_ids IS NULL
    ),
    ranked AS (
        SELECT a.id AS agent_id, a.simulation_id,
               ROW_NUMBER() OVER (
                   PARTITION BY a.simulation_id ORDER BY a.created_at
               ) AS rn
        FROM agents a
        JOIN undrafted u ON a.simulation_id = u.simulation_id
        WHERE a.deleted_at IS NULL
    ),
    draft_sets AS (
        SELECT r.simulation_id,
               ARRAY_AGG(r.agent_id ORDER BY r.rn) AS ids
        FROM ranked r
        WHERE r.rn <= p_max_agents
        GROUP BY r.simulation_id
    )
    UPDATE epoch_participants ep
    SET drafted_agent_ids   = ds.ids,
        draft_completed_at  = NOW()
    FROM draft_sets ds
    JOIN undrafted u ON u.simulation_id = ds.simulation_id
    WHERE ep.id = u.id
      AND ep.drafted_agent_ids IS NULL
    RETURNING ep.*;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_auto_draft_participants(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_auto_draft_participants(UUID, INT) TO service_role;
