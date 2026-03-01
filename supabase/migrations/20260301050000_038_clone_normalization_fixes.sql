-- Migration 038: Clone Normalization Fixes
--
-- Fixes critical balance issues discovered in 233-game simulation battery:
--   1. Zone floor = 4 (Velgarien has 3, gets synthetic zone)
--   2. Agent professions generated for ALL cloned agents (currently 0 rows in any template)
--   3. Embassy auto-generation for all participant pairs (NM has 0 embassies)
--   4. Agent floor = 6, building floor = 8 (future-proofing)
--   5. Building zone distribution (round-robin for synthetic buildings)
--
-- Without these fixes:
--   - Velgarien wins 87% (zone stability advantage: 3 vs 4 zones)
--   - Nova Meridian wins 0% (no embassies = can't deploy)
--   - All agents have qualification=0 (no agent_professions rows → 15% success rate)

-- ============================================================================
-- Replace clone_simulations_for_epoch with normalized version
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
  sim_id_map JSONB := '{}'::JSONB;  -- old_sim_id → new_sim_id
  building_id_map JSONB := '{}'::JSONB;  -- old_building_id → new_building_id
  agent_id_map JSONB := '{}'::JSONB;  -- old_agent_id → new_agent_id
  zone_id_map JSONB := '{}'::JSONB;  -- old_zone_id → new_zone_id
  city_id_map JSONB := '{}'::JSONB;  -- old_city_id → new_city_id
  old_id UUID;
  new_id UUID;
  emb RECORD;
  conn RECORD;
  rel RECORD;
  zone_row RECORD;
  zone_counter INT;
  security_levels TEXT[] := ARRAY['high', 'medium', 'medium', 'low'];
  -- New variables for normalization
  agent_clone_count INT;
  building_clone_count INT;
  first_cloned_city_id UUID;
  zone_names TEXT[] := ARRAY['Sector Alpha', 'Sector Beta', 'Sector Gamma', 'Sector Delta'];
  agent_names TEXT[] := ARRAY['Operative Alpha', 'Operative Beta', 'Operative Gamma', 'Operative Delta', 'Operative Epsilon', 'Operative Zeta'];
  building_names TEXT[] := ARRAY['Facility Alpha', 'Facility Beta', 'Facility Gamma', 'Facility Delta', 'Facility Epsilon', 'Facility Zeta', 'Facility Eta', 'Facility Theta'];
  zone_ids UUID[];  -- array of all zone IDs for this instance
  default_building_type TEXT;
  professions_count INT;
BEGIN
  -- ──────────────────────────────────────────────────────
  -- Phase A: Clone each participating simulation
  -- ──────────────────────────────────────────────────────
  FOR participant IN
    SELECT ep.simulation_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = p_epoch_id
  LOOP
    SELECT * INTO sim FROM simulations WHERE id = participant.simulation_id;
    IF sim IS NULL THEN
      RAISE EXCEPTION 'Simulation % not found', participant.simulation_id;
    END IF;

    -- Generate unique slug
    new_slug := sim.slug || '-e' || p_epoch_number;
    -- Handle slug collision
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

    -- A2: Clone simulation_members (give epoch participant membership)
    INSERT INTO simulation_members (simulation_id, user_id, member_role)
    SELECT new_sim_id, sm.user_id, sm.member_role
    FROM simulation_members sm
    WHERE sm.simulation_id = sim.id;

    -- A3: Clone simulation_settings
    INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
    SELECT new_sim_id, category, setting_key, setting_value
    FROM simulation_settings
    WHERE simulation_id = sim.id;

    -- A4: Clone simulation_taxonomies (including game_weight)
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

    -- Ensure at least one city exists (for synthetic zones/buildings)
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
      LIMIT 4  -- cap at 4 zones
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
        -- Normalize: distribute security levels fairly
        security_levels[LEAST(zone_counter, array_length(security_levels, 1))],
        zone_row.population_estimate
      )
      RETURNING id INTO new_id;
      zone_id_map := zone_id_map || jsonb_build_object(zone_row.id::text, new_id::text);
      zone_ids := zone_ids || new_id;
    END LOOP;

    -- Pad synthetic zones to reach exactly 4
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

    -- A8: Clone agents (max 6, normalized)
    agent_clone_count := 0;
    FOR old_id IN
      SELECT id FROM agents
      WHERE simulation_id = sim.id AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 6
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
      SELECT new_sim_id, new_id, profession, 5, is_primary  -- normalized to 5
      FROM agent_professions
      WHERE agent_id = old_id;

      -- CRITICAL FIX: Ensure at least one profession exists
      -- (templates have ZERO agent_professions rows → qualification=0 → 15% success rate)
      SELECT count(*) INTO professions_count
      FROM agent_professions WHERE agent_id = new_id;

      IF professions_count = 0 THEN
        INSERT INTO agent_professions (
          simulation_id, agent_id, profession,
          qualification_level, is_primary
        ) VALUES (
          new_sim_id, new_id, 'operative',
          5,    -- normalized game qualification
          true  -- primary profession
        );
      END IF;
    END LOOP;

    -- Pad synthetic agents to reach exactly 6
    WHILE agent_clone_count < 6 LOOP
      agent_clone_count := agent_clone_count + 1;
      INSERT INTO agents (
        simulation_id, name, character, background
      ) VALUES (
        new_sim_id,
        agent_names[agent_clone_count],
        'analytical, resourceful',
        'Trained field operative assigned to this simulation.'
      )
      RETURNING id INTO new_id;
      agent_id_map := agent_id_map || jsonb_build_object('synthetic_agent_' || agent_clone_count, new_id::text);

      -- Create profession for synthetic agent
      INSERT INTO agent_professions (
        simulation_id, agent_id, profession, qualification_level, is_primary
      ) VALUES (
        new_sim_id, new_id, 'operative', 5, true
      );
    END LOOP;

    -- A9: Clone buildings (max 8, NORMALIZED condition + capacity)
    -- Embassy buildings are prioritized to ensure cross-sim operations work
    building_clone_count := 0;
    -- Get a default building_type from this simulation's taxonomies
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
        NULL,    -- street_id not remapped (cosmetic)
        b.image_url, b.special_type, b.special_attributes
      FROM buildings b WHERE b.id = old_id
      RETURNING id INTO new_id;
      building_id_map := building_id_map || jsonb_build_object(old_id::text, new_id::text);

      -- Clone building_agent_relations (remapped agent IDs)
      INSERT INTO building_agent_relations (simulation_id, building_id, agent_id, relation_type)
      SELECT
        new_sim_id,
        new_id,
        (agent_id_map->>bar.agent_id::text)::UUID,
        bar.relation_type
      FROM building_agent_relations bar
      WHERE bar.building_id = old_id
        AND agent_id_map ? bar.agent_id::text;

      -- Clone building_profession_requirements (normalized min level)
      INSERT INTO building_profession_requirements (
        simulation_id, building_id, profession, min_qualification_level, is_mandatory
      )
      SELECT new_sim_id, new_id, profession, 3, is_mandatory  -- normalized min level
      FROM building_profession_requirements
      WHERE building_id = old_id;
    END LOOP;

    -- Pad synthetic buildings to reach exactly 8 (round-robin across zones)
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

    -- A10: Clone agent_relationships (intra-simulation, remapped IDs)
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

    -- NOTE: Events are NOT cloned — instances start with 0 events
    -- NOTE: Chat history is NOT cloned
    -- NOTE: Social media, campaigns are NOT cloned

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
    -- Only clone if both buildings were cloned
    IF building_id_map ? emb.building_a_id::text
       AND building_id_map ? emb.building_b_id::text
    THEN
      DECLARE
        new_a UUID := (building_id_map->>emb.building_a_id::text)::UUID;
        new_b UUID := (building_id_map->>emb.building_b_id::text)::UUID;
        ordered_a UUID;
        ordered_b UUID;
      BEGIN
        -- Respect ordered_buildings constraint (building_a_id < building_b_id)
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
          -- sim_a is whichever sim owns building ordered_a
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
          0,     -- normalized: no infiltration penalty
          NULL   -- normalized: no penalty expiry
        );
      END;
    END IF;
  END LOOP;

  -- B2: Clone simulation_connections between instance pairs
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
  -- This ensures every participant can target every other participant.
  -- Fixes: Nova Meridian has 0 embassy buildings → can't deploy any operatives.
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
    -- Iterate all pairs of cloned instances
    FOR sim_a_key IN SELECT jsonb_object_keys(sim_id_map)
    LOOP
      FOR sim_b_key IN SELECT jsonb_object_keys(sim_id_map)
      LOOP
        -- Skip self-pairs and enforce ordering to avoid duplicates
        IF sim_a_key >= sim_b_key THEN
          CONTINUE;
        END IF;

        sim_a_new := (sim_id_map->>sim_a_key)::UUID;
        sim_b_new := (sim_id_map->>sim_b_key)::UUID;

        -- Check if embassy already exists between these instances
        SELECT EXISTS (
          SELECT 1 FROM embassies
          WHERE status = 'active'
            AND (
              (simulation_a_id = sim_a_new AND simulation_b_id = sim_b_new)
              OR (simulation_a_id = sim_b_new AND simulation_b_id = sim_a_new)
            )
        ) INTO has_embassy;

        IF NOT has_embassy THEN
          -- Pick first zone in each sim
          SELECT id INTO emb_zone_a FROM zones
          WHERE simulation_id = sim_a_new ORDER BY created_at LIMIT 1;
          SELECT id INTO emb_zone_b FROM zones
          WHERE simulation_id = sim_b_new ORDER BY created_at LIMIT 1;

          IF emb_zone_a IS NOT NULL AND emb_zone_b IS NOT NULL THEN
            -- Create embassy building in sim A
            INSERT INTO buildings (
              simulation_id, zone_id, name, building_type,
              building_condition, population_capacity, special_type
            ) VALUES (
              sim_a_new, emb_zone_a,
              'Diplomatic Station ' || substr(sim_b_key, 1, 8),
              'embassy', 'good', 30, 'embassy'
            ) RETURNING id INTO emb_building_a;

            -- Create embassy building in sim B
            INSERT INTO buildings (
              simulation_id, zone_id, name, building_type,
              building_condition, population_capacity, special_type
            ) VALUES (
              sim_b_new, emb_zone_b,
              'Diplomatic Station ' || substr(sim_a_key, 1, 8),
              'embassy', 'good', 30, 'embassy'
            ) RETURNING id INTO emb_building_b;

            -- Create embassy link (respect ordering constraint)
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

  -- B4: Auto-generate missing simulation_connections for ALL participant pairs
  -- Ensures the multiverse map shows connections between all game instances
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

-- Permissions unchanged
REVOKE ALL ON FUNCTION clone_simulations_for_epoch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clone_simulations_for_epoch TO service_role;
