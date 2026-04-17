---
title: "Domain Models"
id: domain-models
version: "3.4"
date: 2026-04-16
lang: de
type: reference
status: active
tags: [models, pydantic, typescript, interfaces]
---

# 04 - Domain Models: Entitaeten mit Simulation-Scope

---

## Uebersicht

Alle Entitaeten tragen eine `simulation_id` und sind damit einer Simulation zugeordnet. Die Simulation ist die Top-Level-Entity.

```
Simulation (Top-Level)
+-- Agents
|   +-- AgentProfessions
|   +-- AgentRelationships
|   +-- AgentInteractions (mit Events, Buildings, Trends)
+-- Buildings
|   +-- BuildingAgentRelations
|   +-- BuildingEventRelations
|   +-- BuildingProfessionRequirements
+-- Events
|   +-- EventReactions
|   +-- EventEchoes
+-- Cities
|   +-- Zones
|   +-- CityStreets
+-- Campaigns
|   +-- CampaignEvents
|   +-- CampaignMetrics
+-- SocialTrends
|   +-- TrendKeywords
|   +-- TrendKeywordAssociations
+-- SocialMedia
|   +-- SocialMediaPosts
|   +-- SocialMediaComments
|   +-- SocialMediaAgentReactions
+-- ChatConversations
|   +-- ChatMessages
+-- PromptTemplates
+-- SimulationTaxonomies
+-- SimulationConnections (Cross-Simulation)
```

---

## 1. Simulation

**Top-Level Entity** - Container fuer alle anderen Entitaeten.

```typescript
interface Simulation {
  id: UUID;
  name: string;                     // "Velgarien" — CHECK length 1-255
  slug: string;                     // "velgarien" — CHECK ^[a-z0-9-]+$ length <= 100
  description: string;
  theme: SimulationTheme;           // 'dystopian' | 'utopian' | 'fantasy' | 'scifi' | 'historical' | 'custom'
                                    // NOTE: This is a high-level narrative category. Detailed visual overrides
                                    // (colors, fonts, shadows, etc.) are stored in simulation_settings with
                                    // category='design'. See Theming System (`../specs/theming-system.md`) for the full token taxonomy.
  status: SimulationStatus;         // 'draft' | 'configuring' | 'active' | 'paused' | 'archived'
  content_locale: string;           // "de"
  additional_locales: string[];     // ["en"]
  owner_id: UUID;
  icon_url?: string;
  banner_url?: string;
  created_at: string;               // ISO 8601
  updated_at: string;
  archived_at?: string;
  deleted_at?: string;

  // Relations (loaded on demand)
  members?: SimulationMember[];
  settings?: SimulationSetting[];
  taxonomies?: SimulationTaxonomy[];
}
```

**Zugehoerige Entitaeten:**

```typescript
interface SimulationMember {
  id: UUID;
  simulation_id: UUID;
  user_id: UUID;
  member_role: SimulationRole;      // RENAMED: role -> member_role (SQL reserved word)
  invited_by_id?: UUID;             // RENAMED: invited_by -> invited_by_id (FK-Suffix)
  joined_at: string;

  // Populated
  user?: UserProfile;
}

interface SimulationSetting {
  id: UUID;
  simulation_id: UUID;
  category: SettingCategory;        // 'general' | 'world' | 'ai' | 'integration' | 'design' | 'access' | 'prompts' | 'notifications'
  setting_key: string;              // RENAMED: key -> setting_key (SQL reserved word)
  setting_value: any;               // RENAMED: value -> setting_value (SQL reserved word)
  updated_by_id?: UUID;             // RENAMED: updated_by -> updated_by_id (FK-Suffix)
  created_at: string;
  updated_at: string;
}

interface SimulationTaxonomy {
  id: UUID;
  simulation_id: UUID;
  taxonomy_type: TaxonomyType;      // 'gender' | 'profession' | 'system' | 'building_type' | ...
  value: string;                    // Internal value (always English)
  label: Record<string, string>;    // {"de": "Wissenschaftler", "en": "Scientist"}
  description?: Record<string, string>;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  metadata?: Record<string, any>;
}
```

---

## 2. Agent

**Bewohner/Akteure der Simulation.**

```typescript
interface Agent {
  id: UUID;
  simulation_id: UUID;
  slug: string;                     // Auto-generated from name, UNIQUE per simulation (Migration 137)
  name: string;                     // CHECK length 1-255
  system?: string;                  // Referenz auf Taxonomy 'system'
  character?: string;               // Charakter-Beschreibung
  background?: string;              // Hintergrund-Geschichte
  gender?: string;                  // Referenz auf Taxonomy 'gender'
  primary_profession?: string;      // Referenz auf Taxonomy 'profession'
  portrait_image_url?: string;
  portrait_description?: string;
  data_source?: string;
  created_by_id?: UUID;             // RENAMED: created_by_user -> created_by_id (FK-Suffix)
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Generated (read-only, not in create/update DTOs)
  search_vector?: string;           // tsvector, not exposed in API
  is_ambassador?: boolean;          // Computed by AgentService._enrich_ambassador_flag()
                                    // true if agent assigned to any embassy building (not stored in DB)

  // Relations (loaded on demand)
  professions?: AgentProfession[];
  reactions?: EventReaction[];
  building_relations?: BuildingAgentRelation[];
  aptitudes?: AgentAptitude[];
}
```

**Mapping Alt -> Neu:**
- `charakter` -> `character`
- `hintergrund` -> `background`
- `portrait_description_encoded` -> `portrait_description`
- `created_by_user` -> `created_by_id`
- `event_reactions` JSONB -> eliminiert (nur noch `event_reactions` Tabelle)
- `id` TEXT -> `id` UUID

---

## 3. AgentProfession

**Berufe/Qualifikationen eines Agenten.**

