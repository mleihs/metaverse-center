-- 059: Forge lore, theme config, and generation config
-- Adds simulation_lore table for AI-generated narrative content,
-- plus generation_config and theme_config columns on forge_drafts.

-- ── simulation_lore table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.simulation_lore (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    chapter text NOT NULL,
    arcanum text NOT NULL,
    title text NOT NULL,
    epigraph text NOT NULL DEFAULT '',
    body text NOT NULL,
    image_slug text,
    image_caption text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_lore_sim
    ON public.simulation_lore(simulation_id, sort_order);

COMMENT ON TABLE public.simulation_lore IS
    'AI-generated narrative lore sections for forged simulations.';

-- RLS: public read (follows public-first architecture)
ALTER TABLE public.simulation_lore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulation_lore_public_read"
    ON public.simulation_lore FOR SELECT
    USING (true);

CREATE POLICY "simulation_lore_service_write"
    ON public.simulation_lore FOR ALL
    USING (
        (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    )
    WITH CHECK (
        (SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    );


-- ── forge_drafts: generation_config + theme_config ───────────────────

ALTER TABLE public.forge_drafts
    ADD COLUMN IF NOT EXISTS generation_config jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS theme_config jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.forge_drafts.generation_config IS
    'User-chosen entity counts: agent_count, building_count, zone_count, street_count';
COMMENT ON COLUMN public.forge_drafts.theme_config IS
    'AI-generated + user-customized theme settings (~40 keys). Applied to simulation_settings on materialization.';
