# 21 - Embassies & Ambassadors

**Version:** 1.1
**Date:** 2026-02-27

---

## Overview

Embassies are a cross-simulation feature that establishes physical diplomatic presences between connected simulations. Each embassy is a special building in one simulation that represents another simulation, staffed by an ambassador agent. Embassies create tangible, in-world anchors for the Bleed mechanic described in `concept.md` (Chapter VII: The Vectors — Architecture).

### Lore Context

> "When the walls between Shards thin, places appear that shouldn't exist. A tavern in Velgarien that sells goods from a marketplace nobody remembers building. A filing cabinet in a capybara's burrow containing performance reviews from a space station. These are embassies — the Cartographers call them 'architectural bleed.'"

Embassies represent the physical manifestation of simulation connections. They exist as anomalous buildings within their host simulation, carrying architectural and thematic elements from their origin simulation.

---

## Feature Architecture

### Data Model

**Embassies table** — Cross-simulation building links:

| Field | Type | Description |
|-------|------|-------------|
| `building_a_id` | UUID | First building (sorted: `a < b`) |
| `building_b_id` | UUID | Second building |
| `simulation_a_id` | UUID | Simulation of building A |
| `simulation_b_id` | UUID | Simulation of building B |
| `status` | enum | `proposed` → `active` → `suspended` / `dissolved` |
| `bleed_vector` | enum | Channel of reality bleed (memory, resonance, language, commerce, architecture, dream, desire) |
| `description` | text | "The Question" — the existential question this embassy explores |
| `embassy_metadata` | jsonb | Contains `ambassador_a`, `ambassador_b` objects |

Building IDs are always stored in sorted order (`building_a_id < building_b_id`) via a `LEAST/GREATEST` constraint. The backend automatically reorders them on creation and swaps associated metadata (simulation IDs, ambassador assignments) to maintain correct mapping.

**Buildings table** — Embassies are buildings with `special_type = 'embassy'`:

| Field | Value | Description |
|-------|-------|-------------|
| `special_type` | `'embassy'` | Marks building as embassy |
| `special_attributes` | jsonb | `{ embassy_id, partner_building_id, partner_simulation_id, partner_building_name }` |
| `building_type` | varies | e.g. 'anomaly', 'trading_post', 'observatory' |

**Agents table** — Ambassadors are agents with `is_ambassador = true`:

| Field | Value | Description |
|-------|-------|-------------|
| `is_ambassador` | `true` | Computed flag, NOT stored in DB |

The `is_ambassador` flag is computed at query time by `AgentService._enrich_ambassador_flag()`, which checks whether the agent's name matches any `ambassador_a.name` or `ambassador_b.name` in the `embassy_metadata` of active embassies involving the current simulation.

**Embassy Metadata — Ambassador Structure:**

```json
{
  "ambassador_a": {
    "name": "Agent Name",
    "role": "Cultural Attaché",
    "quirk": "Speaks in haiku during full moons"
  },
  "ambassador_b": {
    "name": "Partner Agent Name",
    "role": "Trade Envoy"
  }
}
```

`ambassador_a` always corresponds to `simulation_a_id`'s agent; `ambassador_b` to `simulation_b_id`'s agent. The backend swaps these when building order is reversed during creation.

### Backend

