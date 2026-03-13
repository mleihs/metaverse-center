---
title: "SEO, GA4 & Deep Linking Implementation"
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
- `backend/middleware/security.py` — CSP header with GA4 domains
- `.env`, `.env.example`, `.env.production.example` — VITE_GA4_MEASUREMENT_ID
- 8 components updated with lightbox alt text (AgentCard, AgentDetailsPanel, BuildingCard, BuildingDetailsPanel, ChatWindow, MessageList, SocialTrendsView, LoreScroll)

## Key Technical Decisions

1. **Deep linking fix**: `_loadSimulationContext()` fetches simulation via `simulationsApi.getById()` when not in appState
2. **URL navigation**: `@lit-labs/router` v0.1.4 `goto()` doesn't call pushState — manual pushState added to `_handleNavigate`
3. **Crawlable links**: Progressive enhancement — `<a href>` with `e.preventDefault()` + CustomEvent dispatch for SPA nav
4. **Crawler detection**: User-Agent regex against 10 known bots (Googlebot, bingbot, Twitterbot, etc.)
5. **HTML enrichment**: String replacement on cached index.html (not DOM parsing), with XSS escaping
6. **GA4**: Consent Mode v2, analytics_storage denied by default, manual page_view on SPA navigation
7. **CSP**: `'unsafe-inline'` required for style-src (Lit adopted stylesheets + ThemeService)
8. **Alt text**: Composed from DB fields used in image generation (character, background, profession for agents; type, zone, description, condition for buildings)

## Crawlability Limitations

- **Individual entity pages NOT crawlable** — agent/building detail panels are client-side modals (VelgSidePanel), no routes like `/simulations/:id/agents/:agentId` exist
- **Crawlers see simulation-level pages only** — e.g., "Agents - Station Null | metaverse.center" with simulation description
- **To make entities crawlable**: Would need individual routes + crawler enrichment per entity + sitemap entries

---

## TODO: Entity-Level SEO (Future)

### Problem

Crawlers see simulation-level pages ("Agents — Station Null") but NOT individual entity content. Agent detail panels (e.g., Chaplain Isadora Mora with character, background, professions) are client-side modals with no URL. Social shares of individual entities show generic simulation metadata.

### Current Entity Inventory

Query live counts:
```bash
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "
  SELECT s.name,
    (SELECT count(*) FROM agents a WHERE a.simulation_id=s.id AND a.deleted_at IS NULL) AS agents,
    (SELECT count(*) FROM buildings b WHERE b.simulation_id=s.id AND b.deleted_at IS NULL) AS buildings,
    (SELECT count(*) FROM zones z WHERE z.simulation_id=s.id) AS zones,
    (SELECT count(*) FROM city_streets cs WHERE cs.simulation_id=s.id) AS streets
  FROM simulations s WHERE s.status='active' ORDER BY s.name;
"
```

Public API endpoints for individual entities already exist (`/api/v1/public/simulations/{id}/agents/{agent_id}`, etc.) but have no frontend routes or sitemap entries.

### Approach Evaluation

Five approaches evaluated. Each assessed on architecture fit, SEO quality, maintainability as the project grows, and hosting implications on Railway/similar container platforms.

---

#### Option 1: Current State (Done)

**What it is:** Simulation-level meta tags + crawler injection. No entity pages.

| Aspect | Assessment |
|--------|-----------|
| **SEO visibility** | Simulation pages indexed with proper titles/descriptions/OG. Individual entities invisible to search. Social previews show simulation, not entity. |
| **Architecture** | Clean. No additional complexity. |
| **Maintainability** | Zero ongoing cost. |
| **Hosting (Railway)** | No impact. Python-only backend. |

**Pros:**
- Already implemented and tested
- Zero additional infrastructure or maintenance
- Googlebot DOES execute JS (eventually) — entity content may appear in search after render queue delay

**Cons:**
- Individual entities like "Chaplain Isadora Mora" will never appear as distinct search results
- Social shares of entities show generic simulation preview, not entity-specific content
- No individual entity URLs to share

**Best for:** Projects where entities are secondary to the simulation-level view.

