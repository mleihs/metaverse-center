---
title: "Substrate Resonances: Platform-Level Event Propagation"
id: substrate-resonances
version: "1.3"
date: 2026-03-17
lang: en
type: spec
status: active
tags: [resonance, game-mechanics, event-propagation, archetypes, platform-level]
---

# Substrate Resonances: Platform-Level Event Propagation

## Overview

Substrate Resonances are platform-level phenomena that propagate across all simulations. They represent real-world events (economic crises, pandemics, conflicts) translated into archetypal forces that impact each simulation differently based on its unique susceptibility profile.

The system creates a shared narrative layer: when a resonance is detected, every simulation feels its effects — but each world interprets and suffers it differently. A military conflict might devastate Velgarien (susceptibility 1.5) while barely touching Station Null (susceptibility 1.0).

### Design Goals

- **Shared world-state:** All simulations share a common substrate of forces
- **Differential impact:** Each simulation responds differently via susceptibility profiles
- **Narrative coherence:** Real-world events become archetypal forces with in-world meaning
- **Operative integration:** Active resonances modify operative effectiveness in competitive epochs

---

## Core Concepts

### Source Categories (Real-World Triggers)

| Source Category | Description |
|----------------|-------------|
| `economic_crisis` | Financial collapse, market crashes, trade disruptions |
| `military_conflict` | Wars, armed conflicts, territorial disputes |
| `pandemic` | Disease outbreaks, biological threats |
| `natural_disaster` | Earthquakes, floods, storms, volcanic events |
| `political_upheaval` | Revolutions, coups, regime changes |
| `tech_breakthrough` | Disruptive technology, paradigm shifts |
| `cultural_shift` | Social movements, ideological changes |
| `environmental_disaster` | Ecological collapse, pollution crises |

### Resonance Signatures (In-World Manifestation)

Each source category maps deterministically to a resonance signature — the in-world manifestation of the real-world event:

| Signature | Source | Affected Event Types |
|-----------|--------|---------------------|
| `economic_tremor` | economic_crisis | trade, crisis, social |
| `conflict_wave` | military_conflict | military, intrigue, social |
| `biological_tide` | pandemic | social, crisis, eldritch |
| `elemental_surge` | natural_disaster | crisis, nautical, discovery |
| `authority_fracture` | political_upheaval | intrigue, military, social |
| `innovation_spark` | tech_breakthrough | discovery, trade, intrigue |
| `consciousness_drift` | cultural_shift | social, religious, discovery |
| `decay_bloom` | environmental_disaster | crisis, eldritch, social |

### Archetypes (Narrative Forces)

Each signature carries an archetype — a Jungian narrative force that shapes how the resonance manifests in stories and gameplay:

| Archetype | Signature | Meaning |
|-----------|-----------|---------|
| The Tower | economic_tremor | Collapse of established structures |
| The Shadow | conflict_wave | Hidden violence and aggression surfacing |
| The Devouring Mother | biological_tide | Nature consuming its children |
| The Deluge | elemental_surge | Overwhelming elemental forces |
| The Overthrow | authority_fracture | Power structures overturned |
| The Prometheus | innovation_spark | Fire of knowledge, transformative discovery |
| The Awakening | consciousness_drift | Collective shift in awareness |
| The Entropy | decay_bloom | Slow dissolution, decay as transformation |

### Archetype Descriptions

| Archetype | Description |
|-----------|-------------|
| The Tower | A tremor through the foundations of commerce and trust. Markets buckle, alliances strain, and the architecture of prosperity reveals its cracks. |
| The Shadow | The drumbeat of conflict reverberates across boundaries. Old enmities surface, new battle lines are drawn, and the shadow of war touches every corner. |
| The Devouring Mother | A sickness moves through the substrate, indifferent to borders and beliefs. Communities turn inward, healers are sought, and the rhythm of daily life fractures. |
| The Deluge | The elements assert their dominion. Coastlines shift, storms reshape landscapes, and civilizations remember their smallness before the forces that birthed them. |
| The Overthrow | The old order trembles. Whether through revolution, reform, or the quiet erosion of legitimacy, power changes hands and nothing remains as it was. |
| The Prometheus | A new fire illuminates and burns in equal measure. Knowledge advances, old methods become obsolete, and societies must choose: adapt or be consumed by progress. |
| The Awakening | A subtle shift in the collective mind. New philosophies emerge, old certainties dissolve, and the way people see their world transforms from within. |
| The Entropy | The slow unwinding. Systems that once sustained life falter, the environment rebels, and communities must confront the consequences of their choices. |

