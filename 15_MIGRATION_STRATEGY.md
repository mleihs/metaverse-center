# 15 - Migration Strategy: Velgarien → Multi-Simulations-Plattform

**Version:** 1.1
**Datum:** 2026-02-15

---

## Ubersicht

Die Migration folgt einem 4-Phasen-Ansatz, bei dem das bestehende Velgarien-System schrittweise in die neue Multi-Simulations-Plattform uberfuhrt wird.

```
Phase 1: Plattform-Grundgerust          (Foundation)
    │
    ▼
Phase 2: Velgarien als erste Simulation  (Daten-Migration)
    │
    ▼
Phase 3: Settings-System + i18n          (Konfigurierbarkeit)
    │
    ▼
Phase 4: Multi-User + Multi-Simulation   (Multi-Tenancy)
```

---

## Phase 1: Plattform-Grundgerust

### Ziel
Neues Datenbank-Schema, Auth-System und API-Grundstruktur stehen. Noch keine Daten-Migration.

### 1.1 Datenbank-Schema aufsetzen

**Neue Tabellen erstellen (in Reihenfolge der Abhangigkeiten):**

```
1. simulations
2. simulation_members
3. simulation_settings
4. simulation_taxonomies
5. prompt_templates
6. cities (mit simulation_id)
7. zones (mit simulation_id)
8. city_streets (mit simulation_id)
9. agents (mit simulation_id, UUID PKs)
10. buildings (mit simulation_id)
11. events (mit simulation_id, UUID PKs)
12. agent_professions (mit simulation_id)
13. building_agent_relations (mit simulation_id)
14. event_reactions (mit simulation_id)
15. campaigns (ehemals propaganda_campaigns)
16. campaign_events
17. campaign_metrics
18. social_trends (mit simulation_id)
19. social_media_posts (ehemals facebook_posts)
20. social_media_comments (ehemals facebook_comments)
21. social_media_agent_reactions
22. chat_conversations (ehemals agent_chats)
23. chat_messages (ehemals agent_chat_messages)
24. user_agents (mit simulation_id)
25. audit_log
```

**Schema-Korrekturen gegenuber Altsystem:**

| Korrektur | Alt | Neu |
|-----------|-----|-----|
| PK-Typ standardisieren | `agents.id` TEXT, `events.id` TEXT | Alle UUID mit `gen_random_uuid()` |
| UUID-Generator vereinheitlichen | Mix aus `uuid_generate_v4()` und `gen_random_uuid()` | Einheitlich `gen_random_uuid()` |
| Foreign Keys hinzufugen | 0 FK-Constraints | Alle Beziehungen mit expliziten FKs |
| Typ-Mismatches beheben | `agent_chats.agent_id` UUID vs `agents.id` TEXT | Alle UUID |
| String-Typen vereinheitlichen | Mix TEXT / VARCHAR(N) | Einheitlich `text` |
| Timestamps vereinheitlichen | Mix `now()` / `timezone('utc', now())` | Einheitlich `timestamptz DEFAULT now()` |
| Enums eliminieren | 3 PostgreSQL ENUMs, 25+ CHECK Constraints | `simulation_taxonomies` Tabelle |
| Deutsche Spaltennamen | `charakter`, `hintergrund` | `character`, `background` |
| RLS auf allen Tabellen | 16/37 Tabellen, oft permissiv | Alle Tabellen, simulation-basiert |
| Redundanzen entfernen | `agents.event_reactions` JSONB + `event_reactions` Tabelle | Nur `event_reactions` Tabelle |

### 1.2 Auth + Rollen (Hybrid-Architektur)

```
1. Supabase Auth konfigurieren (Email/Password)
2. simulation_members Tabelle mit Rollen
3. RLS-Policies fur alle Tabellen (KEIN pauschaler Service-Role-Bypass)
4. Frontend: @supabase/supabase-js Client fur Auth direkt
5. Frontend: SupabaseAuthService (signIn, signUp, signOut, resetPassword)
6. Backend: JWT-Validierung via Depends(get_current_user)
7. Backend: Supabase Client mit User-JWT (RLS aktiv!)
8. Backend: Service Key NUR fur Admin/System-Operationen
9. Backend: PermissionService mit Rollen-Hierarchie via Depends()
```

### 1.3 API-Grundstruktur

```
1. FastAPI App mit simulation-scoped Routing
2. Base Router: /api/v1/simulations/:simId/...
3. Simulations Router: CRUD fur Simulationen
4. Users Router: GET /users/me (Auth via Supabase direkt, kein Auth-Router!)
5. Health Router: /api/v1/health
6. Error-Handling Middleware (FastAPI exception_handler)
7. CORS Middleware (CORSMiddleware)
8. Rate Limiting (slowapi)
9. Dependency Injection: get_simulation_context via Depends()
10. Pydantic Models fur Request/Response Validation
11. Uvicorn als ASGI-Server
```

### 1.4 Frontend-Grundstruktur

```
1. Vite + Lit + TypeScript Setup (frisch)
2. Biome Setup (biome.json fur Linting + Formatting)
3. @supabase/supabase-js Client-Setup (Auth, Storage, Realtime)
4. @lit-labs/router Setup mit Simulation-Kontext
5. Zod-Schemas fur Formular-Validierung
6. Design-Token-System (12_DESIGN_SYSTEM.md)
7. Shared Styles (Button, Card, Form, Modal, Table)
8. Base-Komponenten (VelgarienElement, VelgBaseModal)
9. AppStateManager mit Simulation-Signal
10. SupabaseAuthService (direkt zu Supabase Auth)
11. BaseApiService (JWT aus Supabase Session fur FastAPI-Requests)
12. Login/Register Komponenten
13. Simulations-Dashboard (Plattform-Level)
```

### Phase 1 Deliverables

