# 20 - Agent Relationships, Event Echoes & The Cartographer's Map

**Version:** 1.1
**Date:** 2026-02-26
**Phase:** 6 (all tasks complete)

---

## Overview

Three interconnected features that establish the connective tissue between the platform's four simulations:

1. **Agent Relationships** — Intra-simulation social graph. Agents link to each other with typed, weighted, directional relationships that are driven by each simulation's taxonomy.
2. **Event Echoes** — The Bleed mechanic from `concept.md`. High-impact events create AI-transformed echoes in connected simulations, distorted through each world's aesthetic lens.
3. **The Cartographer's Map** — A platform-level network visualization showing all simulations as nodes and their connections as animated edges, rendered as a force-directed SVG graph.

### Lore Context

These features implement core concepts from `concept.md`:

- **The Bleed (Chapter VI)** — Cross-Shard contamination. Events leak between simulations through specific vectors, transformed by the receiving world's narrative voice.
- **The Vectors (Chapter VII)** — Seven channels of transmission: Commerce, Language, Memory, Resonance, Architecture, Dream, Desire.
- **The Tides (Chapter VIII)** — Variable echo intensity. High/low/eddies map to the `echo_strength` and decay mechanics.
- **The Cartographers (Chapter IX)** — "The Bureau maps everything." The Map UI embodies this role.
- **The Gaze (Chapter X)** — "You are performing an act of Cartography when you observe a simulation."

---

## Feature 1: Agent Relationships

### What It Does

Creates a directed graph of relationships between agents within a simulation. Each relationship has a type (driven by per-simulation taxonomy), intensity (1-10), optional bidirectional flag, and a narrative description.

### Database Schema

**Table: `agent_relationships`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `simulation_id` | UUID | FK to simulations |
| `source_agent_id` | UUID | FK to agents (relationship origin) |
| `target_agent_id` | UUID | FK to agents (relationship target) |
| `relationship_type` | TEXT | Taxonomy-driven (e.g., "rival", "mentor") |
| `is_bidirectional` | BOOLEAN | Whether the relationship goes both ways |
| `intensity` | INTEGER | 1-10 scale of relationship strength |
| `description` | TEXT | Narrative description |
| `metadata` | JSONB | Extensible (history, origin, etc.) |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Constraints:**
- `no_self_relation` — An agent cannot relate to itself
- `unique_relationship` — Unique on (source_agent_id, target_agent_id, relationship_type)

### Relationship Types (Per Simulation)

| Simulation | Types |
|-----------|-------|
| **Velgarien** | handler, informant, rival, co_conspirator, supervisor, subject |
| **Capybara Kingdom** | ally, mentor, rival, trading_partner, blood_oath, scholarly_colleague |
| **Station Null** | crew_partner, antagonist, subject_of_study, commanding_officer, quarantine_contact |
| **Speranza** | contrada_kin, raid_partner, apprentice, rival, salvage_partner, sworn_enemy |

### API Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/simulations/{id}/agents/{aid}/relationships` | viewer | List agent's relationships (both directions) |
| GET | `/api/v1/simulations/{id}/relationships` | viewer | List all relationships in simulation (paginated) |
| POST | `/api/v1/simulations/{id}/agents/{aid}/relationships` | editor | Create a relationship |
| PATCH | `/api/v1/simulations/{id}/relationships/{rid}` | editor | Update a relationship |
| DELETE | `/api/v1/simulations/{id}/relationships/{rid}` | editor | Delete a relationship |
| GET | `/api/v1/public/simulations/{id}/agents/{aid}/relationships` | anon | Public read (no auth) |
| GET | `/api/v1/public/simulations/{id}/relationships` | anon | Public read (no auth) |

### API Examples

**Create a relationship:**
```bash
curl -X POST "http://localhost:8000/api/v1/simulations/{sim_id}/agents/{agent_id}/relationships" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_agent_id": "uuid-of-target-agent",
    "relationship_type": "rival",
    "is_bidirectional": true,
    "intensity": 7,
    "description": "A quiet bureaucratic war over Bureau 9 jurisdiction"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "simulation_id": "uuid",
    "source_agent_id": "uuid",
    "target_agent_id": "uuid",
    "relationship_type": "rival",
    "is_bidirectional": true,
    "intensity": 7,
    "description": "A quiet bureaucratic war over Bureau 9 jurisdiction",
    "metadata": {},
    "created_at": "2026-02-26T12:00:00Z",
    "updated_at": "2026-02-26T12:00:00Z"
  }
}
```

