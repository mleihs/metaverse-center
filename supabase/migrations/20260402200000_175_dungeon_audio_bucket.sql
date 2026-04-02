-- Migration 175: Create dungeon.audio storage bucket
-- Phase 1 audio system — SFX sprites, future ambient loops and impulse responses.
-- Public bucket: audio assets are non-sensitive, served to all users (audio is opt-in).
--
-- Bucket structure:
--   dungeon.audio/
--   ├── sfx/sfx-sprite.ogg     ← SFX sprite (OGG Opus, ~62KB)
--   ├── sfx/sfx-sprite.mp3     ← SFX sprite (MP3 fallback, ~66KB)
--   ├── ambient/                ← Phase 3: per-archetype ambient loops
--   └── impulse/                ← Phase 4: reverb impulse responses
--
-- After running this migration, upload audio files via:
--   node scripts/upload-audio-assets.mjs
-- Or manually via Supabase Dashboard → Storage → dungeon.audio

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dungeon.audio',
  'dungeon.audio',
  true,
  5242880,  -- 5MB max per file (generous for future ambient loops)
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read policy: anyone can download audio assets (no auth required).
-- Audio is a progressive-enhancement luxury layer — all assets are non-sensitive.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public read access for dungeon audio'
      AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read access for dungeon audio"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'dungeon.audio');
  END IF;
END $$;
