# Bureau Social Media Presence — Feature Design Document

> Version: 2.1 — 2026-03-20
> Status: **Phase 1+2+3 LIVE on Instagram + Bluesky** / TikTok Planned

---

## Implementation Status

### Phase 1: API Foundation & Content Pipeline — COMPLETE

| Component | File | Status |
|-----------|------|--------|
| **Database** | `migrations/135_instagram_integration.sql` | DONE — `instagram_posts` table, RLS, indexes, dedup constraint, `set_updated_at` trigger |
| **Postgres RPCs** | migration 135 | DONE — `fn_select_instagram_candidates()`, `fn_instagram_analytics()` |
| **Postgres Views** | migration 135 | DONE — `v_instagram_queue` (admin queue with simulation metadata) |
| **Platform Settings** | migration 135 seed | DONE — 10 config keys seeded (all disabled by default) |
| **Instagram API Client** | `services/external/instagram.py` | DONE — Full Graph API client: containers, publish, carousels, stories, insights, rate limits, token exchange |
| **Image Composer** | `services/instagram_image_composer.py` | DONE — AVIF→JPEG, Bureau overlay (classification header, simulation border, watermark, AI disclosure), 1080×1350 portrait + 1080×1920 story templates |
| **Content Service** | `services/instagram_content_service.py` | DONE — Candidate selection via RPC, AI caption generation (with template fallback), image composition, batch generation, queue management, engagement metrics |
| **Scheduler** | `services/instagram_scheduler.py` | DONE — asyncio background loop, config from platform_settings, publish with retry/crash recovery, metrics collection at +1h/+6h/+24h/+48h, story composition + publishing |
| **Pydantic Models** | `models/instagram.py` | DONE — Request/response models for all endpoints |
| **API Router** | `routers/instagram.py` | DONE — 10 admin endpoints (queue CRUD, generate, approve, reject, force-publish, analytics, rate-limit, candidates) |
| **App Registration** | `app.py` | DONE — Router + scheduler registered in lifespan |
| **Config Resolver** | `external_service_resolver.py` | DONE — `InstagramConfig` dataclass added |
| **Admin API Service** | `AdminApiService.ts` | DONE — 10 TypeScript API methods + interfaces |
| **Admin Panel Tab** | `AdminInstagramTab.ts` | DONE — SCIF-styled operations control panel with intel cards, dispatch queue, status filters, approve/reject/publish actions, quota gauge, reject modal |
| **Admin Panel Registration** | `AdminPanel.ts` | DONE — Instagram tab added to type union, tab bar, and switch |

### Phase 1 Additions (2026-03-19) — COMPLETE

| Component | Status |
|-----------|--------|
| **Meta Developer App** | DONE — App "metverse.center-IG" (ID: `1980078392546426`), Instagram Business Login, App Mode: Live |
| **Instagram Account** | DONE — `@bureau.of.impossible.geography`, Business account, linked to FB Page |
| **Credentials in DB** | DONE — `instagram_access_token` (encrypted), `instagram_ig_user_id` in `platform_settings` |
| **Token Refresh** | DONE — Automatic `ig_refresh_token` in scheduler loop (every 50 days, tokens last 60) |
| **Bureau Prompt Templates** | DONE — `instagram_agent_caption`, `instagram_building_caption`, `instagram_chronicle_caption` in `prompt_templates` |
| **Epoch Instance Filter** | DONE — RPC filters `s.source_template_id IS NULL AND s.epoch_id IS NULL` (only template sims) |
| **Hashtag Fix** | DONE — Epoch suffix stripped from slugs, hashtags appended to caption on publish |
| **Generate Button UX** | DONE — Animated pulse/sweep during generation, "Scanning Bureau dispatch channels..." text |
| **Legal Pages** | DONE — `/privacy`, `/terms`, `/data-deletion` (required by Meta API + GDPR) |
| **First Post Published** | DONE — https://www.instagram.com/p/DWEINw0EaB3/ (2026-03-19) |

### Phase 2: Hardening + Content Moderation — COMPLETE (2026-03-19)

