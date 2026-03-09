-- =============================================================================
-- 015: Epoch Demo Data — Competitive Layer (Enriched)
-- =============================================================================
-- Populates all 6 competitive tables with realistic, player-attributed demo
-- data for the "Convergence Protocol" epoch featuring all 4 simulations.
--
-- Bug #22 fix: All gameplay data now references game instance simulations
-- (simulation_type='game_instance') rather than template simulation IDs.
-- This matches the real epoch lifecycle where clone_simulations_for_epoch()
-- creates game instances before competition starts.
--
-- 21 missions (5-6 per player), 30 battle log entries, event-driven scores.
-- Each mission is explicitly assigned to a player's simulation.
--
-- Template Simulation IDs (used for agent/zone/embassy lookups):
--   Velgarien:        10000000-0000-0000-0000-000000000001
--   The Gaslit Reach: 20000000-0000-0000-0000-000000000001
--   Station Null:     30000000-0000-0000-0000-000000000001
--   Speranza:         40000000-0000-0000-0000-000000000001
--
-- Game Instance IDs (used for all gameplay data):
--   Velgarien [Epoch]:        e1000000-0000-0000-0000-000000000001
--   The Gaslit Reach [Epoch]: e1000000-0000-0000-0000-000000000002
--   Station Null [Epoch]:     e1000000-0000-0000-0000-000000000003
--   Speranza [Epoch]:         e1000000-0000-0000-0000-000000000004
--
-- Player UUIDs (from seed 014):
--   Admin:  00000000-0000-0000-0000-000000000001
--   P1:     00000000-0000-0000-0000-000000000002 (Velgarien)
--   P2:     00000000-0000-0000-0000-000000000003 (Gaslit Reach)
--   P3:     00000000-0000-0000-0000-000000000004 (Station Null)
--   P4:     00000000-0000-0000-0000-000000000005 (Speranza)
-- =============================================================================

DO $$
DECLARE
    v_epoch_id      UUID := 'e0000001-0000-0000-0000-000000000001';
    v_team_id       UUID := 'e0000002-0000-0000-0000-000000000001';
    v_dev_user      UUID := '00000000-0000-0000-0000-000000000001';
    v_p1            UUID := '00000000-0000-0000-0000-000000000002';
    v_p2            UUID := '00000000-0000-0000-0000-000000000003';
    v_p3            UUID := '00000000-0000-0000-0000-000000000004';
    v_p4            UUID := '00000000-0000-0000-0000-000000000005';
    -- Template simulation IDs (for agent/zone/embassy lookups)
    v_velgarien     UUID := '10000000-0000-0000-0000-000000000001';
    v_gaslit_reach  UUID := '20000000-0000-0000-0000-000000000001';
    v_station_null  UUID := '30000000-0000-0000-0000-000000000001';
    v_speranza      UUID := '40000000-0000-0000-0000-000000000001';
    -- Game instance simulation IDs (for all gameplay data)
    v_gi_velgarien      UUID := 'e1000000-0000-0000-0000-000000000001';
    v_gi_gaslit_reach   UUID := 'e1000000-0000-0000-0000-000000000002';
    v_gi_station_null   UUID := 'e1000000-0000-0000-0000-000000000003';
    v_gi_speranza       UUID := 'e1000000-0000-0000-0000-000000000004';
    v_starts_at     TIMESTAMPTZ := now() - INTERVAL '5 days';
    v_ends_at       TIMESTAMPTZ := now() - INTERVAL '5 days' + INTERVAL '14 days';
    -- Agent IDs (looked up below from templates)
    v_agent_viktor      UUID;
    v_agent_elena       UUID;
    v_agent_aldric      UUID;
    v_agent_lena        UUID;
    v_agent_whiskers    UUID;
    v_agent_mossback    UUID;
    v_agent_barnaby     UUID;
    v_agent_vasquez     UUID;
    v_agent_tanaka      UUID;
    v_agent_haven       UUID;
    v_agent_kowalski    UUID;
    v_agent_rosa        UUID;
    v_agent_celeste     UUID;
    v_agent_enzo        UUID;
    -- Embassy IDs (looked up below from templates)
    v_emb_vel_cap   UUID;
    v_emb_vel_spe   UUID;
    v_emb_sn_cap    UUID;
    v_emb_sn_spe    UUID;
    v_emb_sn_vel    UUID;
    v_emb_spe_cap   UUID;
    -- Zone IDs (deterministic, from templates)
    v_zone_altstadt         UUID := 'a0000003-0000-0000-0000-000000000001';
    v_zone_regierung        UUID := 'a0000001-0000-0000-0000-000000000001';
    v_zone_upper_caverns    UUID := 'a0000004-0000-0000-0000-000000000001';
    v_zone_fungal_warrens   UUID := 'a0000005-0000-0000-0000-000000000001';
    v_zone_command_deck     UUID := 'a0000008-0000-0000-0000-000000000001';
    v_zone_science_wing     UUID := 'a0000009-0000-0000-0000-000000000001';
    v_zone_habitation_ring  UUID := 'a000000b-0000-0000-0000-000000000001';
    v_zone_hub              UUID := 'a000000c-0000-0000-0000-000000000001';
    v_zone_workshops        UUID := 'a000000d-0000-0000-0000-000000000001';
    v_zone_topside          UUID := 'a000000f-0000-0000-0000-000000000001';
    -- Mission IDs (deterministic for battle_log references)
    v_m1   UUID := 'e0000010-0000-0000-0000-000000000001';
    v_m2   UUID := 'e0000010-0000-0000-0000-000000000002';
    v_m3   UUID := 'e0000010-0000-0000-0000-000000000003';
    v_m4   UUID := 'e0000010-0000-0000-0000-000000000004';
    v_m5   UUID := 'e0000010-0000-0000-0000-000000000005';
    v_m6   UUID := 'e0000010-0000-0000-0000-000000000006';
    v_m7   UUID := 'e0000010-0000-0000-0000-000000000007';
    v_m8   UUID := 'e0000010-0000-0000-0000-000000000008';
    v_m9   UUID := 'e0000010-0000-0000-0000-000000000009';
    v_m10  UUID := 'e0000010-0000-0000-0000-00000000000a';
    v_m11  UUID := 'e0000010-0000-0000-0000-00000000000b';
    v_m12  UUID := 'e0000010-0000-0000-0000-00000000000c';
    v_m13  UUID := 'e0000010-0000-0000-0000-00000000000d';
    v_m14  UUID := 'e0000010-0000-0000-0000-00000000000e';
    v_m15  UUID := 'e0000010-0000-0000-0000-00000000000f';
    v_m16  UUID := 'e0000010-0000-0000-0000-000000000010';
    v_m17  UUID := 'e0000010-0000-0000-0000-000000000011';
    v_m18  UUID := 'e0000010-0000-0000-0000-000000000012';
    v_m19  UUID := 'e0000010-0000-0000-0000-000000000013';
    v_m20  UUID := 'e0000010-0000-0000-0000-000000000014';
    v_m21  UUID := 'e0000010-0000-0000-0000-000000000015';