```typescript
interface AgentProfession {
  id: UUID;
  simulation_id: UUID;
  agent_id: UUID;
  profession: string;               // Referenz auf Taxonomy 'profession'
  qualification_level: number;      // 1-5
  specialization?: string;
  certified_at?: string;
  certified_by?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;

  // Populated
  agent?: Agent;
  profession_label?: string;        // Lokalisiertes Label
}
```

---

## 3b. AgentAptitude

**Operative-Type-spezifische Eignungswerte pro Agent.** Jeder Agent kann fuer jeden `operative_type` einen `aptitude_level` (3-9) haben, der die Erfolgswahrscheinlichkeit bei Missionen beeinflusst.

```typescript
interface AgentAptitude {
  id: UUID;
  agent_id: UUID;
  simulation_id: UUID;
  operative_type: OperativeType;         // 'spy' | 'saboteur' | 'propagandist' | 'assassin' | 'guardian' | 'infiltrator'
  aptitude_level: number;                // 3-9, Eignungsstufe
  created_at: string;
  updated_at: string;
}

// Convenience type for aptitude display/editing (maps operative type → level)
type AptitudeSet = Record<OperativeType, number>;
```

---

## 4. Building

**Orte und Strukturen in der Simulation.**

```typescript
interface Building {
  id: UUID;
  simulation_id: UUID;
  slug: string;                     // Auto-generated from name, UNIQUE per simulation (Migration 137)
  name: string;                     // CHECK length 1-255
  building_type: string;            // RENAMED: type -> building_type (SQL reserved word)
  description?: string;
  style?: string;
  location?: GeoLocation;           // JSON: {lat, lng, address}
  city_id?: UUID;
  zone_id?: UUID;
  street_id?: UUID;
  address?: string;
  population_capacity: number;
  construction_year?: number;
  building_condition?: string;      // RENAMED: condition -> building_condition (SQL reserved word)
  geojson?: GeoJSON;
  image_url?: string;
  image_prompt_text?: string;
  special_type?: string;            // Referenz auf Taxonomy 'building_special_type'
  special_attributes?: Record<string, any>;
  data_source?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Generated (read-only)
  search_vector?: string;           // tsvector, not exposed in API

  // Relations
  agents?: BuildingAgentRelation[];
  events?: BuildingEventRelation[];
  profession_requirements?: BuildingProfessionRequirement[];
  city?: City;
  zone?: Zone;
  street?: CityStreet;
}
```

---

## 5. Event

**Geschehnisse und Nachrichten in der Simulation.**

```typescript
interface Event {
  id: UUID;
  simulation_id: UUID;
  title: string;                    // CHECK length 1-500
  event_type?: string;              // RENAMED: type -> event_type (SQL reserved word)
  description?: string;
  occurred_at: string;              // RENAMED: event_timestamp -> occurred_at (Timestamp-Suffix)
  data_source: string;              // 'local' | 'generated' | 'imported' | 'transformed'
  metadata?: Record<string, any>;
  source_platform?: string;
  propaganda_type?: string;         // Referenz auf Taxonomy 'campaign_type'
  target_demographic?: string;      // Referenz auf Taxonomy 'target_demographic'
  urgency_level?: string;           // Referenz auf Taxonomy 'urgency_level'
  campaign_id?: UUID;
  original_trend_data?: Record<string, any>;
  impact_level: number;             // 1-10
  location?: string;
  tags: string[];                   // CHANGED: was jsonb, now text[]
  external_refs?: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Generated (read-only)
  search_vector?: string;           // tsvector, not exposed in API

  // Relations
  reactions?: EventReaction[];
  campaign?: Campaign;
}
```

---

## 6. EventReaction

**Reaktionen von Agenten auf Events.**

```typescript
interface EventReaction {
  id: UUID;
  simulation_id: UUID;
  event_id: UUID;
  agent_id: UUID;
  agent_name: string;
  reaction_text: string;
  occurred_at: string;              // RENAMED: reaction_timestamp -> occurred_at (Timestamp-Suffix)
  emotion?: string;
  confidence_score?: number;        // 0.0-1.0
  data_source?: string;
  created_at: string;
  updated_at: string;

  // Populated
  agent?: Agent;
  event?: Event;
}
```

---

## 7. City

**Uebergeordnete geographische Einheit.**

```typescript
interface City {
  id: UUID;
  simulation_id: UUID;
  name: string;                     // CHECK length 1-255
  layout_type?: string;
  description?: string;
  population: number;
  map_center_lat?: number;
  map_center_lng?: number;
  map_default_zoom: number;
  created_at: string;
  updated_at: string;

  // Relations
  zones?: Zone[];
  streets?: CityStreet[];
  buildings?: Building[];
}
```

---

## 8. Zone

**Geographische Unterteilung einer Stadt.**

```typescript
interface Zone {
  id: UUID;
  simulation_id: UUID;
  city_id: UUID;
  name: string;                     // CHECK length 1-255
  description?: string;
  zone_type: string;                // Referenz auf Taxonomy 'zone_type'
  population_estimate: number;
  security_level: string;           // Referenz auf Taxonomy 'security_level'
  data_source?: string;
  created_at: string;
  updated_at: string;

  // Relations
  city?: City;
  streets?: CityStreet[];
  buildings?: Building[];
}
```

---

## 9. CityStreet

```typescript
interface CityStreet {
  id: UUID;
  simulation_id: UUID;
  city_id: UUID;
  zone_id?: UUID;
  name?: string;
  street_type?: string;             // RENAMED: type -> street_type (SQL reserved word)
  length_km?: number;
  geojson?: GeoJSON;
  created_at: string;
  updated_at: string;
}
```

---

## 10. Campaign

**Organisierte Aktionen/Initiativen. Generischer Ersatz fuer `propaganda_campaigns`.**

