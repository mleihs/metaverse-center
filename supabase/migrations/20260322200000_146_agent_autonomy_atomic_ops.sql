-- ============================================================================
-- Migration 146: Agent Autonomy — Atomic Operations
--
-- Moves fetch-compute-update patterns from Python into PostgreSQL:
--   1. fn_fulfill_agent_need: atomic need fulfillment (LEAST/GREATEST clamp)
--   2. fn_update_stress_levels: bulk stress update with mood-based logic
--   3. fn_add_agent_stress: atomic stress increment
--   4. fn_increment_opinion_interaction: atomic counter + timestamp
-- ============================================================================


-- ── 1. Atomic need fulfillment ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_fulfill_agent_need(
  p_agent_id UUID,
  p_need_type TEXT,
  p_amount REAL
) RETURNS REAL
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old REAL;
  v_new REAL;
BEGIN
  -- Dynamic column update: need_type must be one of the 5 valid columns
  IF p_need_type NOT IN ('social', 'purpose', 'safety', 'comfort', 'stimulation') THEN
    RAISE EXCEPTION 'Invalid need type: %', p_need_type;
  END IF;

  -- Atomic read + update in one statement
  EXECUTE format(
    'UPDATE agent_needs SET %I = GREATEST(0, LEAST(100, %I + $1))
     WHERE agent_id = $2
     RETURNING %I',
    p_need_type, p_need_type, p_need_type
  ) INTO v_new USING p_amount, p_agent_id;

  RETURN COALESCE(v_new, 0);
END;
$$;

COMMENT ON FUNCTION fn_fulfill_agent_need IS
  'Atomic need fulfillment: adds amount to specified need column, clamped to 0-100. Returns new value.';


-- ── 2. Bulk stress level update ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_stress_levels(
  p_simulation_id UUID,
  p_recovery_per_tick INTEGER DEFAULT 15
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Single UPDATE with CASE logic:
  -- Positive mood → recover stress (scaled by resilience)
  -- Negative mood (<-20) → gain stress (scaled by inverse resilience)
  -- Neutral → slow natural recovery
  UPDATE agent_mood SET
    stress_level = GREATEST(0, LEAST(1000,
      CASE
        WHEN mood_score > 0 THEN
          stress_level - (p_recovery_per_tick * (0.5 + resilience))::INTEGER
        WHEN mood_score < -20 THEN
          stress_level + (ABS(mood_score) * 0.3 * (1.5 - resilience))::INTEGER
        ELSE
          stress_level - 5
      END
    ))
  WHERE simulation_id = p_simulation_id
    AND (
      (mood_score > 0 AND stress_level > 0)
      OR mood_score < -20
      OR (mood_score BETWEEN -20 AND 0 AND stress_level > 0)
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION fn_update_stress_levels IS
  'Bulk update stress for all agents in a simulation. Positive mood recovers stress (resilience-scaled), negative mood accumulates it. Single UPDATE statement.';


-- ── 3. Atomic stress increment ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_add_agent_stress(
  p_agent_id UUID,
  p_amount REAL
) RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE agent_mood
  SET stress_level = GREATEST(0, LEAST(1000, stress_level + p_amount::INTEGER))
  WHERE agent_id = p_agent_id
  RETURNING stress_level;
$$;

COMMENT ON FUNCTION fn_add_agent_stress IS
  'Atomic stress increment/decrement, clamped to 0-1000. Returns new stress level.';


-- ── 4. Atomic opinion interaction counter ───────────────────────────────────

CREATE OR REPLACE FUNCTION fn_increment_opinion_interaction(
  p_agent_id UUID,
  p_target_agent_id UUID
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE agent_opinions
  SET interaction_count = interaction_count + 1,
      last_interaction_at = now()
  WHERE agent_id = p_agent_id
    AND target_agent_id = p_target_agent_id;
$$;

COMMENT ON FUNCTION fn_increment_opinion_interaction IS
  'Atomic increment of interaction_count + timestamp update. No race conditions.';
