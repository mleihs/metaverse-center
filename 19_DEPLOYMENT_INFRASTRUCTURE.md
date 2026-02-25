# 19 — Deployment Infrastructure & Dev→Prod Sync

**Version:** 1.1
**Date:** 2026-02-25
**Status:** Production deployed (Railway + hosted Supabase)

---

## 1. Architecture Overview

### Production Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                          Internet                                 │
│                                                                   │
│   User Browser ─── https://metaverse.center ────┐                │
│                      │                          │                │
│           ┌──────────▼──────────┐               │                │
│           │   Cloudflare (CDN)   │               │                │
│           │   SSL termination    │               │                │
│           │   DNS + WAF          │               │                │
│           └──────────┬──────────┘               │                │
│                      │ HTTPS (Full strict)      │                │
│           ┌──────────▼──────────┐    ┌──────────▼─────────┐     │
│           │   Railway (Docker)   │    │  Supabase Hosted   │     │
│           │   FastAPI + Uvicorn  │    │  PostgreSQL + RLS  │     │
│           │   Static SPA files   │    │  Auth (ES256/JWKS) │     │
│           │   Port 8000          │    │  Storage (S3)      │     │
│           └──────────┬──────────┘    │  Realtime (WS)     │     │
│                      │               └──────────┬─────────┘     │
│                      │                          │                │
│                      └──────────────────────────┘                │
│                         User-JWT (RLS active)                     │
└──────────────────────────────────────────────────────────────────┘
```

**Production URLs:**

| Component | URL |
|-----------|-----|
| App (custom domain) | `https://metaverse.center` |
| Railway (internal) | `https://backend-production-8f7a.up.railway.app` |
| Supabase (hosted) | `https://bffjoupddfjaljqrwqck.supabase.co` |
| Supabase MCP | `https://mcp.supabase.com/mcp?project_ref=bffjoupddfjaljqrwqck` |

### Local Development Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     localhost                                 │
│                                                              │
│   Browser ───────────┬──────────────────────────────┐       │
│                      │                              │       │
│           ┌──────────▼──────────┐    ┌──────────────▼────┐  │
│           │   Uvicorn (reload)   │    │  Docker Supabase  │  │
│           │   Port 8000          │    │  PostgreSQL       │  │
│           ├──────────────────────┤    │  Port 54322       │  │
│           │   Vite Dev Server    │    │  Auth (HS256)     │  │
│           │   Port 5173 (HMR)   │    │  Storage (local)  │  │
│           └──────────┬──────────┘    │  Port 54321 (API) │  │
│                      │               │  MCP :54321/mcp   │  │
│                      └───────────────┴──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Environment Comparison

| Aspect | Local Development | Production |
|--------|------------------|------------|
| Domain | `http://localhost:5173` | `https://metaverse.center` |
| CDN/SSL | None | Cloudflare (Full strict SSL) |
| Backend | `uvicorn --reload` on :8000 | Railway Docker on :8000 |
| Frontend | Vite dev server on :5173 | Static files served by FastAPI |
| Database | Docker PostgreSQL :54322 | Supabase hosted PostgreSQL |
| Supabase API | `http://127.0.0.1:54321` | `https://bffjoupddfjaljqrwqck.supabase.co` |
| Auth | HS256 shared secret | ES256 (ECC P-256) via JWKS |
| Storage | Local Docker volumes | Supabase S3-backed storage |
| MCP | `http://127.0.0.1:54321/mcp` | `https://mcp.supabase.com/mcp?project_ref=...` |
| DB access | `docker exec ... psql` | MCP or management API |

---

## 2. URL Strategy — The Image URL Problem

### How Image URLs Are Generated

The backend `ImageService._upload_to_storage()` (in `backend/services/image_service.py`) uploads images to Supabase Storage and then calls `supabase.storage.from_(bucket).get_public_url(path)`. This SDK method returns a **full absolute URL** based on the current `SUPABASE_URL` configuration:

- **Local:** `http://127.0.0.1:54321/storage/v1/object/public/agent.portraits/sim/agent/uuid.webp`
- **Production:** `https://bffjoupddfjaljqrwqck.supabase.co/storage/v1/object/public/agent.portraits/sim/agent/uuid.webp`

This full URL is then stored in the database.

### Where URLs Are Stored

| Table | Column | Example |
|-------|--------|---------|
| `agents` | `portrait_image_url` | Agent portrait images |
| `buildings` | `image_url` | Building images |
| `simulations` | `banner_url` | Simulation banner |
| `simulations` | `icon_url` | Simulation icon |

### Two Categories of Image URLs

