-- Seed platform_settings with AI model configuration rows.
-- These control which OpenRouter models are used across the platform.
-- Admin can override via the Platform Admin → Models tab.

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('model_default', '"anthropic/claude-sonnet-4-6"', 'Default text model for generation (OpenRouter ID)'),
  ('model_fallback', '"deepseek/deepseek-r1-0528:free"', 'Fallback text model when default unavailable'),
  ('model_research', '"google/gemini-2.0-flash-001"', 'Cheaper model for research/analysis tasks'),
  ('model_forge', '"anthropic/claude-sonnet-4-6"', 'Text model for Forge pipeline (lore, themes, entities)')
ON CONFLICT (setting_key) DO NOTHING;