```typescript
interface Campaign {
  id: UUID;
  simulation_id: UUID;
  title: string;                    // CHECK length 1-500
  description?: string;
  campaign_type?: string;           // Referenz auf Taxonomy 'campaign_type'
  target_demographic?: string;      // Referenz auf Taxonomy
  urgency_level?: string;           // Referenz auf Taxonomy
  source_trend_id?: UUID;
  is_integrated_as_event: boolean;  // RENAMED: integrated_as_event -> is_integrated_as_event (Boolean-Prefix)
  event_id?: UUID;
  created_at: string;
  updated_at: string;

  // Relations
  source_trend?: SocialTrend;
  event?: Event;
  campaign_events?: CampaignEvent[];
  metrics?: CampaignMetric[];
}
```

---

## 11. SocialTrend

**Externe Nachrichten und Trends.**

```typescript
interface SocialTrend {
  id: UUID;
  simulation_id: UUID;
  name: string;                     // CHECK length 1-255
  platform: string;                 // Dynamisch, nicht CHECK-constrained
  raw_data?: Record<string, any>;
  volume: number;
  url?: string;
  fetched_at: string;
  relevance_score?: number;         // 0-10, numeric(4,2)
  sentiment?: string;               // Dynamisch
  is_processed: boolean;            // RENAMED: processed -> is_processed (Boolean-Prefix)
  created_at: string;
  updated_at: string;
}
```

---

## 12. Social Media (Posts, Comments, Reactions)

**Generische Social-Media-Integration (nicht mehr nur Facebook).**

```typescript
interface SocialMediaPost {
  id: UUID;
  simulation_id: UUID;
  platform: string;                 // 'facebook' | 'twitter' | 'instagram' | ...
  platform_id: string;              // Original-ID der Plattform
  page_id?: string;
  author?: string;
  message?: string;
  source_created_at: string;        // RENAMED: created_time -> source_created_at (Timestamp-Suffix)
  attachments: any[];
  reactions: Record<string, any>;
  transformed_content?: string;
  transformation_type?: string;
  transformed_at?: string;          // RENAMED: transformation_timestamp -> transformed_at (Timestamp-Suffix)
  original_sentiment?: Record<string, any>;
  transformed_sentiment?: Record<string, any>;
  is_published: boolean;
  linked_event_id?: UUID;
  imported_at: string;              // RENAMED: import_timestamp -> imported_at (Timestamp-Suffix)
  last_synced_at: string;           // RENAMED: last_sync -> last_synced_at (Timestamp-Suffix)
  created_at: string;
  updated_at: string;
}

interface SocialMediaComment {
  id: UUID;
  simulation_id: UUID;
  post_id: UUID;
  platform_id: string;
  parent_comment_id?: UUID;
  author: string;
  message: string;
  source_created_at: string;        // RENAMED: created_time -> source_created_at (Timestamp-Suffix)
  transformed_content?: string;
  sentiment?: Record<string, any>;
  imported_at: string;              // RENAMED: import_timestamp -> imported_at (Timestamp-Suffix)
  created_at: string;
  updated_at: string;
}

interface SocialMediaAgentReaction {
  id: UUID;
  simulation_id: UUID;
  post_id?: UUID;                   // XOR comment_id
  comment_id?: UUID;                // XOR post_id
  agent_id: UUID;
  reaction_type: string;
  reaction_content: string;
  reaction_intensity?: number;      // 1-10
  created_at: string;
}
```

---

## 13. Chat System

**Konversationen zwischen Benutzern und Simulations-Agenten.**

```typescript
interface AgentBrief {
  id: UUID;
  name: string;
  portrait_image_url?: string;
}

interface ChatEventReference {
  id: UUID;
  event_id: UUID;
  event_title: string;
  event_type?: string;
  event_description?: string;
  occurred_at?: string;
  impact_level?: number;
  referenced_at: string;
}

interface ChatConversation {
  id: UUID;
  simulation_id: UUID;
  user_id: UUID;
  agent_id?: UUID;                     // Optional for group chats
  title?: string;
  status: 'active' | 'archived';
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;

  // Relations
  messages?: ChatMessage[];
  agents?: AgentBrief[];
  event_references?: ChatEventReference[];
}

interface ChatMessage {
  id: UUID;
  conversation_id: UUID;
  agent_id?: UUID;                       // Agent who sent/received this message
  sender_role: 'user' | 'assistant';     // RENAMED: role -> sender_role (SQL reserved word)
  content: string;                       // Max 5000 chars
  metadata?: Record<string, any>;
  created_at: string;

  // Populated
  agent?: AgentBrief;
}
```

---

## 14. Prompt Templates

**AI-Prompt-Konfiguration pro Simulation und Sprache.**

```typescript
interface PromptTemplate {
  id: UUID;
  simulation_id?: UUID;             // NULL = Plattform-Default
  template_type: PromptTemplateType;
  prompt_category: PromptCategory;  // RENAMED: category -> prompt_category (Clarity)
  locale: string;                   // 'de' | 'en' | ...
  template_name: string;
  prompt_content: string;
  system_prompt?: string;
  variables: PromptVariable[];
  description?: string;
  default_model?: string;
  temperature: number;              // 0.0-2.0
  max_tokens: number;
  negative_prompt?: string;         // Fuer Bildgenerierung
  is_system_default: boolean;
  is_active: boolean;
  version: number;
  parent_template_id?: UUID;
  created_by_id?: UUID;             // RENAMED: created_by -> created_by_id (FK-Suffix)
  created_at: string;
  updated_at: string;
}

type PromptTemplateType =
  | 'agent_generation'
  | 'agent_description'
  | 'agent_reactions'
  | 'agent_portrait_description'
  | 'user_agent_description'
  | 'user_agent_portrait_description'
  | 'building_generation'
  | 'building_description'
  | 'building_image_prompt'
  | 'building_image_generation'
  | 'social_trends_title'
  | 'social_trends_description'
  | 'event_reaction'
  | 'news_integration'
  | 'portrait_generation'
  | 'chat_system_prompt'
  | 'chat_with_memory'
  | 'news_transformation'
  | 'social_media_transformation'
  | 'social_media_sentiment'
  | 'social_media_agent_reaction'
  | 'relationship_generation'
  | 'event_echo_transformation';

type PromptCategory =
  | 'text_generation'
  | 'image_generation'
  | 'description_generation'
  | 'reaction_generation'
  | 'transformation'
  | 'analysis';
```

