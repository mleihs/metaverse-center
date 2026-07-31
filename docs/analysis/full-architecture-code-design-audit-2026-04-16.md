# Full Architecture, Code, and Design Token Audit

Date: 2026-04-16

## Scope

This audit covered the maintained source-bearing project tree:

- `frontend/src`
- `frontend/tests`
- `backend`
- `backend/tests`
- `e2e`
- `scripts`
- `supabase`
- top-level runtime/config files (`README.md`, `pyproject.toml`, `frontend/package.json`, `biome.json`, `supabase/config.toml`)

Excluded from the audit as non-maintained/generated/vendor artifacts:

- `node_modules`
- virtualenvs (`.venv`, `.analysis-venv`)
- caches / `__pycache__`
- screenshots, backups, `_test_output`
- Playwright reports and other generated browser artifacts
- compiled artifacts such as `frontend/dist`

## Executive Summary

The project is ambitious and technically serious. It already has strong foundations:

- coherent platform vision
- clean separation between frontend, backend, and database concerns
- meaningful testing breadth
- a real design-token system instead of ad hoc styling
- substantial use of shared abstractions (`BaseService`, `CrudApiService`, data-loader mixins)

The main problem is not low quality. The main problem is scale concentration.

A small number of files and modules carry too much responsibility:

- backend startup is a single in-process monolith with many schedulers and routers
- several backend services are orchestration-heavy “god services”
- several frontend views are 1.5k-2.7k line components
- large bilingual content corpora are embedded directly in code
- the SQL layer is powerful but highly fragmented across 226 migrations

This is still workable today, but the maintenance cost is now compounding. The next phase should focus less on features and more on decomposition, content externalization, and boundary hardening.

## Audit Metrics

Maintained source file counts in audited areas:

- `frontend/src`: 437 files
- `frontend/tests`: 35 files
- `backend`: 409 files
- `e2e`: 21 files
- `scripts`: 56 files
- `supabase`: 251 files

Extension counts:

- TypeScript: 475
- Python: 456
- SQL: 249
- CSS: 12

Test footprint:

- backend tests: 98 files / about 35k LOC
- frontend tests: 35 files / about 11.6k LOC
- e2e tests: 13 files / about 1.9k LOC

Database complexity:

- 226 migration files
- about 225 `create or replace function`
- about 100 triggers
- about 353 policies
- about 19 materialized views

Design token snapshot:

- 213 declared tokens in token files
- 49 tokens appear effectively unused or only self-declared once
- many components follow token rules well, but some large visual modules still hardcode colors extensively

## Runtime Architecture

### Backend

The backend is a single FastAPI process that does four jobs at once:

1. API server
2. scheduler host
3. SEO/static-serving edge
4. application composition root

Evidence:

- `backend/app.py` initializes Sentry, middleware, global exception handling, router registration, scheduler startup, and SPA serving in one module: [backend/app.py](/Users/mleihs/Dev/velgarien-rebuild/backend/app.py:20), [backend/app.py](/Users/mleihs/Dev/velgarien-rebuild/backend/app.py:109), [backend/app.py](/Users/mleihs/Dev/velgarien-rebuild/backend/app.py:200)

Strengths:

- lifecycle wiring is explicit
- middleware order is documented
- connectivity failures are translated to 503
- startup warmup is intentional

Risks:

- no hard runtime boundary between API traffic and background jobs
- scheduler failures can affect the same process that serves user requests
- startup cost grows as features accumulate
- composition root is becoming harder to reason about

### Frontend

The frontend is a Lit SPA with router-driven lazy loading, Preact Signals for app state, and a large number of domain-specific custom elements.

Evidence:

- routing, auth guards, analytics, SEO, and initial eager imports are all centered in [frontend/src/app-shell.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/app-shell.ts:20)
- the SPA boot path is in [frontend/src/main.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/main.ts:1)

Strengths:

- clear service folders
- strong use of lazy imports
- domain-oriented component organization
- good reusable view infrastructure via `DataLoaderMixin` and `PaginatedLoaderMixin`

Risks:

- several “page” components are effectively mini applications
- routing, SEO, permissions, and view ownership are tightly coupled in a few files
- state is split across singletons, component-local state, and realtime callbacks without a stricter state boundary

### Database

The database is not a passive persistence layer. It is part of the application runtime.

