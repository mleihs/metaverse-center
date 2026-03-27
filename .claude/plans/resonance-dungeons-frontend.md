# Resonance Dungeons — Frontend Implementation Plan

## Status: PHASE 1+2+3+4 COMPLETE — Phase 5 next

**Created:** 2026-03-27
**Basis:** `docs/concepts/resonance-dungeons-spec.md` (§14), `research/dungeon-frontend-deep-dive.md`, backend Phase 0 (complete, 576 tests passing)
**Methodology:** 4-Perspektiven-Analyse (Architect, Game Designer, UX, Research) bei jeder Entscheidung

### Implementation Progress

| Phase | Status | Files | Lines | Verified |
|-------|--------|-------|-------|----------|
| **Phase 1: Data Layer** | ✅ DONE | 3 new + 1 modified | 912 | tsc ✅, triple-check ✅ |
| **Phase 2: Terminal Integration** | ✅ DONE | 2 new + 2 modified | 1396+85 | tsc ✅, WebMCP 8 tests ✅, deep audit ✅ |
| **Phase 3: View Shell & Header** | ✅ DONE | 3 new + 4 modified | 897+70 | tsc ✅, lint ✅, deep audit ✅ |
| **Phase 4: Party Panel & Map** | ✅ DONE | 2 new + 3 modified | 1067+27 | tsc ✅, lint ✅, 4-agent deep audit ✅ |
| Phase 5: Combat System | ⬜ NEXT | 2 new | — | — |
| Phase 6: Encounters & Events | ⬜ | extensions | — | — |
| Phase 7: Realtime & Recovery | ⬜ | extensions | — | — |
| Phase 8: Polish & Mobile | ⬜ | refinements | — | — |

### Bugs Found & Fixed During Implementation
1. **`move`→`go` synonym routing** — SYNONYM_MAP resolved `move` to `go` before dispatcher. Fixed: added `go` to DUNGEON_OVERRIDE_VERBS.
2. **Clearance bypass** — Intercept ran before clearance check. Fixed: DUNGEON_VERB_TIER check inside dispatcher.
3. **Silent failure for dungeon-only verbs** — `scout` etc. outside dungeon returned empty output. Fixed: DUNGEON_ONLY_VERBS returns explicit error.
4. **`allActionsSelected` hardcoded conditions** — Excluded afflicted agents. Fixed: delegate to `available_abilities.length > 0`.
5. **Migration 164 `portrait_url`** — DB column is `portrait_image_url`. Fixed in applied migration.
6. **Phase 4: `_roomLabel` duplication** — DungeonQuickActions._roomLabel duplicated Map's getRoomTypeLabel. Extracted to shared dungeon-formatters.ts. Fixed encounter→Event inconsistency (now "Encounter" everywhere).
7. **Phase 4: Wrong `prefers-reduced-motion` pattern** — Used reduce/opt-out, DungeonHeader uses no-preference/opt-in. Restructured both new components.
8. **Phase 4: Missing stress threshold escalation** — Spec requires dim→bright→red + TENSE/CRITICAL labels. Added CSS classes + threshold text.
9. **Phase 4: Redundant `.terminal-wrapper` CSS rule** — Duplicated terminalWrapperStyles. Removed.
10. **Phase 4: Media query cascade order** — max-width: 640px was before 767px. Fixed: wider first, narrower second.

### DB Migrations Applied
- Migration 163: `resonance_dungeon_runs` + `resonance_dungeon_events` tables + RPCs
- Migration 164: Atomic RPCs + `available_dungeons` VIEW + loot effects table (with portrait_image_url fix)

---

## Design Direction (frontend-design Skill)

**Aesthetic:** Terminal-Bureau Hybrid — the CRT amber phosphor of the BureauTerminal is the soul, but now it breathes. The dungeon wraps the terminal in a *living instrument panel* — think submarine control room meets 1970s analog computing. Not retro for retro's sake — this is an interface built by a clandestine organization with limited resources and unlimited paranoia.

**Tone:** Industrial-utilitarian with moments of dramatic tension. The terminal is terse and efficient. The HUD panels are functional readouts. But when a Resolve Check triggers, or a boss chamber opens — the entire UI shifts register. Chromatic aberration, phosphor bloom, temporal disruption.

**Differentiation:** The combat planning phase. 30 seconds, ticking countdown, Into-the-Breach-style enemy telegraphs, ability buttons with transparent probability percentages. This is the "one thing someone will remember." It's a board game moment inside a terminal.

**Typography:** Existing `--font-mono` for terminal/data. Existing `--font-brutalist` for headings. No new fonts — consistency with Bureau aesthetic.

**Color:** All via design tokens (3-tier system, CI-enforced). Condition states map to existing semantic tokens. New Tier 3 component-local variables only where needed (e.g., `--_condition-operational`, `--_condition-afflicted`).

**Motion:** `prefers-reduced-motion` respected everywhere. Combat timer color transitions. Phosphor-persist for new terminal lines. Bar width transitions. Condition change flashes. Resolve Check: 3s dramatic pause with cursor blink.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Route: /simulation/:slug/dungeon                                     │
│                                                                      │
│ ┌─ DungeonTerminalView.ts (layout shell) ──────────────────────────┐│
│ │                                                                    ││
│ │  ┌─ DungeonHeader.ts ──────────────────────────────────────────┐ ││
│ │  │ Archetype | Depth ████░░ | Rooms 7/15 | Visibility ██░ [2/3]│ ││
│ │  └─────────────────────────────────────────────────────────────┘ ││
│ │                                                                    ││
│ │  ┌──────────────────────────────┐  ┌─ DungeonPartyPanel.ts ────┐ ││
│ │  │                              │  │ Agent cards (condition,    │ ││
│ │  │  BureauTerminal              │  │ stress, mood, aptitudes,   │ ││
│ │  │  (existing, unmodified)      │  │ buffs/debuffs)             │ ││
│ │  │                              │  │                            │ ││
│ │  └──────────────────────────────┘  └────────────────────────────┘ ││
│ │                                                                    ││
│ │  ┌─ DungeonMap.ts ──────────────────────────────────────────────┐ ││
│ │  │ SVG DAG with fog-of-war (collapsible, toggle via config)     │ ││
│ │  └─────────────────────────────────────────────────────────────┘ ││
│ │                                                                    ││
│ │  ┌─ DungeonQuickActions.ts / DungeonCombatBar.ts ──────────────┐ ││
│ │  │ Context-dependent: explore → quick actions / combat → abilities││
│ │  └─────────────────────────────────────────────────────────────┘ ││
│ │                                                                    ││
│ │  ┌─ DungeonEnemyPanel.ts (combat only) ────────────────────────┐ ││
│ │  │ Enemy condition bars + telegraphed intents                    │ ││
│ │  └─────────────────────────────────────────────────────────────┘ ││
│ └────────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ State: DungeonStateManager.ts (Preact Signals singleton)             │
│ API:   DungeonApiService.ts (extends BaseApiService)                 │
│ RT:    RealtimeService extension (dungeon channels)                   │
│ Cmds:  dungeon-commands.ts + dungeon-formatters.ts                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Critical Architectural Decisions

**Decision 1: BureauTerminal is NOT modified.**
The existing BureauTerminal.ts is a 27KB component with extensive tested behavior (feed polling, clearance system, conversation mode, phosphor animations). We do NOT extend or subclass it. Instead, DungeonTerminalView wraps it — the same pattern as EpochTerminalView wraps it for Epoch context. Dungeon commands are registered in the existing command registry via dungeon-commands.ts.

*Why:* EpochTerminalView already proves this pattern works. Modifying BureauTerminal risks regressions in all other terminal contexts. The terminal's command dispatch is already pluggable (SYNONYM_MAP + handler functions).

**Decision 2: DungeonStateManager is the single source of truth.**
Every API response returns a fresh `DungeonClientState`. The state manager replaces its entire state on each response. Components consume signals reactively. No component caches its own data.

*Why:* The backend maintains authoritative state (in-memory + checkpoint). The client is a thin rendering layer. This prevents state desync between terminal output and HUD panels.

**Decision 3: Terminal commands and Quick Action buttons are equivalent.**
Quick Action buttons call the same command handlers as typed commands. Clicking "Scout" dispatches `handleDungeonScout()` — the same function called by typing `scout` in the terminal. Both produce TerminalLine[] output.

*Why:* Single code path means single behavior. No divergent UX between keyboard and mouse users. Also enables testing commands without UI.

**Decision 4: Combat phase drives the entire UI state machine.**
`dungeonState.phase` is a computed signal that determines which HUD panels are visible. Components use `phase.value` to show/hide themselves. No manual visibility toggling.

