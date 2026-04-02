---
title: "Resonance Dungeons — Full Technical Specification"
version: "1.6"
date: "2026-04-02"
type: concept
status: 7-archetypes-live-awakening-implemented
lang: en
tags: [game-design, mud, dungeon, resonance, architecture, combat, procedural-generation, supabase, realtime]
---

# Resonance Dungeons — Full Technical Specification

> Perspectives: Senior Web Application Architect (FastAPI + Supabase + Lit), Senior Game Designer / MUD Specialist
>
> Research basis: Slay the Spire map generation, Hades room selection, FTL sector topology, Evennia lazy room generation, Darkest Dungeon stress/affliction, Disco Elysium skill checks, Caves of Qud procedural narrative, Supabase Realtime benchmarks

---

## REVIEW SUMMARY (2026-03-27)

**Reviewer:** Claude Opus 4.6 — Senior Web Application Architect + Senior Game Designer
**Methodology:** Full codebase cross-reference (migrations, services, frontend), web research (Supabase limits, StS algorithm, FastAPI state patterns), game design analysis (Darkest Dungeon, StS, Into the Breach, FTL comparisons)

| Severity | Count | Key Items |
|---|---|---|
| **CRITICAL** | 1 | #1 In-memory state SPOF |
| **HIGH** | 10 | #2 RLS public-first, #3 missing services, #4 column mismatch, #7 visibility math, #10 condition lethality, #11 stress death spiral, #14 War Room sequencing, #18 rest room bug, #20 aptitude stacking, #23 i18n roadmap |
| **MEDIUM** | 12 | #5 activity enum, #6 checkpoint strategy, #8 exit room undefined, #12 no combat healing, #13 boss alt paths, #15 frontend recovery, #16 multiplayer RLS, #17 checkpoint size, #19 graph simplicity, #21 banter pool, #22 MP friction, #24 resonance gating |
| **LOW** | 1 | #9 distribution weights |

**Architektur-Entscheidungen (beschlossen 2026-03-27):**
1. **Sequenzierung:** Dungeon Shadow MVP zuerst, aber Combat Engine von Tag 1 als Shared Module (`backend/services/combat/`). War Room Ops nutzt dieses Modul später direkt.
2. **State Architecture:** In-Memory + Event-basierter Checkpoint (nach jeder State-Transition). Redis als dokumentierter Scaling-Pfad, nicht für MVP.
3. **i18n:** Deutsche Übersetzungen parallel mit Claude 4.6 Opus beim Content-Authoring.

**Implementierungshinweis:** Bei der Implementierung dieses Features IMMER mit maximalem Thinking-Aufwand (ultrathink/extended thinking) arbeiten. Das ist das wichtigste Feature des Projekts — keine Abkürzungen, keine oberflächlichen Entscheidungen. Jede Architekturentscheidung, jede Formel, jedes Pattern gegen die bestehende Codebase validieren. 4-Perspektiven-Analyse (Architect, Game Designer, UX, Research) bei jedem nicht-trivialen Schritt.

**Gesamtbewertung:** Das Dokument ist beeindruckend durchdacht — die Archetype-Mechaniken sind kreativ und thematisch stark, die Integration mit bestehenden Systemen (Resonances, Aptitudes, Personality) ist elegant, und der Terminal-Aesthetic-Fokus ist genau richtig. Die Hauptrisiken liegen in (a) der In-Memory-Architektur, (b) der numerischen Balance (Stress/Condition/Visibility sind alle zu punitiv), und (c) der Sequenzierung mit War Room Ops. Alle Findings sind lösbar — nichts erfordert einen fundamentalen Redesign.

---

## IMPLEMENTATION STATUS (2026-04-01)

**Phase 0-2 Full Stack: COMPLETE — 5 Archetypes, Content DB (10 tables), Admin Global Config + Clearance Control, 755+ Tests**

### Implementierte Artefakte

| Artefakt | Dateien | Zeilen |
|----------|---------|--------|
| Migration 163: Tabellen + Basis-RPCs | `supabase/migrations/20260327100000_163_resonance_dungeons.sql` | ~280 |
| Migration 164: Atomare RPCs + VIEW | `supabase/migrations/20260327200000_164_resonance_dungeon_rpcs.sql` | ~600 |
| Shared Combat Models | `backend/models/combat.py` | ~85 |
| Dungeon Models | `backend/models/resonance_dungeon.py` | ~560 |
| Combat Engine (shared) | `backend/services/combat/combat_engine.py` | ~650 |
| Skill Checks (shared, §4.2) | `backend/services/combat/skill_checks.py` | ~275 |
| Condition Tracks | `backend/services/combat/condition_tracks.py` | ~110 |
| Stress System | `backend/services/combat/stress_system.py` | ~115 |
| Ability Schools (6 Schulen) | `backend/services/combat/ability_schools.py` | ~345 |
| Dungeon Engine Service | `backend/services/dungeon_engine_service.py` | ~2170 |
| Dungeon Submodule (7 Dateien) | `backend/services/dungeon/*.py` | ~840 |
| Router (12 Endpoints) | `backend/routers/resonance_dungeons.py` | ~310 |

### Architektur-Entscheidungen (implementiert)