| File | Purpose |
|------|---------|
| `backend/models/embassy.py` | Pydantic request/response models |
| `backend/routers/embassies.py` | Embassy CRUD router (create, activate, suspend, dissolve, update) |
| `backend/services/embassy_service.py` | Embassy business logic (auto-activate, metadata swap, building attrs) |
| `backend/services/embassy_prompts.py` | AI prompt templates for embassy generation |
| `backend/services/agent_service.py` | `_enrich_ambassador_flag()` — enriches agent responses |
| `supabase/migrations/20260228200000_028_embassies.sql` | Embassy table/policies |
| `supabase/migrations/20260228300000_029_embassy_prompt_templates.sql` | AI prompt seeds |
| `supabase/migrations/20260228400000_030_fix_embassy_ambassador_metadata.sql` | Ambassador metadata fix |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/components/buildings/EmbassyCreateModal.ts` | 4-step wizard for creating embassies with ambassador assignment |
| `frontend/src/components/buildings/EmbassyLink.ts` | Partner building link in detail panel |
| `frontend/src/components/buildings/BuildingDetailsPanel.ts` | "Establish Embassy" button + embassy section |
| `frontend/src/components/buildings/BuildingsView.ts` | Mounts modal, wires embassy events |
| `frontend/src/services/api/EmbassiesApiService.ts` | API service for embassy endpoints |
| `frontend/src/services/api/AgentsApiService.ts` | `listPublic()` — fetch agents from partner sims |
| `frontend/src/services/api/BuildingsApiService.ts` | `listPublic()` — fetch buildings from partner sims |
| `frontend/src/services/api/SimulationsApiService.ts` | `listPublic()` — fetch all simulations (no auth) |
| `frontend/src/components/shared/card-styles.ts` | `.card--embassy` visual effects |
| `frontend/src/components/agents/AgentCard.ts` | Ambassador badge + embassy card class |
| `frontend/src/components/buildings/BuildingCard.ts` | Embassy card class |

### Types

```typescript
// In frontend/src/types/index.ts

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
  status: EmbassyStatus;  // 'proposed' | 'active' | 'suspended' | 'dissolved'
  bleed_vector?: EchoVector;
  description?: string;
  embassy_metadata?: EmbassyMetadata;
  building_a?: Building;
  building_b?: Building;
  simulation_a?: Simulation;
  simulation_b?: Simulation;
  // ...
}

interface Agent {
  // ... existing fields ...
  is_ambassador?: boolean;  // Computed by backend, not stored in DB
}

interface Building {
  // ... existing fields ...
  special_type?: string;    // 'embassy' for embassy buildings
}
```

---

## Embassy Creation Wizard

The `EmbassyCreateModal` is a 4-step wizard mounted in `BuildingsView`. It is triggered from the "Establish Embassy" button in the `BuildingDetailsPanel` footer (visible to admins on non-embassy buildings).

### Step 1 — Partner

Select the target simulation and building to form a diplomatic link with.

- **Target Simulation** dropdown loads via `simulationsApi.listPublic()` (public endpoint, no auth needed)
- Current simulation is filtered out
- **Target Building** dropdown loads via `buildingsApi.listPublic(targetSimId)` when a simulation is selected
- Existing embassies are filtered out (buildings with `special_type === 'embassy'`)
- Selecting a building shows an **inline preview card** with image thumbnail, name, and type
- Info bubbles on both labels explain what to pick

### Step 2 — Protocol

Configure the metaphysical properties of the embassy connection.

- **Bleed Vector** dropdown — 7 options (memory, resonance, language, commerce, architecture, dream, desire) with info bubble: "The channel through which reality bleeds between connected simulations."
- **The Question** textarea — the fundamental existential question this embassy explores between worlds. Optional.

### Step 3 — Ambassadors

Assign agents as diplomatic representatives. Both fields are optional.

- **Two-column grid** layout: local simulation (left) | partner simulation (right)
- Each column: agent `<select>` dropdown → local agents from `agentsApi.list()`, partner agents from `agentsApi.listPublic(targetSimId)`
- On agent selection: `VelgAvatar` preview with portrait + name
- **Role** text input (placeholder: "e.g., Cultural Attaché")
- **Quirk** text input (optional, placeholder: "e.g., Speaks in haiku during full moons")
- Info banner: "Ambassadors are agents who represent their simulation at this embassy. Assignment is optional."
- Responsive: stacks to single column below 480px

### Step 4 — Confirm

Review all selections before creation.

- Side-by-side building cards with image previews
- Ambassador names + `VelgBadge` "Ambassador" shown under each building (if assigned)
- Bleed vector + question displayed
- **"Establish & Activate"** button — creates the embassy AND auto-activates it in one flow

### Creation Flow (Backend)

1. Frontend sends `POST /api/v1/simulations/{simId}/embassies` with building IDs, simulation IDs, bleed vector, description, and `embassy_metadata` containing ambassador assignments
2. Backend `create_embassy()`:
   - Sorts building IDs (`building_a_id < building_b_id`) to satisfy the ordered constraint
   - **Swaps ambassador metadata** when building order is reversed — `ambassador_a`/`ambassador_b` always map to `simulation_a_id`/`simulation_b_id`
   - Validates different simulations
   - Inserts embassy with status `proposed`
   - Sets `special_type = 'embassy'` + `special_attributes` on both buildings
   - **Auto-activates** → transitions from `proposed` to `active` immediately (wrapped in try/except so creation still succeeds if activation fails)
3. Frontend receives response, shows success toast, closes modal, reloads building list

### Event Flow

```
BuildingDetailsPanel                 BuildingsView                  EmbassyCreateModal
      |                                   |                              |
      |---(embassy-establish)------------>|                              |
      |                                   |--- opens modal ------------->|
      |                                   |                              |
      |                                   |                    [user completes wizard]
      |                                   |                              |
      |                                   |<--(embassy-created)----------|
      |                                   |                              |
      |                                [reloads buildings list]          |
