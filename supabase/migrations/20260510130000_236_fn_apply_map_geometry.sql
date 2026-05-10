-- ============================================================================
-- Migration 236: fn_apply_map_geometry — atomic map geometry persistence
--
-- WHY: ForgeMapService (Python) builds geometry via shapely (Voronoi, polygon
-- ops), but ALL persistence belongs in Postgres per the project Postgres-first
-- principle. This function takes the generated geometry as a single jsonb
-- payload and applies every write atomically: cities update, zones update,
-- streets full-replacement, buildings update, deterministic lives_at agent
-- assignment, version bump, and (if a draft is in flight) map_status='succeeded'.
--
-- WHAT it does (in one transaction, all-or-nothing):
--   1. Validate the simulation exists and is not soft-deleted.
--   2. UPDATE cities.map_center_lat/lng from payload.
--   3. UPDATE zones.geojson from payload.
--   4. DELETE all existing city_streets for this sim, INSERT new ones from
--      payload. buildings.street_id is auto-cleaned via ON DELETE SET NULL.
--   5. UPDATE buildings.geojson and buildings.street_id from payload.
--   6. INSERT building_agent_relations(relation_type='lives_at') for every
--      agent without one, deterministically picking a residential building
--      via md5(agent_id || seed). Idempotent via existing UNIQUE constraint.
--   7. Bump simulations.map_geometry_version. Persist the seed used.
--   8. If p_forge_draft_id is non-null, mark that draft's map_status='succeeded'.
--
-- LIVES-AT DETERMINISM: takes the first 7 hex chars of md5(agent_id::text ||
-- seed), interprets as bit(28)::int (always positive, max 2^28-1), modulo the
-- residential building count. Slight modulo bias is acceptable for a
-- deterministic-but-arbitrary mapping at small N (Velgarien: ~5 residentials,
-- so 2^28 / 5 ≈ 53.7M bins per choice — uniform enough).
--
-- FAILURE TRANSITIONS (NOT in this function):
--   * map_status='generating' is set by the Python orchestrator BEFORE calling
--     this function (the long shapely work happens between).
--   * map_status='failed' is set by the Python orchestrator's except handler;
--     this function never runs in that case (no SQL transaction to roll back).
--
-- SECURITY: SECURITY DEFINER + search_path=public + EXECUTE only to service_role
-- per ADR-006 (no anon/authenticated grants on SECURITY DEFINER functions).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_apply_map_geometry(
    p_simulation_id uuid,
    p_seed text,
    p_geometry jsonb,
    p_forge_draft_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sim_exists boolean;
    v_cities_updated int := 0;
    v_zones_updated int := 0;
    v_streets_inserted int := 0;
    v_buildings_updated int := 0;
    v_lives_at_inserted int := 0;
    v_new_version int;
BEGIN
    -- 1. Validate simulation
    SELECT EXISTS(
        SELECT 1 FROM simulations
        WHERE id = p_simulation_id AND deleted_at IS NULL
    ) INTO v_sim_exists;

    IF NOT v_sim_exists THEN
        RAISE EXCEPTION 'fn_apply_map_geometry: simulation % not found or deleted', p_simulation_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. UPDATE cities
    WITH city_updates AS (
        SELECT
            (e->>'id')::uuid AS id,
            (e->>'map_center_lat')::double precision AS lat,
            (e->>'map_center_lng')::double precision AS lng
        FROM jsonb_array_elements(p_geometry->'cities') e
    )
    UPDATE cities c
    SET map_center_lat = u.lat,
        map_center_lng = u.lng,
        updated_at = now()
    FROM city_updates u
    WHERE c.id = u.id AND c.simulation_id = p_simulation_id;

    GET DIAGNOSTICS v_cities_updated = ROW_COUNT;

    -- 3. UPDATE zones (geojson polygon)
    WITH zone_updates AS (
        SELECT
            (e->>'id')::uuid AS id,
            e->'geojson' AS geojson
        FROM jsonb_array_elements(p_geometry->'zones') e
    )
    UPDATE zones z
    SET geojson = u.geojson,
        updated_at = now()
    FROM zone_updates u
    WHERE z.id = u.id AND z.simulation_id = p_simulation_id;

    GET DIAGNOSTICS v_zones_updated = ROW_COUNT;

    -- 4. DELETE then INSERT streets (full replacement).
    -- buildings.street_id ON DELETE SET NULL → no FK orphan handling needed here.
    DELETE FROM city_streets WHERE simulation_id = p_simulation_id;

    WITH new_streets AS (
        SELECT
            (e->>'id')::uuid AS id,
            (e->>'city_id')::uuid AS city_id,
            NULLIF(e->>'zone_id', '')::uuid AS zone_id,
            e->>'name' AS name,
            e->>'street_type' AS street_type,
            (e->>'length_km')::numeric AS length_km,
            e->'geojson' AS geojson
        FROM jsonb_array_elements(p_geometry->'streets') e
    )
    INSERT INTO city_streets (
        id, simulation_id, city_id, zone_id, name, street_type, length_km, geojson
    )
    SELECT
        id, p_simulation_id, city_id, zone_id, name, street_type, length_km, geojson
    FROM new_streets;

    GET DIAGNOSTICS v_streets_inserted = ROW_COUNT;

    -- 5. UPDATE buildings (geojson point + street_id from snap)
    WITH building_updates AS (
        SELECT
            (e->>'id')::uuid AS id,
            e->'geojson' AS geojson,
            NULLIF(e->>'street_id', '')::uuid AS street_id
        FROM jsonb_array_elements(p_geometry->'buildings') e
    )
    UPDATE buildings b
    SET geojson = u.geojson,
        street_id = u.street_id,
        updated_at = now()
    FROM building_updates u
    WHERE b.id = u.id AND b.simulation_id = p_simulation_id;

    GET DIAGNOSTICS v_buildings_updated = ROW_COUNT;

    -- 6. lives_at deterministic assignment for every agent without one
    WITH residential AS (
        SELECT array_agg(id ORDER BY id) AS ids
        FROM buildings
        WHERE simulation_id = p_simulation_id
          AND building_type = 'residential'
          AND deleted_at IS NULL
    ),
    agents_to_assign AS (
        SELECT a.id AS agent_id, r.ids AS residential_ids
        FROM agents a
        CROSS JOIN residential r
        WHERE a.simulation_id = p_simulation_id
          AND a.deleted_at IS NULL
          AND r.ids IS NOT NULL
          AND cardinality(r.ids) > 0
          AND NOT EXISTS (
              SELECT 1 FROM building_agent_relations bar
              WHERE bar.agent_id = a.id
                AND bar.relation_type = 'lives_at'
          )
    )
    INSERT INTO building_agent_relations (
        simulation_id, agent_id, building_id, relation_type
    )
    SELECT
        p_simulation_id,
        agent_id,
        residential_ids[
            1 + (
                ('x' || substr(md5(agent_id::text || p_seed), 1, 7))::bit(28)::int
                % cardinality(residential_ids)
            )
        ],
        'lives_at'
    FROM agents_to_assign
    ON CONFLICT (building_id, agent_id, relation_type) DO NOTHING;

    GET DIAGNOSTICS v_lives_at_inserted = ROW_COUNT;

    -- 7. Bump version + persist seed
    UPDATE simulations
    SET map_geometry_version = map_geometry_version + 1,
        map_seed = p_seed,
        updated_at = now()
    WHERE id = p_simulation_id
    RETURNING map_geometry_version INTO v_new_version;

    -- 8. Forge draft status transition (only if a draft is in flight)
    IF p_forge_draft_id IS NOT NULL THEN
        UPDATE forge_drafts
        SET map_status = 'succeeded',
            updated_at = now()
        WHERE id = p_forge_draft_id;
    END IF;

    RETURN jsonb_build_object(
        'cities_updated', v_cities_updated,
        'zones_updated', v_zones_updated,
        'streets_inserted', v_streets_inserted,
        'buildings_updated', v_buildings_updated,
        'lives_at_inserted', v_lives_at_inserted,
        'geometry_version', v_new_version
    );
END;
$$;

COMMENT ON FUNCTION public.fn_apply_map_geometry IS
  'Atomic geometry persistence for ForgeMapService. Takes generated geometry '
  'as jsonb (cities/zones/streets/buildings arrays), writes everything in one '
  'transaction, deterministically assigns lives_at relations via md5+seed, '
  'bumps map_geometry_version. Per ADR-006 + CLAUDE.md: SECURITY DEFINER + '
  'service_role-only EXECUTE. Backend handles role gating.';

REVOKE ALL ON FUNCTION public.fn_apply_map_geometry FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_apply_map_geometry TO service_role;
