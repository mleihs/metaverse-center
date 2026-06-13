-- Migration 248: DRIFT — travel_chart_generator (P0b: all active worlds on the chart)
--
-- Spec: docs/plans/drift-implementation-plan.md §8 (chart generation/versioning),
--       §8.3 (the region), §2 (Zahlenwerk re-tune for the bigger map).
-- Supersedes the hand-seeded P0 diamond (migration 247): that file itself notes the
-- deterministic region generator "supersedes this via a higher chart_version
-- (fn_travel_run_open uses max(version))". This is that generator.
--
-- WHY a SQL function, not a Python service (Postgres-first / ADR-007): chart
-- generation is a system "read the active worlds → lay them out → write the topology
-- atomically" operation, NOT concurrent player state, and the layout has no
-- shapely-style no-SQL-equivalent need (a ring is trig; the topology is set-based).
-- So it lives in one SECURITY DEFINER function — atomic by construction, no
-- fetch-compute-update in Python, no second layout layer to keep in sync. Generation
-- is re-runnable: each call reads the CURRENT active worlds and emits a fresh,
-- higher chart_version, so a newly published world appears the next time it runs
-- (the backend exposes an admin regenerate; full automation on publish is later).
--
-- TOPOLOGY (concept §6, "the chart"): a ring of broadcast edges with a dangerous
-- centre.
--   * One broadcast_rand HOME per active template sim, placed on a ring in the
--     deterministic sim order (created_at, id) so layout is stable across runs.
--   * One mid-band Strömungsband INTERSTITIAL between each pair of ring-adjacent
--     homes, on a slightly larger arc; the two corridor edges through it are cheap
--     (weight 1) — the safe, slow route (more moves → more Dissonanz).
--   * One central TIEFDRIFT CORE (deep band) with a weight-3 deep spoke to every
--     home — the risky shortcut: cross the centre to jump between any two worlds
--     fast, but it is Bandbreite-hungry and surge-prone (deep-Drift variance).
-- Every node carries the P0 memory/architecture frequency window so the whole chart
-- is traversable on the opening 'memory' frequency (mask 20 = memory bit2 +
-- architecture bit4; homes broadcast full 127). Edge permeability {memory,
-- architecture}=1 → on-vector everywhere for P0.
--
-- RE-TUNE (§2): the diamond was knife-edge for a 2-world Hamiltonian path; the ring
-- needs more Aufenthaltsfenster and Bandbreite so a run can reach 2–3 worlds and
-- gamble on a core shortcut home. Tightened further by playtest.
--
-- Behind drift_p0_enabled — the gate is unchanged; this only reshapes the chart.


-- ═══════════════════════════════════════════════════════════════════
-- 1. Re-tune the Zahlenwerk for the bigger map (drift_tuning is the DATA home)
-- ═══════════════════════════════════════════════════════════════════
-- UPDATE (not INSERT … ON CONFLICT) — 246 already seeded these keys; we move the
-- defaults to the ring scale. The other scalars (DZ teeth, deep surge, survey
-- values, foreign-dock bonus, Notfrequenz cost) stay as 246 set them.

UPDATE drift_tuning SET value = '8'::jsonb
 WHERE setting_key = 'window_base';   -- was 6: a ring run wants 2–3 worlds + a shortcut home

UPDATE drift_tuning SET value = '{"1": 11, "2": 15, "3": 19, "4": 23}'::jsonb
 WHERE setting_key = 'bandwidth_class_bb_max';   -- was {1:6…}: more hops, Notfrequenz still bites on a greedy route


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_generate_drift_chart(seed, generator_version) — the region generator
-- ═══════════════════════════════════════════════════════════════════
-- Backend/system class (NOT a player RPC): no auth.uid() guard, REVOKE from
-- anon/authenticated, GRANT service_role only (the 245 ADR-006 lesson). Emits a new
-- chart_version > all existing ones; returns a {version, nodes, edges} summary.

