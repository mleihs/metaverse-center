---
title: "Production Deployment Procedures"
version: "1.0"
type: guide
status: active
lang: en
---

# Production Deployment Procedures

## Supabase Credentials (Where to Find)

| Credential | Format | Location |
|------------|--------|----------|
| Secret key | `sb_secret_...` | Dashboard → Settings → API → "Secret keys" |
| Publishable key | `sb_publishable_...` | Dashboard → Settings → API → "Publishable key" |
| Access token (CLI) | `sbp_...` | Dashboard → Avatar (top-right) → Access Tokens |
| Legacy JWT keys | `eyJhbGci...` | Dashboard → Settings → API (scroll down) |
| JWT secret | string | Dashboard → Settings → API → JWT Settings |
| Railway env vars | varies | Railway Dashboard → metaverse-center → Variables |
| Railway API token | UUID | `ff9752d8-3462-4bb7-8516-6199bc6284b6` (Account Settings → Tokens) |

Production user: `matthias@leihs.at`
Production project ref: `bffjoupddfjaljqrwqck`
Production URL: `https://bffjoupddfjaljqrwqck.supabase.co`
App URL: `https://metaverse.center`

## Railway API (GraphQL)

Endpoint: `https://backboard.railway.app/graphql/v2`
Auth header: `Authorization: Bearer ff9752d8-3462-4bb7-8516-6199bc6284b6`

