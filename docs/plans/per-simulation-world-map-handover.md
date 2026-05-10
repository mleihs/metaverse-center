# Per-Simulation World Map — Handover (Phases 4-7)

**Status as of 2026-05-10**: Phases 1-4 complete (schema + service + orchestrator hook + API endpoints). Phases 5-7 outstanding.
**Authoritative spec**: `docs/plans/per-simulation-world-map-plan.md`. Read it first if you haven't.
**Locked decisions** (do not relitigate): see "Critical context" below + linked memories.

This document is for the next session — likely a fresh context. It captures:
1. What's been built and what shape it's in
2. The non-obvious gotchas it took us pain to discover
3. Concrete playbooks for the four remaining phases
4. Where to start

---

## 1. What's done (committed-or-equivalent state)

### New files
| Path | Purpose |
|---|---|
| `supabase/migrations/20260510120000_235_per_sim_world_map.sql` | `zones.geojson`, `simulations.map_seed/preset/version`, `forge_drafts.map_status` |
| `supabase/migrations/20260510130000_236_fn_apply_map_geometry.sql` | Atomic SQL function — every UPDATE/INSERT/DELETE for geometry + lives_at + version bump |
| `backend/models/world_map.py` | Pydantic contract: `MapGeometryPayload`, `MapGenerationResult`, `MapRegenerateRequest`, `MapGeneratorPreset` Literal |
| `backend/services/forge_map_generators.py` | Pure shapely geometry: `generate_medieval_walled` (Quadrant/Voronoi zones, recursive subdivision streets, building snap) |
| `backend/services/forge_map_service.py` | Orchestrator wrapper — fetches inputs, calls generator, calls `fn_apply_map_geometry` RPC |
| `backend/tests/test_forge_map_generators.py` | 9 tests: determinism, invariants, centrality, edge cases — all passing |
| `backend/services/world_map_service.py` | Read-only assembly: parallel fetch (asyncio.gather × 8), template-vs-instance geometry resolution, stability overlay merge, theme-hint projection from `simulation_settings(category='design')` |
| `backend/routers/world_map.py` | `public_router` (GET /api/v1/public/simulations/{slug_or_id}/map, ETag + Cache-Control) + `admin_router` (POST /api/v1/admin/simulations/{id}/map/regenerate, owner-or-platform-admin gated, audit-logged) |
| `backend/tests/test_world_map_router.py` | 13 tests: payload shape, cache headers, ETag stability/version-change, 404 path, slug URL form, Game-Instance shape, admin auth gate (non-member 403, platform admin OK, owner OK), body validation (invalid preset 422) — all passing |
| `backend/tests/test_world_map_service.py` | 14 tests: status guard (3), `_resolve_geometry_version` (4 — covers the Game-Instance bug-fix path), top-level assembly (7 — Template version, Instance inherits Template version, stability merge, theme projection, orphan-agent skip) — all passing |

### Edited files
| Path | What changed |
|---|---|
| `pyproject.toml` | `shapely>=2.0.0` runtime dep + per-file ignore `S311, S324` for `forge_map_generators.py` |
| `backend/models/simulation.py` | `SimulationResponse` extended with `map_seed`, `map_generator_preset`, `map_geometry_version` |
| `backend/models/forge.py` | `ForgeDraftBase` + `ForgeDraftUpdate` extended with `map_status: Literal['pending', 'generating', 'succeeded', 'failed']` |
| `backend/services/forge_orchestrator_service.py` | New Phase A.7 (between A.6 and Phase B) calls `ForgeMapService.generate_map` with proper `map_status` transitions and Sentry capture |
| `backend/models/world_map.py` | Phase 4 additive: `WorldMapResponse` + sub-models (`WorldMapZone`, `WorldMapBuilding`, `WorldMapStreet`, `WorldMapCity`, `WorldMapAgentMarker`, `WorldMapThemeHints`) |
| `backend/app.py` | Phase 4: registered `world_map.public_router` + `world_map.admin_router` next to the cipher routers |
| `docs/plans/per-simulation-world-map-plan.md` | Plan doc with Postgres-first correction baked in |

