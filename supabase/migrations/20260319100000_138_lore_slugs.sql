-- 138: Lore Section Slugs
--
-- Adds slug column to simulation_lore for SEO-friendly chapter URLs.
-- Uses the same auto-generation infrastructure from migration 137.

-- 1. Add slug column (nullable for backfill)
ALTER TABLE public.simulation_lore ADD COLUMN IF NOT EXISTS slug text;

-- 2. Backfill existing lore sections
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, title, simulation_id
        FROM public.simulation_lore
        WHERE slug IS NULL
        ORDER BY simulation_id, sort_order
    LOOP
        UPDATE public.simulation_lore
        SET slug = public.fn_generate_entity_slug(r.title, r.simulation_id, 'simulation_lore')
        WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Add NOT NULL + unique constraint
ALTER TABLE public.simulation_lore
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT uq_lore_simulation_slug UNIQUE (simulation_id, slug);

-- 4. Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_lore_sim_slug ON public.simulation_lore (simulation_id, slug);

-- 5. Auto-generate slug on INSERT
CREATE TRIGGER trg_lore_auto_slug
    BEFORE INSERT ON public.simulation_lore
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_entity_slug();

-- 6. Slug immutability
CREATE TRIGGER trg_lore_slug_immutable
    BEFORE UPDATE ON public.simulation_lore
    FOR EACH ROW EXECUTE FUNCTION public.immutable_slug();
