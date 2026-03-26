/**
 * Bureau Terminal state manager.
 * Manages terminal session state with Preact Signals and localStorage persistence.
 * Pattern: ForgeStateManager (dedicated signal store, singleton export).
 */

import { computed, signal } from '@preact/signals-core';
import type {
  ConversationMode,
  FeedFilter,
  TerminalLine,
  TerminalPersistedState,
} from '../types/terminal.js';
import type { Agent, Building, Zone, ZoneStability } from '../types/index.js';

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'bureau_terminal_';
const MAX_OUTPUT_LINES = 500;
const MAX_COMMAND_HISTORY = 100;
const PERSIST_DEBOUNCE_MS = 500;
const DEFAULT_OPS_POINTS = 3;
const DEFAULT_INTEL_POINTS = 2;

/** Command count thresholds for clearance upgrades (spec 4.4.4). */
const CLEARANCE_THRESHOLDS: Record<number, number> = {
  2: 10,  // Tier 2 unlocks after 10 successful commands
  3: 25,  // Tier 3 unlocks after 25 commands (Intelligence Network)
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

  /** Timestamp of last fetched heartbeat entry (for polling delta). */
  readonly lastFeedTimestamp = signal<string | null>(null);

  // --- Computed ---
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
      this.currentZoneId.value = stored.currentZoneId;
      this.clearanceLevel.value = stored.clearanceLevel;
      this.commandCount.value = stored.commandCount;
      this.onboarded.value = stored.onboarded;
      this.onboardingStep.value = stored.onboardingStep;
      this.commandHistory.value = stored.commandHistory;
      this.operationsPoints.value = stored.operationsPoints;
      this.intelPoints.value = stored.intelPoints;
      this.feedFilter.value = stored.feedFilter;
      this.conversationMap.value = stored.conversationMap;
    } else {
      this._resetToDefaults();
    }

    // Always clear transient state
    this.outputLines.value = [];
    this.conversationMode.value = null;
    this.isLoading.value = false;
    this.lastFeedTimestamp.value = null;
  }

  // ── Output Management ──────────────────────────────────────────────────

  /** Append lines to the terminal output buffer, trimming to MAX_OUTPUT_LINES. */
  appendOutput(lines: TerminalLine[]): void {
    const current = this.outputLines.value;
    const combined = [...current, ...lines];
    this.outputLines.value =
      combined.length > MAX_OUTPUT_LINES
        ? combined.slice(combined.length - MAX_OUTPUT_LINES)
        : combined;
  }

  /** Append a single line. Convenience wrapper. */
  appendLine(line: TerminalLine): void {
    this.appendOutput([line]);
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
   * Check if the current command count triggers a clearance upgrade.
   * Returns the new commands unlocked, or null if no upgrade.
   */
  checkClearanceUpgrade(): { newLevel: number; commands: string[] } | null {
    const count = this.commandCount.value;
    const current = this.clearanceLevel.value;

    const TIER_COMMANDS: Record<number, string[]> = {
      2: ['fortify', 'quarantine', 'assign', 'unassign', 'ceremony'],
      3: ['debrief', 'ask', 'investigate', 'scan', 'report'],
    };

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

  /** Refresh budgets to max (called on heartbeat tick). */
  refreshBudgets(): void {
    this.operationsPoints.value = DEFAULT_OPS_POINTS;
    this.intelPoints.value = DEFAULT_INTEL_POINTS;
    this._debouncedPersist();
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
    } catch {
      return null;
    }
  }

  private _persist(): void {
    if (!this._simulationId) return;
    const state: TerminalPersistedState = {
      currentZoneId: this.currentZoneId.value,
      clearanceLevel: this.clearanceLevel.value,
      commandCount: this.commandCount.value,
      onboarded: this.onboarded.value,
      onboardingStep: this.onboardingStep.value,
      commandHistory: this.commandHistory.value,
      operationsPoints: this.operationsPoints.value,
      intelPoints: this.intelPoints.value,
      feedFilter: this.feedFilter.value,
      conversationMap: this.conversationMap.value,
    };
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(state));
    } catch {
      // localStorage full or unavailable — silently degrade
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
