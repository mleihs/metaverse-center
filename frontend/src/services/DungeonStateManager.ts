/**
 * Dungeon state manager — Preact Signals singleton for Resonance Dungeons.
 *
 * Pattern: TerminalStateManager (signal store, singleton export).
 * Server-authoritative: every API response returns a fresh DungeonClientState
 * which replaces the entire local state via applyState().
 *
 * NOT persisted to localStorage (except runId for crash recovery).
 * Dungeon state is ephemeral and server-owned.
 */

import { computed, signal } from '@preact/signals-core';

import type {
  AgentCombatStateClient,
  AvailableDungeonResponse,
  CombatAction,
  CombatStateClient,
  DungeonClientState,
  DungeonPhase,
  PhaseTimer,
  RoomNodeClient,
} from '../types/dungeon.js';
import { dungeonApi } from './api/DungeonApiService.js';
import { captureError } from './SentryService.js';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dungeon_active_run';
const TIMER_TICK_MS = 100; // 100ms precision for smooth countdown

// ── State Manager ──────────────────────────────────────────────────────────

class DungeonStateManager {
  // ── Core State (server-authoritative) ──────────────────────────────────

  /** Full client state from the last API response. */
  readonly clientState = signal<DungeonClientState | null>(null);

  /** Active run ID. Null when not in a dungeon. */
  readonly runId = signal<string | null>(null);

  /** Loading flag for API calls. */
  readonly loading = signal(false);

  /** Last error message from API. Null when no error. */
  readonly error = signal<string | null>(null);

  // ── Pre-Run State ──────────────────────────────────────────────────────

  /** Available dungeon archetypes for the current simulation. */
  readonly availableDungeons = signal<AvailableDungeonResponse[]>([]);

  // ── Combat Planning (client-only, ephemeral) ───────────────────────────

  /** Selected combat actions keyed by agent_id. Cleared on phase change. */
  readonly selectedActions = signal<Map<string, CombatAction>>(new Map());

  /** Whether combat submission is in flight. */
  readonly combatSubmitting = signal(false);

  // ── UI State (client-only) ─────────────────────────────────────────────

  /** Whether the SVG map panel is expanded. */
  readonly mapExpanded = signal(true);

  /** Whether the party panel is expanded (relevant on mobile). */
  readonly partyPanelExpanded = signal(true);

  // ── Timer ──────────────────────────────────────────────────────────────

  /** Remaining milliseconds on the active phase timer. Null when no timer. */
  readonly timerRemaining = signal<number | null>(null);

  private _timerInterval: ReturnType<typeof setInterval> | null = null;

  // ── Computed ───────────────────────────────────────────────────────────

  /** Whether the player is currently in an active dungeon. */
  readonly isInDungeon = computed(() => this.runId.value !== null);

  /** Current state machine phase. Null when not in dungeon. */
  readonly phase = computed((): DungeonPhase | null =>
    this.clientState.value?.phase ?? null,
  );

  /** Whether the current phase is any combat phase. */
  readonly isInCombat = computed(() => {
    const p = this.phase.value;
    return (
      p === 'combat_planning' ||
      p === 'combat_resolving' ||
      p === 'combat_outcome' ||
      p === 'boss'
    );
  });

  /** Party agents with combat state. */
  readonly party = computed((): AgentCombatStateClient[] =>
    this.clientState.value?.party ?? [],
  );

  /** All rooms in the dungeon graph (fog-of-war applied). */
  readonly rooms = computed((): RoomNodeClient[] =>
    this.clientState.value?.rooms ?? [],
  );

  /** The room the party is currently in. */
  readonly currentRoom = computed((): RoomNodeClient | null => {
    const idx = this.clientState.value?.current_room;
    if (idx === undefined || idx === null) return null;
    return this.rooms.value.find((r) => r.index === idx) ?? null;
  });

  /** Rooms adjacent to the current room (revealed only). */
  readonly adjacentRooms = computed((): RoomNodeClient[] => {
    const current = this.currentRoom.value;
    if (!current) return [];
    const conns = new Set(current.connections);
    return this.rooms.value.filter((r) => conns.has(r.index) && r.revealed);
  });

  /** Active combat state. Null when not in combat. */
  readonly combat = computed((): CombatStateClient | null =>
    this.clientState.value?.combat ?? null,
  );