- [ ] Neues DB-Schema deployed (alle Tabellen, FKs, RLS)
- [ ] Auth funktional (Frontend → Supabase Auth direkt)
- [ ] Backend JWT-Validierung (Supabase-Token in Depends())
- [ ] Backend Supabase-Client mit User-JWT (RLS aktiv)
- [ ] Simulation erstellen/auflisten funktional
- [ ] API-Grundstruktur mit 3 Routers (Users, Simulations, Health)
- [ ] FastAPI App mit Uvicorn lauffähig
- [ ] Pydantic Models für alle Entities
- [ ] Frontend: Supabase Auth Service + Login/Register Komponenten
- [ ] Frontend: Simulations-Dashboard
- [ ] Design-Token-System komplett
- [ ] CI/CD Pipeline (Tests, Build, Deploy)

---

## Phase 2: Velgarien als erste Simulation

### Ziel
Alle bestehenden Velgarien-Daten in die neue Plattform migrieren. Velgarien wird zur ersten Simulation.

### 2.1 Simulation "Velgarien" erstellen

```sql
-- Velgarien-Simulation erstellen
INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
  'velgarien-uuid',
  'Velgarien',
  'velgarien',
  'Eine dystopische Welt unter totaler Kontrolle',
  'dystopian',
  'active',
  'de',
  'admin-user-uuid'
);

-- Admin als Owner
INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES ('velgarien-uuid', 'admin-user-uuid', 'owner');
```

### 2.2 Taxonomien migrieren

```sql
-- Gender-Typen (Alt: PostgreSQL ENUM → Neu: Taxonomie)
-- label ist jsonb mit Locale-Keys (siehe 03_DATABASE_SCHEMA_NEW.md)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'gender', 'male', '{"de":"männlich","en":"male"}', 1),
  ('velgarien-uuid', 'gender', 'female', '{"de":"weiblich","en":"female"}', 2),
  ('velgarien-uuid', 'gender', 'diverse', '{"de":"divers","en":"diverse"}', 3),
  ('velgarien-uuid', 'gender', 'alien', '{"de":"alien","en":"alien"}', 4);

-- Professionen
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'profession', 'scientist', '{"de":"Wissenschaftler","en":"Scientist"}', 1),
  ('velgarien-uuid', 'profession', 'leader', '{"de":"Führungsperson","en":"Leader"}', 2),
  ('velgarien-uuid', 'profession', 'military', '{"de":"Militär","en":"Military"}', 3),
  ('velgarien-uuid', 'profession', 'engineer', '{"de":"Ingenieur","en":"Engineer"}', 4),
  ('velgarien-uuid', 'profession', 'artist', '{"de":"Künstler","en":"Artist"}', 5),
  ('velgarien-uuid', 'profession', 'medic', '{"de":"Mediziner","en":"Medic"}', 6),
  ('velgarien-uuid', 'profession', 'security', '{"de":"Sicherheitspersonal","en":"Security"}', 7),
  ('velgarien-uuid', 'profession', 'administration', '{"de":"Verwaltung","en":"Administration"}', 8),
  ('velgarien-uuid', 'profession', 'craftsman', '{"de":"Handwerker","en":"Craftsman"}', 9),
  ('velgarien-uuid', 'profession', 'specialist', '{"de":"Spezialist","en":"Specialist"}', 10);

-- Agenten-Systeme
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'system', 'politics', '{"de":"Politik","en":"Politics"}', 1),
  ('velgarien-uuid', 'system', 'military', '{"de":"Militär","en":"Military"}', 2),
  ('velgarien-uuid', 'system', 'clergy', '{"de":"Klerus","en":"Clergy"}', 3),
  ('velgarien-uuid', 'system', 'science', '{"de":"Wissenschaft","en":"Science"}', 4),
  ('velgarien-uuid', 'system', 'civilian', '{"de":"Zivilbevölkerung","en":"Civilian"}', 5);

-- Gebäude-Typen
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'building_type', 'residential', '{"de":"Wohngebäude","en":"Residential"}', 1),
  ('velgarien-uuid', 'building_type', 'commercial', '{"de":"Gewerbegebäude","en":"Commercial"}', 2),
  ('velgarien-uuid', 'building_type', 'industrial', '{"de":"Industriegebäude","en":"Industrial"}', 3),
  ('velgarien-uuid', 'building_type', 'government', '{"de":"Regierungsgebäude","en":"Government"}', 4),
  ('velgarien-uuid', 'building_type', 'military', '{"de":"Militärgebäude","en":"Military"}', 5),
  ('velgarien-uuid', 'building_type', 'religious', '{"de":"Religiöses Gebäude","en":"Religious"}', 6),
  ('velgarien-uuid', 'building_type', 'special', '{"de":"Spezialgebäude","en":"Special"}', 7);

-- Building Special Types
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'building_special_type', 'academy_of_sciences', '{"de":"Akademie der Wissenschaften","en":"Academy of Sciences"}', 1),
  ('velgarien-uuid', 'building_special_type', 'military_academy', '{"de":"Militärakademie","en":"Military Academy"}', 2),
  ('velgarien-uuid', 'building_special_type', 'medical_center', '{"de":"Medizinisches Zentrum","en":"Medical Center"}', 3),
  ('velgarien-uuid', 'building_special_type', 'research_lab', '{"de":"Forschungslabor","en":"Research Lab"}', 4),
  ('velgarien-uuid', 'building_special_type', 'propaganda_center', '{"de":"Propagandazentrum","en":"Propaganda Center"}', 5);

-- Urgency Levels
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'urgency_level', 'low', '{"de":"Niedrig","en":"Low"}', 1),
  ('velgarien-uuid', 'urgency_level', 'medium', '{"de":"Mittel","en":"Medium"}', 2),
  ('velgarien-uuid', 'urgency_level', 'high', '{"de":"Hoch","en":"High"}', 3),
  ('velgarien-uuid', 'urgency_level', 'critical', '{"de":"Kritisch","en":"Critical"}', 4);

-- Zonen-Typen
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
VALUES
  ('velgarien-uuid', 'zone_type', 'residential', '{"de":"Wohngebiet","en":"Residential"}', 1),
  ('velgarien-uuid', 'zone_type', 'commercial', '{"de":"Gewerbegebiet","en":"Commercial"}', 2),
  ('velgarien-uuid', 'zone_type', 'industrial', '{"de":"Industriegebiet","en":"Industrial"}', 3),
  ('velgarien-uuid', 'zone_type', 'military', '{"de":"Militärgebiet","en":"Military"}', 4),
  ('velgarien-uuid', 'zone_type', 'religious', '{"de":"Religiöses Gebiet","en":"Religious"}', 5),
  ('velgarien-uuid', 'zone_type', 'government', '{"de":"Regierungsgebiet","en":"Government"}', 6),
  ('velgarien-uuid', 'zone_type', 'slums', '{"de":"Slums","en":"Slums"}', 7),
  ('velgarien-uuid', 'zone_type', 'ruins', '{"de":"Ruinen","en":"Ruins"}', 8);
```

