-- ============================================================================
-- Migration 159: Bootstrap agent_professions from primary_profession
-- ============================================================================
--
-- Problem: Migration 157 bootstrapped agent_needs, agent_mood, agent_opinions
-- but NOT agent_professions. Without profession qualification records,
-- fn_compute_agent_influence (migration 158) returns 0 for the profession
-- component, making the influence score artificially low. Almost all agents
-- land in WEAK tier (< 0.25) not due to game mechanics, but missing data.
--
-- Fix: For every agent with a primary_profession, create an agent_professions
-- row if one doesn't already exist. Default qualification_level = 3 (mid-range,
-- CHECK constraint is 1-5). Agents with existing profession records are skipped.
--
-- This gives an initial profession contribution of: 3/10 * 0.3 = 0.09 influence.
-- Combined with relationships (~0.16+), agents land at WEAK/AVERAGE boundary
-- (~0.25), which is the correct starting position for fresh agents.
-- As agents develop secondary professions, AVG(qualification_level) evolves.
-- ============================================================================

-- Step 1: Add UNIQUE constraint to prevent duplicate (agent, simulation, profession) tuples.
-- This enforces data integrity that the NOT EXISTS check alone cannot guarantee
-- under concurrent inserts or accidental re-runs.
ALTER TABLE agent_professions
  ADD CONSTRAINT uq_agent_sim_profession UNIQUE (agent_id, simulation_id, profession);

-- Step 2: Bootstrap professions for all active agents (including draft simulations,
-- so agents created during setup are not permanently excluded).
INSERT INTO agent_professions (simulation_id, agent_id, profession, qualification_level, is_primary)
SELECT
  a.simulation_id,
  a.id,
  a.primary_profession,
  3,    -- mid-range default (scale 1-5)
  true  -- mark as primary profession
FROM agents a
JOIN simulations s ON s.id = a.simulation_id
  AND s.status IN ('active', 'configuring', 'draft')
  AND s.deleted_at IS NULL
WHERE a.deleted_at IS NULL
  AND a.primary_profession IS NOT NULL
  AND a.primary_profession != ''
ON CONFLICT (agent_id, simulation_id, profession) DO NOTHING;
