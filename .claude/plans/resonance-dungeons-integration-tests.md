# Resonance Dungeons — Integration Tests Plan

## Context

Unit tests (576, pure functions) are DONE. Next: integration tests for the async orchestrator (`DungeonEngineService`) and REST router endpoints. These require Supabase mocking.

## Test Files (Priority Order)

### File 1: `test_dungeon_engine_service.py` (~60-80 tests)

Tests for the core orchestrator. ALL methods are `@classmethod async`, all need admin_supabase mock.

**Mock Strategy:**
- Use `conftest.make_async_supabase_mock()` for Supabase
- Patch `get_admin_supabase` to return mock
- Pre-populate `_active_instances` dict for most tests (bypass create_run DB calls)
- Patch `_checkpoint` and `_log_event` to no-op for non-checkpoint tests

**Public Methods to Test:**

| Method | Priority | Key Tests |
|--------|----------|-----------|
| `create_run()` | HIGH | Party validation (2-4 agents), RPC fn_get_party_combat_state, graph generation, initial archetype_state, MAX_CONCURRENT_PER_SIM=1 |
| `move_to_room()` | HIGH | Adjacent room validation, room reveal, ambient stress, visibility cost per 2 rooms, banter trigger, entering different room types |
| `submit_combat_actions()` | HIGH | Planning phase validation, action storage, auto-resolve when all submitted |
| `handle_encounter_choice()` | HIGH | Choice validation, skill check delegation, effect application (stress, reveal, loot), narrative selection |
| `scout()` | MEDIUM | Spy agent validation, visibility restore +1, room reveal, cooldown |
| `rest()` | MEDIUM | Rest site validation, stress heal 200, condition recovery (wounded→stressed), ambush check |
| `retreat()` | MEDIUM | Status update, partial loot via fn_abandon_dungeon_run RPC |
| `get_available_dungeons()` | LOW | available_dungeons VIEW query, magnitude threshold |
| `recover_from_checkpoint()` | MEDIUM | Restore from DB, graph + mutable state, room flags |
| `get_client_state()` | HIGH | Fog-of-war filtering (unrevealed rooms as "?"), enemy stat hiding |

**Private Methods Worth Testing:**

| Method | Key Tests |
|--------|-----------|
| `_build_client_state()` | Fog of war: unrevealed→"?", current room marker, stress threshold display |
| `_apply_shadow_visibility()` | VP cost per 2 rooms, not per room |
| `_enter_combat_room()` | Spawn enemies, ambush check, combat state init |
| `_enter_encounter_room()` | Encounter selection, choice list |
| `_enter_rest_room()` | Stress heal, condition recovery |
| `_enter_treasure_room()` | Loot roll, VP 0 bonus |
| `_resolve_combat()` | Round resolution delegation, victory/wipe handling |
| `_complete_run()` | fn_complete_dungeon_run RPC, loot items for RPC |
| `_handle_party_wipe()` | fn_wipe_dungeon_run RPC, trauma outcomes |
| `_build_loot_items_for_rpc()` | Loot item serialization for Postgres |
| `_checkpoint()` | to_checkpoint() → DB upsert |

**Edge Cases:**
- Instance TTL expiry (INSTANCE_TTL_SECONDS = 1800)
- MAX_CONCURRENT_PER_SIM = 1 enforcement
- Combat timer (COMBAT_PLANNING_TIMEOUT_MS = 30000)
- Room already cleared → skip encounter
- Dead-end prevention: boss always reachable

### File 2: `test_resonance_dungeons_router.py` (~40-50 tests)

Tests for REST API endpoints using FastAPI TestClient.

**Mock Strategy:**
- Override `get_current_user` → mock CurrentUser
- Override `get_admin_supabase` → mock Supabase
- Override `require_simulation_member` → pass-through
- Patch `DungeonEngineService` methods to return controlled data

**12 Authenticated Endpoints:**

| Endpoint | Method | Key Tests |
|----------|--------|-----------|
| GET /dungeons/available | viewer | Simulation ID required, returns AvailableDungeonResponse[] |
| POST /dungeons/runs | editor | DungeonRunCreate validation (2-4 agents, difficulty 1-5), 201 created |
| GET /dungeons/runs/{id} | public | Returns DungeonRunResponse |
| GET /dungeons/runs/{id}/state | public | Returns DungeonClientState (fog of war) |
| POST /dungeons/runs/{id}/move | editor | DungeonMoveRequest validation, room_index >= 0 |
| POST /dungeons/runs/{id}/action | editor | DungeonAction validation |
| POST /dungeons/runs/{id}/combat/submit | editor | CombatSubmission (min 1 action) |
| POST /dungeons/runs/{id}/scout | editor | ScoutRequest validation |
| POST /dungeons/runs/{id}/rest | editor | RestRequest (min 1 agent_id) |
| POST /dungeons/runs/{id}/retreat | editor | No body needed |
| GET /dungeons/runs/{id}/events | public | Pagination (limit, offset) |
| GET /dungeons/history | viewer | Simulation ID + pagination |

**2 Public Endpoints (in public.py):**

| Endpoint | Key Tests |
|----------|-----------|
| GET /public/simulations/{id}/dungeons/history | Only completed/abandoned/wiped runs |
| GET /public/dungeons/runs/{id} | Only completed/abandoned/wiped run details |

**Test Categories:**
- Auth: unauthenticated → 401, wrong role → 403
- Validation: malformed body → 422
- Happy path: correct response shape
- Error: non-existent run_id → 404

### File 3: `test_dungeon_models.py` (~20-30 tests)

Tests for Pydantic model validation and serialization.

| Model | Key Tests |
|-------|-----------|
| DungeonRunCreate | party_agent_ids min 2 / max 4, difficulty 1-5 |
| DungeonMoveRequest | room_index >= 0 |
| CombatSubmission | actions min 1 |
| DungeonInstance | to_checkpoint() → restore_from_checkpoint() round-trip |
| RoomNode | default values |
| Client state models | Fog-of-war schemas |

## Execution Order

1. `test_dungeon_models.py` — pure validation, no mocks (warmup)
2. `test_dungeon_engine_service.py` — core orchestrator (biggest effort)
3. `test_resonance_dungeons_router.py` — HTTP layer (relies on understanding engine)

## Dependencies

- `pytest-asyncio` for async tests
- `conftest.py` fixtures: `make_async_supabase_mock`, `mock_current_user`, `test_app`
- May need new conftest fixtures for DungeonInstance factory

## Command to Continue

```
Lies den Plan in .claude/plans/resonance-dungeons-integration-tests.md und die Memory-Datei memory/resonance-dungeons-test-findings.md. Implementiere die 3 Test-Dateien in der Priority-Reihenfolge. Ultrathink, keine Abschneider. Jede Datei: schreiben → pytest ausführen → Fehler fixen → nächste.
```
