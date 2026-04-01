# Resonance Dungeons -- Full-Stack Audit

**Date**: 2026-04-01
**Scope**: Resonance Dungeon system (backend engine, frontend terminal UI, database, security, performance)
**Auditor**: Claude Opus 4.6 (3-agent parallel deep dive)

---

## 1. Executive Summary

The Resonance Dungeons system is an architecturally ambitious, literarily rich dungeon-crawl engine built on FastAPI + Lit + Supabase. The codebase demonstrates strong separation of concerns (router/service/model), excellent TypeScript types, robust RLS policies, and a server-authoritative state model that prevents client-side cheating.

**Biggest risks** (production-blocking):
1. **Unprotected global mutable state** (`_active_instances` dict) -- race conditions under concurrent requests
2. **Multi-worker incompatibility** -- in-memory state doesn't share across Uvicorn workers
3. **God-class engine** (2,615 lines) -- all game logic in one file, high coupling
4. **God-class encounters** (5,228 lines) -- all encounter content inline in Python code

**Biggest strengths**:
1. Fog-of-war enforcement at type level (no HP/room leaks to client)
2. Atomic Postgres RPCs with advisory locks for loot distribution
3. Server-authoritative state -- zero client trust
4. Comprehensive RLS policies with public-first architecture
5. Excellent literary quality in encounter/banter content

**Production readiness**: **7/10** -- solid for single-server deployment, needs concurrency hardening for horizontal scale.

---

## 2. Architecture Overview

```
Frontend (Lit 3 + Preact Signals + TypeScript)
    |
    | REST API (Bearer JWT)
    v
FastAPI Router (resonance_dungeons.py, 324 lines)
    |
    | Depends(require_simulation_member)
    v
DungeonEngineService (606 lines -- FACADE after H7 decomposition)
    |
    +-- DungeonMovementService (749 lines) -- room traversal, encounters, scout, rest
    +-- DungeonCombatService (539 lines)   -- combat resolution, timers, victory/wipe
    +-- DungeonDistributionService (484 lines) -- loot assignment, finalization
    +-- DungeonCheckpointService (437 lines)   -- persistence, recovery, client state
    +-- DungeonInstanceStore (177 lines)   -- in-memory state, locks, timers, dirty-flag
    +-- dungeon_shared.py (133 lines)      -- constants, utility functions
    |
    +-- archetype_strategies.py (Strategy Pattern, 805 lines)
    +-- dungeon_combat.py (enemy templates + spawns, 1,334 lines)
    +-- dungeon_encounters.py (encounter templates, 5,228 lines)
    +-- dungeon_banter.py (narrative content, 1,970 lines)
    +-- dungeon_loot.py (loot tables + rolling, 1,278 lines)
    +-- dungeon_objektanker.py (anchor objects, 2,967 lines)
    +-- dungeon_archetypes.py (configs, 351 lines)
    +-- combat/combat_engine.py (stateless combat resolution, ~800 lines)
    +-- combat/stress_system.py (stress/resolve mechanics, 112 lines)
    +-- dungeon_content_service.py (DB cache layer, 341 lines)
    |
    v
Supabase (PostgreSQL + RLS)
    +-- resonance_dungeon_runs (JSONB checkpoint)
    +-- resonance_dungeon_events (bilingual event log)
    +-- 10 content tables (banter, enemies, encounters, loot, etc.)
    +-- 5 RPCs (loot CAS, party fetch, completion, wipe, abandon)
    +-- available_dungeons VIEW
```

**State model**: `InstanceStore` singleton manages in-memory instances with per-instance `asyncio.Lock`, combat/distribution timers, and dirty-flag tracking. Checkpointed to PostgreSQL JSONB after every state transition. Recovery on server restart via `DungeonCheckpointService.recover_from_checkpoint()`.

---

## 3. Critical Findings