| Category | Examples | How Generated | Environment-Aware? |
|----------|----------|---------------|-------------------|
| **DB-stored** | `agents.portrait_image_url`, `buildings.image_url`, `simulations.banner_url`, `simulations.icon_url` | Backend `ImageService._upload_to_storage()` calls `supabase.storage.get_public_url()` — returns full URL based on current `SUPABASE_URL` | **No** — URL is baked at generation time |
| **Runtime-constructed** | Hero image, lore images (LoreScroll) | Frontend builds URL from `VITE_SUPABASE_URL` + hardcoded path at render time | **Yes** — always uses current env |

### The Fundamental Problem

When an agent portrait is generated in **local dev**, the SDK returns:
```
http://127.0.0.1:54321/storage/v1/object/public/agent.portraits/{sim}/{agent}/{uuid}.webp
```

This full URL is stored in `agents.portrait_image_url`. If you then copy this row to production, the URL still points to localhost — the image is broken.

Runtime-constructed URLs (hero image, lore images) don't have this problem because they build the URL from `VITE_SUPABASE_URL` at render time.

### Solutions

#### Solution 1: URL Rewriting on Export (Quick Fix for Bulk Sync)

After importing data to production, rewrite all localhost URLs:

```sql
-- Agents
UPDATE agents SET portrait_image_url =
  REPLACE(portrait_image_url, 'http://127.0.0.1:54321', 'https://bffjoupddfjaljqrwqck.supabase.co')
WHERE portrait_image_url LIKE '%127.0.0.1%';

-- Buildings
UPDATE buildings SET image_url =
  REPLACE(image_url, 'http://127.0.0.1:54321', 'https://bffjoupddfjaljqrwqck.supabase.co')
WHERE image_url LIKE '%127.0.0.1%';

-- Simulations
UPDATE simulations SET
  banner_url = REPLACE(banner_url, 'http://127.0.0.1:54321', 'https://bffjoupddfjaljqrwqck.supabase.co'),
  icon_url = REPLACE(icon_url, 'http://127.0.0.1:54321', 'https://bffjoupddfjaljqrwqck.supabase.co')
WHERE banner_url LIKE '%127.0.0.1%' OR icon_url LIKE '%127.0.0.1%';
```

**Pros:** Minimal effort, works immediately.
**Cons:** Must remember to run after every data sync; fragile if URLs change format.

#### Solution 2: Store Relative Paths (Recommended Long-Term Fix)

Store only the path component instead of full URLs:

```
# Instead of:
http://127.0.0.1:54321/storage/v1/object/public/agent.portraits/{sim}/{agent}/{uuid}.webp

# Store:
/storage/v1/object/public/agent.portraits/{sim}/{agent}/{uuid}.webp
```

Frontend and backend prepend `SUPABASE_URL` (or `VITE_SUPABASE_URL`) at runtime. This is the industry standard pattern — S3, GCS, and Azure Blob Storage all use relative keys.

**Benefits:**
- Eliminates the entire class of URL portability problems permanently
- Data is portable between any environments without rewriting
- Follows cloud storage best practices

**Required changes:**
- Migration to strip existing full URLs to relative paths
- `ImageService._upload_to_storage()`: return path instead of `get_public_url()`
- All frontend components that render images: prepend `VITE_SUPABASE_URL`
- Backend endpoints that return image URLs: prepend `SUPABASE_URL` (or let frontend handle it)

**This is the recommended architectural improvement to implement next.**

#### Solution 3: Generate Directly on Production

Run image generation endpoints against the production backend. URLs are automatically correct since `SUPABASE_URL` points to production. Images are uploaded directly to production storage.

**Pros:** No URL mismatch at all.
**Cons:** Requires production API access; uses production resources; doesn't help with existing local data.

### Recommended Workflow for Ongoing Dev→Prod Sync

| Scenario | Approach |
|----------|----------|
| New entity created locally (no images) | Export row, import to production — no URL issue |
| New entity with generated images | (a) Regenerate images on production, or (b) export row + copy image file + rewrite URL |
| Bulk data sync | pg_dump + URL rewrite SQL + image file transfer script |
| Schema changes | `supabase db push` (no URL involvement) |
| New platform assets (hero, lore) | Upload to production storage — frontend constructs URL at runtime |

---

## 3. Data Migration Playbook

### Full Export/Import (One-Time or Bulk Sync)

This is the procedure used for the initial production data migration. It handles all known edge cases.

#### Step 1: Export with INSERT Format

```bash
docker exec supabase_db_velgarien-rebuild pg_dump -U postgres \
  --data-only --schema=public --no-owner --no-privileges \
  --inserts --rows-per-insert=1 \
  --exclude-table=supabase_migrations.schema_migrations \
  postgres > /tmp/velgarien_export.sql
```