### What runs end-to-end today
A complete Forge ignition for a new simulation will, after Phase A.6 (theme refinement), automatically generate the world map: pick the preset from `simulations.theme` → `medieval_walled` for Velgarien-style → write zones/streets/buildings/lives_at via `fn_apply_map_geometry`, bump `map_geometry_version` to 1, mark `forge_drafts.map_status='succeeded'`. If anything throws, ignition still completes; `map_status='failed'` and a Sentry event are recorded.

**Phase 4 additions** (2026-05-10): `GET /api/v1/public/simulations/{slug_or_id}/map` returns the assembled payload anonymously (admin Supabase + `WHERE status='active' AND deleted_at IS NULL` guard, ETag + Cache-Control); `POST /api/v1/admin/simulations/{id}/map/regenerate` synchronously regenerates via `ForgeMapService.generate_map` for owners or platform admins. Both wired in `backend/app.py`.

What's NOT yet exposed: no frontend renders the geometry yet (Phase 5).

### Phase 4 — clarifications discovered while implementing
- **Theme storage**: `forge_themes` table doesn't exist. Themes live in `simulation_settings(category='design')` as key-value rows (one row per setting key). `WorldMapService._fetch_theme_settings` projects the narrow hint subset via `.in_("setting_key", _THEME_HINT_KEYS)`.
- **Zones don't have `name_de`**: only `description_de` and `zone_type_de` (migration 060). Dropped `name_de` from `WorldMapZone`. German names are stored as the canonical `name`.
- **Soft-delete columns**: `cities`, `zones`, `city_streets` do NOT have `deleted_at` (only `agents`, `buildings`, `events` do). `_fetch_buildings` and `_fetch_agents` apply the `deleted_at IS NULL` filter; the geometry tables don't need it.
- **Test harness**: `is_platform_admin` is patched directly in the owner/non-member fixtures rather than relying on the platform-admin-IDs cache being empty between tests — the autouse `_reset_admin_supabase_cache` only resets the supabase client, not `_platform_admin_ids`.

### Phase 4 — Game-Instance geometry-version bug (caught in self-audit, fixed)
- **Symptom**: For Game-Instances the response would always report `geometry_version=0` and the ETag would be `hash(instance_id:0)` — never invalidating after a Template regen.
- **Root cause**: `fn_apply_map_geometry` only bumps the row it runs against, and `ForgeMapService.generate_map` refuses to run on Game-Instances per the locked Decision A. So `simulations.map_geometry_version` for an Instance is permanently 0, while geometry on its `source_template_id` evolves.
- **Fix**: Added `WorldMapService._resolve_geometry_version(admin, sim, geometry_sim_id)`. For Templates, returns the sim's own version (no extra query). For Instances, fetches `map_geometry_version` from the Template row. Included as a 9th task in the parallel `asyncio.gather` so it adds zero latency.
- **Coverage**: `test_world_map_service.py::TestResolveGeometryVersion` (4 tests) and `TestGetPublicMap::test_game_instance_inherits_template_geometry_version` lock this in.
- **Lesson for Phase 5**: the API contract `WorldMapResponse.geometry_version` is the geometry-source's version, not the URL'd simulation's. Frontend cache key is `(geometry_source_id, geometry_version)` per the docstring.

### Phase 4 — YAGNI cleanup (caught in self-audit)
- Dropped `WorldMapZone.is_quarantined` from the model — there is no source for it in `mv_zone_stability` or anywhere else, and Phase 6 will need to introduce both the data source and the field together. Per CLAUDE.md "don't design for hypothetical future requirements."

---

## 2. Critical context (do not relitigate)

These were either user-locked decisions or non-obvious gotchas we hit. A fresh-context agent should NOT need to rediscover them.

