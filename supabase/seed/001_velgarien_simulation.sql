-- =============================================================================
-- SEED 001: Velgarien Simulation + Taxonomies
-- =============================================================================
-- Creates the Velgarien simulation as first simulation on the platform.
-- Includes: test user, simulation, membership, all taxonomy values.
--
-- Source specs:
--   - 03_DATABASE_SCHEMA_NEW.md v2.0 (table/column definitions)
--   - 15_MIGRATION_STRATEGY.md v1.1 Section 2.1 + 2.2 (simulation + taxonomies)
--
-- This seed is STANDALONE — no external data required.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Test User (for local development only)
-- ---------------------------------------------------------------------------
-- Supabase Auth stores users in auth.users. For seeding, we create a
-- deterministic test user. In production, the real user already exists.

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@velgarien.dev',
    crypt('velgarien-dev-2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Velgarien Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- Also insert into auth.identities (required by Supabase Auth)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    jsonb_build_object(
        'sub', '00000000-0000-0000-0000-000000000001',
        'email', 'admin@velgarien.dev',
        'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Velgarien Simulation
-- ---------------------------------------------------------------------------
-- Fixed UUID for referencing in subsequent seed files.

INSERT INTO simulations (
    id, name, slug, description, theme, status, content_locale, owner_id
)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Velgarien',
    'velgarien',
    'Eine dystopische Welt unter totaler Kontrolle. Das Regime durchdringt jeden Aspekt des Lebens — von der Wissenschaft bis zur Straße.',
    'dystopian',
    'active',
    'de',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Owner Membership
-- ---------------------------------------------------------------------------

INSERT INTO simulation_members (
    simulation_id, user_id, member_role
)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner'
)
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Taxonomies
-- ---------------------------------------------------------------------------
-- All values from 15_MIGRATION_STRATEGY.md Section 2.2.
-- label is jsonb with locale keys: {"de":"...","en":"..."}
-- Additional taxonomy types derived from old system CHECK constraints.

-- Shorthand: sim_id for all inserts
DO $$
DECLARE
    sim_id uuid := '10000000-0000-0000-0000-000000000001';
BEGIN