### 2.3 Daten-Migration

#### Agenten

```sql
-- ID-Mapping: TEXT → UUID
-- Separate Mapping-Tabelle fur Referenzen

CREATE TEMP TABLE agent_id_mapping (
  old_id text PRIMARY KEY,
  new_id uuid DEFAULT gen_random_uuid()
);

-- Mapping erstellen
INSERT INTO agent_id_mapping (old_id)
SELECT id FROM old_agents;

-- Agenten migrieren (Spalten gemäß 03_DATABASE_SCHEMA_NEW.md)
INSERT INTO agents (id, simulation_id, name, system, gender, character, background,
                    portrait_image_url, portrait_description, data_source, created_at, updated_at)
SELECT
  m.new_id,
  'velgarien-uuid',
  a.name,
  a.system,
  -- Gender: Deutscher Enum-Wert → Englischer Taxonomy-Value
  CASE a.gender
    WHEN 'männlich' THEN 'male'
    WHEN 'weiblich' THEN 'female'
    WHEN 'divers' THEN 'diverse'
    WHEN 'alien' THEN 'alien'
    ELSE a.gender::text
  END,
  a.charakter,              -- Spalte umbenannt: charakter → character
  a.hintergrund,            -- Spalte umbenannt: hintergrund → background
  a.portrait_image_url,     -- Identischer Spaltenname
  a.portrait_description,
  'migration',              -- data_source: Herkunft der Daten
  a.created_at,
  COALESCE(a.updated_at, a.created_at)
FROM old_agents a
JOIN agent_id_mapping m ON m.old_id = a.id;
```

#### Events

```sql
-- Gleicher Ansatz: TEXT → UUID Mapping
CREATE TEMP TABLE event_id_mapping (
  old_id text PRIMARY KEY,
  new_id uuid DEFAULT gen_random_uuid()
);

INSERT INTO event_id_mapping (old_id)
SELECT id FROM old_events;

INSERT INTO events (id, simulation_id, title, description, event_type, urgency_level,
                    target_demographic, status, created_at, updated_at)
SELECT
  m.new_id,
  'velgarien-uuid',
  e.title,
  e.description,
  e.type,  -- Alt: type → Neu: event_type
  -- Urgency: Deutsch → Englisch
  CASE e.urgency_level
    WHEN 'NIEDRIG' THEN 'low'
    WHEN 'MITTEL' THEN 'medium'
    WHEN 'HOCH' THEN 'high'
    WHEN 'KRITISCH' THEN 'critical'
    ELSE lower(e.urgency_level)
  END,
  e.target_demographic,
  e.status,
  e.created_at,
  COALESCE(e.updated_at, e.created_at)
FROM old_events e
JOIN event_id_mapping m ON m.old_id = e.id;
```

#### Gebaude

```sql
-- Buildings haben bereits UUID-PKs
INSERT INTO buildings (id, simulation_id, name, description, building_type, special_type,
                       city_id, zone_id, street_id, image_url, created_at, updated_at)
SELECT
  b.id,
  'velgarien-uuid',
  b.name,
  b.description,
  b.type,  -- Alt: type → Neu: building_type
  -- Special Type: Deutsch → Englisch
  CASE b.special_type
    WHEN 'akademie_der_wissenschaften' THEN 'academy_of_sciences'
    WHEN 'militarakademie' THEN 'military_academy'
    WHEN 'medizinisches_zentrum' THEN 'medical_center'
    WHEN 'forschungslabor' THEN 'research_lab'
    WHEN 'propagandazentrum' THEN 'propaganda_center'
    ELSE b.special_type::text
  END,
  b.city_id,
  b.zone_id,
  b.street_id,
  b.image_url,
  b.created_at,
  COALESCE(b.updated_at, b.created_at)
FROM old_buildings b;
```

#### Beziehungs-Tabellen

