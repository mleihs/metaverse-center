-- Fix foreign key constraints that block simulation hard-delete.
--
-- battle_log: SET NULL — preserve log entries for historical context,
--   null out the reference to the deleted simulation.
-- event_echoes: CASCADE — echoes are meaningless without both sides
--   (columns are NOT NULL, so SET NULL is not possible).

-- ── battle_log ──────────────────────────────────────────────────────

ALTER TABLE battle_log
  DROP CONSTRAINT IF EXISTS battle_log_source_simulation_id_fkey;

ALTER TABLE battle_log
  ADD CONSTRAINT battle_log_source_simulation_id_fkey
    FOREIGN KEY (source_simulation_id) REFERENCES simulations(id)
    ON DELETE SET NULL;

ALTER TABLE battle_log
  DROP CONSTRAINT IF EXISTS battle_log_target_simulation_id_fkey;

ALTER TABLE battle_log
  ADD CONSTRAINT battle_log_target_simulation_id_fkey
    FOREIGN KEY (target_simulation_id) REFERENCES simulations(id)
    ON DELETE SET NULL;

-- ── event_echoes ────────────────────────────────────────────────────

ALTER TABLE event_echoes
  DROP CONSTRAINT IF EXISTS event_echoes_source_simulation_id_fkey;

ALTER TABLE event_echoes
  ADD CONSTRAINT event_echoes_source_simulation_id_fkey
    FOREIGN KEY (source_simulation_id) REFERENCES simulations(id)
    ON DELETE CASCADE;

ALTER TABLE event_echoes
  DROP CONSTRAINT IF EXISTS event_echoes_target_simulation_id_fkey;

ALTER TABLE event_echoes
  ADD CONSTRAINT event_echoes_target_simulation_id_fkey
    FOREIGN KEY (target_simulation_id) REFERENCES simulations(id)
    ON DELETE CASCADE;
