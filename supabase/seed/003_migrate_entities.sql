-- =============================================================================
-- SEED 003: Entity Data Migration (Events, Buildings, Geography, Relations)
-- =============================================================================
-- Migrates events, buildings, cities, zones, streets, and relation tables.
--
-- Key transformations:
--   - events.id: TEXT → UUID (via mapping table)
--   - events.type → event_type
--   - events.timestamp → occurred_at
--   - events.urgency_level: German (NIEDRIG/MITTEL/HOCH/KRITISCH) → English
--   - events.target_demographic: German → English taxonomy value
--   - events.tags: jsonb → text[]
--   - buildings.type → building_type
--   - buildings.condition → building_condition
--   - buildings.special_type: German ENUM → English taxonomy value
--   - city_streets.type → street_type
--   - Relation tables: TEXT agent_id/event_id → UUID via mapping
--
-- PREREQUISITE: 002_migrate_agents.sql must run first
--   (creates public._migration_agent_id_mapping)
--
-- Source specs:
--   - 03_DATABASE_SCHEMA_NEW.md v2.0
--   - 15_MIGRATION_STRATEGY.md v1.1 Section 2.3
-- =============================================================================

BEGIN;

-- ===========================================================================
-- PART A: Geography (Cities, Zones, Streets)
-- ===========================================================================
-- Cities, zones, and streets already have UUID PKs.
-- Only need to add simulation_id.