---

## Status Lifecycle

```
detected → impacting → subsiding → archived
```

| Status | Description |
|--------|-------------|
| `detected` | Resonance identified, awaiting `impacts_at` timestamp |
| `impacting` | Active — spawning events in target simulations |
| `subsiding` | All impacts processed, effects fading |
| `archived` | Terminal state, historical record only |

**Transitions:**
- `detected → impacting`: Platform admin triggers impact processing (or auto at `impacts_at`)
- `impacting → subsiding`: Automatic when all `resonance_impacts` reach `completed` status
- `subsiding → archived`: Platform admin archives after effects fade

### Impact Status (Per Simulation)

```
pending → generating → completed | skipped | failed
```

Each resonance creates one `resonance_impact` record per target simulation. The impact pipeline:

1. **pending** — Impact record created, awaiting generation
2. **generating** — AI event generation in progress
3. **completed** — Events spawned successfully
4. **skipped** — Simulation opted out or susceptibility too low
5. **failed** — Generation error (retryable)

---

## Susceptibility Profiles

Each simulation has a `resonance_profile` setting (JSONB) mapping each signature to a susceptibility multiplier:

```json
{
  "economic_tremor": 1.2,
  "conflict_wave": 1.5,
  "biological_tide": 0.8,
  "elemental_surge": 0.6,
  "authority_fracture": 1.8,
  "innovation_spark": 0.5,
  "consciousness_drift": 0.4,
  "decay_bloom": 1.0
}
```

**Multiplier range:** 0.4 – 1.8

**Effective magnitude:** `MIN(resonance.magnitude * susceptibility, 1.00)`

### Default Simulation Profiles

| Simulation | Strongest | Weakest |
|------------|-----------|---------|
| Velgarien | authority_fracture (1.8), conflict_wave (1.5) | consciousness_drift (0.4), innovation_spark (0.5) |
| The Gaslit Reach | biological_tide (1.5), consciousness_drift (1.4) | authority_fracture (0.7), conflict_wave (0.8) |
| Station Null | innovation_spark (1.6), decay_bloom (1.5) | elemental_surge (0.5), economic_tremor (0.7) |
| Speranza | elemental_surge (1.8), conflict_wave (1.4) | consciousness_drift (0.7), decay_bloom (0.8) |
| Cite des Dames | consciousness_drift (1.8), authority_fracture (1.3) | elemental_surge (0.5), economic_tremor (0.6) |

Unregistered simulations default to 1.0 across all signatures.

---

## Event Type Mapping

The `resonance_event_type_map` setting (JSONB) defines which event types each signature spawns:

```json
{
  "economic_tremor":     ["trade", "crisis", "social"],
  "conflict_wave":       ["military", "intrigue", "social"],
  "biological_tide":     ["social", "crisis", "eldritch"],
  "elemental_surge":     ["crisis", "nautical", "discovery"],
  "authority_fracture":  ["intrigue", "military", "social"],
  "innovation_spark":    ["discovery", "trade", "intrigue"],
  "consciousness_drift": ["social", "religious", "discovery"],
  "decay_bloom":         ["crisis", "eldritch", "social"]
}
```

Per-simulation overridable via `simulation_settings`.

---

## Impact Processing Pipeline

When a platform admin processes a resonance impact:

1. **Resonance transitions** to `impacting` status
2. For each target simulation:
   a. Retrieve susceptibility via `fn_get_resonance_susceptibility(sim_id, signature)`
   b. Retrieve event types via `fn_get_resonance_event_types(sim_id, signature)`
   c. Create `resonance_impact` record (effective_magnitude auto-computed by trigger)
   d. Spawn 2–3 events per simulation using AI generation or fallback templates
   e. Each spawned event is linked to the resonance via `event_chains` (chain_type='resonance')
3. When all impacts complete, resonance auto-transitions to `subsiding`

### AI Event Generation

For each spawned event, the system:
1. Constructs a prompt with archetype description, bureau dispatch narrative, and simulation context
2. Generates title + description via `GenerationService` (resonance_impact_generation template)
3. Falls back to template: `"{Archetype} — {Signature} in {Simulation}"` if AI fails

---

## Operative Integration (Competitive Epochs)

Active resonances (status `impacting` or `subsiding`) modify operative effectiveness during competitive epochs.

### Archetype-Operative Affinities

Each archetype aligns with or opposes certain operative types:

