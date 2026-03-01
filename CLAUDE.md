# metaverse.center — Development Guidelines

## Core Principles

**Clean architecture and no workarounds.** This is non-negotiable:

- Follow the spec documents. Every implementation decision has a corresponding spec — read it first.
- No hacks, no TODO-later, no "temporary" shortcuts. If something can't be done properly right now, flag it rather than patching around it.
- Proper separation of concerns: routers handle HTTP, services handle logic, models handle validation.
- No code duplication. Extract shared patterns into base classes or utilities.
- Every layer must be independently testable.
- If a workaround seems necessary, the design is wrong — fix the design.

## Project Overview

Multi-simulation platform rebuilt from a single-world Flask app. See `00_PROJECT_OVERVIEW.md` for full context.

**Current Status:** All 6 phases complete + i18n fully implemented + codebase audit applied + architecture audit applied + full-stack audit remediation (security hardening, dead code removal, code deduplication, accessibility, epoch theming, SEO improvements) + lore expansion + dashboard LoreScroll + per-simulation theming + WCAG contrast validation + public-first architecture (anonymous read access) + anonymous view audit applied + Station Null (sim 3) added + Speranza (sim 4) added + per-simulation lore pages (4×6 chapters) + SEO/GA4/deep-linking implemented + GA4 comprehensive event tracking (37 events) + Agent Relationships + Event Echoes (Bleed mechanic) + Cartographer's Map (multiverse force-directed graph with starfield, energy pulses, node glow drift) + Settings architecture cleanup (shared CSS + BaseSettingsPanel base class) + Slug-based URLs (`/simulations/speranza/lore` instead of UUIDs) + Building description prompt fix (short functional output) + Embassies & Ambassadors (cross-sim diplomatic buildings, `is_ambassador` computed flag, `.card--embassy` pulsing ring + gradient hover effects with per-theme colors, 4-step creation wizard with ambassador assignment) + UI polish (SimulationNav diagonal gradient dwell effects, PlatformHeader marching ants map button, LoreScroll microanimations, close button hover effects) + English default locale + Game Systems (materialized views, mechanics service, info bubbles, AI prompt integration, bleed threshold/echo pipeline) + AI Relationship Generation (inline review flow in AgentDetailsPanel) + Dramatic Microanimations (23 files: staggered card grids, panel cascades, badge pops, impact bar segment grows, directional chat messages, tab crossfades, toast slide-out fix, theme-aware duration scaling) + Game Feature Completions (6 operative effects with game state effects: spy intel reveal, saboteur zone damage, propagandist events, assassin blocking, infiltrator reduction, alliance/betrayal) + Game Balance Tuning v2.1 (guardian 0.08/cap 0.20, scoring rebalance, betrayal −25%, alliance 15%) + Game Instances (template cloning for balanced PvP) + How-to-Play tutorial (dark military-console guide with match replays + changelog section) + Epoch Invitations (lore-flavored email invites via Resend API + OpenRouter AI lore generation) + Epoch Realtime Chat (REST + Supabase Broadcast, dual-channel epoch/team comms, presence tracking, cycle-ready signals) + Operations Board COMMS sidebar (collapsible chat panel on epoch list view) + Cartographer's Map game instance visualization (phase rings, health arcs, sparklines, operative trails, battle feed, leaderboard panel, minimap) + full-stack audit v2 (security hardening, PyJWT migration, component decomposition, CSS token migration, grid deduplication) + SEO structured data (JSON-LD schema.org markup) + Platform Admin Panel (user management via SECURITY DEFINER RPC, runtime cache TTL controls, dark tactical HUD aesthetic). 160 tasks. ~1860 localized UI strings (EN/DE). Production deployed on Railway + hosted Supabase. 4 simulations: Velgarien (dark), Capybara Kingdom (fantasy), Station Null (sci-fi horror), Speranza (post-apocalyptic).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Uvicorn + Pydantic v2 |
| Frontend | Lit 3.3 + Preact Signals + TypeScript + Vite |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT) |
| Email | Resend API (transactional epoch invitations) |
| AI | OpenRouter (chat, generation, lore) + Replicate (images) |
| Linting | Biome 2.4 (frontend), ruff (backend) |
| Testing | pytest (backend), vitest + happy-dom (frontend), Playwright (E2E) |

## Architecture

**Hybrid Supabase pattern:**
- Frontend -> Supabase directly: Auth, Storage, Realtime
- Frontend -> FastAPI: Business logic, AI pipelines, CRUD
- FastAPI -> Supabase with **User-JWT** (RLS active, NOT service_role for normal ops)

**Defense in Depth:** FastAPI `Depends()` validates roles (Layer 1), Supabase RLS validates access (Layer 2).

**Public-First Architecture:** All simulation data is browsable read-only without membership. Frontend API services use `BaseApiService.getSimulationData()` which checks both `appState.isAuthenticated.value` AND `appState.currentRole.value` — routes to `/api/v1/public/*` (anon RLS) when unauthenticated or not a member, `/api/v1/*` (authenticated RLS) when a member. This ensures authenticated non-members can browse any simulation without 403 errors. Backend public router uses `get_anon_supabase()` with anon RLS policies. Write operations require authentication + membership. LoginPanel slides in from right via `VelgSidePanel`.

## Directory Structure

