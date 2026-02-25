# Velgarien Platform — Development Guidelines

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

**Current Status:** All 5 phases complete + i18n fully implemented + codebase audit applied + architecture audit applied + lore expansion + dashboard LoreScroll + per-simulation theming + WCAG contrast validation. 139 tasks. 885 localized UI strings (EN/DE). Platform ready for deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Uvicorn + Pydantic v2 |
| Frontend | Lit 3.3 + Preact Signals + TypeScript + Vite |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT) |
| Linting | Biome 2.4 (frontend), ruff (backend) |
| Testing | pytest (backend), vitest (frontend), Playwright (E2E) |

## Architecture

**Hybrid Supabase pattern:**
- Frontend -> Supabase directly: Auth, Storage, Realtime
- Frontend -> FastAPI: Business logic, AI pipelines, CRUD
- FastAPI -> Supabase with **User-JWT** (RLS active, NOT service_role for normal ops)

**Defense in Depth:** FastAPI `Depends()` validates roles (Layer 1), Supabase RLS validates access (Layer 2).

## Directory Structure

```
backend/              FastAPI application
  app.py              Entry point (registers 19 routers)
  config.py           Settings (pydantic-settings, extra="ignore")
  dependencies.py     JWT auth, Supabase client, role checking
  routers/            API endpoints — 19 routers, 100+ endpoints (/api/v1/...)
  models/             Pydantic request/response models (19 files)
  services/           Business logic (BaseService + 15 entity + audit + simulation + external)
  middleware/         Rate limiting, security headers
  utils/              Encryption (AES-256 for settings), search helpers
  tests/              pytest tests (239 tests: unit + integration + security + performance)
frontend/             Lit + Vite application
  src/
    app-shell.ts      Main app with @lit-labs/router (auth + simulation-scoped routes)
    components/
      auth/           Login, Register views
      platform/       PlatformHeader, UserMenu, SimulationsDashboard, LoreScroll, CreateSimulationWizard, UserProfileView, InvitationAcceptView, NotificationCenter
      layout/         SimulationShell, SimulationHeader, SimulationNav
      shared/         17 reusable components + 3 shared CSS modules (see Code Reusability)
      agents/         AgentsView, AgentCard, AgentEditModal, AgentDetailsPanel
      buildings/      BuildingsView, BuildingCard, BuildingEditModal, BuildingDetailsPanel
      events/         EventsView, EventCard, EventEditModal, EventDetailsPanel
      chat/           ChatView, ChatWindow, ConversationList, MessageList, MessageInput, AgentSelector
      social/         SocialTrendsView, SocialMediaView, CampaignDashboard, CampaignDetailView, TrendCard, PostCard, TransformationModal, PostTransformModal, CampaignCard
      locations/      LocationsView, CityList, ZoneList, StreetList, LocationEditModal
      settings/       SettingsView + 7 panels (General, World, AI, Integration, Design, Access, View)
    services/         Supabase client, 16 API services, AppStateManager, NotificationService, RealtimeService, PresenceService, ThemeService, theme-presets
      i18n/           LocaleService + FormatService
    locales/          i18n files
      generated/      Auto-generated: de.ts, locale-codes.ts (DO NOT EDIT)
      xliff/          Translation interchange: de.xlf (EDIT THIS for translations)
    styles/           CSS design tokens (tokens/: 8 files — colors, typography, spacing, borders, shadows, animation, layout, z-index) + base styles (base/)
    utils/            Shared utilities (text.ts, formatters.ts, error-handler.ts, icons.ts)
    types/            TypeScript interfaces (index.ts) + Zod validation schemas (validation/)
  tests/              vitest tests (183 tests: validation + API + notification + theme contrast)
e2e/                  Playwright E2E tests (37 specs across 8 files)
  playwright.config.ts
  helpers/            auth.ts, fixtures.ts
  tests/              auth, agents, buildings, events, chat, settings, multi-user, social
supabase/
  migrations/         13 SQL migration files (001-013)
  seed/               10 SQL seed files (001-010): simulation, agents, entities, social/chat, verification, prompts, sample data, image config, capybara kingdom, simulation themes
  config.toml         Local Supabase config
scripts/              Utility scripts (image generation via Replicate)
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
```

