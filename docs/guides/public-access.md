---
title: "Public-First Architecture — Implementation Reference"
type: guide
status: active
lang: en
---

# Public-First Architecture — Implementation Reference

## Status: COMPLETE (implemented 2026-02-25)

### Implementation Notes
- Migration 018: 21 anon SELECT policies (fixed `is_deleted` → `deleted_at IS NULL`, table name corrections: `building_agent_relations`, `event_reactions`, removed nonexistent `agent_professions_junction`)
- 10 API services updated (not 8 as originally planned — added SocialMediaApiService + CampaignsApiService)
- SettingsApiService: both `list()` AND `getByCategory()` needed public routing (getByCategory caused theme/skin regression)
- Detail panels: added auth guards on sub-resource loads (_loadReactions, _loadAgents) to prevent 422 for anon
- ChatWindow: message input hidden for anon (not just ConversationList)

## Task Order

1. **Database migration** — `supabase/migrations/20260226000000_018_public_read_access.sql` (NEW)
2. **Backend dependency** — `backend/dependencies.py` — add `get_anon_supabase()`
3. **Backend public router** — `backend/routers/public.py` (NEW) — GET-only endpoints under `/api/v1/public`
4. **Register router** — `backend/app.py` — add `from backend.routers import public` + `app.include_router(public.router)`
5. **BaseApiService.getPublic()** — `frontend/src/services/api/BaseApiService.ts` — add public GET method
6. **API service routing** — 8 API services: auto-route list/getById to public when not authenticated
7. **LoginPanel** — `frontend/src/components/auth/LoginPanel.ts` (NEW) — login form in VelgSidePanel
8. **app-shell.ts** — remove auth guards on dashboard + simulation routes, always show header, add login panel
9. **PlatformHeader.ts** — Sign In button for anonymous users
10. **SimulationsDashboard.ts** — hide create button for anon
11. **ChatView.ts + ConversationList.ts** — read-only mode for anon
12. **Detail panels** — wrap footer buttons with canEdit check (agents, buildings, events)
13. **i18n** — extract + translate + build

---

## Key Files

> Line numbers omitted — search by function/class name instead. These are the files involved in the public-first implementation.

**Backend:**
- `backend/dependencies.py` — `get_anon_supabase()` creates client with anon key only (no JWT, anon RLS)
- `backend/routers/public.py` — GET-only endpoints under `/api/v1/public`
- `backend/app.py` — router registration (SPA catch-all must stay LAST)

**Frontend:**
- `frontend/src/services/api/BaseApiService.ts` — `getPublic()` prefixes path with `/public`, omits Authorization header
- `frontend/src/app-shell.ts` — routes, simulation context loading (anon: public API, no members, role=null)
- `frontend/src/components/platform/PlatformHeader.ts` — "Sign In" button for anon
- `frontend/src/components/platform/SimulationsDashboard.ts` — "Fracture a New Shard" hidden for anon
- `frontend/src/components/chat/ChatView.ts` + `ConversationList.ts` — read-only mode for anon
- Detail panels (`AgentDetailsPanel`, `BuildingDetailsPanel`, `EventDetailsPanel`) — footer buttons gated by `appState.canEdit.value`

**API Services (all extend BaseApiService):**
- Simulation-scoped services use `getSimulationData()` which routes to public when `!isAuthenticated || !currentRole`
- Platform-level services use simple `isAuthenticated` check
- Special cases: `SettingsApiService` design category always uses public endpoint; `SocialMediaApiService` has different public/auth paths

### Public routing pattern for API services:

**Updated 2026-02-28:** Simulation-scoped services now use `getSimulationData()` which checks both `isAuthenticated` AND `currentRole`. This fixes 403 errors when authenticated users browse simulations they're not members of.

```typescript
// Simulation-scoped services use getSimulationData():
list(simulationId: string, params?: Record<string, string>) {
  return this.getSimulationData(`/simulations/${simulationId}/agents`, params);
}
// getSimulationData() routes to public when !isAuthenticated || !currentRole

// Platform-level services still use simple isAuthenticated check:
list(params?: Record<string, string>) {
  if (!appState.isAuthenticated.value) {
    return this.getPublic('/simulations', params);
  }
  return this.get('/simulations', params);
}
```
Special cases: `SettingsApiService` design category always uses public endpoint. `SocialMediaApiService` has different public/auth paths.

---

## i18n Strings Needed

| English | German | Context |
|---------|--------|---------|
| `Sign In` | `Anmelden` | Header button + panel title |
| `Email` | `E-Mail` | Login form label |
| `Password` | `Passwort` | Login form label |
| `Signing in...` | `Anmeldung läuft...` | Button loading state |
| `Invalid email or password.` | `Ungültige E-Mail oder Passwort.` | Error message |
| `Don't have an account?` | `Noch kein Konto?` | Login panel link |
| `Register` | `Registrieren` | Login panel link |
| `Sign in to start conversations and chat with agents` | `Melde dich an, um Konversationen zu starten und mit Agenten zu chatten` | Chat banner |

---

## Database Migration SQL

```sql
-- Anonymous read access for active simulation data.
-- TO anon policies — additive, don't modify existing authenticated policies.

CREATE POLICY simulations_anon_select ON simulations
    FOR SELECT TO anon USING (status = 'active');

CREATE POLICY taxonomies_anon_select ON simulation_taxonomies
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY settings_anon_select ON simulation_settings
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY agents_anon_select ON agents
    FOR SELECT TO anon
    USING (is_deleted = false AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY buildings_anon_select ON buildings
    FOR SELECT TO anon
    USING (is_deleted = false AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY events_anon_select ON events
    FOR SELECT TO anon
    USING (is_deleted = false AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY cities_anon_select ON cities
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY zones_anon_select ON zones
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY streets_anon_select ON city_streets
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY agent_professions_anon_select ON agent_professions
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY agent_prof_junction_anon_select ON agent_professions_junction
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active')));

CREATE POLICY building_agents_anon_select ON building_agent_assignments
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM buildings WHERE id = building_id AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active')));

CREATE POLICY event_reactions_anon_select ON event_agent_reactions
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM events WHERE id = event_id AND EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active')));

CREATE POLICY conversations_anon_select ON chat_conversations
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY messages_anon_select ON chat_messages
    FOR SELECT TO anon
    USING (EXISTS (
        SELECT 1 FROM chat_conversations c
        JOIN simulations s ON s.id = c.simulation_id
        WHERE c.id = conversation_id AND s.status = 'active'
    ));

CREATE POLICY campaigns_anon_select ON campaigns
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY social_trends_anon_select ON social_trends
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));

CREATE POLICY social_posts_anon_select ON social_media_posts
    FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM simulations WHERE id = simulation_id AND status = 'active'));
```

---

## Backend Public Router Structure

File: `backend/routers/public.py`
- `router = APIRouter(prefix="/api/v1/public", tags=["Public"])`
- Uses `get_anon_supabase()` dependency (no auth)
- Only GET endpoints — ~15 endpoints mirroring the authenticated ones
- Same response format (`PaginatedResponse`, `SuccessResponse`)
- Pagination via `limit`/`offset` query params
- Search via `search` query param where applicable
- Settings endpoint filters to `design` category only

---

## Key Architectural Notes

- `appState.canEdit` is already a computed signal that returns `false` when role is null
- `appState.isAuthenticated` checks for accessToken presence
- Entity views already gate edit/delete via `_canEdit` getter — create buttons should already be hidden
- SimulationNav settings tab is already gated by `requireAdmin` — hidden for anon
- The `/register` route stays as a standalone page
- `/profile` and `/new-simulation` keep auth guards
