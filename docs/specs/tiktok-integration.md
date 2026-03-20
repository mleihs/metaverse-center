# TikTok Integration — Complete Implementation Plan

## Context

Instagram and Bluesky publishing pipelines are production-ready. TikTok is the third social media outlet, following the identical cross-posting pattern. **Decision: plan now, build after TikTok app approval** (6-10 week approval timeline). The image proxy approach uses a FastAPI route through `metaverse.center` to satisfy TikTok's domain verification requirement.

**TikTok API reality check (2025-2026 developer feedback):**
- 13% failure rate across 235K attempts (Zernio data)
- 3-stage approval: App Review → Scope Approval → Direct Post Audit
- No delete/edit/schedule endpoints — publish-only
- Documentation has errors and gaps, developer support is non-existent
- Content moderation more aggressive via API than native app
- 24h access token lifecycle (365d refresh token)

---

## Part 0: TikTok Developer App Registration Guide

### Prerequisites
- A TikTok account (business or creator account recommended)
- A live website with Privacy Policy and Terms of Service pages
- The website must be on a domain you control (metaverse.center)

### Step 1: Create Developer Account (Day 1)
1. Go to https://developers.tiktok.com/
2. Click "Log in" → sign in with TikTok account
3. Complete developer registration (company/individual info)
4. Accept Developer Terms of Service

### Step 2: Create App (Day 1)
1. Dashboard → "Manage Apps" → "Create App"
2. Fill in:
   - **App name**: `metaverse.center`
   - **App icon**: Use Bureau logo (256x256 PNG)
   - **App description**: "AI-powered worldbuilding platform that publishes generated content across social channels"
   - **Website URL**: `https://metaverse.center`
   - **Terms of Service URL**: `https://metaverse.center/terms`
   - **Privacy Policy URL**: `https://metaverse.center/privacy`
   - **Category**: Entertainment / Media
   - **Platform**: Web
3. Note down `client_key` and `client_secret` — store in platform_settings (encrypted)

### Step 3: Configure Products & Scopes (Day 1)
1. In app settings → "Add Products"
2. Enable **Login Kit** (required for OAuth)
3. Enable **Content Posting API**
4. Request scopes:
   - `user.info.basic` — read user profile
   - `video.publish` — publish content (Direct Post)
   - `video.list` — read post metrics
5. Set **Redirect URI**: `https://metaverse.center/api/v1/admin/tiktok/oauth/callback`

### Step 4: Domain Verification (Day 1-3)
1. In app settings → "URL Properties" → "Add URL"
2. Add `https://metaverse.center`
3. Choose DNS verification method:
   - Add TXT record to metaverse.center DNS with the provided signature
   - Wait for propagation (up to 72h, usually <1h with Cloudflare)
4. Click "Verify" once DNS propagates
5. This covers all subpaths including `/api/v1/media/proxy/...`

### Step 5: Submit App Review (Day 2-3)
1. Go to app settings → "Submit for Review"
2. Requirements:
   - All fields from Step 2 completed
   - Privacy Policy + TOS links live and accessible
   - Working website (metaverse.center is already live)
3. **Demo video required**: Record a 2-3 min screencast showing:
   - The admin panel Social tab
   - How content is generated and queued
   - The TikTok Configure tab with credential entry
   - A mock publish flow (can use sandbox)
4. Upload video + description of how the API will be used
5. Submit — expect response in **5-14 business days**

### Step 6: Content Posting Scope Approval (After App Review passes)
1. May be automatically approved with App Review
2. If separate: requires additional scope justification
3. Timeline: **5-10 business days**

### Step 7: Direct Post Audit (After Scope Approval)
This is the final gate — without it, all posts are forced to `SELF_ONLY` (private).

1. Go to "Content Posting API" → "Apply for Direct Post"
2. Submit required materials:
   - **UX mockups** (PDF): Screenshots of the admin panel TikTok tab, showing the complete posting workflow from queue to publish confirmation
   - **Screen recording**: Full end-to-end flow — content selection → caption editing → publish → status confirmation
   - **Data fields documentation**: List all API response fields you store (tiktok_post_id, metrics, etc.)
   - **Estimated daily upload volume**: Honest estimate (e.g., "3-5 posts per day")
   - **Content type description**: "AI-generated worldbuilding content — character portraits, architecture images, narrative dispatches"
3. **IMPORTANT**: Create original materials — TikTok rejects template/example PDFs
4. Submit — expect response in **2-4 weeks**

