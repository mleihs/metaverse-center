# 03 - Database Schema New: Neues Schema mit Simulation-Kontext

**Version:** 2.2
**Datum:** 2026-02-26
**Aenderung v2.2:** 3 neue Tabellen (agent_relationships, event_echoes, simulation_connections). 30 Tabellen gesamt, 130 RLS-Policies, 25 Triggers. Migration 026. Taxonomy-Typ `relationship_type` mit 24 Werten (6 pro Simulation).
**Aenderung v2.1:** 24 Migrationen (001-021 + ensure_dev_user). 27 Tabellen, 122 RLS-Policies (inkl. 21 anon SELECT), 22 Triggers, 6 Views + 2 materialisierte Views. 4 Storage-Buckets (agent.portraits, building.images, user.agent.portraits, simulation.assets). `banner_url` und `icon_url` Felder in `simulations` Tabelle.

---

## Design-Prinzipien

1. **Einheitliche PKs:** Alle Tabellen verwenden `uuid DEFAULT gen_random_uuid()` (PostgreSQL-nativ)
2. **Explizite Foreign Keys:** Alle Beziehungen mit FK-Constraints und ON DELETE CASCADE/SET NULL
3. **Simulation-Scope:** Alle Entitaeten tragen `simulation_id` FK
4. **Einheitlich `text`:** Kein VARCHAR, nur `text` fuer Strings
5. **Einheitliche Timestamps:** `timestamptz DEFAULT now()`, Suffix immer `_at`
6. **Englische Schema-Sprache:** Alle Tabellen-, Spalten-, Constraint-Namen auf Englisch
7. **Dynamische Taxonomien:** Keine PostgreSQL ENUMs, keine hartcodierten CHECK Constraints
8. **Vollstaendige RLS:** Jede Tabelle mit simulation-basierter Isolation
9. **Soft Deletes:** Wo sinnvoll mit `deleted_at` statt hartem DELETE
10. **Keine SQL Reserved Words:** Spalten heissen `building_type`, `setting_key`, `member_role` etc. statt `type`, `key`, `role`
11. **FK-Suffix `_id`:** Alle Foreign-Key-Spalten enden auf `_id` (z.B. `created_by_id`, `updated_by_id`)
12. **Boolean-Prefix `is_`:** Alle booleans starten mit `is_` (z.B. `is_processed`, `is_integrated_as_event`)
13. **Length Constraints:** CHECK-Constraints fuer name/title/slug-Felder
14. **Full-Text Search:** Generated `tsvector` Columns + GIN Indexes fuer durchsuchbare Entitaeten

---

## Kern-Tabellen (Plattform-Level)

### `simulations`

```sql
CREATE TABLE public.simulations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) <= 100),
    description text,
    theme text NOT NULL DEFAULT 'custom',            -- dystopian, utopian, fantasy, scifi, custom
    status text NOT NULL DEFAULT 'draft',             -- draft, configuring, active, paused, archived
    content_locale text NOT NULL DEFAULT 'en',        -- Hauptsprache fuer Inhalte
    additional_locales text[] DEFAULT '{}',            -- Weitere Sprachen
    owner_id uuid NOT NULL REFERENCES auth.users(id),
    icon_url text,
    banner_url text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    archived_at timestamptz,
    deleted_at timestamptz
);

CREATE INDEX idx_simulations_owner ON simulations(owner_id);
CREATE INDEX idx_simulations_status ON simulations(status);
CREATE INDEX idx_simulations_slug ON simulations(slug);
CREATE INDEX idx_simulations_active ON simulations(owner_id) WHERE deleted_at IS NULL;
```

### `simulation_members`

```sql
CREATE TABLE public.simulation_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_role text NOT NULL DEFAULT 'viewer',       -- owner, admin, editor, viewer
    invited_by_id uuid REFERENCES auth.users(id),
    joined_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(simulation_id, user_id)
);

CREATE INDEX idx_sim_members_simulation ON simulation_members(simulation_id);
CREATE INDEX idx_sim_members_user ON simulation_members(user_id);
```

**Renames:**
- `role` -> `member_role` (SQL reserved word)
- `invited_by` -> `invited_by_id` (FK-Suffix-Konvention)

### `simulation_settings`

```sql
CREATE TABLE public.simulation_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    category text NOT NULL,                           -- general, world, ai, integration, design, access
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    updated_by_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(simulation_id, category, setting_key)
);

CREATE INDEX idx_sim_settings_lookup ON simulation_settings(simulation_id, category);
```

**Renames:**
- `key` -> `setting_key` (SQL reserved word)
- `value` -> `setting_value` (SQL reserved word)
- `updated_by` -> `updated_by_id` (FK-Suffix-Konvention)

### `simulation_taxonomies`

Ersetzt alle hartcodierten ENUMs und CHECK Constraints.

```sql
CREATE TABLE public.simulation_taxonomies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    taxonomy_type text NOT NULL,                      -- gender, profession, building_type, system, ...
    value text NOT NULL,                              -- Interner Wert (immer englisch)
    label jsonb NOT NULL DEFAULT '{}',                -- Labels pro Locale: {"de":"Wissenschaftler","en":"Scientist"}
    description jsonb DEFAULT '{}',                   -- Beschreibung pro Locale
    sort_order integer DEFAULT 0,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(simulation_id, taxonomy_type, value)
);

CREATE INDEX idx_taxonomies_lookup ON simulation_taxonomies(simulation_id, taxonomy_type);
CREATE INDEX idx_taxonomies_active ON simulation_taxonomies(simulation_id, taxonomy_type) WHERE is_active = true;
```

### `simulation_invitations`

```sql
CREATE TABLE public.simulation_invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    invited_email text,
    invite_token text NOT NULL UNIQUE,
    invited_role text NOT NULL DEFAULT 'viewer',      -- owner, admin, editor, viewer
    invited_by_id uuid NOT NULL REFERENCES auth.users(id),
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_invitations_token ON simulation_invitations(invite_token);
CREATE INDEX idx_invitations_simulation ON simulation_invitations(simulation_id);
```

**Renames:**
- `role` -> `invited_role` (SQL reserved word, plus clarifies context)
- `invited_by` -> `invited_by_id` (FK-Suffix-Konvention)

---

## Entitaets-Tabellen (Simulation-Scoped)

### `agents`

```sql
CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    system text,                                      -- Referenz auf taxonomy: type='system'
    character text,                                   -- Renamed: charakter -> character
    background text,                                  -- Renamed: hintergrund -> background
    gender text,                                      -- Referenz auf taxonomy: type='gender'
    primary_profession text,                          -- Referenz auf taxonomy: type='profession'
    portrait_image_url text,
    portrait_description text,
    data_source text,
    created_by_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(character, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(background, '')), 'C')
    ) STORED
);

CREATE INDEX idx_agents_simulation ON agents(simulation_id);
CREATE INDEX idx_agents_name ON agents(simulation_id, name);
CREATE INDEX idx_agents_system ON agents(simulation_id, system);
CREATE INDEX idx_agents_gender ON agents(simulation_id, gender);
CREATE INDEX idx_agents_profession ON agents(simulation_id, primary_profession);
CREATE INDEX idx_agents_created_by ON agents(created_by_id);
CREATE INDEX idx_agents_active ON agents(simulation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_search ON agents USING GIN(search_vector);
```