The project relies on:

- RLS as a primary security mechanism
- RPCs/functions for atomic operations
- triggers for side effects and achievements
- views/materialized views for gameplay and reporting

This is a valid architecture for Supabase/Postgres, but the scale of the SQL surface means the database is effectively another application codebase. That codebase is harder to navigate than the TypeScript or Python layers.

## What Is Working Well

### 1. Shared abstractions exist and are real

Good examples:

- backend CRUD baseline in [backend/services/base_service.py](/Users/mleihs/Dev/velgarien-rebuild/backend/services/base_service.py:39)
- frontend API base layers in [frontend/src/services/api/BaseApiService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/api/BaseApiService.ts:1) and [frontend/src/services/api/CrudApiService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/api/CrudApiService.ts:1)
- frontend data loading mixins in [frontend/src/components/shared/DataLoaderMixin.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/shared/DataLoaderMixin.ts:1) and [frontend/src/components/shared/PaginatedLoaderMixin.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/shared/PaginatedLoaderMixin.ts:1)

This is not a copy-paste codebase with zero shared patterns. The base is healthy.

### 2. The design system is intentional

The token architecture is documented and not performative:

- token policy: [docs/guides/design-tokens.md](/Users/mleihs/Dev/velgarien-rebuild/docs/guides/design-tokens.md:7)
- token definitions: [frontend/src/styles/tokens/_colors.css](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/styles/tokens/_colors.css:5)
- theme application layer: [frontend/src/services/ThemeService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/ThemeService.ts:1)

This is stronger than most projects at similar size.

### 3. Test coverage breadth is better than average

The project has tests across:

- backend unit and integration
- frontend service and utility tests
- e2e flows

The issue is not absence of tests. The issue is mismatch between test breadth and architectural complexity in the biggest modules.

## Main Findings

### 1. Architectural complexity is concentrated in a few oversized files

Large files are not automatically bad, but here they indicate collapsed boundaries.

Examples:

- `backend/services/dungeon/dungeon_encounters.py`: about 7980 lines
- `backend/services/dungeon/dungeon_objektanker.py`: about 4886 lines
- `backend/services/forge_orchestrator_service.py`: about 1946 lines
- `frontend/src/components/epoch/EpochCommandCenter.ts`: about 2728 lines
- `frontend/src/components/platform/SimulationsDashboard.ts`: about 2312 lines
- `frontend/src/components/landing/LandingPage.ts`: about 2303 lines
- `frontend/src/components/forge/VelgForgeCeremony.ts`: about 2108 lines

Impact:

- slower onboarding
- hard-to-localize regressions
- more expensive reviews
- lower confidence in refactors

### 2. Large content corpora are embedded directly in code

This is one of the biggest structural issues in the repo.

Evidence:

- dungeon encounter text registry in [backend/services/dungeon/dungeon_encounters.py](/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_encounters.py:1)
- anchor and entrance prose registry in [backend/services/dungeon/dungeon_objektanker.py](/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_objektanker.py:1)
- frontend archetype detail corpus in [frontend/src/components/archetypes/dungeon-detail-data.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/archetypes/dungeon-detail-data.ts:1)

Why this matters:

- content edits require code edits
- localization changes require code reviews
- prose and mechanics are tightly coupled in one artifact
- frontend and backend can drift when both carry their own authored text

Recommendation:

- move authored bilingual content into versioned content files or DB-backed content bundles
- keep code responsible for selection/rendering rules, not storing thousands of lines of literary text

### 3. The Forge subsystem has a clear orchestration smell

`ForgeOrchestratorService` does prompt building, AI orchestration, translation coordination, research, draft management, image flow, and error recovery in one place.

Evidence:

- prompt policy and generation concerns already dominate the first 250 lines: [backend/services/forge_orchestrator_service.py](/Users/mleihs/Dev/velgarien-rebuild/backend/services/forge_orchestrator_service.py:45)

This subsystem should be split into explicit stages with stable interfaces:

- prompt assembly
- model execution
- validation/repair
- persistence
- image generation
- search/research enrichment

Right now it is powerful but brittle.

### 4. Frontend page components are too large and mix too many concerns

`app-shell.ts` and major page components mix routing, permissions, SEO, analytics, fetch orchestration, UI, and styling.

Evidence:

