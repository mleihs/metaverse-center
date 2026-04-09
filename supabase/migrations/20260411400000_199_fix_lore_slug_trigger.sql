-- Migration 199: Drop broken trg_lore_auto_slug trigger.
--
-- fn_auto_entity_slug references NEW.name, but simulation_lore has 'title'
-- not 'name'. This trigger should never have been on simulation_lore —
-- lore slugs are handled separately in migration 138.
-- The trigger caused:
--   ERROR: record "new" has no field "name" (SQLSTATE 42703)
-- on every INSERT into simulation_lore (including forge materialization).

DROP TRIGGER IF EXISTS trg_lore_auto_slug ON simulation_lore;
