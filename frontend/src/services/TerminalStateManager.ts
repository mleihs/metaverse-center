/**
 * Bureau Terminal state manager.
 * Manages terminal session state with Preact Signals and localStorage persistence.
 * Pattern: ForgeStateManager (dedicated signal store, singleton export).
 */

import { msg, str } from '@lit/localize';
import { computed, signal } from '@preact/signals-core';
import type {
  Agent,
  Building,
  EpochParticipant,
  EpochStatus,
  EpochTeam,
  Zone,
  ZoneStability,
} from '../types/index.js';
import type {
  ConversationMode,
  FeedFilter,
  TerminalLine,
  TerminalPersistedState,
} from '../types/terminal.js';
import type { DungeonNarrationLine, DungeonRoomStamp } from '../types/dungeon.js';
import { captureError } from './SentryService.js';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'bureau_terminal_';
const MAX_OUTPUT_LINES = 500;
/**
 * Ring size of the dungeon chronicle. Shorter than the terminal buffer on
 * purpose: the chronicle is a glanceable event stream in a 340px column, not a
 * scrollback. ~120 lines covers several rooms of play.
 */
const MAX_NARRATION_LINES = 120;
const MAX_COMMAND_HISTORY = 100;
const PERSIST_DEBOUNCE_MS = 500;
const DEFAULT_OPS_POINTS = 3;
const DEFAULT_INTEL_POINTS = 2;

/** Command count thresholds for clearance upgrades (spec 4.4.4). */
const CLEARANCE_THRESHOLDS: Record<number, number> = {
  2: 10, // Tier 2 unlocks after 10 successful commands
  3: 25, // Tier 3 unlocks after 25 commands (Intelligence Network)
  // Tier 4-5 are gated by Stage 4-5 features (Epoch)
};

// ── State Manager ──────────────────────────────────────────────────────────

class TerminalStateManager {
  // --- Session Identity ---
  private _simulationId: string | null = null;
  private _persistTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Core State Signals ---
  readonly currentZoneId = signal<string | null>(null);
  readonly commandHistory = signal<string[]>([]);
  readonly outputLines = signal<TerminalLine[]>([]);
  readonly clearanceLevel = signal<number>(1);
  readonly commandCount = signal<number>(0);
  readonly operationsPoints = signal<number>(DEFAULT_OPS_POINTS);
  readonly intelPoints = signal<number>(DEFAULT_INTEL_POINTS);
  /** Herzschlag-Tick der letzten Auffuellung; null = noch nie aufgefuellt. */
  readonly budgetTick = signal<number | null>(null);
  readonly onboarded = signal<boolean>(false);
  readonly onboardingStep = signal<number>(0);
  readonly conversationMode = signal<ConversationMode | null>(null);
  readonly feedFilter = signal<FeedFilter>('all');
  readonly isLoading = signal<boolean>(false);

  /** Map of agentId -> conversationId for reusing terminal conversations. */
  readonly conversationMap = signal<Record<string, string>>({});

  // --- Data Caches (not persisted) ---
  readonly zoneCache = signal<Map<string, Zone>>(new Map());
  readonly agentsByZone = signal<Map<string, Agent[]>>(new Map());
  readonly buildingsByZone = signal<Map<string, Building[]>>(new Map());
  readonly zoneStabilities = signal<ZoneStability[]>([]);

