import { computed, type Signal, signal } from '@preact/signals-core';
import { appState } from './AppStateManager.js';
import type {
  BYOKStatus,
  FeaturePurchase,
  ForgeAgentDraft,
  ForgeBuildingDraft,
  ForgeDraft,
  ForgeGenerationConfig,
  ForgeProgress,
  PurchaseReceipt,
  TokenBundle,
  TokenPurchase,
  WalletResponse,
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
const TIMING_STORAGE_KEY = 'forge_generation_timings';
const MAX_TIMING_RECORDS = 20;
const TIMING_AVERAGE_WINDOW = 5;
const DEFAULT_ESTIMATES: Record<string, number> = {
  research: 30_000,
  geography: 120_000,
  agents: 180_000,
  buildings: 150_000,
};

interface TimingRecord {
  type: string;
  durationMs: number;
  timestamp: number;
}

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

  // --- Generation Timing ---
  /** Timestamp when current generation started. Null when idle. */
  readonly generationStartedAt = signal<number | null>(null);
  /** True if last generation completed via timeout recovery. Reset on next generation. */
  readonly lastGenerationRecovered = signal(false);
  /** True while actively polling the backend for recovery after a timeout. */
  readonly isRecovering = signal(false);

  // --- Staging State (hand/fan for review before accept) ---
  readonly stagedAgents = signal<ForgeAgentDraft[]>([]);
  readonly stagedBuildings = signal<ForgeBuildingDraft[]>([]);

  // --- Generation Config ---
  readonly generationConfig = signal<ForgeGenerationConfig>({ ...DEFAULT_GENERATION_CONFIG });

  // --- Theme State ---
  readonly isGeneratingTheme = signal(false);

  // --- Wallet / Mint State ---
  readonly walletBalance = signal<number>(0);
  readonly walletTier = signal<string>('observer');
  readonly isLoadingWallet = signal(false);
  readonly mintOpen = signal(false);
  readonly bundles = signal<TokenBundle[]>([]);
  readonly purchaseHistory = signal<TokenPurchase[]>([]);
  readonly byokStatus = signal<BYOKStatus>({
    has_openrouter_key: false,
    has_replicate_key: false,
    byok_allowed: false,
    byok_bypass: false,
    system_bypass_enabled: false,
    effective_bypass: false,
    access_policy: 'per_user',
  });

  // --- Threat Level (extracted from dossier ZETA) ---
  readonly threatLevel = signal<{ level: number; label: string; researchValue: string } | null>(
    null,
  );

  // --- Image Generation Tracking (post-ceremony) ---
  /** Slug of the simulation currently having images generated. */
  readonly imageTrackingSlug = signal<string | null>(null);
  /** Latest progress snapshot from get_forge_progress. */
  readonly imageProgress = signal<ForgeProgress | null>(null);
  /** Counter incremented each time new images are detected (triggers view re-fetches). */
  readonly imageUpdateVersion = signal(0);

  // --- Computed Views ---
  readonly phase = computed(() => this.draft.value?.current_phase ?? 'astrolabe');
  readonly status = computed(() => this.draft.value?.status ?? 'draft');
  /** Platform admins and BYOK bypass users skip all token costs. */
  readonly hasTokenBypass = computed(
    () => appState.isPlatformAdmin.value || this.byokStatus.value.effective_bypass,
  );
  readonly canIgnite = computed(() => {
    const d = this.draft.value;
    if (!d || d.current_phase !== 'ignition' || d.status !== 'draft') return false;
    return this.walletBalance.value > 0 || this.hasTokenBypass.value;
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
    return this._discardIfCompleted();
  }

  /** Clears the draft + sessionStorage if the loaded draft is no longer active. */
  private _discardIfCompleted(): boolean {
    const d = this.draft.value;
    if (d && d.status !== 'draft') {
      this.draft.value = null;
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return false;
    }
    return !!d;
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
    const draftId = this.draft.value.id;

    // Snapshot anchor count for timeout recovery
    const anchorsBefore = this.draft.value.philosophical_anchor?.options?.length ?? 0;

    this.isGenerating.value = true;
    this.error.value = null;
    this.isRecovering.value = false;
    this.generationStartedAt.value = Date.now();
    this.lastGenerationRecovered.value = false;
    try {
      const resp = await forgeApi.runResearch(draftId);
      if (!resp.success) {
        this.isRecovering.value = true;
        const recovered = await this._tryRecoverResearch(draftId, anchorsBefore);
        this.isRecovering.value = false;
        if (recovered) {
          this.lastGenerationRecovered.value = true;
        } else {
          this.error.value = resp.error?.message ?? 'Research failed';
        }
        return;
      }
      await this.loadDraft(draftId);
    } catch (err) {
      this.isRecovering.value = true;
      const recovered = await this._tryRecoverResearch(draftId, anchorsBefore);
      this.isRecovering.value = false;
      if (recovered) {
        this.lastGenerationRecovered.value = true;
      } else {
        this.error.value = err instanceof Error ? err.message : 'Research failed';
      }
    } finally {
      const startedAt = this.generationStartedAt.value;
      if (startedAt) {
        this._recordTiming('research', Date.now() - startedAt);
      }
      this.generationStartedAt.value = null;
      this.isRecovering.value = false;
      this.isGenerating.value = false;
    }
  }

  async generateChunk(chunkType: 'geography' | 'agents' | 'buildings') {
    const draftId = this.draft.value?.id;
    if (!draftId) return;

    // Snapshot entity counts before generation for timeout recovery
    const snapshot = this._snapshotCounts();

    this.isGenerating.value = true;
    this.error.value = null;
    this.isRecovering.value = false;
    this.generationStartedAt.value = Date.now();
    this.lastGenerationRecovered.value = false;
    try {
      const resp = await forgeApi.generateChunk(draftId, chunkType);
      if (resp.success) {
        await this.loadDraft(draftId);
        this._syncStagingAfterGeneration(chunkType);
      } else {
        this.isRecovering.value = true;
        const recovered = await this._tryRecoverChunk(draftId, chunkType, snapshot);
        this.isRecovering.value = false;
        if (recovered) {
          this.lastGenerationRecovered.value = true;
        } else {
          this.error.value = resp.error?.message ?? 'Generation failed';
        }
      }
    } catch (err) {
      this.isRecovering.value = true;
      const recovered = await this._tryRecoverChunk(draftId, chunkType, snapshot);
      this.isRecovering.value = false;
      if (recovered) {
        this.lastGenerationRecovered.value = true;
      } else {
        this.error.value = err instanceof Error ? err.message : 'Generation failed';
      }
    } finally {
      const startedAt = this.generationStartedAt.value;
      if (startedAt) {
        this._recordTiming(chunkType, Date.now() - startedAt);
      }
      this.generationStartedAt.value = null;
      this.isRecovering.value = false;
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

  async ignite(): Promise<{
    simulationId?: string;
    slug?: string;
    name?: string;
    description?: string;
  }> {
    const draftId = this.draft.value?.id;
    if (!draftId) return {};

    this.isLoading.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.ignite(draftId);
      if (resp.success && resp.data?.simulation_id) {
        // Draft is now materialized — clear session so the wizard starts fresh next time
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
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

  // --- Wallet / Mint Actions ---

  async loadWallet(): Promise<WalletResponse | null> {
    this.isLoadingWallet.value = true;
    try {
      const resp = await forgeApi.getWallet();
      if (resp.success && resp.data) {
        this.walletBalance.value = resp.data.forge_tokens;
        this.walletTier.value = resp.data.account_tier ?? 'observer';
        if (resp.data.byok_status) {
          this.byokStatus.value = resp.data.byok_status;
        }
        return resp.data;
      }
      return null;
    } catch {
      // Best-effort — wallet display is non-critical
      return null;
    } finally {
      this.isLoadingWallet.value = false;
    }
  }

  async loadBundles(): Promise<void> {
    try {
      const resp = await forgeApi.listBundles();
      if (resp.success && resp.data) {
        this.bundles.value = resp.data;
      }
    } catch {
      // Best-effort
    }
  }

  async purchaseBundle(slug: string): Promise<PurchaseReceipt | null> {
    this.isLoadingWallet.value = true;
    this.error.value = null;
    try {
      const resp = await forgeApi.purchaseBundle(slug);
      if (resp.success && resp.data) {
        this.walletBalance.value = resp.data.balance_after;
        return resp.data;
      }
      this.error.value = resp.error?.message ?? 'Purchase failed';
      return null;
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Purchase failed';
      return null;
    } finally {
      this.isLoadingWallet.value = false;
    }
  }

  async loadPurchaseHistory(): Promise<void> {
    try {
      const resp = await forgeApi.getPurchaseHistory();
      if (resp.success && resp.data) {
        // PaginatedResponse wraps data in .data
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as unknown as { data: TokenPurchase[] }).data ?? []);
        this.purchaseHistory.value = items;
      }
    } catch {
      // Best-effort
    }
  }

  // --- Feature Purchases ---

  readonly featurePurchases: Signal<Map<string, FeaturePurchase[]>> = signal(new Map());

  private static readonly FEATURE_TYPES = [
    'classified_dossier',
    'recruitment',
    'darkroom_pass',
    'chronicle_export',
  ] as const;

  private static readonly FEATURE_TAB_MAP: Record<string, string> = {
    classified_dossier: 'lore',
    recruitment: 'agents',
    darkroom_pass: 'settings',
    chronicle_export: 'chronicle',
  };

  async loadAllFeatureStatuses(simulationId: string): Promise<void> {
    await Promise.all(
      ForgeStateManager.FEATURE_TYPES.map((t) => this.loadFeaturePurchases(simulationId, t)),
    );
  }

  hasAnyUnpurchasedFeature(simulationId: string): boolean {
    return ForgeStateManager.FEATURE_TYPES.some((t) => !this.hasCompletedPurchase(simulationId, t));
  }

  getUnpurchasedTabPaths(simulationId: string): Set<string> {
    const tabs = new Set<string>();
    for (const ft of ForgeStateManager.FEATURE_TYPES) {
      if (!this.hasCompletedPurchase(simulationId, ft)) {
        const tab = ForgeStateManager.FEATURE_TAB_MAP[ft];
        if (tab) tabs.add(tab);
      }
    }
    return tabs;
  }

  async loadFeaturePurchases(
    simulationId: string,
    featureType: string,
  ): Promise<FeaturePurchase[]> {
    const resp = await forgeApi.listFeaturePurchases(simulationId, featureType);
    if (resp.success && resp.data) {
      const map = new Map(this.featurePurchases.value);
      map.set(`${simulationId}:${featureType}`, resp.data);
      this.featurePurchases.value = map;
      return resp.data;
    }
    return [];
  }

  hasCompletedPurchase(simulationId: string, featureType: string): boolean {
    const key = `${simulationId}:${featureType}`;
    const purchases = this.featurePurchases.value.get(key);
    return purchases?.some((p) => p.status === 'completed') ?? false;
  }

  async awaitFeatureCompletion(
    purchaseId: string,
    onProgress?: (p: FeaturePurchase) => void,
  ): Promise<FeaturePurchase | null> {
    const MAX_POLLS = 90; // 3 minutes at 2s interval
    for (let i = 0; i < MAX_POLLS; i++) {
      const purchase = await this.pollFeaturePurchase(purchaseId);
      if (!purchase) return null;
      onProgress?.(purchase);
      if (purchase.status !== 'processing' && purchase.status !== 'pending') {
        // Update featurePurchases signal so badges react immediately
        void this.loadFeaturePurchases(purchase.simulation_id, purchase.feature_type);
        return purchase;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }

  async purchaseFeature(
    simulationId: string,
    featureType: 'darkroom_pass' | 'classified_dossier' | 'recruitment' | 'chronicle_export',
    options?: { focus?: string; zoneId?: string; exportType?: 'codex' | 'hires' },
  ): Promise<string | null> {
    this.error.value = null;
    try {
      let resp: { success: boolean; data?: { purchase_id: string }; error?: { message?: string } };

      switch (featureType) {
        case 'darkroom_pass':
          resp = await forgeApi.purchaseDarkroom(simulationId);
          break;
        case 'classified_dossier':
          resp = await forgeApi.purchaseDossier(simulationId);
          break;
        case 'recruitment':
          resp = await forgeApi.purchaseRecruitment(simulationId, options?.focus, options?.zoneId);
          break;
        case 'chronicle_export':
          if (options?.exportType === 'hires') {
            resp = await forgeApi.purchaseHiresArchive(simulationId);
          } else {
            resp = await forgeApi.purchaseChronicle(simulationId);
          }
          break;
      }

      if (resp.success && resp.data?.purchase_id) {
        // Refresh wallet balance after purchase
        void this.loadWallet();
        return resp.data.purchase_id;
      }
      this.error.value = resp.error?.message ?? 'Feature purchase failed';
      return null;
    } catch (err) {
      this.error.value = err instanceof Error ? err.message : 'Feature purchase failed';
      return null;
    }
  }

  async pollFeaturePurchase(purchaseId: string): Promise<FeaturePurchase | null> {
    try {
      const resp = await forgeApi.getFeaturePurchase(purchaseId);
      if (resp.success && resp.data) {
        return resp.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  // --- Image Generation Tracking Methods ---

  private _imageTrackingTimer: ReturnType<typeof setInterval> | null = null;
  private _imageTrackingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private _imageTrackingStart = 0;
  private _prevCompleted = -1;

  startImageTracking(slug: string): void {
    this.stopImageTracking();
    this.imageTrackingSlug.value = slug;
    this.imageProgress.value = null;
    this.imageUpdateVersion.value = 0;
    this._prevCompleted = -1;
    this._imageTrackingStart = Date.now();

    const poll = async () => {
      try {
        const resp = await forgeApi.getForgeProgress(slug);
        if (!resp.success || !resp.data) return;
        this.imageProgress.value = resp.data;

        // Detect new images arriving
        if (this._prevCompleted >= 0 && resp.data.completed > this._prevCompleted) {
          this.imageUpdateVersion.value++;
        }
        this._prevCompleted = resp.data.completed;

        // Stop when all done
        if (resp.data.done) {
          // Final bump so views pick up the last images
          this.imageUpdateVersion.value++;
          this._imageTrackingStopTimer = setTimeout(() => this.stopImageTracking(), 2000);
          return;
        }

        // Safety timeout: 5 minutes
        if (Date.now() - this._imageTrackingStart > 5 * 60 * 1000) {
          this.stopImageTracking();
        }
      } catch {
        // Best-effort polling — ignore transient errors
      }
    };

    // Initial poll immediately, then every 5s
    void poll();
    this._imageTrackingTimer = setInterval(poll, 5000);
  }

  stopImageTracking(): void {
    if (this._imageTrackingStopTimer) {
      clearTimeout(this._imageTrackingStopTimer);
      this._imageTrackingStopTimer = null;
    }
    if (this._imageTrackingTimer) {
      clearInterval(this._imageTrackingTimer);
      this._imageTrackingTimer = null;
    }
    this.imageTrackingSlug.value = null;
    this.imageProgress.value = null;
  }

  // --- Timeout Recovery Helpers ---

  private _snapshotCounts() {
    const d = this.draft.value;
    return {
      agents: d?.agents.length ?? 0,
      buildings: d?.buildings.length ?? 0,
      hasGeography: Object.keys(d?.geography ?? {}).length > 0,
    };
  }

  /**
   * Sync newly generated entities into staging for review.
   * Deduplicates the staging logic between happy path and recovery path.
   */
  private _syncStagingAfterGeneration(chunkType: 'geography' | 'agents' | 'buildings'): void {
    if (!this.draft.value) return;
    if (chunkType === 'agents') {
      this.stagedAgents.value = [...this.draft.value.agents];
    } else if (chunkType === 'buildings') {
      this.stagedBuildings.value = [...this.draft.value.buildings];
    }
  }

  /**
   * Attempt to recover from a generation timeout/network error.
   * The backend may have completed and saved data even though the HTTP response
   * was lost (e.g. Railway proxy timeout). Re-fetches the draft and compares
   * entity counts against the pre-generation snapshot.
   */
  private async _tryRecoverChunk(
    draftId: string,
    chunkType: 'geography' | 'agents' | 'buildings',
    snapshot: { agents: number; buildings: number; hasGeography: boolean },
  ): Promise<boolean> {
    // Retry up to 4 times with increasing delays (5s, 10s, 15s, 20s).
    // Railway proxy may kill the connection at ~120s while the backend is still
    // generating. The backend typically finishes within 30–60s after the timeout,
    // so retrying gives it time to persist results.
    const delays = [5_000, 10_000, 15_000, 20_000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }
      try {
        await this.loadDraft(draftId);
      } catch {
        continue;
      }
      if (!this.draft.value) continue;

      const newAgents = this.draft.value.agents.length;
      const newBuildings = this.draft.value.buildings.length;
      const newHasGeo = Object.keys(this.draft.value.geography).length > 0;

      let recovered = false;
      if (chunkType === 'agents' && newAgents > snapshot.agents) recovered = true;
      if (chunkType === 'buildings' && newBuildings > snapshot.buildings) recovered = true;
      if (chunkType === 'geography' && newHasGeo && !snapshot.hasGeography) recovered = true;

      if (recovered) {
        this.error.value = null;
        this._syncStagingAfterGeneration(chunkType);
        return true;
      }
    }
    return false;
  }

  /**
   * Attempt to recover from a research timeout/network error.
   * Re-fetches the draft and checks if new anchors appeared.
   */
  private async _tryRecoverResearch(
    draftId: string,
    anchorsBefore: number,
  ): Promise<boolean> {
    const delays = [5_000, 10_000, 15_000, 20_000];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }
      try {
        await this.loadDraft(draftId);
      } catch {
        continue;
      }
      if (!this.draft.value) continue;

      const anchorsAfter = this.draft.value.philosophical_anchor?.options?.length ?? 0;
      if (anchorsAfter > anchorsBefore) {
        this.error.value = null;
        return true;
      }
    }
    return false;
  }

  // --- Generation Timing Methods ---

  /**
   * Returns rolling average duration (ms) from localStorage for a generation type.
   * Falls back to hardcoded defaults when no history exists.
   */
  getEstimatedDuration(type: string): number {
    try {
      const raw = localStorage.getItem(TIMING_STORAGE_KEY);
      if (!raw) return DEFAULT_ESTIMATES[type] ?? 60_000;
      const records: TimingRecord[] = JSON.parse(raw);
      const matching = records
        .filter((r) => r.type === type)
        .slice(-TIMING_AVERAGE_WINDOW);
      if (matching.length === 0) return DEFAULT_ESTIMATES[type] ?? 60_000;
      const sum = matching.reduce((acc, r) => acc + r.durationMs, 0);
      return Math.round(sum / matching.length);
    } catch {
      return DEFAULT_ESTIMATES[type] ?? 60_000;
    }
  }

  /**
   * Records a generation timing to localStorage for future ETA estimates.
   * Caps at MAX_TIMING_RECORDS entries, evicting oldest first.
   */
  private _recordTiming(type: string, durationMs: number): void {
    try {
      const raw = localStorage.getItem(TIMING_STORAGE_KEY);
      const records: TimingRecord[] = raw ? JSON.parse(raw) : [];
      records.push({ type, durationMs, timestamp: Date.now() });
      // Evict oldest entries beyond cap
      while (records.length > MAX_TIMING_RECORDS) {
        records.shift();
      }
      localStorage.setItem(TIMING_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Private browsing or quota exceeded — silently ignore
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
    this.generationStartedAt.value = null;
    this.lastGenerationRecovered.value = false;
    this.stagedAgents.value = [];
    this.stagedBuildings.value = [];
    this.generationConfig.value = { ...DEFAULT_GENERATION_CONFIG };
    this.featurePurchases.value = new Map();
    this.stopImageTracking();
  }
}

export const forgeStateManager = new ForgeStateManager();
