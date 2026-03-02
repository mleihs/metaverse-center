# 02 - Database Schema Legacy: Komplettes Alt-Schema

**Version:** 1.0
**Datum:** 2026-02-15
**Quelle:** `db_cluster-31-10-2025@00-31-20.backup.gz`

---

## Übersicht

| Metrik | Wert |
|--------|------|
| **Tabellen (public)** | 37 |
| **Views (public)** | 6 |
| **Custom ENUMs** | 3 |
| **Indexes** | ~100 |
| **Foreign Key Constraints** | 0 (!) |
| **CHECK Constraints** | ~25 |
| **Stored Functions** | 14 |
| **RLS-aktivierte Tabellen** | 16 von 37 |

---

## Custom Types (ENUMs)

### `public.building_special_type`
```sql
CREATE TYPE public.building_special_type AS ENUM (
    'akademie_der_wissenschaften',
    'militärakademie',
    'medizinisches_zentrum',
    'forschungslabor',
    'propagandazentrum'
);
```

### `public.gender_type`
```sql
CREATE TYPE public.gender_type AS ENUM (
    'männlich',
    'weiblich',
    'divers',
    'alien'
);
```

### `public.profession_type`
```sql
CREATE TYPE public.profession_type AS ENUM (
    'wissenschaftler',
    'führungsperson',
    'militär',
    'ingenieur',
    'künstler',
    'mediziner',
    'sicherheitspersonal',
    'verwaltung',
    'handwerker',
    'spezialist'
);
```

---

## Tabellen (public Schema)

### 1. `agents`

**PK:** TEXT (kein Auto-Generate!)

```sql
CREATE TABLE public.agents (
    id text NOT NULL,                                    -- PK, TEXT statt UUID!
    name text,
    system text,                                         -- "Politik", "Militär" etc.
    charakter text,                                      -- DEUTSCH: charakter statt character
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    portrait_image_url text,
    data_source text,
    hintergrund text,                                    -- DEUTSCH: hintergrund statt background
    portrait_description_encoded text,
    event_reactions jsonb DEFAULT '[]'::jsonb,            -- REDUNDANT: auch in event_reactions Tabelle
    created_by_user uuid,
    gender public.gender_type DEFAULT 'divers',
    primary_profession public.profession_type
);
```

**Indexes:**
- `idx_agents_gender` → `gender`
- `idx_agents_primary_profession` → `primary_profession`

**Kritische Probleme:**
- PK ist `text` statt UUID
- Kein Auto-Generate für PK
- Deutsche Spaltennamen: `charakter`, `hintergrund`
- `event_reactions` JSONB ist redundant mit `event_reactions` Tabelle

---

### 2. `events`

**PK:** TEXT (kein Auto-Generate!)

```sql
CREATE TABLE public.events (
    id text NOT NULL,                                    -- PK, TEXT statt UUID!
    type text,
    description text,
    "timestamp" timestamptz DEFAULT now(),
    data_source text DEFAULT 'local',
    created_at timestamptz DEFAULT now(),
    title text NOT NULL,
    metadata jsonb,
    source_platform text,
    propaganda_type text,
    target_demographic text,
    urgency_level text,
    campaign_id uuid,
    original_trend_data jsonb,
    updated_at timestamptz DEFAULT now() NOT NULL,
    impact_level integer DEFAULT 5,
    location text,
    tags jsonb DEFAULT '[]',
    external_refs jsonb DEFAULT '{}',
    -- CHECK Constraints:
    CONSTRAINT events_impact_level_check
        CHECK (impact_level >= 1 AND impact_level <= 10),
    CONSTRAINT events_propaganda_type_check
        CHECK (propaganda_type IN ('surveillance','control','distraction','loyalty','productivity','conformity')),
    CONSTRAINT events_target_demographic_check
        CHECK (target_demographic IN ('Bildungssektor','Arbeitende Bevölkerung','Gesundheitsbewusste Bürger','Allgemeine Bevölkerung')),
    CONSTRAINT events_urgency_level_check
        CHECK (urgency_level IN ('NIEDRIG','MITTEL','HOCH','KRITISCH'))
);
```

**Indexes:**
- `idx_events_campaign_id`, `idx_events_created_updated`, `idx_events_impact_level`
- `idx_events_location`, `idx_events_propaganda_type`, `idx_events_source_platform`
- `idx_events_target_demographic`, `idx_events_type_timestamp`
- `idx_events_updated_at`, `idx_events_urgency_level`