---

## 15. Beziehungs-Tabellen

```typescript
interface BuildingAgentRelation {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  agent_id: UUID;
  relation_type: string;            // 'assigned' | 'owner' | 'visitor' | 'worker'
  created_at: string;

  // Populated
  building?: Building;
  agent?: Agent;
}

interface BuildingEventRelation {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  event_id: UUID;
  relation_type: string;
  created_at: string;
}

interface BuildingProfessionRequirement {
  id: UUID;
  simulation_id: UUID;
  building_id: UUID;
  profession: string;               // Referenz auf Taxonomy
  min_qualification_level: number;  // 1-5
  is_mandatory: boolean;
  description?: string;
  created_at: string;
}

interface CampaignEvent {
  id: UUID;
  simulation_id: UUID;
  campaign_id: UUID;
  event_id: UUID;
  integration_type: string;
  integration_status: string;       // 'pending' | 'active' | 'completed'
  agent_reactions_generated: boolean;
  reactions_count: number;
  event_metadata?: Record<string, any>;
  performance_metrics?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface CampaignMetric {
  id: UUID;
  simulation_id: UUID;
  campaign_id: UUID;
  metric_name: string;
  metric_value: number;
  metric_metadata?: Record<string, any>;
  measured_at: string;
}
```

---

## 23. Forge Draft Models (AI Generation)

**Pydantic-AI output models for the Simulation Forge (Phase II: Drafting Table).** These models serve as `output_type` for structured LLM generation. Field descriptions embed word-count guidance and image-generation hints to ensure output quality matches downstream DB prompt templates.

```typescript
// Geography — typed zone/street sub-models replace list[dict]
interface ForgeZoneDraft {
  name: string;
  zone_type: string;                  // e.g. residential, industrial, cultural, commercial, government
  description: string;                // 1-2 sentence atmospheric description
  characteristics: string[];          // 2-4 evocative tags (e.g. "perpetual twilight", "echoing walls")
}

interface ForgeStreetDraft {
  name: string;
  zone_name: string;                  // Zone this street belongs to
  street_type: string;                // e.g. alley, boulevard, lane, avenue, stairway
  description?: string;               // Optional 1-sentence atmospheric detail
}

interface ForgeGeographyDraft {
  city_name: string;
  zones: ForgeZoneDraft[];
  streets: ForgeStreetDraft[];
}

// Agents — Field descriptions request 200-300 words + physical impressions for portrait gen
interface ForgeAgentDraft {
  name: string;
  gender: string;
  system: string;
  primary_profession: string;
  character: string;                  // 200-300 words: temperament, mannerisms, contradictions, physical impression
  background: string;                 // 200-300 words: origin, formative event, motivation, secret
}

// Buildings — Field descriptions request 150-250 words + materials/sensory details for image gen
interface ForgeBuildingDraft {
  name: string;
  building_type: string;
  description: string;                // 150-250 words: architectural style, materials, sensory details
  building_condition: string;         // pristine | good | fair | poor | ruined (varied across set)
}
```

**Materialization Compatibility:** `fn_materialize_shard` reads zone/street data from JSONB via `->>'name'`, `->>'zone_type'`, `->>'description'`. Extra fields (`characteristics`, street `description`) are safely ignored by the SQL — no migration required.

---

## Column Rename Summary (v1.0 -> v2.0)

All renames follow these conventions established in 03_DATABASE_SCHEMA_NEW v2.0:

| Convention | Rule | Examples |
|------------|------|---------|
| **SQL Reserved Words** | Prefix with table/context name | `type` -> `building_type`, `role` -> `member_role` |
| **FK Suffix** | All foreign key columns end in `_id` | `created_by` -> `created_by_id`, `updated_by` -> `updated_by_id` |
| **Boolean Prefix** | All booleans start with `is_` | `processed` -> `is_processed` |
| **Timestamp Suffix** | All timestamps end in `_at` | `last_sync` -> `last_synced_at`, `created_time` -> `source_created_at` |

---

## Taxonomy-Typen

Die folgenden Taxonomy-Typen ersetzen alle hartcodierten ENUMs und CHECK Constraints:

| Taxonomy-Typ | Ersetzt | Velgarien-Seed-Werte |
|-------------|---------|---------------------|
| `gender` | `gender_type` ENUM | male, female, diverse, alien |
| `profession` | `profession_type` ENUM | scientist, leader, military, engineer, artist, medic, security, admin, craftsman, specialist |
| `system` | Hardcoded in validation | politics, military, civil, economy, underworld, clergy, science |
| `building_type` | Hardcoded in validation | residential, office, factory, clinic, education, culture, government, trade, infrastructure, other |
| `building_style` | Hardcoded in validation | brutalist, modern, classic, futuristic, industrial |
| `building_special_type` | `building_special_type` ENUM | academy, military_academy, medical_center, research_lab, propaganda_center, embassy |
| `campaign_type` | `propaganda_type` CHECK | surveillance, control, distraction, loyalty, productivity, conformity |
| `target_demographic` | `target_demographic` CHECK | education_sector, working_population, health_conscious, general_population |
| `urgency_level` | `urgency_level` CHECK | low, medium, high, critical |
| `zone_type` | `zone_type` CHECK | residential, commercial, industrial, military, religious, government, slums, ruins |
| `security_level` | `security_level` CHECK | low, medium, high, restricted |
| `event_type` | Hardcoded | political, economic, social, environmental, technological, cultural, military, disaster, other |
| `sentiment` | `sentiment` CHECK | positive, negative, neutral, mixed |
| `interaction_type` | CHECK | supportive, resistant, fearful, neutral |
| `campaign_tone` | `tone` CHECK | authoritarian, paternalistic, urgent, reassuring, threatening |
| `complexity_level` | CHECK | simple, medium, complex, sophisticated |
| `relationship_type` | Neu (v2.2) | ally, rival, mentor, student, lover, family, colleague, enemy |

