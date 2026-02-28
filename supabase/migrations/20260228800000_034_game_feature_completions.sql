-- Migration 034: Game Feature Completions
-- Adds columns for 5 missing competitive layer mechanics:
--   A2: Ambassador blocking (assassin success effect)
--   A3: Infiltration penalty (infiltrator success effect)
--   A5: Betrayal penalty (detected betrayal consequence)

-- A2: Assassin can block ambassador status for 3 cycles
ALTER TABLE agents ADD COLUMN ambassador_blocked_until TIMESTAMPTZ;
CREATE INDEX idx_agents_ambassador_blocked ON agents (ambassador_blocked_until)
  WHERE ambassador_blocked_until IS NOT NULL;

-- A3: Infiltrator can reduce embassy effectiveness for 3 cycles
ALTER TABLE embassies ADD COLUMN infiltration_penalty NUMERIC(3,2) DEFAULT 0;
ALTER TABLE embassies ADD COLUMN infiltration_penalty_expires_at TIMESTAMPTZ;

-- A5: Detected betrayal applies diplomatic score penalty
ALTER TABLE epoch_participants ADD COLUMN betrayal_penalty NUMERIC(3,2) DEFAULT 0;
