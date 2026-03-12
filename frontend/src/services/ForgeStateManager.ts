import { computed, signal } from '@preact/signals-core';
import type {
  ForgeAgentDraft,
  ForgeBuildingDraft,
  ForgeDraft,
  ForgeGenerationConfig,
} from './api/ForgeApiService.js';
import { forgeApi } from './api/ForgeApiService.js';

const DEFAULT_GENERATION_CONFIG: ForgeGenerationConfig = {
  agent_count: 6,
  building_count: 7,
  zone_count: 5,
  street_count: 5,
  deep_research: true,
};

const DRAFT_STORAGE_KEY = 'forge_draft_id';

/**
 * State manager for the Simulation Forge wizard.
 * Single source of truth — all forge operations go through here.
 */
class ForgeStateManager {
  // --- Core State ---
  readonly draft = signal<ForgeDraft | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isGenerating = signal(false);

  // --- Staging State (hand/fan for review before accept) ---
  readonly stagedAgents = signal<ForgeAgentDraft[]>([]);
  readonly stagedBuildings = signal<ForgeBuildingDraft[]>([]);

  // --- Generation Config ---
  readonly generationConfig = signal<ForgeGenerationConfig>({ ...DEFAULT_GENERATION_CONFIG });

  // --- Theme State ---
  readonly isGeneratingTheme = signal(false);

  // --- Computed Views ---
  readonly phase = computed(() => this.draft.value?.current_phase ?? 'astrolabe');
  readonly status = computed(() => this.draft.value?.status ?? 'draft');
  readonly canIgnite = computed(() => {
    const d = this.draft.value;
    return d && d.current_phase === 'ignition' && d.status === 'draft';
  });

  // --- Debounce state ---
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingUpdate: Partial<ForgeDraft> | null = null;

  // --- Actions ---

