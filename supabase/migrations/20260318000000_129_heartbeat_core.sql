-- Migration 129: Simulation Heartbeat Core
-- Adds tick system, narrative arcs, bureau responses, attunements, anchors, chronicle tables.
-- All 6 new tables + ALTER simulations/events + platform_settings seed + RLS + indexes.

-- ============================================================
-- 1. ALTER existing tables
-- ============================================================

ALTER TABLE simulations
  ADD COLUMN IF NOT EXISTS last_heartbeat_tick INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_heartbeat_at TIMESTAMPTZ;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ticks_in_status INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heartbeat_pressure NUMERIC(6,4) NOT NULL DEFAULT 0.0;

-- ============================================================
-- 2. simulation_heartbeats — one row per tick per simulation
-- ============================================================

CREATE TABLE simulation_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  tick_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed', 'skipped')),
  summary JSONB DEFAULT '{}'::jsonb,
  dispatch_en TEXT,
  dispatch_de TEXT,
  events_aged INT NOT NULL DEFAULT 0,
  events_escalated INT NOT NULL DEFAULT 0,
  events_resolved INT NOT NULL DEFAULT 0,
  zone_actions_expired INT NOT NULL DEFAULT 0,
  scar_tissue_delta NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  resonance_pressure_delta NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  bureau_responses_resolved INT NOT NULL DEFAULT 0,
  cascade_events_spawned INT NOT NULL DEFAULT 0,
  convergence_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(simulation_id, tick_number)
);

CREATE INDEX idx_heartbeats_sim ON simulation_heartbeats (simulation_id);
CREATE INDEX idx_heartbeats_sim_tick ON simulation_heartbeats (simulation_id, tick_number DESC);

-- ============================================================
-- 3. heartbeat_entries — individual log lines (chronicle feed)
-- ============================================================

CREATE TABLE heartbeat_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heartbeat_id UUID NOT NULL REFERENCES simulation_heartbeats(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  tick_number INT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'cascade_spawn', 'bureau_response',
    'attunement_deepen', 'anchor_strengthen', 'convergence', 'positive_event',
    'narrative_arc', 'system_note'
  )),
  narrative_en TEXT NOT NULL,
  narrative_de TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical', 'positive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hb_entries_sim ON heartbeat_entries (simulation_id);
CREATE INDEX idx_hb_entries_sim_tick ON heartbeat_entries (simulation_id, tick_number DESC);
CREATE INDEX idx_hb_entries_heartbeat ON heartbeat_entries (heartbeat_id);
CREATE INDEX idx_hb_entries_type ON heartbeat_entries (entry_type);

-- ============================================================
-- 4. narrative_arcs — multi-stage resonance chains
-- ============================================================

CREATE TABLE narrative_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  arc_type TEXT NOT NULL CHECK (arc_type IN ('escalation', 'cascade', 'convergence', 'resolution')),
  primary_signature TEXT NOT NULL,
  secondary_signature TEXT,
  primary_archetype TEXT,
  secondary_archetype TEXT,
  status TEXT NOT NULL DEFAULT 'building'
    CHECK (status IN ('building', 'active', 'climax', 'resolving', 'resolved', 'dormant')),
  pressure NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  peak_pressure NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  started_at_tick INT NOT NULL DEFAULT 0,
  last_active_tick INT NOT NULL DEFAULT 0,
  ticks_active INT NOT NULL DEFAULT 0,
  ticks_dormant INT NOT NULL DEFAULT 0,
  source_event_ids UUID[] DEFAULT '{}',
  spawned_event_ids UUID[] DEFAULT '{}',
  scar_tissue_deposited NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_narrative_arcs_sim ON narrative_arcs (simulation_id);
CREATE INDEX idx_narrative_arcs_sim_status ON narrative_arcs (simulation_id, status);
CREATE INDEX idx_narrative_arcs_signature ON narrative_arcs (primary_signature);

-- ============================================================
-- 5. bureau_responses — player response to events
-- ============================================================

CREATE TABLE bureau_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('contain', 'remediate', 'adapt')),
  assigned_agent_ids UUID[] NOT NULL DEFAULT '{}',
  agent_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolving', 'resolved', 'expired', 'failed')),
  submitted_before_tick INT NOT NULL,
  resolved_at_tick INT,
  effectiveness NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  pressure_reduction NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  staffing_penalty_active BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bureau_responses_sim ON bureau_responses (simulation_id);
CREATE INDEX idx_bureau_responses_event ON bureau_responses (event_id);
CREATE INDEX idx_bureau_responses_status ON bureau_responses (simulation_id, status);

-- ============================================================
-- 6. substrate_attunements — player resonance attunements
-- ============================================================

CREATE TABLE substrate_attunements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  resonance_signature TEXT NOT NULL,
  depth NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  ticks_exposed INT NOT NULL DEFAULT 0,
  positive_threshold NUMERIC(6,4) NOT NULL DEFAULT 0.50,
  positive_event_generated BOOLEAN NOT NULL DEFAULT false,
  switching_cooldown_ticks INT NOT NULL DEFAULT 0,
  created_by_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(simulation_id, resonance_signature)
);

CREATE INDEX idx_attunements_sim ON substrate_attunements (simulation_id);

-- ============================================================
-- 7. collaborative_anchors — cross-simulation anchoring
-- ============================================================

