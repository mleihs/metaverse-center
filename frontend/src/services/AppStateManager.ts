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

export class AppStateManager {
  // --- Auth ---
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);

  // --- Simulations ---
  readonly currentSimulation = signal<Simulation | null>(null);
  readonly simulations = signal<Simulation[]>([]);
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

  // --- Navigation deep-link signals ---
  /** Agent name to auto-open on next AgentsView load, then cleared. */
  readonly pendingOpenAgentName = signal<string | null>(null);
  /** Building ID to auto-open on next BuildingsView load, then cleared. */
  readonly pendingOpenBuildingId = signal<string | null>(null);

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

  setSettings(settings: SimulationSetting[]): void {
    this.settings.value = settings;
  }

  setThresholdState(state: ThresholdState): void {
    this.thresholdState.value = state;
  }

  setBleedStatus(status: BleedStatus | null): void {
    this.bleedStatus.value = status;
    if (status) {
      this.thresholdState.value = status.threshold_state;
    }
  }

  /** Get taxonomy values for a specific type. */
  getTaxonomiesByType(type: string): SimulationTaxonomy[] {
    return this.taxonomies.value.filter((t) => t.taxonomy_type === type);
  }
}

export const appState = new AppStateManager();
