# metaverse.center — Development Contract

## Core Principles (Non-Negotiable)

- Follow spec documents in `/docs` before implementing.
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

---

## Frontend Rules

- All components extend `LitElement`.
- State via `AppStateManager` (Preact Signals).
- All API calls through existing API service singletons.
- Never create inline API service classes.
- Use shared components before creating new ones.
- Use design tokens — never hardcode colors or spacing.
- All icons must come from `utils/icons.ts`.

---

## i18n (MANDATORY)

Every user-facing string must use:

```ts
msg('...')