**Renames:**
- `created_by_user` -> `created_by_id` (FK-Suffix-Konvention)

**Neu:**
- `search_vector` generated column + GIN index
- `idx_agents_active` partial index for soft-delete
- Length CHECK on `name`

### `agent_professions`

```sql
CREATE TABLE public.agent_professions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    profession text NOT NULL,                         -- Referenz auf taxonomy: type='profession'
    qualification_level integer DEFAULT 1 NOT NULL CHECK (qualification_level >= 1 AND qualification_level <= 5),
    specialization text,
    certified_at timestamptz DEFAULT now(),
    certified_by text,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_prof_agent ON agent_professions(agent_id);
CREATE INDEX idx_agent_prof_simulation ON agent_professions(simulation_id);
```

### `buildings`

```sql
CREATE TABLE public.buildings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    building_type text NOT NULL,                      -- Referenz auf taxonomy: type='building_type'
    description text,
    style text,
    location jsonb,
    city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
    zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
    street_id uuid REFERENCES city_streets(id) ON DELETE SET NULL,
    address text,
    population_capacity integer DEFAULT 0,
    construction_year integer,
    building_condition text,
    geojson jsonb,
    image_url text,
    image_prompt_text text,
    special_type text,                                -- Referenz auf taxonomy: type='building_special_type'
    special_attributes jsonb DEFAULT '{}',
    data_source text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED
);

CREATE INDEX idx_buildings_simulation ON buildings(simulation_id);
CREATE INDEX idx_buildings_city ON buildings(city_id);
CREATE INDEX idx_buildings_zone ON buildings(zone_id);
CREATE INDEX idx_buildings_type ON buildings(simulation_id, building_type);
CREATE INDEX idx_buildings_active ON buildings(simulation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_buildings_search ON buildings USING GIN(search_vector);
```

**Renames:**
- `type` -> `building_type` (SQL reserved word)
- `condition` -> `building_condition` (SQL reserved word)

**Neu:**
- `search_vector` generated column + GIN index
- `idx_buildings_active` partial index for soft-delete
- Length CHECK on `name`

### `events`

```sql
CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) > 0 AND length(title) <= 500),
    event_type text,                                  -- Referenz auf taxonomy: type='event_type'
    description text,
    occurred_at timestamptz DEFAULT now(),             -- Renamed: event_timestamp -> occurred_at
    data_source text DEFAULT 'local',
    metadata jsonb,
    source_platform text,
    propaganda_type text,                             -- Referenz auf taxonomy: type='propaganda_type'
    target_demographic text,                          -- Referenz auf taxonomy: type='target_demographic'
    urgency_level text,                               -- Referenz auf taxonomy: type='urgency_level'
    campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
    original_trend_data jsonb,
    impact_level integer DEFAULT 5 CHECK (impact_level >= 1 AND impact_level <= 10),
    location text,
    tags text[] DEFAULT '{}',                         -- Changed: jsonb -> text[] for cleaner queries
    external_refs jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED
);

CREATE INDEX idx_events_simulation ON events(simulation_id);
CREATE INDEX idx_events_type ON events(simulation_id, event_type);
CREATE INDEX idx_events_occurred ON events(occurred_at DESC);
CREATE INDEX idx_events_urgency ON events(simulation_id, urgency_level);
CREATE INDEX idx_events_campaign ON events(campaign_id);
CREATE INDEX idx_events_tags ON events USING GIN(tags);
CREATE INDEX idx_events_active ON events(simulation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_search ON events USING GIN(search_vector);
```

**Renames:**
- `type` -> `event_type` (SQL reserved word)
- `event_timestamp` -> `occurred_at` (Timestamp-Suffix-Konvention)

**Typ-Aenderungen:**
- `tags`: `jsonb DEFAULT '[]'` -> `text[] DEFAULT '{}'` (saubere Queries via `ANY(tags)`, GIN-Index-Support)

**Neu:**
- `search_vector` generated column + GIN index
- `idx_events_active` partial index for soft-delete
- `idx_events_tags` GIN index on text array
- Length CHECK on `title`

### `event_reactions`

```sql
CREATE TABLE public.event_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agent_name text NOT NULL,
    reaction_text text NOT NULL,
    occurred_at timestamptz DEFAULT now(),             -- Renamed: reaction_timestamp -> occurred_at
    emotion text,
    confidence_score numeric(3,2) CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    data_source text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_reactions_event ON event_reactions(event_id);
CREATE INDEX idx_reactions_agent ON event_reactions(agent_id);
CREATE INDEX idx_reactions_simulation ON event_reactions(simulation_id);
```

**Renames:**
- `reaction_timestamp` -> `occurred_at` (Timestamp-Suffix-Konvention)

**Eliminiert:** `agents.event_reactions` JSONB-Spalte. Reaktionen nur in dieser Tabelle.

### `cities`

```sql
CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    layout_type text,
    description text,
    population integer DEFAULT 0,
    map_center_lat double precision,
    map_center_lng double precision,
    map_default_zoom integer DEFAULT 12,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_cities_simulation ON cities(simulation_id);
```

### `zones`

```sql
CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    description text,
    zone_type text DEFAULT 'residential',             -- Referenz auf taxonomy: type='zone_type'
    population_estimate integer DEFAULT 0,
    security_level text DEFAULT 'medium',             -- Referenz auf taxonomy: type='security_level'
    data_source text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_zones_simulation ON zones(simulation_id);
CREATE INDEX idx_zones_city ON zones(city_id);
```

### `city_streets`

```sql
CREATE TABLE public.city_streets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
    name text,
    street_type text,                                 -- Renamed: type -> street_type
    length_km numeric(10,2),
    geojson jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_streets_simulation ON city_streets(simulation_id);
CREATE INDEX idx_streets_city ON city_streets(city_id);
```

**Renames:**
- `type` -> `street_type` (SQL reserved word)

### `campaigns`

Renamed von `propaganda_campaigns` -> generisch `campaigns`.

```sql
CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) > 0 AND length(title) <= 500),
    description text,
    campaign_type text,                               -- Referenz auf taxonomy: type='campaign_type'
    target_demographic text,                          -- Referenz auf taxonomy
    urgency_level text,                               -- Referenz auf taxonomy
    source_trend_id uuid REFERENCES social_trends(id) ON DELETE SET NULL,
    is_integrated_as_event boolean DEFAULT false,      -- Renamed: integrated_as_event -> is_integrated_as_event
    event_id uuid REFERENCES events(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_campaigns_simulation ON campaigns(simulation_id);
CREATE INDEX idx_campaigns_type ON campaigns(simulation_id, campaign_type);
CREATE INDEX idx_campaigns_trend ON campaigns(source_trend_id);
CREATE INDEX idx_campaigns_event ON campaigns(event_id);
```

