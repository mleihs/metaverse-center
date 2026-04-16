---
title: "SEO, GA4 & Deep Linking Implementation"
version: "2.0"
type: guide
status: active
lang: en
---

# SEO, GA4 & Deep Linking Implementation

## Architecture (3 Layers)

| Layer | Responsibility | Files |
|-------|---------------|-------|
| Static SEO baseline | Default meta tags, JSON-LD, hreflang | `frontend/index.html` |
| Client-side SeoService | Dynamic titles + meta for human users | `frontend/src/services/SeoService.ts` |
| Server-side crawler injection | Dynamic meta for crawlers (Googlebot etc.) | `backend/middleware/seo.py` |

## Files Created/Modified

### New Files
- `frontend/src/services/SeoService.ts` — setTitle, setDescription, setCanonical, setOgImage, reset
- `frontend/src/services/AnalyticsService.ts` — GA4 consent mode v2, trackPageView, consent management
- `frontend/src/components/shared/CookieConsent.ts` — GDPR consent banner (accept/decline)
- `backend/routers/seo.py` — GET /robots.txt + GET /sitemap.xml (dynamic from DB)
- `backend/middleware/seo.py` — is_crawler(), enrich_html_for_crawler(), _replace_meta(), _escape()
- `frontend/tests/seo-analytics.test.ts` — 25 tests (requires `// @vitest-environment happy-dom`)
- `backend/tests/unit/test_seo.py` — 29 unit tests (crawler detection, escaping, meta replacement, enrichment)
- `backend/tests/integration/test_seo_router.py` — 18 integration tests (robots.txt, sitemap.xml)

### Modified Files
- `frontend/index.html` — Static meta tags, OG, Twitter Cards, hreflang, JSON-LD WebSite schema
- `frontend/src/app-shell.ts` — Deep link fix, SeoService/AnalyticsService integration, CookieConsent, pushState fix
- `frontend/src/components/layout/SimulationHeader.ts` — Reactive simulation read (no longer cached in connectedCallback)
- `frontend/src/components/platform/SimulationCard.ts` — div.shard -> a.shard (crawlable link), aria-label on banner
- `frontend/src/components/layout/SimulationNav.ts` — button -> a href (crawlable tabs)
- `frontend/src/components/platform/PlatformHeader.ts` — span -> a href="/dashboard" (crawlable title)
- `frontend/src/utils/text.ts` — agentAltText(), buildingAltText() for rich image alt text from DB fields
- `backend/app.py` — Registered seo.router, crawler-aware serve_spa
- `backend/middleware/security.py` — CSP header with GA4, Google Fonts, Cloudflare Insights domains
- `.env`, `.env.example`, `.env.production.example` — VITE_GA4_MEASUREMENT_ID
- 8 components updated with lightbox alt text (AgentCard, AgentDetailsPanel, BuildingCard, BuildingDetailsPanel, ChatWindow, MessageList, SocialTrendsView, LoreScroll)

## Key Technical Decisions

1. **Deep linking fix**: `_loadSimulationContext()` fetches simulation via `simulationsApi.getById()` when not in appState
2. **URL navigation**: `@lit-labs/router` v0.1.4 `goto()` doesn't call pushState — manual pushState added to `_handleNavigate`
3. **Crawlable links**: Progressive enhancement — `<a href>` with `e.preventDefault()` + CustomEvent dispatch for SPA nav
4. **Crawler detection**: User-Agent regex against 10 known bots (Googlebot, bingbot, Twitterbot, etc.)
5. **HTML enrichment**: String replacement on cached index.html (not DOM parsing), with XSS escaping
6. **GA4**: Consent Mode v2, analytics_storage denied by default, manual page_view on SPA navigation
7. **CSP**: `'unsafe-inline'` required for style-src (Lit adopted stylesheets + ThemeService). `fonts.googleapis.com` in style-src, `fonts.gstatic.com` in font-src, `static.cloudflareinsights.com` in script-src
8. **Alt text**: Composed from DB fields used in image generation (character, background, profession for agents; type, zone, description, condition for buildings)

## Entity-Level SEO (Implemented — Migration 137)

### Status: COMPLETE (2026-03-19)

Individual agents and buildings now have slug-based URLs, making every entity a distinct crawlable page. This multiplies indexed pages from ~130 to ~1500+.

### Architecture: Option 2 — Entity Routes + Extended Dynamic Rendering

Chosen after evaluating 5 approaches (see git history for full analysis). Key reasons: zero new infrastructure, real-time data, scales to 5000+ entities with no build-time cost, single Railway container.

### What Was Implemented