**List relationships for an agent (public, no auth):**
```bash
curl "http://localhost:8000/api/v1/public/simulations/{sim_id}/agents/{agent_id}/relationships"
```

### UI Components

**AgentDetailsPanel — Relationships Section:**
- Accordion section (same `Set<string>` expand/collapse pattern as other sections)
- Shows a list of `RelationshipCard` components for each connected agent
- Each card displays: agent avatar + name, type badge (`VelgBadge`), intensity bar (1-10), description excerpt
- "Add Relationship" button visible for editors+
- Click a relationship card to navigate to the related agent

**RelationshipCard:**
- Displays: other agent's avatar, name, relationship type badge, intensity bar, description
- Click navigates to the related agent's detail panel
- Edit/delete icons for editors

**RelationshipEditModal (editors+):**
- Target agent: searchable dropdown of simulation agents
- Relationship type: taxonomy dropdown (populated from `appState.getTaxonomiesByType('relationship_type')`)
- Intensity: slider (1-10)
- Bidirectional: toggle
- Description: textarea

### Demo Data (Seeded)

**Velgarien (3 relationships):**
- Kessler --> Moritz: `supervisor` (intensity 8) — "Kessler oversees Moritz's compliance reports"
- Voss --> Kessler: `rival` (intensity 6) — "A quiet bureaucratic war over Bureau 9 jurisdiction"
- Mueller --> Braun: `informant` (intensity 7) — "Mueller reports architectural anomalies to Braun"

**Capybara Kingdom (3 relationships):**
- Elderberry --> Fernwhistle: `mentor` (intensity 9) — "The elder scholar guides the young cartographer"
- Thornback --> Mudwalker: `trading_partner` (intensity 7) — "Bioluminescent goods flow between their domains"
- Dewdrop --> Elderberry: `scholarly_colleague` (intensity 6) — "They share research on the Unterzee tides"

**Station Null (3 relationships):**
- Commander Voss --> Dr. Osei: `commanding_officer` (intensity 8) — "Voss maintains authority over research protocols"
- Dr. Osei --> HAVEN: `subject_of_study` (intensity 9) — "Osei's primary research subject"
- Navigator Braun --> Commander Voss: `antagonist` (intensity 5) — "Growing distrust over navigation decisions"

**Speranza (3 relationships):**
- Capitana Ferretti --> Enzo Moretti: `raid_partner` (intensity 9) — "They've survived 147 raids together"
- Lina Russo --> Dottor Ferrara: `apprentice` (intensity 7) — "Lina learns field medicine under Ferrara's guidance"
- Celeste Amara --> Tomas Vidal: `contrada_kin` (intensity 8) — "Bound by the Contrada Leoni compact"

---

## Feature 2: Event Echoes (The Bleed)

### What It Does

When a high-impact event occurs in one simulation, it can "bleed" into connected simulations as a transformed echo. The echo is distorted through the receiving world's narrative voice and aesthetic, creating a new event that feels native to the target simulation while carrying traces of its origin.

### How Echoes Work

1. **Triggering:** An admin selects a source event and a target simulation, choosing a bleed vector
2. **Echo Record:** A record is created in `event_echoes` with status `pending`
3. **AI Transformation:** The echo service uses the `event_echo_transformation` prompt template to rewrite the event in the target simulation's voice
4. **Target Event:** A new event is created in the target simulation with `data_source = 'bleed'`
5. **Provenance:** The target event's `external_refs` contains the full echo chain

### Echo Vectors

The seven channels through which events bleed between simulations:

| Vector | Description | Example |
|--------|-------------|---------|
| **Commerce** | Trade, economics, resource flow | A market crash in Velgarien causes supply shortages in Capybara Kingdom |
| **Language** | Words, phrases, propaganda | Bureaucratic terms from Velgarien appear in Station Null comms |
| **Memory** | Collective/individual memory | Station Null crew dream of underground kingdoms |
| **Resonance** | Vibration, frequency, music | Bureau radio frequencies bleed into station transmissions |
| **Architecture** | Built environment, spatial echoes | Brutalist forms appear in Speranza's underground constructions |
| **Dream** | Subconscious, surreal imagery | Citizens dream of dark waters and bioluminescent caverns |
| **Desire** | Wants, needs, emotional pull | A longing for open skies spreads through underground civilizations |