## Supabase MCP (Local)

The Supabase MCP server is configured in `.mcp.json` (project root) to connect to the **local** Supabase instance:

```
URL: http://127.0.0.1:54321/mcp
Container: supabase_db_velgarien-rebuild
```

This overrides the remote Supabase plugin (`https://mcp.supabase.com/mcp`). Use the MCP tools (`mcp__supabase__*`) for migrations, SQL queries, type generation, and advisory checks. If the MCP connection times out, use Docker psql as fallback:

```bash
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SQL..."
```

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

## Database (27 Tables)

- **101 RLS policies** — CRUD per table, role-based via helper functions
- **22 triggers** — 16 updated_at + 6 business logic (slug immutability, status transitions, primary profession, last owner protection, conversation stats)
- **6 views** — 4 active_* (soft-delete filter) + simulation_dashboard + conversation_summaries
- **2 materialized views** — campaign_performance + agent_statistics
- **4 storage buckets** — agent.portraits, building.images, user.agent.portraits, simulation.assets
- **16 functions** — RLS helpers, utility (generate_slug, validate_taxonomy_value), trigger functions

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

100+ endpoints across 19 routers. Platform-level: `/api/v1/health`, `/api/v1/users/me`, `/api/v1/simulations`, `/api/v1/invitations`. Simulation-scoped: `/api/v1/simulations/{simulation_id}/agents`, `buildings`, `events`, `agent_professions`, `locations`, `taxonomies`, `settings`, `chat`, `members`, `campaigns`, `social-trends`, `social-media`, `generation`, `prompt-templates`.

## Backend Patterns

- **Config:** `backend/config.py` — `Settings(BaseSettings)` with `extra="ignore"`, reads `.env`. Imported as `app_settings` in `app.py` to avoid conflict with `routers.settings`.
- **Auth:** `get_current_user()` validates JWT via python-jose, returns `CurrentUser(id, email, access_token)`
- **Supabase client:** `get_supabase()` creates client with user's JWT (RLS enforced)
- **Role checking:** `require_role("admin")` factory returns Depends() that checks simulation_members
- **Rate limiting:** slowapi — 30/hr AI generation, 10/min AI chat, 5/min external API, 100/min standard
- **Models:** `PaginatedResponse[T]`, `SuccessResponse[T]`, `ErrorResponse` in `models/common.py`
- **BaseService:** Generic CRUD in `services/base_service.py` — uses `active_*` views for soft-delete filtering, optional `include_deleted=True` for admin queries. Set `view_name = None` for tables without soft-delete (e.g., campaigns, agent_professions, locations). Public `serialize_for_json()` utility for datetime/UUID/date conversion.
- **Entity services:** All CRUD routers use dedicated services — `AgentService` (with `list_for_reaction()` for lightweight AI queries), `BuildingService`, `EventService` (with `generate_reactions()` for AI reaction generation), `CampaignService` (extends BaseService), `LocationService` (facade delegating to `CityService`/`ZoneService`/`StreetService`, all extending BaseService), `AgentProfessionService` (extends BaseService), `PromptTemplateService` (custom, uses `is_active` for soft-delete), `MemberService` (with `LastOwnerError` exception + `get_user_memberships()`), `SocialMediaService`, `SocialTrendsService`
- **Router discipline:** Routers handle HTTP only — no direct DB queries, no business logic helpers, no late-binding imports. All service imports at module level. External service imports (Guardian, NewsAPI, Facebook, GenerationService) at module level.
- **AuditService:** `services/audit_service.py` — logs CRUD operations to `audit_log` table with entity diffs. Applied to all data-changing endpoints across all routers.
- **Search utility:** `utils/search.py` — `apply_search_filter(query, search, vector_field, fallback_fields)` for full-text search with ilike fallback
- **Encryption:** `utils/encryption.py` — AES-256 via `cryptography` for sensitive settings values