**Renames:**
- `integrated_as_event` -> `is_integrated_as_event` (Boolean-Prefix-Konvention)

**Neu:**
- `idx_campaigns_trend` und `idx_campaigns_event` Indexes
- Length CHECK on `title`

---

## Beziehungs-Tabellen

### `building_agent_relations`

```sql
CREATE TABLE public.building_agent_relations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(building_id, agent_id, relation_type)
);

CREATE INDEX idx_building_agents_building ON building_agent_relations(building_id);
CREATE INDEX idx_building_agents_agent ON building_agent_relations(agent_id);
```

### `building_event_relations`

```sql
CREATE TABLE public.building_event_relations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_building_events_building ON building_event_relations(building_id);
CREATE INDEX idx_building_events_event ON building_event_relations(event_id);
```

### `building_profession_requirements`

```sql
CREATE TABLE public.building_profession_requirements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    profession text NOT NULL,                         -- Referenz auf taxonomy
    min_qualification_level integer DEFAULT 1 CHECK (min_qualification_level >= 1 AND min_qualification_level <= 5),
    is_mandatory boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_building_profs_building ON building_profession_requirements(building_id);
```

### `campaign_events` (NEU)

```sql
CREATE TABLE public.campaign_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    integration_type text NOT NULL,
    integration_status text NOT NULL DEFAULT 'pending',
    agent_reactions_generated boolean DEFAULT false,
    reactions_count integer DEFAULT 0,
    event_metadata jsonb DEFAULT '{}',
    performance_metrics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(campaign_id, event_id)
);

CREATE INDEX idx_campaign_events_campaign ON campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_event ON campaign_events(event_id);
```

### `campaign_metrics` (NEU)

```sql
CREATE TABLE public.campaign_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    metric_name text NOT NULL,
    metric_value numeric NOT NULL,
    metric_metadata jsonb DEFAULT '{}',
    measured_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
```

---

## Social & Media Tabellen

### `social_trends`

```sql
CREATE TABLE public.social_trends (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) > 0 AND length(name) <= 255),
    platform text NOT NULL,                           -- Kein CHECK, via Taxonomy validiert
    raw_data jsonb,
    volume integer DEFAULT 0,
    url text,
    fetched_at timestamptz DEFAULT now(),
    relevance_score numeric(4,2) CHECK (relevance_score >= 0 AND relevance_score <= 10),
    sentiment text,                                   -- Kein CHECK, via Taxonomy validiert
    is_processed boolean DEFAULT false,               -- Renamed: processed -> is_processed
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_trends_simulation ON social_trends(simulation_id);
CREATE INDEX idx_trends_platform ON social_trends(simulation_id, platform);
CREATE INDEX idx_trends_fetched ON social_trends(fetched_at DESC);
```

**Renames:**
- `processed` -> `is_processed` (Boolean-Prefix-Konvention)

**Typ-Aenderungen:**
- `relevance_score`: `numeric(5,2)` -> `numeric(4,2)` (0-10 Range, 99.99 reicht)

### `social_media_posts`

Renamed von `facebook_posts` -> generisch.

```sql
CREATE TABLE public.social_media_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    platform text NOT NULL,                           -- facebook, twitter, etc.
    platform_id text NOT NULL,                        -- Original-ID der Plattform
    page_id text,
    author text,
    message text,
    source_created_at timestamptz NOT NULL,           -- Renamed: created_time -> source_created_at
    attachments jsonb DEFAULT '[]',
    reactions jsonb DEFAULT '{}',
    transformed_content text,
    transformation_type text,
    transformed_at timestamptz,                       -- Renamed: transformation_timestamp -> transformed_at
    original_sentiment jsonb,
    transformed_sentiment jsonb,
    is_published boolean DEFAULT false,
    linked_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
    imported_at timestamptz DEFAULT now(),             -- Renamed: import_timestamp -> imported_at
    last_synced_at timestamptz DEFAULT now(),          -- Renamed: last_sync -> last_synced_at
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(simulation_id, platform, platform_id)
);

CREATE INDEX idx_social_posts_simulation ON social_media_posts(simulation_id);
CREATE INDEX idx_social_posts_platform ON social_media_posts(simulation_id, platform);
CREATE INDEX idx_social_posts_event ON social_media_posts(linked_event_id);
```

**Renames:**
- `created_time` -> `source_created_at` (Timestamp-Suffix-Konvention)
- `transformation_timestamp` -> `transformed_at` (Timestamp-Suffix-Konvention)
- `import_timestamp` -> `imported_at` (Timestamp-Suffix-Konvention)
- `last_sync` -> `last_synced_at` (Timestamp-Suffix-Konvention)

**Neu:**
- `idx_social_posts_event` Index auf linked_event_id

### `social_media_comments`

```sql
CREATE TABLE public.social_media_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES social_media_posts(id) ON DELETE CASCADE,
    platform_id text NOT NULL,
    parent_comment_id uuid REFERENCES social_media_comments(id) ON DELETE CASCADE,
    author text NOT NULL,
    message text NOT NULL,
    source_created_at timestamptz NOT NULL,           -- Renamed: created_time -> source_created_at
    transformed_content text,
    sentiment jsonb,
    imported_at timestamptz DEFAULT now(),             -- Renamed: import_timestamp -> imported_at
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_social_comments_post ON social_media_comments(post_id);
CREATE INDEX idx_social_comments_parent ON social_media_comments(parent_comment_id);
CREATE INDEX idx_social_comments_simulation ON social_media_comments(simulation_id);
```

**Renames:**
- `created_time` -> `source_created_at` (Timestamp-Suffix-Konvention)
- `import_timestamp` -> `imported_at` (Timestamp-Suffix-Konvention)

**Neu:**
- 3 fehlende Indexes

### `social_media_agent_reactions`

```sql
CREATE TABLE public.social_media_agent_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    post_id uuid REFERENCES social_media_posts(id) ON DELETE CASCADE,
    comment_id uuid REFERENCES social_media_comments(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    reaction_type text NOT NULL,
    reaction_content text NOT NULL,
    reaction_intensity integer CHECK (reaction_intensity >= 1 AND reaction_intensity <= 10),
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT check_reaction_target
        CHECK ((post_id IS NOT NULL AND comment_id IS NULL)
            OR (post_id IS NULL AND comment_id IS NOT NULL))
);
```

---

## Chat-System

### `chat_conversations`

Neue Tabelle fuer Konversationen (bisher war `agent_chats` flach).