```
exploring        → QuickActions + Map + PartyPanel
encounter        → QuickActions (choices) + PartyPanel
combat_planning  → CombatBar + EnemyPanel + Timer + PartyPanel
combat_resolving → EnemyPanel + PartyPanel (read-only)
combat_outcome   → EnemyPanel + PartyPanel (results display)
rest             → QuickActions (rest/leave) + PartyPanel
treasure         → Loot display in terminal + PartyPanel
boss             → Same as combat but boss-specific styling
exit             → QuickActions (retreat/continue) + PartyPanel
completed        → Summary in terminal, HUD fades
wiped            → Death screen in terminal, HUD distorts
```

**Decision 5: SVG map, not ASCII-only.**
The terminal `map` command outputs ASCII (existing terminal text pattern). But the HUD DungeonMap component renders an interactive SVG DAG. Click-to-move on the SVG dispatches `move` commands. Both representations are generated from the same `rooms[]` data.

*Why:* ASCII is perfect for the terminal feel. But an interactive map enables spatial reasoning that pure text can't match. FTL/StS players expect a node graph they can reason about visually. The SVG is collapsible for those who prefer terminal-only.

---

## File Structure

```
frontend/src/
├── components/dungeon/
│   ├── DungeonTerminalView.ts        # Route entry, layout shell (Phase 3)
│   ├── DungeonHeader.ts              # Top bar: archetype, depth, visibility (Phase 3)
│   ├── DungeonPartyPanel.ts          # Right sidebar: agent status cards (Phase 4)
│   ├── DungeonMap.ts                 # SVG DAG with fog-of-war (Phase 4)
│   ├── DungeonQuickActions.ts        # Explore-mode action buttons (Phase 3)
│   ├── DungeonCombatBar.ts           # Combat: ability selection per agent (Phase 5)
│   └── DungeonEnemyPanel.ts          # Combat: enemy status + telegraphs (Phase 5)
│
├── services/
│   ├── DungeonStateManager.ts        # Preact Signals singleton (Phase 1)
│   └── api/DungeonApiService.ts      # REST client, 14 endpoints (Phase 1)
│
├── types/
│   └── dungeon.ts                    # TypeScript interfaces (Phase 1)
│
└── utils/
    ├── dungeon-commands.ts           # Terminal command handlers (Phase 2)
    └── dungeon-formatters.ts         # Terminal text formatters (Phase 2)
```

**Modifications to existing files:**
- `frontend/src/services/TerminalStateManager.ts` — Add dungeon signals (Phase 2)
- `frontend/src/utils/terminal-commands.ts` — Register dungeon commands + synonyms (Phase 2)
- `frontend/src/utils/terminal-formatters.ts` — Import/re-export dungeon formatters (Phase 2)
- `frontend/src/app-shell.ts` — Add `/simulation/:slug/dungeon` route (Phase 3)
- `frontend/src/services/realtime/RealtimeService.ts` — Add dungeon channels (Phase 7)
- `frontend/src/utils/icons.ts` — Add dungeon-specific icons (Phase 3)

---

## Phase 1: Data Layer (Foundation)

**Goal:** TypeScript types, API service, state manager. Zero UI. Everything testable in isolation.
**Dependencies:** Backend Phase 0 complete (✅)
**Estimated files:** 3 new

### 1.1 TypeScript Types (`types/dungeon.ts`)

All types derived from backend Pydantic models (verified against `backend/models/resonance_dungeon.py` and `backend/models/combat.py`). Every field documented.

```typescript
// ── Enums ────────────────────────────────────────────────
export type DungeonStatus = 'active' | 'combat' | 'exploring' | 'completed' | 'abandoned' | 'wiped';

export type DungeonPhase =
  | 'exploring' | 'encounter' | 'combat_planning' | 'combat_resolving'
  | 'combat_outcome' | 'rest' | 'treasure' | 'boss' | 'exit'
  | 'room_clear' | 'completed' | 'retreated' | 'wiped';

export type RoomType = 'combat' | 'elite' | 'encounter' | 'treasure' | 'rest' | 'boss' | 'entrance' | 'exit';

export type ArchetypeName =
  | 'The Tower' | 'The Shadow' | 'The Devouring Mother' | 'The Deluge'
  | 'The Overthrow' | 'The Prometheus' | 'The Awakening' | 'The Entropy';

export type Condition = 'operational' | 'stressed' | 'wounded' | 'afflicted' | 'captured';
export type StressThreshold = 'normal' | 'tense' | 'critical';
export type ThreatLevel = 'minion' | 'standard' | 'elite' | 'boss';
export type EnemyConditionDisplay = 'healthy' | 'damaged' | 'critical' | 'defeated';
export type AbilitySchool = 'spy' | 'guardian' | 'saboteur' | 'propagandist' | 'infiltrator' | 'assassin';
export type CombatPhase = 'assessment' | 'planning' | 'resolving' | 'outcome';
export type SkillCheckResult = 'success' | 'partial' | 'fail';

// ── Client State (from backend on every action) ─────────
export interface DungeonClientState { ... }
export interface RoomNodeClient { ... }
export interface AgentCombatStateClient { ... }
export interface CombatStateClient { ... }
export interface EnemyCombatStateClient { ... }
export interface AbilityOption { ... }
export interface BuffDebuff { ... }
export interface TelegraphedAction { ... }
export interface PhaseTimer { ... }

// ── Request Types ────────────────────────────────────────
export interface DungeonRunCreate { ... }
export interface DungeonMoveRequest { ... }
export interface DungeonAction { ... }
export interface CombatSubmission { ... }
export interface CombatAction { ... }
export interface ScoutRequest { ... }
export interface RestRequest { ... }

// ── Response Types ───────────────────────────────────────
export interface DungeonRunResponse { ... }
export interface CreateRunResponse { ... }
export interface MoveToRoomResponse { ... }
export interface CombatSubmitResponse { ... }
export interface EncounterChoiceResponse { ... }
export interface ScoutResponse { ... }
export interface RestResponse { ... }
export interface RetreatResponse { ... }
export interface AvailableDungeonResponse { ... }
export interface DungeonEventResponse { ... }
export interface LootItem { ... }
export interface EncounterChoice { ... }
```

Full field definitions from backend models — see research agent output for complete field listings.

### 1.2 API Service (`services/api/DungeonApiService.ts`)

Extends `BaseApiService`. Follows the exact pattern of SimulationsApiService, EpochsApiService.

```typescript
import { BaseApiService } from './BaseApiService.js';
import type { ApiResponse } from './BaseApiService.js';
import type {
  AvailableDungeonResponse, CreateRunResponse, DungeonClientState,
  DungeonRunCreate, DungeonRunResponse, DungeonEventResponse,
  MoveToRoomResponse, DungeonAction, CombatSubmission,
  ScoutResponse, RestResponse, RetreatResponse,
  EncounterChoiceResponse, CombatSubmitResponse,
} from '../../types/dungeon.js';

class DungeonApiService extends BaseApiService {
  // ── Authenticated (12 endpoints) ────────────────────────
  async getAvailable(simId: string): Promise<ApiResponse<AvailableDungeonResponse[]>> {
    return this.get('/dungeons/available', { simulation_id: simId });
  }

  async createRun(simId: string, body: DungeonRunCreate): Promise<ApiResponse<CreateRunResponse>> {
    return this.post(`/dungeons/runs?simulation_id=${simId}`, body);
  }

  async getRun(runId: string): Promise<ApiResponse<DungeonRunResponse>> {
    return this.get(`/dungeons/runs/${runId}`);
  }

  async getState(runId: string): Promise<ApiResponse<DungeonClientState>> {
    return this.get(`/dungeons/runs/${runId}/state`);
  }

  async moveToRoom(runId: string, roomIndex: number): Promise<ApiResponse<MoveToRoomResponse>> {
    return this.post(`/dungeons/runs/${runId}/move`, { room_index: roomIndex });
  }

  async submitAction(runId: string, action: DungeonAction): Promise<ApiResponse<EncounterChoiceResponse>> {
    return this.post(`/dungeons/runs/${runId}/action`, action);
  }

  async submitCombat(runId: string, submission: CombatSubmission): Promise<ApiResponse<CombatSubmitResponse>> {
    return this.post(`/dungeons/runs/${runId}/combat/submit`, submission);
  }

  async scout(runId: string, agentId: string): Promise<ApiResponse<ScoutResponse>> {
    return this.post(`/dungeons/runs/${runId}/scout`, { agent_id: agentId });
  }

  async rest(runId: string, agentIds: string[]): Promise<ApiResponse<RestResponse>> {
    return this.post(`/dungeons/runs/${runId}/rest`, { agent_ids: agentIds });
  }

  async retreat(runId: string): Promise<ApiResponse<RetreatResponse>> {
    return this.post(`/dungeons/runs/${runId}/retreat`, {});
  }

  async getEvents(runId: string, limit = 50, offset = 0): Promise<ApiResponse<DungeonEventResponse[]>> {
    return this.get(`/dungeons/runs/${runId}/events`, {
      limit: String(limit), offset: String(offset),
    });
  }

  async getHistory(simId: string, limit = 25, offset = 0): Promise<ApiResponse<DungeonRunResponse[]>> {
    return this.get('/dungeons/history', {
      simulation_id: simId, limit: String(limit), offset: String(offset),
    });
  }

  // ── Public (2 endpoints) ────────────────────────────────
  async getRunPublic(runId: string): Promise<ApiResponse<DungeonRunResponse>> {
    return this.getPublic(`/dungeons/runs/${runId}`);
  }

  async getHistoryPublic(simId: string, limit = 25, offset = 0): Promise<ApiResponse<DungeonRunResponse[]>> {
    return this.getPublic(`/simulations/${simId}/dungeons/history`, {
      limit: String(limit), offset: String(offset),
    });
  }
}

export const dungeonApi = new DungeonApiService();
```

