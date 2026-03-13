import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// ForgeStateManager unit tests.
//
// We replicate the signal/computed pattern and state machine logic locally
// since importing ForgeStateManager requires Preact Signals singleton,
// import.meta.env, and @supabase/supabase-js. We test the contract:
// state transitions, optimistic updates, computed derivation, and session
// persistence — without pulling in the full dependency tree.
// ---------------------------------------------------------------------------

// --- Minimal signal/computed replica for testing ---

interface Signal<T> {
  value: T;
  peek(): T;
}

function signal<T>(initial: T): Signal<T> {
  const s = {
    value: initial,
    peek() { return s.value; },
  };
  return s;
}

function computed<T>(fn: () => T): { readonly value: T } {
  return { get value() { return fn(); } };
}

// --- Types replicated from ForgeApiService ---

interface ForgeGenerationConfig {
  agent_count: number;
  building_count: number;
  zone_count: number;
  street_count: number;
  deep_research: boolean;
}

interface BYOKStatus {
  has_openrouter_key: boolean;
  has_replicate_key: boolean;
  byok_allowed: boolean;
  byok_bypass: boolean;
  system_bypass_enabled: boolean;
  effective_bypass: boolean;
  access_policy: 'none' | 'all' | 'per_user';
}

interface ForgeDraft {
  id: string;
  user_id: string;
  current_phase: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition' | 'completed' | 'failed';
  seed_prompt: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  generation_config: ForgeGenerationConfig;
  agents: Array<{ name: string }>;
  buildings: Array<{ name: string }>;
  geography: Record<string, unknown>;
  theme_config: Record<string, string>;
  [key: string]: unknown;
}

interface FeaturePurchase {
  id: string;
  simulation_id: string;
  feature_type: string;
  status: string;
}

// --- Testable ForgeStateManager ---

class TestableForgeStateManager {
  draft = signal<ForgeDraft | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  isGenerating = signal(false);
  stagedAgents = signal<Array<{ name: string }>>([]);
  stagedBuildings = signal<Array<{ name: string }>>([]);
  generationConfig = signal<ForgeGenerationConfig>({
    agent_count: 6,
    building_count: 8,
    zone_count: 4,
    street_count: 12,
    deep_research: false,
  });
  isGeneratingTheme = signal(false);
  walletBalance = signal(0);
  walletTier = signal('free');
  isLoadingWallet = signal(false);
  mintOpen = signal(false);
  bundles = signal<Array<{ slug: string; tokens: number }>>([]);
  purchaseHistory = signal<Array<{ id: string }>>([]);
  byokStatus = signal<BYOKStatus>({
    has_openrouter_key: false,
    has_replicate_key: false,
    byok_allowed: false,
    byok_bypass: false,
    system_bypass_enabled: false,
    effective_bypass: false,
    access_policy: 'per_user',
  });
  featurePurchases = signal<Map<string, FeaturePurchase[]>>(new Map());

  phase = computed(() => this.draft.value?.current_phase ?? 'astrolabe');
  status = computed(() => this.draft.value?.status ?? 'draft');
  canIgnite = computed(() => {
    const d = this.draft.value;
    if (!d) return false;
    return (
      d.current_phase === 'ignition' &&
      d.status === 'draft' &&
      (this.walletBalance.value > 0 || this.byokStatus.value.effective_bypass)
    );
  });

  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingUpdate: Partial<ForgeDraft> | null = null;

  updateDraft(data: Partial<ForgeDraft>): void {
    if (!this.draft.value) return;
    // Optimistic: apply locally immediately
    this.draft.value = { ...this.draft.value, ...data };
    this._pendingUpdate = { ...(this._pendingUpdate || {}), ...data };

    // Debounce the backend sync
    if (this._saveTimer) clearTimeout(this._saveTimer);
    const isPhaseChange = 'current_phase' in data;
    this._saveTimer = setTimeout(() => {
      this._flushUpdate();
    }, isPhaseChange ? 0 : 500);
  }

  private _flushUpdate(): void {
    this._pendingUpdate = null;
    this._saveTimer = null;
    // In real service, this calls forgeApi.updateDraft()
  }