-- ---- Gender (Alt: PostgreSQL ENUM gender_type) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'gender', 'male',    '{"de":"Männlich","en":"Male"}', 1),
    (sim_id, 'gender', 'female',  '{"de":"Weiblich","en":"Female"}', 2),
    (sim_id, 'gender', 'diverse', '{"de":"Divers","en":"Diverse"}', 3),
    (sim_id, 'gender', 'alien',   '{"de":"Alien","en":"Alien"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession (Alt: PostgreSQL ENUM profession_type) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'scientist',       '{"de":"Wissenschaftler","en":"Scientist"}', 1),
    (sim_id, 'profession', 'leader',           '{"de":"Führungsperson","en":"Leader"}', 2),
    (sim_id, 'profession', 'military',         '{"de":"Militär","en":"Military"}', 3),
    (sim_id, 'profession', 'engineer',         '{"de":"Ingenieur","en":"Engineer"}', 4),
    (sim_id, 'profession', 'artist',           '{"de":"Künstler","en":"Artist"}', 5),
    (sim_id, 'profession', 'medic',            '{"de":"Mediziner","en":"Medic"}', 6),
    (sim_id, 'profession', 'security',         '{"de":"Sicherheitspersonal","en":"Security"}', 7),
    (sim_id, 'profession', 'administration',   '{"de":"Verwaltung","en":"Administration"}', 8),
    (sim_id, 'profession', 'craftsman',        '{"de":"Handwerker","en":"Craftsman"}', 9),
    (sim_id, 'profession', 'specialist',       '{"de":"Spezialist","en":"Specialist"}', 10)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Agenten-Systeme / Fraktionen) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'politics', '{"de":"Politik","en":"Politics"}', 1),
    (sim_id, 'system', 'military', '{"de":"Militär","en":"Military"}', 2),
    (sim_id, 'system', 'clergy',   '{"de":"Klerus","en":"Clergy"}', 3),
    (sim_id, 'system', 'science',  '{"de":"Wissenschaft","en":"Science"}', 4),
    (sim_id, 'system', 'civilian', '{"de":"Zivilbevölkerung","en":"Civilian"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential', '{"de":"Wohngebäude","en":"Residential"}', 1),
    (sim_id, 'building_type', 'commercial',  '{"de":"Gewerbegebäude","en":"Commercial"}', 2),
    (sim_id, 'building_type', 'industrial',  '{"de":"Industriegebäude","en":"Industrial"}', 3),
    (sim_id, 'building_type', 'government',  '{"de":"Regierungsgebäude","en":"Government"}', 4),
    (sim_id, 'building_type', 'military',    '{"de":"Militärgebäude","en":"Military"}', 5),
    (sim_id, 'building_type', 'religious',   '{"de":"Religiöses Gebäude","en":"Religious"}', 6),
    (sim_id, 'building_type', 'special',     '{"de":"Spezialgebäude","en":"Special"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Special Type (Alt: PostgreSQL ENUM building_special_type) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_special_type', 'academy_of_sciences', '{"de":"Akademie der Wissenschaften","en":"Academy of Sciences"}', 1),
    (sim_id, 'building_special_type', 'military_academy',    '{"de":"Militärakademie","en":"Military Academy"}', 2),
    (sim_id, 'building_special_type', 'medical_center',      '{"de":"Medizinisches Zentrum","en":"Medical Center"}', 3),
    (sim_id, 'building_special_type', 'research_lab',        '{"de":"Forschungslabor","en":"Research Lab"}', 4),
    (sim_id, 'building_special_type', 'propaganda_center',   '{"de":"Propagandazentrum","en":"Propaganda Center"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Condition ----
-- Derived from old system (no ENUM, free text in old; standardized here)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent',  '{"de":"Ausgezeichnet","en":"Excellent"}', 1),
    (sim_id, 'building_condition', 'good',       '{"de":"Gut","en":"Good"}', 2),
    (sim_id, 'building_condition', 'fair',       '{"de":"Befriedigend","en":"Fair"}', 3),
    (sim_id, 'building_condition', 'poor',       '{"de":"Schlecht","en":"Poor"}', 4),
    (sim_id, 'building_condition', 'ruined',     '{"de":"Ruine","en":"Ruined"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'residential', '{"de":"Wohngebiet","en":"Residential"}', 1),
    (sim_id, 'zone_type', 'commercial',  '{"de":"Gewerbegebiet","en":"Commercial"}', 2),
    (sim_id, 'zone_type', 'industrial',  '{"de":"Industriegebiet","en":"Industrial"}', 3),
    (sim_id, 'zone_type', 'military',    '{"de":"Militärgebiet","en":"Military"}', 4),
    (sim_id, 'zone_type', 'religious',   '{"de":"Religiöses Gebiet","en":"Religious"}', 5),
    (sim_id, 'zone_type', 'government',  '{"de":"Regierungsgebiet","en":"Government"}', 6),
    (sim_id, 'zone_type', 'slums',       '{"de":"Slums","en":"Slums"}', 7),
    (sim_id, 'zone_type', 'ruins',       '{"de":"Ruinen","en":"Ruins"}', 8)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Security Level ----
-- From old zones CHECK constraint: low, medium, high, restricted
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'low',        '{"de":"Niedrig","en":"Low"}', 1),
    (sim_id, 'security_level', 'medium',     '{"de":"Mittel","en":"Medium"}', 2),
    (sim_id, 'security_level', 'high',       '{"de":"Hoch","en":"High"}', 3),
    (sim_id, 'security_level', 'restricted', '{"de":"Eingeschränkt","en":"Restricted"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Urgency Level ----
-- Alt: German CHECK (NIEDRIG, MITTEL, HOCH, KRITISCH) → English taxonomy
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"de":"Niedrig","en":"Low"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"de":"Mittel","en":"Medium"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"de":"Hoch","en":"High"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"de":"Kritisch","en":"Critical"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Event Type ----
-- Standardized event types for Velgarien (dystopian simulation)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'surveillance',  '{"de":"Überwachung","en":"Surveillance"}', 1),
    (sim_id, 'event_type', 'control',       '{"de":"Kontrolle","en":"Control"}', 2),
    (sim_id, 'event_type', 'propaganda',    '{"de":"Propaganda","en":"Propaganda"}', 3),
    (sim_id, 'event_type', 'resistance',    '{"de":"Widerstand","en":"Resistance"}', 4),
    (sim_id, 'event_type', 'social',        '{"de":"Sozial","en":"Social"}', 5),
    (sim_id, 'event_type', 'economic',      '{"de":"Wirtschaft","en":"Economic"}', 6),
    (sim_id, 'event_type', 'military',      '{"de":"Militärisch","en":"Military"}', 7),
    (sim_id, 'event_type', 'scientific',    '{"de":"Wissenschaftlich","en":"Scientific"}', 8),
    (sim_id, 'event_type', 'cultural',      '{"de":"Kulturell","en":"Cultural"}', 9),
    (sim_id, 'event_type', 'crisis',        '{"de":"Krise","en":"Crisis"}', 10)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type ----
-- From old events CHECK constraint
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'surveillance',  '{"de":"Überwachung","en":"Surveillance"}', 1),
    (sim_id, 'propaganda_type', 'control',       '{"de":"Kontrolle","en":"Control"}', 2),
    (sim_id, 'propaganda_type', 'distraction',   '{"de":"Ablenkung","en":"Distraction"}', 3),
    (sim_id, 'propaganda_type', 'loyalty',       '{"de":"Loyalität","en":"Loyalty"}', 4),
    (sim_id, 'propaganda_type', 'productivity',  '{"de":"Produktivität","en":"Productivity"}', 5),
    (sim_id, 'propaganda_type', 'conformity',    '{"de":"Konformität","en":"Conformity"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
-- From old events CHECK constraint (German → English + bilingual labels)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'education_sector',      '{"de":"Bildungssektor","en":"Education Sector"}', 1),
    (sim_id, 'target_demographic', 'working_population',    '{"de":"Arbeitende Bevölkerung","en":"Working Population"}', 2),
    (sim_id, 'target_demographic', 'health_conscious',      '{"de":"Gesundheitsbewusste Bürger","en":"Health-Conscious Citizens"}', 3),
    (sim_id, 'target_demographic', 'general_population',    '{"de":"Allgemeine Bevölkerung","en":"General Population"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
-- Mirrors propaganda_type for campaigns
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'surveillance',  '{"de":"Überwachung","en":"Surveillance"}', 1),
    (sim_id, 'campaign_type', 'control',       '{"de":"Kontrolle","en":"Control"}', 2),
    (sim_id, 'campaign_type', 'distraction',   '{"de":"Ablenkung","en":"Distraction"}', 3),
    (sim_id, 'campaign_type', 'loyalty',       '{"de":"Loyalität","en":"Loyalty"}', 4),
    (sim_id, 'campaign_type', 'productivity',  '{"de":"Produktivität","en":"Productivity"}', 5),
    (sim_id, 'campaign_type', 'conformity',    '{"de":"Konformität","en":"Conformity"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

END;
$$;

COMMIT;

-- =============================================================================
-- Verification: Count taxonomy values by type
-- =============================================================================
-- Expected: 12 taxonomy types, ~70 total values
SELECT
    taxonomy_type,
    count(*) as value_count
FROM simulation_taxonomies
WHERE simulation_id = '10000000-0000-0000-0000-000000000001'
GROUP BY taxonomy_type
ORDER BY taxonomy_type;