### Cascade Prevention (Multi-Layer)

Echoes can themselves trigger further echoes, creating cascading chains. Multiple safeguards prevent runaway cascades:

1. **Depth limit:** `echo_depth` CHECK constraint limits to 3 hops maximum
2. **Strength decay:** Each hop multiplies strength by the target simulation's `bleed_strength_decay` setting (default 0.6)
3. **Minimum strength:** Echoes below 0.3 strength cannot propagate further
4. **Data source check:** Events with `data_source = 'bleed'` have a higher impact threshold
5. **Unique constraint:** Only one echo per (source_event, target_simulation) pair

### Database Schema

**Table: `event_echoes`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `source_event_id` | UUID | FK to events (original event) |
| `source_simulation_id` | UUID | FK to simulations (where the event originated) |
| `target_simulation_id` | UUID | FK to simulations (where the echo lands) |
| `target_event_id` | UUID | FK to events (the created echo event, nullable) |
| `echo_vector` | TEXT | One of 7 vectors (commerce, language, etc.) |
| `echo_strength` | NUMERIC(3,2) | 0.0 to 1.0, decays per hop |
| `echo_depth` | INTEGER | 1-3, chain depth |
| `root_event_id` | UUID | Original event in the chain (for cascade tracking) |
| `status` | TEXT | pending, generating, completed, failed, rejected |
| `bleed_metadata` | JSONB | Transformation notes, AI context |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Constraints:**
- `no_self_echo` — Source and target simulations must be different
- `unique_echo` — Unique on (source_event_id, target_simulation_id)

### Status Workflow

```
pending --> generating --> completed
   |                         |
   +--------> rejected       +-----> failed
```

- **pending** — Echo record created, awaiting approval or AI transformation
- **generating** — AI is transforming the event text
- **completed** — Echo event created in target simulation
- **failed** — AI transformation or creation failed
- **rejected** — Admin manually rejected the echo

### API Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/simulations/{id}/echoes` | viewer | List echoes (filter: direction, status) |
| GET | `/api/v1/simulations/{id}/events/{eid}/echoes` | viewer | List echoes from a specific event |
| POST | `/api/v1/simulations/{id}/echoes` | admin | Manually trigger an echo |
| PATCH | `/api/v1/simulations/{id}/echoes/{eid}/approve` | admin | Approve a pending echo |
| PATCH | `/api/v1/simulations/{id}/echoes/{eid}/reject` | admin | Reject a pending echo |
| GET | `/api/v1/public/simulations/{id}/echoes` | anon | Public read (no auth) |
| GET | `/api/v1/public/simulations/{id}/events/{eid}/echoes` | anon | Public read (no auth) |

### API Examples

**Trigger an echo:**
```bash
curl -X POST "http://localhost:8000/api/v1/simulations/{sim_id}/echoes" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_event_id": "uuid-of-high-impact-event",
    "target_simulation_id": "uuid-of-target-simulation",
    "echo_vector": "memory",
    "echo_strength": 0.8
  }'
```

**List incoming echoes (with direction filter):**
```bash
curl "http://localhost:8000/api/v1/simulations/{sim_id}/echoes?direction=incoming&limit=25"
```

**Approve a pending echo:**
```bash
curl -X PATCH "http://localhost:8000/api/v1/simulations/{sim_id}/echoes/{echo_id}/approve" \
  -H "Authorization: Bearer <jwt>"
```

### Echo'd Event Shape

When an echo creates a new event in the target simulation, the event has:

```json
{
  "name": "Spectral Frequencies in the Deep",
  "description": "HAVEN's sensors detected anomalous radio patterns matching classified Bureau transmissions...",
  "data_source": "bleed",
  "impact_level": 6,
  "external_refs": {
    "echo_id": "uuid",
    "source_event_id": "uuid",
    "source_simulation_id": "uuid",
    "root_event_id": "uuid",
    "echo_vector": "resonance",
    "echo_depth": 1
  }
}
```

### UI Components

**EventDetailsPanel — Echoes Section:**
- Accordion section showing outgoing echoes (where this event has echoed to)
- For bleed events: incoming provenance chain showing origin
- Each echo displays: source/target simulation name, vector badge, strength bar, status badge, depth indicator
- "Trigger Echo" button for admins

**EchoCard:**
- Source simulation name/icon, target simulation name/icon
- Vector badge (commerce, language, etc.)
- Strength bar (0-1)
- Status badge (pending/generating/completed/failed/rejected)
- Depth indicator
- Click navigates to target event (if completed)