### 1.3 State Manager (`services/DungeonStateManager.ts`)

Singleton with Preact Signals. Follows TerminalStateManager and ForgeStateManager patterns.

```typescript
import { computed, signal } from '@preact/signals-core';
import { dungeonApi } from './api/DungeonApiService.js';
import type {
  DungeonClientState, DungeonPhase, AgentCombatStateClient,
  CombatStateClient, RoomNodeClient, AvailableDungeonResponse,
  AbilityOption, CombatAction,
} from '../types/dungeon.js';

const STORAGE_KEY = 'dungeon_active_run';

class DungeonStateManager {
  // ── Core State (server-authoritative) ──────────────────
  readonly clientState = signal<DungeonClientState | null>(null);
  readonly runId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Available dungeons (pre-run) ───────────────────────
  readonly availableDungeons = signal<AvailableDungeonResponse[]>([]);

  // ── Combat Planning (local, client-only) ───────────────
  readonly selectedActions = signal<Map<string, CombatAction>>(new Map());
  readonly combatSubmitting = signal(false);

  // ── UI State (client-only) ─────────────────────────────
  readonly mapExpanded = signal(true);
  readonly partyPanelExpanded = signal(true);

  // ── Computed ───────────────────────────────────────────
  readonly isInDungeon = computed(() => this.runId.value !== null);
  readonly phase = computed((): DungeonPhase | null =>
    this.clientState.value?.phase ?? null
  );
  readonly isInCombat = computed(() => {
    const p = this.phase.value;
    return p === 'combat_planning' || p === 'combat_resolving' || p === 'combat_outcome' || p === 'boss';
  });
  readonly party = computed((): AgentCombatStateClient[] =>
    this.clientState.value?.party ?? []
  );
  readonly rooms = computed((): RoomNodeClient[] =>
    this.clientState.value?.rooms ?? []
  );
  readonly currentRoom = computed((): RoomNodeClient | null => {
    const idx = this.clientState.value?.current_room;
    return this.rooms.value.find(r => r.index === idx) ?? null;
  });
  readonly combat = computed((): CombatStateClient | null =>
    this.clientState.value?.combat ?? null
  );
  readonly archetypeState = computed(() =>
    this.clientState.value?.archetype_state ?? {}
  );
  readonly adjacentRooms = computed((): RoomNodeClient[] => {
    const current = this.currentRoom.value;
    if (!current) return [];
    return this.rooms.value.filter(r => current.connections.includes(r.index));
  });
  readonly allActionsSelected = computed(() => {
    const alive = this.party.value.filter(a => a.condition !== 'captured' && a.condition !== 'afflicted');
    return alive.every(a => this.selectedActions.value.has(a.agent_id));
  });

  // ── Timer ──────────────────────────────────────────────
  readonly timerRemaining = signal<number | null>(null); // milliseconds
  private _timerInterval: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle Methods ──────────────────────────────────

  /** Apply a new DungeonClientState from any API response. Single source of truth. */
  applyState(state: DungeonClientState): void {
    this.clientState.value = state;
    this.runId.value = state.run_id;
    this._persistRunId(state.run_id);

    // Reset combat selections on phase change
    if (state.phase !== 'combat_planning') {
      this.selectedActions.value = new Map();
    }

    // Start/stop timer based on phase_timer
    if (state.phase_timer) {
      this._startTimer(state.phase_timer);
    } else {
      this._stopTimer();
    }
  }

  /** Select an ability for an agent during combat planning. */
  selectAction(agentId: string, abilityId: string, targetId?: string): void {
    const next = new Map(this.selectedActions.value);
    next.set(agentId, { agent_id: agentId, ability_id: abilityId, target_id: targetId ?? null });
    this.selectedActions.value = next;
  }

  /** Clear dungeon state (after completion, wipe, or retreat). */
  clear(): void {
    this.clientState.value = null;
    this.runId.value = null;
    this.selectedActions.value = new Map();
    this.error.value = null;
    this._stopTimer();
    this._clearPersistedRunId();
  }

  /** Recovery: check localStorage for active run on page load. */
  async tryRecover(): Promise<boolean> {
    const storedId = this._getPersistedRunId();
    if (!storedId) return false;

    this.loading.value = true;
    try {
      const resp = await dungeonApi.getState(storedId);
      if (resp.success && resp.data) {
        this.applyState(resp.data);
        return true;
      }
      // Run expired/completed — clear stale storage
      this._clearPersistedRunId();
      return false;
    } catch {
      this._clearPersistedRunId();
      return false;
    } finally {
      this.loading.value = false;
    }
  }

  // ── Private ────────────────────────────────────────────

  private _startTimer(timer: { started_at: string; duration_ms: number }): void {
    this._stopTimer();
    const startMs = new Date(timer.started_at).getTime();
    const endMs = startMs + timer.duration_ms;

    const tick = () => {
      const remaining = endMs - Date.now();
      this.timerRemaining.value = Math.max(0, remaining);
      if (remaining <= 0) this._stopTimer();
    };

    tick(); // immediate first tick
    this._timerInterval = setInterval(tick, 100); // 100ms precision for smooth countdown
  }

  private _stopTimer(): void {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = null;
    this.timerRemaining.value = null;
  }

  private _persistRunId(runId: string): void {
    try { localStorage.setItem(STORAGE_KEY, runId); } catch { /* quota */ }
  }

  private _getPersistedRunId(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  private _clearPersistedRunId(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

export const dungeonState = new DungeonStateManager();
```

### Phase 1 Validation Checklist

- [ ] All TypeScript types compile cleanly (`tsc --noEmit`)
- [ ] DungeonApiService methods match backend router exactly (14 endpoints, method + path + params)
- [ ] DungeonStateManager signals are reactive (change propagation verified)
- [ ] `getSimulationData` pattern used for public endpoints (auto-routes to /public when unauthenticated)
- [ ] localStorage persistence for runId works in all browsers
- [ ] Timer precision is smooth (100ms interval, computed from server timestamp + duration)
- [ ] No circular imports between types → services → state

---

## Phase 2: Terminal Integration (Playable via Text)

**Goal:** Full dungeon gameplay through terminal commands only. No HUD yet.
**Dependencies:** Phase 1 complete
**Estimated files:** 2 new, 2 modified

After this phase, a player can: start a dungeon, move between rooms, fight combats, rest, scout, retreat, interact with encounters — all via typed commands. This is the **minimum viable dungeon experience**.

### 2.1 Terminal State Extensions (`TerminalStateManager.ts` modifications)

Add dungeon signals to the existing TerminalStateManager. Follow the epochId/epochParticipant pattern exactly.

```typescript
// ── NEW: Dungeon State (NOT persisted — server-authoritative) ────
readonly dungeonRunId = signal<string | null>(null);
readonly isDungeonMode = computed(() => this.dungeonRunId.value !== null);

// NOTE: The actual dungeon state lives in DungeonStateManager.
// TerminalStateManager only knows IF we're in a dungeon (for command routing).
// This prevents duplicate state between two managers.
```

**Why minimal:** The DungeonStateManager owns the actual state. TerminalStateManager only needs to know "am I in dungeon mode?" for command routing (e.g., `move` means zone-move normally, room-move in dungeon).

### 2.2 Dungeon Commands (`utils/dungeon-commands.ts`)

New file. Exports handler functions consumed by terminal-commands.ts command registry.