**Why `--inserts` instead of `COPY`:** The `COPY` format requires `psql` to import, which isn't available for hosted Supabase. `INSERT` statements work with the management API and `supabase db push`.

#### Step 2: Clean the Export

Use `scripts/export_for_production.py` to handle 5 known issues:

```bash
python3.13 scripts/export_for_production.py /tmp/velgarien_export.sql /tmp/velgarien_clean.sql
```

The script handles:
1. Remove `\restrict` / `\unrestrict` psql meta-commands
2. Remove `SET` configuration statements
3. Strip pg_dump comments (`-- `) but preserve data starting with `---`
4. Replace `DISABLE TRIGGER ALL` → `DISABLE TRIGGER USER`
5. Collapse multi-line INSERT strings to single-line with `E'...\n...'` syntax

#### Step 3: Backup Production Data

Always backup before replacing data:

```bash
# Via MCP or management API — export current production state
# Or simply note that migrations can be re-applied with `supabase db reset` (destructive)
```

#### Step 4: Prepend TRUNCATE CASCADE

If replacing existing data, add to the top of the clean SQL:

```sql
-- Order matters: children before parents (FK constraints)
TRUNCATE TABLE
  social_media_posts,
  social_trends,
  campaign_agents,
  campaigns,
  chat_messages,
  conversations,
  event_agent_reactions,
  building_agent_assignments,
  agent_professions_junction,
  agent_professions,
  events,
  buildings,
  streets,
  zones,
  cities,
  prompt_templates,
  simulation_settings,
  simulation_members,
  agents,
  taxonomies,
  simulations,
  audit_log
CASCADE;
```

#### Step 5: Push as Temporary Migration

```bash
# Copy cleaned SQL to a new migration file
cp /tmp/velgarien_clean.sql supabase/migrations/99999999999999_temp_data_import.sql

# Push to production
supabase db push

# Remove the temporary migration file (don't commit it)
rm supabase/migrations/99999999999999_temp_data_import.sql
```

#### Step 6: Rewrite Image URLs

Run the URL rewriting SQL from Section 2, Solution 1 against the production database.

#### Step 7: Transfer Image Files

Upload local storage files to production using the Supabase Storage API. The image files must be transferred separately from the database data.

```bash
# List local storage files
docker exec supabase_db_velgarien-rebuild ls /var/lib/storage/

# Or use the storage API to list and download/upload
# See: scripts/ for image generation scripts that demonstrate the upload pattern
```

### Incremental Sync (Single Entities)

For adding specific rows to production:

```bash
# Export single table rows as CSV
docker exec supabase_db_velgarien-rebuild psql -U postgres \
  -c "COPY (SELECT * FROM agents WHERE id = 'uuid') TO STDOUT WITH CSV HEADER"

# Or construct INSERT statements manually
docker exec supabase_db_velgarien-rebuild psql -U postgres \
  -c "SELECT 'INSERT INTO agents (' || string_agg(column_name, ', ') || ') VALUES ...'
      FROM information_schema.columns WHERE table_name = 'agents'"
```

For simple queries, use the production MCP server or the Supabase management API.

### Image File Transfer (Proven Procedure)

Images exist in 4 storage buckets:

| Bucket | Content | Current Count |
|--------|---------|---------------|
| `agent.portraits` | Agent portrait images | 13 (8 Velgarien + 5 Capybara) |
| `building.images` | Building images | 11 (6 Velgarien + 5 Capybara) |
| `user.agent.portraits` | User-created agent portraits | 0 |
| `simulation.assets` | Simulation banners, icons, lore images | 36 (platform assets) |

#### Step-by-Step Transfer

**Prerequisites:** Supabase secret key (`sb_secret_...`) from Dashboard → Settings → API.

**1. Clean production buckets** (optional — if replacing existing images):

```bash
# List files in a bucket
curl -s "$PROD_URL/storage/v1/object/list/agent.portraits" \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "apikey: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "", "limit": 100}'

# Delete files (batch)
curl -s -X DELETE "$PROD_URL/storage/v1/object/agent.portraits" \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "apikey: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefixes": ["path/to/file1.webp", "path/to/file2.webp"]}'
```

**2. Download from local, upload to production:**

```bash
# Download from local storage (public bucket — no auth needed)
curl -o /tmp/image.webp "http://127.0.0.1:54321/storage/v1/object/public/agent.portraits/{sim_id}/{agent_id}/{uuid}.webp"

# Upload to production (requires secret key, x-upsert: true to overwrite)
curl -X POST "$PROD_URL/storage/v1/object/agent.portraits/{sim_id}/{agent_id}/{uuid}.webp" \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "apikey: $SECRET_KEY" \
  -H "Content-Type: image/webp" \
  -H "x-upsert: true" \
  --data-binary @/tmp/image.webp
```

