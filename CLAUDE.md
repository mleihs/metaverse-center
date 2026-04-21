# metaverse.center — Development Contract

## Core Principles (Non-Negotiable)

- Follow spec documents in `/docs` before implementing. See `/docs/INDEX.md` for catalog, `/docs/llms.txt` for AI-friendly index.
- No hacks. No temporary shortcuts. No TODO-later patches.
- Proper separation of concerns:
  - Routers → HTTP only
  - Services → business logic
  - Models → validation
- No code duplication.
- Every layer must be independently testable.
- If a workaround seems necessary, the design is wrong — fix the design.

---

## System Architecture (Critical Overview)

### Stack

- Backend: FastAPI + Pydantic v2
- Frontend: Lit 3 + Preact Signals + TypeScript
- Database: Supabase (PostgreSQL + RLS)
- Auth: Supabase JWT (ES256 in production, HS256 locally)
- AI: OpenRouter
- Email: SMTP SSL

### Social Media Pipeline

- Instagram: admin generates drafts, approves, publishes via Graph API
- Bluesky: AT Protocol cross-posting from Instagram (reformatted captions, re-uploaded images)
- Cipher ARG: unique codes per post, steganographic hints, `/bureau/dispatch` redemption
- Hashtag strategy: 5 tags max, varied per post, trending tag slot
- Forge Phases A.5/A.6: lore-informed style prompts and prompt templates per simulation

---

---

## Hybrid Supabase Pattern (CRITICAL)

Frontend:
- Direct → Supabase (Auth, Storage, Realtime)
- API → FastAPI (business logic, AI pipelines, CRUD)

Backend:
- Uses **user JWT** for normal operations (RLS enforced)
- Uses `service_role` only for system/admin operations

Defense in Depth:
- FastAPI `Depends()` role validation
- Supabase RLS enforcement

Never bypass RLS.

---

## Public-First Architecture (CRITICAL)

All simulation data is publicly readable.

Frontend routing rule:
- If user is **not authenticated OR not a member** → call `/api/v1/public/*`
- If user **is a member** → call `/api/v1/*`

Browsing must never produce 403 errors.

Write operations require:
- Authentication
- Membership

---

## Backend Rules

- No direct DB queries in routers.
- All business logic lives in services.
- CRUD must extend `BaseService` unless justified.
- All responses use typed Pydantic wrappers — never raw dicts:
  - `SuccessResponse[T]` for single/list data
  - `PaginatedResponse[T]` for paginated data
  - Return type annotation is the single source of truth (no `response_model=` parameter)
  - Return `SuccessResponse(data=...)` / `PaginatedResponse(data=..., meta=...)` instances, never `{"success": True, ...}` dicts
  - ASSESS endpoints (polymorphic AI output) use `SuccessResponse[dict]` or `SuccessResponse[list[dict]]`
  - Response models live in `backend/models/<domain>.py`, named `*Response`
- Audit logging required for all mutations.
- Import dependencies at module level (no late-binding imports).
- Platform admin bypass uses `is_platform_admin()` (3-tier: email allowlist → cached DB IDs → DB refresh). Integrated into `require_role()`, `require_simulation_member()`, `require_platform_admin()`, `require_owner_or_platform_admin()`, `require_architect()`. NOT in `require_epoch_creator()` / `require_epoch_participant()` (game-logic ownership).
- Supabase client hierarchy: `get_supabase` (user JWT, RLS enforced, internal only) → `get_effective_supabase` (auto-elevates to service_role for platform admins) → `get_admin_supabase` (service_role, bypasses all RLS). All 38 routers use `get_effective_supabase` — `get_supabase` is only used internally by `get_effective_supabase` and `require_role`.

### NEVER

