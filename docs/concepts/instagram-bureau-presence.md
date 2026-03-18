# Bureau Instagram Presence — Feature Design Document

> Version: 1.1 — 2026-03-18
> Status: **Phase 1 Implemented** / Phases 2-5 Planned

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
| **Image Composer** | `services/instagram_image_composer.py` | DONE — AVIF→JPEG, Bureau overlay (classification header, simulation border, watermark, AI disclosure), 1080×1350 portrait |
| **Content Service** | `services/instagram_content_service.py` | DONE — Candidate selection via RPC, AI caption generation (with template fallback), image composition, batch generation, queue management, engagement metrics |
| **Scheduler** | `services/instagram_scheduler.py` | DONE — asyncio background loop, config from platform_settings, publish with retry/crash recovery, metrics collection at +1h/+6h/+24h/+48h |
| **Pydantic Models** | `models/instagram.py` | DONE — Request/response models for all endpoints |
| **API Router** | `routers/instagram.py` | DONE — 10 admin endpoints (queue CRUD, generate, approve, reject, force-publish, analytics, rate-limit, candidates) |
| **App Registration** | `app.py` | DONE — Router + scheduler registered in lifespan |
| **Config Resolver** | `external_service_resolver.py` | DONE — `InstagramConfig` dataclass added |
| **Admin API Service** | `AdminApiService.ts` | DONE — 10 TypeScript API methods + interfaces |
| **Admin Panel Tab** | `AdminInstagramTab.ts` | DONE — SCIF-styled operations control panel with intel cards, dispatch queue, status filters, approve/reject/publish actions, quota gauge, reject modal |
| **Admin Panel Registration** | `AdminPanel.ts` | DONE — Instagram tab added to type union, tab bar, and switch |

### What's NOT Yet Implemented (Future Phases)

| Item | Phase | Notes |
|------|-------|-------|
| Meta Developer App setup | Phase 1 (manual) | One-time manual step: create FB Page, IG Business Account, register Meta app, App Review |
| Prompt templates in DB | Phase 2 | `instagram_agent_caption`, `instagram_building_caption`, etc. — currently uses hardcoded fallback templates |
| Content moderation pipeline | Phase 2 | Keyword blocklist, LLM safety check — currently relies on admin approval |
| Cipher system | Phase 3 | `unlock_code` column exists but cipher generation/unlock page not built |
| Bleed contamination visuals | Phase 3 | Per-archetype visual effects on images during active resonances |
| Resonance → Story pipeline | Phase 3 | Auto-post Stories when resonances are detected |
| Deep link share cards | Phase 4 | "Share to Instagram" button on agent/building/chronicle pages |
| Comment import loop | Phase 4 | Fetch IG comments → `social_media_comments` → sentiment analysis |
| Instagram Polls → Game State | Phase 4 | Story polls mapped to Bureau Response system |
| IPTC/C2PA metadata embedding | Phase 1 (deferred) | EU AI Act compliance metadata in JPEG — need `python-iptcinfo3` or `c2pa-python` |
| Bilingual carousel slides | Phase 2 | EN slide 1 + DE final slide for key posts |

---

## Context

The Pulse page theme migration revealed a truth about the platform: metaverse.center generates extraordinary content — AI portraits, architectural imagery, battle narratives, cross-dimensional dispatches, Jungian archetype events — but none of it leaves the platform. Instagram is the highest-leverage channel for visual storytelling in the gaming/worldbuilding niche.

This is not a social media marketing feature. This is the Bureau of Impossible Geography extending its operations into a new dimension. Instagram is Shard-IG.

---

## The Core Conceit

**The Bureau does not know it is on Instagram.** It is filing dispatches through whatever medium is available. The medium happens to be Instagram. If the medium were clay tablets, the Bureau would use clay tablets. The Bureau's indifference to its own medium is what makes the voice authentic.