| Component | Status |
|-----------|--------|
| **Structured Logging** | DONE — All 5 Instagram files enriched with `extra={}` context fields |
| **Sentry Integration** | DONE — 17 `sentry_sdk.capture_exception` calls across all files |
| **Retry Logic Fix** | DONE — Container errors now reset status from `publishing` to `scheduled` |
| **ConnectError Fix** | DONE — Catches `httpx.ConnectError, httpx.ConnectTimeout` explicitly |
| **Font Path Fix** | DONE — Cross-platform `_load_monospace_font()` with Linux/macOS/Pillow fallback chain |
| **Force-Publish Error Handling** | DONE — Wrapped in try/except with Sentry capture + status cleanup |
| **Credential Deduplication** | DONE — Shared `InstagramContentService.load_instagram_credentials()` |
| **Audit Trail** | DONE — All admin actions logged with user_id + post_id |
| **Scheduler Context** | DONE — `structlog.contextvars.bind_contextvars(scheduler="instagram", iteration=N)` |
| **Content Moderation** | DONE — Keyword blocklist + emoji count check |

### Phase 2: Cipher ARG System — COMPLETE (2026-03-19)

| Component | File | Status |
|-----------|------|--------|
| **Database** | `migrations/139_cipher_system.sql` | DONE — `cipher_redemptions` table, `cipher_attempts` rate-limit table, RLS, partial unique index for anon users |
| **Postgres RPCs** | migration 139 | DONE — `fn_generate_cipher_code(difficulty, seed)` deterministic code gen, `fn_redeem_cipher_code(code, user_id, ip_hash)` atomic validation with rate limiting |
| **Platform Settings** | migration 139 seed | DONE — 5 cipher config keys |
| **Cipher Service** | `services/cipher_service.py` | DONE — Code generation via RPC, Caesar/Base64 hint encoding (3 difficulty levels), caption embedding |
| **Cipher Router** | `routers/cipher.py` | DONE — Public `POST /api/v1/public/bureau/dispatch` + Admin endpoints |
| **Bureau Dispatch Page** | `components/bureau/BureauDispatchView.ts` | DONE — Cold War terminal unlock page at `/bureau/dispatch` |
| **Admin Panel Extension** | `AdminInstagramTab.ts` | DONE — Cipher Operations section with stats cards + recent redemptions |

---

## Multi-Platform Architecture

### Shared Protocol Pattern

All social media platforms follow the same architectural pattern:

```
SocialPlatformClient (external API client)
    → ContentService (selection, adaptation, queue)
    → Scheduler (background loop, publish, metrics)
    → Admin Tab (operations, configure, intelligence)
```

Each platform has its own database table, content adaptation logic, and scheduler loop. The shared patterns are:

- **Platform settings**: All config in `platform_settings` KV store, prefixed by platform name
- **Encrypted credentials**: Tokens/passwords encrypted at rest via `SETTINGS_ENCRYPTION_KEY`
- **Queue-based publishing**: Content moves through `draft → scheduled → publishing → published/failed`
- **Metrics collection**: Engagement collected at +1h, +6h, +24h, +48h intervals
- **Error hierarchy**: Typed exceptions for token expiry, rate limits, API errors
- **Sentry integration**: All publish failures captured with context

### Cross-Posting Flow

```
Instagram Post Published
    → Postgres trigger: fn_crosspost_to_bluesky()
    → Creates bluesky_posts row with placeholder caption
    → BlueskyScheduler picks up pending posts
    → BlueskyContentService.adapt_instagram_post() reformats caption
    → BlueskyService publishes via AT Protocol
```

### Unified Admin Panel

The Social Media tab in AdminPanel provides a channel selector:

```
AdminPanel → Social Media tab
    └─ AdminSocialTab.ts (channel selector)
       ├─ Instagram → AdminInstagramTab.ts (3 sub-tabs)
       └─ Bluesky → AdminBlueskyTab.ts (3 sub-tabs)
```

Each channel tab has three operational views:
1. **Operations** — Queue management, dispatch cards, status filters, action buttons
2. **Configure** — Credentials, pipeline toggles, content mix, connection test
3. **Intelligence** — Analytics grid, engagement breakdown, content performance

