-- =============================================================================
-- SEED 020: Conventional Memory — VBDOS Theme (Design Tokens)
-- =============================================================================
-- DOS text-mode aesthetic: CGA/VGA 16-color palette, CRT scanlines,
-- monospace fonts, zero border radius, step animations.
--
-- Color scheme derived from the canonical VGA text-mode palette:
--   Desktop blue:  #0000AA → adapted to dark background
--   Cyan:          #00AAAA → primary color
--   Yellow:        #FFFF55 → accent
--   Light green:   #55FF55 → secondary/success
--   Light red:     #FF5555 → danger
--   Light gray:    #AAAAAA → text
--   White:         #FFFFFF → headings
--
-- Depends on: seed 019 (simulation must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '60000000-0000-0000-0000-000000000001';
    usr_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
    -- ── Colors ──
    (sim_id, 'design', 'color_primary',        '"#00AAAA"', usr_id),
    (sim_id, 'design', 'color_primary_hover',   '"#00CCCC"', usr_id),
    (sim_id, 'design', 'color_primary_active',  '"#008888"', usr_id),
    (sim_id, 'design', 'color_secondary',       '"#55FF55"', usr_id),
    (sim_id, 'design', 'color_accent',          '"#FFFF55"', usr_id),
    (sim_id, 'design', 'color_background',      '"#08081a"', usr_id),
    (sim_id, 'design', 'color_surface',         '"#0c0c2c"', usr_id),
    (sim_id, 'design', 'color_surface_sunken',  '"#060614"', usr_id),
    (sim_id, 'design', 'color_surface_header',  '"#0a0a24"', usr_id),
    (sim_id, 'design', 'color_text',            '"#AAAAAA"', usr_id),
    (sim_id, 'design', 'color_text_secondary',  '"#5588AA"', usr_id),
    (sim_id, 'design', 'color_text_muted',      '"#557799"', usr_id),
    (sim_id, 'design', 'color_border',          '"#00AAAA"', usr_id),
    (sim_id, 'design', 'color_border_light',    '"#1a1a3a"', usr_id),
    (sim_id, 'design', 'color_danger',          '"#FF5555"', usr_id),
    (sim_id, 'design', 'color_success',         '"#55FF55"', usr_id),
    (sim_id, 'design', 'color_primary_bg',      '"#0a1a2a"', usr_id),
    (sim_id, 'design', 'color_info_bg',         '"#0a1a30"', usr_id),
    (sim_id, 'design', 'color_danger_bg',       '"#2a0a0a"', usr_id),
    (sim_id, 'design', 'color_success_bg',      '"#0a2a0a"', usr_id),
    (sim_id, 'design', 'color_warning_bg',      '"#2a2a0a"', usr_id),

    -- ── Typography ──
    (sim_id, 'design', 'font_heading',       '"''VT323'', ''Share Tech Mono'', ''Courier New'', monospace"', usr_id),
    (sim_id, 'design', 'font_body',          '"''IBM Plex Mono'', ''Courier New'', monospace"', usr_id),
    (sim_id, 'design', 'heading_weight',     '"700"', usr_id),
    (sim_id, 'design', 'heading_transform',  '"uppercase"', usr_id),
    (sim_id, 'design', 'heading_tracking',   '"0.15em"', usr_id),
    (sim_id, 'design', 'font_base_size',     '"15px"', usr_id),

    -- ── Character ──
    (sim_id, 'design', 'border_radius',         '"0"', usr_id),
    (sim_id, 'design', 'border_width',          '"2px"', usr_id),
    (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
    (sim_id, 'design', 'shadow_style',          '"offset"', usr_id),
    (sim_id, 'design', 'shadow_color',          '"#000000"', usr_id),
    (sim_id, 'design', 'hover_effect',          '"translate"', usr_id),
    (sim_id, 'design', 'text_inverse',          '"#000000"', usr_id),

    -- ── Animation ──
    (sim_id, 'design', 'animation_speed',   '"0.5"', usr_id),
    (sim_id, 'design', 'animation_easing',  '"steps(3, end)"', usr_id)

ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now();

RAISE NOTICE 'Conventional Memory theme seed complete: 36 design tokens';
END $$;

COMMIT;