**Kritische Probleme:**
- PK ist `text` statt UUID
- Deutsche CHECK-Werte: `NIEDRIG`, `MITTEL`, `HOCH`, `KRITISCH`
- Deutsche Zielgruppen: `Bildungssektor`, `Arbeitende Bevölkerung` etc.
- Englische Propaganda-Typen gemischt mit deutschen Zielgruppen

---

### 3. `buildings`

```sql
CREATE TABLE public.buildings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    style text NOT NULL,
    location jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    city_id uuid,                                        -- FK → cities.id (KEIN CONSTRAINT!)
    zone_id uuid,                                        -- FK → zones.id (KEIN CONSTRAINT!)
    street_id uuid,                                      -- FK → city_streets.id (KEIN CONSTRAINT!)
    address text,
    population_capacity integer DEFAULT 0,
    construction_year integer,
    condition text,
    geojson jsonb,
    image_url text,
    image_prompt_text text,
    data_source text DEFAULT 'schema_migration',
    special_type public.building_special_type,
    special_attributes jsonb DEFAULT '{}'
);
```

**Indexes:**
- `idx_buildings_city_id`, `idx_buildings_zone_id`, `idx_buildings_street_id`, `idx_buildings_data_source`

---

### 4. `agent_chats`

```sql
CREATE TABLE public.agent_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,                              -- TYP-MISMATCH: UUID vs agents.id (TEXT)
    target_agent_id uuid NOT NULL,                       -- TYP-MISMATCH: UUID vs agents.id (TEXT)
    message text NOT NULL,
    status varchar(20) DEFAULT 'sent',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by_user uuid,
    updated_by_user uuid,
    CONSTRAINT agent_chats_different_agents CHECK (agent_id <> target_agent_id),
    CONSTRAINT agent_chats_message_length CHECK (length(message) <= 1000),
    CONSTRAINT agent_chats_status_check
        CHECK (status IN ('sent','delivered','read','archived'))
);
```

**Indexes:**
- `idx_agent_chats_agent_id`, `idx_agent_chats_target_agent_id`
- `idx_agent_chats_conversation` → `(agent_id, target_agent_id, created_at)`
- `idx_agent_chats_created_at` → `(created_at DESC)`
- `idx_agent_chats_recent_messages` → `(agent_id, target_agent_id, created_at DESC)`
- `idx_agent_chats_audit` → `(created_by_user, created_at) WHERE created_by_user IS NOT NULL`
- `idx_agent_chats_unique_message` → UNIQUE `(agent_id, target_agent_id, message)`

**Kritischer Typ-Mismatch:** `agent_id` ist UUID, aber `agents.id` ist TEXT!

---

### 5. `agent_professions`

```sql
CREATE TABLE public.agent_professions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,                              -- TEXT passend zu agents.id
    profession public.profession_type NOT NULL,          -- Hartcodierter ENUM
    qualification_level integer DEFAULT 1 NOT NULL,
    specialization text,
    certified_at timestamptz DEFAULT now(),
    certified_by text,
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT agent_professions_qualification_level_check
        CHECK (qualification_level >= 1 AND qualification_level <= 5)
);
```

**Indexes:**
- `idx_agent_professions_agent_id`, `idx_agent_professions_profession`

---

### 6. `agent_propaganda_responses`

```sql
CREATE TABLE public.agent_propaganda_responses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id varchar(255) NOT NULL,                      -- VARCHAR statt TEXT (Inkonsistenz!)
    propaganda_type varchar(50) NOT NULL,
    response_pattern text NOT NULL,
    loyalty_factor numeric(3,2) DEFAULT 0.0,
    resistance_factor numeric(3,2) DEFAULT 0.0,
    emotional_response varchar(50),
    behavioral_changes text[],
    response_triggers text[],
    is_active boolean DEFAULT true,
    effectiveness_score numeric(3,2) DEFAULT 0.0,
    last_used_at timestamptz,
    usage_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT loyalty_factor_check CHECK (loyalty_factor >= -1.0 AND loyalty_factor <= 1.0),
    CONSTRAINT resistance_factor_check CHECK (resistance_factor >= 0.0 AND resistance_factor <= 1.0)
);
```

---