---

## Bluesky Integration — COMPLETE (2026-03-19)

| Component | Status |
|-----------|--------|
| Database migration 142 | DONE — `bluesky_posts` table, `v_bluesky_queue`, `fn_crosspost_to_bluesky()` trigger, `fn_bluesky_analytics()` RPC |
| AT Protocol client | DONE — `services/external/bluesky.py` — session management, blob upload, createRecord, facets |
| Content service | DONE — `services/bluesky_content_service.py` — caption adaptation (280 graphemes), hashtag filtering, queue management |
| Scheduler | DONE — `services/bluesky_scheduler.py` — background loop, caption adaptation before publish, CID capture |
| Router | DONE — 8 endpoints under `/api/v1/admin/bluesky/` |
| Models | DONE — `models/bluesky.py` |
| Admin UI | DONE — `AdminBlueskyTab.ts` with Operations, Configure, Intelligence tabs |
| Connection testing | DONE — Test button validates app password against bsky.social |
| Configure UI | DONE — Handle, app password, PDS URL, pipeline toggles |
| First post published | DONE — https://bsky.app/profile/bureau-imposs-geo.bsky.social/post/3mhgqvgkbbs2p |

---

## Admin Panel Consolidation — COMPLETE

| Change | Status |
|--------|--------|
| Unified Social tab | DONE — `AdminSocialTab.ts` with Instagram/Bluesky channel selector |
| Consolidated admin tabs | DONE — Merged API Keys, Models, Research, Caching into Platform Config |
| Instagram connection test | DONE — Test button + connection status card |
| Bluesky connection test | DONE — Same pattern |

---

## Bug Fixes (2026-03-19/20)

| Bug | Fix |
|-----|-----|
| Instagram API domain | `graph.facebook.com` → `graph.instagram.com` — IGAA tokens require Instagram domain |
| Bluesky handle Unicode | Stripped invisible `\u202c` from stored handle |
| Bluesky CID not saved | Added `cid` field to `PublishResult`, saved from createRecord response |
| Bluesky trigger NULL images | `COALESCE(NEW.image_urls, '{}'::text[])` |
| Bluesky scheduler caption | Calls `adapt_instagram_post()` before publishing cross-posts |
| Instagram stuck publishing | Reset mechanism for posts stuck in `publishing` state |

---

## Hashtag Strategy Overhaul — COMPLETE

| Change | Status |
|--------|--------|
| Instagram: removed brand tags | DONE — No more `#BureauOfImpossibleGeography` or simulation-specific tags |
| Instagram: new formula | DONE — 2 broad + 2 niche + 1 trending (all discoverable community tags) |
| Bluesky: community tags | DONE — 2-3 filtered community hashtags appended to adapted captions |
| Bluesky: tag whitelist | DONE — `_BLUESKY_WORTHY_TAGS` set filters brand tags out |

### Hashtag Strategy Detail

Instagram 2026 data shows hashtags with zero organic search volume hurt discoverability. The new formula:

- **2 broad tags**: Rotated from pool of 14 high-search-volume tags (`#worldbuilding`, `#AIart`, `#speculativefiction`, etc.)
- **2 niche tags**: Per-content-type pools (agent, building, chronicle, lore)
- **1 trending tag**: Optional, from admin-configured trending tag list
- **Deterministic rotation**: Entity name hash ensures variety across batch, penalizes identical tag sets

---

## TikTok Integration — PLANNED

Full specification at `docs/specs/tiktok-integration.md`.

**Summary**: TikTok integration follows the same cross-posting pattern as Bluesky. Awaiting TikTok Developer App approval (5-9 week timeline from registration).

**Key architectural decisions**:
- FastAPI media proxy for domain verification (TikTok requires `pull_url` from verified domain)
- 24h token lifecycle with proactive refresh in scheduler
- Separate `title` + `description` columns (TikTok splits what Instagram combines)
- Publishing status polling (TikTok publish is async with status callback)
- Migration 144 reserved (adjusted from 143 which now holds social stories)

