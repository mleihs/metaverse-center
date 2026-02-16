-- =============================================================================
-- SEED 002: Agent Data Migration
-- =============================================================================
-- Migrates agents and agent_professions from old system to new schema.
--
-- Key transformations:
--   - agents.id: TEXT → UUID (via mapping table)
--   - agents.charakter → character
--   - agents.hintergrund → background
--   - agents.gender: German ENUM (männlich/weiblich/divers/alien) → English (male/female/diverse/alien)
--   - agents.primary_profession: German ENUM → English taxonomy value
--   - agents.portrait_description_encoded → portrait_description
--   - agents.event_reactions: ELIMINATED (only in event_reactions table)
--   - agent_professions.profession: German ENUM → English taxonomy value
--   - agent_professions.agent_id: TEXT → UUID via mapping
--
-- Source specs:
--   - 03_DATABASE_SCHEMA_NEW.md v2.0 (target columns)
--   - 15_MIGRATION_STRATEGY.md v1.1 Section 2.3 (transformation SQL)
--   - DATABASE_SCHEMA.sql (old schema reference)
--
-- HOW TO USE:
--   1. Load old data into staging tables (see COPY instructions below)
--   2. Run this script: psql -f 002_migrate_agents.sql
--   3. Verify counts in 005_verify_migration.sql
--
-- To extract old data from backup:
--   pg_restore -d old_velgarien db_cluster-31-10-2025@00-31-20.backup.gz
--   psql -d old_velgarien -c "\copy agents TO '/tmp/old_agents.csv' CSV HEADER"
--   psql -d old_velgarien -c "\copy agent_professions TO '/tmp/old_agent_professions.csv' CSV HEADER"
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Staging Tables (match old schema exactly)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_agents (
    id text NOT NULL,
    name text,
    system text,
    charakter text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    portrait_image_url text,
    data_source text,
    hintergrund text,
    portrait_description_encoded text,
    event_reactions jsonb DEFAULT '[]',
    created_by_user uuid,
    gender text DEFAULT 'divers',           -- was ENUM: männlich, weiblich, divers, alien
    primary_profession text                 -- was ENUM: wissenschaftler, führungsperson, etc.
);