### 7. `agent_trend_interactions`

```sql
CREATE TABLE public.agent_trend_interactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    agent_id text,
    trend_id uuid,
    campaign_id uuid,
    interaction_type text,
    interaction_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT interaction_type_check
        CHECK (interaction_type IN ('supportive','resistant','fearful','neutral'))
);
```

**RLS:** Aktiviert, Policy: `USING (true)` (permissiv)

---

### 8. `api_usage_logs`

```sql
CREATE TABLE public.api_usage_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    endpoint varchar(255) NOT NULL,
    method varchar(10) NOT NULL,
    user_id uuid,
    ip_address inet,
    user_agent text,
    request_params jsonb DEFAULT '{}',
    response_status integer,
    response_time_ms integer,
    error_message text,
    rate_limit_hit boolean DEFAULT false,
    api_key_used varchar(100),
    "timestamp" timestamptz DEFAULT now()
);
```

**Indexes:** `idx_api_logs_endpoint`, `idx_api_logs_status`, `idx_api_logs_timestamp`, `idx_api_logs_user`
**RLS:** Aktiviert

---

### 9. `building_agent_relations`

```sql
CREATE TABLE public.building_agent_relations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    building_id uuid,                                    -- FK → buildings.id (KEIN CONSTRAINT)
    agent_id text,                                       -- FK → agents.id (KEIN CONSTRAINT)
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

---

### 10. `building_campaign_support`

```sql
CREATE TABLE public.building_campaign_support (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    building_id uuid,
    campaign_id uuid,
    support_type text,
    efficiency_boost numeric(3,2) DEFAULT 1.0,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT support_type_check
        CHECK (support_type IN ('broadcast','analysis','storage','coordination'))
);
```

**RLS:** Aktiviert, Policy: `USING (true)` (permissiv)

---

### 11. `building_event_relations`

```sql
CREATE TABLE public.building_event_relations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    building_id uuid,
    event_id text,
    relation_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

---

### 12. `building_profession_requirements`

```sql
CREATE TABLE public.building_profession_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    profession public.profession_type NOT NULL,
    min_qualification_level integer DEFAULT 1 NOT NULL,
    is_mandatory boolean DEFAULT true,
    description text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT min_qualification_level_check
        CHECK (min_qualification_level >= 1 AND min_qualification_level <= 5)
);
```

---

### 13. `campaign_events`

```sql
CREATE TABLE public.campaign_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    event_id varchar(255) NOT NULL,                      -- VARCHAR vs events.id (TEXT)
    integration_type varchar(50) DEFAULT 'automatic',
    integration_status varchar(30) DEFAULT 'pending',
    agent_reactions_generated boolean DEFAULT false,
    reactions_count integer DEFAULT 0,
    event_metadata jsonb DEFAULT '{}',
    performance_metrics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT integration_status_check
        CHECK (integration_status IN ('pending','active','completed','failed','cancelled')),
    CONSTRAINT integration_type_check
        CHECK (integration_type IN ('automatic','manual','scheduled','triggered'))
);
```

**RLS:** Aktiviert

---

### 14. `campaign_metrics`

```sql
CREATE TABLE public.campaign_metrics (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    metric_name text NOT NULL,
    metric_value numeric,
    metric_metadata jsonb,
    measured_at timestamptz DEFAULT now()
);
```

**RLS:** Aktiviert, Policy: `USING (true)` (permissiv)

---

### 15. `campaign_performance_metrics`

```sql
CREATE TABLE public.campaign_performance_metrics (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    metric_type varchar(50) NOT NULL,
    metric_value numeric(10,2) NOT NULL,
    target_value numeric(10,2),
    measurement_unit varchar(20),
    demographic_segment varchar(100),
    geographic_region varchar(100),
    measurement_period_start timestamptz,
    measurement_period_end timestamptz,
    data_source varchar(100),
    confidence_level numeric(3,2) DEFAULT 0.0,
    raw_data jsonb DEFAULT '{}',
    recorded_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT metric_type_check
        CHECK (metric_type IN ('reach','engagement','conversion','sentiment_shift',
                               'behavioral_change','compliance_rate','resistance_level'))
);
```

**RLS:** Aktiviert

---

### 16. `cities`

