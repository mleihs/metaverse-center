# Full Stack Audit — Findings & Action Plan

## Context

Comprehensive audit of the velgarien-rebuild codebase covering backend architecture, frontend architecture, database layer, security, code duplication, component reuse, and mobile readiness. The codebase is overall well-architected (A- grade) with specific actionable improvements.

---

## Severity Legend

- **RED** = Spec violation / security concern — fix promptly
- **AMBER** = Architecture debt / duplication — fix when touching these files
- **GREEN** = Nice-to-have optimization — backlog

---

## RED — Spec Violations & Security

### R1. Direct DB query in forge.py router (line 932-934)

```python
admin_supabase.table("simulation_lore").delete().eq(
    "simulation_id", str(simulation_id),
).execute()
```

**Violation**: CLAUDE.md — "No direct DB queries in routers."
**Fix**: Move to `ForgeLoreService.delete_by_simulation(admin_supabase, simulation_id)`.
**File**: `backend/routers/forge.py:932`

### R2. Phase transition validation in forge.py router (lines 120-129)

State machine validation logic (allowed phase transitions) lives in the router.
**Fix**: Move to `ForgeDraftService.validate_phase_transition(current_phase, new_phase)`.
**File**: `backend/routers/forge.py:120`

### R3. BYOK allowance check in forge.py router (lines 338-351)

Business logic (RPC call + auth decision) in router.
**Fix**: Move to `ForgeDraftService.check_byok_allowed(supabase, user_id)`.
**File**: `backend/routers/forge.py:338`

### R4. `enrich_with_counts()` called in public.py router (lines 99, 115, 149)

Post-processing logic called 3 times in the router.
**Fix**: Fold into `SimulationService.list_active_public()` and `get_by_slug_public()` so callers get enriched data automatically.
**File**: `backend/routers/public.py:99,115,149`

### R5. Allied intel tagging in epochs.py router (lines 289-301)

Business logic (data mutation based on ownership) in router.
**Fix**: Move to `BattleLogService.tag_allied_intel(data, simulation_id)`.
**File**: `backend/routers/epochs.py:289`

---

## AMBER — Architecture Debt

### A1. Generation router error handling duplication

4+ endpoints in `generation.py` repeat identical try/except blocks (`OpenRouterError` → 503, `Exception` → 500).
**Fix**: Extract `@catch_generation_errors` decorator or wrapper function.
**File**: `backend/routers/generation.py:141-160, 174-193, 207-224, 238-258`

### A2. BaseService subclass pagination overrides

`AgentService`, `BuildingService`, `EventService` all override `list()` just to add filters, then re-implement pagination. BaseService already supports a `filters` dict parameter.
**Fix**: Use `filters` dict in `BaseService.list()` calls instead of overriding. Affects 5+ service files.
**Files**: `backend/services/agent_service.py`, `building_service.py`, `event_service.py`

### A3. Operative constants duplicated in frontend

`OP_LABELS`, `OP_SHORT` defined identically in two files.
**Fix**: Extract to `frontend/src/utils/operative-constants.ts` and import.
**Files**: `frontend/src/components/shared/VelgGameCard.ts:17-33`, `frontend/src/components/epoch/DraftRosterPanel.ts:17-33`

### A4. ForgeApiService too large (386 lines)

Combines draft CRUD, wallet, feature purchases, research, generation, ignition.
**Fix**: Split into `ForgeDraftApiService`, `ForgeWalletApiService`, `ForgeFeatureApiService`.
**File**: `frontend/src/services/api/ForgeApiService.ts`

### A5. Missing `deleted_at` partial indexes

`agents`, `buildings`, `events` tables have no index for the common `WHERE deleted_at IS NULL` filter.
**Fix**: Migration to add partial indexes:
```sql
CREATE INDEX idx_agents_active ON agents(simulation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_buildings_active ON buildings(simulation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_active ON events(simulation_id) WHERE deleted_at IS NULL;
```
**File**: New migration

### A6. Model validation gaps

- `PhilosophicalAnchor`: no `min_length` on `title`, `core_question`, `description` — empty strings pass
- `SimulationResponse`: `status` and `content_locale` are bare `str` instead of `Literal` types
- `ForgeGenerationConfig`: no cross-field validation (e.g. zone_count vs street_count)
**Files**: `backend/models/forge.py:361-383`, `backend/models/simulation.py:28-53`

### A7. Frontend public/authenticated routing inconsistency

`SimulationsApiService.list()` checks only `isAuthenticated`, but `BaseApiService.getSimulationData()` checks both `isAuthenticated` AND `currentRole`. A logged-in user without a role could get routed differently depending on which method is called.
**Fix**: Standardize — `getSimulationData()` pattern is correct (checks both). Make `SimulationsApiService.list()` and `getById()` use `getSimulationData()`.
**File**: `frontend/src/services/api/SimulationsApiService.ts:6-18`

---

## GREEN — Optimizations

### G1. Card event handler duplication

`AgentCard`, `BuildingCard`, `EventCard`, `ResonanceCard` all define identical `_handleClick`, `_handleEdit`, `_handleDelete` dispatchers. Could extract to a mixin.

### G2. Status badge variant mapping

Repeated `_getStatusBadgeVariant()` logic across card components. Could become a shared utility.

### G3. AuditService silently swallows failures

`safe_log()` catches all exceptions and logs at debug level. Audit trail gaps are invisible. Consider logging at warning level.
**File**: `backend/services/audit_service.py:14-30`

### G4. Missing mobile media queries on epoch components

`EpochCommandCenter.ts`, `EpochResultsView.ts`, `WarRoomPanel.ts` — no explicit mobile breakpoints verified. Touch targets on some form inputs (RelationshipEditModal checkboxes at 18x18px) are below 44px minimum.

### G5. HealthApiService manual URL query building

`executeThresholdAction()` manually builds query strings instead of passing `params` to `post()`.
**File**: `frontend/src/services/api/HealthApiService.ts:44-50`

---

## Positive Findings (No Action Needed)

- No backend logic in frontend components
- All API calls through service singletons (no inline API classes)
- 100% i18n compliance (`msg()` wrapping)
- Design tokens used consistently (no hardcoded colors)
- Icons from centralized `utils/icons.ts`
- RLS properly enforced — no bypasses detected
- No circular imports
- No SQL injection vectors
- Service role usage limited to admin operations with proper auth
- Views actively refreshed when columns added (migrations 111, 123)
- `VelgGameCard` shared component pattern is exemplary

---

## Execution Order

If you want me to implement fixes, I'd suggest this order:

**Phase 1 — RED items (R1-R5)**: Extract business logic from routers to services. ~1 hour.

**Phase 2 — AMBER items (A1-A7)**: Architecture improvements. ~2-3 hours total, can be done incrementally.

**Phase 3 — GREEN items (G1-G5)**: Polish. Backlog — tackle when touching those files.

---

## Verification

After RED fixes:
- `ruff check backend/` — no lint errors
- `npx tsc --noEmit` — no type errors
- `pytest backend/tests/` — existing tests pass
- Manual: Forge flow (create draft → phase transitions → ignite) works
- Manual: Public simulation listing returns enriched data