- app composition and route policy in [frontend/src/app-shell.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/app-shell.ts:128)
- one large PvP dashboard component in [frontend/src/components/epoch/EpochCommandCenter.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/epoch/EpochCommandCenter.ts:1)

Pattern issue:

- view files are acting as page controller + state store + layout + style module

Recommendation:

- introduce thin page controllers that compose smaller shell, data, and presentation components
- move CSS out of the heaviest page components where possible

### 5. DRY is good in some layers and weak in others

Good DRY:

- backend base CRUD service
- frontend base API services
- frontend data-loader mixins

Weak DRY:

- many frontend API services are extremely thin wrappers and still require file-per-resource boilerplate
- some backend routers repeat the same auth/role/audit/translation choreography
- `LocationsApiService` reimplements CRUD-like methods instead of aligning with the `CrudApiService` pattern

Evidence:

- generic CRUD exists: [frontend/src/services/api/CrudApiService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/api/CrudApiService.ts:1)
- thin wrappers still proliferate: for example [frontend/src/services/api/AgentMemoryApiService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/api/AgentMemoryApiService.ts:1), [frontend/src/services/api/MembersApiService.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/services/api/MembersApiService.ts:1)
- router pattern repetition in [backend/routers/agents.py](/Users/mleihs/Dev/velgarien-rebuild/backend/routers/agents.py:31)

This is not urgent, but it is an ongoing maintenance tax.

### 6. The design token system is strong, but compliance is inconsistent in advanced visual components

The documented rule is explicit:

- “never raw `#hex` or `rgba()`” in component CSS: [docs/guides/design-tokens.md](/Users/mleihs/Dev/velgarien-rebuild/docs/guides/design-tokens.md:7)

But several large visual components bypass that rule extensively:

- [frontend/src/components/forge/VelgForgeCeremony.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/forge/VelgForgeCeremony.ts:33)
- [frontend/src/components/landing/dungeon-showcase-styles.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/landing/dungeon-showcase-styles.ts:14)
- [frontend/src/components/forge/forge-placeholders.ts](/Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/forge/forge-placeholders.ts:134)

Observed token issues:

- raw amber/black values duplicated instead of derived from existing tokens
- raw SVG fill/stroke values embedded in generated string markup
- many atmospheric components opt out of token discipline via comments or local escape hatches

This is understandable for art-heavy surfaces, but it weakens the promise that themes propagate consistently.

### 7. The token inventory has early signs of entropy

Findings from the token pass:

- 213 declared tokens
- 49 appear effectively unused or only self-declared

Notable low-use categories:

- some layout/container tokens
- some animation/easing tokens
- some status/focus tokens

This suggests the design system is ahead of actual adoption. That is better than having no system, but it also means the token surface should be pruned or usage enforced.

### 8. SQL complexity is high enough to deserve bounded-context documentation

The SQL layer is substantial:

- 226 migrations
- hundreds of policies/functions/triggers

Current risk:

- feature behavior is split across Python, SQL functions, triggers, and policies
- it is hard to answer “where does this business rule actually live?”

This is especially risky for:

- epoch scoring
- achievements
- heartbeat/autonomy
- dungeon lifecycle
- public read access

Recommendation:

- group migrations logically in docs by domain
- maintain a domain map of authoritative tables, views, functions, triggers, and RPCs

### 9. Known performance debt is already acknowledged in code

There is at least one explicit dormant N² hotspot:

- [backend/services/agent_opinion_service.py](/Users/mleihs/Dev/velgarien-rebuild/backend/services/agent_opinion_service.py:274)

This is a good sign in one sense because the risk is documented. But it also means the architecture already has code paths that will not scale once activated more heavily.

### 10. Testing is broad, but quality gates are lighter than the codebase complexity now requires

Strength:

- many tests across backend, frontend, and e2e

Weakness:

- backend coverage threshold is only 30%: [pyproject.toml](/Users/mleihs/Dev/velgarien-rebuild/pyproject.toml:94)

Given the size and criticality of the backend services, that threshold is now too low to act as a meaningful gate.

## Frontend Audit

### Architecture

Current frontend architecture is:

- Lit custom elements for pages and widgets
- Router in `app-shell`
- Preact Signals singletons for app-level state
- API service wrappers per domain
- tokenized CSS foundation with theme overrides

This is coherent. The main issues are component size and visual-rule exceptions.

