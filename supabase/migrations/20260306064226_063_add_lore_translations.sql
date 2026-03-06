-- 063: Add German translation columns to simulation_lore
ALTER TABLE public.simulation_lore
  ADD COLUMN IF NOT EXISTS title_de text,
  ADD COLUMN IF NOT EXISTS epigraph_de text,
  ADD COLUMN IF NOT EXISTS body_de text,
  ADD COLUMN IF NOT EXISTS image_caption_de text;

COMMENT ON COLUMN public.simulation_lore.title_de IS 'German translation of title';
COMMENT ON COLUMN public.simulation_lore.body_de IS 'German translation of body';