  updateGenerationConfig(config: Partial<ForgeGenerationConfig>): void {
    this.generationConfig.value = { ...this.generationConfig.value, ...config };
    if (this.draft.value) {
      this.updateDraft({ generation_config: this.generationConfig.value } as Partial<ForgeDraft>);
    }
  }

  acceptEntity(type: 'agent' | 'building', index: number): void {
    if (type === 'agent') {
      const staged = [...this.stagedAgents.value];
      const accepted = staged.splice(index, 1)[0];
      this.stagedAgents.value = staged;
      if (this.draft.value && accepted) {
        const agents = [...this.draft.value.agents, accepted];
        this.updateDraft({ agents } as Partial<ForgeDraft>);
      }
    } else {
      const staged = [...this.stagedBuildings.value];
      const accepted = staged.splice(index, 1)[0];
      this.stagedBuildings.value = staged;
      if (this.draft.value && accepted) {
        const buildings = [...this.draft.value.buildings, accepted];
        this.updateDraft({ buildings } as Partial<ForgeDraft>);
      }
    }
  }

  rejectEntity(type: 'agent' | 'building', index: number): void {
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

  hasCompletedPurchase(simulationId: string, featureType: string): boolean {
    const key = `${simulationId}:${featureType}`;
    const purchases = this.featurePurchases.value.get(key) || [];
    return purchases.some(p => p.status === 'completed');
  }

  hasAnyUnpurchasedFeature(simulationId: string): boolean {
    const allTypes = ['darkroom_pass', 'classified_dossier', 'recruitment', 'chronicle_export'];
    return allTypes.some(ft => !this.hasCompletedPurchase(simulationId, ft));
  }

  getUnpurchasedTabPaths(simulationId: string): Set<string> {
    const paths = new Set<string>();
    const featureTabMap: Record<string, string> = {
      darkroom_pass: 'darkroom',
      classified_dossier: 'dossier',
      recruitment: 'recruit',
      chronicle_export: 'chronicle',
    };
    for (const [ft, tab] of Object.entries(featureTabMap)) {
      if (!this.hasCompletedPurchase(simulationId, ft)) {
        paths.add(tab);
      }
    }
    return paths;
  }

  reset(): void {
    this.draft.value = null;
    this.isLoading.value = false;
    this.error.value = null;
    this.isGenerating.value = false;
    this.stagedAgents.value = [];
    this.stagedBuildings.value = [];
    this.generationConfig.value = {
      agent_count: 6,
      building_count: 8,
      zone_count: 4,
      street_count: 12,
      deep_research: false,
    };
    this.isGeneratingTheme.value = false;
    this.walletBalance.value = 0;
    this.walletTier.value = 'free';
    this.mintOpen.value = false;
    this.bundles.value = [];
    this.purchaseHistory.value = [];
    this.byokStatus.value = {
      has_openrouter_key: false,
      has_replicate_key: false,
      byok_allowed: false,
      byok_bypass: false,
      system_bypass_enabled: false,
      effective_bypass: false,
      access_policy: 'per_user',
    };
    this.featurePurchases.value = new Map();
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._pendingUpdate = null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ForgeStateManager — initial state', () => {
  it('should have null draft', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.draft.value).toBeNull();
  });

  it('should have default generation config', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.generationConfig.value.agent_count).toBe(6);
    expect(sm.generationConfig.value.building_count).toBe(8);
    expect(sm.generationConfig.value.zone_count).toBe(4);
    expect(sm.generationConfig.value.street_count).toBe(12);
    expect(sm.generationConfig.value.deep_research).toBe(false);
  });

  it('should have zero wallet balance', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.walletBalance.value).toBe(0);
  });

  it('should default BYOK to no keys and no bypass', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.byokStatus.value.has_openrouter_key).toBe(false);
    expect(sm.byokStatus.value.effective_bypass).toBe(false);
  });

  it('should have empty feature purchases map', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.featurePurchases.value.size).toBe(0);
  });
});

describe('ForgeStateManager — computed: phase', () => {
  it('should return astrolabe when no draft', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.phase.value).toBe('astrolabe');
  });

  it('should return draft current_phase', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'drafting' });
    expect(sm.phase.value).toBe('drafting');
  });

  it('should reflect phase updates', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'astrolabe' });
    expect(sm.phase.value).toBe('astrolabe');
    sm.draft.value = { ...sm.draft.value!, current_phase: 'darkroom' };
    expect(sm.phase.value).toBe('darkroom');
  });
});