CREATE TEMP TABLE _old_agent_professions (
    id uuid NOT NULL,
    agent_id text NOT NULL,
    profession text NOT NULL,               -- was ENUM: wissenschaftler, führungsperson, etc.
    qualification_level integer DEFAULT 1,
    specialization text,
    certified_at timestamptz DEFAULT now(),
    certified_by text,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Load Old Data
-- ---------------------------------------------------------------------------
-- Option A: From CSV export
--   \copy _old_agents FROM '/tmp/old_agents.csv' CSV HEADER
--   \copy _old_agent_professions FROM '/tmp/old_agent_professions.csv' CSV HEADER
--
-- Option B: From another database via dblink
--   INSERT INTO _old_agents SELECT * FROM dblink('dbname=old_velgarien', 'SELECT * FROM agents') AS t(...)
--
-- Option C: Direct INSERT for known data (example — replace with actual data)
-- Uncomment and populate with actual data from dump:

-- INSERT INTO _old_agents (id, name, system, charakter, hintergrund, gender, primary_profession, portrait_image_url, portrait_description_encoded, data_source, created_at, updated_at) VALUES
--     ('agent-001', 'Kommandant Voss', 'military', 'Ein erbarmungsloser Stratege...', 'Geboren in den Kasemen...', 'männlich', 'militär', NULL, NULL, 'manual', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
--     ('agent-002', 'Dr. Elara Kess', 'science', 'Eine brillante Wissenschaftlerin...', 'Aufgewachsen im Labor...', 'weiblich', 'wissenschaftler', NULL, NULL, 'manual', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z');

-- ---------------------------------------------------------------------------
-- 3. ID Mapping: TEXT → UUID
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _agent_id_mapping (
    old_id text PRIMARY KEY,
    new_id uuid DEFAULT gen_random_uuid()
);

INSERT INTO _agent_id_mapping (old_id)
SELECT id FROM _old_agents;

-- ---------------------------------------------------------------------------
-- 4. Migrate Agents
-- ---------------------------------------------------------------------------

INSERT INTO agents (
    id, simulation_id, name, system, gender, primary_profession,
    character, background, portrait_image_url, portrait_description,
    data_source, created_by_id, created_at, updated_at
)
SELECT
    m.new_id,
    '10000000-0000-0000-0000-000000000001',   -- Velgarien simulation_id
    a.name,
    a.system,
    -- Gender: German ENUM → English taxonomy value
    CASE a.gender
        WHEN 'männlich' THEN 'male'
        WHEN 'weiblich' THEN 'female'
        WHEN 'divers'   THEN 'diverse'
        WHEN 'alien'    THEN 'alien'
        ELSE COALESCE(lower(a.gender), 'diverse')
    END,
    -- Primary Profession: German ENUM → English taxonomy value
    CASE a.primary_profession
        WHEN 'wissenschaftler'      THEN 'scientist'
        WHEN 'führungsperson'       THEN 'leader'
        WHEN 'militär'              THEN 'military'
        WHEN 'ingenieur'            THEN 'engineer'
        WHEN 'künstler'             THEN 'artist'
        WHEN 'mediziner'            THEN 'medic'
        WHEN 'sicherheitspersonal'  THEN 'security'
        WHEN 'verwaltung'           THEN 'administration'
        WHEN 'handwerker'           THEN 'craftsman'
        WHEN 'spezialist'           THEN 'specialist'
        ELSE a.primary_profession   -- pass through if already English
    END,
    a.charakter,                    -- Renamed: charakter → character
    a.hintergrund,                  -- Renamed: hintergrund → background
    a.portrait_image_url,           -- Same column name
    a.portrait_description_encoded, -- Renamed: portrait_description_encoded → portrait_description
    COALESCE(a.data_source, 'migration'),
    a.created_by_user,              -- Renamed: created_by_user → created_by_id (both UUID)
    COALESCE(a.created_at, now()),
    COALESCE(a.updated_at, a.created_at, now())
FROM _old_agents a
JOIN _agent_id_mapping m ON m.old_id = a.id;

-- ---------------------------------------------------------------------------
-- 5. Migrate Agent Professions
-- ---------------------------------------------------------------------------

INSERT INTO agent_professions (
    id, simulation_id, agent_id, profession,
    qualification_level, specialization, certified_at, certified_by,
    is_primary, created_at, updated_at
)
SELECT
    ap.id,
    '10000000-0000-0000-0000-000000000001',
    m.new_id,                               -- TEXT → UUID via mapping
    -- Profession: German ENUM → English taxonomy value
    CASE ap.profession
        WHEN 'wissenschaftler'      THEN 'scientist'
        WHEN 'führungsperson'       THEN 'leader'
        WHEN 'militär'              THEN 'military'
        WHEN 'ingenieur'            THEN 'engineer'
        WHEN 'künstler'             THEN 'artist'
        WHEN 'mediziner'            THEN 'medic'
        WHEN 'sicherheitspersonal'  THEN 'security'
        WHEN 'verwaltung'           THEN 'administration'
        WHEN 'handwerker'           THEN 'craftsman'
        WHEN 'spezialist'           THEN 'specialist'
        ELSE ap.profession::text
    END,
    ap.qualification_level,
    ap.specialization,
    ap.certified_at,
    ap.certified_by,
    ap.is_primary,
    COALESCE(ap.created_at, now()),
    COALESCE(ap.updated_at, ap.created_at, now())
FROM _old_agent_professions ap
JOIN _agent_id_mapping m ON m.old_id = ap.agent_id;

-- ---------------------------------------------------------------------------
-- 6. Persist ID Mapping for subsequent seeds
-- ---------------------------------------------------------------------------
-- Create a non-temporary table so 003/004 can reference it.
-- Will be dropped in 005_verify_migration.sql after all migrations.

DROP TABLE IF EXISTS public._migration_agent_id_mapping;
CREATE TABLE public._migration_agent_id_mapping (
    old_id text PRIMARY KEY,
    new_id uuid NOT NULL
);
INSERT INTO public._migration_agent_id_mapping SELECT * FROM _agent_id_mapping;

-- ---------------------------------------------------------------------------
-- 7. Quick Verification
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    old_count integer;
    new_count integer;
BEGIN
    SELECT count(*) INTO old_count FROM _old_agents;
    SELECT count(*) INTO new_count
    FROM agents WHERE simulation_id = '10000000-0000-0000-0000-000000000001';

    IF old_count > 0 AND old_count != new_count THEN
        RAISE WARNING 'Agent count mismatch! Old: %, New: %', old_count, new_count;
    ELSE
        RAISE NOTICE 'Agents migrated: % → %', old_count, new_count;
    END IF;
END;
$$;

COMMIT;