### C1: Unprotected Global Mutable State -- Race Conditions
- **Severity**: CRITICAL
- **Files**: `dungeon_engine_service.py:115-117`
- **Problem**: `_active_instances`, `_instance_last_activity`, `_combat_timers` are plain dicts accessed without locking. Concurrent requests can read/write simultaneously.
- **Attack vector**: Two players submit combat actions at the same millisecond. Both enter `_resolve_combat()`, producing duplicate state mutations.
- **Impact**: Data corruption, duplicate combat rounds, checkpoint inconsistency.
- **Fix**: Add `asyncio.Lock` per instance (keyed by `run_id`). Wrap all `_active_instances` access in a lock-protected accessor.
- **Effort**: Medium (1-2 days)

### C2: Multi-Worker Split-Brain
- **Severity**: CRITICAL
- **Files**: `dungeon_engine_service.py:115`, `Dockerfile:57`
- **Problem**: Each Uvicorn worker has its own `_active_instances` dict. If deployed with `--workers N`, clients routed to different workers see different state.
- **Impact**: State divergence, lost progress, phantom dungeons.
- **Current mitigation**: Single-worker deployment (CMD uses no `--workers` flag). But Railway/production may auto-scale.
- **Fix**: Either enforce `--workers 1` explicitly, or migrate to Redis-backed state with DB checkpoint as fallback.
- **Effort**: Low (enforce single worker) or High (Redis migration)

### C3: Timer Race -- Duplicate Combat Resolution
- **Severity**: CRITICAL
- **Files**: `dungeon_engine_service.py:743-748, 2354-2399`
- **Problem**: Combat timer auto-resolve and player submission can fire simultaneously. No idempotency guard on `_resolve_combat()`.
- **Impact**: Double resolution = double damage, double loot, corrupted state.
- **Fix**: Add atomic compare-and-swap: check `combat.round_num == expected_round` before resolving. Use DB-level advisory lock or optimistic locking on checkpoint.
- **Effort**: Medium (1 day)

### C4: Checkpoint Failure Leaves Orphaned State
- **Severity**: CRITICAL
- **Files**: `dungeon_engine_service.py:1780-1786`
- **Problem**: If checkpoint write fails (network, DB timeout), exception is caught but instance remains in memory with new state that never reached DB. Next request may re-process from old DB state.
- **Impact**: Progress loss, state divergence between memory and DB.
- **Fix**: On checkpoint failure, mark instance as "dirty" and force re-checkpoint before next mutation. Or evict instance and force recovery.
- **Effort**: Medium (1 day)

### C5: Ambush Ability Never Triggers
- **Severity**: CRITICAL (gameplay)
- **Files**: `combat/combat_engine.py:407-414`
- **Problem**: `requires_first_round_or_dark` parameter exists but is never checked against round number. TODO comment acknowledges the gap. Ambush Strike degrades to normal damage always.
- **Impact**: Assassin archetype's key ability is broken. Players with Ambush Strike never get the damage bonus.
- **Fix**: Pass `round_num` through `CombatContext` to ability resolution. Check `round_num == 1 or visibility == 0`.
- **Effort**: Low (2 hours)

---

## 4. High Severity Findings

### H1: No Rate Limiting on Dungeon Endpoints
- **Files**: `routers/resonance_dungeons.py` (all endpoints)
- **Problem**: No `@limiter.limit()` decorator on any dungeon endpoint. Other routers (forge, generation) have rate limits.
- **Impact**: Client can spam combat submissions, moves, or rest actions. DoS on single run.
- **Fix**: Add `RATE_LIMIT_STANDARD` to all mutation endpoints.

### H2: Auth Gap on Event Log Endpoint
- **Files**: `routers/resonance_dungeons.py:267-279`
- **Problem**: `list_events` uses standard `supabase` client with RLS but has no `require_player` check. Any simulation member can read any run's event log.
- **Impact**: Information disclosure across simulation members who aren't dungeon participants.
- **Fix**: Add player ownership check or document as intentional (spectator mode).

### H3: Agent ID Not Validated in Combat/Scout
- **Files**: `dungeon_engine_service.py:1760, 1216`
- **Problem**: `agent_id` in combat actions and scout requests is not verified against party membership.
- **Impact**: User can submit actions for agents not in their party. Low real risk (backend filters later) but defense-in-depth gap.
- **Fix**: Add `if agent_id not in {a.agent_id for a in instance.party}: continue`.