**3. Update DB URLs** via the Supabase REST API (not MCP — MCP tools only connect to local):

```bash
# Update a single agent portrait URL
curl -X PATCH "$PROD_URL/rest/v1/agents?id=eq.$AGENT_ID" \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "apikey: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"portrait_image_url\": \"$PROD_URL/storage/v1/object/public/agent.portraits/{path}\"}"
```

**Or bulk-rewrite** all localhost URLs (if images were transferred with same paths):

```bash
# This MUST run against PRODUCTION, not local.
# Use REST API or a temporary migration — NOT the local MCP.
```

#### Important: MCP Tools Are Local-Only

The `mcp__supabase__*` tools in Claude Code connect to the **local** Supabase instance (`127.0.0.1:54321`). To modify the production database:

| Method | When to Use |
|--------|-------------|
| REST API with `sb_secret_` key | Individual row updates, storage operations |
| `supabase db push` with temp migration | Bulk SQL (INSERT, UPDATE, DELETE) |
| Production MCP (`mcp__supabase-prod__*`) | Read queries (if connected) |

**Never run URL rewrite SQL via the local MCP** — it will modify local data instead of production.

---

## 4. Schema Migration Workflow

### Local Development

```bash
# Reset everything (destructive — drops all data)
supabase db reset

# This re-applies all 19 migrations + seed files in order
```

### Production

```bash
# Push pending migrations
supabase db push

# This compares local migrations against supabase_migrations.schema_migrations
# and applies only new ones
```

### Migration File Inventory (21 Files)

| Migration | Content | Type |
|-----------|---------|------|
| `001_foundation` | simulations, simulation_members, simulation_settings, taxonomies | Schema |
| `002_geography` | cities, zones, streets | Schema |
| `003_entities` | agents, buildings, events | Schema |
| `004_relations` | agent_professions, junctions, building_agent_assignments, event_agent_reactions | Schema |
| `005_social` | campaigns, campaign_agents, social_trends, social_media_posts | Schema |
| `006_chat_prompts` | conversations, chat_messages, prompt_templates | Schema |
| `007_rls_functions` | RLS helper functions (is_simulation_member, get_member_role, etc.) | Schema |
| `008_rls_policies` | 101 RLS policies across all tables | Schema |
| `009_triggers` | 16 updated_at triggers + 6 business logic triggers | Schema |
| `010_utility_functions` | generate_slug, validate_taxonomy_value, etc. | Schema |
| `011_views` | 4 active_* views + simulation_dashboard + conversation_summaries + 2 materialized views | Schema |
| `012_storage` | 4 storage buckets + storage policies | Schema |
| `013_fix_audit_log_rls` | Fix audit_log RLS policy | Schema |
| `013_group_chat_events` | Group chat and event system updates | Schema |
| `014_reaction_upsert_and_delete` | Reaction upsert/delete functions | Schema |
| `014_chat_prompt_templates` | Chat and prompt template updates | Schema |
| `015_cleanup` | Schema cleanup and fixes | Schema |
| `016_image_gen_config` | Image generation config seed data | Data-only |
| `017_capybara_kingdom` | Capybara Kingdom simulation seed | Data-only |
| `018_public_read_access` | 21 anon RLS policies for public read access | Schema |
| `019_add_buildings_street_index` | Index on `buildings.street_id` | Schema |
| `020_restrict_settings_anon_policy` | Restrict `settings_anon_select` to `category = 'design'` | Schema |

### Data-Only Migrations (016, 017)

Migrations 016 and 017 contain `INSERT` statements for seed data. They reference `created_by_id` foreign keys pointing to `auth.users`. For production:

