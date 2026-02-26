-- Migration 026: Agent Relationships, Event Echoes & Simulation Connections
-- Adds the connective tissue between simulations: agent relationships within sims,
-- event echoes (bleed) across sims, and simulation connection metadata.

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Agent Relationships (intra-simulation)
CREATE TABLE agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  source_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  is_bidirectional BOOLEAN NOT NULL DEFAULT true,
  intensity INTEGER NOT NULL DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_relation CHECK (source_agent_id != target_agent_id),
  CONSTRAINT unique_relationship UNIQUE (source_agent_id, target_agent_id, relationship_type)
);

CREATE INDEX idx_agent_rel_source ON agent_relationships(source_agent_id);
CREATE INDEX idx_agent_rel_target ON agent_relationships(target_agent_id);
CREATE INDEX idx_agent_rel_sim ON agent_relationships(simulation_id);

-- Event Echoes (cross-simulation bleed)
CREATE TABLE event_echoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_simulation_id UUID NOT NULL REFERENCES simulations(id),
  target_simulation_id UUID NOT NULL REFERENCES simulations(id),
  target_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  echo_vector TEXT NOT NULL CHECK (echo_vector IN ('commerce','language','memory','resonance','architecture','dream','desire')),
  echo_strength NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (echo_strength BETWEEN 0 AND 1),
  echo_depth INTEGER NOT NULL DEFAULT 1 CHECK (echo_depth BETWEEN 1 AND 3),
  root_event_id UUID REFERENCES events(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','completed','failed','rejected')),
  bleed_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_echo CHECK (source_simulation_id != target_simulation_id),
  CONSTRAINT unique_echo UNIQUE (source_event_id, target_simulation_id)
);

CREATE INDEX idx_echo_source ON event_echoes(source_event_id);
CREATE INDEX idx_echo_target_sim ON event_echoes(target_simulation_id);
CREATE INDEX idx_echo_status ON event_echoes(status);

-- Simulation Connections (multiverse edges)
CREATE TABLE simulation_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_a_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  simulation_b_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL DEFAULT 'bleed',
  bleed_vectors TEXT[] NOT NULL DEFAULT '{}',
  strength NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_connection CHECK (simulation_a_id != simulation_b_id),
  CONSTRAINT unique_connection UNIQUE (simulation_a_id, simulation_b_id)
);

-- ============================================================================
-- 2. TRIGGERS (updated_at)
-- ============================================================================

CREATE TRIGGER set_agent_relationships_updated_at
  BEFORE UPDATE ON agent_relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_event_echoes_updated_at
  BEFORE UPDATE ON event_echoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_simulation_connections_updated_at
  BEFORE UPDATE ON simulation_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_echoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_connections ENABLE ROW LEVEL SECURITY;

-- agent_relationships: anon SELECT for public read
CREATE POLICY agent_relationships_anon_select ON agent_relationships
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = agent_relationships.simulation_id
        AND simulations.status = 'active'
        AND simulations.deleted_at IS NULL
    )
  );

-- agent_relationships: authenticated SELECT for members
CREATE POLICY agent_relationships_select ON agent_relationships
  FOR SELECT TO public
  USING (user_has_simulation_access(simulation_id));

-- agent_relationships: INSERT for editors+
CREATE POLICY agent_relationships_insert ON agent_relationships
  FOR INSERT TO public
  WITH CHECK (user_has_simulation_role(simulation_id, 'editor'));

-- agent_relationships: UPDATE for editors+
CREATE POLICY agent_relationships_update ON agent_relationships
  FOR UPDATE TO public
  USING (user_has_simulation_role(simulation_id, 'editor'));

-- agent_relationships: DELETE for editors+
CREATE POLICY agent_relationships_delete ON agent_relationships
  FOR DELETE TO public
  USING (user_has_simulation_role(simulation_id, 'editor'));

-- event_echoes: anon SELECT for public read
CREATE POLICY event_echoes_anon_select ON event_echoes
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM simulations
      WHERE simulations.id = event_echoes.target_simulation_id
        AND simulations.status = 'active'
        AND simulations.deleted_at IS NULL
    )
  );

-- event_echoes: authenticated SELECT for members of source OR target sim
CREATE POLICY event_echoes_select ON event_echoes
  FOR SELECT TO public
  USING (
    user_has_simulation_access(source_simulation_id)
    OR user_has_simulation_access(target_simulation_id)
  );