```

---

## Visual Design

### Embassy Card Effects

Embassy buildings and ambassador agents receive special visual treatment via the `.card--embassy` CSS class in `card-styles.ts`. The effects use per-simulation theme colors (`--color-primary` and `--color-text-secondary`) so each simulation's embassies have a unique visual identity.

#### Non-Hover State: Pulsing Ring

A continuously pulsing ring effect using `box-shadow: 0 0 0 Npx`:

- **Technique:** `box-shadow` ring (not `border-image`, which breaks with `border-radius`)
- **Pulse range:** 1px (narrow) → 5px (wide) over 3 seconds
- **Color shift:** `--color-primary` at 0%/100% → `--color-text-secondary` at 50%
- **Glow:** Outer glow pulses from 6px/30% opacity to 20px/70% opacity
- **Animation:** `embassy-pulse 3s ease-in-out infinite`

```css
@keyframes embassy-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 1px var(--color-primary),
      0 0 6px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 5px var(--color-text-secondary),
      0 0 20px color-mix(in srgb, var(--color-primary) 70%, transparent);
  }
}
```

#### Hover State: Gradient Fill + Border

On hover, two effects activate simultaneously:

1. **Gradient border** via `background: padding-box/border-box` trick — a 3px gradient border using `linear-gradient(135deg, --color-primary, --color-text-secondary, --color-primary)`. This technique works with `border-radius` (unlike `border-image`).

2. **Gradient fill overlay** via `::after` pseudo-element — a semi-transparent gradient wash over the entire card surface, using `color-mix()` to keep content readable. `pointer-events: none` ensures click-through. `z-index: 1` layers it above the card background.

Combined with the standard card hover lift (`translate(-2px, -2px)`) and enhanced glow shadow.

#### Theme Compatibility

The effects are designed to work across all theme presets:

| Theme | `--color-primary` | `--color-text-secondary` | Visual |
|-------|-------------------|--------------------------|--------|
| Brutalist (Velgarien) | `#000000` | `#525252` | Black→grey pulse, strong contrast |
| Sunless-Sea (Capybara Kingdom) | `#0d7377` | `#90aa9c` | Teal→sage pulse, underwater glow |
| Deep-Space-Horror (Station Null) | `#8b0000` | `#ff6b35` | Blood red→orange pulse, alarm effect |
| Arc-Raiders (Speranza) | `#d4a574` | `#8b7355` | Gold→bronze pulse, warm glow |
| Cyberpunk | `#ff00ff` | `#00ffff` | Magenta→cyan pulse, neon |
| Solarpunk | `#2d6a4f` | `#52796f` | Green→sage, organic |
| Nordic-Noir | `#4a6741` | `#7d8471` | Forest→grey, subtle |

**Key design decisions:**
- Uses `box-shadow` ring instead of `border-image` because `border-image` does not work with `border-radius` (fails on themes with rounded corners like Sunless-Sea)
- Uses `color-mix()` for semi-transparent effects (94% browser support, matches AVIF target)
- The `::after` gradient overlay uses `pointer-events: none` so it doesn't block card clicks
- Embassy cards set `border-color: transparent` to prevent double-border artifacts
- Border width forced to `3px` on hover for gradient visibility across all themes

### Badges

| Component | Badge | Variant | Condition |
|-----------|-------|---------|-----------|
| `AgentCard` | "Ambassador" / "Botschafter" | `warning` | `agent.is_ambassador === true` |
| `BuildingCard` | "Embassy" / "Botschaft" | `info` | `building.special_type === 'embassy'` |
| `BuildingDetailsPanel` | "Embassy" / "Botschaft" | `info` | `building.special_type === 'embassy'` |

### Info Bubbles

The wizard uses info bubbles (pattern from `DesignSettingsPanel`) on form labels to explain domain-specific concepts without cluttering the UI. CSS in `EmbassyCreateModal.ts` — hover/focus-within reveals a tooltip positioned above the icon.

