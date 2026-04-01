-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 172: Dungeon content table hardening
--
-- H4: Add ON DELETE RESTRICT to encounter_templates.combat_encounter_id FK.
--     Prevents orphaned encounter references when a spawn config is deleted.
--
-- H5: Add index on dungeon_encounter_choices(encounter_id).
--     The composite PK (encounter_id, id) covers this in theory, but an
--     explicit single-column index is clearer and guarantees FK lookup perf.
--
-- H11 (M11): Add composite index on resonance_dungeon_events(simulation_id, created_at)
--     for efficient event log queries filtered by simulation + time range.
-- ══════════════════════════════════════════════════════════════════════════════

-- H4: Replace FK without ON DELETE → ON DELETE RESTRICT
ALTER TABLE dungeon_encounter_templates
    DROP CONSTRAINT IF EXISTS dungeon_encounter_templates_combat_encounter_id_fkey;

ALTER TABLE dungeon_encounter_templates
    ADD CONSTRAINT dungeon_encounter_templates_combat_encounter_id_fkey
    FOREIGN KEY (combat_encounter_id) REFERENCES dungeon_spawn_configs(id)
    ON DELETE RESTRICT;

-- H5: Index on encounter_choices(encounter_id) for FK lookups
CREATE INDEX IF NOT EXISTS idx_encounter_choices_encounter_id
    ON dungeon_encounter_choices(encounter_id);

-- M11: Composite index for event log queries
CREATE INDEX IF NOT EXISTS idx_dungeon_events_sim_created
    ON resonance_dungeon_events(simulation_id, created_at);
