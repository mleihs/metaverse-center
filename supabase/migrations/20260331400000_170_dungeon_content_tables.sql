-- ============================================================================
-- Migration 170: Dungeon Content Tables
-- ============================================================================
-- Moves dungeon content from hardcoded Python files to DB tables.
-- All content is publicly readable (game content, not sensitive).
-- All mutations via service_role (admin CRUD endpoints).
--
-- FK chain: choices -> encounters -> spawn_configs -> enemy_templates
-- 10 tables, ~556 rows total across 4 archetypes.
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 1: dungeon_banter (~186 rows)
-- Archetype-specific between-encounter dialogue templates.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_banter (
    id                  TEXT PRIMARY KEY,
    archetype           TEXT NOT NULL,
    trigger             TEXT NOT NULL,
    personality_filter  JSONB NOT NULL DEFAULT '{}',
    text_en             TEXT NOT NULL,
    text_de             TEXT NOT NULL,
    decay_tier          INT,
    attachment_tier     INT,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banter_arch_trigger ON dungeon_banter(archetype, trigger);

-- RLS: public-readable content
ALTER TABLE dungeon_banter ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_banter_public_read ON dungeon_banter
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 2: dungeon_enemy_templates (~19 rows)
-- Enemy type definitions with stats, abilities, and bilingual text.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_enemy_templates (
    id                  TEXT PRIMARY KEY,
    archetype           TEXT NOT NULL,
    name_en             TEXT NOT NULL,
    name_de             TEXT NOT NULL,
    condition_threshold INT NOT NULL,
    stress_resistance   INT NOT NULL DEFAULT 0,
    threat_level        TEXT NOT NULL DEFAULT 'standard'
                        CHECK (threat_level IN ('minion', 'standard', 'elite', 'boss')),
    attack_aptitude     TEXT NOT NULL,
    attack_power        INT NOT NULL,
    stress_attack_power INT NOT NULL,
    telegraphed_intent  BOOLEAN NOT NULL DEFAULT true,
    evasion             INT NOT NULL DEFAULT 0,
    resistances         TEXT[] NOT NULL DEFAULT '{}',
    vulnerabilities     TEXT[] NOT NULL DEFAULT '{}',
    action_weights      JSONB NOT NULL DEFAULT '{}',
    special_abilities   TEXT[] NOT NULL DEFAULT '{}',
    description_en      TEXT NOT NULL DEFAULT '',
    description_de      TEXT NOT NULL DEFAULT '',
    ambient_text_en     TEXT[] NOT NULL DEFAULT '{}',
    ambient_text_de     TEXT[] NOT NULL DEFAULT '{}',
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enemy_arch ON dungeon_enemy_templates(archetype);

ALTER TABLE dungeon_enemy_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_enemy_templates_public_read ON dungeon_enemy_templates
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 3: dungeon_spawn_configs (~24 rows)
-- Maps combat encounter IDs to enemy spawn lists.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_spawn_configs (
    id          TEXT PRIMARY KEY,
    archetype   TEXT NOT NULL,
    entries     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_spawn_arch ON dungeon_spawn_configs(archetype);

ALTER TABLE dungeon_spawn_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_spawn_configs_public_read ON dungeon_spawn_configs
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 4: dungeon_encounter_templates (~62 rows)
-- Encounter definitions (combat, narrative, rest, treasure, boss).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_encounter_templates (
    id                  TEXT PRIMARY KEY,
    archetype           TEXT NOT NULL,
    room_type           TEXT NOT NULL,
    min_depth           INT NOT NULL DEFAULT 0,
    max_depth           INT NOT NULL DEFAULT 99,
    min_difficulty      INT NOT NULL DEFAULT 1,
    requires_aptitude   JSONB,
    description_en      TEXT NOT NULL DEFAULT '',
    description_de      TEXT NOT NULL DEFAULT '',
    combat_encounter_id TEXT REFERENCES dungeon_spawn_configs(id),
    is_ambush           BOOLEAN NOT NULL DEFAULT false,
    ambush_stress       INT NOT NULL DEFAULT 0,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_encounter_arch_room ON dungeon_encounter_templates(archetype, room_type);

ALTER TABLE dungeon_encounter_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_encounter_templates_public_read ON dungeon_encounter_templates
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 5: dungeon_encounter_choices (~118 rows)
-- Choices within encounters. Composite PK (encounter_id, id) because
-- choice IDs like "investigate" are only unique within their parent.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_encounter_choices (
    id                   TEXT NOT NULL,
    encounter_id         TEXT NOT NULL REFERENCES dungeon_encounter_templates(id) ON DELETE CASCADE,
    label_en             TEXT NOT NULL,
    label_de             TEXT NOT NULL,
    requires_aptitude    JSONB,
    requires_profession  TEXT,
    check_aptitude       TEXT,
    check_difficulty     INT NOT NULL DEFAULT 0,
    success_effects      JSONB NOT NULL DEFAULT '{}',
    partial_effects      JSONB NOT NULL DEFAULT '{}',
    fail_effects         JSONB NOT NULL DEFAULT '{}',
    success_narrative_en TEXT NOT NULL DEFAULT '',
    success_narrative_de TEXT NOT NULL DEFAULT '',
    partial_narrative_en TEXT NOT NULL DEFAULT '',
    partial_narrative_de TEXT NOT NULL DEFAULT '',
    fail_narrative_en    TEXT NOT NULL DEFAULT '',
    fail_narrative_de    TEXT NOT NULL DEFAULT '',
    sort_order           INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (encounter_id, id)
);

ALTER TABLE dungeon_encounter_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_encounter_choices_public_read ON dungeon_encounter_choices
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 6: dungeon_loot_items (~60 rows)
-- 3-tier loot system for all archetypes.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_loot_items (
    id              TEXT PRIMARY KEY,
    archetype       TEXT NOT NULL,
    tier            INT NOT NULL CHECK (tier BETWEEN 1 AND 3),
    name_en         TEXT NOT NULL,
    name_de         TEXT NOT NULL,
    effect_type     TEXT NOT NULL,
    effect_params   JSONB NOT NULL DEFAULT '{}',
    description_en  TEXT NOT NULL DEFAULT '',
    description_de  TEXT NOT NULL DEFAULT '',
    drop_weight     INT NOT NULL DEFAULT 10,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loot_arch_tier ON dungeon_loot_items(archetype, tier);

ALTER TABLE dungeon_loot_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_loot_items_public_read ON dungeon_loot_items
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 7: dungeon_anchor_objects (~32 rows)
-- Objektanker — wandering objects with 4 phases (discovery/echo/mutation/climax).
-- Phases stored as JSONB (rigid schema, always loaded as unit).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_anchor_objects (
    id          TEXT NOT NULL,
    archetype   TEXT NOT NULL,
    phases      JSONB NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (archetype, id)
);

ALTER TABLE dungeon_anchor_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_anchor_objects_public_read ON dungeon_anchor_objects
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 8: dungeon_entrance_texts (~20 rows)
-- Per-archetype atmosphere texts displayed on dungeon entry.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_entrance_texts (
    id          SERIAL PRIMARY KEY,
    archetype   TEXT NOT NULL,
    text_en     TEXT NOT NULL,
    text_de     TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (archetype, sort_order)
);

CREATE INDEX idx_entrance_arch ON dungeon_entrance_texts(archetype);

ALTER TABLE dungeon_entrance_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_entrance_texts_public_read ON dungeon_entrance_texts
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 9: dungeon_barometer_texts (~16 rows)
-- Resonance barometer prose — displayed on archetype state tier changes.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dungeon_barometer_texts (
    id          SERIAL PRIMARY KEY,
    archetype   TEXT NOT NULL,
    tier        INT NOT NULL CHECK (tier BETWEEN 0 AND 3),
    text_en     TEXT NOT NULL,
    text_de     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (archetype, tier)
);

ALTER TABLE dungeon_barometer_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dungeon_barometer_texts_public_read ON dungeon_barometer_texts
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- Table 10: combat_abilities (~19 rows)
-- Ability definitions for the shared combat system (dungeon + future War Room).
-- Named combat_* because it lives in backend/services/combat/, not dungeon-specific.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS combat_abilities (
    id              TEXT PRIMARY KEY,
    school          TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_de         TEXT NOT NULL,
    description_en  TEXT NOT NULL DEFAULT '',
    description_de  TEXT NOT NULL DEFAULT '',
    min_aptitude    INT NOT NULL DEFAULT 3,
    cooldown        INT NOT NULL DEFAULT 0,
    effect_type     TEXT NOT NULL DEFAULT 'damage',
    effect_params   JSONB NOT NULL DEFAULT '{}',
    is_ultimate     BOOLEAN NOT NULL DEFAULT false,
    targets         TEXT NOT NULL DEFAULT 'single_enemy'
                    CHECK (targets IN (
                        'single_enemy', 'all_enemies',
                        'single_ally', 'all_allies', 'self'
                    )),
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_abilities_school ON combat_abilities(school);

ALTER TABLE combat_abilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY combat_abilities_public_read ON combat_abilities
    FOR SELECT USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- updated_at triggers — reuses existing public.set_updated_at() from migration 007
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_dungeon_banter_updated_at
    BEFORE UPDATE ON dungeon_banter
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_enemy_templates_updated_at
    BEFORE UPDATE ON dungeon_enemy_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_spawn_configs_updated_at
    BEFORE UPDATE ON dungeon_spawn_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_encounter_templates_updated_at
    BEFORE UPDATE ON dungeon_encounter_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_encounter_choices_updated_at
    BEFORE UPDATE ON dungeon_encounter_choices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_loot_items_updated_at
    BEFORE UPDATE ON dungeon_loot_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_anchor_objects_updated_at
    BEFORE UPDATE ON dungeon_anchor_objects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_entrance_texts_updated_at
    BEFORE UPDATE ON dungeon_entrance_texts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_dungeon_barometer_texts_updated_at
    BEFORE UPDATE ON dungeon_barometer_texts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_combat_abilities_updated_at
    BEFORE UPDATE ON combat_abilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