  /** Archetype-specific state (e.g. Shadow visibility). */
  readonly archetypeState = computed(
    (): Record<string, unknown> =>
      this.clientState.value?.archetype_state ?? {},
  );

  /** Whether all agents that can act have selected a combat action.
   *  Delegates "can this agent act?" to the backend via available_abilities. */
  readonly allActionsSelected = computed(() => {
    const canAct = this.party.value.filter(
      (a) => a.condition !== 'captured' && a.available_abilities.length > 0,
    );
    if (canAct.length === 0) return false;
    return canAct.every((a) => this.selectedActions.value.has(a.agent_id));
  });

  /** Dungeon depth progress as fraction (0-1). */
  readonly depthProgress = computed(() => {
    const state = this.clientState.value;
    if (!state) return 0;
    const maxDepth = Math.max(...this.rooms.value.map((r) => r.depth), 1);
    return state.depth / maxDepth;
  });

  // ── Lifecycle Methods ─────────────────────────────────────────────────

  /**
   * Apply a fresh DungeonClientState from any API response.
   * This is the SINGLE entry point for state updates — every action
   * returns a new state which fully replaces the previous one.
   */
  applyState(state: DungeonClientState): void {
    this.clientState.value = state;
    this.runId.value = String(state.run_id);
    this.error.value = null;
    this._persistRunId(String(state.run_id));

    // Reset combat selections when leaving planning phase
    if (state.phase !== 'combat_planning') {
      this.selectedActions.value = new Map();
    }

    // Manage timer based on phase_timer
    if (state.phase_timer) {
      this._startTimer(state.phase_timer);
    } else {
      this._stopTimer();
    }
  }

  /**
   * Select an ability for an agent during combat planning.
   * Replaces any previous selection for that agent.
   */
  selectAction(agentId: string, abilityId: string, targetId?: string): void {
    const next = new Map(this.selectedActions.value);
    next.set(agentId, {
      agent_id: agentId,
      ability_id: abilityId,
      target_id: targetId ?? null,
    });
    this.selectedActions.value = next;
  }

  /** Deselect an agent's combat action. */
  deselectAction(agentId: string): void {
    const next = new Map(this.selectedActions.value);
    next.delete(agentId);
    this.selectedActions.value = next;
  }

  /**
   * Clear all dungeon state. Called after completion, wipe, or retreat.
   */
  clear(): void {
    this.clientState.value = null;
    this.runId.value = null;
    this.selectedActions.value = new Map();
    this.error.value = null;
    this.loading.value = false;
    this.combatSubmitting.value = false;
    this._stopTimer();
    this._clearPersistedRunId();
  }

  /**
   * Recovery: check localStorage for an active run on page load.
   * Calls GET /runs/{id}/state to resync. Returns true if recovered.
   */
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
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager.tryRecover', runId: storedId });
      this._clearPersistedRunId();
      return false;
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * Load available dungeons for a simulation (pre-run).
   */
  async loadAvailable(simulationId: string): Promise<void> {
    this.loading.value = true;
    try {
      const resp = await dungeonApi.getAvailable(simulationId);
      if (resp.success && resp.data) {
        this.availableDungeons.value = resp.data;
      }
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager.loadAvailable', simulationId });
    } finally {
      this.loading.value = false;
    }
  }

  // ── Timer Management (private) ────────────────────────────────────────

  private _startTimer(timer: PhaseTimer): void {
    this._stopTimer();

    const startMs = new Date(timer.started_at).getTime();
    const endMs = startMs + timer.duration_ms;

    const tick = (): void => {
      const remaining = endMs - Date.now();
      this.timerRemaining.value = Math.max(0, remaining);
      if (remaining <= 0) {
        this._stopTimer();
      }
    };

    tick(); // Immediate first tick
    this._timerInterval = setInterval(tick, TIMER_TICK_MS);
  }

  private _stopTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this.timerRemaining.value = null;
  }

  // ── localStorage Persistence (runId only) ─────────────────────────────

  private _persistRunId(runId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, runId);
    } catch {
      // Quota exceeded or private browsing — non-critical
    }
  }

  private _getPersistedRunId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private _clearPersistedRunId(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Non-critical
    }
  }
}

export const dungeonState = new DungeonStateManager();
