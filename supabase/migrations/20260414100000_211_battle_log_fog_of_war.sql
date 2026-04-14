-- =============================================================================
-- Migration 211: Battle log fog-of-war filtering
-- =============================================================================
-- Fixes 5 playtest bugs (BUG-001, 002, 006, 007, 008) with a single
-- architectural fix: proper server-side fog-of-war filtering.
--
-- Problems:
--   1. RLS policy allows defender to see ALL event types targeting them,
--      including stealth failures (mission_failed) that should be invisible.
--   2. No application-level fog-of-war for admin users (service_role bypasses RLS).
--   3. Allied intel tagging was broken: ANY non-own/non-public entry was tagged
--      as allied intel even for unaligned players.
--
-- Solution:
--   1. Fix RLS policy: restrict defender-visible event types.
--   2. New RPC get_battle_log_for_player: fog-of-war + allied intel tagging in SQL.
--      Uses explicit WHERE (not reliant on RLS), so it works correctly for both
--      user JWT (RLS + WHERE) and service_role (WHERE only) callers.
--
-- Visibility rules (applied identically in RLS + RPC):
--   Rule 1: Public events (is_public = true)
--   Rule 2: Own actions (source_simulation_id = viewer)
--   Rule 3: Incoming visible threats (target = viewer, event_type restricted)
--   Rule 4: Allied intel (teammate is source or target)
--
-- NOT in Rule 3: counter_intel (source=sweeper sees via Rule 2; target=attacker
-- should NOT learn the detection method), mission_failed, mission_success,
-- operative_deployed (stealth events invisible to defender).
-- =============================================================================

-- ── 1. Fix RLS policy (defense in depth) ────────────────────────────────────

DROP POLICY IF EXISTS battle_log_select ON battle_log;
CREATE POLICY battle_log_select ON battle_log
  FOR SELECT USING (
    is_public = true
    OR EXISTS (
      -- Rule 2: Own actions
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = battle_log.epoch_id
        AND ep.simulation_id = battle_log.source_simulation_id
        AND ep.user_id = (SELECT auth.uid())
    )
    OR (
      -- Rule 3: Incoming visible threats (NO counter_intel — see header comment)
      battle_log.event_type IN (
        'detected', 'captured',
        'sabotage', 'propaganda', 'assassination',
        'agent_wounded', 'building_damaged', 'zone_fortified'
      )
      AND EXISTS (
        SELECT 1 FROM epoch_participants ep
        WHERE ep.epoch_id = battle_log.epoch_id
          AND ep.simulation_id = battle_log.target_simulation_id
          AND ep.user_id = (SELECT auth.uid())
      )
    )
    OR EXISTS (
      -- Rule 4: Allied intel
      SELECT 1 FROM epoch_participants my_ep
      JOIN epoch_participants ally_ep
        ON ally_ep.team_id = my_ep.team_id
        AND ally_ep.epoch_id = my_ep.epoch_id
        AND ally_ep.team_id IS NOT NULL
      WHERE my_ep.epoch_id = battle_log.epoch_id
        AND my_ep.user_id = (SELECT auth.uid())
        AND (
          ally_ep.simulation_id = battle_log.source_simulation_id
          OR ally_ep.simulation_id = battle_log.target_simulation_id
        )
    )
  );

-- ── 2. Fog-of-war RPC ──────────────────────────────────────────────────────
-- Single query with count(*) OVER() window function eliminates WHERE duplication.
-- SECURITY INVOKER: non-admin callers still get RLS (defense in depth).

CREATE OR REPLACE FUNCTION get_battle_log_for_player(
  p_epoch_id uuid,
  p_viewer_simulation_id uuid,
  p_event_type text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
DECLARE
  v_team_id uuid;
  v_result jsonb;
BEGIN
  -- Resolve viewer's team (NULL if unaligned)
  SELECT team_id INTO v_team_id
  FROM epoch_participants
  WHERE epoch_id = p_epoch_id
    AND simulation_id = p_viewer_simulation_id
  LIMIT 1;

  -- Single query: fog-of-war filter + allied_intel tagging + pagination + total count
  SELECT jsonb_build_object(
    'entries', coalesce(jsonb_agg(sub.row_data ORDER BY sub.created_at DESC), '[]'::jsonb),
    'total', coalesce(max(sub.total_count), 0)
  ) INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'id', bl.id,
        'epoch_id', bl.epoch_id,
        'cycle_number', bl.cycle_number,
        'event_type', bl.event_type,
        'narrative', bl.narrative,
        'source_simulation_id', bl.source_simulation_id,
        'target_simulation_id', bl.target_simulation_id,
        'mission_id', bl.mission_id,
        'is_public', bl.is_public,
        'metadata', CASE
          -- Allied intel: visible via teammate, not own action
          WHEN (
            NOT bl.is_public
            AND bl.source_simulation_id IS DISTINCT FROM p_viewer_simulation_id
            AND bl.target_simulation_id IS DISTINCT FROM p_viewer_simulation_id
            AND v_team_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM epoch_participants ts
              WHERE ts.epoch_id = p_epoch_id
                AND ts.team_id = v_team_id
                AND ts.simulation_id != p_viewer_simulation_id
                AND (
                  ts.simulation_id = bl.source_simulation_id
                  OR ts.simulation_id = bl.target_simulation_id
                )
            )
          )
          THEN coalesce(bl.metadata, '{}'::jsonb) || '{"allied_intel": true}'::jsonb
          ELSE coalesce(bl.metadata, '{}'::jsonb)
        END,
        'created_at', bl.created_at
      ) AS row_data,
      bl.created_at,
      count(*) OVER () AS total_count
    FROM battle_log bl
    WHERE bl.epoch_id = p_epoch_id
      AND (p_event_type IS NULL OR bl.event_type = p_event_type)
      AND (
        -- Rule 1: Public events
        bl.is_public = true
        -- Rule 2: Own actions
        OR bl.source_simulation_id = p_viewer_simulation_id
        -- Rule 3: Incoming visible threats (NO counter_intel)
        OR (
          bl.target_simulation_id = p_viewer_simulation_id
          AND bl.event_type IN (
            'detected', 'captured',
            'sabotage', 'propaganda', 'assassination',
            'agent_wounded', 'building_damaged', 'zone_fortified'
          )
        )
        -- Rule 4: Allied intel
        OR (
          v_team_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM epoch_participants ts
            WHERE ts.epoch_id = p_epoch_id
              AND ts.team_id = v_team_id
              AND ts.simulation_id != p_viewer_simulation_id
              AND (
                ts.simulation_id = bl.source_simulation_id
                OR ts.simulation_id = bl.target_simulation_id
              )
          )
        )
      )
    ORDER BY bl.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN coalesce(v_result, '{"entries": [], "total": 0}'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_battle_log_for_player IS
  'Fog-of-war filtered battle log for a specific player. '
  'Visibility: public events, own actions, incoming visible threats '
  '(detected/captured/sabotage/propaganda/assassination/wounded/damaged/fortified), '
  'and allied intel (tagged in metadata). Independent of RLS for admin callers.';