| Archetype | Aligned (+0.03) | Opposed (-0.02) |
|-----------|-----------------|-----------------|
| The Shadow | spy, assassin | propagandist |
| The Tower | saboteur, infiltrator | — |
| The Devouring Mother | spy, propagandist | infiltrator |
| The Deluge | saboteur, infiltrator | spy |
| The Overthrow | propagandist, infiltrator | — |
| The Prometheus | spy, infiltrator | saboteur |
| The Awakening | propagandist, spy | assassin |
| The Entropy | saboteur, assassin | infiltrator |

### Modifier Calculation

The PostgreSQL function `fn_resonance_operative_modifier(simulation_id, operative_type)`:

1. Aggregates all active resonances (impacting/subsiding) for the target simulation
2. For each resonance: `+0.03` if operative type is aligned, `-0.02` if opposed
3. Weights each contribution by the resonance's `effective_magnitude`
4. Subsiding resonances contribute at 0.5x strength (decay)
5. Returns net modifier, clamped to `[-0.04, +0.04]`

This modifier is added to the operative's base success probability during mission resolution.

### Zone Pressure Integration

The function `fn_target_zone_pressure(simulation_id, zone_id)`:

- Returns the total event pressure for a specific zone (or max across all zones)
- Scaled by `resonance_operative_pressure_cap` (default 0.04)
- Added to operative success probability for missions targeting high-pressure zones
- NULL bug fix: returns 0.0 when zone_id not found (previously returned cap)

### Attacker Pressure Penalty

The function `fn_attacker_pressure_penalty(simulation_id)`:

- Returns a negative modifier based on the attacker's own average zone pressure
- Formula: `-1.0 * LEAST(0.04, avg_pressure * 0.04)`
- Range: `[-0.04, 0.00]`
- Rationale: destabilized attackers are less effective at projecting force abroad, compensating the defender's zone pressure bonus

### Configurable Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `resonance_operative_pressure_cap` | 0.04 | Max zone pressure bonus |
| `resonance_operative_modifier_cap` | 0.04 | Max resonance alignment bonus |
| `resonance_operative_penalty_cap` | -0.04 | Max resonance opposition penalty |
| `resonance_bot_awareness_enabled` | true | Whether bots factor resonances into decisions |

---

## Bot Awareness

When `resonance_bot_awareness_enabled` is true, bot personalities factor active resonances into their operative deployment decisions:

- **BotGameState** tracks `active_resonances`, `resonance_aligned_types`, and `resonance_opposed_types`
- `is_under_resonance_pressure()` returns true when `own_avg_pressure > 0.3`
- `get_resonance_preferred_operative(candidates)` returns the most aligned operative type
- Sentinel personality increases guardian deployment (50% → 60%) under resonance pressure
- Strategist personality applies resonance preference to operative selection

---

## Database Schema

### `substrate_resonances`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `source_category` | text | NO | |
| `resonance_signature` | text | YES | (trigger-derived) |
| `archetype` | text | YES | (trigger-derived) |
| `title` | text | NO | |
| `description` | text | YES | |
| `bureau_dispatch` | text | YES | |
| `real_world_source` | jsonb | YES | |
| `magnitude` | numeric | NO | 0.50 |
| `affected_event_types` | text[] | YES | (trigger-derived) |
| `status` | resonance_status | NO | 'detected' |
| `detected_at` | timestamptz | NO | `now()` |
| `impacts_at` | timestamptz | YES | |
| `subsides_at` | timestamptz | YES | |
| `created_by_id` | uuid | YES | |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `deleted_at` | timestamptz | YES | |

**Computed field (API-Level):**
- `magnitude_class`: Abgeleitet aus `magnitude` — `low` (<=0.4), `medium` (<=0.7), `high` (>0.7). Nicht in der Datenbank gespeichert, vom Backend in der Response berechnet.

**CHECK constraints:**
- `source_category IN ('economic_crisis', 'military_conflict', 'pandemic', 'natural_disaster', 'political_upheaval', 'tech_breakthrough', 'cultural_shift', 'environmental_disaster')`
- `resonance_signature IN ('economic_tremor', 'conflict_wave', 'biological_tide', 'elemental_surge', 'authority_fracture', 'innovation_spark', 'consciousness_drift', 'decay_bloom')`
- `archetype IN ('The Tower', 'The Shadow', 'The Devouring Mother', 'The Deluge', 'The Overthrow', 'The Prometheus', 'The Awakening', 'The Entropy')`
- `magnitude BETWEEN 0.10 AND 1.00`