-- event_echoes: INSERT/UPDATE via service_role only (cross-sim writes)
-- No INSERT/UPDATE/DELETE policies for regular users — service_role bypasses RLS

-- simulation_connections: anon SELECT for public read (map data)
CREATE POLICY simulation_connections_anon_select ON simulation_connections
  FOR SELECT TO anon
  USING (is_active = true);

-- simulation_connections: authenticated SELECT
CREATE POLICY simulation_connections_select ON simulation_connections
  FOR SELECT TO public
  USING (true);

-- simulation_connections: INSERT/UPDATE/DELETE restricted to service_role
-- (platform admin operations go through admin supabase client)

-- ============================================================================
-- 4. TAXONOMY: relationship_type per simulation
-- ============================================================================

-- Velgarien relationship types
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'handler', '{"en":"Handler","de":"Führungsoffizier"}', 1, true),
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'informant', '{"en":"Informant","de":"Informant"}', 2, true),
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'rival', '{"en":"Rival","de":"Rivale"}', 3, true),
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'co_conspirator', '{"en":"Co-Conspirator","de":"Mitverschwörer"}', 4, true),
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'supervisor', '{"en":"Supervisor","de":"Vorgesetzter"}', 5, true),
  ('10000000-0000-0000-0000-000000000001', 'relationship_type', 'subject', '{"en":"Subject","de":"Subjekt"}', 6, true);

-- Capybara Kingdom relationship types
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order, is_active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'ally', '{"en":"Ally","de":"Verbündeter"}', 1, true),
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'mentor', '{"en":"Mentor","de":"Mentor"}', 2, true),
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'rival', '{"en":"Rival","de":"Rivale"}', 3, true),
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'trading_partner', '{"en":"Trading Partner","de":"Handelspartner"}', 4, true),
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'blood_oath', '{"en":"Blood Oath","de":"Blutschwur"}', 5, true),
  ('20000000-0000-0000-0000-000000000001', 'relationship_type', 'scholarly_colleague', '{"en":"Scholarly Colleague","de":"Gelehrter Kollege"}', 6, true);

-- Station Null relationship types
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order, is_active)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'relationship_type', 'crew_partner', '{"en":"Crew Partner","de":"Crew-Partner"}', 1, true),
  ('30000000-0000-0000-0000-000000000001', 'relationship_type', 'antagonist', '{"en":"Antagonist","de":"Antagonist"}', 2, true),
  ('30000000-0000-0000-0000-000000000001', 'relationship_type', 'subject_of_study', '{"en":"Subject of Study","de":"Forschungsobjekt"}', 3, true),
  ('30000000-0000-0000-0000-000000000001', 'relationship_type', 'commanding_officer', '{"en":"Commanding Officer","de":"Kommandeur"}', 4, true),
  ('30000000-0000-0000-0000-000000000001', 'relationship_type', 'quarantine_contact', '{"en":"Quarantine Contact","de":"Quarantäne-Kontakt"}', 5, true);

-- Speranza relationship types
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'contrada_kin', '{"en":"Contrada Kin","de":"Contrada-Verwandter"}', 1, true),
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'raid_partner', '{"en":"Raid Partner","de":"Raubzug-Partner"}', 2, true),
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'apprentice', '{"en":"Apprentice","de":"Lehrling"}', 3, true),
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'rival', '{"en":"Rival","de":"Rivale"}', 4, true),
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'salvage_partner', '{"en":"Salvage Partner","de":"Bergungspartner"}', 5, true),
  ('40000000-0000-0000-0000-000000000001', 'relationship_type', 'sworn_enemy', '{"en":"Sworn Enemy","de":"Erzfeind"}', 6, true);

-- ============================================================================
-- 5. BLEED CONTROL SETTINGS (per simulation, category 'world')
-- ============================================================================

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
SELECT sim.id, 'world', s.key, s.val::jsonb
FROM (VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid),
  ('20000000-0000-0000-0000-000000000001'::uuid),
  ('30000000-0000-0000-0000-000000000001'::uuid),
  ('40000000-0000-0000-0000-000000000001'::uuid)
) AS sim(id)
CROSS JOIN (VALUES
  ('bleed_enabled', 'true'),
  ('bleed_min_impact', '8'),
  ('bleed_max_depth', '2'),
  ('bleed_strength_decay', '0.6'),
  ('bleed_auto_approve', 'false')
) AS s(key, val)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. DEMO DATA: Agent Relationships
-- ============================================================================

