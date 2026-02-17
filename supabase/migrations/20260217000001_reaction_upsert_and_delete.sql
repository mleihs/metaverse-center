-- Deduplicate: keep only newest reaction per agent+event pair
DELETE FROM event_reactions r1
USING event_reactions r2
WHERE r1.event_id = r2.event_id
  AND r1.agent_id = r2.agent_id
  AND r1.created_at < r2.created_at;

-- UNIQUE constraint: one reaction per agent per event
ALTER TABLE event_reactions
  ADD CONSTRAINT uq_event_reactions_agent_event UNIQUE (event_id, agent_id);

-- Update delete policy: editors can delete reactions (not just admins)
DROP POLICY IF EXISTS event_reactions_delete ON event_reactions;
CREATE POLICY event_reactions_delete ON event_reactions FOR DELETE
  USING (user_has_simulation_role(simulation_id, 'editor'));