```sql
-- Agent Professions (agent_id TEXT → UUID via Mapping)
INSERT INTO agent_professions (id, simulation_id, agent_id, profession, level)
SELECT
  ap.id,
  'velgarien-uuid',
  m.new_id,
  -- Profession: Deutsch → Englisch
  CASE ap.profession
    WHEN 'wissenschaftler' THEN 'scientist'
    WHEN 'fuhrungsperson' THEN 'leader'
    WHEN 'militar' THEN 'military'
    WHEN 'ingenieur' THEN 'engineer'
    WHEN 'kunstler' THEN 'artist'
    WHEN 'mediziner' THEN 'medic'
    WHEN 'sicherheitspersonal' THEN 'security'
    WHEN 'verwaltung' THEN 'administration'
    WHEN 'handwerker' THEN 'craftsman'
    WHEN 'spezialist' THEN 'specialist'
    ELSE ap.profession::text
  END,
  ap.level
FROM old_agent_professions ap
JOIN agent_id_mapping m ON m.old_id = ap.agent_id;

-- Event Reactions (agent_id TEXT + event_id TEXT → UUID via Mappings)
INSERT INTO event_reactions (id, simulation_id, event_id, agent_id, reaction_text, sentiment)
SELECT
  er.id,
  'velgarien-uuid',
  em.new_id,
  am.new_id,
  er.reaction_text,
  er.sentiment
FROM old_event_reactions er
JOIN event_id_mapping em ON em.old_id = er.event_id
JOIN agent_id_mapping am ON am.old_id = er.agent_id;
```

#### Geographische Daten

```sql
-- Cities, Zones, Streets haben bereits UUID-PKs
-- Nur simulation_id hinzufugen

INSERT INTO cities (id, simulation_id, name, description, population, geojson, created_at)
SELECT id, 'velgarien-uuid', name, description, population, geojson, created_at
FROM old_cities;

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description, geojson)
SELECT id, 'velgarien-uuid', city_id, name, zone_type, security_level, description, geojson
FROM old_zones;

INSERT INTO city_streets (id, simulation_id, zone_id, name, description)
SELECT id, 'velgarien-uuid', zone_id, name, description
FROM old_city_streets;
```

#### Social Media Daten

```sql
-- facebook_posts → social_media_posts
INSERT INTO social_media_posts (id, simulation_id, platform, external_id, message,
                                 source_created_at, likes_count, comments_count, shares_count)
SELECT
  id, 'velgarien-uuid', 'facebook', facebook_post_id, message,
  created_time,  -- Alt: created_time → Neu: source_created_at
  likes_count, comments_count, shares_count
FROM old_facebook_posts;

-- facebook_comments → social_media_comments
INSERT INTO social_media_comments (id, simulation_id, post_id, external_id, message, source_created_at)
SELECT
  id, 'velgarien-uuid', post_id, facebook_comment_id, message,
  created_time  -- Alt: created_time → Neu: source_created_at
FROM old_facebook_comments;
```

#### Chat-Daten

```sql
-- agent_chats → chat_conversations
-- ACHTUNG: agent_chats.agent_id ist UUID, agents.id war TEXT → UUID-Mapping notig
INSERT INTO chat_conversations (id, simulation_id, user_id, agent_id, title, created_at, updated_at)
SELECT
  ac.id,
  'velgarien-uuid',
  ac.user_id,
  am.new_id,  -- UUID via Mapping
  ac.title,
  ac.created_at,
  ac.updated_at
FROM old_agent_chats ac
LEFT JOIN agent_id_mapping am ON am.old_id = ac.agent_id::text;

-- agent_chat_messages → chat_messages
-- Hinweis: chat_messages hat kein simulation_id (wird über conversation → simulation aufgelöst)
INSERT INTO chat_messages (id, conversation_id, sender_role, content, created_at)
SELECT
  id,
  chat_id,
  role,  -- Alt: role → Neu: sender_role
  content,
  created_at
FROM old_agent_chat_messages;
```

### 2.4 Migrations-Verifikation

```sql
-- Zahlen-Vergleich
SELECT 'agents' as entity,
  (SELECT count(*) FROM old_agents) as old_count,
  (SELECT count(*) FROM agents WHERE simulation_id = 'velgarien-uuid') as new_count;

SELECT 'events' as entity,
  (SELECT count(*) FROM old_events) as old_count,
  (SELECT count(*) FROM events WHERE simulation_id = 'velgarien-uuid') as new_count;

SELECT 'buildings' as entity,
  (SELECT count(*) FROM old_buildings) as old_count,
  (SELECT count(*) FROM buildings WHERE simulation_id = 'velgarien-uuid') as new_count;

-- FK-Integritat prufen
SELECT 'orphaned event_reactions' as issue,
  count(*) as count
FROM event_reactions er
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = er.event_id)
   OR NOT EXISTS (SELECT 1 FROM agents a WHERE a.id = er.agent_id);

-- Duplikate prufen
SELECT 'duplicate agents' as issue,
  count(*) - count(DISTINCT name) as count
FROM agents WHERE simulation_id = 'velgarien-uuid';
```

### Phase 2 Deliverables

- [ ] Alle Velgarien-Daten in neuem Schema
- [ ] ID-Mappings dokumentiert und verifiziert
- [ ] Taxonomien fur Velgarien angelegt
- [ ] Alle Beziehungen via FKs verifiziert
- [ ] Zahlen-Vergleich Alt vs. Neu = 100%
- [ ] Agents CRUD funktional
- [ ] Buildings CRUD funktional
- [ ] Events CRUD + Reactions funktional
- [ ] Chat funktional

---

## Phase 3: Settings-System + i18n

### Ziel
Konfigurierbares Settings-System und Mehrsprachigkeit. Alle hartcodierten Werte → Settings.

### 3.1 Simulation-Settings fur Velgarien

