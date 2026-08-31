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
  CombatRoundResult,
  CombatStateClient,
  CombatSubmission,
  DungeonClientState,
  DungeonPhase,
  EncounterChoiceClient,
  PendingOrder,
  PhaseTimer,
  RoomNodeClient,
} from '../types/dungeon.js';
import type { Agent } from '../types/index.js';
import type { AptitudeIndex } from '../utils/aptitudes.js';
import { buildAptitudeIndex } from '../utils/aptitudes.js';
import {
  formatCombatResolution,
  formatDungeonComplete,
  formatLootDrop,
  formatPartyWipe,
  getRoomTypeLabel,
} from '../utils/dungeon-formatters.js';
import {
  describeRoom,
  mergeRoomDescription,
  type RoomDescription,
} from '../utils/dungeon-room-text.js';
import { combatSystemLine, systemLine } from '../utils/terminal-formatters.js';
import { analyticsService } from './AnalyticsService.js';
import { appState } from './AppStateManager.js';
import { agentsApi } from './api/AgentsApiService.js';
import { dungeonApi } from './api/DungeonApiService.js';
import { captureError } from './SentryService.js';
import { terminalState } from './TerminalStateManager.js';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dungeon_active_run';
// View-mode preference (terminal vs graphical). Persisted separately from run
// state and deliberately NOT touched by applyState()/clear() — the chosen view
// is a UI preference that must survive run start, run end, wipe, and recovery.
const VIEW_MODE_STORAGE_KEY = 'dungeon_view_mode';
// 250ms tick — 4 updates/sec is visually smooth for the CSS-transitioned fill bar.
// Tradeoff: auto-submit may fire up to 250ms after server deadline. The backend
// grants a grace period (see combat_submit timeout_tolerance_ms), so this is safe.
const TIMER_TICK_MS = 250;

// ── Types ────────────────────────────────────────────────────────────────

/** Which rendering of the dungeon the player is using. */
export type DungeonViewMode = 'terminal' | 'graphical';

// ── State Manager ──────────────────────────────────────────────────────────

class DungeonStateManager {
  /** Guard flag: prevents concurrent validateActiveRun calls (e.g. rapid tab switches). */
  private _validating = false;
  /** Set during tryRecover() to distinguish recovery from fresh session start in analytics. */
  private _recovering = false;