```sql
CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title text,
    status text DEFAULT 'active',                     -- active, archived
    message_count integer DEFAULT 0,
    last_message_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(simulation_id, user_id, agent_id)
);

CREATE INDEX idx_conversations_simulation ON chat_conversations(simulation_id);
CREATE INDEX idx_conversations_user ON chat_conversations(user_id);
```

### `chat_messages`

```sql
CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_role text NOT NULL,                        -- Renamed: role -> sender_role (SQL reserved word)
    content text NOT NULL CHECK (length(content) <= 5000),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id, created_at);
```

**Renames:**
- `role` -> `sender_role` (SQL reserved word)

### `chat_conversation_agents`

Junction table for multi-agent (group) conversations. Each row links an agent to a conversation.

```sql
CREATE TABLE public.chat_conversation_agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    added_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (conversation_id, agent_id)
);

CREATE INDEX idx_conv_agents_conversation ON chat_conversation_agents(conversation_id);
CREATE INDEX idx_conv_agents_agent ON chat_conversation_agents(agent_id);
```

### `chat_event_references`

Tracks which events are referenced in a conversation's context, allowing agents to reason about events during chat.

```sql
CREATE TABLE public.chat_event_references (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    referenced_by uuid REFERENCES auth.users(id),
    referenced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (conversation_id, event_id)
);

CREATE INDEX idx_event_refs_conversation ON chat_event_references(conversation_id);
```

---

## AI & Prompts

### `prompt_templates`

```sql
CREATE TABLE public.prompt_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid REFERENCES simulations(id) ON DELETE CASCADE,   -- NULL = Plattform-Default
    template_type text NOT NULL,                      -- agent_generation, event_generation, etc.
    prompt_category text NOT NULL,                    -- Renamed: category -> prompt_category
    locale text NOT NULL DEFAULT 'en',                -- Sprache des Templates
    template_name text NOT NULL,
    prompt_content text NOT NULL,
    system_prompt text,
    variables jsonb DEFAULT '[]',
    description text,
    default_model text,
    temperature numeric(3,2) DEFAULT 0.8,
    max_tokens integer DEFAULT 500,
    negative_prompt text,                             -- Fuer Bildgenerierung
    is_system_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    parent_template_id uuid REFERENCES prompt_templates(id),
    created_by_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- FIXED: Inline UNIQUE+WHERE is invalid PostgreSQL syntax.
-- Use two partial unique indexes instead:

-- Uniqueness when simulation_id IS NOT NULL
CREATE UNIQUE INDEX idx_prompt_templates_sim_unique
    ON prompt_templates(simulation_id, template_type, locale)
    WHERE simulation_id IS NOT NULL;

-- Uniqueness for platform defaults (simulation_id IS NULL)
CREATE UNIQUE INDEX idx_prompt_templates_platform_unique
    ON prompt_templates(template_type, locale)
    WHERE simulation_id IS NULL;

CREATE INDEX idx_templates_simulation ON prompt_templates(simulation_id, template_type, locale);
CREATE INDEX idx_templates_active ON prompt_templates(is_active) WHERE is_active = true;
```

**Renames:**
- `category` -> `prompt_category` (Clarity, avoids ambiguity with simulation_settings.category)
- `created_by` -> `created_by_id` (FK-Suffix-Konvention)

**CRITICAL FIX:**
- Removed invalid inline `UNIQUE(...) WHERE ...` syntax
- Replaced with two proper partial unique indexes

---

## Logging & Audit

### `audit_log`

Konsolidiert `social_trends_audit`, `api_usage_logs`, `prompt_usage_logs`.

```sql
CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid REFERENCES simulations(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,                             -- create, update, delete, generate, api_call
    entity_type text,                                 -- agent, building, event, prompt, etc.
    entity_id uuid,
    details jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_simulation ON audit_log(simulation_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

---

## PostgreSQL Functions

### Utility Functions

```sql
-- updated_at trigger function (used by 16 tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Role hierarchy check (immutable for optimizer)
CREATE OR REPLACE FUNCTION public.role_meets_minimum(user_role text, min_role text)
RETURNS boolean AS $$
    SELECT CASE min_role
        WHEN 'viewer' THEN user_role IN ('owner', 'admin', 'editor', 'viewer')
        WHEN 'editor' THEN user_role IN ('owner', 'admin', 'editor')
        WHEN 'admin'  THEN user_role IN ('owner', 'admin')
        WHEN 'owner'  THEN user_role = 'owner'
        ELSE false
    END;
$$ LANGUAGE sql IMMUTABLE;

-- Slug generator (requires unaccent extension)
CREATE OR REPLACE FUNCTION public.generate_slug(input text)
RETURNS text AS $$
    SELECT lower(regexp_replace(
        regexp_replace(unaccent(trim(input)), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    ));
$$ LANGUAGE sql IMMUTABLE;

-- Taxonomy validation lookup
CREATE OR REPLACE FUNCTION public.validate_taxonomy_value(sim_id uuid, tax_type text, tax_value text)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM simulation_taxonomies
        WHERE simulation_id = sim_id
          AND taxonomy_type = tax_type
          AND value = tax_value
          AND is_active = true
    );
$$ LANGUAGE sql STABLE;
```

### Trigger Functions

```sql
-- Chat conversation stats (message_count + last_message_at)
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations SET
        message_count = message_count + 1,
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Agent primary profession exclusivity
-- Ensures only one is_primary = true per agent
CREATE OR REPLACE FUNCTION public.enforce_single_primary_profession()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        UPDATE agent_professions
        SET is_primary = false
        WHERE agent_id = NEW.agent_id
          AND id != NEW.id
          AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Simulation status transition validation
-- State machine: draft -> configuring -> active <-> paused -> archived
CREATE OR REPLACE FUNCTION public.validate_simulation_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions jsonb := '{
        "draft": ["configuring"],
        "configuring": ["active"],
        "active": ["paused", "archived"],
        "paused": ["active", "archived"],
        "archived": []
    }'::jsonb;
    allowed jsonb;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    allowed := valid_transitions -> OLD.status;
    IF allowed IS NULL OR NOT (allowed ? NEW.status) THEN
        RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Slug immutability (prevent UPDATE of simulations.slug after creation)
