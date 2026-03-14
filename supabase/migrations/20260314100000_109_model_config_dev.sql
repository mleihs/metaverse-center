-- Migration 109: Development model configuration
-- Adds model_*_dev keys for environment-specific model resolution.
-- Dev defaults use cheap/free models to avoid exhausting credits during development.

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('model_default_dev', '"deepseek/deepseek-r1-0528:free"', 'Default text model for development (cheap/free)'),
  ('model_fallback_dev', '"deepseek/deepseek-r1-0528:free"', 'Fallback text model for development'),
  ('model_research_dev', '"google/gemini-2.0-flash-001"', 'Research model for development (fast + cheap)'),
  ('model_forge_dev', '"deepseek/deepseek-r1-0528:free"', 'Forge pipeline model for development')
ON CONFLICT (setting_key) DO NOTHING;
