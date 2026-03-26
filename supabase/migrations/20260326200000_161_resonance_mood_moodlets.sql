-- ============================================================================
-- Migration 161: Resonance → Agent Mood (A3 Game Systems Integration)
--
-- Implements the resonance→mood bridge: active platform resonances generate
-- low-strength moodlets for agents in susceptible simulations.
--
-- Design principles (per game-systems-integration.md §A3):
--   - Background pressure, NOT dominant force
--   - Moodlet strength LOW: −2 to +2 (vs. normal −20 to +20)
--   - One moodlet per active archetype (multiple resonances = multiple moodlets)
--   - Subsiding resonances contribute at 0.5× strength
--   - Effective magnitude = MIN(resonance.magnitude × susceptibility, 1.0)
--
-- Archetype → emotion mapping (Jungian archetypes → mood effects):
--   The Tower (economic)     → anxiety  (−2)
--   The Shadow (conflict)    → anxiety  (−2)
--   The Devourer (pandemic)  → dread    (−2)
--   The Deluge (disaster)    → fear     (−2)
--   The Overthrow (politics) → unease   (−1)
--   The Prometheus (tech)    → hope     (+2)
--   The Awakening (culture)  → wonder   (+1)
--   The Entropy (environ.)   → despair  (−2)
--
-- PostgreSQL function: fn_apply_resonance_moodlets(p_simulation_id)
-- Called from HeartbeatService Phase 3b (after resonance pressure, before
-- narrative arcs). Atomic: deletes stale resonance moodlets, inserts fresh
-- ones in a single transaction. No Python loop, no N+1 queries.
--
-- References:
--   - ADR-007: Postgres-first for concurrent data
--   - Migration 074: substrate_resonances + resonance_impacts tables
--   - Migration 076: fn_get_resonance_susceptibility()
--   - Migration 145: agent_moodlets + agent_mood tables
-- ============================================================================


-- ── fn_apply_resonance_moodlets ─────────────────────────────────────────────
-- Replaces any existing resonance_pressure moodlets for the simulation,
-- then inserts fresh moodlets based on currently active resonances.
-- Returns the number of moodlets inserted.