---

## Demo Data (Migration 026+)

### Embassy Buildings (per simulation)

| Simulation | Building | Type | Description |
|------------|----------|------|-------------|
| Velgarien | Archive Sub-Level C | Archive | Restricted section containing documents from other simulations |
| Capybara Kingdom | The Drowned Antenna | Observatory | Alien antenna array matching HAVEN's frequencies |
| Capybara Kingdom | The Threshold | Anomaly | Door to a corridor with concrete walls and fluorescent lighting |
| Capybara Kingdom | The Warm Market | Trading Post | Vendors selling pre-Fracture technology from "Speranza" |
| Station Null | *(planned)* | — | — |
| Speranza | *(planned)* | — | — |

### Ambassador Agents

Ambassador status is computed dynamically — any agent whose name matches an ambassador entry in `embassy_metadata` of an active embassy becomes an ambassador. The `AgentService._enrich_ambassador_flag()` method queries the embassies table at response time.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/simulations/{id}/embassies` | JWT | List embassies for simulation |
| `POST` | `/api/v1/simulations/{id}/embassies` | JWT (admin) | Create embassy (auto-activates) |
| `GET` | `/api/v1/simulations/{id}/embassies/{eid}` | JWT | Get embassy by ID |
| `PATCH` | `/api/v1/simulations/{id}/embassies/{eid}` | JWT (admin) | Update embassy metadata |
| `PATCH` | `/api/v1/simulations/{id}/embassies/{eid}/activate` | JWT (admin) | Activate embassy |
| `PATCH` | `/api/v1/simulations/{id}/embassies/{eid}/suspend` | JWT (admin) | Suspend embassy |
| `PATCH` | `/api/v1/simulations/{id}/embassies/{eid}/dissolve` | JWT (admin) | Dissolve embassy |
| `GET` | `/api/v1/simulations/{id}/buildings/{bid}/embassy` | JWT | Get embassy for building |
| `GET` | `/api/v1/public/simulations/{id}/embassies` | Anon | Public: list embassies |
| `GET` | `/api/v1/public/simulations/{id}/buildings/{bid}/embassy` | Anon | Public: get embassy for building |
| `GET` | `/api/v1/public/embassies` | Anon | Public: list all active embassies |

### Public API Methods (for cross-sim data loading)

The wizard needs data from partner simulations where the user may not be a member. Three `listPublic()` methods bypass auth checks:

```typescript
simulationsApi.listPublic()                    // All simulations (no auth)
buildingsApi.listPublic(simulationId, params)  // Buildings in partner sim
agentsApi.listPublic(simulationId, params)     // Agents in partner sim
```

These always route to `/api/v1/public/*` regardless of authentication state.

---

## User Manual

### For Viewers (Anonymous / Authenticated Read-Only)

1. **Identifying Embassies:** Embassy buildings are visually distinct with a pulsing colored ring around their card and a "Botschaft" (Embassy) badge. Ambassador agents show a "Botschafter" (Ambassador) badge with the same pulsing effect.

2. **The pulsing effect** uses your simulation's theme colors — each world's embassies look different, matching the local aesthetic.

3. **On hover**, embassy cards show an enhanced gradient effect with a colored border and subtle color wash overlay, plus the standard card lift animation.

4. **Embassy details** — open any embassy building's detail panel to see the "Embassy Link" section with the partner building and simulation, plus the local ambassador (if assigned).

### For Admins (Creating Embassies)

1. **Starting the wizard:** Open any non-embassy building's detail panel → click the blue **"Establish Embassy"** button in the footer. This opens the 4-step creation wizard with the selected building pre-filled as the local side.

2. **Step 1 — Partner:** Select the target simulation from the dropdown, then select a target building. You'll see an inline preview with the building's image and type. Only non-embassy buildings are shown.

3. **Step 2 — Protocol:** Choose a **Bleed Vector** (the metaphysical channel connecting the two worlds) and optionally write **"The Question"** — the fundamental existential question this embassy explores.

4. **Step 3 — Ambassadors:** Optionally assign agents as diplomatic representatives for each side. Select an agent from the dropdown to see their avatar preview, then fill in their diplomatic role (e.g., "Cultural Attaché") and an optional quirk. Both sides are optional — you can create an embassy without ambassadors and assign them later.

5. **Step 4 — Confirm:** Review the side-by-side building previews, ambassador assignments, bleed vector, and question. Click **"Establish & Activate"** to create and immediately activate the embassy.

6. **After creation:** Both buildings show the `.card--embassy` pulsing ring. Assigned ambassadors show the "Ambassador" badge on their agent cards. The building detail panel shows the "Embassy Link" section with a link to the partner building.

7. **Managing embassies:** Use the API or backend admin to suspend, dissolve, or update embassy metadata after creation.

### For Editors (Building Management)

1. **Embassy buildings** function like regular buildings in all other respects (editable name, description, type, condition, image generation, location assignment).

2. **Assigning ambassadors:** Ambassadors are designated through `embassy_metadata` on the embassy record (set during creation wizard or via API update). The `is_ambassador` flag on agents is computed automatically — no manual flag needed.

3. **Dissolving an embassy** clears `special_type` and `special_attributes` from both buildings.

### For Developers

1. **Adding embassy support to a new simulation:** Create buildings with `special_type = 'embassy'` in the simulation's seed data, or use the wizard UI. The visual effects activate automatically via the CSS class.

2. **Theme compatibility:** The embassy effects use `--color-primary` and `--color-text-secondary` CSS custom properties. Ensure your theme preset defines these with sufficient contrast against the background.

3. **Ambassador metadata swap:** When `building_a_id > building_b_id`, the backend swaps both the building/simulation IDs AND the `ambassador_a`/`ambassador_b` metadata keys. This ensures `ambassador_a` always maps to `simulation_a_id` regardless of the order the user selected buildings.

4. **Auto-activation:** `create_embassy()` automatically transitions the embassy from `proposed` → `active`. The `proposed` status exists for potential future workflows (e.g., requiring partner simulation approval) but is skipped for UI-created embassies.

5. **Testing:** Embassy visual effects can be verified by checking:
   - `AgentCard` renders `card--embassy` class when `agent.is_ambassador === true`
   - `BuildingCard` renders `card--embassy` class when `building.special_type === 'embassy'`
   - The `embassy-pulse` animation runs in the browser
   - Hover state shows gradient border + fill overlay
   - Backend: `python3.13 -m pytest backend/tests/ -v -k embassy` (23 tests)
   - Frontend: `cd frontend && npx vitest run` (28 embassy API tests in `embassy-api.test.ts`)

---

## Relationship to Other Features

| Feature | Relationship |
|---------|-------------|
| **Simulation Connections** (20_RELATIONSHIPS_ECHOES_MAP.md) | Embassies are the in-world manifestation of simulation connections |
| **Event Echoes / The Bleed** | Embassies serve as narrative vectors for cross-simulation events |
| **Cartographer's Map** | Embassy count displayed on connection edges (planned) |
| **Agent Relationships** | Ambassadors can form cross-simulation relationships |
| **Per-Simulation Theming** (18_THEMING_SYSTEM.md) | Embassy visual effects use theme colors for per-world identity |
| **Public-First Architecture** | Wizard uses `listPublic()` to load partner sim data without auth |

---

## i18n

| String | EN | DE |
|--------|----|----|
| Embassy badge | "Embassy" | "Botschaft" |
| Ambassador badge | "Ambassador" | "Botschafter" |
| Wizard header | "Establish Embassy" | "Botschaft errichten" |
| Step: Partner | "Partner" | "Partner" |
| Step: Protocol | "Protocol" | "Protokoll" |
| Step: Ambassadors | "Ambassadors" | "Botschafter" |
| Step: Confirm | "Confirm" | "Bestätigen" |
| Bleed Vector label | "Bleed Vector" | "Blutungsvektor" |
| The Question label | "The Question" | "Die Frage" |
| No ambassador | "No ambassador" | "Kein Botschafter" |
| Role placeholder | "Role (e.g., Cultural Attaché)" | "Rolle (z. B. Kulturattaché)" |
| Quirk placeholder | "Quirk (optional)" | "Eigenart (optional)" |
| Establish & Activate | "Establish & Activate" | "Einrichten & Aktivieren" |
| Success toast | "Embassy established and activated." | "Botschaft eingerichtet und aktiviert." |
| Info: ambassadors | "Ambassadors are agents who represent their simulation..." | "Botschafter sind Agenten, die ihre Simulation..." |

All UI strings wrapped in `msg()` with German translations in `de.xlf` (15 new trans-units added in v1.1).
