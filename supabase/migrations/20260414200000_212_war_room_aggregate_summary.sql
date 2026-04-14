-- =============================================================================
-- Migration 212: War Room aggregate summary support
-- =============================================================================
-- BUG-005: War Room stats always show 0 because they count per-cycle while
-- the battle log shows all cycles. When p_cycle_number = 0, aggregate across
-- all cycles for the epoch.

CREATE OR REPLACE FUNCTION get_cycle_battle_summary(
  p_epoch_id uuid,
  p_cycle_number int,
  p_simulation_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'cycle_number', p_cycle_number,
    'missions_deployed', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
        AND event_type = 'operative_deployed'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'successes', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
        AND event_type = 'mission_success'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'failures', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
        AND event_type = 'mission_failed'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'detections', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
        AND event_type IN ('detected', 'captured')
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
    ),
    'events_by_type', (
      SELECT coalesce(jsonb_object_agg(event_type, cnt), '{}'::jsonb)
      FROM (
        SELECT event_type, count(*) AS cnt
        FROM battle_log
        WHERE epoch_id = p_epoch_id
          AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
          AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
        GROUP BY event_type
      ) sub
    ),
    'narrative_highlights', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'narrative', narrative,
          'is_public', is_public,
          'source_simulation_id', source_simulation_id,
          'target_simulation_id', target_simulation_id,
          'created_at', created_at
        ) ORDER BY created_at
      ), '[]'::jsonb)
      FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND (p_cycle_number = 0 OR cycle_number = p_cycle_number)
        AND event_type IN ('phase_change', 'betrayal', 'alliance_formed', 'alliance_dissolved', 'building_damaged', 'agent_wounded')
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
    )
  );
$$;
