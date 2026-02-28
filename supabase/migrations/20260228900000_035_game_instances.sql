-- Migration 035: Game Instances — Template/Instance separation
--
-- Problem: Epoch gameplay writes directly onto template simulations (saboteur
-- degrades building_condition, propagandist creates events, etc.). Simulations
-- are also not balanced for fair competition.
--
-- Solution: When an epoch starts, clone all participating simulations into
-- "game instances" with normalized gameplay values. All epoch logic runs on
-- the clones, leaving templates untouched.
--
-- Creates:
--   1. simulation_type + source columns on simulations
--   2. clone_simulation_for_epoch() — atomic batch clone of N simulations
--   3. Updated views to filter by simulation_type
--   4. RLS updates for game instance access

-- ============================================================================
-- 1. ADD COLUMNS TO SIMULATIONS TABLE
-- ============================================================================

ALTER TABLE simulations
  ADD COLUMN simulation_type TEXT NOT NULL DEFAULT 'template'
    CHECK (simulation_type IN ('template', 'game_instance', 'archived')),
  ADD COLUMN source_template_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
  ADD COLUMN epoch_id UUID REFERENCES game_epochs(id) ON DELETE SET NULL;

CREATE INDEX idx_simulations_type ON simulations(simulation_type);
CREATE INDEX idx_simulations_epoch ON simulations(epoch_id) WHERE epoch_id IS NOT NULL;
CREATE INDEX idx_simulations_source ON simulations(source_template_id) WHERE source_template_id IS NOT NULL;

COMMENT ON COLUMN simulations.simulation_type IS
  'template = worldbuilding original, game_instance = epoch clone, archived = completed epoch clone';
COMMENT ON COLUMN simulations.source_template_id IS
  'For game instances: points to the original template simulation';
COMMENT ON COLUMN simulations.epoch_id IS
  'For game instances: which epoch this instance belongs to';

-- Existing simulations are all templates
-- (default is 'template', no UPDATE needed)


-- ============================================================================
-- 2. NORMALIZED GAMEPLAY CONSTANTS
-- ============================================================================
-- Used by the clone function to ensure fair starts.

-- The clone function normalizes:
--   building_condition → 'good'        (game_weight 0.85)
--   population_capacity → 30            (uniform)
--   agent qualification_level → 5       (uniform)
--   zones.security_level distribution → 1× high, 2× medium, 1× low
--   ambassador_blocked_until → NULL
--   infiltration_penalty → 0
--   events → NOT cloned (instances start with 0 events)


-- ============================================================================
-- 3. CLONE FUNCTION — Atomic batch operation
-- ============================================================================
-- Clones all participating template simulations into game instances.
-- Returns a JSON array mapping: [{template_id, instance_id, slug}]
--
-- The function:
--   a) Clones each simulation (with normalized gameplay values)
--   b) Clones agents, buildings, zones, streets, professions, taxonomies, settings
--   c) Remaps embassies and simulation_connections between new instances
--   d) Creates simulation_members for epoch participants

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
    FOR old_id IN SELECT id FROM cities WHERE simulation_id = sim.id
    LOOP
      INSERT INTO cities (simulation_id, name, layout_type, description, population)
      SELECT new_sim_id, name, layout_type, description, population
      FROM cities WHERE id = old_id
      RETURNING id INTO new_id;
      city_id_map := city_id_map || jsonb_build_object(old_id::text, new_id::text);
    END LOOP;

    -- A6: Clone zones with NORMALIZED security_level
    zone_counter := 0;
    FOR zone_row IN
      SELECT * FROM zones WHERE simulation_id = sim.id ORDER BY name
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
    FOR old_id IN
      SELECT id FROM agents
      WHERE simulation_id = sim.id AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 6
    LOOP
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
    END LOOP;

    -- A9: Clone buildings (max 8, NORMALIZED condition + capacity)
    FOR old_id IN
      SELECT id FROM buildings
      WHERE simulation_id = sim.id AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 8
    LOOP
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

-- Only service_role / admin can call this function
REVOKE ALL ON FUNCTION clone_simulations_for_epoch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clone_simulations_for_epoch TO service_role;