  // --- Epoch State (NOT persisted — server-authoritative) ---
  readonly epochId = signal<string | null>(null);
  readonly epochParticipant = signal<EpochParticipant | null>(null);
  readonly epochParticipants = signal<EpochParticipant[]>([]);
  readonly epochStatus = signal<EpochStatus | null>(null);
  readonly epochTeams = signal<EpochTeam[]>([]);
  // --- Dungeon State (NOT persisted — DungeonStateManager owns actual state) ---
  /** Active dungeon run ID. Only used for command routing (isDungeonMode). */
  readonly dungeonRunId = signal<string | null>(null);
  /** Archetype label shown in statusbar during dungeon mode (e.g. "The Shadow"). */
  readonly dungeonLabel = signal<string | null>(null);
  /**
   * Admin-configured clearance for dungeon commands only.
   * - bypass=true: dungeon verbs skip tier check entirely (clearance_mode=off).
   * - customThreshold: when set, dungeon commands require this many prior
   *   commands instead of the standard 10 (clearance_mode=custom).
   * Does NOT affect general tier progression (fortify, quarantine, etc.).
   * Fetched from public API on init — not persisted locally.
   */
  readonly dungeonClearanceBypass = signal<boolean>(false);
  readonly dungeonClearanceThreshold = signal<number | null>(null);
  /**
   * The dungeon chronicle: every line produced while in dungeon mode.
   *
   * A DERIVED VIEW of the output buffer, filled at the sink (`appendOutput`)
   * rather than at any source. That placement is the whole point. The graphical
   * dungeon runs commands through the same `parseAndExecute` pipeline as the
   * terminal and got the complete result back – it just had nowhere to render
   * it, so rolls, results, loot and server errors were invisible there. Feeding
   * this from the dispatcher instead would have missed exactly the lines that
   * matter: the echoed command (added by `parseAndExecute`, outside the dungeon
   * dispatcher) and the run-start banner (`startDungeonRun`, which never enters
   * it). Every line that reaches the buffer reaches the chronicle, from every
   * call site that exists or will exist.
   *
   * `feed` lines are excluded – realtime heartbeat chatter belongs to the
   * terminal's world feed, not to the account of this descent.
   */
  readonly dungeonNarration = signal<DungeonNarrationLine[]>([]);

  /**
   * Armed while a descent is being recorded.
   *
   * Set on entry and cleared only by the NEXT entry – deliberately not when the
   * run ends. A run's last words (the victory block, the wipe, the loot list)
   * are produced by the same handler that tears the run down, and reach
   * `appendOutput` after `clearDungeon()` has already run. Disarming there
   * would drop precisely the lines a player most wants to read. Nothing renders
   * the chronicle outside a run, so keeping it armed past the end costs a
   * bounded buffer and no confusion.
   */
  private _narrationArmed = false;

  /** The room the party is standing in, as the dungeon last reported it.
   *
   *  Pushed IN by DungeonStateManager rather than read out of it: the
   *  dependency runs dungeon -> terminal and must keep running that way, and a
   *  terminal that reached back into the dungeon store would close the loop.
   *  Null outside a run, and null for any line absorbed before the first room
   *  is known — which the chronicle renders as an unlabelled group rather than
   *  guessing. */
  private _narrationRoom: DungeonRoomStamp | null = null;

  // --- Computed ---
  readonly isDungeonMode = computed(() => this.dungeonRunId.value !== null);
  /**
   * True when both epoch signals are populated. Checking both closes the race
   * window in `initializeEpoch`, which sets `epochId` before `epochParticipant`
   * — observers firing between those two writes previously saw
   * `isEpochMode === true` with a null participant, which the downstream
   * `value!` assertion in `handleLook` / `handleStatus` could crash on.
   */
  readonly isEpochMode = computed(
    () => this.epochId.value !== null && this.epochParticipant.value !== null,
  );
  readonly currentRP = computed(() => this.epochParticipant.value?.current_rp ?? 0);
  readonly myTeamId = computed(() => this.epochParticipant.value?.team_id ?? null);

  /**
   * Effective clearance level — the actual tier used for command access.
   * In epoch mode, tier 4 is granted as a context privilege (not persisted).
   * In template mode, reflects the earned tier (1-3 based on command count).
   */
  readonly effectiveClearance = computed(() => {
    const earned = this.clearanceLevel.value;
    if (this.isEpochMode.value) return Math.max(earned, 4);
    return Math.min(earned, 3); // Template mode caps at tier 3
  });
  readonly isInConversation = computed(() => this.conversationMode.value !== null);
  readonly currentZone = computed(() => {
    const zoneId = this.currentZoneId.value;
    if (!zoneId) return null;
    return this.zoneCache.value.get(zoneId) ?? null;
  });
  readonly currentZoneAgents = computed(() => {
    const zoneId = this.currentZoneId.value;
    if (!zoneId) return [];
    return this.agentsByZone.value.get(zoneId) ?? [];
  });
  readonly currentZoneBuildings = computed(() => {
    const zoneId = this.currentZoneId.value;
    if (!zoneId) return [];
    return this.buildingsByZone.value.get(zoneId) ?? [];
  });
  readonly currentZoneStability = computed(() => {
    const zoneId = this.currentZoneId.value;
    if (!zoneId) return null;
    return this.zoneStabilities.value.find((zs) => zs.zone_id === zoneId) ?? null;
  });