  /**
   * Restore a draft from sessionStorage if one exists.
   * Call this on wizard mount to survive page refreshes.
   */
  async restoreSession(): Promise<boolean> {
    const savedId = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!savedId || this.draft.value) return false;
    await this.loadDraft(savedId);
    return !!this.draft.value;
  }

  async loadDraft(id: string) {
    this.isLoading.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.getDraft(id);
      if (resp.success && resp.data) {
        this.draft.value = resp.data;
        sessionStorage.setItem(DRAFT_STORAGE_KEY, resp.data.id);
        // Sync generation config from draft
        if (resp.data.generation_config) {
          this.generationConfig.value = {
            ...DEFAULT_GENERATION_CONFIG,
            ...resp.data.generation_config,
          };
        }
      } else {
        this.error.value = resp.error?.message ?? 'Failed to load draft';
      }
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      this.isLoading.value = false;
    }
  }

  async createDraft(seed: string) {
    this.isLoading.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.createDraft(seed);
      if (resp.success && resp.data) {
        this.draft.value = resp.data;
        sessionStorage.setItem(DRAFT_STORAGE_KEY, resp.data.id);
        return resp.data.id;
      }
      const msg = resp.error?.message ?? 'Failed to create draft';
      this.error.value = msg;
      throw new Error(msg);
    } catch (err) {
      if (!this.error.value) {
        this.error.value = err instanceof Error ? err.message : 'Unknown error';
      }
      throw err;
    } finally {
      this.isLoading.value = false;
    }
  }

  /**
   * Optimistic local update + debounced backend sync.
   * Phase transitions flush immediately; field edits debounce 500ms.
   */
  updateDraft(data: Partial<ForgeDraft>) {
    if (!this.draft.value) return;

    // Optimistic local update
    this.draft.value = { ...this.draft.value, ...data };

    // Phase changes flush immediately
    if (data.current_phase) {
      this._flushUpdate(data);
      return;
    }

    // Merge with pending update and debounce
    this._pendingUpdate = { ...this._pendingUpdate, ...data };
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flushPending(), 500);
  }

  /**
   * Update generation config and sync to draft.
   */
  updateGenerationConfig(config: Partial<ForgeGenerationConfig>) {
    this.generationConfig.value = { ...this.generationConfig.value, ...config };
    this.updateDraft({
      generation_config: this.generationConfig.value,
    } as Partial<ForgeDraft>);
  }

  private async _flushPending() {
    if (!this._pendingUpdate || !this.draft.value) return;
    const data = this._pendingUpdate;
    this._pendingUpdate = null;
    this._saveTimer = null;
    await this._flushUpdate(data);
  }

  private async _flushUpdate(data: Partial<ForgeDraft>) {
    if (!this.draft.value) return;
    try {
      await forgeApi.updateDraft(this.draft.value.id, data);
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Failed to save draft';
    }
  }

  async startResearch() {
    if (!this.draft.value) return;
    this.isGenerating.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.runResearch(this.draft.value.id);
      if (!resp.success) {
        this.error.value = resp.error?.message ?? 'Research failed';
        return;
      }
      await this.loadDraft(this.draft.value.id);
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Research failed';
    } finally {
      this.isGenerating.value = false;
    }
  }

  async generateChunk(chunkType: 'geography' | 'agents' | 'buildings') {
    const draftId = this.draft.value?.id;
    if (!draftId) return;

    this.isGenerating.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.generateChunk(draftId, chunkType);
      if (resp.success) {
        await this.loadDraft(draftId);
        // Move newly generated entities into staging
        if (chunkType === 'agents' && this.draft.value) {
          this.stagedAgents.value = [...this.draft.value.agents];
        } else if (chunkType === 'buildings' && this.draft.value) {
          this.stagedBuildings.value = [...this.draft.value.buildings];
        }
      } else {
        this.error.value = resp.error?.message ?? 'Generation failed';
      }
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Generation failed';
    } finally {
      this.isGenerating.value = false;
    }
  }

  /**
   * Accept an entity from staging into the committed roster.
   */
  acceptEntity(type: 'agent' | 'building', index: number) {
    if (type === 'agent') {
      const staged = [...this.stagedAgents.value];
      staged.splice(index, 1);
      this.stagedAgents.value = staged;
    } else {
      const staged = [...this.stagedBuildings.value];
      staged.splice(index, 1);
      this.stagedBuildings.value = staged;
    }
  }

  /**
   * Reject an entity from staging (remove without committing).
   */
  rejectEntity(type: 'agent' | 'building', index: number) {
    if (type === 'agent') {
      const staged = [...this.stagedAgents.value];
      const agents = [...(this.draft.value?.agents ?? [])];
      // Remove from both staging and draft
      staged.splice(index, 1);
      agents.splice(index, 1);
      this.stagedAgents.value = staged;
      this.updateDraft({ agents });
    } else {
      const staged = [...this.stagedBuildings.value];
      const buildings = [...(this.draft.value?.buildings ?? [])];
      staged.splice(index, 1);
      buildings.splice(index, 1);
      this.stagedBuildings.value = staged;
      this.updateDraft({ buildings });
    }
  }

  /**
   * Generate an AI theme for the current draft (Darkroom phase).
   */
  async generateTheme(): Promise<Record<string, string> | null> {
    const draftId = this.draft.value?.id;
    if (!draftId) return null;

    this.isGeneratingTheme.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.generateTheme(draftId);
      if (resp.success && resp.data) {
        this.updateDraft({ theme_config: resp.data } as Partial<ForgeDraft>);
        return resp.data;
      }
      this.error.value = resp.error?.message ?? 'Theme generation failed';
      return null;
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Theme generation failed';
      return null;
    } finally {
      this.isGeneratingTheme.value = false;
    }
  }

  async ignite(): Promise<{ simulationId?: string; slug?: string; name?: string; description?: string }> {
    const draftId = this.draft.value?.id;
    if (!draftId) return {};

    this.isLoading.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.ignite(draftId);
      if (resp.success && resp.data?.simulation_id) {
        return {
          simulationId: resp.data.simulation_id,
          slug: resp.data.slug ?? resp.data.simulation_id,
          name: resp.data.name ?? '',
          description: resp.data.description ?? '',
        };
      }
      this.error.value = resp.error?.message ?? 'Ignition failed';
      return {};
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Ignition failed';
      throw err;
    } finally {
      this.isLoading.value = false;
    }
  }

  reset() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._pendingUpdate = null;
    this.draft.value = null;
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    this.error.value = null;
    this.isGenerating.value = false;
    this.isGeneratingTheme.value = false;
    this.isLoading.value = false;
    this.stagedAgents.value = [];
    this.stagedBuildings.value = [];
    this.generationConfig.value = { ...DEFAULT_GENERATION_CONFIG };
  }
}

export const forgeStateManager = new ForgeStateManager();