The account `@bureau.of.impossible.geography` IS the Bureau's public communications channel. Followers are "external observers." Hashtags are filing codes. The fiction is total — except for a pinned "DECLASSIFICATION NOTICE" and a bio line that reads: *"The Bureau of Impossible Geography is a narrative experiment by metaverse.center. All content is AI-generated fiction. Est. [REDACTED]."*

---

## Proposal A: The Content Engine (Automated Publishing)

### What Gets Posted

| Content Type | Instagram Format | Source | Cadence | Purpose | Impl Status |
|---|---|---|---|---|---|
| **Agent Dossiers** | Carousel (5-7 slides) | `agents` table | 3x/week | Character discovery, saves | Content selection DONE, carousel publishing DONE, multi-slide composition TODO |
| **Bureau Dispatches** | Single image (classified doc aesthetic) | `heartbeat_entries`, `simulation_chronicles` | 2x/week | Lore drip, ARG breadcrumb | DONE (single image) |
| **Shard Surveillance** | Reels (15-30s Ken Burns on building images) | `buildings` table | 2x/week | Algorithmic reach via Explore | Content selection DONE, Reels generation TODO |
| **Chronicle Headlines** | Story (24h ephemeral) | `simulation_chronicles` | On generation | Urgency, FOMO | Story publishing DONE, auto-trigger TODO |
| **Resonance Alerts** | Story (poll + countdown) | `substrate_resonances` | On resonance event | Engagement, game integration | TODO (Phase 3) |
| **Bleed Evidence** | Carousel (cross-shard contamination) | `echoes` + `bleed_gazette` | 1x/week | Deep lore | TODO (Phase 3) |
| **Epoch Battle Reports** | Reels (dramatic narration) | `epoch_battle_log` | During active epochs | Competition hype | TODO (Phase 3) |

### The Bureau Voice on Instagram

Four registers that rotate (already established in `BUREAU_ARCHIVIST_PROMPT`):
1. **Archival-scholarly** — meticulous, footnoted, quietly astonished
2. **Bureaucratic-clinical** — forms, directives, classification stamps
3. **Poetic-intimate** — sudden eruptions of beauty within administrative prose
4. **Oracular-compressed** — short, dense, prophetic fragments

Caption template (implemented in `InstagramContentService.CAPTION_TEMPLATES`):
```
BUREAU OF IMPOSSIBLE GEOGRAPHY
DISPATCH [auto-numbered] | [date]
CLASSIFICATION: [PUBLIC | AMBER | RESTRICTED]
RE: [simulation name] — [event summary]

[2-3 paragraphs of Bureau prose]

[ADDENDUM: Filing Clerk's Note — the hook/CTA]

#SUBSTRATE_DISPATCH #[simulation_slug] #ARCHETYPE_[name]
```

### Visual Identity

Each post is visually tagged to its source simulation using the existing theming system. The compositing pipeline (implemented in `InstagramImageComposer`):
1. Pull simulation's `color_primary`, `color_background` from design settings
2. Apply as overlay: border color, classification header stamp color
3. Add Bureau watermark (partially redacted seal text)
4. Convert AVIF → JPEG at 1080×1350 (4:5 portrait), quality 90, max 8MB

### Hashtag Strategy (3-5 per post)

Implemented in `InstagramContentService._build_hashtags()`:
- **1 brand tag**: `#BureauOfImpossibleGeography`
- **1 simulation tag**: derived from slug (e.g., `#StationNull`)
- **1-2 discovery tags**: `#worldbuilding`, `#AIart`, `#speculativefiction`

---

## Proposal B: The ARG Layer (Instagram as Game Surface)

> Status: NOT YET IMPLEMENTED (Phase 3)

### Instagram IS the 12th Shard

The central creative conceit: Instagram is another dimension the Bureau monitors.

### Bleed Contamination Protocol

When platform bleed events occur, the Instagram account exhibits "contamination symptoms" per archetype. Requires extending `InstagramImageComposer` with per-archetype visual effects.

### Cipher System: Instagram → Platform