CREATE OR REPLACE FUNCTION public.immutable_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
        RAISE EXCEPTION 'Slug cannot be changed after creation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Last owner protection (prevent removing last owner from simulation)
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.member_role = 'owner' THEN
        IF NOT EXISTS (
            SELECT 1 FROM simulation_members
            WHERE simulation_id = OLD.simulation_id
              AND member_role = 'owner'
              AND id != OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot remove the last owner of a simulation';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

### Trigger Assignments

```sql
-- updated_at triggers (16 tables)
CREATE TRIGGER trg_simulations_updated_at BEFORE UPDATE ON simulations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_simulation_settings_updated_at BEFORE UPDATE ON simulation_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agent_professions_updated_at BEFORE UPDATE ON agent_professions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_buildings_updated_at BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_event_reactions_updated_at BEFORE UPDATE ON event_reactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_city_streets_updated_at BEFORE UPDATE ON city_streets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_social_trends_updated_at BEFORE UPDATE ON social_trends
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_social_media_posts_updated_at BEFORE UPDATE ON social_media_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_social_media_comments_updated_at BEFORE UPDATE ON social_media_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Chat conversation stats
CREATE TRIGGER trg_chat_messages_stats AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Primary profession exclusivity
CREATE TRIGGER trg_primary_profession BEFORE INSERT OR UPDATE ON agent_professions
    FOR EACH ROW EXECUTE FUNCTION enforce_single_primary_profession();

-- Simulation status transitions
CREATE TRIGGER trg_simulation_status BEFORE UPDATE ON simulations
    FOR EACH ROW EXECUTE FUNCTION validate_simulation_status_transition();

-- Slug immutability
CREATE TRIGGER trg_slug_immutable BEFORE UPDATE ON simulations
    FOR EACH ROW EXECUTE FUNCTION immutable_slug();

-- Last owner protection
CREATE TRIGGER trg_last_owner BEFORE DELETE ON simulation_members
    FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();
```

---

## Views

### Active-Only Views (Soft-Delete Filter)

```sql
CREATE VIEW public.active_agents AS
    SELECT * FROM agents WHERE deleted_at IS NULL;

CREATE VIEW public.active_buildings AS
    SELECT * FROM buildings WHERE deleted_at IS NULL;

CREATE VIEW public.active_events AS
    SELECT * FROM events WHERE deleted_at IS NULL;

CREATE VIEW public.active_simulations AS
    SELECT * FROM simulations WHERE deleted_at IS NULL;
```

### Dashboard Aggregation

```sql
CREATE VIEW public.simulation_dashboard AS
    SELECT
        s.id AS simulation_id,
        s.name,
        s.slug,
        s.status,
        s.theme,
        s.content_locale,
        s.owner_id,
        (SELECT count(*) FROM simulation_members sm WHERE sm.simulation_id = s.id) AS member_count,
        (SELECT count(*) FROM agents a WHERE a.simulation_id = s.id AND a.deleted_at IS NULL) AS agent_count,
        (SELECT count(*) FROM buildings b WHERE b.simulation_id = s.id AND b.deleted_at IS NULL) AS building_count,
        (SELECT count(*) FROM events e WHERE e.simulation_id = s.id AND e.deleted_at IS NULL) AS event_count,
        s.created_at,
        s.updated_at
    FROM simulations s
    WHERE s.deleted_at IS NULL;

CREATE VIEW public.conversation_summaries AS
    SELECT
        cc.id,
        cc.simulation_id,
        cc.user_id,
        cc.agent_id,
        a.name AS agent_name,
        a.portrait_image_url AS agent_portrait_url,
        cc.title,
        cc.status,
        cc.message_count,
        cc.last_message_at,
        cc.created_at
    FROM chat_conversations cc
    JOIN agents a ON cc.agent_id = a.id;
```

### Materialized Views (Refresh Periodically)

```sql
CREATE MATERIALIZED VIEW public.campaign_performance AS
    SELECT
        c.id AS campaign_id,
        c.simulation_id,
        c.title,
        c.campaign_type,
        count(DISTINCT ce.event_id) AS event_count,
        coalesce(sum(ce.reactions_count), 0) AS total_reactions,
        count(DISTINCT er.agent_id) AS unique_reacting_agents,
        c.created_at,
        c.updated_at
    FROM campaigns c
    LEFT JOIN campaign_events ce ON c.id = ce.campaign_id
    LEFT JOIN events e ON ce.event_id = e.id
    LEFT JOIN event_reactions er ON e.id = er.event_id
    GROUP BY c.id, c.simulation_id, c.title, c.campaign_type, c.created_at, c.updated_at;

CREATE UNIQUE INDEX idx_campaign_performance_pk ON campaign_performance(campaign_id);

CREATE MATERIALIZED VIEW public.agent_statistics AS
    SELECT
        a.id AS agent_id,
        a.simulation_id,
        a.name,
        count(DISTINCT ap.id) AS profession_count,
        count(DISTINCT er.id) AS reaction_count,
        count(DISTINCT bar.building_id) AS building_count
    FROM agents a
    LEFT JOIN agent_professions ap ON a.id = ap.agent_id
    LEFT JOIN event_reactions er ON a.id = er.agent_id
    LEFT JOIN building_agent_relations bar ON a.id = bar.agent_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.simulation_id, a.name;

CREATE UNIQUE INDEX idx_agent_statistics_pk ON agent_statistics(agent_id);
```

---

## RLS-Policies (alle Tabellen)

### RLS-Helper-Funktionen

```sql
-- Funktion: Prueft ob User Mitglied der Simulation ist
CREATE OR REPLACE FUNCTION public.user_has_simulation_access(sim_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM simulation_members
        WHERE simulation_id = sim_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Funktion: Prueft ob User eine bestimmte Rolle hat
CREATE OR REPLACE FUNCTION public.user_has_simulation_role(sim_id uuid, min_role text)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM simulation_members
        WHERE simulation_id = sim_id
          AND user_id = auth.uid()
          AND role_meets_minimum(member_role, min_role)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Funktion: Gibt die Rolle eines Users in einer Simulation zurueck
CREATE OR REPLACE FUNCTION public.user_simulation_role(sim_id uuid)
RETURNS text AS $$
    SELECT member_role FROM simulation_members
    WHERE simulation_id = sim_id AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Standard-Policies (Beispiel: agents)

```sql
-- Template fuer jede simulation-scoped Tabelle:
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_select ON agents FOR SELECT
    USING (user_has_simulation_access(simulation_id));

CREATE POLICY agents_insert ON agents FOR INSERT
    WITH CHECK (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY agents_update ON agents FOR UPDATE
    USING (user_has_simulation_role(simulation_id, 'editor'));

CREATE POLICY agents_delete ON agents FOR DELETE
    USING (user_has_simulation_role(simulation_id, 'admin'));
```

### RLS-Matrix (alle Tabellen)

| Tabelle | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| `simulations` | Member | - | Admin+ | Owner |
| `simulation_members` | Member | Admin+ | Owner | Owner |
| `simulation_settings` | Member | Admin+ | Admin+ | Admin+ |
| `simulation_taxonomies` | Member | Admin+ | Admin+ | Admin+ |
| `simulation_invitations` | Member | Admin+ | - | Admin+ |
| `agents` | Member | Editor+ | Editor+ | Admin+ |
| `agent_professions` | Member | Editor+ | Editor+ | Admin+ |
| `buildings` | Member | Editor+ | Editor+ | Admin+ |
| `events` | Member | Editor+ | Editor+ | Admin+ |
| `event_reactions` | Member | Editor+ | Editor+ | Admin+ |
| `cities` | Member | Admin+ | Admin+ | Admin+ |
| `zones` | Member | Admin+ | Admin+ | Admin+ |
| `city_streets` | Member | Admin+ | Admin+ | Admin+ |
| `campaigns` | Member | Editor+ | Editor+ | Admin+ |
| `campaign_events` | Member | Editor+ | Editor+ | Admin+ |
| `campaign_metrics` | Member | Editor+ | Editor+ | Admin+ |
| `social_trends` | Member | Editor+ | Editor+ | Admin+ |
| `social_media_posts` | Member | Editor+ | Editor+ | Admin+ |
| `social_media_comments` | Member | Editor+ | Editor+ | Admin+ |
| `social_media_agent_reactions` | Member | Editor+ | Editor+ | Admin+ |
| `building_agent_relations` | Member | Editor+ | - | Editor+ |
| `building_event_relations` | Member | Editor+ | - | Editor+ |
| `building_profession_requirements` | Member | Editor+ | Editor+ | Admin+ |
| `chat_conversations` | Own | Own | Own | Own |
| `chat_messages` | Own Conv | Own Conv | - | - |
| `prompt_templates` | Member | Admin+ | Admin+ | Admin+ |
| `agent_relationships` | Anon/Member | Editor+ | Editor+ | Editor+ |
| `event_echoes` | Anon/Member | Service only | Service only | Service only |
| `simulation_connections` | Anon/Member | Service only | Service only | Service only |
| `audit_log` | Admin+ | Service only | - | - |

---

## Storage Buckets + RLS

```sql
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
    ('agent.portraits', 'agent.portraits', true),
    ('user.agent.portraits', 'user.agent.portraits', true),
    ('building.images', 'building.images', true),
    ('simulation.assets', 'simulation.assets', true);

-- Storage RLS: Agent portraits (Backend AI + Member read)
CREATE POLICY agent_portraits_select ON storage.objects FOR SELECT
    USING (bucket_id = 'agent.portraits');

CREATE POLICY agent_portraits_insert ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'agent.portraits'
        AND (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    );

-- Storage RLS: User agent portraits (own user only)
CREATE POLICY user_agent_portraits_all ON storage.objects
    FOR ALL USING (
        bucket_id = 'user.agent.portraits'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage RLS: Building images (Backend AI + Member read)
CREATE POLICY building_images_select ON storage.objects FOR SELECT
    USING (bucket_id = 'building.images');

CREATE POLICY building_images_insert ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'building.images'
        AND (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    );

-- Storage RLS: Simulation assets (Admin+ upload, Member read)
CREATE POLICY simulation_assets_select ON storage.objects FOR SELECT
    USING (bucket_id = 'simulation.assets');

CREATE POLICY simulation_assets_insert ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'simulation.assets'
        AND auth.role() = 'authenticated'
    );
```

---

## Eliminierte Tabellen

| Alte Tabelle | Grund | Ersatz |
|-------------|-------|--------|
| `locations` | Redundant mit cities/zones/streets | Entfernt |
| `streets` VIEW | Simpler Alias | Entfernt |
| `agent_propaganda_responses` | Velgarien-spezifisch | In Simulation-Settings + generische `agent_interactions` |
| `zone_propaganda_influence` | Velgarien-spezifisch + Typ-Mismatch | In generische `zone_attributes` |

---

## Schema-Statistik

| Metrik | Wert |
|--------|------|
| Tabellen | 30 (+ agent_relationships, event_echoes, simulation_connections gegenueber v2.1) |
| Trigger Functions | 6 |
| Utility Functions | 4 |
| RLS Functions | 3 |
| Triggers | 25 (19x updated_at + 6 business logic) |
| Regular Views | 6 (4x active_* + simulation_dashboard + conversation_summaries) |
| Materialized Views | 2 (campaign_performance + agent_statistics) |
| RLS-Policies | 130 (inkl. 24 anon SELECT + 8 Phase-6-Policies) |
| Indexes | ~60 (inkl. partial, GIN, unique) |
| Storage Buckets | 4 |

---

## Logic Distribution Summary

| Logic | PostgreSQL | FastAPI | Frontend |
|-------|-----------|---------|----------|
| `updated_at` | **Trigger** | -- | -- |
| Chat counters | **Trigger** | -- | -- |
| Primary profession | **Trigger** | -- | -- |
| Status transitions | **Trigger** | Validates first | UI state machine |
| Slug immutability | **Trigger** | Generates slug | Preview |
| Last owner | **Trigger** | Validates first | Disables button |
| Full-text search | **Generated column + GIN** | Uses `search_vector @@` | Sends `?search=` |
| Soft-delete filter | **Views** | Uses views | -- |
| Dashboard stats | **View** | Uses view | Renders |
| Campaign perf | **Materialized view** | Refreshes | Renders |
| Role hierarchy | **Function** | `require_role()` dep | `canEdit` signal |
| Taxonomy validation | Function available | **Primary validator** | Populates dropdowns |
| AI orchestration | -- | **PromptResolver, ModelResolver** | Progress UI |
| External APIs | -- | **Services (encrypted keys)** | -- |
| Image pipeline | -- | **Pillow, Storage upload** | Progress indicator |
| Chat memory | -- | **LangChain** | UI + optimistic |
| Auth | RLS uses JWT | JWT validation | **Supabase direct** |
| File uploads (user) | Storage RLS | -- | **Supabase direct** |
| Realtime | Change events | -- | **Supabase direct** |
| Form validation | CHECK constraints | Pydantic | **Zod** |

---

## Migration-Mapping: Alt -> Neu

### Spalten-Renames

| Alt | Neu | Tabelle | Grund |
|-----|-----|---------|-------|
| `charakter` | `character` | agents | Englisch |
| `hintergrund` | `background` | agents | Englisch |
| `portrait_description_encoded` | `portrait_description` | agents | Vereinfacht |
| `created_by_user` | `created_by_id` | agents | FK-Suffix |
| `"timestamp"` | `occurred_at` | events | Reserved word + Suffix |
| `type` | `event_type` | events | Reserved word |
| `type` | `building_type` | buildings | Reserved word |
| `condition` | `building_condition` | buildings | Reserved word |
| `type` | `street_type` | city_streets | Reserved word |
| `key` | `setting_key` | simulation_settings | Reserved word |
| `value` | `setting_value` | simulation_settings | Reserved word |
| `updated_by` | `updated_by_id` | simulation_settings | FK-Suffix |
| `role` | `member_role` | simulation_members | Reserved word |
| `invited_by` | `invited_by_id` | simulation_members | FK-Suffix |
| `role` | `invited_role` | simulation_invitations | Reserved word |
| `invited_by` | `invited_by_id` | simulation_invitations | FK-Suffix |
| `role` | `sender_role` | chat_messages | Reserved word |
| `category` | `prompt_category` | prompt_templates | Clarity |
| `created_by` | `created_by_id` | prompt_templates | FK-Suffix |
| `dystopian_title` | `title` | campaigns | Generisch |
| `integrated_as_event` | `is_integrated_as_event` | campaigns | Boolean-Prefix |
| `processed` | `is_processed` | social_trends | Boolean-Prefix |
| `event_timestamp` | `occurred_at` | events | Timestamp-Suffix |
| `reaction_timestamp` | `occurred_at` | event_reactions | Timestamp-Suffix |
| `created_time` | `source_created_at` | social_media_posts | Timestamp-Suffix |
| `transformation_timestamp` | `transformed_at` | social_media_posts | Timestamp-Suffix |
| `import_timestamp` | `imported_at` | social_media_posts | Timestamp-Suffix |
| `last_sync` | `last_synced_at` | social_media_posts | Timestamp-Suffix |
| `created_time` | `source_created_at` | social_media_comments | Timestamp-Suffix |
| `import_timestamp` | `imported_at` | social_media_comments | Timestamp-Suffix |
| `facebook_id` | `platform_id` | social_media_posts | Generisch |
| `velgarien_event_id` | `linked_event_id` | social_media_posts | Generisch |

### Tabellen-Renames

| Alt | Neu |
|-----|-----|
| `propaganda_campaigns` | `campaigns` |
| `facebook_posts` | `social_media_posts` |
| `facebook_comments` | `social_media_comments` |
| `facebook_agent_reactions` | `social_media_agent_reactions` |
| `agent_chats` | `chat_conversations` + `chat_messages` |

### Neue Tabellen

| Tabelle | Zweck |
|---------|-------|
| `campaign_events` | Many-to-many Campaign <-> Event mit Metriken |
| `campaign_metrics` | Zeitreihendaten fuer Campaign-Performance |

### Typ-Korrekturen

| Alt | Neu | Aenderung |
|-----|-----|---------|
| `agents.id` (text) | `agents.id` (uuid) | text -> uuid |
| `events.id` (text) | `events.id` (uuid) | text -> uuid |
| `events.tags` (jsonb) | `events.tags` (text[]) | jsonb -> text array |
| `social_trends.relevance_score` (numeric(5,2)) | `numeric(4,2)` | Precision reduced |
| `agent_chats.agent_id` (uuid) | `chat_conversations.agent_id` (uuid) | Typ-Mismatch behoben |
| `zone_propaganda_influence.zone_id` (varchar) | eliminiert | Typ-Mismatch behoben |
| Alle `varchar(N)` | `text` | Einheitlicher String-Typ |

### Enum -> Taxonomy Migration

| Alt (Enum/CHECK) | Neu (Taxonomy) | Werte |
|-------------------|---------------|-------|
| `gender_type` ENUM | `taxonomy(type='gender')` | maennlich->male, weiblich->female, divers->diverse, alien->alien |
| `profession_type` ENUM | `taxonomy(type='profession')` | wissenschaftler->scientist, etc. |
| `building_special_type` ENUM | `taxonomy(type='building_special_type')` | akademie->academy, etc. |
| `urgency_level` CHECK | `taxonomy(type='urgency_level')` | NIEDRIG->low, MITTEL->medium, etc. |
| `target_demographic` CHECK | `taxonomy(type='target_demographic')` | Bildungssektor->education_sector, etc. |
| `propaganda_type` CHECK | `taxonomy(type='campaign_type')` | surveillance, control, etc. |
| `zone_type` CHECK | `taxonomy(type='zone_type')` | residential, commercial, etc. |
| `security_level` CHECK | `taxonomy(type='security_level')` | low, medium, high, restricted |

---

## Beziehungs- und Echo-Tabellen (Phase 6)

Migration 026 fuegt drei Tabellen hinzu, die das Verbindungsgewebe zwischen Agenten und Simulationen bilden: Beziehungen innerhalb einer Simulation, Event-Echos (Bleed) zwischen Simulationen, und Metadaten ueber Simulations-Verbindungen.

### `agent_relationships`

Intra-Simulation-Beziehungen zwischen Agenten. Jede Beziehung hat einen Typ (aus Taxonomy `relationship_type`), eine Intensitaet (1-10), und kann uni- oder bidirektional sein.

```sql
CREATE TABLE agent_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  source_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  is_bidirectional BOOLEAN NOT NULL DEFAULT true,
  intensity INTEGER NOT NULL DEFAULT 5 CHECK (intensity BETWEEN 1 AND 10),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_relation CHECK (source_agent_id != target_agent_id),
  CONSTRAINT unique_relationship UNIQUE (source_agent_id, target_agent_id, relationship_type)
);

CREATE INDEX idx_agent_rel_source ON agent_relationships(source_agent_id);
CREATE INDEX idx_agent_rel_target ON agent_relationships(target_agent_id);
CREATE INDEX idx_agent_rel_sim ON agent_relationships(simulation_id);
```

**Constraints:**
- `no_self_relation` — Ein Agent kann keine Beziehung zu sich selbst haben
- `unique_relationship` — Nur eine Beziehung pro (source, target, type)-Kombination
- `intensity` — Ganzzahl 1-10, Default 5
- `relationship_type` — Referenz auf taxonomy `relationship_type` (24 Werte, 6 pro Simulation)

### `event_echoes`

Cross-Simulation-Bleed: Events einer Simulation koennen als abgewandelte Echos in einer anderen Simulation erscheinen. Der `echo_vector` bestimmt den thematischen Kanal (commerce, language, memory, resonance, architecture, dream, desire).

```sql
CREATE TABLE event_echoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_simulation_id UUID NOT NULL REFERENCES simulations(id),
  target_simulation_id UUID NOT NULL REFERENCES simulations(id),
  target_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  echo_vector TEXT NOT NULL CHECK (echo_vector IN ('commerce','language','memory','resonance','architecture','dream','desire')),
  echo_strength NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (echo_strength BETWEEN 0 AND 1),
  echo_depth INTEGER NOT NULL DEFAULT 1 CHECK (echo_depth BETWEEN 1 AND 3),
  root_event_id UUID REFERENCES events(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','completed','failed','rejected')),
  bleed_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_echo CHECK (source_simulation_id != target_simulation_id),
  CONSTRAINT unique_echo UNIQUE (source_event_id, target_simulation_id)
);

CREATE INDEX idx_echo_source ON event_echoes(source_event_id);
CREATE INDEX idx_echo_target_sim ON event_echoes(target_simulation_id);
CREATE INDEX idx_echo_status ON event_echoes(status);
```

**Constraints:**
- `no_self_echo` — Echos koennen nicht in dieselbe Simulation zeigen
- `unique_echo` — Nur ein Echo pro (source_event, target_simulation)-Kombination
- `echo_vector` — CHECK auf 7 erlaubte Werte: commerce, language, memory, resonance, architecture, dream, desire
- `echo_strength` — NUMERIC(3,2), 0.00-1.00
- `echo_depth` — 1-3 (verhindert Kaskaden: Echo eines Echos max. 3 Stufen tief)
- `status` — CHECK auf 5 Werte (siehe Status-Workflow)

**Status-Workflow:**
```
pending → generating → completed
                    → failed
pending → rejected
```
- `pending` — Echo erkannt, wartet auf AI-Transformation
- `generating` — AI generiert gerade das transformierte Event
- `completed` — `target_event_id` gesetzt, Echo-Event erstellt
- `failed` — AI-Generierung fehlgeschlagen
- `rejected` — Manuell oder automatisch abgelehnt (z.B. Bleed deaktiviert)

**Kaskadenverhinderung:**
- `echo_depth` begrenzt Ketten auf max. 3 Stufen
- `root_event_id` verweist immer auf das Original-Event (nicht das Zwischen-Echo)
- `unique_echo` verhindert doppelte Echos desselben Events in dieselbe Simulation

### `simulation_connections`

Multiverse-Kanten: Metadaten ueber die Verbindung zwischen zwei Simulationen. Definiert welche Bleed-Vektoren aktiv sind und wie stark die Verbindung ist.

```sql
CREATE TABLE simulation_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_a_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  simulation_b_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL DEFAULT 'bleed',
  bleed_vectors TEXT[] NOT NULL DEFAULT '{}',
  strength NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (strength BETWEEN 0 AND 1),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_connection CHECK (simulation_a_id != simulation_b_id),
  CONSTRAINT unique_connection UNIQUE (simulation_a_id, simulation_b_id)
);
```

**Constraints:**
- `no_self_connection` — Keine Verbindung einer Simulation mit sich selbst
- `unique_connection` — Nur eine Verbindung pro Simulations-Paar (Reihenfolge beachten: a < b konventionell)
- `strength` — NUMERIC(3,2), 0.00-1.00 (Default 0.5)
- `bleed_vectors` — TEXT Array der aktiven Echo-Vektoren fuer diese Verbindung
- `is_active` — Verbindung kann deaktiviert werden ohne Loeschung

---

### Neue RLS-Policies (Phase 6)

8 neue Policies ueber 3 Tabellen. `event_echoes` und `simulation_connections` haben keine INSERT/UPDATE/DELETE-Policies fuer regulaere User — Schreibzugriff erfolgt ausschliesslich ueber `service_role` (Cross-Simulation-Operationen).

| # | Policy-Name | Tabelle | Operation | Rolle | Beschreibung |
|---|-------------|---------|-----------|-------|-------------|
| 1 | `agent_relationships_anon_select` | `agent_relationships` | SELECT | anon | Leserecht fuer aktive Simulationen (anon RLS) |
| 2 | `agent_relationships_select` | `agent_relationships` | SELECT | public | Mitglieder-Leserecht via `user_has_simulation_access()` |
| 3 | `agent_relationships_insert` | `agent_relationships` | INSERT | public | Editor+ via `user_has_simulation_role('editor')` |
| 4 | `agent_relationships_update` | `agent_relationships` | UPDATE | public | Editor+ via `user_has_simulation_role('editor')` |
| 5 | `agent_relationships_delete` | `agent_relationships` | DELETE | public | Editor+ via `user_has_simulation_role('editor')` |
| 6 | `event_echoes_anon_select` | `event_echoes` | SELECT | anon | Leserecht fuer aktive Target-Simulationen (anon RLS) |
| 7 | `event_echoes_select` | `event_echoes` | SELECT | public | Mitglieder von Source- ODER Target-Simulation |
| 8 | `simulation_connections_anon_select` | `simulation_connections` | SELECT | anon | Leserecht fuer aktive Verbindungen (`is_active = true`) |
| 9 | `simulation_connections_select` | `simulation_connections` | SELECT | public | Alle authentifizierten User (`USING (true)`) |

**Hinweis:** `event_echoes` und `simulation_connections` haben bewusst keine INSERT/UPDATE/DELETE-Policies. Schreiboperationen gehen ueber den Admin-Supabase-Client (`service_role`), der RLS umgeht. Dies ist korrekt, da Cross-Simulation-Operationen nicht an einzelne User-Berechtigungen gebunden sind.

---

### Neue Triggers (Phase 6)

3 neue `updated_at`-Triggers (erhoehen Gesamt auf 25: 19x updated_at + 6 business logic):

```sql
CREATE TRIGGER set_agent_relationships_updated_at
  BEFORE UPDATE ON agent_relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_event_echoes_updated_at
  BEFORE UPDATE ON event_echoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_simulation_connections_updated_at
  BEFORE UPDATE ON simulation_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### Taxonomy: `relationship_type`

