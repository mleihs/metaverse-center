-- =============================================================================
-- 016: Development Player Accounts
-- =============================================================================
-- Creates 4 player accounts (one per simulation) for local testing of the
-- competitive layer. Each player is made an owner of their simulation.
--
-- Pattern: ensure_dev_user.sql (auth.users + auth.identities + simulation_members)
-- All passwords: velgarien-dev-2026
-- Idempotent via ON CONFLICT DO NOTHING.
--
-- Player UUIDs:
--   P1 (Velgarien):        00000000-0000-0000-0000-000000000002
--   P2 (The Gaslit Reach): 00000000-0000-0000-0000-000000000003
--   P3 (Station Null):     00000000-0000-0000-0000-000000000004
--   P4 (Speranza):         00000000-0000-0000-0000-000000000005
-- =============================================================================

DO $$
DECLARE
    v_password TEXT := crypt('velgarien-dev-2026', gen_salt('bf'));
    v_instance UUID := '00000000-0000-0000-0000-000000000000';
    v_p1 UUID := '00000000-0000-0000-0000-000000000002';
    v_p2 UUID := '00000000-0000-0000-0000-000000000003';
    v_p3 UUID := '00000000-0000-0000-0000-000000000004';
    v_p4 UUID := '00000000-0000-0000-0000-000000000005';
    v_velgarien     UUID := '10000000-0000-0000-0000-000000000001';
    v_gaslit_reach      UUID := '20000000-0000-0000-0000-000000000001';
    v_station_null  UUID := '30000000-0000-0000-0000-000000000001';
    v_speranza      UUID := '40000000-0000-0000-0000-000000000001';
BEGIN
    -- Skip if P1 already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_p1) THEN
        RAISE NOTICE 'Dev players already exist, skipping.';
        RETURN;
    END IF;

    -- =========================================================================
    -- auth.users
    -- =========================================================================
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES
        (v_p1, v_instance, 'authenticated', 'authenticated',
         'player-velgarien@velgarien.dev', v_password, now(),
         '{"provider":"email","providers":["email"]}',
         '{"name":"Overseer Voss"}',
         now(), now(), '', '', '', ''),
        (v_p2, v_instance, 'authenticated', 'authenticated',
         'player-capybara@velgarien.dev', v_password, now(),
         '{"provider":"email","providers":["email"]}',
         '{"name":"Cmdr. Harrowgate"}',
         now(), now(), '', '', '', ''),
        (v_p3, v_instance, 'authenticated', 'authenticated',
         'player-station-null@velgarien.dev', v_password, now(),
         '{"provider":"email","providers":["email"]}',
         '{"name":"Cmdr. Vasquez"}',
         now(), now(), '', '', '', ''),
        (v_p4, v_instance, 'authenticated', 'authenticated',
         'player-speranza@velgarien.dev', v_password, now(),
         '{"provider":"email","providers":["email"]}',
         '{"name":"Capitana Rosa"}',
         now(), now(), '', '', '', '')
    ON CONFLICT (id) DO NOTHING;

    -- =========================================================================
    -- auth.identities
    -- =========================================================================
    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES
        (v_p1, v_p1, v_p1,
         jsonb_build_object('sub', v_p1::text, 'email', 'player-velgarien@velgarien.dev', 'email_verified', true),
         'email', now(), now(), now()),
        (v_p2, v_p2, v_p2,
         jsonb_build_object('sub', v_p2::text, 'email', 'player-capybara@velgarien.dev', 'email_verified', true),
         'email', now(), now(), now()),
        (v_p3, v_p3, v_p3,
         jsonb_build_object('sub', v_p3::text, 'email', 'player-station-null@velgarien.dev', 'email_verified', true),
         'email', now(), now(), now()),
        (v_p4, v_p4, v_p4,
         jsonb_build_object('sub', v_p4::text, 'email', 'player-speranza@velgarien.dev', 'email_verified', true),
         'email', now(), now(), now())
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- =========================================================================
    -- simulation_members (each player owns their simulation)
    -- =========================================================================
    INSERT INTO simulation_members (simulation_id, user_id, member_role) VALUES
        (v_velgarien,    v_p1, 'owner'),
        (v_gaslit_reach,     v_p2, 'owner'),
        (v_station_null, v_p3, 'owner'),
        (v_speranza,     v_p4, 'owner')
    ON CONFLICT (simulation_id, user_id) DO NOTHING;

    RAISE NOTICE 'Dev players created: P1 (Velgarien), P2 (Gaslit Reach), P3 (Station Null), P4 (Speranza).';
END $$;