Database support exists (`instagram_posts.unlock_code` column). Implementation needed:
- `instagram_cipher_service.py` — cipher generation (base64, substitution, multi-step)
- `BureauDispatchUnlock.ts` — frontend unlock page at `/bureau/dispatch`

### Resonance → Instagram Story Pipeline

Requires hooking into `ResonanceScheduler` to auto-create Story posts during active resonances.

---

## Proposal C: User Integration

> Status: NOT YET IMPLEMENTED (Phase 4)

### Deep Link Sharing (Phase 1 — No OAuth)

"Share to Instagram" button on entity detail pages → generates themed share card JPEG → downloads to device.

### Instagram Polls → Game State (Phase 2)

Story polls mapped to Bureau Response system.

### Comment Sentiment → Simulation Health (Phase 3)

Comment import into existing `social_media_comments` pipeline.

### User Instagram Connection (Phase 4 — Optional)

Not recommended for initial launch.

---

## Proposal D: Growth & Engagement

> Status: NOT YET IMPLEMENTED (strategy-level, no code needed)

### Bootstrap (0 → 1000 followers)

1. Seed batch from existing content (122 agents, 154 buildings, chronicles, lore)
2. Cicada 3301 homage launch
3. Creator seeding with physical Bureau dossiers
4. Cross-post to worldbuilding communities

### Growth (1000 → 10000)

1. Reels algorithm: 15-second "Shard Surveillance" clips
2. Collab posts with AI art accounts
3. `#WhatDidTheBleedBring` hashtag challenge
4. Diegetic questions on every post

---

## Research-Backed Strategy Insights (March 2026)

### Instagram Algorithm (2026 confirmed)
- **#1 ranking factor**: Watch time (3-second retention threshold)
- **#2**: DM shares (strongest distribution signal)
- **#3**: Likes per reach
- **Optimal content mix**: 3-4 Reels/week + 2-3 carousels + 1-2 static posts
- **Hashtags are dead for reach**: Posts without hashtags get 23% higher reach
- **First 24-48 hours** of engagement determine long-term distribution

### Best Practices for Gaming/Worldbuilding Niche
- Ask a question on nearly every post
- Visual quality dominates
- Short-form video is mandatory for growth
- Lead with compelling text in first 10 words

---

## Technical Architecture

### Meta API Requirements (Verified March 2026)

- **API**: Instagram Graph API v22.0 — Content Publishing endpoints
- **Client**: Direct `httpx` async client (`backend/services/external/instagram.py`)
- **Auth**: Facebook Login → short-lived → long-lived → perpetual page token → IG Business Account ID
- **Permissions**: `instagram_business_basic`, `instagram_business_content_publish`, `pages_read_engagement`
- **Rate limits**: 100 API-published posts per 24h rolling window
- **Supported formats**: Feed photos, Carousels (up to 10), Reels (up to 90s), Stories
- **Image format**: JPEG only. Max 8MB. Optimal: 1080×1350
- **Two-step process**: Create container → Poll status → Publish container

### Implemented Files

| File | Purpose |
|---|---|
| `backend/services/external/instagram.py` | Instagram Graph API client (httpx async) — containers, publishing, insights, rate limits, token exchange |
| `backend/services/instagram_content_service.py` | Content selection (via RPC), caption generation (AI + template fallback), image composition, queue management |
| `backend/services/instagram_scheduler.py` | Background asyncio loop — publish due posts, collect metrics, crash recovery |
| `backend/services/instagram_image_composer.py` | AVIF→JPEG conversion, Bureau overlay compositing, Supabase staging upload |
| `backend/routers/instagram.py` | 10 admin API endpoints under `/api/v1/admin/instagram/` |
| `backend/models/instagram.py` | Pydantic request/response models |
| `frontend/src/components/admin/AdminInstagramTab.ts` | SCIF-styled admin operations panel |
| `frontend/src/services/api/AdminApiService.ts` | TypeScript API methods + interfaces (added to existing file) |

### Database (Migration 135)