**Triggers:**
- `trg_derive_resonance_fields` (BEFORE INSERT): Auto-derives `resonance_signature`, `archetype`, `affected_event_types` from `source_category`
- `trg_resonance_updated_at` (BEFORE UPDATE): Updates `updated_at`

**RLS:**
- Public read (anon + authenticated SELECT)
- Authenticated write (INSERT, UPDATE)
- `resonances_admin_full_access`: Platform admin can see/modify soft-deleted rows

**View:** `active_resonances` — filters where `deleted_at IS NULL AND status != 'archived'`

### `resonance_impacts`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `resonance_id` | uuid | NO | FK → substrate_resonances |
| `simulation_id` | uuid | NO | FK → simulations |
| `susceptibility` | numeric | NO | 1.00 |
| `effective_magnitude` | numeric | YES | (trigger-computed) |
| `status` | resonance_impact_status | NO | 'pending' |
| `spawned_event_ids` | uuid[] | YES | |
| `narrative_context` | text | YES | |
| `created_at` | timestamptz | NO | `now()` |

**UNIQUE:** `(resonance_id, simulation_id)` — one impact per simulation per resonance

**Computed field (API-Level):**
- `simulation_slug`: Via JOIN auf `simulations.slug` aufgelöst. Ermöglicht Frontend-seitige URL-Konstruktion ohne zusätzlichen Lookup.

**Triggers:**
- `trg_compute_effective_magnitude` (BEFORE INSERT): `effective_magnitude = MIN(resonance.magnitude * susceptibility, 1.00)`
- `trg_check_resonance_completion` (AFTER UPDATE when status='completed'): Auto-transitions resonance to 'subsiding' when all impacts complete

### PostgreSQL Functions

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `fn_derive_resonance_fields()` | — (trigger) | trigger | Maps source_category → signature + archetype + event_types |
| `fn_get_resonance_susceptibility()` | `(simulation_id, signature)` | numeric | Returns susceptibility from resonance_profile setting |
| `fn_get_resonance_event_types()` | `(simulation_id, signature)` | text[] | Returns event types from resonance_event_type_map |
| `fn_resonance_operative_modifier()` | `(simulation_id, operative_type)` | numeric | Net operative modifier from active resonances [-0.04, +0.04], subsiding at 0.5x |
| `fn_target_zone_pressure()` | `(simulation_id, zone_id?)` | numeric | Zone pressure scaled by cap (default 0.04), NULL-safe |
| `fn_attacker_pressure_penalty()` | `(simulation_id)` | numeric | Attacker's own zone pressure penalty [-0.04, 0.00] |
| `is_platform_admin()` | — | boolean | Checks if current user is platform admin (SECURITY DEFINER) |

---

## API Endpoints

All endpoints under `/api/v1/resonances`. Public read, platform admin write.

### `GET /api/v1/resonances`
List resonances (paginated, filterable).

**Query:** `?status=detected&signature=conflict_wave&search=crisis&limit=25&offset=0&include_deleted=false`

**Response:** `PaginatedResponse[ResonanceResponse]`

**Auth:** Authenticated user (public read)

### `GET /api/v1/resonances/:resonanceId`
Get single resonance.

**Response:** `SuccessResponse[ResonanceResponse]`

### `POST /api/v1/resonances`
Create resonance. Signature, archetype, and event types auto-derived from source_category via Postgres trigger.

**Auth:** Platform admin (`require_platform_admin()`)

**Body:**
```json
{
  "source_category": "military_conflict",
  "title": "Eastern Continental War",
  "description": "Armed conflict spreading across...",
  "bureau_dispatch": "The Bureau has detected tremors...",
  "real_world_source": { "url": "...", "headline": "..." },
  "magnitude": 0.7,
  "impacts_at": "2026-03-10T00:00:00Z"
}
```

**Response:** `SuccessResponse[ResonanceResponse]` (201)

### `PUT /api/v1/resonances/:resonanceId`
Update resonance fields.

**Auth:** Platform admin

**Body:** Partial fields (title, description, bureau_dispatch, magnitude, status, impacts_at, subsides_at)

### `POST /api/v1/resonances/:resonanceId/process-impact`
Trigger impact processing across simulations.

**Auth:** Platform admin

**Body:**

```json
{
  "simulation_ids": ["uuid-1", "uuid-2"],
  "generate_narratives": true,
  "locale": "de"
}
```

If `simulation_ids` is empty/omitted, impacts all active simulations.