**EchoTriggerModal (admin+):**
- Target simulation: dropdown (excludes current simulation)
- Echo vector: dropdown with all 7 vectors
- Strength override: slider (0.1-1.0)

**EventCard — Bleed Badge:**
- Events with `data_source === 'bleed'` show a "Bleed" badge (accent color)

**EventsView — Bleed Filter:**
- Checkbox toggle in SharedFilterBar: "Show Bleed events only"
- Filters the event list to only show events that originated from echoes

### Prompt Templates

**`relationship_generation`** — Given an agent's character/background and the other agents in the simulation, generates 2-4 plausible relationships with type, intensity, and description.

**`event_echo_transformation`** — Transforms an event from one world's narrative voice into another's. Input: source event, source world description, target world description, echo vector. Output: new event title and description that feels native to the target world.

---

## Feature 3: The Cartographer's Map

### What It Does

A platform-level page at `/multiverse` showing all four simulations as nodes in a force-directed graph, connected by animated edges representing their bleed connections. The map provides a visual overview of the multiverse topology and allows navigation to individual simulations.

### Route & Navigation

- **URL:** `/multiverse`
- **Platform-level:** Not scoped to any simulation
- **Navigation:** "Map" / "Karte" link in PlatformHeader (visible on all pages)
- **Default view:** Force-directed SVG graph on desktop, card list on mobile

### Simulation Connections

**Table: `simulation_connections`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `simulation_a_id` | UUID | FK to simulations |
| `simulation_b_id` | UUID | FK to simulations |
| `connection_type` | TEXT | bleed, trade, rumour, dream |
| `bleed_vectors` | TEXT[] | Which vectors flow on this edge |
| `strength` | NUMERIC(3,2) | 0.0 to 1.0 |
| `description` | TEXT | Lore description of the connection |
| `is_active` | BOOLEAN | Whether the connection is currently active |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**Seeded Connections (complete graph):**

| Simulation A | Simulation B | Vectors | Strength | Description |
|-------------|-------------|---------|----------|-------------|
| Velgarien | Capybara Kingdom | memory, architecture | 0.7 | Brutalist forms appear in cavern walls; citizens dream of dark waters |
| Velgarien | Station Null | dream, resonance | 0.5 | Bureau radio frequencies bleed into station comms |
| Velgarien | Speranza | commerce, language | 0.6 | Propaganda leaflets found in salvage; similar bureaucratic structures |
| Capybara Kingdom | Station Null | memory, desire | 0.4 | The Unterzee's darkness mirrors the void; bioluminescence echoes station lights |
| Capybara Kingdom | Speranza | architecture, commerce | 0.5 | Underground civilizations share construction knowledge |
| Station Null | Speranza | resonance, dream | 0.6 | Station transmissions reach underground receivers; shared isolation themes |

### Force-Directed Layout Algorithm

The map uses a custom physics simulation (~130 lines) with zero external dependencies:

**Forces:**
1. **Coulomb Repulsion** — `F = 50000 / distance^2` pushes all node pairs apart
2. **Hooke Attraction** — `F = 0.001 * distance * edge_strength` pulls connected nodes together
3. **Center Gravity** — `F = 0.005 * distance_to_center` keeps the graph centered
4. **Damping** — Velocity multiplied by 0.85 each tick for stability

**Parameters (tuned for complete graph of 4 nodes):**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `repulsion` | 50000 | Strong enough to overcome 6 attraction edges |
| `attraction` | 0.001 | Weak per-edge (cumulative effect of 6 edges is significant) |
| `centerForce` | 0.005 | Gentle centering (repulsion drives structure) |
| `damping` | 0.85 | Prevents oscillation |
| `minDistance` | 140 | Collision avoidance threshold |
| `nodeRadius` | 60 | Visual node size |

**Convergence:** Animation runs via `requestAnimationFrame` until kinetic energy drops below 0.5 or 300 iterations.

### SVG Rendering

**Nodes:**
- Circle with simulation banner image (SVG `<clipPath>` + `<image>`)
- Theme-colored border ring (from `THEME_COLORS` mapping)
- Glow effect matching theme (`<filter>` with `feGaussianBlur`)
- Label below: simulation name (uppercase, monospace)
- Stats: agent count / building count / event count