### H4: Missing FK ON DELETE in Content Tables
- **Files**: Migration 170, line 114
- **Problem**: `encounter_templates.combat_encounter_id REFERENCES dungeon_spawn_configs(id)` has no ON DELETE clause. Deleted spawn config leaves dangling FK.
- **Impact**: Runtime errors when encounter references missing spawn.
- **Fix**: Add `ON DELETE RESTRICT`.

### H5: Missing Index on encounter_choices(encounter_id)
- **Files**: Migration 170
- **Problem**: `dungeon_encounter_choices` has no index on `encounter_id`. Every encounter lookup does a full table scan for its choices.
- **Impact**: Slow content loading as encounter count grows.
- **Fix**: `CREATE INDEX idx_encounter_choices_eid ON dungeon_encounter_choices(encounter_id)`.

### H6: Checkpoint Serialization Overhead
- **Files**: `dungeon_engine_service.py:1744-1785`, `models/resonance_dungeon.py:172-204`
- **Problem**: Full state (50-150KB) serialized to JSONB on every state transition. ~75 checkpoints per run = ~7.5MB per run.
- **Impact**: DB write amplification. At 100 concurrent runs: 750MB/minute of JSONB writes.
- **Fix**: Delta checkpointing (serialize only changed fields). Or reduce checkpoint frequency (batch room movements).

### H7: God-Class DungeonEngineService (2,615 lines)
- **Files**: `dungeon_engine_service.py`
- **Problem**: 40+ methods covering room movement, combat, encounters, loot distribution, checkpointing, timers, cleanup, recovery. Violates SRP.
- **Impact**: High coupling, difficult testing, merge conflicts, onboarding friction.
- **Fix**: Extract into: `DungeonCombatService`, `DungeonMovementService`, `DungeonDistributionService`, `DungeonCheckpointService`.

### H8: God-File dungeon_encounters.py (5,228 lines)
- **Files**: `dungeon/dungeon_encounters.py`
- **Problem**: All encounter templates for 5 archetypes defined inline. ~1,000 lines per archetype of hardcoded bilingual content.
- **Impact**: Merge conflicts, impossible to review, content changes require code deploy.
- **Fix**: Content already migrated to DB (migration 170/171). Remove Python-side definitions, load exclusively from `dungeon_content_service.py`.

### H9: Container Runs as Root
- **Files**: `Dockerfile:37-57`
- **Problem**: No `USER` directive. Container runs as root.
- **Impact**: Container escape vulnerability amplified.
- **Fix**: Add `RUN useradd -m appuser && USER appuser`.

### H10: No Dockerfile HEALTHCHECK
- **Files**: `Dockerfile`
- **Problem**: No HEALTHCHECK instruction. Orchestrator can't detect unhealthy containers.
- **Fix**: Add `HEALTHCHECK CMD curl -f http://localhost:${PORT:-8000}/health`.

---

## 5. Medium Severity Findings

| ID | Finding | File | Fix |
|----|---------|------|-----|
| M1 | `archetype_state` dict has no Pydantic schema | `models/resonance_dungeon.py:143` | Add typed ArchetypeState union |
| M2 | `outcome` JSONB unvalidated in DB | Migration 163:56 | Add CHECK constraint or trigger |
| M3 | `resonance_id` allows NULL | Migration 163:19 | Evaluate NOT NULL or document |
| M4 | Content cache no cross-worker invalidation | `dungeon_content_service.py:260` | Broadcast invalidation via Supabase Realtime or Redis |
| M5 | Content load all-or-nothing | `dungeon_content_service.py:66-90` | Partial load with fallback to Python-side content |
| M6 | No timeout on checkpoint recovery | `dungeon_engine_service.py:1732` | Add `asyncio.wait_for(timeout=5.0)` |
| M7 | Admin composite PK split on `::` | `dungeon_content_admin.py:166-189` | Validate IDs don't contain delimiter |
| M8 | Stress healing uncapped (asymmetric) | `combat/stress_system.py:86-87` | Cap healing at 200 per round |
| M9 | Boss enemies use same AI weights as minions | `combat/combat_engine.py:225-227` | Add boss-specific action weights |
| M10 | AoE narrative only shows first target | `combat/combat_engine.py:377-382` | Generate per-target narrative |
| M11 | Event table missing `(simulation_id, created_at)` index | Migration 163 | Add composite index |
| M12 | No migration rollback scripts | All migrations | Document or provide down migrations |
| M13 | No eviction cap in cleanup loop | `dungeon_engine_service.py:313-335` | Batch: `stale[:100]` per cycle |
| M14 | Hit chance uses int rounding for evasion | `combat/combat_engine.py:149` | Use `round()` explicitly |