```typescript
// Pattern: each handler receives CommandContext, returns TerminalLine[]
// Follows exact same signature as handleLook, handleExamine, etc.

export async function handleDungeonEnter(ctx: CommandContext): Promise<TerminalLine[]>
// 1. Call dungeonApi.getAvailable(simId)
// 2. If no available → system line "No resonance dungeons available"
// 3. If multiple → list available archetypes with suggested difficulty
// 4. If user typed `dungeon shadow` → start The Shadow directly
// 5. Show agent selection (list agents with aptitudes)
// 6. After selection → call dungeonApi.createRun()
// 7. Apply state → dungeonState.applyState(resp.data.state)
// 8. Set terminalState.dungeonRunId
// 9. Return formatDungeonEntry() terminal lines

export async function handleDungeonMove(ctx: CommandContext): Promise<TerminalLine[]>
// Parse room_index from args (e.g., `move 3` or `move north` → resolve to index)
// Validate: room is in adjacentRooms
// Call dungeonApi.moveToRoom()
// Apply state
// Return formatRoomEntry() + any banter/combat/encounter lines

export async function handleDungeonMap(ctx: CommandContext): Promise<TerminalLine[]>
// Read dungeonState.clientState
// Return formatDungeonMap() ASCII output

export async function handleDungeonScout(ctx: CommandContext): Promise<TerminalLine[]>
// Parse agent_id from args (fuzzy match agent name)
// Call dungeonApi.scout()
// Apply state
// Return formatScoutResult()

export async function handleDungeonRest(ctx: CommandContext): Promise<TerminalLine[]>
// Validate: current room is rest type
// Parse agent_ids (default: all non-captured agents)
// Call dungeonApi.rest()
// Apply state
// If ambushed → return formatAmbush() + combat start
// Else → return formatRestResult()

export async function handleDungeonRetreat(ctx: CommandContext): Promise<TerminalLine[]>
// Confirm prompt: "Retreat? Partial loot only. (yes/no)"
// Call dungeonApi.retreat()
// Clear state
// Return formatRetreatResult()

export async function handleDungeonInteract(ctx: CommandContext): Promise<TerminalLine[]>
// Parse choice_id from args (e.g., `interact 2` for choice #2)
// Call dungeonApi.submitAction({ action_type: 'encounter_choice', choice_id })
// Apply state
// Return formatEncounterResult() with skill check display

export async function handleDungeonCombatSubmit(ctx: CommandContext): Promise<TerminalLine[]>
// In terminal-only mode: `attack <agent> <ability> [target]`
// Build CombatSubmission from accumulated selections
// Call dungeonApi.submitCombat()
// If round resolved → return formatCombatResolution()
// If waiting → return "Waiting for other players..."

export async function handleDungeonStatus(ctx: CommandContext): Promise<TerminalLine[]>
// Show current dungeon state summary: room, party, phase, visibility
```

### 2.3 Dungeon Formatters (`utils/dungeon-formatters.ts`)

New file. Pure functions transforming dungeon data to TerminalLine[]. Follows terminal-formatters.ts patterns exactly.

```typescript
export function formatDungeonEntry(state: DungeonClientState, archetype_config: ...): TerminalLine[]
// Archetype intro text, party summary, initial room

export function formatDungeonMap(state: DungeonClientState): TerminalLine[]
// ASCII FTL-style map (from spec §14.2C)
// Groups rooms by depth, draws connections
// Legend: [E] Entrance [C] Combat [!] Elite [?] Unknown [R] Rest [T] Treasure [B] Boss
// Markers: * Current  ■ Cleared  ░ Unrevealed

export function formatRoomEntry(room, encounter, banter, archetype_state): TerminalLine[]
// Banter first, then room type header, then visibility display (Shadow)
// Per spec §14.5 formatRoomEntry example

export function formatCombatStart(enemies: EnemyCombatStateClient[], telegraphs: TelegraphedAction[]): TerminalLine[]
// Enemy listing with condition bars, telegraphed intents

export function formatCombatPlanning(party: AgentCombatStateClient[]): TerminalLine[]
// Available abilities per agent with check_info percentages
// Numbered list for terminal selection

export function formatCombatResolution(round, actions, enemy_actions, narrative, state_changes): TerminalLine[]
// Per spec §14.5 formatCombatResolution example
// Narrative → mechanical outcomes → state changes

export function formatResolveCheck(agent_name, is_virtue, result_name, effects): TerminalLine[]
// THE dramatic moment. Per spec §14.2F
// 3-second pause simulated via delayed line rendering (fresh line IDs with staggered timestamps)
// ████ VIRTUE: COURAGE ████ or ░░░ AFFLICTION: FEAR ░░░

export function formatEncounterChoices(description, choices: EncounterChoice[], party): TerminalLine[]
// Encounter narrative + numbered choices with requirements and agent reactions
// Per spec §14.2E

export function formatScoutResult(revealed_rooms, visibility): TerminalLine[]
export function formatRestResult(healed, ambushed): TerminalLine[]
export function formatRetreatResult(loot: LootItem[]): TerminalLine[]
export function formatLootDrop(items: LootItem[]): TerminalLine[]
export function formatDungeonComplete(outcome): TerminalLine[]
export function formatPartyWipe(): TerminalLine[]
export function formatDungeonStatus(state: DungeonClientState): TerminalLine[]
```

### 2.4 Command Registry Integration (`terminal-commands.ts` modifications)

Add to SYNONYM_MAP:
```typescript
['explore', 'dungeon'], ['delve', 'dungeon'],
['scout', 'scout'], ['observe', 'look'], // scout already unique
['rest', 'rest'], ['camp', 'rest'],
['retreat', 'retreat'], ['flee', 'retreat'], ['escape', 'retreat'],
['interact', 'interact'], ['choose', 'interact'],
['attack', 'attack'], ['fight', 'attack'], ['strike', 'attack'],
['submit', 'submit'], ['ready', 'submit'],
```

Add to parseAndExecute():
```typescript
// Before standard command dispatch, check dungeon mode:
if (terminalState.isDungeonMode.value) {
  const dungeonResult = await dispatchDungeonCommand(verb, args, ctx);
  if (dungeonResult !== null) return dungeonResult; // handled by dungeon
  // If null → fall through to standard commands (help, config, etc.)
}
```

**Command override logic:** In dungeon mode, `move` means room-move (not zone-move), `look` shows current room (not zone), `status` shows dungeon status. `help`, `config`, `filter`, `clear` still work normally.

### Phase 2 Validation Checklist

- [ ] Can type `dungeon` → starts a run → see entry text
- [ ] Can type `map` → ASCII map with fog-of-war renders correctly
- [ ] Can type `move 3` → party moves, room entry text appears
- [ ] Can type `scout kovacs` → fuzzy-matched, rooms revealed
- [ ] Can type `rest` → stress recovery or ambush
- [ ] Can type `retreat` → partial loot, dungeon ends
- [ ] Can type `interact 2` → encounter choice resolved, skill check display
- [ ] Combat: `attack kovacs observe echo` → selects ability, `submit` → resolves round
- [ ] Resolve Check: dramatic text output with ████ boxes
- [ ] All dungeon commands show in `help` during dungeon mode
- [ ] Non-dungeon commands (help, config, clear) still work in dungeon mode
- [ ] `ruff check` + `tsc --noEmit` pass

---

## Phase 3: View Shell & Header (Layout Foundation)

**Goal:** Route, layout component, header bar, quick actions. The "frame" for the dungeon UI.
**Dependencies:** Phase 2 complete
**Estimated files:** 4 new, 2 modified

### 3.1 Route Registration (`app-shell.ts` modification)

```typescript
{
  path: '/simulation/:slug/dungeon',
  render: () => html`<velg-dungeon-terminal-view></velg-dungeon-terminal-view>`,
  enter: async () => {
    await this._authReady;
    if (!await this._lazy(() => import('./components/dungeon/DungeonTerminalView.js'))) {
      return false;
    }
    const simName = appState.currentSimulation.value?.name ?? '';
    seoService.setTitle([msg('Resonance Dungeon'), simName]);
    analyticsService.trackPageView('/simulation/dungeon', document.title);
    return true;
  },
}
```

### 3.2 DungeonTerminalView (`components/dungeon/DungeonTerminalView.ts`)

Layout shell. Wraps BureauTerminal + HUD panels. Same pattern as EpochTerminalView.

```typescript
@customElement('velg-dungeon-terminal-view')
export class VelgDungeonTerminalView extends SignalWatcher(LitElement) {
  // CSS layout:
  // - Grid: header (auto) | main area (1fr) | actions (auto)
  // - Main area: terminal (1fr) | party panel (280px on desktop, hidden on mobile)
  // - Map: collapsible between terminal and actions
  // - Mobile (<768px): single column, party panel as collapsible top strip

  // On connectedCallback:
  // 1. Import DungeonStateManager
  // 2. Call dungeonState.tryRecover() — reconnect to active run
  // 3. If no active run → show "no dungeon" state with available dungeons list

  // Reactive rendering based on dungeonState.isInDungeon:
  // - false → EmptyState "No active dungeon. Type 'dungeon' in the terminal to begin."
  //           + List of available dungeons (from dungeonState.availableDungeons)
  // - true → Full HUD layout

  // Phase-reactive panel visibility:
  // - DungeonHeader: always visible when in dungeon
  // - DungeonPartyPanel: always visible when in dungeon
  // - DungeonMap: visible when mapExpanded signal is true
  // - DungeonQuickActions: visible when NOT in combat
  // - DungeonCombatBar: visible when IN combat (combat_planning phase)
  // - DungeonEnemyPanel: visible when IN combat (any combat phase)
}
```