**Edges:**
- Bezier curves between nodes (quadratic with perpendicular offset)
- Dashed stroke with CSS animation (flowing toward target)
- Stroke color from source node's theme
- Width proportional to connection strength

**Interactions:**
- Click node: navigate to `/simulations/{id}/lore`
- Click edge: open MapConnectionPanel (side panel with connection details)
- Hover node: MapTooltip with description and stats
- Pan: drag background (SVG viewBox manipulation)
- Zoom: scroll wheel (0.5x to 3x range)

### Dark Theme Override

The map is a platform-level view (not inside a simulation shell), so it doesn't inherit per-simulation theme presets. The global CSS tokens define a **light theme** (`--color-surface: #ffffff`). To ensure the map always renders with a dark space-themed appearance, `CartographerMap` overrides CSS custom properties on its `:host`:

```css
:host {
  --color-surface: #0a0a0a;
  --color-surface-raised: #161616;
  --color-text-primary: #f0f0f0;
  --color-text-muted: #777777;
  --color-border: #2a2a2a;
}
```

These cascade through shadow DOM to `MapGraph`, `MapTooltip`, and `MapConnectionPanel`.

### Navigation Toggle

The "Map" / "Karte" nav link in `PlatformHeader` toggles — clicking it while on `/multiverse` navigates back to `/dashboard`. An active state (`header__nav-link--active`) highlights the link when on the map page.

### Responsive Design

| Viewport | Behavior |
|----------|----------|
| >768px | Full SVG force graph with pan/zoom |
| <=768px | Vertical card list with simulation name, stats, and theme color indicator |

### API Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/v1/connections` | authenticated | List all connections |
| POST | `/api/v1/connections` | platform admin | Create connection |
| PATCH | `/api/v1/connections/{id}` | platform admin | Update connection |
| DELETE | `/api/v1/connections/{id}` | platform admin | Delete connection |
| GET | `/api/v1/public/connections` | anon | Public read (for map) |
| GET | `/api/v1/public/map-data` | anon | Aggregated map data |

### Map Data Endpoint

**`GET /api/v1/public/map-data`** returns a single payload for map rendering:

```json
{
  "success": true,
  "data": {
    "simulations": [
      {
        "id": "uuid",
        "name": "Velgarien",
        "slug": "velgarien",
        "theme": "dark",
        "description": "...",
        "banner_url": "https://...",
        "agent_count": 8,
        "building_count": 6,
        "event_count": 6
      }
    ],
    "connections": [
      {
        "id": "uuid",
        "simulation_a_id": "uuid",
        "simulation_b_id": "uuid",
        "connection_type": "bleed",
        "bleed_vectors": ["memory", "architecture"],
        "strength": 0.7,
        "description": "Brutalist forms appear in cavern walls...",
        "is_active": true
      }
    ],
    "echo_counts": {
      "sim-uuid-1": 0,
      "sim-uuid-2": 0
    }
  }
}
```

### Component Files

| File | Purpose |
|------|---------|
| `CartographerMap.ts` | Main route component (data loading, mobile fallback, navigation) |
| `MapGraph.ts` | SVG renderer (nodes, edges, pan/zoom, force simulation loop) |
| `MapConnectionPanel.ts` | Edge detail side panel (extends VelgSidePanel) |
| `MapTooltip.ts` | Hover tooltip (positioned at cursor) |
| `map-force.ts` | Force simulation algorithm (Coulomb + Hooke + centering) |
| `map-data.ts` | Static config (theme colors, vector labels/icons) |
| `map-types.ts` | TypeScript interfaces (MapNodeData, MapEdgeData, ForceConfig) |

---

## Architecture

### Data Flow

```
                    +-----------+
                    | Supabase  |
                    |  (30 tbl) |
                    +-----+-----+
                          |
                    +-----+-----+
                    |  FastAPI   |
                    | (23 rtrs) |
                    +-----+-----+
                          |
              +-----------+-----------+
              |           |           |
         Relationships  Echoes    Connections
         (sim-scoped)  (cross-sim) (platform)
              |           |           |
              +-----+-----+-----+----+
                    |           |
               Public API   Auth API
               (26 endpts)  (131 endpts)
                    |           |
              +-----+-----------+-----+
              |                       |
         Anonymous Users        Authenticated Users
         (read-only)           (CRUD by role)
              |                       |
              +-----+-----------+-----+
                    |
              +-----+-----+
              |  Frontend  |
              | (Lit + TS) |
              +-----+-----+
                    |
     +--------------+--------------+
     |              |              |
  Agent Panel   Event Panel   Cartographer's
  (relationships) (echoes)     Map (/multiverse)
```