**Database (Migration 137):**
- `slug TEXT NOT NULL` column on `agents` and `buildings` tables
- `UNIQUE(simulation_id, slug)` composite constraint — slugs unique per simulation
- `fn_generate_entity_slug(name, sim_id, table_name)` — reusable SQL slugifier with collision handling (`name-2`, `name-3`)
- `BEFORE INSERT` trigger `trg_agents_auto_slug` / `trg_buildings_auto_slug` — auto-generates slugs on new inserts
- `trg_agents_slug_immutable` / `trg_buildings_slug_immutable` — prevents slug modification (URL stability)
- `active_agents` / `active_buildings` views refreshed to pick up new column
- ~2000 existing entities backfilled with slugs

**Backend:**
- `backend/utils/slug.py` — shared `slugify()` utility (extracted from simulation_service.py)
- `AgentService.get_by_slug()` / `BuildingService.get_by_slug()` — slug-based entity lookups
- `GET /api/v1/public/simulations/{sim_id}/agents/by-slug/{slug}` — public agent slug endpoint
- `GET /api/v1/public/simulations/{sim_id}/buildings/by-slug/{slug}` — public building slug endpoint
- `backend/middleware/seo.py` — regex updated to match entity slugs (not just UUIDs), crawler redirect resolves entity UUID→slug
- `backend/middleware/seo_content.py` — entity detail builders support slug lookups, all JSON-LD URLs use entity slugs
- `backend/routers/seo.py` — sitemap generates slug-based entity URLs

**Frontend:**
- `Agent` / `Building` TypeScript interfaces — added `slug: string` field
- `AgentsApiService.getBySlug()` / `BuildingsApiService.getBySlug()` — slug-based fetch methods
- `app-shell.ts` — entity slug routes: `/simulations/:id/agents/:entitySlug`, `/simulations/:id/buildings/:entitySlug` (registered before list routes for first-match routing)
- `AgentsView` / `BuildingsView` — `entitySlug` property, slug-based deep-linking, URL push on card click/close/navigate
- `AgentCard` / `BuildingCard` — crawlable hidden `<a>` links for SEO (`position:absolute; clip:rect(0,0,0,0)`)

### URL Examples

```
/simulations/velgarien/agents/elena-voss
/simulations/velgarien/buildings/kathedrale-des-lichts
/simulations/station-null/agents/chaplain-isadora-mora
```

### Crawler Response (what Googlebot sees)

For `/simulations/velgarien/agents/elena-voss`:
1. `<title>Agents — Velgarien | metaverse.center</title>`
2. `<meta name="description" content="...">` with simulation description
3. `<link rel="canonical" href="https://metaverse.center/simulations/velgarien/agents/elena-voss">`
4. `<script type="application/ld+json">` with Person schema (name, jobTitle, description, url, image, gender)
5. `<script type="application/ld+json">` with BreadcrumbList (Home > Dashboard > Velgarien > Agents)
6. `<div id="seo-content">` with semantic HTML (h2, p.role, character text)
7. UUID URLs get 301 redirected to slug URLs

### Sitemap

`/sitemap.xml` now includes slug-based entity URLs:
```xml
<url><loc>https://metaverse.center/simulations/velgarien/agents/elena-voss</loc>...</url>
<url><loc>https://metaverse.center/simulations/velgarien/buildings/kanzlerpalast</loc>...</url>
```

### Future: Lore/Chronicle Slug Routes

Lore chapters and chronicle editions could follow the same pattern using natural identifiers (chapter slugs). Not yet implemented.

## GA4

