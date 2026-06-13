-- Migration 247: DRIFT — travel_seed (P0 minimal chart region)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.8 (seed), §8.3 (P0 region),
--       §19 (scope anchor: Velgarien ↔ The Gaslit Reach, frequency pair
--       memory/architecture). Behind drift_p0_enabled=false (chart topology is
--       public-read by the public-first contract; the *game* is gated in the backend).
--
-- This is the HAND-SEEDED P0 chart — just enough topology for the first playable
-- loop "open at home → drift across the chart → dock / return". The deterministic
-- region generator (the §8.3 region as generator output, a new chart_version via
-- fn_apply_chart_version) is P0b and supersedes this by adding a higher version;
-- fn_travel_run_open resolves the active chart as max(version), so the generator's
-- output takes over cleanly when it lands.
--
-- DELIBERATELY NOT here (deferred to their callers, §3.8): pack-generated
-- quest-template rows, platform-default prompt_templates (travel_narrative /
-- dispatch_flavor) + their ai_budget purpose rows — they belong with the quest /
-- narrative slice (P0c), not the movement loop.
--
-- Env-robust + idempotent (the 244 lesson): sims are resolved by stable slug (no
-- hardcoded UUIDs); the whole seed no-ops if the canon sims are absent (a fresh /
-- CI DB without world data) or if chart_version 1 already exists.

DO $seed$
DECLARE
    v_velg   UUID;
    v_gaslit UUID;
    v_vh UUID; v_gh UUID; v_c1 UUID; v_deep UUID; v_c2 UUID;
BEGIN
    SELECT id INTO v_velg   FROM simulations WHERE slug = 'velgarien';
    SELECT id INTO v_gaslit FROM simulations WHERE slug = 'the-gaslit-reach';
    IF v_velg IS NULL OR v_gaslit IS NULL THEN
        RAISE NOTICE 'DRIFT 247: canon sims (velgarien / the-gaslit-reach) absent — skipping chart seed';
        RETURN;
    END IF;
    IF EXISTS (SELECT 1 FROM chart_versions WHERE version = 1) THEN
        RAISE NOTICE 'DRIFT 247: chart_version 1 already seeded — skipping';
        RETURN;
    END IF;

    INSERT INTO chart_versions (version, seed, generator_version)
    VALUES (1, 47, 'p0-handseed-247');

    -- Two dockable homes (broadcast_rand — exactly one per sim, respecting
    -- uq_chart_home_node from 246), linked by a 3-node corridor that dips through
    -- the deep Drift at its midpoint (near → mid → deep → mid → near = the full
    -- Dissonanz band ladder, §2.1). Coordinates are the server-generated layout the
    -- renderer reads (§8.1); a single region_cell for P0 (paging is §14.4 / P0b).
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, simulation_id, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'velgarien-home', 'seeded', 'broadcast_rand', v_velg,    0, 0, 127, 'r0', 'near') RETURNING id INTO v_vh;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, simulation_id, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'gaslit-home',    'seeded', 'broadcast_rand', v_gaslit, 1200, 0, 127, 'r0', 'near') RETURNING id INTO v_gh;
    -- frequency_mask 20 = memory(bit2=4) + architecture(bit4=16): the P0 pair tissue.
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'stroemung-west', 'seeded', 'interstitial', 300,  40, 20, 'r0', 'mid')  RETURNING id INTO v_c1;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'tiefdrift',      'seeded', 'interstitial', 600, -30, 20, 'r0', 'deep') RETURNING id INTO v_deep;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'stroemung-ost',  'seeded', 'interstitial', 900,  20, 20, 'r0', 'mid')  RETURNING id INTO v_c2;

    -- Edges: Strömungsband (corridor=true, weight 1) near each home; open deep Drift
    -- (weight 2) across the middle. Permeable on the P0 pair memory+architecture, so a
    -- traveler tuned to either crosses on-vector (BB cost = weight × 1).
    INSERT INTO drift_chart_edges (chart_version, from_node, to_node, weight, permeability, corridor) VALUES
        (1, v_vh,   v_c1,   1, '{"memory":1,"architecture":1}'::jsonb, true),
        (1, v_c1,   v_deep, 2, '{"memory":1,"architecture":1}'::jsonb, false),
        (1, v_deep, v_c2,   2, '{"memory":1,"architecture":1}'::jsonb, false),
        (1, v_c2,   v_gh,   1, '{"memory":1,"architecture":1}'::jsonb, true);

    RAISE NOTICE 'DRIFT 247: seeded chart_version 1 — Velgarien <-> Gaslit, 5 nodes, 4 edges';
END $seed$;