-- ============================================================================
-- 4. ARCHIVE FUNCTION — Mark instances as archived after epoch ends
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_epoch_instances(p_epoch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE simulations
  SET simulation_type = 'archived',
      status = 'archived',
      archived_at = now()
  WHERE epoch_id = p_epoch_id
    AND simulation_type = 'game_instance';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION archive_epoch_instances FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_epoch_instances TO service_role;


-- ============================================================================
-- 5. CLEANUP FUNCTION — Delete instances (for cancelled epochs)
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_epoch_instances(p_epoch_id UUID)
RETURNS void AS $$
DECLARE
  instance_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO instance_ids
  FROM simulations
  WHERE epoch_id = p_epoch_id
    AND simulation_type IN ('game_instance', 'archived');

  IF instance_ids IS NULL THEN
    RETURN;
  END IF;

  -- Delete in FK-safe order:
  -- 1. Cross-sim refs (embassies, connections, echoes)
  DELETE FROM embassies WHERE simulation_a_id = ANY(instance_ids) OR simulation_b_id = ANY(instance_ids);
  DELETE FROM simulation_connections WHERE simulation_a_id = ANY(instance_ids) OR simulation_b_id = ANY(instance_ids);
  DELETE FROM event_echoes WHERE source_simulation_id = ANY(instance_ids) OR target_simulation_id = ANY(instance_ids);

  -- 2. Disable last-owner trigger (instances are expendable)
  ALTER TABLE simulation_members DISABLE TRIGGER trg_last_owner;

  -- 3. Delete simulations (cascades to agents, buildings, zones, etc.)
  DELETE FROM simulations WHERE id = ANY(instance_ids);

  -- 4. Re-enable trigger
  ALTER TABLE simulation_members ENABLE TRIGGER trg_last_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION delete_epoch_instances FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_epoch_instances TO service_role;


-- ============================================================================
-- 6. UPDATE simulation_dashboard VIEW — filter out game instances
-- ============================================================================

DROP VIEW IF EXISTS public.simulation_dashboard CASCADE;
CREATE VIEW public.simulation_dashboard AS
  SELECT
    s.id AS simulation_id,
    s.name,
    s.slug,
    s.status,
    s.theme,
    s.content_locale,
    s.owner_id,
    s.simulation_type,
    s.source_template_id,
    s.epoch_id,
    (SELECT count(*) FROM simulation_members sm WHERE sm.simulation_id = s.id) AS member_count,
    (SELECT count(*) FROM agents a WHERE a.simulation_id = s.id AND a.deleted_at IS NULL) AS agent_count,
    (SELECT count(*) FROM buildings b WHERE b.simulation_id = s.id AND b.deleted_at IS NULL) AS building_count,
    (SELECT count(*) FROM events e WHERE e.simulation_id = s.id AND e.deleted_at IS NULL) AS event_count,
    s.created_at,
    s.updated_at
  FROM simulations s
  WHERE s.deleted_at IS NULL;

-- Re-grant access after view recreation
GRANT SELECT ON public.simulation_dashboard TO authenticated, anon;


-- ============================================================================
-- 7. UPDATE mv_simulation_health — filter out game instances from default view
-- ============================================================================
-- Note: materialized views include ALL simulation types so scoring works on
-- game instances. Filtering by type happens in the application layer.
-- The view already filters by status IN ('active', 'configuring') which is fine
-- since game instances get status='active'.


-- ============================================================================
-- 8. FIX notify_game_metrics_stale trigger for embassies
-- ============================================================================
-- The trigger from migration 031 assumes NEW.simulation_id exists, but
-- embassies has simulation_a_id/simulation_b_id instead.
-- Fix: use dynamic field resolution to avoid "no field" errors.

CREATE OR REPLACE FUNCTION notify_game_metrics_stale()
RETURNS trigger AS $$
DECLARE
  sim_id TEXT := '';
BEGIN
  -- Try simulation_id first, then simulation_a_id as fallback
  BEGIN
    IF TG_OP = 'DELETE' THEN
      sim_id := OLD.simulation_id::text;
    ELSE
      sim_id := NEW.simulation_id::text;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        sim_id := OLD.simulation_a_id::text;
      ELSE
        sim_id := NEW.simulation_a_id::text;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      sim_id := '';
    END;
  END;

  PERFORM pg_notify('game_metrics_stale', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'simulation_id', sim_id
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 9. RLS — game instance access
-- ============================================================================
-- Game instances inherit RLS from the base simulations policies.
-- simulation_members are cloned during the clone process, so existing
-- policies that check simulation_members will work for instances too.
-- No additional RLS changes needed.
