-- Migration 198: Fix trg_ach_forge referencing non-existent columns.
--
-- The trigger referenced NEW.data_source and NEW.created_by_id which do not
-- exist on the simulations table (columns are owner_id, simulation_type).
-- This caused:
--   ERROR: record "new" has no field "data_source" (SQLSTATE 42703)
--
-- Fix: use owner_id (the simulation creator) instead. Every forge-created
-- simulation has owner_id set by fn_materialize_shard.

CREATE OR REPLACE FUNCTION trg_ach_forge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.owner_id IS NOT NULL THEN
        PERFORM fn_award_achievement(NEW.owner_id, 'forgemaster',
            jsonb_build_object('simulation_id', NEW.id::text));
    END IF;
    RETURN NEW;
END;
$$;
