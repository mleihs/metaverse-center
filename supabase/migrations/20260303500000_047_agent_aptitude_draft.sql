-- Migration 047: Agent Aptitude System + Draft Phase
--
-- Two interlocking features:
--   1. Agent aptitudes — per-operative-type skill scores (3-9, budget 36)
--   2. Draft phase — players select which agents to bring into an epoch match
--
-- Aptitudes are separate from professions (lore identity vs game mechanics).
-- Success probability formula changes: qualification×0.05 → aptitude×0.03

-- ============================================================================
-- 1. agent_aptitudes table
-- ============================================================================

CREATE TABLE agent_aptitudes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  operative_type TEXT NOT NULL CHECK (operative_type IN (
    'spy', 'guardian', 'saboteur', 'propagandist', 'infiltrator', 'assassin'
  )),
  aptitude_level INT NOT NULL DEFAULT 6 CHECK (aptitude_level >= 3 AND aptitude_level <= 9),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, operative_type)
);

-- Indexes
CREATE INDEX idx_agent_aptitudes_agent ON agent_aptitudes(agent_id);
CREATE INDEX idx_agent_aptitudes_simulation ON agent_aptitudes(simulation_id);

-- updated_at trigger
CREATE TRIGGER set_agent_aptitudes_updated_at
  BEFORE UPDATE ON agent_aptitudes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 2. RLS policies (same pattern as agent_professions)
-- ============================================================================

ALTER TABLE agent_aptitudes ENABLE ROW LEVEL SECURITY;

-- Simulation members can read
CREATE POLICY agent_aptitudes_select ON agent_aptitudes
  FOR SELECT USING (
    simulation_id IN (
      SELECT simulation_id FROM simulation_members WHERE user_id = auth.uid()
    )
    OR simulation_id IN (
      SELECT id FROM simulations WHERE simulation_type = 'template'
    )
  );

-- Anon can read template aptitudes (public access)
CREATE POLICY agent_aptitudes_anon_select ON agent_aptitudes
  FOR SELECT TO anon USING (
    simulation_id IN (
      SELECT id FROM simulations WHERE simulation_type = 'template'
    )
  );