24 simulationsspezifische Beziehungstypen (6 pro Simulation). Gespeichert in `simulation_taxonomies` mit `taxonomy_type = 'relationship_type'`.

| Simulation | Wert | Label (EN) | Label (DE) |
|-----------|------|-----------|-----------|
| **Velgarien** | `handler` | Handler | Fuehrungsoffizier |
| | `informant` | Informant | Informant |
| | `rival` | Rival | Rivale |
| | `co_conspirator` | Co-Conspirator | Mitverschwoerer |
| | `supervisor` | Supervisor | Vorgesetzter |
| | `subject` | Subject | Subjekt |
| **Capybara Kingdom** | `ally` | Ally | Verbuendeter |
| | `mentor` | Mentor | Mentor |
| | `rival` | Rival | Rivale |
| | `trading_partner` | Trading Partner | Handelspartner |
| | `blood_oath` | Blood Oath | Blutschwur |
| | `scholarly_colleague` | Scholarly Colleague | Gelehrter Kollege |
| **Station Null** | `crew_partner` | Crew Partner | Crew-Partner |
| | `antagonist` | Antagonist | Antagonist |
| | `subject_of_study` | Subject of Study | Forschungsobjekt |
| | `commanding_officer` | Commanding Officer | Kommandeur |
| | `quarantine_contact` | Quarantine Contact | Quarantaene-Kontakt |
| **Speranza** | `contrada_kin` | Contrada Kin | Contrada-Verwandter |
| | `raid_partner` | Raid Partner | Raubzug-Partner |
| | `apprentice` | Apprentice | Lehrling |
| | `rival` | Rival | Rivale |
| | `salvage_partner` | Salvage Partner | Bergungspartner |
| | `sworn_enemy` | Sworn Enemy | Erzfeind |

**Hinweis:** Station Null hat nur 5 Typen (nicht 6). `rival` wird von Velgarien, Capybara Kingdom und Speranza geteilt (gleicher `value`, unterschiedliche `simulation_id`).
