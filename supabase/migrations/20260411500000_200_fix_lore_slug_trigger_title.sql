-- Migration 200: Replace broken lore slug trigger with title-based version.
--
-- Migration 199 dropped trg_lore_auto_slug because fn_auto_entity_slug
-- used NEW.name which doesn't exist on simulation_lore (it has 'title').
-- But dropping the trigger entirely broke lore INSERT because slug is
-- NOT NULL without a default — every persist_lore() call failed silently.
--
-- Fix: dedicated fn_lore_auto_slug() that uses NEW.title instead of
-- NEW.name, restoring auto-slug generation for lore sections.

CREATE OR REPLACE FUNCTION fn_lore_auto_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.fn_generate_entity_slug(NEW.title, NEW.simulation_id, TG_TABLE_NAME);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lore_auto_slug
    BEFORE INSERT ON simulation_lore
    FOR EACH ROW EXECUTE FUNCTION fn_lore_auto_slug();