**Registration status**: Not yet started. Critical path item — 5-9 weeks to Direct Post Audit approval.

---

## Resonance → Instagram Story Pipeline — LIVE (Phase 3)

### Overview

When a substrate resonance impacts simulations, the system generates a sequence of 3-5 Instagram Stories posted over 1-2 hours — the Bureau's "emergency broadcast channel." Stories are ephemeral (24h) because classified transmissions are time-limited.

### Implementation Status

| Component | File | Status |
|-----------|------|--------|
| **Database** | `migrations/143_social_stories.sql` | DONE — `social_stories` table, indexes, RLS, 9 platform settings |
| **Models** | `models/social_story.py` | DONE — Response models, archetype color map, operative alignment map |
| **Story Service** | `services/social_story_service.py` | DONE — Sequence creation, cinematic image composition, 5-layer throttle, concurrent asset downloading |
| **Cinematic Templates** | `services/instagram_image_composer.py` | DONE — 5 cinematic story templates (1080×1920): gradient backgrounds, archetype glyphs, circular magnitude gauges, portrait circles with glow rings, text glow effects, film grain, vignettes, reaction cards |
| **Resonance Hook** | `services/resonance_service.py` | DONE — `process_impact()` calls `create_resonance_stories()`, `update_status()` calls `create_subsiding_story()` |
| **Scheduler Extension** | `services/instagram_scheduler.py` | DONE — `_compose_pending_stories()` + `_process_due_stories()` in run loop |
| **Admin UI** | `AdminInstagramTab.ts` | DONE — Stories section in Social tab: sequence accordion, status filters, compose/publish/skip actions |
| **AI closing lines** | `GenerationService` | DONE — `story_closing_line` prompt template + `generate_story_closing_line()` |
| **Story Highlights** | — | MANUAL — Instagram Stories API doesn't support Highlight management |

### Story Sequence

Each resonance generates a cinematic narrative arc:

1. **DETECTION** (posted immediately) — Emergency broadcast: gradient background (archetype color → black), large geometric archetype glyph, circular magnitude gauge, text glow, heavy scan lines + film grain + vignette
2. **CLASSIFICATION** (+15 min) — Bureau dossier: paper-textured dark background, corner bracket framing, Bureau seal watermark, amber-accented dispatch text with left bar, classification markers
3. **IMPACT** (+30-45 min, one per high-impact simulation) — Cinematic hero slide: simulation banner (darkened, blurred, full-bleed), circular agent portraits with glow rings, reaction quote cards on semi-transparent dark backgrounds, AI-generated poetic closing with text glow. Falls back to gradient+text when assets are unavailable
4. **ADVISORY** (+60 min, epochs only) — Tactical briefing HUD: two-column layout with aligned (green ♜♞) and opposed (red ♝♛) operative types, chess piece symbols, accent-colored directive
5. **SUBSIDING** (on status transition) — Elegiac resolution: near-black with faintest archetype hint, large centered stat numbers with glow, fading closing lines ("The trembling fades. The scars remain.")

### Cinematic Template Architecture

All story templates use RGBA compositing for proper alpha blending:

| Visual Element | Implementation | Used In |
|---------------|---------------|---------|
| Gradient backgrounds | NumPy linear interpolation → RGBA | All slides |
| Film grain | NumPy Gaussian noise overlay | All slides |
| Vignette | NumPy radial distance → alpha mask | All slides |
| Scan lines | RGBA overlay via `alpha_composite` | All slides |
| Text glow | Cropped GaussianBlur layer + alpha composite | Titles, stats, closing lines |
| Archetype glyphs | Pillow geometric primitives (8 unique shapes) | Detection |
| Magnitude gauge | `draw.arc()` circular gauge | Detection |
| Corner brackets | L-shaped line pairs at 4 corners | Classification |
| Portrait circles | 4x supersampled mask + LANCZOS downscale + glow ring | Impact |
| Reaction cards | `rounded_rectangle` with alpha fill + italic text | Impact |
| Operative symbols | Unicode chess pieces (♜♞♝♛♚) | Advisory |