- Never use `service_role` for normal CRUD.
- Never run `supabase db reset` without explicit user approval.
- Never place business logic inside routers.
- Never change response shape without updating spec.
- Never use `response_model=` on FastAPI decorators. Use return type annotations instead (`-> SuccessResponse[T]`). The codebase has zero `response_model=` usage — this was removed in the Pydantic response typing refactor (468 endpoints, 46 routers, 45 models).
- Never return raw `{"success": True, "data": ...}` dicts from endpoints. Always return `SuccessResponse(data=...)` or `PaginatedResponse(data=..., meta=...)` instances.
- Never add columns to `agents`, `buildings`, `simulations`, or `events` without refreshing the corresponding `active_*` view (`CREATE OR REPLACE VIEW`) in the same migration. PostgreSQL `SELECT *` in views resolves columns at creation time, not query time.
- Never grant SECURITY DEFINER functions to `anon` or `authenticated`. Admin RPCs must be callable only via backend with role validation (see ADR-006, incident migration 096→147).
- Never use `httpx`/`requests` directly for user-provided URLs. Use `backend/utils/safe_fetch.py` for SSRF protection.
- Never implement fetch-compute-update patterns in Python for concurrent-access data. Use atomic Postgres RPCs with compare-and-swap logic (see ADR-007, migration 148).
- Never write RLS policies with bare function calls. Always wrap `user_has_simulation_access()`, `user_has_simulation_role()`, `user_simulation_role()`, and `auth.uid()` in `(SELECT ...)` subqueries for initPlan optimization. Without the wrapper, Postgres evaluates per-row; with it, the result is cached per-statement (94-99% improvement). See migration 183.
- Never use `get_supabase` directly in routers. Use `get_effective_supabase` instead — it auto-elevates to service_role for platform admins, returns the user-scoped client for everyone else. All 38 routers already use this pattern. `get_supabase` is internal only (used by `get_effective_supabase` and `require_role`). Without this, admins pass `require_role()` but fail on RLS.
- Never add dungeon content (enemies, encounters, banter, loot, objektanker, abilities) to Python files under `backend/services/dungeon/` or `backend/services/combat/ability_schools.py`. Since A1.5 (2026-04-19) the canonical authoring source is `content/dungeon/**/*.yaml`. Runtime reads from the pack-derived cache via `dungeon_content_service` (`get_banter_registry()`, `get_encounter_registry()`, `get_ability_registry()`, etc.). Pipeline: author YAML under `content/dungeon/archetypes/{slug}/*.yaml` → `scripts/validate_content_packs.py` checks schema + FKs + invariants in CI → `backend.services.content_packs.generate_migration --output supabase/migrations/{N}_*.sql` produces the DB seed migration (TRUNCATE + re-insert, pack is single source of truth) → migration applied at deploy → `load_all_content()` refreshes cache. Enforced by `scripts/lint-no-content-in-python.sh` in CI. File-level exception: `backend/services/dungeon/dungeon_loot.py` carries `DELUGE_DEBRIS_POOL` (tier-0 auto-apply pool, not in the DB content tables); the file opts in via `# content-allowed: …` pragma.
- Never call `.maybe_single().execute()` directly. Use `maybe_single_data()` from `backend/utils/db.py` instead. postgrest-py's `maybe_single().execute()` returns `None` (the entire response object) when 0 rows match — every downstream `resp.data` access is a latent NoneType crash. The wrapper collapses this into `dict | None`. Pattern: `data = await maybe_single_data(supabase.table("t").select("*").eq("id", x).maybe_single())`.
- Never call `GenerationService._generate()` from outside `generation_service.py`. Use the public façade methods: `extract_memory_observations`, `reflect_on_memories`, `generate_chronicle_entry`, `generate_cycle_sitrep`, `generate_instagram_caption`. Each owns its prompt template + model purpose and returns a typed DTO from `backend/models/generation.py`. Enforced by `scripts/lint-no-private-generate.sh` in CI. Tests under `backend/tests/` are exempt (mocking `_generate` via `patch.object` is a legitimate LLM-response test seam).
- Never write `platform_settings` rows via `.update({"setting_value": v}).eq("setting_key", k).execute()` — the pattern silently no-ops when the row is absent (fresh DB, migration-lag window, unseeded key). Use `upsert_platform_setting(admin, key, value, *, updated_by_id)` from `backend/utils/settings.py`. The table declares `UNIQUE(setting_key)` (migration 040), so `.upsert(row, on_conflict="setting_key")` resolves cleanly — existing rows UPDATE, absent rows INSERT. `PlatformSettingsService.update` (admin-UI write path) already uses upsert; migration seeds use `INSERT … ON CONFLICT DO NOTHING`. F7 (2026-04-21) normalised 7 scheduler + service sites to the helper.
- Never rely on the old liberal `parse_setting_bool` semantics that returned True for anything not in `{"false", "0", "no", ""}`. Since F32 (2026-04-21) the helper is positive-match `{"true", "1", "yes", "on"}` with `None` short-circuit and `isinstance(value, bool)` passthrough — fail-closed so a jsonb null round-trip or a SQL typo cannot silently arm a `*_enabled` gate (orphan-sweeper, instagram/bluesky posting, forge BYOK, resonance stories, …). Writers: store canonical lowercase strings (`"true"`/`"false"`) via `adminApi.updateSetting` or `PlatformSettingsService.update`, or canonical jsonb bool via migration seeds.