```sql
CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    layout_type text,
    description text,
    population integer DEFAULT 0,
    map_center_lat double precision,
    map_center_lng double precision,
    map_default_zoom integer DEFAULT 12,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,   -- ABWEICHEND: timezone()
    updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL    -- ABWEICHEND: timezone()
);
```

---

### 17. `city_streets`

```sql
CREATE TABLE public.city_streets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    zone_id uuid,
    name text,
    type text,
    length_km numeric(10,2),
    geojson jsonb,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);
```

**Indexes:** `idx_city_streets_city_id`, `idx_city_streets_zone_id`

---

### 18. `event_reactions`

```sql
CREATE TABLE public.event_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text,                                       -- FK → events.id (KEIN CONSTRAINT)
    agent_id text,                                       -- FK → agents.id (KEIN CONSTRAINT)
    agent_name text NOT NULL,
    reaction_text text NOT NULL,
    "timestamp" timestamptz,
    created_at timestamptz DEFAULT now(),
    data_source text,
    updated_at timestamptz DEFAULT now(),
    emotion text,
    confidence_score numeric(3,2),
    CONSTRAINT confidence_score_check CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);
```

**Indexes:**
- `idx_event_reactions_event_id`, `idx_event_reactions_agent_id`
- `idx_event_reactions_agent_event`, `idx_event_reactions_emotion`
- `idx_event_reactions_data_source`, `idx_event_reactions_updated_at`

---

### 19. `facebook_posts`

```sql
CREATE TABLE public.facebook_posts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    facebook_id text NOT NULL,
    page_id text NOT NULL,
    author text,
    message text,
    created_time timestamptz NOT NULL,
    attachments jsonb DEFAULT '[]',
    reactions jsonb DEFAULT '{}',
    transformed_content text,
    transformation_type text,
    transformation_timestamp timestamptz,
    original_sentiment jsonb,
    transformed_sentiment jsonb,
    is_published boolean DEFAULT false,
    velgarien_event_id text,
    import_timestamp timestamptz DEFAULT now(),
    last_sync timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_facebook_posts_page_id`, `idx_facebook_posts_created_time`
- `idx_facebook_posts_is_published`, `idx_facebook_posts_velgarien_event_id`

---

### 20. `facebook_comments`

