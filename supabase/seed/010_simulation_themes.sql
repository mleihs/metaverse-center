-- =============================================================================
-- SEED 010: Simulation Design Themes
-- =============================================================================
-- Seeds design settings for the Capybara Kingdom simulation to demonstrate
-- the per-simulation theming system (Sunless Sea / bioluminescent preset).
--
-- Velgarien (sim 001) intentionally has no design settings — base tokens
-- produce the brutalist aesthetic by default.
--
-- Depends on: seed 009 (Capybara Kingdom simulation must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '20000000-0000-0000-0000-000000000001';  -- Capybara Kingdom
    usr_id uuid := '00000000-0000-0000-0000-000000000001';  -- test user
BEGIN

-- ============================================================================
-- CAPYBARA KINGDOM — Sunless Sea Theme
-- ============================================================================

-- Colors
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#0d7377"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#0a5c5f"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#084a4d"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#00e5cc"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#f4a261"', usr_id),
  (sim_id, 'design', 'color_background',      '"#0a1628"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#0f2236"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#081320"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#0d1d30"', usr_id),
  (sim_id, 'design', 'color_text',            '"#e8ede9"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#90aa9c"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#708e80"', usr_id),
  (sim_id, 'design', 'color_border',          '"#1a3a4a"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#0f2a3a"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#e74c3c"', usr_id),
  (sim_id, 'design', 'color_success',         '"#27ae60"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#061a1e"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#0d2a38"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#2d1520"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#0d2a1e"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#2a2210"', usr_id),

  -- Typography
  (sim_id, 'design', 'font_heading',          '"''Georgia'', ''Palatino Linotype'', serif"', usr_id),
  (sim_id, 'design', 'font_body',             '"''Segoe UI'', Roboto, sans-serif"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"700"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"none"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.05em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"16px"', usr_id),

  -- Character
  (sim_id, 'design', 'border_radius',         '"6px"', usr_id),
  (sim_id, 'design', 'border_width',          '"1px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"glow"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#00e5cc"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"glow"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#e8ede9"', usr_id),

  -- Animation
  (sim_id, 'design', 'animation_speed',       '"1.5"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-in-out"', usr_id)

ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

END $$;

COMMIT;