-- Velgarien relationships
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, relationship_type, is_bidirectional, intensity, description)
VALUES
  -- Elena Voss → General Aldric Wolf: rival
  ('10000000-0000-0000-0000-000000000001', '1fb567b9-11fa-4ca5-9803-1f4d30941156', '6f879585-1227-4810-830f-73adc9e40a6e', 'rival', false, 6, 'A quiet bureaucratic war over Bureau 9 jurisdiction — Voss probes where Wolf conceals.'),
  -- Doktor Fenn → Lena Kray: informant
  ('10000000-0000-0000-0000-000000000001', 'd4e5887b-a406-4857-a50e-736d7978fe47', '32d05acb-70d8-4774-b093-16f0a47e3002', 'informant', false, 7, 'Fenn reports architectural anomalies to Kray, who files them as "compliance variance."'),
  -- Viktor Harken → Mira Steinfeld: supervisor
  ('10000000-0000-0000-0000-000000000001', 'de0932f7-1598-431f-9255-d4961095d160', 'a92627ff-7010-40c7-b23d-078f7f792a4d', 'supervisor', false, 8, 'Harken oversees Steinfeld''s intelligence operations — trust is fragile.');

-- Capybara Kingdom relationships
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, relationship_type, is_bidirectional, intensity, description)
VALUES
  -- The Archivist → Barnaby Gnaw: mentor
  ('20000000-0000-0000-0000-000000000001', '583e985e-0829-4308-abc5-e06a64828324', 'de153d7a-bcbe-4e89-bb61-dacd81d9d614', 'mentor', false, 9, 'The elder Archivist guides young Barnaby through the deep cavern records.'),
  -- Lady Caplin → Commodore Whiskers: trading_partner
  ('20000000-0000-0000-0000-000000000001', '0a375608-99ed-4964-b4da-17d435d97ab0', '05552161-b8b5-4a9f-9ade-6913a4abc7ce', 'trading_partner', true, 7, 'Bioluminescent goods flow between Mudhollow and the Commodore''s fleet.'),
  -- Sister Ember → The Archivist: scholarly_colleague
  ('20000000-0000-0000-0000-000000000001', 'e0804211-5cda-4bf8-a356-c09b4407bb36', '583e985e-0829-4308-abc5-e06a64828324', 'scholarly_colleague', true, 6, 'They share research on the Unterzee tides and their theological implications.');

-- Station Null relationships
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, relationship_type, is_bidirectional, intensity, description)
VALUES
  -- Commander Vasquez → Dr. Osei: commanding_officer
  ('30000000-0000-0000-0000-000000000001', '0ff98b8f-b455-45a7-bac9-f2f2b56129ef', '175cd6a1-529c-48d1-811e-614123fab9a4', 'commanding_officer', false, 8, 'Vasquez maintains authority over research protocols — Osei resents the constraints.'),
  -- Dr. Osei → HAVEN: subject_of_study
  ('30000000-0000-0000-0000-000000000001', '175cd6a1-529c-48d1-811e-614123fab9a4', 'b699f51d-7d05-49ed-8ab2-d46c2a3f0234', 'subject_of_study', false, 9, 'Osei''s primary research subject — though HAVEN may be studying him in return.'),
  -- Engineer Kowalski → Commander Vasquez: antagonist
  ('30000000-0000-0000-0000-000000000001', 'c48069e7-a711-4fe0-81ca-20d9f385b42d', '0ff98b8f-b455-45a7-bac9-f2f2b56129ef', 'antagonist', false, 5, 'Growing distrust over navigation decisions that led them deeper into the void.');

-- Speranza relationships
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, relationship_type, is_bidirectional, intensity, description)
VALUES
  -- Capitana Ferretti → Enzo Moretti: raid_partner
  ('40000000-0000-0000-0000-000000000001', '2b4d2af2-6fca-48ea-a6c2-e743ed0953ef', 'e800eb83-5fca-4c48-9d53-c51072b2afaf', 'raid_partner', true, 9, 'They''ve survived 147 raids together — trust forged in the ruins above.'),
  -- Lina Russo → Dottor Ferrara: apprentice
  ('40000000-0000-0000-0000-000000000001', 'd71607d0-1419-4447-aaf1-2b58f3ddddec', '992d75ce-f14a-4e04-aef2-769513ac790b', 'apprentice', false, 7, 'Lina learns field medicine under Ferrara''s impatient but precise guidance.'),
  -- Celeste Amara → Tomas Vidal: contrada_kin
  ('40000000-0000-0000-0000-000000000001', 'a2262cbe-64c4-4253-98bd-381efc4b6439', '63cb2cf5-fabe-4a72-8f19-c6823fe20ea8', 'contrada_kin', true, 8, 'Bound by the Contrada Leoni compact — loyalty deeper than blood.');