---

## 16. Agent Relationships

**Beziehungen zwischen Agenten innerhalb einer Simulation.**

```typescript
interface AgentRelationship {
  id: UUID;
  simulation_id: UUID;
  source_agent_id: UUID;
  target_agent_id: UUID;
  relationship_type: string;        // Referenz auf Taxonomy 'relationship_type'
  is_bidirectional: boolean;
  intensity: number;                // Staerke der Beziehung
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Populated
  source_agent?: Agent;
  target_agent?: Agent;
}

// AI-generated suggestion (used in AgentDetailsPanel inline review flow)
interface RelationshipSuggestion {
  target_agent_id: string;
  relationship_type: string;
  intensity: number;
  description: string;
  is_bidirectional: boolean;
}
```

---

## 17. Event Echoes

**Simulations-uebergreifende Echo-Effekte von Events.** Wenn ein bedeutsames Event in einer Simulation stattfindet, kann es als Echo in eine andere Simulation "bluten" — transformiert durch einen Echo-Vektor.

```typescript
type EchoVector =
  | 'commerce'       // Handelsbeziehungen
  | 'language'        // Sprachliche Drift
  | 'memory'          // Kollektive Erinnerung
  | 'resonance'       // Thematische Resonanz
  | 'architecture'    // Bauliche Einfluesse
  | 'dream'           // Traumhafte Verzerrung
  | 'desire';         // Unterbewusste Sehnsucht

type EchoStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'rejected';

interface EventEcho {
  id: UUID;
  source_event_id: UUID;
  source_simulation_id: UUID;
  target_simulation_id: UUID;
  target_event_id?: UUID;           // Generiertes Ziel-Event (nach Transformation)
  echo_vector: EchoVector;
  echo_strength: number;            // 0-1, Zerfall pro Hop
  echo_depth: number;               // 1-3, Kaskadenverhinderung
  root_event_id?: UUID;             // Urspruengliches Event bei Kaskaden
  status: EchoStatus;
  bleed_metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Populated
  source_event?: Event;
  target_event?: Event;
}
```

**Echo-Regeln:**
- **Echo-Vektoren (7 Typen):** `commerce`, `language`, `memory`, `resonance`, `architecture`, `dream`, `desire` — bestimmen, wie das Quell-Event beim Uebergang transformiert wird.
- **Echo-Tiefe (1-3):** Verhindert endlose Kaskaden. Ein Echo der Tiefe 3 erzeugt keine weiteren Echoes. `root_event_id` verweist auf das urspruengliche Ausloese-Event.
- **Echo-Staerke (0-1):** Nimmt pro Hop ab. Bestimmt den Impact-Level des generierten Ziel-Events. Unterhalb eines Schwellwerts wird das Echo verworfen.
- **Status-Workflow:** `pending` -> `generating` (AI-Transformation laeuft) -> `completed` (Ziel-Event erstellt) | `failed` (Generierung fehlgeschlagen) | `rejected` (manuell abgelehnt oder Staerke zu gering).

---

## 18. Simulation Connections

**Verbindungen zwischen Simulationen fuer Cross-Simulation-Interaktion.**

```typescript
interface SimulationConnection {
  id: UUID;
  simulation_a_id: UUID;
  simulation_b_id: UUID;
  connection_type: string;
  bleed_vectors: string[];           // Erlaubte Echo-Vektoren fuer diese Verbindung
  strength: number;                  // Verbindungsstaerke
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Populated
  simulation_a?: Simulation;
  simulation_b?: Simulation;
}
```

---

## 19. Map Data (Aggregiert)

**Aggregierte Daten fuer die Simulations-Karte / Netzwerk-Visualisierung.**

```typescript
interface MapData {
  simulations: Simulation[];
  connections: SimulationConnection[];
  echo_counts: Record<string, number>;  // Simulation-ID -> Anzahl aktiver Echoes
}
```

---

## 20. Embassies

**Simulations-uebergreifende diplomatische Gebaeude.** Embassies verbinden zwei Buildings aus verschiedenen Simulationen und ermoeglichen diplomatischen Austausch, Bleed-Effekte und Ambassador-Zuweisungen.

```typescript
type EmbassyStatus = 'proposed' | 'active' | 'suspended' | 'dissolved';

interface EmbassyAmbassador {
  name: string;
  role?: string;
  quirk?: string;
}

interface EmbassyMetadata {
  ambassador_a?: EmbassyAmbassador;
  ambassador_b?: EmbassyAmbassador;
  protocol?: string;
  ache_point?: string;
  [key: string]: unknown;
}

interface Embassy {
  id: UUID;
  building_a_id: UUID;
  simulation_a_id: UUID;
  building_b_id: UUID;
  simulation_b_id: UUID;
  status: EmbassyStatus;
  connection_type: string;
  description?: string;
  established_by?: string;
  bleed_vector?: EchoVector;
  event_propagation: boolean;
  embassy_metadata?: EmbassyMetadata;
  created_by_id?: UUID;
  created_at: string;
  updated_at: string;

  // Populated
  building_a?: Building;
  building_b?: Building;
  simulation_a?: Simulation;
  simulation_b?: Simulation;
}
```

---

## 21. Game Mechanics (Materialized Views)

**Berechnete Metriken fuer Spielmechaniken.** Diese Typen bilden die 4 materialisierten Views ab, die aus den Kerndaten aggregierte Gesundheits- und Bereitschaftswerte berechnen.