### Observability & Error Tracking

- Source maps are uploaded during Docker build via `@sentry/vite-plugin` in `frontend/vite.config.ts`. Never rebuild the frontend separately for Sentry — this creates a dual-build mismatch where source maps don't correspond to production chunks.
- `SENTRY_AUTH_TOKEN` is a Stage 1 Docker ARG only. It must never appear in the runtime image (Stage 3) or be committed to the repository.
- Release tagging: backend reads `os.environ.get("SENTRY_RELEASE")`, frontend reads `import.meta.env.VITE_SENTRY_RELEASE`. Never hardcode release versions.
- `development` and `test` environments are excluded from Sentry (`backend/app.py` checks `app_settings.environment`).
- All `capture_exception()` calls should include contextual tags (service name, `simulation_id` where applicable) via `sentry_sdk.push_scope()`.
- See `docs/guides/sentry-cicd-integration.md` for full architecture.

---

## Frontend Rules

- All components extend `LitElement`.
- State via `AppStateManager` (Preact Signals).
- All API calls through existing API service singletons.
- Never create inline API service classes.
- Use shared components before creating new ones.
- Use design tokens — never hardcode colors or spacing.
- All icons must come from `utils/icons.ts`.
- Never apply CSS `filter`, `transform`, `will-change`, `contain: paint`, or `perspective` on layout containers (shells, views, panels). These create new containing blocks that break `position: fixed` modals/lightboxes. Use `backdrop-filter` on a `::after` overlay or apply filters to leaf elements only.
- Never read **routing signals** (`appState.isAuthenticated`, `appState.currentRole`) inside `src/services/api/`. API-service methods must accept `mode: 'public' | 'member'` as an explicit parameter and forward it to `BaseApiService.getSimulationData(path, mode, params?)`. Callers pass `appState.currentSimulationMode.value` for simulation-scoped reads or `isAuthenticated.value ? 'member' : 'public'` for auth-gated global reads (Epochs, Simulations list, Resonance, Connections). `appState.accessToken` is **allowed** in the API layer — it is the Authorization-header source, not a routing decision. Enforced by `frontend/scripts/lint-no-appstate-access-reads.sh` in CI. Reason: routing must be visible at the call site and independent of route-entry timing; an API call that fires before `_checkMembership` resolves used to silently hit the wrong endpoint.

### Error Observability (MANDATORY)

Never silently swallow an exception. Every failure path must be observed via `captureError(err, { source: 'ClassName.methodName' })` from `services/SentryService.ts`. User-visible operations additionally show a toast (`captureError` runs first, then `VelgToast.error`). Module-level functions use `file-slug.functionName` as the source tag (e.g. `'simulation-switcher.getLastTab'`).

Forbidden:
- `catch {}` / `catch { /* comment */ }` / `catch { return fallback; }` — no binding, observation unreachable
- `.catch(() => {})` / `.catch(() => { fallback })` — Promise-chain rejection without binding

Allowed:
- `catch (err) { captureError(err, { source: '...' }); /* optional body */ }`
- `.catch((err) => captureError(err, { source: '...' }))` — Promise-chain equivalent

Run `frontend/scripts/lint-no-empty-catch.sh` to verify. CI will reject violations.

### Type Safety (MANDATORY)

Never use `as unknown as T` double-casts. They defeat TypeScript's structural check and hide shape drift at runtime — W3.2 found three latent bugs (broken "examine building" agent list, always-zero active-embassy count in sitrep, dead effectiveness multiplier in deploy modal) where the cast masked that the accessed field never existed in the actual response.

Forbidden:
- `as unknown as T` anywhere in `frontend/src/**/*.ts` outside the two Lit-mixin sites

