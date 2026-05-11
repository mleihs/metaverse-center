---
title: "Per-Simulation Procedural World Map — Implementation Plan"
id: doc-per-sim-world-map-plan
version: 1.0
lang: en
type: plan
status: implementing
date: 2026-05-10
tags: [world-map, maplibre, forge, geometry, simulations]
---

# Per-Simulation Procedural World Map — Implementation Plan

**Status**: Draft pending review.
**Scope**: New feature — each simulation gets a navigable OSM-style map with procedurally generated street network, zone polygons, and building positions, rendered in a MapLibre-based Lit component. MVP target: Velgarien, one preset (`medieval_walled`), one style.
**Plan author**: 2026-05-10 session.

This is the CONTRACT. Decisions resolve open questions inline so later phases don't stall on "wait, we never decided X." All decisions in §"Architecture overview" can still be overridden — but the plan assumes them.

Related memory: `project_per_sim_map_template_geometry.md` (Template/Instance geometry split — locked decision from this session).

---

## Context

Each simulation in metaverse.center should have a navigable OSM-style map that plausibly depicts its locations and street network. The map must:
- Make narrative sense per simulation (medieval/cyberpunk/eldritch styles, all driven by the existing per-sim Forge theme)
- Be small and fictional, NOT a 1:1 copy of real geography (even for sims with real `weather_lat/lon`)
- Show the simulation's existing named cities, zones, buildings, and agents — not invent new entities
- Render live overlays (zone stability, events, agent positions) on top of stable base geometry
- Stay public-first: anonymous users can browse it without 403s

The geography layer is already half-built: `cities`, `zones`, `city_streets`, `buildings` exist with `jsonb` geometry columns (`buildings.geojson`, `city_streets.geojson`, `cities.map_center_lat/lng`). What's missing is **a polygon column on `zones`**, **a deterministic generator that populates these existing columns**, and **a frontend component that renders them as a tiled MapLibre map**. PostGIS is deliberately not enabled — `jsonb` is the established convention (used by `forge_drafts.geography`).

Two locked architectural decisions from prior planning sessions:
- **Geometry lives at the Template, not the Game-Instance.** Instances inherit via JOIN on `source_template_id`. Live overlays come from the Instance.
- **Agent home position is a convention, not a column.** `building_agent_relations.relation_type='lives_at'` — `relation_type` is free `text` with no CHECK; the existing clone function copies it faithfully (`supabase/migrations/20260301050000_038_clone_normalization_fixes.sql:313-321`); zero-migration introduction.

---

## Architecture overview

The cleanest cut, after stress-testing the first sketch:

