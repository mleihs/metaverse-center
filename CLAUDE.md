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

**Current Status:** Phase 1 + Phase 2 complete. Phase 3 next (Settings, i18n, AI Pipelines).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Uvicorn + Pydantic v2 |
| Frontend | Lit 3.3 + Preact Signals + TypeScript + Vite |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT) |
| Linting | Biome 2.4 (frontend), ruff (backend) |
| Testing | pytest (backend), vitest (frontend) |

## Architecture

**Hybrid Supabase pattern:**
- Frontend -> Supabase directly: Auth, Storage, Realtime
- Frontend -> FastAPI: Business logic, AI pipelines, CRUD
- FastAPI -> Supabase with **User-JWT** (RLS active, NOT service_role for normal ops)

**Defense in Depth:** FastAPI `Depends()` validates roles (Layer 1), Supabase RLS validates access (Layer 2).

## Directory Structure

```
backend/              FastAPI application
  app.py              Entry point (registers 13 routers)
  config.py           Settings (pydantic-settings, extra="ignore")
  dependencies.py     JWT auth, Supabase client, role checking
  routers/            API endpoints — 13 routers, 81+ endpoints (/api/v1/...)
  models/             Pydantic request/response models (16 files)
  services/           Business logic (BaseService + 8 entity + audit + simulation)
  middleware/         Rate limiting, security headers
  utils/              Encryption (AES-256 for settings)
  tests/              pytest tests (52 tests: unit + integration)
frontend/             Lit + Vite application
  src/
    app-shell.ts      Main app with @lit-labs/router (auth + simulation-scoped routes)
    components/
      auth/           Login, Register views
      platform/       PlatformHeader, UserMenu, SimulationsDashboard
      layout/         SimulationShell, SimulationHeader, SimulationNav
      shared/         10 reusable components (BaseModal, DataTable, FilterBar, etc.)
      agents/         AgentsView, AgentCard, AgentEditModal, AgentDetailsPanel
      buildings/      BuildingsView, BuildingCard, BuildingEditModal, BuildingDetailsPanel
      events/         EventsView, EventCard, EventEditModal, EventDetailsPanel
      chat/           ChatView, ChatWindow, ConversationList, MessageList, MessageInput, AgentSelector
    services/         Supabase client, 11 API services, AppStateManager
    styles/           CSS design tokens (tokens/) + base styles (base/)
    types/            TypeScript interfaces (index.ts) + Zod validation schemas (validation/)
  tests/              vitest tests
supabase/
  migrations/         12 SQL migration files (001-012)
  seed/               5 SQL seed files (001-005): simulation, agents, entities, social/chat, verification
  config.toml         Local Supabase config
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

# Database
supabase start                                 # Start local Supabase
supabase db reset                              # Reset + reapply all migrations
supabase status                                # Check container status

# Docker queries (when psql not available)
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SELECT ..."
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

81+ endpoints across 13 routers. Platform-level: `/api/v1/health`, `/api/v1/users/me`, `/api/v1/simulations`. Simulation-scoped: `/api/v1/simulations/{simulation_id}/agents`, `buildings`, `events`, `agent_professions`, `locations`, `taxonomies`, `settings`, `chat`, `members`, `campaigns`.

## Backend Patterns

- **Config:** `backend/config.py` — `Settings(BaseSettings)` with `extra="ignore"`, reads `.env`. Imported as `app_settings` in `app.py` to avoid conflict with `routers.settings`.
- **Auth:** `get_current_user()` validates JWT via python-jose, returns `CurrentUser(id, email, access_token)`
- **Supabase client:** `get_supabase()` creates client with user's JWT (RLS enforced)
- **Role checking:** `require_role("admin")` factory returns Depends() that checks simulation_members
- **Rate limiting:** slowapi — 30/hr AI generation, 100/min standard
- **Models:** `PaginatedResponse[T]`, `SuccessResponse[T]`, `ErrorResponse` in `models/common.py`
- **BaseService:** Generic CRUD in `services/base_service.py` — uses `active_*` views for soft-delete filtering, optional `include_deleted=True` for admin queries
- **AuditService:** `services/audit_service.py` — logs CRUD operations to `audit_log` table with entity diffs
- **Encryption:** `utils/encryption.py` — AES-256 via `cryptography` for sensitive settings values

## Frontend Patterns

- Components extend `LitElement` with `@customElement('velg-...')`
- State via Preact Signals (`appState` in `AppStateManager.ts`)
- API calls through `BaseApiService` (auto-attaches JWT from appState)
- Routing via `@lit-labs/router` (Reactive Controller in app-shell)
- All types in `frontend/src/types/index.ts`
- Design tokens as CSS Custom Properties in `styles/tokens/`
- **Shared components:** 10 reusable components in `components/shared/` (BaseModal, SharedFilterBar, DataTable, Pagination, Toast, ConfirmDialog, FormBuilder, ErrorState, LoadingState, EmptyState)
- **Entity views:** Each entity has 4 files: ListView, Card, EditModal, DetailsPanel (except Chat which has 6)
- **Event naming:** `import type { Event as SimEvent }` to avoid DOM `Event` conflict
- **Taxonomy-driven options:** Dropdowns populated from `appState.getTaxonomiesByType()` with locale-aware labels
- **AppStateManager signals:** `user`, `accessToken`, `currentSimulation`, `simulations`, `currentRole`, `taxonomies`, `settings`. Computed: `isAuthenticated`, `simulationId`, `isOwner`, `canAdmin`, `canEdit`

## Spec Documents

18 specification documents (00-17) in project root. **Always consult the relevant spec before implementing:**

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
| `17_IMPLEMENTATION_PLAN.md` | 138 tasks, 5 phases, dependency graph | v2.3 |

## Python Version

Use `python3.13` explicitly (system `python3` is 3.9.6). The venv at `backend/.venv/` was created with Python 3.13.

## Ruff Configuration

Per-file ignores in `pyproject.toml`:
- `backend/tests/**/*.py` — S101 (assert), S105/S106 (hardcoded passwords in test fixtures)
- `backend/routers/**/*.py` + `backend/dependencies.py` — B008 (Depends() in defaults, standard FastAPI pattern)
- `backend/services/**/*.py` — A003 (`list` method in BaseService shadows builtin)
