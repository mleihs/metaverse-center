-- ============================================================================
-- Migration 235: Per-Simulation World Map — schema foundation
--
-- WHY: Each simulation needs a navigable OSM-style map of its locations. The
-- geography tables (cities, zones, city_streets, buildings) already exist with
-- geojson jsonb columns, but zone polygons have no storage and the simulation
-- has no determinism/preset config for a map generator.
--
-- WHAT (one new geometry column, three sim-level config columns, one Forge
-- draft state column):
--   1. zones.geojson jsonb — polygon storage (GeoJSON Polygon Feature)
--   2. simulations.map_seed text — deterministic generator seed
--   3. simulations.map_generator_preset text — algorithm key (free text)
--   4. simulations.map_geometry_version int — bumps on regeneration (cache key)
--   5. forge_drafts.map_status text — ignition step status (pending/…/failed)
--
-- LOCKED ARCHITECTURAL DECISIONS (do not violate without the team's review):
--   * Map geometry lives at the TEMPLATE simulation. Game-Instances inherit it
--     via JOIN on source_template_id. The clone_simulations_for_epoch function
--     intentionally does NOT copy map fields — Instances should leave them NULL
--     and the API resolves geometry through COALESCE(source_template_id, id).
--     See docs/plans/per-simulation-world-map-plan.md and the project memory
--     `project_per_sim_map_template_geometry.md`.
--   * Live overlays (zone stability, events, agent positions) come from the
--     INSTANCE, not the Template. The single map endpoint joins both sources.
--   * No PostGIS — jsonb is the established convention (forge_drafts.geography).
--   * map_generator_preset has NO CHECK constraint by design — Pydantic Literal
--     at the API layer validates allowed values; new presets ship without a
--     migration.
--   * Agent home positions use the convention building_agent_relations
--     .relation_type='lives_at'. relation_type is free text (migration 004),
--     so introducing this value is zero-migration.
--
-- VIEWS NOT REFRESHED (justified):
--   * active_simulations was dropped in migration 196 — nothing to refresh.
--   * simulation_dashboard and map_simulations use EXPLICIT column lists
--     (migration 217). New columns are not consumed by those views' callers,
--     so leaving them out is safe and avoids unnecessary view churn.
-- ============================================================================


-- 1. zones polygon
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS geojson jsonb;

COMMENT ON COLUMN public.zones.geojson IS
  'GeoJSON Polygon for the zone boundary. Populated by ForgeMapService at '
  'ignition. Game-Instances leave this NULL and inherit via the JOIN on '
  'source_template_id at the API layer. shapely.contains(zone, building_point) '
  'invariant enforced by the generator.';


-- 2. simulation-level map config
ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS map_seed text,
  ADD COLUMN IF NOT EXISTS map_generator_preset text,
  ADD COLUMN IF NOT EXISTS map_geometry_version int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.simulations.map_seed IS
  'Deterministic seed for map generation. Set once at ignition (defaults to '
  'simulations.id::text inside ForgeMapService when NULL). NULL on '
  'Game-Instances — they inherit geometry from source_template_id. PYTHONHASHSEED '
  'is pinned in the generator to keep set/dict iteration deterministic.';

COMMENT ON COLUMN public.simulations.map_generator_preset IS
  'Generator algorithm key. Examples: "medieval_walled", "modern_grid", '
  '"radial_capital", "coastal_port", "underground_station". Free text — '
  'validated as Pydantic Literal at the API layer to avoid migrations on new '
  'presets. NULL means "auto-derive from simulations.theme via the generator''s '
  'theme→preset map".';

COMMENT ON COLUMN public.simulations.map_geometry_version IS
  'Monotonic counter, bumped by ForgeMapService on every successful '
  'regeneration. Frontend uses this as a cache key — combined with the '
  'simulation id, identical (id, version) means identical geometry. Starts at '
  '0 (no map yet); first generation produces version=1.';


-- 3. forge_drafts state for the ignition map-gen step
ALTER TABLE public.forge_drafts
  ADD COLUMN IF NOT EXISTS map_status text NOT NULL DEFAULT 'pending'
    CHECK (map_status IN ('pending', 'generating', 'succeeded', 'failed'));

COMMENT ON COLUMN public.forge_drafts.map_status IS
  'Status of the post-materialization world-map generation step. The map step '
  'runs after _generate_lore_and_translations during ignition. Failure here '
  'does NOT fail ignition — the simulation comes online without a map; admins '
  'recover via POST /api/v1/admin/simulations/{id}/map/regenerate.';


-- 4. NO new RLS policies — geometry tables (zones/cities/city_streets/buildings)
-- keep their existing SELECT policies (user_has_simulation_access). The public
-- map endpoint goes through service_role + app-layer status check, mirroring
-- the established /api/v1/public/* pattern (bleed_gazette, broadsheets).