1. The auth user must exist before these migrations run
2. If importing data separately, mark them as applied in `schema_migrations` without executing:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('20260225000000', '016_image_gen_config'),
          ('20260225100000', '017_capybara_kingdom');
   ```

---

## 5. Deployment Configuration

### Railway Setup

**Service:** `metaverse-center` (project: `metaverse.center`)

**Dockerfile** (`Dockerfile` in project root): Multi-stage build that:
1. Builds the Vite frontend (`npm run build`)
2. Installs Python dependencies
3. Copies built frontend assets to `backend/static/`
4. Runs `uvicorn backend.app:app --host 0.0.0.0 --port 8000`

The FastAPI app serves the SPA static files in production (see `backend/app.py` static file mounting).

**`railway.toml`** — Config-as-code for build/deploy behavior:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
watchPatterns = ["backend/**", "frontend/**", "Dockerfile", "pyproject.toml"]

[deploy]
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Watch patterns** control when Railway triggers a build. Only changes matching these patterns cause a deploy. This means:
- Commits touching only docs (`*.md`), specs, scripts, supabase config, etc. → **no deploy**
- Commits touching `backend/`, `frontend/`, `Dockerfile`, or `pyproject.toml` → **deploy triggered**

**Environment Variables (6 required):**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Hosted Supabase API URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (for RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for admin ops) |
| `SUPABASE_JWT_SECRET` | JWT verification secret |
| `VITE_SUPABASE_URL` | Frontend Supabase URL (build-time) |
| `VITE_SUPABASE_ANON_KEY` | Frontend anon key (build-time) |

See `.env.production.example` for the full list including optional AI/external service keys.

### Custom Domain + Cloudflare

**Domain:** `metaverse.center` — managed via Cloudflare DNS.

**DNS records** (only the records relevant to the app):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `metaverse.center` | Railway CNAME target | Proxied |
| CNAME | `www` | Railway CNAME target | Proxied |

**Cloudflare SSL/TLS:** Set to **Full (strict)**. This is critical — "Flexible" mode causes an infinite redirect loop because Cloudflare connects to Railway over HTTP, Railway redirects to HTTPS, and Cloudflare proxies the redirect again.

**CORS:** The Railway env var `BACKEND_CORS_ORIGINS` must be set to `https://metaverse.center`.

### Supabase Hosted Setup

**Project ref:** `bffjoupddfjaljqrwqck`

Setup steps performed:
1. Created project on Supabase dashboard
2. Created auth user `admin@velgarien.dev` (UUID `00000000-0000-0000-0000-000000000001`) via Auth Admin API
3. Applied 21 migrations via `supabase db push`
4. Imported data via temporary migration (then repaired stale migration entry)
5. Uploaded 60 images to storage buckets (36 platform assets + 13 agent portraits + 11 building images)
6. Updated image URLs in production DB via REST API with `sb_secret_` key

### MCP Configuration

`.mcp.json` configures two MCP servers:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "http://127.0.0.1:54321/mcp"
    },
    "supabase-prod": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=bffjoupddfjaljqrwqck"
    }
  }
}
```

- `mcp__supabase__*` tools → local development database
- `mcp__supabase-prod__*` tools → production database

### Authentication Differences

| Aspect | Local | Production |
|--------|-------|------------|
| Algorithm | HS256 | ES256 (ECC P-256) |
| Verification | Shared `JWT_SECRET` | JWKS endpoint |
| Token source | Local Supabase Auth | Hosted Supabase Auth |
| User creation | `supabase/seed/` SQL | Auth Admin API |

The backend `dependencies.py` handles both: it tries HS256 first (local), then falls back to ES256 with JWKS (production).

---

## 6. Migration Lessons Learned

These 12 issues were encountered during production deployments. They are documented here to prevent repeating them.

### Issue 1: Auth User Must Exist Before Data Migrations

**Problem:** Migration 016 inserts rows with `created_by_id` referencing `auth.users(id)`. If the auth user doesn't exist in production, FK constraints fail.

**Solution:** Create the auth user via the Supabase Auth Admin API before running data migrations:
```bash
curl -X POST "https://bffjoupddfjaljqrwqck.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@velgarien.dev", "password": "...", "email_confirm": true,
       "id": "00000000-0000-0000-0000-000000000001"}'
