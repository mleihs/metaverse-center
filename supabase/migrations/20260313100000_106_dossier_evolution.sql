-- Migration 106: Dossier Evolution (Living Dossier)
-- Adds columns to simulation_lore for tracking dossier section evolution.

ALTER TABLE public.simulation_lore
  ADD COLUMN IF NOT EXISTS evolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS evolution_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evolution_log jsonb DEFAULT '[]'::jsonb;

-- Index for quickly finding evolved sections
CREATE INDEX IF NOT EXISTS idx_simulation_lore_evolved
  ON public.simulation_lore (simulation_id, evolved_at)
  WHERE evolved_at IS NOT NULL;

COMMENT ON COLUMN public.simulation_lore.evolved_at IS 'Timestamp of last dossier evolution update';
COMMENT ON COLUMN public.simulation_lore.evolution_count IS 'Number of times this section has been evolved';
COMMENT ON COLUMN public.simulation_lore.evolution_log IS 'Array of {trigger, timestamp, words_added} entries';