```sql
-- General Settings (category + setting_key/setting_value gemaess 03_DATABASE_SCHEMA_NEW.md v2.0)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('velgarien-uuid', 'general', 'name', '"Velgarien"'),
  ('velgarien-uuid', 'general', 'description', '"Eine dystopische Welt unter totaler Kontrolle"'),
  ('velgarien-uuid', 'general', 'theme', '"dystopian"'),
  ('velgarien-uuid', 'general', 'content_locale', '"de"'),
  ('velgarien-uuid', 'general', 'content_locales', '["de"]');

-- AI Settings (ehemals config.py)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('velgarien-uuid', 'ai', 'models.agent_description', '"deepseek/deepseek-chat-v3-0324"'),
  ('velgarien-uuid', 'ai', 'models.agent_reaction', '"meta-llama/llama-3.3-70b-instruct:free"'),
  ('velgarien-uuid', 'ai', 'models.building_description', '"meta-llama/llama-3.3-70b-instruct:free"'),
  ('velgarien-uuid', 'ai', 'models.event_generation', '"meta-llama/llama-3.3-70b-instruct:free"'),
  ('velgarien-uuid', 'ai', 'models.chat', '"deepseek/deepseek-chat-v3-0324"'),
  ('velgarien-uuid', 'ai', 'models.news_transformation', '"meta-llama/llama-3.2-3b-instruct:free"'),
  ('velgarien-uuid', 'ai', 'models.fallback', '"shisa-ai/shisa-v2-llama3.3-70b:free"'),
  ('velgarien-uuid', 'ai', 'image_models.agent_portrait', '"stability-ai/stable-diffusion"'),
  ('velgarien-uuid', 'ai', 'image_models.building_image', '"stability-ai/stable-diffusion"');

-- Integration Settings (ehemals config.py + .env)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('velgarien-uuid', 'integration', 'facebook.enabled', 'true'),
  ('velgarien-uuid', 'integration', 'facebook.page_id', '"203648343900979"'),
  ('velgarien-uuid', 'integration', 'facebook.api_version', '"v23.0"');
```

### 3.2 Prompt-Templates migrieren

```sql
-- Plattform-Default Prompts (simulation_id = NULL)
-- Alle 22 Prompts als EN + DE Templates

-- Beispiel: Agent Generation (EN - aus generate_service.py:262-266)
INSERT INTO prompt_templates (simulation_id, template_type, locale, prompt_content, system_prompt, variables, is_default)
VALUES (
  NULL,  -- Plattform-Default
  'agent_generation_full',
  'en',
  'You are an expert character creator for a simulation called "{simulation_name}".
Create a detailed character for an agent:

Name: {agent_name}
System: {agent_system}
Gender: {agent_gender}

The world is {simulation_theme_description}.

Create:
1. Character (at least 100 words): Personality, motivations, strengths, weaknesses
2. Background (at least 100 words): Origin, education, important life events

Respond in {locale_name}.
Respond in JSON format:
{{"character": "...", "background": "..."}}',
  'You are a creative world-builder. Always respond in {locale_name}.',
  ARRAY['simulation_name', 'agent_name', 'agent_system', 'agent_gender', 'simulation_theme_description', 'locale_name'],
  true
);

-- Beispiel: Chat System Prompt (DE - aus generate_service.py:1246-1259)
INSERT INTO prompt_templates (simulation_id, template_type, locale, prompt_content, system_prompt, variables, is_default)
VALUES (
  NULL,
  'chat_system_prompt',
  'de',
  'Du bist {agent_name}, ein Charakter in der Welt "{simulation_name}".

Dein Charakter: {agent_character}
Dein Hintergrund: {agent_background}

Antworte immer im Charakter. Bleibe in der Rolle.
Antworte auf {locale_name}.',
  'Du bist ein Rollenspiel-Charakter. Bleibe immer in der Rolle.',
  ARRAY['agent_name', 'simulation_name', 'agent_character', 'agent_background', 'locale_name'],
  true
);

-- ... alle weiteren 20 Prompt-Templates
```

### 3.3 i18n implementieren

```
1. @lit/localize Setup
2. Translation-Dateien (DE + EN)
3. Alle Komponenten: hardcodierte Strings → msg()
4. LocaleService mit Persistenz
5. Datums-/Zahlenformatierung via Intl API
```

### 3.4 Settings-UI

```
1. Tab-basiertes Settings-Panel
2. General Tab: Name, Beschreibung, Theme, Sprache
3. World Tab: Taxonomie-Editor (CRUD fur Enums)
4. AI Tab: Modell-Auswahl, Prompt-Editor, Parameter
5. Integration Tab: Facebook, News-APIs (verschlusselt)
6. Design Tab: Theme-Farben, Font-Auswahl
7. Access Tab: Rollen-Verwaltung, Einladungen
```

### Phase 3 Deliverables

- [ ] Settings-Service (Backend) mit Verschlusselung
- [ ] Settings-UI (Frontend) mit 6 Tabs
- [ ] Alle 22 Prompts als Templates (DE + EN)
- [ ] Taxonomie-Editor funktional
- [ ] i18n: Alle UI-Strings uber msg()
- [ ] i18n: DE + EN Translation-Dateien komplett
- [ ] PromptResolver mit Fallback-Kette
- [ ] ExternalServiceResolver pro Simulation

---

## Phase 4: Multi-User + Multi-Simulation

### Ziel
Mehrere Benutzer und Simulationen. Vollstandige Multi-Tenancy.

### 4.1 Multi-User

```
1. Registrierungs-Flow mit Email-Verifikation
2. Benutzer-Profil (Name, Avatar, Sprach-Praferenz)
3. Simulation-Einladungen via Link
4. Rollen-Verwaltung (Owner, Admin, Editor, Viewer)
5. User-Dashboard: Meine Simulationen
```

### 4.2 Simulations-Erstellung

```
1. "Neue Simulation"-Wizard:
   a. Name + Beschreibung + Sprache
   b. Theme wahlen (dystopisch, utopisch, fantasy, sci-fi, custom)
   c. Taxonomien: Default ubernehmen oder anpassen
   d. AI-Settings: Defaults ubernehmen oder anpassen
2. Simulation-Templates (Velgarien als Template verfugbar)
3. Simulation klonen
```

### 4.3 Plattform-Administration

```
1. Plattform-Admin Dashboard
2. Benutzer-Verwaltung
3. Simulations-Ubersicht (alle)
4. Plattform-Default-Settings verwalten
5. Plattform-Default-Prompts verwalten
6. Audit-Log
```