---

## 6. Low Severity Findings

| ID | Finding | File | Fix |
|----|---------|------|-----|
| L1 | Error message leaks run existence | `dungeon_engine_service.py:1737` | Generic "Access denied" |
| L2 | No heartbeat verification for abandoned runs | Engine cleanup | Verify fn_expire_abandoned runs in cron |
| L3 | Test credentials in ci.yml | `.github/workflows/ci.yml:63-67` | Use GitHub Secrets |
| L4 | No security scanning in CI | CI pipeline | Add Trivy/SAST |
| L5 | No correlation IDs across async tasks | Engine service | Add structlog context |
| L6 | Cleanup eviction count not metricsed | `dungeon_engine_service.py:333` | Emit to StatsD/Prometheus |
| L7 | `_auto_finalize()` no retry on failure | `dungeon_engine_service.py:2387` | Add 1 retry with backoff |
| L8 | Virtue rate 40% may feel harsh | `stress_system.py:19` | Make configurable |

---

## 7. Backend Audit

**Architecture**: 8/10 -- Strong router/service/model separation. Strategy pattern for archetypes is excellent. God-class engine is the main weakness.

**FastAPI Usage**: 9/10 -- Clean dependency injection, proper response models, appropriate status codes, audit logging on mutations.

**Async Correctness**: 6/10 -- Unprotected global state is the critical gap. Supabase client is async. Timer management has race conditions. No timeouts on DB operations.

**Business Logic**: 8/10 -- Clean state machine (exploring -> combat -> distributing -> completed). Archetype strategies are well-abstracted. Encounter/loot selection is solid.

**Error Handling**: 7/10 -- Sentry integration on all critical paths. HTTPExceptions well-typed. But checkpoint failures swallowed, RPC failures partially handled, timer failures silent.

**Tests**: 7/10 -- 637 dungeon tests passing. Good unit coverage of combat/encounters/loot. Missing: concurrency tests, race condition tests, integration tests with real DB.

---

## 8. Frontend Audit

**Architecture**: 9/10 -- Lit + Preact Signals is clean and reactive. Server-authoritative state. No client-side game logic. Signal-based singleton store.

**TypeScript Quality**: 10/10 -- No `any` leaks. Comprehensive type guards for archetype-specific state. Fog-of-war enforced at type level. Backend/frontend type drift minimal.

**State Management**: 9/10 -- `DungeonStateManager` is well-designed. Timer lifecycle managed. `_autoSubmitFired` prevents duplicate submissions. Memory cleanup in `clear()`.

**API Integration**: 9/10 -- All 17 endpoints typed. Loading/error states handled. Race conditions prevented via `loading` and `combatSubmitting` flags. Auth token injected centrally.

**Security (Client)**: 10/10 -- No XSS risk (text content, not HTML). No command injection (all inputs validated as integers or matched against enums). No sensitive data exposure. Fog-of-war intact.

---

## 9. Supabase / Database Audit

**Schema Quality**: 8/10 -- Good constraints, foreign keys, partial indexes. JSONB used appropriately for checkpoint (flexible schema). Missing a few indexes and ON DELETE clauses.

**RLS Policies**: 9/10 -- Public-first architecture correctly implemented. Completed runs public, active runs member-gated. Content tables public-read. All mutations service_role only.

**RPCs**: 9/10 -- SECURITY INVOKER pattern throughout. Advisory locks for loot CAS. Explicit REVOKE PUBLIC on all functions. `fn_get_party_combat_state` prevents N+1 elegantly.

