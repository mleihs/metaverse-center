-- Migration 245: DRIFT — zone_adjacencies (P0a Begehung movement graph substrate)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.7. Design contract:
--       drift-…-concept.md v0.4 §8.2 (Begehung = zone graph; adjacency derived
--       from zone-polygon border-sharing, NOT streets — findings 12/54/71).
-- Pattern reference: migration 236 (fn_apply_map_geometry) — the Postgres-first
--       map-geometry contract this extends (ADR-007, CLAUDE.md map-geometry rule).
--
-- Seventh DRIFT P0a migration. Inside a simulation, travel is played as a ZONE
-- GRAPH: zones are rooms, adjacency is which zones share a polygon border. This
-- ships the persistence substrate for that graph:
--   * zone_adjacencies   — the derived adjacency table (one row per undirected
--                          zone pair, canonical-ordered).
--   * fn_apply_zone_adjacencies(sim, pairs[, bump]) — the dedicated atomic writer.
--   * fn_apply_map_geometry — EXTENDED to delegate adjacency writes when the forge
--                          geometry payload carries them, so new forge output
--                          persists its zone graph in the same atomic flow.
--
-- ── Why a dedicated function, decoupled from the forge-draft contract ──────────
-- fn_apply_map_geometry's contract ends in a forge_drafts.map_status write (step
-- 8) and is built around a draft being in flight. The adjacency backfill must
-- serve EVERY existing simulation with zone geojson — including ones that never
-- had a forge draft — so the write cannot ride that contract. fn_apply_zone_
-- adjacencies owns the adjacency write alone: full-replacement for one sim + a
-- map_geometry_version bump, with NO forge_drafts coupling. fn_apply_map_geometry
-- calls it (step 6b) for new forge output, passing p_bump_version=false because
-- its own step 7 already performs the single version bump (no double-bump).
--
-- ── Derivation taxonomy (geometry-only logic lives in Python) ──────────────────
-- The actual border-sharing computation is shapely (Python, ForgeMapService
-- style — there is no SQL equivalent; geojson is stored as plain jsonb, not
-- PostGIS). This function only PERSISTS precomputed pairs, exactly as
-- fn_apply_map_geometry persists precomputed geometry. derivation marks each
-- pair's origin:
--   'geometry' — intra-city, zone polygons share a border (the real adjacency).
--   'transit'  — inter-city Stadtfahrt edges (city center-points share no border,
--                so cross-city movement is modeled as all-city-pairs transit).
--   'fallback' — reserved for degraded geometry (a zone with no usable polygon).
-- Geometry-LESS simulations get NO rows at all — DriftChartService computes their
-- list-shaped graph at read time (fallback is code, adjacency is data, §3.7).
--
-- The backfill of existing sims is a one-shot Python pass (shapely) that calls
-- fn_apply_zone_adjacencies — it ships alongside this migration, NOT inside it
-- (a SQL migration cannot run shapely, and precomputing pairs into the migration
-- would bake one environment's geometry into all environments).
--
-- RLS (§5 world-state posture): zone_adjacencies is PUBLIC read (map topology is
-- public, like zones — the public-first contract); writes are service_role only
-- (the two functions). Active-view refresh: none (no agents/buildings/simulations/
-- events column change — zones is an FK target only).
--
-- ── SECURITY FIX bundled in (ADR-006) ─────────────────────────────────────────
-- Both functions REVOKE EXECUTE from anon + authenticated explicitly (not just
-- PUBLIC). Supabase default privileges grant EXECUTE on new functions DIRECTLY to
-- anon/authenticated, which REVOKE FROM PUBLIC does not undo — migration 236 left
-- fn_apply_map_geometry anon-callable via PostgREST RPC (a SECURITY DEFINER
-- geometry-rewrite reachable by an anonymous caller). Since we CREATE OR REPLACE
-- that function here anyway, its grants are corrected in the same migration.


-- ═══════════════════════════════════════════════════════════════════
-- 1. zone_adjacencies — the derived Begehung movement graph
-- ═══════════════════════════════════════════════════════════════════
-- One row per UNDIRECTED zone pair. zone_a < zone_b is the canonical ordering, so
-- (a,b) and (b,a) can never both exist — the PK is the dedup. simulation_id is
-- denormalized for the per-sim full-replacement DELETE and read queries.

CREATE TABLE zone_adjacencies (
    simulation_id  UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    zone_a         UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    zone_b         UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    derivation     TEXT NOT NULL CHECK (derivation IN ('geometry', 'transit', 'fallback')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (zone_a, zone_b),
    -- Canonical ordered pair: forbids the reverse duplicate and self-adjacency.
    CONSTRAINT zone_adjacencies_ordered CHECK (zone_a < zone_b)
);

-- The PK covers zone_a lookups; reverse lookups (zone_b = X) + per-sim ops need these.
CREATE INDEX idx_zone_adjacencies_zone_b ON zone_adjacencies (zone_b);
CREATE INDEX idx_zone_adjacencies_sim    ON zone_adjacencies (simulation_id);


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_apply_zone_adjacencies — the dedicated atomic writer
-- ═══════════════════════════════════════════════════════════════════
-- p_pairs: jsonb array of {zone_a, zone_b, derivation}. The function normalizes
-- each pair's order (LEAST/GREATEST), drops self-pairs, dedups, full-replaces the
-- sim's rows, and (optionally) bumps map_geometry_version. Append-only contract:
-- a row is never updated in place (DELETE + INSERT), so no updated_at column.

CREATE OR REPLACE FUNCTION public.fn_apply_zone_adjacencies(
    p_simulation_id uuid,
    p_pairs jsonb,
    p_bump_version boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sim_exists boolean;
    v_deleted int := 0;
    v_inserted int := 0;
    v_new_version int;
BEGIN
    -- 1. Validate simulation
    SELECT EXISTS(
        SELECT 1 FROM simulations
        WHERE id = p_simulation_id AND deleted_at IS NULL
    ) INTO v_sim_exists;

    IF NOT v_sim_exists THEN
        RAISE EXCEPTION 'fn_apply_zone_adjacencies: simulation % not found or deleted', p_simulation_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Full replacement for this simulation
    DELETE FROM zone_adjacencies WHERE simulation_id = p_simulation_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- 3. Insert normalized, de-duplicated pairs. LEAST/GREATEST canonicalizes the
    --    undirected pair so the ordered-pair CHECK/PK is satisfied; self-pairs are
    --    dropped; DISTINCT ON collapses any duplicate (a,b) regardless of input order.
    WITH raw AS (
        SELECT
            LEAST((e->>'zone_a')::uuid, (e->>'zone_b')::uuid)    AS za,
            GREATEST((e->>'zone_a')::uuid, (e->>'zone_b')::uuid) AS zb,
            e->>'derivation'                                     AS derivation
        FROM jsonb_array_elements(p_pairs) e
        WHERE (e->>'zone_a')::uuid <> (e->>'zone_b')::uuid
    ),
    deduped AS (
        SELECT DISTINCT ON (za, zb) za, zb, derivation
        FROM raw
        ORDER BY za, zb
    )
    INSERT INTO zone_adjacencies (simulation_id, zone_a, zone_b, derivation)
    SELECT p_simulation_id, za, zb, derivation FROM deduped;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    -- 4. Version bump — skipped when called from fn_apply_map_geometry (which bumps
    --    once for the whole geometry write). Standalone backfill bumps.
    IF p_bump_version THEN
        UPDATE simulations
        SET map_geometry_version = map_geometry_version + 1,
            updated_at = now()
        WHERE id = p_simulation_id
        RETURNING map_geometry_version INTO v_new_version;
    ELSE
        SELECT map_geometry_version INTO v_new_version
        FROM simulations WHERE id = p_simulation_id;
    END IF;

    RETURN jsonb_build_object(
        'deleted', v_deleted,
        'inserted', v_inserted,
        'geometry_version', v_new_version
    );
END;
$$;

COMMENT ON FUNCTION public.fn_apply_zone_adjacencies IS
    'Atomic persistence for the DRIFT Begehung zone-adjacency graph (plan §3.7). Takes precomputed undirected zone pairs as jsonb [{zone_a,zone_b,derivation}], normalizes/dedups, full-replaces the simulation''s rows, optionally bumps map_geometry_version (p_bump_version=false when called inside fn_apply_map_geometry, which bumps once itself). Decoupled from the forge_drafts contract so it can back-fill sims that never had a draft. Border-sharing is computed in Python (shapely); this only writes. Per ADR-006 + CLAUDE.md: SECURITY DEFINER + service_role-only EXECUTE.';

-- ADR-006: explicit REVOKE from anon + authenticated, not just PUBLIC. Supabase's
-- default privileges grant EXECUTE on new functions directly to anon/authenticated,
-- which a bare REVOKE FROM PUBLIC does NOT remove (verified: it left anon able to
-- call this SECURITY DEFINER fn via PostgREST RPC). travel_audit (migration 239) is
-- the correct precedent.
REVOKE ALL    ON FUNCTION public.fn_apply_zone_adjacencies(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.fn_apply_zone_adjacencies(uuid, jsonb, boolean) FROM anon;
REVOKE ALL    ON FUNCTION public.fn_apply_zone_adjacencies(uuid, jsonb, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_zone_adjacencies(uuid, jsonb, boolean) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. zone_adjacencies RLS (plan §5 — world-state public read)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE zone_adjacencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY zone_adjacencies_public_select
    ON zone_adjacencies FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY zone_adjacencies_service_role
    ON zone_adjacencies FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON TABLE zone_adjacencies IS
    'DRIFT Begehung movement graph (plan §3.7): one row per undirected zone pair (zone_a < zone_b canonical). derivation: geometry (intra-city polygon border-sharing), transit (inter-city Stadtfahrt edges), fallback (degraded geometry). Geometry-less sims get NO rows — DriftChartService computes their list-shaped graph at read time. Written only by fn_apply_zone_adjacencies / fn_apply_map_geometry. Public read (map topology); service_role write.';


-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_apply_map_geometry — EXTENDED to delegate adjacency writes (step 6b)
-- ═══════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE reproduces migration 236's full body verbatim, adding ONE new
-- block (6b) between the lives_at assignment and the version bump: when the forge
-- geometry payload carries an 'adjacencies' array, persist it via the dedicated
-- function WITHOUT a second version bump (step 7 below bumps once). Payloads with
-- no 'adjacencies' key behave exactly as before — additive, backward-compatible.

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

    -- 6b. Zone adjacencies (DRIFT, migration 245) — when the forge payload carries
    -- a precomputed adjacency graph, persist it through the dedicated function.
    -- p_bump_version=false: step 7 below performs the single version bump.
    IF p_geometry ? 'adjacencies' THEN
        PERFORM fn_apply_zone_adjacencies(p_simulation_id, p_geometry->'adjacencies', false);
    END IF;

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
  'as jsonb (cities/zones/streets/buildings arrays, + optional DRIFT adjacencies '
  'array — migration 245), writes everything in one transaction, deterministically '
  'assigns lives_at relations via md5+seed, bumps map_geometry_version. Per '
  'ADR-006 + CLAUDE.md: SECURITY DEFINER + service_role-only EXECUTE. Backend '
  'handles role gating.';

-- SECURITY FIX (in-scope: we are already replacing this function): migration 236
-- only did REVOKE ... FROM PUBLIC, which left anon + authenticated with a DIRECT
-- EXECUTE grant from Supabase's default privileges — i.e. an anonymous PostgREST
-- caller could invoke this SECURITY DEFINER geometry-rewrite RPC against any
-- simulation (the ADR-006 / incident-096→147 class). The backend calls it only via
-- the service_role admin client (forge_map_service.py:161), so revoking anon +
-- authenticated is safe and closes the hole.
REVOKE ALL    ON FUNCTION public.fn_apply_map_geometry(uuid, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.fn_apply_map_geometry(uuid, text, jsonb, uuid) FROM anon;
REVOKE ALL    ON FUNCTION public.fn_apply_map_geometry(uuid, text, jsonb, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_map_geometry(uuid, text, jsonb, uuid) TO service_role;