1. **Shared Combat Module** (`backend/models/combat.py` + `backend/services/combat/`): Dungeon-agnostisch. War Room Ops importiert direkt. Typen (`Condition`, `AgentCombatState`, `EnemyInstance`) leben in `models/combat.py`.
2. **Event-basierter Checkpoint**: Nach jeder State-Transition (Raum-Wechsel, Kampf-Phase, Encounter). Kein Timer-basierter Checkpoint.
3. **Atomare RPCs** (ADR-007): `fn_complete_dungeon_run`, `fn_abandon_dungeon_run`, `fn_wipe_dungeon_run` — jeweils Status + Outcome + Agent-Effekte + Event in einer Transaktion.
4. **CAS für Aptitude-Cap** (Review #20): `pg_advisory_xact_lock` + COUNT-Check in `fn_apply_dungeon_loot`. Maximum +2 per Agent.
5. **Skill-Check-Formel** (§4.2): `effective_roll = raw_roll + (check_value - 55)`, Bänder bei 30/70. Check Value beeinflusst tatsächlich das Ergebnis (nicht nur informativ).
6. **Buff-Pipeline**: `has_buff()`, `_apply_buff()`, `_consume_buff()` — One-Shot Shield, defensive Removal.
7. **Archetype Strategy Pattern** (`archetype_strategies.py`): ABC mit 7 Methoden (4 abstract + 3 optional hooks). `ShadowStrategy` + `TowerStrategy`. Dict-Registry, O(1) Lookup. Archetype N = 1 Subklasse + 1 Registry-Eintrag, 0 Engine-Änderungen. Ersetzt if/elif-Dispatch in 7 Stellen.
8. **Structured Logging** (stdlib `extra={}`): 21 Log-Calls mit `_log_extra(instance, **kwargs)` Helper. Felder: `run_id`, `sim_id`, `archetype`, `difficulty` + kontextspezifische kwargs (`outcome`, `phase`, `depth`, etc.). Production: JSON via `structlog.ExtraAdder` + `JSONRenderer`. Kein structlog-Import in Engine — rein stdlib `extra={}`.
9. **Instance TTL Cleanup** (`start_instance_cleanup()`): 60s Sweep-Loop in FastAPI Lifespan. Dual-Cleanup: In-Memory-Eviction (`_instance_last_activity` via `time.monotonic()`) + DB-RPC `fn_expire_abandoned_dungeon_runs`. Cancelt Combat- und Distribution-Timer bei Eviction.

### Admin Configuration (2026-04-01)

#### Global Dungeon Config (`PlatformSettingsService`)

Platform-level settings that cascade to all simulations unless a per-simulation override is set. Stored in `platform_settings` as 4 keys:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `dungeon_global_mode` | `off\|supplement\|override` | `off` | Global archetype override mode |
| `dungeon_global_archetypes` | JSON string array | `[]` | Archetypes to unlock globally |
| `dungeon_clearance_mode` | `off\|standard\|custom` | `standard` | Terminal clearance requirement |
| `dungeon_clearance_threshold` | int (0-100) | `10` | Command count for Tier 2 (custom mode) |

**Cascade order** (per-sim wins): Per-Simulation Override > Global Config > Resonance Default.

**Clearance modes:**
- `off`: All dungeon commands bypass the tier check entirely.
- `standard`: Tier 2 after 10 executed commands (default `CLEARANCE_THRESHOLDS`). Affects general tier progression (fortify, quarantine, etc.).
- `custom`: Tier 2 requirement checked per-command-count only for dungeon verbs. Does NOT alter general tier progression.

**Endpoints:**
- `GET /api/v1/admin/dungeon-config/global` — admin only, returns full config
- `PUT /api/v1/admin/dungeon-config/global` — admin only, batch upserts 4 keys atomically
- `GET /api/v1/public/dungeons/clearance-config` — public, returns clearance subset only

**Frontend:** `AdminDungeonsTab.ts` with Global Config Card (corner brackets, segmented controls) + Per-Simulation Override Grid (provenance badges: "Local Override" / "Inherited" / "Resonance Only").

#### All 8 Archetypes

| Archetype | Signature | Status |
|-----------|-----------|--------|
| The Shadow | `conflict_wave` | Implemented |
| The Tower | `economic_tremor` | Implemented |
| The Entropy | `decay_bloom` | Implemented |
| The Devouring Mother | `biological_tide` | Implemented |
| The Prometheus | `innovation_spark` | Implemented |
| The Deluge | `elemental_surge` | Implemented (core + 5 follow-ups) |
| The Overthrow | `authority_fracture` | Config only |
| The Awakening | `consciousness_drift` | Implemented |

### Review Findings — Auflösungsstatus

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| #1 | CRITICAL | In-Memory SPOF | ✅ Event-Checkpoint nach jeder Transition |
| #2 | HIGH | RLS Public-First | ✅ Completed/abandoned/wiped öffentlich lesbar |
| #5 | MEDIUM | Activity Enum | ✅ `explore` + `dungeon_exploration` Subtype |
| #7 | HIGH | Visibility Math | ✅ -1 VP per 2 Räume, Start bei 3, VP 0 = 40% Ambush |
| #10 | HIGH | Condition Lethality | ✅ Max 2 Steps/Hit Cap |
| #11 | HIGH | Stress Death Spiral | ✅ Halved ambient + 40% Virtue + 150 Cap/Runde |
| #16 | MEDIUM | Multiplayer RLS | ✅ admin_supabase für alle Mutationen |
| #17 | MEDIUM | Checkpoint Size | ✅ Nur mutable State (nicht Graph) |
| #18 | HIGH | Rest Room Bug | ✅ Per-Layer Garantie |
| #20 | HIGH | Aptitude Stacking | ✅ CAS mit Advisory Lock, +2 Cap enforced |

### Implementation Gotchas (discovered during test suite, 2026-03-27)

These are not bugs but subtle behaviors worth knowing when extending the system:

1. **Personality modifier default 0.5**: `_calculate_personality_modifier` in `skill_checks.py` defaults missing Big Five traits to 0.5. For "courage" checks, this means empty personality dicts always trigger the neuroticism penalty (-10%). Pass explicit personality traits or accept the penalty.

2. **Pydantic model_dump() preserves UUID**: `AgentCombatState.model_dump()` returns `{"agent_id": UUID(...)}`, not a string. When comparing snapshot dicts from combat results, compare against UUID objects directly.

3. **random.seed() global side-effect**: `generate_dungeon_graph(seed=X)` calls `random.seed(X)` on the global RNG. All subsequent `random.*` calls in the same process become deterministic until re-seeded. Avoid relying on randomness after a seeded graph generation without re-seeding.

4. **Condition damage cap lives in condition_tracks, not combat_engine**: `_calculate_attack_damage` in `combat_engine.py` can return > 2 damage steps (e.g., power 9 + vulnerability = 3). The 2-step cap (Review #10) is enforced in `apply_condition_damage()` in `condition_tracks.py`. Any code path that bypasses `apply_condition_damage` will not have the cap.

5. **Per-round stress cap only inside resolve_combat_round**: The 150 stress/round cap is tracked via a local `round_stress` dict inside `resolve_combat_round()`. Direct calls to `apply_stress()` outside the combat engine do NOT enforce this cap. The `cap_per_round` parameter on `apply_stress` caps the single delta, not cumulative stress from multiple sources.

### Full Implementation Timeline (2026-03-27 → 2026-03-28)

1. ~~**Unit Tests**: combat_engine, skill_checks, dungeon_generator~~ **DONE — 576 tests, 8 files (2026-03-27)**
2. ~~**Integration Tests**: DungeonEngineService + Router endpoints~~ **DONE — 179 tests, 3 files (2026-03-27)**
3. ~~**Frontend Phase 1+2**: DungeonStateManager, DungeonApiService, Terminal Commands, Formatters~~ **DONE (2026-03-27)**
4. ~~**Frontend Phase 3**: DungeonTerminalView, DungeonHeader, DungeonQuickActions, Route, Icons~~ **DONE (2026-03-27)**
5. ~~**Frontend Phase 4**: DungeonPartyPanel, DungeonMap (SVG DAG, fog-of-war, click-to-move)~~ **DONE (2026-03-27)**
6. ~~**Frontend Phase 5**: DungeonCombatBar, DungeonEnemyPanel, event forwarding fix~~ **DONE (2026-03-27)**
7. ~~**Browser Playtest 1**: 18 UX issues found, Phase 1-2 backend fixes applied~~ **DONE (2026-03-28)**
8. ~~**Browser Playtest 2**: Combat deep dive, 12 issues found + Combat Engine Phase 1 (14/17 abilities)~~ **DONE (2026-03-28)**
9. ~~**Frontend Phase 6**: Encounters, Events, 6 completion gaps fixed~~ **DONE (2026-03-28)**
10. ~~**Frontend Phase 7-8**: Loot provenance UI, loot distribution debrief terminal, refactors~~ **DONE (2026-03-28)**
11. ~~**E2E Test**: Full dungeon run (Entrance→Combat→Encounter→Rest→Combat→Boss→Complete)~~ **DONE (2026-03-28)**

**Total: 755+ tests, 13 new frontend files (~4,500 lines), 20+ backend files (~4,500 lines), 2 migrations (~880 lines)**

### Remaining Work (The Shadow)

1. **3/17 Abilities**: Counter-Intelligence (needs intent cancellation system), Ambush Strike (round_num scope), 1 unidentified
2. **Phase 3-6 UX Polish**: Terminal window sizing, Sentry captureError gaps (7+1+router), boot message hardcode, hero.avif preload
3. **Content-Review**: Deutsche Texte Feinschliff
4. **Realtime**: Supabase Broadcast for multiplayer state sync (deferred — single-player works fully)

### Next Archetype

5. **Phase 1: The Tower** — stability countdown mechanic, Tower encounter templates, Tower loot pools

---

## 1. Executive Summary

When a simulation's Substrate Resonance magnitude crosses a critical threshold, a **Resonance Dungeon** opens — a procedurally generated, archetypally themed instance that players explore with a party of their agents through the Bureau Terminal. Each of the 8 Substrate Archetypes produces a fundamentally different dungeon with unique mechanics, encounters, and rewards.

**Key design decisions:**
- **Phase-based combat** (45s planning → simultaneous resolution), not real-time
- **FTL-style node graph** topology (branching paths, typed nodes, visible rewards)
- **Condition tracks** instead of HP (Operational → Stressed → Wounded → Afflicted)
- **3-tier skill checks** (Success / Partial / Fail) using existing Aptitudes + Personality
- **Zero handcrafted rooms** — all content generated from templates + simulation data
- **Supabase Broadcast** for multiplayer state sync (existing pattern, no new WebSocket)
- **In-memory dungeon state** on FastAPI, PostgreSQL for persistence only

**Implementation plan:** Design all 8, build **The Shadow** first (simplest mechanics, strongest atmosphere, best showcase for the terminal aesthetic).

---

## 2. System Architecture

### 2.1 Where It Lives in the Stack

> **[REVIEW #1 — CRITICAL]** In-Memory State Single Point of Failure
>
> The architecture places all active dungeon state in a module-level Python dict (`_active_instances`). This is a **critical reliability risk**:
>
> - **Worker restarts:** Railway deployment uses gunicorn, which restarts workers on crashes, OOM, deployments, and after `max_requests`. ALL in-memory state is lost instantly.
> - **Checkpoint gap:** 120s checkpoint interval means up to 2 minutes of gameplay (multiple room transitions, full combat encounters) can be lost silently.
> - **No multi-worker path:** The spec acknowledges "single-worker only" but the production backend already runs with workers. Scaling to 2+ workers makes in-memory state impossible without external coordination.
> - **asyncio race conditions:** Multiple concurrent HTTP requests to the same dungeon instance (e.g., two players submitting combat actions simultaneously) will race on the shared dict without locks.
>
> **Evidenz:** FastAPI docs explicitly warn: "each worker gets its own process and its own instance of the application — local state is not shared across workers." Railway deploys trigger full worker replacement.
>
> **Empfehlung:** Use Redis (already available via Railway) as primary state store instead of in-memory dict. Keep a thin in-memory cache with TTL for hot-path reads, but make Redis the source of truth. This also enables multi-worker scaling for free. Alternative: if Redis is too complex for MVP, at minimum checkpoint on EVERY state transition (room change, combat phase change), not on timer — and add a recovery handshake on frontend reconnect.

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Lit + Preact Signals)                             │
│                                                             │
│ ┌─────────────────┐  ┌──────────────────┐                  │
│ │ DungeonTerminal  │  │ DungeonStateManager│                │
│ │ View.ts          │  │ .ts (Singleton)    │                │
│ │ (extends         │  │ - dungeonId        │                │
│ │  BureauTerminal  │  │ - currentRoomId    │                │
│ │  wrapper pattern)│  │ - partyState       │                │
│ └────────┬─────── ┘  │ - roomGraph        │                │
│          │            │ - combatState      │                │
│          │            └────────┬───────────┘                │
│          │                     │                            │
│  ┌───────▼─────────────────────▼──────────┐                │
│  │ DungeonApiService.ts (extends Base)     │                │
│  │ + RealtimeService combat/dungeon channels│               │
│  └───────┬────────────────────────────────┘                │
└──────────┼──────────────────────────────────────────────────┘
           │ HTTP POST (actions) + Supabase Broadcast (state)
           │
┌──────────▼──────────────────────────────────────────────────┐
│ BACKEND (FastAPI)                                           │
│                                                             │
│ ┌──────────────────┐  ┌────────────────────────┐           │
│ │ routers/          │  │ services/               │           │
│ │ resonance_        │  │ dungeon_engine_         │           │
│ │ dungeons.py       │  │ service.py              │           │
│ │ (REST endpoints)  │  │ (orchestration)         │           │
│ └──────────────────┘  └───────┬────────────────┘           │
│                               │                             │
│ ┌─────────────────────────────▼───────────────────────┐    │
│ │ services/dungeon/                                    │    │
│ │ ├── dungeon_generator.py    (room graph generation)  │    │
│ │ ├── dungeon_combat.py       (combat resolution)     │    │
│ │ ├── dungeon_encounters.py   (encounter templates)   │    │
│ │ ├── dungeon_loot.py         (reward calculation)    │    │
│ │ ├── dungeon_archetypes.py   (8 archetype configs)   │    │
│ │ └── archetype_strategies.py (Strategy Pattern ABC)  │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌──────────────────────────────────────────┐               │
│ │ DungeonInstanceManager (module-level)     │               │
│ │ - active_instances: dict[str, DungeonInstance]            │
│ │ - In-memory state, NOT in database        │               │
│ │ - Periodic checkpoint to PostgreSQL       │               │
│ └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
           │
           │ Persistence only (start, checkpoint, end)
           ▼
┌─────────────────────────────────────────────────────────────┐
│ POSTGRESQL (Supabase)                                       │
│                                                             │
│ resonance_dungeon_runs     (run metadata, outcome)          │
│ resonance_dungeon_events   (combat log, discoveries)        │
│ + existing: agent_mood, agent_stress, agent_moodlets,       │
│   agent_opinions, agent_activities, agent_memories          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Database Schema

#### Table: `resonance_dungeon_runs`

```sql
CREATE TABLE resonance_dungeon_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id       UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    resonance_id        UUID REFERENCES substrate_resonances(id) ON DELETE SET NULL,
    archetype           TEXT NOT NULL,  -- 'The Shadow', 'The Tower', etc.
    resonance_signature TEXT NOT NULL,  -- 'conflict_wave', 'economic_tremor', etc.

    -- Party
    party_agent_ids     UUID[] NOT NULL,  -- 2-4 agent UUIDs
    party_player_ids    UUID[] NOT NULL DEFAULT '{}',  -- multiplayer: user UUIDs

    -- Configuration
    difficulty          INT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    depth_target        INT NOT NULL DEFAULT 5,  -- planned number of floors
    config              JSONB NOT NULL DEFAULT '{}',  -- archetype-specific params

    -- Progress
    current_depth       INT NOT NULL DEFAULT 0,
    rooms_cleared       INT NOT NULL DEFAULT 0,
    rooms_total         INT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                            'active', 'combat', 'exploring',
                            'completed', 'abandoned', 'wiped'
                        )),

    -- Checkpoint (serialized in-memory state for crash recovery)
    checkpoint_state    JSONB,
    checkpoint_at       TIMESTAMPTZ,

    -- Outcome
    outcome             JSONB,  -- loot, agent state changes, score
    completed_at        TIMESTAMPTZ,

    -- Metadata
    started_by_id       UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dungeon_runs_sim ON resonance_dungeon_runs(simulation_id);
CREATE INDEX idx_dungeon_runs_status ON resonance_dungeon_runs(status)
    WHERE status IN ('active', 'combat', 'exploring');
CREATE INDEX idx_dungeon_runs_archetype ON resonance_dungeon_runs(archetype);

-- RLS: simulation members can read their own runs
--
-- [REVIEW #2 — HIGH] RLS Violates Public-First Architecture
-- CLAUDE.md mandates: "All simulation data is publicly readable" and
-- "Browsing must never produce 403 errors." These SELECT policies require
-- simulation_members membership, which means anonymous/non-member users
-- cannot view completed dungeon runs. Compare: heartbeat_entries and
-- narrative_arcs are publicly readable (no membership check on SELECT).
--
-- Empfehlung: Add a public SELECT policy for completed/abandoned/wiped runs
-- (like heartbeat_entries), keep membership-gated SELECT only for active runs
-- (to prevent snooping on in-progress dungeons). Pattern:
--   CREATE POLICY dungeon_runs_public_read ON resonance_dungeon_runs
--     FOR SELECT USING (status IN ('completed', 'abandoned', 'wiped'));
--   CREATE POLICY dungeon_runs_member_read ON resonance_dungeon_runs
--     FOR SELECT USING (status IN ('active', 'combat', 'exploring') AND ...membership check...);
--
ALTER TABLE resonance_dungeon_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dungeon_runs_select ON resonance_dungeon_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = resonance_dungeon_runs.simulation_id
            AND sm.user_id = auth.uid()
        )
    );

CREATE POLICY dungeon_runs_insert ON resonance_dungeon_runs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = resonance_dungeon_runs.simulation_id
            AND sm.user_id = auth.uid()
            AND sm.member_role IN ('admin', 'owner', 'editor')
        )
    );

CREATE POLICY dungeon_runs_update ON resonance_dungeon_runs
    FOR UPDATE USING (
        started_by_id = auth.uid()
    );
```

#### Table: `resonance_dungeon_events`

```sql
CREATE TABLE resonance_dungeon_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES resonance_dungeon_runs(id) ON DELETE CASCADE,
    depth           INT NOT NULL,
    room_index      INT NOT NULL,

    event_type      TEXT NOT NULL CHECK (event_type IN (
        'room_entered', 'combat_started', 'combat_resolved',
        'skill_check', 'encounter_choice', 'loot_found',
        'agent_stressed', 'agent_afflicted', 'agent_virtue',
        'agent_wounded', 'party_wipe', 'boss_defeated',
        'dungeon_completed', 'dungeon_abandoned',
        'banter', 'discovery'
    )),

    -- Narrative
    narrative_en    TEXT,
    narrative_de    TEXT,

    -- Mechanical outcome
    outcome         JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dungeon_events_run ON resonance_dungeon_events(run_id, created_at);

ALTER TABLE resonance_dungeon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY dungeon_events_select ON resonance_dungeon_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM resonance_dungeon_runs r
            JOIN simulation_members sm ON sm.simulation_id = r.simulation_id
            WHERE r.id = resonance_dungeon_events.run_id
            AND sm.user_id = auth.uid()
        )
    );
```

### 2.3 Backend Models (Pydantic)

```python
# backend/models/resonance_dungeon.py

from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field

# ── Enums ──────────────────────────────────────────

DungeonStatus = Literal[
    "active", "combat", "exploring",
    "completed", "abandoned", "wiped"
]

DungeonEventType = Literal[
    "room_entered", "combat_started", "combat_resolved",
    "skill_check", "encounter_choice", "loot_found",
    "agent_stressed", "agent_afflicted", "agent_virtue",
    "agent_wounded", "party_wipe", "boss_defeated",
    "dungeon_completed", "dungeon_abandoned",
    "banter", "discovery"
]

RoomType = Literal[
    "combat", "elite", "encounter", "treasure",
    "rest", "boss", "entrance", "exit", "threshold"
]

ArchetypeName = Literal[
    "The Tower", "The Shadow", "The Devouring Mother",
    "The Deluge", "The Overthrow", "The Prometheus",
    "The Awakening", "The Entropy"
]

# ── Create / Response ──────────────────────────────

class DungeonRunCreate(BaseModel):
    """Start a new dungeon run."""
    archetype: ArchetypeName
    party_agent_ids: list[UUID] = Field(..., min_length=2, max_length=4)
    difficulty: int = Field(1, ge=1, le=5)

class DungeonRunResponse(BaseModel):
    """Full dungeon run record."""
    id: UUID
    simulation_id: UUID
    resonance_id: UUID | None = None
    archetype: str
    resonance_signature: str
    party_agent_ids: list[UUID]
    party_player_ids: list[UUID]
    difficulty: int
    depth_target: int
    current_depth: int
    rooms_cleared: int
    rooms_total: int
    status: str
    outcome: dict | None = None
    completed_at: datetime | None = None
    created_at: datetime

class DungeonEventResponse(BaseModel):
    """Single dungeon event."""
    id: UUID
    run_id: UUID
    depth: int
    room_index: int
    event_type: str
    narrative_en: str | None = None
    narrative_de: str | None = None
    outcome: dict
    created_at: datetime

# ── In-Memory State (NOT persisted as-is) ──────────

class RoomNode(BaseModel):
    """Single room in the dungeon graph."""
    index: int
    depth: int
    room_type: RoomType
    connections: list[int]  # indices of connected rooms
    cleared: bool = False
    revealed: bool = False
    encounter_template: str | None = None  # template ID for this room
    loot_tier: int = 0  # 0=none, 1=minor, 2=major, 3=legendary

class AgentCombatState(BaseModel):
    """Agent's state during a dungeon run."""
    agent_id: UUID
    agent_name: str
    condition: Literal["operational", "stressed", "wounded", "afflicted", "captured"] = "operational"
    stress: int = 0  # mirrors agent_mood.stress_level
    mood: int = 0  # mirrors agent_mood.mood_score
    active_buffs: list[str] = []
    active_debuffs: list[str] = []
    aptitudes: dict[str, int] = {}  # spy: 8, guardian: 3, etc.
    personality: dict[str, float] = {}  # openness: 0.7, etc.

class DungeonInstance(BaseModel):
    """Full in-memory state of an active dungeon run."""
    run_id: UUID
    simulation_id: UUID
    archetype: ArchetypeName
    signature: str
    difficulty: int

    # Graph
    rooms: list[RoomNode]
    current_room: int = 0  # index into rooms

    # Party
    party: list[AgentCombatState]

    # Archetype-specific state
    archetype_state: dict = {}  # e.g., Shadow: {"visibility": 1}, Tower: {"stability_points": 100}

    # Progress
    depth: int = 0
    rooms_cleared: int = 0
    turn: int = 0
```

### 2.4 Dungeon Graph Generation (FTL/Slay the Spire Hybrid)

The dungeon is a **directed acyclic graph** (DAG) of typed rooms, visualized as an ASCII map in the terminal.

```
DEPTH 0:  [ENTRANCE]
              │
DEPTH 1:  [COMBAT]──[COMBAT]
            │    ╲      │
DEPTH 2:  [EVENT] [ELITE]
            │       │
DEPTH 3:  [REST]──[TREASURE]
              │
DEPTH 4:  [COMBAT]──[COMBAT]
            │    ╲      │
DEPTH 5:     [BOSS]
```

**Generation algorithm** (per archetype config):

```python
# backend/services/dungeon/dungeon_generator.py

def generate_dungeon_graph(
    archetype: str,
    difficulty: int,
    depth: int,
    simulation_susceptibility: float,
) -> list[RoomNode]:
    """Generate FTL-style node graph for a resonance dungeon.

    Algorithm (Slay the Spire inspired):
    1. Create `depth` layers of 1-3 rooms each
    2. Connect rooms: each room connects to 1-2 rooms in the next layer
    3. Ensure all rooms are reachable from entrance
    4. Assign room types per archetype distribution table
    5. Place boss at final depth
    """
    config = ARCHETYPE_CONFIGS[archetype]
    rooms: list[RoomNode] = []
    room_index = 0

    # Layer 0: Entrance
    entrance = RoomNode(index=0, depth=0, room_type="entrance", connections=[], revealed=True)
    rooms.append(entrance)
    room_index = 1

    # Layers 1 to depth-1: Content rooms
    prev_layer_indices = [0]
    for d in range(1, depth):
        # Width: 1-3 rooms per layer, more at middle depths
        width = _layer_width(d, depth, difficulty)
        layer_indices = []

        for w in range(width):
            room_type = _pick_room_type(d, depth, config, difficulty)
            room = RoomNode(
                index=room_index, depth=d, room_type=room_type,
                connections=[], loot_tier=_loot_tier(room_type, d, difficulty),
            )
            rooms.append(room)
            layer_indices.append(room_index)
            room_index += 1

        # Connect previous layer to this layer
        _connect_layers(rooms, prev_layer_indices, layer_indices)
        prev_layer_indices = layer_indices

    # Final layer: Boss
    boss = RoomNode(
        index=room_index, depth=depth, room_type="boss",
        connections=[], loot_tier=3,
    )
    rooms.append(boss)
    for idx in prev_layer_indices:
        rooms[idx].connections.append(room_index)

    return rooms

# Room type distribution per archetype (Slay the Spire ratios, modified):
# combat=50%, encounter=20%, elite=10%, rest=10%, treasure=10%
# Archetype overrides shift these ratios
```

**Room type distribution (base, modified per archetype):**

| Room Type | Base % | The Shadow Override | Reason |
|---|---|---|---|
| Combat | 50% | 40% | More encounters, less pure combat |
| Encounter | 20% | 30% | Moral dilemmas, darkness puzzles |
| Elite | 10% | 10% | (unchanged) |
| Rest | 10% | 5% | Rest is scarce in darkness |
| Treasure | 10% | 15% | Rewards for bravery in the dark |

### 2.5 Realtime Architecture

**Channels (extending existing RealtimeService pattern):**

```typescript
// New channels:
`dungeon:${runId}:state`       // Broadcast: room transitions, phase changes
`dungeon:${runId}:combat`      // Broadcast: combat state, resolution narrative
`dungeon:${runId}:presence`    // Presence: who is in the dungeon
```

**Message flow (per room transition):**

```
Player: HTTP POST /api/v1/dungeons/{runId}/move {room_index: 3}
  → Backend validates, updates in-memory state
  → Backend broadcasts on dungeon:{runId}:state:
    { event: "room_entered", payload: { room: {...}, encounter: {...} } }
  → All connected clients update UI

Player: HTTP POST /api/v1/dungeons/{runId}/combat/action {agent_id, action}
  → Backend queues action in CombatHandler
  → When all players submitted (or timer expires):
    → Backend resolves simultaneously
    → Broadcasts on dungeon:{runId}:combat:
      { event: "combat_resolved", payload: { narrative, outcomes, new_state } }
```

**Capacity estimate:** Identical to War Room Ops analysis — ~20 msg/s for 50 concurrent dungeons. 4% of Supabase Pro plan capacity.

---

## 3. The 8 Resonance Dungeon Archetypes

### Design Principles (applied to all 8)

Each archetype defines:
1. **Core mechanic** — one unique rule that makes this dungeon feel different
2. **Atmosphere** — terminal aesthetic, prose style, ambient tension
3. **Encounter palette** — which encounter types dominate
4. **Aptitude emphasis** — which agent skills matter most
5. **Personality stress profile** — which Big Five traits are tested
6. **Unique resource** — an archetype-specific resource or constraint
7. **Boss design** — thematic boss encounter
8. **Loot table** — archetype-specific rewards

---

### 3.1 THE SHADOW (conflict_wave) — "Die Tiefe Nacht"

> *"The part of reality that knows how to hurt rises to the surface."*

**IMPLEMENTATION PRIORITY: FIRST. Simplest core mechanic, strongest terminal atmosphere, best showcase.**

#### Core Mechanic: VISIBILITY

Each room has a **visibility level** (0-3):
- **0 (Blind):** Only the current room described. No enemy preview. Ambush chance 40%. Stress multiplier +25%. Loot bonus +50% (Tier 1→Tier 2 upgrade chance).
- **1 (Dim):** Adjacent room types visible but not details. Ambush chance 15%.
- **2 (Clear):** Full room preview. Enemy intentions visible. No ambush.
- **3 (Illuminated):** Full preview + hidden items/passages revealed.

Visibility is a **consumable resource**. Party starts at visibility **3** (max 3). Each **2 rooms** entered costs 1 visibility. Multiple restoration sources: Spy "Observe" ability (+1 VP), rest site (+1 VP), treasure room (+1 VP), successful combat (+1 VP).

**Why this works:** Creates constant tension between moving forward (spending visibility) and gathering intelligence (restoring it). Spy agents are critical but not mandatory — multiple VP restoration sources prevent a death spiral for parties without a Spy. The terminal's amber-on-black aesthetic is perfect for darkness.

#### Atmosphere

```
You descend into absolute darkness. The terminal flickers.

The shadows here are not the absence of light — they are the presence
of something else. Your instruments read nothing. Agent Kovacs adjusts
his scanner, frowns. "I'm getting echoes. Old ones. Violence leaves
marks in places like this."

VISIBILITY: ██░░ [1/3]
```

Prose style: Terse. Military. Shadows described as predatory. Sound is amplified. Agents whisper.

#### Encounter Palette

| Type | % | Examples |
|---|---|---|
| Combat (Ambush) | 35% | "Echoes of Violence" — manifestations of past conflicts. Stronger if simulation has many high-impact events |
| Combat (Patrol) | 15% | "Shadow Sentinels" — predictable patrol routes, avoidable with Infiltrator |
| Encounter (Moral) | 20% | "The Prisoner" — a shadow entity begs for release. Free it (unknown consequence) or leave it? |
| Encounter (Puzzle) | 10% | "The Locked Memory" — a room that only opens when an agent confronts a specific memory (uses agent Memory system) |
| Rest (Fragile) | 5% | "Safe Haven" — rest here heals stress, but 20% chance of ambush during rest |
| Treasure | 10% | "Shadow Cache" — hidden loot, better at lower visibility (risk = reward) |
| Elite | 5% | "The Remnant" — a powerful shadow formed from the simulation's strongest unresolved conflict |

#### Aptitude Emphasis

| Aptitude | Role in Shadow Dungeon | Weight |
|---|---|---|
| **Spy** | Visibility restoration, ambush prevention, enemy detection | **Critical** |
| **Guardian** | Protecting party during ambushes, stress absorption | High |
| **Assassin** | Burst damage to eliminate threats before they escalate | High |
| **Infiltrator** | Bypassing encounters entirely, scouting ahead | Medium |
| **Saboteur** | Environmental traps, visibility manipulation | Medium |
| **Propagandist** | Stress management, morale recovery | Medium |

#### Personality Stress Profile

| Trait | Effect in Shadow |
|---|---|
| High Neuroticism | +25% stress gain from ambushes. But: unlocks "Hyper-Vigilance" passive (auto-detect traps in adjacent rooms) |
| Low Extraversion | -15% detection chance (quiet agent = harder to find). Natural stealth bonus |
| High Extraversion | +15% detection chance (loud agent). But: +20% to Propagandist abilities (rallying voice carries in the dark) |
| Low Agreeableness | Can make "ruthless" encounter choices (leave the prisoner, sacrifice the weak) without stress penalty |
| High Openness | Can perceive "hidden passages" that low-Openness agents miss |

#### Unique Resource: Visibility Points

> **[REVIEW #7 — HIGH]** Shadow Visibility Math Too Punishing — Death Spiral Risk
>
> The numbers don't add up for a fun experience:
>
> - Start at 2 VP, -1 per room entered. After 2 rooms → VP 0 (blind).
> - A 5-depth dungeon has minimum 5 rooms to traverse (entrance → boss).
> - At VP 0: 60% ambush chance + 50% stress amplification + no enemy preview.
> - Spy "Observe" restores 1 VP but costs an action in combat/exploration.
> - Rest sites restore 1 VP but are only 5% of rooms (0-1 per run).
>
> **Spielerische Konsequenz:** After room 2, the party is permanently blind unless they have a Spy agent AND use Observe every other room (forgoing other actions). This makes Spy not "critical" but **mandatory** — there's no viable party without one. Players who don't pick a Spy agent are punished with a near-guaranteed wipe.
>
> **Vergleich Darkest Dungeon:** Light in DD drains slowly (per step, not per room), and has multiple restoration sources (torches are cheap consumables, camp skills, quirks). The scarcity creates tension without making the resource feel impossible to manage.
>
> **Empfehlung:** Either (a) start at 3 VP and cost 1 per 2 rooms, or (b) add more VP restoration sources (e.g., treasure rooms +1 VP, successful combat +1 VP, all encounters have a "cautious" option that restores VP at cost of loot), or (c) reduce VP 0 penalties to 40% ambush / +25% stress (uncomfortable but survivable).

- Start: **3 VP** (of 3 max) *(Review #7: was 2)*
- Each **2 rooms** entered: -1 VP *(Review #7: was -1 per room)*
- Spy "Observe" ability: +1 VP
- Rest site: +1 VP
- Treasure room: +1 VP
- Successful combat: +1 VP
- Treasure found at VP 0: +50% loot bonus ("brave in the dark") — implemented as 50% chance Tier 1→Tier 2 upgrade
- VP 0: Ambush chance **40%** *(was 60%)*, no enemy preview, agents gain stress faster (**+25%**, *was +50%*)
- VP 1: Ambush chance **15%** *(balanced during implementation from 30%)*

#### Boss: "The Unresolved"

A manifestation of the simulation's highest-impact unresolved event (pulled from real `events` table where `impact_level >= 7` and `event_status != 'resolved'`).

**Phase 1: Recognition** — The boss takes the form of a distorted version of an agent involved in the event. Party must identify which event it represents (Spy skill check). Success reveals the boss's weakness pattern.

**Phase 2: Confrontation** — Standard combat with the boss using abilities themed around the original event. If the event was military, the boss uses combat abilities. If social, it uses propaganda/manipulation.

**Phase 3: Resolution** — The boss can be defeated through combat (Assassin/Guardian), or through psychological confrontation (Propagandist convinces it to dissipate, requires agent who was involved in the original event in the party). The psychological path is faster but requires specific party composition.

**Loot:**
- **Shadow Attunement**: One agent gains permanent +1 to either Spy OR Assassin aptitude (player choice). The agent's aptitude budget increases from 36 to 37.
- **Shadow Memory**: A high-importance Memory implanted in one agent, describing their experience in the darkness. Affects future autonomous behavior.
- **Scar Tissue Reduction**: If boss was defeated, the simulation's `scar_tissue` for the corresponding event decreases by 0.05.

---

### 3.2 THE TOWER (economic_tremor) — "Der Fallende Turm"

> *"Structures that seemed permanent reveal themselves as temporary. Value dissolves."*

#### Core Mechanic: STABILITY COUNTDOWN

The dungeon has a **Stability meter** (starts at 100, decreases every room). When Stability hits 0, the dungeon collapses — forced evacuation, partial loot only. Deeper floors drain Stability faster. The party must balance speed (less drain per room) against thoroughness (more loot but more drain).

- Room entered (depth 1-2): -5 Stability
- Room entered (depth 3-4): -10 Stability
- Room entered (depth 5): -15 Stability
- Combat round: -3 Stability per round
- Failed skill check: -5 Stability
- Successful "Reinforce" (Guardian ability): +10 Stability
- Treasure room cleared: +5 Stability (structural salvage)

At stability 0, the Tower enters **Structural Failure** mode: ambient stress is doubled (collapse_stress_multiplier: 2.0), ambush chance rises to 50% (collapse_ambush_chance), and the Reinforce ability becomes ineffective. The banter trigger changes from `stability_critical` to `stability_collapse`. This is not a party wipe — agents can still retreat or push to the boss, but the escalating penalties make prolonged exploration untenable.

#### Atmosphere

Vertigo. The building leans. Numbers cascade down walls like stock tickers. Markets collapse in text. Agents comment on the wrongness of value itself.

#### Encounter Palette

| Type | % | Emphasis |
|---|---|---|
| Combat | 40% | "Debt Collectors" — drain agent aptitudes temporarily |
| Encounter (Economic) | 25% | "The Investment" — risk Stability Points for potential loot multiplier |
| Encounter (Puzzle) | 10% | "The Ledger" — reconstruct a trade route (Spy + profession "trader" bonus) |
| Rest | 10% | "The Vault" — safe, but costs 10 Stability to reinforce |
| Treasure | 10% | "Fallen Assets" — resources from collapsed markets |
| Elite | 5% | "The Liquidator" — strips buffs, converts them to damage |

#### Aptitude Emphasis: Guardian (Stability reinforcement), Spy (efficiency), Saboteur (controlled demolition for shortcuts)

#### Boss: "The Collapse"

The tower itself is the boss. Party must ascend as floors collapse beneath them. Each round, the lowest-depth party member's room collapses (-20 stress, skill check to avoid Wounded). Victory = reaching the exit before total collapse. Guardian abilities buy time. Saboteur can demolish obstacles. Assassin can "cut through" structural enemies blocking the path.

#### Loot: **Stability Catalyst** (+0.05 simulation Overall Health, permanent)

---

### 3.3 THE DEVOURING MOTHER (biological_tide) — "Das Lebendige Labyrinth"

> *"That which sustains life turns against it. The organic remembers hunger."*

#### Core Mechanic: PARASITIC DRAIN

The dungeon drains agent **Needs** each room. Social drops first (isolation), then Purpose (existential dread), then Safety (panic). Agents with critically low Needs (< 20) develop debuffs. The party must use Talk commands (existing chat system) between agents to restore Social needs, and complete objectives to restore Purpose.

#### Encounter Palette

| Type | % | Emphasis |
|---|---|---|
| Combat | 35% | "Symbiotes" — attach to agents, buff one aptitude +3 but agent risks losing control at stress > 500 |
| Encounter (Biological) | 25% | "The Infection" — agent-specific puzzles requiring profession-based cures |
| Encounter (Cooperative) | 15% | "The Membrane" — two agents must solve different halves simultaneously |
| Rest | 10% | "The Womb" — deep rest, restores all Needs, but agents gain "dependent" moodlet |
| Treasure | 10% | "Organic Harvest" — biological components |
| Elite | 5% | "The Host" — a parasitized agent from another simulation's echo |

#### Aptitude Emphasis: Propagandist (Need restoration via Talk), Guardian (protecting drained agents), Spy (identifying safe organic material)

#### Boss: "The Mother"

Cannot be killed through combat. Must be negotiated with (Propagandist) or escaped from (Infiltrator). If agents have Symbiotes attached, the Mother can control those agents temporarily. Party must remove Symbiotes first (Saboteur) or turn them against the Mother (Spy identifies weakness).

#### Loot: **Symbiotic Bond** — permanently links two agents; +10% Qualification when together, -5% when apart

---

### 3.4 THE DELUGE (elemental_surge) — "Die Steigende Flut"

> *"The world reminds its inhabitants that they are guests, not owners."*

#### Core Mechanic: RISING WATER (INVERTED DUNGEON)

The deepest floors are already flooded. Each turn, water rises 1 floor. The party starts at the bottom and must ascend. Lower floors have better loot but are underwater first. Movement in flooded rooms requires physical skill checks (Guardian/Assassin aptitude). Agents with low physical professions suffer -20% to all checks in water.

#### Encounter Palette: Environmental hazards dominate. Combat is rare (30%). Most encounters are evacuation puzzles and resource management.

#### Boss: "The Current" — An environmental boss. The party must build a dam/barrier (Saboteur + Guardian cooperation) while waves of water attack. Each wave is stronger. Timer-based: survive N waves to win.

#### Loot: **Elemental Warding** — one building in simulation becomes immune to condition degradation below "moderate"

---

### 3.5 THE OVERTHROW (authority_fracture) — "Der Spiegelpalast"

> *"Power changes hands. The old order doesn't die — it metamorphoses."*

#### Core Mechanic: FACTION NAVIGATION

Each floor has 2-3 competing factions. The party must choose which to ally with. Each alliance opens doors but closes others. Betraying a faction (switching allegiance) is possible but incurs party stress and reputation consequences. Propagandist and Spy abilities are dominant.

#### Encounter Palette: 60% non-combat (social encounters, negotiations, intrigue). 20% combat (faction enforcers). 20% puzzle (political riddles, document analysis).

#### Boss: "The Pretender" — A distorted version of the simulation's owner/leader. Phases: 1) Debate (Propagandist duel), 2) Exposure (Spy reveals truth), 3) Overthrow (combat or persuasion). The boss adapts to whichever approach the party uses most.

#### Loot: **Authority Fragment** — upgrades one zone's security_level by 1 tier for 10 heartbeat ticks

---

### 3.6 THE PROMETHEUS (innovation_spark) — "Die Werkstatt der Götter"

> *"Den Göttern gestohlenes Feuer. Jede Gabe ist auch eine Waffe."*
> *"Fire stolen from the gods. Every gift is also a weapon."*

**Literary Research:** See `docs/research/prometheus-literary-research.md` (comprehensive, 19 authors + 8 philosophical sources)

**Literary DNA:** Mary Shelley (*Frankenstein*), Bruno Schulz (*Street of Crocodiles*), Stanisław Lem (*The Cyberiad*), Patrick Süskind (*Das Parfum*), E.T.A. Hoffmann (*Der Sandmann*), Gaston Bachelard (*Psychoanalysis of Fire*), Ernst Jünger (*Gläserne Bienen*), Ted Chiang (*Exhalation*), Primo Levi (*The Periodic Table*). Philosophical: Bernard Stiegler (technology as pharmakon), Heidegger (techne as poiesis), Lévi-Strauss (the bricoleur). Deep cuts: Villiers de l'Isle-Adam (*L'Ève future*), Gustav Meyrink (*Der Golem*), Adolfo Bioy Casares (*The Invention of Morel*), Andrei Platonov (*The Foundation Pit*), Karel Čapek (*R.U.R.*). Mythological: Prometheus/Hephaestus/Daedalus/Pygmalion/Tsukumogami.

**Tone:** NOT horror, NOT dread, NOT resignation. **Innovation fever** — the ecstasy and vertigo of creation. The workshop is alive. Components have personality. Crafting banter is procedural. Humor (Lem's cosmic irony) is permitted. The pharmakon principle is non-negotiable: every crafted item carries both benefit and cost.

**Emotional gradient:** No items → Levi/Chiang precision + wonder. 1–2 items → Lem/Schulz constructor-humor. 3–4 items → Shelley/Hoffmann complications + uncanny. 5+ items → Schulz/Meyrink matter-with-its-own-agenda. Failed → Lem irony + Platonov tragedy. Brilliant → Bachelard fire-reverie + Novalis wonder.

#### Core Mechanic: CRAFTING / COMBINATION

Rooms contain **components** instead of loot. Components can be combined (Saboteur + profession skills) to create unique items. Some combinations are brilliant, others catastrophic (Cultist Simulator opacity pattern). The dungeon rewards experimentation and punishes playing safe (no components = no boss-fight tools).

**The Pharmakon Principle (Stiegler/Derrida):** Every crafted item has BOTH a benefit and a cost. This is architecturally non-negotiable — no pure-upside items exist. Fire warms AND burns. The alloy strengthens AND resonates at a dangerous frequency. The innovation empowers AND creates dependency.

**The Bricoleur Principle (Lévi-Strauss):** The party works with whatever components they find, not ideal ones. There is no "correct" combination. Mythical thought as creative recombination — the bricoleur constructs things using whatever materials are at hand.

**Component Personality (Schulz):** Components are not generic. Each has material-specific behavior. Metals resist combination. Fluids merge eagerly. Crystals shatter precisely. Powders dissipate under stress. Energy sources hum with intent. Components REACH toward certain partners and REJECT others. "In the depth of matter, indistinct smiles are shaped, tensions build up, attempts at form appear."

**Crafting Consumption (Bioy Casares):** Components are consumed when crafted. You cannot craft AND keep the originals. The perfect copy destroys the original. This creates genuine scarcity and forces triage decisions.

**Emergent Properties (Čapek/Tsukumogami):** Crafted items may develop properties that weren't in either component. Consciousness arrives uninvited. Objects used long enough gain their own trajectories. The crafting system must allow for results that exceed component values.

#### Encounter Palette: 40% puzzle (combination challenges), 30% combat (guardian constructs), 20% encounter (invention opportunities), 10% rest.

#### Boss: "The Prototype" — A malfunctioning construct that can only be defeated using crafted items from the dungeon. Each crafted item has a different effect on the boss. Party must figure out which combination works (Ted Chiang's "Seventy-Two Letters" principle: the right combination of signs = function; the wrong combination = nothing). The Prototype adapts — using the same crafted item twice has diminishing returns. The boss is a puzzle, not a tank-and-spank.

#### Loot: **Innovation Blueprint** — player chooses: +1 Aptitude for one agent, OR +0.15 Building Readiness for one building, OR Fortify duration doubled for one zone

#### Banter Register

- **Workshop-as-actor:** The workspace is alive. Tools arrange themselves. Reagents crystallize autonomously. Surfaces change temperature. The workshop has preferences.
- **Procedural narration:** Unlike Shadow (atmospheric) or Tower (structural), Prometheus banter describes PROCESS. "The {component_a} meets the {component_b}. For a moment, nothing. Then: heat. Then: light. Then: something that was not there before."
- **German compound nouns:** Werkstatt, Schmelztiegel, Versuchsanordnung, Legierungsbruch, Destillationsrückstand. German's compounding ability is perfect for this register.
- **Anti-patterns:** No Shadow vocabulary (darkness, void, absence). No Entropy vocabulary (decay, dissolution). No Mother vocabulary (warmth, growth, absorption). No Tower vocabulary (structural, load-bearing). No body horror.
- **S-tier example:** "The components align. Not chemically — intentionally. As if the alloy wanted to exist before {agent} thought to forge it."

---

### 3.7 THE AWAKENING (consciousness_drift) — "Das Kollektive Unbewusste"

> *"The collective mind turns over in its sleep. Something new is dreaming."*

#### Core Mechanic: MEMORY DUNGEON

Rooms are generated from actual agent Memories (pgvector retrieval). High-importance memories become key rooms. The party navigates through their own agents' psychology. Agents with memories related to the current room gain bonuses. Unknown memories (from other agents) create mystery encounters.

#### Encounter Palette: 50% encounter (memory confrontation, reflection puzzles), 25% combat (repressed memories as monsters), 15% rest (meditation), 10% treasure (insight).

#### Boss: "The Repressed" — A memory so painful it was buried. Can only be defeated by the agent whose memory it is (if in the party). Otherwise, it must be contained (Guardian) and escaped from.

#### Loot: **Awakening Insight** — modify one agent's Big Five personality dimension by 0.1 (player choice)

---

### 3.8 THE ENTROPY (decay_bloom) — "Der Verfall-Garten"

> *"The slow unwinding accelerates. Decay is not destruction — it is transformation's dark twin."*

#### Core Mechanic: RESTORATION vs SPEED

Every room contains something valuable that is decaying in real-time (Heartbeat-tick-synced). The party has limited "Restoration Points" (RP). Restoring items costs RP but yields better loot. Letting items decay saves RP but yields worse loot. The party must prioritize what to save. Guardian abilities slow decay. Saboteur abilities can redirect decay to enemies.

#### Encounter Palette: 40% encounter (triage decisions), 30% combat (entropy blooms — passive enemies that drain aptitudes), 15% treasure (decaying artifacts), 15% rest.

#### Boss: "The Garden" — An area boss, not a single entity. The party must restore a central artifact while entropy blooms attack. Each round, the artifact decays. Restoration requires coordinated effort (Guardian holds the line, Saboteur clears blooms, Spy identifies optimal restoration sequence, Propagandist keeps party morale up).

#### Loot: **Restoration Fragment** — improves one building's condition by one tier (e.g., "poor" → "moderate")

---

## 4. Combat System (Applied to Dungeons)

### 4.1 Phase-Based Resolution

Identical to the combat system designed in `mud-combat-feasibility-analysis.md`:

```
ASSESSMENT (3-5s) → PLANNING (15-45s) → RESOLUTION (5-8s) → OUTCOME (2-3s)
Total per round: 25-60 seconds
Typical combat: 3-5 rounds = 2-4 minutes
```

> **[REVIEW #11 — HIGH]** Stress Economy Death Spiral — Math Breakdown
>
> Running the numbers for a typical Shadow dungeon (difficulty 3, depth 5):
>
> **Per-room ambient stress** (from Section 12):
> `stress_per_room = 15 + (5 × depth) + (10 × difficulty)`
> - Depth 1: 15+5+30 = 50
> - Depth 3: 15+15+30 = 60
> - Depth 5: 15+25+30 = 70
> - Total over 8 rooms (typical path): ~480 ambient stress
>
> **Combat stress additions:**
> - Shadow Wisp: stress_attack_power 4 → ~80 stress per hit (base 4×20=80)
> - Paranoia Shade: stress_attack_power 8 → ~160 stress per hit
> - 3-4 combats per run × 3-5 rounds × 1-2 stress attacks = ~400-800 combat stress
>
> **Total: ~880-1280 stress per run** — every agent hits Resolve Check territory (800+).
>
> With 75% affliction rate, a 4-agent party statistically loses 3 agents to affliction per run. This isn't "challenging" — it's mathematically unwinnable at difficulty 3.
>
> **Vergleich Darkest Dungeon:** Stress accumulates over 20-30 room dungeons (not 5-8), with multiple stress healing options (camp skills, jester, hound master, flagellant). Virtue rate is 25% but you rarely hit 200 stress in a single run unless something goes very wrong.
>
> **Empfehlung:** The stress economy needs one or more of: (a) halve ambient stress per room (it's a passive tax that players can't interact with), (b) increase Virtue rate to 40% (makes Resolve Checks a tense moment, not a death sentence), (c) add more stress recovery: Propagandist "Inspire" should heal 100+ stress (not 75), rest sites should heal 200+ stress, (d) cap maximum stress gain per round at 150 (prevents spike kills from Paranoia Shade).

### 4.2 Skill Check System (3-Tier, Disco Elysium + PbtA Hybrid)

Every non-combat challenge uses this resolution:

```
Check Value = Base (55%) + (Relevant Aptitude × 3%) + Personality Modifier + Context Modifier

Thresholds:
  ≤ 30%: FAIL — negative consequence, narrative complication, stress +50-100
  31-70%: PARTIAL — succeed with cost (stress, resource loss, time)
  ≥ 71%: SUCCESS — clean success, possible bonus discovery
```

**Personality Modifiers (context-dependent):**

| Check Type | Positive Modifier | Negative Modifier |
|---|---|---|
| Courage check | Low Neuroticism: +10% | High Neuroticism: -10% |
| Social check | High Extraversion: +10% | Low Extraversion: -5% |
| Precision check | High Conscientiousness: +10% | Low Conscientiousness: -5% |
| Creative check | High Openness: +10% | Low Openness: -10% |
| Moral check | High Agreeableness: +10% for compassionate choices | Low Agreeableness: +10% for ruthless choices |

**Terminal output for a skill check:**

```
Agent Kovacs attempts to bypass the shadow ward.

[INFILTRATOR CHECK — Aptitude 5: Base 55% + (5×3%) = 70%
  Personality: Conscientiousness 0.8 → +8%
  Context: Visibility 0 → -15%
  Final: 63%]

Rolling... ████████░░ 63%

Result: 58 — PARTIAL SUCCESS

Kovacs disables the ward, but not cleanly. A pulse of dark energy
ripples outward. The shadows stir.

  → Ward disabled (passage open)
  → Alert: Shadow Sentinels in adjacent rooms are now aware (+1 to next ambush chance)
  → Kovacs: Stress +30 ("That was messy. They know we're here.")
```

### 4.3 Encounter Templates

Each encounter is a **self-contained module** (Sunless Sea storylet pattern):

```python
@dataclass
class EncounterTemplate:
    """A single encounter definition."""
    id: str  # e.g., "shadow_prisoner"
    archetype: str  # "The Shadow"
    room_type: str  # "encounter"

    # Gating
    min_depth: int = 0
    max_depth: int = 99
    min_difficulty: int = 1
    requires_aptitude: dict[str, int] | None = None  # e.g., {"spy": 5}
    requires_personality: dict[str, float] | None = None  # e.g., {"agreeableness": 0.6}

    # Content
    description_en: str = ""
    description_de: str = ""

    # Choices
    choices: list[EncounterChoice] = field(default_factory=list)

    # Passive checks (auto-fire if agent meets threshold)
    passive_checks: list[PassiveCheck] = field(default_factory=list)

@dataclass
class EncounterChoice:
    """A choice within an encounter."""
    id: str  # e.g., "free_prisoner"
    label_en: str
    label_de: str

    # Requirements
    requires_aptitude: dict[str, int] | None = None
    requires_profession: str | None = None  # e.g., "diplomat"

    # Skill check (if any)
    check_aptitude: str | None = None  # which aptitude to check
    check_difficulty: int = 0  # modifier to base difficulty

    # Outcomes (success / partial / fail)
    success_effects: dict = field(default_factory=dict)  # {"stress": -20, "loot_tier": 2}
    partial_effects: dict = field(default_factory=dict)
    fail_effects: dict = field(default_factory=dict)

    # Narrative
    success_narrative_en: str = ""
    partial_narrative_en: str = ""
    fail_narrative_en: str = ""
```

> **[REVIEW #12 — MEDIUM]** No In-Combat Healing Specified
>
> The spec defines rest sites for between-room recovery (Stress -100, Wounded→Stressed), but no in-combat healing mechanic exists. Guardian can absorb damage (prevention), Propagandist can reduce stress (mitigation), but no ability restores condition steps during combat.
>
> **Frage:** Is this intentional (Darkest Dungeon also has no in-combat HP healing — only stress healing via Jester)? If yes, this should be explicitly stated as a design decision. If no, Guardian School needs a "Stabilize" ability (restore 1 condition step, long cooldown).
>
> **Empfehlung:** Make this explicit either way. If intentional, add a design note: "Condition damage is permanent within combat — this makes Guardian prevention and Spy ambush-avoidance critical. Recovery happens only at rest sites."

> **[REVIEW #13 — MEDIUM]** Boss Alternative Win Conditions Underspecified
>
> Shadow Boss "The Unresolved" offers a psychological confrontation path (Propagandist convinces it to dissipate). This is thematically excellent but mechanically vague:
> - Is it a single skill check? (Anticlimactic for a boss)
> - A multi-round "debate combat"? (Needs its own mechanics)
> - Does it require specific dialogue choices? (Where are the templates?)
> - What happens on partial success? On failure?
>
> The combat path has full damage formulas, round-by-round phases, and specific enemy abilities. The alternative path has one paragraph.
>
> **Empfehlung:** Define a "Psychological Resolution" mechanic usable across all archetypes. Suggestion: 3-round dialogue combat where Propagandist makes Persuasion checks, boss has "Resistance" that decreases per successful check, partial success = boss weakened but not defeated (fall back to combat phase with boss at reduced stats). This pattern can be reused for Devouring Mother (negotiate), Overthrow (debate), and Awakening (introspection).

### 4.4 Agent Banter System

Between encounters, agents generate contextual dialogue based on:
- Current room type and archetype theme
- Agent personality (Big Five drives tone)
- Pairwise opinions (allies joke together, rivals snipe)
- Current stress level (stressed agents are terse, relaxed agents are chatty)
- Active moodlets (an agent with "haunted by foreign memories" comments on déjà vu)

**Implementation:** Template pool per archetype + personality, selected by weighted random. NOT LLM-generated (too slow for between-room pacing). LLM reserved for boss encounters and major story beats.

```python
SHADOW_BANTER = [
    # (trigger_condition, personality_filter, template)
    ("room_entered", {"neuroticism": (0.6, 1.0)},
     "{agent} flinches at a sound only they can hear."),
    ("room_entered", {"extraversion": (0.0, 0.3)},
     "{agent} says nothing, but you notice their hand hasn't left their weapon."),
    ("combat_won", {"agreeableness": (0.7, 1.0)},
     "{agent} checks on each party member before celebrating."),
    ("visibility_zero", {"openness": (0.7, 1.0)},
     "{agent}: 'The darkness isn't empty. It's... full of something.'"),
    # Opinion-driven
    ("combat_won", {"opinion_positive_pair": True},
     "{agent_a} nods at {agent_b}. No words needed."),
    ("agent_stressed", {"opinion_negative_pair": True},
     "{agent_a} mutters something about {agent_b}'s competence."),
]
```

---

## 5. Integration Points with Existing Systems

### 5.1 Terminal Integration

The dungeon runs **inside the existing BureauTerminal**, not as a separate component. New terminal commands are registered in the existing `COMMAND_REGISTRY`:

```typescript
// New commands (Tier 2+):
['dungeon',  { verb: 'dungeon', tier: 2, handler: handleDungeonEnter }]  // Start a run
['move',     { verb: 'move', tier: 1, handler: handleDungeonMove }]       // Move to adjacent room (overrides zone navigation in dungeon mode)
['map',      { verb: 'map', tier: 1, handler: handleDungeonMap }]         // Show dungeon graph
['scout',    { verb: 'scout', tier: 2, handler: handleDungeonScout }]     // Spy: reveal adjacent rooms
['rest',     { verb: 'rest', tier: 2, handler: handleDungeonRest }]       // Rest at rest site
['retreat',  { verb: 'retreat', tier: 2, handler: handleDungeonRetreat }] // Leave dungeon (keep partial loot)
['interact', { verb: 'interact', tier: 2, handler: handleEncounterChoice }] // Make encounter choice
```

The `TerminalStateManager` gains dungeon state signals (same pattern as epoch state):

```typescript
// New signals in TerminalStateManager:
readonly dungeonRunId = signal<string | null>(null);
readonly dungeonState = signal<DungeonClientState | null>(null);
readonly dungeonCombat = signal<CombatState | null>(null);

readonly isInDungeon = computed(() => this.dungeonRunId.value !== null);

initializeDungeon(runId, state) { ... }
clearDungeon() { ... }
```

### 5.2 Resonance System Integration

Dungeon availability tied to existing `substrate_resonances`:

```python
async def get_available_dungeons(supabase, simulation_id) -> list[dict]:
    """Check which archetypes have active resonances above threshold."""
    # Active resonances impacting this simulation
    impacts = await supabase.table("resonance_impacts") \
        .select("*, substrate_resonances(*)") \
        .eq("simulation_id", str(simulation_id)) \
        .in_("status", ["completed", "generating"]) \
        .execute()

    available = []
    for impact in impacts.data:
        resonance = impact["substrate_resonances"]
        if resonance["status"] in ("detected", "impacting"):
            if impact["effective_magnitude"] >= 0.3:  # minimum threshold
                available.append({
                    "archetype": resonance["archetype"],
                    "signature": resonance["resonance_signature"],
                    "resonance_id": resonance["id"],
                    "magnitude": resonance["magnitude"],
                    "susceptibility": impact["susceptibility"],
                    "effective_magnitude": impact["effective_magnitude"],
                    "difficulty_suggestion": _calc_difficulty(impact["effective_magnitude"]),
                })

    return available
```

Higher `effective_magnitude` = deeper dungeon (more floors) and better loot, but also harder enemies.

### 5.3 Agent State Integration

> **[REVIEW #3 — HIGH]** Referenced Services and RPCs Don't Exist in Codebase
>
> The integration code below references several services/RPCs that do not exist:
>
> 1. **`update_agent_mood` RPC** — No SQL function with this name exists in any migration. The only related function is `fn_recalculate_mood_scores(p_simulation_id UUID)` which is a bulk recalculation, not a single-agent update.
> 2. **`AgentMemoryService.create_memory()`** — No backend `AgentMemoryService` class exists. Only `AgentMemoryApiService` (frontend) and a DB function `retrieve_agent_memories()` exist.
> 3. **`NarrativeArcService.find_active_arc()` / `.reduce_pressure()`** (Section 5.4) — No `NarrativeArcService` class exists anywhere in the codebase.
>
> **Evidenz:** Exhaustive grep across `backend/services/`, `backend/routers/`, `supabase/migrations/` for each name.
>
> **Empfehlung:** These services need to be created as part of the implementation. Add them to the Phase 0 roadmap as prerequisite tasks. Alternatively, refactor the integration to use direct Supabase table operations (which is the pattern used by `bureau_response_service.py`).

> **[REVIEW #4 — HIGH]** Column Name Mismatch: `scar_tissue`
>
> Section 5.4 references `scar_tissue` on narrative_arcs, but the actual column (migration 129) is `scar_tissue_deposited` (NUMERIC 6,4). These have different semantics: `scar_tissue_deposited` tracks cumulative deposits, not a current reducible value.
>
> **Empfehlung:** Verify the intended game mechanic — is the dungeon supposed to reduce cumulative scar tissue, or reduce current arc pressure? The code in 5.4 already reduces `pressure` separately. Clarify or remove the scar_tissue reference.

> **[REVIEW #5 — MEDIUM]** `activity_type` Enum Mismatch
>
> The code below uses `activity_type: "dungeon_exploration"` but the `agent_activities` table (migration 145) constrains activity_type to a closed enum: `'work', 'socialize', 'rest', 'explore', 'maintain', 'reflect', 'avoid', 'confront', 'celebrate', 'mourn', 'seek_comfort', 'collaborate', 'create', 'investigate'`. The value `dungeon_exploration` would violate this CHECK constraint.
>
> **Empfehlung:** Either extend the enum in a new migration (add `'dungeon_exploration'`), or map to existing value `'explore'` with a distinguishing `activity_subtype`.

Dungeon outcomes write to **existing agent tables** (no new agent columns needed):

```python
async def apply_dungeon_outcome(supabase, run: DungeonRun, party: list[AgentCombatState]):
    """Apply dungeon results to persistent agent state."""
    for agent in party:
        # 1. Update mood (existing agent_mood table)
        mood_delta = _calc_mood_delta(agent)
        await supabase.rpc("update_agent_mood", {
            "p_agent_id": str(agent.agent_id),
            "p_mood_delta": mood_delta,
            "p_stress_delta": agent.stress,
        }).execute()

        # 2. Create moodlets (existing agent_moodlets table)
        moodlets = _generate_dungeon_moodlets(agent, run.archetype)
        for m in moodlets:
            await supabase.table("agent_moodlets").insert(m).execute()

        # 3. Create memory (existing agent_memories via MemoryService)
        memory_content = _generate_dungeon_memory(agent, run)
        await AgentMemoryService.create_memory(
            supabase, agent.agent_id, run.simulation_id,
            content=memory_content,
            memory_type="dungeon_experience",
            importance=7 + (1 if run.status == "completed" else 0),
        )

        # 4. Update opinions (existing agent_opinion_modifiers table)
        for other in party:
            if other.agent_id != agent.agent_id:
                modifier = _calc_opinion_modifier(agent, other, run)
                await supabase.table("agent_opinion_modifiers").insert({
                    "agent_id": str(agent.agent_id),
                    "target_agent_id": str(other.agent_id),
                    "simulation_id": str(run.simulation_id),
                    "modifier_type": "shared_dungeon_experience",
                    "opinion_change": modifier,
                    "decay_type": "permanent",
                    "description": f"Survived {run.archetype} dungeon together",
                }).execute()

        # 5. Create activity (existing agent_activities table)
        await supabase.table("agent_activities").insert({
            "agent_id": str(agent.agent_id),
            "simulation_id": str(run.simulation_id),
            "activity_type": "dungeon_exploration",
            "activity_subtype": run.archetype.lower().replace(" ", "_"),
            "significance": 8,
            "narrative_text": f"Explored a {run.archetype} resonance dungeon",
            "effects": {
                "mood_delta": mood_delta,
                "stress_final": agent.stress,
                "dungeon_completed": run.status == "completed",
            },
        }).execute()
```

### 5.4 Narrative Arc Integration

Completing a dungeon can advance or resolve narrative arcs:

```python
# If the dungeon's archetype matches an active narrative arc's primary_signature:
arc = await NarrativeArcService.find_active_arc(supabase, simulation_id, signature)
if arc and run.status == "completed":
    # Boss defeat reduces arc pressure
    pressure_reduction = 0.15 * difficulty
    await NarrativeArcService.reduce_pressure(supabase, arc["id"], pressure_reduction)
```

### 5.5 Heartbeat Integration

Dungeon availability refreshes on heartbeat ticks. Abandoned dungeons expire after 3 ticks. Completed dungeons generate heartbeat entries:

```python
# In heartbeat_service._tick_simulation():
# After Phase 9 (Chronicle), add:
# Phase 10: Dungeon cleanup
await DungeonEngineService.cleanup_expired_runs(admin_supabase, simulation_id)
```

---

> **[REVIEW #14 — HIGH]** Sequencing Conflict with War Room Operations
>
> The companion document `mud-combat-feasibility-analysis.md` explicitly recommends **War Room Operations as Phase 1** ("kleinste Brücke zwischen 'was wir haben' und 'instanziertes Abenteuer'") and Resonance Dungeons as **Phase 2-3**. However, this spec's roadmap starts with "Phase 0: The Shadow MVP" as if it's the first thing to build.
>
> **Das Problem:** Both systems share the same combat engine (phase-based, 45s planning, simultaneous resolution), ability schools, condition tracks, stress system, and many terminal formatters. Building them independently would create massive code duplication. Building Dungeons first means War Room Ops can't reuse the combat code (it doesn't exist yet in the right shape).
>
> **Empfehlung:** Resolve the sequencing explicitly:
> - **Option A (recommended by feasibility doc):** Build War Room Ops first. Extract the shared combat engine as `backend/services/combat/` (combat_engine.py, ability_schools.py, condition_tracks.py, stress_system.py). Then Resonance Dungeons wraps this engine with dungeon-specific graph traversal, encounters, and archetype mechanics.
> - **Option B:** Build Dungeon Shadow MVP first, but architect the combat engine as a shared module from day 1. Reference `backend/services/combat/` in both the War Room and Dungeon specs.
> - Either way, the combat engine should be a **shared service**, not embedded in `dungeon_combat.py`.

> **[REVIEW #15 — MEDIUM]** Missing Frontend Recovery Path
>
> The checkpoint/recovery system (Section 9.3) is entirely server-side. The frontend has no specified behavior for:
> - Browser crash during combat → user reopens page → what happens?
> - Server restart mid-dungeon → all clients lose WebSocket → what do they see?
> - Mobile user switches apps → comes back 5 minutes later → is the dungeon still there?
>
> **Empfehlung:** Add a frontend recovery flow:
> 1. On page load, `DungeonStateManager.initialize()` checks for `dungeonRunId` in localStorage
> 2. If found, calls `GET /runs/{runId}/state` to resync
> 3. If run still active → restore full dungeon UI with "Reconnected to dungeon session" system line
> 4. If run expired/completed → clear local state, show "Dungeon session ended while you were away" with outcome summary
> 5. RealtimeService reconnection should re-subscribe to `dungeon:{runId}:*` channels automatically

## 6. Implementation Roadmap

### Phase 0: The Shadow MVP — COMPLETE (2026-03-27 → 2026-03-28)

**Backend:**
- [x] Migration 163: `resonance_dungeon_runs` + `resonance_dungeon_events` tables
- [x] Migration 164: Atomic RPCs (`fn_complete_dungeon_run`, `fn_abandon_dungeon_run`, `fn_wipe_dungeon_run`, `fn_get_party_combat_state`, `fn_apply_dungeon_loot`), `available_dungeons` VIEW
- [x] Migration 165: Loot distribution (`fn_begin_distribution`, `fn_finalize_dungeon_run`), CHECK constraints, indexes
- [x] `backend/models/resonance_dungeon.py` + `backend/models/combat.py` — Pydantic schemas
- [x] `backend/services/combat/` — Shared combat module (6 files: combat_engine, skill_checks, condition_tracks, stress_system, ability_schools, __init__)
- [x] `backend/services/dungeon/` — Dungeon submodule (6 files: generator, encounters, combat, loot, archetypes, __init__)
- [x] `backend/services/dungeon_engine_service.py` — orchestration + DungeonInstanceManager
- [x] `backend/services/dungeon_query_service.py` — read operations (history, events, loot effects)
- [x] `backend/routers/resonance_dungeons.py` — 15 REST endpoints (12 auth + 2 public + 1 loot effects)
- [x] 5 combat enemy templates, 10 encounter templates, 12 loot items
- [x] 755+ tests (11 files), 0 bugs

**Frontend:**
- [x] `DungeonStateManager.ts` — Preact Signals singleton (state, timer, combat planning, recovery, loot distribution)
- [x] `DungeonApiService.ts` — REST client (14 endpoints)
- [x] `dungeon-commands.ts` — Dispatcher + 10 command handlers, 3 verb categories
- [x] `dungeon-formatters.ts` — 16 pure formatters + 2 shared i18n helpers
- [x] `DungeonTerminalView.ts` — Route entry, HUD grid, lobby, Wake Lock, recovery, event forwarding
- [x] `DungeonHeader.ts` — Submarine depth gauge
- [x] `DungeonQuickActions.ts` — Phase-driven action buttons (13 phases)
- [x] `DungeonPartyPanel.ts` — Agent cards, condition/stress/mood bars, buff/debuff pills
- [x] `DungeonMap.ts` — SVG DAG, fog-of-war, click-to-move, collapsible
- [x] `DungeonCombatBar.ts` — 45s timer, per-agent ability selection, target picker, EXECUTE
- [x] `DungeonEnemyPanel.ts` — Into the Breach-style telegraphs, threat badges
- [x] `AgentDungeonRewards` component — Loot provenance UI in AgentDetailsPanel
- [ ] RealtimeService extension: `joinDungeon()` / `leaveDungeon()` — deferred (single-player works)

**Content:**
- [x] 10 Shadow encounter templates (4 combat, 3 encounter, 1 elite, 1 rest, 1 treasure)
- [x] Shadow boss encounter (The Remnant — shadow_remnant_spawn template)
- [x] Banter templates (placeholder resolution: {agent}, {agent_a}, {agent_b})
- [x] Shadow loot table (3 tiers, 12 items)
- [x] Combat onboarding (CIC briefing card)
- [x] Dungeon completion screen (ASCII-box, stress bars, party status, loot)

### Phase 1: Second Archetype — The Tower (COMPLETE, 2026-03-29)

- [x] Backend refactoring: `ArchetypeStrategy` ABC in `archetype_strategies.py` — `ShadowStrategy` + `TowerStrategy` with dict-Registry. 4 abstract methods (`init_state`, `apply_drain`, `apply_restore`, `apply_encounter_effects`) + 3 optional hooks (`get_ambient_stress_multiplier`, `on_combat_round`, `on_failed_check`). Adding archetype N = 1 Strategy subclass + 1 registry entry, 0 engine changes.
- [x] The Tower stability countdown mechanic (100→0, depth-based drain, combat drain, failed check drain)
- [x] 5 Tower enemies: Tremor Broker, Foundation Worm, The Crowned, Debt Shade, Remnant of Commerce
- [x] 6 Tower spawn configs + fallback spawns
- [x] 11 Tower encounter templates (4 combat, 3 narrative, 1 elite, 1 boss, 1 rest, 1 treasure)
- [x] 45 Tower banter templates (incl. stability_critical trigger)
- [x] 12 Tower loot items (4/5/3 tiers) + stability bonus (>=80 → tier upgrade)
- [x] Tower boss "The Collapse" (environmental, per-round -3 stability)
- [x] Guardian "Reinforce" ability: +10 Stability (Tower only)
- [x] Tower ambush logic (stability <30 = 25%, <15 = 50%)
- [x] Frontend: TowerArchetypeState types, stability gauge, terminal formatters
- [x] HTP lore: fixed archetype names + Shadow/Tower callouts
- [x] 119 new tests (2184 total), all passing
- [ ] Remaining 3/17 abilities (Counter-Intelligence, Ambush Strike, 1 unidentified)
- [ ] Multiplayer dungeon support (2 players, shared party)

### Phase 2-3: Remaining Archetypes (4-8 weeks)

- [x] The Devouring Mother (4th, commit 3bc7a3e..6877013)
- [x] The Prometheus (5th, insight crafting mechanic)
- [x] The Deluge (6th, commit 599e6a0 + cc30c13 follow-ups)
  - [x] Inverted loot gradient (low-water bonus + depth bonus)
  - [x] Salvage mechanic (full-stack: POST /salvage, depth-based submersion)
  - [x] The Current Carries (6 debris items, auto-apply every 2nd room)
  - [x] Protocol briefing + water bar in formatRoomEntry
  - [x] Elemental warding (simulation_modifier pipeline, migration 174)
  - [x] Seal Breach frontend (commands + formatters)
- [x] The Entropy (3rd, commit e6f2453)
- [ ] The Overthrow (config only, stubbed)
- [ ] The Awakening (config only, stubbed)
- [ ] Advanced Ability Schools (Aptitude 7-9, Ultimate abilities)
- [ ] Difficulty scaling (Ascension-style modifiers)
- [ ] Weekly Resonance Dungeon leaderboard

### Phase 4: Meta-Progression + Polish

- [ ] Cross-dungeon progression tracking
- [ ] Agent "dungeon veteran" trait system
- [ ] Dungeon Chronicle integration (newspaper reports on completed dungeons)
- [ ] Convergence Dungeons (combined archetypes from narrative arc convergences)

---

## 7. Why The Shadow First

| Criterion | The Shadow | Alternatives |
|---|---|---|
| **Mechanic simplicity** | One resource (Visibility) with clear spend/restore | Tower has Stability (similar but + time pressure). Others are more complex |
| **Terminal atmosphere** | Darkness + amber phosphor = perfect match | All work, but Shadow is the most atmospheric in text |
| **Combat showcase** | Ambush mechanics demonstrate the skill check system naturally | Others need more encounter variety before combat feels complete |
| **Aptitude coverage** | Tests Spy (critical), Guardian, Assassin, Infiltrator — 4 of 6 aptitudes matter | Some archetypes over-index on 1-2 aptitudes |
| **Existing data usage** | Boss pulls from real `events` table — zero content creation for boss thematic | Others need more handcrafted thematic content |
| **Player appeal** | "Explore darkness with your agents" is immediately graspable | "Navigate economic collapse" is more abstract |
| **Replayability** | Visibility resource creates different runs even on same layout | Good for all, but Shadow's ambush randomness adds natural variety |

---

## 8. REST API Endpoints

### Router: `backend/routers/resonance_dungeons.py`

```python
router = APIRouter(prefix="/api/v1/dungeons", tags=["resonance-dungeons"])
```

| Method | Path | Auth | Description | Request | Response |
|---|---|---|---|---|---|
| `GET` | `/available` | Member | List archetypes with active resonances above threshold | `?simulation_id=UUID` | `PaginatedResponse[AvailableDungeonResponse]` |
| `POST` | `/runs` | Editor+ | Start a new dungeon run | `DungeonRunCreate` + `?simulation_id=UUID` | `SuccessResponse[DungeonRunResponse]` |
| `GET` | `/runs/{run_id}` | Member | Get run metadata + current state snapshot | — | `SuccessResponse[DungeonRunDetailResponse]` |
| `GET` | `/runs/{run_id}/state` | Member | Get full client state (rooms, party, archetype state) | — | `SuccessResponse[DungeonClientState]` |
| `POST` | `/runs/{run_id}/move` | Editor+ | Move party to adjacent room | `{ room_index: int }` | `SuccessResponse[RoomEntryResponse]` |
| `POST` | `/runs/{run_id}/action` | Editor+ | Submit encounter choice or combat action | `DungeonAction` | `SuccessResponse[ActionResultResponse]` |
| `POST` | `/runs/{run_id}/combat/submit` | Editor+ | Submit combat actions for planning phase | `CombatSubmission` | `SuccessResponse[{ accepted: true }]` |
| `POST` | `/runs/{run_id}/scout` | Editor+ | Spy: reveal adjacent rooms (costs Visibility) | `{ agent_id: UUID }` | `SuccessResponse[ScoutResultResponse]` |
| `POST` | `/runs/{run_id}/rest` | Editor+ | Rest at rest site | `{ agent_ids: list[UUID] }` | `SuccessResponse[RestResultResponse]` |
| `POST` | `/runs/{run_id}/retreat` | Editor+ | Abandon dungeon (keep partial loot) | — | `SuccessResponse[RetreatResultResponse]` |
| `GET` | `/runs/{run_id}/events` | Member | Get dungeon event log | `?limit=50&offset=0` | `PaginatedResponse[DungeonEventResponse]` |
| `GET` | `/history` | Member | List past dungeon runs for simulation | `?simulation_id=UUID&limit=25` | `PaginatedResponse[DungeonRunResponse]` |

> **[REVIEW #16 — MEDIUM]** Multiplayer UPDATE RLS Issue
>
> The UPDATE policy on `resonance_dungeon_runs` (Section 2.2) only allows `started_by_id = auth.uid()`. In multiplayer mode, Player B needs to submit combat actions which trigger backend state changes that update the run record (rooms_cleared, current_depth, status). If these updates go through the user's JWT (not service_role), Player B's updates will be rejected by RLS.
>
> **Empfehlung:** Since all dungeon mutations go through the backend API (not direct Supabase client), the backend should use `admin_supabase` (service_role) for all dungeon run updates — consistent with how `heartbeat_service` and `bureau_response_service` use service_role for system-level state changes. The RLS UPDATE policy then only matters for edge cases (direct Supabase client access), where `started_by_id` restriction is appropriate as a safety net.

### Request/Response Schemas

```python
class AvailableDungeonResponse(BaseModel):
    archetype: str
    signature: str
    resonance_id: UUID
    magnitude: float
    susceptibility: float
    effective_magnitude: float
    suggested_difficulty: int  # 1-5 based on effective_magnitude
    suggested_depth: int  # 3-7 based on effective_magnitude
    last_run_at: datetime | None  # cooldown tracking
    available: bool  # False if cooldown active or run in progress

class DungeonRunDetailResponse(DungeonRunResponse):
    """Extended response with denormalized agent data."""
    party_agents: list[dict]  # agent name, portrait, aptitudes, profession
    events_count: int
    duration_seconds: int | None

class DungeonClientState(BaseModel):
    """Full state sent to client for rendering."""
    run_id: UUID
    archetype: str
    signature: str
    difficulty: int
    depth: int
    current_room: int

    # Graph (rooms the party has revealed)
    rooms: list[RoomNodeClient]  # only revealed rooms
    edges: list[tuple[int, int]]  # connections between revealed rooms

    # Party
    party: list[AgentCombatStateClient]

    # Archetype-specific
    archetype_state: dict  # e.g., Shadow: {"visibility": 2, "max_visibility": 3}

    # Combat (if active)
    combat: CombatStateClient | None

    # Phase
    phase: Literal["exploring", "encounter", "combat_planning",
                    "combat_resolving", "rest", "treasure", "boss"]
    phase_timer: PhaseTimer | None

class RoomNodeClient(BaseModel):
    index: int
    depth: int
    room_type: str
    connections: list[int]
    cleared: bool
    current: bool  # is party here?
    # Fog of war: unrevealed rooms show as "?" type
    revealed: bool

class AgentCombatStateClient(BaseModel):
    agent_id: UUID
    agent_name: str
    portrait_url: str | None
    condition: str
    stress: int
    stress_threshold: str  # "normal", "uneasy", "tense", "strained", "critical", "breaking"
    mood: int
    active_buffs: list[BuffDebuff]
    active_debuffs: list[BuffDebuff]
    aptitudes: dict[str, int]
    available_abilities: list[AbilityOption]
    personality_summary: str  # "cautious, analytical, reserved"

class BuffDebuff(BaseModel):
    id: str
    name: str
    icon: str  # icon key from icons.ts
    duration_rounds: int | None  # None = permanent
    description: str

class AbilityOption(BaseModel):
    id: str
    name: str
    school: str  # "spy", "guardian", etc.
    description: str
    check_info: str | None  # "Spy 8: 73% success" — pre-calculated
    cooldown_remaining: int  # 0 = ready
    is_ultimate: bool

class CombatStateClient(BaseModel):
    round: int
    max_rounds: int  # estimated
    enemies: list[EnemyCombatState]
    phase: Literal["assessment", "planning", "resolving", "outcome"]
    timer: PhaseTimer | None
    telegraphed_actions: list[TelegraphedAction]  # enemy intentions

class PhaseTimer(BaseModel):
    started_at: str  # ISO timestamp
    duration_ms: int
    phase: str

class TelegraphedAction(BaseModel):
    enemy_name: str
    intent: str  # "will attack Agent Kovacs", "preparing area stress attack"
    target: str | None
    threat_level: Literal["low", "medium", "high", "critical"]

class DungeonAction(BaseModel):
    """Generic action submission."""
    action_type: Literal["encounter_choice", "combat_action", "interact", "use_ability"]
    agent_id: UUID | None  # which agent performs
    choice_id: str | None  # for encounter choices
    ability_id: str | None  # for combat actions
    target_id: str | None  # enemy or ally UUID

class CombatSubmission(BaseModel):
    """All combat actions for one planning phase."""
    actions: list[CombatAction]

class CombatAction(BaseModel):
    agent_id: UUID
    ability_id: str
    target_id: str | None  # enemy or ally
```

---

## 9. DungeonEngineService — Instance Lifecycle & State Machine

### 9.1 Instance Manager (Module-Level Singleton)

```python
# backend/services/dungeon_engine_service.py

import asyncio
import logging
import time
from uuid import UUID

logger = logging.getLogger(__name__)

# ── Module-level instance store ───────────────────────
# In-memory dict. NOT shared across workers.
# For single-worker deployment (sufficient for <100 concurrent dungeons).
_active_instances: dict[str, DungeonInstance] = {}
_instance_last_activity: dict[str, float] = {}  # run_id → time.monotonic()
_combat_timers: dict[str, asyncio.Task] = {}
_distribution_timers: dict[str, asyncio.Task] = {}

INSTANCE_TTL_SECONDS = 1800       # 30 min inactive → auto-cleanup
MAX_CONCURRENT_PER_SIM = 1        # Only one active dungeon per simulation
COMBAT_PLANNING_TIMEOUT_MS = 45_000
DISTRIBUTION_TIMEOUT_MS = 300_000  # 5 min for loot distribution
```

**Instance TTL Cleanup Loop** (registered in FastAPI lifespan alongside
ResonanceScheduler, HeartbeatService, ScannerService, etc.):

```python
_CLEANUP_INTERVAL_SECONDS = 60

async def start_instance_cleanup() -> asyncio.Task:
    """Launch the instance cleanup loop. Called from app lifespan."""
    task = asyncio.create_task(_instance_cleanup_loop())
    return task

async def _instance_cleanup_loop() -> None:
    """Every 60s: evict stale in-memory instances + expire DB orphans."""
    while True:
        _evict_stale_instances()        # In-memory: check _instance_last_activity
        admin.rpc("fn_expire_abandoned_dungeon_runs", ...)  # DB: check updated_at
        await asyncio.sleep(_CLEANUP_INTERVAL_SECONDS)
```

Dual cleanup strategy:
- **In-memory:** `_instance_last_activity` tracks `time.monotonic()` on every
  `_get_instance()` call and on creation/recovery. `_evict_stale_instances()`
  removes entries inactive longer than `INSTANCE_TTL_SECONDS`, cancelling
  associated combat and distribution timers.
- **Database:** `fn_expire_abandoned_dungeon_runs(p_ttl_seconds)` SQL function
  (migration 163) bulk-updates `status='abandoned'` for rows where
  `updated_at < now() - TTL`. Handles server-restart orphans.

```
# [REVIEW #6 — RESOLVED] Checkpoint Strategy
# Originally timer-based (every 2 min). Now checkpoints on every state
# transition (Review #1). Zero gameplay loss, writes only when state changes.
```

### 9.1.1 Archetype Strategy Dispatch

All archetype-specific mechanics (visibility drain, stability countdown, etc.)
are delegated to `ArchetypeStrategy` subclasses in
`backend/services/dungeon/archetype_strategies.py`. The engine service calls
strategy methods via `get_archetype_strategy(instance.archetype)` — zero
archetype-specific conditionals in the engine itself.

```python
# archetype_strategies.py — Strategy Pattern ABC

class ArchetypeStrategy(ABC):
    """4 abstract core + 3 optional hooks."""
    def init_state(self) -> dict: ...           # Initial archetype_state
    def apply_drain(self, inst) -> str | None: ...  # Room-entry drain → banter trigger
    def apply_restore(self, inst, event) -> None: ... # Victory/rest/treasure/scout restore
    def apply_encounter_effects(self, inst, effects) -> None: ...  # Encounter deltas
    def get_ambient_stress_multiplier(self, inst) -> float: ...    # Default: 1.0
    def on_combat_round(self, inst) -> None: ...  # Default: no-op
    def on_failed_check(self, inst) -> None: ...  # Default: no-op

class ShadowStrategy(ArchetypeStrategy):  # Visibility mechanic
class TowerStrategy(ArchetypeStrategy):   # Stability countdown

_ARCHETYPE_STRATEGIES = {
    "The Shadow": ShadowStrategy(ARCHETYPE_CONFIGS["The Shadow"]),
    "The Tower": TowerStrategy(ARCHETYPE_CONFIGS["The Tower"]),
}
```

### 9.1.2 Structured Logging

All 21 dungeon-specific log calls use stdlib `extra={}` parameter, processed
by the existing structlog pipeline (`ExtraAdder` → `JSONRenderer` in production).

```python
def _log_extra(instance: DungeonInstance, **kwargs) -> dict:
    """Standard structured fields: run_id, sim_id, archetype, difficulty + kwargs."""
    return {
        "run_id": str(instance.run_id),
        "sim_id": str(instance.simulation_id),
        "archetype": instance.archetype,
        "difficulty": instance.difficulty,
        **kwargs,
    }

# Usage:
logger.info("Dungeon completed", extra=_log_extra(instance, outcome="completed", rooms_cleared=5))
# Production JSON: {"event": "Dungeon completed", "run_id": "...", "archetype": "The Shadow", "outcome": "completed", ...}
```

**Coverage by category:**
- Run lifecycle: `outcome` field ("completed", "wipe", "retreat", "stalemate", "distributed")
- Combat: `ability_id`, `agent_id`, `rounds`
- Encounters: `room_type`, `event_type`, `depth`
- Loot: `distributable`, `auto_apply`, `loot_items`, `skipped`
- Errors: `rpc`, `context`, `attempt`, `phase`
- Infrastructure (6 cleanup-loop calls): inline `extra={"run_id": ...}` without helper

### 9.2 State Machine

```
                    ┌──────────┐
                    │  CREATE   │
                    └────┬─────┘
                         │ generate graph, load agents
                         ▼
              ┌──────────────────────┐
         ┌───│     EXPLORING         │◄──────────────────┐
         │   │  (party moves rooms)  │                    │
         │   └──────┬──────┬────────┘                    │
         │          │      │                              │
         │   room has     room has                       │
         │   encounter    combat enemy                   │
         │          │      │                              │
         │          ▼      ▼                              │
         │   ┌──────────┐ ┌──────────────┐               │
         │   │ ENCOUNTER │ │COMBAT_PLANNING│               │
         │   │ (choices) │ │ (45s timer)  │               │
         │   └────┬─────┘ └──────┬───────┘               │
         │        │              │ all submitted / timeout│
         │   choice made         ▼                        │
         │        │        ┌──────────────┐               │
         │        │        │COMBAT_RESOLVE │               │
         │        │        │ (simultaneous)│               │
         │        │        └──────┬───────┘               │
         │        │               │                       │
         │        │        ┌──────▼───────┐               │
         │        │        │COMBAT_OUTCOME │               │
         │        │        │ (display 5s) │               │
         │        │        └──────┬───────┘               │
         │        │               │                       │
         │        └───────┬───────┘                       │
         │                │ room cleared                  │
         │                ▼                               │
         │         ┌──────────┐     more rooms?           │
         │         │ROOM_CLEAR │─────yes──────────────────┘
         │         └────┬─────┘
         │              │ no (boss defeated or all cleared)
         │              ▼
         │       ┌────────────┐
         │       │ COMPLETED   │
         │       │ (loot, xp)  │
         │       └─────────────┘
         │
         │ retreat command
         ▼
    ┌──────────┐          ┌──────────┐
    │ RETREATED │          │  WIPED    │
    │(part loot)│          │ (no loot) │
    └──────────┘          └──────────┘
```

### 9.3 Core Orchestration Methods

```python
class DungeonEngineService:

    @classmethod
    async def create_run(
        cls, supabase: Client, simulation_id: UUID, user_id: UUID,
        body: DungeonRunCreate, admin_supabase: Client,
    ) -> dict:
        """
        1. Validate: no active run for this sim, resonance above threshold
        2. Fetch party agents (aptitudes, personality, mood, stress, needs)
        3. Generate dungeon graph (archetype config + difficulty)
        4. Create DB record (resonance_dungeon_runs)
        5. Create in-memory DungeonInstance
        6. Start checkpoint timer
        7. Broadcast dungeon:start on simulation channel
        8. Return run + initial client state
        """

    @classmethod
    async def move_to_room(
        cls, supabase: Client, run_id: UUID, room_index: int,
    ) -> dict:
        """
        1. Validate: room is adjacent, room is revealed (or adjacent to current)
        2. Update current_room in instance
        3. Process room entry:
           a. If combat room → generate enemies, transition to COMBAT_PLANNING
           b. If encounter → load encounter template, transition to ENCOUNTER
           c. If rest → transition to REST
           d. If treasure → generate loot, transition to ROOM_CLEAR
           e. If boss → generate boss encounter, transition to COMBAT_PLANNING
        4. Generate banter (template-based, personality-filtered)
        5. Apply archetype effects (Shadow: -1 Visibility)
        6. Create dungeon_event record
        7. Broadcast room_entered on dungeon channel
        8. Return new room state + encounter/combat data
        """

    @classmethod
    async def submit_combat_actions(
        cls, supabase: Client, run_id: UUID, user_id: UUID,
        submission: CombatSubmission,
    ) -> dict:
        """
        1. Validate: instance in COMBAT_PLANNING phase
        2. Validate: all agent_ids belong to submitting player
        3. Store actions in instance action queue
        4. If all players submitted → resolve immediately
        5. Else: wait for timer expiration (auto-defend for missing actions)
        """

    @classmethod
    async def resolve_combat_round(cls, run_id: UUID) -> dict:
        """
        Called when all actions submitted or timer expires.
        1. Collect all submitted actions (auto-defend for missing)
        2. Generate enemy actions (template-based AI)
        3. Resolve simultaneously:
           a. Apply attack/defend/ability effects
           b. Calculate damage via Aptitude checks
           c. Apply stress changes
           d. Check condition transitions (Operational→Stressed→Wounded→Afflicted)
           e. Check for Resolve (stress > 800: **40% Virtue / 60% Affliction** *(Review #11: was 25%/75%)*)
           f. Check for party wipe (all agents Captured/Afflicted)
           g. Check for enemy defeat
           h. **Check for stalemate** (round >= max_rounds → room cleared, +80 stress, no loot)
        4. Generate narrative text (template + personality flavor)
        5. Create dungeon_events records
        6. Broadcast combat_resolved
        7. Transition to COMBAT_OUTCOME (5s display)
        8. Then → ROOM_CLEAR or next combat round
        """

    @classmethod
    async def _start_combat_timer(cls, run_id: UUID, duration_ms: int = 45000):
        """Asyncio task that auto-resolves after timer expires."""
        async def _timer():
            await asyncio.sleep(duration_ms / 1000)
            instance = _active_instances.get(str(run_id))
            if instance and instance.phase == "combat_planning":
                await cls.resolve_combat_round(run_id)
        task = asyncio.create_task(_timer())
        _combat_timers[str(run_id)] = task

    # [REVIEW #17 — MEDIUM] Checkpoint Serialization Size
    # `instance.model_dump()` serializes the ENTIRE DungeonInstance to JSONB.
    # A full dungeon with 15-20 RoomNodes, 4 AgentCombatStates (each with
    # aptitudes, personality, buffs, debuffs), combat state, and archetype_state
    # could easily be 50-100KB of JSONB. At 120s intervals with 50 concurrent
    # dungeons, that's 50 × 100KB / 120s ≈ 42KB/s sustained write to a single
    # JSONB column — not catastrophic but unnecessary.
    #
    # Empfehlung: If keeping timer-based checkpoints (see Review #6), consider
    # differential checkpoints: only write fields that changed since last
    # checkpoint. Or, since the room graph is static after generation, store
    # it separately (once, on create) and only checkpoint mutable state
    # (current_room, party state, archetype_state, rooms_cleared).

    @classmethod
    async def checkpoint(cls, supabase: Client, run_id: UUID):
        """Persist in-memory state to DB for crash recovery."""
        instance = _active_instances.get(str(run_id))
        if not instance:
            return
        await supabase.table("resonance_dungeon_runs").update({
            "current_depth": instance.depth,
            "rooms_cleared": instance.rooms_cleared,
            "status": "active",
            "checkpoint_state": instance.model_dump(),
            "checkpoint_at": datetime.now(UTC).isoformat(),
        }).eq("id", str(run_id)).execute()

    @classmethod
    async def cleanup_expired(cls, admin_supabase: Client, simulation_id: UUID):
        """Called by heartbeat. Expire abandoned runs."""
        cutoff = datetime.now(UTC) - timedelta(seconds=INSTANCE_TTL_SECONDS)
        await admin_supabase.table("resonance_dungeon_runs").update({
            "status": "abandoned",
            "completed_at": datetime.now(UTC).isoformat(),
        }).eq("simulation_id", str(simulation_id)).eq("status", "active") \
          .lt("updated_at", cutoff.isoformat()).execute()

    @classmethod
    async def recover_from_checkpoint(cls, supabase: Client, run_id: UUID):
        """Restore in-memory instance from DB checkpoint after server restart."""
        run = await supabase.table("resonance_dungeon_runs") \
            .select("*").eq("id", str(run_id)) \
            .eq("status", "active").maybe_single().execute()
        if run.data and run.data.get("checkpoint_state"):
            instance = DungeonInstance(**run.data["checkpoint_state"])
            _active_instances[str(run_id)] = instance
            return instance
        return None
```

---

## 10. Enemy Design — The Shadow Bestiary

### 10.1 Enemy Data Model

```python
class EnemyTemplate(BaseModel):
    """Definition of an enemy type."""
    id: str  # e.g., "shadow_echo_violence"
    name_en: str
    name_de: str
    archetype: str  # "The Shadow"

    # Stats
    condition_threshold: int  # hits to defeat (not HP — condition steps)
    stress_resistance: int  # 0-500, reduces incoming stress damage
    threat_level: Literal["minion", "standard", "elite", "boss"]

    # Offensive
    attack_aptitude: str  # which aptitude their attacks target
    attack_power: int  # 1-10, scales damage
    stress_attack_power: int  # 1-10, scales stress inflicted
    telegraphed_intent: bool  # Into the Breach style: show next action?

    # Defensive
    evasion: int  # 0-100, chance to dodge attacks
    resistances: list[str]  # aptitude schools they resist (e.g., ["propagandist"])
    vulnerabilities: list[str]  # aptitude schools they're weak to (e.g., ["spy"])

    # Behavior AI (weighted action selection)
    action_weights: dict[str, int]  # {"attack": 50, "stress_attack": 30, "defend": 20}

    # Flavor
    description_en: str
    description_de: str
    ambient_text: list[str]  # random text shown when enemy is present
```

### 10.2 Shadow Enemies (Complete Set)

#### Minions (1-2 condition steps, threat: low)

**Shadow Wisp**
```python
EnemyTemplate(
    id="shadow_wisp",
    name_en="Shadow Wisp", name_de="Schattenglimmer",
    archetype="The Shadow",
    condition_threshold=1, stress_resistance=50,
    threat_level="minion",
    attack_aptitude="infiltrator", attack_power=2, stress_attack_power=4,
    telegraphed_intent=True,
    evasion=40, resistances=["assassin"], vulnerabilities=["spy"],
    action_weights={"stress_attack": 60, "evade": 30, "ambient": 10},
    description_en="A flickering presence at the edge of perception. It doesn't attack the body — it erodes certainty.",
    description_de="Eine flackernde Prasenz am Rand der Wahrnehmung. Sie greift nicht den Korper an — sie zersetzt Gewissheit.",
    ambient_text=[
        "The wisp drifts closer, then retreats. Testing.",
        "You feel it before you see it — a chill that starts behind the eyes.",
    ],
)
```

**Shadow Tendril**
```python
EnemyTemplate(
    id="shadow_tendril",
    name_en="Shadow Tendril", name_de="Schattenfaden",
    condition_threshold=2, stress_resistance=0,
    threat_level="minion",
    attack_aptitude="guardian", attack_power=4, stress_attack_power=1,
    telegraphed_intent=True,
    evasion=10, resistances=[], vulnerabilities=["saboteur", "assassin"],
    action_weights={"attack": 70, "grapple": 30},  # grapple = immobilize 1 agent for 1 round
    description_en="A black appendage reaching from the walls. Patient. Methodical.",
)
```

#### Standard (2-3 condition steps, threat: medium)

**Echo of Violence**
```python
EnemyTemplate(
    id="shadow_echo_violence",
    name_en="Echo of Violence", name_de="Gewaltecho",
    condition_threshold=3, stress_resistance=200,
    threat_level="standard",
    attack_aptitude="assassin", attack_power=6, stress_attack_power=5,
    telegraphed_intent=True,
    evasion=20, resistances=["propagandist"], vulnerabilities=["spy", "guardian"],
    action_weights={"attack": 40, "stress_attack": 30, "ambush": 20, "defend": 10},
    description_en="A replay of violence that once scarred this place. It moves with the precision of memory — every strike has happened before.",
    ambient_text=[
        "The echo replays a death. Not yours. Not yet.",
        "Its movements are familiar. You've seen this fighting style in your simulation's history.",
    ],
)
```

**Paranoia Shade**
```python
EnemyTemplate(
    id="shadow_paranoia_shade",
    name_en="Paranoia Shade", name_de="Paranoiaschatten",
    condition_threshold=2, stress_resistance=300,
    threat_level="standard",
    attack_aptitude="propagandist", attack_power=2, stress_attack_power=8,
    telegraphed_intent=False,  # Cannot predict — it LIES
    evasion=30, resistances=["spy"], vulnerabilities=["propagandist", "guardian"],
    action_weights={"stress_attack": 50, "disinformation": 30, "hide": 20},
    description_en="It whispers. Not lies, exactly — plausible fears. Things your agents already suspect about each other.",
    # Special: disinformation action shows FALSE telegraphed intents for other enemies
)
```

#### Elite (4-5 condition steps, threat: high)

**The Remnant**
```python
EnemyTemplate(
    id="shadow_remnant",
    name_en="The Remnant", name_de="Der Uberrest",
    condition_threshold=5, stress_resistance=400,
    threat_level="elite",
    attack_aptitude="assassin", attack_power=8, stress_attack_power=7,
    telegraphed_intent=True,
    evasion=25, resistances=["infiltrator", "saboteur"], vulnerabilities=["spy"],
    action_weights={"attack": 30, "stress_attack": 25, "summon_wisps": 20, "aoe_fear": 15, "defend": 10},
    description_en="Formed from the simulation's strongest unresolved conflict. It remembers what your agents have tried to forget.",
    # Special: summon_wisps spawns 1-2 Shadow Wisps per use. aoe_fear = party-wide stress +100.
    # Special: takes 50% reduced damage while Wisps are alive.
)
```

### 10.3 Combat Damage Formulas

```python
def calculate_attack_damage(
    attacker_aptitude: int,  # 3-9
    attacker_power: int,  # 1-10 (from ability or enemy template)
    defender_evasion: int,  # 0-100
    is_vulnerable: bool,  # attacker's school in defender's vulnerabilities
    is_resistant: bool,  # attacker's school in defender's resistances
    visibility: int,  # Shadow-specific: 0-3
) -> tuple[bool, int]:
    """Returns (hit: bool, condition_steps: int)."""

    # 1. Hit check
    hit_chance = 55 + (attacker_aptitude * 3) - (defender_evasion * 0.5)
    if visibility == 0:
        hit_chance -= 15  # blind penalty
    hit_chance = max(10, min(95, hit_chance))  # floor 10%, cap 95%
    hit = random.randint(1, 100) <= hit_chance

    if not hit:
        return False, 0

    # 2. Damage (condition steps)
    base_damage = 1  # minimum 1 condition step
    if attacker_power >= 7:
        base_damage = 2  # powerful attacks deal 2 steps
    if is_vulnerable:
        base_damage += 1  # exploit weakness
    if is_resistant:
        base_damage = max(1, base_damage - 1)  # resist

    return True, base_damage

def calculate_stress_damage(
    attacker_stress_power: int,  # 1-10
    defender_resilience: float,  # 0-1 from personality
    defender_neuroticism: float,  # 0-1 from personality
    has_guardian_shield: bool,
) -> int:
    """Returns stress points inflicted."""
    base = attacker_stress_power * 20  # 20-200 range
    resilience_reduction = base * defender_resilience * 0.4  # up to 40% reduction
    neuroticism_amplify = base * defender_neuroticism * 0.3  # up to 30% increase
    if has_guardian_shield:
        base *= 0.5  # Guardian absorbs 50% stress
    return max(10, int(base - resilience_reduction + neuroticism_amplify))
```

> **[REVIEW #10 — HIGH]** Condition Track Progression Too Lethal
>
> The condition system allows catastrophic one-hit outcomes:
>
> - Elite enemy "The Remnant" has `attack_power: 8` → `base_damage = 2` (power ≥ 7).
> - If the target is vulnerable to assassin school: `base_damage += 1` → **3 steps**.
> - 3 steps from Operational = **Afflicted in a single hit** (see transition table below).
> - An Afflicted agent triggers Resolve Check at 75% affliction rate → agent effectively removed from combat with one unlucky hit.
>
> **Vergleich:**
> - **Darkest Dungeon:** HP pools absorb 3-6 hits before Death's Door. Even Death's Door has a % chance to survive each subsequent hit. The horror comes from attrition across many hits, not instant removal.
> - **Into the Breach:** Mechs have 2-4 HP. Even 1-HP damage is survivable and repairable.
> - **Slay the Spire:** Block mechanic prevents most damage entirely. Even bosses rarely one-shot.
>
> **Das Problem:** A 3-5 round combat with instant-removal possible on round 1 feels like coin-flip game design, not strategic game design. The planning phase becomes meaningless if the outcome is "pray the elite doesn't target your unshielded agent."
>
> **Empfehlung:** Either (a) cap maximum condition steps per hit at 2 (devastating but not run-ending), or (b) add a "Death's Door" equivalent — Afflicted agents get one more round before Captured, with a chance-based survival check each hit, or (c) require 2 separate damage events to cause Afflicted (not just raw steps from one hit).

### 10.4 Condition Track Transitions (Precise)

```python
CONDITION_TRANSITIONS = {
    # (current_condition, damage_steps) → new_condition
    ("operational", 1): "stressed",
    ("operational", 2): "wounded",  # critical hit skips stressed
    ("operational", 3): "afflicted",  # devastating hit
    ("stressed", 1): "wounded",
    ("stressed", 2): "afflicted",
    ("wounded", 1): "afflicted",
    ("wounded", 2): "captured",
    ("afflicted", 1): "captured",
}

def apply_condition_damage(agent: AgentCombatState, steps: int) -> str:
    """Apply damage steps, return new condition."""
    key = (agent.condition, min(steps, 3))
    new_condition = CONDITION_TRANSITIONS.get(key, "captured")
    agent.condition = new_condition

    # Side effects
    if new_condition == "stressed":
        agent.stress += 100
    elif new_condition == "wounded":
        agent.stress += 200
        # All physical aptitude checks -30%
    elif new_condition == "afflicted":
        agent.stress = max(agent.stress, 800)
        # Trigger Resolve Check
    elif new_condition == "captured":
        # Agent removed from combat
        pass

    return new_condition
```

---

## 11. Graph Generation Algorithm (Implementation-Ready)

```python
import random
from typing import Literal

def generate_dungeon_graph(
    archetype: str,
    difficulty: int,
    depth: int,
    seed: int | None = None,
) -> list[RoomNode]:
    """
    Generate an FTL/Slay-the-Spire style node graph.

    Returns a list of RoomNode objects forming a directed acyclic graph.
    Algorithm inspired by Slay the Spire's 7x15 grid reduced to
    our smaller scale (5-7 depths, 1-3 rooms per layer).
    """
    if seed is not None:
        random.seed(seed)

    config = ARCHETYPE_ROOM_DISTRIBUTIONS[archetype]
    rooms: list[RoomNode] = []
    idx = 0

    # ── Layer 0: Entrance ──────────────────────────
    rooms.append(RoomNode(index=idx, depth=0, room_type="entrance",
                          connections=[], revealed=True, cleared=True))
    idx += 1
    prev_layer = [0]

    # ── Layers 1 to depth-1: Content ───────────────
    for d in range(1, depth):
        # Width: bell curve (narrow at start/end, wide in middle)
        progress = d / depth
        if progress < 0.3:
            width = random.choice([1, 2])  # narrow start
        elif progress < 0.7:
            width = random.choice([2, 2, 3])  # wide middle
        else:
            width = random.choice([1, 2])  # narrow toward boss

        # Scale with difficulty
        if difficulty >= 4 and width < 3:
            width = min(3, width + (1 if random.random() < 0.3 else 0))

        layer = []
        for _ in range(width):
            room_type = _pick_room_type(d, depth, config, difficulty)
            loot_tier = _assign_loot_tier(room_type, d, depth, difficulty)
            room = RoomNode(index=idx, depth=d, room_type=room_type,
                            connections=[], loot_tier=loot_tier)
            rooms.append(room)
            layer.append(idx)
            idx += 1

        # ── Connect layers ─────────────────────────
        # Each room in prev_layer connects to 1-2 rooms in current layer
        # Each room in current layer must have ≥1 incoming connection
        connected = set()
        for p_idx in prev_layer:
            # Connect to 1-2 rooms in next layer
            n_connections = min(len(layer), random.choice([1, 1, 2]))
            targets = random.sample(layer, n_connections)
            for t in targets:
                rooms[p_idx].connections.append(t)
                connected.add(t)

        # Ensure all rooms in layer have at least 1 incoming
        for l_idx in layer:
            if l_idx not in connected:
                source = random.choice(prev_layer)
                rooms[source].connections.append(l_idx)

        prev_layer = layer

    # ── Final Layer: Boss ──────────────────────────
    boss = RoomNode(index=idx, depth=depth, room_type="boss",
                    connections=[], loot_tier=3)
    rooms.append(boss)
    for p_idx in prev_layer:
        rooms[p_idx].connections.append(idx)

    # ── Reveal first layer (player sees immediate choices) ──
    for room in rooms:
        if room.depth <= 1:
            room.revealed = True

    return rooms

> **[REVIEW #18 — HIGH]** `_pick_room_type` Bug: Guaranteed Rest Applies Per-Room, Not Per-Layer
>
> The function below is called once per room. The `if current_depth == mid: return "rest"` check fires for EVERY room at that depth. If the mid-depth layer has 3 rooms (width=3), ALL THREE will be forced to type "rest". This turns an entire floor into rest rooms — not the intended "guarantee at least one rest site."
>
> **Empfehlung:** Move the guaranteed-rest constraint to the layer generation loop in `generate_dungeon_graph()`. After generating all rooms for a layer at `mid` depth, replace exactly one random room's type with "rest" (if none are already rest). This preserves variety while guaranteeing the safety valve.

> **[REVIEW #19 — MEDIUM]** Graph Topology Simpler Than Slay the Spire — Player Choice Quality
>
> Slay the Spire's map generation uses a 7×15 grid with a critical constraint: **paths cannot cross**. This creates meaningful routing decisions because the player sees the FULL map (all room types revealed) and must plan a path that avoids elites when weak or routes through rest sites before the boss.
>
> This spec's algorithm has no non-crossing constraint and, crucially, most rooms are **unrevealed** (fog of war, especially in Shadow). The player's choice is effectively "go left or right" with no strategic information. The Spy's scout ability reveals adjacent rooms, but by then you're already committed to the current layer.
>
> **Frage:** Is blind choice intentional (the Shadow dungeon IS about navigating darkness)? If yes, this is a valid design decision — but other archetypes (Tower, Prometheus, Overthrow) should reveal the full map. If no, consider: reveal room TYPES (not details) for all rooms, but keep encounter contents hidden. This matches StS and gives informed routing decisions.

def _pick_room_type(
    current_depth: int, max_depth: int,
    config: dict, difficulty: int,
) -> RoomType:
    """Weighted random room type selection with constraints."""
    weights = dict(config["base_weights"])  # e.g., {"combat": 50, "encounter": 20, ...}

    # Constraint: no elites before depth 2
    if current_depth < 2:
        weights.pop("elite", None)

    # Constraint: no exit rooms before depth 3 (Review #8)
    if current_depth < 3:
        weights.pop("exit", None)

    # Constraint: difficulty increases elite probability
    if "elite" in weights:
        weights["elite"] = weights["elite"] + (difficulty * 2)

    # Weighted selection
    types = list(weights.keys())
    wts = list(weights.values())
    return random.choices(types, weights=wts, k=1)[0]

# NOTE: Guaranteed rest site near 60% depth is enforced PER-LAYER in
# generate_dungeon_graph(), NOT here. Review #18 found that placing the
# guarantee in _pick_room_type forced ALL rooms at mid-depth to be rest rooms.
# Fix: after generating a layer at mid_depth, if no rest room exists, replace
# exactly one random room with "rest". See dungeon_generator.py lines 81-91.

def _assign_loot_tier(
    room_type: str, depth: int, max_depth: int, difficulty: int,
) -> int:
    """Assign loot tier: 0=none, 1=minor, 2=major, 3=legendary."""
    if room_type == "boss":
        return 3
    if room_type == "treasure":
        return 2 if depth > max_depth * 0.5 else 1
    if room_type == "elite":
        return 2
    if room_type == "combat":
        return 1 if random.random() < 0.3 else 0  # 30% chance of minor loot
    return 0

# ── Archetype-specific distributions ──────────────

> **[REVIEW #8 — MEDIUM]** "exit" Room Type Undefined
>
> All 8 archetype distribution tables below include an `"exit"` room type with 5-10% weight, and `RoomType` Literal (Section 2.3) includes `"exit"`. However, **nowhere in the spec is `exit` described**: not in the encounter palette, not in the room descriptions, not in the formatter switch statement (Section 14.5, line ~2308), and not in the graph generation algorithm. What happens when a player enters an `exit` room? Is it an early-exit opportunity (flee the dungeon with partial loot)? A teleport? A shortcut?
>
> **Empfehlung:** Define the `exit` room type explicitly. Suggestion: "Early Exit — allows the party to leave the dungeon with partial loot, skipping the boss. Loot quality = Tier 1 only. Available at depth ≥ 3. Choosing exit triggers retreat narrative."

> **[REVIEW #9 — LOW]** Room Type Distribution Doesn't Sum to 100
>
> The Shadow weights: 40+30+5+5+15+5 = 100 ✓, but The Overthrow: 20+45+5+10+10+10 = 100 ✓. All check out mathematically. However, `_pick_room_type()` pops `"elite"` before depth 2 and adds `difficulty * 2` to elite weight — this shifts the effective distribution significantly at high difficulty. The guaranteed rest at mid-depth also isn't reflected in these base weights. Consider documenting effective distributions at each difficulty level.

ARCHETYPE_ROOM_DISTRIBUTIONS = {
    "The Shadow": {
        "base_weights": {"combat": 40, "encounter": 30, "elite": 5, "rest": 5, "treasure": 15, "exit": 5},
    },
    "The Tower": {
        "base_weights": {"combat": 40, "encounter": 25, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    },
    "The Devouring Mother": {
        "base_weights": {"combat": 35, "encounter": 30, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    },
    "The Deluge": {
        "base_weights": {"combat": 30, "encounter": 35, "elite": 5, "rest": 5, "treasure": 15, "exit": 10},
    },
    "The Overthrow": {
        "base_weights": {"combat": 20, "encounter": 45, "elite": 5, "rest": 10, "treasure": 10, "exit": 10},
    },
    "The Prometheus": {
        "base_weights": {"combat": 30, "encounter": 35, "elite": 5, "rest": 10, "treasure": 15, "exit": 5},
    },
    "The Awakening": {
        "base_weights": {"combat": 25, "encounter": 40, "elite": 5, "rest": 15, "treasure": 10, "exit": 5},
    },
    "The Entropy": {
        "base_weights": {"combat": 30, "encounter": 35, "elite": 5, "rest": 10, "treasure": 15, "exit": 5},
    },
}
```

---

## 12. Difficulty Scaling Formulas

```python
DIFFICULTY_MULTIPLIERS = {
    # difficulty: (enemy_power, enemy_condition, stress_mult, loot_mult, depth)
    1: {"enemy_power": 1.0, "enemy_condition": 1.0, "stress_mult": 0.8, "loot_quality": 1.0, "depth": 4},
    2: {"enemy_power": 1.15, "enemy_condition": 1.0, "stress_mult": 1.0, "loot_quality": 1.15, "depth": 5},
    3: {"enemy_power": 1.3, "enemy_condition": 1.5, "stress_mult": 1.2, "loot_quality": 1.3, "depth": 5},
    4: {"enemy_power": 1.5, "enemy_condition": 2.0, "stress_mult": 1.4, "loot_quality": 1.5, "depth": 6},
    5: {"enemy_power": 1.75, "enemy_condition": 2.0, "stress_mult": 1.6, "loot_quality": 1.75, "depth": 7},
}

# Scaling per depth within a run (deeper = harder):
# enemy_power_at_depth = base_power * (1 + 0.1 * current_depth)
# stress_per_room_base = 15 + (5 * current_depth) + (10 * difficulty)
```

---

## 13. Loot Tables — The Shadow (Complete)

### Tier 1: Minor (combat rooms, 30% drop)

| Item | Effect | Drop Weight |
|---|---|---|
| **Shadow Residue** | Agent stress -50 after dungeon | 40 |
| **Dark Insight** | Agent gains Memory: "Learned to sense movement in darkness" (importance 4) | 30 |
| **Silenced Step** | Agent Infiltrator checks +5% for rest of dungeon | 20 |
| **Fear Extract** | Consumable: one Propagandist ability deals +50% stress this dungeon | 10 |

### Tier 2: Major (elite/treasure rooms)

| Item | Effect | Drop Weight |
|---|---|---|
| **Shadow Attunement Shard** | Permanent: one agent gains `shadow_attuned` moodlet (+5 Stimulation decay rate, "drawn to darkness") | 30 |
| **Echo Fragment** | Creates a Reflection Memory for one agent about the dungeon experience (importance 7) | 25 |
| **Darkened Lens** | Permanent: one agent gains +1 Spy aptitude passive in ALL future Shadow dungeons | 20 |
| **Conflict Residue** | Can be applied to one Event in simulation: reduces impact_level by 1 | 15 |
| **Shadow Map** | Next Shadow dungeon run: all rooms pre-revealed (Visibility starts at 3) | 10 |

> **[REVIEW #20 — HIGH]** Permanent Aptitude Stacking Uncapped — Balance Breaker
>
> Shadow Attunement (Tier 3 loot) grants **permanent +1 aptitude** and increases the budget from 36→37. This stacks across dungeon runs. After 5 completed Shadow dungeons, an agent has budget 41 — a 14% power increase across ALL game systems (operative success, skill checks, combat).
>
> **Systemische Auswirkung:** Aptitude scores feed into:
> - Operative success probability: +0.03 per point → +0.15 after 5 runs
> - Combat damage: `base_damage = 2` at power ≥ 7 → easier to reach
> - Skill checks: +3% per point → +15% success chance
> - The 36-point budget exists specifically to force tradeoffs. Uncapped stacking removes this constraint entirely.
>
> **Vergleich:** Darkest Dungeon trinkets are equipped (limited slots) and lost on death. Slay the Spire relics are per-run. Hades permanent upgrades are capped (Mirror of Night has max levels). No successful roguelike allows unbounded permanent stat increases.
>
> **Empfehlung:** One of:
> - (a) Cap bonus aptitude points at +2 per agent total (budget max 38). Still meaningful but doesn't break the game.
> - (b) Make dungeon aptitude bonuses temporary (last 10 heartbeat ticks, like Authority Fragment).
> - (c) Make it a one-time reward per archetype per agent (8 possible +1s total across all archetypes = budget cap 44, which is still bounded).
> - (d) The bonus replaces a point instead of adding one: redistribute, don't inflate.

### Tier 3: Legendary (boss room, guaranteed)

| Item | Effect | Condition |
|---|---|---|
| **Shadow Attunement** | One agent: permanent +1 Assassin OR Spy aptitude (budget 36→37) | Always on boss kill |
| **Scar Tissue Reduction** | Simulation: scar_tissue for the source event decreases by 0.05 | If boss was event-based |
| **Shadow Memory** | High-importance Memory (importance 9): "Confronted the darkness and prevailed" — affects agent autonomous behavior (more brave, less avoidant) | Always |
| **Narrative Arc Pressure** | If matching arc exists: pressure reduced by 0.15 × difficulty | If arc active |

---

## 14. Interface Concept — Terminal + Surrounding Components

### 14.1 Layout Architecture

The dungeon interface is a **hybrid** — the terminal remains the primary interaction, but it is surrounded by **HUD components** that display visual information that text alone cannot convey efficiently.

```
┌─────────────────────────────────────────────────────────────────────┐
│ DUNGEON HEADER BAR (thin, across top)                               │
│ ┌──────────┐  ┌─────────────┐  ┌───────────┐  ┌────────────────┐  │
│ │ ARCHETYPE │  │ DEPTH 3/5   │  │ ROOMS 7/15│  │ VISIBILITY ██░ │  │
│ │ THE SHADOW│  │ ████████░░  │  │           │  │ [2/3]          │  │
│ └──────────┘  └─────────────┘  └───────────┘  └────────────────┘  │
├─────────────────────────────────────────────────┬───────────────────┤
│                                                 │ PARTY PANEL       │
│                                                 │ (right sidebar)   │
│                                                 │                   │
│   ┌─────────────────────────────────────┐       │ ┌───────────────┐ │
│   │                                     │       │ │ KOVACS        │ │
│   │        BUREAU TERMINAL              │       │ │ [portrait]    │ │
│   │        (existing component)         │       │ │ ████████░░    │ │
│   │                                     │       │ │ Stress: 145   │ │
│   │   > scout                           │       │ │ OPERATIONAL   │ │
│   │                                     │       │ │ Spy 8 Gdn 3  │ │
│   │   Agent Kovacs scans the darkness...│       │ └───────────────┘ │
│   │   [OBSERVE SUCCESS — Spy 8: 79%]    │       │ ┌───────────────┐ │
│   │   → Adjacent rooms revealed         │       │ │ MIRA          │ │
│   │                                     │       │ │ [portrait]    │ │
│   │   > _                               │       │ │ ██████████░░  │ │
│   │                                     │       │ │ Stress: 380   │ │
│   └─────────────────────────────────────┘       │ │ STRESSED      │ │
│                                                 │ │ Prop 7 Gdn 5 │ │
│   ┌─────────────────────────────────────┐       │ └───────────────┘ │
│   │ DUNGEON MAP (ASCII, collapsible)    │       │ ┌───────────────┐ │
│   │                                     │       │ │ VOSS          │ │
│   │  [E]──[C]──[C]                      │       │ │ [portrait]    │ │
│   │         │  ╲ │                       │       │ │ ████░░░░░░░░  │ │
│   │        [?] [!]                       │       │ │ Stress: 90    │ │
│   │         │   │                        │       │ │ OPERATIONAL   │ │
│   │        [R]─[T]                       │       │ │ Asn 7 Sab 5  │ │
│   │         │                            │       │ └───────────────┘ │
│   │     * [C]──[C]                       │       │                   │
│   │         │  ╲ │                        │       │                   │
│   │          [B]                          │       │                   │
│   └─────────────────────────────────────┘       │                   │
│                                                 │                   │
│   ┌─────────────────────────────────────┐       │                   │
│   │ QUICK ACTIONS / COMBAT ACTIONS      │       │                   │
│   │ [Scout] [Move] [Rest] [Retreat]     │       │                   │
│   │ [Map]   [Look] [Talk] [Interact]    │       │                   │
│   └─────────────────────────────────────┘       │                   │
├─────────────────────────────────────────────────┴───────────────────┤
│ COMBAT BAR (appears only during combat, replaces quick actions)     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│ │ KOVACS       │ │ MIRA         │ │ VOSS         │ │ TIMER      │ │
│ │ [Observe]    │ │ [Demoralize] │ │ [Precision]  │ │ ██████░░░░ │ │
│ │ [Analyze]    │ │ [Inspire]    │ │ [Ambush]     │ │ 18s        │ │
│ │ [Counter]    │ │ [Rally]      │ │ [Exploit]    │ │            │ │
│ │              │ │              │ │              │ │ [READY]    │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 14.2 Component Breakdown

#### A. Dungeon Header Bar (`VelgDungeonHeader.ts`)

A thin bar above the terminal showing run-level information. Reuses existing design patterns from `EpochCommandCenter` banner.

```typescript
// Uses existing design tokens:
// - Corner brackets (::before/::after from BureauTerminal pattern)
// - Monospace text (--font-mono)
// - Amber accent (--color-accent-amber)
// - Scanline subtle overlay

// Archetype badge: colored per resonance signature
// Depth progress: existing RP meter bar pattern (scaleX animation)
// Visibility: 3-pip display (filled/empty diamonds — existing gem pattern from VelgGameCard)
```

**Micro-animations:**
- Depth progress bar animates on floor transition (400ms ease-out)
- Visibility pips pulse when changing (phosphor-persist pattern)
- Archetype name has subtle chromatic aberration (system line pattern)

#### B. Party Panel (`VelgDungeonPartyPanel.ts`)

Right sidebar showing agent status. Uses `VelgAvatar` for portraits, existing stress/mood display patterns.

```
┌───────────────────┐
│ ┌────┐ KOVACS     │  ← VelgAvatar (sm: 32px) + name
│ │    │ SPY 8      │  ← Primary aptitude, colored pip
│ └────┘            │
│ Condition: ██████████ OPERATIONAL   │  ← Green bar
│ Stress:    ████░░░░░░ 145/1000     │  ← Amber bar, pulses at >500
│ Mood:      ██████████ +32 Content  │  ← Green/red gradient
│ ┌─────────────────┐│
│ │ ◆ Sharp Focus   ││  ← Active buff (green diamond)
│ │ ◇ Fear Residue  ││  ← Active debuff (red diamond)
│ └─────────────────┘│
└───────────────────┘
```

**Condition bar colors (existing design token mapping):**
- Operational: `--color-success` (green)
- Stressed: `--color-warning` (amber) + subtle pulse animation
- Wounded: `--color-danger` (red) + pulse
- Afflicted: `--color-danger` + chromatic aberration + `pulse-glow` 2s
- Captured: `--color-text-muted` + strikethrough name

**Stress bar thresholds (6-tier label system, visual escalation):**
- 0-99: Calm amber fill (no label)
- 100-249 (10%): Label "UNEASY", slightly brighter amber
- 250-399 (25%): Label "TENSE", brighter amber
- 400-599 (40%): Label "STRAINED", orange-red gradient, `pulse-glow` animation starts
- 600-799 (60%): Label "CRITICAL", deep red, rapid pulse
- 800-1000 (80%): Label "BREAKING", deep red, rapid pulse intensified

**Micro-animations:**
- Bar changes animate `transition: width var(--duration-slow) var(--ease-out)`
- Buff/debuff pills slide in with `field-reveal` animation (existing)
- On condition change: flash entire card border with new color (300ms)
- Portrait gets CRT distortion filter at Afflicted (`SvgFilters.ts: entropy-dissolve`)

#### C. Dungeon Map (`VelgDungeonMap.ts`)

Collapsible ASCII map below the terminal OR rendered as a minimal SVG node graph.

**ASCII Mode (in terminal output):**
```
DUNGEON MAP — THE SHADOW, Depth 3/5

  [E]─────[C]─────[C]
            │    ╲   │
           [?]   [!]
            │     │
           [R]───[T]
            │
        * [C]─────[C]
            │    ╲   │
             [B]

  Legend: [E] Entrance  [C] Combat  [!] Elite  [?] Unknown
          [R] Rest  [T] Treasure  [B] Boss  * Current
  Cleared: ■  Unrevealed: ░
```

**SVG Mode (Lit component, for visual richness):**
- Nodes as circles/diamonds (room type determines shape)
- Edges as lines with glow effect
- Current room: pulsing amber glow
- Cleared rooms: dimmed, checkmark overlay
- Unrevealed: `?` with fog effect (reduced opacity)
- Hover: shows room type tooltip
- Click: equivalent to `move` command (if adjacent)

Both modes available, player toggles via `config` command (existing terminal config pattern).

#### D. Combat Action Bar (`VelgDungeonCombatBar.ts`)

Replaces Quick Actions during combat. One column per agent with their available abilities.

```
┌──────────────────────────────────────────────────────────────────┐
│ COMBAT — Round 2/4                              ████████░░ 22s  │
│                                                                  │
│ KOVACS (Spy 8)         MIRA (Prop 7)        VOSS (Asn 7)       │
│ ┌────────────────┐    ┌────────────────┐    ┌────────────────┐  │
│ │ ◉ Observe      │    │ ◉ Demoralize   │    │ ◉ Precision    │  │
│ │   Reveal intents│    │   Stress +150  │    │   Strike       │  │
│ │   73% success  │    │   81% success  │    │   76% success  │  │
│ ├────────────────┤    ├────────────────┤    ├────────────────┤  │
│ │ ◉ Analyze      │    │ ◉ Inspire      │    │ ◉ Ambush       │  │
│ │   Reveal stats │    │   Stress -75   │    │   2x if !atk   │  │
│ │   73% success  │    │   Auto-success │    │   76% success  │  │
│ ├────────────────┤    ├────────────────┤    ├────────────────┤  │
│ │ ○ Counter-Intel│    │ ◉ Rally        │    │ ◉ Exploit Weak │  │
│ │   CD: 1 round  │    │   Party -75 str│    │   +30% marked  │  │
│ │   (cooldown)   │    │   Auto-success │    │   76% success  │  │
│ ├────────────────┤    ├────────────────┤    ├────────────────┤  │
│ │ ★ Omniscience  │    │ ★ Break Point  │    │ ★ Deathmark    │  │
│ │   1x per dungeon│   │   1x per dungeon│   │   1x per dung. │  │
│ └────────────────┘    └────────────────┘    └────────────────┘  │
│                                                                  │
│ Selected: Kovacs→Observe, Mira→Rally             [✓ SUBMIT ALL] │
└──────────────────────────────────────────────────────────────────┘
```

**Ability button states:**
- `◉` Available: clickable, amber border, hover glow
- `○` Cooldown: dimmed, border dashed, cooldown count shown
- `★` Ultimate: gold border (`--color-ascendant-gold`), used=strikethrough
- Selected: filled background (`--color-primary` at 15% opacity), checkmark icon
- Disabled (agent Afflicted): entire column grayed, "AFFLICTED" stamp overlay (MissionCard disabled pattern)

**Timer bar:**
- Countdown from 45→0 with percentage-width fill bar
- Color transitions: amber (45-10s) → warning/yellow (10-5s) → danger/red (≤5s)
- Critical state (≤5s): multi-layer urgency feedback:
  - Container: red-tinted background + pulsing inset glow (`critical-container` 0.6s)
  - Track: red border glow
  - Seconds: danger color + double text-shadow + scale pump (1.06x, `critical-pulse` 0.6s)
  - Fill bar: aggressive opacity throb (`critical-bar-pulse` 0.6s)
  - Label: flashing red (`critical-label-flash` 0.6s)
  - All animations behind `prefers-reduced-motion: no-preference`; reduced-motion users get color-only changes
- Auto-submit at 0 (server-side, client shows "AUTO-DEFEND" flash)

**Combat Briefing (Onboarding):**
- Shown once per user (persisted via `localStorage: dungeon_combat_onboarded`)
- Compact 2-column grid layout (4 numbered steps, 1-2 left / 3-4 right)
- Footer: alt-text ("Or type commands in terminal") inline with [ACKNOWLEDGED] dismiss button
- Mobile (≤767px): falls back to single-column layout
- Auto-dismisses on first ability click (UX-04)

**Enemy panel (above combat bar during assessment phase):**

```
┌──────────────────────────────────────────────────────────────────┐
│ ENEMIES                                                          │
│                                                                  │
│ Echo of Violence ████████░░ [3/3]  INTENT: ► Attack Kovacs      │
│ Paranoia Shade   ██████░░░░ [2/2]  INTENT: ► ???  (unpredictable)│
│ Shadow Wisp      ████░░░░░░ [1/1]  INTENT: ► Stress attack party│
└──────────────────────────────────────────────────────────────────┘
```

Enemy condition as simple bar (existing `stabilityBar` pattern from terminal-formatters). Intent shown Into-the-Breach-style — `►` arrow + target description. Unknown intents (Paranoia Shade) show `???`.

**Enemy condition labels (5-state, HP-percentage based):**
- **healthy** (>80%) — full bar, default color
- **scratched** (>60%) — minor damage, bar slightly reduced
- **damaged** (>40%) — amber bar, visible wear
- **wounded** (>20%) — red bar, significant damage
- **critical** (<=20%) — deep red, rapid pulse, near defeat

#### E. Encounter Panel (`VelgDungeonEncounterPanel.ts`)

Appears as overlay/modal when entering an encounter room. Uses `BaseModal` pattern but styled with terminal aesthetic.

```
┌───────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════╗ │
│ ║              THE PRISONER                         ║ │
│ ╚═══════════════════════════════════════════════════╝ │
│                                                       │
│ In the deepest corner of the shadow-room, something   │
│ moves. Not a threat — a plea. A figure made of        │
│ compressed darkness, bound by chains of light that     │
│ flicker with each heartbeat of the dungeon.            │
│                                                       │
│ It speaks without sound: "Release me. I was someone,  │
│ once. Before this place consumed my edges."            │
│                                                       │
│ Agent Mira steps forward, hand outstretched.           │
│ Agent Voss grabs her wrist. "Don't."                   │
│                                                       │
│ ┌───────────────────────────────────────────────────┐ │
│ │ [1] Free the prisoner                             │ │
│ │     Requires: Agreeableness > 0.5                 │ │
│ │     Risk: Unknown consequence                     │ │
│ │     ► Mira volunteers (Agreeableness: 0.8)        │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ [2] Interrogate first                             │ │
│ │     Spy check: Kovacs 73% success                 │ │
│ │     Reveals: prisoner's true nature               │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ [3] Destroy it                                    │ │
│ │     Assassin check: Voss 76% success              │ │
│ │     Warning: Agents with Agreeableness > 0.6      │ │
│ │     will gain "guilt" moodlet                     │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ [4] Leave it. Move on.                            │ │
│ │     No check. No risk. No reward.                 │ │
│ └───────────────────────────────────────────────────┘ │
│                                                       │
│ > _                                                   │
└───────────────────────────────────────────────────────┘
```

**Rendering:** This is terminal output, not a separate component. The encounter text is pushed to the terminal buffer as `TerminalLine[]`. Choices are shown as numbered options. Player types `1`, `2`, `3`, or `4` (or clicks Quick Action buttons that auto-type the number).

**Agent reactions in encounter text** are driven by personality:
- High Agreeableness agents volunteer for compassionate options
- Low Agreeableness agents suggest ruthless options
- High Neuroticism agents express fear
- High Openness agents are curious about unknown consequences

#### F. Resolve Check Animation (Terminal + Micro-Animation)

The Darkest-Dungeon-style Resolve Check is the most dramatic moment in the dungeon. It deserves special treatment.

**In terminal (text output):**
```
Agent Mira's stress reaches critical [████████████ 847/1000]

[SYSTEM] ═══ RESOLVE CHECK ═══
[SYSTEM] Agent Mira — Neuroticism: 0.3, Resilience: 0.7
[SYSTEM] Threshold: 800 | Virtue chance: 40%
[SYSTEM]
[SYSTEM] Resolving...
```

**3-second pause (dramatic tension). Terminal cursor blinks.**

Then either:

```
[SYSTEM] ████████████████████████████████████████
[SYSTEM] ██                                    ██
[SYSTEM] ██     V I R T U E :  C O U R A G E  ██
[SYSTEM] ██                                    ██
[SYSTEM] ████████████████████████████████████████

Something shifts in Mira's eyes. The fear doesn't leave —
but it stops mattering. She stands straighter.

"They think they can break us. They're wrong."

  → All checks +20% for 3 rounds
  → Immune to stress damage
  → Party stress reduced by 100
  → All party members: +10 Opinion toward Mira
```

Or:

```
[SYSTEM] ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
[SYSTEM] ░░                                    ░░
[SYSTEM] ░░  A F F L I C T I O N :  F E A R    ░░
[SYSTEM] ░░                                    ░░
[SYSTEM] ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

Mira's hands won't stop shaking. Her voice is barely
a whisper, and it's saying the wrong things.

"We need to go back. We need to go back NOW."

  → Mira: loses next action (frozen)
  → Mira: -20% all checks for rest of dungeon
  → Party: Stress +50 each (fear is contagious)
  → Mira refuses to enter boss room without Guardian escort
```

**Visual accompaniment on Party Panel:**
- Virtue: Agent card border flashes gold (`--color-ascendant-gold`) with `legendary-glow` animation (from VelgGameCard). Portrait gains bright glow.
- Affliction: Agent card border flashes red (`--color-danger`), `entropy-dissolve` SVG filter applied to portrait. Condition text pulses.

### 14.3 Mobile Layout

On screens < 768px:
- Party Panel moves to a **collapsible top strip** (just names + condition bars, tap to expand)
- Dungeon Map is toggle-only (hidden by default, shown on `map` command)
- Combat Bar stacks vertically (one agent at a time, swipe between)
- Terminal remains full-width

### 14.4 Component File Structure

**Phase 1-3 (implemented):**

```
frontend/src/components/dungeon/
├── DungeonTerminalView.ts    ✅ Route entry, HUD grid + lobby, Wake Lock, recovery
├── DungeonHeader.ts          ✅ Submarine depth gauge: archetype, depth bar, rooms, visibility pips
└── DungeonQuickActions.ts    ✅ Phase-driven action buttons (shares terminalActionStyles)

frontend/src/services/
├── DungeonStateManager.ts    ✅ Preact Signals singleton (state, timer, combat planning, recovery)
└── api/DungeonApiService.ts  ✅ REST client (12 auth + 2 public endpoints)

frontend/src/utils/
├── dungeon-commands.ts       ✅ Dispatcher + 10 handlers, 3 verb categories, clearance tiers
├── dungeon-formatters.ts     ✅ 16 pure formatters + 2 shared i18n helpers (getConditionLabel, getRoomTypeLabel)
└── terminal-initialization.ts ✅ Shared zone init (used by TerminalView, EpochTerminalView, DungeonTerminalView)
```

**Phase 4 (done):**

```
frontend/src/components/dungeon/
├── DungeonPartyPanel.ts      ✅ Right sidebar: agent cards, condition/stress/mood bars, buffs/debuffs
├── DungeonMap.ts             ✅ SVG DAG with fog-of-war, click-to-move, collapsible
```

**Phase 5 (done):**

```
frontend/src/components/dungeon/
├── DungeonCombatBar.ts       ✅ ~1090 lines. 45s timer with 3-stage urgency (amber→warning→critical), per-agent ability radiogroup, smart target picker, compact 2-col onboarding briefing, EXECUTE
└── DungeonEnemyPanel.ts      ✅ ~260 lines. Enemy cards, threat badges, telegraphed intents (◆◆/◆/▸)
```

**Known Patterns & Accepted Tradeoffs (Phase 4 audit):**

1. **OPERATIVE_COLORS uses raw hex values** (`#64748b`, `#10b981`, etc.) in `operative-constants.ts`. These are applied via inline style, not component CSS, so the color token lint doesn't flag them. Established pattern shared with VelgAptitudeBars. Converting to design tokens requires a cross-cutting refactor of the operative color system — out of scope for dungeon work.
2. **Aptitude names displayed untranslated** ("SPY 8", "GUARDIAN 3") in DungeonPartyPanel. `getOperativeLabel()` exists in VelgAptitudeBars but is not exported. Exporting and wiring it is Phase 8 (Polish) scope — the uppercase abbreviation reads well in the terminal context across languages.
3. **`RoomNodeClient.current` property naming** — mirrors the backend Python `current` field. The frontend also has `dungeonState.currentRoom` (computed). Dual access pattern is intentional: `current` is per-room state from the API, `currentRoom` is a computed convenience. No rename needed.
4. **SVG event handlers use `nothing` sentinel** for conditional binding (`@click=${isAdj ? handler : nothing}`). Same pattern as `VelgAvatar.ts:99`. Verified working in Lit's svg template context.
5. **Stress bar "/1000" not in msg()** — universal numeric format, not a translatable string. The denominator 1000 is a game constant.

**Shared CSS exports** (in `frontend/src/components/shared/terminal-theme-styles.ts`):
- `terminalTokens` — Tier 2 HUD aliases (--amber, --hud-bg, etc.)
- `terminalComponentTokens` — Tier 3 bridges (--_phosphor, --_screen-bg, --_mono)
- `terminalActionStyles` — Shared button CSS (TerminalQuickActions + DungeonQuickActions)

> **[REVIEW #21 — MEDIUM]** Banter Template Pool Too Small for Replayability
>
> The MVP roadmap specifies 20 banter templates for Shadow. A typical 5-depth run with 8-10 rooms triggers 8-10 banter moments. With personality + opinion + context filtering narrowing the pool to maybe 5-8 applicable templates per trigger condition, **visible repeats will occur in the first 2-3 runs**.
>
> Text-adventure players are highly sensitive to repeated text — it breaks immersion faster than anything else. MUD veterans specifically cite "seeing the same room description 50 times" as a top frustration.
>
> **Empfehlung:** Either (a) increase to 40-50 banter templates for MVP (still template-based, not LLM), or (b) add a lightweight LLM fallback for banter generation (not full story generation — just personality-flavored one-liners, which are fast and cheap on Haiku/small models), or (c) implement a "no-repeat-until-pool-exhausted" tracker per dungeon run to at least prevent same-run repeats.

### 14.5 Terminal Formatter Examples

```typescript
// dungeon-formatters.ts

export function formatDungeonMap(state: DungeonClientState): TerminalLine[] {
    const lines: TerminalLine[] = [];
    lines.push(systemLine(`DUNGEON MAP — ${state.archetype.toUpperCase()}, Depth ${state.depth}/${state.rooms.length > 0 ? Math.max(...state.rooms.map(r => r.depth)) : '?'}`));
    lines.push(systemLine(''));

    // Group rooms by depth
    const byDepth = new Map<number, RoomNodeClient[]>();
    for (const room of state.rooms) {
        const list = byDepth.get(room.depth) ?? [];
        list.push(room);
        byDepth.set(room.depth, list);
    }

    // Render each depth layer
    for (const [depth, rooms] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
        const roomStrs = rooms.map(r => {
            const symbol = r.current ? '*' : r.cleared ? '■' : !r.revealed ? '░' : ROOM_SYMBOLS[r.room_type];
            return `[${symbol}]`;
        });
        // Join with connections
        lines.push(responseLine(`  ${roomStrs.join('───')}`));
        // Draw vertical connections to next depth (simplified)
        if (byDepth.has(depth + 1)) {
            lines.push(responseLine(`    │`));
        }
    }

    lines.push(systemLine(''));
    lines.push(hintLine('Legend: [E]ntrance [C]ombat [!]Elite [?]Unknown [R]est [T]reasure [B]oss'));
    lines.push(hintLine('* Current  ■ Cleared  ░ Unrevealed'));
    return lines;
}

const ROOM_SYMBOLS: Record<string, string> = {
    entrance: 'E', combat: 'C', elite: '!', encounter: '?',
    rest: 'R', treasure: 'T', boss: 'B', exit: '⇤',
};

export function formatRoomEntry(
    room: RoomNodeClient,
    encounter: EncounterData | null,
    banter: string | null,
    archetype_state: Record<string, unknown>,
): TerminalLine[] {
    const lines: TerminalLine[] = [];

    // Banter first (agent reaction to entering room)
    if (banter) {
        lines.push(responseLine(''));
        lines.push(responseLine(banter));
    }

    // Room description
    lines.push(responseLine(''));
    lines.push(systemLine(`═══ DEPTH ${room.depth} — ROOM ${room.index} ═══`));

    // Archetype-specific state display
    if (archetype_state.visibility !== undefined) {
        const vis = archetype_state.visibility as number;
        const maxVis = (archetype_state.max_visibility ?? 3) as number;
        const bar = '█'.repeat(vis) + '░'.repeat(maxVis - vis);
        lines.push(systemLine(`VISIBILITY: ${bar} [${vis}/${maxVis}]`));
    }

    // Room type-specific content
    switch (room.room_type) {
        case 'combat':
            lines.push(systemLine(`[COMBAT ENCOUNTER]`));
            // Enemy details rendered by formatCombatStart
            break;
        case 'encounter':
            lines.push(systemLine(`[ENCOUNTER]`));
            // Encounter text + choices rendered by formatEncounter
            break;
        case 'rest':
            lines.push(systemLine(`[REST SITE]`));
            lines.push(responseLine('A fragile pocket of stillness in the darkness.'));
            lines.push(hintLine('Use "rest" to recover stress. 20% chance of ambush.'));
            break;
        case 'treasure':
            lines.push(systemLine(`[TREASURE]`));
            lines.push(responseLine('Something glints in the shadow.'));
            break;
        case 'boss':
            lines.push(systemLine(`[BOSS CHAMBER]`));
            lines.push(responseLine('The darkness is thicker here. Absolute. Intentional.'));
            break;
    }

    return lines;
}

export function formatCombatResolution(
    round: number,
    actions: ResolvedAction[],
    enemy_actions: ResolvedAction[],
    narrative: string,
    state_changes: StateChange[],
): TerminalLine[] {
    const lines: TerminalLine[] = [];

    lines.push(systemLine(`═══ RESOLUTION — Round ${round} ═══`));
    lines.push(responseLine(''));

    // Narrative text (the "story" of what happened)
    for (const para of narrative.split('\n')) {
        lines.push(responseLine(para));
    }

    lines.push(responseLine(''));

    // Mechanical outcomes (transparent, inline)
    for (const action of actions) {
        const checkStr = action.check_info
            ? ` [${action.aptitude.toUpperCase()} ${action.aptitude_level}: ${action.success_chance}% — Roll: ${action.roll}]`
            : '';
        const resultStr = action.success ? 'SUCCESS' : action.partial ? 'PARTIAL' : 'FAIL';
        lines.push(systemLine(`[${resultStr}${checkStr}]`));
        for (const effect of action.effects) {
            lines.push(responseLine(`  → ${effect}`));
        }
    }

    // Enemy actions
    if (enemy_actions.length > 0) {
        lines.push(responseLine(''));
        for (const ea of enemy_actions) {
            lines.push(responseLine(ea.narrative));
            for (const effect of ea.effects) {
                lines.push(responseLine(`  → ${effect}`));
            }
        }
    }

    return lines;
}
```

---

## 15. Multiplayer Coordination

### 15.1 Shared Party Model

Multiple players control different agents in the same party:

```python
# Player A controls: Kovacs (Spy 8), Mira (Propagandist 7)
# Player B controls: Voss (Assassin 7), Kira (Guardian 6)

# In DungeonRunCreate:
party_agent_ids: [kovacs_id, mira_id, voss_id, kira_id]
party_player_ids: [player_a_id, player_b_id]

# Agent ownership tracked in instance:
agent_ownership: dict[UUID, UUID] = {
    kovacs_id: player_a_id,
    mira_id: player_a_id,
    voss_id: player_b_id,
    kira_id: player_b_id,
}
```

### 15.2 Action Sync

- **Movement:** Either player can propose movement. Both must confirm (Supabase Broadcast `move_proposed` event → other player sees "Player A wants to move to Room 5. [Confirm] [Reject]")
- **Combat:** Each player submits actions for their own agents only. Resolution waits for all players OR timer (45s). Broadcast `actions_submitted` shows who has submitted.
- **Encounters:** Choice is voted on. If disagreement, the agent with the highest relevant aptitude's player decides (narrative justification: "the expert leads")
- **Retreat:** Either player can initiate. Other gets 10s to object. If objection, vote (majority wins; tie = stay).

> **[REVIEW #22 — MEDIUM]** Multiplayer Friction Points
>
> Several multiplayer mechanics create unnecessary friction:
>
> 1. **Movement confirmation:** Both players must confirm every room transition. A 10-room dungeon = 10 confirmation dialogues. This will feel tedious fast, especially when players are in sync and just want to move forward.
>    → **Empfehlung:** Default to "leader proposes, follower has 5s to veto" (silence = consent). Much less friction.
>
> 2. **Encounter voting ties:** "If disagreement, the agent with the highest relevant aptitude's player decides." But WHICH aptitude? If the encounter has a Spy check and a Propagandist check, whose aptitude counts? This needs a clear tiebreaker rule.
>    → **Empfehlung:** The encounter defines a `primary_aptitude`. Ties are broken by the player whose agent has the highest value in that aptitude.
>
> 3. **AFK threshold too short:** 60s → "AFK" badge, 120s → auto-actions. A bathroom break or phone call makes your agents auto-defend in combat. This is punishing for casual players.
>    → **Empfehlung:** 120s → AFK badge, 180s → auto-actions, 300s → AI pilot. Give players a "BRB" command that pauses their AFK timer for 3 minutes.

### 15.3 Presence & AFK

Uses existing Supabase Presence on `dungeon:{runId}:presence`:
- Track last_action_at per player
- After 60s inactivity → "AFK" badge in party panel
- After 120s → auto-defend in combat, auto-confirm in movement
- After 300s → player disconnected, their agents go to AI auto-pilot (simple defensive behavior)

---

## 16. Shadow Encounter Templates (Complete Set for MVP)

### Combat Encounters (4 templates)

**1. "Whispers in the Dark"** — 2 Shadow Wisps
- Depth 1-2, Difficulty 1+
- Telegraphed: stress attacks
- First encounter: serves as tutorial for combat system

**2. "The Patrol"** — 1 Echo of Violence + 1 Shadow Tendril
- Depth 2-3, Difficulty 1+
- Telegraphed: Echo attacks random agent, Tendril grapples highest-Spy agent
- Avoidable: Infiltrator 5+ can bypass entirely

**3. "Ambush!"** — 2 Echoes of Violence (surprise round)
- Depth 2-4, Difficulty 2+
- Triggered at Visibility 0: enemies get free first action
- High-stress event: +100 stress to party on trigger

**4. "The Haunting"** — 1 Paranoia Shade + 2 Shadow Wisps
- Depth 3-4, Difficulty 2+
- Shade's disinformation makes Wisp intents unreliable
- Must kill Shade first to see true intents

### Encounter Templates (3)

**5. "The Prisoner"** (described in Section 14.2 above)
- Depth 2-3, requires party Agreeableness variance
- 4 choices with different aptitude/personality requirements

**6. "The Mirror Room"**
- Depth 2-4
- Each agent sees a distorted version of themselves
- Spy check: reveals what the distortion means (agent's greatest fear)
- If agent confronts their fear (Talk command): permanent +0.05 Resilience
- If agent flees: +100 Stress, room is blocked

**7. "Echoes of the Past"**
- Depth 3-4
- Room replays a real Event from the simulation (pulled from events table, impact >= 5)
- Party must make a choice about the replayed event that differs from what historically happened
- Different choice → insight about alternative outcomes → Memory created

### Elite Encounter (1)

**8. "The Remnant"** (described in Section 10.2)
- Depth 3-4, Difficulty 2+
- 5 condition steps, summons wisps, AoE fear
- Guaranteed Tier 2 loot on defeat

### Rest Site (1)

**9. "The Hollow"**
- Any depth
- Heal: all agents Stress -100, Wounded→Stressed
- 20% ambush chance (1 Shadow Tendril — easy combat)
- If Visibility 0: ambush chance rises to 50%
- Safe option: post a Guardian as watch (no ambush, but Guardian doesn't heal)

### Treasure Room (1)

**10. "Shadow Cache"**
- Any depth
- Locked container: Infiltrator check to open (65% base)
- If Visibility 0: +1 loot tier (risk = reward in the dark)
- Contains Tier 1 or Tier 2 loot (based on depth + difficulty)
- Trapped: 15% chance of stress trap (+75 stress to opener) — Spy passive detects it

---

## REVIEW — Cross-Cutting Findings

> **[REVIEW #23 — HIGH]** i18n Content Doubling Not Accounted in Roadmap
>
> The project requires bilingual content (en/de) for ALL user-facing strings (CLAUDE.md: "Every user-facing string must use `msg('...')`"). This applies to:
>
> - 10 encounter templates × 2 languages = 20 text blocks
> - 20 banter templates × 2 languages = 40 text strings
> - Enemy descriptions (5 enemies × description + ambient_text × 2) = 20+ strings
> - Combat narratives, loot descriptions, system messages — all bilingual
> - Boss encounter narrative (multiple phases × outcomes × 2 languages)
>
> The Phase 0 roadmap estimates "2-3 weeks" but does NOT account for German translations of encounter prose, banter templates, enemy flavor text, or combat narratives. The literary quality bar in this project is high (B+ to A- from Forge audit) — German translations need equivalent quality, not machine-translated text.
>
> **Empfehlung:** Die deutschen Übersetzungen aller Encounter-Texte, Banter-Templates, Enemy-Descriptions und Combat-Narratives sollen intern mit Claude 4.6 (Opus) im Rahmen der Implementierung vorbereitet werden — kein separater Übersetzungsschritt, sondern direkt beim Content-Authoring en+de parallel generieren. Das spart den DeepL-Roundtrip und liefert konsistentere literarische Qualität, da Claude den vollen Kontext (Archetype-Atmosphäre, Agent-Persönlichkeit, Terminal-Ästhetik) mitbekommt. Trotzdem im Roadmap-Zeitplan berücksichtigen: ~30% Aufschlag auf Content-Tasks für Review und Feinschliff der deutschen Texte.

> **[REVIEW #24 — MEDIUM]** Dungeon Availability Gated Entirely by Resonance State
>
> Dungeon access requires an active Substrate Resonance with `effective_magnitude >= 0.3` and matching archetype. This means:
>
> - If no resonance is currently active → **zero dungeons available**. The feature is invisible.
> - If only one resonance type is active → no player choice. You run Shadow or nothing.
> - Resonances are admin-created and follow a lifecycle (detected→impacting→subsiding→archived). A subsiding resonance might close the dungeon mid-availability.
>
> **Das Problem für Player Agency:** Players can't plan around dungeon availability. They can't prepare a party, choose an archetype that matches their agents' strengths, or set aside time to play — because they don't control when dungeons appear. This is fine for FOMO-driven games (Destiny 2 rotating activities), but this project values player agency and deep strategic planning.
>
> **Empfehlung:** Add a fallback mechanism: when no resonance is active, a "Training Dungeon" (The Shadow, difficulty 1, no permanent loot — only moodlets and memories) is always available. This lets players learn the system, test party compositions, and have fun regardless of platform-level resonance state. Training dungeons don't affect simulation health or scores.

---

## 17. Implementation Learnings (Post-Playtest, 2026-03-28)

> This section captures empirical findings from 2 full browser playtests and 755+ automated tests. These patterns are **mandatory for all future archetype implementations**.

### 17.1 Combat Engine Learnings

**Stalemate Mechanic:** Combat auto-resolves at `max_rounds` (default 10). On stalemate: room is cleared, +80 stress to all party agents, no loot awarded. Prevents infinite combat loops. Implemented in `_check_victory_conditions()` returning a 4-tuple with stalemate flag, handled by `_handle_combat_stalemate()`.

**Auto-Submit on Timer Expiry:** When the 45s planning timer hits 0, `DungeonStateManager._autoSubmitOnExpiry()` automatically submits current selections. If no selections made, backend auto-defends all agents using rotation: `(round_num + hash(agent_id)) % len(damage_abilities)` — ensuring variety across rounds. Falls back to `getState()` polling on submission failure.

**Timer Race Condition:** Atomic pop in callback prevents double-resolve. Stale timer guard: `_startTimer()` checks if timer was aborted before interval starts, preventing recursive auto-submit loops. `_autoSubmitFired` flag only resets on fresh timer reset (in `_startTimer` when `remaining > 0`), never in `applyState()`.

**AbilityOption.targets Field:** Backend sends `targets: "self" | "single_enemy" | "single_ally" | "all_enemies"` on each AbilityOption. Frontend uses this to skip target picker for self/all abilities (1-click), auto-target when only 1 alive enemy, and show picker only for multi-enemy single-target scenarios. Reduced clicks from 6 to 1-2 per agent per round.

**Combat Narratives:** Template-based `narrative_en`/`narrative_de` on every `CombatEvent`. Aggregated `narrative_summary_en`/`narrative_summary_de` on `CombatRoundResult`. Templates: `"{attacker} attacks {target}. HIT for {damage} condition steps."`, `"{actor} casts {ability} on {target}."`, etc. Frontend renders these in semantic combat log colors.

**Ability Resolution (14/17 working):**

| Ability | School | Mechanic | Status |
|---------|--------|----------|--------|
| Observe | Spy | +1 VP via archetype_state | ✅ |
| Analyze Weakness | Spy | Reveal enemy stats | ✅ |
| Counter-Intelligence | Spy | Cancel enemy intent | ⏳ needs intent system |
| Shield | Guardian | Absorb next hit | ✅ |
| Taunt | Guardian | Force enemies to target self + evasion bonus | ✅ |
| Fortify | Guardian | Damage reduction on next incoming | ✅ |
| Ambush Strike | Assassin | 2x damage if enemy hasn't attacked | ⏳ round_num scope |
| Precision Strike | Assassin | High single-target damage | ✅ |
| Evade | Assassin | Untargetable + evasion bonus | ✅ |
| Demoralize | Propagandist | Enemy attack reduction + 1 condition step | ✅ |
| Inspire | Propagandist | Heal 120 stress to ally | ✅ |
| Rally | Propagandist | Party-wide stress heal | ✅ |
| Deploy Trap | Saboteur | "trapped" debuff + auto-damage | ✅ |
| Detonate | Saboteur | AoE damage to all enemies | ✅ |
| Disrupt | Saboteur | Enemy evasion penalty | ✅ |
| Summon Decoy | Infiltrator | (not yet tested) | ⏳ |
| Vanish | Infiltrator | (not yet tested) | ⏳ |
| Basic Attack | Universal | Guaranteed damage (min_aptitude=0, power=3) | ✅ |

**Universal school:** Basic Attack (min_aptitude=0, power=3) is a guaranteed damage ability available to all agents regardless of aptitude profile. `get_all_agent_abilities()` always includes universal abilities unconditionally, ensuring every agent can deal damage even with a zero-aptitude profile.

**Buff Lifecycle:** All agent buffs cleared at end of round (1-round duration, Phase 0 simplification). Pipeline: `has_buff()` → `_apply_buff_to_agent()` → `_consume_buff()`. One-shot shields (Fortify) applied and consumed in same round. Debuffs (Demoralize, Deploy Trap) persist across rounds.

**DRY Helpers:** `_build_round_result_dict()` is a shared static helper for round_result serialization across all 4 outcomes (normal round, victory, wipe, stalemate).

### 17.2 Combat Onboarding

**CIC-style Combat Briefing:** Inline card (not modal) in terminal with 4 numbered steps explaining combat flow. "ACKNOWLEDGED" dismiss button with blinking cursor. Persisted to `localStorage` (`dungeon_combat_onboarded` key). Terminal alternative: `skip` command to dismiss. Submarine aesthetic consistent with Bureau Terminal.

**Agent Done Badge:** `[OK]` indicator (phosphor green) shown after agent name in CombatBar when action selected — visual confirmation of completion status per agent.

### 17.3 Encounter System Learnings

**Number→ID Mapping:** Terminal interaction uses `interact 1` → maps to choice ID. Consistent with familiar MUD/text-adventure patterns.

**Auto-Select Best Agent:** When a choice requires a skill check, the system automatically selects the party member with the highest relevant aptitude. Shown to player: `"► Mira volunteers (Propagandist: 85%)"`.

**Banter Placeholder Resolution:** Templates use `{agent}`, `{agent_a}`, `{agent_b}` — resolved at runtime with random party members. Boss rooms trigger `boss_approach` banter.

**Boss Encounter Fix:** Boss rooms spawn `SHADOW_BOSS_ENCOUNTERS` template (shadow_remnant_spawn) instead of regular combat encounters. Fallback: if room has `is_boss=True` flag, force boss encounter template regardless of room_type.

### 17.4 Loot Distribution Phase

**New `distributing` Phase:** Inserted between boss victory and dungeon completion. Loot is classified into:
- **Auto-apply:** Simulation-wide effects (event_modifier, arc_modifier) and stress_heal (applied to all operational agents) — no player choice needed.
- **Distributable:** Aptitude boosts, memories, moodlets — player assigns via terminal commands (`assign <#> <agent>`, `confirm`).

**Smart Suggestions:** `aptitude_boost` → suggests agent with lowest relevant aptitude. Memory/moodlet → round-robin across party.

**Edge Cases:** 0 distributable items → auto-complete to dungeon_completed. 1 agent → auto-assign all. Checkpoint recovery preserves distribution state.

**Migration 165:** CHECK constraint on `agent_dungeon_loot_effects`, indexes, RLS, VIEW, 2 new RPCs (`fn_begin_distribution`, `fn_finalize_dungeon_run`). Backward compatible — `fn_complete_dungeon_run` unchanged for retreat/wipe paths.

### 17.5 Frontend Architecture Patterns

**Terminal-Command Event Forwarding (CRITICAL):** HUD components (QuickActions, Map, CombatBar) are siblings of BureauTerminal in shadow DOM, not ancestors. Custom `terminal-command` events with `composed: true` bubble upward but cannot cross sideways. **Fix:** `DungeonTerminalView._handleTerminalCommand()` listens on the HUD container div, catches all `terminal-command` events, dispatches through `parseAndExecute()`, appends output to `terminalState`. **All future dungeon components MUST dispatch `terminal-command` events, not call terminal methods directly.**

**BureauTerminal Unmodified:** DungeonTerminalView wraps BureauTerminal — no changes to existing terminal component. Maintains separation of concerns.

**Phase Drives UI:** `dungeonState.phase` (computed Preact Signal) determines which HUD panels are visible. 13 phases mapped to contextual button sets in QuickActions. Combat phases hide QuickActions and show CombatBar/EnemyPanel instead.

**DungeonStateManager as Orchestrator:** Not a pure state container — imports `terminalState`, formatters, and API service. `applyState()` replaces entire state atomically. Singleton pattern via module-level export.

**5 Semantic Combat Log Colors:**
- `combat-player` (gold #fbbf24): Agent actions — distinct from dim amber
- `combat-damage` (danger red): Enemy attacks — strong text-shadow glow
- `combat-heal` (success green): Healing, stress restore
- `combat-miss` (50% opacity, italic): Failed actions
- `combat-system` (phosphor green, UPPERCASE, bold): Headers, system messages

**Tags:** `[HIT]`, `[MISS]`, `[ACT]`, `[DEF]`, `[HEAL]` — for scannable battle log. `PARTY ACTIONS` / `ENEMY ACTIONS` grouping.

**forceScrollToBottom() API:** Public method on BureauTerminal for external command dispatch (QuickActions, CombatBar). Required because async layout changes trigger `_handleScroll` → `_userScrolled = true` → content scrolls away from bottom.

**Responsive Breakpoints:**
- 640px (extra-small): font-size reductions, compact layouts
- 767px (mobile): grid collapse, 44px WCAG touch targets
- 1440px (large): wider sidebar 320px, larger fonts 12px
- 2560px (4K): extra-wide sidebar 380px, even larger fonts 13px

**prefers-reduced-motion:** Opt-in pattern (`no-preference`). Base CSS has NO animation/transition. All motion ONLY inside `@media (prefers-reduced-motion: no-preference)`. Matching WCAG AA requirements.

**terminalComponentTokens:** Shared Tier 3 CSS export in `terminal-theme-styles.ts`. ALL dungeon components MUST import for consistent `--_phosphor`, `--_screen-bg`, `--_mono` variables.

### 17.6 Database & Backend Learnings

**UUID Serialization Crash:** `model_dump()` returns `{"agent_id": UUID(...)}`, not strings. Three checkpoint boundaries require `model_dump(mode="json")` for JSON-safe serialization. Discovered during first playtest — silent corruption until deserialization.

**get_admin_supabase() in Timer Callbacks:** Combat timer callbacks run in asyncio tasks that outlive request scope. Must call `get_admin_supabase()` for a fresh client — the request-scoped client may be closed.

**Auto-Recovery from Checkpoint:** `_get_instance()` is async. If instance not in `_active_instances` dict (server restart), automatically calls `recover_from_checkpoint(run_id)` to restore from DB. All 7 mutation endpoints work transparently after recovery.

**resolve_combat_round() Decomposition:** Originally monolithic (~400 lines). Decomposed into 9 phase functions for testability and clarity.

### 17.7 Testing Coverage

**755 tests across 11 files, 0.51s runtime, 0 bugs found:**

| Layer | Files | Tests | Focus |
|-------|-------|-------|-------|
| Unit (pure functions) | 8 | 576 | condition_tracks, stress_system, skill_checks, ability_schools, archetypes, generator, combat+encounters+loot, combat_engine |
| Integration (async + mocks) | 2 | 140 | DungeonEngineService (90), Router endpoints (50) |
| Validation (Pydantic) | 1 | 50 | Model validation, checkpoint round-trip, fog-of-war |

**Review Decisions Verified by Tests:** #7 (VP rebalance), #8 (no exit < depth 3), #10 (max 2 condition steps), #11 (stress halved, 40% virtue, 150 cap), #18 (rest room guarantee), #20 (aptitude +2 cap).

**5 Documented Gotchas:**
1. Personality modifier defaults missing traits to 0.5 → "courage" check always penalizes empty personality
2. `model_dump()` preserves UUID objects — compare with UUID, not str
3. `random.seed(X)` in graph generation affects global RNG until re-seeded
4. Condition 2-step cap enforced in `condition_tracks.py`, not `combat_engine.py` — bypass risk if calling damage directly
5. Per-round stress cap (150) only inside `resolve_combat_round()` — direct `apply_stress()` calls have no cumulative cap

### 17.8 Playtest Results Summary

**Playtest 1 (2026-03-28):** Full browser playtest via WebMCP. 18 UX/UI/gameflow issues found:
- CRITICAL: UUID serialization crash, no party selection UI, no combat timer, empty abilities
- Fixed in 2 phases (backend fixes + party selection)

**Playtest 2 (2026-03-28):** Combat flow deep dive. 12 issues found:
- CRITICAL: Round counter exceeded max_rounds, frontend stuck after timer, only "Observe" available
- Led to Combat Engine Phase 1 (14/17 abilities mechanical effects)
- All 12 fixed in same session

**E2E Verification (2026-03-28):** Full dungeon run completed:
`Entrance → Combat (Shadow Wisps, won) → Encounter (Mirror Room, Skill Check PARTIAL) → Rest (Stress healed) → Combat (Echoes of Violence, won) → Boss (won, Dungeon Complete)`

20+ features verified working including ARIA landmarks, dungeon tab navigation, boot message clearance, loot display, completion screen.