### 4.4 Erweiterte Features

```
1. Supabase Realtime fur Live-Updates
2. Simulation-Export/Import
3. Offentliche Simulationen (Gallery)
4. Simulation-Archivierung
5. Nutzungs-Statistiken pro Simulation
```

### Phase 4 Deliverables

- [ ] Multi-User-System komplett
- [ ] Simulations-Erstellung Wizard
- [ ] Simulation-Templates
- [ ] Rollen-basierte Zugriffskontrolle verifiziert
- [ ] Plattform-Admin Dashboard
- [ ] Realtime-Updates
- [ ] Performance-Tests mit 100+ Simulationen

---

## Risiken & Mitigationen

| # | Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|--------|-------------------|--------|-----------|
| R1 | **Datenverlust bei Migration** | Mittel | Kritisch | Komplettes Backup vor Migration, ID-Mapping-Tabellen behalten, Verifikations-Queries |
| R2 | **TEXT→UUID ID-Konvertierung bricht Referenzen** | Hoch | Hoch | Mapping-Tabelle, Migration in Transaktion, alle FKs testen |
| R3 | **RLS-Policies blockieren berechtigte Zugriffe** | Hoch | Mittel | Extensive Tests, Logging von RLS-Denials, Supabase Dashboard Monitoring |
| R4 | **Performance-Regression durch simulation_id Filter** | Mittel | Mittel | Indexes auf simulation_id + haufige Filter-Spalten, Query-Plans prufen |
| R5 | **Prompt-Template-Migration verliert Nuancen** | Niedrig | Mittel | Sorgfaltige 1:1 Ubertragung, A/B-Test Output Alt vs. Neu |
| R6 | **Supabase Storage-URLs andern sich** | Niedrig | Hoch | Bucket-Namen beibehalten, URL-Rewriting-Schicht |
| R7 | **Shadow DOM Token-Probleme** | Niedrig | Niedrig | CSS Custom Properties durchdringen Shadow DOM nativ |
| R8 | **i18n-Lucken (vergessene Strings)** | Hoch | Niedrig | Automatische Extraktion via @lit/localize, CI-Check fur fehlende Keys |
| R9 | **Parallel-Betrieb Alt+Neu notig** | Mittel | Mittel | Feature-Flags, schrittweise Umschaltung |
| R10 | **User-Migration (Passwort-Hashes)** | Mittel | Hoch | Supabase Auth ubernimmt bestehende User, oder Password-Reset-Flow |

---

## Rollback-Strategie

### Pro Phase

| Phase | Rollback-Methode |
|-------|-----------------|
| Phase 1 | DROP neues Schema, kein Impact auf Altsystem |
| Phase 2 | Daten aus neuem Schema loschen, Altsystem unverandert |
| Phase 3 | Settings-Daten loschen, hardcodierte Fallbacks greifen |
| Phase 4 | Simulationen auf Single-User zurucksetzen |

### Daten-Sicherung

```
1. Vor jeder Phase: Vollstandiges DB-Backup
2. Migrations-Tabellen mit Timestamps
3. ID-Mapping-Tabellen dauerhaft behalten (mindestens 6 Monate)
4. Altes Schema parallel behalten (read-only) bis Phase 4 abgeschlossen
```

---

## Zeitliche Abhangigkeiten

```
Phase 1 ─────────────────────────────────────────────
  │ Schema, Auth, API-Grundstruktur, Design-System
  │
  ├── Phase 2 ───────────────────────────────────────
  │     │ Daten-Migration, Feature-Parity
  │     │
  │     ├── Phase 3 ─────────────────────────────────
  │     │     │ Settings, i18n, Prompts
  │     │     │
  │     │     └── Phase 4 ───────────────────────────
  │     │           Multi-User, Multi-Simulation
  │     │
  │     └── [OPTIONAL] Parallel: AI-Pipeline Tests
  │
  └── [OPTIONAL] Parallel: Design-System-Entwicklung
```

**Kritischer Pfad:** Phase 1 → Phase 2 → Phase 3 → Phase 4

Die Phasen konnen nicht ubersprungen werden, da jede Phase auf der vorherigen aufbaut. Innerhalb jeder Phase konnen bestimmte Aufgaben parallelisiert werden (z.B. Backend + Frontend gleichzeitig).

---

## Appendix: Flask → FastAPI Migrationspfad

Das Altsystem verwendet Flask (WSGI, synchron) mit 17 V3-Blueprints. Der Neubau nutzt **FastAPI** (ASGI, async). Dieser Abschnitt dokumentiert die systematische Konvertierung.

### Analyse des Altsystems

| Aspekt | Altsystem (Flask) | Neubau (FastAPI) |
|--------|-------------------|------------------|
| Framework | Flask 3.0 + Gunicorn | FastAPI + Uvicorn |
| Routing | 17 Flask Blueprints (BaseBlueprint-Pattern) | 17 APIRouter-Module |
| Validation | Manuelle `ValidationStrategy` + `request.get_json()` | Pydantic Models als Funktionsparameter |
| Error Handling | `ResponseFactory.error(msg, code)` → `(jsonify, status)` | `raise HTTPException(code, detail=msg)` |
| Dependencies | `ServiceFactory.get_service()` (Singleton) | `Depends(get_service)` (Dependency Injection) |
| Auth | Manueller JWT-Check in BaseBlueprint | `Depends(get_current_user)` |
| Config | `config.py` + `load_dotenv()` | `pydantic_settings.BaseSettings` |
| Async | Komplett synchron (0 async-Aufrufe) | Async für alle I/O-Operationen |
| CORS | `flask-cors` | `CORSMiddleware` |
| Server | Gunicorn (WSGI) | Uvicorn (ASGI) |
| API Docs | Manuell / keine | Auto-generiert via OpenAPI (`/docs`, `/redoc`) |