  // ── Initialization ─────────────────────────────────────────────────────

  /**
   * Initialize terminal state for a simulation.
   * Loads persisted state from localStorage if available.
   */
  initialize(simulationId: string): void {
    this._simulationId = simulationId;
    const stored = this._loadFromStorage();

    if (stored) {
      // Guard against corrupt localStorage values (arrays, numbers, enums)
      if (!Array.isArray(stored.commandHistory)) stored.commandHistory = [];
      if (!Array.isArray(stored.recentOutput)) stored.recentOutput = [];
      if (typeof stored.conversationMap !== 'object' || stored.conversationMap === null) {
        stored.conversationMap = {};
      }
      if (
        typeof stored.clearanceLevel !== 'number' ||
        Number.isNaN(stored.clearanceLevel) ||
        stored.clearanceLevel < 1 ||
        stored.clearanceLevel > 5
      ) {
        stored.clearanceLevel = 1;
      }
      if (
        typeof stored.commandCount !== 'number' ||
        Number.isNaN(stored.commandCount) ||
        stored.commandCount < 0
      ) {
        stored.commandCount = 0;
      }
      if (typeof stored.operationsPoints !== 'number' || Number.isNaN(stored.operationsPoints)) {
        stored.operationsPoints = DEFAULT_OPS_POINTS;
      }
      if (typeof stored.intelPoints !== 'number' || Number.isNaN(stored.intelPoints)) {
        stored.intelPoints = DEFAULT_INTEL_POINTS;
      }
      if (typeof stored.budgetTick !== 'number' || Number.isNaN(stored.budgetTick)) {
        stored.budgetTick = null;
      }
      if (typeof stored.onboarded !== 'boolean') stored.onboarded = false;
      if (typeof stored.onboardingStep !== 'number' || Number.isNaN(stored.onboardingStep))
        stored.onboardingStep = 0;

      this.currentZoneId.value = stored.currentZoneId;
      this.clearanceLevel.value = stored.clearanceLevel;
      this.commandCount.value = stored.commandCount;
      this.onboarded.value = stored.onboarded;
      this.onboardingStep.value = stored.onboardingStep;
      this.commandHistory.value = stored.commandHistory;
      this.operationsPoints.value = stored.operationsPoints;
      this.intelPoints.value = stored.intelPoints;
      this.budgetTick.value = stored.budgetTick;
      this.feedFilter.value = stored.feedFilter;
      this.conversationMap.value = stored.conversationMap;
    } else {
      this._resetToDefaults();
    }

    // Restore recent output from localStorage if available (session continuity)
    if (stored?.recentOutput?.length) {
      let counter = 0;
      this.outputLines.value = stored.recentOutput.map((r) => ({
        id: `restored-${counter++}`,
        type: r.type as import('../types/terminal.js').TerminalLineType,
        content: r.content,
        timestamp: new Date(),
      }));
    } else {
      this.outputLines.value = [];
    }
    this.conversationMode.value = null;
    this.isLoading.value = false;

    // Fetch admin-configured dungeon clearance settings (non-blocking).
    void this.loadDungeonClearanceConfig();
    // Und die Punkte an den Herzschlag koppeln (ebenfalls nicht blockierend).
    void this.syncBudgetsWithHeartbeat();
  }

  // ── Epoch Context ────────────────────────────────────────────────────

  /**
   * Initialize epoch context for OPERATIONAL MODE.
   * Called by EpochTerminalView after base initialize().
   * Epoch state is NOT persisted — it's server-authoritative and set fresh each session.
   */
  initializeEpoch(
    epochId: string,
    participant: EpochParticipant,
    participants: EpochParticipant[],
    teams: EpochTeam[],
    status: EpochStatus,
  ): void {
    this.epochId.value = epochId;
    this.epochParticipant.value = participant;
    this.epochParticipants.value = participants;
    this.epochTeams.value = teams;
    this.epochStatus.value = status;
    // Tier 4 clearance is derived via effectiveClearance computed — no mutation needed.
  }