```
backend/              FastAPI application
  app.py              Entry point (registers 31 routers)
  config.py           Settings (pydantic-settings, extra="ignore", resend_api_key for email)
  dependencies.py     JWT auth, Supabase client (user/anon/admin), role checking
  routers/            API endpoints — 31 routers, 236 endpoints (/api/v1/... + /api/v1/public/... + /api/v1/admin/...)
  models/             Pydantic request/response models (20 files)
  services/           Business logic (BaseService + 23 entity + audit + simulation + external + email + admin)
  middleware/         Rate limiting, security headers (CSP), SEO crawler detection + HTML enrichment
  utils/              Encryption (AES-256 for settings), search helpers
  tests/              pytest tests (500 tests: unit + integration + security + performance)
frontend/             Lit + Vite application
  src/
    app-shell.ts      Main app with @lit-labs/router (auth + simulation-scoped routes)
    components/
      auth/           Login, Register views, LoginPanel (slide-in)
      platform/       PlatformHeader, UserMenu, DevAccountSwitcher, SimulationsDashboard, LoreScroll, CreateSimulationWizard, UserProfileView, InvitationAcceptView
      layout/         SimulationShell, SimulationHeader, SimulationNav
      shared/         16 reusable components + 10 shared CSS modules + BaseSettingsPanel base class (see Code Reusability)
      agents/         AgentsView, AgentCard, AgentEditModal, AgentDetailsPanel
      buildings/      BuildingsView, BuildingCard, BuildingEditModal, BuildingDetailsPanel, EmbassyCreateModal, EmbassyLink
      events/         EventsView, EventCard, EventEditModal, EventDetailsPanel
      chat/           ChatView, ChatWindow, ConversationList, MessageList, MessageInput, AgentSelector
      social/         SocialTrendsView, SocialMediaView, CampaignDashboard, TrendCard, PostCard, TransformationModal, PostTransformModal, CampaignCard
      locations/      LocationsView, CityList, ZoneList, StreetList, LocationEditModal
      lore/           SimulationLoreView, lore-content dispatcher, 4 content files (per-simulation ~3500 words each)
      multiverse/   CartographerMap, MapGraph, MapConnectionPanel, MapTooltip, MapBattleFeed, MapLeaderboardPanel, MapMinimap, map-force, map-data, map-types
      settings/       SettingsView + 7 panels (General, World, AI, Integration, Design, Access, View) + BleedSettingsPanel
      epoch/          EpochCommandCenter (orchestrator), EpochOpsBoard, EpochOverviewTab, EpochOperationsTab, EpochAlliancesTab, EpochLobbyActions, EpochCreationWizard, DeployOperativeModal, EpochLeaderboard, EpochBattleLog, EpochInvitePanel, EpochInviteAcceptView, EpochChatPanel, EpochPresenceIndicator, EpochReadyPanel
      how-to-play/    HowToPlayView, htp-styles, htp-types, htp-content-rules, htp-content-matches
      admin/          AdminPanel (tabbed shell), AdminUsersTab (user/membership CRUD), AdminCachingTab (cache TTL controls)
      health/         SimulationHealthView
    services/         Supabase client, 20 API services (incl. AdminApiService), AppStateManager, NotificationService, ThemeService, theme-presets, SeoService, AnalyticsService
      realtime/       RealtimeService (singleton, Supabase Realtime channels for epoch chat/presence/status)
      i18n/           LocaleService + FormatService
    locales/          i18n files
      generated/      Auto-generated: de.ts, locale-codes.ts (DO NOT EDIT)
      xliff/          Translation interchange: de.xlf (EDIT THIS for translations)
    styles/           CSS design tokens (tokens/: 8 files — colors, typography, spacing, borders, shadows, animation, layout, z-index) + base styles (base/)
    utils/            Shared utilities (text.ts, icons.ts, theme-colors.ts)
    types/            TypeScript interfaces (index.ts) + Zod validation schemas (validation/)
  tests/              vitest tests (386 tests: validation + API + notification + theme contrast + SEO/analytics + settings)
e2e/                  Playwright E2E tests (81 specs across 12 files)
  playwright.config.ts
  helpers/            auth.ts, fixtures.ts
  tests/              auth, agents, buildings, events, chat, settings, multi-user, social
supabase/
  migrations/         41 SQL migration files (001-037 + ensure_dev_user + 040 platform_settings)
  seed/               16 SQL seed files (7 active: 001, 006-008, 010, 015-016; 9 archived with _ prefix: 002-005, 009, 011-014)
  config.toml         Local Supabase config
scripts/              Image generation scripts (5: velgarien, capybara, station_null, speranza, dashboard) + lore images
concept.md            Game design proposal (~9300 words) with expanded meta-lore + research appendix
```

## Important Commands

