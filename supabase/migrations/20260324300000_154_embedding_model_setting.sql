-- Migration 154: Move embedding model config to platform_settings
-- Previously hardcoded as EMBEDDING_MODEL in backend/services/embedding_service.py

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES
  ('embedding_model', '"openai/text-embedding-3-small"', 'OpenRouter embedding model identifier'),
  ('embedding_dims', '1536', 'Embedding vector dimensionality (must match model output)')
ON CONFLICT (setting_key) DO NOTHING;
