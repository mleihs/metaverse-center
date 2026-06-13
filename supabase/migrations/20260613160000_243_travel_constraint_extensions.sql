-- Migration 243: DRIFT — travel_constraint_extensions (P0a platform-side wiring)
--
-- Spec: docs/plans/drift-implementation-plan.md §3.5 (the consolidated constraint
--       package), concept §17. Design contract: drift-…-concept.md v0.4.
--
-- Fifth DRIFT P0a migration. UNLIKE 239–242 (which created net-new tables), this
-- one ALTERs SIX existing platform tables so the travel system can slot into the
-- journal / memory / attunement / achievement / building / chronicle subsystems
-- it reuses. Each change is additive (a new enum value, a widened CHECK, a new
-- column) — no existing value or row is removed. Behind drift_p0_enabled=false
-- (seeded in 239) — no runtime change.
--
-- The six changes:
--   1. journal_fragments.source_type CHECK += 'travel', and fragment_type CHECK
--      += 'journey'. A travel fragment is neither dungeon- nor bond-shaped, so it
--      gets its OWN fragment_type ('journey'), not a reused 'resonance'/existing
--      kind (plan §3.5.1 — the journal UI gains one new icon). NB: CHECKs are not
--      additive in Postgres — each is DROPped and re-ADDed with the full widened
--      value list (current lists captured from the live catalog, not guessed).
--   2. memory_source_type ENUM += 'travel' (agents remember a Träger's visit via
--      the existing memory pipeline). See the ENUM caveat below.
--   3. journal_attunements.system_hook CHECK += 'travel_option'.
--   4. achievement_definitions.category CHECK += 'travel'.
--   5. buildings.sanctuary boolean (sanctuaries lower Dissonanz — concept §8.4),
--      + active_buildings view CREATE OR REPLACE in THIS migration (CLAUDE.md view
--      rule: buildings is one of the 4 view-coupled tables) so the column surfaces
--      to travel code reading through the view, + seed: Chapel of Silence = sanctuary.
--   6. simulation_chronicles.mentions jsonb DEFAULT '[]' — structured Träger
--      credits the chronicle prompt template reads (P0d, §19.5).
--
-- ── ENUM ADD VALUE caveat (plan §3.5.2) ───────────────────────────────────────
-- Postgres 12+ (server is 17.6) permits `ALTER TYPE … ADD VALUE` inside a
-- transaction block; the only restriction is that the new label may not be USED
-- in the SAME transaction. This migration only ADDs 'travel' (no INSERT/CHECK in
-- 243 references it), so it is transaction-safe both under the supabase migration
-- runner and under the BEGIN/ROLLBACK validation harness. House precedent:
-- migration 144 (`ALTER TYPE resonance_impact_status ADD VALUE IF NOT EXISTS …`),
-- applied in production. IF NOT EXISTS keeps it idempotent.
--
-- Active-view refresh: active_buildings (item 5) — the ONLY view touched (the other
-- five tables are not column-coupled to an active_* view). active_buildings uses an
-- explicit column list (not SELECT *), so the new column is appended at the end;
-- every pre-existing column keeps its name/type/order (CREATE OR REPLACE contract).


-- ═══════════════════════════════════════════════════════════════════
-- 1. journal_fragments — source_type += 'travel', fragment_type += 'journey'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE journal_fragments DROP CONSTRAINT IF EXISTS journal_fragments_source_type_check;
ALTER TABLE journal_fragments ADD CONSTRAINT journal_fragments_source_type_check
    CHECK (source_type = ANY (ARRAY[
        'dungeon', 'epoch', 'simulation', 'bond', 'achievement', 'bleed',
        'travel'  -- DRIFT: a journey fragment
    ]::text[]));

ALTER TABLE journal_fragments DROP CONSTRAINT IF EXISTS journal_fragments_fragment_type_check;
ALTER TABLE journal_fragments ADD CONSTRAINT journal_fragments_fragment_type_check
    CHECK (fragment_type = ANY (ARRAY[
        'imprint', 'signature', 'echo', 'impression', 'mark', 'tremor',
        'journey'  -- DRIFT: travel-shaped, distinct from dungeon/bond fragment kinds
    ]::text[]));