```

### Issue 2: Data-Only Migrations Reference Seed Data

**Problem:** Migrations 016 and 017 INSERT into tables expecting simulation rows from seed files (`supabase/seed/`). Seeds don't run on production — only migrations do.

**Solution:** Mark data-only migrations as applied in `schema_migrations` without executing them, then import data separately via the full export/import procedure.

### Issue 3: pg_dump COPY Format Incompatible with Management API

**Problem:** Default `pg_dump` output uses `COPY ... FROM stdin` format, which requires `psql` to import. The Supabase management API and `db push` can't process `COPY` commands.

**Solution:** Re-export with `--inserts` flag to get `INSERT INTO` statements instead.

### Issue 4: DISABLE TRIGGER ALL Requires Superuser

**Problem:** pg_dump emits `ALTER TABLE ... DISABLE TRIGGER ALL` / `ENABLE TRIGGER ALL`. On hosted Supabase, the `postgres` role is not a true superuser and cannot disable system triggers.

**Solution:** Replace `DISABLE TRIGGER ALL` with `DISABLE TRIGGER USER`. This disables only user-defined triggers while keeping FK constraint triggers active. Import order must respect FK dependencies.

### Issue 5: Comment Stripping Destroyed Data

**Problem:** A naive comment-stripping regex removed all lines starting with `--`. But INSERT values can contain strings like `'--- END EVENTS ---'` which also start with `--` when broken across lines. Stripping these corrupted the data.

**Solution:** Only strip lines matching `^-- ` (dash-dash-space) or bare `^--$` (empty comment). Never strip lines starting with `---` (three dashes), as these are likely data content.

### Issue 6: Multi-Line String Literals Break CLI Parser

**Problem:** Prompt templates contain text with embedded newlines. When exported as multi-line INSERT statements, the Supabase CLI's statement parser splits on `;` boundaries incorrectly, breaking statements mid-string.

**Solution:** Collapse embedded newlines to `\n` escape sequences and use PostgreSQL E-string syntax: `E'first line\nsecond line'`. The `export_for_production.py` script automates this.

### Issue 7: Cloudflare WAF Blocks SQL INSERT Payloads

**Problem:** The Supabase management API SQL endpoint (`/v1/projects/{ref}/database/query`) returns HTTP 403 (Cloudflare error 1010) for INSERT statements. Cloudflare's WAF interprets SQL INSERT payloads as SQL injection attacks.

**Solution:** Use `supabase db push` with a temporary migration file instead of the management API for data import. The CLI uses a different connection path that bypasses the WAF.

### Issue 8: Production Database is IPv6-Only

**Problem:** The direct database hostname `db.bffjoupddfjaljqrwqck.supabase.co` resolves to an AAAA (IPv6) record only. Local machines without IPv6 routing cannot connect. The connection pooler resolves to IPv4 but returns "Tenant not found" errors.

**Solution:** Use `supabase db push` (the CLI manages its own connection) or the management API for queries. Direct `psql` connections from local machines may not work without IPv6 support.

### Issue 9: Stale Temporary Migrations Block `db push`

**Problem:** After using a temporary migration file for data import (e.g., `99999999999999_temp_data_import.sql`), its version is recorded in production's `schema_migrations` table. Even after deleting the local file, `supabase db push` fails because it finds a remote migration version with no matching local file.

**Solution:** Use `migration repair` to mark the stale migration as reverted:
```bash
SUPABASE_ACCESS_TOKEN=sbp_... supabase migration repair --status reverted 20260225200000
```

Then retry `supabase db push`. This also applies if a migration was manually applied to production (e.g., via MCP) and later added as a migration file with a different timestamp — use `repair --status applied` to register it.

### Issue 10: MCP Tools Connect to Local DB, Not Production

**Problem:** The `mcp__supabase__*` tools in Claude Code always connect to the local Supabase instance (`127.0.0.1:54321`). Running UPDATE/INSERT statements via MCP modifies the local database, not production. This caused accidental local URL rewriting during a production deployment.

**Solution:** For production database modifications:
- **Individual rows:** Use the Supabase REST API with `sb_secret_` key via `curl`
- **Bulk operations:** Use a temporary migration file + `supabase db push`
- **Read queries:** The production MCP (`mcp__supabase-prod__*`) works for SELECT queries if connected

Never assume MCP tools target production. Always verify which database you're modifying.

### Issue 11: Railway Pauses Free/Trial Deploys Without Warning

**Problem:** After pushing to `main`, the Railway auto-deploy silently fails. No deployment appears in the deployment list. The `railway redeploy --yes` command returns `"We've paused free/trial deploys"`. Production continues serving the old build with no error indication.

**Solution:** Before pushing code to production, verify Railway account status:
```bash
# Check deployment list — if no new deploy appears after push, account may be paused
railway deployment list

# Verify which build is actually live
curl -s https://metaverse.center/ | grep "<title>"
```

If deploys are paused, check the Railway Dashboard for billing alerts and upgrade or add credits as needed. **Always verify the deploy actually happened** after pushing — don't assume auto-deploy worked.

### Issue 12: Image UUID Mismatch After Re-Generation

**Problem:** When images are re-generated locally (e.g., new Replicate runs), the UUID in the filename changes (each generation produces a new UUID). If the image files are transferred to production storage with the new UUIDs but the production DB still references the old UUIDs, images appear broken — even though the new files exist in storage.

**Example:**
```
Production DB:  .../agent-id/OLD-UUID.webp    ← points to deleted file
Storage:        .../agent-id/NEW-UUID.webp    ← actual file
```

**Solution:** After transferring images, **always update ALL image URLs** in the production DB — not just newly-added entities. Compare local URLs against production URLs for every entity:
```bash
# Compare local vs production UUIDs
docker exec supabase_db_velgarien-rebuild psql -U postgres -t -c \
  "SELECT name, split_part(portrait_image_url, '/', -1) FROM agents WHERE portrait_image_url IS NOT NULL ORDER BY name"

