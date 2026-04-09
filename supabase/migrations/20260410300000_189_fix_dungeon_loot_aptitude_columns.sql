-- Migration 189: Fix fn_apply_dungeon_loot aptitude_boost column names.
--
-- L2 FIX: Migration 177 introduced wrong column names in the aptitude_boost
-- branch of fn_apply_dungeon_loot (6-arg overload):
--   - `SET level = level + 1` → should be `SET aptitude_level = aptitude_level + 1`
--   - `WHERE aptitude = v_aptitude` → should be `WHERE operative_type = v_aptitude`
--
-- This caused all dungeon aptitude boosts to silently fail (UPDATE matched 0 rows).
-- The agent_aptitudes table (migration 047) uses columns: operative_type, aptitude_level.
--
-- Also fixes SECURITY DEFINER → adds proper REVOKE/GRANT per ADR-006.

CREATE OR REPLACE FUNCTION fn_apply_dungeon_loot(
  p_agent_id UUID,
  p_simulation_id UUID,
  p_run_id UUID,
  p_loot_id TEXT,
  p_effect_type TEXT,
  p_effect_params JSONB
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID := p_agent_id;
  v_sim_id UUID := p_simulation_id;
  v_run_id UUID := p_run_id;
  v_loot_id TEXT := p_loot_id;
  v_effect_type TEXT := p_effect_type;
  v_params JSONB := p_effect_params;
  v_current_boost INT;
  v_max_cap INT := 2;
  v_aptitude TEXT;
  v_importance INT;
  v_dimension TEXT;
  v_delta NUMERIC;
  v_current_val NUMERIC;
  v_new_val NUMERIC;
BEGIN
  -- aptitude_boost: +1 to chosen aptitude, capped at +2 total per agent
  IF v_effect_type = 'aptitude_boost' THEN
    v_aptitude := v_params->>'aptitude';
    IF v_aptitude IS NULL THEN RETURN; END IF;

    SELECT COALESCE(SUM((effect_params->>'boost')::int), 0) INTO v_current_boost
    FROM agent_dungeon_loot_effects
    WHERE agent_id = v_agent_id
      AND effect_type = 'aptitude_boost'
      AND consumed = FALSE;

    IF v_current_boost >= v_max_cap THEN RETURN; END IF;

    INSERT INTO agent_dungeon_loot_effects (agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params)
    VALUES (v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type,
            jsonb_build_object('aptitude', v_aptitude, 'boost', 1));

    -- FIX: Correct column names (were 'level' and 'aptitude' in migration 177)
    UPDATE agent_aptitudes
    SET aptitude_level = LEAST(9, aptitude_level + 1)
    WHERE agent_id = v_agent_id AND operative_type = v_aptitude;

  -- memory: create Memory record
  ELSIF v_effect_type = 'memory' THEN
    v_importance := COALESCE((v_params->>'importance')::int, 3);
    INSERT INTO memories (agent_id, simulation_id, importance, content_en, content_de, source)
    VALUES (
      v_agent_id, v_sim_id, v_importance,
      COALESCE(v_params->>'content_en', 'A dungeon memory.'),
      COALESCE(v_params->>'content_de', 'Eine Dungeon-Erinnerung.'),
      'dungeon_loot'
    );

  -- moodlet: add agent moodlet with decay
  ELSIF v_effect_type = 'moodlet' THEN
    INSERT INTO agent_moodlets (agent_id, simulation_id, moodlet_type, intensity, decay_type, source_type, source_id)
    VALUES (
      v_agent_id, v_sim_id,
      COALESCE(v_params->>'moodlet_type', 'neutral'),
      COALESCE((v_params->>'intensity')::numeric, 0.5),
      COALESCE(v_params->>'decay_type', 'slow'),
      'dungeon_loot', v_loot_id
    );

  -- event_modifier: persist for next matching event (one-shot)
  ELSIF v_effect_type = 'event_modifier' THEN
    INSERT INTO agent_dungeon_loot_effects (agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params)
    VALUES (v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type, v_params);

  -- arc_modifier: persist for matching narrative arc (one-shot)
  ELSIF v_effect_type = 'arc_modifier' THEN
    INSERT INTO agent_dungeon_loot_effects (agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params)
    VALUES (v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type, v_params);

  -- stress_heal: reduce agent stress immediately
  ELSIF v_effect_type = 'stress_heal' THEN
    UPDATE agents
    SET stress_level = GREATEST(0, stress_level - COALESCE((v_params->>'stress_heal')::int, 0))
    WHERE id = v_agent_id;

  -- permanent_dungeon_bonus / next_dungeon_bonus: persist for dungeon system
  ELSIF v_effect_type IN ('permanent_dungeon_bonus', 'next_dungeon_bonus') THEN
    INSERT INTO agent_dungeon_loot_effects (agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params)
    VALUES (v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type, v_params);

  -- simulation_modifier: persist for building/simulation-wide effects
  ELSIF v_effect_type = 'simulation_modifier' THEN
    INSERT INTO agent_dungeon_loot_effects (agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params)
    VALUES (v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type, v_params);

  -- personality_modifier: modify one Big Five dimension by ±delta (Awakening Insight)
  ELSIF v_effect_type = 'personality_modifier' THEN
    v_dimension := v_params->>'dimension';
    v_delta := COALESCE((v_params->>'delta')::numeric, 0.1);

    IF v_dimension IS NULL OR v_dimension NOT IN (
      'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'
    ) THEN
      RETURN;
    END IF;

    SELECT COALESCE((personality_profile->>v_dimension)::numeric, 0.5)
    INTO v_current_val
    FROM agents WHERE id = v_agent_id;

    v_new_val := GREATEST(0.0, LEAST(1.0, v_current_val + v_delta));

    UPDATE agents
    SET personality_profile = jsonb_set(
      COALESCE(personality_profile, '{}'::jsonb),
      ARRAY[v_dimension],
      to_jsonb(v_new_val)
    )
    WHERE id = v_agent_id;

    INSERT INTO agent_dungeon_loot_effects (
      agent_id, simulation_id, source_run_id, source_loot_id, effect_type, effect_params
    ) VALUES (
      v_agent_id, v_sim_id, v_run_id, v_loot_id, v_effect_type,
      jsonb_build_object(
        'dimension', v_dimension,
        'delta', v_delta,
        'old_value', v_current_val,
        'new_value', v_new_val
      )
    );

  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict to service_role only (per ADR-006)
REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, UUID, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, UUID, TEXT, TEXT, JSONB) TO service_role;