```typescript
interface BuildingReadiness {
  building_id: UUID;
  simulation_id: UUID;
  zone_id?: UUID;
  building_name: string;
  building_type?: string;
  building_condition?: string;
  population_capacity: number;
  special_type?: string;
  assigned_agents: number;
  staffing_ratio: number;
  staffing_status: string;
  qualification_match: number;
  condition_factor: number;
  criticality_weight: number;
  readiness: number;
}

interface ZoneStability {
  zone_id: UUID;
  simulation_id: UUID;
  city_id?: UUID;
  zone_name: string;
  zone_type?: string;
  security_level?: string;
  infrastructure_score: number;
  security_factor: number;
  event_pressure: number;
  building_count: number;
  total_agents: number;
  total_capacity: number;
  critical_understaffed_count: number;
  avg_readiness: number;
  stability: number;
  stability_label: string;
}

interface EmbassyEffectiveness {
  embassy_id: UUID;
  simulation_a_id: UUID;
  simulation_b_id: UUID;
  building_a_id: UUID;
  building_b_id: UUID;
  status: string;
  bleed_vector?: string;
  building_health: number;
  ambassador_quality: number;
  vector_alignment: number;
  effectiveness: number;
  effectiveness_label: string;
}

interface SimulationHealth {
  simulation_id: UUID;
  simulation_name: string;
  slug?: string;
  avg_zone_stability: number;
  zone_count: number;
  critical_zone_count: number;
  unstable_zone_count: number;
  building_count: number;
  avg_readiness: number;
  critically_understaffed_buildings: number;
  overcrowded_buildings: number;
  total_agents_assigned: number;
  total_capacity: number;
  diplomatic_reach: number;
  active_embassy_count: number;
  avg_embassy_effectiveness: number;
  outbound_echoes: number;
  inbound_echoes: number;
  avg_outbound_strength: number;
  bleed_permeability: number;
  overall_health: number;
  health_label: string;
}

interface SimulationHealthDashboard {
  health: SimulationHealth;
  zones: ZoneStability[];
  buildings: BuildingReadiness[];
  embassies: EmbassyEffectiveness[];
  recent_high_impact_events: Record<string, unknown>[];
}
```

---

## 22. Competitive Layer / Epochs

**PvP-Wettbewerbssystem.** Epochs sind zeitlich begrenzte Wettbewerbe zwischen Simulationen mit Team-Bildung, Operativen-Einsaetzen, Punktewertung und Battle-Log.

```typescript
type EpochStatus = 'lobby' | 'foundation' | 'competition' | 'reckoning' | 'completed' | 'cancelled';

type OperativeType = 'spy' | 'saboteur' | 'propagandist' | 'assassin' | 'guardian' | 'infiltrator';

type BattleLogEventType = 'operative_deployed' | 'mission_success' | 'mission_failed' | 'detected' | 'captured' | 'sabotage' | 'propaganda' | 'assassination' | 'infiltration' | 'alliance_formed' | 'alliance_dissolved' | 'betrayal' | 'phase_change' | 'epoch_start' | 'epoch_end' | 'rp_allocated' | 'building_damaged' | 'agent_wounded' | 'counter_intel' | 'intel_report' | 'zone_fortified';

interface EpochScoreWeights {
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
}

interface EpochConfig {
  duration_days: number;
  cycle_hours: number;
  rp_per_cycle: number;
  rp_cap: number;
  foundation_pct: number;
  reckoning_pct: number;
  max_team_size: number;
  max_agents_per_player?: number;        // Max agents per player in draft (default: 3)
  allow_betrayal: boolean;
  score_weights: EpochScoreWeights;
  referee_mode: boolean;
}

interface Epoch {
  id: UUID;
  name: string;
  description?: string;
  created_by_id: UUID;
  starts_at?: string;
  ends_at?: string;
  current_cycle: number;
  status: EpochStatus;
  config: EpochConfig;
  created_at: string;
  updated_at: string;
}

interface EpochParticipant {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  user_id?: UUID;                          // Direct user reference (Migration 049). NULL for bots.
  team_id?: UUID;
  joined_at: string;
  current_rp: number;
  last_rp_grant_at?: string;
  final_scores?: Record<string, number>;
  is_bot: boolean;
  bot_player_id?: UUID;
  bot_players?: BotPlayer;  // Joined via PostgREST select
  cycle_ready: boolean;
  drafted_agent_ids?: string[];          // UUID[] of agents selected during draft phase
  draft_completed_at?: string;           // ISO 8601 timestamp when draft was locked in
  simulations?: { name: string; slug: string };
}

interface EpochTeam {
  id: UUID;
  epoch_id: UUID;
  name: string;
  created_by_simulation_id: UUID;
  created_at: string;
  dissolved_at?: string;
  dissolved_reason?: string;
}

interface OperativeMission {
  id: UUID;
  epoch_id: UUID;
  agent_id: UUID;
  operative_type: OperativeType;
  source_simulation_id: UUID;
  target_simulation_id?: UUID;
  embassy_id?: UUID;
  target_entity_id?: UUID;
  target_entity_type?: string;
  target_zone_id?: UUID;
  status: string;
  cost_rp: number;
  success_probability?: number;
  deployed_at: string;
  resolves_at: string;
  resolved_at?: string;
  mission_result?: Record<string, unknown>;
  created_at: string;

  // Populated
  agents?: { name: string; portrait_image_url?: string };
}

interface LeaderboardEntry {
  rank: number;
  simulation_id: UUID;
  simulation_name: string;
  simulation_slug?: string;
  team_name?: string;
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
  composite: number;
  stability_title?: string;
  influence_title?: string;
  sovereignty_title?: string;
  diplomatic_title?: string;
  military_title?: string;
}

interface EpochScore {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  cycle_number: number;
  stability_score: number;
  influence_score: number;
  sovereignty_score: number;
  diplomatic_score: number;
  military_score: number;
  composite_score: number;
  computed_at: string;
}

interface BattleLogEntry {
  id: UUID;
  epoch_id: UUID;
  cycle_number: number;
  event_type: BattleLogEventType;
  source_simulation_id?: UUID;
  target_simulation_id?: UUID;
  mission_id?: UUID;
  narrative: string;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Epoch Invitations (Migration 036) ───────────────────

type EpochInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

interface EpochInvitation {
  id: UUID;
  epoch_id: UUID;
  invited_by_id: UUID;
  invited_email: string;
  invited_role: string;
  invite_token: UUID;
  status: EpochInvitationStatus;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Epoch Chat (Migration 037) ──────────────────────────

type EpochChatChannelType = 'epoch' | 'team';

interface EpochChatMessage {
  id: UUID;
  epoch_id: UUID;
  sender_id: UUID;
  sender_simulation_id: UUID;
  channel_type: EpochChatChannelType;
  team_id?: UUID;
  content: string;
  sender_type: 'human' | 'bot';
  created_at: string;
  sender_simulation_name?: string; // enriched client-side
}

interface PresenceUser {
  user_id: string;
  simulation_id: string;
  simulation_name: string;
  online_at: string;
}

// ── Bot Players (Migration 041) ─────────────────────────

type BotPersonality = 'sentinel' | 'warlord' | 'diplomat' | 'strategist' | 'chaos';
type BotDifficulty = 'easy' | 'medium' | 'hard';

interface BotPlayer {
  id: UUID;
  name: string;
  personality: BotPersonality;
  difficulty: BotDifficulty;
  config: Record<string, unknown>;
  created_by_id: UUID;
  created_at: string;
  updated_at: string;
}
```