CREATE OR REPLACE FUNCTION public.fn_generate_drift_chart(
    p_seed              BIGINT DEFAULT NULL,
    p_generator_version TEXT   DEFAULT 'p0b-ring-core-1'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version   INT;
    v_n         INT;
    v_radius    NUMERIC := 1200;            -- home ring radius (chart units; camera auto-frames)
    v_inter_arc NUMERIC := 1.16;            -- push interstitials onto a slightly larger arc
    v_perm      JSONB := '{"memory": 1, "architecture": 1}'::jsonb;  -- P0 pair: on-vector
    v_mask      INT := 20;                  -- memory(bit2=4) + architecture(bit4=16) Bleed tissue
    v_core_id   UUID;
    v_inter     UUID;
    v_nodes     INT;
    v_edges     INT;
    rec         RECORD;
BEGIN
    SELECT count(*) INTO v_n
      FROM simulations
     WHERE status = 'active' AND simulation_type = 'template';
    IF v_n < 2 THEN
        RAISE EXCEPTION 'fn_generate_drift_chart: need >= 2 active template sims, found %', v_n
            USING ERRCODE = '22023';
    END IF;

    -- New, higher chart version (immutable history; in-flight runs keep their pinned version).
    SELECT COALESCE(max(version), 0) + 1 INTO v_version FROM chart_versions;
    INSERT INTO chart_versions (version, seed, generator_version)
    VALUES (v_version, COALESCE(p_seed, v_version * 7919), p_generator_version);

    -- HOMES: one broadcast_rand per active world, on a ring in deterministic sim order.
    -- uq_chart_home_node (246) guarantees exactly one home per sim per version.
    INSERT INTO drift_chart_nodes (
        chart_version, stable_key, node_kind, node_type, simulation_id,
        x, y, frequency_mask, region_cell, distance_band
    )
    SELECT v_version, 'home-' || w.slug, 'seeded', 'broadcast_rand', w.id,
           round((v_radius * cos(2 * pi() * w.idx / v_n))::numeric, 2),
           round((v_radius * sin(2 * pi() * w.idx / v_n))::numeric, 2),
           127, 'r0', 'near'
      FROM (
          SELECT id, slug, row_number() OVER (ORDER BY created_at, id) - 1 AS idx
            FROM simulations
           WHERE status = 'active' AND simulation_type = 'template'
      ) w;

    -- TIEFDRIFT CORE: the dangerous centre (deep band, surge-prone) — the shortcut hub.
    INSERT INTO drift_chart_nodes (
        chart_version, stable_key, node_kind, node_type,
        x, y, frequency_mask, region_cell, distance_band
    )
    VALUES (v_version, 'tiefdrift-core', 'seeded', 'interstitial',
            0, 0, v_mask, 'r0', 'deep')
    RETURNING id INTO v_core_id;

    -- RING segments: for each home `a` and its ring-successor `b` ((idx+1) mod n),
    -- a mid-band interstitial between them (the safe corridor) + a deep spoke a→core.
    FOR rec IN
        WITH homes AS (
            SELECT n.id, n.x, n.y,
                   row_number() OVER (ORDER BY s.created_at, s.id) - 1 AS idx
              FROM drift_chart_nodes n
              JOIN simulations s ON s.id = n.simulation_id
             WHERE n.chart_version = v_version AND n.node_type = 'broadcast_rand'
        )
        SELECT a.id AS a_id, a.x AS a_x, a.y AS a_y, a.idx AS a_idx,
               b.id AS b_id, b.x AS b_x, b.y AS b_y
          FROM homes a
          JOIN homes b ON b.idx = (a.idx + 1) % v_n
         ORDER BY a.idx
    LOOP
        INSERT INTO drift_chart_nodes (
            chart_version, stable_key, node_kind, node_type,
            x, y, frequency_mask, region_cell, distance_band
        )
        VALUES (
            v_version, 'ring-' || rec.a_idx, 'seeded', 'interstitial',
            round((((rec.a_x + rec.b_x) / 2) * v_inter_arc)::numeric, 2),
            round((((rec.a_y + rec.b_y) / 2) * v_inter_arc)::numeric, 2),
            v_mask, 'r0', 'mid'
        )
        RETURNING id INTO v_inter;

        -- Safe corridor (cheap weight-1, Strömungsband): home → interstitial → next home.
        INSERT INTO drift_chart_edges (chart_version, from_node, to_node, weight, permeability, corridor)
        VALUES (v_version, rec.a_id, v_inter, 1, v_perm, true),
               (v_version, v_inter, rec.b_id, 1, v_perm, true);

        -- Deep spoke (weight-3, open Drift): this home → the Tiefdrift core (risky shortcut).
        INSERT INTO drift_chart_edges (chart_version, from_node, to_node, weight, permeability, corridor)
        VALUES (v_version, rec.a_id, v_core_id, 3, v_perm, false);
    END LOOP;

    SELECT count(*) INTO v_nodes FROM drift_chart_nodes WHERE chart_version = v_version;
    SELECT count(*) INTO v_edges FROM drift_chart_edges WHERE chart_version = v_version;

    PERFORM travel_audit(NULL, 'travel_chart_generate', 'chart_version', NULL, NULL,
        jsonb_build_object('version', v_version, 'worlds', v_n,
                           'nodes', v_nodes, 'edges', v_edges,
                           'generator', p_generator_version));

    RETURN jsonb_build_object('version', v_version, 'worlds', v_n,
                              'nodes', v_nodes, 'edges', v_edges);
END;
$$;

COMMENT ON FUNCTION public.fn_generate_drift_chart(BIGINT, TEXT) IS
    'Generate a fresh DRIFT chart_version from the CURRENT active template sims: a ring of broadcast_rand homes + mid-band Stroemungsband interstitials (cheap corridors) + a central Tiefdrift core with deep weight-3 spokes (risky shortcut). Emits version = max(version)+1 so it supersedes prior charts via fn_travel_run_open''s max(version) lookup; re-run picks up newly published worlds. System/admin class — service_role only.';

-- ADR-006 grant posture (245 lesson): explicit revoke from anon + authenticated,
-- not just PUBLIC; service_role only (the backend calls it via the admin client).
REVOKE ALL    ON FUNCTION public.fn_generate_drift_chart(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_drift_chart(BIGINT, TEXT) TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- 3. Generate the first all-worlds chart now (guarded → re-apply is a no-op)
-- ═══════════════════════════════════════════════════════════════════
-- On a fresh apply: 247 seeded v1 (the diamond), this emits v2 (all worlds), and
-- max(version)=2 becomes the active chart. Guarded on "no generated chart yet" so a
-- manual re-run of this block never stacks versions (the migration runner won't
-- re-run an applied migration; this is belt-and-suspenders).

DO $gen$
BEGIN
    IF EXISTS (SELECT 1 FROM chart_versions WHERE generator_version LIKE 'p0b-%') THEN
        RAISE NOTICE 'DRIFT 248: a generated chart already exists — skipping initial generation';
    ELSIF (SELECT count(*) FROM simulations WHERE status = 'active' AND simulation_type = 'template') < 2 THEN
        RAISE NOTICE 'DRIFT 248: fewer than 2 active template sims — skipping initial generation';
    ELSE
        PERFORM fn_generate_drift_chart();
        RAISE NOTICE 'DRIFT 248: generated the all-worlds ring chart (supersedes the diamond)';
    END IF;
END $gen$;
