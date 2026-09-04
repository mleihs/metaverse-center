import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import type { User } from '@supabase/supabase-js';
import type { BleedStatus, ThresholdState } from '../types/health.js';
import type {
  ForgeAccessStatus,
  Simulation,
  SimulationRole,
  SimulationSetting,
  SimulationTaxonomy,
} from '../types/index.js';
import type {
  AchievementDefinition,
  AchievementSummary,
  UserAchievement,
} from './api/AchievementsApiService.js';
import { captureError } from './SentryService.js';
import { isPlatformSkin, type LandingTemplate, type PlatformSkin } from './theme-presets.js';

/** Where the reader's skin choice survives a reload. */
const PLATFORM_SKIN_KEY = 'velg-platform-skin';

/**
 * Die zuletzt vom Server gemeldete Vorgabe.
 *
 * Ein eigener Schluessel neben der eigenen Wahl, und das ist der Kern der
 * Sache: die zwei sind verschiedene Dinge. Die WAHL gehoert dem Benutzer und
 * ueberlebt jede Aenderung in der Verwaltung. Die VORGABE gehoert dem Haus und
 * darf sich aendern, ohne dass jemandes Wahl davon beruehrt wird. In einem
 * Schluessel zusammengelegt waere die erste Anwendung der Vorgabe zugleich eine
 * Wahl gewesen — der Gast haette damit fuer immer das Aussehen behalten, das
 * am Tag seines ersten Besuchs eingestellt war.
 */
const PLATFORM_DEFAULT_SKIN_KEY = 'velg-default-skin';

/** Wenn weder Wahl noch gemeldete Vorgabe vorliegen. */
const FALLBACK_SKIN: PlatformSkin = 'dark';

function lies(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    captureError(err, { source: 'AppStateManager.lies' });
    return null;
  }
}

/**
 * Die Ausgabe, mit der diese Sitzung anfaengt.
 *
 * Drei Stufen, in dieser Reihenfolge:
 *   1. die eigene Wahl dieses Browsers — sie schlaegt alles,
 *   2. die zuletzt gemeldete Vorgabe des Hauses,
 *   3. Phosphor.
 *
 * Stufe 2 ist der Grund, warum die Vorgabe ueberhaupt gespeichert wird: sie
 * kommt aus einem Abruf, und ein Abruf braucht Zeit. Ohne die Erinnerung saehe
 * ein Gast bei JEDEM Aufruf erst Phosphor und dann das Papier. Mit ihr sieht
 * er das Umschalten genau einmal — beim allerersten Besuch.
 *
 * Einmal beim Bau gelesen und nicht bei jedem Zugriff: der Wert aendert sich
 * nur ueber setPlatformSkin bzw. applyDefaultSkin, und ein Signal, das die
 * Ablage neu liest, machte den Umschalter von einem Plattenzugriff mitten in
 * einem Render-Effekt abhaengig.
 */
function readStoredSkin(): PlatformSkin {
  const gewaehlt = lies(PLATFORM_SKIN_KEY);
  if (isPlatformSkin(gewaehlt)) return gewaehlt;
  const vorgabe = lies(PLATFORM_DEFAULT_SKIN_KEY);
  return isPlatformSkin(vorgabe) ? vorgabe : FALLBACK_SKIN;
}