**Performance**: 7/10 -- Checkpoint overhead is the main concern. Content loading is well-cached. Missing a few indexes. `available_dungeons` VIEW does N+1 EXISTS per row.

---

## 10. Security Audit

| Category | Status | Notes |
|----------|--------|-------|
| **Broken Access Control** | GOOD | IDOR prevented via `require_player` check on all mutations |
| **Privilege Escalation** | GOOD | Service_role limited to backend. No SECURITY DEFINER on RPCs |
| **Input Validation** | GOOD (gaps) | Room/choice indices validated. Agent IDs NOT validated against party |
| **SQL Injection** | SAFE | Supabase SDK parameterizes all queries |
| **XSS** | SAFE | Terminal renders text, not HTML. Lit auto-escapes |
| **CSRF** | N/A | Bearer token auth, no cookies |
| **SSRF** | SAFE | No user-provided URLs in dungeon system |
| **Rate Limiting** | MISSING | No rate limits on any dungeon endpoint |
| **Data Exposure** | SAFE | Fog-of-war at type level. No HP/room leaks |
| **Audit Logging** | GOOD | All mutations logged via AuditService + dungeon_events |

---

## 11. Performance Audit

| Operation | Latency | Bottleneck |
|-----------|---------|------------|
| Create run | 200-500ms | Party RPC + insert + checkpoint |
| Move to room | 100-300ms | Checkpoint write (50-150KB JSONB) |
| Combat round | 100-200ms | Resolution O(n+m) + checkpoint |
| Loot distribution | 50ms | In-memory + checkpoint |
| Content load | ~500ms startup | 10 parallel queries, cached after |

**Scalability limit**: ~100 concurrent runs per server (memory: 500KB/run, DB: checkpoint writes).

---

## 12. Top 20 Improvements (Prioritized)

### Quick Wins (1-2 days)
1. Fix ambush ability trigger (C5) -- 2 hours
2. Add rate limiting to dungeon endpoints (H1) -- 1 hour
3. Validate agent_id in combat/scout (H3) -- 30 minutes
4. Add Dockerfile HEALTHCHECK + non-root user (H9, H10) -- 30 minutes
5. Add missing encounter_choices index (H5) -- 1 migration
6. Add FK ON DELETE RESTRICT (H4) -- 1 migration
7. Fix event log auth gap (H2) -- 30 minutes

### Mittelfristige Refactors (1-2 Wochen)
8. Add asyncio.Lock per instance for concurrency (C1) -- 2 days
9. Add idempotency guard on combat resolution (C3) -- 1 day
10. Handle checkpoint failures with dirty-flag (C4) -- 1 day
11. Delta checkpointing to reduce JSONB size (H6) -- 2 days
12. Extract DungeonEngineService into sub-services (H7) -- 3 days
13. Typed ArchetypeState union with Pydantic (M1) -- 1 day
14. Boss-specific AI action weights (M9) -- 1 day
15. Content cache cross-worker invalidation (M4) -- 1 day

### Langfristige Architektur (1-3 Monate)
16. Remove Python-side encounter definitions (H8) -- migrate fully to DB content
17. Redis-backed instance state for multi-worker (C2) -- if horizontal scaling needed
18. OpenTelemetry distributed tracing (L5, L6) -- observability
19. Load testing: 500 concurrent runs baseline -- performance
20. Migration rollback documentation (M12) -- operational maturity

---

## 13. Offene Fragen / Unsicherheiten

1. **Multi-worker deployment**: Is Railway deploying with >1 worker? If yes, C2 is actively breaking. If single-worker, it's a scaling risk only.
2. **Checkpoint recovery frequency**: How often do server restarts happen in production? Determines urgency of C4.
3. **Content update frequency**: How often does admin update encounter content? Determines urgency of M4 (cache invalidation).
4. **Concurrent dungeon runs per simulation**: Current limit is 1 per archetype per simulation (DB unique constraint). Is multi-party planned?
5. **Combat round timing**: Is the 45s planning timeout appropriate? No telemetry on actual submission times.