**Asset pipeline for Impact (hero) slides:**
1. Service fetches `banner_url` from `simulations` table
2. Service fetches top reactions + agent portrait URLs from `event_reactions` JOIN `agents`
3. All images downloaded concurrently via `asyncio.gather` + `_download_image_safe`
4. Composer receives bytes — darkens/blurs banner, crops portraits to anti-aliased circles
5. Graceful fallback: missing banner → gradient, missing portraits → event title list

### Throttle System (5 Layers)

| Layer | Rule | Catastrophic Override |
|-------|------|-----------------------|
| Magnitude gate | `magnitude ≥ 0.5` for auto-trigger | No (always triggers) |
| Daily budget | Max 1 sequence/day | Yes (bypasses) |
| Archetype dedup | Max 1 per archetype per 48h | No (simplified update) |
| Cooldown window | Min 6h between sequences | Yes (bypasses) |
| Shared API budget | Reserve 10 feed post slots from 50/24h limit | No |

### Archetype Visual Language

| Archetype | Color Accent | Archetype | Color Accent |
|-----------|-------------|-----------|-------------|
| The Tower | `#FF3333` crimson | The Overthrow | `#FF8800` amber |
| The Shadow | `#7744AA` violet | The Prometheus | `#FFCC00` gold |
| The Devouring Mother | `#33AA66` toxic green | The Awakening | `#CC88FF` lavender |
| The Deluge | `#2266CC` deep blue | The Entropy | `#666666` ash |

### Configuration (`platform_settings`)

| Key | Default | Purpose |
|-----|---------|---------|
| `resonance_stories_enabled` | `false` | Master switch |
| `resonance_stories_auto_magnitude` | `0.5` | Min magnitude for automatic Stories |
| `resonance_stories_max_sequences_per_day` | `1` | Daily sequence limit |
| `resonance_stories_cooldown_hours` | `6` | Min hours between sequences |
| `resonance_stories_archetype_dedup_hours` | `48` | Same archetype cooldown |
| `resonance_stories_catastrophic_threshold` | `0.8` | Bypass threshold |
| `resonance_stories_advisory_in_epochs_only` | `true` | Advisory only during epochs |
| `resonance_stories_impact_threshold` | `0.4` | Min effective_magnitude per sim |
| `resonance_stories_feed_post_reserve` | `10` | Feed post slots to reserve |

---

## What's NOT Yet Implemented (Future Phases)

| Item | Phase | Notes |
|------|-------|-------|
| ~~Bluesky integration~~ | ~~Phase 2~~ | **DONE (2026-03-19)** |
| ~~Hashtag strategy overhaul~~ | ~~Phase 2~~ | **DONE (2026-03-20)** |
| ~~Resonance → Story admin UI~~ | ~~Phase 3~~ | **DONE (2026-03-20)** — Stories section in AdminInstagramTab Operations tab |
| ~~AI narrative closing lines~~ | ~~Phase 3~~ | **DONE (2026-03-20)** — `story_closing_line` prompt template + `GenerationService.generate_story_closing_line()` |
| TikTok integration | Phase 2+ | PLANNED — awaiting Developer App approval (5-9 weeks) |
| Story Highlights management | Phase 3 | MANUAL — see workflow below |
| Bleed contamination visuals | Phase 3 | Per-archetype visual effects on feed images during active resonances |
| Deep link share cards | Phase 4 | "Share to Instagram" button on entity detail pages |
| Comment import loop | Phase 4 | Fetch IG comments → `social_media_comments` → sentiment analysis |
| Instagram Polls → Game State | Phase 4 | Story polls mapped to Bureau Response system |
| IPTC/C2PA metadata embedding | Phase 1 (deferred) | EU AI Act compliance — deadline: August 2, 2026 |
| Bilingual carousel slides | Phase 3 | EN slide 1 + DE final slide for key posts |
| Content seeding sprint | Ongoing | Generate events/chronicles to fill pipeline |

### Story Highlights — "Declassified Archives" (Manual Workflow)

After a resonance fully resolves (status → `archived`), its Stories should be saved to an Instagram Highlight named after the archetype:

- **The Tower** — economic crises
- **The Shadow** — conflicts
- **The Devouring Mother** — pandemics
- **The Deluge** — natural disasters
- **The Overthrow** — political upheaval
- **The Prometheus** — breakthroughs
- **The Awakening** — cultural shifts
- **The Entropy** — environmental disasters

**Why manual**: Instagram's Content Publishing API does not support Story Highlight creation or management. Highlights must be created through the Instagram mobile app.

**Admin workflow**:
1. After a resonance transitions to `archived` status, note the archetype
2. Open Instagram mobile → Profile → Story Highlights
3. Create or update the archetype-named Highlight
4. Add the resonance's published Stories (available for 24h after posting, or from the Stories Archive)
5. Use the archetype color as the Highlight cover (generate a simple circle graphic matching the hex codes in `ARCHETYPE_COLORS`)

---

## Context

The Pulse page theme migration revealed a truth about the platform: metaverse.center generates extraordinary content — AI portraits, architectural imagery, battle narratives, cross-dimensional dispatches, Jungian archetype events — but none of it leaves the platform. Social media is the highest-leverage channel for visual storytelling in the gaming/worldbuilding niche.

This is not a social media marketing feature. This is the Bureau of Impossible Geography extending its operations into new dimensions. Instagram is Shard-IG. Bluesky is Shard-AT. TikTok will be Shard-TT.

---

## The Core Conceit

**The Bureau does not know it is on Instagram.** It is filing dispatches through whatever medium is available. The medium happens to be Instagram. If the medium were clay tablets, the Bureau would use clay tablets. The Bureau's indifference to its own medium is what makes the voice authentic.

The account `@bureau.of.impossible.geography` IS the Bureau's public communications channel. Followers are "external observers." Hashtags are filing codes. The fiction is total — except for a pinned "DECLASSIFICATION NOTICE" and a bio line that reads: *"The Bureau of Impossible Geography is a narrative experiment by metaverse.center. All content is AI-generated fiction. Est. [REDACTED]."*

---

## The Bureau Voice

Four registers that rotate (established in `BUREAU_ARCHIVIST_PROMPT`):
1. **Archival-scholarly** — meticulous, footnoted, quietly astonished
2. **Bureaucratic-clinical** — forms, directives, classification stamps
3. **Poetic-intimate** — sudden eruptions of beauty within administrative prose
4. **Oracular-compressed** — short, dense, prophetic fragments

Stories use a **compressed, urgent register** distinct from the archival tone of feed posts:
- **Detection**: Military alert. Short sentences. All caps headers. Numbers and data.
- **Classification**: Bureaucratic clinical. Filing codes. Classification stamps. Formal but tense.
- **Impact**: Poetic fragments. One simulation, one emotional beat.
- **Advisory**: Tactical briefing. Direct, actionable. "Deploy accordingly."
- **Subsiding**: Elegiac. Brief. "The trembling fades. The scars remain."

---

## Visual Identity

Each post is visually tagged to its source simulation using the existing theming system. The compositing pipeline (in `InstagramImageComposer`):
1. Pull simulation's `color_primary`, `color_background` from design settings
2. Apply as overlay: border color, classification header stamp color
3. Add Bureau watermark (partially redacted seal text)
4. Convert AVIF → JPEG at target dimensions, quality 90, max 8MB
5. **Feed posts**: 1080×1350 (4:5 portrait)
6. **Stories**: 1080×1920 (9:16 vertical) cinematic templates — RGBA compositing with gradient backgrounds, archetype glyphs, film grain, vignettes, text glow, portrait circles with glow rings, reaction cards. Real simulation imagery (blurred banners, agent portraits) when available, graceful fallback to gradient-on-dark

---

## Technical Architecture

### Meta API Requirements