```bash
# Backend
source backend/.venv/bin/activate
uvicorn backend.app:app --reload              # Dev server on :8000
python3.13 -m pytest backend/tests/ -v        # Run tests
python3.13 -m ruff check backend/             # Lint
python3.13 -m ruff check --fix backend/       # Auto-fix lint issues

# Frontend (run from frontend/ directory)
npm run dev                                    # Vite dev server on :5173
npx vitest run                                 # Run tests
npx tsc --noEmit                              # TypeScript type-check (run BEFORE push)
npx biome check src/                          # Lint
npx biome check --write src/                  # Auto-fix lint issues
npx lit-localize extract                       # Extract msg() strings to XLIFF
npx lit-localize build                         # Build de.ts from XLIFF translations

# Database
supabase start                                 # Start local Supabase
supabase db reset                              # Reset + reapply all migrations
supabase status                                # Check container status
# Direct SQL via Docker (when psql not available or MCP times out)
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SQL..."

# Server Restart (ALWAYS use this sequence — orphaned workers can hold ports)
# Step 1: Kill by process name (catches parent + workers)
pkill -9 -f uvicorn 2>/dev/null; pkill -9 -f "node.*vite" 2>/dev/null; pkill -9 -f "npm exec vite" 2>/dev/null
# Step 2: Kill orphaned Python multiprocessing workers
ps aux | grep "multiprocessing.spawn\|multiprocessing.resource_tracker" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
# Step 3: Wait for ports to free
sleep 3
# Step 4: Verify ports are free (no LISTEN output = good)
netstat -an | grep -E '\.8000|\.5173' | grep LISTEN
# Step 5: Start backend (from project root)
cd /Users/mleihs/Dev/velgarien-rebuild && source backend/.venv/bin/activate
nohup uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000 > /tmp/velgarien-backend.log 2>&1 &
# Step 6: Start frontend (from frontend/ directory)
cd /Users/mleihs/Dev/velgarien-rebuild/frontend
nohup npx vite --host 0.0.0.0 --port 5173 > /tmp/velgarien-frontend.log 2>&1 &
# Step 7: Verify both started (wait ~5s, check health + logs)
sleep 5 && curl -s http://localhost:8000/api/v1/health && head -5 /tmp/velgarien-backend.log

# Docker queries (when psql not available)
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SELECT ..."

# Pre-Push Checklist (run ALL before git push)
cd frontend && npx tsc --noEmit               # TypeScript type-check (catches CI failures)
cd frontend && npx biome check src/           # Lint check
cd frontend && npx vitest run                 # Unit tests
python3.13 -m ruff check backend/            # Backend lint
python3.13 -m pytest backend/tests/ -v       # Backend tests

# Production Deployment
SUPABASE_ACCESS_TOKEN=sbp_... supabase db push    # Push migrations to production
git push origin main                                # Code deploy (Railway auto-builds)
curl -s https://metaverse.center/api/v1/health     # Verify production health
# Notify search engines of updated pages (IndexNow — Bing/Yandex/Seznam/Naver)
curl -s -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json" \
  -d "$(curl -s https://metaverse.center/sitemap.xml | grep -oE 'https://metaverse\.center/[^<]+' | jq -Rsc '{host:"metaverse.center",key:"299fb48f40654304a83169241a35900a",keyLocation:"https://metaverse.center/299fb48f40654304a83169241a35900a.txt",urlList:split("\n")|map(select(length>0))}')"

# Production DB via REST API (NOT via MCP — MCP is local only!)
curl -s "https://bffjoupddfjaljqrwqck.supabase.co/rest/v1/TABLE?select=COLS" \
  -H "Authorization: Bearer sb_secret_..." \
  -H "apikey: sb_secret_..."

# Production Storage Upload
curl -X POST "https://bffjoupddfjaljqrwqck.supabase.co/storage/v1/object/BUCKET/PATH" \
  -H "Authorization: Bearer sb_secret_..." \
  -H "apikey: sb_secret_..." \
  -H "Content-Type: image/webp" \
  -H "x-upsert: true" \
  --data-binary @/tmp/image.webp

# Migration repair (if db push fails due to stale temp migration)
SUPABASE_ACCESS_TOKEN=sbp_... supabase migration repair --status reverted VERSION
```

## Supabase MCP

Two MCP servers configured in `.mcp.json`:

| Server | URL | Use |
|--------|-----|-----|
| `supabase` (local) | `http://127.0.0.1:54321/mcp` | `mcp__supabase__*` tools |
| `supabase-prod` | `https://mcp.supabase.com/mcp?project_ref=bffjoupddfjaljqrwqck` | `mcp__supabase-prod__*` tools |

**Local fallback** (when MCP times out): `docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SQL..."`

## Production Deployment

| Component | URL |
|-----------|-----|
| App (Railway + Cloudflare) | `https://metaverse.center` |
| Supabase (hosted) | `https://bffjoupddfjaljqrwqck.supabase.co` |

**Auth:** Production uses ES256 (ECC P-256) tokens verified via JWKS. Local uses HS256 with shared secret.