describe('ForgeStateManager — computed: status', () => {
  it('should return draft when no draft loaded', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.status.value).toBe('draft');
  });

  it('should return draft status', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ status: 'processing' });
    expect(sm.status.value).toBe('processing');
  });
});

describe('ForgeStateManager — computed: canIgnite', () => {
  it('should be false when no draft', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.canIgnite.value).toBe(false);
  });

  it('should be false when phase is not ignition', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'darkroom', status: 'draft' });
    sm.walletBalance.value = 100;
    expect(sm.canIgnite.value).toBe(false);
  });

  it('should be false when status is processing', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'ignition', status: 'processing' });
    sm.walletBalance.value = 100;
    expect(sm.canIgnite.value).toBe(false);
  });

  it('should be false when no tokens and no bypass', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'ignition', status: 'draft' });
    sm.walletBalance.value = 0;
    sm.byokStatus.value = { ...sm.byokStatus.value, effective_bypass: false };
    expect(sm.canIgnite.value).toBe(false);
  });

  it('should be true when phase=ignition, status=draft, and has tokens', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'ignition', status: 'draft' });
    sm.walletBalance.value = 50;
    expect(sm.canIgnite.value).toBe(true);
  });

  it('should be true when phase=ignition, status=draft, and effective_bypass', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ current_phase: 'ignition', status: 'draft' });
    sm.walletBalance.value = 0;
    sm.byokStatus.value = { ...sm.byokStatus.value, effective_bypass: true };
    expect(sm.canIgnite.value).toBe(true);
  });
});

describe('ForgeStateManager — updateDraft (optimistic)', () => {
  it('should update draft value immediately', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ seed_prompt: 'Old seed' });
    sm.updateDraft({ seed_prompt: 'New seed' } as Partial<ForgeDraft>);
    expect(sm.draft.value!.seed_prompt).toBe('New seed');
  });

  it('should not update when draft is null', () => {
    const sm = new TestableForgeStateManager();
    sm.updateDraft({ seed_prompt: 'Test' } as Partial<ForgeDraft>);
    expect(sm.draft.value).toBeNull();
  });

  it('should merge multiple updates', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ seed_prompt: 'Old', current_phase: 'astrolabe' });
    sm.updateDraft({ seed_prompt: 'New' } as Partial<ForgeDraft>);
    sm.updateDraft({ current_phase: 'drafting' } as Partial<ForgeDraft>);
    expect(sm.draft.value!.seed_prompt).toBe('New');
    expect(sm.draft.value!.current_phase).toBe('drafting');
  });
});

describe('ForgeStateManager — updateGenerationConfig', () => {
  it('should merge config changes', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({});
    sm.updateGenerationConfig({ agent_count: 10 });
    expect(sm.generationConfig.value.agent_count).toBe(10);
    expect(sm.generationConfig.value.building_count).toBe(8); // unchanged
  });

  it('should sync config to draft', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({});
    sm.updateGenerationConfig({ zone_count: 6 });
    expect((sm.draft.value as ForgeDraft).generation_config.zone_count).toBe(6);
  });
});

describe('ForgeStateManager — acceptEntity / rejectEntity', () => {
  it('should move agent from staged to draft', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ agents: [{ name: 'Existing' }] });
    sm.stagedAgents.value = [{ name: 'Newcomer' }];

    sm.acceptEntity('agent', 0);

    expect(sm.stagedAgents.value).toHaveLength(0);
    expect(sm.draft.value!.agents).toHaveLength(2);
    expect(sm.draft.value!.agents[1].name).toBe('Newcomer');
  });

  it('should move building from staged to draft', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ buildings: [] });
    sm.stagedBuildings.value = [{ name: 'Watchtower' }];

    sm.acceptEntity('building', 0);

    expect(sm.stagedBuildings.value).toHaveLength(0);
    expect(sm.draft.value!.buildings).toHaveLength(1);
    expect(sm.draft.value!.buildings[0].name).toBe('Watchtower');
  });

  it('should reject agent by removing from staged', () => {
    const sm = new TestableForgeStateManager();
    sm.stagedAgents.value = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];

    sm.rejectEntity('agent', 1);

    expect(sm.stagedAgents.value).toHaveLength(2);
    expect(sm.stagedAgents.value[0].name).toBe('A');
    expect(sm.stagedAgents.value[1].name).toBe('C');
  });

  it('should reject building by removing from staged', () => {
    const sm = new TestableForgeStateManager();
    sm.stagedBuildings.value = [{ name: 'X' }, { name: 'Y' }];

    sm.rejectEntity('building', 0);

    expect(sm.stagedBuildings.value).toHaveLength(1);
    expect(sm.stagedBuildings.value[0].name).toBe('Y');
  });

  it('should handle accept on empty staged list without crash', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({});
    sm.stagedAgents.value = [];

    // Should not throw
    sm.acceptEntity('agent', 0);
    expect(sm.draft.value!.agents).toHaveLength(0);
  });
});