| Entity | ID |
|--------|----|
| User | `55845245-de70-46c5-bead-cf3f34327ee0` |
| Workspace | `68f0903f-57a7-4ebb-bac8-bd116037910c` (mleihs's Projects) |
| Project | `572794ed-40e2-4e8b-94a4-862041c4be7b` (metaverse.center) |
| Service | `4235fe36-8790-4ba7-954b-ea1670292d4f` (metaverse-center) |

```bash
# Get latest deployment
curl -s -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer ff9752d8-3462-4bb7-8516-6199bc6284b6" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ deployments(first: 1, input: { projectId: \"572794ed-40e2-4e8b-94a4-862041c4be7b\", serviceId: \"4235fe36-8790-4ba7-954b-ea1670292d4f\" }) { edges { node { id status createdAt meta } } } }"}'

# Get build logs for a deployment
curl -s -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer ff9752d8-3462-4bb7-8516-6199bc6284b6" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ buildLogs(deploymentId: \"DEPLOYMENT_ID\", filter: \"\", limit: 200) { ... on Log { message timestamp severity } } }"}'
```

## Push Migrations to Production

```bash
SUPABASE_ACCESS_TOKEN=sbp_... supabase db push
```

If it fails with "Remote migration versions not found":
```bash
SUPABASE_ACCESS_TOKEN=sbp_... supabase migration repair --status reverted <VERSION>
```

If a migration was already applied manually (e.g., via MCP):
```bash
SUPABASE_ACCESS_TOKEN=sbp_... supabase migration repair --status applied <VERSION>
```

## Modify Production DB

**CRITICAL: MCP tools (`mcp__supabase__*`) are LOCAL ONLY. Never use them for production changes.**

For individual rows — use REST API with secret key:
```bash
curl -X PATCH "https://bffjoupddfjaljqrwqck.supabase.co/rest/v1/TABLE?id=eq.UUID" \
  -H "Authorization: Bearer sb_secret_..." \
  -H "apikey: sb_secret_..." \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"column": "value"}'
```

For bulk operations — use temporary migration + `supabase db push`.

## Transfer Images Local → Production

### Quick method: Python transfer script

For bulk transfers, use a Python script (see `/tmp/transfer_station_null.py` as template). Key pattern:
1. Query production for entity IDs via REST API (they differ from local — auto-generated UUIDs)
2. Download each image from local `http://127.0.0.1:54321/storage/v1/object/public/BUCKET/path`
3. Upload to production with `x-upsert: true` using the **production entity ID** in the storage path
4. Update production DB URL column via REST API PATCH

```python
# Upload pattern (Python urllib):
req = urllib.request.Request(
    f"{PROD_URL}/storage/v1/object/{bucket}/{storage_path}",
    data=image_bytes, method="POST",
    headers={
        "Authorization": f"Bearer {PROD_KEY}",
        "apikey": PROD_KEY,
        "Content-Type": "image/avif",
        "x-upsert": "true",
    },
)
```

### Manual method: curl

1. **Download from local** (public — no auth):
   ```bash
   curl -o /tmp/img.avif "http://127.0.0.1:54321/storage/v1/object/public/BUCKET/path"
   ```

2. **Upload to production** (requires secret key — legacy JWT or `sb_secret_`):
   ```bash
   curl -X POST "$PROD_URL/storage/v1/object/BUCKET/path" \
     -H "Authorization: Bearer $SECRET_KEY" -H "apikey: $SECRET_KEY" \
     -H "Content-Type: image/avif" -H "x-upsert: true" \
     --data-binary @/tmp/img.webp
   ```

3. **Update DB URLs** — via REST API PATCH (see Modify Production DB section), NOT via MCP.

4. **Clean old files** (optional):
   ```bash
   curl -X DELETE "$PROD_URL/storage/v1/object/BUCKET" \
     -H "Authorization: Bearer $SECRET_KEY" -H "apikey: $SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"prefixes": ["path/to/file.webp"]}'
   ```

### Critical: Production IDs differ from local

Migrations create entities without explicit UUIDs → production gets auto-generated IDs.
**Always query production** for IDs before transferring — match by name.

```bash
# Get production agent IDs:
curl -s "$PROD_URL/rest/v1/agents?simulation_id=eq.SIM_ID&select=id,name" \
  -H "Authorization: Bearer $SECRET_KEY" -H "apikey: $SECRET_KEY"
```

### Auth key for storage uploads

The legacy JWT service_role key (from Railway `SUPABASE_SERVICE_ROLE_KEY` env var) works for storage uploads.
Get it with: `railway variables --json | python3 -c "import sys,json; print(json.load(sys.stdin)['SUPABASE_SERVICE_ROLE_KEY'])"`

### Verify all images after transfer

```bash
# Check all portrait URLs return HTTP 200:
curl -s "$PROD_URL/rest/v1/agents?simulation_id=eq.SIM_ID&select=name,portrait_image_url" \
  -H "Authorization: Bearer $KEY" -H "apikey: $KEY" | python3 -c "
import sys, json, urllib.request
for a in json.load(sys.stdin):
    req = urllib.request.Request(a['portrait_image_url'], method='HEAD')
    resp = urllib.request.urlopen(req)
    print(f'{a[\"name\"]}: {resp.status}')
"
```

**Gotcha:** When images are re-generated locally, the UUID in the filename changes. The production DB may still reference the old UUID. Always update ALL image URLs after transferring, not just newly-added ones.

## Code Deploy

```bash
git push origin main  # Railway auto-deploys if backend/ or frontend/ changed
```

**ALWAYS verify deploy actually happened:**
```bash
railway deployment list                              # New entry should appear
curl -s https://metaverse.center/ | grep "<title>"   # Should reflect new build
curl -s https://metaverse.center/api/v1/health       # Health check
```

**Railway can silently skip deploys** if the account is paused (free/trial limit).
Check Railway Dashboard for billing alerts. `railway redeploy --yes` will also fail
with "We've paused free/trial deploys" in this case.

## Key Gotchas (Quick Reference)

1. **MCP is local only** — `mcp__supabase__*` hits `127.0.0.1:54321`, never production
2. **Railway deploy silence** — paused accounts don't error on push, just skip the build
3. **Image UUIDs change** — re-generated images get new filenames; must update ALL DB URLs
4. **Stale temp migrations** — `migration repair --status reverted` before `db push`
5. **Migration already applied** — `migration repair --status applied` to register it
6. **Production entity IDs differ from local** — migrations auto-generate UUIDs; always query production by name to get IDs before image transfer
7. **Out-of-order migrations** — `ensure_dev_user` has early timestamp; `supabase db push` rejects it. Use `migration repair --status applied` to skip it if the user already exists on production
8. **Zsh incompatibility** — `declare -A` (bash associative arrays) fails in zsh. Use Python for complex scripting involving maps/dicts
9. **NEVER hardcode agent/building UUIDs in migrations** — see below

## CRITICAL: Never Hardcode Entity UUIDs in Migrations

**Problem:** Migrations that INSERT seed/demo data referencing agents, buildings, or other auto-generated entities by hardcoded UUID will FAIL on production. Local and production databases have different auto-generated UUIDs because migrations use `DEFAULT gen_random_uuid()`.

**Entities with STABLE IDs (safe to hardcode):**
- Simulations — deterministic pattern `N0000000-0000-0000-0000-000000000001`
- Cities — deterministic pattern `c000000N-...`
- Zones — deterministic pattern `a000000X-...`
- Test user — always `00000000-0000-0000-0000-000000000001`

**Entities with AUTO-GENERATED IDs (NEVER hardcode):**
- Agents — `gen_random_uuid()`, different per environment
- Buildings — `gen_random_uuid()`, different per environment
- Events — `gen_random_uuid()`, different per environment
- Any entity without explicit UUID in its INSERT

**Solution: Use name-based subqueries instead of hardcoded UUIDs:**

```sql
-- BAD: hardcoded agent UUID (fails on production)
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, ...)
VALUES ('10000000-...', 'local-agent-uuid-1', 'local-agent-uuid-2', ...);

-- GOOD: name-based lookup (works everywhere)
INSERT INTO agent_relationships (simulation_id, source_agent_id, target_agent_id, ...)
SELECT '10000000-...', src.id, tgt.id, rel.rtype, ...
FROM (VALUES
  ('Elena Voss', 'General Aldric Wolf', 'rival', ...)
) AS rel(src_name, tgt_name, rtype, ...)
JOIN agents src ON src.name = rel.src_name AND src.simulation_id = '10000000-...'
JOIN agents tgt ON tgt.name = rel.tgt_name AND tgt.simulation_id = '10000000-...'
ON CONFLICT DO NOTHING;
```

**This pattern was learned the hard way** — migration 026 initially hardcoded local agent UUIDs for demo relationships, causing FK violations on `supabase db push`. Fixed by replacing all agent UUID references with `JOIN agents ON name`.

## Supabase Access Token (for `supabase db push`)

```
SUPABASE_ACCESS_TOKEN=sbp_8caf5a4e7a95d315d0799e33489b35328d409bee supabase db push
```

## Querying Current State

Rather than hardcoding counts (which go stale within days), query live:

```bash
# Migration count
ls supabase/migrations/ | wc -l

# Simulations + entity counts
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "
  SELECT s.name, s.slug,
    (SELECT count(*) FROM agents a WHERE a.simulation_id = s.id AND a.deleted_at IS NULL) AS agents,
    (SELECT count(*) FROM buildings b WHERE b.simulation_id = s.id AND b.deleted_at IS NULL) AS buildings
  FROM simulations s WHERE s.status = 'active' ORDER BY s.name;
"

# Storage object count
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SELECT count(*) FROM storage.objects;"

# i18n string count
wc -l frontend/src/locales/generated/de.ts

# API endpoint count
grep -r '@router\.' backend/routers/ | wc -l
```

## Known Gotcha: Cloudflare Cache

After deploying changes to static assets or new endpoints at root paths (like `/robots.txt`), Cloudflare may serve cached old responses for up to 4 hours (`max-age=14400`). Verify with cache-busting query param: `curl "https://metaverse.center/robots.txt?_=$(date +%s)"`
