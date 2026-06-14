-- Migration 251: DRIFT — fn_apply_drift_chart (atomic writer for the Python-derived chart)
--
-- Spec: docs/plans/drift-implementation-plan.md §8.1 (topology derived from the
--       platform's real inter-world relationships), §8.2 (versioning / stable_key),
--       ADR-007 (Postgres-first persistence: geometry in Python, the single SQL write).
--
-- WHY this supersedes the 248 SQL generator (fn_generate_drift_chart):
--   248 laid every world on a synthetic ring with a central spoke-hub. That hub made
--   every world reachable in ~2 moves (graph diameter ≈ 2), which collapsed the entire
--   push-your-luck loop — window/Bandbreite/Dissonanz pressure is all distance-scaled,
--   so with no distance there was no journey and no route choice. The redesign DERIVES
--   the topology from `simulation_connections` (+ `embassies`): a corridor of
--   interstitials per real connection (length from strength), unconnected worlds as a
--   Tiefdrift frontier, a few deep cross-cuts — genuine distances 3–8 between homes.
--
-- WHY Python generation + a SQL writer (not a SQL generator like 248):
--   The layout is a seeded force-directed embedding (Fruchterman-Reingold) — iterative
--   float physics with no clean set-based SQL equivalent, exactly the shapely-in-
--   ForgeMapService situation (ADR-007). So generation is pure Python
--   (`backend/services/travel/chart_generator.py::build_chart`, unit-tested, no I/O) and
--   THIS function is the single atomic write: it takes the generated nodes + edges as
--   two jsonb arrays and persists a fresh chart_version all-or-nothing. Mirrors
--   fn_apply_map_geometry (236): generate in Python, write in one SECURITY DEFINER fn.
--
-- ATOMICITY (one transaction, all-or-nothing):
--   1. Validate p_nodes / p_edges are non-empty arrays.
--   2. v_version = max(version)+1 (immutable history; in-flight runs keep their pinned
--      version via travel_runs.chart_version).
--   3. INSERT chart_versions(version, seed, generator_version).
--   4. INSERT nodes via jsonb_to_recordset (node_kind='seeded').
--   5. INSERT edges via jsonb_to_recordset, resolving from_key/to_key → node id by JOIN
--      on (chart_version, stable_key). A dangling key (a generator contract violation)
--      drops the row in the INNER JOIN → the row-count guard RAISES rather than silently
--      shipping a broken chart.
--   6. Guard: ≥2 broadcast_rand homes (a chart needs at least two worlds).
--   7. travel_audit + RETURN {version, worlds, nodes, edges}.
--
-- FRESH-APPLY NOTE: this migration only installs the writer; it does NOT generate a
-- chart (generation is Python now). On a fresh database the active chart stays at
-- whatever the last applied generator emitted (248's ring) until an operator calls the
-- Python regenerate (POST /api/v1/drift/admin/regenerate → ChartGeneratorService).
-- DRIFT is gated by drift_p0_enabled=false in prod, so nothing is user-visible until
-- the gate is raised — by which point the operator will have regenerated.
--
-- SECURITY: SECURITY DEFINER + search_path=public + EXECUTE only to service_role. Per
-- the 245 ADR-006 lesson the REVOKE is explicit FROM anon + authenticated (a bare REVOKE
-- FROM PUBLIC leaves Supabase's default direct grants intact → anon could PostgREST-RPC
-- a chart rewrite). The backend calls it via the admin (service_role) client.
--
-- Behind drift_p0_enabled — the gate is unchanged; this only reshapes the chart writer.


-- ═══════════════════════════════════════════════════════════════════
-- 1. Retire the 248 SQL generator (superseded by the Python builder)
-- ═══════════════════════════════════════════════════════════════════
-- 248's DO block already ran on prior applies (and runs before this on a fresh apply),
-- so dropping it here removes the design-broken ring generator going forward without
-- losing the historically-generated versions (chart_versions rows are untouched).

DROP FUNCTION IF EXISTS public.fn_generate_drift_chart(BIGINT, TEXT);


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_apply_drift_chart(seed, generator_version, nodes, edges) — the atomic writer
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_apply_drift_chart(
    p_seed              BIGINT,
    p_generator_version TEXT,
    p_nodes             JSONB,
    p_edges             JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version    INT;
    v_nodes      INT;
    v_edges      INT;
    v_edges_in   INT;
    v_worlds     INT;
BEGIN
    -- 1. Shape validation (the writer is generic; defend its contract).
    IF jsonb_typeof(p_nodes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_nodes) = 0 THEN
        RAISE EXCEPTION 'fn_apply_drift_chart: p_nodes must be a non-empty json array'
            USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_edges) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'fn_apply_drift_chart: p_edges must be a json array'
            USING ERRCODE = '22023';
    END IF;

    -- 2. New, higher chart version (immutable history; max(version) is the active chart
    --    per fn_travel_run_open).
    SELECT COALESCE(max(version), 0) + 1 INTO v_version FROM chart_versions;
    INSERT INTO chart_versions (version, seed, generator_version)
    VALUES (v_version, p_seed, p_generator_version);

    -- 3. Nodes. node_kind='seeded' (the generated base topology); region_cell/band/mask
    --    come straight from the builder. uq_chart_home_node (246) enforces one
    --    broadcast_rand per sim per version — a generator double-home RAISEs here.
    INSERT INTO drift_chart_nodes (
        chart_version, stable_key, node_kind, node_type, simulation_id,
        x, y, frequency_mask, region_cell, distance_band
    )
    SELECT v_version, n.stable_key, 'seeded', n.node_type, n.simulation_id,
           n.x, n.y, n.frequency_mask, n.region_cell, n.distance_band
      FROM jsonb_to_recordset(p_nodes) AS n(
          stable_key     TEXT,
          node_type      TEXT,
          simulation_id  UUID,
          x              DOUBLE PRECISION,
          y              DOUBLE PRECISION,
          frequency_mask INT,
          distance_band  TEXT,
          region_cell    TEXT
      );
    GET DIAGNOSTICS v_nodes = ROW_COUNT;

    -- 4. Edges — resolve from_key/to_key → node id by JOIN on (chart_version, stable_key).
    --    INNER JOIN drops an edge whose endpoint key is absent; the count guard below
    --    turns that silent loss into a hard failure (no broken chart ships).
    v_edges_in := jsonb_array_length(p_edges);
    INSERT INTO drift_chart_edges (
        chart_version, from_node, to_node, weight, permeability, corridor
    )
    SELECT v_version, nf.id, nt.id, e.weight, e.permeability, e.corridor
      FROM jsonb_to_recordset(p_edges) AS e(
          from_key     TEXT,
          to_key       TEXT,
          weight       INT,
          permeability JSONB,
          corridor     BOOLEAN
      )
      JOIN drift_chart_nodes nf
        ON nf.chart_version = v_version AND nf.stable_key = e.from_key
      JOIN drift_chart_nodes nt
        ON nt.chart_version = v_version AND nt.stable_key = e.to_key;
    GET DIAGNOSTICS v_edges = ROW_COUNT;

    IF v_edges <> v_edges_in THEN
        RAISE EXCEPTION 'fn_apply_drift_chart: % of % edges referenced a missing node stable_key',
            v_edges_in - v_edges, v_edges_in USING ERRCODE = '22023';
    END IF;

    -- 5. A chart needs at least two dockable worlds (mirrors the old generator guard).
    SELECT count(*) INTO v_worlds
      FROM drift_chart_nodes
     WHERE chart_version = v_version AND node_type = 'broadcast_rand';
    IF v_worlds < 2 THEN
        RAISE EXCEPTION 'fn_apply_drift_chart: need >= 2 broadcast_rand homes, got %', v_worlds
            USING ERRCODE = '22023';
    END IF;

    PERFORM travel_audit(NULL, 'travel_chart_generate', 'chart_version', NULL, NULL,
        jsonb_build_object('version', v_version, 'worlds', v_worlds,
                           'nodes', v_nodes, 'edges', v_edges,
                           'generator', p_generator_version, 'seed', p_seed));

    RETURN jsonb_build_object('version', v_version, 'worlds', v_worlds,
                              'nodes', v_nodes, 'edges', v_edges);
END;
$$;

COMMENT ON FUNCTION public.fn_apply_drift_chart(BIGINT, TEXT, JSONB, JSONB) IS
    'Atomic writer for a Python-derived DRIFT chart (ChartGeneratorService → this). Takes the generated nodes + edges as two jsonb arrays, emits a fresh chart_version = max(version)+1, inserts nodes via jsonb_to_recordset and edges by resolving from_key/to_key → node id on (chart_version, stable_key). Guards: every edge key must resolve (no silent loss) and >= 2 broadcast_rand homes. Mirrors fn_apply_map_geometry (geometry in Python, the single SQL write — ADR-007). System/admin class — service_role only.';

-- ADR-006 grant posture (245 lesson): explicit revoke from anon + authenticated, not
-- just PUBLIC; service_role only (the backend calls it via the admin client).
REVOKE ALL    ON FUNCTION public.fn_apply_drift_chart(BIGINT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_drift_chart(BIGINT, TEXT, JSONB, JSONB) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. Operator guidance (no chart is generated at migration time)
-- ═══════════════════════════════════════════════════════════════════

DO $note$
BEGIN
    RAISE NOTICE 'DRIFT 251: chart generation is now the Python ChartGeneratorService. '
                 'Call POST /api/v1/drift/admin/regenerate (platform admin) to emit the '
                 'relationship-derived chart as a new, higher chart_version.';
END $note$;
