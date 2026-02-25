-- =============================================================================
-- SEED 012: Station Null Design Theme — Deep Space Horror
-- =============================================================================
-- Seeds design settings for the Station Null simulation.
-- Void-black with CRT green accents, cold cyan scanners, warning orange alarms.
-- Monospace headings, zero border-radius, slow creeping animations.
--
-- Depends on: seed 011 (Station Null simulation must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '30000000-0000-0000-0000-000000000001';  -- Station Null
    usr_id uuid := '00000000-0000-0000-0000-000000000001';  -- test user
BEGIN

-- ============================================================================
-- STATION NULL — Deep Space Horror Theme
-- ============================================================================

-- Colors
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#00cc88"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#00b377"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#009966"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#00ccff"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#ff6633"', usr_id),
  (sim_id, 'design', 'color_background',      '"#050508"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#0c0c14"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#030306"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#0a0a12"', usr_id),
  (sim_id, 'design', 'color_text',            '"#c8d0d8"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#7888a0"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#6888a8"', usr_id),
  (sim_id, 'design', 'color_border',          '"#1a2030"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#141820"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#ff3344"', usr_id),
  (sim_id, 'design', 'color_success',         '"#00cc88"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#0a1a14"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#0a1420"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#200a0c"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#0a200e"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#201a0a"', usr_id),

  -- Typography
  (sim_id, 'design', 'font_heading',          '"''Courier New'', Monaco, monospace"', usr_id),
  (sim_id, 'design', 'font_body',             '"system-ui, -apple-system, sans-serif"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"700"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"uppercase"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.12em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"15px"', usr_id),

  -- Character
  (sim_id, 'design', 'border_radius',         '"0"', usr_id),
  (sim_id, 'design', 'border_width',          '"1px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"glow"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#00cc88"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"glow"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#050508"', usr_id),

  -- Animation
  (sim_id, 'design', 'animation_speed',       '"1.8"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-in"', usr_id)

ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

END $$;

COMMIT;