1. **Generator split: Python builds geometry, Postgres writes it.** Per the project Postgres-first principle (memory `feedback_postgres_first.md`), the Python `ForgeMapService` is reduced to *only* the work that uniquely needs Python — shapely Voronoi, recursive grid subdivision, `shapely.contains` invariant checks. ALL persistence (every `UPDATE`, every `INSERT`, the version bump, the `lives_at` assignment loop, the `forge_drafts.map_status='succeeded'` transition) happens inside ONE atomic SQL function `fn_apply_map_geometry(p_simulation_id, p_seed, p_geometry_json)`. The Python service is sibling to `ForgeLoreService` / `ForgeThemeService` / `ForgeImageService`, called by `forge_orchestrator_service` as a post-materialization step.
2. **Storage uses existing columns** as much as possible: `cities.map_center_lat/lng` (already exist), `buildings.geojson` (already exists, currently empty), `city_streets.geojson` (already exists, currently empty). Only **one new geometry column**: `zones.geojson`.
3. **Determinism via two new sim-level columns**: `simulations.map_seed text`, `simulations.map_generator_preset text` (no CHECK constraint — validated as Pydantic `Literal` at API layer; new presets don't require migrations). Plus `simulations.map_geometry_version int` for cache invalidation.
4. **Forge phase enum is NOT touched.** The hard-coded `Literal["astrolabe", "drafting", "darkroom", "ignition", "completed", "failed"]` at `backend/models/forge.py:104` and the matching CHECK at `supabase/migrations/20260305500000_055_forge_infrastructure.sql:40-41` stay as-is. Map-gen plugs in as an *orchestrator step within ignition*, with its own state field for retry, not as a new phase.
5. **Single public endpoint** `GET /api/v1/public/simulations/{slug}/map` returns geometry + theme hints in one round-trip, JOIN-resolved against `source_template_id` for Game-Instances. Plus one admin endpoint to regenerate. **No separate `style.json` endpoint** — the frontend computes MapLibre paint properties client-side from existing theme tokens (`utils/theme-colors.ts`).
6. **Public read goes through service_role + app-layer status check** (existing `/api/v1/public/*` pattern, used by bleed_gazette, broadsheets, etc.). No new RLS policies; existing geometry-table policies stay restrictive for direct Supabase access.
7. **Frontend: new directory** `frontend/src/components/world-map/` to avoid namespace collision with the existing `frontend/src/components/map/CartographicMap.ts` (which is the *multiverse* schematic, a different feature). New component `<velg-simulation-world-map>` uses MapLibre GL JS 5.x, light-DOM render root.
8. **Live overlays are deferred to Phase 6** but designed-in: API returns geometry from Template (via JOIN), live agent positions / zone stability from the Instance — explicit data path, not magic.

### Why this is the cleanest cut (vs. earlier sketches)

| Earlier sketch | Replaced with | Reason |
|---|---|---|
| `buildings.map_position` new column | Use existing `buildings.geojson` | Avoids the 3-column drift that started with `location` + `geojson` |
| `zones.boundary` + `zones.centroid_lat/lng` | Just `zones.geojson`; centroid computed via `shapely` at query time | Two columns less, no sync risk |
| `CHECK (preset IN (…))` enum | Free text + Pydantic `Literal` at API layer | New presets cost zero migrations |
| `fn_bootstrap_simulation_map` PL/pgSQL function | Pure Python service method | Supabase forbids `plpython3u`; SQL-Voronoi is impossible |
| Server-side `style.json` endpoint | Frontend derives style from existing theme tokens | One endpoint less; no drift between map and rest-of-UI styling |
| New `cartography` Forge phase | Orchestrator step within ignition with own `map_status` state | Forge phase enum is hard-coded in 3 places; new phase = state-machine churn |

---

## Schema migration (1 file)

`supabase/migrations/{N}_per_sim_world_map.sql`:

```sql
-- 1. zones polygon
ALTER TABLE zones ADD COLUMN geojson jsonb;
COMMENT ON COLUMN zones.geojson IS
  'GeoJSON Polygon for the zone boundary. Populated by ForgeMapService at ignition. '
  'Game-Instances leave this NULL and inherit via source_template_id JOIN.';

-- 2. simulation-level map config
ALTER TABLE simulations
  ADD COLUMN map_seed text,
  ADD COLUMN map_generator_preset text,
  ADD COLUMN map_geometry_version int NOT NULL DEFAULT 0;

COMMENT ON COLUMN simulations.map_seed IS
  'Deterministic seed for map generation. Set once at ignition (NEW.id::text by default). '
  'NULL on Game-Instances — they inherit geometry from source_template_id.';
COMMENT ON COLUMN simulations.map_generator_preset IS
  'Generator algorithm key (e.g. "medieval_walled", "modern_grid"). Free text; '
  'validated as Pydantic Literal at API layer to avoid migrations on new presets.';
COMMENT ON COLUMN simulations.map_geometry_version IS
  'Bumps on every successful regeneration. Frontend caches by (simulation_id, version).';

-- 3. forge_drafts state for the ignition map-gen step
ALTER TABLE forge_drafts
  ADD COLUMN map_status text NOT NULL DEFAULT 'pending'
    CHECK (map_status IN ('pending', 'generating', 'succeeded', 'failed'));

-- 4. NO new RLS policies — public reads use service_role via /api/v1/public/* endpoints.
```

**Explicitly NOT added** (justified by review):
- `buildings.map_position` — `buildings.geojson` already exists, would be duplicate.
- `zones.centroid_lat/lng` — derived at query time via `shapely.centroid` in Python or `jsonb` extraction; storing it duplicates state.
- `CHECK (preset IN (...))` on `simulations.map_generator_preset` — Pydantic Literal at API gives same validation without migration churn.
- `fn_bootstrap_simulation_map` PL/pgSQL — generator is Python-only.
- New `relation_type='lives_at'` enum value — column is free text already.

---

## Backend services

### `backend/services/forge_map_service.py` (new)

Mirror of `forge_lore_service.py` / `forge_theme_service.py`. Public methods:

- `async def generate_map(simulation_id: UUID, *, seed: str | None = None, preset: str | None = None) -> MapGenerationResult` — top-level entry point. Resolves preset (uses passed value, else `simulations.map_generator_preset`, else maps from `simulations.theme` via a small dict, e.g. `velgarien → medieval_walled`). Resolves seed (passed value or `simulations.id::str`).
- Reads: `cities`, `zones`, `buildings`, `agents`, `building_agent_relations`, `forge_themes` (for style hints) — all via `get_admin_supabase` because this is a system operation.
- Writes (single transaction via Postgres function `fn_apply_map_geometry` — pure SQL, no scipy, just bulk UPDATE): `cities.map_center_lat/lng`, `zones.geojson`, `city_streets` rows (DELETE existing + INSERT generated), `buildings.geojson`, `building_agent_relations(relation_type='lives_at')` rows (INSERT ON CONFLICT DO NOTHING). Bumps `simulations.map_geometry_version`.
- Returns: `MapGenerationResult` Pydantic model with counts (zones_polygons_written, streets_written, buildings_placed, agents_assigned_homes) and the new version int.

### Generator presets (Python, shapely + numpy ONLY)

Dependency policy: **shapely yes, scipy NO** (80MB on Railway is too much). Voronoi for small N (≤6 zones) is hand-rolled or via `shapely.ops.voronoi_diagram` (no scipy needed). Pin `PYTHONHASHSEED` for determinism; sort all set/dict iterations explicitly.

For MVP, **only one preset is implemented**: `medieval_walled`. Others (`modern_grid`, `radial_capital`, `coastal_port`, `underground_station`) are stubs that raise `NotImplementedError` with a clear "next preset" message.

`medieval_walled` algorithm (~400 LOC target):
1. **Pseudo-Mercator patch**: assign each city a fictional 0.01° × 0.01° square at `(0.5, 0.5)` Lat/Lng (configurable per sim if multi-city).
2. **Zone polygons**: for `zone_count ≤ 4`, use direct quadrant assignment (N/E/S/W or N/S only); for `zone_count > 4`, Lloyd-relaxed Voronoi via `shapely.ops.voronoi_diagram` with weighted seed points (weight = `zones.population_estimate`). Zones near the city center are weighted toward `government`/`religious` types; outer zones lean `industrial`/`slums`/`ruins`.
3. **Street network per zone**: recursive grid subdivision (3-5 levels, jittered) → block polygons. Block edges = streets, written to `city_streets.geojson` as LineString features. Street type derived from depth (`arterial` / `secondary` / `tertiary` / `alley`). Street name: pulled from a small Velgarien naming bank (no LLM call in MVP — defer i18n to Phase 6).
4. **Building placement**: for each building in the zone, find a free block edge and place a Point on it. Snap to street via shortest perpendicular. Set `buildings.street_id` to the matched street row.
5. **`lives_at` assignment**: handled INSIDE `fn_apply_map_geometry` (SQL), not Python — per the Postgres-first principle. The SQL function inserts `building_agent_relations(relation_type='lives_at')` rows for every agent in the simulation that doesn't already have one, choosing a residential building deterministically via `('x' || md5(agent.id::text || p_seed))::bit(64)::bigint % cardinality(residential_buildings)`. Idempotent via the existing `UNIQUE (building_id, agent_id, relation_type)` constraint and `ON CONFLICT DO NOTHING`. Python only passes the seed and the residential-buildings array; the SQL function is the single source of truth for the assignment.
6. **Invariant check**: `shapely.contains(zone_polygon, building_point)` for every building. Any failure aborts the whole generation, logs to Sentry, returns error.

### Orchestrator integration (NOT a Forge phase)

Edit `backend/services/forge_orchestrator_service.py` — at the end of the ignition pipeline, **after** `_generate_lore_and_translations` (currently around line 827+), add a step `_generate_world_map(simulation_id)` that:
- Catches all exceptions (no silent fail), writes outcome to `forge_drafts.map_status` (`pending` / `generating` / `succeeded` / `failed`).
- Failure path: marks `map_status='failed'`, captures Sentry exception with `simulation_id` tag, but does NOT fail ignition. The simulation comes online without a generated map; the admin regen endpoint (below) is the recovery path.
- Bumps `simulations.map_geometry_version` on success.
- Reports duration to logs (target: ≤30s for Velgarien-scale, no Cloudflare 100s budget worry since this is post-ignition-completion).

---

## API layer

`backend/routers/world_map.py` (new), all endpoints typed with Pydantic response wrappers per CLAUDE.md.

### Public endpoint (one round-trip, public-first)
```
GET /api/v1/public/simulations/{slug_or_id}/map → SuccessResponse[WorldMapResponse]
```
- Uses `get_admin_supabase` (service_role) per the established public-endpoint pattern (bleed_gazette, broadsheets) — bypasses RLS, validates `simulations.status='active' AND deleted_at IS NULL` at app layer.
- Resolves geometry source: `geometry_sim_id = simulation.source_template_id ?? simulation.id`. JOIN on `geometry_sim_id` for cities/zones/streets/buildings.
- Live overlay source: always `simulation.id` (the Instance). Returns current `mv_zone_stability` rows + agent positions (from `agents.current_building_id`).
- Soft-deleted entities filtered out (`deleted_at IS NULL` everywhere).
- Returns `WorldMapResponse`:
  ```
  {
    cities: [GeoJSON FeatureCollection],
    zones: [GeoJSON FeatureCollection with stability props],
    streets: [GeoJSON FeatureCollection],
    buildings: [GeoJSON FeatureCollection with type, name],
    agent_positions: [{ agent_id, building_id, current: bool, name }],
    geometry_version: int,
    theme_hints: { primary_color, surface_color, … }  // small subset of ForgeThemeOutput
  }
  ```
- Cache: `Cache-Control: public, max-age=60` keyed by `geometry_version`. Frontend invalidates on signal change.

### Admin regen endpoint
```
POST /api/v1/admin/simulations/{id}/map/regenerate
  body: { seed?: string, preset?: string }
  → SuccessResponse[MapGenerationResult]
```
- `require_owner_or_platform_admin()` per CLAUDE.md.
- Calls `ForgeMapService.generate_map(simulation_id, seed=…, preset=…)` synchronously (operation is ≤30s for Velgarien-scale).
- Audited via existing audit_log infrastructure.

---

## Frontend

### New component `<velg-simulation-world-map>`
File: `frontend/src/components/world-map/SimulationWorldMap.ts` (NEW directory to avoid collision with existing `frontend/src/components/map/CartographicMap.ts` which is the multiverse schematic — different feature).

Implementation rules:
- Extends `LitElement` per CLAUDE.md frontend rules.
- **Light-DOM render root**: `createRenderRoot() { return this; }` to sidestep MapLibre + Shadow-DOM container/event-coordinate issues (documented in MapLibre discussion #1304).
- MapLibre GL JS 5.x via dynamic import (lazy-loaded; ~250KB gzipped). The static import would balloon the initial bundle.
- Reads geometry from `WorldMapApiService.getMap(slug, mode)` where mode is `appState.currentSimulationMode.value` (per CLAUDE.md routing rule).
- Computes MapLibre paint properties from existing theme tokens (`getThemeColor()` from `utils/theme-colors.ts`) — no server-side `style.json`. This avoids drift between map style and rest-of-UI styling.
- Subscribes to `appState.currentSimulation.signal` for sim switches → calls `map.setStyle(newStyle)` (no full re-init).
- All user-facing strings via `msg('...')` per i18n rule. No em dashes, no LLM-isms.
- All colors via theme tokens, no raw hex.
- All errors observed via `captureError(err, { source: 'SimulationWorldMap.<method>' })` per CLAUDE.md.
- Invokes the `velg-frontend-design` skill BEFORE writing component code per CLAUDE.md.

### API service
`frontend/src/services/api/WorldMapApiService.ts` — singleton, extends `BaseApiService`. Single method `getMap(slug, mode)` calls the public endpoint. Returns typed `WorldMapResponse`. Forwards `mode` parameter explicitly per the appstate-no-routing-reads rule.

### Live overlay (Phase 6 — designed in but deferred)
- Existing zone-stability subscription via Supabase Realtime, already used by other map components.
- Renders as MapLibre data-driven `fill-color` paint property (no deck.gl needed for MVP — that's only worth it for >10k overlay points, which we don't have).

### Velgarien dogfood
Add a route `/v/velgarien/world-map` (or wherever the existing simulation tab routing puts it) and verify in browser per CLAUDE.md frontend testing rule. Test golden path (load, pan, zoom, switch sims) and regressions.

---

## Migration deltas to existing code

- `backend/services/forge_orchestrator_service.py`: one new step in ignition (~30 LOC).
- `backend/models/forge.py`: extend `ForgeDraft` model with `map_status: Literal['pending', 'generating', 'succeeded', 'failed'] = 'pending'`.
- `backend/models/simulation.py`: add `map_seed`, `map_generator_preset`, `map_geometry_version` to relevant response models.
- `backend/models/world_map.py` (new): all the Pydantic types for the API.
- `clone_simulations_for_epoch`: NO change required. Verified: the function does not currently copy `cities.map_center_*` or `city_streets.geojson` — that's correct under the locked Decision A. New columns `zones.geojson`, `simulations.map_*` should remain similarly omitted from the clone (Instances inherit via JOIN).
- `frontend/src/components/map/CartographicMap.ts`: untouched. Different feature.

---

## Phases

| # | Deliverable | Effort |
|---|---|---|
| **1** | Schema migration + Pydantic models + clone-function audit (no change confirmed) | 1 day |
| **2** | `ForgeMapService` skeleton + `medieval_walled` preset (Velgarien-scoped) | 1.5 weeks |
| **3** | `fn_apply_map_geometry` SQL function + orchestrator hook with proper state column + retry path | 3 days |
| **4** | Single map API endpoint + admin regen endpoint + Pydantic response models | 2-3 days |
| **5** | `<velg-simulation-world-map>` Lit component + WorldMapApiService + Velgarien dogfood in browser | 1.5 weeks |
| **6** | Live overlay (zone stability colors + agent home markers + current_building positions) | 4-5 days |
| **7** | CLAUDE.md updates (map rendering rules, MapLibre+Lit gotchas) + docs/INDEX.md entry + Sentry alerting on `map_status='failed'` rate | 1 day |

**Honest MVP total: ~5 weeks** (corrected from earlier 3-week estimate based on Lloyd-relaxation reality + visual tuning).

---

## Verification

### Unit / determinism
- `pytest backend/tests/services/test_forge_map_service.py` — new file. Snapshot-test: `(seed='velgarien-test', preset='medieval_walled', zone_count=3) → identical bytes for cities/zones/streets/buildings outputs`. Run twice; assert byte-equal.
- Invariant test: every generated `buildings.geojson` Point lies within the corresponding `zones.geojson` Polygon (`shapely.contains`).
- Idempotency test: running the generator twice on the same sim yields the same `geometry_version + 2` and identical row contents.

### Integration
- `pytest backend/tests/integration/test_world_map_api.py` — anonymous fetch returns geometry + theme_hints; archived sim returns 404; Game-Instance fetch returns Template's geometry but Instance's live overlays.
- `python -m scripts.regenerate_velgarien_map` — one-shot dev script, reports counts, exits 0 on success.

### End-to-end (browser, MANDATORY per CLAUDE.md)
- `npm run dev` → navigate to `/v/velgarien/world-map`. Verify:
  - Map loads, zones render as filled polygons with names, streets as lines, buildings as markers
  - Pan + zoom work (golden path)
  - Switch to another simulation → style swaps, geometry reloads
  - Anonymous (logged-out) browse works — no 403, no auth modal
  - Live zone stability colors update when an event is triggered admin-side
  - Soft-deleting a building admin-side → marker disappears on next refetch
  - Browser console: zero errors, all `captureError` calls observable in Sentry dev project

### CI
- New ESLint rule check: `<velg-simulation-world-map>` does not use raw hex colors (existing `lint-color-tokens.sh` covers this).
- Bundle-size check: Velgarien page initial bundle does not regress more than +5KB (MapLibre is dynamic-imported).

---

## Open follow-ups (NOT in MVP)

- Second preset (`modern_grid`) for the next non-medieval simulation — likely 1 week each.
- Vector tile pipeline (PMTiles + tippecanoe + Supabase Storage) — only when single-sim GeoJSON exceeds ~500KB or when many sims are visible side-by-side. Today's expected payload (~10-30KB per Velgarien-scale sim) doesn't justify it.
- Procedural street naming via LLM (currently uses static naming bank). Forge translation service can extend to street names; do this when the second preset ships.
- Content-pack-defined building positions ("northeast quadrant near the wall"). Today Velgarien is not pack-driven; revisit if a future world ships pack-defined geometry constraints.
- "Iterable map preview in Forge" UX — let users see the generated map during drafting and regenerate with different presets before ignition. UX nice-to-have, requires Forge state-machine extension; not architecturally clean enough for MVP.
- Move geometry to PostGIS if we ever need spatial queries (`ST_Contains` for "which zone owns this point"). Currently solvable client-side or in Python.