---

## 14. Scorecard

| Dimension | Score (original) | Score (post-remediation) | Begründung |
|-----------|------------------|--------------------------|------------|
| **Architektur** | 7/10 | **9/10** | H7 resolved: 2,722-line god-class decomposed into 7 focused modules (max 749 lines). Facade pattern preserves public API. |
| **Security** | 8/10 | **9/10** | H1 rate limits, H2 event log auth, H3 agent validation, H9/H10 Docker hardening all resolved. |
| **Async-Korrektheit** | 5/10 | **8/10** | C1 per-instance locking, C3 idempotency guards, C4 dirty-flag checkpoint recovery all resolved. |
| **Datenmodell** | 8/10 | **9/10** | H4 FK ON DELETE RESTRICT, H5 encounter_choices index, M11 composite event index added. |
| **API-Design** | 8/10 | 8/10 | Unchanged. |
| **Frontend-Qualität** | 9/10 | 9/10 | Unchanged. |
| **Testbarkeit** | 7/10 | **8/10** | 2,195 tests passing (was 637 dungeon-only). Test suite 100% green for first time. |
| **Produktionsreife** | 6/10 | **8/10** | Rate limits, healthcheck, non-root container, concurrency guards all resolved. |
| **Wartbarkeit** | 6/10 | **8/10** | Engine decomposed into focused sub-services. Largest file: 749 lines (was 2,722). |
| **Skalierbarkeit** | 5/10 | 5/10 | In-memory state still limits to single worker. Delta checkpointing (H6) and Redis (C2) remain open. |

**Gesamtnote: 6.9/10 → 8.1/10** -- Concurrency-Schwächen behoben, God-Class aufgelöst, Security-Gaps geschlossen. Verbleibende Schulden: H6 (Delta Checkpointing), H8 (Python-Encounters → DB-only), C2 (Multi-Worker).

---

## 15. Management-Zusammenfassung

**Größte Risiken**:
- Race Conditions im Kampfsystem bei gleichzeitigen Requests (C1, C3)
- Multi-Worker-Deployment würde sofort zu Split-Brain führen (C2)
- Broken Ambush-Mechanik betrifft Gameplay-Qualität (C5)

**Wahrscheinlichste Produktionsprobleme**:
- Timer-Duplikate bei langsamen Netzwerken (C3)
- Checkpoint-Verlust bei DB-Flakes (C4)
- Fehlende Rate Limits ermöglichen Spam (H1)

**Empfohlene Reihenfolge**:
1. **Sofort**: C5 (Ambush fix), H1 (Rate Limits), H3 (Agent validation), H9/H10 (Docker)
2. **Diese Woche**: C1 (Locks), C3 (Idempotenz), C4 (Checkpoint recovery)
3. **Nächste 2 Wochen**: H6 (Delta checkpoint), H7 (Engine aufteilen), H5/H4 (DB indexes/FKs)
4. **Nächste 1-3 Monate**: H8 (Content aus Python entfernen), C2 (Redis wenn Skalierung nötig)

---

## 16. Remediation Status (2026-04-01)

### DONE
| # | Finding | Fix |
|---|---------|-----|
| C1 | Global mutable state race | `InstanceStore` class + per-instance `asyncio.Lock` on all mutation endpoints |
| C3 | Timer double-resolve | Lock + phase-check idempotency guard; timer callback acquires lock before resolving |
| C4 | Checkpoint failure divergence | Dirty-flag on failure, re-checkpoint enforced in `_get_instance`, eviction on re-fail |
| C5 | Ambush ability never triggers | `round_num` passed to `_resolve_agent_damage`; degradation to half power outside round 1 / darkness |
| H1 | No rate limiting | `@limiter.limit(RATE_LIMIT_STANDARD)` on all 9 mutation endpoints |
| H2 | Event log auth gap | Participant check via `party_player_ids` before serving events; 403 for non-participants |
| H3 | Agent ID unvalidated in combat | `party_agent_ids` membership check before processing submitted combat actions |
| H4 | Missing FK ON DELETE | Migration 172: `ON DELETE RESTRICT` on `encounter_templates.combat_encounter_id` |
| H5 | Missing encounter_choices index | Migration 172: `idx_encounter_choices_encounter_id` |
| H9 | Container runs as root | `useradd appuser` + `USER appuser` in Dockerfile Stage 3 |
| H10 | No HEALTHCHECK | `HEALTHCHECK CMD curl -f http://localhost:${PORT:-8000}/health` |
| M11 | Missing event composite index | Migration 172: `idx_dungeon_events_sim_created` |
| H7 | God-Class DungeonEngineService | Decomposed 2,722-line god-class into 7 focused modules: `DungeonMovementService` (749), `DungeonCombatService` (539), `DungeonDistributionService` (484), `DungeonCheckpointService` (437), `InstanceStore` (177), `dungeon_shared` (133). Engine facade: 606 lines. Zero router changes (Facade pattern). |