### Step 8: Sandbox Testing (During approval wait)
- Sandbox mode works WITHOUT full approval
- Domain verification NOT required in sandbox
- All posts go to drafts/private — but you can test the full API flow
- Use sandbox to build and validate the integration code

### Step 9: Go Live (After Direct Post Audit passes)
1. Switch from sandbox to production in app settings
2. Set `tiktok_enabled` and `tiktok_posting_enabled` to true in platform_settings
3. First posts will go through TikTok's content moderation (usually <1 min, sometimes hours)
4. Monitor for moderation rejections — API moderation is stricter than native app

### Timeline Summary
| Gate | Expected Duration | Cumulative |
|------|-------------------|------------|
| Account + App creation | 1 day | Day 1 |
| Domain verification | 1-3 days | Day 2-4 |
| App Review | 5-14 business days | Week 2-4 |
| Scope Approval | 5-10 business days | Week 3-5 |
| Direct Post Audit | 2-4 weeks | Week 5-9 |
| **Total to first public post** | **5-9 weeks** | — |

### Tips from Developers Who've Been Through This
- Start the approval process BEFORE writing code — it's on the critical path
- Keep the demo video simple and professional, show exactly what TikTok expects
- Be transparent about AI-generated content — TikTok has a dedicated `is_aigc` flag
- If review is rejected, response times for re-review are faster (3-5 days)
- The sandbox bypass for domain verification is invaluable for development

---

## Part 1: New Files

### `backend/services/external/tiktok.py` — AT Protocol client
Pattern: `backend/services/external/bluesky.py`

**Exception hierarchy:**
- `TikTokAPIError(message, status_code, error_code)` — base
- `TikTokAuthError` — token expired/invalid
- `TikTokRateLimitError` — 429 / 6 req/min
- `TikTokModerationError` — content rejected
- `TikTokDomainError` — unverified domain

**Token dataclass:**
```python
@dataclass
class _TikTokTokens:
    access_token: str
    refresh_token: str
    expires_at: datetime  # UTC
    open_id: str
```

**Class `TikTokService`** implements `SocialPlatformClient`:
- `__init__(client_key, client_secret, tokens, on_token_refresh: Callable)`
- `ensure_token()` — proactive refresh when <1h from expiry. Calls callback to persist new tokens
- `_refresh_token() → _TikTokTokens` — POST `/v2/oauth/token/` with `grant_type=refresh_token`. CRITICAL: store returned `refresh_token` (TikTok issues new one each time)
- `query_creator_info() → dict` — POST `/v2/post/publish/creator_info/query/`. Must call before every publish
- `publish_post(content, media) → PublishResult` — POST `/v2/post/publish/content/init/` with `post_mode=DIRECT_POST`, `media_type=PHOTO`, `is_aigc=true`. Returns `publish_id`
- `poll_publish_status(publish_id) → dict` — POST `/v2/post/publish/status/fetch/`. Returns status + `publicly_available_post_id`
- `upload_media(data, mime_type) → UploadedMedia` — TikTok uses PULL_FROM_URL, so this constructs proxy URL and returns `UploadedMedia(ref={"url": proxy_url})`
- `get_post_metrics(post_id) → dict` — POST `/v2/video/query/` → `{views, likes, comments, shares}`
- `validate_credentials() → bool` — attempt `query_creator_info()`, return True/False
- `_api_post(path, json_body) → dict` — internal with retry (3x), exponential backoff (2s base), typed error checking
- `_check_response(resp)` — parse TikTok error format, map to typed exceptions, log + Sentry

Constants: `BASE_URL = "https://open.tiktokapis.com"`, `TIMEOUT = 30s`, `TITLE_MAX = 90`, `DESC_MAX = 4000`

### `backend/services/tiktok_content_service.py` — Content service
Pattern: `backend/services/bluesky_content_service.py`