- Measurement ID: `G-GP0Y16L51G`
- Set in `.env` (local), Railway env vars (production)
- **Dockerfile** must declare `ARG VITE_GA4_MEASUREMENT_ID` (added alongside `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) — Vite inlines env vars at build time, so missing ARG = empty measurement ID = no gtag.js in production
- Cookie consent stored in `localStorage('analytics-consent')` as 'granted' or 'denied'
- **Production-only guard:** `init()` checks `import.meta.env.PROD` — no gtag.js loaded or event listeners registered in dev mode

### Comprehensive Event Tracking

Declarative EVENT_MAP in `AnalyticsService.ts` maps DOM CustomEvents to GA4 events. All Lit custom events use `bubbles: true, composed: true`, so document-level listeners catch everything — zero component changes needed for DOM events. Check current count: `grep -c "'" frontend/src/services/AnalyticsService.ts` (approximate).

| Category | Events | Count | Source |
|----------|--------|:-----:|--------|
| Entity views | `view_agent`, `view_building`, `view_event`, `view_campaign`, `select_simulation` | 5 | EVENT_MAP |
| Entity CRUD | `save_agent`, `save_building`, `save_event`, `save_location`, `save_settings` | 5 | EVENT_MAP |
| Entity delete | `delete_agent`, `delete_building`, `delete_event` | 3 | EVENT_MAP |
| Edit modals | `open_edit_modal` (agent/building/event) | 3 | EVENT_MAP |
| Chat | `send_chat_message`, `select_chat_agents`, `select_conversation` | 3 | EVENT_MAP |
| Social | `transform_trend`, `integrate_trend`, `transform_post`, `analyze_post`, `transform_complete` | 5 | EVENT_MAP |
| Locations | `select_city`, `select_zone` | 2 | EVENT_MAP |
| Search | `apply_filter` | 1 | EVENT_MAP |
| Media | `view_lightbox_image` | 1 | EVENT_MAP (Lightbox dispatches `lightbox-open`) |
| Auth UI | `open_login_panel` | 1 | EVENT_MAP |
| Landing | `landing_cta_click`, `landing_section_view` | 2 | EVENT_MAP |
| Funnel | `tutorial_complete`, `create_simulation`, `accept_invitation`, `join_epoch` | 4 | EVENT_MAP |
| Auth | `login`, `logout` | 2 | SupabaseAuthService |
| Locale | `change_locale` | 1 | locale-service |
| AI Generation | `generation_start`, `generation_complete`, `generation_error` | 3 | GenerationProgressService |
| Consent | `consent_granted`, `consent_revoked` | 2 | AnalyticsService |
| Web Vitals | `web_vitals` (CLS, LCP, INP, TTFB) | 1 | AnalyticsService (web-vitals lib) |

**Service-level tracking (8 non-DOM events):** Added directly in `SupabaseAuthService._syncAppState()` (login/logout via `_previouslyAuthenticated` flag), `LocaleService.setLocale()`, `GenerationProgressService.withProgress()` (start/complete/error), and `AnalyticsService.grantConsent()`/`revokeConsent()`.

**Lightbox tracking:** `VelgLightbox` dispatches `lightbox-open` CustomEvent in `updated()` when `src` becomes truthy. Tracked from all usage sites (LoreScroll, AgentsView, BuildingsView) with zero consumer changes.

**User properties:** `setUserProperties()` sets GA4 user properties for audience segmentation: `user_type` (admin/member/anon), `has_forge_access` (boolean), `locale` (en/de). Called from `app-shell` after auth state resolves.

**Config notes:**
- `link_attribution: true` is set in gtag config for enhanced link attribution (tracks which specific link was clicked when multiple links point to the same destination)
- Scroll tracking, site search, outbound clicks, and file downloads are controlled in GA4 Admin UI → Enhanced Measurement settings, not in gtag config

## Slug-Based URLs

URLs use slugs instead of UUIDs at both simulation and entity level:
- Simulation: `/simulations/speranza/lore` instead of `/simulations/40000000-.../lore`
- Entity: `/simulations/velgarien/agents/elena-voss` instead of `.../agents/abc123-...` (Migration 137)

**Backend changes:**
- `routers/public.py` — New `/api/v1/public/simulations/by-slug/{slug}` endpoint (placed before UUID endpoint to avoid route conflicts)
- `routers/seo.py` — Sitemap uses `sim['slug']` in URLs, added lore + multiverse pages
- `middleware/seo.py` — Handles both UUID and slug paths, 301 redirects for crawlers from UUID→slug, canonical URL always uses slug
- `app.py` — Crawler redirect logic before enrichment in `serve_spa`
- `models/user.py` — `MembershipInfo` includes `simulation_slug`
- `services/member_service.py` — Selects slug from simulations join

**Frontend changes:**
- `services/api/SimulationsApiService.ts` — `getBySlug(slug)` method
- `app-shell.ts` — `_resolveSimulation(idOrSlug)` detects UUID vs slug, resolves slug→UUID via API, rewrites UUID URLs to slugs via `history.replaceState`
- 8 components updated to use `simulation.slug` in navigation: SimulationCard, SimulationsDashboard, PlatformHeader, CreateSimulationWizard, UserProfileView, SimulationNav, CartographerMap, app-shell

**Backward compatibility:** Old UUID URLs still resolve and are silently rewritten to slug URLs.

## Test Coverage

Query live test counts:
```bash
cd backend && python -m pytest --co -q 2>/dev/null | tail -1   # backend
cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -5  # frontend
```
- E2E: 73 specs across 12 files
- Tests require `happy-dom` package (installed as devDependency)