CREATE TABLE collaborative_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  resonance_id UUID REFERENCES substrate_resonances(id) ON DELETE SET NULL,
  resonance_signature TEXT NOT NULL,
  anchor_simulation_ids UUID[] NOT NULL DEFAULT '{}',
  strength NUMERIC(6,4) NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming', 'active', 'reinforcing', 'dissolved')),
  formed_at_tick INT NOT NULL DEFAULT 0,
  ticks_active INT NOT NULL DEFAULT 0,
  created_by_simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anchors_status ON collaborative_anchors (status);
CREATE INDEX idx_anchors_resonance ON collaborative_anchors (resonance_id);

-- ============================================================
-- 8. RLS Policies
-- ============================================================

ALTER TABLE simulation_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bureau_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE substrate_attunements ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_anchors ENABLE ROW LEVEL SECURITY;

-- Public read for heartbeat/chronicle/arcs (browsable without login)
CREATE POLICY "Public read heartbeats"
  ON simulation_heartbeats FOR SELECT USING (true);

CREATE POLICY "Public read heartbeat entries"
  ON heartbeat_entries FOR SELECT USING (true);

CREATE POLICY "Public read narrative arcs"
  ON narrative_arcs FOR SELECT USING (true);

CREATE POLICY "Public read collaborative anchors"
  ON collaborative_anchors FOR SELECT USING (true);

-- Bureau responses: read for all authenticated, write for editors+
CREATE POLICY "Authenticated read bureau responses"
  ON bureau_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editor insert bureau responses"
  ON bureau_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY "Editor update bureau responses"
  ON bureau_responses FOR UPDATE
  TO authenticated
  USING (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY "Editor delete bureau responses"
  ON bureau_responses FOR DELETE
  TO authenticated
  USING (user_has_simulation_role(simulation_id, 'editor'));

-- Attunements: read for all authenticated, write for editors+
CREATE POLICY "Authenticated read attunements"
  ON substrate_attunements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editor insert attunements"
  ON substrate_attunements FOR INSERT
  TO authenticated
  WITH CHECK (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY "Editor update attunements"
  ON substrate_attunements FOR UPDATE
  TO authenticated
  USING (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY "Editor delete attunements"
  ON substrate_attunements FOR DELETE
  TO authenticated
  USING (user_has_simulation_role(simulation_id, 'editor'));

-- Service role full access (for HeartbeatService background task)
CREATE POLICY "Service role full access heartbeats"
  ON simulation_heartbeats FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access entries"
  ON heartbeat_entries FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access arcs"
  ON narrative_arcs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access bureau"
  ON bureau_responses FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access attunements"
  ON substrate_attunements FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access anchors"
  ON collaborative_anchors FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON simulation_heartbeats TO authenticated, anon;
GRANT SELECT ON heartbeat_entries TO authenticated, anon;
GRANT SELECT ON narrative_arcs TO authenticated, anon;
GRANT SELECT ON collaborative_anchors TO authenticated, anon;
GRANT ALL ON bureau_responses TO authenticated;
GRANT ALL ON substrate_attunements TO authenticated;

-- ============================================================
-- 9. Platform settings seed — heartbeat defaults
-- ============================================================

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('heartbeat_enabled', '"true"', 'Global heartbeat kill switch'),
  ('heartbeat_interval_seconds', '28800', 'Default tick interval in seconds (8h = 3 ticks/day)'),
  ('heartbeat_systems', '["zone_decay","resonance_pressure","event_aging","scar_tissue","bureau_resolution","attunement","anchoring"]', 'Sub-systems to run each tick'),
  ('heartbeat_scar_decay_rate', '0.02', 'Scar tissue decay per tick (healing)'),
  ('heartbeat_attunement_growth_rate', '0.05', 'Attunement depth growth per tick'),
  ('heartbeat_anchor_growth_per_sim', '0.03', 'Anchor strength growth per participant per tick'),
  ('heartbeat_escalation_threshold', '3', 'Same-signature events before escalation arc'),
  ('heartbeat_cascade_pressure_trigger', '0.60', 'Arc pressure threshold for cross-signature cascade'),
  ('heartbeat_convergence_pairs', '{
    "Shadow+Tower": {"name": "The Siege", "effects": {"saboteur": 0.05, "assassin": 0.05, "guardian": -0.03}},
    "Deluge+Entropy": {"name": "The Unmaking", "effects": {"impact_magnitude": 0.15}},
    "Overthrow+Shadow": {"name": "The Purge", "effects": {"propagandist": 0.05, "infiltrator": 0.05}},
    "Awakening+Prometheus": {"name": "The Transcendence", "effects": {"positive_event_multiplier": 2.0}},
    "Devouring Mother+Deluge": {"name": "The Drowning", "effects": {"cascade_threshold_reduction": 0.10}},
    "Tower+Overthrow": {"name": "The Revolution", "effects": {"authority_fracture_susceptibility": 0.30}}
  }', 'Archetype convergence pairings and effects')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 10. Refresh active_* views for new simulation columns
-- ============================================================

-- Recreate active_simulations view to include new heartbeat columns
CREATE OR REPLACE VIEW active_simulations AS
SELECT * FROM simulations WHERE deleted_at IS NULL;

-- Recreate active_events view to include new heartbeat columns
CREATE OR REPLACE VIEW active_events AS
SELECT * FROM events WHERE deleted_at IS NULL;

-- ============================================================
-- 11. Refresh materialized views
-- ============================================================

SELECT refresh_all_game_metrics();
