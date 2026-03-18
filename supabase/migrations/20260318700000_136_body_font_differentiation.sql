-- =============================================================================
-- MIGRATION 136: Body Font Differentiation + Theme Preset Seeding
-- =============================================================================
-- Updates font_body design settings for 4 simulations from generic system-ui
-- to distinctive, thematically appropriate Google Fonts.
-- Also seeds theme_preset setting so ThemeService resolves the correct base
-- preset instead of always falling back to brutalist.
--
-- Safe: uses ON CONFLICT DO UPDATE (idempotent).
-- No schema changes — data-only migration.
-- =============================================================================

BEGIN;

-- ============================================================================
-- Gaslit Reach (sunless-sea) — Lora serif for Victorian dark fantasy
-- ============================================================================
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'design', 'font_body',
   '"''Lora'', Georgia, serif"',
   '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', 'design', 'theme_preset',
   '"sunless-sea"',
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- ============================================================================
-- Station Null (deep-space-horror) — IBM Plex Sans for cold clinical feel
-- ============================================================================
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'design', 'font_body',
   '"''IBM Plex Sans'', system-ui, sans-serif"',
   '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', 'design', 'theme_preset',
   '"deep-space-horror"',
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- ============================================================================
-- Speranza (arc-raiders) — Source Sans 3 for utilitarian warmth
-- ============================================================================
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'design', 'font_body',
   '"''Source Sans 3'', system-ui, sans-serif"',
   '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000001', 'design', 'theme_preset',
   '"arc-raiders"',
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- ============================================================================
-- Cité des Dames (illuminated-literary) — Cormorant serif for literary elegance
-- ============================================================================
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'design', 'font_body',
   '"''Cormorant'', Georgia, serif"',
   '00000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000001', 'design', 'theme_preset',
   '"illuminated-literary"',
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

COMMIT;