export class AppStateManager {
  // --- Auth ---
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);

  // --- Simulations ---
  readonly currentSimulation = signal<Simulation | null>(null);
  readonly simulations = signal<Simulation[]>([]);
  readonly memberSimulationIds = signal<Set<string>>(new Set());
  readonly isArchitect = signal<boolean>(false);

  // --- Simulation context ---
  readonly currentRole = signal<SimulationRole | null>(null);
  readonly taxonomies = signal<SimulationTaxonomy[]>([]);
  readonly settings = signal<SimulationSetting[]>([]);

  // --- Forge Access Requests ---
  readonly forgeRequestStatus = signal<'none' | ForgeAccessStatus>('none');
  readonly pendingForgeRequestCount = signal<number>(0);

  // --- Threshold / Bleed ---
  readonly thresholdState = signal<ThresholdState>('normal');
  readonly bleedStatus = signal<BleedStatus | null>(null);

  // --- Onboarding ---
  readonly onboardingCompleted = signal<boolean>(true); // default true to avoid flash

  // --- UI ---
  readonly loading = signal<boolean>(false);
  readonly mockMode = signal<boolean>(false);

  /**
   * Which global skin the platform chrome wears — dark phosphor or map paper.
   *
   * A reader's choice, not a world's: it survives switching simulations and is
   * remembered per browser. `app-shell.ts` watches it and re-themes its own
   * host; DRIFT and the dungeon re-assert the dark config on theirs regardless,
   * because the Zwischenraum and the CRT are diegetic.
   */
  readonly platformSkin = signal<PlatformSkin>(readStoredSkin());

  /**
   * Welche Layout-Vorlage die Frontseite und das Dashboard tragen.
   *
   * WARUM ABGELEITET UND KEIN EIGENES SIGNAL
   *   Das Design-Paket nennt es ein Merkmalstor
   *   (`landingTemplate: 'editorial' | 'atlas'`), das dem Skin folgt. Ein
   *   zweites Signal, das dem ersten folgen SOLL, ist aber genau die Bauart,
   *   bei der beide irgendwann auseinanderstehen — und ein Papier-Skin mit dem
   *   redaktionellen Layout waere kein Fehler, der auffaellt, sondern einfach
   *   eine Seite, die nach 70 Prozent aussieht.
   *
   *   Solange die Vorlage dem Skin folgt, IST sie der Skin, nur anders
   *   benannt. Wer sie spaeter entkoppeln will, macht hier ein Signal daraus
   *   und hat dann genau eine Stelle zu aendern.
   *
   *   Der Name bleibt trotzdem eigen: an der Lesestelle soll stehen, welche
   *   VORLAGE gemeint ist, nicht welcher Skin. Ein `if (skin === 'atlas')` in
   *   einer Layout-Entscheidung verschweigt, worum es dort geht.
   */
  readonly landingTemplate: ReadonlySignal<LandingTemplate> = computed(() =>
    this.platformSkin.value === 'atlas' ? 'atlas' : 'editorial',
  );

  // --- Achievements ---
  readonly achievementDefinitions = signal<AchievementDefinition[]>([]);
  readonly achievementSummary = signal<AchievementSummary | null>(null);
  /** Set briefly on Realtime INSERT, consumed by toast/dashboard. Cleared after display. */
  readonly recentUnlock = signal<UserAchievement | null>(null);

  // --- Navigation deep-link signals ---
  /** Agent name to auto-open on next AgentsView load, then cleared. */
  readonly pendingOpenAgentName = signal<string | null>(null);
  /** Building ID to auto-open on next BuildingsView load, then cleared. */
  readonly pendingOpenBuildingId = signal<string | null>(null);
  /** Archetype slug to auto-select on next DungeonTerminalView load, then cleared. */
  readonly pendingDungeonArchetype = signal<string | null>(null);

  // --- Computed ---
  readonly isAuthenticated = computed(() => this.user.value !== null);

  readonly simulationId = computed(() => this.currentSimulation.value?.id ?? null);

  readonly isOwner = computed(() => this.currentRole.value === 'owner');

  readonly canAdmin = computed(() => {
    const role = this.currentRole.value;
    return role === 'owner' || role === 'admin';
  });

  readonly canEdit = computed(() => {
    const role = this.currentRole.value;
    return role === 'owner' || role === 'admin' || role === 'editor';
  });

  /**
   * Access mode for simulation-scoped API reads.
   *
   * `'member'` iff the user is authenticated AND has a role in the current
   * simulation. Otherwise `'public'` (guests, signed-out sessions, and
   * authenticated non-members browsing someone else's simulation).
   *
   * Read this at the call site and pass it explicitly to
   * `BaseApiService.getSimulationData` so the routing decision is visible at
   * the callsite and `services/api/` stays free of implicit appState reads.
   */
  readonly currentSimulationMode = computed<'public' | 'member'>(() =>
    this.isAuthenticated.value && this.currentRole.value !== null ? 'member' : 'public',
  );

  private readonly _isPlatformAdmin = signal<boolean>(false);
  readonly isPlatformAdmin: ReadonlySignal<boolean> = this._isPlatformAdmin;

  readonly canForge = computed(() => this.isArchitect.value || this.isPlatformAdmin.value);

  readonly canRequestForgeAccess = computed(
    () =>
      this.isAuthenticated.value &&
      !this.canForge.value &&
      this.forgeRequestStatus.value === 'none',
  );

  // --- Setters ---

  setUser(user: User | null): void {
    this.user.value = user;
  }

  setAccessToken(token: string | null): void {
    this.accessToken.value = token;
  }

  setArchitectStatus(isArchitect: boolean): void {
    this.isArchitect.value = isArchitect;
  }

  setPlatformAdmin(value: boolean): void {
    this._isPlatformAdmin.value = value;
  }

  setForgeRequestStatus(status: 'none' | ForgeAccessStatus): void {
    this.forgeRequestStatus.value = status;
  }

  setPendingForgeRequestCount(count: number): void {
    this.pendingForgeRequestCount.value = count;
  }

  setCurrentSimulation(simulation: Simulation | null): void {
    this.currentSimulation.value = simulation;
    // Reset context when simulation changes
    if (!simulation) {
      this.currentRole.value = null;
      this.taxonomies.value = [];
      this.settings.value = [];
    }
  }

  setSimulations(simulations: Simulation[]): void {
    this.simulations.value = simulations;
  }

  setMemberSimulationIds(ids: Set<string>): void {
    this.memberSimulationIds.value = ids;
  }

  setCurrentRole(role: SimulationRole | null): void {
    this.currentRole.value = role;
  }

  setTaxonomies(taxonomies: SimulationTaxonomy[]): void {
    this.taxonomies.value = taxonomies;
  }

  setOnboardingCompleted(value: boolean): void {
    this.onboardingCompleted.value = value;
  }

  setMockMode(value: boolean): void {
    this.mockMode.value = value;
  }

  /**
   * Switch the platform skin and remember it.
   *
   * The signal moves first and the write follows: a browser that refuses
   * storage (private mode, blocked site data) should still get the skin it
   * asked for in this session rather than a switch that silently does nothing.
   */
  setPlatformSkin(skin: PlatformSkin): void {
    this.platformSkin.value = skin;
    try {
      localStorage.setItem(PLATFORM_SKIN_KEY, skin);
    } catch (err) {
      captureError(err, { source: 'AppStateManager.setPlatformSkin' });
    }
  }

  /**
   * Die Vorgabe des Hauses uebernehmen — aber NUR fuer den, der nicht gewaehlt
   * hat.
   *
   * Die Bedingung ist die ganze Methode. Wer den Editionsumschalter benutzt
   * hat, dem darf eine Aenderung in der Verwaltung sein Aussehen nicht unter
   * den Fuessen wegziehen; das waere aus seiner Sicht ein Fehler, kein
   * Merkmal. Gespeichert wird die Vorgabe trotzdem in jedem Fall, damit der
   * naechste Aufruf ohne Warten richtig anfaengt.
   */
  applyDefaultSkin(skin: PlatformSkin): void {
    try {
      localStorage.setItem(PLATFORM_DEFAULT_SKIN_KEY, skin);
    } catch (err) {
      captureError(err, { source: 'AppStateManager.applyDefaultSkin' });
    }
    if (isPlatformSkin(lies(PLATFORM_SKIN_KEY))) return;
    this.platformSkin.value = skin;
  }

  setSettings(settings: SimulationSetting[]): void {
    this.settings.value = settings;
  }

  setThresholdState(state: ThresholdState): void {
    this.thresholdState.value = state;
  }

  setBleedStatus(status: BleedStatus | null): void {
    this.bleedStatus.value = status;
    if (status) {
      this.thresholdState.value =
        status.threshold_state === 'critical' && status.effects_suppressed
          ? 'normal'
          : status.threshold_state;
    }
  }

  setAchievementDefinitions(defs: AchievementDefinition[]): void {
    this.achievementDefinitions.value = defs;
  }

  setAchievementSummary(summary: AchievementSummary | null): void {
    this.achievementSummary.value = summary;
  }

  setRecentUnlock(achievement: UserAchievement | null): void {
    this.recentUnlock.value = achievement;
  }

  /** Get taxonomy values for a specific type. */
  getTaxonomiesByType(type: string): SimulationTaxonomy[] {
    return this.taxonomies.value.filter((t) => t.taxonomy_type === type);
  }
}

export const appState = new AppStateManager();