  /** Clear all epoch state. Called when leaving the epoch terminal. */
  clearEpoch(): void {
    this.epochId.value = null;
    this.epochParticipant.value = null;
    this.epochParticipants.value = [];
    this.epochTeams.value = [];
    this.epochStatus.value = null;
    // effectiveClearance automatically reverts to earned tier (1-3) when isEpochMode becomes false.
  }

  /** Update participant data (e.g., after RP change from intercept). */
  updateParticipant(participant: EpochParticipant): void {
    this.epochParticipant.value = participant;
  }

  /**
   * Type-safe snapshot of paired epoch state. Returns `{ epochId, participant }`
   * when both signals are populated, or `null` otherwise. Collapses the two
   * signal reads into one atomic-feeling access so consumers don't have to
   * re-check `isEpochMode` AND null-check each signal individually.
   *
   * The inner null-check after `isEpochMode` passes is defensive: with the
   * strengthened `isEpochMode` invariant it is unreachable, but signals can
   * theoretically mutate between computed evaluation and raw reads. The
   * `captureError` is a tripwire for any future drift in the invariant.
   */
  snapshotEpoch(): { epochId: string; participant: EpochParticipant } | null {
    if (!this.isEpochMode.value) return null;
    const epochId = this.epochId.value;
    const participant = this.epochParticipant.value;
    if (epochId === null || participant === null) {
      captureError(
        new Error(
          `TerminalStateManager.snapshotEpoch invariant violation: epochId=${
            epochId === null ? 'null' : 'set'
          }, participant=${participant === null ? 'null' : 'set'}`,
        ),
        { source: 'TerminalStateManager.snapshotEpoch' },
      );
      return null;
    }
    return { epochId, participant };
  }

  // ── Dungeon Context ─────────────────────────────────────────────────────

  /**
   * Enter dungeon mode. Called by dungeon command handler after run creation.
   * Actual dungeon state lives in DungeonStateManager — this only tracks
   * the mode flag for command routing (move → room-move, look → room-look).
   */
  initializeDungeon(runId: string, label?: string): void {
    this.dungeonRunId.value = runId;
    this.dungeonLabel.value = label ?? null;
    // A chronicle belongs to one descent. Clearing on entry also covers the
    // second run of a session, where the previous run's ending would otherwise
    // stand above the new run's first room.
    this.dungeonNarration.value = [];
    this._narrationArmed = true;
  }

  /** Exit dungeon mode. Called after completion, wipe, or retreat.
   *  Leaves the chronicle standing – see `_narrationArmed`. */
  clearDungeon(): void {
    this._narrationRoom = null;
    this.dungeonRunId.value = null;
    this.dungeonLabel.value = null;
  }

  // ── Output Management ──────────────────────────────────────────────────

  /** Append lines to the terminal output buffer, trimming to MAX_OUTPUT_LINES.
   *  In dungeon mode the same lines also feed the chronicle – see
   *  `dungeonNarration` for why the mirror lives here and nowhere else. */
  appendOutput(lines: TerminalLine[]): void {
    const current = this.outputLines.value;
    const combined = [...current, ...lines];
    this.outputLines.value =
      combined.length > MAX_OUTPUT_LINES
        ? combined.slice(combined.length - MAX_OUTPUT_LINES)
        : combined;

    if (this._narrationArmed) {
      // Stamp the room HERE, at the moment of absorption. Working it out at
      // render time would be cheaper and wrong: the party moves on, and the
      // whole history would relabel itself to wherever they stand now.
      const narrated: DungeonNarrationLine[] = lines
        .filter((line) => line.type !== 'feed')
        .map((line) => ({ ...line, room: this._narrationRoom }));
      if (narrated.length > 0) {
        const merged = [...this.dungeonNarration.value, ...narrated];
        this.dungeonNarration.value =
          merged.length > MAX_NARRATION_LINES
            ? merged.slice(merged.length - MAX_NARRATION_LINES)
            : merged;
      }
    }
  }

  /** Append a single line. Convenience wrapper. */
  appendLine(line: TerminalLine): void {
    this.appendOutput([line]);
  }

  /** Tell the chronicle which room the next lines belong to.
   *
   *  Called by DungeonStateManager whenever the party's room changes. Lines
   *  already absorbed keep the stamp they were given — this only affects what
   *  comes next, which is the whole point. */
  setNarrationRoom(room: DungeonRoomStamp | null): void {
    this._narrationRoom = room;
  }