### Notification Preferences

```typescript
interface NotificationPreferences {
  cycle_resolved: boolean;           // Email nach cycle resolve
  phase_changed: boolean;            // Email bei Phasenwechsel
  epoch_completed: boolean;          // Email bei Epoch-Ende (Endrangliste)
  email_locale: string;              // 'en' | 'de' — Sprache der Email
}
```

Gespeichert in `notification_preferences` Tabelle (1 Zeile pro User, UNIQUE user_id). Defaults: alle `true`, locale `'en'`. Verwendet in `CycleNotificationService` fuer Recipient-Resolution.

### Zone Fortification

```typescript
interface ZoneFortification {
  id: UUID;
  epoch_id: UUID;
  zone_id: UUID;
  source_simulation_id: UUID;
  security_bonus: number;                // Default 1 (one security tier)
  expires_at_cycle: number;              // Cycle number when fortification expires
  created_at: string;
}
```

Versteckte Zonenfortifikationen waehrend der Foundation-Phase ("Nebelkrieg"). Erhoehen die Sicherheitsstufe einer Zone um 1 Tier fuer 5 Wettbewerbszyklen. Max 1 pro Zone. Kosten 2 RP. Nur sichtbar fuer den Besitzer und via feindliche Spion-Intel-Reports.

### Zone Actions (Simulation-Level)

```typescript
interface ZoneAction {
  id: UUID;
  zone_id: UUID;
  simulation_id: UUID;
  action_type: 'fortify' | 'quarantine' | 'deploy_resources';
  effect_value: number;              // 0.0-1.0
  created_by_id: UUID | null;
  expires_at: string;                // ISO timestamp
  cooldown_until: string;            // ISO timestamp
  created_at: string;
  deleted_at: string | null;
}
```

Simulation-level zone actions affecting zone stability. Three action types with different effect values, durations, and cooldowns:

| Action | Effect | Duration | Cooldown | Description |
|--------|--------|----------|----------|-------------|
| `fortify` | +0.3 | 7 days | 14 days | Deploy resources to stabilize zone |
| `quarantine` | -0.1 | 14 days | 21 days | Isolate zone to prevent cascade spreading |
| `deploy_resources` | +0.5 | 3 days | 30 days | Emergency intervention, strong but short |

Only one active action per zone at a time. Cooldown prevents re-use of the same action type until expired.

### Event Chains

```typescript
interface EventChain {
  id: UUID;
  simulation_id: UUID;
  parent_event_id: UUID;
  child_event_id: UUID;
  chain_type: 'escalation' | 'follow_up' | 'resolution' | 'cascade' | 'resonance';
  created_at: string;
}
```

Links between related events forming narrative chains. Chain types:
- `escalation`: Event intensifies into a more severe event
- `follow_up`: Consequential event spawned by a parent
- `resolution`: Event that resolves or concludes a parent event
- `cascade`: Auto-spawned by `process_cascade_events()` when zone pressure exceeds threshold
- `resonance`: Spawned by substrate resonance impact processing

### Event Zone Links

```typescript
interface EventZoneLink {
  id: UUID;
  event_id: UUID;
  zone_id: UUID;
  affinity_weight: number;           // 0.0-1.0, default 1.0
  link_source: 'auto' | 'manual' | 'location_match';
  created_at: string;
}
```

Links events to affected zones via the zone gravity matrix. Auto-assigned by trigger (`assign_event_zones()`) on event creation/update.

### Event Status Lifecycle

Events have a `event_status` field with pressure multipliers:

| Status | Multiplier | Description |
|--------|-----------|-------------|
| `active` | 1.0x | Normal active event |
| `escalating` | 1.3x | Intensifying — increased pressure |
| `resolving` | 0.5x | Being resolved — reduced pressure |
| `resolved` | 0.0x | Fully resolved — no pressure |
| `archived` | 0.0x | Historical record only |

### Substrate Resonance