curl -s "$PROD_URL/rest/v1/agents?portrait_image_url=not.is.null&select=name,portrait_image_url" \
  -H "Authorization: Bearer $SECRET_KEY" -H "apikey: $SECRET_KEY"
```

Any UUID mismatch means the production DB URL needs updating via the REST API.

---

## 7. Deployment Workflow

### Git Branching Strategy

Railway auto-deploys on push to `main` (filtered by watch patterns). Use feature branches to commit without triggering production builds:

```bash
# Work on a branch — no production deploy
git checkout -b feature/my-change
# ... make changes, commit, push ...
git push -u origin feature/my-change

# When ready to deploy, merge to main
git checkout main
git merge feature/my-change
git push origin main
# → Railway builds only if watch patterns match
```

**What triggers a Railway deploy** (watch patterns in `railway.toml`):
- Changes to `backend/**`, `frontend/**`, `Dockerfile`, `pyproject.toml`

**What does NOT trigger a deploy:**
- Spec docs (`*.md`), scripts (`scripts/`), Supabase config (`supabase/`), seed files, `railway.toml` itself, `.mcp.json`, `.env*`

### Full Production Update Checklist

When deploying changes that include schema, data, and code:

```
1. Schema migrations     →  supabase db push
2. Data migration        →  export → clean → push as temp migration
3. Image file transfer   →  upload to production storage buckets
4. URL rewriting         →  run URL rewrite SQL on production DB
5. Code deploy           →  merge to main + push (Railway auto-builds)
```

**Order matters:** Schema must be in place before data that depends on it. Code goes last so the new backend matches the new schema.

#### Step 1: Schema Migrations

```bash
# Requires SUPABASE_ACCESS_TOKEN env var
supabase db push
```

Only applies migrations not yet in production's `schema_migrations` table.

#### Step 2: Data Migration

```bash
# Export from local
docker exec supabase_db_velgarien-rebuild pg_dump -U postgres \
  --data-only --schema=public --no-owner --no-privileges \
  --inserts --rows-per-insert=1 \
  --exclude-table=supabase_migrations.schema_migrations \
  postgres > /tmp/velgarien_export.sql

# Clean for production compatibility
python3.13 scripts/export_for_production.py /tmp/velgarien_export.sql /tmp/velgarien_clean.sql

# Prepend TRUNCATE CASCADE if replacing existing data (see Section 3, Step 4)

# Push as temporary migration
cp /tmp/velgarien_clean.sql supabase/migrations/99999999999999_temp_data_import.sql
supabase db push
rm supabase/migrations/99999999999999_temp_data_import.sql
```

#### Step 3: Image Files

Upload new images to production storage buckets (requires `service_role` key). See Section 3, Image File Transfer.

#### Step 4: URL Rewriting

Run the URL rewrite SQL from Section 2 against the production database (via MCP or temp migration).

#### Step 5: Code Deploy

```bash
git checkout main
git merge feature/my-change
git push origin main
# Railway detects changes in watch patterns and auto-builds
```

**Verify deploy succeeded** (Railway can silently skip deploys if account is paused):
```bash
railway deployment list                              # New entry should appear
curl -s https://metaverse.center/ | grep "<title>"   # Should reflect new build
```

### Code-Only Deploy (No Data Changes)

Most deploys are code-only. Just merge to `main` and push:

```bash
git checkout main
git merge feature/my-change
git push origin main
```

**Always verify the deploy actually happened:**
```bash
# 1. Check Railway triggered a new deployment
railway deployment list
# → Look for a new entry with BUILDING or SUCCESS status after your push timestamp

# 2. Verify production serves the new build (check HTML title, asset hashes, etc.)
curl -s https://metaverse.center/ | grep "<title>"

# 3. Health check
curl -s https://metaverse.center/api/v1/health
```

If no new deployment appears, Railway may have paused deploys (billing/trial limit). Check the Railway Dashboard. See Issue 11.

### Schema-Only Deploy (No Code Changes)

```bash
supabase db push
```

No Railway build triggered since `supabase/migrations/` is not in the watch patterns.

---

## 8. Operational Runbook

### Health Checks

```bash
# Backend health endpoint
curl -s https://metaverse.center/api/v1/health

# Supabase health (returns project status)
curl -s https://bffjoupddfjaljqrwqck.supabase.co/rest/v1/ \
  -H "apikey: $SUPABASE_ANON_KEY"

# Local backend
curl -s http://localhost:8000/api/v1/health

# Local Supabase
supabase status
```

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 401 on production API | JWT expired or wrong audience | Re-authenticate; check `SUPABASE_JWT_SECRET` matches |
| Images broken on production | Localhost URLs in DB | Run URL rewrite SQL (Section 2) |
| `supabase db push` hangs | Network/IPv6 issues | Check `SUPABASE_ACCESS_TOKEN` is set; retry |
| Railway deploy fails | Build error | Check Dockerfile; ensure `npm run build` succeeds locally |
| RLS policy denied | Missing simulation_members row | Verify user is a member of the simulation |
| ERR_TOO_MANY_REDIRECTS | Cloudflare SSL set to "Flexible" | Change to **Full (strict)** in Cloudflare SSL/TLS settings |
| Port 8000/5173 in use (local) | Orphaned processes | Follow Server Restart sequence in CLAUDE.md |
| `db push` fails: "Remote migration versions not found" | Stale temp migration in production | `supabase migration repair --status reverted <version>` |
| MCP UPDATE modified local DB instead of production | MCP tools are local-only | Use REST API with `sb_secret_` key for production modifications |
| Push to main but production unchanged | Railway paused free/trial deploys | Check Railway Dashboard billing; `railway deployment list` to verify |
| Images uploaded but broken on production | UUID mismatch after re-generation | Update ALL image URLs in production DB, not just new ones |

### Credentials Reference

**No credentials are stored in this document or in version control.**

#### Supabase API Keys (New Format)

Supabase has transitioned from legacy JWT-based keys to a new key format. Both are available on the dashboard:

| Key Type | Format | Where to Find | Purpose |
|----------|--------|---------------|---------|
| **Secret key** | `sb_secret_...` | Dashboard → Settings → API → "Secret keys" | Server-side operations: storage uploads, direct DB access via REST API, admin operations |
| **Publishable key** | `sb_publishable_...` | Dashboard → Settings → API → "Publishable key" | Client-side: safe for browser, used with RLS |
| **Legacy anon key** | `eyJhbGci...` (JWT) | Dashboard → Settings → API (scroll down) | Same as publishable, older format |
| **Legacy service_role key** | `eyJhbGci...` (JWT) | Dashboard → Settings → API (scroll down) | Same as secret, older format |

**Railway env vars** still use the legacy JWT format (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Both formats work for API calls — the new `sb_secret_` key can be used as `Authorization: Bearer sb_secret_...` and as `apikey: sb_secret_...` interchangeably with the legacy JWT keys.

#### SUPABASE_ACCESS_TOKEN (CLI Authentication)

This is a **separate credential** from the API keys. It authenticates the `supabase` CLI for commands like `db push`, `migration list`, etc.

| Step | Action |
|------|--------|
| 1 | Go to [supabase.com/dashboard](https://supabase.com/dashboard) |
| 2 | Click your **avatar** (top-right corner) |
| 3 | Select **"Access Tokens"** |
| 4 | Generate or copy a token (format: `sbp_...`) |

**Usage:** Either set as env var or pass inline:
```bash
# Option 1: Export for session
export SUPABASE_ACCESS_TOKEN=sbp_your_token_here

# Option 2: Inline per command
SUPABASE_ACCESS_TOKEN=sbp_... supabase db push
```

#### Complete Credentials Map

| Credential | Format | Where to Find | Used For |
|------------|--------|---------------|----------|
| Supabase secret key | `sb_secret_...` | Dashboard → Settings → API | Storage API, REST API (server-side) |
| Supabase publishable key | `sb_publishable_...` | Dashboard → Settings → API | Frontend Supabase client |
| Supabase access token | `sbp_...` | Dashboard → Avatar → Access Tokens | CLI: `supabase db push`, `migration list` |
| Legacy anon key | JWT (`eyJ...`) | Dashboard → Settings → API | Railway `SUPABASE_ANON_KEY` env var |
| Legacy service_role key | JWT (`eyJ...`) | Dashboard → Settings → API | Railway `SUPABASE_SERVICE_ROLE_KEY` env var |
| JWT secret | string | Dashboard → Settings → API → JWT Settings | Railway `SUPABASE_JWT_SECRET` env var |
| Railway env vars | varies | Railway Dashboard → metaverse-center → Variables | Backend config |
| Production user | email/password | `admin@velgarien.dev` | Auth for production API calls |

See `.env.production.example` for the full list of required environment variables.

---

## References

- [00_PROJECT_OVERVIEW.md](./00_PROJECT_OVERVIEW.md) — Project context and architecture
- [03_DATABASE_SCHEMA_NEW.md](./03_DATABASE_SCHEMA_NEW.md) — Complete schema (27 tables)
- [10_AUTH_AND_SECURITY.md](./10_AUTH_AND_SECURITY.md) — Auth and JWT details
- [CLAUDE.md](./CLAUDE.md) — Development commands and patterns