### Pattern-Mapping (1:1 Konvertierung)

```
Flask (Alt)                          → FastAPI (Neu)
─────────────────────────────────────────────────────
Flask(__name__)                      → FastAPI(title="...", version="...")
Blueprint(name, url_prefix="/api")   → APIRouter(prefix="/api")
app.register_blueprint(bp)           → app.include_router(router)
@bp.route("/agents", methods=["GET"])→ @router.get("/agents")
request.args.get("key")              → key: str = Query(None)
request.get_json()                   → body: AgentCreate (Pydantic)
return jsonify(data), 200            → return data (auto-serialisiert)
response_factory.error(msg, 400)     → raise HTTPException(400, detail=msg)
CORS(app, origins=[...])             → app.add_middleware(CORSMiddleware, ...)
ServiceFactory.get_service()         → Depends(get_service)
@app.before_request                  → @app.middleware("http")
@app.after_request                   → Middleware-Klasse (BaseHTTPMiddleware)
config.py + load_dotenv()            → BaseSettings(env_file=".env")
gunicorn -w 4 app:app                → uvicorn app:app --workers 4
```

### Router-Konvertierung (17 Blueprints → 17 Routers)

```
Altsystem                                    → Neubau
─────────────────────────────────────────────────────────
core/blueprints/agents_blueprint_v3.py       → backend/routers/agents.py
core/blueprints/events_blueprint_v3.py       → backend/routers/events.py
core/blueprints/buildings_blueprint_v3.py    → backend/routers/buildings.py
core/blueprints/chat_blueprint_v3.py         → backend/routers/chat.py
core/blueprints/generate_blueprint_v3.py     → backend/routers/generation.py
core/blueprints/auth_blueprint_v3.py         → ENTFÄLLT (Auth via Supabase direkt)
(kein Äquivalent)                            → backend/routers/users.py (GET /users/me)
core/blueprints/news_blueprint_v3.py         → backend/routers/news.py
core/blueprints/social_trends_blueprint_v3.py→ backend/routers/social_trends.py
core/blueprints/facebook_*_v3.py             → backend/routers/social_media.py
core/blueprints/config_blueprint_v3.py       → backend/routers/config.py
core/blueprints/locations_blueprint_v3.py    → backend/routers/locations.py
core/blueprints/user_agents_blueprint_v3.py  → backend/routers/user_agents.py
core/blueprints/agent_professions_*.py       → backend/routers/agent_professions.py
core/blueprints/building_agent_rel_*.py      → backend/routers/building_relations.py
core/blueprints/prompt_templates_*.py        → backend/routers/prompt_templates.py
core/blueprints/health_blueprint_v3.py       → backend/routers/health.py
(kein Äquivalent)                            → backend/routers/simulations.py (NEU)
```

### Async-Migrationsstrategie (3 Stufen)

**Stufe 1: Sync-Wrapper (sofort lauffähig)**
```python
# Services bleiben zunächst synchron, werden in Thread-Pool ausgeführt
import asyncio

@router.get("/agents")
async def list_agents(simulation_id: UUID):
    # Synchronen Service in Thread ausführen
    agents = await asyncio.to_thread(
        agents_service.get_all, simulation_id
    )
    return {"success": True, "data": agents}
```

**Stufe 2: Async externe APIs (höchster Performance-Gewinn)**
```python
# httpx statt requests für externe API-Calls
import httpx

class OpenRouterService:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url="https://api.openrouter.com/api/v1")

    async def generate(self, model: str, prompt: str) -> str:
        response = await self.client.post("/chat/completions", json={...})
        return response.json()["choices"][0]["message"]["content"]
```

**Stufe 3: Async DB (supabase-py 2.x hat bereits async-Support)**
```python
# supabase-py 2.x bietet AsyncClient via supabase._async
from supabase import acreate_client, AsyncClient

async_supabase: AsyncClient = await acreate_client(url, key)

async def get_agents(simulation_id: UUID) -> list[Agent]:
    result = await async_supabase.table("agents") \
        .select("*") \
        .eq("simulation_id", str(simulation_id)) \
        .execute()
    return [Agent(**row) for row in result.data]
```

> **Hinweis:** `supabase-py` 2.x enthält bereits einen vollwertigen async Client. Es ist kein separates Paket oder "Phase 3"-Warten nötig. Der async Client kann ab Phase 1 eingesetzt werden.

### Konkretes Beispiel: Blueprint → Router

**Alt (Flask Blueprint):**
```python
# core/blueprints/agents_blueprint_v3.py
class AgentsBlueprint(BaseBlueprint):
    def __init__(self):
        super().__init__('agents', '/api/v3/agents')
        self.service = ServiceFactory.get_agents_service()

    def register_routes(self):
        self.add_route('/', self.get_agents, methods=['GET'])
        self.add_route('/<agent_id>', self.get_agent, methods=['GET'])
        self.add_route('/', self.create_agent, methods=['POST'])

    def get_agents(self):
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 25, type=int)
        result = self.service.get_all(page=page, limit=limit)
        return self.response_factory.success(result)

    def create_agent(self):
        data = request.get_json()
        errors = self.validation_strategy.validate(data, 'agent_create')
        if errors:
            return self.response_factory.error(errors, 422)
        result = self.service.create(data)
        return self.response_factory.success(result, 201)
```

