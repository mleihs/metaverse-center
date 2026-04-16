---
title: "Database Schema: Neues Multi-Simulations-Schema"
id: database-schema
version: "4.1"
date: 2026-04-16
lang: de
type: reference
status: active
tags: [database, schema, rls, functions, triggers]
---

# 03 - Database Schema New: Neues Schema mit Simulation-Kontext

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

## Datenbank-Logik-Philosophie

### Kernthese: Datenbank-Logik gehoert in die Datenbank

metaverse.center verfolgt eine **Database-First-Strategie**: Geschaeftslogik, die Dateninvarianten schuetzt, abgeleitete Daten berechnet oder atomare Multi-Tabellen-Operationen ausfuehrt, wird in PostgreSQL implementiert — nicht in der Anwendungsschicht. Die Datenbank ist die letzte Verteidigungslinie; sie kann nicht durch Application-Bugs, Race Conditions oder fehlende Service-Aufrufe umgangen werden.

### Drei Kategorien von Datenbank-Logik

**1. Invarianten-Schutz (Triggers)**

Triggers schuetzen Zustaende, die unter keinen Umstaenden verletzt werden duerfen:

- **State Machines:** `validate_simulation_status_transition()`, `validate_epoch_status_transition()` — Nur definierte Uebergaenge erlaubt (z.B. `draft→configuring→active`, `active→archived→active` fuer Restore, nicht `archived→draft`)
- **Slug-Immutabilitaet:** `immutable_slug()` — Einmal gesetzte Slugs koennen nicht mehr geaendert werden (URL-Stabilitaet, SEO)
- **Last-Owner-Guard:** `prevent_last_owner_removal()` — Letzte/r Owner kann nicht entfernt werden (Waisen-Simulation-Verhinderung)
- **Primaer-Profession-Exklusivitaet:** `enforce_single_primary_profession()` — Genau eine `is_primary=true` pro Agent
- **Reaction-Modifier:** `recompute_reaction_modifier()` — Automatische Neuberechnung bei Event-Reactions-Aenderungen
- **Resonanz-Ableitung:** `fn_derive_resonance_fields()` — Signature/Archetype automatisch aus source_category abgeleitet
- **Allianz-Abstimmung:** `fn_resolve_alliance_proposal()` — Automatische Antragsentscheidung bei Vote-Eingang (Reject → sofort, Unanimity → Beitritt)
- **Allianz-Tension:** `fn_check_alliance_tension()` — Automatische Team-Aufloesung bei Tension >= 80

**2. Abgeleitete Daten (Materialized Views, Trigger-berechnete Felder)**

Abgeleitete Metriken werden einmal berechnet und bei Quelldaten-Aenderung invalidiert:

- **4 Materialized Views:** `mv_building_readiness`, `mv_zone_stability`, `mv_embassy_effectiveness`, `mv_simulation_health` — Single Source of Truth fuer Spiel-Metriken
- **11 Stale-Notification-Triggers:** Bei Aenderung an Quell-Tabellen → `pg_notify('game_metrics_stale')` → Backend refresht MVs
- **Effektive Magnitude:** `compute_effective_magnitude()` — Trigger-basierte Resonanz-Staerke-Berechnung
- **Architect-Flag-Sync:** `fn_sync_architect_flag()` — Leitet `is_architect` Boolean aus `account_tier` ab (Abwaertskompatibilitaet)

**3. Atomare Komplex-Operationen (PL/pgSQL Functions)**

Operationen, die mehrere Tabellen atomar modifizieren muessen:

- **`clone_simulations_for_epoch()`** (~250 Zeilen) — Klont Template-Simulationen inkl. Settings, Taxonomien, Stadt, Zonen, Strassen, Agenten, Gebaeude + normalisiert Werte fuer PvP-Balance
- **`fn_materialize_shard()`** — Konvertiert Forge-Entwurf in Live-Simulation (Simulation + Settings + Taxonomien + Stadt + Zonen + Strassen + Agenten + Gebaeude atomar). Seit Migration 112: Bilingual — inseriert `_de`-Spalten (z.B. `character_de`, `description_de`) aus dem Draft-JSONB. Seit Migration 121: Setzt `critical_health_effects_enabled = false` (Kategorie `game`) — neue Simulationen starten ohne kritische Health-Effekte. Seit Migration 122: Persistiert philosophische Anchor-Felder (title, core_question, literary_influence, description, bleed_signature_suggestion, seed_prompt + alle `_de`-Varianten) zu `simulation_settings` mit `category='anchor'`
- **`fn_approve_forge_access()`** — Atomare Genehmigung: Request sperren + Wallet-Tier upgraden + User-Details zurueckgeben
- **`fn_reject_forge_access()`** — Atomare Ablehnung: Request sperren + Status setzen + User-Details zurueckgeben
- **`process_cascade_events()`** — Auto-Spawn von Kaskaden-Events bei Zone-Druck-Ueberschreitung, rate-limited pro Zone
- **`get_forge_progress()`** — Zeremonie- und Post-Ceremony-Bildfortschritt: Zählt fertige Bilder (Banner + Agents + Buildings + Lore) + per-Entity Image-URLs. `simulation_lore.image_generated_at` trackt Lore-Bild-Completion. Liefert `banner_url`, `agents`, `buildings`, `lore`-Arrays + `total`/`completed`/`done` + `lore_progress` (Migration 098, erweitert Migration 107, erweitert Migration 123)
- **`get_bleed_status()`** — Aggregierter Bleed-Status: Health, Echoes, Foreign Themes, Lore in einem Round-Trip (Migration 099). SECURITY DEFINER (seit Migration 120) fuer Zugriff auf `platform_settings`. Gibt `effects_suppressed` zurueck (Admin-Toggle fuer kritische Health-Effekte)
- **`get_map_overlay_data()`** — Zone-Topologie + historische Events + Bleed-Details fuer Karten-Overlay in einem Call (Migration 100)

### Entscheidungsmatrix: Wo lebt die Logik?

| Kriterium | PostgreSQL | FastAPI | Frontend |
|-----------|-----------|---------|----------|
| Schuetzt Daten-Invariante? | **Ja** | Nein | Nein |
| Atomar ueber mehrere Tabellen? | **Ja** | Nein | Nein |
| Berechnet abgeleitete Metriken? | **Ja** (MVs) | Refresht MVs | Rendert |
| Orchestriert externe APIs? | Nein | **Ja** | Nein |
| Validiert User-Input? | CHECK/RLS | **Pydantic** | Zod |
| Steuert UI-Zustand? | Nein | Nein | **Ja** |

> **Faustregel:** Wenn die Logik eine Daten-Invariante schuetzt oder atomar mehrere Tabellen modifiziert → PostgreSQL. Wenn sie externe APIs orchestriert → FastAPI. Wenn sie UI-Zustand steuert → Frontend.

