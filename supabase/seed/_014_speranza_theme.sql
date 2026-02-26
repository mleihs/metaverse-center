-- =============================================================================
-- SEED 014: Speranza Design Theme — Arc Raiders (Warm Light, NASA-Punk)
-- =============================================================================
-- Seeds design settings for the Speranza simulation.
-- Parchment background with golden amber accents, Barlow headings, offset shadows.
-- Based on arcraiders.com aesthetic: warm, hopeful, industrial-handmade.
--
-- Depends on: seed 013 (Speranza simulation must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '40000000-0000-0000-0000-000000000001';  -- Speranza
    usr_id uuid := '00000000-0000-0000-0000-000000000001';  -- test user
BEGIN

-- ============================================================================
-- SPERANZA — Arc Raiders Theme
-- ============================================================================

-- Colors
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#C08A10"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#A87700"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#8F6600"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#2B5BA8"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#B84D1A"', usr_id),
  (sim_id, 'design', 'color_background',      '"#ECE2D0"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#F5EDE0"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#E0D4BE"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#F0E8D8"', usr_id),
  (sim_id, 'design', 'color_text',            '"#130918"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#3D2E47"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#7A6B85"', usr_id),
  (sim_id, 'design', 'color_border',          '"#8B7D6B"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#C9BBAA"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#C42B1C"', usr_id),
  (sim_id, 'design', 'color_success',         '"#2D7A3A"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#FFFFFF"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#EEF1F8"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#FDF0EE"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#EFF8F0"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#FFF5E6"', usr_id),

  -- Typography
  (sim_id, 'design', 'font_heading',          '"''Barlow'', ''Arial Narrow'', sans-serif"', usr_id),
  (sim_id, 'design', 'font_body',             '"system-ui, -apple-system, sans-serif"', usr_id),
  (sim_id, 'design', 'font_mono',             '"SF Mono, Monaco, Inconsolata, ''Roboto Mono'', monospace"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"800"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"uppercase"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.06em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"16px"', usr_id),

  -- Character
  (sim_id, 'design', 'border_radius',         '"4px"', usr_id),
  (sim_id, 'design', 'border_width',          '"2px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"2px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"offset"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#8B7D6B"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"translate"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#FFFFFF"', usr_id),

  -- Animation
  (sim_id, 'design', 'animation_speed',       '"0.9"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-out"', usr_id)

ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

END $$;

COMMIT;