**Response:** `SuccessResponse[list[ResonanceImpactResponse]]` (201)

### `GET /api/v1/resonances/:resonanceId/impacts`

List impact records for a resonance.

**Response:** `SuccessResponse[list[ResonanceImpactResponse]]`

### `PUT /api/v1/resonances/:resonanceId/status`

Update resonance status.

**Auth:** Platform admin

**Query:** `?new_status=subsiding`

### `POST /api/v1/resonances/:resonanceId/restore`

Restore soft-deleted resonance.

**Auth:** Platform admin

### `DELETE /api/v1/resonances/:resonanceId`

Soft-delete resonance.

**Auth:** Platform admin

---

## Frontend Components

### ResonanceMonitor (`<resonance-monitor>`)

Platform-level dashboard for viewing active resonances. Displayed on the SimulationsDashboard.

**Features:**

- Status filter chips (all, detected, impacting, subsiding)
- Signature dropdown filter
- Auto-refresh every 60 seconds
- Grid of ResonanceCard components with stagger animation
- Process impact button (platform admin only)

### ResonanceCard (`<resonance-card>`)

Individual resonance display card.

**Properties:**

- `resonance`: Resonance object
- `impactCount`: number
- `showProcessButton`: boolean

**Visual:**

- Magnitude indicator: low (cyan, ≤0.4), medium (amber, 0.4–0.7), high (red, >0.7)
- Status badge with color coding (detected/impacting/subsiding/archived)
- Countdown to `impacts_at` timestamp
- Expandable bureau dispatch section
- Impact count badge

### AdminResonancesTab (`<velg-admin-resonances-tab>`)

Full admin management panel for substrate resonances.

**Views:** Active | Archived | Trash
**Filters:** Status chips, signature dropdown, search
**Actions:** Create, edit, transition status, process impact, soft-delete, restore

### AdminResonanceFormModal (`<velg-admin-resonance-form-modal>`)

Modal form for creating/editing resonances.

**Fields:** Source category (with auto-derivation preview), title, description, bureau dispatch, magnitude slider (0.1–1.0), impacts_at datetime picker.

### ResonanceApiService

Singleton API service (`resonanceApi`).

**Methods:** `list()`, `getById()`, `create()`, `update()`, `processImpact()`, `listImpacts()`, `updateStatus()`, `restore()`, `remove()`

---

## Automatic Impact Processing

The `ResonanceScheduler` (`backend/services/resonance_scheduler.py`) runs as a background asyncio task during the FastAPI application lifespan. It periodically checks for due resonances and auto-processes them without requiring manual admin intervention.

### Configuration

| Setting (platform_settings) | Type | Default | Description |
|------------------------------|------|---------|-------------|
| `resonance_auto_process_enabled` | bool | `true` | Enable/disable auto-processing |
| `resonance_auto_process_interval_seconds` | int | `60` | Check interval (floor: 10s) |

### Behavior

1. On app startup, `ResonanceScheduler.start()` launches an infinite asyncio loop
2. Every N seconds: query `substrate_resonances` where `status = 'detected' AND impacts_at <= now() AND deleted_at IS NULL`
3. For each due resonance: call `ResonanceService.process_impact()` using system actor (zero UUID, admin supabase client)
4. Log results per-resonance; one failure does not block others
5. On app shutdown: task is gracefully cancelled via `task.cancel()`

### System Actor Pattern

The scheduler uses `get_admin_supabase()` (service_role client) — the same pattern as bot architecture. This is a system actor, not a user operation, so no user JWT is involved. The zero UUID (`00000000-0000-0000-0000-000000000000`) indicates automated processing in audit logs.

---

## Migrations

| Migration | Description |
|-----------|-------------|
| 074 | Core tables: `substrate_resonances`, `resonance_impacts`, enums, triggers, RLS |
| 075 | Seed resonance profiles + event type maps per simulation |
| 076 | Derivation functions: `fn_derive_resonance_fields()`, `fn_get_resonance_susceptibility()`, `fn_get_resonance_event_types()` |
| 077 | Admin RLS: `is_platform_admin()`, `resonances_admin_full_access` policy |
| 078 | Gameplay functions: `fn_resonance_operative_modifier()`, `fn_target_zone_pressure()` |
| 079 | Seed gameplay settings: operative pressure/modifier caps, bot awareness |
| 080 | Balance fixes: NULL bug fix, reduced caps (0.06→0.04), infiltrator oppositions, subsiding decay, `fn_attacker_pressure_penalty()`, `active_resonances` view fix |