```typescript
interface Resonance {
  id: UUID;
  source_category: SourceCategory;
  resonance_signature: ResonanceSignature;
  archetype: string;
  title: string;
  description: string | null;
  bureau_dispatch: string | null;
  real_world_source: Record<string, unknown> | null;
  magnitude: number;                 // 0.1-1.0
  affected_event_types: string[];
  status: 'detected' | 'impacting' | 'subsiding' | 'archived';
  detected_at: string;
  impacts_at: string | null;
  subsides_at: string | null;
  created_by_id: UUID | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

Platform-level phenomena that propagate across simulations. 8 source categories map to 8 resonance signatures and 8 archetypes. See [Substrate Resonances Spec](../specs/substrate-resonances.md) for full documentation.

### Resonance Impact

```typescript
interface ResonanceImpact {
  id: UUID;
  resonance_id: UUID;
  simulation_id: UUID;
  susceptibility: number;
  effective_magnitude: number;
  status: 'pending' | 'generating' | 'completed' | 'skipped' | 'failed';
  spawned_event_ids: UUID[];
  narrative_context: string | null;
  created_at: string;
}
```

Per-simulation impact record created when a resonance is processed. Effective magnitude = `MIN(resonance.magnitude * susceptibility, 1.00)`.

### Prompt Template Types (Extended)

Additional template types beyond the base set:

| Type | Description |
|------|-------------|
| `memory_extraction` | Extract observations from chat messages |
| `memory_reflection` | Synthesize memories into insights |
| `event_echo_transformation` | Transform events across simulations (bleed) |
| `resonance_impact_generation` | Generate events when resonance impacts a simulation |

---

## 24. Account Tiers & Forge Access

**Platform-level access control.** Account Tiers govern Forge access and simulation creation. Separate from Simulation Roles (owner/admin/editor/viewer), which are simulation-scoped.

```typescript
type AccountTier = 'observer' | 'architect' | 'director';

type ForgeAccessStatus = 'pending' | 'approved' | 'rejected';

interface ForgeAccessRequest {
  id: UUID;
  user_id: UUID;
  requested_tier: AccountTier;
  status: ForgeAccessStatus;
  message?: string;                   // User's application message
  admin_notes?: string;               // Platform admin review notes
  reviewed_by?: UUID;                 // Admin who reviewed the request
  created_at: string;                 // ISO 8601
  reviewed_at?: string;               // ISO 8601
}

interface ForgeAccessRequestWithEmail extends ForgeAccessRequest {
  user_email: string;                 // From v_pending_forge_requests view (admin use)
}
```

**UserWallet (updated):**

```typescript
interface UserWallet {
  // ... existing fields ...
  account_tier: AccountTier;          // Default 'observer'. Controls Forge access.
  is_architect: boolean;              // Maintained via DB trigger for backward compat.
                                      // TRUE when account_tier IN ('architect', 'director').
  byok_bypass: boolean;              // Per-user BYOK bypass for token costs.
  byok_allowed: boolean;             // Per-user BYOK access (when policy is 'per_user').
}
```

---

## 25. Forge Token Economy

**Token purchasing, wallet management, and feature purchases.** Mock-monetization layer for the Forge.

```typescript
interface TokenBundle {
  id: UUID;
  slug: string;                       // e.g. 'field-sample', 'architects-reserve'
  display_name: string;
  tokens: number;
  price_cents: number;
  savings_pct: number;                // 0-100
  sort_order: number;
  is_active: boolean;
}

interface TokenPurchaseHistory {
  id: UUID;
  user_id: UUID;
  bundle_id: UUID;
  tokens_granted: number;
  price_cents: number;
  payment_method: 'mock' | 'stripe' | 'admin_grant' | 'subscription';
  payment_reference?: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

interface PurchaseReceipt {
  purchase_id: UUID;
  bundle_slug: string;
  tokens_granted: number;
  balance_before: number;
  balance_after: number;
  price_cents: number;
}

type FeatureType = 'darkroom_pass' | 'classified_dossier' | 'recruitment' | 'chronicle_export';
type FeatureStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

interface FeaturePurchase {
  id: UUID;
  user_id: UUID;
  simulation_id: UUID;
  feature_type: FeatureType;
  token_cost: number;                 // 0 for admin/BYOK bypass
  status: FeatureStatus;
  config: Record<string, unknown>;
  result: Record<string, unknown>;
  regen_budget_remaining: number;     // Darkroom-specific: remaining image regenerations
  created_at: string;
  completed_at?: string;
}

interface UpdateBYOKRequest {
  openrouter_key?: string;
  replicate_key?: string;
}

interface TestBYOKRequest {
  provider: 'openrouter' | 'replicate';
  key: string;
}

interface TestBYOKResult {
  valid: boolean;
  detail: string;
  response_ms: number;                  // 0 on timeout/connection error
}

// ── Agent Bonds ──────────────────────────────────────────────────────

interface Bond {
  id: string;
  user_id: string;
  agent_id: string;
  simulation_id: string;
  depth: number;                        // 1-5
  status: 'forming' | 'active' | 'strained' | 'farewell';
  attention_score: number;
  formed_at: string | null;
  agent_name: string | null;            // Enriched from agents join
  agent_portrait_url: string | null;
  created_at: string;
  updated_at: string;
}

interface BondDetail extends Bond {
  recent_whispers: Whisper[];
  unread_count: number;
  agent_mood_score: number | null;
  agent_dominant_emotion: string | null;
  agent_stress_level: number | null;
}

interface Whisper {
  id: string;
  bond_id: string;
  whisper_type: 'state' | 'event' | 'memory' | 'question' | 'reflection';
  content_de: string;
  content_en: string;
  trigger_context: Record<string, unknown>;
  read_at: string | null;
  acted_on: boolean;
  action_acknowledged: boolean;
  created_at: string;
}

interface RecognitionCandidate {
  agent_id: string;
  agent_name: string;
  agent_portrait_url: string | null;
  attention_score: number;
  simulation_id: string;
}
```