**Schema changes:** `supabase db push` (requires `SUPABASE_ACCESS_TOKEN` env var, format `sbp_...`, from Dashboard → Avatar → Access Tokens). Migration `ensure_dev_user` creates test user + Velgarien sim (idempotent, safe for production). Migrations 016-017 are data-only (Velgarien image config + Capybara Kingdom). Migration 018 adds 21 anon RLS policies for public read access. Migration 019 adds `idx_buildings_street` index. Migration 020 restricts `settings_anon_select` policy to `category = 'design'` only. Migration 021 adds Station Null simulation (6 agents, 7 buildings, 4 zones, 16 streets, 36 design settings). Migration 022 improves prompt diversity (max_tokens=300, template rewrites removing aesthetic redundancy). Migration 023 fixes horror aesthetic (Alien 1979 style prompts, guidance_scale 3.5→5.0, Flux-aware prompting). Migration 024 adds Speranza simulation (6 agents, 7 buildings, 4 zones, 16 streets, 37 design settings). Migration 025 adds 3 underground buildings to Speranza. Migration 026 adds agent_relationships, event_echoes, simulation_connections tables + demo data. Migration 027 fixes building description prompts (short functional output instead of 150-250 word narratives). Migration 028 adds embassies table + embassy_prompt_templates + RLS policies + triggers + 12 embassy buildings (3 per sim) + 6 cross-sim embassy connections with ambassador metadata. Migration 029 adds embassy prompt templates (EN/DE). Migration 030 fixes ambassador metadata swap on building reorder. Migration 031 adds 4 materialized views (mv_building_readiness, mv_zone_stability, mv_embassy_effectiveness, mv_simulation_health). Migration 032 adds 6 competitive layer tables (game_epochs, epoch_teams, epoch_participants, operative_missions, epoch_scores, battle_log) + RLS + triggers. Migration 033 widens simulation read access for game mechanics queries. Migration 034 adds `ambassador_blocked_until`, `infiltration_penalty`, `betrayal_penalty` columns for operative effects. Migration 035 adds `simulation_type`, `source_template_id`, `epoch_id` columns + `clone_simulations_for_epoch()` PL/pgSQL function (~250 lines) + `archive_epoch_instances()` + `delete_epoch_instances()` for game instance lifecycle. Migration 036 adds `epoch_invitations` table + RLS policies + indexes + epoch invitation prompt template. Migration 037 adds `epoch_chat_messages` table + `cycle_ready` column on epoch_participants + 4 RLS policies + 2 broadcast triggers + indexes for cursor-based pagination. Migration 040 adds `platform_settings` table (key-value runtime config, service_role-only RLS) + 6 default cache TTL seeds + 3 SECURITY DEFINER RPC functions (admin_list_users, admin_get_user, admin_delete_user) for platform admin user management.

**CRITICAL — NEVER run `supabase db reset` without EXPLICIT user approval.** This is a destructive operation that wipes all Docker volumes including storage files (images). **Always ask the user directly and prominently before running any DB reset.** Use `mcp__supabase__apply_migration` or `docker exec` to apply individual migrations instead. `supabase stop --no-backup` is equally destructive. If a reset is truly necessary, confirm with the user first, ensure images are backed up, and follow recovery procedures in `memory/local-db-reset-guide.md`. Local Supabase uses `sb_secret_`/`sb_publishable_` keys (NOT JWT service_role keys) — get from `supabase status`.

**Production DB modifications:** The `mcp__supabase__*` tools are LOCAL only. For production, use the Supabase REST API with the secret key (`sb_secret_...`, from Dashboard → Settings → API), or `supabase db push` with a temporary migration file. See `19_DEPLOYMENT_INFRASTRUCTURE.md` for full procedures.

**Env vars:** Railway service `metaverse-center` in project `metaverse.center`. See `.env.production.example` for required vars.

## Schema Naming Conventions

These renames were applied in the v2.0 schema to avoid SQL reserved words. **Always use the new names:**

| Old Name | New Name | Reason |
|----------|----------|--------|
| `role` | `member_role` / `sender_role` / `invited_role` | Reserved word |
| `key` / `value` | `setting_key` / `setting_value` | Reserved words |
| `type` | `building_type` / `event_type` / `street_type` / `taxonomy_type` | Reserved word |
| `condition` | `building_condition` | Reserved word |
| `category` | `prompt_category` | Ambiguous |
| `created_by` | `owner_id` (simulations) / `created_by_id` (agents, prompts) | Consistency |
| `portrait_url` | `portrait_image_url` | Explicit |
| `created_time` | `source_created_at` | Consistency |

## Database (42 Tables)

- **140+ RLS policies** — CRUD per table, role-based via helper functions + 21 anon SELECT policies for public read access + embassy policies + competitive layer policies + epoch chat policies
- **27+ triggers** — 16 updated_at + 6 business logic (slug immutability, status transitions, primary profession, last owner protection, conversation stats) + 3 new table triggers + competitive layer triggers + 2 epoch chat broadcast triggers
- **6 views** — 4 active_* (soft-delete filter) + simulation_dashboard + conversation_summaries
- **6 materialized views** — campaign_performance + agent_statistics + mv_building_readiness + mv_zone_stability + mv_embassy_effectiveness + mv_simulation_health
- **Phase 6 tables** — agent_relationships (intra-sim agent graph), event_echoes (cross-sim Bleed mechanic), simulation_connections (multiverse topology)
- **Competitive layer tables** — game_epochs, epoch_teams, epoch_participants, operative_missions, epoch_scores, battle_log, epoch_invitations, epoch_chat_messages
- **Platform settings** — platform_settings (key-value runtime config, service_role-only RLS)
- **4 storage buckets** — agent.portraits, building.images, user.agent.portraits, simulation.assets
- **19 functions** — RLS helpers, utility (generate_slug, validate_taxonomy_value), trigger functions, admin RPC (admin_list_users, admin_get_user, admin_delete_user via SECURITY DEFINER)

## API Pattern

