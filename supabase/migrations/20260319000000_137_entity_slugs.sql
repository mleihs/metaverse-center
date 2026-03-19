-- 137: Entity Slugs for Agents & Buildings
--
-- Adds slug columns to agents and buildings tables for SEO-friendly URLs.
-- Slugs are UNIQUE per simulation (composite unique constraint).
-- Auto-generated via BEFORE INSERT trigger with collision handling.

-- 1. Reusable slug generator function
CREATE OR REPLACE FUNCTION public.fn_generate_entity_slug(
    p_name text,
    p_simulation_id uuid,
    p_table_name text
) RETURNS text AS $$
DECLARE
    v_slug_base text;
    v_slug text;
    v_counter int := 0;
    v_exists boolean;
BEGIN
    -- Slugify: lowercase, replace non-alphanumeric with hyphens, trim, truncate
    v_slug_base := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(BOTH '-' FROM v_slug_base);
    v_slug_base := left(v_slug_base, 80);  -- leave room for collision suffix

    IF v_slug_base = '' THEN
        v_slug_base := 'entity';
    END IF;

    v_slug := v_slug_base;

    LOOP
        EXECUTE format(
            'SELECT EXISTS(SELECT 1 FROM public.%I WHERE simulation_id = $1 AND slug = $2)',
            p_table_name
        ) INTO v_exists USING p_simulation_id, v_slug;

        EXIT WHEN NOT v_exists;
        v_counter := v_counter + 1;
        v_slug := v_slug_base || '-' || v_counter;
    END LOOP;

    RETURN v_slug;
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. Add slug column to agents (nullable initially for backfill)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS slug text;

-- 3. Add slug column to buildings (nullable initially for backfill)
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS slug text;


-- 4. Backfill existing agents
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, name, simulation_id
        FROM public.agents
        WHERE slug IS NULL
        ORDER BY simulation_id, name
    LOOP
        UPDATE public.agents
        SET slug = public.fn_generate_entity_slug(r.name, r.simulation_id, 'agents')
        WHERE id = r.id;
    END LOOP;
END $$;

-- 5. Backfill existing buildings
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, name, simulation_id
        FROM public.buildings
        WHERE slug IS NULL
        ORDER BY simulation_id, name
    LOOP
        UPDATE public.buildings
        SET slug = public.fn_generate_entity_slug(r.name, r.simulation_id, 'buildings')
        WHERE id = r.id;
    END LOOP;
END $$;


-- 6. Add NOT NULL constraint and composite unique constraint
ALTER TABLE public.agents
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT uq_agents_simulation_slug UNIQUE (simulation_id, slug);

ALTER TABLE public.buildings
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT uq_buildings_simulation_slug UNIQUE (simulation_id, slug);


-- 7. Indexes for slug lookups (covered by unique constraint, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_agents_sim_slug ON public.agents (simulation_id, slug);
CREATE INDEX IF NOT EXISTS idx_buildings_sim_slug ON public.buildings (simulation_id, slug);


-- 8. Auto-generate slug on INSERT trigger
CREATE OR REPLACE FUNCTION public.fn_auto_entity_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.fn_generate_entity_slug(NEW.name, NEW.simulation_id, TG_TABLE_NAME);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agents_auto_slug
    BEFORE INSERT ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_entity_slug();

CREATE TRIGGER trg_buildings_auto_slug
    BEFORE INSERT ON public.buildings
    FOR EACH ROW EXECUTE FUNCTION public.fn_auto_entity_slug();


-- 9. Slug immutability trigger (same pattern as simulations)
CREATE TRIGGER trg_agents_slug_immutable
    BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.immutable_slug();

CREATE TRIGGER trg_buildings_slug_immutable
    BEFORE UPDATE ON public.buildings
    FOR EACH ROW EXECUTE FUNCTION public.immutable_slug();


-- 10. Refresh active views to pick up new slug column
-- PostgreSQL expands SELECT * at view creation time, not query time.
CREATE OR REPLACE VIEW public.active_agents AS
    SELECT * FROM agents WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_buildings AS
    SELECT * FROM buildings WHERE deleted_at IS NULL;
