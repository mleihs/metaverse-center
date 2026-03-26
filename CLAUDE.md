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
- All responses use:
  - `SuccessResponse`
  - `PaginatedResponse`
- Audit logging required for all mutations.
- Import dependencies at module level (no late-binding imports).

### NEVER

- Never use `service_role` for normal CRUD.
- Never run `supabase db reset` without explicit user approval.
- Never place business logic inside routers.
- Never change response shape without updating spec.
- Never add columns to `agents`, `buildings`, `simulations`, or `events` without refreshing the corresponding `active_*` view (`CREATE OR REPLACE VIEW`) in the same migration. PostgreSQL `SELECT *` in views resolves columns at creation time, not query time.
- Never grant SECURITY DEFINER functions to `anon` or `authenticated`. Admin RPCs must be callable only via backend with role validation (see ADR-006, incident migration 096→147).
- Never use `httpx`/`requests` directly for user-provided URLs. Use `backend/utils/safe_fetch.py` for SSRF protection.
- Never implement fetch-compute-update patterns in Python for concurrent-access data. Use atomic Postgres RPCs with compare-and-swap logic (see ADR-007, migration 148).

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

### Color Tokens (MANDATORY)

Never use raw `#hex` or `rgba()` in component CSS. All colors must reference:
- Tier 1 semantic tokens: `var(--color-text-primary)`, `var(--color-surface)`, etc.
- Tier 2 auto-derived tokens: `var(--color-danger-glow)`, `var(--color-success-bg)`, etc.
- Tier 3 component-local `--_*` variables (defined in `:host` only, using `color-mix()` from Tier 1/2)

Exceptions: `EchartsChart.ts`, `forge-placeholders.ts`, `DailyBriefingModal.ts`, `VelgDarkroomStudio.ts` (documented in `docs/guides/design-tokens.md`).

Run `frontend/scripts/lint-color-tokens.sh` to verify. CI will reject violations.

### Content Quality (MANDATORY)

No em dashes (U+2014) in user-facing `msg()` strings — use en dashes (U+2013). No LLM-ism words (tapestry, delve, unleash, seamlessly, holistic, multifaceted, bustling, game-changer, cutting-edge) in `msg()` strings.

Run `frontend/scripts/lint-llm-content.sh` to verify. CI will reject violations.

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

- MUST invoke `frontend-design` skill before writing any component code.
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