-- =============================================================================
-- Migration: Ensure Development User Exists
-- =============================================================================
-- Creates the test user in auth.users + auth.identities for local development.
-- Data migrations 016+ reference this user (created_by_id, owner_id).
-- In production, the real user already exists — ON CONFLICT DO NOTHING.
-- =============================================================================

-- Test user in auth.users
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@velgarien.dev',
    crypt('velgarien-dev-2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Velgarien Admin"}',
    now(), now(),
    '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- Identity record (required by Supabase Auth for login)
INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    jsonb_build_object(
        'sub', '00000000-0000-0000-0000-000000000001',
        'email', 'admin@velgarien.dev',
        'email_verified', true
    ),
    'email',
    now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Velgarien simulation (needed by migration 016 for simulation-specific data)
INSERT INTO simulations (
    id, name, slug, description, theme, status, content_locale, owner_id
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Velgarien',
    'velgarien',
    'A dark, brutalist city-state where surveillance is omnipresent and dissent is dangerous.',
    'dark',
    'active',
    'en',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- Simulation membership
INSERT INTO simulation_members (
    simulation_id, user_id, member_role
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner'
) ON CONFLICT (simulation_id, user_id) DO NOTHING;