CREATE OR REPLACE FUNCTION fn_apply_resonance_moodlets(
  p_simulation_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_rows_this_loop INTEGER;
  v_archetype_rec RECORD;
  v_base_strength INTEGER;
  v_emotion TEXT;
  v_moodlet_type TEXT;
  v_eff_mag NUMERIC;
  v_final_strength INTEGER;
  v_subsiding_factor NUMERIC;
BEGIN
  -- 1. Delete existing resonance_pressure moodlets for this simulation.
  --    These are timed (4h) and would expire soon anyway, but replacing
  --    ensures we always reflect the CURRENT resonance state.
  DELETE FROM agent_moodlets
  WHERE simulation_id = p_simulation_id
    AND stacking_group = 'resonance_pressure';

  -- 2. For each active/subsiding resonance impacting this simulation,
  --    compute effective magnitude and map archetype → moodlet.
  FOR v_archetype_rec IN
    SELECT
      sr.archetype,
      sr.resonance_signature,
      sr.magnitude,
      sr.status AS resonance_status,
      ri.susceptibility,
      ri.effective_magnitude AS stored_eff_mag,
      sr.id AS resonance_id
    FROM resonance_impacts ri
    JOIN substrate_resonances sr ON sr.id = ri.resonance_id
    WHERE ri.simulation_id = p_simulation_id
      AND sr.status IN ('impacting', 'subsiding')
      AND sr.deleted_at IS NULL
  LOOP
    -- Compute effective magnitude (use stored if available, else recompute)
    IF v_archetype_rec.stored_eff_mag IS NOT NULL THEN
      v_eff_mag := v_archetype_rec.stored_eff_mag;
    ELSE
      v_eff_mag := LEAST(
        v_archetype_rec.magnitude * v_archetype_rec.susceptibility,
        1.0
      );
    END IF;

    -- Subsiding resonances contribute at 0.5× strength
    v_subsiding_factor := CASE
      WHEN v_archetype_rec.resonance_status = 'subsiding' THEN 0.5
      ELSE 1.0
    END;

    -- Map archetype → (moodlet_type, emotion, base_strength)
    CASE v_archetype_rec.archetype
      WHEN 'The Tower' THEN
        v_moodlet_type := 'economic_pressure';
        v_emotion := 'anxiety';
        v_base_strength := -2;
      WHEN 'The Shadow' THEN
        v_moodlet_type := 'conflict_pressure';
        v_emotion := 'anxiety';
        v_base_strength := -2;
      WHEN 'The Devouring Mother' THEN
        v_moodlet_type := 'plague_dread';
        v_emotion := 'dread';
        v_base_strength := -2;
      WHEN 'The Deluge' THEN
        v_moodlet_type := 'natural_upheaval';
        v_emotion := 'fear';
        v_base_strength := -2;
      WHEN 'The Overthrow' THEN
        v_moodlet_type := 'political_uncertainty';
        v_emotion := 'unease';
        v_base_strength := -1;
      WHEN 'The Prometheus' THEN
        v_moodlet_type := 'innovation_wave';
        v_emotion := 'hope';
        v_base_strength := 2;
      WHEN 'The Awakening' THEN
        v_moodlet_type := 'consciousness_shift';
        v_emotion := 'wonder';
        v_base_strength := 1;
      WHEN 'The Entropy' THEN
        v_moodlet_type := 'decay_pressure';
        v_emotion := 'despair';
        v_base_strength := -2;
      ELSE
        CONTINUE;  -- Unknown archetype, skip
    END CASE;

    -- Compute final strength: base × effective_magnitude × subsiding_factor
    -- Result is in range [−2, +2]
    v_final_strength := ROUND(
      v_base_strength * v_eff_mag * v_subsiding_factor
    )::INTEGER;

    -- Skip if strength rounded to zero (too weak to matter)
    IF v_final_strength = 0 THEN
      CONTINUE;
    END IF;

    -- Clamp to [−2, +2] (defensive, should already be in range)
    v_final_strength := GREATEST(-2, LEAST(2, v_final_strength));

    -- 3. Bulk-insert one moodlet per agent that has a mood record in this sim.
    --    Only agents with agent_mood rows are active in the autonomy system.
    INSERT INTO agent_moodlets (
      agent_id, simulation_id, moodlet_type, emotion, strength,
      source_type, source_id, source_description,
      decay_type, initial_strength, expires_at, stacking_group
    )
    SELECT
      am.agent_id,
      p_simulation_id,
      v_moodlet_type,
      v_emotion,
      v_final_strength,
      'system',
      v_archetype_rec.resonance_id,
      'Substrate resonance: ' || v_archetype_rec.archetype,
      'timed',
      v_final_strength,
      now() + INTERVAL '5 hours',  -- Slightly longer than 4h tick to avoid gaps
      'resonance_pressure'
    FROM agent_mood am
    WHERE am.simulation_id = p_simulation_id;

    GET DIAGNOSTICS v_rows_this_loop = ROW_COUNT;
    v_inserted := v_inserted + v_rows_this_loop;
  END LOOP;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION fn_apply_resonance_moodlets(UUID) IS
  'A3 Resonance → Mood: applies low-strength moodlets to all agents based on '
  'active platform resonances. Atomic delete-and-replace per tick. '
  'Archetype determines emotion/strength, effective magnitude scales intensity.';


-- ── Permissions ─────────────────────────────────────────────────────────────
-- Called from backend HeartbeatService with service_role (admin) client.
-- No need for anon/authenticated access (server-side only).

GRANT EXECUTE ON FUNCTION fn_apply_resonance_moodlets(UUID) TO service_role;