### Locked decisions
| Decision | Memory / source |
|---|---|
| **Map geometry lives at the Template.** Game-Instances inherit via `source_template_id` JOIN. Live overlays per Instance. NEVER copy geometry to instances during clone. | `project_per_sim_map_template_geometry.md` |
| **Postgres-first principle.** Every deterministic / atomic / set-based logic goes into Postgres functions. Python is reserved for shapely / LLM / image work. The user emphasised this mid-flow. | `feedback_postgres_first.md` |
| **Agent home positions = `building_agent_relations.relation_type='lives_at'` convention.** No schema change. `relation_type` is free `text` in migration 004; the existing clone function copies it faithfully. | Plan §4 (Schema) |
| **Maps are small fictional patches** in pseudo-Mercator near `(0.5, 0.5)` lat/lng. NOT 1:1 real geography even when `simulations.weather_lat/lon` exists (those are for weather pulls). | Plan §1 (Architecture overview) |
| **No new RLS policies on geometry tables.** Public reads use `service_role` + app-layer status check (`/api/v1/public/*` pattern, see bleed_gazette / broadsheets). | Plan §6 (API layer) |
| **No new Forge phase.** `ForgePhase` Literal at `backend/models/forge.py:104` and CHECK at migration `055` are hard-coded; adding a phase touches three places. `ForgeMapService` is called BY the orchestrator, sibling to `ForgeLoreService`/`ForgeThemeService`/`ForgeImageService`. | Plan §1 (point 4) |
| **No PostGIS.** `jsonb` is the established convention (see `forge_drafts.geography`). Spatial queries are done in Python with shapely. | Plan §3 (Schema) |

### Non-obvious gotchas
| Gotcha | Where it bites |
|---|---|
| **MapLibre + Shadow DOM** has known event-coordinate quirks. Use `createRenderRoot() { return this; }` to render in light DOM. | Phase 5 |
| **Existing `frontend/src/components/map/` is the MULTIVERSE schematic** (`CartographicMap.ts`, `MapAnnotationTool.ts`, etc.) — different feature. New component MUST go to `frontend/src/components/world-map/` to avoid namespace clash. | Phase 5 |
| **Frontend forbids raw hex colors.** Use Tier 1/2 design tokens (`var(--color-...)`) per `lint-color-tokens.sh`. MapLibre paint properties must read from CSS custom properties. | Phase 5 |
| **CLAUDE.md mandates `velg-frontend-design` skill BEFORE writing component code.** Don't skip. | Phase 5 |
| **Public-endpoint auth pattern** is `get_admin_supabase` + app-layer `WHERE status='active' AND deleted_at IS NULL`, NOT new RLS. See `bleed_gazette` (`migration 065c`) and `simulation_broadsheets` (`migration 186b`). | Phase 4 |
| **Pydantic response wrappers** — never `response_model=`, always return-type annotation `-> SuccessResponse[WorldMapResponse]`. CLAUDE.md hard rule. | Phase 4 |
| **Generator determinism requires the user seed in EVERY token** that influences output. We had a bug where `_subdivide_into_blocks` only used `f"{city.id}|{zone.id}"` — fixed to `f"{seed}|{city.id}|{zone.id}"`. Tests catch regressions. | If extending generators |
| **`forge_drafts` has no `simulation_id` link.** During ignition, the draft_id is passed to `ForgeMapService.generate_map(forge_draft_id=...)` and forwarded to `fn_apply_map_geometry(p_forge_draft_id)` for the `map_status='succeeded'` transition. Without a draft (admin regen path), the parameter is NULL and the function skips that update. | Phase 4 admin endpoint |
| **`agents.current_building_id` is NULL for Game-Instances after clone.** For MVP rendering, place agent markers at their `lives_at` building (always populated by the generator). `current_building_id` for live movement is a Phase 6+ concern. | Phase 5/6 |
| **`buildings.street_id`** in Game-Instances is explicitly NULLed by the existing clone function with comment "not remapped (cosmetic)". This is fine — instances render via the JOIN to template geometry; instance street_ids would be stale anyway. | Phase 4 |

### What we deliberately did NOT do
- Did NOT add `buildings.map_position` (existing `buildings.geojson` suffices)
- Did NOT add `zones.centroid_lat/lng` (compute from polygon at query time)
- Did NOT add `CHECK (map_generator_preset IN (...))` (Pydantic Literal at API)
- Did NOT add `fn_bootstrap_simulation_map` PL/pgSQL (generator is Python-only)
- Did NOT add `relation_type='lives_at'` enum value (free text already)
- Did NOT add `buildings.source_template_building_id` bridge column. We considered it during planning but concluded that for MVP, agent markers render at Template positions for ALL views (Template and Instance) — Instance live-data overlays are zone stability + events, not agent positions. Defer the bridge column until/unless live agent movement on the map becomes a real requirement.

