-- =============================================================================
-- SEED 018: Cité des Dames Design Theme — Illuminated Literary
-- =============================================================================
-- Seeds design settings for the Cité des Dames simulation.
-- Vellum cream background with ultramarine + burnished gold accents.
-- Libre Baskerville serif headings. Soft blur shadows. First light theme.
-- Illuminated manuscripts + Regency + Pre-Raphaelite + suffragette purple.
--
-- Depends on: seed 017 (Cité des Dames simulation must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '50000000-0000-0000-0000-000000000001';  -- Cité des Dames
    usr_id uuid := '00000000-0000-0000-0000-000000000001';  -- test user
BEGIN

-- ============================================================================
-- CITÉ DES DAMES — Illuminated Literary Theme
-- ============================================================================

-- Colors
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#1E3A8A"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#1A3278"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#152A66"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#7B2D8E"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#B8860B"', usr_id),
  (sim_id, 'design', 'color_background',      '"#F5E6CC"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#FAF3E6"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#EDE0C8"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#F7EDD8"', usr_id),
  (sim_id, 'design', 'color_text',            '"#1C1008"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#3A2A18"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#7A6B55"', usr_id),
  (sim_id, 'design', 'color_border',          '"#8B7D6B"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#C9BBAA"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#9B111E"', usr_id),
  (sim_id, 'design', 'color_success',         '"#2D6B3A"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#EEF1F8"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#F0ECF5"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#FDF0EE"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#EFF8F0"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#FFF5E6"', usr_id),

  -- Typography
  (sim_id, 'design', 'font_heading',          '"''Libre Baskerville'', Baskerville, Georgia, serif"', usr_id),
  (sim_id, 'design', 'font_body',             '"system-ui, -apple-system, sans-serif"', usr_id),
  (sim_id, 'design', 'font_mono',             '"SF Mono, Monaco, Inconsolata, ''Roboto Mono'', monospace"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"700"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"none"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.02em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"16px"', usr_id),

  -- Character
  (sim_id, 'design', 'border_radius',         '"3px"', usr_id),
  (sim_id, 'design', 'border_width',          '"1px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"blur"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#8B7D6B88"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"glow"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#FFFFFF"', usr_id),

  -- Animation
  (sim_id, 'design', 'animation_speed',       '"1.1"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-in-out"', usr_id)

ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

END $$;

COMMIT;
