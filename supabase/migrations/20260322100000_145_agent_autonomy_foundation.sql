-- ============================================================================
-- Migration 145: Agent Autonomy Foundation
--
-- The Living World: agents act autonomously between player sessions.
-- Adds mood, moodlets, opinions, opinion modifiers, needs, activities,
-- and personality profile + location tracking on agents.
--
-- Research basis: Stanford Generative Agents, Dwarf Fortress stress system,
-- RimWorld opinion modifiers, The Sims Utility AI, CK3 opinion stacking.
-- ============================================================================


-- ============================================================================
-- 1. ALTER agents: personality profile + current location
-- ============================================================================

-- Big Five personality profile extracted from backstory (one-time LLM call)
-- Schema: {"openness": 0.7, "conscientiousness": 0.5, "extraversion": 0.4,
--          "agreeableness": 0.6, "neuroticism": 0.3,
--          "dominant_traits": ["curious","stubborn","loyal"],
--          "values": ["craftsmanship","freedom","knowledge"],
--          "fears": ["abandonment","irrelevance"],
--          "social_style": "reserved"}
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS personality_profile JSONB DEFAULT '{}';

COMMENT ON COLUMN agents.personality_profile IS
  'Big Five personality + traits/values/fears extracted from backstory via LLM. Drives autonomy decisions.';

-- Per-agent autonomy toggle (admin can disable individual agents)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS autonomy_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN agents.autonomy_active IS
  'When false, this agent is excluded from autonomy processing (needs, mood, activities). Controllable via admin panel.';

-- Current location tracking (updated each autonomy tick)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS current_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_building_id UUID REFERENCES buildings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agents_current_zone ON agents(current_zone_id)
  WHERE current_zone_id IS NOT NULL;


-- ============================================================================
-- 2. agent_needs: 5 core needs with per-agent decay rates (Sims pattern)
-- ============================================================================

CREATE TABLE agent_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- 5 core needs (0.0 = desperate, 100.0 = fully satisfied)
  social REAL NOT NULL DEFAULT 60.0
    CHECK (social BETWEEN 0 AND 100),
  purpose REAL NOT NULL DEFAULT 60.0
    CHECK (purpose BETWEEN 0 AND 100),
  safety REAL NOT NULL DEFAULT 60.0
    CHECK (safety BETWEEN 0 AND 100),
  comfort REAL NOT NULL DEFAULT 60.0
    CHECK (comfort BETWEEN 0 AND 100),
  stimulation REAL NOT NULL DEFAULT 60.0
    CHECK (stimulation BETWEEN 0 AND 100),

  -- Per-agent decay rates (derived from personality_profile on init)
  social_decay REAL NOT NULL DEFAULT 5.0,
  purpose_decay REAL NOT NULL DEFAULT 3.0,
  safety_decay REAL NOT NULL DEFAULT 2.0,
  comfort_decay REAL NOT NULL DEFAULT 2.0,
  stimulation_decay REAL NOT NULL DEFAULT 4.0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_agent_needs UNIQUE (agent_id)
);

CREATE INDEX idx_needs_sim ON agent_needs(simulation_id);

COMMENT ON TABLE agent_needs IS
  'Per-agent need levels (Sims pattern). Decay each tick, fulfilled by activities. Drive Utility AI selection.';


-- ============================================================================
-- 3. agent_mood: emotional state + stress accumulator (DF stress system)
-- ============================================================================

CREATE TABLE agent_mood (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- Aggregate mood score (-100 desperate .. +100 euphoric)
  mood_score INTEGER NOT NULL DEFAULT 0
    CHECK (mood_score BETWEEN -100 AND 100),

  -- Dominant emotion (highest absolute moodlet contribution)
  dominant_emotion TEXT NOT NULL DEFAULT 'neutral',

  -- Stress accumulator (DF pattern: 0 calm .. 1000 breakdown)
  stress_level INTEGER NOT NULL DEFAULT 0
    CHECK (stress_level BETWEEN 0 AND 1000),

  -- Personality-derived modifiers (set once from personality_profile)
  resilience REAL NOT NULL DEFAULT 0.5
    CHECK (resilience BETWEEN 0 AND 1),
  volatility REAL NOT NULL DEFAULT 0.5
    CHECK (volatility BETWEEN 0 AND 1),
  sociability REAL NOT NULL DEFAULT 0.5
    CHECK (sociability BETWEEN 0 AND 1),

  last_tick_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_agent_mood UNIQUE (agent_id)
);

