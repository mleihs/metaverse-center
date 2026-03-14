---
title: "Local DB Reset & Storage Recovery Guide"
version: "1.0"
type: guide
status: active
lang: en
---

# Local DB Reset & Storage Recovery Guide

## What Goes Wrong

### The Chain of Destruction

1. `supabase db reset` or `supabase stop --no-backup` → destroys Docker volumes
2. Docker volumes contain: PostgreSQL data + Supabase Storage files (images)
3. On restart, migrations re-create schema + seed data, but **storage files are gone forever**
4. Image URLs in DB point to files that no longer exist → broken images in UI

### Migration Ordering Problem (Fixed)

Data migrations 016-021 reference test user `00000000-0000-0000-0000-000000000001`, but this user was previously only created by **seeds** (which run AFTER migrations). On a fresh start, the user doesn't exist when migration 016 runs → FK violation crash.

**Fix applied:** Migration `20260220000000_ensure_dev_user.sql` creates the test user + Velgarien simulation between DDL migrations (015) and data migrations (016+).

### Seed Duplication Problem (Fixed)

Seeds 009 (Capybara) and 011 (Station Null) insert agents/buildings **without explicit UUIDs**. Migrations 017 and 021 also insert the same agents/buildings. When both run on fresh start → duplicate records (e.g., 12 agents instead of 6).

**Fix applied:** Seeds 009, 011, 012 renamed with `_` prefix to exclude from glob pattern `./seed/0*.sql`.

### v1→v2 Migration Seeds (Fixed)

Seeds 002-005 reference temporary tables (`_old_agents`, etc.) that only existed during v1→v2 migration. On fresh install, these tables don't exist → crash.

**Fix applied:** Seeds 002-005 renamed with `_` prefix.

## Current Seed Layout

```
supabase/seed/
  001_velgarien_simulation.sql    ← Active: test user, Velgarien base data, taxonomies
  006_prompt_templates.sql        ← Active: 30 platform-default templates
  007_sample_data.sql             ← Active: sample agents, buildings, events
  008_velgarien_image_config.sql  ← Active: Velgarien AI settings
  010_simulation_themes.sql       ← Active: Capybara design settings (36 tokens)
  _002_migrate_agents.sql         ← Skipped: v1→v2 migration
  _003_migrate_entities.sql       ← Skipped: v1→v2 migration
  _004_migrate_social_chat.sql    ← Skipped: v1→v2 migration
  _005_verify_migration.sql       ← Skipped: v1→v2 migration
  _009_capybara_kingdom.sql       ← Skipped: data in migration 017
  _011_station_null.sql           ← Skipped: data in migration 021
  _012_station_null_theme.sql     ← Skipped: data in migration 021
```

## Migration Layout

Query current migration count: `ls supabase/migrations/ | wc -l`

Key structural migrations:
```
001-012: DDL (schema, RLS, triggers, views, storage)
ensure_dev_user: Test user + Velgarien simulation (MUST run before 016)
016+:    Data migrations (simulations, image config, public access, etc.)
```

Full migration list: `ls supabase/migrations/`

## How to Safely Reset

### Preferred: Reset DB Only (Keep Storage)

```bash
# This resets the database but keeps Docker volumes (storage files preserved)
supabase db reset
```

**Note:** Image URLs in DB will be cleared by the reset. Re-apply them:
```bash
docker exec -i supabase_db_velgarien-rebuild psql -U postgres < /tmp/update_portrait_urls.sql
docker exec -i supabase_db_velgarien-rebuild psql -U postgres < /tmp/update_building_urls.sql
```

### If Storage Was Destroyed: Recovery from Production

1. **Download images from production** (READ-ONLY, doesn't modify production):
   ```bash
   # Agent portraits
   SERVICE_KEY="eyJhbG..."  # production service_role key
   PROD_URL="https://bffjoupddfjaljqrwqck.supabase.co"
   curl -s "$PROD_URL/rest/v1/agents?select=name,portrait_image_url&portrait_image_url=neq.null" \
     -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $SERVICE_KEY"
   # Download each URL with curl -o
   ```

2. **Upload to local** (use `sb_secret_` key, NOT JWT):
   ```bash
   LOCAL_SECRET="sb_secret_..."  # from `supabase status`
   curl -X POST "http://127.0.0.1:54321/storage/v1/object/BUCKET/PATH" \
     -H "Authorization: Bearer $LOCAL_SECRET" -H "apikey: $LOCAL_SECRET" \
     -H "Content-Type: image/webp" -H "x-upsert: true" \
     --data-binary @/tmp/image.webp
   ```

3. **Update local DB URLs** (from production URLs, replace host):
   ```sql
   UPDATE agents SET portrait_image_url = REPLACE(portrait_image_url,
     'https://bffjoupddfjaljqrwqck.supabase.co', 'http://127.0.0.1:54321')
   WHERE portrait_image_url LIKE 'https://%';
   ```

## Key Differences: Local vs Production Auth

| Feature | Local (Supabase CLI) | Production (Hosted) |
|---------|---------------------|---------------------|
| API keys | `sb_publishable_...` / `sb_secret_...` | JWT anon/service_role |
| Storage auth | `sb_secret_` as Bearer token | JWT service_role as Bearer |
| DB access | `docker exec ... psql -U postgres` | REST API with secret key |
| MCP tools | `mcp__supabase__*` (local) | N/A (use REST API) |

## Image Re-Generation After Reset

After a DB reset destroys storage, re-generate all images:

```bash
# 1. Start backend
source backend/.venv/bin/activate
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

# 2. Generate dashboard banners (hero + per-simulation banners)
python3.13 scripts/generate_dashboard_images.py

# 3. Generate per-simulation images (run all scripts in scripts/generate_*_images.py)
ls scripts/generate_*_images.py
```

**NOTE:** Velgarien/Capybara scripts have hardcoded IDs — they break if DB is reset. Newer scripts auto-query DB for IDs. Dashboard script auto-detects `sb_secret_` key.

**Alternatively:** Download all images from production (see "Recovery from Production" above).

## Banner Images

Banners are stored in `simulation.assets` bucket at `{simulation_id}/banner.webp`. The `banner_url` column in the `simulations` table must be set separately — the generation script `generate_dashboard_images.py` handles this automatically.

- Dashboard hero: `platform/dashboard-hero.webp`
- Velgarien: `10000000-.../banner.webp`
- Capybara: `20000000-.../banner.webp`
- Station Null: `30000000-.../banner.webp`

## Prevention Checklist

Before any `supabase stop`, `supabase db reset`, or Docker operations:
- [ ] Check if storage has images: `docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SELECT count(*) FROM storage.objects;"`
- [ ] If images exist, back them up first OR ensure they can be recovered from production
- [ ] Never use `--no-backup` unless you're sure storage is empty or backed up
- [ ] After reset, verify data: `SELECT name FROM simulations WHERE status='active';` — check agent/building counts, design settings present
- [ ] After reset, re-run `generate_dashboard_images.py` to restore banners + set `banner_url`
- [ ] After reset, re-run all `generate_*_images.py` scripts OR download from production