All endpoints under `/api/v1/`. Swagger UI at `/api/docs`. Responses use unified format:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "count": 10, "total": 42, "limit": 25, "offset": 0 },
  "timestamp": "2026-02-15T12:00:00Z"
}
```

236 endpoints across 31 routers. Platform-level: `/api/v1/health`, `/api/v1/users/me`, `/api/v1/simulations`, `/api/v1/invitations`. Admin (platform admin only): `/api/v1/admin/settings`, `/api/v1/admin/users`, `/api/v1/admin/users/{id}/memberships` (8 endpoints, email-allowlist auth via `require_platform_admin()`). SEO: `/robots.txt`, `/sitemap.xml` (dynamic from DB, uses slugs). Simulation-scoped: `/api/v1/simulations/{simulation_id}/agents`, `buildings`, `events`, `agent_professions`, `locations`, `taxonomies`, `settings`, `chat`, `members`, `campaigns`, `social-trends`, `social-media`, `generation`, `prompt-templates`, `relationships`, `echoes`. Competitive layer: `epochs`, `operatives`, `scores`, `game-mechanics`, `epochs/{id}/invitations`, `epochs/{id}/chat`. Public (no auth, rate-limited 100/min): `/api/v1/public/simulations`, `/api/v1/public/simulations/{id}/*`, `/api/v1/public/simulations/by-slug/{slug}`, `/api/v1/public/epoch-invitations/{token}` (GET-only, 45 endpoints mirroring authenticated reads, delegates to service layer). Platform-level public: `/api/v1/public/connections`, `/api/v1/public/map-data`.

## Backend Patterns

- **Config:** `backend/config.py` — `Settings(BaseSettings)` with `extra="ignore"`, reads `.env`. Includes `resend_api_key` for transactional email. Imported as `app_settings` in `app.py` to avoid conflict with `routers.settings`.
- **Auth:** `get_current_user()` validates JWT via PyJWT (JWKS for ES256, shared secret for HS256), returns `CurrentUser(id, email, access_token)`. JWKS keys cached with 1-hour TTL. JWT errors sanitized (no internal details leaked).
- **Supabase client:** `get_supabase()` creates client with user's JWT (RLS enforced). `get_anon_supabase()` creates client with anon key only (no JWT, anon RLS policies for public endpoints).
- **Role checking:** `require_role("admin")` factory returns Depends() that checks simulation_members. `require_epoch_creator()` checks epoch ownership. `require_simulation_member("editor")` checks role via query param (for platform-level endpoints). `require_platform_admin()` checks email allowlist (`admin@velgarien.dev`) for platform admin endpoints — uses `get_admin_supabase()` (service_role) for DB access.
- **Rate limiting:** slowapi — 30/hr AI generation, 10/min AI chat, 5/min external API, 100/min standard
- **Models:** `PaginatedResponse[T]`, `SuccessResponse[T]`, `ErrorResponse` in `models/common.py`
- **BaseService:** Generic CRUD in `services/base_service.py` — uses `active_*` views for soft-delete filtering, optional `include_deleted=True` for admin queries. Set `view_name = None` for tables without soft-delete (e.g., campaigns, agent_professions, locations). Public `serialize_for_json()` utility for datetime/UUID/date conversion.
- **Entity services:** All CRUD routers use dedicated services — `AgentService` (with `list_for_reaction()` for lightweight AI queries, ambassador blocking check), `BuildingService`, `EventService` (with `generate_reactions()` for AI reaction generation), `CampaignService` (extends BaseService), `LocationService` (facade delegating to `CityService`/`ZoneService`/`StreetService`, all extending BaseService), `AgentProfessionService` (extends BaseService), `PromptTemplateService` (custom, uses `is_active` for soft-delete), `MemberService` (with `LastOwnerError` exception + `get_user_memberships()`), `SocialMediaService`, `SocialTrendsService`, `RelationshipService` (extends BaseService for agent_relationships), `EchoService` (cross-simulation writes via admin client, cascade prevention), `ConnectionService` (platform-level simulation connections), `EpochService` (game instance integration: start→clone, complete→archive, cancel→delete), `OperativeService` (6 operative effects + 2 game state effects: spy intel reveal, saboteur zone downgrade, propagandist event creation, assassin blocking, infiltrator reduction, alliance bonus, betrayal), `ScoringService` (5-dimension scoring with alliance/betrayal/spy bonuses), `GameMechanicsService`, `BattleLogService`, `GameInstanceService` (clone/archive/delete game instances via PL/pgSQL functions), `EpochInvitationService` (CRUD + lore generation via OpenRouter + email send via Resend API), `EpochChatService` (epoch chat messages CRUD + broadcast triggers), `EmailTemplates` (HTML email renderer)
- **Public router:** `routers/public.py` — 46 GET-only endpoints under `/api/v1/public`, rate-limited (100/min), uses `get_anon_supabase()` (no auth required). Includes `/simulations/by-slug/{slug}` for slug-based URL resolution, `/epoch-invitations/{token}` for invitation token validation, `/battle-feed` for global public battle log. Delegates to service layer (`AgentService`, `BuildingService`, `EventService`, `LocationService`, `SettingsService`, `SocialTrendsService`, `SocialMediaService`, `CampaignService`, `RelationshipService`, `EchoService`, `ConnectionService`, `EmbassyService`, `EpochService`, `ScoringService`, `BattleLogService`, `GameMechanicsService`, `EpochInvitationService`) for query consistency. Covers simulations, agents, buildings, events, locations (cities/zones/streets with detail views), chat, taxonomies, settings (design category only), social-media, social-trends, campaigns, relationships, echoes, connections, map-data, embassies, health, epochs (list/active/detail/participants/teams/leaderboard/standings/battle-log), battle-feed, epoch-invitations.
- **Router discipline:** Routers handle HTTP only — no direct DB queries, no business logic helpers, no late-binding imports. All service imports at module level. External service imports (Guardian, NewsAPI, Facebook, GenerationService) at module level.
- **AuditService:** `services/audit_service.py` — logs CRUD operations to `audit_log` table with entity diffs. Applied to all data-changing endpoints across all routers.
- **Search utility:** `utils/search.py` — `apply_search_filter(query, search, vector_field, fallback_fields)` for full-text search with ilike fallback
- **Admin services:** `AdminUserService` (user listing/detail/deletion via SECURITY DEFINER RPC, membership CRUD via PostgREST), `PlatformSettingsService` (key-value settings CRUD with cache invalidation), `CacheConfigService` (singleton reading TTL values from `platform_settings` table, used by echo_service, seo middleware, public router HTTP Cache-Control headers)
- **Encryption:** `utils/encryption.py` — AES-256 via `cryptography` for sensitive settings values

## Frontend Patterns

- **ALWAYS use `frontend-design` skill** when designing or polishing UI components. This ensures distinctive, high-quality aesthetics instead of generic defaults.
- Components extend `LitElement` with `@customElement('velg-...')`
- State via Preact Signals (`appState` in `AppStateManager.ts`)
- API calls through `BaseApiService` (auto-attaches JWT from appState). `getPublic()` method routes to `/api/v1/public/*` without Authorization header for anonymous access. `getSimulationData()` helper checks both `isAuthenticated` AND `currentRole` — routes to public endpoint when user is not authenticated OR not a member of the current simulation. Always import existing API service singletons (e.g., `simulationsApi`, `buildingsApi`) — never create inline service classes in components.
- **Public API routing pattern:** Simulation-scoped API services use `this.getSimulationData(path)` for read methods — routes to `/api/v1/public/*` when unauthenticated OR authenticated-but-not-a-member, and to `/api/v1/*` when authenticated AND a member. Applied to 14 services: Agents, Buildings, Events, Chat, Locations, Taxonomies, Settings, SocialMedia, SocialTrends, Campaigns, Relationships, Echoes, Embassies, Health. Special cases: `SettingsApiService` design category **always** uses public endpoint (anon RLS policy, migration 020); `SocialMediaApiService` has different public/auth paths so uses inline check. Platform-level services (Simulations, Connections, Epochs) check only `isAuthenticated`.
- **Multiverse Map:** Force-directed graph at `/multiverse` (platform-level route). Custom physics simulation in `map-force.ts` (~130 lines). SVG rendering in Lit Shadow DOM with pan/zoom. Mobile fallback to card list at ≤768px. Game instance visualization: dashed rotating border ring, phase ring pulse (color per epoch phase), 5-dimension health arcs (stability/influence/sovereignty/diplomatic/military), sparkline composite scores on template nodes, operative type trails on edges, search with node fade, zoom-to-cluster on double-click. `MapBattleFeed` scrolling ticker, `MapLeaderboardPanel` side panel, `MapMinimap` viewport overview. 30s auto-refresh during active epochs.
- **API contract:** Backend endpoints using query params (e.g., `assign-agent?agent_id=...`, `profession-requirements?profession=...`) must use `URLSearchParams` in the frontend — never send these as JSON body. `PaginatedResponse<T>` uses `meta?: { count, total, limit, offset }` matching the backend structure.
- Routing via `@lit-labs/router` (Reactive Controller in app-shell). Platform-level routes: `/dashboard`, `/multiverse`, `/how-to-play`, `/epoch/join` (token-based invite acceptance). Simulation-scoped: `/simulations/:slug/lore`, `/agents`, `/buildings`, etc.
- All types in `frontend/src/types/index.ts`
- Design tokens as CSS Custom Properties in `styles/tokens/`
- **Shared components:** 16 reusable components + 10 shared CSS modules + `BaseSettingsPanel` base class in `components/shared/` — see Code Reusability section for full list
- **Slug-based URLs:** Simulation routes use slugs (`/simulations/speranza/lore`) instead of UUIDs. `app-shell._enterSimulationRoute()` (router `enter()` callback) resolves slug→UUID via `_resolveSimulation()` and determines membership via `_checkMembership()` before render, ensuring `currentRole` is set before components mount and fire API calls. All navigation links use `simulation.slug`. SEO middleware returns 301 redirects from UUID→slug for crawlers.
- **Shared icons:** All SVG icons centralized in `utils/icons.ts` — import `{ icons }` and use `icons.edit()`, `icons.trash()`, etc. Never define inline SVG icon methods in components.
- **Entity views:** Each entity has 4 files: ListView, Card, EditModal, DetailsPanel (except Chat which has 6)
- **Event naming:** `import type { Event as SimEvent }` to avoid DOM `Event` conflict
- **Taxonomy-driven options:** Dropdowns populated from `appState.getTaxonomiesByType()` with locale-aware labels
- **LoreScroll accordion:** `Set<string>`-based expand/collapse pattern (same as AgentDetailsPanel, EventDetailsPanel). Sections defined via `getLoreSections()` function (not `const` — `msg()` must evaluate at render time). Body text, titles, epigraphs, and image captions all localised via `msg()`. Uses `velg-lightbox` for image enlargement. Supports per-simulation lore via `sections` and `basePath` properties, with 12 CSS custom properties for theme overrides. `SimulationLoreView` maps theme tokens → lore vars and uses `effect()` signal subscription for reload resilience. Images in AVIF format.
- **AppStateManager signals:** `user`, `accessToken`, `currentSimulation`, `simulations`, `currentRole`, `taxonomies`, `settings`. Computed: `isAuthenticated`, `simulationId`, `isOwner`, `canAdmin`, `canEdit`

## i18n — MANDATORY for ALL UI Strings

**Every user-facing string MUST be wrapped with `msg()`.** This is non-negotiable.

### Rules

1. **All new UI strings must use `msg()`** — labels, buttons, placeholders, error messages, toast messages, aria-labels, empty states, loading states, validation messages
2. **Static strings:** `msg('Save Changes')`
3. **Dynamic strings with interpolation:** `msg(str\`Agent "${name}" deleted.\`)`
4. **Import:** `import { msg } from '@lit/localize';` (add `str` only when using template literals)
5. **Do NOT wrap:** CSS classes, HTML attributes, event names, route paths, property names, console messages, technical identifiers
6. **Module-level arrays with msg():** Convert to functions (e.g., `const TABS = [...]` → `function getTabs() { return [...]; }`) because `msg()` must evaluate at render time for locale switching

### German Translation — ALWAYS Required (Use Claude 4.6)

**When adding ANY new `msg()` string, you MUST also add the German translation to the XLIFF file.**

**Always use Claude 4.6** to translate new strings to German. Do NOT use DeepL API. Translate directly using your own knowledge, with game/UI context for accurate translations.

Workflow:
```bash
# 1. Extract new strings
cd frontend
npx lit-localize extract    # Updates src/locales/xliff/de.xlf with new <trans-unit> entries

# 2. Translate new entries directly
# For each new <trans-unit> in de.xlf (those without <target>), add the German translation.
# Use game/UI context: this is a dark military-HUD tactical simulation platform.

# 3. Build generated locale
npx lit-localize build      # Regenerates src/locales/generated/de.ts
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/lit-localize.json` | Config: sourceLocale=en, targetLocale=de, runtime mode |
| `frontend/src/services/i18n/locale-service.ts` | LocaleService: initLocale, setLocale, getInitialLocale |
| `frontend/src/services/i18n/format-service.ts` | FormatService: formatDate, formatDateTime, formatNumber, formatRelativeTime |
| `frontend/src/locales/xliff/de.xlf` | XLIFF translations (1813 trans-units) — edit this for translations |
| `frontend/src/locales/generated/de.ts` | Auto-generated — NEVER edit manually |
| `frontend/src/locales/generated/locale-codes.ts` | Source/target locale constants |

## Code Reusability — ALWAYS Check First

**Before writing new code, ALWAYS search for existing reusable patterns:**

1. **Check `components/shared/`** — 16 reusable components + 8 CSS modules + 1 base class exist. Use them instead of creating one-off solutions:
   - **Layout:** `VelgSidePanel` (slide-from-right detail panel shell with backdrop, Escape, focus trap, 3 slots: media/content/footer), `BaseModal` (centered dialog with focus trap)
   - **UI Primitives:** `VelgBadge` (6 color variants), `VelgAvatar` (portrait + initials fallback, 3 sizes, optional `alt` override), `VelgIconButton` (30px icon action button), `VelgSectionHeader` (section titles, 2 variants)
   - **Data Display:** `Pagination`, `SharedFilterBar`
   - **Feedback:** `Toast`, `ConfirmDialog`, `LoadingState`, `EmptyState`, `ErrorState`, `GenerationProgress`
   - **Media:** `Lightbox` (fullscreen image overlay with Escape/click-to-close, optional `caption` + `alt` properties)
   - **GDPR:** `CookieConsent` (fixed bottom banner, accept/decline analytics, privacy policy link, stores in localStorage)
   - **Settings:** `BaseSettingsPanel` (abstract base class for simulation_settings-backed panels — provides load/save/dirty-tracking via `settingsApi`. Subclasses define `category` getter + `render()`. Used by AI, Integration, Design, Access panels. GeneralSettingsPanel does NOT extend this — it reads from the `simulations` table directly.)
   - **Shared CSS:**
     - `panel-button-styles.ts` — `panelButtonStyles` for detail panel footer buttons (`.panel__btn` base + `--edit`, `--danger`, `--generate` variants)
     - `form-styles.ts` — `formStyles` for modal forms (`.form`, `.form__group`, `.form__row`, `.form__label`, `.form__input/.form__textarea/.form__select`, `.footer`, `.footer__btn--cancel/--save`, `.gen-btn`)
     - `view-header-styles.ts` — `viewHeaderStyles` for entity list views (`.view`, `.view__header`, `.view__title`, `.view__create-btn`, `.view__count`)
     - `settings-styles.ts` — `settingsStyles` for settings panels (`.settings-panel`, `.settings-form`, `.settings-form__group`, `.settings-form__input`, `.settings-btn`, `.settings-toggle`)
     - `card-styles.ts` — `cardStyles` for entity cards (`.card` hover/active + `.card--embassy` pulsing ring + gradient hover with per-theme colors)
     - `info-bubble-styles.ts` — `renderInfoBubble(title, text)` shared render function for info tooltips in edit modals
     - `panel-cascade-styles.ts` — `panelCascadeStyles` for staggered detail panel section animations
     - `typography-styles.ts` — `typographyStyles` with `.label-brutalist` class for uppercase brutalist labels
     - `grid-layout-styles.ts` — `gridLayoutStyles` for entity card grids (`.entity-grid` with `--grid-min-width` custom property, responsive breakpoints). Used by AgentsView, BuildingsView, EventsView, SocialMediaView, CampaignDashboard.
     - `htp-styles.ts` (in `how-to-play/`) — extracted HowToPlayView CSS (~1100 lines), not in shared/ but a shared-style pattern
   - **Usage:** `static styles = [formStyles, css\`...\`]` — local styles win by cascade for per-component overrides
2. **Check `services/`** — BaseApiService provides CRUD patterns. Extend it for new API services. BaseService (backend) provides generic CRUD with soft-delete, audit logging, and optimistic locking.
3. **Check existing components** for similar patterns — entity views follow a consistent 4-file pattern (ListView, Card, EditModal, DetailsPanel). Copy the pattern, don't reinvent it.
4. **Check `styles/tokens/`** — Use existing CSS custom properties for spacing, colors, typography. Don't hardcode values.
5. **Check `types/index.ts`** — Use existing TypeScript interfaces. Extend them if needed, don't duplicate.
6. **Check `utils/`** — `text.ts` (getInitials), `icons.ts` (centralized SVG icons with `aria-hidden="true"`), `theme-colors.ts` (theme color utilities). Add to them rather than creating parallel utilities. For icons, always import from `icons.ts` — never define inline SVG methods in components.
7. **Backend:** Check `services/base_service.py` before implementing CRUD logic. Check `models/common.py` for response types. Check `dependencies.py` for auth patterns.

## Theme Contrast Rules — MANDATORY for Presets

All theme presets are validated by `frontend/tests/theme-contrast.test.ts` (WCAG 2.1 AA). **Any change to theme presets must pass this test.**

### Minimum Ratios

| Category | Minimum | Pairs |
|---|---|---|
| Normal text on surfaces | **4.5:1** | `color_text`, `color_text_secondary` on `color_surface` and `color_background` |
| Muted text on surfaces | **3.0:1** | `color_text_muted` on `color_surface` and `color_background` |
| Button text | **3.0:1** | `text_inverse` on `color_primary` and `color_danger` |
| Badge text on tinted bg | **3.0:1** | `color_primary` on `color_primary_bg`, `color_secondary` on `color_info_bg`, `color_accent` on `color_warning_bg`, `color_danger` on `color_danger_bg`, `color_success` on `color_success_bg` |
| Gen-button hover | **3.0:1** | `color_background` on `color_secondary` |

### Key Rules

1. **Semantic colors must be functional** — `color_secondary` (→ `--color-info`) and `color_accent` (→ `--color-warning`) are used as badge text and must have sufficient contrast. Never use pale/pastel values.
2. **Dark themes need dark `-bg` tints** — if `color_background` is dark, all 5 `-bg` tokens must be dark too.
3. **`text_inverse` must work on both `color_primary` and `color_danger`** — it's used on solid-color buttons.
4. **Always run after preset changes**: `cd frontend && npx vitest run tests/theme-contrast.test.ts`

See `18_THEMING_SYSTEM.md` for full contrast documentation.

## Spec Documents

26 specification documents (00-23 + GAME_DESIGN_DOCUMENT) in project root. **Always consult the relevant spec before implementing:**

| Doc | Content | Version |
|-----|---------|---------|
| `03_DATABASE_SCHEMA_NEW.md` | Complete schema (42 tables, triggers, views, RLS) | v2.6 |
| `04_DOMAIN_MODELS.md` | TypeScript interfaces (aligned with schema v2.6) | v2.6 |
| `05_API_SPECIFICATION.md` | 236 endpoints with request/response formats | v1.6 |
| `07_FRONTEND_COMPONENTS.md` | Component hierarchy, routing, state management | v1.8 |
| `09_AI_INTEGRATION.md` | AI pipelines, prompt system, model fallback | v1.0 |
| `10_AUTH_AND_SECURITY.md` | Hybrid auth, JWT validation, RLS strategies | v1.0 (rewritten) |
| `12_DESIGN_SYSTEM.md` | CSS tokens, brutalist aesthetic, component styles | v1.0 |
| `13_TECHSTACK_RECOMMENDATION.md` | All config templates (pyproject, package.json, etc.) | v1.3 |
| `17_IMPLEMENTATION_PLAN.md` | 160 tasks, 6 phases, dependency graph | v2.9 |
| `18_THEMING_SYSTEM.md` | Per-simulation theming: token taxonomy, presets, ThemeService, contrast rules | v1.1 |
| `19_DEPLOYMENT_INFRASTRUCTURE.md` | Production deployment, dev→prod sync, data migration playbook | v1.0 |
| `20_RELATIONSHIPS_ECHOES_MAP.md` | Agent relationships, event echoes, cartographer's map — feature docs + user manual | v1.0 |
| `21_EMBASSIES.md` | Embassies & ambassadors: cross-sim diplomatic feature, visual effects, user manual | v1.0 |
| `22A_GAME_SYSTEMS.md` | Game mechanics: materialized views, computed attributes, bleed system | v1.0 |
| `22B_EPOCHS_COMPETITIVE_LAYER.md` | Competitive PvP: epochs, operatives, scoring, battle log, epoch chat, realtime | v1.2 |
| `23_MICROANIMATIONS.md` | Dramatic entrance animations, stagger patterns, theme-aware motion across all UI | v1.0 |
| `GAME_DESIGN_DOCUMENT.md` | High-level game design concept and vision | v1.0 |

## Python Version

Use `python3.13` explicitly (system `python3` is 3.9.6). The venv at `backend/.venv/` was created with Python 3.13.

## Ruff Configuration

Per-file ignores in `pyproject.toml`:
- `backend/tests/**/*.py` — S101 (assert), S105/S106 (hardcoded passwords in test fixtures), E501 (line length)
- `backend/routers/**/*.py` + `backend/dependencies.py` — B008 (Depends() in defaults, standard FastAPI pattern)
- `backend/services/**/*.py` — A003 (`list` method in BaseService shadows builtin)
- `backend/services/email_templates.py` — A003, E501 (long HTML template strings)