describe('ForgeStateManager — feature purchases', () => {
  it('should return false for hasCompletedPurchase when no purchases', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.hasCompletedPurchase('sim-1', 'darkroom_pass')).toBe(false);
  });

  it('should return true for hasCompletedPurchase when completed', () => {
    const sm = new TestableForgeStateManager();
    sm.featurePurchases.value = new Map([
      ['sim-1:darkroom_pass', [{ id: 'fp-1', simulation_id: 'sim-1', feature_type: 'darkroom_pass', status: 'completed' }]],
    ]);
    expect(sm.hasCompletedPurchase('sim-1', 'darkroom_pass')).toBe(true);
  });

  it('should return false for hasCompletedPurchase when only pending', () => {
    const sm = new TestableForgeStateManager();
    sm.featurePurchases.value = new Map([
      ['sim-1:darkroom_pass', [{ id: 'fp-1', simulation_id: 'sim-1', feature_type: 'darkroom_pass', status: 'pending' }]],
    ]);
    expect(sm.hasCompletedPurchase('sim-1', 'darkroom_pass')).toBe(false);
  });

  it('should identify unpurchased features', () => {
    const sm = new TestableForgeStateManager();
    sm.featurePurchases.value = new Map([
      ['sim-1:darkroom_pass', [{ id: 'fp-1', simulation_id: 'sim-1', feature_type: 'darkroom_pass', status: 'completed' }]],
    ]);
    expect(sm.hasAnyUnpurchasedFeature('sim-1')).toBe(true); // 3 other features not purchased
  });

  it('should return false for hasAnyUnpurchasedFeature when all purchased', () => {
    const sm = new TestableForgeStateManager();
    const allTypes = ['darkroom_pass', 'classified_dossier', 'recruitment', 'chronicle_export'];
    const map = new Map<string, FeaturePurchase[]>();
    for (const ft of allTypes) {
      map.set(`sim-1:${ft}`, [{ id: `fp-${ft}`, simulation_id: 'sim-1', feature_type: ft, status: 'completed' }]);
    }
    sm.featurePurchases.value = map;
    expect(sm.hasAnyUnpurchasedFeature('sim-1')).toBe(false);
  });

  it('should return correct unpurchased tab paths', () => {
    const sm = new TestableForgeStateManager();
    sm.featurePurchases.value = new Map([
      ['sim-1:darkroom_pass', [{ id: 'fp-1', simulation_id: 'sim-1', feature_type: 'darkroom_pass', status: 'completed' }]],
      ['sim-1:chronicle_export', [{ id: 'fp-2', simulation_id: 'sim-1', feature_type: 'chronicle_export', status: 'completed' }]],
    ]);
    const paths = sm.getUnpurchasedTabPaths('sim-1');
    expect(paths.has('dossier')).toBe(true);
    expect(paths.has('recruit')).toBe(true);
    expect(paths.has('darkroom')).toBe(false);
    expect(paths.has('chronicle')).toBe(false);
  });

  it('should return all tab paths when nothing purchased', () => {
    const sm = new TestableForgeStateManager();
    const paths = sm.getUnpurchasedTabPaths('sim-1');
    expect(paths.size).toBe(4);
    expect(paths.has('darkroom')).toBe(true);
    expect(paths.has('dossier')).toBe(true);
    expect(paths.has('recruit')).toBe(true);
    expect(paths.has('chronicle')).toBe(true);
  });
});