  /** Clear the output buffer. */
  clearOutput(): void {
    this.outputLines.value = [];
  }

  // ── Command History ────────────────────────────────────────────────────

  /** Record a command in history and increment count. */
  pushCommand(input: string): void {
    const trimmed = input.trim();
    if (!trimmed) return;

    const history = [...this.commandHistory.value, trimmed];
    this.commandHistory.value =
      history.length > MAX_COMMAND_HISTORY
        ? history.slice(history.length - MAX_COMMAND_HISTORY)
        : history;

    this.commandCount.value += 1;
    this._debouncedPersist();
  }

  // ── Clearance ──────────────────────────────────────────────────────────

  /**
   * Load admin-configured dungeon clearance settings from public API.
   * Called once during terminal initialization. Non-blocking — uses defaults
   * if the fetch fails (standard tier system, no bypass).
   */
  async loadDungeonClearanceConfig(): Promise<void> {
    try {
      const { dungeonApi } = await import('../services/api/DungeonApiService.js');
      const result = await dungeonApi.getClearanceConfig();
      if (result.success && result.data) {
        const { clearance_mode, clearance_threshold } = result.data;
        if (clearance_mode === 'off') {
          this.dungeonClearanceBypass.value = true;
          this.dungeonClearanceThreshold.value = null;
        } else if (clearance_mode === 'custom') {
          this.dungeonClearanceBypass.value = false;
          this.dungeonClearanceThreshold.value = clearance_threshold;
        } else {
          // "standard" — use module-level CLEARANCE_THRESHOLDS defaults
          this.dungeonClearanceBypass.value = false;
          this.dungeonClearanceThreshold.value = null;
        }
      }
    } catch (err) {
      captureError(err, { source: 'TerminalStateManager.loadDungeonClearanceConfig' });
    }
  }

  /**
   * Check if the current command count triggers a clearance upgrade.
   * Returns the new commands unlocked, or null if no upgrade.
   */
  checkClearanceUpgrade(): { newLevel: number; commands: string[] } | null {
    const count = this.commandCount.value;
    const current = this.clearanceLevel.value;

    const TIER_COMMANDS: Record<number, string[]> = {
      2: ['fortify', 'quarantine', 'assign', 'unassign', 'ceremony'],
      3: ['debrief', 'ask', 'investigate', 'scan', 'report'],
      4: ['sitrep', 'dossier', 'threats', 'intercept'],
    };

    // Tier 4 is epoch-context-based (handled in initializeEpoch), not command-count-based.
    for (const [level, threshold] of Object.entries(CLEARANCE_THRESHOLDS)) {
      const lvl = Number(level);
      if (lvl > current && count >= threshold) {
        this.clearanceLevel.value = lvl;
        this._debouncedPersist();
        return { newLevel: lvl, commands: TIER_COMMANDS[lvl] ?? [] };
      }
    }
    return null;
  }

  // ── Resource Budgets ───────────────────────────────────────────────────

  /** Consume operations points. Returns true if sufficient, false otherwise. */
  consumeOps(cost: number): boolean {
    if (this.operationsPoints.value < cost) return false;
    this.operationsPoints.value -= cost;
    this._debouncedPersist();
    return true;
  }

  /** Consume intel points. Returns true if sufficient, false otherwise. */
  consumeIntel(cost: number): boolean {
    if (this.intelPoints.value < cost) return false;
    this.intelPoints.value -= cost;
    this._debouncedPersist();
    return true;
  }

  /**
   * Punkte auf das Maximum setzen. Kein oeffentlicher Einstieg mehr —
   * `syncBudgetsWithHeartbeat` entscheidet, WANN das passiert.
   *
   * Der Kommentar hier lautete „called on heartbeat tick". Gemessen am
   * 31.08.2026: die Methode hatte NULL Aufrufer im gesamten Baum. Der Satz
   * beschrieb eine Absicht als Tatsache, und die Punktewirtschaft lief
   * einseitig — `fortify` kostet 1, `quarantine` 2, `scan`/`debrief` je 1
   * Intel, und nach drei bzw. zwei Handlungen war die Sitzung endgueltig
   * vorbei. Nicht bis zum naechsten Zyklus: endgueltig, denn der persistierte
   * Stand ueberlebte den Neuladen.
   */
  private _refillBudgets(tick: number): void {
    this.operationsPoints.value = DEFAULT_OPS_POINTS;
    this.intelPoints.value = DEFAULT_INTEL_POINTS;
    this.budgetTick.value = tick;
    this._debouncedPersist();
  }