-- Editors+ can insert/update/delete
CREATE POLICY agent_aptitudes_insert ON agent_aptitudes
  FOR INSERT WITH CHECK (
    simulation_id IN (
      SELECT simulation_id FROM simulation_members
      WHERE user_id = auth.uid() AND member_role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY agent_aptitudes_update ON agent_aptitudes
  FOR UPDATE USING (
    simulation_id IN (
      SELECT simulation_id FROM simulation_members
      WHERE user_id = auth.uid() AND member_role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY agent_aptitudes_delete ON agent_aptitudes
  FOR DELETE USING (
    simulation_id IN (
      SELECT simulation_id FROM simulation_members
      WHERE user_id = auth.uid() AND member_role IN ('owner', 'admin', 'editor')
    )
  );

-- ============================================================================
-- 3. epoch_participants: draft columns
-- ============================================================================

ALTER TABLE epoch_participants
  ADD COLUMN drafted_agent_ids UUID[] DEFAULT NULL,
  ADD COLUMN draft_completed_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 4. Refactored clone function — reads drafted_agent_ids + clones aptitudes
-- ============================================================================

CREATE OR REPLACE FUNCTION clone_simulations_for_epoch(
  p_epoch_id UUID,
  p_created_by_id UUID,
  p_epoch_number INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  participant RECORD;
  sim RECORD;
  new_sim_id UUID;
  new_slug TEXT;
  mapping JSONB := '[]'::JSONB;
  sim_id_map JSONB := '{}'::JSONB;
  building_id_map JSONB := '{}'::JSONB;
  agent_id_map JSONB := '{}'::JSONB;
  zone_id_map JSONB := '{}'::JSONB;
  city_id_map JSONB := '{}'::JSONB;
  old_id UUID;
  new_id UUID;
  emb RECORD;
  conn RECORD;
  rel RECORD;
  zone_row RECORD;
  zone_counter INT;
  security_levels TEXT[] := ARRAY['high', 'medium', 'medium', 'low'];
  agent_clone_count INT;
  building_clone_count INT;
  first_cloned_city_id UUID;
  zone_names TEXT[] := ARRAY['Sector Alpha', 'Sector Beta', 'Sector Gamma', 'Sector Delta'];
  agent_names TEXT[] := ARRAY['Operative Alpha', 'Operative Beta', 'Operative Gamma', 'Operative Delta', 'Operative Epsilon', 'Operative Zeta'];
  building_names TEXT[] := ARRAY['Facility Alpha', 'Facility Beta', 'Facility Gamma', 'Facility Delta', 'Facility Epsilon', 'Facility Zeta', 'Facility Eta', 'Facility Theta'];
  zone_ids UUID[];
  default_building_type TEXT;
  professions_count INT;
  -- New: draft-related variables
  p_drafted_ids UUID[];
  p_max_agents INT;
  epoch_config JSONB;
  aptitude_count INT;
BEGIN
  -- Read epoch config for max_agents_per_player
  SELECT config INTO epoch_config FROM game_epochs WHERE id = p_epoch_id;
  p_max_agents := COALESCE((epoch_config->>'max_agents_per_player')::INT, 6);

  -- ──────────────────────────────────────────────────────
  -- Phase A: Clone each participating simulation
  -- ──────────────────────────────────────────────────────
  FOR participant IN
    SELECT ep.simulation_id, ep.drafted_agent_ids
    FROM epoch_participants ep
    WHERE ep.epoch_id = p_epoch_id
  LOOP
    SELECT * INTO sim FROM simulations WHERE id = participant.simulation_id;
    IF sim IS NULL THEN
      RAISE EXCEPTION 'Simulation % not found', participant.simulation_id;
    END IF;

    -- Read drafted agent IDs (may be NULL if draft was skipped)
    p_drafted_ids := participant.drafted_agent_ids;

    -- Generate unique slug
    new_slug := sim.slug || '-e' || p_epoch_number;
    IF EXISTS (SELECT 1 FROM simulations WHERE slug = new_slug) THEN
      new_slug := new_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    END IF;

    -- A1: Clone simulation row
    INSERT INTO simulations (
      name, slug, description, theme, status, content_locale,
      additional_locales, owner_id, icon_url, banner_url,
      simulation_type, source_template_id, epoch_id
    ) VALUES (
      sim.name || ' (Epoch ' || p_epoch_number || ')',
      new_slug,
      sim.description,
      sim.theme,
      'active',
      sim.content_locale,
      sim.additional_locales,
      p_created_by_id,
      sim.icon_url,
      sim.banner_url,
      'game_instance',
      sim.id,
      p_epoch_id
    )
    RETURNING id INTO new_sim_id;

    sim_id_map := sim_id_map || jsonb_build_object(sim.id::text, new_sim_id::text);
    mapping := mapping || jsonb_build_array(jsonb_build_object(
      'template_id', sim.id,
      'instance_id', new_sim_id,
      'slug', new_slug,
      'name', sim.name || ' (Epoch ' || p_epoch_number || ')'
    ));

    -- A2: Clone simulation_members
    INSERT INTO simulation_members (simulation_id, user_id, member_role)
    SELECT new_sim_id, sm.user_id, sm.member_role
    FROM simulation_members sm
    WHERE sm.simulation_id = sim.id;

    -- A3: Clone simulation_settings
    INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
    SELECT new_sim_id, category, setting_key, setting_value
    FROM simulation_settings
    WHERE simulation_id = sim.id;

    -- A4: Clone simulation_taxonomies
    INSERT INTO simulation_taxonomies (
      simulation_id, taxonomy_type, value, label, description,
      sort_order, is_default, is_active, metadata, game_weight
    )
    SELECT
      new_sim_id, taxonomy_type, value, label, description,
      sort_order, is_default, is_active, metadata, game_weight
    FROM simulation_taxonomies
    WHERE simulation_id = sim.id;

    -- A5: Clone cities
    first_cloned_city_id := NULL;
    FOR old_id IN SELECT id FROM cities WHERE simulation_id = sim.id
    LOOP
      INSERT INTO cities (simulation_id, name, layout_type, description, population)
      SELECT new_sim_id, name, layout_type, description, population
      FROM cities WHERE id = old_id
      RETURNING id INTO new_id;
      city_id_map := city_id_map || jsonb_build_object(old_id::text, new_id::text);
      IF first_cloned_city_id IS NULL THEN
        first_cloned_city_id := new_id;
      END IF;
    END LOOP;

    IF first_cloned_city_id IS NULL THEN
      INSERT INTO cities (simulation_id, name, layout_type, description, population)
      VALUES (new_sim_id, 'Central District', 'grid', 'Auto-generated district', 10000)
      RETURNING id INTO first_cloned_city_id;
    END IF;

    -- A6: Clone zones with NORMALIZED security_level (up to 4)
    zone_counter := 0;
    zone_ids := ARRAY[]::UUID[];
    FOR zone_row IN
      SELECT * FROM zones WHERE simulation_id = sim.id ORDER BY name
      LIMIT 4
    LOOP
      zone_counter := zone_counter + 1;
      INSERT INTO zones (
        simulation_id, city_id, name, description, zone_type,
        security_level, population_estimate
      ) VALUES (
        new_sim_id,
        (city_id_map->>zone_row.city_id::text)::UUID,
        zone_row.name,
        zone_row.description,
        zone_row.zone_type,
        security_levels[LEAST(zone_counter, array_length(security_levels, 1))],
        zone_row.population_estimate
      )
      RETURNING id INTO new_id;
      zone_id_map := zone_id_map || jsonb_build_object(zone_row.id::text, new_id::text);
      zone_ids := zone_ids || new_id;
    END LOOP;

    WHILE zone_counter < 4 LOOP
      zone_counter := zone_counter + 1;
      INSERT INTO zones (
        simulation_id, city_id, name, zone_type,
        security_level, population_estimate
      ) VALUES (
        new_sim_id,
        first_cloned_city_id,
        zone_names[zone_counter],
        'mixed',
        security_levels[zone_counter],
        1000
      )
      RETURNING id INTO new_id;
      zone_id_map := zone_id_map || jsonb_build_object('synthetic_zone_' || zone_counter, new_id::text);
      zone_ids := zone_ids || new_id;
    END LOOP;

    -- A7: Clone city_streets
    INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type, length_km)
    SELECT
      new_sim_id,
      (city_id_map->>s.city_id::text)::UUID,
      (zone_id_map->>s.zone_id::text)::UUID,
      s.name, s.street_type, s.length_km
    FROM city_streets s
    WHERE s.simulation_id = sim.id;

    -- A8: Clone agents — DRAFT-AWARE
    -- If drafted_agent_ids is set, clone ONLY those agents (in order).
    -- Otherwise fall back to ORDER BY created_at LIMIT max_agents.
    agent_clone_count := 0;
    FOR old_id IN
      SELECT a.id FROM agents a
      WHERE a.simulation_id = sim.id AND a.deleted_at IS NULL
        AND (
          -- If draft IDs exist and non-empty, use them; otherwise take all
          p_drafted_ids IS NULL
          OR cardinality(p_drafted_ids) = 0
          OR a.id = ANY(p_drafted_ids)
        )
      ORDER BY
        -- If drafted, preserve draft order; otherwise created_at
        CASE WHEN p_drafted_ids IS NOT NULL AND cardinality(p_drafted_ids) > 0
          THEN array_position(p_drafted_ids, a.id)
          ELSE NULL
        END NULLS LAST,
        a.created_at
      LIMIT p_max_agents
    LOOP
      agent_clone_count := agent_clone_count + 1;
      INSERT INTO agents (
        simulation_id, name, system, character, background, gender,
        primary_profession, portrait_image_url, portrait_description,
        ambassador_blocked_until
      )
      SELECT
        new_sim_id, name, system, character, background, gender,
        primary_profession, portrait_image_url, portrait_description,
        NULL  -- normalized: no ambassador blocking
      FROM agents WHERE id = old_id
      RETURNING id INTO new_id;
      agent_id_map := agent_id_map || jsonb_build_object(old_id::text, new_id::text);

      -- Clone agent_professions with NORMALIZED qualification_level
      INSERT INTO agent_professions (simulation_id, agent_id, profession, qualification_level, is_primary)
      SELECT new_sim_id, new_id, profession, 5, is_primary
      FROM agent_professions
      WHERE agent_id = old_id;

      SELECT count(*) INTO professions_count
      FROM agent_professions WHERE agent_id = new_id;

      IF professions_count = 0 THEN
        INSERT INTO agent_professions (
          simulation_id, agent_id, profession,
          qualification_level, is_primary
        ) VALUES (
          new_sim_id, new_id, 'operative',
          5, true
        );
      END IF;

      -- Clone agent_aptitudes AS-IS (no normalization — aptitudes ARE the balance lever)
      INSERT INTO agent_aptitudes (simulation_id, agent_id, operative_type, aptitude_level)
      SELECT new_sim_id, new_id, operative_type, aptitude_level
      FROM agent_aptitudes
      WHERE agent_id = old_id;

      -- Check if aptitudes were cloned; if not, insert uniform defaults (6 each)
      SELECT count(*) INTO aptitude_count
      FROM agent_aptitudes WHERE agent_id = new_id;

      IF aptitude_count = 0 THEN
        INSERT INTO agent_aptitudes (simulation_id, agent_id, operative_type, aptitude_level)
        VALUES
          (new_sim_id, new_id, 'spy', 6),
          (new_sim_id, new_id, 'guardian', 6),
          (new_sim_id, new_id, 'saboteur', 6),
          (new_sim_id, new_id, 'propagandist', 6),
          (new_sim_id, new_id, 'infiltrator', 6),
          (new_sim_id, new_id, 'assassin', 6);
      END IF;
    END LOOP;

    -- Pad synthetic agents to reach the configured max
    WHILE agent_clone_count < p_max_agents LOOP
      agent_clone_count := agent_clone_count + 1;
      INSERT INTO agents (
        simulation_id, name, character, background
      ) VALUES (
        new_sim_id,
        agent_names[LEAST(agent_clone_count, array_length(agent_names, 1))],
        'analytical, resourceful',
        'Trained field operative assigned to this simulation.'
      )
      RETURNING id INTO new_id;
      agent_id_map := agent_id_map || jsonb_build_object('synthetic_agent_' || agent_clone_count, new_id::text);

      INSERT INTO agent_professions (
        simulation_id, agent_id, profession, qualification_level, is_primary
      ) VALUES (
        new_sim_id, new_id, 'operative', 5, true
      );

      -- Synthetic agents get uniform aptitudes
      INSERT INTO agent_aptitudes (simulation_id, agent_id, operative_type, aptitude_level)
      VALUES
        (new_sim_id, new_id, 'spy', 6),
        (new_sim_id, new_id, 'guardian', 6),
        (new_sim_id, new_id, 'saboteur', 6),
        (new_sim_id, new_id, 'propagandist', 6),
        (new_sim_id, new_id, 'infiltrator', 6),
        (new_sim_id, new_id, 'assassin', 6);
    END LOOP;

    -- A9: Clone buildings (max 8, NORMALIZED)
    building_clone_count := 0;
    SELECT value INTO default_building_type
    FROM simulation_taxonomies
    WHERE simulation_id = sim.id
      AND taxonomy_type = 'building_type'
      AND is_active = true
    ORDER BY sort_order
    LIMIT 1;
    IF default_building_type IS NULL THEN
      default_building_type := 'facility';
    END IF;

    FOR old_id IN
      SELECT id FROM buildings
      WHERE simulation_id = sim.id AND deleted_at IS NULL
      ORDER BY CASE WHEN special_type = 'embassy' THEN 0 ELSE 1 END, created_at
      LIMIT 8
    LOOP
      building_clone_count := building_clone_count + 1;
      INSERT INTO buildings (
        simulation_id, zone_id, name, description,
        building_type, building_condition, population_capacity,
        style, location, city_id, street_id,
        image_url, special_type, special_attributes
      )
      SELECT
        new_sim_id,
        (zone_id_map->>b.zone_id::text)::UUID,
        b.name, b.description, b.building_type,
        'good',  -- normalized condition
        30,      -- normalized capacity
        b.style, b.location,
        CASE WHEN b.city_id IS NOT NULL THEN (city_id_map->>b.city_id::text)::UUID END,
        NULL,    -- street_id not remapped
        b.image_url, b.special_type, b.special_attributes
      FROM buildings b WHERE b.id = old_id
      RETURNING id INTO new_id;
      building_id_map := building_id_map || jsonb_build_object(old_id::text, new_id::text);

      INSERT INTO building_agent_relations (simulation_id, building_id, agent_id, relation_type)
      SELECT
        new_sim_id,
        new_id,
        (agent_id_map->>bar.agent_id::text)::UUID,
        bar.relation_type
      FROM building_agent_relations bar
      WHERE bar.building_id = old_id
        AND agent_id_map ? bar.agent_id::text;

      INSERT INTO building_profession_requirements (
        simulation_id, building_id, profession, min_qualification_level, is_mandatory
      )
      SELECT new_sim_id, new_id, profession, 3, is_mandatory
      FROM building_profession_requirements
      WHERE building_id = old_id;
    END LOOP;

    WHILE building_clone_count < 8 LOOP
      building_clone_count := building_clone_count + 1;
      INSERT INTO buildings (
        simulation_id, zone_id, name,
        building_type, building_condition, population_capacity,
        city_id
      ) VALUES (
        new_sim_id,
        zone_ids[1 + ((building_clone_count - 1) % array_length(zone_ids, 1))],
        building_names[building_clone_count],
        default_building_type,
        'good',
        30,
        first_cloned_city_id
      )
      RETURNING id INTO new_id;
      building_id_map := building_id_map || jsonb_build_object('synthetic_bldg_' || building_clone_count, new_id::text);
    END LOOP;

    -- A10: Clone agent_relationships
    FOR rel IN
      SELECT * FROM agent_relationships WHERE simulation_id = sim.id
    LOOP
      IF agent_id_map ? rel.source_agent_id::text
         AND agent_id_map ? rel.target_agent_id::text
      THEN
        INSERT INTO agent_relationships (
          simulation_id, source_agent_id, target_agent_id,
          relationship_type, is_bidirectional, intensity, description, metadata
        ) VALUES (
          new_sim_id,
          (agent_id_map->>rel.source_agent_id::text)::UUID,
          (agent_id_map->>rel.target_agent_id::text)::UUID,
          rel.relationship_type,
          rel.is_bidirectional,
          rel.intensity,
          rel.description,
          rel.metadata
        );
      END IF;
    END LOOP;

  END LOOP;

  -- ──────────────────────────────────────────────────────
  -- Phase B: Remap cross-simulation references
  -- ──────────────────────────────────────────────────────

  -- B1: Clone embassies between instance pairs
  FOR emb IN
    SELECT * FROM embassies
    WHERE sim_id_map ? simulation_a_id::text
      AND sim_id_map ? simulation_b_id::text
      AND status = 'active'
  LOOP
    IF building_id_map ? emb.building_a_id::text
       AND building_id_map ? emb.building_b_id::text
    THEN
      DECLARE
        new_a UUID := (building_id_map->>emb.building_a_id::text)::UUID;
        new_b UUID := (building_id_map->>emb.building_b_id::text)::UUID;
        ordered_a UUID;
        ordered_b UUID;
      BEGIN
        IF new_a < new_b THEN
          ordered_a := new_a;
          ordered_b := new_b;
        ELSE
          ordered_a := new_b;
          ordered_b := new_a;
        END IF;

        INSERT INTO embassies (
          building_a_id, simulation_a_id, building_b_id, simulation_b_id,
          status, connection_type, description, established_by,
          bleed_vector, event_propagation, embassy_metadata,
          created_by_id, infiltration_penalty, infiltration_penalty_expires_at
        ) VALUES (
          ordered_a,
          CASE WHEN new_a < new_b
            THEN (sim_id_map->>emb.simulation_a_id::text)::UUID
            ELSE (sim_id_map->>emb.simulation_b_id::text)::UUID
          END,
          ordered_b,
          CASE WHEN new_a < new_b
            THEN (sim_id_map->>emb.simulation_b_id::text)::UUID
            ELSE (sim_id_map->>emb.simulation_a_id::text)::UUID
          END,
          'active',
          emb.connection_type,
          emb.description,
          emb.established_by,
          emb.bleed_vector,
          emb.event_propagation,
          emb.embassy_metadata,
          p_created_by_id,
          0,
          NULL
        );
      END;
    END IF;
  END LOOP;

  -- B2: Clone simulation_connections
  FOR conn IN
    SELECT * FROM simulation_connections
    WHERE sim_id_map ? simulation_a_id::text
      AND sim_id_map ? simulation_b_id::text
      AND is_active = true
  LOOP
    INSERT INTO simulation_connections (
      simulation_a_id, simulation_b_id, connection_type,
      bleed_vectors, strength, description, is_active
    ) VALUES (
      (sim_id_map->>conn.simulation_a_id::text)::UUID,
      (sim_id_map->>conn.simulation_b_id::text)::UUID,
      conn.connection_type,
      conn.bleed_vectors,
      conn.strength,
      conn.description,
      true
    );
  END LOOP;

  -- B3: Auto-generate missing embassies for ALL participant pairs
  DECLARE
    sim_a_key TEXT;
    sim_b_key TEXT;
    sim_a_new UUID;
    sim_b_new UUID;
    has_embassy BOOLEAN;
    emb_building_a UUID;
    emb_building_b UUID;
    emb_zone_a UUID;
    emb_zone_b UUID;
  BEGIN
    FOR sim_a_key IN SELECT jsonb_object_keys(sim_id_map)
    LOOP
      FOR sim_b_key IN SELECT jsonb_object_keys(sim_id_map)
      LOOP
        IF sim_a_key >= sim_b_key THEN
          CONTINUE;
        END IF;

        sim_a_new := (sim_id_map->>sim_a_key)::UUID;
        sim_b_new := (sim_id_map->>sim_b_key)::UUID;

        SELECT EXISTS (
          SELECT 1 FROM embassies
          WHERE status = 'active'
            AND (
              (simulation_a_id = sim_a_new AND simulation_b_id = sim_b_new)
              OR (simulation_a_id = sim_b_new AND simulation_b_id = sim_a_new)
            )
        ) INTO has_embassy;

        IF NOT has_embassy THEN
          SELECT id INTO emb_zone_a FROM zones
          WHERE simulation_id = sim_a_new ORDER BY created_at LIMIT 1;
          SELECT id INTO emb_zone_b FROM zones
          WHERE simulation_id = sim_b_new ORDER BY created_at LIMIT 1;

          IF emb_zone_a IS NOT NULL AND emb_zone_b IS NOT NULL THEN
            INSERT INTO buildings (
              simulation_id, zone_id, name, building_type,
              building_condition, population_capacity, special_type
            ) VALUES (
              sim_a_new, emb_zone_a,
              'Diplomatic Station ' || substr(sim_b_key, 1, 8),
              'embassy', 'good', 30, 'embassy'
            ) RETURNING id INTO emb_building_a;

            INSERT INTO buildings (
              simulation_id, zone_id, name, building_type,
              building_condition, population_capacity, special_type
            ) VALUES (
              sim_b_new, emb_zone_b,
              'Diplomatic Station ' || substr(sim_a_key, 1, 8),
              'embassy', 'good', 30, 'embassy'
            ) RETURNING id INTO emb_building_b;

            IF emb_building_a < emb_building_b THEN
              INSERT INTO embassies (
                building_a_id, simulation_a_id,
                building_b_id, simulation_b_id,
                status, connection_type, description,
                created_by_id, infiltration_penalty
              ) VALUES (
                emb_building_a, sim_a_new,
                emb_building_b, sim_b_new,
                'active', 'diplomatic',
                'Auto-generated diplomatic station for epoch competition.',
                p_created_by_id, 0
              );
            ELSE
              INSERT INTO embassies (
                building_a_id, simulation_a_id,
                building_b_id, simulation_b_id,
                status, connection_type, description,
                created_by_id, infiltration_penalty
              ) VALUES (
                emb_building_b, sim_b_new,
                emb_building_a, sim_a_new,
                'active', 'diplomatic',
                'Auto-generated diplomatic station for epoch competition.',
                p_created_by_id, 0
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END;

  -- B4: Auto-generate missing simulation_connections
  DECLARE
    conn_sim_a_key TEXT;
    conn_sim_b_key TEXT;
    conn_sim_a_new UUID;
    conn_sim_b_new UUID;
    has_connection BOOLEAN;
  BEGIN
    FOR conn_sim_a_key IN SELECT jsonb_object_keys(sim_id_map)
    LOOP
      FOR conn_sim_b_key IN SELECT jsonb_object_keys(sim_id_map)
      LOOP
        IF conn_sim_a_key >= conn_sim_b_key THEN
          CONTINUE;
        END IF;

        conn_sim_a_new := (sim_id_map->>conn_sim_a_key)::UUID;
        conn_sim_b_new := (sim_id_map->>conn_sim_b_key)::UUID;

        SELECT EXISTS (
          SELECT 1 FROM simulation_connections
          WHERE is_active = true
            AND (
              (simulation_a_id = conn_sim_a_new AND simulation_b_id = conn_sim_b_new)
              OR (simulation_a_id = conn_sim_b_new AND simulation_b_id = conn_sim_a_new)
            )
        ) INTO has_connection;

        IF NOT has_connection THEN
          INSERT INTO simulation_connections (
            simulation_a_id, simulation_b_id,
            connection_type, bleed_vectors, strength,
            description, is_active
          ) VALUES (
            conn_sim_a_new, conn_sim_b_new,
            'diplomatic', ARRAY['resonance']::TEXT[], 0.5,
            'Auto-generated connection for epoch competition.',
            true
          );
        END IF;
      END LOOP;
    END LOOP;
  END;

  -- ──────────────────────────────────────────────────────
  -- Phase C: Update epoch_participants to point to instances
  -- ──────────────────────────────────────────────────────
  FOR participant IN
    SELECT ep.id, ep.simulation_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = p_epoch_id
  LOOP
    IF sim_id_map ? participant.simulation_id::text THEN
      UPDATE epoch_participants
      SET simulation_id = (sim_id_map->>participant.simulation_id::text)::UUID
      WHERE id = participant.id;
    END IF;
  END LOOP;

  RETURN mapping;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION clone_simulations_for_epoch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clone_simulations_for_epoch TO service_role;

-- ============================================================================
-- 5. Seed aptitude profiles for all 35 template agents (budget = 36 each)
-- ============================================================================
-- Each agent gets lore-appropriate aptitude distributions.
-- spy/guardian/saboteur/propagandist/infiltrator/assassin

-- Helper function to insert 6 aptitude rows for one agent
CREATE OR REPLACE FUNCTION _seed_aptitudes(
  p_agent_name TEXT,
  p_sim_slug TEXT,
  p_spy INT, p_guardian INT, p_saboteur INT,
  p_propagandist INT, p_infiltrator INT, p_assassin INT
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID;
  v_sim_id UUID;
BEGIN
  SELECT s.id INTO v_sim_id FROM simulations s WHERE s.slug = p_sim_slug AND s.simulation_type = 'template';
  SELECT a.id INTO v_agent_id FROM agents a WHERE a.name = p_agent_name AND a.simulation_id = v_sim_id AND a.deleted_at IS NULL;
  IF v_agent_id IS NULL THEN
    RAISE NOTICE 'Agent % not found in %, skipping', p_agent_name, p_sim_slug;
    RETURN;
  END IF;
  INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
    (v_agent_id, v_sim_id, 'spy', p_spy),
    (v_agent_id, v_sim_id, 'guardian', p_guardian),
    (v_agent_id, v_sim_id, 'saboteur', p_saboteur),
    (v_agent_id, v_sim_id, 'propagandist', p_propagandist),
    (v_agent_id, v_sim_id, 'infiltrator', p_infiltrator),
    (v_agent_id, v_sim_id, 'assassin', p_assassin)
  ON CONFLICT (agent_id, operative_type) DO UPDATE SET aptitude_level = EXCLUDED.aptitude_level;
END;
$$ LANGUAGE plpgsql;

-- ── Velgarien (9 agents) ──────────────────────────────
-- Elena Voss — journalist/spy, information-focused
SELECT _seed_aptitudes('Elena Voss', 'velgarien', 9, 3, 4, 7, 8, 5);
-- Lena Kray — resistance fighter, sabotage specialist
SELECT _seed_aptitudes('Lena Kray', 'velgarien', 5, 4, 9, 5, 6, 7);
-- General Aldric Wolf — military commander, guardian
SELECT _seed_aptitudes('General Aldric Wolf', 'velgarien', 4, 9, 5, 6, 3, 9);
-- Mira Steinfeld — artist/propagandist
SELECT _seed_aptitudes('Mira Steinfeld', 'velgarien', 5, 3, 4, 9, 7, 8);
-- Doktor Fenn — scientist, analytical
SELECT _seed_aptitudes('Doktor Fenn', 'velgarien', 8, 5, 7, 4, 9, 3);
-- Pater Cornelius — priest, diplomatic influence
SELECT _seed_aptitudes('Pater Cornelius', 'velgarien', 6, 7, 3, 8, 5, 7);
-- Viktor Harken — enforcer, direct action
SELECT _seed_aptitudes('Viktor Harken', 'velgarien', 3, 8, 7, 4, 5, 9);
-- Schwester Irma — nurse, infiltration specialist
SELECT _seed_aptitudes('Schwester Irma', 'velgarien', 7, 5, 3, 6, 9, 6);
-- Inspektor Mueller — detective, surveillance
SELECT _seed_aptitudes('Inspektor Mueller', 'velgarien', 9, 7, 5, 3, 6, 6);

-- ── The Gaslit Reach (6 agents) ───────────────────────
-- Commodore Harrowgate — military, naval commander
SELECT _seed_aptitudes('Commodore Harrowgate', 'the-gaslit-reach', 4, 9, 5, 6, 3, 9);
-- The Marchioness — socialite, influence-focused
SELECT _seed_aptitudes('The Marchioness', 'the-gaslit-reach', 7, 3, 4, 9, 8, 5);
-- Archivist Quill — scholar, intelligence specialist
SELECT _seed_aptitudes('Archivist Quill', 'the-gaslit-reach', 9, 4, 5, 5, 7, 6);
-- Mother Cinder — matriarch, protector
SELECT _seed_aptitudes('Mother Cinder', 'the-gaslit-reach', 5, 8, 6, 7, 4, 6);
-- Obediah Crook — merchant, subversive
SELECT _seed_aptitudes('Obediah Crook', 'the-gaslit-reach', 6, 3, 9, 4, 7, 7);
-- Madam Lacewing — spy, infiltrator
SELECT _seed_aptitudes('Madam Lacewing', 'the-gaslit-reach', 8, 4, 3, 6, 9, 6);

-- ── Station Null (7 agents) ───────────────────────────
-- HAVEN — AI system, intelligence specialist
SELECT _seed_aptitudes('HAVEN', 'station-null', 9, 6, 7, 4, 5, 5);
-- Engineer Jan Kowalski — engineer, sabotage/repair
SELECT _seed_aptitudes('Engineer Jan Kowalski', 'station-null', 4, 7, 9, 3, 6, 7);
-- Dr. Kwame Osei — scientist, analytical
SELECT _seed_aptitudes('Dr. Kwame Osei', 'station-null', 8, 4, 6, 5, 7, 6);
-- Chaplain Isadora Mora — chaplain, influence/propaganda
SELECT _seed_aptitudes('Chaplain Isadora Mora', 'station-null', 5, 6, 3, 9, 7, 6);
-- Dr. Yuki Tanaka — medic, support/infiltration
SELECT _seed_aptitudes('Dr. Yuki Tanaka', 'station-null', 6, 5, 4, 7, 9, 5);
-- Commander Elena Vasquez — military commander
SELECT _seed_aptitudes('Commander Elena Vasquez', 'station-null', 5, 9, 6, 5, 3, 8);
-- Navigator Braun — navigator, reconnaissance
SELECT _seed_aptitudes('Navigator Braun', 'station-null', 7, 4, 5, 6, 8, 6);

-- ── Speranza (7 agents) ──────────────────────────────
-- Dottor Marco Ferrara — doctor, support
SELECT _seed_aptitudes('Dottor Marco Ferrara', 'speranza', 6, 5, 3, 7, 8, 7);
-- Lina Russo — scout, field operative
SELECT _seed_aptitudes('Lina Russo', 'speranza', 8, 4, 7, 3, 6, 8);
-- Celeste Amara — seer, influence
SELECT _seed_aptitudes('Celeste Amara', 'speranza', 5, 3, 4, 9, 8, 7);
-- Capitana Rosa Ferretti — military leader
SELECT _seed_aptitudes('Capitana Rosa Ferretti', 'speranza', 4, 9, 6, 5, 3, 9);
-- Tomas Vidal — engineer, builder
SELECT _seed_aptitudes('Tomas Vidal', 'speranza', 3, 7, 9, 5, 6, 6);
-- Enzo Moretti — merchant, smuggler
SELECT _seed_aptitudes('Enzo Moretti', 'speranza', 7, 3, 6, 6, 9, 5);
-- Padre Ignazio — priest, diplomat
SELECT _seed_aptitudes('Padre Ignazio', 'speranza', 5, 6, 4, 9, 7, 5);

-- ── Cité des Dames (6 agents) ────────────────────────
-- Christine de Pizan — writer, propagandist
SELECT _seed_aptitudes('Christine de Pizan', 'cite-des-dames', 6, 4, 3, 9, 7, 7);
-- Mary Wollstonecraft — philosopher, activist
SELECT _seed_aptitudes('Mary Wollstonecraft', 'cite-des-dames', 5, 5, 6, 8, 6, 6);
-- Hildegard von Bingen — mystic, healer
SELECT _seed_aptitudes('Hildegard von Bingen', 'cite-des-dames', 7, 7, 3, 6, 8, 5);
-- Sor Juana Inés de la Cruz — scholar, polymath
SELECT _seed_aptitudes('Sor Juana Inés de la Cruz', 'cite-des-dames', 9, 4, 5, 5, 7, 6);
-- Ada Lovelace — mathematician, analytical
SELECT _seed_aptitudes('Ada Lovelace', 'cite-des-dames', 8, 3, 9, 4, 6, 6);
-- Sojourner Truth — orator, guardian
SELECT _seed_aptitudes('Sojourner Truth', 'cite-des-dames', 3, 9, 5, 7, 5, 7);

-- Clean up helper function
DROP FUNCTION _seed_aptitudes;