Allowed:
- Extend the base type (if the field is genuinely on the entity)
- Wrapper / projection type (for SQL-view or FK-join fields that aren't on the base table)
- `function isFoo(x: unknown): x is Foo` type guard with runtime validation — route rejections through `captureError` per the Error Observability rule
- Correct the upstream API service return type — `ApiResponse<T>` already carries `meta`; don't double-wrap with `PaginatedResponse<T>`
- Narrow a dynamic key type via `Exclude<keyof State, 'immutableField'>` instead of widening to `Record<string, unknown>`

Whitelist: `src/components/shared/DataLoaderMixin.ts` and `src/components/shared/PaginatedLoaderMixin.ts` — TypeScript cannot infer the Lit mixin constructor intersection (documented at https://lit.dev/docs/composition/mixins/#creating-a-mixin). Both files carry a block comment explaining the exception.

Run `frontend/scripts/lint-no-cast-unknown.sh` to verify. CI will reject violations.

### Color Tokens (MANDATORY)

Never use raw `#hex` or `rgba()` in component CSS. All colors must reference:
- Tier 1 semantic tokens: `var(--color-text-primary)`, `var(--color-surface)`, etc.
- Tier 2 auto-derived tokens: `var(--color-danger-glow)`, `var(--color-success-bg)`, etc.
- Tier 3 component-local `--_*` variables (defined in `:host` only, using `color-mix()` from Tier 1/2)

Exceptions: `EchartsChart.ts`, `HowToPlayWarRoom.ts`, `forge-placeholders.ts`, `DailyBriefingModal.ts`, `VelgDarkroomStudio.ts` (documented in `docs/guides/design-tokens.md`).

Run `frontend/scripts/lint-color-tokens.sh` to verify. CI will reject violations.

### Content Quality (MANDATORY)

No em dashes (U+2014) in user-facing `msg()` strings — use en dashes (U+2013). No LLM-ism words (tapestry, delve, unleash, seamlessly, holistic, multifaceted, bustling, game-changer, cutting-edge) in `msg()` strings.

Run `frontend/scripts/lint-llm-content.sh` to verify. CI will reject violations.

### Alpha Suite (pre-release only)

Four Bureau-flavored indicators are active while Velgarien is in alpha: `<velg-alpha-stamp>`, `<velg-build-strip>`, `<velg-first-contact-modal>` (all under `frontend/src/components/alpha/`, wrapped by `<velg-alpha-suite>`), and the persistent `<velg-redacted>` inline marker under `frontend/src/components/shared/`.

- Gate: `import.meta.env.VITE_IS_ALPHA === 'true'` (a build-time constant injected by `vite.config.ts` via `loadEnv`). The render branch in `app-shell.ts` is const-evaluated — setting the flag to `false` tree-shakes the entire suite out of the bundle. Do not add runtime kill-switches for the stamp or build-strip.
- State: `services/AlphaStatusService.ts` singleton owns four signals + the `shouldShowFirstContact` computed. Kept **separate from `AppStateManager`** so release-cut deletion is a single-file operation.
- Runtime config: two `platform_settings` keys drive the first-contact modal (`alpha_first_contact_modal_enabled` bool, `alpha_first_contact_modal_version` text). Public read via `GET /api/v1/public/alpha-state` (narrow DTO; `platform_settings` stays `service_role` only).
- Admin control: sub-tab **Admin → Platform → Announcements** (`AdminAnnouncementsTab`). Bumping the version retriggers the modal for every user who dismissed an older version. Preview mode opens the modal without touching `localStorage`.
- Cross-shadow-DOM `url(#filter-id)` does not work — each alpha component inlines its own `<svg><defs><filter>` with a unique ID.
- Scramble/animation entry points tie to the open transition (via `updated()`), not `connectedCallback`, so the async `alpha-state` fetch never races the animation off-screen.
- Full reference: `docs/guides/alpha-suite.md`.

---

## i18n (MANDATORY)

Every user-facing string must use:

```ts
msg('...')
```

---

## Claude Collaboration Rules

### Safety (HARD BLOCKS)

- NEVER destroy, delete, reset, drop, or truncate production database data.
- Python 3.13 everywhere (production + local venv), NOT system Python 3.9.

### Architecture & Quality

- SAUBERSTE Architektur: no shortcuts, verify every pattern against existing codebase.
- Before ANY new service: list all existing patterns the new code must follow.
- Every JOIN must be LEFT JOIN unless documented reason for INNER.
- Never hardcode mappings that should be configurable.
- Self-audit checklist before presenting code as "done".
- No hacks/shortcuts: clean architecture, configurable settings, proper logging.
- Fix surrounding code problems while you're there.

### Frontend

- MUST invoke `velg-frontend-design` skill before writing any component code.
- Maximum creative effort: dramatic animations, modern UI, WCAG AA.
- Always check shared components before creating new ones.

### Process

- Run full lint pipeline (`ruff` + `tsc`) after EVERY change, fix before presenting.
- MOST DETAILED commit messages: explain why, impact, verification for every change.
- Update docs + memory at EVERY implementation step, not batched at the end.
- Give step-by-step status updates during multi-step work — don't go silent.
- Never convert stdlib `logging` to `structlog` (injection middleware handles it).

### Mindset

- Always deep dive, ultrathink, 4 perspectives (architect, game designer, UX, research).
- Perfection over speed: take time, question every step, deep dive when unclear.