### Good Patterns

- `AppStateManager` is straightforward and readable
- `ThemeService` is thoughtful and solves the token cascade problem correctly
- `DataLoaderMixin` / `PaginatedLoaderMixin` are high-value reuse points
- service foldering is sensible

### Bad Patterns / Risks

- giant page components
- large inline CSS inside page-level components
- content-heavy TS modules instead of content assets
- manual API wrapper proliferation
- too many raw-color exceptions in advanced visual modules

### Design Token Audit

Healthy:

- semantic base tokens exist
- derived tokens are implemented
- theme inheritance across shadow DOM is handled deliberately

Weak:

- token compliance is not enforced consistently
- some tokens are dead or barely used
- atmospheric modules use hardcoded values faster than the token system can absorb them

## Backend Audit

### Architecture

Current backend architecture is:

- FastAPI router layer
- service layer for business logic
- Supabase/Postgres for persistence and policy enforcement
- in-process schedulers for recurring systems

This is still mostly clean by folder structure. The main problem is business-logic gravity collecting in services.

### Good Patterns

- `BaseService` gives real leverage
- dependency layer handles JWT/RLS/admin bypass clearly
- middleware is purposeful
- response helpers remove a lot of Supabase response-shape repetition

### Bad Patterns / Risks

- startup composition root is overloaded
- scheduler hosting is not isolated
- orchestration services are too large
- authored content is stored as Python constants
- service boundaries are not always strong enough to stop “one more responsibility” from being added

## Database / Supabase Audit

### Strengths

- strong use of RLS
- meaningful use of stored procedures for atomic behavior
- migration history is detailed
- platform clearly treats SQL as first-class application code

### Risks

- migration count is now high enough that discovery cost is significant
- business logic location is not obvious to new contributors
- many triggers/policies/functions increase debugging complexity
- drift risk rises when frontend, backend, and SQL all encode related gameplay assumptions

## Duplication and Pattern Violations

### Duplication Hotspots

- thin API-service wrappers for many resources
- repetitive router workflows for CRUD + audit + translation
- large bilingual prose repeated across backend and frontend content surfaces

### Pattern Violations

- token guide says no raw component colors, but several advanced UI files still hardcode many values
- several page components violate the otherwise good modular component philosophy by becoming all-in-one screens
- several content-heavy modules violate the otherwise good separation between logic and data

## Recommended Priorities

### Priority 1

- Extract authored dungeon/archetype prose from code into content assets or DB-backed content bundles.
- Split `ForgeOrchestratorService` into stage-specific services.
- Split the heaviest Lit page components into controller/data/presentation layers.

### Priority 2

- Add a design-token compliance pass for high-visual modules.
- Consolidate thin API wrappers where they add little value.
- Document database bounded contexts and authoritative SQL objects by domain.

### Priority 3

- Raise backend coverage threshold from 30 to something that actually protects the codebase.
- Prune or adopt low-use tokens.
- Isolate scheduler hosting from the request-serving process if operations load keeps growing.

## Suggested Refactor Plan

### 1. Content Externalization

Move:

- dungeon encounter text
- dungeon objektanker text
- archetype detail page content

Into:

- versioned JSON/JSON5/YAML/Markdown content packs with schema validation

### 2. Forge Boundary Split

Break Forge into:

- prompt builders
- draft generators
- validators/repairers
- persistence coordinators
- image coordinators

### 3. Frontend Page Decomposition

For each large page:

- keep route/controller shell
- extract data orchestration into a controller helper/store
- extract large CSS blocks into style modules
- extract repeated render sections into subcomponents

### 4. Design System Hardening

- introduce linting or CI checks for raw colors outside approved folders
- define an explicit exception policy for art/SVG files
- remove dead tokens or adopt them intentionally

### 5. Database Domain Map

Add docs that answer:

- which table/view/function is authoritative per feature
- which triggers exist for each domain
- which RPCs are safe entrypoints for mutations

## Final Assessment

Overall quality: strong

Architectural health: good but stressed

Design-system maturity: high, with enforcement drift

Backend maintainability: medium-high today, trending downward without decomposition

Frontend maintainability: medium, due to oversized page components and content-in-code

Database sophistication: high, but now under-documented relative to its complexity

This is a serious codebase with real engineering discipline. It does not need a rewrite. It needs boundary recovery.