---

#### Option 2: Entity Routes + Extended Dynamic Rendering (Recommended)

**What it is:** Add frontend routes (`/simulations/:id/agents/:agentId`) + extend the existing Python crawler middleware to inject semantic HTML + JSON-LD for those routes. No new runtime dependencies.

**Implementation sketch:**
1. **Frontend:** Add entity routes to `app-shell.ts` that open the detail panel for a specific entity (same UI, but with a URL)
2. **Backend:** Extend `enrich_html_for_crawler()` to detect entity-level paths, fetch entity data via Supabase anon client, inject semantic HTML (`<article>`, `<h2>`, `<img>`, `<p>`) + JSON-LD structured data
3. **Sitemap:** Extend `sitemap.xml` generation to include entity URLs (~63 pages currently)
4. **Optional:** Jinja2 templates for crawler HTML (cleaner than string concatenation)

| Aspect | Assessment |
|--------|-----------|
| **SEO visibility** | Individual entities appear in search results. Social shares show entity-specific OG tags (name, portrait, description). JSON-LD enables rich snippets. |
| **Architecture** | Natural extension of existing middleware. No new runtimes. Same Supabase queries the public API already uses. |
| **Maintainability** | Medium. Python templates for crawler content must roughly mirror Lit component structure. But crawler templates are simple semantic HTML, not complex UI — they rarely need updating. |
| **Hosting (Railway)** | No change. Same single Python container. ~20-50ms per crawler request for DB query (cacheable). |

**Pros:**
- No Node.js required — not at build time, not in production
- Real-time data — crawlers always see current entity state
- Incremental — add one entity type at a time (agents first, then buildings, then events)
- Reuses existing infrastructure (`is_crawler()`, `enrich_html_for_crawler()`, public API data)
- Works perfectly on Railway's single-container deployment
- Entity URLs become shareable (deep links to specific agents/buildings)
- Google's policy explicitly allows dynamic rendering when content is equivalent

**Cons:**
- Dual template maintenance — crawler HTML templates (Python/Jinja2) and Lit components both render entity data, changes must be mirrored
- Crawler HTML won't match SPA visual fidelity (semantic content only, no styled UI)
- No benefit for screenshot-based previews (Twitter/Slack show OG image, not rendered page)

**Effort:** ~2-3 days for agents + buildings, incremental for other entities.

**Files to create/modify:**
- `frontend/src/app-shell.ts` — add routes `/simulations/:id/agents/:agentId`, `/simulations/:id/buildings/:buildingId`
- `backend/middleware/seo.py` — extend path parsing + entity data fetching + HTML injection
- `backend/templates/seo/` — optional Jinja2 templates for semantic HTML
- `backend/routers/seo.py` — extend sitemap with entity URLs
- Frontend entity views — open detail panel when route has entity ID param

---

#### Option 3: Playwright Build-Time Pre-rendering

**What it is:** After `vite build`, a Playwright script visits every entity URL in headless Chrome, captures the fully rendered HTML, and saves it to disk. FastAPI serves these pre-rendered files to crawlers.

| Aspect | Assessment |
|--------|-----------|
| **SEO visibility** | Highest visual fidelity — crawlers see the actual rendered page with all CSS/styling. |
| **Architecture** | Adds a Node.js build step. Production remains Python-only. Requires the SPA to be running during pre-render (local dev server or temporary process). |
| **Maintainability** | Low ongoing cost after setup — pre-render script just visits URLs. But cache invalidation is manual (re-run on data changes). |
| **Hosting (Railway)** | Build-time only, but Railway build containers need Playwright + Chromium (~400MB). Build times increase significantly (2-5s per page × 63+ pages = 2-5 min). Docker image size increases. |

**Pros:**
- Pixel-perfect rendering — crawlers see exactly what users see
- No dual template maintenance — single source of truth (Lit components)
- Production-proven pattern (used by many SPAs)
- Playwright already in the project's devDependencies