- **API**: Instagram Graph API v22.0 — Content Publishing endpoints
- **Client**: Direct `httpx` async client (`backend/services/external/instagram.py`)
- **Domain**: `graph.instagram.com` (NOT `graph.facebook.com` — IGAA tokens require Instagram domain)
- **Auth**: Instagram Business Login → long-lived token (60 days) → automatic refresh
- **Permissions**: `instagram_business_basic`, `instagram_business_content_publish`, `pages_read_engagement`
- **Rate limits**: 100 API-published posts per 24h (stories + feed shared)
- **Supported formats**: Feed photos, Carousels (up to 10), Reels (up to 90s), Stories
- **Two-step process**: Create container → Poll status → Publish container

### Token Lifecycle

Dashboard-generated tokens (IGAA prefix) are long-lived (60 days). The scheduler refreshes at 50 days.

- **Refresh**: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={TOKEN}`
- **If expired**: Must re-generate from Meta Developer Dashboard manually

### Implemented Files

| File | Purpose |
|---|---|
| `services/external/instagram.py` | Instagram Graph API client |
| `services/external/bluesky.py` | AT Protocol client (sessions, publishing, facets) |
| `services/instagram_content_service.py` | Content selection, caption generation, queue management |
| `services/instagram_scheduler.py` | Background loop — publish posts + stories, collect metrics |
| `services/instagram_image_composer.py` | Image compositing: feed overlays + 5 story templates |
| `services/bluesky_content_service.py` | Caption adaptation (280 graphemes), hashtag filtering |
| `services/bluesky_scheduler.py` | Background loop — caption adaptation, blob upload, publish |
| `services/social_story_service.py` | Resonance story orchestration — sequences, throttle, compose |
| `services/cipher_service.py` | Cipher code generation, hint encoding, redemption |
| `routers/instagram.py` | 10 admin endpoints under `/api/v1/admin/instagram/` |
| `routers/bluesky.py` | 8 admin endpoints under `/api/v1/admin/bluesky/` |
| `routers/cipher.py` | Public cipher redemption + admin cipher management |
| `models/instagram.py` | Pydantic request/response models |
| `models/bluesky.py` | Pydantic request/response models |
| `models/social_story.py` | Story response models, archetype colors, operative alignment |
| `models/cipher.py` | Cipher request/response models |

### Database

| Migration | Tables/Objects |
|-----------|---------------|
| 135 | `instagram_posts`, `v_instagram_queue`, `fn_select_instagram_candidates()`, `fn_instagram_analytics()` |
| 139 | `cipher_redemptions`, `cipher_attempts`, `fn_generate_cipher_code()`, `fn_redeem_cipher_code()` |
| 142 | `bluesky_posts`, `v_bluesky_queue`, `fn_crosspost_to_bluesky()` trigger, `fn_bluesky_analytics()` |
| 143 | `social_stories` — resonance story sequences with scheduling, composition status, platform tracking |

---

## Legal & Compliance

### AI Content Disclosure (MANDATORY — Deadline August 2, 2026)

- **Caption footer**: Every post ends with `"AI-generated content from metaverse.center"`
- **`ai_disclosure_included` column**: Defaults to `true`, tracked per post
- **Bio**: Clear fiction/AI disclosure (manual setup)
- **Story footer**: AI disclosure watermark in all story templates
- **IPTC/C2PA metadata**: Not yet implemented — needed before EU AI Act enforcement

### Content Moderation

- Admin approval workflow: DONE (draft → approve/reject → scheduled → published)
- Keyword blocklist: DONE (configurable via platform settings)
- Emoji count validation: DONE (Bureau voice = minimal emoji)

---

## Next Steps (Priority Order)

1. ~~Meta Developer App setup~~ **DONE (2026-03-19)**
2. ~~Bluesky integration~~ **DONE (2026-03-19)**
3. ~~Hashtag strategy overhaul~~ **DONE (2026-03-20)**
4. ~~Instagram API domain fix~~ **DONE (2026-03-19)**
5. **TikTok Developer App registration** — start NOW (critical path: 5-9 weeks)
6. ~~Resonance → Story Pipeline~~ **DONE (2026-03-20)** — Cinematic templates with real imagery, concurrent asset downloads, portrait circles, reaction cards
7. **Content seeding sprint** — fill pipeline across simulations
8. **IPTC/C2PA metadata** — EU AI Act compliance (deadline: August 2, 2026)
