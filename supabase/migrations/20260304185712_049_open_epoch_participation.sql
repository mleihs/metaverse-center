-- Migration 049: Open Epoch Participation
-- Allow any authenticated user to join an epoch with any template simulation.
-- Adds user_id column to epoch_participants, rewrites competitive-layer RLS
-- to use direct user_id checks instead of simulation_members JOINs, and
-- extends user_has_simulation_access() so epoch participants can read
-- simulation data (agents, buildings, zones, etc.) for their participating sim.

-- ── 1. Add user_id column ──────────────────────────────────────────────

ALTER TABLE epoch_participants ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Backfill from simulation_members.
-- Strategy: for each participant, pick the simulation member who is a member of
-- the FEWEST other simulations in this epoch. This avoids the admin-owns-all
-- problem where a single user (admin) is owner of all sims and would be assigned
-- to every participant, violating the unique (epoch_id, user_id) constraint.
-- Per-sim players have 1 membership → preferred. Admin has N memberships → fallback.
UPDATE epoch_participants ep
SET user_id = (
  SELECT sm.user_id
  FROM simulation_members sm
  WHERE sm.simulation_id = resolve_template_id(ep.simulation_id)
    AND sm.member_role IN ('editor', 'admin', 'owner')
  ORDER BY (
    -- Count how many OTHER participants' sims this user is also a member of
    SELECT COUNT(*) FROM epoch_participants ep2
    JOIN simulation_members sm2
      ON sm2.simulation_id = resolve_template_id(ep2.simulation_id)
      AND sm2.user_id = sm.user_id
      AND sm2.member_role IN ('editor', 'admin', 'owner')
    WHERE ep2.epoch_id = ep.epoch_id
      AND ep2.id != ep.id
      AND ep2.is_bot = false
  ) ASC, sm.user_id  -- tiebreak by user_id for determinism
  LIMIT 1
)
WHERE ep.is_bot = false;

-- For bot participants, user_id stays NULL — make column NOT NULL only for humans
-- Actually bots don't have a user, so we need to handle this.
-- Bots have is_bot = true, humans have is_bot = false.
-- Set a NOT NULL constraint only via CHECK, allowing NULL for bots.
ALTER TABLE epoch_participants
  ADD CONSTRAINT epoch_participants_user_id_required
  CHECK (is_bot = true OR user_id IS NOT NULL);

-- One user per epoch (can't join twice with different sims)
-- Partial index: only enforce for non-bot participants
CREATE UNIQUE INDEX epoch_participants_user_epoch_unique
  ON epoch_participants (epoch_id, user_id)
  WHERE user_id IS NOT NULL;

-- Index for fast user_id lookups in RLS
CREATE INDEX idx_epoch_participants_user_id ON epoch_participants (user_id)
  WHERE user_id IS NOT NULL;


-- ── 2. Update user_has_simulation_access() ─────────────────────────────
-- Epoch participants should be able to read simulation data for their
-- participating simulation (agents, zones, buildings, etc.)

CREATE OR REPLACE FUNCTION public.user_has_simulation_access(sim_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM simulation_members
        WHERE simulation_id = sim_id AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM epoch_participants
        WHERE simulation_id = sim_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── 3. Tighten epoch_participants INSERT policy ────────────────────────
-- Ensure user_id = auth.uid() on insert (or is_bot = true for bot adds)

DROP POLICY IF EXISTS epoch_participants_insert ON epoch_participants;
CREATE POLICY epoch_participants_insert ON epoch_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR is_bot = true
  );

-- Allow participants to leave (delete their own row)
DROP POLICY IF EXISTS epoch_participants_delete ON epoch_participants;
CREATE POLICY epoch_participants_delete ON epoch_participants
  FOR DELETE USING (
    user_id = auth.uid()
  );


-- ── 4. Rewrite epoch_chat_messages RLS policies ───────────────────────
-- Replace simulation_members JOIN + resolve_template_id with direct user_id

DROP POLICY IF EXISTS epoch_chat_select_epoch ON epoch_chat_messages;
CREATE POLICY epoch_chat_select_epoch ON epoch_chat_messages
  FOR SELECT USING (
    channel_type = 'epoch'
    AND EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND ep.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS epoch_chat_select_team ON epoch_chat_messages;
CREATE POLICY epoch_chat_select_team ON epoch_chat_messages
  FOR SELECT USING (
    channel_type = 'team'
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND ep.team_id = epoch_chat_messages.team_id
        AND ep.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS epoch_chat_insert ON epoch_chat_messages;
CREATE POLICY epoch_chat_insert ON epoch_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = epoch_chat_messages.epoch_id
        AND ep.user_id = auth.uid()
    )
  );


-- ── 5. Rewrite operative_missions RLS policies ───────────────────────

DROP POLICY IF EXISTS operative_missions_select ON operative_missions;
CREATE POLICY operative_missions_select ON operative_missions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = operative_missions.epoch_id
        AND ep.simulation_id = operative_missions.source_simulation_id
        AND ep.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = operative_missions.epoch_id
        AND ep.simulation_id = operative_missions.target_simulation_id
        AND ep.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS operative_missions_insert ON operative_missions;
CREATE POLICY operative_missions_insert ON operative_missions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = operative_missions.epoch_id
        AND ep.simulation_id = operative_missions.source_simulation_id
        AND ep.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS operative_missions_update ON operative_missions;
CREATE POLICY operative_missions_update ON operative_missions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = operative_missions.epoch_id
        AND ep.simulation_id = operative_missions.source_simulation_id
        AND ep.user_id = auth.uid()
    )
  );


-- ── 6. Rewrite battle_log SELECT policy ──────────────────────────────

DROP POLICY IF EXISTS battle_log_select ON battle_log;
CREATE POLICY battle_log_select ON battle_log
  FOR SELECT USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = battle_log.epoch_id
        AND ep.simulation_id = battle_log.source_simulation_id
        AND ep.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM epoch_participants ep
      WHERE ep.epoch_id = battle_log.epoch_id
        AND ep.simulation_id = battle_log.target_simulation_id
        AND ep.user_id = auth.uid()
    )
  );