-- ---------------------------------------------------------------------------
-- A1. Staging Tables
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_cities (
    id uuid NOT NULL,
    name text NOT NULL,
    layout_type text,
    description text,
    population integer DEFAULT 0,
    map_center_lat double precision,
    map_center_lng double precision,
    map_default_zoom integer DEFAULT 12,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TEMP TABLE _old_zones (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    city_id uuid NOT NULL,
    zone_type text DEFAULT 'residential',
    population_estimate integer DEFAULT 0,
    security_level text DEFAULT 'medium',
    data_source text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TEMP TABLE _old_city_streets (
    id uuid NOT NULL,
    city_id uuid NOT NULL,
    zone_id uuid,
    name text,
    type text,                              -- Renamed to street_type
    length_km numeric(10,2),
    geojson jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- A2. Load Old Data
-- ---------------------------------------------------------------------------
-- \copy _old_cities FROM '/tmp/old_cities.csv' CSV HEADER
-- \copy _old_zones FROM '/tmp/old_zones.csv' CSV HEADER
-- \copy _old_city_streets FROM '/tmp/old_city_streets.csv' CSV HEADER

-- ---------------------------------------------------------------------------
-- A3. Migrate Cities
-- ---------------------------------------------------------------------------

INSERT INTO cities (
    id, simulation_id, name, layout_type, description,
    population, map_center_lat, map_center_lng, map_default_zoom,
    created_at, updated_at
)
SELECT
    c.id,
    '10000000-0000-0000-0000-000000000001',
    c.name,
    c.layout_type,
    c.description,
    c.population,
    c.map_center_lat,
    c.map_center_lng,
    c.map_default_zoom,
    COALESCE(c.created_at, now()),
    COALESCE(c.updated_at, c.created_at, now())
FROM _old_cities c
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- A4. Migrate Zones
-- ---------------------------------------------------------------------------

INSERT INTO zones (
    id, simulation_id, city_id, name, description,
    zone_type, population_estimate, security_level, data_source,
    created_at, updated_at
)
SELECT
    z.id,
    '10000000-0000-0000-0000-000000000001',
    z.city_id,
    z.name,
    z.description,
    z.zone_type,                            -- Already English in old system
    z.population_estimate,
    z.security_level,                       -- Already English in old system
    z.data_source,
    COALESCE(z.created_at, now()),
    COALESCE(z.updated_at, z.created_at, now())
FROM _old_zones z
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- A5. Migrate Streets
-- ---------------------------------------------------------------------------

INSERT INTO city_streets (
    id, simulation_id, city_id, zone_id, name,
    street_type, length_km, geojson,
    created_at, updated_at
)
SELECT
    s.id,
    '10000000-0000-0000-0000-000000000001',
    s.city_id,
    s.zone_id,
    s.name,
    s.type,                                 -- Renamed: type → street_type
    s.length_km,
    s.geojson,
    COALESCE(s.created_at, now()),
    COALESCE(s.updated_at, s.created_at, now())
FROM _old_city_streets s
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- PART B: Buildings
-- ===========================================================================
-- Buildings already have UUID PKs. Need simulation_id + column renames.

-- ---------------------------------------------------------------------------
-- B1. Staging Table
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_buildings (
    id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,                     -- Renamed to building_type
    description text,
    style text,
    location jsonb,
    city_id uuid,
    zone_id uuid,
    street_id uuid,
    address text,
    population_capacity integer DEFAULT 0,
    construction_year integer,
    condition text,                          -- Renamed to building_condition
    geojson jsonb,
    image_url text,
    image_prompt_text text,
    data_source text,
    special_type text,                       -- Was German ENUM, now English taxonomy
    special_attributes jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- B2. Load Old Data
-- ---------------------------------------------------------------------------
-- \copy _old_buildings FROM '/tmp/old_buildings.csv' CSV HEADER

-- ---------------------------------------------------------------------------
-- B3. Migrate Buildings
-- ---------------------------------------------------------------------------

INSERT INTO buildings (
    id, simulation_id, name, building_type, description, style,
    location, city_id, zone_id, street_id, address,
    population_capacity, construction_year, building_condition,
    geojson, image_url, image_prompt_text,
    special_type, special_attributes, data_source,
    created_at, updated_at
)
SELECT
    b.id,
    '10000000-0000-0000-0000-000000000001',
    b.name,
    b.type,                                 -- Renamed: type → building_type
    b.description,
    b.style,
    b.location,
    b.city_id,
    b.zone_id,
    b.street_id,
    b.address,
    b.population_capacity,
    b.construction_year,
    b.condition,                            -- Renamed: condition → building_condition
    b.geojson,
    b.image_url,
    b.image_prompt_text,
    -- Special Type: German ENUM → English taxonomy value
    CASE b.special_type
        WHEN 'akademie_der_wissenschaften' THEN 'academy_of_sciences'
        WHEN 'militärakademie'             THEN 'military_academy'
        WHEN 'medizinisches_zentrum'       THEN 'medical_center'
        WHEN 'forschungslabor'             THEN 'research_lab'
        WHEN 'propagandazentrum'           THEN 'propaganda_center'
        ELSE b.special_type                -- pass through if NULL or already English
    END,
    b.special_attributes,
    COALESCE(b.data_source, 'migration'),
    COALESCE(b.created_at, now()),
    COALESCE(b.updated_at, b.created_at, now())
FROM _old_buildings b
ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- PART C: Events
-- ===========================================================================
-- Events have TEXT PKs → need UUID mapping like agents.

-- ---------------------------------------------------------------------------
-- C1. Staging Table
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_events (
    id text NOT NULL,
    title text NOT NULL,
    type text,                              -- Renamed to event_type
    description text,
    "timestamp" timestamptz DEFAULT now(),   -- Renamed to occurred_at
    data_source text DEFAULT 'local',
    metadata jsonb,
    source_platform text,
    propaganda_type text,
    target_demographic text,                -- German → English
    urgency_level text,                     -- German → English
    campaign_id uuid,
    original_trend_data jsonb,
    impact_level integer DEFAULT 5,
    location text,
    tags jsonb DEFAULT '[]',                -- jsonb → text[]
    external_refs jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- C2. Load Old Data
-- ---------------------------------------------------------------------------
-- \copy _old_events FROM '/tmp/old_events.csv' CSV HEADER

-- ---------------------------------------------------------------------------
-- C3. ID Mapping: TEXT → UUID
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _event_id_mapping (
    old_id text PRIMARY KEY,
    new_id uuid DEFAULT gen_random_uuid()
);

INSERT INTO _event_id_mapping (old_id)
SELECT id FROM _old_events;

-- ---------------------------------------------------------------------------
-- C4. Migrate Events
-- ---------------------------------------------------------------------------

INSERT INTO events (
    id, simulation_id, title, event_type, description,
    occurred_at, data_source, metadata, source_platform,
    propaganda_type, target_demographic, urgency_level,
    original_trend_data, impact_level, location, tags, external_refs,
    created_at, updated_at
)
SELECT
    m.new_id,
    '10000000-0000-0000-0000-000000000001',
    e.title,
    e.type,                                 -- Renamed: type → event_type
    e.description,
    e."timestamp",                          -- Renamed: timestamp → occurred_at
    COALESCE(e.data_source, 'local'),
    e.metadata,
    e.source_platform,
    e.propaganda_type,                      -- Already English in old system
    -- Target Demographic: German → English taxonomy value
    CASE e.target_demographic
        WHEN 'Bildungssektor'               THEN 'education_sector'
        WHEN 'Arbeitende Bevölkerung'       THEN 'working_population'
        WHEN 'Gesundheitsbewusste Bürger'   THEN 'health_conscious'
        WHEN 'Allgemeine Bevölkerung'       THEN 'general_population'
        ELSE e.target_demographic           -- pass through if NULL or already English
    END,
    -- Urgency Level: German → English taxonomy value
    CASE e.urgency_level
        WHEN 'NIEDRIG'  THEN 'low'
        WHEN 'MITTEL'   THEN 'medium'
        WHEN 'HOCH'     THEN 'high'
        WHEN 'KRITISCH' THEN 'critical'
        ELSE COALESCE(lower(e.urgency_level), 'low')
    END,
    e.original_trend_data,
    COALESCE(e.impact_level, 5),
    e.location,
    -- Tags: jsonb array → text array
    CASE
        WHEN e.tags IS NOT NULL AND e.tags != '[]'::jsonb
        THEN ARRAY(SELECT jsonb_array_elements_text(e.tags))
        ELSE '{}'::text[]
    END,
    COALESCE(e.external_refs, '{}'),
    COALESCE(e.created_at, now()),
    COALESCE(e.updated_at, e.created_at, now())
FROM _old_events e
JOIN _event_id_mapping m ON m.old_id = e.id;


-- ===========================================================================
-- PART D: Relation Tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- D1. Event Reactions (agent_id TEXT + event_id TEXT → UUID via mappings)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_event_reactions (
    id uuid NOT NULL,
    event_id text,
    agent_id text,
    agent_name text NOT NULL,
    reaction_text text NOT NULL,
    "timestamp" timestamptz,                -- Renamed to occurred_at
    data_source text,
    emotion text,
    confidence_score numeric(3,2),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- \copy _old_event_reactions FROM '/tmp/old_event_reactions.csv' CSV HEADER

INSERT INTO event_reactions (
    id, simulation_id, event_id, agent_id, agent_name,
    reaction_text, occurred_at, emotion, confidence_score,
    data_source, created_at, updated_at
)
SELECT
    er.id,
    '10000000-0000-0000-0000-000000000001',
    em.new_id,                              -- event_id: TEXT → UUID
    am.new_id,                              -- agent_id: TEXT → UUID
    er.agent_name,
    er.reaction_text,
    er."timestamp",                         -- Renamed: timestamp → occurred_at
    er.emotion,
    er.confidence_score,
    er.data_source,
    COALESCE(er.created_at, now()),
    COALESCE(er.updated_at, er.created_at, now())
FROM _old_event_reactions er
JOIN _event_id_mapping em ON em.old_id = er.event_id
JOIN public._migration_agent_id_mapping am ON am.old_id = er.agent_id;

-- ---------------------------------------------------------------------------
-- D2. Building-Agent Relations (agent_id TEXT → UUID)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_building_agent_relations (
    id uuid NOT NULL,
    building_id uuid,
    agent_id text,
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- \copy _old_building_agent_relations FROM '/tmp/old_building_agent_relations.csv' CSV HEADER

INSERT INTO building_agent_relations (
    id, simulation_id, building_id, agent_id, relation_type, created_at
)
SELECT
    bar.id,
    '10000000-0000-0000-0000-000000000001',
    bar.building_id,
    am.new_id,                              -- agent_id: TEXT → UUID
    bar.relation_type,
    COALESCE(bar.created_at, now())
FROM _old_building_agent_relations bar
JOIN public._migration_agent_id_mapping am ON am.old_id = bar.agent_id
ON CONFLICT (building_id, agent_id, relation_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- D3. Building-Event Relations (event_id TEXT → UUID)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_building_event_relations (
    id uuid NOT NULL,
    building_id uuid,
    event_id text,
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- \copy _old_building_event_relations FROM '/tmp/old_building_event_relations.csv' CSV HEADER

INSERT INTO building_event_relations (
    id, simulation_id, building_id, event_id, relation_type, created_at
)
SELECT
    ber.id,
    '10000000-0000-0000-0000-000000000001',
    ber.building_id,
    em.new_id,                              -- event_id: TEXT → UUID
    ber.relation_type,
    COALESCE(ber.created_at, now())
FROM _old_building_event_relations ber
JOIN _event_id_mapping em ON em.old_id = ber.event_id;

-- ---------------------------------------------------------------------------
-- D4. Building Profession Requirements (profession ENUM → taxonomy)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _old_building_profession_requirements (
    id uuid NOT NULL,
    building_id uuid NOT NULL,
    profession text NOT NULL,               -- Was German ENUM
    min_qualification_level integer DEFAULT 1,
    is_mandatory boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now()
);

-- \copy _old_building_profession_requirements FROM '/tmp/old_building_profession_requirements.csv' CSV HEADER

INSERT INTO building_profession_requirements (
    id, simulation_id, building_id, profession,
    min_qualification_level, is_mandatory, description, created_at
)
SELECT
    bpr.id,
    '10000000-0000-0000-0000-000000000001',
    bpr.building_id,
    -- Profession: German ENUM → English taxonomy value
    CASE bpr.profession
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
        ELSE bpr.profession::text
    END,
    bpr.min_qualification_level,
    bpr.is_mandatory,
    bpr.description,
    COALESCE(bpr.created_at, now())
FROM _old_building_profession_requirements bpr;

-- ---------------------------------------------------------------------------
-- E. Persist Event ID Mapping for seed 004
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public._migration_event_id_mapping;
CREATE TABLE public._migration_event_id_mapping (
    old_id text PRIMARY KEY,
    new_id uuid NOT NULL
);
INSERT INTO public._migration_event_id_mapping SELECT * FROM _event_id_mapping;

-- ---------------------------------------------------------------------------
-- F. Quick Verification
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    sim_id uuid := '10000000-0000-0000-0000-000000000001';
    cnt integer;
BEGIN
    SELECT count(*) INTO cnt FROM cities WHERE simulation_id = sim_id;
    RAISE NOTICE 'Cities migrated: %', cnt;

    SELECT count(*) INTO cnt FROM zones WHERE simulation_id = sim_id;
    RAISE NOTICE 'Zones migrated: %', cnt;

    SELECT count(*) INTO cnt FROM city_streets WHERE simulation_id = sim_id;
    RAISE NOTICE 'Streets migrated: %', cnt;

    SELECT count(*) INTO cnt FROM buildings WHERE simulation_id = sim_id;
    RAISE NOTICE 'Buildings migrated: %', cnt;

    SELECT count(*) INTO cnt FROM events WHERE simulation_id = sim_id;
    RAISE NOTICE 'Events migrated: %', cnt;

    SELECT count(*) INTO cnt FROM event_reactions WHERE simulation_id = sim_id;
    RAISE NOTICE 'Event reactions migrated: %', cnt;

    SELECT count(*) INTO cnt FROM building_agent_relations WHERE simulation_id = sim_id;
    RAISE NOTICE 'Building-agent relations migrated: %', cnt;

    SELECT count(*) INTO cnt FROM building_event_relations WHERE simulation_id = sim_id;
    RAISE NOTICE 'Building-event relations migrated: %', cnt;

    SELECT count(*) INTO cnt FROM building_profession_requirements WHERE simulation_id = sim_id;
    RAISE NOTICE 'Building profession requirements migrated: %', cnt;
END;
$$;

COMMIT;