CREATE INDEX idx_mood_sim ON agent_mood(simulation_id);
CREATE INDEX idx_mood_stress ON agent_mood(simulation_id, stress_level DESC)
  WHERE stress_level >= 500;

COMMENT ON TABLE agent_mood IS
  'Per-agent emotional state. mood_score = sum of moodlets. stress_level = DF-style accumulator triggering breakdowns at 800+.';


-- ============================================================================
-- 4. agent_moodlets: individual mood influences (RimWorld + CK3 pattern)
-- ============================================================================

CREATE TABLE agent_moodlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- Moodlet definition
  moodlet_type TEXT NOT NULL,
  emotion TEXT NOT NULL,
  strength INTEGER NOT NULL
    CHECK (strength BETWEEN -20 AND 20),

  -- Source traceability
  source_type TEXT NOT NULL
    CHECK (source_type IN ('event', 'relationship', 'zone', 'building', 'social', 'memory', 'system')),
  source_id UUID,
  source_description TEXT,

  -- Decay mechanics (CK3: permanent / timed / decaying)
  decay_type TEXT NOT NULL DEFAULT 'timed'
    CHECK (decay_type IN ('permanent', 'timed', 'decaying')),
  initial_strength INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Stacking control (RimWorld: max N same-type moodlets)
  stacking_group TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moodlets_agent ON agent_moodlets(agent_id);
CREATE INDEX idx_moodlets_sim ON agent_moodlets(simulation_id);
CREATE INDEX idx_moodlets_expires ON agent_moodlets(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_moodlets_stacking ON agent_moodlets(agent_id, stacking_group)
  WHERE stacking_group IS NOT NULL;

COMMENT ON TABLE agent_moodlets IS
  'Individual mood influences with 3 decay types (CK3) and stacking caps (RimWorld). Summed into agent_mood.mood_score.';


-- ============================================================================
-- 5. agent_opinions: inter-agent opinion scores
-- ============================================================================

CREATE TABLE agent_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- Aggregate opinion (-100 enmity .. +100 devotion)
  opinion_score INTEGER NOT NULL DEFAULT 0
    CHECK (opinion_score BETWEEN -100 AND 100),

  -- Deterministic base compatibility (computed from personality profiles)
  base_compatibility REAL NOT NULL DEFAULT 0.0
    CHECK (base_compatibility BETWEEN -0.3 AND 0.3),

  last_interaction_at TIMESTAMPTZ,
  interaction_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_opinion CHECK (agent_id != target_agent_id),
  CONSTRAINT unique_agent_opinion UNIQUE (agent_id, target_agent_id)
);

CREATE INDEX idx_opinions_agent ON agent_opinions(agent_id);
CREATE INDEX idx_opinions_target ON agent_opinions(target_agent_id);
CREATE INDEX idx_opinions_sim ON agent_opinions(simulation_id);

COMMENT ON TABLE agent_opinions IS
  'Aggregate inter-agent opinions (CK3 pattern). opinion_score = base_compatibility * 20 + sum(active modifiers).';


-- ============================================================================
-- 6. agent_opinion_modifiers: individual opinion influences
-- ============================================================================

CREATE TABLE agent_opinion_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- Modifier definition
  modifier_type TEXT NOT NULL,
  opinion_change INTEGER NOT NULL
    CHECK (opinion_change BETWEEN -30 AND 30),

  -- Decay mechanics (CK3: permanent / timed / decaying)
  decay_type TEXT NOT NULL DEFAULT 'decaying'
    CHECK (decay_type IN ('permanent', 'timed', 'decaying')),
  initial_value INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Stacking control
  stacking_group TEXT,

  -- Source event reference
  source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_mods_pair ON agent_opinion_modifiers(agent_id, target_agent_id);