**Cons:**
- **Stale content** — pre-rendered pages are snapshots from build time, not live data
- **Build time bloat** — Railway builds become significantly slower as entity count grows (linear scaling: 100 entities = ~5 min, 500 entities = ~25 min)
- **Docker image size** — Chromium adds ~400MB to the production image, even though it's only used at build time (unless you separate build/runtime images)
- **Cache invalidation** — need a trigger to re-build when entities change (webhook, cron, or manual)
- **CI/CD complexity** — build step needs running FastAPI + Supabase (or mock data) to render pages
- **Railway resource limits** — free/hobby tier may timeout or OOM during Chromium rendering of many pages
- **Doesn't scale** — if the project grows to 500+ entities across 10+ simulations, build times become prohibitive

**Effort:** ~3-4 days for initial setup + CI/CD integration.

---

#### Option 4: Astro/11ty Hybrid (SSR/SSG Framework)

**What it is:** Introduce a Node.js framework (Astro or 11ty) that renders public SEO pages, while the existing Lit SPA handles authenticated/interactive pages.

| Aspect | Assessment |
|--------|-----------|
| **SEO visibility** | Excellent — full SSR/SSG with proper hydration. Best-in-class for content sites. |
| **Architecture** | **Fundamental restructuring.** Two frontend systems (Astro + Lit SPA) with routing split between them. Shared components must work in both contexts. |
| **Maintainability** | High ongoing cost. Two build systems, two routing systems, shared state management across boundary. Every UI change potentially requires updates in both systems. |
| **Hosting (Railway)** | Requires Node.js in production (for SSR) or at build time (for SSG). SSR mode needs a separate service or combined Python+Node container. SSG has same build-time scaling issues as Playwright option. |

**Pros:**
- Best SEO quality (full HTML with hydration, JSON-LD, structured data)
- Modern framework with active ecosystem (Astro 5.x)
- Island architecture controls JS loading precisely
- If starting from scratch, this would be the ideal choice

**Cons:**
- **Astro's official `@astrojs/lit` integration was deprecated in v5** — community `@semantic-ui/astro-lit` exists but is not officially supported
- **Migration cost is prohibitive** — rewrites routing, page templates, state management for all public pages
- **Two frontend systems** — doubled cognitive overhead, harder onboarding, more things that can break
- **Node.js in production** — Railway needs a second service or polyglot container (Python + Node)
- **Community dependency risk** — the Lit integration depends on `@lit-labs/ssr` (experimental) under the hood
- **11ty's Lit plugin** is also experimental, lightly maintained
- **Overkill** — introduces an entire framework to solve what is fundamentally a content injection problem

**Effort:** ~2-3 weeks minimum for migration + testing.

---

#### Option 5: @lit-labs/ssr (Native Lit SSR)

**What it is:** Use Lit's own SSR package to render Lit components to HTML strings (with Declarative Shadow DOM) on the server.

| Aspect | Assessment |
|--------|-----------|
| **SEO visibility** | High — rendered HTML with DSD, hydration on client. Components render identically to client-side. |
| **Architecture** | Requires Node.js sidecar service or build-time rendering. Lit components must be SSR-compatible (no async rendering, shadow DOM only). |
| **Maintainability** | Medium — single component source of truth, but SSR compatibility constraints limit component design. Breaking changes possible (Labs status). |
| **Hosting (Railway)** | Node.js required. Sidecar service means a second Railway service (~$5/mo minimum). Or build-time only (same scaling issues as Playwright). |

**Pros:**
- Single source of truth — same Lit components render on server and client
- Declarative Shadow DOM has 94%+ browser support (2026)
- Hydration is seamless when it works

**Cons:**
- **Experimental (`@lit-labs`)** — may receive breaking changes or lose support
- **No async component support** — components that fetch data during rendering are not supported (ALL entity panels do this)
- **No Vite integration** — no `vite-plugin-lit-ssr` exists, requires custom build pipeline
- **Node.js required** — either sidecar service or build step
- **Shadow DOM only** — light DOM components can't be SSR'd
- **High risk** — betting production SEO on an experimental package

**Effort:** ~1-2 weeks, with ongoing risk of breaking changes.

---

### Comparison Matrix