---

## 3. Remaining phases

### Phase 4: API endpoints (~2-3 days)

**Goal**: Two endpoints — public read (one round-trip JSON), admin regen.

**Files to create**:
- `backend/routers/world_map.py` (NEW)

**Files to edit**:
- `backend/models/world_map.py` — add `WorldMapResponse` (public response shape) and supporting types
- `backend/app.py` (or the routers registration site — grep for `include_router` to find it) — wire the new router

**Endpoints**:
```
GET /api/v1/public/simulations/{slug_or_id}/map → SuccessResponse[WorldMapResponse]
POST /api/v1/admin/simulations/{id}/map/regenerate (body: MapRegenerateRequest) → SuccessResponse[MapGenerationResult]
```

**Implementation notes**:
- `GET` uses `get_admin_supabase` (service_role bypasses RLS), then app-layer guards: `simulations.status='active' AND deleted_at IS NULL`. 404 otherwise. Pattern: see how `bleed_gazette_router` or `simulation_broadsheets_router` does it.
- Resolve `geometry_sim_id = simulation.source_template_id ?? simulation.id` BEFORE querying cities/zones/streets/buildings. JOIN on `geometry_sim_id` for everything geometric.
- Live overlay source is ALWAYS `simulation.id` (the Instance, even when geometry came from Template). For MVP, fetch `mv_zone_stability` rows for `simulation_id = simulation.id` and merge stability props into the zones FeatureCollection.
- Soft-delete filters: `deleted_at IS NULL` everywhere (cities, zones, streets, buildings).
- Theme hints: small subset of `forge_themes` row — `color_primary`, `color_surface`, `color_border`, `color_danger`, `color_success`, `color_text`, `font_heading`, `font_body`. Frontend uses these as CSS custom property defaults if local theme isn't loaded yet.
- Cache header: `Cache-Control: public, max-age=60`. Include `ETag` keyed by `f"{simulation_id}:{geometry_version}"`.
- `POST /admin/regenerate` uses `require_owner_or_platform_admin()`. Calls `ForgeMapService.generate_map(simulation_id, seed=body.seed, preset=body.preset, forge_draft_id=None)`. Synchronous — operation is ≤30s for Velgarien-scale.
- Audit: log via existing `audit_log` infrastructure (grep `audit_log` for the helper).

**`WorldMapResponse` shape** (write into `backend/models/world_map.py`):
```python
class WorldMapZone(BaseModel):
    id: UUID
    name: str
    name_de: str | None
    zone_type: str
    geojson: dict[str, Any] | None
    # Live overlay (always from instance):
    stability: float | None
    stability_label: str | None
    is_quarantined: bool

class WorldMapBuilding(BaseModel):
    id: UUID
    name: str
    building_type: str
    geojson: dict[str, Any] | None  # GeoJSON Point
    street_id: UUID | None
    zone_id: UUID | None

class WorldMapStreet(BaseModel):
    id: UUID
    name: str | None
    street_type: str | None
    length_km: float | None
    geojson: dict[str, Any] | None  # GeoJSON LineString

class WorldMapCity(BaseModel):
    id: UUID
    name: str
    map_center_lat: float | None
    map_center_lng: float | None
    map_default_zoom: int

class WorldMapAgentMarker(BaseModel):
    agent_id: UUID
    name: str
    home_building_id: UUID | None  # from building_agent_relations(lives_at)

class WorldMapThemeHints(BaseModel):
    color_primary: str | None
    color_surface: str | None
    color_border: str | None
    color_danger: str | None
    color_success: str | None
    color_text: str | None
    font_heading: str | None
    font_body: str | None

class WorldMapResponse(BaseModel):
    simulation_id: UUID
    simulation_slug: str
    is_game_instance: bool
    geometry_source_id: UUID  # = source_template_id ?? id
    geometry_version: int
    cities: list[WorldMapCity]
    zones: list[WorldMapZone]
    streets: list[WorldMapStreet]
    buildings: list[WorldMapBuilding]
    agent_markers: list[WorldMapAgentMarker]
    theme_hints: WorldMapThemeHints
```