CREATE INDEX idx_op_mods_sim ON agent_opinion_modifiers(simulation_id);
CREATE INDEX idx_op_mods_expires ON agent_opinion_modifiers(expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_op_mods_stacking ON agent_opinion_modifiers(agent_id, target_agent_id, stacking_group)
  WHERE stacking_group IS NOT NULL;

COMMENT ON TABLE agent_opinion_modifiers IS
  'Individual opinion modifiers with decay (CK3) and stacking caps (RimWorld). Summed into agent_opinions.opinion_score.';


-- ============================================================================
-- 7. agent_activities: autonomous action log
-- ============================================================================

CREATE TABLE agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,

  -- Activity definition
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'work', 'socialize', 'rest', 'explore', 'maintain',
      'reflect', 'avoid', 'confront', 'celebrate', 'mourn',
      'seek_comfort', 'collaborate', 'create', 'investigate'
    )),
  activity_subtype TEXT,

  -- Context references
  location_zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  location_building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  target_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Narrative (LLM-generated for Tier 2+3 activities)
  narrative_text TEXT,
  narrative_text_de TEXT,

  -- Significance for morning briefing prioritization (1-10)
  significance INTEGER NOT NULL DEFAULT 1
    CHECK (significance BETWEEN 1 AND 10),

  -- Mechanical effects (JSON: mood changes, opinion changes, need fulfillment)
  effects JSONB NOT NULL DEFAULT '{}',

  -- Heartbeat tick reference
  heartbeat_tick_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_sim ON agent_activities(simulation_id, created_at DESC);
CREATE INDEX idx_activities_agent ON agent_activities(agent_id, created_at DESC);
CREATE INDEX idx_activities_significance ON agent_activities(simulation_id, significance DESC)
  WHERE significance >= 5;
-- Note: no partial index with now() — PostgreSQL requires IMMUTABLE predicates.
-- Queries filter by created_at at runtime using idx_activities_sim.

COMMENT ON TABLE agent_activities IS
  'Log of autonomous agent actions. Drives morning briefing narrative. Significance 1-10 controls briefing priority.';


-- ============================================================================
-- 8. updated_at TRIGGERS
-- ============================================================================

CREATE TRIGGER set_agent_needs_updated_at
  BEFORE UPDATE ON agent_needs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_agent_mood_updated_at
  BEFORE UPDATE ON agent_mood
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_agent_opinions_updated_at
  BEFORE UPDATE ON agent_opinions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

-- All autonomy tables: public read (public-first architecture), service_role write

ALTER TABLE agent_needs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "needs_public_read" ON agent_needs FOR SELECT USING (true);
CREATE POLICY "needs_service_write" ON agent_needs FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE agent_mood ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mood_public_read" ON agent_mood FOR SELECT USING (true);
CREATE POLICY "mood_service_write" ON agent_mood FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE agent_moodlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moodlets_public_read" ON agent_moodlets FOR SELECT USING (true);
CREATE POLICY "moodlets_service_write" ON agent_moodlets FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE agent_opinions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opinions_public_read" ON agent_opinions FOR SELECT USING (true);
CREATE POLICY "opinions_service_write" ON agent_opinions FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE agent_opinion_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_mods_public_read" ON agent_opinion_modifiers FOR SELECT USING (true);
CREATE POLICY "op_mods_service_write" ON agent_opinion_modifiers FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_public_read" ON agent_activities FOR SELECT USING (true);
CREATE POLICY "activities_service_write" ON agent_activities FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- 10. ACTIVE VIEWS REFRESH
-- ============================================================================

-- Refresh active_agents view to include new columns
CREATE OR REPLACE VIEW active_agents AS
  SELECT * FROM agents
  WHERE deleted_at IS NULL;