  /**
   * Die Punkte an den Herzschlag der Welt koppeln.
   *
   * Die Hilfe verspricht „3 Operations Points per cycle" und „2 Intel Points
   * per cycle" — ein Zyklus ist ein Herzschlag-Tick. Genau diese Zusage war
   * unerfuellbar, weil niemand das Auffuellen ausloeste.
   *
   * ERSTER ABGLEICH FUELLT NICHT AUF. Wer `budgetTick = null` mitbringt, hat
   * diesen Mechanismus nie gehabt; er bekaeme sonst allein durch das
   * Erscheinen des Feldes ein Geschenk, und im Protokoll saehe es aus wie
   * eine regulaere Auffuellung. Der aktuelle Tick wird uebernommen, die
   * Punkte bleiben, wie sie sind.
   *
   * MEHRERE VERSAEUMTE TICKS FUELLEN EINMAL AUF, nicht mehrfach: die Punkte
   * sind eine Obergrenze je Zyklus, kein Guthaben, das sich ansammelt. Wer
   * eine Woche nicht da war, kommt mit vollen Punkten zurueck — nicht mit
   * zwanzig.
   *
   * Nicht blockierend und fehlertolerant: schlaegt der Abruf fehl, bleiben
   * die Punkte, wie sie waren. Ein Terminal, das wegen einer misslungenen
   * Abfrage Punkte verschenkt, waere schlimmer als eines, das eine Auffuellung
   * verpasst.
   */
  async syncBudgetsWithHeartbeat(): Promise<void> {
    if (!this._simulationId) return;
    try {
      const { heartbeatApi } = await import('../services/api/HeartbeatApiService.js');
      const { appState } = await import('./AppStateManager.js');
      const result = await heartbeatApi.getOverview(
        this._simulationId,
        appState.currentSimulationMode.value,
      );
      if (!result.success || !result.data) return;

      const tick = result.data.last_tick;
      if (typeof tick !== 'number' || Number.isNaN(tick)) return;

      if (this.budgetTick.value === null) {
        this.budgetTick.value = tick;
        this._debouncedPersist();
        return;
      }
      if (tick > this.budgetTick.value) {
        const missed = tick - this.budgetTick.value;
        this._refillBudgets(tick);
        // Eine Auffuellung, die niemand sieht, ist die halbe Tuer: der
        // Spielende wuerde die Punkte fuer unveraenderlich halten und nicht
        // ausgeben. Deshalb sagt das Terminal es an — und nennt die Zahl der
        // Zyklen, damit sichtbar bleibt, dass mehrere Ticks EINMAL auffuellen
        // und sich nicht ansammeln.
        this.appendOutput([
          {
            id: `budget-refill-${tick}`,
            type: 'system',
            content:
              missed === 1
                ? msg('[SYSTEM] Substrate pulse registered. Operations and Intel points restored.')
                : msg(
                    str`[SYSTEM] ${missed} substrate pulses registered since your last visit. Operations and Intel points restored (they do not accumulate).`,
                  ),
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      captureError(err, { source: 'TerminalStateManager.syncBudgetsWithHeartbeat' });
    }
  }

  // ── Conversation Mode ──────────────────────────────────────────────────

  /** Enter conversation mode with an agent. */
  enterConversation(agentId: string, agentName: string, conversationId: string): void {
    this.conversationMode.value = { agentId, agentName, conversationId };

    // Cache conversation for reuse
    this.conversationMap.value = {
      ...this.conversationMap.value,
      [agentId]: conversationId,
    };
    this._debouncedPersist();
  }

  /** Exit conversation mode. */
  exitConversation(): void {
    this.conversationMode.value = null;
  }

  /** Get existing conversation ID for an agent, if any. */
  getConversationForAgent(agentId: string): string | null {
    return this.conversationMap.value[agentId] ?? null;
  }

  // ── Onboarding ─────────────────────────────────────────────────────────

  /** Mark onboarding as complete (boot sequence shown). */
  completeOnboarding(): void {
    this.onboarded.value = true;
    this._debouncedPersist();
  }

  /** Advance the guided hint step. Returns the new step number. */
  advanceOnboardingStep(): number {
    const next = this.onboardingStep.value + 1;
    this.onboardingStep.value = next;
    this._debouncedPersist();
    return next;
  }

  // ── Zone Navigation ────────────────────────────────────────────────────

  /** Set current zone and invalidate per-zone caches. */
  setCurrentZone(zoneId: string): void {
    this.currentZoneId.value = zoneId;
    this._debouncedPersist();
  }

  /** Cache zone data from API response. */
  cacheZones(zones: Zone[]): void {
    const map = new Map<string, Zone>();
    for (const z of zones) {
      map.set(z.id, z);
    }
    this.zoneCache.value = map;
  }

  /** Cache agents for a specific zone. */
  cacheAgentsForZone(zoneId: string, agents: Agent[]): void {
    const map = new Map(this.agentsByZone.value);
    map.set(zoneId, agents);
    this.agentsByZone.value = map;
  }

  /** Cache buildings for a specific zone. */
  cacheBuildingsForZone(zoneId: string, buildings: Building[]): void {
    const map = new Map(this.buildingsByZone.value);
    map.set(zoneId, buildings);
    this.buildingsByZone.value = map;
  }

  /** Invalidate per-zone caches (called on zone change or mutation). */
  invalidateZoneCaches(): void {
    this.agentsByZone.value = new Map();
    this.buildingsByZone.value = new Map();
  }

  // ── Feed Filter ────────────────────────────────────────────────────────

  setFeedFilter(filter: FeedFilter): void {
    this.feedFilter.value = filter;
    this._debouncedPersist();
  }

  // ── Persistence ────────────────────────────────────────────────────────

  private _storageKey(): string {
    return `${STORAGE_PREFIX}${this._simulationId}`;
  }

  private _loadFromStorage(): TerminalPersistedState | null {
    if (!this._simulationId) return null;
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return null;
      return JSON.parse(raw) as TerminalPersistedState;
    } catch (err) {
      captureError(err, { source: 'TerminalStateManager._loadFromStorage' });
      return null;
    }
  }

  private _persist(): void {
    if (!this._simulationId) return;
    // Persist last 50 output lines (stripped to content+type for JSON safety)
    const recentOutput = this.outputLines.value
      .slice(-50)
      .map((l) => ({ type: l.type, content: l.content }));
    const state: TerminalPersistedState = {
      currentZoneId: this.currentZoneId.value,
      clearanceLevel: this.clearanceLevel.value,
      commandCount: this.commandCount.value,
      onboarded: this.onboarded.value,
      onboardingStep: this.onboardingStep.value,
      commandHistory: this.commandHistory.value,
      operationsPoints: this.operationsPoints.value,
      intelPoints: this.intelPoints.value,
      budgetTick: this.budgetTick.value,
      feedFilter: this.feedFilter.value,
      conversationMap: this.conversationMap.value,
      recentOutput,
    };
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(state));
    } catch (err) {
      captureError(err, { source: 'TerminalStateManager._persist' });
    }
  }

  private _debouncedPersist(): void {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this._persist(), PERSIST_DEBOUNCE_MS);
  }

  private _resetToDefaults(): void {
    this.currentZoneId.value = null;
    this.clearanceLevel.value = 1;
    this.commandCount.value = 0;
    this.onboarded.value = false;
    this.onboardingStep.value = 0;
    this.commandHistory.value = [];
    this.operationsPoints.value = DEFAULT_OPS_POINTS;
    this.intelPoints.value = DEFAULT_INTEL_POINTS;
    // Bewusst null und nicht 0: eine frische Sitzung hat noch nie aufgefuellt.
    // Mit 0 waere der erste Abgleich gegen einen echten Tick (auf Prod
    // dreistellig) sofort eine Auffuellung — auf einem Stand, der ohnehin
    // schon voll ist. Das waere folgenlos, aber es stuende als Auffuellung im
    // Protokoll, und der naechste Leser haielte den Mechanismus fuer erprobt.
    this.budgetTick.value = null;
    this.feedFilter.value = 'all';
    this.conversationMap.value = {};
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  /** Flush pending persist and clear timers. */
  dispose(): void {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persist(); // flush
      this._persistTimer = null;
    }
  }
}

export const terminalState = new TerminalStateManager();