BEGIN
    -- Skip if epoch already exists (idempotent)
    IF EXISTS (SELECT 1 FROM game_epochs WHERE id = v_epoch_id) THEN
        RAISE NOTICE 'Epoch demo data already exists, skipping.';
        RETURN;
    END IF;

    -- =========================================================================
    -- Look up agent IDs by name (from TEMPLATE simulations)
    -- =========================================================================
    SELECT id INTO v_agent_viktor FROM agents WHERE name = 'Viktor Harken' AND simulation_id = v_velgarien;
    SELECT id INTO v_agent_elena FROM agents WHERE name = 'Elena Voss' AND simulation_id = v_velgarien;
    SELECT id INTO v_agent_aldric FROM agents WHERE name = 'General Aldric Wolf' AND simulation_id = v_velgarien;
    SELECT id INTO v_agent_lena FROM agents WHERE name = 'Lena Kray' AND simulation_id = v_velgarien;
    SELECT id INTO v_agent_whiskers FROM agents WHERE name = 'Commodore Harrowgate' AND simulation_id = v_gaslit_reach;
    SELECT id INTO v_agent_mossback FROM agents WHERE name = 'Archivist Quill' AND simulation_id = v_gaslit_reach;
    SELECT id INTO v_agent_barnaby FROM agents WHERE name = 'Obediah Crook' AND simulation_id = v_gaslit_reach;
    SELECT id INTO v_agent_vasquez FROM agents WHERE name = 'Commander Elena Vasquez' AND simulation_id = v_station_null;
    SELECT id INTO v_agent_tanaka FROM agents WHERE name = 'Dr. Yuki Tanaka' AND simulation_id = v_station_null;
    SELECT id INTO v_agent_haven FROM agents WHERE name = 'HAVEN' AND simulation_id = v_station_null;
    SELECT id INTO v_agent_kowalski FROM agents WHERE name = 'Engineer Jan Kowalski' AND simulation_id = v_station_null;
    SELECT id INTO v_agent_rosa FROM agents WHERE name = 'Capitana Rosa Ferretti' AND simulation_id = v_speranza;
    SELECT id INTO v_agent_celeste FROM agents WHERE name = 'Celeste Amara' AND simulation_id = v_speranza;
    SELECT id INTO v_agent_enzo FROM agents WHERE name = 'Enzo Moretti' AND simulation_id = v_speranza;

    -- =========================================================================
    -- Look up embassy IDs (from TEMPLATE simulations)
    -- =========================================================================
    SELECT id INTO v_emb_vel_cap FROM embassies WHERE simulation_a_id = v_velgarien AND simulation_b_id = v_gaslit_reach;
    SELECT id INTO v_emb_vel_spe FROM embassies WHERE simulation_a_id = v_velgarien AND simulation_b_id = v_speranza;
    SELECT id INTO v_emb_sn_cap FROM embassies WHERE simulation_a_id = v_station_null AND simulation_b_id = v_gaslit_reach;
    SELECT id INTO v_emb_sn_spe FROM embassies WHERE simulation_a_id = v_station_null AND simulation_b_id = v_speranza;
    SELECT id INTO v_emb_sn_vel FROM embassies WHERE simulation_a_id = v_station_null AND simulation_b_id = v_velgarien;
    SELECT id INTO v_emb_spe_cap FROM embassies WHERE simulation_a_id = v_speranza AND simulation_b_id = v_gaslit_reach;

    -- =========================================================================
    -- 1. GAME EPOCH
    -- =========================================================================
    INSERT INTO game_epochs (id, name, description, created_by_id, starts_at, ends_at, current_cycle, status, config)
    VALUES (
        v_epoch_id,
        'The Convergence Protocol',
        'The boundaries between worlds grow thin. Four civilizations compete for dominance as the fabric of the multiverse trembles. Resource points flow to those who dare — and to those who endure.',
        v_dev_user,
        v_starts_at,
        v_ends_at,
        7,
        'competition',
        jsonb_build_object(
            'duration_days', 14,
            'cycle_hours', 8,
            'rp_per_cycle', 10,
            'rp_cap', 30,
            'foundation_pct', 20,
            'reckoning_pct', 15,
            'max_team_size', 3,
            'allow_betrayal', true,
            'score_weights', jsonb_build_object(
                'stability', 25,
                'influence', 20,
                'sovereignty', 20,
                'diplomatic', 15,
                'military', 20
            ),
            'referee_mode', false,
            'instance_mapping', jsonb_build_array(
                jsonb_build_object(
                    'template_id', v_velgarien,
                    'instance_id', v_gi_velgarien,
                    'slug', 'velgarien-e1',
                    'name', 'Velgarien (Epoch 1)'
                ),
                jsonb_build_object(
                    'template_id', v_gaslit_reach,
                    'instance_id', v_gi_gaslit_reach,
                    'slug', 'the-gaslit-reach-e1',
                    'name', 'The Gaslit Reach (Epoch 1)'
                ),
                jsonb_build_object(
                    'template_id', v_station_null,
                    'instance_id', v_gi_station_null,
                    'slug', 'station-null-e1',
                    'name', 'Station Null (Epoch 1)'
                ),
                jsonb_build_object(
                    'template_id', v_speranza,
                    'instance_id', v_gi_speranza,
                    'slug', 'speranza-e1',
                    'name', 'Speranza (Epoch 1)'
                )
            )
        )
    );

    -- =========================================================================
    -- 2. GAME INSTANCE SIMULATIONS
    --    Lightweight clones of templates for epoch gameplay.
    --    In production, clone_simulations_for_epoch() creates these with full
    --    entity cloning. For seed data, we create minimal simulation rows and
    --    reference template agents/zones/embassies directly (FKs allow this).
    -- =========================================================================
    INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id, simulation_type, source_template_id, epoch_id)
    VALUES
        (v_gi_velgarien,    'Velgarien (Epoch 1)',        'velgarien-e1',          'Game instance of Velgarien for The Convergence Protocol', 'dark_fantasy', 'active', 'en', v_dev_user, 'game_instance', v_velgarien,    v_epoch_id),
        (v_gi_gaslit_reach, 'The Gaslit Reach (Epoch 1)', 'the-gaslit-reach-e1',   'Game instance of The Gaslit Reach for The Convergence Protocol', 'gothic',       'active', 'en', v_dev_user, 'game_instance', v_gaslit_reach, v_epoch_id),
        (v_gi_station_null, 'Station Null (Epoch 1)',     'station-null-e1',       'Game instance of Station Null for The Convergence Protocol', 'sci_fi',       'active', 'en', v_dev_user, 'game_instance', v_station_null, v_epoch_id),
        (v_gi_speranza,     'Speranza (Epoch 1)',         'speranza-e1',           'Game instance of Speranza for The Convergence Protocol', 'post_apocalyptic', 'active', 'en', v_dev_user, 'game_instance', v_speranza,     v_epoch_id)
    ON CONFLICT (id) DO NOTHING;

    -- Game instance members (players need membership for RLS)
    INSERT INTO simulation_members (simulation_id, user_id, member_role) VALUES
        (v_gi_velgarien,    v_p1, 'owner'),
        (v_gi_gaslit_reach, v_p2, 'owner'),
        (v_gi_station_null, v_p3, 'owner'),
        (v_gi_speranza,     v_p4, 'owner')
    ON CONFLICT (simulation_id, user_id) DO NOTHING;

    -- =========================================================================
    -- 3. EPOCH TEAM — "The Northern Pact" (Velgarien + Station Null)
    --    References game instance IDs, not templates.
    -- =========================================================================
    INSERT INTO epoch_teams (id, epoch_id, name, created_by_simulation_id)
    VALUES (v_team_id, v_epoch_id, 'The Northern Pact', v_gi_velgarien);

    -- =========================================================================
    -- 4. EPOCH PARTICIPANTS (all 4 game instances)
    -- =========================================================================
    INSERT INTO epoch_participants (epoch_id, simulation_id, user_id, team_id, joined_at, current_rp, last_rp_grant_at) VALUES
        -- Velgarien: 18 RP, in Northern Pact (builder archetype)
        (v_epoch_id, v_gi_velgarien,    v_p1, v_team_id, v_starts_at - INTERVAL '1 day',  18, now() - INTERVAL '2 hours'),
        -- The Gaslit Reach: 22 RP, no team (diplomat archetype)
        (v_epoch_id, v_gi_gaslit_reach, v_p2, NULL,      v_starts_at - INTERVAL '1 day',  22, now() - INTERVAL '4 hours'),
        -- Station Null: 8 RP, in Northern Pact (shadow archetype)
        (v_epoch_id, v_gi_station_null, v_p3, v_team_id, v_starts_at - INTERVAL '12 hours', 8, now() - INTERVAL '6 hours'),
        -- Speranza: 15 RP, lone wolf (opportunist archetype)
        (v_epoch_id, v_gi_speranza,     v_p4, NULL,      v_starts_at - INTERVAL '6 hours', 15, now() - INTERVAL '1 hour');

    -- =========================================================================
    -- 5. OPERATIVE MISSIONS (21 missions, player-attributed)
    --    source_simulation_id/target_simulation_id use game instance IDs.
    --    agent_id/embassy_id/target_zone_id reference template entities (valid FKs).
    -- =========================================================================

    -- === VELGARIEN (6 missions: P1) ===

    -- M1: Elena Voss spy → Gaslit Reach (active, c6, via embassy)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m1, v_epoch_id, v_agent_elena, 'spy', v_gi_velgarien, v_gi_gaslit_reach, v_emb_vel_cap, v_zone_upper_caverns, 'active', 3, 0.65, now() - INTERVAL '8 hours', now() + INTERVAL '16 hours');

    -- M2: Lena Kray spy → Speranza (captured in c4)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m2, v_epoch_id, v_agent_lena, 'spy', v_gi_velgarien, v_gi_speranza, v_emb_vel_spe, v_zone_workshops, 'captured', 3, 0.35, v_starts_at + INTERVAL '28 hours', v_starts_at + INTERVAL '36 hours', v_starts_at + INTERVAL '32 hours',
        '{"outcome": "captured", "narrative": "Lena Kray was identified by Speranza guardians while photographing Workshop defenses. She is being held under armed guard.", "detected_by": null}'::jsonb);

    -- M3: Gen. Aldric Wolf guardian (domestic, c3, active)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m3, v_epoch_id, v_agent_aldric, 'guardian', v_gi_velgarien, NULL, NULL, v_zone_regierung, 'active', 3, NULL, v_starts_at + INTERVAL '20 hours', now() + INTERVAL '360 days');

    -- M4: Viktor Harken propagandist → Station Null (failed in c5)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m4, v_epoch_id, v_agent_viktor, 'propagandist', v_gi_velgarien, v_gi_station_null, v_emb_sn_vel, v_zone_command_deck, 'failed', 4, 0.40, v_starts_at + INTERVAL '20 hours', v_starts_at + INTERVAL '36 hours', v_starts_at + INTERVAL '38 hours',
        '{"outcome": "failed", "narrative": "Viktor Harken''s broadcasts were jammed by HAVEN''s automated defense systems. The propaganda campaign fizzled before reaching Station Null''s crew.", "event_created_id": null}'::jsonb);

    -- M5: Lena Kray spy → Speranza (2nd deployment, c5, active)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m5, v_epoch_id, v_agent_lena, 'spy', v_gi_velgarien, v_gi_speranza, v_emb_vel_spe, v_zone_hub, 'active', 3, 0.50, v_starts_at + INTERVAL '40 hours', now() + INTERVAL '10 hours');

    -- M6: Elena Voss saboteur → Gaslit Reach (deploying, c7)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m6, v_epoch_id, v_agent_elena, 'saboteur', v_gi_velgarien, v_gi_gaslit_reach, v_emb_vel_cap, v_zone_fungal_warrens, 'deploying', 5, 0.45, now() - INTERVAL '3 hours', now() + INTERVAL '21 hours');

    -- === THE GASLIT REACH (6 missions: P2) ===

    -- M7: Cmdr. Whiskers infiltrator → Station Null (success c5, via embassy)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m7, v_epoch_id, v_agent_whiskers, 'infiltrator', v_gi_gaslit_reach, v_gi_station_null, v_emb_sn_cap, v_zone_habitation_ring, 'success', 6, 0.60, v_starts_at + INTERVAL '28 hours', v_starts_at + INTERVAL '40 hours', v_starts_at + INTERVAL '38 hours',
        '{"outcome": "success", "narrative": "Commodore Harrowgate infiltrated the Habitation Ring through maintenance tunnels, temporarily disrupting Station Null''s embassy communication relays.", "relationships_weakened": 1}'::jsonb);

    -- M8: Obediah Crook saboteur → Station Null (deploying, c7)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m8, v_epoch_id, v_agent_barnaby, 'saboteur', v_gi_gaslit_reach, v_gi_station_null, v_emb_sn_cap, v_zone_command_deck, 'deploying', 5, 0.40, now() - INTERVAL '2 hours', now() + INTERVAL '14 hours');

    -- M9: Archivist Quill spy → Velgarien (success c4)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m9, v_epoch_id, v_agent_mossback, 'spy', v_gi_gaslit_reach, v_gi_velgarien, v_emb_vel_cap, v_zone_altstadt, 'success', 3, 0.55, v_starts_at + INTERVAL '12 hours', v_starts_at + INTERVAL '28 hours', v_starts_at + INTERVAL '30 hours',
        '{"outcome": "success", "narrative": "Archivist Quill spent weeks cataloguing Velgarien''s Altstadt archives. The intelligence gathered reveals cracks in the Northern Pact''s supply lines.", "intel_gathered": true}'::jsonb);

    -- M10: Mossback guardian (domestic, c3, active)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m10, v_epoch_id, v_agent_mossback, 'guardian', v_gi_gaslit_reach, NULL, NULL, v_zone_upper_caverns, 'active', 3, NULL, v_starts_at + INTERVAL '22 hours', now() + INTERVAL '360 days');

    -- M11: Obediah Crook saboteur → Speranza (success c6)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m11, v_epoch_id, v_agent_barnaby, 'saboteur', v_gi_gaslit_reach, v_gi_speranza, v_emb_spe_cap, v_zone_workshops, 'success', 5, 0.50, v_starts_at + INTERVAL '36 hours', v_starts_at + INTERVAL '48 hours', v_starts_at + INTERVAL '46 hours',
        '{"outcome": "success", "narrative": "Obediah Crook sabotaged Speranza''s workshop power conduits. The resulting blackout disrupted repair operations for hours.", "infrastructure_damaged": true}'::jsonb);

    -- M12: Cmdr. Whiskers infiltrator → Velgarien (active, c6)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m12, v_epoch_id, v_agent_whiskers, 'infiltrator', v_gi_gaslit_reach, v_gi_velgarien, v_emb_vel_cap, v_zone_regierung, 'active', 6, 0.55, now() - INTERVAL '10 hours', now() + INTERVAL '14 hours');

    -- === STATION NULL (4 missions: P3) ===

    -- M13: Dr. Tanaka spy → Speranza (active, c6, via embassy)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m13, v_epoch_id, v_agent_tanaka, 'spy', v_gi_station_null, v_gi_speranza, v_emb_sn_spe, v_zone_hub, 'active', 3, 0.55, now() - INTERVAL '6 hours', now() + INTERVAL '18 hours');

    -- M14: HAVEN guardian (domestic, c3, active)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m14, v_epoch_id, v_agent_haven, 'guardian', v_gi_station_null, NULL, NULL, v_zone_science_wing, 'active', 3, NULL, v_starts_at + INTERVAL '20 hours', now() + INTERVAL '360 days');

    -- M15: Kowalski assassin → Gaslit Reach (deploying, c7)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m15, v_epoch_id, v_agent_kowalski, 'assassin', v_gi_station_null, v_gi_gaslit_reach, v_emb_sn_cap, v_zone_fungal_warrens, 'deploying', 8, 0.30, now() - INTERVAL '4 hours', now() + INTERVAL '44 hours');

    -- M16: Vasquez propagandist → Velgarien (active, c6)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m16, v_epoch_id, v_agent_vasquez, 'propagandist', v_gi_station_null, v_gi_velgarien, v_emb_sn_vel, v_zone_altstadt, 'active', 4, 0.60, now() - INTERVAL '7 hours', now() + INTERVAL '17 hours');

    -- === SPERANZA (5 missions: P4) ===

    -- M17: Celeste Amara propagandist → Velgarien (success c4)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m17, v_epoch_id, v_agent_celeste, 'propagandist', v_gi_speranza, v_gi_velgarien, v_emb_vel_spe, v_zone_altstadt, 'success', 4, 0.70, v_starts_at + INTERVAL '24 hours', v_starts_at + INTERVAL '36 hours', v_starts_at + INTERVAL '34 hours',
        '{"outcome": "success", "narrative": "Celeste Amara''s carefully crafted broadcasts from the Velgarien embassy penetrated deep into Altstadt, sowing seeds of doubt about the Northern Pact''s true intentions.", "event_created_id": null}'::jsonb);

    -- M18: Rosa guardian (domestic, c2, active)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m18, v_epoch_id, v_agent_rosa, 'guardian', v_gi_speranza, NULL, NULL, v_zone_topside, 'active', 3, NULL, v_starts_at + INTERVAL '14 hours', now() + INTERVAL '360 days');

    -- M19: Enzo Moretti infiltrator → Gaslit Reach (detected c6)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m19, v_epoch_id, v_agent_enzo, 'infiltrator', v_gi_speranza, v_gi_gaslit_reach, v_emb_spe_cap, v_zone_fungal_warrens, 'detected', 6, 0.45, v_starts_at + INTERVAL '28 hours', v_starts_at + INTERVAL '48 hours', v_starts_at + INTERVAL '46 hours',
        '{"outcome": "detected", "narrative": "Enzo Moretti was spotted by Gaslit Reach scouts in the Fungal Warrens. Though he escaped, his cover is blown and Speranza''s intentions are now suspect.", "detected_by": "counter-intel"}'::jsonb);

    -- M20: Celeste Amara spy → Station Null (failed c6)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at, resolved_at, mission_result)
    VALUES (v_m20, v_epoch_id, v_agent_celeste, 'spy', v_gi_speranza, v_gi_station_null, v_emb_sn_spe, v_zone_science_wing, 'failed', 3, 0.30, v_starts_at + INTERVAL '36 hours', v_starts_at + INTERVAL '48 hours', v_starts_at + INTERVAL '47 hours',
        '{"outcome": "failed", "narrative": "Celeste Amara''s espionage attempt was thwarted by HAVEN''s surveillance algorithms in the Science Wing. She returned empty-handed.", "detected_by": "guardian"}'::jsonb);

    -- M21: Enzo Moretti assassin → Velgarien (deploying, c7)
    INSERT INTO operative_missions (id, epoch_id, agent_id, operative_type, source_simulation_id, target_simulation_id, embassy_id, target_zone_id, status, cost_rp, success_probability, deployed_at, resolves_at)
    VALUES (v_m21, v_epoch_id, v_agent_enzo, 'assassin', v_gi_speranza, v_gi_velgarien, v_emb_vel_spe, v_zone_regierung, 'deploying', 8, 0.25, now() - INTERVAL '5 hours', now() + INTERVAL '43 hours');

    -- =========================================================================
    -- 6. EPOCH SCORES (cycles 1-7, event-driven variance)
    --    simulation_id references game instances, not templates.
    -- =========================================================================

    -- Velgarien: builder archetype. c5 drop from Speranza propaganda (c4), partial recovery c6
    INSERT INTO epoch_scores (epoch_id, simulation_id, cycle_number, stability_score, influence_score, sovereignty_score, diplomatic_score, military_score, composite_score, computed_at) VALUES
        (v_epoch_id, v_gi_velgarien, 1, 72.0, 45.0, 68.0, 55.0, 50.0, 59.75, v_starts_at + INTERVAL '8 hours'),
        (v_epoch_id, v_gi_velgarien, 2, 74.5, 48.0, 70.0, 58.0, 52.0, 61.93, v_starts_at + INTERVAL '16 hours'),
        (v_epoch_id, v_gi_velgarien, 3, 76.0, 50.0, 72.0, 60.0, 55.0, 63.90, v_starts_at + INTERVAL '24 hours'),
        (v_epoch_id, v_gi_velgarien, 4, 78.0, 52.0, 71.0, 62.0, 58.0, 65.60, v_starts_at + INTERVAL '32 hours'),
        -- c5: stability drops (propaganda hit), sovereignty dips (spy captured = intel leak)
        (v_epoch_id, v_gi_velgarien, 5, 72.0, 54.0, 61.0, 63.0, 60.0, 63.15, v_starts_at + INTERVAL '40 hours'),
        -- c6: partial recovery
        (v_epoch_id, v_gi_velgarien, 6, 75.0, 56.0, 64.0, 65.0, 62.0, 65.55, v_starts_at + INTERVAL '48 hours'),
        (v_epoch_id, v_gi_velgarien, 7, 77.0, 58.0, 66.0, 66.0, 64.0, 67.15, v_starts_at + INTERVAL '56 hours');

    -- Gaslit Reach: diplomat archetype. c6 sovereignty dip (infiltration detected)
    INSERT INTO epoch_scores (epoch_id, simulation_id, cycle_number, stability_score, influence_score, sovereignty_score, diplomatic_score, military_score, composite_score, computed_at) VALUES
        (v_epoch_id, v_gi_gaslit_reach, 1, 60.0, 55.0, 58.0, 72.0, 42.0, 56.60, v_starts_at + INTERVAL '8 hours'),
        (v_epoch_id, v_gi_gaslit_reach, 2, 62.0, 58.0, 60.0, 74.0, 44.0, 58.70, v_starts_at + INTERVAL '16 hours'),
        (v_epoch_id, v_gi_gaslit_reach, 3, 63.0, 62.0, 61.0, 76.0, 48.0, 61.15, v_starts_at + INTERVAL '24 hours'),
        (v_epoch_id, v_gi_gaslit_reach, 4, 64.0, 64.0, 60.0, 78.0, 50.0, 62.50, v_starts_at + INTERVAL '32 hours'),
        (v_epoch_id, v_gi_gaslit_reach, 5, 65.0, 66.0, 59.0, 80.0, 52.0, 63.65, v_starts_at + INTERVAL '40 hours'),
        -- c6: sovereignty dip (Enzo detected = border concerns)
        (v_epoch_id, v_gi_gaslit_reach, 6, 66.0, 68.0, 52.0, 82.0, 55.0, 63.45, v_starts_at + INTERVAL '48 hours'),
        (v_epoch_id, v_gi_gaslit_reach, 7, 67.0, 70.0, 55.0, 84.0, 58.0, 65.55, v_starts_at + INTERVAL '56 hours');

    -- Station Null: shadow archetype. c5 military +4 (counter-intel success vs Viktor)
    INSERT INTO epoch_scores (epoch_id, simulation_id, cycle_number, stability_score, influence_score, sovereignty_score, diplomatic_score, military_score, composite_score, computed_at) VALUES
        (v_epoch_id, v_gi_station_null, 1, 42.0, 40.0, 75.0, 35.0, 70.0, 53.25, v_starts_at + INTERVAL '8 hours'),
        (v_epoch_id, v_gi_station_null, 2, 40.0, 42.0, 76.0, 38.0, 74.0, 54.90, v_starts_at + INTERVAL '16 hours'),
        (v_epoch_id, v_gi_station_null, 3, 38.0, 45.0, 78.0, 40.0, 78.0, 56.70, v_starts_at + INTERVAL '24 hours'),
        (v_epoch_id, v_gi_station_null, 4, 36.0, 48.0, 80.0, 42.0, 80.0, 57.90, v_starts_at + INTERVAL '32 hours'),
        -- c5: military boost (HAVEN jammed Viktor's propaganda)
        (v_epoch_id, v_gi_station_null, 5, 35.0, 50.0, 82.0, 44.0, 84.0, 59.55, v_starts_at + INTERVAL '40 hours'),
        (v_epoch_id, v_gi_station_null, 6, 34.0, 52.0, 83.0, 46.0, 86.0, 60.60, v_starts_at + INTERVAL '48 hours'),
        (v_epoch_id, v_gi_station_null, 7, 33.0, 54.0, 84.0, 48.0, 88.0, 61.70, v_starts_at + INTERVAL '56 hours');

    -- Speranza: opportunist archetype. c4 diplomatic drop (capturing spy = fallout), c6 influence drop (failed spy + sabotage)
    INSERT INTO epoch_scores (epoch_id, simulation_id, cycle_number, stability_score, influence_score, sovereignty_score, diplomatic_score, military_score, composite_score, computed_at) VALUES
        (v_epoch_id, v_gi_speranza, 1, 55.0, 52.0, 54.0, 50.0, 55.0, 53.35, v_starts_at + INTERVAL '8 hours'),
        (v_epoch_id, v_gi_speranza, 2, 56.0, 54.0, 55.0, 52.0, 56.0, 54.70, v_starts_at + INTERVAL '16 hours'),
        (v_epoch_id, v_gi_speranza, 3, 58.0, 55.0, 56.0, 54.0, 58.0, 56.30, v_starts_at + INTERVAL '24 hours'),
        -- c4: diplomatic drops (spy capture = international incident)
        (v_epoch_id, v_gi_speranza, 4, 59.0, 56.0, 58.0, 48.0, 59.0, 56.25, v_starts_at + INTERVAL '32 hours'),
        (v_epoch_id, v_gi_speranza, 5, 60.0, 58.0, 59.0, 50.0, 60.0, 57.70, v_starts_at + INTERVAL '40 hours'),
        -- c6: influence + stability drop (sabotage hit from Barnaby + failed spy mission)
        (v_epoch_id, v_gi_speranza, 6, 55.0, 53.0, 60.0, 52.0, 61.0, 56.15, v_starts_at + INTERVAL '48 hours'),
        (v_epoch_id, v_gi_speranza, 7, 57.0, 55.0, 62.0, 54.0, 62.0, 57.80, v_starts_at + INTERVAL '56 hours');

    -- =========================================================================
    -- 7. BATTLE LOG (30 entries across cycles 0-7)
    --    source_simulation_id/target_simulation_id use game instance IDs.
    -- =========================================================================

    -- Cycle 0: Epoch starts
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 0, 'epoch_start',
         'The Convergence Protocol has begun. Four civilizations enter the crucible. The multiverse holds its breath.',
         true, '{"participant_count": 4}'::jsonb, v_starts_at);

    -- Cycle 1: Alliance formed, phase change
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 1, 'alliance_formed', v_gi_velgarien,
         'Velgarien and Station Null forge The Northern Pact. An unlikely alliance between order and shadow.',
         true, '{"team_name": "The Northern Pact", "member_count": 2}'::jsonb, v_starts_at + INTERVAL '1 day');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 1, 'phase_change',
         'The foundation phase ends. Competition begins — all operatives are now cleared for deployment.',
         true, '{"old_phase": "foundation", "new_phase": "competition"}'::jsonb, v_starts_at + INTERVAL '2 days 16 hours');

    -- Cycle 2: First probes, guardian deployments, RP allocation
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 2, 'rp_allocated',
         'Resource points distributed to all participants. The competition economy stabilizes.',
         true, '{"rp_amount": 10}'::jsonb, v_starts_at + INTERVAL '16 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 2, 'operative_deployed', v_gi_gaslit_reach, v_m9,
         'Archivist Quill slips into Velgarien territory under the guise of a scholarly exchange. Target: the Altstadt archives.',
         false, '{"operative_type": "spy", "target": "Velgarien"}'::jsonb, v_starts_at + INTERVAL '12 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 2, 'operative_deployed', v_gi_speranza, v_m18,
         'Capitana Rosa takes her post as Guardian of Topside. The bunker entrances are now under watch.',
         false, '{"operative_type": "guardian"}'::jsonb, v_starts_at + INTERVAL '14 hours');

    -- Cycle 3: Defensive posturing, Velgarien propaganda attempt
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 3, 'operative_deployed', v_gi_velgarien, v_m3,
         'General Aldric Wolf takes position as Guardian of the Regierungsviertel. The government quarter is now under military watch.',
         false, '{"operative_type": "guardian"}'::jsonb, v_starts_at + INTERVAL '20 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 3, 'operative_deployed', v_gi_station_null, v_m14,
         'HAVEN activates defense subroutines in the Science Wing. Automated counter-intelligence protocols are now online.',
         false, '{"operative_type": "guardian"}'::jsonb, v_starts_at + INTERVAL '21 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 3, 'operative_deployed', v_gi_gaslit_reach, v_m10,
         'Archivist Quill returns from Velgarien and takes up a guardian post in the Upper Caverns. The tunnels are watched.',
         false, '{"operative_type": "guardian"}'::jsonb, v_starts_at + INTERVAL '22 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 3, 'operative_deployed', v_gi_velgarien, v_gi_station_null, v_m4,
         'Viktor Harken begins broadcasting propaganda toward Station Null. The Northern Pact''s own ally becomes a target — politics makes strange enemies.',
         false, '{"operative_type": "propagandist", "target": "Station Null"}'::jsonb, v_starts_at + INTERVAL '20 hours');

    -- Cycle 4: Escalation — captures, propaganda success, spy returns
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 4, 'operative_deployed', v_gi_velgarien, v_gi_speranza, v_m2,
         'A Velgarien operative slips through the embassy channels into Speranza territory.',
         false, '{"operative_type": "spy", "target": "Speranza"}'::jsonb, v_starts_at + INTERVAL '28 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 4, 'captured', v_gi_velgarien, v_gi_speranza, v_m2,
         'Lena Kray has been captured in The Workshops! Speranza guardians intercepted her during a reconnaissance sweep. Velgarien loses face.',
         true, '{"operative_type": "spy", "outcome": "captured"}'::jsonb, v_starts_at + INTERVAL '32 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 4, 'propaganda', v_gi_speranza, v_gi_velgarien, v_m17,
         'Whispers from Speranza seep through the Altstadt. Celeste Amara''s propaganda campaign plants seeds of dissent among Velgarien citizens.',
         true, '{"operative_type": "propagandist", "outcome": "success"}'::jsonb, v_starts_at + INTERVAL '34 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 4, 'mission_success', v_gi_gaslit_reach, v_gi_velgarien, v_m9,
         'Intelligence report received: Archivist Quill''s mission in Velgarien was a complete success. Northern Pact supply line data acquired.',
         false, '{"operative_type": "spy", "outcome": "success"}'::jsonb, v_starts_at + INTERVAL '30 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 4, 'operative_deployed', v_gi_speranza, v_gi_gaslit_reach, v_m19,
         'Enzo Moretti infiltrates Gaslit Reach territory through the southern trade routes. Target: the Fungal Warrens.',
         false, '{"operative_type": "infiltrator", "target": "The Gaslit Reach"}'::jsonb, v_starts_at + INTERVAL '28 hours');

    -- Cycle 5: Counter-intel, mission failures, sabotage
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 5, 'counter_intel', v_gi_station_null, v_gi_velgarien, v_m4,
         'HAVEN''s automated defense systems jammed Viktor Harken''s propaganda broadcasts. The Northern Pact''s own internal conflict resolves quietly.',
         false, '{"operative_type": "propagandist", "outcome": "failed", "defender": "HAVEN"}'::jsonb, v_starts_at + INTERVAL '38 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 5, 'infiltration', v_gi_gaslit_reach, v_gi_station_null, v_m7,
         'Commodore Harrowgate completes a daring infiltration of Station Null''s Habitation Ring. Embassy communications are temporarily compromised.',
         true, '{"operative_type": "infiltrator", "outcome": "success"}'::jsonb, v_starts_at + INTERVAL '38 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 5, 'operative_deployed', v_gi_velgarien, v_gi_speranza, v_m5,
         'Lena Kray, recently exchanged from Speranza captivity, is redeployed on a new spy mission. Target: the Hub district.',
         false, '{"operative_type": "spy", "target": "Speranza", "note": "second deployment"}'::jsonb, v_starts_at + INTERVAL '40 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 5, 'rp_allocated',
         'Mid-epoch resource allocation. Tensions rise as RP stockpiles shift the balance of power.',
         true, '{"rp_amount": 10}'::jsonb, v_starts_at + INTERVAL '40 hours');

    -- Cycle 6: Detection wave, sabotage success, active spy deployments
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 6, 'detected', v_gi_speranza, v_gi_gaslit_reach, v_m19,
         'Enzo Moretti spotted by Gaslit Reach scouts in the Fungal Warrens! His cover is blown. Speranza''s intentions toward the Reach are now suspect.',
         true, '{"operative_type": "infiltrator", "outcome": "detected"}'::jsonb, v_starts_at + INTERVAL '46 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 6, 'sabotage', v_gi_gaslit_reach, v_gi_speranza, v_m11,
         'Power conduits in Speranza''s Workshops sever and spark — Obediah Crook strikes again. Repair operations disrupted for hours.',
         true, '{"operative_type": "saboteur", "outcome": "success"}'::jsonb, v_starts_at + INTERVAL '46 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 6, 'mission_failed', v_gi_speranza, v_gi_station_null, v_m20,
         'Celeste Amara''s espionage attempt at Station Null was thwarted by HAVEN''s surveillance algorithms. She returned empty-handed.',
         false, '{"operative_type": "spy", "outcome": "failed", "defender": "guardian"}'::jsonb, v_starts_at + INTERVAL '47 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 6, 'operative_deployed', v_gi_velgarien, v_gi_gaslit_reach, v_m1,
         'Elena Voss crosses into Gaslit Reach territory through diplomatic channels. Her mission: intelligence gathering in the Upper Caverns.',
         false, '{"operative_type": "spy", "target": "The Gaslit Reach"}'::jsonb, now() - INTERVAL '8 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 6, 'operative_deployed', v_gi_station_null, v_gi_speranza, v_m13,
         'Dr. Yuki Tanaka deploys to Speranza under cover of a scientific exchange program.',
         false, '{"operative_type": "spy", "target": "Speranza"}'::jsonb, now() - INTERVAL '6 hours');

    -- Cycle 7: Final deployments — assassins and saboteurs, tension peaks
    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 7, 'operative_deployed', v_gi_velgarien, v_gi_gaslit_reach, v_m6,
         'Elena Voss transitions to saboteur operations. A second Velgarien strike against the Gaslit Reach — this time targeting the Fungal Warrens.',
         false, '{"operative_type": "saboteur", "target": "The Gaslit Reach"}'::jsonb, now() - INTERVAL '3 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 7, 'operative_deployed', v_gi_gaslit_reach, v_gi_station_null, v_m8,
         'The Gaslit Reach dispatches a saboteur to Station Null. Obediah Crook slips through the bureaucracy with a cheerful wave — and into the Command Deck.',
         false, '{"operative_type": "saboteur", "target": "Station Null"}'::jsonb, now() - INTERVAL '2 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 7, 'operative_deployed', v_gi_station_null, v_gi_gaslit_reach, v_m15,
         'Station Null deploys Engineer Kowalski on an assassination mission. Target: the Fungal Warrens. The shadows deepen.',
         false, '{"operative_type": "assassin", "target": "The Gaslit Reach"}'::jsonb, now() - INTERVAL '4 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 7, 'operative_deployed', v_gi_speranza, v_gi_velgarien, v_m21,
         'Enzo Moretti, his cover blown in the Gaslit Reach, is redirected on a desperate assassination mission against Velgarien''s Regierungsviertel.',
         false, '{"operative_type": "assassin", "target": "Velgarien"}'::jsonb, now() - INTERVAL '5 hours');

    INSERT INTO battle_log (epoch_id, cycle_number, event_type, source_simulation_id, target_simulation_id, mission_id, narrative, is_public, metadata, created_at) VALUES
        (v_epoch_id, 7, 'operative_deployed', v_gi_gaslit_reach, v_gi_velgarien, v_m12,
         'Commodore Harrowgate begins a second infiltration operation — this time targeting Velgarien''s Regierungsviertel. The Commodore''s appetite for secrets grows.',
         false, '{"operative_type": "infiltrator", "target": "Velgarien"}'::jsonb, now() - INTERVAL '10 hours');

    -- =========================================================================
    -- 8. AGENT APTITUDES (Bug #21 fix)
    --    Budget: 36 points per agent, range 3-9 per type
    --    Lore-appropriate distributions reflecting each agent's specialty.
    --    simulation_id references TEMPLATES (agents live on templates in seed data,
    --    since we don't clone agents for seed data).
    -- =========================================================================

    -- Viktor Harken (Velgarien) — propagandist/spy specialist
    IF v_agent_viktor IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_viktor, v_velgarien, 'spy', 6),
        (v_agent_viktor, v_velgarien, 'guardian', 4),
        (v_agent_viktor, v_velgarien, 'saboteur', 5),
        (v_agent_viktor, v_velgarien, 'propagandist', 9),
        (v_agent_viktor, v_velgarien, 'infiltrator', 5),
        (v_agent_viktor, v_velgarien, 'assassin', 7)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Elena Voss (Velgarien) — spy/saboteur specialist
    IF v_agent_elena IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_elena, v_velgarien, 'spy', 8),
        (v_agent_elena, v_velgarien, 'guardian', 4),
        (v_agent_elena, v_velgarien, 'saboteur', 7),
        (v_agent_elena, v_velgarien, 'propagandist', 5),
        (v_agent_elena, v_velgarien, 'infiltrator', 6),
        (v_agent_elena, v_velgarien, 'assassin', 6)
      ON CONFLICT DO NOTHING;
    END IF;

    -- General Aldric Wolf (Velgarien) — guardian/military specialist
    IF v_agent_aldric IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_aldric, v_velgarien, 'spy', 3),
        (v_agent_aldric, v_velgarien, 'guardian', 9),
        (v_agent_aldric, v_velgarien, 'saboteur', 6),
        (v_agent_aldric, v_velgarien, 'propagandist', 4),
        (v_agent_aldric, v_velgarien, 'infiltrator', 5),
        (v_agent_aldric, v_velgarien, 'assassin', 9)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Lena Kray (Velgarien) — spy/infiltrator specialist
    IF v_agent_lena IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_lena, v_velgarien, 'spy', 9),
        (v_agent_lena, v_velgarien, 'guardian', 3),
        (v_agent_lena, v_velgarien, 'saboteur', 5),
        (v_agent_lena, v_velgarien, 'propagandist', 6),
        (v_agent_lena, v_velgarien, 'infiltrator', 8),
        (v_agent_lena, v_velgarien, 'assassin', 5)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Commodore Harrowgate (Gaslit Reach) — infiltrator specialist
    IF v_agent_whiskers IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_whiskers, v_gaslit_reach, 'spy', 5),
        (v_agent_whiskers, v_gaslit_reach, 'guardian', 5),
        (v_agent_whiskers, v_gaslit_reach, 'saboteur', 6),
        (v_agent_whiskers, v_gaslit_reach, 'propagandist', 4),
        (v_agent_whiskers, v_gaslit_reach, 'infiltrator', 9),
        (v_agent_whiskers, v_gaslit_reach, 'assassin', 7)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Archivist Quill (Gaslit Reach) — spy/guardian dual
    IF v_agent_mossback IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_mossback, v_gaslit_reach, 'spy', 8),
        (v_agent_mossback, v_gaslit_reach, 'guardian', 7),
        (v_agent_mossback, v_gaslit_reach, 'saboteur', 4),
        (v_agent_mossback, v_gaslit_reach, 'propagandist', 6),
        (v_agent_mossback, v_gaslit_reach, 'infiltrator', 5),
        (v_agent_mossback, v_gaslit_reach, 'assassin', 6)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Obediah Crook (Gaslit Reach) — saboteur specialist
    IF v_agent_barnaby IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_barnaby, v_gaslit_reach, 'spy', 5),
        (v_agent_barnaby, v_gaslit_reach, 'guardian', 3),
        (v_agent_barnaby, v_gaslit_reach, 'saboteur', 9),
        (v_agent_barnaby, v_gaslit_reach, 'propagandist', 7),
        (v_agent_barnaby, v_gaslit_reach, 'infiltrator', 6),
        (v_agent_barnaby, v_gaslit_reach, 'assassin', 6)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Commander Vasquez (Station Null) — propagandist/guardian
    IF v_agent_vasquez IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_vasquez, v_station_null, 'spy', 5),
        (v_agent_vasquez, v_station_null, 'guardian', 7),
        (v_agent_vasquez, v_station_null, 'saboteur', 5),
        (v_agent_vasquez, v_station_null, 'propagandist', 8),
        (v_agent_vasquez, v_station_null, 'infiltrator', 5),
        (v_agent_vasquez, v_station_null, 'assassin', 6)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Dr. Yuki Tanaka (Station Null) — spy/infiltrator
    IF v_agent_tanaka IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_tanaka, v_station_null, 'spy', 8),
        (v_agent_tanaka, v_station_null, 'guardian', 4),
        (v_agent_tanaka, v_station_null, 'saboteur', 5),
        (v_agent_tanaka, v_station_null, 'propagandist', 6),
        (v_agent_tanaka, v_station_null, 'infiltrator', 7),
        (v_agent_tanaka, v_station_null, 'assassin', 6)
      ON CONFLICT DO NOTHING;
    END IF;

    -- HAVEN (Station Null) — guardian/counter-intel AI
    IF v_agent_haven IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_haven, v_station_null, 'spy', 5),
        (v_agent_haven, v_station_null, 'guardian', 9),
        (v_agent_haven, v_station_null, 'saboteur', 4),
        (v_agent_haven, v_station_null, 'propagandist', 3),
        (v_agent_haven, v_station_null, 'infiltrator', 6),
        (v_agent_haven, v_station_null, 'assassin', 9)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Engineer Kowalski (Station Null) — assassin/saboteur
    IF v_agent_kowalski IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_kowalski, v_station_null, 'spy', 4),
        (v_agent_kowalski, v_station_null, 'guardian', 5),
        (v_agent_kowalski, v_station_null, 'saboteur', 8),
        (v_agent_kowalski, v_station_null, 'propagandist', 3),
        (v_agent_kowalski, v_station_null, 'infiltrator', 7),
        (v_agent_kowalski, v_station_null, 'assassin', 9)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Capitana Rosa (Speranza) — guardian specialist
    IF v_agent_rosa IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_rosa, v_speranza, 'spy', 4),
        (v_agent_rosa, v_speranza, 'guardian', 9),
        (v_agent_rosa, v_speranza, 'saboteur', 6),
        (v_agent_rosa, v_speranza, 'propagandist', 5),
        (v_agent_rosa, v_speranza, 'infiltrator', 5),
        (v_agent_rosa, v_speranza, 'assassin', 7)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Celeste Amara (Speranza) — propagandist/spy
    IF v_agent_celeste IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_celeste, v_speranza, 'spy', 7),
        (v_agent_celeste, v_speranza, 'guardian', 3),
        (v_agent_celeste, v_speranza, 'saboteur', 4),
        (v_agent_celeste, v_speranza, 'propagandist', 9),
        (v_agent_celeste, v_speranza, 'infiltrator', 6),
        (v_agent_celeste, v_speranza, 'assassin', 7)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Enzo Moretti (Speranza) — assassin/infiltrator
    IF v_agent_enzo IS NOT NULL THEN
      INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level) VALUES
        (v_agent_enzo, v_speranza, 'spy', 5),
        (v_agent_enzo, v_speranza, 'guardian', 4),
        (v_agent_enzo, v_speranza, 'saboteur', 6),
        (v_agent_enzo, v_speranza, 'propagandist', 5),
        (v_agent_enzo, v_speranza, 'infiltrator', 7),
        (v_agent_enzo, v_speranza, 'assassin', 9)
      ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Epoch demo data inserted: "The Convergence Protocol" with 4 game instances, 4 participants, 1 team, 21 missions, 28 score entries, 30 battle log entries, 14 agents with aptitudes.';
END $$;