### Cross-Simulation Writes

Echo creation requires writing to a different simulation's events table, which bypasses standard RLS (user JWT is scoped to source simulation). The echo service uses `get_admin_supabase()` (service-role client) for these cross-simulation writes, with full audit logging.

### Security Model

| Table | Anon | Viewer | Editor | Admin | Service Role |
|-------|------|--------|--------|-------|-------------|
| `agent_relationships` | SELECT | SELECT | SELECT, INSERT, UPDATE, DELETE | All | All |
| `event_echoes` | SELECT | SELECT | SELECT | SELECT | INSERT, UPDATE |
| `simulation_connections` | SELECT (active) | SELECT | SELECT | SELECT | INSERT, UPDATE, DELETE |

---

## Testing

### Test Coverage

| Layer | Files | Tests | Focus |
|-------|-------|-------|-------|
| Backend Unit | 5 | 90 | Service CRUD, validation, cascade prevention |
| Frontend Unit | 4 | 60 | API services, force simulation, map data |
| E2E (Playwright) | 3 | 17 | UI interactions, API calls, navigation |
| Visual (WebMCP) | - | Manual | Map layout, panel rendering, locale switch |

### Key Test Files

| File | Tests | Description |
|------|-------|-------------|
| `backend/tests/test_relationship_service.py` | ~18 | CRUD, no-self-relation, unique constraint, taxonomy validation |
| `backend/tests/test_echo_service.py` | ~18 | Echo creation, cascade prevention, status workflow |
| `backend/tests/test_relationship_router.py` | ~18 | API endpoints, auth checks, public endpoints |
| `backend/tests/test_echo_router.py` | ~18 | API endpoints, auth checks, approve/reject flow |
| `backend/tests/test_connection_router.py` | ~18 | CRUD, public endpoint, map-data aggregation |
| `frontend/tests/relationship-api.test.ts` | 15 | API service methods, public routing |
| `frontend/tests/echo-api.test.ts` | 16 | API service methods, public routing |
| `frontend/tests/map-force.test.ts` | 15 | Force simulation convergence, collision avoidance |
| `frontend/tests/map-data.test.ts` | 14 | Static connections, theme colors |
| `e2e/tests/relationships.spec.ts` | 5 | Agent panel, API data, auth guards |
| `e2e/tests/echoes.spec.ts` | 7 | Bleed filter, API data, echo section, auth guards |
| `e2e/tests/multiverse-map.spec.ts` | 5 | Map rendering, nodes, navigation, mobile fallback |

### E2E Testing Notes

- **Shadow DOM clicks:** Agent card clicks must target `.card__body` (not the host element) to avoid avatar lightbox interception
- **Event card clicks:** Must target `.card__title` for the same reason
- **Map node clicks:** Require `force: true` because banner `<image>` elements intercept pointer events
- **Hidden modal text:** `EchoTriggerModal` is always in the DOM; use `button:visible` locator instead of `getByText`

---

## i18n

59 new translation strings added for all three features (1088 total). All translated via DeepL API.

Key translation decisions:
- "Bleed" kept as-is in German (established larp/game design terminology)
- "Echo" becomes "Echo" (same in German)
- "The Cartographer's Map" becomes "Die Karte des Kartographen"
- Relationship types use simulation-specific German translations
- Vector names translated: Commerce=Handel, Language=Sprache, Memory=Erinnerung, Resonance=Resonanz, Architecture=Architektur, Dream=Traum, Desire=Verlangen

---

## Migration

**File:** `supabase/migrations/20260228000000_026_agent_relationships_and_echoes.sql`

Contains:
1. Three CREATE TABLE statements with all constraints and indexes
2. Eight RLS policies (anon SELECT, auth CRUD)
3. Three updated_at triggers
4. 24 taxonomy seed values (relationship types)
5. 12 demo relationships (3 per simulation)
6. 6 simulation connections (complete graph)
7. 2 prompt templates (relationship_generation, event_echo_transformation)

### Deployment Checklist