**Test plan**:
- `backend/tests/test_world_map_router.py` — anonymous fetch returns full payload for an active sim; archived sim returns 404; Game-Instance fetch returns Template's geometry but Instance's stability values (mock `mv_zone_stability`).
- `backend/tests/test_world_map_admin_router.py` — non-admin gets 403; admin regen bumps version, returns counts.

---

### Phase 5: Frontend Lit component (~1.5 weeks)

**Goal**: A `<velg-simulation-world-map>` component that loads the map JSON and renders it via MapLibre.

**FIRST**: invoke the `velg-frontend-design` skill BEFORE writing any component code. Hard CLAUDE.md rule.

**Files to create**:
- `frontend/src/components/world-map/SimulationWorldMap.ts` (NEW directory — do NOT use `components/map/`, that's the multiverse schematic)
- `frontend/src/services/api/WorldMapApiService.ts` (singleton extending `BaseApiService`)
- `frontend/src/components/world-map/world-map-styles.ts` (MapLibre paint property builders that read CSS custom props)

**Files to edit**:
- Wherever the simulation tab routing lives (grep for routes containing `/v/`) — add a tab/route for the map
- `frontend/package.json` — add `maplibre-gl@^5.0.0` dep (~250KB gzipped, dynamic-imported)

**Implementation rules** (from CLAUDE.md):
- Extends `LitElement`. Uses `@lit/localize` `msg(...)` for all user-facing strings. No em dashes. No LLM-isms.
- **Light DOM render root**: `createRenderRoot() { return this; }` — sidesteps MapLibre + Shadow DOM coordinate issues.
- **Dynamic import**: `const { Map: MapLibreMap } = await import('maplibre-gl')` inside `firstUpdated`. Keeps initial bundle lean.
- All colors via `var(--color-...)` tokens. MapLibre paint properties read computed CSS values from `getComputedStyle(this).getPropertyValue('--color-primary')` and feed them into the paint config.
- API call uses `WorldMapApiService.getMap(slug, mode)` where `mode = appState.currentSimulationMode.value` (per the routing-no-appstate-reads rule).
- All `catch` blocks use `captureError(err, { source: 'SimulationWorldMap.<method>' })` from `services/SentryService.ts`.
- Forbidden CSS on the map container: `filter`, `transform`, `will-change`, `contain: paint`, `perspective` — they break the WebGL canvas. Apply visual effects to leaf elements only.

**MVP rendering scope** (Phase 5, before live overlays):
- Cities → invisible bounding boxes (define map fitBounds)
- Zones → filled polygons with theme colors
- Streets → lines (color/width by `street_type`)
- Buildings → markers (icon by `building_type`, name on hover)
- Agent home markers → dots with name labels at `home_building_id` position (lookup against the buildings layer)
- Pan/zoom controls, sim-switch handling (`map.setStyle(newStyle)` on simulation signal change)

**Velgarien dogfood**: navigate to the map route, verify in browser per CLAUDE.md frontend testing mandate. Test golden path + sim switch + soft-delete handling.

---

### Phase 6: Live overlays (~4-5 days)

**Goal**: Zone stability colors update in real time. (Agent live movement is OUT OF SCOPE for MVP — see "What we deliberately did NOT do" above.)

**Files to edit**:
- `SimulationWorldMap.ts` — subscribe to zone-stability changes via Supabase Realtime
- Possibly extend `WorldMapApiService` to expose a Realtime subscription helper

**Pattern**: existing simulations already subscribe to `mv_zone_stability` via Supabase Realtime in other map-adjacent components (grep `mv_zone_stability` in frontend). Reuse that pattern. Render via MapLibre data-driven `fill-color` paint property keyed on `stability_label`. NO deck.gl needed for MVP — that's only worth it for >10k overlay points.

**Event markers** (optional in Phase 6, can defer):
- High-impact recent events from `events` table → drop a temporary marker at the event's `location` (matched by name to zones)
- Pulse animation, fade after N seconds

---

### Phase 7: Docs + observability (~1 day)

**Files to edit**:
- `CLAUDE.md` — add Frontend section rule:
  - "Never put MapLibre/canvas-heavy components inside Shadow DOM. Use `createRenderRoot() { return this; }` on the host."
  - "Never put new map components in `frontend/src/components/map/` — that's the multiverse schematic. World maps go in `frontend/src/components/world-map/`."
- `CLAUDE.md` — add Backend section rule (if not covered by existing Postgres-first guidance):
  - "Geometry generation: Python (shapely). Geometry persistence: Postgres (`fn_apply_map_geometry`). Never UPDATE/INSERT/DELETE geometry tables from Python directly."
- `docs/INDEX.md` — add a Plans section (currently absent — see audit) and link the per-sim-world-map plan + this handover
- Consider Sentry alerting rule on `forge_drafts.map_status='failed'` rate (the `feedback_postgres_first.md` memory implies this should exist if failures spike)

---

## 4. Where to start in the next session

1. Read `docs/plans/per-simulation-world-map-plan.md` — the full spec
2. Read THIS handover for the post-plan state
3. Skim the two memory files (`project_per_sim_map_template_geometry.md`, `feedback_postgres_first.md`)
4. **Default**: start Phase 4 (API). It's the smallest remaining piece and unblocks frontend work.
5. **Alternative**: if user wants to validate generator end-to-end first, run the migrations locally + write a one-shot script (`scripts/regenerate_velgarien_map.py`) that calls `ForgeMapService.generate_map(velgarien_id)` and inspects the DB output. That's a useful confidence-builder before investing in API + frontend.

---

## 5. Verification / smoke tests

Before declaring any phase done:

| Phase | Quick check |
|---|---|
| 4 | `curl http://localhost:8000/api/v1/public/simulations/velgarien/map | jq .data.zones[].name` returns the 3 Velgarien zones; `curl` from a logged-out browser session returns 200 not 403 |
| 5 | Browser at `/v/velgarien/world-map`: pan/zoom works, zones colored, building markers labeled, console clean |
| 6 | Trigger a high-impact event admin-side; the affected zone color shifts within 2s |
| 7 | `lint-color-tokens.sh`, `tsc`, `ruff check`, `pytest` all pass; INDEX.md links resolve |

---

## 6. Open questions / risks (low priority but worth knowing)

- **Velgarien has 2 cities** (`Velgarien-Stadt` 850k, `Hafenstadt Korrin` 320k). The current `_build_city_patch` tiles them horizontally — fine for MVP. Korrin is described as a "port"; long-term we want the `coastal_port` preset. Defer to "second preset" follow-up.
- **Voronoi at N=3 is wasted sophistication** (review caught this). Current code uses direct quadrant assignment for N≤4 — correct path. Don't introduce Voronoi-for-3.
- **Bundle size budget**: if MapLibre bundle pushes the Velgarien page over the existing budget, the dynamic import is the lever — confirm the chunk shows up in `dist/assets/maplibre-*.js` not the main bundle.
- **i18n for street names**: the generator currently leaves `name=NULL`. The Velgarien naming bank (Phase 2 plan) was deferred to later. Frontend should hide nameless streets from labels but still render their geometry.
- **Game-instance map cleanup**: when an epoch is deleted (`delete_epoch_instances`), instance rows are dropped — geometry on the Template is untouched. ✓ correct under Decision A. No extra cleanup needed.

---

## 7. Reference files

- Plan spec: `docs/plans/per-simulation-world-map-plan.md`
- Project memories: `~/.claude/projects/-home-mleihs-dev-metaverse-center/memory/project_per_sim_map_template_geometry.md`, `~/.claude/projects/-home-mleihs-dev-metaverse-center/memory/feedback_postgres_first.md`
- Existing public-endpoint pattern: `supabase/migrations/20260306144504_065c_bleed_gazette.sql`, `supabase/migrations/20260409200500_186b_simulation_broadsheets.sql`
- Existing RPC call pattern: `backend/services/game_instance_service.py:45+`
- Existing forge sibling services: `backend/services/forge_lore_service.py`, `forge_theme_service.py`, `forge_image_service.py`
- Multiverse map (different feature, do NOT extend): `frontend/src/components/map/CartographicMap.ts`
- Velgarien seed reference: `supabase/migrations/20260228150000_027b_velgarien_cities_zones.sql`