**CSS Layout (critical):**
```css
:host {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr 280px;
  height: 100%;
  gap: var(--spacing-xs);

  /* Tier 3 component-local tokens */
  --_dungeon-bg: var(--color-surface);
  --_dungeon-border: var(--color-border);
}

/* Header spans full width */
.dungeon-header { grid-column: 1 / -1; }

/* Terminal + Map stack in left column */
.dungeon-main {
  grid-column: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Party panel in right column */
.dungeon-party { grid-column: 2; overflow-y: auto; }

/* Actions span full width */
.dungeon-actions { grid-column: 1 / -1; }

/* ── Mobile (< 768px) ────────────── */
@media (max-width: 767px) {
  :host {
    grid-template-columns: 1fr;
  }
  .dungeon-party {
    grid-column: 1;
    /* Collapses to top strip: names + condition bars only */
    max-height: var(--_party-collapsed-height, 80px);
    transition: max-height var(--duration-slow) var(--ease-dramatic);
  }
  .dungeon-party[expanded] {
    max-height: 50vh;
  }
}

/* ── Reduced Motion ───────────────── */
@media (prefers-reduced-motion: reduce) {
  .dungeon-party { transition: none; }
}
```

### 3.3 DungeonHeader (`components/dungeon/DungeonHeader.ts`)

Thin top bar. Uses existing design patterns from EpochCommandCenter banner.

```typescript
@customElement('velg-dungeon-header')
export class VelgDungeonHeader extends SignalWatcher(LitElement) {
  // Reactive from dungeonState:
  // - archetype name (colored badge per resonance signature)
  // - depth progress bar (scaleX, current_depth / depth_target)
  // - rooms counter (rooms_cleared / rooms_total)
  // - visibility pips (Shadow-specific, 3 diamonds filled/empty)
  // - difficulty stars (1-5)

  // Micro-animations:
  // - Depth bar: width transition 400ms ease-out on floor change
  // - Visibility pips: phosphor-persist pulse on change
  // - Archetype name: subtle letter-spacing variation (--font-mono)

  // ARIA: role="banner", aria-label with full status text for screen readers
}
```

### 3.4 DungeonQuickActions (`components/dungeon/DungeonQuickActions.ts`)

Context-dependent action buttons below the terminal. Reuses TerminalQuickActions pattern.

```typescript
@customElement('velg-dungeon-quick-actions')
export class VelgDungeonQuickActions extends SignalWatcher(LitElement) {
  // Actions shown depend on phase:
  // exploring → [Scout] [Map] [Status] [Retreat]
  // encounter → [Choice 1] [Choice 2] [Choice 3] [Choice 4]  (from encounter data)
  // rest → [Rest All] [Rest <agent>...] [Move On]
  // treasure → [Take Loot] [Move On]
  // exit → [Leave Dungeon] [Continue]
  // room_clear → [Move to Room X]... (adjacent rooms as buttons)

  // Each button dispatches to dungeon-commands.ts handler (same code path as typing)
  // Keyboard: Tab navigation between buttons, Enter to activate
  // ARIA: role="toolbar", aria-label="Dungeon actions"
  // Touch: min 44px height

  // Adjacent room buttons show room type icon + index
  // Encounter choice buttons show choice label + requirement indicator
}
```

### 3.5 Icons Addition (`utils/icons.ts` modification)

Add dungeon-specific icons (Tabler Icons style, matching existing stroke-width 2.5):

```typescript
// Room types
icons.dungeonCombat = (size = 16) => svg`...`       // Crossed swords
icons.dungeonElite = (size = 16) => svg`...`         // Skull
icons.dungeonEncounter = (size = 16) => svg`...`     // Question mark in circle
icons.dungeonTreasure = (size = 16) => svg`...`      // Chest
icons.dungeonRest = (size = 16) => svg`...`          // Campfire
icons.dungeonBoss = (size = 16) => svg`...`          // Crown/skull
icons.dungeonEntrance = (size = 16) => svg`...`      // Door open
icons.dungeonExit = (size = 16) => svg`...`          // Door exit

// Combat
icons.shield = (size = 16) => svg`...`               // Shield
icons.sword = (size = 16) => svg`...`                // Sword
icons.spell = (size = 16) => svg`...`                // Sparkles/wand
icons.stress = (size = 16) => svg`...`               // Brain with lightning
icons.condition = (size = 16) => svg`...`            // Heart with pulse
icons.visibility = (size = 16) => svg`...`           // Eye
icons.telegraph = (size = 16) => svg`...`            // Arrow/intent indicator

// Abilities (per school)
icons.abilitySpy = (size = 16) => svg`...`           // Eye
icons.abilityGuardian = (size = 16) => svg`...`      // Shield
icons.abilitySaboteur = (size = 16) => svg`...`      // Wrench/bomb
icons.abilityPropagandist = (size = 16) => svg`...`  // Megaphone
icons.abilityInfiltrator = (size = 16) => svg`...`   // Mask
icons.abilityAssassin = (size = 16) => svg`...`      // Dagger
```

### Phase 3 Validation Checklist