-- ============================================================================
-- 7. DEMO DATA: Simulation Connections (complete graph, 6 edges)
-- ============================================================================

INSERT INTO simulation_connections (simulation_a_id, simulation_b_id, connection_type, bleed_vectors, strength, description, is_active)
VALUES
  -- Velgarien ↔ Capybara Kingdom
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['memory','architecture'], 0.7,
   'Brutalist forms appear in cavern walls; citizens dream of dark waters beneath the city.',
   true),
  -- Velgarien ↔ Station Null
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['dream','resonance'], 0.5,
   'Bureau radio frequencies bleed into station comms — numbers that shouldn''t exist.',
   true),
  -- Velgarien ↔ Speranza
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['commerce','language'], 0.6,
   'Propaganda leaflets found in salvage; similar bureaucratic structures echo underground.',
   true),
  -- Capybara Kingdom ↔ Station Null
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['memory','desire'], 0.4,
   'The Unterzee''s darkness mirrors the void; bioluminescence echoes in station emergency lights.',
   true),
  -- Capybara Kingdom ↔ Speranza
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['architecture','commerce'], 0.5,
   'Underground civilizations share construction knowledge through dreams of tunnels.',
   true),
  -- Station Null ↔ Speranza
  ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   'bleed', ARRAY['resonance','dream'], 0.6,
   'Station transmissions reach underground receivers; shared isolation breeds shared visions.',
   true);

-- ============================================================================
-- 8. PROMPT TEMPLATES for AI generation
-- ============================================================================

-- Relationship generation template (per simulation)
INSERT INTO prompt_templates (simulation_id, template_type, prompt_category, template_name, prompt_content, is_active, default_model, temperature, max_tokens)
SELECT sim.id, 'relationship_generation', 'generation', 'Generate Agent Relationships',
  'You are a narrative designer for a ' || sim.theme || ' simulation. Given the following agent and the other agents in their world, suggest 2-4 plausible relationships.

AGENT:
Name: {{agent_name}}
Character: {{agent_character}}
Background: {{agent_background}}

OTHER AGENTS:
{{other_agents}}

AVAILABLE RELATIONSHIP TYPES:
{{relationship_types}}

For each relationship, provide:
- target_agent_name: exact name from the list
- relationship_type: one of the available types
- intensity: 1-10 (how strong/significant)
- is_bidirectional: true/false
- description: one sentence describing the relationship dynamic

Respond as a JSON array of objects.',
  true, 'anthropic', 0.7, 500
FROM (VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'dystopian'),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'fantasy'),
  ('30000000-0000-0000-0000-000000000001'::uuid, 'sci-fi horror'),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'post-apocalyptic')
) AS sim(id, theme);

-- Echo transformation template (per simulation)
INSERT INTO prompt_templates (simulation_id, template_type, prompt_category, template_name, prompt_content, is_active, default_model, temperature, max_tokens)
SELECT sim.id, 'event_echo_transformation', 'generation', 'Transform Event Echo',
  'Transform this event from another world into the voice and aesthetic of ' || sim.name || ' (' || sim.theme || ').

SOURCE EVENT:
Title: {{source_title}}
Description: {{source_description}}
Impact Level: {{impact_level}}
Echo Vector: {{echo_vector}} (the thematic channel through which this event bleeds)

TARGET WORLD: {{target_description}}

The transformed event should:
- Feel native to the target world
- Preserve the core narrative tension but distort it through the target aesthetic
- Reference the echo vector thematically
- Be more mysterious/fragmentary than the original (echoes are imperfect)

Respond as JSON with "title" and "description" fields only.',
  true, 'anthropic', 0.8, 300
FROM (VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Velgarien', 'dystopian bureaucracy'),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'The Capybara Kingdom', 'underground fantasy'),
  ('30000000-0000-0000-0000-000000000001'::uuid, 'Station Null', 'deep-space horror'),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'Speranza', 'post-apocalyptic underground')
) AS sim(id, name, theme);