-- ═══════════════════════════════════════════════════════════════════
-- 2. memory_source_type ENUM += 'travel' (see header caveat)
-- ═══════════════════════════════════════════════════════════════════

ALTER TYPE memory_source_type ADD VALUE IF NOT EXISTS 'travel';


-- ═══════════════════════════════════════════════════════════════════
-- 3. journal_attunements.system_hook += 'travel_option'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE journal_attunements DROP CONSTRAINT IF EXISTS journal_attunements_system_hook_check;
ALTER TABLE journal_attunements ADD CONSTRAINT journal_attunements_system_hook_check
    CHECK (system_hook = ANY (ARRAY[
        'dungeon_option', 'epoch_option', 'simulation_option',
        'travel_option'  -- DRIFT: an attunement that unlocks a travel option
    ]::text[]));


-- ═══════════════════════════════════════════════════════════════════
-- 4. achievement_definitions.category += 'travel'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_category_check;
ALTER TABLE achievement_definitions ADD CONSTRAINT achievement_definitions_category_check
    CHECK (category = ANY (ARRAY[
        'initiation', 'dungeon', 'epoch', 'collection', 'social', 'challenge', 'secret',
        'travel'  -- DRIFT: travel achievements
    ]::text[]));


-- ═══════════════════════════════════════════════════════════════════
-- 5. buildings.sanctuary + active_buildings view refresh + Chapel seed
-- ═══════════════════════════════════════════════════════════════════
-- Sanctuaries lower Dissonanz (concept §8.4). The column is added first, the
-- view is refreshed to surface it (CLAUDE.md rule), then the canonical Chapel of
-- Silence is flagged. The UPDATE matches by name and is a safe no-op in any
-- environment lacking that building.

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS sanctuary BOOLEAN NOT NULL DEFAULT FALSE;

-- active_buildings: reproduce the exact current column list + append sanctuary.
-- (Pre-existing columns keep name/type/order — CREATE OR REPLACE VIEW contract.)
CREATE OR REPLACE VIEW active_buildings AS
    SELECT id,
           simulation_id,
           name,
           building_type,
           description,
           style,
           location,
           city_id,
           zone_id,
           street_id,
           address,
           population_capacity,
           construction_year,
           building_condition,
           geojson,
           image_url,
           image_prompt_text,
           special_type,
           special_attributes,
           data_source,
           created_at,
           updated_at,
           deleted_at,
           search_vector,
           description_de,
           building_type_de,
           building_condition_de,
           style_reference_url,
           slug,
           sanctuary
      FROM buildings
     WHERE deleted_at IS NULL;

-- Seed: the Chapel of Silence is a sanctuary (a place to shed Dissonanz). No-op
-- where the building is absent.
UPDATE buildings SET sanctuary = TRUE WHERE name = 'Chapel of Silence';


-- ═══════════════════════════════════════════════════════════════════
-- 6. simulation_chronicles.mentions jsonb DEFAULT '[]'
-- ═══════════════════════════════════════════════════════════════════
-- Structured Träger credits ([{kind, id, …}]) the chronicle prompt template reads
-- to weave visiting travelers into a simulation's chronicle (P0d, §19.5).

ALTER TABLE simulation_chronicles
    ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ═══════════════════════════════════════════════════════════════════
-- 7. Column comments (new columns only)
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON COLUMN buildings.sanctuary IS
    'DRIFT (migration 243): a sanctuary building lowers a visiting Träger''s Dissonanz (concept §8.4). Surfaced via active_buildings. Seeded true for the Chapel of Silence.';

COMMENT ON COLUMN simulation_chronicles.mentions IS
    'DRIFT (migration 243): structured Träger credits ([{kind, id, …}]) woven into the chronicle by the prompt template (plan §19.5). Defaults to an empty array.';
