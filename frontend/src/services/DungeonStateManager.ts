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
  ArchetypeState,
  AvailableDungeonResponse,
  CombatAction,
  CombatStateClient,
  CombatSubmission,
  DungeonClientState,
  DungeonPhase,
  EncounterChoiceClient,
  PhaseTimer,
  RoomNodeClient,
} from '../types/dungeon.js';
import type { Agent, AptitudeSet } from '../types/index.js';
import {
  formatCombatResolution,
  formatDungeonComplete,
  formatLootDrop,
  formatPartyWipe,
} from '../utils/dungeon-formatters.js';
import { combatSystemLine } from '../utils/terminal-formatters.js';
import { agentsApi } from './api/AgentsApiService.js';
import { dungeonApi } from './api/DungeonApiService.js';
import { captureError } from './SentryService.js';
import { terminalState } from './TerminalStateManager.js';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dungeon_active_run';
// 250ms tick — 4 updates/sec is visually smooth for the CSS-transitioned fill bar.
// Tradeoff: auto-submit may fire up to 250ms after server deadline. The backend
// grants a grace period (see combat_submit timeout_tolerance_ms), so this is safe.
const TIMER_TICK_MS = 250;

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

  /** Agents available for party selection (cached after first fetch). */
  readonly pickerAgents = signal<Agent[]>([]);

  /** Aptitude map for picker agents: agent_id → {spy: N, guardian: N, ...}. */
  readonly pickerAptitudes = signal<Map<string, AptitudeSet>>(new Map());

  /** Archetype stored after showing the agent picker — lets the user type
   *  `dungeon 1 2 3` (agent indices) without re-specifying the archetype.
   *  Cleared on run start, explicit re-selection, or archetype listing. */
  readonly pendingArchetypeForPicker = signal<string | null>(null);

  // ── Encounter State (client-only, ephemeral) ───────────────────────────

  /** Encounter choices for the current room. Set from move response, cleared on phase change. */
  readonly encounterChoices = signal<EncounterChoiceClient[]>([]);

  // ── Combat Planning (client-only, ephemeral) ───────────────────────────

  /** Selected combat actions keyed by agent_id. Cleared on phase change. */
  readonly selectedActions = signal<Map<string, CombatAction>>(new Map());

  /** Whether combat submission is in flight. */
  readonly combatSubmitting = signal(false);

  // ── UI State (client-only) ─────────────────────────────────────────────

  /** Whether the SVG map panel is expanded (default: collapsed for terminal-first layout). */
  readonly mapExpanded = signal(false);

  // ── Timer ──────────────────────────────────────────────────────────────

  /** Remaining milliseconds on the active phase timer. Null when no timer. */
  readonly timerRemaining = signal<number | null>(null);

  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _autoSubmitFired = false;

  // ── Computed ───────────────────────────────────────────────────────────

  /** Whether the player is currently in an active dungeon. */
  readonly isInDungeon = computed(() => this.runId.value !== null);

  /** Current state machine phase. Null when not in dungeon. */
  readonly phase = computed((): DungeonPhase | null => this.clientState.value?.phase ?? null);

  /** Whether the current phase is any combat phase. */
  readonly isInCombat = computed(() => {
    const p = this.phase.value;
    return (
      p === 'combat_planning' || p === 'combat_resolving' || p === 'combat_outcome' || p === 'boss'
    );
  });

  /** Whether the player is distributing loot after boss victory. */
  readonly isDistributing = computed(() => this.phase.value === 'distributing');

  /** Party agents with combat state. */
  readonly party = computed((): AgentCombatStateClient[] => this.clientState.value?.party ?? []);

  /** All rooms in the dungeon graph (fog-of-war applied). */
  readonly rooms = computed((): RoomNodeClient[] => this.clientState.value?.rooms ?? []);

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
  readonly combat = computed(
    (): CombatStateClient | null => this.clientState.value?.combat ?? null,
  );

  /** Archetype-specific state (e.g. Shadow visibility). */
  readonly archetypeState = computed(
    (): ArchetypeState => this.clientState.value?.archetype_state ?? {},
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
    // NOTE: _autoSubmitFired is NOT reset here. It's only reset when
    // _startTimer detects a fresh (non-expired) timer, preventing the
    // recursive auto-submit loop.
    this._persistRunId(String(state.run_id));

    // Reset combat selections when leaving planning phase
    if (state.phase !== 'combat_planning') {
      this.selectedActions.value = new Map();
    }

    // Restore or clear encounter choices based on phase
    const hasChoicePhase =
      state.phase === 'encounter' || state.phase === 'rest' || state.phase === 'threshold';
    if (hasChoicePhase && state.encounter_choices?.length) {
      this.encounterChoices.value = state.encounter_choices;
    } else if (!hasChoicePhase) {
      this.encounterChoices.value = [];
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
    this.encounterChoices.value = [];
    this.pickerAgents.value = [];
    this.pickerAptitudes.value = new Map();
    this.pendingArchetypeForPicker.value = null;
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

  /**
   * Load all simulation agents with aptitudes for party selection.
   * Parallelizes agent list + aptitudes fetch. Cached until clear().
   */
  async loadPickerAgents(simulationId: string): Promise<void> {
    // Return cached if already loaded
    if (this.pickerAgents.value.length > 0) return;

    this.loading.value = true;
    this.error.value = null;
    try {
      const [agentsResp, aptResp] = await Promise.all([
        agentsApi.list(simulationId, { limit: '100' }),
        agentsApi.getAllAptitudes(simulationId),
      ]);

      if (!agentsResp.success) {
        this.error.value = agentsResp.error?.message ?? 'Failed to load agents';
        return;
      }
      this.pickerAgents.value = agentsResp.data ?? [];

      if (aptResp.success && aptResp.data) {
        const aptMap = new Map<string, AptitudeSet>();
        for (const apt of aptResp.data) {
          const existing = aptMap.get(apt.agent_id) ?? ({} as AptitudeSet);
          existing[apt.operative_type] = apt.aptitude_level;
          aptMap.set(apt.agent_id, existing);
        }
        this.pickerAptitudes.value = aptMap;
      }
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Failed to load agents';
      captureError(err, { source: 'DungeonStateManager.loadPickerAgents', simulationId });
    } finally {
      this.loading.value = false;
    }
  }

  // ── Timer Management (private) ────────────────────────────────────────

  private _startTimer(timer: PhaseTimer): void {
    this._stopTimer();

    const startMs = new Date(timer.started_at).getTime();
    if (Number.isNaN(startMs)) {
      this.timerRemaining.value = 0;
      return;
    }
    const endMs = startMs + timer.duration_ms;
    const remaining = endMs - Date.now();

    // If the timer already expired (stale from server checkpoint), don't
    // start a countdown. This prevents a recursive loop where auto-submit
    // → applyState → _startTimer → tick(expired) → auto-submit again.
    if (remaining <= 0) {
      this.timerRemaining.value = 0;
      return;
    }

    this._autoSubmitFired = false;

    const tick = (): void => {
      const rem = endMs - Date.now();
      this.timerRemaining.value = Math.max(0, rem);
      if (rem <= 0) {
        this._stopTimer();
        this._autoSubmitOnExpiry();
      }
    };

    tick(); // Immediate first tick (only when timer is still valid)
    this._timerInterval = setInterval(tick, TIMER_TICK_MS);
  }

  /**
   * Auto-submit combat actions when the planning timer expires.
   * Submits whatever is currently selected (may be empty — backend auto-defends).
   * Falls back to polling getState if submission fails (backend already resolved).
   */
  private async _autoSubmitOnExpiry(): Promise<void> {
    if (this._autoSubmitFired || this.combatSubmitting.value) return;
    const runId = this.runId.value;
    if (!runId || this.clientState.value?.phase !== 'combat_planning') return;

    this._autoSubmitFired = true;
    this.combatSubmitting.value = true;

    try {
      const submission: CombatSubmission = {
        actions: Array.from(this.selectedActions.value.values()),
      };
      const resp = await dungeonApi.submitCombat(runId, submission);
      if (resp.success && resp.data) {
        // Render battle log BEFORE applyState so lines are in the buffer
        // before the re-render cycle triggered by state change.
        // NOTE: Don't include next round's planning info — the CombatBar
        // GUI already shows that. Keeping the log short ensures the
        // resolution results stay visible instead of being pushed off
        // screen by 40+ lines of ability descriptions.
        if (resp.data.round_result) {
          const partyNames = this.party.value.map((a) => a.agent_name);
          const lines = [
            combatSystemLine('[AUTO] Timer expired. Actions submitted.'),
            ...formatCombatResolution(resp.data.round_result, partyNames),
          ];

          // Victory loot
          if (resp.data.round_result.victory && resp.data.loot && resp.data.loot.length > 0) {
            lines.push(...formatLootDrop(resp.data.loot));
          }

          // Dungeon completion (boss victory)
          if (resp.data.state.phase === 'completed') {
            lines.push(...formatDungeonComplete(resp.data.state, resp.data.loot ?? []));
          }

          // Party wipe
          if (resp.data.state.phase === 'wiped') {
            lines.push(...formatPartyWipe());
          }

          terminalState.appendOutput(lines);
        }

        this.combatSubmitting.value = false;

        // Exit dungeon on terminal states (after rendering output)
        if (resp.data.state.phase === 'completed' || resp.data.state.phase === 'wiped') {
          terminalState.clearDungeon();
          this.clear();
        } else {
          this.applyState(resp.data.state);
        }
        return;
      }
    } catch {
      // Backend may have already resolved (timer race). Fall back to getState.
    }

    // Fallback: poll for updated state
    try {
      const stateResp = await dungeonApi.getState(runId);
      if (stateResp.success && stateResp.data) {
        this.applyState(stateResp.data);
      }
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._autoSubmitOnExpiry', runId });
    } finally {
      this.combatSubmitting.value = false;
    }
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
