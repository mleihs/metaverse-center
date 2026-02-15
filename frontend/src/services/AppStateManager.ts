import { computed, signal } from '@preact/signals-core';
import type { User } from '@supabase/supabase-js';
import type {
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

  // --- Simulation context ---
  readonly currentRole = signal<SimulationRole | null>(null);
  readonly taxonomies = signal<SimulationTaxonomy[]>([]);
  readonly settings = signal<SimulationSetting[]>([]);

  // --- UI ---
  readonly loading = signal<boolean>(false);

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

  // --- Setters ---

  setUser(user: User | null): void {
    this.user.value = user;
  }

  setAccessToken(token: string | null): void {
    this.accessToken.value = token;
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

  setSettings(settings: SimulationSetting[]): void {
    this.settings.value = settings;
  }

  /** Get taxonomy values for a specific type. */
  getTaxonomiesByType(type: string): SimulationTaxonomy[] {
    return this.taxonomies.value.filter((t) => t.taxonomy_type === type);
  }
}

export const appState = new AppStateManager();