-- ============================================================================
-- 11. HELPER FUNCTIONS
-- ============================================================================

-- Expire moodlets and opinion modifiers in bulk (called by heartbeat)
CREATE OR REPLACE FUNCTION fn_expire_autonomy_modifiers(
  p_simulation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_expired_moodlets INTEGER;
  v_expired_op_mods INTEGER;
BEGIN
  -- Remove expired timed moodlets
  DELETE FROM agent_moodlets
  WHERE simulation_id = p_simulation_id
    AND decay_type IN ('timed', 'decaying')
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS v_expired_moodlets = ROW_COUNT;

  -- Remove expired opinion modifiers
  DELETE FROM agent_opinion_modifiers
  WHERE simulation_id = p_simulation_id
    AND decay_type IN ('timed', 'decaying')
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS v_expired_op_mods = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_moodlets', v_expired_moodlets,
    'expired_op_mods', v_expired_op_mods
  );
END;
$$;

-- Decay strength of 'decaying' moodlets (linear interpolation toward 0)
CREATE OR REPLACE FUNCTION fn_decay_moodlet_strengths(
  p_simulation_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE agent_moodlets
  SET strength = CASE
    WHEN initial_strength > 0 THEN GREATEST(1, strength - 1)
    WHEN initial_strength < 0 THEN LEAST(-1, strength + 1)
    ELSE 0
  END
  WHERE simulation_id = p_simulation_id
    AND decay_type = 'decaying'
    AND expires_at IS NOT NULL
    AND expires_at > now()
    AND ABS(strength) > 1;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

-- Initialize autonomy data for a new agent
CREATE OR REPLACE FUNCTION fn_initialize_agent_autonomy(
  p_agent_id UUID,
  p_simulation_id UUID,
  p_resilience REAL DEFAULT 0.5,
  p_volatility REAL DEFAULT 0.5,
  p_sociability REAL DEFAULT 0.5,
  p_social_decay REAL DEFAULT 5.0,
  p_purpose_decay REAL DEFAULT 3.0,
  p_safety_decay REAL DEFAULT 2.0,
  p_comfort_decay REAL DEFAULT 2.0,
  p_stimulation_decay REAL DEFAULT 4.0
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create needs record
  INSERT INTO agent_needs (agent_id, simulation_id,
    social_decay, purpose_decay, safety_decay, comfort_decay, stimulation_decay)
  VALUES (p_agent_id, p_simulation_id,
    p_social_decay, p_purpose_decay, p_safety_decay, p_comfort_decay, p_stimulation_decay)
  ON CONFLICT (agent_id) DO NOTHING;

  -- Create mood record
  INSERT INTO agent_mood (agent_id, simulation_id,
    resilience, volatility, sociability)
  VALUES (p_agent_id, p_simulation_id,
    p_resilience, p_volatility, p_sociability)
  ON CONFLICT (agent_id) DO NOTHING;

  -- Assign to first available zone if not already placed
  UPDATE agents
  SET current_zone_id = COALESCE(
    current_zone_id,
    (SELECT z.id FROM zones z WHERE z.simulation_id = p_simulation_id
     ORDER BY random() LIMIT 1)
  )
  WHERE id = p_agent_id;
END;
$$;

COMMENT ON FUNCTION fn_initialize_agent_autonomy IS
  'Bootstrap autonomy data (needs + mood) for a new or existing agent. Idempotent via ON CONFLICT.';


-- Recalculate mood_score + dominant_emotion from active moodlets (atomic)
CREATE OR REPLACE FUNCTION fn_recalculate_mood_scores(
  p_simulation_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER := 0;
  v_agent RECORD;
BEGIN
  FOR v_agent IN
    SELECT am.agent_id,
      COALESCE(SUM(ml.strength), 0) AS total_mood,
      -- Dominant emotion = emotion with highest absolute contribution
      (SELECT ml2.emotion FROM agent_moodlets ml2
       WHERE ml2.agent_id = am.agent_id
       ORDER BY ABS(ml2.strength) DESC, ml2.created_at DESC
       LIMIT 1) AS top_emotion
    FROM agent_mood am
    LEFT JOIN agent_moodlets ml ON ml.agent_id = am.agent_id
    WHERE am.simulation_id = p_simulation_id
    GROUP BY am.agent_id
  LOOP
    UPDATE agent_mood SET
      mood_score = GREATEST(-100, LEAST(100, v_agent.total_mood::INTEGER)),
      dominant_emotion = COALESCE(v_agent.top_emotion, 'neutral')
    WHERE agent_id = v_agent.agent_id
      AND (mood_score != GREATEST(-100, LEAST(100, v_agent.total_mood::INTEGER))
           OR dominant_emotion != COALESCE(v_agent.top_emotion, 'neutral'));
    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION fn_recalculate_mood_scores IS
  'Atomically recalculate mood_score (sum of moodlets, clamped -100..100) and dominant_emotion for all agents in a simulation.';


-- Recalculate opinion_score from base_compatibility + active modifiers (atomic)
CREATE OR REPLACE FUNCTION fn_recalculate_opinion_scores(
  p_simulation_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER := 0;
  v_opinion RECORD;
BEGIN
  FOR v_opinion IN
    SELECT ao.id, ao.agent_id, ao.target_agent_id, ao.base_compatibility,
      COALESCE(SUM(om.opinion_change), 0) AS modifier_total
    FROM agent_opinions ao
    LEFT JOIN agent_opinion_modifiers om
      ON om.agent_id = ao.agent_id
      AND om.target_agent_id = ao.target_agent_id
    WHERE ao.simulation_id = p_simulation_id
    GROUP BY ao.id, ao.agent_id, ao.target_agent_id, ao.base_compatibility
  LOOP
    UPDATE agent_opinions SET
      opinion_score = GREATEST(-100, LEAST(100,
        (v_opinion.base_compatibility * 20)::INTEGER + v_opinion.modifier_total::INTEGER
      ))
    WHERE id = v_opinion.id;
    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION fn_recalculate_opinion_scores IS
  'Atomically recalculate opinion_score (base_compatibility * 20 + sum of modifiers, clamped -100..100) for all opinions in a simulation.';


-- Decay all agent needs in a simulation (bulk update, personalized rates)
CREATE OR REPLACE FUNCTION fn_decay_agent_needs(
  p_simulation_id UUID,
  p_rate_multiplier REAL DEFAULT 1.0
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE agent_needs SET
    social      = GREATEST(0, social      - (social_decay      * p_rate_multiplier)),
    purpose     = GREATEST(0, purpose     - (purpose_decay     * p_rate_multiplier)),
    safety      = GREATEST(0, safety      - (safety_decay      * p_rate_multiplier)),
    comfort     = GREATEST(0, comfort     - (comfort_decay     * p_rate_multiplier)),
    stimulation = GREATEST(0, stimulation - (stimulation_decay  * p_rate_multiplier))
  WHERE simulation_id = p_simulation_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION fn_decay_agent_needs IS
  'Decay all 5 needs for every agent in a simulation. Uses per-agent decay rates with global multiplier.';


-- Count moodlets in a stacking group (for cap enforcement)
CREATE OR REPLACE FUNCTION fn_count_moodlet_stacking(
  p_agent_id UUID,
  p_stacking_group TEXT
) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COUNT(*)::INTEGER
  FROM agent_moodlets
  WHERE agent_id = p_agent_id
    AND stacking_group = p_stacking_group;
$$;

-- Count opinion modifiers in a stacking group
CREATE OR REPLACE FUNCTION fn_count_opinion_modifier_stacking(
  p_agent_id UUID,
  p_target_agent_id UUID,
  p_stacking_group TEXT
) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COUNT(*)::INTEGER
  FROM agent_opinion_modifiers
  WHERE agent_id = p_agent_id
    AND target_agent_id = p_target_agent_id
    AND stacking_group = p_stacking_group;
$$;