  constructor() {
    // Detect externally-abandoned runs when the user returns to the tab.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.runId.value) {
          void this.validateActiveRun();
        }
      });
    }
  }

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

  /** Effective aptitudes for picker agents (levels + which of them are baseline). */
  readonly pickerAptitudes = signal<AptitudeIndex>(buildAptitudeIndex(null));

  /** Archetype stored after showing the agent picker — lets the user type
   *  `dungeon 1 2 3` (agent indices) without re-specifying the archetype.
   *  Cleared on run start, explicit re-selection, or archetype listing. */
  readonly pendingArchetypeForPicker = signal<string | null>(null);

  // ── Encounter State (client-only, ephemeral) ───────────────────────────

  /** Encounter choices for the current room. Set from move response, cleared on phase change. */
  readonly encounterChoices = signal<EncounterChoiceClient[]>([]);

  /** The prose belonging to the room the party is standing in, as derived by
   *  the shared selector (utils/dungeon-room-text.ts). Client-only: most of it
   *  lives on the move response and is discarded by applyState(). The graphical
   *  view — which has no terminal buffer — renders this into the scene.
   *
   *  It carries the WHOLE description, not a selection. The previous version
   *  published banter and barometer only, which is why encounter prose and
   *  anchor objects never reached the graphical mode at all. Null until the
   *  first move or `look`. */
  readonly lastRoomDescription = signal<RoomDescription | null>(null);

  /** Last resolved combat round, published at the two submit-resolution sites
   *  (manual submit in dungeon-commands + auto-submit on timer expiry). Like
   *  lastRoomDescription this lives on the CombatSubmitResponse — NOT on the
   *  DungeonClientState — so applyState() never sees it and would discard it.
   *  The graphical view's PixiJS combat-FX host (a second consumer) subscribes
   *  to this signal and plays per-event juice; the terminal view ignores it.
   *  A fresh object is published per round, so reference identity dedupes
   *  replays. Null until the first resolved round. */
  readonly lastRoundResult = signal<CombatRoundResult | null>(null);

  // ── Combat Planning (client-only, ephemeral) ───────────────────────────

  /** Selected combat actions keyed by agent_id. Cleared on phase change. */
  readonly selectedActions = signal<Map<string, CombatAction>>(new Map());

  /** The order currently being AIMED, or null when nothing is pending.
   *
   *  This lives in the store rather than inside the combat bar, where the older
   *  targeting flags sat, because the targeting chain has anchors in two
   *  sibling components: the stage draws the spotlight, the command card over
   *  the operative and the "in your sights" tag on the creature; the bar draws
   *  the tick on the tab and the order strip. Local state would have obliged
   *  the bar to TELL the stage, and a told state is a second source that can
   *  fall out of step with the first. One signal, read by both. */
  readonly pendingOrder = signal<PendingOrder | null>(null);

  /** Whether combat submission is in flight. */
  readonly combatSubmitting = signal(false);

  // ── UI State (client-only) ─────────────────────────────────────────────

  /** Whether the SVG map panel is expanded (default: collapsed for terminal-first layout). */
  readonly mapExpanded = signal(false);

  /** Which dungeon rendering is active. Default 'terminal'. Persisted to
   *  localStorage; never reset by applyState()/clear() so the preference
   *  survives across runs. The graphical view is a second, additive consumer
   *  of the same server-authoritative state — switching modes changes nothing
   *  about the run itself. */
  readonly viewMode = signal<DungeonViewMode>(this._getPersistedViewMode());

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

  /** Who is aiming at what: target id -> the agent ids whose PLACED order names
   *  it, in party order.
   *
   *  Derived from `selectedActions` alone. This is what makes the three anchors
   *  of a placed order one thing rather than three: the creature's sights tag,
   *  the operative's command card and the order strip all read this (or the map
   *  it is built from), so a withdrawal at any one of them is a withdrawal at
   *  all three — there is no second copy left to forget.
   *
   *  Keyed in PARTY order rather than Map insertion order: the portraits inside
   *  one sights tag must sit in the same sequence as the tabs in the bar, or
   *  two operatives on one creature read as two different pairs depending on
   *  where the player happens to look. */
  readonly ordersByTarget = computed((): ReadonlyMap<string, readonly string[]> => {
    const byTarget = new Map<string, string[]>();
    for (const agent of this.party.value) {
      const action = this.selectedActions.value.get(agent.agent_id);
      if (!action?.target_id) continue;
      const existing = byTarget.get(action.target_id);
      if (existing) existing.push(agent.agent_id);
      else byTarget.set(action.target_id, [agent.agent_id]);
    }
    return byTarget;
  });

  /** Dungeon depth progress as fraction (0-1). */
  readonly depthProgress = computed(() => {
    const state = this.clientState.value;
    if (!state) return 0;
    const maxDepth = Math.max(...this.rooms.value.map((r) => r.depth), 1);
    return state.depth / maxDepth;
  });

  // ── Room Narrative (client-only publication) ───────────────────────────

  /**
   * Publish the current room's description for the graphical scene. Called at
   * the move resolution site and by `look` (utils/dungeon-commands.ts).
   *
   * MERGES with the standing description rather than replacing it. Only the
   * move response carries banter, anchor prose and the barometer line; `look`
   * re-derives from run state alone and correctly has none of them. Publishing
   * that impoverished object used to wipe the arrival prose — the room
   * described itself once and then went quiet the moment the player looked
   * again or resolved its encounter. `mergeRoomDescription` keeps the
   * arrival-only fields while the party is still in the same room and drops
   * them on a room change.
   */
  publishRoomDescription(description: RoomDescription): void {
    this.lastRoomDescription.value = mergeRoomDescription(
      this.lastRoomDescription.value,
      description,
    );
  }

  /**
   * Re-derive the standing room description from run state alone.
   *
   * `applyState` deliberately does NOT set it: on a move the prose rides on the
   * move RESPONSE, so applying state must never overwrite the richer arrival
   * text. After a page reload there is no move response to carry it, and the
   * graphical scene — whose only source is this signal — came up with an empty
   * stage until the player moved. The choices survived (applyState restores
   * `encounterChoices`); only the prose was missing.
   *
   * This is the same derivation `look` performs, minus the arrival-only texts
   * (banter, anchor prose, barometer) that only exist at the moment of arrival.
   * Recovery must not invent them.
   */
  private _redescribeCurrentRoom(): void {
    const state = this.clientState.value;
    const room = this.currentRoom.value;
    if (!state || !room) return;
    this.publishRoomDescription(describeRoom(room, state));
  }

  /** Publish a resolved combat round for the graphical combat-FX host. Called
   *  at the two submit-resolution sites after applyState() (applyState lives on
   *  the state object and would otherwise drop round_result). */
  publishRoundResult(result: CombatRoundResult): void {
    this.lastRoundResult.value = result;
  }

  // ── View Mode ──────────────────────────────────────────────────────────

  /** Switch the active dungeon rendering and persist the preference. */
  setViewMode(mode: DungeonViewMode): void {
    if (this.viewMode.value === mode) return;
    this.viewMode.value = mode;
    this._persistViewMode(mode);
    analyticsService.trackEvent('dungeon_view_mode_changed', { mode });
  }

  // ── Lifecycle Methods ─────────────────────────────────────────────────

  /**
   * Apply a fresh DungeonClientState from any API response.
   * This is the SINGLE entry point for state updates — every action
   * returns a new state which fully replaces the previous one.
   */
  applyState(state: DungeonClientState): void {
    const wasNull = this.runId.value === null;
    this.clientState.value = state;
    this.runId.value = String(state.run_id);
    this.error.value = null;

    // Track session start when transitioning from no run → active run.
    // Distinguish fresh starts from page-refresh recovery to avoid inflating session counts.
    if (wasNull) {
      analyticsService.trackEvent(
        this._recovering ? 'dungeon_session_recovered' : 'dungeon_session_started',
        { archetype: state.archetype ?? '' },
      );
    }
    // NOTE: _autoSubmitFired is NOT reset here. It's only reset when
    // _startTimer detects a fresh (non-expired) timer, preventing the
    // recursive auto-submit loop.
    this._persistRunId(String(state.run_id));

    // Hand the chronicle the room it is about to write in. Before the lines of
    // this update are absorbed, not after: appendOutput stamps from this value,
    // so a stamp set afterwards would label the arrival text with the room the
    // party just LEFT — off by exactly one room, and only ever visible as a
    // divider in the wrong place.
    const room = this.currentRoom.value;
    terminalState.setNarrationRoom(
      room ? { index: room.index, label: getRoomTypeLabel(room.room_type) } : null,
    );

    // Reset combat selections when leaving planning phase
    if (state.phase !== 'combat_planning') {
      this.selectedActions.value = new Map();
      // An aim must not outlive the phase it was taken in. Without this the
      // spotlight would still be lit over a round that has already resolved,
      // and the next click would place an order against a creature that is no
      // longer standing there.
      this.pendingOrder.value = null;
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
    // Placing an order ends the aim, whoever placed it. Only one order is aimed
    // at a time, so this needs no agent comparison — and doing it HERE, at the
    // one seam every placement passes through, is why no caller can leave a
    // spotlight burning on the stage over an order that is already given.
    this.pendingOrder.value = null;
  }

  /** Deselect an agent's combat action. */
  deselectAction(agentId: string): void {
    const next = new Map(this.selectedActions.value);
    next.delete(agentId);
    this.selectedActions.value = next;
  }

  /** Begin aiming: the operative has chosen an ability and is choosing a target.
   *  Replaces any aim already in progress — a second ability click re-aims
   *  rather than stacking. */
  beginTargeting(agentId: string, abilityId: string, scope: 'enemy' | 'ally'): void {
    this.pendingOrder.value = { agent_id: agentId, ability_id: abilityId, scope };
  }

  /** Abandon the aim without placing an order (Escape, or a second click on the
   *  same ability). Placed orders are untouched. */
  cancelTargeting(): void {
    this.pendingOrder.value = null;
  }

  /**
   * Clear all dungeon state. Called after completion, wipe, or retreat.
   */
  clear(): void {
    // Track session end before clearing state
    const state = this.clientState.value;
    if (state) {
      analyticsService.trackEvent('dungeon_session_ended', {
        archetype: state.archetype ?? '',
        phase: state.phase ?? '',
      });
    }

    this.clientState.value = null;
    this.runId.value = null;
    this.selectedActions.value = new Map();
    this.pendingOrder.value = null;
    this.lastRoomDescription.value = null;
    this.lastRoundResult.value = null;
    this.error.value = null;
    this.loading.value = false;
    this.combatSubmitting.value = false;
    this.encounterChoices.value = [];
    this.pickerAgents.value = [];
    this.pickerAptitudes.value = buildAptitudeIndex(null);
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
    this._recovering = true;
    try {
      const resp = await dungeonApi.getState(storedId);
      if (resp.success && resp.data) {
        this.applyState(resp.data);
        this._redescribeCurrentRoom();
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
      this._recovering = false;
      this.loading.value = false;
    }
  }

  /**
   * Validate that the active in-memory run still exists on the server.
   * Called on tab focus return (visibilitychange) to detect externally-abandoned runs.
   *
   * Distinguishes server-confirmed removal (HTTP 4xx → clear state) from
   * transient network errors (retain state — the run is likely still alive).
   */
  async validateActiveRun(): Promise<boolean> {
    const runId = this.runId.value;
    if (!runId || this._validating) return false;

    this._validating = true;
    try {
      const resp = await dungeonApi.getState(runId);
      if (resp.success && resp.data) {
        const phase = resp.data.phase;
        if (phase === 'completed' || phase === 'wiped') {
          terminalState.appendOutput([systemLine('Dungeon run ended. Returning to lobby.')]);
          terminalState.clearDungeon();
          this.clear();
          return false;
        }
        // Run is still active — resync state
        this.applyState(resp.data);
        return true;
      }
      // Non-success response: check if server confirmed (4xx) vs network failure
      const code = resp.error?.code ?? '';
      if (code === 'NETWORK_ERROR') {
        // Transient network issue — retain state, run is likely still alive
        return true;
      }
      // Server confirmed the run is gone (404, 403, etc.)
      terminalState.appendOutput([systemLine('Dungeon run expired. Returning to lobby.')]);
      terminalState.clearDungeon();
      this.clear();
      return false;
    } catch (err) {
      // Retain state conservatively — an unexpected error here likely means
      // a transient fault, not a confirmed-dead run (server-confirmed 4xx
      // paths above already cleared state).
      captureError(err, { source: 'DungeonStateManager.validateActiveRun', runId });
      return false;
    } finally {
      this._validating = false;
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
      const mode = appState.currentSimulationMode.value;
      const [agentsResp, aptResp] = await Promise.all([
        agentsApi.list(simulationId, mode, { limit: '100' }),
        agentsApi.getAllAptitudes(simulationId, mode),
      ]);

      if (!agentsResp.success) {
        this.error.value = agentsResp.error?.message ?? 'Failed to load agents';
        return;
      }
      this.pickerAgents.value = agentsResp.data ?? [];

      // A failed aptitude fetch must not pass unnoticed: the picker would then
      // show every agent as "unknown" with no hint why. It stays usable either
      // way — party selection does not depend on aptitudes.
      if (!aptResp.success) {
        captureError(new Error(aptResp.error?.message ?? 'Failed to load aptitudes'), {
          source: 'DungeonStateManager.loadPickerAgents',
          simulationId,
        });
      }
      this.pickerAptitudes.value = buildAptitudeIndex(aptResp.success ? aptResp.data : null);
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

    // Use remaining_ms from backend (clock-skew-free) if available,
    // otherwise fall back to cross-clock calculation for backward compat.
    let remaining: number;
    if (timer.remaining_ms && timer.remaining_ms > 0) {
      remaining = timer.remaining_ms;
    } else {
      const startMs = new Date(timer.started_at).getTime();
      if (Number.isNaN(startMs)) {
        this.timerRemaining.value = 0;
        return;
      }
      remaining = startMs + timer.duration_ms - Date.now();
    }

    // First-time players: grant 10s grace for onboarding briefing read time
    if (!globalThis.localStorage?.getItem('dungeon_combat_onboarded')) {
      remaining += 10_000;
    }

    // If the timer already expired (stale from server checkpoint), don't
    // start a countdown. This prevents a recursive loop where auto-submit
    // → applyState → _startTimer → tick(expired) → auto-submit again.
    if (remaining <= 0) {
      this.timerRemaining.value = 0;
      return;
    }

    this._autoSubmitFired = false;

    // Use local clock for countdown — endMs is our own Date.now() + remaining
    const endMs = Date.now() + remaining;

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
          // Publish for the graphical combat-FX host (second consumer). Safe on
          // every terminal outcome too: on completed/wipe the dungeon view
          // unmounts before any FX could replay, and clear() nulls this anyway.
          this.publishRoundResult(resp.data.round_result);
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
    } catch (err) {
      // Timer-race: backend may have already resolved the run. Fall through
      // to the getState poll below for authoritative state.
      captureError(err, {
        source: 'DungeonStateManager._autoSubmitOnExpiry.submit',
        runId,
        kind: 'timer_race',
      });
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
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._persistRunId' });
    }
  }

  private _getPersistedRunId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._getPersistedRunId' });
      return null;
    }
  }

  private _clearPersistedRunId(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._clearPersistedRunId' });
    }
  }

  // ── localStorage Persistence (viewMode) ───────────────────────────────

  private _getPersistedViewMode(): DungeonViewMode {
    try {
      return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'graphical' ? 'graphical' : 'terminal';
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._getPersistedViewMode' });
      return 'terminal';
    }
  }

  private _persistViewMode(mode: DungeonViewMode): void {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch (err) {
      captureError(err, { source: 'DungeonStateManager._persistViewMode' });
    }
  }
}

export const dungeonState = new DungeonStateManager();