- **Table**: `instagram_posts` — full schema with content tracking, IG API fields, scheduling, engagement metrics, ARG unlock codes, compliance fields
- **Indexes**: simulation, status, scheduled, published, source dedup
- **RLS**: Platform admin only (service role bypasses for scheduler)
- **View**: `v_instagram_queue` — queue with simulation metadata
- **RPCs**: `fn_select_instagram_candidates()`, `fn_instagram_analytics()`

### Config: `platform_settings` keys

| Key | Default | Purpose |
|-----|---------|---------|
| `instagram_enabled` | `false` | Master switch |
| `instagram_posting_enabled` | `false` | Enable actual posting (vs dry-run) |
| `instagram_ig_user_id` | `''` | IG Business Account ID |
| `instagram_access_token` | `''` | Encrypted perpetual page token |
| `instagram_posts_per_day` | `3` | Max daily posts |
| `instagram_posting_hours` | `[9, 13, 18]` | UTC posting schedule |
| `instagram_approval_required` | `true` | Require admin approval |
| `instagram_caption_model` | `''` | Override model for captions |
| `instagram_scheduler_interval_seconds` | `300` | Check interval |
| `instagram_content_mix` | `{"agent": 3, "building": 2, "chronicle": 2}` | Weighted distribution |

### Content Pipeline Flow (Implemented)

```
Admin clicks "Generate Dispatches" OR scheduler runs at posting hour
    ↓
fn_select_instagram_candidates() — Postgres RPC: joins agents/buildings/chronicles,
    LEFT JOINs instagram_posts to exclude already-posted, quality filters
    ↓
InstagramContentService.generate_caption() — AI via GenerationService + PromptResolver
    (falls back to Bureau-voice templates if AI fails)
    ↓
InstagramImageComposer.compose() — AVIF→JPEG, themed overlay, Bureau watermark
    → uploads to simulation.assets/instagram/ staging bucket
    ↓
instagram_posts table (status: 'draft', content_source_snapshot frozen)
    ↓
Admin approval via AdminInstagramTab → status: 'scheduled'
    ↓
InstagramScheduler picks up at scheduled_at:
    → creates container (POST /{IG_ID}/media)
    → polls status (60s intervals, 5min max)
    → publishes (POST /{IG_ID}/media_publish)
    → updates status: 'published', stores ig_media_id + ig_permalink
    ↓
Engagement metrics collected at +1h, +6h, +24h, +48h
    → GET /{media_id}/insights
    → updates engagement_rate = (likes + comments + saves + shares) / reach
```

---

## Legal & Compliance

### AI Content Disclosure (MANDATORY — Deadline August 2, 2026)

- **Caption footer**: Every post ends with `"AI-generated content from metaverse.center"` (implemented in `_AI_DISCLOSURE_FOOTER`)
- **`ai_disclosure_included` column**: Defaults to `true`, tracked per post
- **Bio**: Clear fiction/AI disclosure (manual setup)
- **IPTC/C2PA metadata**: Not yet implemented — needed before EU AI Act enforcement

### Content Moderation (Partially Implemented)

- Admin approval workflow: DONE (draft → approve/reject → scheduled → published)
- Keyword blocklist: TODO
- LLM safety check: TODO
- Simulation-specific content softening: TODO

### i18n / Multilingual Strategy

- Captions generated in English (primary audience)
- Bilingual carousel option: TODO
- Alt text: Generated in English (implemented in `_generate_alt_text`)

---

## Next Steps (Priority Order)

1. **Meta Developer App setup** — manual: create FB Page + IG Business Account, register Meta app
2. **Content seeding sprint** — generate events/chronicles across simulations to populate the content pipeline
3. **Prompt templates** — add `instagram_agent_caption`, `instagram_building_caption`, `instagram_chronicle_caption` to `prompt_templates` table for AI-quality Bureau voice
4. **Content moderation** — keyword blocklist + LLM safety scoring before posts reach `scheduled`
5. **IPTC metadata** — embed AI disclosure in JPEG metadata for EU AI Act compliance
6. **Phase 3: ARG layer** — cipher service, unlock page, bleed visual effects