```bash
# 1. Push migration to production
SUPABASE_ACCESS_TOKEN=sbp_... supabase db push

# 2. Verify tables exist
curl -s "https://bffjoupddfjaljqrwqck.supabase.co/rest/v1/agent_relationships?select=count" \
  -H "Authorization: Bearer sb_secret_..." \
  -H "apikey: sb_secret_..."

# 3. Deploy code (Railway auto-deploys on git push)
git push origin main

# 4. Verify endpoints
curl -s https://metaverse.center/api/v1/public/map-data | jq '.data.connections | length'
# Expected: 6

curl -s https://metaverse.center/api/v1/public/simulations/{sim_id}/relationships | jq '.data | length'
# Expected: 3 (per simulation)
```

---

## File Inventory

### New Files (Phase 6)

| File | Type | Lines |
|------|------|-------|
| `supabase/migrations/20260228000000_026_*.sql` | Migration | ~400 |
| `backend/models/relationship.py` | Pydantic model | ~40 |
| `backend/models/echo.py` | Pydantic model | ~80 |
| `backend/services/relationship_service.py` | Service | ~80 |
| `backend/services/echo_service.py` | Service + ConnectionService | ~180 |
| `backend/routers/relationships.py` | Router (5 endpoints) | ~125 |
| `backend/routers/echoes.py` | Router (5 endpoints) | ~144 |
| `backend/routers/connections.py` | Router (4 endpoints) | ~65 |
| `frontend/src/types/index.ts` | Types (6 new interfaces) | +60 |
| `frontend/src/services/api/relationship-api.ts` | API service | ~80 |
| `frontend/src/services/api/echo-api.ts` | API service | ~90 |
| `frontend/src/services/api/connection-api.ts` | API service | ~50 |
| `frontend/src/components/agents/RelationshipCard.ts` | UI component | ~120 |
| `frontend/src/components/agents/RelationshipEditModal.ts` | UI component | ~200 |
| `frontend/src/components/events/EchoCard.ts` | UI component | ~120 |
| `frontend/src/components/events/EchoTriggerModal.ts` | UI component | ~180 |
| `frontend/src/components/multiverse/CartographerMap.ts` | Main route | ~290 |
| `frontend/src/components/multiverse/MapGraph.ts` | SVG renderer | ~350 |
| `frontend/src/components/multiverse/MapConnectionPanel.ts` | Side panel | ~200 |
| `frontend/src/components/multiverse/MapTooltip.ts` | Tooltip | ~80 |
| `frontend/src/components/multiverse/map-force.ts` | Physics sim | ~130 |
| `frontend/src/components/multiverse/map-data.ts` | Static config | ~50 |
| `frontend/src/components/multiverse/map-types.ts` | Types | ~40 |
| `backend/tests/test_relationship_service.py` | Tests | ~200 |
| `backend/tests/test_echo_service.py` | Tests | ~200 |
| `backend/tests/test_relationship_router.py` | Tests | ~200 |
| `backend/tests/test_echo_router.py` | Tests | ~200 |
| `backend/tests/test_connection_router.py` | Tests | ~200 |
| `frontend/tests/relationship-api.test.ts` | Tests | ~150 |
| `frontend/tests/echo-api.test.ts` | Tests | ~160 |
| `frontend/tests/map-force.test.ts` | Tests | ~280 |
| `frontend/tests/map-data.test.ts` | Tests | ~150 |
| `e2e/tests/relationships.spec.ts` | E2E tests | ~77 |
| `e2e/tests/echoes.spec.ts` | E2E tests | ~102 |
| `e2e/tests/multiverse-map.spec.ts` | E2E tests | ~62 |

### Modified Files

| File | Change |
|------|--------|
| `backend/app.py` | 3 new router registrations |
| `backend/routers/public.py` | 6 new public endpoints + map-data |
| `frontend/src/types/index.ts` | 6 new interfaces, 2 updated union types |
| `frontend/src/services/api/index.ts` | 3 new service exports |
| `frontend/src/app-shell.ts` | `/multiverse` route |
| `frontend/src/components/platform/PlatformHeader.ts` | "Map" nav link |
| `frontend/src/components/agents/AgentDetailsPanel.ts` | Relationships section |
| `frontend/src/components/agents/AgentCard.ts` | Relationship count indicator |
| `frontend/src/components/events/EventDetailsPanel.ts` | Echoes section |
| `frontend/src/components/events/EventCard.ts` | Bleed badge |
| `frontend/src/components/events/EventsView.ts` | Bleed filter toggle |
| `frontend/src/locales/xliff/de.xlf` | 59 new trans-units |
| `frontend/src/locales/generated/de.ts` | Auto-generated |