## Frontend Patterns

- Components extend `LitElement` with `@customElement('velg-...')`
- State via Preact Signals (`appState` in `AppStateManager.ts`)
- API calls through `BaseApiService` (auto-attaches JWT from appState). Always import existing API service singletons (e.g., `simulationsApi`, `buildingsApi`) — never create inline service classes in components.
- **API contract:** Backend endpoints using query params (e.g., `assign-agent?agent_id=...`, `profession-requirements?profession=...`) must use `URLSearchParams` in the frontend — never send these as JSON body. `PaginatedResponse<T>` uses `meta?: { count, total, limit, offset }` matching the backend structure.
- Routing via `@lit-labs/router` (Reactive Controller in app-shell)
- All types in `frontend/src/types/index.ts`
- Design tokens as CSS Custom Properties in `styles/tokens/`
- **Shared components:** 17 reusable components + 3 shared CSS modules in `components/shared/` — see Code Reusability section for full list
- **Shared icons:** All SVG icons centralized in `utils/icons.ts` — import `{ icons }` and use `icons.edit()`, `icons.trash()`, etc. Never define inline SVG icon methods in components.
- **Entity views:** Each entity has 4 files: ListView, Card, EditModal, DetailsPanel (except Chat which has 6)
- **Event naming:** `import type { Event as SimEvent }` to avoid DOM `Event` conflict
- **Taxonomy-driven options:** Dropdowns populated from `appState.getTaxonomiesByType()` with locale-aware labels
- **LoreScroll accordion:** `Set<string>`-based expand/collapse pattern (same as AgentDetailsPanel, EventDetailsPanel). Sections defined via `getLoreSections()` function (not `const` — `msg()` must evaluate at render time). Body text, titles, epigraphs, and image captions all localised via `msg()`. Uses `velg-lightbox` for image enlargement.
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

### German Translation — ALWAYS Required

**When adding ANY new `msg()` string, you MUST also add the German translation to the XLIFF file.**

Workflow:
```bash
# After adding msg() calls:
cd frontend
npx lit-localize extract    # Updates src/locales/xliff/de.xlf with new <trans-unit> entries
# Add <target>German translation</target> to each new entry in de.xlf
npx lit-localize build      # Regenerates src/locales/generated/de.ts
```

Alternatively, add `<target>` elements directly to `frontend/src/locales/xliff/de.xlf` before running extract+build.

### Key Files

| File | Purpose |
|------|---------|
| `frontend/lit-localize.json` | Config: sourceLocale=en, targetLocale=de, runtime mode |
| `frontend/src/services/i18n/locale-service.ts` | LocaleService: initLocale, setLocale, getInitialLocale |
| `frontend/src/services/i18n/format-service.ts` | FormatService: formatDate, formatDateTime, formatNumber, formatRelativeTime |
| `frontend/src/locales/xliff/de.xlf` | XLIFF translations (875 trans-units) — edit this for translations |
| `frontend/src/locales/generated/de.ts` | Auto-generated — NEVER edit manually |
| `frontend/src/locales/generated/locale-codes.ts` | Source/target locale constants |

## Code Reusability — ALWAYS Check First

**Before writing new code, ALWAYS search for existing reusable patterns:**