| Criterion | Option 1 (Current) | Option 2 (Dynamic Rendering) | Option 3 (Playwright) | Option 4 (Astro/11ty) | Option 5 (Lit SSR) |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **SEO: Entity indexing** | None | Good | Best | Best | Good |
| **SEO: Social previews** | Sim-level | Entity-level OG | Entity-level OG | Entity-level OG | Entity-level OG |
| **SEO: Rich snippets** | No | Yes (JSON-LD) | Possible | Yes | Possible |
| **Architecture: Complexity** | None | Low | Medium | Very High | High |
| **Architecture: Node.js needed** | No | **No** | Build only | **Yes (prod)** | **Yes** |
| **Architecture: Single container** | Yes | **Yes** | Yes | No (SSR) | No |
| **Maintainability: Template duplication** | None | Medium | None | High | None |
| **Maintainability: Build complexity** | None | None | High | High | Medium |
| **Maintainability: Dependency risk** | None | None | Low | Medium | **High (Labs)** |
| **Scaling: 50 entities** | N/A | Trivial | ~2 min build | ~2 min build | ~2 min build |
| **Scaling: 500 entities** | N/A | Trivial | ~25 min build | ~25 min build | ~25 min build |
| **Scaling: 5000 entities** | N/A | **Trivial** | Impractical | Impractical | Impractical |
| **Railway: Cost** | $0 | $0 | $0 (build time) | +$5/mo (SSR) | +$5/mo |
| **Railway: Build time impact** | None | None | +2-25 min | +2-25 min | +1-5 min |
| **Railway: Image size** | ~200MB | ~200MB | +400MB (Chromium) | +200MB (Node) | +200MB (Node) |
| **Data freshness** | N/A | **Real-time** | Build-time snapshot | Configurable | Configurable |
| **Effort** | Done | **~2-3 days** | ~3-4 days | ~2-3 weeks | ~1-2 weeks |

### Recommendation

**Option 2 (Entity Routes + Extended Dynamic Rendering)** is the clear winner for this project:

1. **Zero new infrastructure** — extends existing Python middleware, no Node.js
2. **Real-time data** — no stale content, no cache invalidation headaches
3. **Scales linearly with zero build-time cost** — 5 entities or 5000, same ~20ms per crawler request
4. **Single Railway container** — no additional services or costs
5. **Incremental** — ship agents first, add buildings later, events after that
6. **Low risk** — no experimental dependencies, just Python + SQL + HTML

The only trade-off (dual template maintenance) is minor — crawler templates are 20-30 lines of semantic HTML per entity type, not complex UI components. They change rarely.

### Implementation Priority (when ready)

1. Add `/simulations/:id/agents/:agentId` route to frontend (opens detail panel with URL)
2. Extend `enrich_html_for_crawler()` for agent detail paths
3. Add agent JSON-LD structured data (Person schema)
4. Extend sitemap.xml with agent URLs
5. Repeat for buildings (LocalBusiness/Place schema)
6. Repeat for events (Event schema)

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
| Auth | `login`, `logout` | 2 | SupabaseAuthService |
| Locale | `change_locale` | 1 | locale-service |
| AI Generation | `generation_start`, `generation_complete`, `generation_error` | 3 | GenerationProgressService |
| Consent | `consent_granted`, `consent_revoked` | 2 | AnalyticsService |

**Service-level tracking (8 non-DOM events):** Added directly in `SupabaseAuthService._syncAppState()` (login/logout via `_previouslyAuthenticated` flag), `LocaleService.setLocale()`, `GenerationProgressService.withProgress()` (start/complete/error), and `AnalyticsService.grantConsent()`/`revokeConsent()`.

**Lightbox tracking:** `VelgLightbox` dispatches `lightbox-open` CustomEvent in `updated()` when `src` becomes truthy. Tracked from all usage sites (LoreScroll, AgentsView, BuildingsView) with zero consumer changes.

## Slug-Based URLs (Added Later)

URLs now use simulation slugs instead of UUIDs: `/simulations/speranza/lore` instead of `/simulations/40000000-.../lore`.

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