**Neu (FastAPI Router):**
```python
# backend/routers/agents.py
from fastapi import APIRouter, Depends, Query, HTTPException
from uuid import UUID
from ..models.agents import AgentCreate, AgentResponse, AgentListResponse
from ..dependencies import get_simulation_context, get_current_user

router = APIRouter(prefix="/api/v1/simulations/{simulation_id}/agents", tags=["agents"])

@router.get("/", response_model=AgentListResponse)
async def list_agents(
    simulation_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str = Query(None),
    context = Depends(get_simulation_context),
):
    agents = await agents_service.get_all(
        simulation_id=simulation_id, page=page, limit=limit, search=search
    )
    return agents

@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(
    simulation_id: UUID,
    body: AgentCreate,  # Pydantic validiert automatisch
    user = Depends(require_role("editor")),
):
    agent = await agents_service.create(simulation_id=simulation_id, data=body)
    return agent
```

### Pydantic Models (ersetzt ValidationStrategy)

```python
# backend/models/agents.py
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional

class AgentCreate(BaseModel):
    """Request-Body für Agent-Erstellung. Ersetzt manuelle Validierung.
    Spalten gemäß 03_DATABASE_SCHEMA_NEW.md"""
    name: str = Field(..., min_length=1, max_length=200)
    system: Optional[str] = None                    # Referenz auf taxonomy: type='system'
    gender: Optional[str] = None                    # Referenz auf taxonomy: type='gender'
    primary_profession: Optional[str] = None        # Referenz auf taxonomy: type='profession'
    character: Optional[str] = None
    background: Optional[str] = None

class AgentResponse(BaseModel):
    """Response für einzelnen Agent."""
    id: UUID
    simulation_id: UUID
    name: str
    system: Optional[str] = None
    gender: Optional[str] = None
    primary_profession: Optional[str] = None
    character: Optional[str] = None
    background: Optional[str] = None
    portrait_image_url: Optional[str] = None
    portrait_description: Optional[str] = None
    data_source: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

### FastAPI App-Konfiguration

```python
# backend/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import (
    agents, events, buildings, chat, generation,
    users, news, social_trends, social_media,
    config, locations, user_agents, simulations,
    agent_professions, building_relations, prompt_templates, health
)
from .middleware import SecurityHeadersMiddleware

app = FastAPI(
    title="Velgarien Platform API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

# Routers registrieren
app.include_router(users.router)
app.include_router(simulations.router)
app.include_router(health.router)
app.include_router(agents.router)
app.include_router(events.router)
app.include_router(buildings.router)
app.include_router(chat.router)
app.include_router(generation.router)
app.include_router(news.router)
app.include_router(social_trends.router)
app.include_router(social_media.router)
app.include_router(config.router)
app.include_router(locations.router)
app.include_router(user_agents.router)
app.include_router(agent_professions.router)
app.include_router(building_relations.router)
app.include_router(prompt_templates.router)
```

### Dependencies (Dependency Injection)

```python
# backend/dependencies.py
from fastapi import Depends, Header, HTTPException
from uuid import UUID
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str                # Auch im Backend (mit User-JWT für RLS)
    supabase_service_key: str             # NUR für Admin/System-Ops
    supabase_jwt_secret: str              # JWT-Validierung
    openrouter_api_key: str
    replicate_api_token: str
    settings_encryption_key: str
    app_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"

settings = Settings()

async def get_current_user(authorization: str = Header(...)) -> CurrentUser:
    """Validiert Supabase-JWT und gibt User zurück."""
    from jose import jwt, JWTError
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, settings.supabase_jwt_secret,
                           algorithms=["HS256"], audience="authenticated")
        return CurrentUser(id=UUID(payload["sub"]), email=payload.get("email", ""),
                          access_token=token)
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, detail="Invalid or expired token")

async def get_supabase(user: CurrentUser = Depends(get_current_user)) -> Client:
    """Supabase Client mit User-JWT → RLS aktiv!"""
    return create_client(settings.supabase_url, settings.supabase_anon_key,
                        options=ClientOptions(headers={"Authorization": f"Bearer {user.access_token}"}))

async def get_simulation_context(
    simulation_id: UUID,
    user: User = Depends(get_current_user)
) -> SimulationContext:
    """Prüft Zugang und gibt Simulation-Kontext zurück."""
    member = await get_simulation_member(simulation_id, user.id)
    if not member:
        raise HTTPException(403, detail="Not a member of this simulation")
    return SimulationContext(simulation_id=simulation_id, user=user, role=member.role)
```

---

## Querverweise

- **02_DATABASE_SCHEMA_LEGACY.md** - Alt-Schema als Migrations-Quelle
- **03_DATABASE_SCHEMA_NEW.md** - Ziel-Schema
- **04_DOMAIN_MODELS.md** - Entity-Definitionen
- **08_SIMULATION_SETTINGS.md** - Settings-Konfiguration
- **09_AI_INTEGRATION.md** - Prompt-Templates Migration
- **10_AUTH_AND_SECURITY.md** - Auth + RLS Setup
- **13_TECHSTACK_RECOMMENDATION.md** - FastAPI Stack-Empfehlung + Migrationspfad
- **14_I18N_ARCHITECTURE.md** - i18n Implementation

---

## Aenderungsprotokoll

### v1.1 (2026-02-15)
- Spaltenumbenennung gemaess 03_DATABASE_SCHEMA_NEW.md v2.0:
  - `simulations.created_by` → `owner_id` + `slug` Spalte hinzugefuegt
  - `simulation_members.role` → `member_role`
  - `simulation_settings.key` → `setting_key`, `value` → `setting_value`
  - `events.type` → `event_type` (INSERT-Spalte, SELECT bleibt Alt-Spalte)
  - `buildings.type` → `building_type` (INSERT-Spalte, SELECT bleibt Alt-Spalte)
  - `social_media_posts/comments.created_time` → `source_created_at`
  - `chat_messages.role` → `sender_role`
- `campaign_metrics` in Tabellen-Reihenfolge aufgenommen (Nr. 17, Total: 25)
- Irrefuehrenden Kommentar bei Settings-INSERT korrigiert
