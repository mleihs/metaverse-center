-- Migration 046: Fix RLS policies for game instance simulation_ids
--
-- Problem: 7 RLS policies across epoch_chat_messages, operative_missions, and
-- battle_log join simulation_members.simulation_id (template UUID) against
-- epoch_participants.simulation_id or source/target_simulation_id (game instance
-- UUIDs). Game instances have different UUIDs than their source templates, so
-- these JOINs never match — breaking chat, operative visibility, and private
-- battle log entries for epoch players.
--
-- Solution: A STABLE helper function resolve_template_id(uuid) returns the
-- source_template_id for game instances, or the id itself for templates.
-- All 7 policies rewritten to use this function.

-- ── Data fix: Gaslit Reach description (BUG-001) ─────────────────

UPDATE simulations
SET description = 'A drowned kingdom beneath the Unterzee. Ancient waterways, bioluminescent fungi, Victorian-era intrigue, and eldritch secrets. Something stirs in the deep.'
WHERE slug = 'the-gaslit-reach';


-- ── Helper function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_template_id(sim_id uuid)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(source_template_id, id) FROM simulations WHERE id = sim_id;
$$;


-- ── epoch_chat_messages (3 policies) ──────────────────────────────

-- SELECT: epoch channel
DROP POLICY IF EXISTS epoch_chat_select_epoch ON epoch_chat_messages;
CREATE POLICY epoch_chat_select_epoch ON epoch_chat_messages
  FOR SELECT USING (
    channel_type = 'epoch'
    AND EXISTS (
      SELECT 1
      FROM epoch_participants ep
      JOIN simulation_members sm
        ON sm.simulation_id = resolve_template_id(ep.simulation_id)
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND sm.user_id = auth.uid()
    )
  );

-- SELECT: team channel
DROP POLICY IF EXISTS epoch_chat_select_team ON epoch_chat_messages;
CREATE POLICY epoch_chat_select_team ON epoch_chat_messages
  FOR SELECT USING (
    channel_type = 'team'
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM epoch_participants ep
      JOIN simulation_members sm
        ON sm.simulation_id = resolve_template_id(ep.simulation_id)
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND ep.team_id = epoch_chat_messages.team_id
        AND sm.user_id = auth.uid()
    )
  );

-- INSERT: sender must be epoch participant
DROP POLICY IF EXISTS epoch_chat_insert ON epoch_chat_messages;
CREATE POLICY epoch_chat_insert ON epoch_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM epoch_participants ep
      JOIN simulation_members sm
        ON sm.simulation_id = resolve_template_id(ep.simulation_id)
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND sm.user_id = auth.uid()
    )
  );


-- ── operative_missions (3 policies) ──────────────────────────────

-- SELECT: source or target participant
DROP POLICY IF EXISTS operative_missions_select ON operative_missions;
CREATE POLICY operative_missions_select ON operative_missions
  FOR SELECT USING (
    resolve_template_id(source_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
    )
    OR resolve_template_id(target_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
    )
  );

-- INSERT: source simulation owner
DROP POLICY IF EXISTS operative_missions_insert ON operative_missions;
CREATE POLICY operative_missions_insert ON operative_missions
  FOR INSERT WITH CHECK (
    resolve_template_id(source_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
        AND simulation_members.member_role = 'owner'
    )
  );

-- UPDATE: source simulation owner
DROP POLICY IF EXISTS operative_missions_update ON operative_missions;
CREATE POLICY operative_missions_update ON operative_missions
  FOR UPDATE USING (
    resolve_template_id(source_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
        AND simulation_members.member_role = 'owner'
    )
  );


-- ── battle_log event_type constraint ──────────────────────────────

-- Add 'intel_report' to allowed event types (was missing, causing spy intel
-- writes to silently fail due to CHECK constraint violation)
ALTER TABLE battle_log DROP CONSTRAINT IF EXISTS battle_log_event_type_check;
ALTER TABLE battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
  event_type = ANY (ARRAY[
    'operative_deployed', 'mission_success', 'mission_failed',
    'detected', 'captured', 'sabotage', 'propaganda', 'assassination',
    'infiltration', 'alliance_formed', 'alliance_dissolved', 'betrayal',
    'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
    'building_damaged', 'agent_wounded', 'counter_intel', 'intel_report'
  ])
);


-- ── battle_log (1 policy) ────────────────────────────────────────

-- SELECT: public entries visible to all, private entries visible to participants
DROP POLICY IF EXISTS battle_log_select ON battle_log;
CREATE POLICY battle_log_select ON battle_log
  FOR SELECT USING (
    is_public = true
    OR resolve_template_id(source_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
    )
    OR resolve_template_id(target_simulation_id) IN (
      SELECT simulation_members.simulation_id
      FROM simulation_members
      WHERE simulation_members.user_id = auth.uid()
    )
  );