Siehe auch: [ADR-007](../adr/007-database-logic-in-database.md) | [Platform Architecture](../specs/platform-architecture.md) | [Logic Distribution Summary](#logic-distribution-summary)

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
    deleted_at timestamptz,
    lore_progress jsonb DEFAULT NULL                    -- Forge lore generation progress (Migration 123)
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
    slug text NOT NULL,                               -- Auto-generated from name (Migration 137)
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
CREATE INDEX idx_agents_sim_slug ON agents(simulation_id, slug);
-- UNIQUE(simulation_id, slug) constraint enforced separately
```

**Renames:**
- `created_by_user` -> `created_by_id` (FK-Suffix-Konvention)

**Neu:**
- `slug` — auto-generated from name via `BEFORE INSERT` trigger `trg_agents_auto_slug` (Migration 137). Collision handling appends `-2`, `-3` etc. Immutable via `trg_agents_slug_immutable`. `UNIQUE(simulation_id, slug)`.
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
    slug text NOT NULL,                               -- Auto-generated from name (Migration 137)
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
CREATE INDEX idx_buildings_sim_slug ON buildings(simulation_id, slug);
-- UNIQUE(simulation_id, slug) constraint enforced separately
```

**Renames:**
- `type` -> `building_type` (SQL reserved word)
- `condition` -> `building_condition` (SQL reserved word)

**Neu:**
- `search_vector` generated column + GIN index
- `slug` — auto-generated from name via `BEFORE INSERT` trigger `trg_buildings_auto_slug` (Migration 137). Same collision handling as agents. Immutable via `trg_buildings_slug_immutable`. `UNIQUE(simulation_id, slug)`.
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

### `chat_message_reactions`

Emoji reactions on chat messages. Toggle-based (add/remove via atomic Postgres RPC). Aggregation via `get_message_reactions` RPC returns per-emoji counts with `reacted_by_me` flag.

```sql
CREATE TABLE public.chat_message_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_chat_reactions_message ON chat_message_reactions(message_id);
```

**RLS:** Select for all, insert/delete own only. **RPCs:** `toggle_message_reaction(UUID, TEXT)` (atomic toggle), `get_message_reactions(UUID[])` (batch aggregation). **Broadcast:** `trg_broadcast_chat_reaction` fires on INSERT/DELETE to `chat:{conversation_id}:reactions` channel.

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

-- Game weight fallback: Returns weight factor for game mechanics taxonomy values
CREATE OR REPLACE FUNCTION public.game_weight_fallback(p_taxonomy_type text, p_value text)
RETURNS numeric AS $$
    -- Returns a weight factor (0.0-1.0) for game mechanics calculations.
    -- Falls back to sensible defaults when taxonomy metadata lacks explicit weights.
$$ LANGUAGE sql IMMUTABLE;
```

### Game-Mechanics Functions (Migration 031-032, 037)

```sql
-- Refresh all 4 game-mechanics materialized views
CREATE OR REPLACE FUNCTION public.refresh_all_game_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_building_readiness;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_zone_stability;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_embassy_effectiveness;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_simulation_health;
END;
$$ LANGUAGE plpgsql;

-- Individual view refreshes
CREATE OR REPLACE FUNCTION public.refresh_building_readiness()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_building_readiness;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_zone_stability()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_zone_stability;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_embassy_effectiveness()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_embassy_effectiveness;
END;
$$ LANGUAGE plpgsql;

-- Agent influence score for building readiness pipeline (Migration 158)
-- Formula: relationships(top5 avg/10) × 0.4 + professions(avg ql/10) × 0.3 + ambassador × 0.3
CREATE OR REPLACE FUNCTION fn_compute_agent_influence(p_agent_id UUID, p_simulation_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = public;
-- Used by: mv_building_readiness CTE agent_influence

-- Bootstrap building_agent_relations from agents.current_building_id (Migration 160)
-- Creates 'works' records for agents assigned to buildings. Idempotent (ON CONFLICT DO NOTHING).
-- Pass NULL for all simulations, or specific UUID for single-sim bootstrap.
CREATE OR REPLACE FUNCTION fn_bootstrap_building_relations(p_simulation_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
-- Used by: personality_extraction_service.initialize_simulation_agents(), migration 160 bulk backfill

-- Trigger function: Sends pg_notify when game-metrics-relevant data changes
CREATE OR REPLACE FUNCTION public.notify_game_metrics_stale()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('game_metrics_stale', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Validates epoch status state machine transitions
CREATE OR REPLACE FUNCTION public.validate_epoch_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions jsonb := '{
        "lobby": ["foundation", "cancelled"],
        "foundation": ["competition", "cancelled"],
        "competition": ["reckoning", "cancelled"],
        "reckoning": ["completed", "cancelled"],
        "completed": [],
        "cancelled": []
    }'::jsonb;
    allowed jsonb;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    allowed := valid_transitions -> OLD.status;
    IF allowed IS NULL OR NOT (allowed ? NEW.status) THEN
        RAISE EXCEPTION 'Invalid epoch status transition: % -> %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Broadcasts new epoch chat messages via Supabase Realtime (Migration 037)
-- Sends to epoch:{epoch_id}:chat (epoch-wide) or epoch:{epoch_id}:team:{team_id}:chat (team-only)
CREATE OR REPLACE FUNCTION broadcast_epoch_chat()
RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: Broadcasts cycle_ready changes via Supabase Realtime (Migration 037)
-- Sends to epoch:{epoch_id}:status
CREATE OR REPLACE FUNCTION broadcast_ready_signal()
RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Epoch-Management Functions (Migrationen 035, 047, 060)

```sql
-- Atomares Klonen von Template-Simulationen fuer kompetitive Epochs (~250 Zeilen)
-- Klont: simulation + settings + taxonomies + city + zones + streets + agents + buildings
-- Normalisiert: agent_cap (max 6), building_cap (max 8), condition→'good', capacity→30,
--   security_level (1×high, 2×medium, 1×low), aptitudes (alle→5)
-- Siehe ADR-005 in Platform Architecture (`../specs/platform-architecture.md`)
CREATE OR REPLACE FUNCTION clone_simulations_for_epoch(
    p_epoch_id UUID, p_created_by_id UUID, p_epoch_number INTEGER DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER;

-- Archiviert Game-Instances nach Epoch-Abschluss (simulation_type→'archived')
CREATE OR REPLACE FUNCTION archive_epoch_instances(p_epoch_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER;

-- Loescht Game-Instances bei Epoch-Abbruch (Reverse-FK-Reihenfolge)
CREATE OR REPLACE FUNCTION delete_epoch_instances(p_epoch_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER;
```

### Alliance Functions (Migration 081)

```sql
-- Trigger Function: Automatische Antragsentscheidung bei Vote-Eingang
-- Ablehnung (reject) → sofortige Zurueckweisung (status='rejected')
-- Einstimmige Annahme (alle Team-Mitglieder accept) → Antragsteller tritt Team bei
CREATE OR REPLACE FUNCTION fn_resolve_alliance_proposal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function: Automatische Team-Aufloesung bei Tension >= 80
-- Setzt dissolved_at + dissolved_reason, entfernt team_id von allen Mitgliedern
CREATE OR REPLACE FUNCTION fn_check_alliance_tension()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER;

-- Laesst abgelaufene Allianz-Antraege verfallen (status → 'expired')
-- Aufgerufen waehrend Zyklusaufloesung
CREATE OR REPLACE FUNCTION fn_expire_alliance_proposals(
    p_epoch_id UUID, p_current_cycle INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER;

-- Zieht Allianz-Unterhaltskosten ab: 1 RP pro Mitglied von jedem Allianz-Mitglied
-- Aufgerufen waehrend Zyklusaufloesung
CREATE OR REPLACE FUNCTION fn_deduct_alliance_upkeep(p_epoch_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER;

-- Berechnet Allianz-Tension aus ueberlappenden Angriffen
-- Wenn Team-Mitglieder dieselben Ziele angreifen oder sich gegenseitig angreifen → Tension steigt
CREATE OR REPLACE FUNCTION fn_compute_alliance_tension(
    p_epoch_id UUID, p_cycle_number INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER;
```

### Forge-Materialisierung (Migrationen 055/056/058/122)

```sql
-- Konvertiert Forge-Entwurf in Live-Simulation. Atomar erstellt:
-- simulation + simulation_settings + simulation_taxonomies + city + zones + streets + agents + buildings
-- Setzt Forge-Guthaben (user_wallets) ein. Gibt neue simulation_id zurueck.
-- Migration 122: Persistiert philosophical anchor fields (title, core_question,
-- literary_influence, description, bleed_signature_suggestion, seed_prompt + _de Varianten)
-- zu simulation_settings mit category='anchor'. Anon RLS auf 'anchor' erweitert.
CREATE OR REPLACE FUNCTION public.fn_materialize_shard(p_draft_id uuid)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER;

-- Quota-Enforcement: Prueft user_wallets.forge_credits > 0 vor Materialisierung
CREATE OR REPLACE FUNCTION public.fn_enforce_forge_quota()
RETURNS TRIGGER LANGUAGE plpgsql;
```

### Forge Access Functions (Migration 093)

```sql
-- Atomare Genehmigung: Sperrt Request (FOR UPDATE), setzt status='approved',
-- Upsert user_wallets mit neuem account_tier (Trigger synct is_architect),
-- Grantet 3 Starter-Tokens (Lock Wallet, Credit forge_tokens, Ledger-Eintrag
-- via admin-grant Bundle mit payment_reference='clearance_welcome').
-- Gibt {request_id, user_id, user_email, email_locale, requested_tier, status,
--       tokens_granted, balance_after} zurueck.
-- Migration 118 erweitert mit Starter-Token-Grant.
CREATE OR REPLACE FUNCTION public.fn_approve_forge_access(
    p_request_id uuid, p_admin_notes text DEFAULT NULL, p_reviewer_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER;

-- Ablehnung: Sperrt Request, setzt status='rejected',
-- Gibt User-Details fuer E-Mail-Benachrichtigung zurueck.
CREATE OR REPLACE FUNCTION public.fn_reject_forge_access(
    p_request_id uuid, p_admin_notes text DEFAULT NULL, p_reviewer_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Synchronisiert is_architect aus account_tier (Abwaertskompatibilitaet)
-- is_architect := (account_tier != 'observer')
CREATE OR REPLACE FUNCTION public.fn_sync_architect_flag()
RETURNS TRIGGER LANGUAGE plpgsql;
```

### Chronicle & Memory Functions (Migrationen 066/067)

```sql
-- Aggregiert Quell-Daten fuer AI-Chronicle-Generierung:
-- Events, Echoes, Battle-Log, Agent-Reactions der letzten p_days Tage
-- Gibt JSONB zurueck mit events[], echoes[], battles[], reactions[]
CREATE OR REPLACE FUNCTION get_chronicle_source_data(
    p_simulation_id UUID, p_days INTEGER DEFAULT 7
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER;

-- pgvector-basierte Agent-Memory-Abfrage (Stanford Generative Agents-Stil)
-- Scoring: 0.4 × cosine_similarity + 0.4 × (importance/10) + 0.2 × recency_decay
-- Gibt TABLE(id, content, importance, memory_type, created_at, relevance_score) zurueck
CREATE OR REPLACE FUNCTION retrieve_agent_memories(
    p_agent_id UUID, p_query_embedding vector(1536), p_limit INTEGER DEFAULT 10
) RETURNS TABLE LANGUAGE plpgsql SECURITY DEFINER;
```

### Security & Wallet RPC Functions (Migrationen 125/126)

```sql
-- SECURITY DEFINER: Aktualisiert/loescht verschluesselte BYOK-Keys fuer den aufrufenden User.
-- Ersetzt service_role-Bypass (user_wallets RLS erlaubt nur SELECT fuer Owner).
-- Validiert auth.uid() = p_user_id.
-- Migration 218: p_clear_openrouter/p_clear_replicate Boolean-Flags zum gezielten Loeschen einzelner Keys.
CREATE OR REPLACE FUNCTION public.fn_update_user_byok_keys(
    p_user_id uuid, p_encrypted_openrouter_key text DEFAULT NULL, p_encrypted_replicate_key text DEFAULT NULL,
    p_clear_openrouter boolean DEFAULT false, p_clear_replicate boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER;

-- Single UPDATE fuer RP-Grants an alle Epoch-Teilnehmer.
-- Verwendet LEAST() fuer Cap-Enforcement statt Python-seitiger Gruppierung.
CREATE OR REPLACE FUNCTION public.fn_batch_grant_rp(
    p_epoch_id uuid, p_amount integer, p_rp_cap integer
) RETURNS integer LANGUAGE sql SECURITY DEFINER;
```

### Scoring & Draft RPC Functions (Migrationen 127/128)

```sql
-- Komplette Cycle-Scoring-Berechnung in einem SQL-Call.
-- CTE-Kette: zone_stab, propaganda, inbound_missions, outbound_missions,
-- echo_strength, embassy_data, team_data, guardian_counts → raw_scores → maxes → normalized → composited.
-- Ersetzt 12 per-Simulation Python-Queries.
CREATE OR REPLACE FUNCTION public.fn_compute_cycle_scores(
    p_epoch_id uuid, p_cycle_number integer, p_score_weights jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-Draft: Selektiert die besten Agenten pro Teilnehmer basierend auf Aptitude-Summen.
-- Ersetzt N per-Participant Python-Loop durch ein einziges UPDATE ... FROM.
CREATE OR REPLACE FUNCTION public.fn_auto_draft_participants(
    p_epoch_id uuid, p_max_agents integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER;
```

### Admin-RPC Functions (Migrationen 040/057/113)

```sql
-- SECURITY DEFINER: Direkter auth.users-Zugriff (umgeht GoTrue HS256/ES256-Problem)
-- Alle drei erfordern service_role-Berechtigung via is_platform_admin()
-- Siehe ADR-006 in Platform Architecture (`../specs/platform-architecture.md`) und 10_AUTH_AND_SECURITY.md
CREATE OR REPLACE FUNCTION public.admin_list_users(p_page integer, p_per_page integer)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 113: DROP + CREATE (Return-Type-Wechsel boolean→void).
-- Transferiert Simulation-Ownership an Platform-Admin, nullifiziert Audit/Referenz-FKs,
-- loescht user-owned Records, dann DELETE FROM auth.users (CASCADE fuer Rest).
CREATE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER;
```

### Campaign & War-Room Analytics (Migration 065)

```sql
-- Kampagnen-Performance-Analytik: Engagement, Reichweite, Konversionsraten
CREATE OR REPLACE FUNCTION get_campaign_analytics(p_simulation_id uuid, p_campaign_id uuid)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER;

-- Zyklus-Kampf-Zusammenfassung fuer War-Room-Dashboard
CREATE OR REPLACE FUNCTION get_cycle_battle_summary(p_epoch_id uuid, p_cycle integer)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER;

-- Cross-Sim Narrative Bleed Feed (Event-Echoes + Battle-Log)
CREATE OR REPLACE FUNCTION get_bleed_gazette_feed(p_limit int DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql;
```

### Event-Processing Functions (Migrationen 071/072/073)

```sql
-- Trigger Function: Berechnet dominant_sentiment + reaction_modifier aus event_reactions
-- Emotions-Gewichtung: fear=0.35, anger=0.25, support=0.20, defiance=0.15, indifference=0.05
-- Aktualisiert events.metadata JSONB mit reaction_modifier und dominant_sentiment
CREATE OR REPLACE FUNCTION recompute_reaction_modifier()
RETURNS TRIGGER LANGUAGE plpgsql;

-- Automatische Zone-Zuweisung fuer Events basierend auf zone_gravity
-- Events ohne zone_id erhalten gewichtete Zufalls-Zuweisung
CREATE OR REPLACE FUNCTION assign_event_zones()
RETURNS TRIGGER LANGUAGE plpgsql;

-- Auto-Spawn von Kaskaden-Events bei Zone-Druck-Ueberschreitung
-- Prueft mv_zone_stability.event_pressure > threshold (aus simulation_settings)
-- Rate-Limited: max 1 Kaskade pro Zone pro 24h
-- Gibt TABLE(event_id UUID, zone_name TEXT) zurueck
CREATE OR REPLACE FUNCTION process_cascade_events(p_simulation_id UUID)
RETURNS TABLE(event_id UUID, zone_name TEXT) LANGUAGE plpgsql SECURITY DEFINER;
```

### Resonance Functions (Migrationen 074/076)

```sql
-- BEFORE INSERT Trigger: Leitet signature + archetype aus source_category ab
-- Mapping: z.B. 'political'→signature='authority', archetype='control'
CREATE OR REPLACE FUNCTION fn_derive_resonance_fields()
RETURNS TRIGGER LANGUAGE plpgsql;

-- Berechnet Resonanz-Empfaenglichkeit einer Simulation fuer eine Signatur
-- Basiert auf aktiven Resonanzen, Zone-Stabilitaet, und historischem Decay
CREATE OR REPLACE FUNCTION fn_get_resonance_susceptibility(
    p_simulation_id UUID, p_signature TEXT
) RETURNS numeric LANGUAGE plpgsql;

-- Gibt Event-Typen zurueck, die durch eine Resonanz-Signatur ausgeloest werden koennen
CREATE OR REPLACE FUNCTION fn_get_resonance_event_types(
    p_simulation_id UUID, p_signature TEXT
) RETURNS text[] LANGUAGE plpgsql;

-- Trigger: Validiert impact_started_at bei Resonanz-Abschluss
CREATE OR REPLACE FUNCTION check_resonance_impact_time()
RETURNS TRIGGER LANGUAGE plpgsql;

-- Trigger: Berechnet effective_magnitude aus base_magnitude × modifiers
CREATE OR REPLACE FUNCTION compute_effective_magnitude()
RETURNS TRIGGER LANGUAGE plpgsql;
```

### Hilfs-Functions

```sql
-- Template-ID-Aufloesung: Gibt source_template_id oder eigene ID zurueck
CREATE OR REPLACE FUNCTION resolve_template_id(sim_id uuid)
RETURNS UUID LANGUAGE plpgsql;

-- Platform-Admin-Pruefung via auth.jwt() Email-Check
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER;

-- Batch-E-Mail-Abfrage fuer Benachrichtigungen (SECURITY DEFINER fuer auth.users)
CREATE OR REPLACE FUNCTION get_user_emails_batch(user_ids UUID[])
RETURNS TABLE LANGUAGE plpgsql SECURITY DEFINER;
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

-- Epoch status transitions (Migration 032)
CREATE TRIGGER trg_epoch_status BEFORE UPDATE ON game_epochs
    FOR EACH ROW EXECUTE FUNCTION validate_epoch_status_transition();

-- Game metrics stale notification (Migration 031)
-- Applied to buildings, building_agent_relations, building_profession_requirements, zones, embassies
CREATE TRIGGER trg_buildings_metrics_stale AFTER INSERT OR UPDATE OR DELETE ON buildings
    FOR EACH ROW EXECUTE FUNCTION notify_game_metrics_stale();
CREATE TRIGGER trg_bar_metrics_stale AFTER INSERT OR UPDATE OR DELETE ON building_agent_relations
    FOR EACH ROW EXECUTE FUNCTION notify_game_metrics_stale();
CREATE TRIGGER trg_bpr_metrics_stale AFTER INSERT OR UPDATE OR DELETE ON building_profession_requirements
    FOR EACH ROW EXECUTE FUNCTION notify_game_metrics_stale();
CREATE TRIGGER trg_zones_metrics_stale AFTER INSERT OR UPDATE OR DELETE ON zones
    FOR EACH ROW EXECUTE FUNCTION notify_game_metrics_stale();
CREATE TRIGGER trg_embassies_metrics_stale AFTER INSERT OR UPDATE OR DELETE ON embassies
    FOR EACH ROW EXECUTE FUNCTION notify_game_metrics_stale();

-- Broadcast epoch chat messages to Realtime channels (Migration 037)
CREATE TRIGGER trg_broadcast_epoch_chat AFTER INSERT ON epoch_chat_messages
    FOR EACH ROW EXECUTE FUNCTION broadcast_epoch_chat();

-- Broadcast ready signal changes to Realtime channels (Migration 037)
CREATE TRIGGER trg_broadcast_ready_signal AFTER UPDATE OF cycle_ready ON epoch_participants
    FOR EACH ROW EXECUTE FUNCTION broadcast_ready_signal();

-- Forge quota enforcement (Migration 055)
CREATE TRIGGER trg_enforce_forge_quota BEFORE INSERT ON forge_drafts
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_forge_quota();

-- Reaction modifier recomputation (Migration 071)
CREATE TRIGGER trg_recompute_reaction_modifier AFTER INSERT OR UPDATE OR DELETE ON event_reactions
    FOR EACH ROW EXECUTE FUNCTION recompute_reaction_modifier();

-- Automatic event zone assignment (Migration 072)
CREATE TRIGGER trg_assign_event_zones BEFORE INSERT ON events
    FOR EACH ROW EXECUTE FUNCTION assign_event_zones();

-- Resonance field derivation (Migration 076)
CREATE TRIGGER trg_derive_resonance_fields BEFORE INSERT ON substrate_resonances
    FOR EACH ROW EXECUTE FUNCTION fn_derive_resonance_fields();

-- Resonance completion validation (Migration 074)
CREATE TRIGGER trg_check_resonance_completion BEFORE UPDATE ON substrate_resonances
    FOR EACH ROW EXECUTE FUNCTION check_resonance_impact_time();

-- Resonance effective magnitude computation (Migration 074)
CREATE TRIGGER trg_compute_effective_magnitude BEFORE INSERT OR UPDATE ON substrate_resonances
    FOR EACH ROW EXECUTE FUNCTION compute_effective_magnitude();

-- Alliance proposal resolution (Migration 081)
CREATE TRIGGER trg_resolve_alliance_proposal AFTER INSERT ON epoch_alliance_votes
    FOR EACH ROW EXECUTE FUNCTION fn_resolve_alliance_proposal();

-- Alliance tension dissolution check (Migration 081)
CREATE TRIGGER trg_alliance_tension_check AFTER UPDATE OF tension ON epoch_teams
    FOR EACH ROW EXECUTE FUNCTION fn_check_alliance_tension();

-- Account tier → is_architect sync (Migration 093)
CREATE TRIGGER trg_sync_architect_flag BEFORE INSERT OR UPDATE OF account_tier ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION fn_sync_architect_flag();

-- updated_at Triggers fuer neuere Tabellen (Migrationen 055, 074)
CREATE TRIGGER trg_user_wallets_updated_at BEFORE UPDATE ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_forge_drafts_updated_at BEFORE UPDATE ON forge_drafts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_resonance_updated_at BEFORE UPDATE ON substrate_resonances
    FOR EACH ROW EXECUTE FUNCTION update_resonance_updated_at();
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
        s.description,
        s.description_de,
        s.status,
        s.theme,
        s.content_locale,
        s.additional_locales,
        s.owner_id,
        s.icon_url,
        s.banner_url,
        s.simulation_type,
        s.source_template_id,
        s.epoch_id,
        (SELECT count(*) FROM simulation_members sm WHERE sm.simulation_id = s.id) AS member_count,
        (SELECT count(*) FROM agents a WHERE a.simulation_id = s.id AND a.deleted_at IS NULL) AS agent_count,
        (SELECT count(*) FROM buildings b WHERE b.simulation_id = s.id AND b.deleted_at IS NULL) AS building_count,
        (SELECT count(*) FROM events e WHERE e.simulation_id = s.id AND e.deleted_at IS NULL) AS event_count,
        s.archived_at,
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

### Forge Access View (Migration 093)

```sql
-- Admin-View: Offene Forge-Zugangsantraege mit User-E-Mail
CREATE OR REPLACE VIEW public.v_pending_forge_requests AS
SELECT
    far.id,
    far.user_id,
    u.email AS user_email,
    far.requested_tier,
    far.status,
    far.message,
    far.admin_notes,
    far.reviewed_by,
    far.created_at,
    far.reviewed_at
FROM public.forge_access_requests far
JOIN auth.users u ON u.id = far.user_id
WHERE far.status = 'pending'
ORDER BY far.created_at ASC;
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

### Game-Mechanics Materialized Views (Migration 031)

4 materialisierte Views fuer berechnete Spielmetriken. Werden via `refresh_all_game_metrics()` oder einzeln aktualisiert.

```sql
-- Building readiness: Berechnet Bereitschaft basierend auf Staffing, Condition, Population
CREATE MATERIALIZED VIEW public.mv_building_readiness AS
    SELECT
        b.id AS building_id,
        b.simulation_id,
        b.name,
        b.building_type,
        b.building_condition,
        b.population_capacity,
        count(DISTINCT bar.agent_id) AS assigned_agents,
        count(DISTINCT bpr.id) AS required_professions,
        -- staffing_ratio, condition_score, readiness berechnet
        ...
    FROM buildings b
    LEFT JOIN building_agent_relations bar ON b.id = bar.building_id
    LEFT JOIN building_profession_requirements bpr ON b.id = bpr.building_id
    WHERE b.deleted_at IS NULL
    GROUP BY b.id;

CREATE UNIQUE INDEX idx_mv_building_readiness_pk ON mv_building_readiness(building_id);

-- Zone stability: Berechnet Stabilitaet basierend auf Building Readiness und Security Level
CREATE MATERIALIZED VIEW public.mv_zone_stability AS
    SELECT
        z.id AS zone_id,
        z.simulation_id,
        z.name,
        z.zone_type,
        z.security_level,
        -- avg_readiness, building_count, stability berechnet
        ...
    FROM zones z
    LEFT JOIN buildings b ON b.zone_id = z.id AND b.deleted_at IS NULL
    LEFT JOIN mv_building_readiness mbr ON b.id = mbr.building_id
    GROUP BY z.id;

CREATE UNIQUE INDEX idx_mv_zone_stability_pk ON mv_zone_stability(zone_id);

-- Embassy effectiveness: Berechnet Effektivitaet basierend auf Building Health, Ambassador Quality, Vector Alignment
CREATE MATERIALIZED VIEW public.mv_embassy_effectiveness AS
    SELECT
        e.id AS embassy_id,
        e.simulation_a_id,
        e.simulation_b_id,
        e.status,
        e.bleed_vector,
        -- building_health, ambassador_quality, vector_alignment, effectiveness berechnet
        ...
    FROM embassies e
    LEFT JOIN buildings ba ON e.building_a_id = ba.id
    LEFT JOIN buildings bb ON e.building_b_id = bb.id;

CREATE UNIQUE INDEX idx_mv_embassy_effectiveness_pk ON mv_embassy_effectiveness(embassy_id);

-- Simulation health: Aggregiert Zone-Stabilitaet, Building Readiness, Diplomatic Reach, Bleed Permeability
CREATE MATERIALIZED VIEW public.mv_simulation_health AS
    SELECT
        s.id AS simulation_id,
        s.name,
        -- avg_zone_stability, avg_readiness, diplomatic_reach, bleed_permeability, overall_health berechnet
        ...
    FROM simulations s
    WHERE s.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_mv_simulation_health_pk ON mv_simulation_health(simulation_id);
```

**Spalten pro View:**
- **mv_building_readiness:** `building_id`, `simulation_id`, `zone_id`, `building_name`, `building_type`, `building_condition`, `population_capacity`, `special_type`, `assigned_agents`, `staffing_ratio`, `staffing_status`, `qualification_match`, `condition_factor`, `criticality_weight`, `avg_influence`, `influence_factor`, `readiness` (migration 158: added `avg_influence` + `influence_factor`, readiness formula now includes influence)
- **mv_zone_stability:** `zone_id`, `simulation_id`, `name`, `zone_type`, `security_level`, `building_count`, `avg_readiness`, `stability`
- **mv_embassy_effectiveness:** `embassy_id`, `simulation_a_id`, `simulation_b_id`, `status`, `bleed_vector`, `building_health`, `ambassador_quality`, `vector_alignment`, `effectiveness`
- **mv_simulation_health:** `simulation_id`, `name`, `avg_zone_stability`, `avg_readiness`, `diplomatic_reach`, `bleed_permeability`, `overall_health`

---

## RLS-Policies (alle Tabellen)

### RLS-Helper-Funktionen

```sql
-- Funktion: Prueft ob User Mitglied der Simulation ist ODER Epoch-Teilnehmer mit dieser Simulation
-- (Migration 049: erweitert um epoch_participants Check)
CREATE OR REPLACE FUNCTION public.user_has_simulation_access(sim_id uuid)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM simulation_members
        WHERE simulation_id = sim_id AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM epoch_participants
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
| `embassies` | Anon/Member | Admin+ | Admin+ | Admin+ |
| `game_epochs` | Anon/Member | Auth | Auth | - |
| `epoch_teams` | Anon/Member | Auth | Auth | - |
| `epoch_participants` | Anon/Member | Auth (user_id=uid) | Auth | Own (user_id=uid) |
| `epoch_alliance_proposals` | Anon/Member | Participant | - | - |
| `epoch_alliance_votes` | Team+Proposer | Team Member | - | - |
| `operative_missions` | Source/Target Member | Source Member | Source Owner | - |
| `epoch_scores` | Anon/Member | Auth | - | - |
| `battle_log` | Public/Member | Auth | - | - |
| `epoch_invitations` | Creator/Anon(token) | Creator | Creator | Creator |
| `epoch_chat_messages` | Anon(epoch)/Participant(epoch+team) | Participant | - | - |
| `notification_preferences` | Own (auth) | Own (auth) | Own (auth) | - |
| `zone_fortifications` | Epoch-Participant (own sim) | Editor+ (own sim) | - | - |
| `agent_aptitudes` | Anon/Member | Editor+ | Editor+ | Admin+ |
| `forge_access_requests` | Own (auth) + Admin | Own (auth) | Admin | - |
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
| Tabellen | 58 (inkl. Forge, Chronicle, Agent Memory, Substrate Resonance, Alliance, Forge Access, Token Economy, Feature Purchases) |
| Trigger Functions | 20 (set_updated_at, update_conversation_stats, enforce_single_primary_profession, validate_simulation_status_transition, immutable_slug, prevent_last_owner_removal, notify_game_metrics_stale, validate_epoch_status_transition, broadcast_epoch_chat, broadcast_ready_signal, fn_enforce_forge_quota, recompute_reaction_modifier, assign_event_zones, fn_derive_resonance_fields, update_resonance_updated_at, check_resonance_impact_time, compute_effective_magnitude, fn_resolve_alliance_proposal, fn_check_alliance_tension, fn_sync_architect_flag) |
| Utility Functions | 12 (role_meets_minimum, generate_slug, validate_taxonomy_value, game_weight_fallback, refresh_all_game_metrics, refresh_building_readiness, refresh_embassy_effectiveness, refresh_zone_stability, resolve_template_id, is_platform_admin, get_user_emails_batch, get_bleed_gazette_feed) |
| Epoch/Forge/Chronicle Functions | 27 (clone_simulations_for_epoch, archive_epoch_instances, delete_epoch_instances, fn_materialize_shard, get_chronicle_source_data, retrieve_agent_memories, get_campaign_analytics, get_cycle_battle_summary, process_cascade_events, fn_get_resonance_susceptibility, fn_get_resonance_event_types, assign_event_zones, fn_expire_alliance_proposals, fn_deduct_alliance_upkeep, fn_compute_alliance_tension, fn_approve_forge_access, fn_reject_forge_access, fn_purchase_tokens, fn_admin_grant_tokens, fn_purchase_feature, fn_refund_feature, fn_darkroom_use_regen, fn_user_byok_allowed, fn_update_user_byok_keys, fn_batch_grant_rp, fn_compute_cycle_scores, fn_auto_draft_participants) |
| Admin RPC Functions | 3 (admin_list_users, admin_get_user, admin_delete_user) |
| RLS Functions | 4 (user_has_simulation_access, user_has_simulation_role, user_simulation_role, role_meets_minimum) |
| Functions gesamt | ~70 (ohne unaccent-Varianten und interne Helfer; +fn_compute_agent_influence mig 158, +fn_bootstrap_building_relations mig 160, +fn_add_moodlet_capped mig 162, +fn_apply_zone_need_modifiers mig 162) |
| Triggers | 56 Eintraege (19 unique Trigger-Functions auf 56 Tabellen/Spalten-Kombinationen) |
| Regular Views | 10 (4x active_* + simulation_dashboard + conversation_summaries + agent_statistics + campaign_performance + v_pending_forge_requests + token_economy_stats) |
| Materialized Views | 4 (mv_building_readiness + mv_zone_stability + mv_embassy_effectiveness + mv_simulation_health) |
| RLS-Policies | 246+ (inkl. anon SELECT + Forge + Chronicle + Resonance + Alliance + Forge Access + Token Economy + Feature Purchases + alle frueheren Policies) |
| Indexes | ~92 (inkl. partial, GIN, pgvector IVFFlat, unique) |
| Storage Buckets | 4 |
| SQL Migrationen | 100 |

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
| Game metrics | **4 Materialized views** | `refresh_all_game_metrics()` | Info bubbles + Health dashboard |
| Epoch status | **Trigger** | Validates first | UI state machine |
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
| Epoch cloning | **Function** (~250 LOC) | Triggers clone | -- |
| Epoch lifecycle | **Functions** (archive/delete) | Calls RPCs | Status UI |
| Forge materialization | **Function** (atomarer Insert) | Orchestriert Forge-Pipeline | Forge Wizard UI |
| Chronicle aggregation | **Function** (JSONB) | AI-Generierung | Broadsheet-Layout |
| Agent memory | **Function** (pgvector) | Injects in Chat-Context | Chat UI |
| Reaction modifier | **Trigger** (auto-recompute) | Reads modifier | Renders sentiment |
| Cascade events | **Function** (rate-limited) | Triggers via Scheduler | Event-Feed |
| Resonance derivation | **Trigger** (BEFORE INSERT) | Reads resonance data | Resonance UI |
| Resonance susceptibility | **Function** | Reads for AI decisions | -- |
| Zone gravity | **Trigger** (auto-assign) | -- | Zone-Map |
| Admin user mgmt | **SECURITY DEFINER RPCs** | Calls RPCs | Admin Panel |
| BYOK key updates | **SECURITY DEFINER RPC** | Calls RPC | Wallet UI |
| RP batch grants | **SECURITY DEFINER RPC** | Calls RPC | -- |
| Realtime broadcast | **SECURITY DEFINER Triggers** | -- | **Supabase Realtime** |

### Trigger-Datenfluesse

**1. Game-Metriken-Invalidierung:**

```
Daten-Aenderung (agents, buildings, zones, embassies, ...)
    │
    ▼
trg_game_metrics_* (11 Triggers auf verschiedenen Tabellen)
    │
    ▼
notify_game_metrics_stale() → pg_notify('game_metrics_stale', simulation_id)
    │
    ▼
Backend Listener (asyncpg) empfaengt Notification
    │
    ▼
refresh_all_game_metrics() → REFRESH MATERIALIZED VIEW CONCURRENTLY
    │   ├── mv_building_readiness
    │   ├── mv_zone_stability
    │   ├── mv_embassy_effectiveness
    │   └── mv_simulation_health
    ▼
Frontend pollt aktualisierte Metriken (Health Dashboard, Info Bubbles)
```

**2. Epoch-Chat-Broadcast:**

```
INSERT epoch_chat_messages (Spieler sendet Nachricht)
    │
    ▼
trg_broadcast_epoch_chat (AFTER INSERT, SECURITY DEFINER)
    │
    ├── Epoch-weit: pg_notify → Supabase Realtime channel 'epoch:{epoch_id}:chat'
    │
    └── Team-only: pg_notify → Supabase Realtime channel 'epoch:{epoch_id}:team:{team_id}:chat'
            │
            ▼
      Frontend RealtimeService Subscriber → Chat-UI Update
```

**3. Reaction-Modifier-Kaskade:**

```
event_reactions INSERT/UPDATE/DELETE (Spieler reagiert auf Event)
    │
    ▼
trg_recompute_reaction_modifier (AFTER, FOR EACH ROW)
    │
    ▼
recompute_reaction_modifier() → Gewichtete Sentiment-Berechnung
    │   (fear=0.35, anger=0.25, support=0.20, defiance=0.15, indifference=0.05)
    │
    ▼
UPDATE events SET metadata = metadata || {reaction_modifier, dominant_sentiment}
    │
    ▼
Beeinflusst mv_zone_stability.event_pressure (naechster MV-Refresh)
    │
    ▼
process_cascade_events() kann neue Events spawnen (wenn pressure > threshold)
```

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
| `agent_relationships` | Intra-Simulation Agenten-Beziehungsgraph (Phase 6, Migration 026) |
| `event_echoes` | Cross-Simulation Bleed-Echos (Phase 6, Migration 026) |
| `simulation_connections` | Multiverse-Topologie (Phase 6, Migration 026) |
| `embassies` | Cross-Simulation diplomatische Gebaeude-Verbindungen (Migration 028) |
| `game_epochs` | Zeitlich begrenzte PvP-Wettbewerbe (Migration 032) |
| `epoch_teams` | Allianzen innerhalb einer Epoche (Migration 032) |
| `epoch_participants` | Simulations-Teilnahme an Epochen mit RP-Tracking (Migration 032) |
| `operative_missions` | Agenten-basierte Missionen (Spionage, Diplomatie, Sabotage) (Migration 032) |
| `epoch_scores` | Pro-Zyklus Multi-Dimension Scoring (Migration 032) |
| `battle_log` | Narrativer Epoch-Event-Log (Migration 032) |
| `epoch_invitations` | Email-basierte Spielereinladungen mit AI-Lore (Migration 036) |
| `epoch_chat_messages` | In-Game Chat (epoch-weit + team-only) mit Realtime-Broadcast (Migration 037) |
| `bot_players` | Wiederverwendbare Bot-Presets mit Persoenlichkeits-Archetypen (Migration 041) |
| `bot_decision_log` | Audit-Trail aller Bot-Entscheidungen pro Zyklus (Migration 041) |
| `epoch_alliance_proposals` | Allianz-Beitrittsantraege mit Abstimmungsmechanik (Migration 081) |
| `epoch_alliance_votes` | Abstimmungen ueber Allianz-Antraege (Migration 081) |
| `forge_access_requests` | Forge-Zugangsantraege fuer Tier-Upgrades (Observer→Architect/Director) (Migration 093) |
| `threshold_actions` | Notfall-Aktionen bei kritischem Schwellenwert (scorched_earth, emergency_draft, reality_anchor) (Migration 097) |

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
CREATE INDEX idx_echo_source_sim_status ON event_echoes(source_simulation_id, status);
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
| **The Gaslit Reach** | `ally` | Ally | Verbuendeter |
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

**Hinweis:** Station Null hat nur 5 Typen (nicht 6). `rival` wird von Velgarien, The Gaslit Reach und Speranza geteilt (gleicher `value`, unterschiedliche `simulation_id`).

---

## Embassy-Tabelle (Migration 028-030)

Cross-Simulation diplomatische Gebaeude. Embassy-Gebaeude (`buildings.special_type = 'embassy'`) werden ueber diese Junction-Tabelle verbunden. Jede Embassy verbindet zwei Gebaeude aus verschiedenen Simulationen und kann Ambassadoren (Agenten) zuweisen.

### `embassies`

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `building_a_id` | uuid | NO | |
| `simulation_a_id` | uuid | NO | |
| `building_b_id` | uuid | NO | |
| `simulation_b_id` | uuid | NO | |
| `status` | text | NO | `'proposed'` |
| `connection_type` | text | NO | `'embassy'` |
| `description` | text | YES | |
| `established_by` | text | YES | |
| `bleed_vector` | text | YES | |
| `event_propagation` | boolean | NO | `true` |
| `embassy_metadata` | jsonb | YES | `'{}'` |
| `created_by_id` | uuid | YES | |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `building_a_id` → `buildings(id) ON DELETE CASCADE`
- `building_b_id` → `buildings(id) ON DELETE CASCADE`
- `simulation_a_id` → `simulations(id) ON DELETE CASCADE`
- `simulation_b_id` → `simulations(id) ON DELETE CASCADE`
- `created_by_id` → `auth.users(id)`

**RLS:** 5 Policies:
- `embassies_anon_select` — SELECT fuer anon: aktive Embassies in aktiven Simulationen
- `embassies_select` — SELECT fuer Mitglieder von Simulation A oder B
- `embassies_insert` — INSERT fuer Admin+ in einer der beiden Simulationen
- `embassies_update` — UPDATE fuer Admin+ in einer der beiden Simulationen
- `embassies_delete` — DELETE fuer Admin+ in einer der beiden Simulationen

**Ambassador-Mechanismus:** `embassy_metadata` speichert Ambassador-Zuordnungen als JSONB (z.B. `{"ambassador_a_id": "uuid", "ambassador_b_id": "uuid"}`). Der `is_ambassador`-Flag auf Agenten wird von `AgentService._enrich_ambassador_flag()` berechnet (kein DB-Feld).

---

## Competitive Layer Tabellen (Migration 032)

6 Tabellen fuer das PvP-Epoch-System: Zeitlich begrenzte Wettbewerbe zwischen Simulationen mit Operativen (Agenten als Spione/Diplomaten/Saboteure), Scoring und Battle-Log.

### `game_epochs`

Zeitlich begrenzte Wettbewerbs-Epochen mit Status-State-Machine.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | |
| `description` | text | YES | |
| `created_by_id` | uuid | NO | |
| `starts_at` | timestamptz | YES | |
| `ends_at` | timestamptz | YES | |
| `current_cycle` | integer | YES | `0` |
| `status` | text | NO | `'lobby'` |
| `config` | jsonb | NO | `'{}'` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `created_by_id` → `auth.users(id)`

**Config JSONB Felder:**
- `cycle_duration_hours`, `max_participants`, `rp_per_cycle`, `rp_cap`, `foundation_pct`, `reckoning_pct`, `max_team_size`, `allow_betrayal`, `score_weights`, `referee_mode`, `invitation_lore`
- `max_agents_per_player` — Maximale Anzahl Agenten pro Spieler fuer den Draft (Default: 3). Steuert wie viele Agenten jeder Teilnehmer waehrend der Draft-Phase auswaehlen darf.

**RLS:** 4 Policies (anon_select, select, insert, update).

**Status-Transitions:** `lobby` → `foundation` → `competition` → `reckoning` → `completed`, jeder Status → `cancelled`. Durchgesetzt via `validate_epoch_status_transition()` Trigger.

### `epoch_teams`

Allianzen innerhalb einer Epoche. Simulationen koennen Teams bilden.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `name` | text | NO | |
| `created_by_simulation_id` | uuid | NO | |
| `created_at` | timestamptz | NO | `now()` |
| `tension` | integer | NO | `0` |
| `dissolved_at` | timestamptz | YES | |
| `dissolved_reason` | text | YES | |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `created_by_simulation_id` → `simulations(id)`

**CHECK Constraints:**
- `tension BETWEEN 0 AND 100`

**Trigger:** `trg_alliance_tension_check` — AFTER UPDATE OF tension: Loest automatische Team-Aufloesung aus wenn Tension >= 80 (`fn_check_alliance_tension()`).

**RLS:** 4 Policies (anon_select, select, insert, update).

### `epoch_participants`

Simulationen, die an einer Epoche teilnehmen. Trackt Resource Points (RP) und optionale Team-Zuordnung.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `simulation_id` | uuid | NO | |
| `user_id` | uuid | YES | |
| `team_id` | uuid | YES | |
| `joined_at` | timestamptz | NO | `now()` |
| `current_rp` | integer | NO | `0` |
| `last_rp_grant_at` | timestamptz | YES | |
| `final_scores` | jsonb | YES | |
| `is_bot` | boolean | NO | `false` |
| `bot_player_id` | uuid | YES | |
| `cycle_ready` | boolean | NO | `false` |
| `drafted_agent_ids` | uuid[] | YES | |
| `draft_completed_at` | timestamptz | YES | |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `simulation_id` → `simulations(id)`
- `user_id` → `auth.users(id)`
- `team_id` → `epoch_teams(id) ON DELETE SET NULL`
- `bot_player_id` → `bot_players(id)`

**CHECK Constraints:**
- `chk_bot_consistency` — `(is_bot = FALSE AND bot_player_id IS NULL) OR (is_bot = TRUE AND bot_player_id IS NOT NULL)`
- `epoch_participants_user_id_required` — `(is_bot = true OR user_id IS NOT NULL)` — Menschliche Teilnehmer muessen eine user_id haben, Bots duerfen NULL sein.

**Indexes:**
- `epoch_participants_user_epoch_unique` — `UNIQUE(epoch_id, user_id) WHERE user_id IS NOT NULL` — Ein User pro Epoche (Partial Index, nur fuer Nicht-Bots)
- `idx_epoch_participants_user_id` — `user_id WHERE user_id IS NOT NULL` — Schnelle user_id-Lookups in RLS

**Draft-Spalten:**
- `drafted_agent_ids` — Array der ausgewaehlten Agent-UUIDs fuer diese Epoch-Teilnahme. Gesetzt waehrend der Draft-Phase im Lobby.
- `draft_completed_at` — Zeitstempel wann der Draft abgeschlossen wurde. `NULL` = Draft noch offen.

**user_id-Spalte (Migration 049):**
- Direkte Zuordnung des Users zum Epoch-Teilnehmer. Ermoeglicht Teilnahme ohne Simulations-Mitgliedschaft (Open Epoch Participation). Wird bei INSERT gesetzt (`user_id = auth.uid()`). Bots haben `user_id = NULL`.

**RLS:** 5 Policies (anon_select, select, insert mit `user_id = auth.uid()`, update, delete mit `user_id = auth.uid()`).

### `epoch_alliance_proposals`

Vorschlaege zum Beitritt in ein bestehendes Allianz-Team. Ein Teilnehmer kann einen Antrag stellen, einem Team beizutreten. Bestehende Team-Mitglieder stimmen ab.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `team_id` | uuid | NO | |
| `proposer_simulation_id` | uuid | NO | |
| `proposed_at` | timestamptz | NO | `now()` |
| `expires_at_cycle` | integer | NO | |
| `status` | text | NO | `'pending'` |
| `resolved_at` | timestamptz | YES | |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `team_id` → `epoch_teams(id) ON DELETE CASCADE`
- `proposer_simulation_id` → `simulations(id)`

**Indexes:**
- `idx_alliance_proposals_unique_pending` — `UNIQUE(team_id, proposer_simulation_id) WHERE status = 'pending'` — Maximal ein aktiver Antrag pro Simulation pro Team (Partial Unique Index)

**CHECK Constraints:**
- `status IN ('pending', 'accepted', 'rejected', 'expired')`

**Trigger:** `trg_resolve_alliance_proposal` — AFTER INSERT auf `epoch_alliance_votes`: Automatische Antragsentscheidung bei Abstimmung. Ablehnung → sofortige Zurueckweisung. Einstimmige Annahme → Beitritt (`fn_resolve_alliance_proposal()`).

**RLS:** 2 Policies:
- `epoch_alliance_proposals_select` — SELECT fuer alle (oeffentlich lesbar, wie andere Epoch-Daten)
- `epoch_alliance_proposals_insert` — INSERT fuer Epoch-Teilnehmer (`auth.uid()` via `epoch_participants`)

### `epoch_alliance_votes`

Abstimmungen ueber Allianz-Antraege. Jedes bestehende Team-Mitglied kann pro Antrag genau einmal abstimmen.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `proposal_id` | uuid | NO | |
| `voter_simulation_id` | uuid | NO | |
| `vote` | text | NO | |
| `voted_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `proposal_id` → `epoch_alliance_proposals(id) ON DELETE CASCADE`
- `voter_simulation_id` → `simulations(id)`

**UNIQUE Constraint:**
- `(proposal_id, voter_simulation_id)` — Ein Vote pro Simulation pro Antrag

**CHECK Constraints:**
- `vote IN ('accept', 'reject')`

**RLS:** 2 Policies:
- `epoch_alliance_votes_select` — SELECT fuer Team-Mitglieder und den Antragsteller (via `epoch_participants.team_id` + `epoch_alliance_proposals.proposer_simulation_id`)
- `epoch_alliance_votes_insert` — INSERT fuer Team-Mitglieder des betroffenen Teams (via `epoch_participants.team_id`)

### `operative_missions`

Agenten-basierte Missionen: Spionage, Diplomatie, Sabotage. Jede Mission hat Kosten (RP), Erfolgswahrscheinlichkeit und Aufloesung.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `agent_id` | uuid | NO | |
| `operative_type` | text | NO | |
| `source_simulation_id` | uuid | NO | |
| `target_simulation_id` | uuid | YES | |
| `embassy_id` | uuid | YES | |
| `target_entity_id` | uuid | YES | |
| `target_entity_type` | text | YES | |
| `target_zone_id` | uuid | YES | |
| `status` | text | NO | `'deploying'` |
| `cost_rp` | integer | NO | |
| `success_probability` | numeric | YES | |
| `deployed_at` | timestamptz | NO | `now()` |
| `deployed_cycle` | integer | YES | | Zyklus der Entsendung — fuer Tension-Berechnung (Migration 090) |
| `resolves_at` | timestamptz | NO | |
| `resolved_at` | timestamptz | YES | |
| `mission_result` | jsonb | YES | |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `agent_id` → `agents(id)`
- `source_simulation_id` → `simulations(id)`
- `target_simulation_id` → `simulations(id)`
- `embassy_id` → `embassies(id)`
- `target_zone_id` → `zones(id)`

**RLS:** 3 Policies (Migration 049: umgeschrieben auf direkte `user_id`-Checks via `epoch_participants`):
- `operative_missions_insert` — INSERT fuer Epoch-Teilnehmer der Source-Simulation (via `epoch_participants.user_id`)
- `operative_missions_select` — SELECT fuer Epoch-Teilnehmer von Source- ODER Target-Simulation (via `epoch_participants.user_id`)
- `operative_missions_update` — UPDATE fuer Epoch-Teilnehmer der Source-Simulation (via `epoch_participants.user_id`)

### `epoch_scores`

Pro-Zyklus Scoring fuer jede Simulation innerhalb einer Epoche. 5 Score-Dimensionen plus Composite.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `simulation_id` | uuid | NO | |
| `cycle_number` | integer | NO | |
| `stability_score` | numeric | NO | `0` |
| `influence_score` | numeric | NO | `0` |
| `sovereignty_score` | numeric | NO | `0` |
| `diplomatic_score` | numeric | NO | `0` |
| `military_score` | numeric | NO | `0` |
| `composite_score` | numeric | NO | `0` |
| `computed_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `simulation_id` → `simulations(id)`

**RLS:** 3 Policies (anon_select, insert, select).

### `battle_log`

Narrativer Log aller Epoch-Events: Missionen, Score-Aenderungen, Allianzen, Konflikte. Oeffentliche Eintraege (`is_public = true`) sind fuer alle sichtbar.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `cycle_number` | integer | NO | |
| `event_type` | text | NO | |
| `source_simulation_id` | uuid | YES | |
| `target_simulation_id` | uuid | YES | |
| `mission_id` | uuid | YES | |
| `narrative` | text | NO | |
| `is_public` | boolean | NO | `false` |
| `metadata` | jsonb | NO | `'{}'` |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `source_simulation_id` → `simulations(id)`
- `target_simulation_id` → `simulations(id)`
- `mission_id` → `operative_missions(id) ON DELETE SET NULL`

**RLS:** 3 Policies (Migration 049: `battle_log_select` umgeschrieben auf direkte `user_id`-Checks via `epoch_participants`):
- `battle_log_anon_select` — SELECT fuer anon: nur oeffentliche Eintraege (`is_public = true`)
- `battle_log_insert` — INSERT fuer authentifizierte User
- `battle_log_select` — SELECT fuer oeffentliche Eintraege ODER Epoch-Teilnehmer von Source-/Target-Simulation (via `epoch_participants.user_id`)

---

## Epoch Invitations & Realtime Tabellen (Migrationen 034-037)

Migrationen 034-037 erweitern den Competitive Layer: Operative Effects (ambassador_blocked_until, infiltration_penalty, betrayal_penalty Spalten auf bestehenden Tabellen), Game Instances (simulation_type, source_template_id, epoch_id Spalten + clone/archive/delete PL/pgSQL-Funktionen), Email-basierte Epoch-Einladungen und Echtzeit-Chat.

### `epoch_invitations`

Email-basierte Einladungen fuer Epochen. Creator kann Spieler per Email einladen, optional mit AI-generierter Lore. Token-basierte Akzeptanz ueber oeffentliche Seite.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `invited_email` | text | NO | |
| `invite_token` | text | NO | UNIQUE |
| `invited_by_id` | uuid | NO | |
| `status` | text | NO | `'pending'` |
| `expires_at` | timestamptz | NO | |
| `accepted_at` | timestamptz | YES | |
| `accepted_by_id` | uuid | YES | |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `invited_by_id` → `auth.users(id)`
- `accepted_by_id` → `auth.users(id)`

**CHECK Constraints:**
- `status IN ('pending', 'accepted', 'expired', 'revoked')`

**Indexes:**
- `idx_epoch_invitations_token` — `invite_token` (fuer Token-Lookup)
- `idx_epoch_invitations_epoch` — `epoch_id` (fuer Epoch-basierte Abfragen)

**RLS:** 5 Policies:
- `epoch_invitations_creator_select` — SELECT fuer Epoch-Creator und Einladende
- `epoch_invitations_creator_insert` — INSERT fuer Epoch-Creator
- `epoch_invitations_creator_update` — UPDATE fuer Epoch-Creator (Revoke)
- `epoch_invitations_anon_select` — SELECT fuer anon (Token-Validierung auf oeffentlicher Accept-Seite)
- `epoch_invitations_accept` — UPDATE fuer authentifizierte User (Akzeptanz)

### `epoch_chat_messages`

In-Game Chat fuer Epochen. Unterstuetzt epoch-weite Nachrichten (alle Teilnehmer) und team-only Nachrichten (nur Allianz-Mitglieder). Neue Nachrichten werden via Supabase Realtime Broadcast-Triggers an die entsprechenden Channels gepusht.

```sql
CREATE TABLE epoch_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id        UUID NOT NULL REFERENCES game_epochs(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  sender_simulation_id UUID NOT NULL REFERENCES simulations(id),
  channel_type    TEXT NOT NULL DEFAULT 'epoch'
                  CHECK (channel_type IN ('epoch', 'team')),
  team_id         UUID REFERENCES epoch_teams(id) ON DELETE SET NULL,
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for cursor-based pagination
CREATE INDEX idx_epoch_chat_epoch_created ON epoch_chat_messages (epoch_id, created_at);
CREATE INDEX idx_epoch_chat_team_created ON epoch_chat_messages (team_id, created_at)
  WHERE team_id IS NOT NULL;
```

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `sender_id` | uuid | NO | |
| `sender_simulation_id` | uuid | NO | |
| `channel_type` | text | NO | `'epoch'` |
| `team_id` | uuid | YES | |
| `content` | text | NO | |
| `sender_type` | text | NO | `'human'` |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `sender_id` → `auth.users(id)`
- `sender_simulation_id` → `simulations(id)`
- `team_id` → `epoch_teams(id) ON DELETE SET NULL`

**CHECK Constraints:**
- `channel_type IN ('epoch', 'team')`
- `char_length(content) BETWEEN 1 AND 2000`
- `sender_type IN ('human', 'bot')`

**Indexes:**
- `idx_epoch_chat_epoch_created` — `(epoch_id, created_at)` fuer Cursor-basierte Pagination
- `idx_epoch_chat_team_created` — `(team_id, created_at) WHERE team_id IS NOT NULL` (partial)

**RLS:** 4 Policies:
- `epoch_chat_select_epoch` — SELECT fuer authentifizierte Epoch-Teilnehmer: epoch-weite Nachrichten (`channel_type = 'epoch'`)
- `epoch_chat_select_team` — SELECT fuer authentifizierte Team-Mitglieder: team-only Nachrichten (`channel_type = 'team'`, team_id muss matchen)
- `epoch_chat_insert` — INSERT fuer Epoch-Teilnehmer (`sender_id = auth.uid()`)
- `epoch_chat_select_anon` — SELECT fuer anon: nur epoch-weite Nachrichten (oeffentliche Zuschauer)

**Spaltenergaenzung auf `epoch_participants` (Migration 037):**

```sql
ALTER TABLE epoch_participants ADD COLUMN cycle_ready BOOLEAN NOT NULL DEFAULT false;
```

### Broadcast Trigger Functions (Migration 037)

Zwei `SECURITY DEFINER` Functions fuer Supabase Realtime Broadcast:

```sql
-- Broadcast neue Chat-Nachricht an den passenden Realtime-Channel
CREATE OR REPLACE FUNCTION broadcast_epoch_chat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.channel_type = 'team' AND NEW.team_id IS NOT NULL THEN
    PERFORM realtime.send(
      to_jsonb(NEW),
      'new_message',
      'epoch:' || NEW.epoch_id::text || ':team:' || NEW.team_id::text || ':chat',
      true
    );
  ELSE
    PERFORM realtime.send(
      to_jsonb(NEW),
      'new_message',
      'epoch:' || NEW.epoch_id::text || ':chat',
      true
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Broadcast Ready-Signal-Aenderungen
CREATE OR REPLACE FUNCTION broadcast_ready_signal()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.cycle_ready IS DISTINCT FROM NEW.cycle_ready THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'simulation_id', NEW.simulation_id,
        'cycle_ready', NEW.cycle_ready
      ),
      'ready_changed',
      'epoch:' || NEW.epoch_id::text || ':status',
      true
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Realtime Channel Naming:**
- Epoch-Chat: `epoch:{epoch_id}:chat`
- Team-Chat: `epoch:{epoch_id}:team:{team_id}:chat`
- Ready-Status: `epoch:{epoch_id}:status`

### `bot_players`

Wiederverwendbare Bot-Presets ("Kartendeck von Gegnern"). Jeder Bot hat eine Persoenlichkeit (Archetyp) und Schwierigkeitsgrad. Erstellt von Benutzern, kann in mehreren Epochen wiederverwendet werden.

```sql
CREATE TABLE bot_players (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
    personality     TEXT NOT NULL CHECK (personality IN ('sentinel', 'warlord', 'diplomat', 'strategist', 'chaos')),
    difficulty      TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    config          JSONB NOT NULL DEFAULT '{}',
    created_by_id   UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_players_created_by ON bot_players(created_by_id);
```

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | |
| `personality` | text | NO | |
| `difficulty` | text | NO | `'medium'` |
| `config` | jsonb | NO | `'{}'` |
| `created_by_id` | uuid | NO | |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `created_by_id` → `auth.users(id)`

**CHECK Constraints:**
- `char_length(name) >= 1 AND char_length(name) <= 50`
- `personality IN ('sentinel', 'warlord', 'diplomat', 'strategist', 'chaos')`
- `difficulty IN ('easy', 'medium', 'hard')`

**Trigger:** `set_updated_at_bot_players` — updated_at Auto-Update

**RLS:** 4 Policies:
- `bot_players_select` — SELECT fuer alle authentifizierten Benutzer (fuer Lobby-Anzeige)
- `bot_players_insert` — INSERT nur fuer eigene Bots (`created_by_id = auth.uid()`)
- `bot_players_update` — UPDATE nur fuer eigene Bots
- `bot_players_delete` — DELETE nur fuer eigene Bots

### `bot_decision_log`

Audit-Trail fuer Bot-Entscheidungen. Protokolliert jede Phase jedes Zyklus (Analyse, Allokation, Deployment, Allianz, Chat) mit der getroffenen Entscheidung als JSONB.

```sql
CREATE TABLE bot_decision_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epoch_id        UUID NOT NULL REFERENCES game_epochs(id) ON DELETE CASCADE,
    participant_id  UUID NOT NULL REFERENCES epoch_participants(id) ON DELETE CASCADE,
    cycle_number    INTEGER NOT NULL,
    phase           TEXT NOT NULL CHECK (phase IN ('analysis', 'allocation', 'deployment', 'alliance', 'chat')),
    decision        JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_decision_log_epoch ON bot_decision_log(epoch_id, cycle_number);
CREATE INDEX idx_bot_decision_log_participant ON bot_decision_log(participant_id);
```

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `participant_id` | uuid | NO | |
| `cycle_number` | integer | NO | |
| `phase` | text | NO | |
| `decision` | jsonb | NO | |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `participant_id` → `epoch_participants(id) ON DELETE CASCADE`

**CHECK Constraints:**
- `phase IN ('analysis', 'allocation', 'deployment', 'alliance', 'chat')`

**RLS:** 3 Policies:
- `bot_decision_log_select` — SELECT fuer authentifizierte Epoch-Teilnehmer (Transparenz)
- `bot_decision_log_anon_select` — SELECT fuer anon (oeffentliche Transparenz)
- `bot_decision_log_service_insert` — INSERT nur via service_role (Admin-Client)

### `notification_preferences`

Per-User Email-Benachrichtigungspraeferenzen fuer Epoch-Events. Jeder Benutzer hat maximal eine Zeile (UNIQUE user_id). Steuert welche Email-Typen gesendet werden und in welcher Sprache.

```sql
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_resolved  BOOLEAN NOT NULL DEFAULT true,
    phase_changed   BOOLEAN NOT NULL DEFAULT true,
    epoch_completed BOOLEAN NOT NULL DEFAULT true,
    email_locale    TEXT NOT NULL DEFAULT 'en' CHECK (email_locale IN ('en', 'de')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
```

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | |
| `cycle_resolved` | boolean | NO | `true` |
| `phase_changed` | boolean | NO | `true` |
| `epoch_completed` | boolean | NO | `true` |
| `email_locale` | text | NO | `'en'` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `user_id` → `auth.users(id) ON DELETE CASCADE`

**CHECK Constraints:**
- `email_locale IN ('en', 'de')`

**Trigger:** `set_updated_at` — automatisches `updated_at` bei UPDATE.

**RLS:** 3 Policies:
- `notification_preferences_select` — SELECT fuer authentifizierte User (eigene Zeile: `user_id = auth.uid()`)
- `notification_preferences_insert` — INSERT fuer authentifizierte User (eigene Zeile)
- `notification_preferences_update` — UPDATE fuer authentifizierte User (eigene Zeile)

**SECURITY DEFINER Function:**

```sql
CREATE OR REPLACE FUNCTION get_user_emails_batch(user_ids UUID[])
RETURNS TABLE(id UUID, email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email::TEXT
    FROM auth.users u
    WHERE u.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Wird von `CycleNotificationService` fuer Batch-Email-Lookup verwendet. Nur service_role darf diese Funktion aufrufen.

### `resolve_template_id()` (Migration 046)

Helper-Funktion fuer Game-Instance-RLS. Liest `source_template_id` aus der `simulations`-Tabelle:

```sql
CREATE OR REPLACE FUNCTION resolve_template_id(sim_id UUID)
RETURNS UUID AS $$
    SELECT COALESCE(source_template_id, sim_id) FROM simulations WHERE id = sim_id;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
```

Wird in 7 RLS-Policies verwendet, die Epoch-Teilnehmern Zugriff auf Game-Instance-Daten ermoeglichen: Die `simulation_id` der Game-Instance wird auf ihre `source_template_id` aufgeloest, um den Abgleich mit `epoch_participants.simulation_id` (die immer auf Templates zeigt) zu ermoeglichen.

---

## Agent Aptitudes (Migration 047)

Operative-Type-spezifische Eignungswerte pro Agent. Jeder Agent hat pro `operative_type` einen `aptitude_level` (3-9), der die Erfolgswahrscheinlichkeit und Effektivitaet bei Missionen beeinflusst. Wird im Draft-System zur Teamzusammenstellung verwendet.

### `agent_aptitudes`

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `agent_id` | uuid | NO | |
| `simulation_id` | uuid | NO | |
| `operative_type` | text | NO | |
| `aptitude_level` | integer | NO | |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `agent_id` → `agents(id) ON DELETE CASCADE`
- `simulation_id` → `simulations(id) ON DELETE CASCADE`

**CHECK Constraints:**
- `operative_type IN ('spy', 'saboteur', 'propagandist', 'assassin', 'guardian', 'infiltrator')`
- `aptitude_level BETWEEN 3 AND 9`

**UNIQUE Constraint:**
- `UNIQUE(agent_id, operative_type)` — ein Agent hat pro Operative-Typ maximal einen Eignungswert

**Trigger:** `set_updated_at` — automatisches `updated_at` bei UPDATE.

**RLS:** 5 Policies:
- `agent_aptitudes_anon_select` — SELECT fuer anon: aktive Simulationen (anon RLS)
- `agent_aptitudes_select` — SELECT fuer Mitglieder via `user_has_simulation_access(simulation_id)`
- `agent_aptitudes_insert` — INSERT fuer Editor+ via `user_has_simulation_role(simulation_id, 'editor')`
- `agent_aptitudes_update` — UPDATE fuer Editor+ via `user_has_simulation_role(simulation_id, 'editor')`
- `agent_aptitudes_delete` — DELETE fuer Admin+ via `user_has_simulation_role(simulation_id, 'admin')`

---

## Foundation Phase Redesign + Open Epoch Participation (Migrationen 048-049)

Migration 048 fuehrt die "Nebelkrieg"-Mechanik ein: Zonenfortifikationen als versteckte Verteidigungsaktionen waehrend der Foundation-Phase. Spione sind jetzt in Foundation erlaubt (neben Guardians). Migration 049 oeffnet Epoch-Teilnahme fuer alle authentifizierten User — keine Simulations-Mitgliedschaft erforderlich. `user_id` auf `epoch_participants`, RLS-Policies auf direkte `user_id`-Checks umgestellt.

### `zone_fortifications`

Versteckte Zonenfortifikationen waehrend der Foundation-Phase. Erhoehen die Sicherheitsstufe einer Zone um 1 Tier fuer eine begrenzte Anzahl von Zyklen. Nur sichtbar fuer den Besitzer und via Spion-Intel.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `epoch_id` | uuid | NO | |
| `zone_id` | uuid | NO | |
| `source_simulation_id` | uuid | NO | |
| `security_bonus` | integer | NO | `1` |
| `expires_at_cycle` | integer | NO | |
| `created_at` | timestamptz | NO | `now()` |

**Foreign Keys:**
- `epoch_id` → `game_epochs(id) ON DELETE CASCADE`
- `zone_id` → `zones(id) ON DELETE CASCADE`
- `source_simulation_id` → `simulations(id) ON DELETE CASCADE`

**UNIQUE Constraint:**
- `UNIQUE(epoch_id, zone_id)` — Maximal eine Fortifikation pro Zone pro Epoche

**Indexes:**
- `idx_zone_fortifications_epoch` — `epoch_id` (fuer Epoch-basierte Abfragen)
- `idx_zone_fortifications_source` — `source_simulation_id` (fuer Source-Simulation-Lookups)

**RLS:** 2 Policies:
- `zone_fortifications_select` — SELECT fuer Epoch-Teilnehmer der Source-Simulation (via `epoch_participants` + `simulation_members`)
- `zone_fortifications_insert` — INSERT fuer Editor+ der Source-Simulation (via `simulation_members`)

### Erweiterter `battle_log` event_type CHECK (Migration 048)

```sql
ALTER TABLE battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
    event_type IN (
        'operative_deployed', 'mission_success', 'mission_failed',
        'detected', 'captured', 'sabotage', 'propaganda', 'assassination',
        'infiltration', 'alliance_formed', 'alliance_dissolved', 'betrayal',
        'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
        'building_damaged', 'agent_wounded', 'counter_intel', 'intel_report',
        'zone_fortified'
    )
);
```

### Open Epoch Participation — RLS-Umstellung (Migration 049)

Migration 049 stellt die Competitive-Layer-RLS von `simulation_members`-JOINs auf direkte `user_id`-Checks via `epoch_participants` um. Betroffene Policies:

---

## Event Pressure & Zone Dynamics (Migrationen 068-073)

### Event Status & Lifecycle (Migration 069)

`events` Tabelle erweitert um `event_status` Spalte:

| Wert | Druck-Multiplikator | Beschreibung |
|------|---------------------|-------------|
| `active` | 1.0x | Normal aktives Event |
| `escalating` | 1.3x | Intensiviert sich — erhoehter Druck |
| `resolving` | 0.5x | Wird aufgeloest — reduzierter Druck |
| `resolved` | 0.0x | Vollstaendig aufgeloest |
| `archived` | 0.0x | Nur historischer Datensatz |

### `event_chains` (Migration 069)

Verknuepfungen zwischen verwandten Events.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `simulation_id` | uuid | NO | FK → simulations |
| `parent_event_id` | uuid | NO | FK → events |
| `child_event_id` | uuid | NO | FK → events |
| `chain_type` | text | NO | |
| `created_at` | timestamptz | NO | `now()` |

**CHECK:** `chain_type IN ('escalation', 'follow_up', 'resolution', 'cascade', 'resonance')`
**UNIQUE:** `(parent_event_id, child_event_id, chain_type)`

### `event_zone_links` (Migration 072)

Verknuepfung von Events zu betroffenen Zonen via Zone-Gravity-Matrix.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `event_id` | uuid | NO | FK → events |
| `zone_id` | uuid | NO | FK → zones |
| `affinity_weight` | numeric | NO | 1.0 |
| `link_source` | text | NO | |
| `created_at` | timestamptz | NO | `now()` |

**CHECK:** `link_source IN ('auto', 'manual', 'location_match')`, `affinity_weight BETWEEN 0.0 AND 1.0`
**UNIQUE:** `(event_id, zone_id)`

### `zone_actions` (Migration 072)

Simulation-Level Zonenaktionen fuer Stabilitaets-Management.

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `zone_id` | uuid | NO | FK → zones |
| `simulation_id` | uuid | NO | FK → simulations |
| `action_type` | text | NO | |
| `effect_value` | numeric | NO | |
| `created_by_id` | uuid | YES | FK → auth.users |
| `expires_at` | timestamptz | NO | |
| `cooldown_until` | timestamptz | NO | |
| `created_at` | timestamptz | NO | `now()` |
| `deleted_at` | timestamptz | YES | |

**CHECK:** `action_type IN ('fortify', 'quarantine', 'deploy_resources')`, `effect_value BETWEEN 0.0 AND 1.0`

**Aktionstypen:**

| Aktion | Effekt | Dauer | Cooldown |
|--------|--------|-------|----------|
| `fortify` | +0.3 | 7 Tage | 14 Tage |
| `quarantine` | -0.1 | 14 Tage | 21 Tage |
| `deploy_resources` | +0.5 | 3 Tage | 30 Tage |

### Reaction Modifier Trigger (Migration 071)

`recompute_reaction_modifier()` berechnet Emotions-gewichteten Modifier fuer Event-Druck:

| Emotion | Gewicht | Wirkung |
|---------|---------|---------|
| fear, anger, panic | +0.1 | Krisen-Verstaerker |
| despair | +0.05 | Leichte Verstaerkung |
| hope, defiance | -0.1 | Resilienz-Daempfer |
| resolve | -0.05 | Leichte Daempfung |
| indifference | 0.0 | Neutral |

Berechnet `dominant_sentiment` und `reaction_modifier` in `events.metadata`.

### Zone Gravity & Vulnerability Matrizen (Migration 072)

**zone_gravity_matrix** (simulation_settings): Bestimmt welche Event-Typen welche Zonen-Typen betreffen.

```json
{
  "exploration": {"ruins": 1.0, "slums": 0.6},
  "trade": {"commercial": 1.0, "industrial": 0.6},
  "crisis": {"_global": 0.6},
  "military": {"military": 1.0, "government": 0.7, "industrial": 0.3}
}
```

**zone_vulnerability_matrix**: Multipliziert Basis-Druck je nach Zone-Event-Kombination.

```json
{
  "residential": {"social": 1.5, "crisis": 1.3, "military": 0.7},
  "military": {"military": 1.5, "intrigue": 1.3, "social": 0.5},
  "government": {"intrigue": 1.5, "military": 1.3, "crisis": 1.2}
}
```

**Weitere Settings:** `pressure_spill_factor` (0.3), `cascade_threshold` (0.7).

### Cascade Events (Migration 073)

`process_cascade_events(p_simulation_id)` erzeugt automatisch Folgeereignisse wenn Zonen-Druck den `cascade_threshold` (0.7) ueberschreitet:

- Rate-limitiert: 1 Kaskade pro Zone pro Zeitfenster
- Ueberspringt quarantaenierte Zonen
- Impact-Level: `LEAST(10, GREATEST(4, FLOOR(zone_pressure * 7)))`
- Verknuepft via `event_chains` (chain_type='cascade')

### Erweiterte `mv_zone_stability` Formel

```
total_pressure = event_pressure + ambient_pressure - fortification_reduction
stability = (infrastructure * 0.5) + (security * 0.3) - (total_pressure * 0.25)
```

Neue Spalten: `event_pressure`, `ambient_pressure`, `fortification_reduction`, `is_quarantined`, `total_pressure`.

---

## Substrate Resonances (Migrationen 074-079)

### `substrate_resonances` (Migration 074)

Platform-Level Phaenomene die ueber alle Simulationen propagieren. Vollstaendige Dokumentation: [Substrate Resonances Spec](../specs/substrate-resonances.md).

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `source_category` | text | NO | |
| `resonance_signature` | text | YES | (trigger-derived) |
| `archetype` | text | YES | (trigger-derived) |
| `title` | text | NO | |
| `description` | text | YES | |
| `bureau_dispatch` | text | YES | |
| `real_world_source` | jsonb | YES | |
| `magnitude` | numeric | NO | 0.50 |
| `affected_event_types` | text[] | YES | |
| `status` | resonance_status | NO | 'detected' |
| `detected_at` | timestamptz | NO | `now()` |
| `impacts_at` | timestamptz | YES | |
| `subsides_at` | timestamptz | YES | |
| `created_by_id` | uuid | YES | |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `deleted_at` | timestamptz | YES | |

**Enums:** `resonance_status` (detected, impacting, subsiding, archived), `resonance_impact_status` (pending, generating, completed, skipped, failed)

**RLS:** Public read, authenticated write, `resonances_admin_full_access` fuer Platform-Admin.

### `resonance_impacts` (Migration 074)

| Spalte | Typ | Nullable | Default |
|--------|-----|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `resonance_id` | uuid | NO | FK → substrate_resonances |
| `simulation_id` | uuid | NO | FK → simulations |
| `susceptibility` | numeric | NO | 1.00 |
| `effective_magnitude` | numeric | YES | (trigger: `MIN(magnitude * susceptibility, 1.00)`) |
| `status` | resonance_impact_status | NO | 'pending' |
| `spawned_event_ids` | uuid[] | YES | |
| `narrative_context` | text | YES | |
| `created_at` | timestamptz | NO | `now()` |

**UNIQUE:** `(resonance_id, simulation_id)`

### Resonance Functions (Migrationen 076-078)

| Funktion | Parameter | Returns | Beschreibung |
|----------|-----------|---------|-------------|
| `fn_derive_resonance_fields()` | trigger | trigger | source_category → signature + archetype + event_types |
| `fn_get_resonance_susceptibility()` | `(sim_id, signature)` | numeric | Susceptibility aus resonance_profile Setting |
| `fn_get_resonance_event_types()` | `(sim_id, signature)` | text[] | Event-Typen aus resonance_event_type_map |
| `fn_resonance_operative_modifier()` | `(sim_id, operative_type)` | numeric | Netto-Modifier [-0.04, +0.04], subsiding 0.5x Decay |
| `fn_target_zone_pressure()` | `(sim_id, zone_id?)` | numeric | Zonen-Druck skaliert auf Cap (0.04), NULL-safe |
| `fn_attacker_pressure_penalty()` | `(sim_id)` | numeric | Angreifer-Druckstrafe [-0.04, 0.00] |
| `is_platform_admin()` | — | boolean | SECURITY DEFINER Admin-Check |

### Balance Fixes (Migration 080)

| Aenderung | Detail |
|-----------|--------|
| `fn_target_zone_pressure` | NULL-Bug Fix: gibt 0.0 zurueck wenn zone_id nicht gefunden (vorher Cap). Cap reduziert 0.06→0.04. |
| `fn_resonance_operative_modifier` | Infiltrator-Oppositionen hinzugefuegt (The Entropy, The Devouring Mother). Subsiding-Resonanzen 0.5x Decay. Clamp reduziert [-0.04, +0.06] → [-0.04, +0.04]. |
| `fn_attacker_pressure_penalty` (NEU) | `(p_simulation_id)` → numeric [-0.04, 0.00]. Formel: `-1.0 * LEAST(0.04, avg_pressure * 0.04)`. Eigene Zonen-Instabilitaet reduziert Angriffs-Effektivitaet. |
| `active_resonances` View | Filter erweitert: `AND status != 'archived'` (archivierte Resonanzen ausgeschlossen). |

- **epoch_participants:** INSERT erfordert `user_id = auth.uid()` (oder `is_bot = true`). Neue DELETE-Policy (`user_id = auth.uid()`).
- **epoch_chat_messages:** 3 Policies umgeschrieben (epoch SELECT, team SELECT, INSERT) — alle via `epoch_participants.user_id` statt `simulation_members` JOIN + `resolve_template_id()`.
- **operative_missions:** 3 Policies umgeschrieben (SELECT, INSERT, UPDATE) — alle via `epoch_participants.user_id`.
- **battle_log:** SELECT umgeschrieben — via `epoch_participants.user_id` + `epoch_participants.simulation_id`.

---

## Alliance-System (Migration 081)

Migration 081 fuehrt das Allianz-Antragssystem ein: formalisierte Beitrittsantraege mit Abstimmungsmechanik, Tension-Tracking und automatische Aufloesung bei Konflikten. Ergaenzt das bestehende Team-System (Migration 032) um demokratische Beitrittskontrolle und dynamische Allianz-Stabilitaet.

### Neue Tabellen

- **`epoch_alliance_proposals`** — Antraege zum Beitritt in ein bestehendes Allianz-Team. Partial Unique Index verhindert doppelte aktive Antraege. Status-Lifecycle: `pending` → `accepted`/`rejected`/`expired`.
- **`epoch_alliance_votes`** — Abstimmungen der Team-Mitglieder ueber Beitrittsantraege. Ein Vote pro Simulation pro Antrag.

Vollstaendige Spaltendefinitionen: siehe [epoch_alliance_proposals](#epoch_alliance_proposals) und [epoch_alliance_votes](#epoch_alliance_votes).

### Neue Spalte

- **`epoch_teams.tension`** — `INTEGER NOT NULL DEFAULT 0 CHECK (tension BETWEEN 0 AND 100)`. Misst die interne Spannung eines Teams. Steigt durch ueberlappende Angriffe auf gleiche Ziele oder gegenseitige Angriffe zwischen Team-Mitgliedern.

### Neue Triggers

| Trigger | Tabelle | Event | Funktion | Beschreibung |
|---------|---------|-------|----------|-------------|
| `trg_resolve_alliance_proposal` | `epoch_alliance_votes` | AFTER INSERT | `fn_resolve_alliance_proposal()` | Automatische Antragsentscheidung: Ablehnung → sofortige Zurueckweisung, einstimmige Annahme → Beitritt |
| `trg_alliance_tension_check` | `epoch_teams` | AFTER UPDATE OF tension | `fn_check_alliance_tension()` | Automatische Team-Aufloesung wenn Tension >= 80 |

### Neue Functions

| Funktion | Parameter | Returns | Beschreibung |
|----------|-----------|---------|-------------|
| `fn_resolve_alliance_proposal()` | trigger | trigger | Prueft alle Votes: ein Reject → `status='rejected'`. Alle Members accept → `status='accepted'`, Antragsteller erhaelt `team_id`. |
| `fn_check_alliance_tension()` | trigger | trigger | Bei `tension >= 80`: setzt `dissolved_at`, `dissolved_reason='tension_threshold'`, entfernt `team_id` von allen Mitgliedern. |
| `fn_expire_alliance_proposals()` | `(p_epoch_id, p_current_cycle)` | void | Setzt `status='expired'` fuer alle Antraege mit `expires_at_cycle <= p_current_cycle`. |
| `fn_deduct_alliance_upkeep()` | `(p_epoch_id)` | void | Zieht 1 RP pro Team-Mitglied von jedem Allianz-Mitglied ab. Aufruf in `resolve_cycle()`. |
| `fn_compute_alliance_tension()` | `(p_epoch_id, p_cycle_number)` | void | Analysiert `operative_missions` des Zyklus: ueberlappende Ziele zwischen Team-Mitgliedern erhoehen Tension, friedliche Koexistenz reduziert sie. |

### RLS

- **`epoch_alliance_proposals`:** Oeffentlich lesbar (wie andere Epoch-Daten). INSERT nur fuer Epoch-Teilnehmer.
- **`epoch_alliance_votes`:** SELECT fuer Team-Mitglieder und Antragsteller. INSERT nur fuer Team-Mitglieder des betroffenen Teams.

---

## Forge Access & Account-Tier-System (Migration 093)

Migration 093 fuehrt das Account-Tier-System und den Forge-Zugangsantragsprozess ein: User beantragen Tier-Upgrades (Observer → Architect/Director), Admins pruefen und genehmigen/ablehnen atomar via SECURITY DEFINER Functions. Die bestehende `user_wallets.is_architect`-Spalte wird per Trigger aus dem neuen `account_tier`-Feld abgeleitet (Abwaertskompatibilitaet).

### Neue Tabelle

#### `forge_access_requests`

```sql
CREATE TABLE public.forge_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_tier text NOT NULL DEFAULT 'architect'
        CHECK (requested_tier IN ('architect', 'director')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    message text,                                        -- User-Begruendung, max 500 Zeichen
    admin_notes text,                                    -- Reviewer-Feedback
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz
);

-- Nur ein offener Antrag pro User
CREATE UNIQUE INDEX idx_forge_access_one_pending
    ON public.forge_access_requests (user_id) WHERE status = 'pending';

-- Schnelle Admin-Abfragen
CREATE INDEX idx_forge_access_pending
    ON public.forge_access_requests (status) WHERE status = 'pending';
```

### Neue Spalte

- **`user_wallets.account_tier`** — `text NOT NULL DEFAULT 'observer'` CHECK (`'observer'`, `'architect'`, `'director'`). Ersetzt `is_architect` als primaere Tier-Bestimmung. Backfill bei Migration: `is_architect = true` → `account_tier = 'architect'`.

### Neue Triggers

| Trigger | Tabelle | Event | Funktion | Beschreibung |
|---------|---------|-------|----------|-------------|
| `trg_sync_architect_flag` | `user_wallets` | BEFORE INSERT OR UPDATE OF account_tier | `fn_sync_architect_flag()` | Synchronisiert `is_architect` Boolean aus `account_tier` fuer Abwaertskompatibilitaet |

### Neue Functions

| Funktion | Parameter | Returns | Beschreibung |
|----------|-----------|---------|-------------|
| `fn_approve_forge_access()` | `(p_request_id uuid, p_admin_notes text, p_reviewer_id uuid)` | jsonb | Atomare Genehmigung: Sperrt Request, setzt `status='approved'`, Upsert `user_wallets.account_tier`,Grantet 3 Starter-Tokens (atomisch: Lock Wallet, Credit, Ledger-Eintrag mit `payment_method='admin_grant'`, `payment_reference='clearance_welcome'`), gibt `{request_id, user_id, user_email, email_locale, requested_tier, status, tokens_granted, balance_after}` zurueck. SECURITY DEFINER. Migration 118 erweitert. |
| `fn_reject_forge_access()` | `(p_request_id uuid, p_admin_notes text, p_reviewer_id uuid)` | jsonb | Ablehnung: Sperrt Request, setzt `status='rejected'`, gibt User-Details zurueck. SECURITY DEFINER. |
| `fn_sync_architect_flag()` | trigger | trigger | Setzt `NEW.is_architect := (NEW.account_tier != 'observer')`. BEFORE INSERT/UPDATE Trigger auf `user_wallets`. |

### Neue View

- **`v_pending_forge_requests`** — Joind `forge_access_requests` + `auth.users`, filtert `WHERE status='pending'`, sortiert nach `created_at ASC`. Spalten: `id`, `user_id`, `user_email`, `requested_tier`, `status`, `message`, `admin_notes`, `reviewed_by`, `created_at`, `reviewed_at`.

### RLS

- **`forge_access_requests`:** User SELECT/INSERT eigene Antraege (`auth.uid() = user_id`). Admin SELECT/UPDATE alle (`is_platform_admin()`).

---

## Forge Token Economy (Migrations 101–104)

Migrations 101–104 fuehren das Token-Wirtschaftssystem ein: Produkt-Katalog (Token-Bundles), Kauf-Ledger, atomare RPC-Funktionen, Admin-Tools (Grants, Statistiken), BYOK-Bypass-System, und Feature-Purchase-Ledger fuer Premium-Features (Darkroom, Dossier, Recruitment, Chronicle Export).

### Neue Tabellen

#### `token_bundles` (Migration 101)
Token-Produkt-Katalog mit 5 vordefinierten Bundles (Field Sample bis Founder's Vault) + 1 Hidden Sentinel (`admin-grant`, `is_active=false`, Migration 102) fuer Admin-Grants und Clearance-Starter-Tokens.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid PK | |
| slug | text UNIQUE | Bundle-Bezeichner (z.B. `field-sample`) |
| display_name | text | Anzeigename |
| tokens | integer | Anzahl Forge-Tokens |
| price_cents | integer | Preis in Cents (>= 0, 0 fuer Admin-Grant-Sentinel) |
| savings_pct | smallint | Ersparnis-Prozentsatz (0–100) |
| sort_order | smallint | Sortierung |
| is_active | boolean | Aktiv im Katalog |

#### `token_purchases` (Migration 101)
Transaktions-Ledger fuer alle Token-Kaeufe (Mock, Stripe, Admin-Grant).

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | Kaeufer |
| bundle_id | uuid FK → token_bundles | Gekauftes Bundle |
| tokens_granted | integer | Gutgeschriebene Tokens |
| price_cents | integer | Gezahlter Preis |
| payment_method | text | `mock`, `stripe`, `admin_grant`, `subscription` |
| payment_reference | text | Referenz (z.B. Admin-Grund) |
| balance_before | integer | Kontostand vorher |
| balance_after | integer | Kontostand nachher |

#### `feature_purchases` (Migration 104)
Generisches Ledger fuer Premium-Feature-Kaeufe mit Token-Abzug.

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | Kaeufer |
| simulation_id | uuid FK → simulations | Ziel-Simulation |
| feature_type | text | `darkroom_pass`, `classified_dossier`, `recruitment`, `chronicle_export`. Config: `export_type` differentiates `codex` (PDF) vs `hires` (ZIP) |
| token_cost | integer | Abgezogene Tokens (0 bei Admin/BYOK-Bypass) |
| status | text | `pending`, `processing`, `completed`, `failed`, `refunded` |
| config | jsonb | Feature-spezifische Konfiguration |
| result | jsonb | Feature-spezifisches Ergebnis |
| regen_budget_remaining | integer | Verbleibende Regenerations (nur Darkroom) |

### Neue Spalten auf `user_wallets` (Migration 103)

- **`byok_bypass`** — boolean DEFAULT false. Per-User BYOK-Bypass fuer Token-Kosten.
- **`byok_allowed`** — boolean DEFAULT false. Per-User BYOK-Zugang (wenn Policy `per_user`).

### Neue Functions

| Funktion | Migration | Beschreibung |
|----------|-----------|-------------|
| `fn_purchase_tokens(slug)` | 101 | Atomarer Token-Kauf: Bundle validieren, Tokens gutschreiben, Ledger-Eintrag. SECURITY DEFINER. |
| `fn_admin_grant_tokens(user_id, tokens, reason)` | 102 | Admin-Token-Grant (1–1000): Credits + auditierter Ledger-Eintrag mit `payment_method=admin_grant`. |
| `fn_user_byok_allowed(user_id)` | 103 | Prueft BYOK-Zugang basierend auf `byok_access_policy` Platform-Setting. |
| `fn_user_has_byok_bypass(user_id)` | 103 | Prueft ob User BYOK-Bypass hat (erlaubt + beide Keys vorhanden + bypass enabled). |
| `fn_purchase_feature(user_id, sim_id, type, cost, config)` | 104 | Atomarer Feature-Kauf: Token-Abzug, Purchase-Record, BYOK/Admin-Skip. |
| `fn_refund_feature(purchase_id)` | 104 | Token-Rueckerstattung bei Fehler (nur Status `processing`/`failed`). |
| `fn_darkroom_use_regen(purchase_id)` | 104 | Dekrementiert Darkroom-Regenerations-Budget. |

### Neue View

- **`token_economy_stats`** (Migration 102) — Aggregierte Statistiken: total_purchases, mock_purchases, admin_grants, total_revenue_cents, tokens_in_circulation, unique_buyers, active_bundles.

### RLS

- **`token_bundles`:** Jeder liest aktive Bundles (`is_active = true`). Admins verwalten alle (`is_platform_admin()`).
- **`token_purchases`:** User lesen eigene (`auth.uid() = user_id`). Admins lesen alle.
- **`feature_purchases`:** User lesen eigene (`auth.uid() = user_id`). Admins verwalten alle.

---

## Forge & Security Improvements (Migrations 122–126)

### Migration 122: Anchor Settings Persistence

`fn_materialize_shard()` erweitert: Philosophische Anchor-Felder (title, title_de, core_question, core_question_de, literary_influence, literary_influence_de, description, description_de, bleed_signature_suggestion, seed_prompt) werden atomar in `simulation_settings` mit `category='anchor'` persistiert. Zuvor gingen diese Daten nach Draft-Loeschung verloren. Anon-RLS-Policy auf `simulation_settings` um `category='anchor'` erweitert (Public-Endpoint-Zugriff).

### Migration 123: Lore Generation Progress

- **Neue Spalte `simulations.lore_progress`** — `jsonb DEFAULT NULL`. Trackt per-section Lore-Generierungsfortschritt waehrend der Forge-Zeremonie (phase, section_index, sections_total, current_section).
- **`active_simulations` View refreshed** — `CREATE OR REPLACE VIEW` nach Spalten-Hinzufuegung (PostgreSQL `SELECT *` in Views resolved Spalten bei Erstellung).
- **`get_forge_progress()` erweitert** — Liefert `lore_progress` im Response-JSONB. Frontend zeigt per-section Status waehrend der Zeremonie an.

### Migration 124: Research Domain Settings

4 neue `platform_settings`-Eintraege fuer konfigurierbare Tavily-Recherche-Domains:

| Setting Key | Default-Domains | Forge-Phase |
|-------------|----------------|-------------|
| `research_domains_encyclopedic` | wikipedia, Stanford Encyclopedia, Britannica | Astrolabe (Phase 1) |
| `research_domains_literary` | wikipedia, Britannica, Paris Review | Lore Research (literary axis) |
| `research_domains_philosophy` | Stanford Encyclopedia, IEP, wikipedia | Lore Research (philosophical axis) |
| `research_domains_architecture` | wikipedia, Dezeen, Designboom | Lore Research (architectural axis) |

Zuvor waren Domains in `tavily_search.py` hartcodiert. AdminResearchTab-Komponente ermoeglicht Runtime-Konfiguration.

### Migration 125: BYOK Key Update RPC

`fn_update_user_byok_keys(p_user_id, p_encrypted_openrouter_key, p_encrypted_replicate_key, p_clear_openrouter, p_clear_replicate)` — SECURITY DEFINER. Ersetzt service_role-Bypass fuer verschluesselte BYOK-Key-Updates. Validiert `auth.uid() = p_user_id`. Nur `authenticated` darf ausfuehren. Erweitert in Migration 218 um `p_clear_*` Boolean-Flags.

### Migration 126: Batch RP Grant RPC

`fn_batch_grant_rp(p_epoch_id, p_amount, p_rp_cap)` — Single `UPDATE ... SET current_rp = LEAST(current_rp + amount, cap)` fuer alle Epoch-Teilnehmer. Ersetzt Python-seitige Gruppierung + mehrere UPDATE-Queries.

### Migration 127: Cycle Scoring RPC (Audit Phase 2 — Postgres Push-Down)

`fn_compute_cycle_scores(p_epoch_id, p_cycle_number, p_score_weights)` — SECURITY DEFINER. Ersetzt 12 per-Simulation Python-Queries durch einen einzigen SQL-Call. Verwendet CTEs fuer zone_stab, propaganda, inbound_missions, outbound_missions, echo_strength, embassy_data, team_data, guardian_counts → raw_scores → maxes → normalized → composited. Ergebnis: UPSERT in `cycle_scores`.

```sql
CREATE OR REPLACE FUNCTION public.fn_compute_cycle_scores(
    p_epoch_id uuid, p_cycle_number integer, p_score_weights jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 128: Auto-Draft Participants RPC (Audit Phase 2 — Postgres Push-Down)

`fn_auto_draft_participants(p_epoch_id, p_max_agents)` — SECURITY DEFINER. Ersetzt N per-Participant Python-Loop durch ein einziges `UPDATE ... FROM` Statement. Selektiert die besten Agenten pro Teilnehmer basierend auf Aptitude-Summen.

```sql
CREATE OR REPLACE FUNCTION public.fn_auto_draft_participants(
    p_epoch_id uuid, p_max_agents integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 163: Resonance Dungeons — Tabellen + Basis-RPCs

Erstellt die Grundlage fuer das Resonance-Dungeon-System.

**Tabellen:**

| Tabelle | Zweck |
|---------|-------|
| `resonance_dungeon_runs` | Run-Metadaten, Party, Fortschritt, Checkpoint. Unique-Index verhindert parallele aktive Runs pro Simulation. |
| `resonance_dungeon_events` | Event-Log: Kampf, Entdeckungen, Narrative (bilingual en/de). |

**RLS:** Public-First — abgeschlossene Runs oeffentlich lesbar, aktive Runs nur fuer Simulations-Mitglieder. Alle Mutationen via `service_role`.

**RPCs:**

| Funktion | Zweck |
|----------|-------|
| `fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes)` | Atomisch: Mood + Moodlets + Activity-Records fuer Party-Agenten |
| `fn_expire_abandoned_dungeon_runs(p_ttl_seconds)` | Bulk-Expire inaktiver Runs (Default 30min TTL). Setzt `status='abandoned'` + `completed_at=now()` fuer Runs mit `updated_at < now() - TTL`. Aufgerufen alle 60s durch `start_instance_cleanup()` Loop (registriert in FastAPI Lifespan). Dual-Cleanup: In-Memory-Eviction (`_instance_last_activity`) + DB-Orphan-Bereinigung (Server-Restart-Fall). |

### Migration 164: Resonance Dungeons — Atomare RPCs + VIEW

Vervollstaendigt das Dungeon-System mit atomaren Transaktionen (ADR-007 Pattern) und einer Verfuegbarkeits-VIEW.

**Neue Tabelle:**

| Tabelle | Zweck |
|---------|-------|
| `agent_dungeon_loot_effects` | Persistente Loot-Effekte: Aptitude-Boost-Cap (+2 per Agent), permanente Dungeon-Boni, Event-Modifier, Simulation-Modifier (Building Protection). CHECK: aptitude_boost/permanent_dungeon_bonus/next_dungeon_bonus/event_modifier/arc_modifier/simulation_modifier. RLS: Simulations-Mitglieder koennen lesen. Migration 174: simulation_modifier hinzugefuegt. |

**RPCs:**

| Funktion | Zweck | Pattern |
|----------|-------|---------|
| `fn_apply_dungeon_loot(p_agent_id, p_simulation_id, p_run_id, p_loot_id, p_effect_type, p_effect_params)` | 8 Branches: aptitude_boost (Cap +2), memory, moodlet, event_modifier, arc_modifier, stress_heal, permanent/next_dungeon_bonus, simulation_modifier (Migration 174). | ADR-007 CAS |
| `fn_complete_dungeon_run(...)` | Atomisch: Status=completed + Outcome + Agent-Effekte + Loot + Event. Ruft intern `fn_apply_dungeon_outcome` + `fn_apply_dungeon_loot` auf. | ADR-007 |
| `fn_abandon_dungeon_run(...)` | Atomisch: Status=abandoned + Partial-Outcome + Event | ADR-007 |
| `fn_wipe_dungeon_run(...)` | Atomisch: Status=wiped + Trauma-Outcomes + Event | ADR-007 |
| `fn_get_party_combat_state(p_agent_ids, p_simulation_id)` | 3 Queries → 1 RPC: Agents + Aptitudes + Mood + Personality als JSONB-Array | Performance |

**VIEW:** `available_dungeons` — Pre-gefilterte Resonances mit Difficulty/Depth-Berechnung. Composite-Index `idx_dungeon_runs_sim_archetype`.

**Sicherheit:** Alle Mutations-RPCs: `REVOKE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role` (ADR-006).

### Migration 165: Dungeon Loot Distribution Phase

Fuegt eine 'distributing'-Phase zwischen Boss-Sieg und Run-Abschluss hinzu. Nach dem Boss weist der Spieler Loot (aptitude_boost, memory, moodlet, Boni) einzelnen Party-Agenten zu, bevor der Run finalisiert wird.

**Schema-Aenderungen:**

| Aenderung | Details |
|-----------|---------|
| `resonance_dungeon_runs.status` CHECK | Neuer Wert `'distributing'` hinzugefuegt |
| `idx_dungeon_runs_active` | Rebuilt: `distributing` als aktiver Status einbezogen |
| `idx_dungeon_runs_one_active_per_sim` | Rebuilt: `distributing` verhindert parallele Runs |
| RLS Policies | Updated: Mitglieder koennen `distributing`-Runs lesen |

**RPCs:**

| Funktion | Zweck | Pattern |
|----------|-------|---------|
| `fn_begin_distribution(p_run_id, p_simulation_id, p_agent_outcomes)` | Setzt status='distributing', wendet Agent-Outcomes (Mood, Moodlets, Activities) an. Trennt Outcome-Anwendung von Loot-Zuweisung. | ADR-007 |
| `fn_finalize_dungeon_run(p_run_id, p_simulation_id, p_loot_items, p_outcome)` | Setzt status='completed', wendet spieler-zugewiesenen Loot an. Ruft intern `fn_apply_dungeon_loot` auf. | ADR-007 |

### Migrationen 190–195: Achievement & Badge System

Leichtgewichtiges Auszeichnungssystem mit 35 Badges in 7 Kategorien und 5 Seltenheitsstufen. Alle Bewertungslogik lebt in PostgreSQL-Triggern — Badges werden automatisch vergeben, nie manuell beansprucht.

**Tabellen:**

| Tabelle | Zweck | Schluessel |
|---------|-------|------------|
| `achievement_definitions` | Katalog aller Badges (35 Eintraege, data-driven) | `id TEXT PK` |
| `user_achievements` | Verdiente Badges pro User (immutable nach Vergabe) | `id UUID PK`, `UNIQUE(user_id, achievement_id)` |
| `achievement_progress` | Inkrementeller Fortschritt fuer Schwellenwert-Badges. `context JSONB` speichert Deduplizierungs-Tracking (z.B. gesehene Banter-IDs fuer `fn_increment_progress_unique`) | `PK(user_id, achievement_id)` |

**`achievement_definitions` Schema:**

| Spalte | Typ | Constraint | Beschreibung |
|--------|-----|------------|-------------|
| `id` | TEXT | PK | Slug-ID (z.B. `shadow_walker`, `flawless_run`) |
| `category` | TEXT | CHECK (7 Werte) | `initiation`, `dungeon`, `epoch`, `collection`, `social`, `challenge`, `secret` |
| `name_en` / `name_de` | TEXT | NOT NULL | Bilingualer Badge-Name |
| `description_en` / `description_de` | TEXT | NOT NULL | Bilinguale Beschreibung |
| `hint_en` / `hint_de` | TEXT | Nullable | Hinweis (NULL fuer Secret-Badges) |
| `icon_key` | TEXT | NOT NULL | Verweis auf `icons.ts` SVG-Funktion |
| `rarity` | TEXT | CHECK (5 Werte) | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `is_secret` | BOOLEAN | NOT NULL DEFAULT FALSE | Secret-Badges: Name/Beschreibung erst nach Unlock sichtbar |
| `sort_order` | INT | NOT NULL | Sortierung innerhalb Kategorie (100er-Bloecke) |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Soft-Deaktivierung ohne Datenverlust |

**RLS:**

| Tabelle | Policy | Regel |
|---------|--------|-------|
| `achievement_definitions` | `SELECT` fuer `authenticated` | `USING (true)` — oeffentlicher Katalog |
| `user_achievements` | `SELECT` fuer `authenticated` | `USING (true)` — alle verdiente Badges sichtbar (Profil-Display) |
| `user_achievements` | `INSERT` fuer `service_role` | Nur System-Vergabe, nie User-Claim |
| `achievement_progress` | `SELECT` fuer `authenticated` | `USING ((SELECT auth.uid()) = user_id)` — nur eigener Fortschritt |
| `achievement_progress` | `ALL` fuer `service_role` | Voller Zugriff fuer Trigger-/RPC-Schreibzugriffe |

**RPCs:**

| Funktion | Signatur | Zweck |
|----------|----------|-------|
| `fn_award_achievement` | `(UUID, TEXT, JSONB) → BOOLEAN` | Idempotente Badge-Vergabe. TRUE wenn neu vergeben, FALSE wenn bereits vorhanden. REVOKE von `authenticated` (Migration 195). |
| `fn_increment_progress` | `(UUID, TEXT, INT, JSONB) → VOID` | Atomarer Fortschritt + Auto-Award bei Schwellenwert. |
| `fn_increment_progress_unique` | `(UUID, TEXT, TEXT, INT, JSONB) → VOID` | Deduplizierter Fortschritt via `item_key` (z.B. 50 einzigartige Banter-Texte). NULL-Guard fuer `item_key`. |

**Trigger Functions (13):**

| Trigger | Source Table | Badges |
|---------|-------------|--------|
| `trg_ach_onboarding` | `user_profiles` | `first_steps` |
| `trg_ach_first_operative` | `operative_missions` | `first_operative` |
| `trg_ach_dungeon_complete` | `resonance_dungeon_runs` | 8 Archetype-Badges + `first_dungeon` + `archetype_explorer` + `all_archetypes` + `depth_master` |
| `trg_ach_epoch_score` | `epoch_scores` | `master_strategist`, `undefeated` |
| `trg_ach_alliance` | `epoch_alliance_proposals` | `the_diplomat` |
| `trg_ach_forge` | `simulations` (data_source='forge') | `forgemaster` |
| `trg_ach_loot` | `resonance_dungeon_loot` | `loot_collector`, `literary_collector` |
| `trg_ach_cipher` | `cipher_redemptions` | `cipher_decoder` |
| `trg_ach_embassy` (×2) | `embassies` | `embassy_builder` (beide Seiten) |
| `trg_ach_echo` | `event_echoes` | `echo_sender` |
| `trg_ach_operative_deploy` | `operative_missions` | `iron_guardian`, `shadow_operative` |

Alle Trigger `SECURITY DEFINER`. `fn_award_achievement` nur fuer `service_role` (Migration 195: REVOKE von `authenticated`).

### Migration 218: BYOK Key Clear Support

`CREATE OR REPLACE` auf `fn_update_user_byok_keys` — erweitert um `p_clear_openrouter BOOLEAN DEFAULT FALSE` und `p_clear_replicate BOOLEAN DEFAULT FALSE`. Wenn ein Clear-Flag TRUE ist, wird die entsprechende Key-Spalte auf NULL gesetzt (CASE-Branch uebersteuert COALESCE). Ermoeglicht gezieltes Loeschen einzelner BYOK-Keys ueber `DELETE /forge/wallet/keys/{provider}` ohne den anderen Key zu beruehren. Berechtigungen unveraendert (REVOKE anon, GRANT authenticated).