- [ ] Route `/simulation/:slug/dungeon` loads DungeonTerminalView
- [ ] Layout renders correctly at 1440px, 1024px, 768px, 375px widths
- [ ] BureauTerminal renders inside the layout, unmodified
- [ ] DungeonHeader shows archetype, depth, rooms, visibility
- [ ] Quick actions show context-appropriate buttons per phase
- [ ] Quick action buttons dispatch to dungeon-commands.ts handlers
- [ ] Recovery: page reload reconnects to active dungeon run
- [ ] Empty state shown when no active dungeon
- [ ] All new icons render correctly at multiple sizes
- [ ] WCAG AA: all text contrast passes, ARIA landmarks present
- [ ] `lint-color-tokens.sh` passes (no raw #hex)
- [ ] `tsc --noEmit` passes

---

## Phase 4: Party Panel & Map (Visual HUD)

**Goal:** Right sidebar with agent status. SVG dungeon map with fog-of-war and click-to-move.
**Dependencies:** Phase 3 complete
**Estimated files:** 2 new

### 4.1 DungeonPartyPanel (`components/dungeon/DungeonPartyPanel.ts`)

Right sidebar showing agent cards. Per spec §14.2B.

```typescript
@customElement('velg-dungeon-party-panel')
export class VelgDungeonPartyPanel extends SignalWatcher(LitElement) {
  // Renders one card per agent from dungeonState.party signal

  // Each agent card:
  // - VelgAvatar (sm: 32px) + agent name
  // - Primary aptitude badge (school icon + level, colored)
  // - Condition bar: colored by condition state
  //   operational → --color-success (green)
  //   stressed → --color-warning (amber) + subtle pulse
  //   wounded → --color-danger (red) + pulse
  //   afflicted → --color-danger + chromatic aberration + pulse-glow 2s
  //   captured → --color-text-muted + strikethrough name
  // - Stress bar: continuous fill with threshold visual escalation
  //   0-200: calm amber
  //   200-500: brighter amber, "TENSE" label
  //   500-800: orange-red gradient, pulse-glow
  //   800-1000: deep red, rapid pulse, "CRITICAL" label
  // - Mood indicator: compact +/- number with color
  // - Active buffs/debuffs: pill list (green diamond / red diamond + name)

  // Micro-animations:
  // - Bar changes: transition width var(--duration-slow) var(--ease-out)
  // - Buff/debuff pills: slide-in with field-reveal animation
  // - Condition change: flash entire card border with new color (300ms)
  // - Portrait: CRT distortion filter at Afflicted (entropy-dissolve from SvgFilters.ts)

  // Mobile collapsed mode:
  // - Only name + condition bar (one line per agent)
  // - Tap to expand full card

  // ARIA:
  // - role="complementary", aria-label="Party status"
  // - Each agent card: role="group", aria-label="Agent {name}: {condition}, Stress {threshold}"
  // - Condition changes: aria-live="polite" for status updates
}
```

### 4.2 DungeonMap (`components/dungeon/DungeonMap.ts`)

SVG DAG with fog-of-war. Collapsible. Click-to-move.

```typescript
@customElement('velg-dungeon-map')
export class VelgDungeonMap extends SignalWatcher(LitElement) {
  // Renders rooms[] and connections as an SVG directed acyclic graph
  // Layout algorithm: rooms grouped by depth (y-axis), spread within depth (x-axis)

  // Node rendering:
  // - Shape varies by room_type: circle (combat), diamond (elite), square (encounter),
  //   hexagon (treasure), triangle-up (rest), octagon (boss), arrow-right (exit)
  // - Unrevealed (!revealed): "?" symbol, reduced opacity (0.3), fog blur
  // - Cleared: dimmed fill, checkmark overlay
  // - Current: pulsing amber glow (box-shadow animation)
  // - Adjacent to current (and revealed): highlight border, clickable

  // Edge rendering:
  // - Lines between connected rooms
  // - Glow effect on edges adjacent to current room
  // - Dashed for edges to unrevealed rooms

  // Interaction:
  // - Click on adjacent revealed room → dispatches handleDungeonMove(roomIndex)
  // - Hover: tooltip with room type name
  // - NOT keyboard-navigable (the terminal map command serves keyboard users)

  // SVG sizing:
  // - Responsive: viewBox based on graph dimensions
  // - Min width 200px, scales with container
  // - Collapsible: smooth height transition to 0

  // Layout algorithm (simple layered DAG):
  // 1. Group rooms by depth
  // 2. Within each depth, space rooms evenly on x-axis
  // 3. Y = depth * ROW_HEIGHT
  // 4. X = (index_within_depth * COLUMN_WIDTH) centered
  // 5. Draw edges as SVG <line> between connected node centers

  // Fog-of-war effect:
  // - Unrevealed rooms: SVG <filter> with feGaussianBlur + reduced opacity
  // - Revealed but uncleared: normal rendering
  // - Cleared: apply a desaturation filter

  // Theming: all colors via CSS custom properties
  // --_map-node-combat: var(--color-danger)
  // --_map-node-encounter: var(--color-warning)
  // --_map-node-rest: var(--color-success)
  // --_map-node-treasure: var(--color-ascendant-gold, var(--color-warning))
  // --_map-node-boss: var(--color-danger)
  // --_map-node-unknown: var(--color-text-muted)
  // --_map-edge: var(--color-border)
  // --_map-current-glow: var(--color-primary)
}
```

### Phase 4 Validation Checklist

- [ ] Party panel shows all agents with correct condition/stress/mood
- [ ] Condition bars use correct semantic color tokens per state
- [ ] Stress bar threshold visual escalation at 200/500/800 boundaries
- [ ] Buff/debuff pills render and animate on add/remove
- [ ] Party panel collapses on mobile (<768px) to name + condition strip
- [ ] SVG map renders rooms in correct DAG layout
- [ ] Fog-of-war: unrevealed rooms show "?" with blur
- [ ] Click on adjacent room triggers move command
- [ ] Current room has pulsing glow
- [ ] Map collapses/expands smoothly
- [ ] `prefers-reduced-motion` disables all pulse/glow animations
- [ ] Screen reader: party status changes announced via aria-live
- [ ] `lint-color-tokens.sh` passes

---

## Phase 5: Combat System (Core Game Loop)

**Goal:** Combat action bar, enemy panel, timer, ability selection, combat resolution display.
**Dependencies:** Phase 4 complete
**Estimated files:** 2 new

This is the **heart of the dungeon experience**. The 30-second planning phase with transparent probability information and Into-the-Breach-style enemy telegraphs is what makes this game unique. Maximum care.

### 5.1 DungeonCombatBar (`components/dungeon/DungeonCombatBar.ts`)

Replaces DungeonQuickActions during combat_planning phase. Per spec §14.2D.

```typescript
@customElement('velg-dungeon-combat-bar')
export class VelgDungeonCombatBar extends SignalWatcher(LitElement) {
  // Layout: one column per alive agent + timer column
  // Each agent column:
  //   - Agent name + primary aptitude
  //   - Ability list (from agent.available_abilities)
  //   - Each ability button shows:
  //     - ◉/○/★ state indicator
  //     - Ability name
  //     - Description (one line)
  //     - check_info probability ("Spy 8: 73%")
  //     - Target selector (if ability has targets)

  // Ability button states:
  // ◉ Available: amber border, hover glow, clickable
  //   - On click: dungeonState.selectAction(agentId, abilityId, targetId?)
  //   - Selected: filled background (--color-primary at 15%), checkmark
  // ○ Cooldown: dimmed, dashed border, "CD: N rounds" label
  // ★ Ultimate: gold border (--color-ascendant-gold), once per dungeon
  //   - Used: strikethrough
  // Disabled (agent Afflicted/Captured): entire column grayed, condition stamp overlay

  // Timer column:
  // - Countdown from 30s → 0s
  // - Progress bar: existing RP meter pattern, scaleX(remaining/total)
  // - Color: green (30-15s) → amber (15-5s) → red (5-0s) with pulse
  // - Uses dungeonState.timerRemaining signal
  // - At 0: "AUTO-DEFEND" flash (server resolves automatically)

  // Submit button:
  // - Visible when dungeonState.allActionsSelected is true
  // - "[✓ SUBMIT ALL]" — amber, prominent
  // - On click: build CombatSubmission from selectedActions, call dungeonApi.submitCombat()
  // - Loading state during submission

  // Target selection flow:
  // 1. Player clicks ability → ability highlighted
  // 2. If ability needs target → enemy panel highlights targetable enemies
  // 3. Player clicks enemy → action registered
  // 4. If no target needed → action registered immediately

  // Keyboard navigation:
  // - Tab moves between agent columns
  // - Arrow Up/Down moves between abilities within column
  // - Enter selects ability
  // - If target needed, Tab moves to enemy panel

  // Mobile (<768px):
  // - One agent at a time, swipe/tab between agents
  // - Timer always visible as thin bar at top of combat bar
  // - Submit button fixed at bottom

  // ARIA:
  // - role="toolbar", aria-label="Combat planning"
  // - Each agent group: role="group", aria-label="Agent {name}'s abilities"
  // - Each ability button: aria-pressed for selection state
  // - Timer: role="timer", aria-live="assertive" at 10s/5s/0s
}
```

### 5.2 DungeonEnemyPanel (`components/dungeon/DungeonEnemyPanel.ts`)

Shows during all combat phases. Per spec §14.2D enemy panel.

```typescript
@customElement('velg-dungeon-enemy-panel')
export class VelgDungeonEnemyPanel extends SignalWatcher(LitElement) {
  // Renders enemies from dungeonState.combat.enemies

  // Each enemy row:
  // - Name (en/de based on locale)
  // - Condition bar: simple filled bar (healthy → damaged → critical → defeated)
  //   healthy: full green, damaged: 2/3 amber, critical: 1/3 red+pulse, defeated: empty+strikethrough
  // - Threat level badge: minion(gray) / standard(amber) / elite(red) / boss(purple)
  // - Telegraphed intent (Into the Breach style):
  //   "► Attack Kovacs" — with threat-level coloring
  //   "► Stress attack party" — high = red, medium = amber, low = green
  //   "► ???" — Paranoia Shade, unpredictable (flicker animation)

  // Target highlighting:
  // - When player is selecting a target, targetable enemies get highlight border
  // - Click on highlighted enemy → registers target in combat action

  // During combat_resolving phase:
  // - All buttons disabled
  // - "RESOLVING..." overlay with scanline animation

  // During combat_outcome phase:
  // - Show results: defeated enemies fade, damage indicators shown

  // ARIA:
  // - role="list", aria-label="Enemies"
  // - Each enemy: role="listitem" with full status text
  // - Telegraphed intents: announced via aria-live="polite"
}
```

### 5.3 Combat Phase State Machine (in DungeonTerminalView)

The combat phase drives HUD panel visibility and behavior:

```
combat_planning:
  - DungeonEnemyPanel: SHOW (with telegraphs)
  - DungeonCombatBar: SHOW (ability selection enabled)
  - Timer: RUNNING
  - DungeonQuickActions: HIDDEN
  - Terminal: shows assessment text, ability list

combat_resolving:
  - DungeonEnemyPanel: SHOW (read-only, "RESOLVING" overlay)
  - DungeonCombatBar: SHOW (all disabled, "SUBMITTED" state)
  - Timer: STOPPED
  - Terminal: shows "Resolving combat..." line

combat_outcome:
  - DungeonEnemyPanel: SHOW (results displayed, defeated fade)
  - DungeonCombatBar: HIDDEN
  - DungeonQuickActions: HIDDEN
  - Terminal: shows formatCombatResolution() text
  - 5s display, then auto-transition to room_clear or next planning

room_clear (after combat):
  - DungeonEnemyPanel: HIDDEN
  - DungeonCombatBar: HIDDEN
  - DungeonQuickActions: SHOW (adjacent rooms)
  - Terminal: shows loot, room cleared text
```

### Phase 5 Validation Checklist

- [ ] Combat bar shows one column per alive agent with correct abilities
- [ ] Ability buttons show name, description, check_info %, cooldown state
- [ ] Selection flow: click ability → if target needed → click enemy → action registered
- [ ] All actions selected → Submit button appears and works
- [ ] Timer counts down from 30s with color transitions (green → amber → red)
- [ ] Timer at 0: "AUTO-DEFEND" flash, server auto-resolves
- [ ] Enemy panel shows condition bars and telegraphed intents
- [ ] Targeting: highlighted enemies during target selection
- [ ] Resolution phase: disabled state, overlay, terminal text output
- [ ] Outcome phase: results display, defeated enemies fade
- [ ] Combat → room_clear transition after 5s outcome display
- [ ] Multiple combat rounds: new planning phase starts cleanly
- [ ] Victory/wipe: correct terminal output and state transitions
- [ ] Mobile: one-agent-at-a-time layout works
- [ ] Keyboard: Tab/Arrow/Enter navigation through abilities
- [ ] Screen reader: timer announced at 10s/5s/0s, enemy intents readable
- [ ] Resolve Check: dramatic terminal output with 3s pause, party panel flash

---

## Phase 6: Encounters, Events & Loot

**Goal:** Rich encounter interaction, skill check display, event log, loot presentation.
**Dependencies:** Phase 5 complete
**Estimated files:** 0 new (extends existing components + formatters)

This phase enriches the non-combat gameplay. Encounters are the narrative soul of the dungeon.

### 6.1 Encounter Rendering (via formatters + QuickActions)

Encounters render as **terminal text** (per spec §14.2E: "This is terminal output, not a separate component"). The encounter text is pushed to the terminal buffer. Choices appear as numbered options AND as Quick Action buttons.

```
Terminal output:
  ═══ ENCOUNTER: THE PRISONER ═══
  [narrative text...]

  [1] Free the prisoner
      Requires: Agreeableness > 0.5
      ► Mira volunteers (Agreeableness: 0.8)
  [2] Interrogate first
      Spy check: Kovacs 73% success
  [3] Destroy it
      Assassin check: Voss 76% success
  [4] Leave it. Move on.
      No check. No risk. No reward.

Quick Action buttons:
  [1: Free] [2: Interrogate] [3: Destroy] [4: Leave]
```

Player types `1`/`2`/`3`/`4` or clicks button → `handleDungeonInteract(choiceId)`.

### 6.2 Skill Check Result Display

After an encounter choice with a skill check, the resolution shows:

```
[INFILTRATOR CHECK — Aptitude 5: Base 55% + (5×3%) = 70%
  Personality: Conscientiousness 0.8 → +8%
  Context: Visibility 0 → -15%
  Final: 63%]

Rolling... ████████░░ 63%

Result: 58 — PARTIAL SUCCESS

[narrative outcome text...]
  → [effects list]
```

Formatter: `formatSkillCheckResult()` — transparent probability breakdown, animated rolling bar, result with narrative.

### 6.3 Event Log (Dungeon History)

Available via terminal command `events` or `log`. Calls `dungeonApi.getEvents()` with pagination.

```
formatDungeonEventLog(events: DungeonEventResponse[]): TerminalLine[]
// Chronological event list with depth/room, type icon, narrative
// Paginated: "Showing 1-50 of 127. Type 'events next' for more."
```

### 6.4 Loot Presentation

Loot appears in terminal text after combat victories and treasure rooms.

```
═══ LOOT FOUND ═══

  ★ Shadow Shard (Tier 2)
    Reduce one agent's stress by 150
    "A fragment of crystallized darkness. It hums with absorbed fear."

  ◆ Veil Fragment (Tier 1)
    +1 Visibility Point
    "A scrap of the shadow's own concealment."
```

Formatter: `formatLootDrop()` — tier indicators (◆ Tier 1, ★ Tier 2, ✦ Tier 3), effect description, flavor text.

### 6.5 Post-Run Summary

When dungeon completes (victory or retreat with loot):

```
═══════════════════════════════════════════════
  DUNGEON COMPLETE — THE SHADOW
═══════════════════════════════════════════════

  Depth Reached: 5/5
  Rooms Cleared: 12/15
  Combats Won: 4
  Time: 18:32

  PARTY STATUS:
  Kovacs — OPERATIONAL (Stress: 230)
  Mira   — STRESSED (Stress: 520) [Virtue: Courage]
  Voss   — WOUNDED (Stress: 680)

  LOOT:
  ★ Shadow Shard (Stress -150 → applied to Voss)
  ◆ Veil Fragment (+1 VP)
  ✦ Shadow Mastery (+1 Spy Aptitude → applied to Kovacs)

  AGENT EFFECTS APPLIED:
  → Mood changes, moodlets, opinion modifiers
  → Memory created: "Survived The Shadow"
═══════════════════════════════════════════════
```

### Phase 6 Validation Checklist

- [ ] Encounter text renders in terminal with numbered choices
- [ ] Quick Action buttons match encounter choices
- [ ] Typing number or clicking button triggers correct choice
- [ ] Skill check result shows full probability breakdown
- [ ] Agent personality reactions appear in encounter text
- [ ] Event log command works with pagination
- [ ] Loot drops display with tier indicators and descriptions
- [ ] Post-run summary shows complete stats and applied effects
- [ ] All text uses `msg()` for i18n readiness
- [ ] No em dashes (U+2014) in user-facing strings

---

## Phase 7: Realtime & Recovery

**Goal:** Supabase Broadcast for multiplayer sync, crash recovery flow, Screen Wake Lock.
**Dependencies:** Phase 6 complete
**Estimated files:** 0 new (extends RealtimeService + DungeonStateManager)

### 7.1 RealtimeService Extension

Add dungeon channels (same pattern as Epoch channels):

```typescript
// In RealtimeService:

joinDungeon(runId: string): void {
  // State channel: room transitions, phase changes
  this._dungeonStateChannel = supabase
    .channel(`dungeon:${runId}:state`, { config: { private: true } })
    .on('broadcast', { event: 'state_update' }, (payload) => {
      const state = payload.payload as DungeonClientState;
      dungeonState.applyState(state);
    })
    .subscribe();

  // Combat channel: combat resolution events
  this._dungeonCombatChannel = supabase
    .channel(`dungeon:${runId}:combat`, { config: { private: true } })
    .on('broadcast', { event: 'combat_resolved' }, (payload) => {
      // Update combat state, trigger resolution display
      dungeonState.applyState(payload.payload.state);
      // Push resolution text to terminal
      const lines = formatCombatResolution(...payload.payload);
      terminalState.appendOutput(lines);
    })
    .subscribe();

  // Presence channel: who's in the dungeon
  this._dungeonPresenceChannel = supabase
    .channel(`dungeon:${runId}:presence`, { config: { private: true } })
    .on('presence', { event: 'sync' }, () => {
      // Update online player list (for multiplayer)
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this._dungeonPresenceChannel?.track({
          user_id: appState.user.value?.id,
          online_at: new Date().toISOString(),
        });
      }
    });
}

leaveDungeon(): void {
  this._dungeonStateChannel?.unsubscribe();
  this._dungeonCombatChannel?.unsubscribe();
  this._dungeonPresenceChannel?.unsubscribe();
}
```

### 7.2 Recovery Flow

On page load (in DungeonTerminalView.connectedCallback):

```
1. Check localStorage for dungeonRunId
2. If found → call GET /runs/{runId}/state
3. If run still active:
   a. dungeonState.applyState(response)
   b. realtimeService.joinDungeon(runId)
   c. Terminal: systemLine("Reconnected to dungeon session.")
   d. If in combat_planning → restore timer from phase_timer
4. If run completed/abandoned/wiped:
   a. Clear localStorage
   b. Terminal: systemLine("Dungeon session ended while you were away.")
   c. If completed → show outcome summary
5. If error (404, network):
   a. Clear localStorage
   b. Terminal: systemLine("Could not reconnect to dungeon session.")
```

### 7.3 Screen Wake Lock

Prevent screen dimming during active dungeon sessions:

```typescript
// In DungeonTerminalView:
private _wakeLock: WakeLockSentinel | null = null;

async _acquireWakeLock(): void {
  if ('wakeLock' in navigator) {
    try {
      this._wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* user denied or not supported */ }
  }
}

disconnectedCallback(): void {
  this._wakeLock?.release();
  super.disconnectedCallback();
}
```

### Phase 7 Validation Checklist

- [ ] Realtime state updates render in all HUD panels
- [ ] Combat resolution from another player triggers resolution display
- [ ] Presence tracking shows online players (multiplayer prep)
- [ ] Page reload reconnects to active dungeon within 2s
- [ ] Expired run shows appropriate message and clears state
- [ ] Screen Wake Lock acquired on dungeon start, released on end
- [ ] RealtimeService cleanup on dungeon end (no leaked channels)
- [ ] Reconnection after brief network loss restores state

---

## Phase 8: Polish, Mobile, Accessibility, Theming

**Goal:** Production-quality UX. Mobile layout refinement. Full WCAG AA. Theme compatibility.
**Dependencies:** Phase 7 complete

### 8.1 Animation Refinement

All animations use existing tokens (`--duration-entrance`, `--ease-dramatic`, etc.) and respect `prefers-reduced-motion`.

**Key animations:**
- **Combat timer color transitions:** CSS `transition: background-color` with keyframe color stops at 50%/83%/100%
- **Condition change flash:** Card border `animation: condition-flash 300ms` with condition color
- **Resolve Check dramatic pause:** 3s delay between "Resolving..." and result. Terminal cursor blinks. Then result lines appear with `phosphor-persist` animation at 1.5x brightness
- **Party wipe:** All agent cards get `entropy-dissolve` filter. Terminal text: chromatic aberration
- **Dungeon completion:** Victory fanfare: gold border pulse on header, loot items stagger-reveal (40ms delay each)
- **Map node pulse:** Current room SVG circle with `animation: node-pulse 2s ease-in-out infinite`
- **Visibility pip change:** Diamond fill transitions with phosphor glow (1.2s)

### 8.2 Mobile Refinement

- **Party panel:** Collapsible top strip (names + condition bars). Tap to expand.
- **Combat bar:** One agent at a time. Swipe left/right or tap agent tab. Timer always visible.
- **Map:** Hidden by default on mobile. Toggle via `map` command or map button.
- **Touch targets:** All interactive elements ≥ 44px height.
- **Font size:** 16px minimum on inputs (prevent iOS auto-zoom).
- **Safe area:** `padding-bottom: env(safe-area-inset-bottom)` on action bars.
- **Scroll behavior:** `overscroll-behavior: contain` on modal/panel elements.
- **`@media (max-height: 700px)`:** Compact header, reduced party panel spacing (iPhone SE).

### 8.3 Accessibility Audit

- [ ] All interactive elements keyboard-reachable (Tab order follows visual flow)
- [ ] Combat planning: focus management moves to first ability on phase enter
- [ ] Timer: `role="timer"`, `aria-live="assertive"` at 10s and 5s
- [ ] Dungeon events: `aria-live="polite"` on new terminal lines (existing pattern)
- [ ] Enemy telegraphs: announced to screen readers
- [ ] Condition changes: aria-live on party panel status
- [ ] Color contrast: all new tokens pass WCAG AA (verified against all 10 theme presets)
- [ ] Focus trap: modals/overlays use existing `focus-trap.ts` utility
- [ ] `prefers-reduced-motion`: all durations → 0ms, no flashing

### 8.4 Theme Compatibility

Test against all 10 existing theme presets:
- brutalist, cyberpunk, sunless-sea, art-nouveau, bauhaus, memphis, swiss, noir, vaporwave, terminal-green

Each preset defines different values for `--color-primary`, `--color-surface`, `--color-danger`, `--color-success`, `--color-warning`, `--color-border`, `--font-mono`, shadows, and animation speed.

Dungeon components use ONLY Tier 1/2 tokens and Tier 3 `--_*` variables derived from Tier 1/2. No preset-specific code.

### 8.5 i18n Preparation

All user-facing strings wrapped in `msg()`. No em dashes. No LLM-ism words. Run `lint-llm-content.sh` to verify.

Dungeon-specific strings to internationalize:
- Room type names, condition labels, stress threshold labels
- Ability descriptions, encounter text, banter templates
- UI labels: "Submit", "Retreat", "Scout", timer display
- Error messages, empty states, loading states

Note: Backend sends `narrative_en` and `narrative_de` for all events. Frontend selects based on locale.

### Phase 8 Validation Checklist

- [ ] All animations smooth at 60fps
- [ ] `prefers-reduced-motion` disables all animations
- [ ] Mobile layout tested on iPhone SE, iPhone 15, Pixel 7, iPad Mini
- [ ] All 10 theme presets render correctly
- [ ] `lint-color-tokens.sh` passes
- [ ] `lint-color-contrast.sh` passes with dungeon tokens
- [ ] `lint-llm-content.sh` passes
- [ ] Keyboard-only navigation complete flow: start dungeon → combat → complete
- [ ] Screen reader complete flow: all information accessible
- [ ] No raw `#hex` or `rgba()` in any dungeon CSS
- [ ] `tsc --noEmit` passes
- [ ] `ruff check` passes (if any Python touched)

---

## Dependency Graph

```
Phase 1 (Data Layer)
  │
  ▼
Phase 2 (Terminal Integration)
  │
  ▼
Phase 3 (View Shell & Header)
  │
  ├─────────────┐
  ▼             ▼
Phase 4       Phase 5
(Party+Map)   (Combat UI)
  │             │
  └──────┬──────┘
         ▼
Phase 6 (Encounters & Events)
         │
         ▼
Phase 7 (Realtime & Recovery)
         │
         ▼
Phase 8 (Polish & Mobile)
```

**Note:** Phases 4 and 5 can be worked in parallel after Phase 3, as Party/Map and Combat UI are independent components. Phase 6 depends on both because encounter choices interact with both Quick Actions (Phase 3) and Party Panel updates (Phase 4), and combat resolution display (Phase 5).

---

## Shared Component Reuse

| Shared Component | Dungeon Usage | Phase |
|-----------------|---------------|-------|
| BureauTerminal | Terminal interface (unmodified, wrapped) | 3 |
| VelgTabs | N/A (no tab-based navigation in dungeon) | — |
| BaseModal | Future: detailed agent inspect, loot detail | 8 |
| VelgDetailPanel | Room details on map hover (future) | 8 |
| VelgAptitudeBars | Agent aptitude display in party panel | 4 |
| VelgAvatar | Agent portraits in party panel | 4 |
| Toast | Combat events, loot drops as toasts | 6 |
| EmptyState | "No active dungeon" state | 3 |
| LoadingState | Dungeon loading screen | 3 |
| ErrorState | API error display | 3 |
| terminal-theme-styles | CRT aesthetic tokens | 3 |
| focus-trap | Modal focus management | 5 |

---

## New Icons Required (Phase 3)

| Icon Name | Visual | Usage |
|-----------|--------|-------|
| dungeonCombat | Crossed swords | Room type indicator |
| dungeonElite | Skull with crown | Room type indicator |
| dungeonEncounter | "?" in circle | Room type indicator |
| dungeonTreasure | Open chest | Room type indicator |
| dungeonRest | Campfire | Room type indicator |
| dungeonBoss | Crown with skull | Room type indicator |
| dungeonEntrance | Door (open) | Room type indicator |
| dungeonExit | Door with arrow | Room type indicator |
| shield | Shield | Guardian school |
| sword | Sword | Combat action |
| spell | Sparkles | Ability indicator |
| stress | Brain with bolt | Stress display |
| visibility | Eye | Shadow mechanic |
| telegraph | Arrow right | Enemy intent |
| abilitySpy | Eye (outlined) | Spy school |
| abilityGuardian | Shield (filled) | Guardian school |
| abilitySaboteur | Wrench | Saboteur school |
| abilityPropagandist | Megaphone | Propagandist school |
| abilityInfiltrator | Mask | Infiltrator school |
| abilityAssassin | Dagger | Assassin school |

All icons: Tabler Icons style, stroke-width 2.5, viewBox 0 0 24 24, `aria-hidden="true"`.

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| BureauTerminal modification regression | HIGH | Decision 1: Do NOT modify BureauTerminal. Wrap it. |
| State desync between terminal and HUD | HIGH | Decision 2: Single source of truth (DungeonStateManager). Every action returns fresh state. |
| Combat timer drift (client vs server) | MEDIUM | Timer computed from `server_started_at + duration_ms`. Client never owns timer truth. |
| Mobile combat bar too complex | MEDIUM | One-agent-at-a-time swipe. Timer always visible. Submit fixed. |
| Theme incompatibility | MEDIUM | Only Tier 1/2 tokens. Test against all 10 presets. |
| Encounter text too long for terminal | LOW | Terminal has MAX_OUTPUT_LINES=500, auto-scroll. Encounter text is typically 5-15 lines. |
| SVG map perf with large graphs | LOW | Max 7 depth × 3 width = 21 nodes. SVG is trivial at this scale. |
| Accessibility: screen reader combat | MEDIUM | aria-live regions for timer, intents, resolution. Focus management on phase transitions. |

---

## Self-Audit Checklist (Before Presenting as Done)

Per CLAUDE.md: "Self-audit checklist before presenting code as 'done'."

- [ ] No business logic in components (formatters are pure functions)
- [ ] No direct API calls in components (via state manager or command handlers)
- [ ] No raw `#hex` or `rgba()` (lint-color-tokens.sh)
- [ ] No em dashes in `msg()` strings (lint-llm-content.sh)
- [ ] No LLM-ism words (lint-llm-content.sh)
- [ ] All user-facing strings in `msg()`
- [ ] Icons only from `utils/icons.ts`
- [ ] All colors via design tokens (3-tier)
- [ ] `prefers-reduced-motion` respected
- [ ] WCAG AA contrast on all text
- [ ] Touch targets ≥ 44px
- [ ] Mobile layout tested at 375px / 768px / 1024px / 1440px
- [ ] `tsc --noEmit` passes
- [ ] `ruff check` passes
- [ ] `lint-color-tokens.sh` passes
- [ ] `lint-llm-content.sh` passes
- [ ] No circular imports
- [ ] No inline API service classes
- [ ] State via signals (no local component state for shared data)
- [ ] LEFT JOIN if any joins (CLAUDE.md rule)
