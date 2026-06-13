-- Migration 247: DRIFT — travel_seed (P0 minimal chart region)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.8 (seed), §8.3 (P0 region),
--       §19 (scope anchor: Velgarien ↔ The Gaslit Reach). Behind drift_p0_enabled.
--
-- The hand-seeded P0 chart for the first playable loop. A DIAMOND between the two
-- home broadcast edges so there is a real route DECISION (the core of the resource
-- game), not just a there-and-back line:
--   * the safe Strömungsband CORRIDOR (north arc): 4 cheap weight-1 hops — low
--     Bandbreite per move but more moves, so Dissonanz accumulates.
--   * the TIEFDRIFT shortcut (south): 2 expensive weight-3 deep crossings — fast,
--     but it burns Bandbreite hard (→ Notfrequenz → Kohärenz bleed under a tight BB).
-- A traveler can go out one way and home the other; with scarce BB it is a genuine
-- BB-vs-Dissonanz-vs-risk calculus. The deterministic region generator (P0b)
-- supersedes this via a higher chart_version (fn_travel_run_open uses max(version)).
--
-- DELIBERATELY NOT here (deferred to their callers, §3.8): pack quest-templates,
-- platform prompt_templates + their ai_budget rows — the quest/narrative slice (P0c).
--
-- Env-robust + idempotent (244 lesson): sims resolved by stable slug, no hardcoded
-- UUIDs; the whole seed no-ops if the canon sims are absent or chart_version 1 exists.

DO $seed$
DECLARE
    v_velg   UUID;
    v_gaslit UUID;
    v_vh UUID; v_gh UUID; v_west UUID; v_relais UUID; v_ost UUID; v_deep UUID;
    v_perm JSONB := '{"memory":1,"architecture":1}'::jsonb;  -- P0 pair: on-vector
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

    -- Two dockable homes (broadcast_rand — one per sim, respecting uq_chart_home_node).
    -- frequency_mask 127 = full broadcast on the homes; 20 = memory(4)+architecture(16)
    -- on the Bleed tissue. distance_band drives Dissonanz/move (near 1 / mid 2 / deep 3).
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, simulation_id, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'velgarien-home', 'seeded', 'broadcast_rand', v_velg,     0, 0, 127, 'r0', 'near') RETURNING id INTO v_vh;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, simulation_id, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'gaslit-home',    'seeded', 'broadcast_rand', v_gaslit, 1200, 0, 127, 'r0', 'near') RETURNING id INTO v_gh;
    -- Corridor arc (north): cheap weight-1 Strömungsband, distance mid.
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'stroemung-west', 'seeded', 'interstitial', 320, -210, 20, 'r0', 'mid') RETURNING id INTO v_west;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'relais-mitte',   'seeded', 'relais',       600, -300, 20, 'r0', 'mid') RETURNING id INTO v_relais;
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'stroemung-ost',  'seeded', 'interstitial', 880, -210, 20, 'r0', 'mid') RETURNING id INTO v_ost;
    -- Tiefdrift shortcut (south): the deep Drift — distance deep (Dissonanz +3/move).
    INSERT INTO drift_chart_nodes (chart_version, stable_key, node_kind, node_type, x, y, frequency_mask, region_cell, distance_band)
    VALUES (1, 'tiefdrift',      'seeded', 'interstitial', 600, 300, 20, 'r0', 'deep') RETURNING id INTO v_deep;

    -- Corridor route (4 × weight-1, corridor=true): cheap BB, more moves → more DZ.
    INSERT INTO drift_chart_edges (chart_version, from_node, to_node, weight, permeability, corridor) VALUES
        (1, v_vh,     v_west,   1, v_perm, true),
        (1, v_west,   v_relais, 1, v_perm, true),
        (1, v_relais, v_ost,    1, v_perm, true),
        (1, v_ost,    v_gh,     1, v_perm, true);
    -- Tiefdrift shortcut (2 × weight-3, open Drift): few moves, heavy BB cost.
    INSERT INTO drift_chart_edges (chart_version, from_node, to_node, weight, permeability, corridor) VALUES
        (1, v_vh,   v_deep, 3, v_perm, false),
        (1, v_deep, v_gh,   3, v_perm, false);

    RAISE NOTICE 'DRIFT 247: seeded chart_version 1 — Velgarien<->Gaslit diamond (corridor + tiefdrift), 6 nodes, 6 edges';
END $seed$;