```sql
CREATE TABLE public.facebook_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    facebook_id text NOT NULL,
    post_id uuid,                                        -- FK → facebook_posts.id (KEIN CONSTRAINT)
    parent_comment_id uuid,
    author text NOT NULL,
    message text NOT NULL,
    created_time timestamptz NOT NULL,
    transformed_content text,
    sentiment jsonb,
    import_timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

---

### 21. `facebook_agent_reactions`

```sql
CREATE TABLE public.facebook_agent_reactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    post_id uuid,
    comment_id uuid,
    agent_id text,
    reaction_type text NOT NULL,
    reaction_content text NOT NULL,
    reaction_intensity integer,
    reaction_timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT check_reaction_target
        CHECK ((post_id IS NOT NULL AND comment_id IS NULL)
            OR (post_id IS NULL AND comment_id IS NOT NULL)),
    CONSTRAINT reaction_intensity_check CHECK (reaction_intensity >= 1 AND reaction_intensity <= 10)
);
```

---

### 22. `locations`

```sql
CREATE TABLE public.locations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    type text,
    parent_id uuid,
    latitude numeric(10,8),
    longitude numeric(11,8),
    description text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    data_source text DEFAULT 'schema_migration',
    CONSTRAINT locations_type_check
        CHECK (type IN ('city','zone','street','building','landmark'))
);
```

**Indexes:** `idx_locations_name`, `idx_locations_type`, `idx_locations_parent_id`, `idx_locations_coordinates`
**RLS:** Aktiviert, Policy: `USING (true) WITH CHECK (true)` (vollständig permissiv)

**Problem:** Redundant mit `cities`, `zones`, `city_streets` Tabellen.

---

### 23. `prompt_templates`

```sql
CREATE TABLE public.prompt_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    template_name varchar(200) NOT NULL,
    template_type varchar(50) NOT NULL,
    category varchar(50) NOT NULL,
    prompt_content text NOT NULL,
    system_prompt text,
    variables jsonb DEFAULT '[]',
    description text,
    usage_count integer DEFAULT 0,
    success_rate numeric(3,2) DEFAULT 0.0,
    default_model varchar(200),
    temperature numeric(3,2) DEFAULT 0.8,
    max_tokens integer DEFAULT 500,
    is_system_default boolean DEFAULT false,
    is_customizable boolean DEFAULT true,
    created_by_user uuid,
    last_modified_by uuid,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    parent_template_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_used_at timestamptz,
    CONSTRAINT template_type_check
        CHECK (template_type IN (
            'agent_generation','agent_description','agent_reactions',
            'agent_portrait_description','user_agent_description',
            'user_agent_portrait_description','building_generation',
            'building_description','building_image_prompt','building_image_generation',
            'social_trends_title','social_trends_description',
            'event_reaction','news_integration','portrait_generation'
        )),
    CONSTRAINT category_check
        CHECK (category IN (
            'text_generation','image_generation',
            'description_generation','reaction_generation'
        ))
);
```

**Indexes:**
- `idx_prompt_templates_type`, `idx_prompt_templates_category`
- `idx_prompt_templates_active`, `idx_prompt_templates_default`

---

### 24. `prompt_variables`

```sql
CREATE TABLE public.prompt_variables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    variable_name varchar(100) NOT NULL,
    variable_type varchar(50) NOT NULL,
    description text,
    default_value text,
    is_required boolean DEFAULT false,
    validation_pattern text,
    example_value text,
    category varchar(100),
    use_cases text[],
    created_at timestamptz DEFAULT now(),
    CONSTRAINT variable_type_check
        CHECK (variable_type IN ('string','text','integer','float','boolean','array','object'))
);
```

---

### 25. `prompt_usage_logs`

```sql
CREATE TABLE public.prompt_usage_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    template_id uuid,
    customization_id uuid,
    entity_type varchar(50),
    entity_id text,
    execution_context varchar(100),
    execution_time_ms integer,
    token_count integer,
    success boolean DEFAULT true,
    error_message text,
    model_used varchar(200),
    temperature_used numeric(3,2),
    max_tokens_used integer,
    quality_score numeric(3,2),
    user_feedback integer,
    executed_at timestamptz DEFAULT now(),
    CONSTRAINT user_feedback_check CHECK (user_feedback >= 1 AND user_feedback <= 5)
);
```

---

### 26. `user_prompt_customizations`

```sql
CREATE TABLE public.user_prompt_customizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    template_id uuid,
    custom_prompt_content text NOT NULL,
    custom_system_prompt text,
    custom_variables jsonb DEFAULT '[]',
    custom_model varchar(200),
    custom_temperature numeric(3,2),
    custom_max_tokens integer,
    customization_name varchar(200),
    notes text,
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

---

### 27. `propaganda_campaigns`

```sql
CREATE TABLE public.propaganda_campaigns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    source_trend_id uuid,
    dystopian_title text NOT NULL,
    campaign_description text,
    propaganda_type text,
    target_demographic text,
    urgency_level text,
    created_at timestamptz DEFAULT now(),
    integrated_as_event boolean DEFAULT false,
    event_id text,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT propaganda_type_check
        CHECK (propaganda_type IN ('surveillance','control','distraction','loyalty','productivity','conformity')),
    CONSTRAINT target_demographic_check
        CHECK (target_demographic IN ('Bildungssektor','Arbeitende Bevölkerung',
                                      'Gesundheitsbewusste Bürger','Allgemeine Bevölkerung')),
    CONSTRAINT urgency_level_check
        CHECK (urgency_level IN ('NIEDRIG','MITTEL','HOCH','KRITISCH'))
);
```

**RLS:** Aktiviert, Policy: `USING (true)` (permissiv)

---

### 28. `propaganda_templates`

```sql
CREATE TABLE public.propaganda_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    template_name varchar(200) NOT NULL,
    propaganda_type varchar(50) NOT NULL,
    title_template text NOT NULL,
    description_template text NOT NULL,
    target_keywords text[],
    effectiveness_rating numeric(3,2) DEFAULT 0.0,
    usage_count integer DEFAULT 0,
    success_rate numeric(3,2) DEFAULT 0.0,
    demographic_targets text[],
    emotional_triggers text[],
    psychological_techniques text[],
    tone varchar(50) DEFAULT 'authoritarian',
    complexity_level varchar(20) DEFAULT 'medium',
    is_active boolean DEFAULT true,
    created_by_user uuid,
    approved_by_user uuid,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT tone_check
        CHECK (tone IN ('authoritarian','paternalistic','urgent','reassuring','threatening')),
    CONSTRAINT complexity_level_check
        CHECK (complexity_level IN ('simple','medium','complex','sophisticated'))
);
```