1. **Check `components/shared/`** — 17 shared components + 3 CSS modules exist. Use them instead of creating one-off solutions:
   - **Layout:** `VelgSidePanel` (slide-from-right detail panel shell with backdrop, Escape, 3 slots: media/content/footer), `BaseModal` (centered dialog)
   - **UI Primitives:** `VelgBadge` (6 color variants), `VelgAvatar` (portrait + initials fallback, 3 sizes), `VelgIconButton` (30px icon action button), `VelgSectionHeader` (section titles, 2 variants)
   - **Data Display:** `DataTable`, `Pagination`, `SharedFilterBar`
   - **Feedback:** `Toast`, `ConfirmDialog`, `LoadingState`, `EmptyState`, `ErrorState`, `GenerationProgress`
   - **Forms:** `FormBuilder`
   - **Media:** `Lightbox` (fullscreen image overlay with Escape/click-to-close, optional `caption` property)
   - **Shared CSS:**
     - `panel-button-styles.ts` — `panelButtonStyles` for detail panel footer buttons (`.panel__btn` base + `--edit`, `--danger`, `--generate` variants)
     - `form-styles.ts` — `formStyles` for modal forms (`.form`, `.form__group`, `.form__row`, `.form__label`, `.form__input/.form__textarea/.form__select`, `.footer`, `.footer__btn--cancel/--save`, `.gen-btn`)
     - `view-header-styles.ts` — `viewHeaderStyles` for entity list views (`.view`, `.view__header`, `.view__title`, `.view__create-btn`, `.view__count`)
   - **Usage:** `static styles = [formStyles, css\`...\`]` — local styles win by cascade for per-component overrides
2. **Check `services/`** — BaseApiService provides CRUD patterns. Extend it for new API services. BaseService (backend) provides generic CRUD with soft-delete, audit logging, and optimistic locking.
3. **Check existing components** for similar patterns — entity views follow a consistent 4-file pattern (ListView, Card, EditModal, DetailsPanel). Copy the pattern, don't reinvent it.
4. **Check `styles/tokens/`** — Use existing CSS custom properties for spacing, colors, typography. Don't hardcode values.
5. **Check `types/index.ts`** — Use existing TypeScript interfaces. Extend them if needed, don't duplicate.
6. **Check `utils/`** — `text.ts` (getInitials), `formatters.ts`, `error-handler.ts`, `icons.ts` (centralized SVG icons). Add to them rather than creating parallel utilities. For icons, always import from `icons.ts` — never define inline SVG methods in components.
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

19 specification documents (00-18) in project root. **Always consult the relevant spec before implementing:**

| Doc | Content | Version |
|-----|---------|---------|
| `03_DATABASE_SCHEMA_NEW.md` | Complete schema (27 tables, triggers, views, RLS) | v2.0 |
| `04_DOMAIN_MODELS.md` | TypeScript interfaces (aligned with schema v2.0) | v2.0 |
| `05_API_SPECIFICATION.md` | 108 endpoints with request/response formats | v1.0 |
| `07_FRONTEND_COMPONENTS.md` | Component hierarchy, routing, state management | v1.1 |
| `09_AI_INTEGRATION.md` | AI pipelines, prompt system, model fallback | v1.0 |
| `10_AUTH_AND_SECURITY.md` | Hybrid auth, JWT validation, RLS strategies | v1.0 (rewritten) |
| `12_DESIGN_SYSTEM.md` | CSS tokens, brutalist aesthetic, component styles | v1.0 |
| `13_TECHSTACK_RECOMMENDATION.md` | All config templates (pyproject, package.json, etc.) | v1.3 |
| `17_IMPLEMENTATION_PLAN.md` | 138 tasks, 5 phases, dependency graph | v2.6 |
| `18_THEMING_SYSTEM.md` | Per-simulation theming: token taxonomy, presets, ThemeService, contrast rules | v1.1 |

## Python Version

Use `python3.13` explicitly (system `python3` is 3.9.6). The venv at `backend/.venv/` was created with Python 3.13.

## Ruff Configuration

Per-file ignores in `pyproject.toml`:
- `backend/tests/**/*.py` — S101 (assert), S105/S106 (hardcoded passwords in test fixtures)
- `backend/routers/**/*.py` + `backend/dependencies.py` — B008 (Depends() in defaults, standard FastAPI pattern)
- `backend/services/**/*.py` — A003 (`list` method in BaseService shadows builtin)