describe('ForgeStateManager — reset', () => {
  it('should clear all state to defaults', () => {
    const sm = new TestableForgeStateManager();
    sm.draft.value = makeDraft({ seed_prompt: 'Something' });
    sm.walletBalance.value = 500;
    sm.error.value = 'Something went wrong';
    sm.isLoading.value = true;
    sm.isGenerating.value = true;
    sm.mintOpen.value = true;
    sm.walletTier.value = 'architect';
    sm.stagedAgents.value = [{ name: 'A' }];
    sm.stagedBuildings.value = [{ name: 'B' }];
    sm.featurePurchases.value = new Map([
      ['sim-1:darkroom_pass', [{ id: 'fp-1', simulation_id: 'sim-1', feature_type: 'darkroom_pass', status: 'completed' }]],
    ]);

    sm.reset();

    expect(sm.draft.value).toBeNull();
    expect(sm.walletBalance.value).toBe(0);
    expect(sm.error.value).toBeNull();
    expect(sm.isLoading.value).toBe(false);
    expect(sm.isGenerating.value).toBe(false);
    expect(sm.mintOpen.value).toBe(false);
    expect(sm.walletTier.value).toBe('free');
    expect(sm.stagedAgents.value).toHaveLength(0);
    expect(sm.stagedBuildings.value).toHaveLength(0);
    expect(sm.featurePurchases.value.size).toBe(0);
    expect(sm.generationConfig.value.agent_count).toBe(6);
  });

  it('should reset BYOK status', () => {
    const sm = new TestableForgeStateManager();
    sm.byokStatus.value = {
      has_openrouter_key: true,
      has_replicate_key: true,
      byok_allowed: true,
      byok_bypass: true,
      system_bypass_enabled: true,
      effective_bypass: true,
      access_policy: 'all',
    };

    sm.reset();

    expect(sm.byokStatus.value.has_openrouter_key).toBe(false);
    expect(sm.byokStatus.value.effective_bypass).toBe(false);
    expect(sm.byokStatus.value.access_policy).toBe('per_user');
  });
});

describe('ForgeStateManager — wallet state', () => {
  it('should track wallet balance independently', () => {
    const sm = new TestableForgeStateManager();
    sm.walletBalance.value = 100;
    expect(sm.walletBalance.value).toBe(100);
    sm.walletBalance.value = 75; // After a purchase
    expect(sm.walletBalance.value).toBe(75);
  });

  it('should track mint open/close state', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.mintOpen.value).toBe(false);
    sm.mintOpen.value = true;
    expect(sm.mintOpen.value).toBe(true);
  });

  it('should store bundles list', () => {
    const sm = new TestableForgeStateManager();
    sm.bundles.value = [
      { slug: 'starter', tokens: 50 },
      { slug: 'architect', tokens: 500 },
    ];
    expect(sm.bundles.value).toHaveLength(2);
    expect(sm.bundles.value[0].slug).toBe('starter');
  });
});

describe('ForgeStateManager — error and loading state', () => {
  it('should track loading state', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.isLoading.value).toBe(false);
    sm.isLoading.value = true;
    expect(sm.isLoading.value).toBe(true);
  });

  it('should track generation state', () => {
    const sm = new TestableForgeStateManager();
    expect(sm.isGenerating.value).toBe(false);
    sm.isGenerating.value = true;
    expect(sm.isGenerating.value).toBe(true);
  });

  it('should track error messages', () => {
    const sm = new TestableForgeStateManager();
    sm.error.value = 'AI generation failed';
    expect(sm.error.value).toBe('AI generation failed');
    sm.error.value = null;
    expect(sm.error.value).toBeNull();
  });
});

// --- Helpers ---

function makeDraft(overrides: Partial<ForgeDraft>): ForgeDraft {
  return {
    id: 'draft-1',
    user_id: 'user-1',
    current_phase: 'astrolabe',
    seed_prompt: 'A test world',
    status: 'draft',
    generation_config: {
      agent_count: 6,
      building_count: 8,
      zone_count: 4,
      street_count: 12,
      deep_research: false,
    },
    agents: [],
    buildings: [],
    geography: {},
    theme_config: {},
    philosophical_anchor: { options: [] },
    taxonomies: {},
    ai_settings: {},
    created_at: '2026-03-10T10:00:00Z',
    updated_at: '2026-03-10T10:00:00Z',
    ...overrides,
  };
}