**Class `TikTokContentService`** (classmethod-based, stateless):
- `PIPELINE_SETTINGS_KEYS` = [tiktok_enabled, tiktok_posting_enabled, tiktok_client_key, tiktok_client_secret, tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at, tiktok_auto_crosspost, tiktok_scheduler_interval_seconds, tiktok_creator_open_id]
- `adapt_instagram_post(admin, tiktok_post_id)` — load IG source caption → split into title (90 chars) + description (4000 chars) → append filtered hashtags → update DB
- `_adapt_title(full_caption) → str` — extract DISPATCH header line, truncate to 90 chars at word boundary
- `_adapt_description(full_caption) → str` — strip footer/disclosure, keep full body. Append community hashtags (5-8 tags, more generous than Bluesky's 3)
- Queue management: `list_queue`, `get_post`, `skip_post`, `unskip_post`, `reset_post_status` — identical signatures to Bluesky
- `update_engagement_metrics(admin, post_id, metrics)` — views, likes, comments, shares
- `get_analytics(admin, days)` — calls `fn_tiktok_analytics` RPC
- `get_pipeline_settings(admin)` / `load_tiktok_credentials(admin)` — same pattern as Bluesky
- `save_refreshed_tokens(admin, tokens)` — persist new access/refresh tokens after OAuth refresh, encrypt before storing

### `backend/services/tiktok_scheduler.py` — Background scheduler
Pattern: `backend/services/bluesky_scheduler.py`

**Class `TikTokScheduler`** — asyncio background task:
- Same loop: `while True: load_config → process_due → poll_publishing → collect_metrics → sleep`
- **Key additions vs Bluesky:**
  1. Token refresh in `_load_config` — check `token_expires_at`, refresh proactively if <1h
  2. `_poll_publishing_posts(admin, config)` — NEW phase: find posts with `status='publishing'`, poll TikTok status API, update to `published` or `failed`. Timeout: 30 min → mark failed
  3. Rate limit tracking — sliding window counter, max 6 req/min
  4. Media proxy URL construction — parse Supabase URLs → `metaverse.center/api/v1/media/proxy/...`
  5. Image format validation — reject PNG, convert if needed via Pillow
- Token refresh callback: passes `TikTokContentService.save_refreshed_tokens` to `TikTokService`

### `backend/routers/tiktok.py` — Admin endpoints
Pattern: `backend/routers/bluesky.py`

Router prefix: `/api/v1/admin/tiktok`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/queue` | list with status filter |
| GET | `/queue/{id}` | single post |
| POST | `/queue/{id}/skip` | skip |
| POST | `/queue/{id}/unskip` | unskip |
| POST | `/queue/{id}/publish` | force-publish |
| GET | `/analytics` | aggregated metrics |
| GET | `/settings` | pipeline config |
| GET | `/status` | validate credentials |

All require `require_platform_admin()`. Same helpers, audit logging, response wrappers.

### `backend/routers/media_proxy.py` — Domain-verified image proxy
**New router** — serves Supabase Storage images through metaverse.center domain.

```
GET /api/v1/media/proxy/{bucket}/{path:path}
```

- Streams from Supabase Storage via httpx
- Allowlist buckets: `["simulation.assets"]`
- `Cache-Control: public, max-age=3600` (TikTok needs 1h access)
- No auth required (images are public)
- Correct `Content-Type` from source
- Rate limited per IP to prevent abuse
- Never expose internal paths, return 404 on missing files

### `backend/models/tiktok.py` — Pydantic models
Pattern: `backend/models/bluesky.py`

- `TikTokPostResponse` — id, instagram_post_id, simulation_id, content_source_type/id, title (90), description (4000), alt_text, image_urls[], status, scheduled_at, published_at, failure_reason, retry_count, tiktok_publish_id, tiktok_post_id, likes/comments/shares/views counts, metrics_updated_at, unlock_code, timestamps
- `TikTokQueueItem(TikTokPostResponse)` — + simulation_name/slug/theme, instagram_permalink/status
- `TikTokAnalytics` — period_days, total_posts/pending/failed/skipped, avg_likes, total_comments/shares/views, engagement_by_type

### `supabase/migrations/XXXXXXXX_144_tiktok_integration.sql` — Database

**Table `tiktok_posts`:** Same structure as `bluesky_posts` but with:
- `title text` — 90-char TikTok title (new, not in Bluesky)
- `description text NOT NULL` — 4000-char body (replaces `caption`)
- `tiktok_publish_id text` — from content/init response (for status polling)
- `tiktok_post_id text` — publicly_available_post_id after moderation
- Metrics: `likes_count`, `comments_count`, `shares_count`, `views_count`
- Extra index: `idx_tiktok_posts_publishing(created_at) WHERE status = 'publishing'` for polling phase

**View `v_tiktok_queue`:** JOIN simulations + instagram_posts (same as v_bluesky_queue)

**Update `v_instagram_queue`:** Add `tiktok_status` subquery alongside `bsky_status`

**Trigger `fn_crosspost_to_tiktok()`:** AFTER UPDATE on instagram_posts, fires on status → 'scheduled'. Same guards as Bluesky (check enabled + auto_crosspost + dedup). Placeholder title/description truncation (Python adapts later). Uses `COALESCE(image_urls, '{}'::text[])`.

**RPC `fn_tiktok_analytics(p_days)`:** Same as Bluesky but with views/comments/shares.

**Platform settings:** 10 keys (enabled, posting_enabled, client_key, client_secret, access_token, refresh_token, token_expires_at, auto_crosspost, scheduler_interval, creator_open_id)

**RLS:** `is_platform_admin()` — same as all other social tables.

### `frontend/src/components/admin/AdminTikTokTab.ts` — Admin UI
Pattern: `frontend/src/components/admin/AdminBlueskyTab.ts`

Three sub-tabs: Operations | Configure | Intelligence

**Differences from Bluesky:**
- Connection card: shows creator username + token expiry countdown
- Configure → Credentials: client_key + client_secret inputs (not handle/PDS)
- Configure → OAuth: token status display, "Refresh Now" button
- Operations: dispatch cards show `title` prominently, `description` as body preview. Posts in `publishing` show "Moderating..." indicator
- Intelligence: TikTok metrics (views, likes, comments, shares — not reposts/quotes)

---

## Part 2: Modified Files

### `backend/services/social/types.py`
Add `title: str | None = None` to `AdaptedContent`. Backward-compatible.

### `backend/app.py`
- Import `TikTokScheduler` + `tiktok` router + `media_proxy` router
- Add `tiktok_task = await TikTokScheduler.start()` in lifespan
- Mount both routers

### `backend/models/instagram.py`
Add `tiktok_status: str | None = None` to `InstagramQueueItem`

### `frontend/src/components/admin/AdminSocialTab.ts`
- Import `AdminTikTokTab.js`
- Extend `SocialChannel` type with `'tiktok'`
- Add third channel button with TikTok icon

### `frontend/src/services/api/AdminApiService.ts`
- Add 8 TikTok API methods (list/get/skip/unskip/publish/analytics/settings/status)
- Add TypeScript interfaces: `TikTokQueueItem`, `TikTokAnalytics`, `TikTokConnectionStatus`, `TikTokPipelineSettings`
- Add `tiktok_status` to `InstagramQueueItem`

### `frontend/src/utils/icons.ts`
Add `tiktok` SVG icon (Lucide-style music note)

---

## Part 3: Implementation Sequence

1. **Database migration** (must be first)
2. **Shared types** (`AdaptedContent.title`)
3. **Media proxy router** (independent, can test immediately)
4. **API client** (`external/tiktok.py`)
5. **Content service** (`tiktok_content_service.py`)
6. **Scheduler** (`tiktok_scheduler.py`)
7. **Models** (`tiktok.py`)
8. **Router** (`routers/tiktok.py`)
9. **App registration** (`app.py` lifespan + router mount)
10. **Instagram model update** (tiktok_status)
11. **Frontend icon** → **TikTok tab** → **Social tab update** → **API service update**

---

## Part 4: Verification

1. `ruff check` on all modified/new Python files
2. `npx tsc --noEmit` in frontend
3. `frontend/scripts/lint-color-tokens.sh`
4. Sandbox testing: create TikTok app in sandbox mode → test full publish flow (posts go to drafts, not public)
5. Production testing (after audit approval): approve an Instagram draft → verify tiktok_posts row created by trigger → verify scheduler adapts caption and publishes → verify post appears on TikTok → verify metrics collection

---

## Part 5: Key Design Decisions

1. **`title` on `AdaptedContent`** — extends the shared protocol rather than creating a TikTok-specific type. Other platforms ignore it
2. **FastAPI media proxy** — simpler than CDN, no infra changes, reusable for future platforms with domain verification
3. **`publishing` status with polling phase** — new scheduler phase (`_poll_publishing_posts`) handles TikTok's async moderation within the existing loop
4. **Token refresh in scheduler** — centralized, no race conditions, proactive (1h before expiry)
5. **Separate `title` + `description` columns** — TikTok surfaces these differently. Storing separately enables independent editing in admin panel
6. **No delete handling** — TikTok has no delete API. Failed posts can only be skipped, not cleaned up. Admin panel should surface this limitation
7. **Image format enforcement** — validate JPEG/WebP before proxy. Convert PNG via Pillow if found (reuse Bluesky's `_recompress_jpeg` pattern)
