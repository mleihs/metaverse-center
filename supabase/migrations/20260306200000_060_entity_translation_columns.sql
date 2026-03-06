-- 060: Entity translation columns (_de suffix)
--
-- Extends the existing Lore _de suffix pattern to all entity tables.
-- 14 new nullable columns across 5 tables for German translations.
-- AI prompts continue reading base (English) columns only.

-- ── Agents: character_de, background_de, primary_profession_de ─────────
ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS character_de text,
    ADD COLUMN IF NOT EXISTS background_de text,
    ADD COLUMN IF NOT EXISTS primary_profession_de text;

-- ── Buildings: description_de, building_type_de, building_condition_de ──
ALTER TABLE public.buildings
    ADD COLUMN IF NOT EXISTS description_de text,
    ADD COLUMN IF NOT EXISTS building_type_de text,
    ADD COLUMN IF NOT EXISTS building_condition_de text;

-- ── Zones: description_de, zone_type_de ────────────────────────────────
ALTER TABLE public.zones
    ADD COLUMN IF NOT EXISTS description_de text,
    ADD COLUMN IF NOT EXISTS zone_type_de text;

-- ── City Streets: street_type_de ───────────────────────────────────────
ALTER TABLE public.city_streets
    ADD COLUMN IF NOT EXISTS street_type_de text;

-- ── Simulations: description_de ────────────────────────────────────────
ALTER TABLE public.simulations
    ADD COLUMN IF NOT EXISTS description_de text;

-- ── Lore table: add _de columns (were missing from 059) ───────────────
ALTER TABLE public.simulation_lore
    ADD COLUMN IF NOT EXISTS title_de text,
    ADD COLUMN IF NOT EXISTS epigraph_de text,
    ADD COLUMN IF NOT EXISTS body_de text,
    ADD COLUMN IF NOT EXISTS image_caption_de text;

-- ── Update clone function to include _de columns ──────────────────────

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
BEGIN
  -- Phase A: Clone each participating simulation
  FOR participant IN
    SELECT ep.simulation_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = p_epoch_id
  LOOP
    SELECT * INTO sim FROM simulations WHERE id = participant.simulation_id;
    IF sim IS NULL THEN
      RAISE EXCEPTION 'Simulation % not found', participant.simulation_id;
    END IF;

    new_slug := sim.slug || '-e' || p_epoch_number;
    IF EXISTS (SELECT 1 FROM simulations WHERE slug = new_slug) THEN
      new_slug := new_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    END IF;

    -- A1: Clone simulation row (including description_de)
    INSERT INTO simulations (
      name, slug, description, description_de, theme, status, content_locale,
      additional_locales, owner_id, icon_url, banner_url,
      simulation_type, source_template_id, epoch_id
    ) VALUES (
      sim.name || ' (Epoch ' || p_epoch_number || ')',
      new_slug,
      sim.description,
      sim.description_de,
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

    -- A6: Clone zones with _de columns
    zone_counter := 0;
    zone_ids := ARRAY[]::UUID[];
    FOR zone_row IN
      SELECT * FROM zones WHERE simulation_id = sim.id ORDER BY name
      LIMIT 4
    LOOP
      zone_counter := zone_counter + 1;
      INSERT INTO zones (
        simulation_id, city_id, name, description, description_de,
        zone_type, zone_type_de,
        security_level, population_estimate
      ) VALUES (
        new_sim_id,
        (city_id_map->>zone_row.city_id::text)::UUID,
        zone_row.name,
        zone_row.description,
        zone_row.description_de,
        zone_row.zone_type,
        zone_row.zone_type_de,
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

    -- A7: Clone city_streets with _de columns
    INSERT INTO city_streets (
      simulation_id, city_id, zone_id, name, street_type, street_type_de, length_km
    )
    SELECT
      new_sim_id,
      (city_id_map->>s.city_id::text)::UUID,
      (zone_id_map->>s.zone_id::text)::UUID,
      s.name, s.street_type, s.street_type_de, s.length_km
    FROM city_streets s
    WHERE s.simulation_id = sim.id;

    -- A8: Clone agents with _de columns (max 6)
    agent_clone_count := 0;
    FOR old_id IN
      SELECT id FROM agents
      WHERE simulation_id = sim.id AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 6
    LOOP
      agent_clone_count := agent_clone_count + 1;
      INSERT INTO agents (
        simulation_id, name, system, character, character_de,
        background, background_de, gender,
        primary_profession, primary_profession_de,
        portrait_image_url, portrait_description,
        ambassador_blocked_until
      )
      SELECT
        new_sim_id, name, system, character, character_de,
        background, background_de, gender,
        primary_profession, primary_profession_de,
        portrait_image_url, portrait_description,
        NULL
      FROM agents WHERE id = old_id
      RETURNING id INTO new_id;
      agent_id_map := agent_id_map || jsonb_build_object(old_id::text, new_id::text);

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
    END LOOP;

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

      INSERT INTO agent_professions (
        simulation_id, agent_id, profession, qualification_level, is_primary
      ) VALUES (
        new_sim_id, new_id, 'operative', 5, true
      );
    END LOOP;

    -- A9: Clone buildings with _de columns (max 8)
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
        simulation_id, zone_id, name, description, description_de,
        building_type, building_type_de,
        building_condition, building_condition_de,
        population_capacity,
        style, location, city_id, street_id,
        image_url, special_type, special_attributes
      )
      SELECT
        new_sim_id,
        (zone_id_map->>b.zone_id::text)::UUID,
        b.name, b.description, b.description_de,
        b.building_type, b.building_type_de,
        'good', b.building_condition_de,
        30,
        b.style, b.location,
        CASE WHEN b.city_id IS NOT NULL THEN (city_id_map->>b.city_id::text)::UUID END,
        NULL,
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

  -- Phase B: Remap cross-simulation references

  -- B1: Clone embassies
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

  -- Phase C: Update epoch_participants to point to instances
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