**RLS:** Aktiviert

---

### 29. `social_trends`

```sql
CREATE TABLE public.social_trends (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    platform text NOT NULL,
    raw_data jsonb,
    volume integer DEFAULT 0,
    url text,
    fetched_at timestamptz DEFAULT now(),
    relevance_score numeric(3,2),
    sentiment text,
    processed boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT platform_check
        CHECK (platform IN ('twitter','reddit','guardian','newsapi')),
    CONSTRAINT relevance_score_check
        CHECK (relevance_score >= 0 AND relevance_score <= 10),
    CONSTRAINT sentiment_check
        CHECK (sentiment IN ('positive','negative','neutral','mixed'))
);
```

**Indexes:** `idx_social_trends_platform`, `idx_social_trends_sentiment`, `idx_social_trends_processed`, `idx_social_trends_fetched_at`, `idx_social_trends_relevance_score`
**RLS:** Aktiviert, Policy: `USING (true)` (permissiv)

---

### 30. `social_media_sources`

```sql
CREATE TABLE public.social_media_sources (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    source_name varchar(100) NOT NULL,
    platform_type varchar(50) NOT NULL,
    api_endpoint text,
    rate_limit_per_hour integer DEFAULT 1000,
    authentication_type varchar(50),
    is_active boolean DEFAULT true,
    last_sync_at timestamptz,
    sync_frequency_minutes integer DEFAULT 30,
    data_retention_days integer DEFAULT 30,
    cost_per_request numeric(8,4) DEFAULT 0.0,
    quality_score numeric(3,2) DEFAULT 0.0,
    configuration jsonb DEFAULT '{}',
    error_count integer DEFAULT 0,
    last_error_at timestamptz,
    last_error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**RLS:** Aktiviert, Policy: Admin/Service-Role Only

---

### 31. `social_trends_audit`

```sql
CREATE TABLE public.social_trends_audit (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    table_name varchar(100) NOT NULL,
    record_id uuid NOT NULL,
    operation varchar(10) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    changed_fields text[],
    user_id uuid,
    user_agent text,
    ip_address inet,
    api_endpoint varchar(255),
    request_id varchar(100),
    session_id varchar(100),
    "timestamp" timestamptz DEFAULT now(),
    CONSTRAINT operation_check CHECK (operation IN ('INSERT','UPDATE','DELETE'))
);
```

**RLS:** Aktiviert

---

### 32. `trend_analysis_sessions`

```sql
CREATE TABLE public.trend_analysis_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_name varchar(200) NOT NULL,
    source_platform varchar(50) NOT NULL,
    analysis_type varchar(50) DEFAULT 'standard',
    trends_analyzed integer DEFAULT 0,
    campaigns_created integer DEFAULT 0,
    success_rate numeric(3,2) DEFAULT 0.0,
    analysis_parameters jsonb DEFAULT '{}',
    ai_model_used varchar(100),
    processing_time_seconds integer DEFAULT 0,
    error_log jsonb DEFAULT '[]',
    session_status varchar(30) DEFAULT 'running',
    started_by_user uuid,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT analysis_type_check
        CHECK (analysis_type IN ('standard','deep','sentiment','competitive','predictive')),
    CONSTRAINT session_status_check
        CHECK (session_status IN ('pending','running','completed','failed','cancelled'))
);
```

**RLS:** Aktiviert, Policy: Owner or Admin

---

### 33. `trend_keywords`

```sql
CREATE TABLE public.trend_keywords (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    keyword varchar(100) NOT NULL,
    normalized_keyword varchar(100) NOT NULL,
    frequency integer DEFAULT 1,
    sentiment_score numeric(3,2) DEFAULT 0.0,
    propaganda_potential numeric(3,2) DEFAULT 0.0,
    category varchar(50),
    language_code varchar(5) DEFAULT 'de',
    first_seen timestamptz DEFAULT now(),
    last_seen timestamptz DEFAULT now(),
    trends_count integer DEFAULT 0,
    campaigns_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**RLS:** Aktiviert, Policy: Public read

---

### 34. `trend_keyword_associations`

```sql
CREATE TABLE public.trend_keyword_associations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    trend_id uuid,
    keyword_id uuid,
    relevance_score numeric(3,2) DEFAULT 0.0,
    position_in_text integer,
    context_snippet text,
    extracted_at timestamptz DEFAULT now()
);
```

**RLS:** Aktiviert

---

### 35. `user_roles`

```sql
CREATE TABLE public.user_roles (
    id uuid NOT NULL,                                    -- KEIN Auto-Generate!
    role text,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT user_roles_role_check CHECK (role IN ('admin','moderator','editor','viewer'))
);
```

**RLS:** Aktiviert, Policies: Users read own role, Admins manage all

---

### 36. `zone_propaganda_influence`

```sql
CREATE TABLE public.zone_propaganda_influence (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    zone_id varchar(255) NOT NULL,                       -- TYP-MISMATCH: VARCHAR vs zones.id (UUID)!
    propaganda_type varchar(50) NOT NULL,
    influence_level numeric(3,2) DEFAULT 0.0,
    population_compliance numeric(3,2) DEFAULT 0.0,
    resistance_groups_count integer DEFAULT 0,
    active_campaigns_count integer DEFAULT 0,
    last_campaign_at timestamptz,
    surveillance_level varchar(20) DEFAULT 'normal',
    enforcement_presence numeric(3,2) DEFAULT 0.0,
    propaganda_infrastructure jsonb DEFAULT '{}',
    effectiveness_metrics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT influence_level_check CHECK (influence_level >= 0.0 AND influence_level <= 1.0),
    CONSTRAINT surveillance_level_check
        CHECK (surveillance_level IN ('minimal','normal','enhanced','maximum'))
);
```

**RLS:** Aktiviert

---

### 37. `zones`

```sql
CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    city_id uuid NOT NULL,
    zone_type text DEFAULT 'residential',
    population_estimate integer DEFAULT 0,
    security_level text DEFAULT 'medium',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    data_source text DEFAULT 'manual_creation',
    CONSTRAINT security_level_check
        CHECK (security_level IN ('low','medium','high','restricted')),
    CONSTRAINT zone_type_check
        CHECK (zone_type IN ('residential','commercial','industrial','military',
                             'religious','government','slums','ruins'))
);
```

**Indexes:** `idx_zones_city_id`, `idx_zones_name`, `idx_zones_zone_type`
**RLS:** Aktiviert, Multiple Policies (authenticated, service_role)

---

## Views

### 1. `active_propaganda_campaigns`
```sql
SELECT pc.id, pc.dystopian_title, pc.propaganda_type, pc.target_demographic,
       pc.urgency_level, pc.integrated_as_event,
       st.name AS trend_name, st.platform, st.volume, st.relevance_score, st.sentiment,
       e.id AS event_id, e.title AS event_title, e.timestamp AS event_timestamp
FROM propaganda_campaigns pc
LEFT JOIN social_trends st ON pc.source_trend_id = st.id
LEFT JOIN events e ON pc.event_id = e.id
WHERE pc.integrated_as_event = true
ORDER BY pc.created_at DESC;
```

### 2. `agent_qualifications_view`
```sql
SELECT a.id AS agent_id, a.name AS agent_name, a.system, a.primary_profession,
       ap.profession, ap.qualification_level, ap.specialization, ap.is_primary
FROM agents a
LEFT JOIN agent_professions ap ON a.id = ap.agent_id;
```

### 3. `campaign_performance`
```sql
SELECT pc.id AS campaign_id, pc.dystopian_title, pc.propaganda_type, pc.urgency_level,
       count(cm.id) AS metrics_count, avg(cm.metric_value) AS avg_performance,
       max(cm.measured_at) AS last_measured
FROM propaganda_campaigns pc
LEFT JOIN campaign_metrics cm ON pc.id = cm.campaign_id
GROUP BY pc.id, pc.dystopian_title, pc.propaganda_type, pc.urgency_level
ORDER BY avg(cm.metric_value) DESC NULLS LAST;
```

### 4. `streets`
```sql
SELECT id, name, type, city_id, zone_id, length_km, geojson, created_at, updated_at
FROM city_streets;
-- Einfacher Alias für city_streets
```

### 5. `trend_analysis_dashboard`
```sql
SELECT st.platform, st.sentiment, count(*), avg(st.volume), avg(st.relevance_score),
       count(pc.id) AS campaigns_created,
       count(CASE WHEN pc.integrated_as_event THEN 1 END) AS campaigns_integrated,
       date_trunc('day', st.fetched_at) AS fetch_date
FROM social_trends st
LEFT JOIN propaganda_campaigns pc ON st.id = pc.source_trend_id
WHERE st.fetched_at >= now() - '30 days'::interval
GROUP BY st.platform, st.sentiment, date_trunc('day', st.fetched_at)
ORDER BY fetch_date DESC, count(*) DESC;
```

### 6. `trending_keywords_analysis`
```sql
SELECT tk.keyword, tk.normalized_keyword, tk.frequency, tk.sentiment_score,
       tk.propaganda_potential, tk.category, tk.trends_count, tk.campaigns_count,
       count(tka.trend_id) AS active_associations,
       avg(tka.relevance_score) AS avg_relevance,
       max(tka.extracted_at) AS last_seen_in_trend
FROM trend_keywords tk
LEFT JOIN trend_keyword_associations tka ON tk.id = tka.keyword_id
GROUP BY tk.id, ...
ORDER BY tk.frequency DESC, tk.propaganda_potential DESC;
```

---

## RLS-Status Übersicht

### Tabellen MIT RLS

| Tabelle | Policies | Effektiver Schutz |
|---------|----------|-------------------|
| `agent_propaganda_responses` | ✅ Aktiviert | Keine Policies definiert |
| `agent_trend_interactions` | `USING (true)` | Kein Schutz (permissiv) |
| `api_usage_logs` | ✅ Aktiviert | Keine Policies definiert |
| `building_campaign_support` | `USING (true)` | Kein Schutz |
| `campaign_events` | ✅ Aktiviert | Keine Policies definiert |
| `campaign_metrics` | `USING (true)` | Kein Schutz |
| `campaign_performance_metrics` | ✅ Aktiviert | Keine Policies definiert |
| `locations` | `USING (true) WITH CHECK (true)` | Kein Schutz |
| `propaganda_campaigns` | `USING (true)` | Kein Schutz |
| `propaganda_templates` | ✅ Aktiviert | Keine Policies definiert |
| `social_media_sources` | Admin/Service Only | Echter Schutz |
| `social_trends` | `USING (true)` | Kein Schutz |
| `social_trends_audit` | ✅ Aktiviert | Keine Policies definiert |
| `trend_analysis_sessions` | Owner/Admin | Echter Schutz |
| `trend_keywords` | Public Read | Teilweiser Schutz |
| `trend_keyword_associations` | ✅ Aktiviert | Keine Policies definiert |
| `user_roles` | Read Own + Admin Manage | Echter Schutz |
| `zones` | Authenticated + Service Role | Rollenbasiert |
| `zone_propaganda_influence` | ✅ Aktiviert | Keine Policies definiert |

### Tabellen OHNE RLS (21 Tabellen)

`agents`, `events`, `buildings`, `agent_chats`, `agent_professions`, `building_agent_relations`, `building_event_relations`, `building_profession_requirements`, `cities`, `city_streets`, `event_reactions`, `facebook_posts`, `facebook_comments`, `facebook_agent_reactions`, `prompt_templates`, `prompt_usage_logs`, `prompt_variables`, `user_prompt_customizations`, `campaign_performance_metrics` (teils aktiviert)

---

## Schema-Qualitätsbewertung

| Kategorie | Bewertung | Details |
|-----------|-----------|---------|
| Referentielle Integrität | ❌ Kritisch | 0 FK-Constraints |
| Typ-Konsistenz | ❌ Kritisch | TEXT vs UUID PKs, VARCHAR vs TEXT |
| UUID-Generierung | ⚠️ Inkonsistent | 2 verschiedene Methoden |
| Sprachkonsistenz | ⚠️ Problematisch | DE/EN gemischt |
| Index-Abdeckung | ✅ Gut | ~100 Indexes |
| RLS-Abdeckung | ⚠️ Unvollständig | 16/37, oft permissiv |
| Normalisierung | ⚠️ Problematisch | Redundante Strukturen |
| Erweiterbarkeit | ❌ Kritisch | Feste ENUMs, feste CHECKs |
| Namenskonventionen | ⚠️ Inkonsistent | charakter/hintergrund vs description |