### TODO
| # | Finding | Aufwand | Beschreibung |
|---|---------|---------|--------------|
| H6 | Checkpoint serialization overhead | ~2 Tage | Delta checkpointing: serialize only changed fields instead of full 50-150KB JSONB per transition |
| H8 | God-File dungeon_encounters.py | ~1 Woche | Remove Python-side encounter definitions, load exclusively from DB content tables (migration 170/171 already seeded) |
| C2 | Multi-worker split-brain | Bei Bedarf | Only relevant if Railway deploys with >1 worker. Currently single-worker. Fix: Redis-backed state or enforce `--workers 1` explicitly |

---

## 17. Visual / UX Audit (2026-04-01, WebMCP 1920×1080)

### Critical Contrast Issue: Simulation Theme Bleeds Into Dungeon HUD

**Root cause**: Simulations with light themes (e.g. Velgarien's brutalist preset) override `--color-surface` to `#ffffff`. The Dungeon HUD components (Header, Map, Party Panel, Quick Actions) inherit this via `terminalComponentTokens` → `--hud-bg` → `--_screen-bg`. Result: amber elements (#f59e0b) rendered on white background — ~1.8:1 contrast ratio, far below WCAG AA 4.5:1. The Terminal itself is unaffected because `BureauTerminal` hardcodes `--_screen-bg: #0a0a08`.

**Fix applied**: `DungeonTerminalView.ts` `:host` now forces platform-dark tokens (`--color-surface: #0a0a0a`, `--color-text-primary: #e5e5e5`, etc.) regardless of simulation theme. All child components inherit the dark tokens via CSS cascade.

### Findings

| # | Area | Issue | Severity | Status |
|---|------|-------|----------|--------|
| F3 | Header | Amber badge/text on white (~1.8:1) | CRITICAL | FIXED (dark override) |
| F4 | Header | Grey counters ("D0/5", "1 visited") on white | HIGH | FIXED (dark override) |
| F5 | Party | Agent names amber on white | CRITICAL | FIXED (dark override) |
| F6 | Party | Aptitude codes barely readable | HIGH | FIXED (dark override) |
| F7 | Party | COND/STR/MOOD labels 8px + low contrast | HIGH | FIXED (dark override) |
| F8 | Party | "Operational"/"0%"/"0" near-invisible | CRITICAL | FIXED (dark override) |
| F9 | Map | Entrance node icon invisible | CRITICAL | FIXED (dark override) |
| F10 | Map | Depth separator lines invisible | MEDIUM | FIXED (dark override) |
| F12 | Map | Cleared node opacity 0.4 too aggressive | HIGH | FIXED (0.4 → 0.65) |
| F14 | Actions | Button text amber on white | HIGH | FIXED (dark override) |
| F15 | Console | 404 on state endpoint after page reload | LOW | Open (race condition in run recovery) |

### What Passed

- Terminal: excellent contrast (hardcoded dark) ✓
- Map click → Room Panel → "Move Here" flow ✓
- Room movement → Header/Map/Party all update correctly ✓
- Combat auto-resolve, Victory banner, Loot display ✓
- Quick Actions context-switch (Lobby → Dungeon → Post-Combat) ✓
- Sim-Nav tabs: all 13 visible, active state correct ✓
