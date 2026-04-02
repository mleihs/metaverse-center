#!/usr/bin/env node
/**
 * Upload dungeon audio assets to Supabase Storage.
 *
 * Uploads SFX sprite files to the `dungeon.audio` bucket under `sfx/`.
 * Uses service_role key for admin upload (no RLS restrictions).
 * Uses curl-based fetch (no external dependencies needed).
 *
 * Run: node scripts/upload-audio-assets.mjs
 *
 * Prerequisites:
 *   - .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Migration 175 applied (creates the dungeon.audio bucket)
 *   - Audio files generated via: node scripts/generate-sfx-sprite.mjs
 *
 * Bucket structure:
 *   dungeon.audio/
 *   ├── sfx/sfx-sprite.ogg    ← SFX sprite (OGG Opus, ~62KB)
 *   ├── sfx/sfx-sprite.mp3    ← SFX sprite (MP3 fallback, ~66KB)
 *   ├── ambient/               ← Phase 3: per-archetype ambient loops
 *   └── impulse/               ← Phase 4: reverb impulse responses
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Load .env manually (no dotenv dependency)
function loadEnv(path) {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const projectRoot = join(import.meta.dirname, '..');
const env = { ...loadEnv(join(projectRoot, '.env')), ...process.env };

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'dungeon.audio';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Audio files are generated into frontend/public/audio/dungeon/ by generate-sfx-sprite.mjs
// They exist temporarily for upload, then are removed (not committed to git).
const AUDIO_DIR = join(projectRoot, 'frontend', 'public', 'audio', 'dungeon');

const FILES = [
  { local: 'sfx-sprite.ogg', remote: 'sfx/sfx-sprite.ogg', contentType: 'audio/ogg' },
  { local: 'sfx-sprite.mp3', remote: 'sfx/sfx-sprite.mp3', contentType: 'audio/mpeg' },
];

async function main() {
  console.log(`Uploading to ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/\n`);

  for (const file of FILES) {
    const localPath = join(AUDIO_DIR, file.local);
    if (!existsSync(localPath)) {
      console.warn(`  SKIP: ${file.local} not found. Run generate-sfx-sprite.mjs first.`);
      continue;
    }

    const data = readFileSync(localPath);
    const sizeKB = (data.length / 1024).toFixed(1);

    // Upload via Supabase Storage REST API (upsert)
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.remote}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': file.contentType,
        'Cache-Control': 'max-age=31536000',
        'x-upsert': 'true',
      },
      body: data,
    });

    if (resp.ok) {
      console.log(`  OK: ${file.remote} (${sizeKB}KB)`);
    } else {
      const err = await resp.text();
      console.error(`  FAIL: ${file.remote} — ${resp.status} ${err}`);
    }
  }

  // Verify public access
  console.log('\nVerifying public access:');
  for (const file of FILES) {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file.remote}`;
    const resp = await fetch(url, { method: 'HEAD' });
    const status = resp.ok ? 'OK' : `FAIL (${resp.status})`;
    console.log(`  ${status}: ${url}`);
  }

  console.log('\nDone.');
}

main();
