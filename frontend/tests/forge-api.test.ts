import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, mockFetchNetworkError, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// Testable service replicating BaseApiService contract for ForgeApiService.
// See api-services.test.ts header comment for rationale.
// ---------------------------------------------------------------------------

class TestableBaseApiService {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl = '/api/v1', token: string | null = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`, 'http://localhost');
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    try {
      const url = this.buildUrl(path, params);
      const headers = this.getHeaders();
      const options: RequestInit = { method, headers };
      if (body !== undefined && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      const json = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: {
            code: json.code || `HTTP_${response.status}`,
            message: json.message || json.detail || response.statusText,
          },
        };
      }
      return {
        success: true,
        data: json.data !== undefined ? json.data : json,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message },
      };
    }
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('GET', path, undefined, params);
  }

  getPublic<T>(path: string, params?: Record<string, string>) {
    const noAuthHeaders = { 'Content-Type': 'application/json' };
    return this.request<T>('GET', `/public${path}`, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

// ---------------------------------------------------------------------------
// ForgeApiService — Draft Management
// ---------------------------------------------------------------------------

describe('ForgeApiService — listDrafts', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/drafts', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/drafts');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts');
    expect(init.method).toBe('GET');
  });

  it('should pass pagination params', async () => {
    const spy = mockFetch([{ body: { data: [], meta: { count: 0, total: 0 } } }]);
    await service.get('/forge/drafts', { limit: '10', offset: '0' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=0');
  });

  it('should include Authorization header', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/drafts');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});

describe('ForgeApiService — createDraft', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/drafts with seed_prompt', async () => {
    const spy = mockFetch([{ body: { data: { id: 'draft-1' } } }]);
    await service.post('/forge/drafts', { seed_prompt: 'A world of glass towers' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ seed_prompt: 'A world of glass towers' });
  });

  it('should return created draft', async () => {
    const draft = { id: 'draft-1', seed_prompt: 'A world of glass towers', current_phase: 'astrolabe' };
    mockFetch([{ body: { data: draft } }]);
    const result = await service.post('/forge/drafts', { seed_prompt: 'A world of glass towers' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(draft);
  });
});

describe('ForgeApiService — getDraft', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/drafts/{id}', async () => {
    const spy = mockFetch([{ body: { data: { id: 'draft-1' } } }]);
    await service.get('/forge/drafts/draft-1');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1');
  });

  it('should handle 404 for missing draft', async () => {
    mockFetch([{ status: 404, body: { code: 'NOT_FOUND', message: 'Draft not found' } }]);
    const result = await service.get('/forge/drafts/nonexistent');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('ForgeApiService — updateDraft', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PATCH /forge/drafts/{id} with body', async () => {
    const body = { current_phase: 'drafting', seed_prompt: 'Updated seed' };
    const spy = mockFetch([{ body: { data: { id: 'draft-1', ...body } } }]);
    await service.patch('/forge/drafts/draft-1', body);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('should handle 422 for invalid phase transition', async () => {
    mockFetch([{ status: 422, body: { detail: "Cannot transition from 'astrolabe' to 'ignition'." } }]);
    const result = await service.patch('/forge/drafts/draft-1', { current_phase: 'ignition' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_422');
  });
});

describe('ForgeApiService — deleteDraft', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call DELETE /forge/drafts/{id}', async () => {
    const spy = mockFetch([{ body: { data: { message: 'Draft deleted.' } } }]);
    await service.delete('/forge/drafts/draft-1');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1');
    expect(init.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Research & Generation
// ---------------------------------------------------------------------------

describe('ForgeApiService — runResearch', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/drafts/{id}/research', async () => {
    const spy = mockFetch([{ body: { data: { anchors: [] } } }]);
    await service.post('/forge/drafts/draft-1/research');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/research');
    expect(init.method).toBe('POST');
  });

  it('should return anchors array', async () => {
    const anchors = [
      { title: 'The Panopticon', literary_influence: 'Foucault', core_question: 'Who watches?', description: 'A world under surveillance' },
    ];
    mockFetch([{ body: { data: { anchors } } }]);
    const result = await service.post('/forge/drafts/draft-1/research');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ anchors });
  });
});

describe('ForgeApiService — generateChunk', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/drafts/{id}/generate/geography', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/drafts/draft-1/generate/geography');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/generate/geography');
    expect(init.method).toBe('POST');
  });

  it('should call POST /forge/drafts/{id}/generate/agents', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/drafts/draft-1/generate/agents');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/generate/agents');
  });

  it('should call POST /forge/drafts/{id}/generate/buildings', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/drafts/draft-1/generate/buildings');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/generate/buildings');
  });
});

describe('ForgeApiService — generateTheme', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/drafts/{id}/generate-theme', async () => {
    const spy = mockFetch([{ body: { data: { color_primary: '#e74c3c' } } }]);
    await service.post('/forge/drafts/draft-1/generate-theme');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/generate-theme');
    expect(init.method).toBe('POST');
  });

  it('should return theme config', async () => {
    const theme = { color_primary: '#e74c3c', color_background: '#0a0a0a', font_heading: 'Oswald' };
    mockFetch([{ body: { data: theme } }]);
    const result = await service.post('/forge/drafts/draft-1/generate-theme');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(theme);
  });
});

describe('ForgeApiService — ignite', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/drafts/{id}/ignite', async () => {
    const spy = mockFetch([{ body: { data: { simulation_id: 'sim-1', slug: 'my-world' } } }]);
    await service.post('/forge/drafts/draft-1/ignite');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/drafts/draft-1/ignite');
    expect(init.method).toBe('POST');
  });

  it('should return simulation_id and slug', async () => {
    const igniteResult = { simulation_id: 'sim-1', slug: 'my-world', name: 'My World' };
    mockFetch([{ body: { data: igniteResult } }]);
    const result = await service.post('/forge/drafts/draft-1/ignite');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(igniteResult);
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Lore & Progress (public routes)
// ---------------------------------------------------------------------------

describe('ForgeApiService — getSimulationLore', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', null);
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /public/simulations/{simId}/lore', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.getPublic('/simulations/sim-1/lore');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/sim-1/lore');
    expect(init.method).toBe('GET');
  });

  it('should return lore sections', async () => {
    const sections = [
      { id: 'l-1', chapter: 'I', arcanum: 'I', title: 'Gateway', body: 'The world begins...' },
    ];
    mockFetch([{ body: { data: sections } }]);
    const result = await service.getPublic('/simulations/sim-1/lore');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(sections);
  });
});

describe('ForgeApiService — getForgeProgress', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', null);
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /public/simulations/by-slug/{slug}/forge-progress', async () => {
    const spy = mockFetch([{ body: { data: { total: 10, completed: 3, done: false } } }]);
    await service.getPublic('/simulations/by-slug/my-world/forge-progress');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/by-slug/my-world/forge-progress');
  });

  it('should return progress data', async () => {
    const progress = { total: 10, completed: 10, done: true, agents: [], buildings: [] };
    mockFetch([{ body: { data: progress } }]);
    const result = await service.getPublic('/simulations/by-slug/my-world/forge-progress');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(progress);
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Wallet / Token Economy
// ---------------------------------------------------------------------------

describe('ForgeApiService — getWallet', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/wallet', async () => {
    const spy = mockFetch([{ body: { data: { forge_tokens: 100, is_architect: true } } }]);
    await service.get('/forge/wallet');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/wallet');
  });

  it('should return wallet data with BYOK status', async () => {
    const wallet = {
      forge_tokens: 250,
      is_architect: true,
      account_tier: 'architect',
      byok_status: {
        has_openrouter_key: true,
        has_replicate_key: false,
        byok_allowed: true,
        byok_bypass: false,
        system_bypass_enabled: false,
        effective_bypass: false,
        access_policy: 'per_user',
      },
    };
    mockFetch([{ body: { data: wallet } }]);
    const result = await service.get('/forge/wallet');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(wallet);
  });
});

describe('ForgeApiService — listBundles', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/bundles', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/bundles');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/bundles');
  });

  it('should return bundle list', async () => {
    const bundles = [
      { id: 'b-1', slug: 'starter', display_name: 'Starter Pack', tokens: 50, price_cents: 0, savings_pct: 0, sort_order: 1 },
      { id: 'b-2', slug: 'architect', display_name: 'Architect Bundle', tokens: 500, price_cents: 999, savings_pct: 20, sort_order: 2 },
    ];
    mockFetch([{ body: { data: bundles } }]);
    const result = await service.get('/forge/bundles');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });
});

describe('ForgeApiService — purchaseBundle', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/wallet/purchase with bundle_slug', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'p-1', tokens_granted: 50 } } }]);
    await service.post('/forge/wallet/purchase', { bundle_slug: 'starter' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/wallet/purchase');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ bundle_slug: 'starter' });
  });

  it('should return purchase receipt', async () => {
    const receipt = {
      purchase_id: 'p-1',
      bundle_slug: 'starter',
      tokens_granted: 50,
      balance_before: 0,
      balance_after: 50,
      price_cents: 0,
    };
    mockFetch([{ body: { data: receipt } }]);
    const result = await service.post('/forge/wallet/purchase', { bundle_slug: 'starter' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(receipt);
  });
});

describe('ForgeApiService — getPurchaseHistory', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/wallet/history with pagination', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/wallet/history?limit=20&offset=0');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/wallet/history');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');
  });
});

describe('ForgeApiService — updateBYOK', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/wallet/keys with key data', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.put('/forge/wallet/keys', { openrouter_key: 'sk-or-v1-abc', replicate_key: null });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/wallet/keys');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ openrouter_key: 'sk-or-v1-abc', replicate_key: null });
  });

  it('should handle 403 when BYOK not allowed', async () => {
    mockFetch([{ status: 403, body: { detail: 'BYOK access not granted.' } }]);
    const result = await service.put('/forge/wallet/keys', { openrouter_key: 'sk-test' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_403');
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Feature Purchases
// ---------------------------------------------------------------------------

describe('ForgeApiService — listFeaturePurchases', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/simulations/{simId}/features', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/simulations/sim-1/features');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/features');
  });

  it('should pass feature_type filter', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/simulations/sim-1/features?feature_type=darkroom_pass');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('feature_type=darkroom_pass');
  });
});

describe('ForgeApiService — purchaseDarkroom', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/simulations/{simId}/darkroom', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'fp-1', regen_budget: 10 } } }]);
    await service.post('/forge/simulations/sim-1/darkroom');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/darkroom');
    expect(init.method).toBe('POST');
  });

  it('should return purchase_id and regen_budget', async () => {
    mockFetch([{ body: { data: { purchase_id: 'fp-1', regen_budget: 10 } } }]);
    const result = await service.post('/forge/simulations/sim-1/darkroom');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ purchase_id: 'fp-1', regen_budget: 10 });
  });
});

describe('ForgeApiService — darkroomRegen', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/simulations/{simId}/darkroom/regenerate/{entityType}/{entityId}', async () => {
    const spy = mockFetch([{ body: { data: { remaining_regenerations: 9 } } }]);
    await service.post(
      '/forge/simulations/sim-1/darkroom/regenerate/agent/agent-1',
      { prompt_override: null },
    );
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/darkroom/regenerate/agent/agent-1');
    expect(init.method).toBe('POST');
  });

  it('should pass prompt_override in body', async () => {
    const spy = mockFetch([{ body: { data: { remaining_regenerations: 8 } } }]);
    await service.post(
      '/forge/simulations/sim-1/darkroom/regenerate/building/bld-1',
      { prompt_override: 'A crumbling tower at dusk' },
    );
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).prompt_override).toBe('A crumbling tower at dusk');
  });

  it('should handle 400 when budget exhausted', async () => {
    mockFetch([{ status: 400, body: { detail: 'Darkroom regeneration budget exhausted.' } }]);
    const result = await service.post('/forge/simulations/sim-1/darkroom/regenerate/agent/a-1', {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_400');
  });

  it('should handle 404 when no darkroom pass', async () => {
    mockFetch([{ status: 404, body: { detail: 'No active Darkroom pass for this simulation.' } }]);
    const result = await service.post('/forge/simulations/sim-1/darkroom/regenerate/agent/a-1', {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_404');
  });
});

describe('ForgeApiService — purchaseDossier', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/simulations/{simId}/dossier', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'fp-2' } } }]);
    await service.post('/forge/simulations/sim-1/dossier');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/dossier');
    expect(init.method).toBe('POST');
  });
});

describe('ForgeApiService — purchaseRecruitment', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/simulations/{simId}/recruit with focus and zone_id', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'fp-3' } } }]);
    await service.post('/forge/simulations/sim-1/recruit', {
      focus: 'artisans',
      zone_id: 'zone-1',
    });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/recruit');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.focus).toBe('artisans');
    expect(body.zone_id).toBe('zone-1');
  });

  it('should send null for optional fields when omitted', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'fp-3' } } }]);
    await service.post('/forge/simulations/sim-1/recruit', {
      focus: null,
      zone_id: null,
    });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.focus).toBeNull();
    expect(body.zone_id).toBeNull();
  });
});

describe('ForgeApiService — purchaseChronicle', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/simulations/{simId}/chronicle', async () => {
    const spy = mockFetch([{ body: { data: { purchase_id: 'fp-4' } } }]);
    await service.post('/forge/simulations/sim-1/chronicle');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/simulations/sim-1/chronicle');
    expect(init.method).toBe('POST');
  });
});

describe('ForgeApiService — getFeaturePurchase', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/features/{purchaseId}', async () => {
    const spy = mockFetch([{
      body: { data: { id: 'fp-1', status: 'completed', feature_type: 'darkroom_pass' } },
    }]);
    await service.get('/forge/features/fp-1');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/features/fp-1');
  });

  it('should return feature purchase with all status fields', async () => {
    const purchase = {
      id: 'fp-1',
      user_id: 'user-1',
      simulation_id: 'sim-1',
      feature_type: 'recruitment',
      token_cost: 25,
      status: 'processing',
      config: { focus: 'artisans' },
      result: {},
      regen_budget_remaining: 0,
      created_at: '2026-03-10T10:00:00Z',
      completed_at: null,
    };
    mockFetch([{ body: { data: purchase } }]);
    const result = await service.get('/forge/features/fp-1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(purchase);
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Access Requests (Clearance)
// ---------------------------------------------------------------------------

describe('ForgeApiService — requestAccess', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/access-requests', async () => {
    const spy = mockFetch([{ body: { data: { id: 'ar-1', status: 'pending' } } }]);
    await service.post('/forge/access-requests', { message: 'I want to build worlds' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/access-requests');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).message).toBe('I want to build worlds');
  });
});

describe('ForgeApiService — getMyAccessRequest', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/access-requests/me', async () => {
    const spy = mockFetch([{ body: { data: null } }]);
    await service.get('/forge/access-requests/me');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/access-requests/me');
  });

  it('should return null when no request exists', async () => {
    mockFetch([{ body: { data: null } }]);
    const result = await service.get('/forge/access-requests/me');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe('ForgeApiService — listPendingRequests', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/access-requests/pending', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/access-requests/pending');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/access-requests/pending');
  });
});

describe('ForgeApiService — getPendingRequestCount', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/access-requests/pending/count', async () => {
    const spy = mockFetch([{ body: { data: 3 } }]);
    await service.get('/forge/access-requests/pending/count');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/access-requests/pending/count');
  });
});

describe('ForgeApiService — reviewRequest', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/access-requests/{id}/review with action', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/access-requests/ar-1/review', {
      action: 'approve',
      admin_notes: 'Welcome aboard',
    });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/access-requests/ar-1/review');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe('approve');
    expect(body.admin_notes).toBe('Welcome aboard');
  });

  it('should support reject action', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/access-requests/ar-1/review', {
      action: 'reject',
      admin_notes: null,
    });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe('reject');
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Admin Stats
// ---------------------------------------------------------------------------

describe('ForgeApiService — getAdminStats', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/admin/stats', async () => {
    const spy = mockFetch([{
      body: { data: { active_drafts: 5, total_tokens: 10000, total_materialized: 12 } },
    }]);
    await service.get('/forge/admin/stats');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/stats');
  });
});

describe('ForgeApiService — purgeStale', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call DELETE /forge/admin/purge with days param', async () => {
    const spy = mockFetch([{ body: { data: { deleted_count: 3 } } }]);
    await service.delete('/forge/admin/purge?days=30');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/purge');
    expect(url).toContain('days=30');
    expect(init.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// ForgeApiService — Error handling
// ---------------------------------------------------------------------------

describe('ForgeApiService — error handling', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should handle network errors', async () => {
    mockFetchNetworkError('Failed to fetch');
    const result = await service.post('/forge/drafts/d-1/ignite');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
  });

  it('should handle 429 rate limit', async () => {
    mockFetch([{ status: 429, body: { detail: 'Rate limit exceeded' } }]);
    const result = await service.post('/forge/drafts/d-1/research');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_429');
  });

  it('should handle 500 server error', async () => {
    mockFetch([{ status: 500, body: { message: 'AI generation failed' } }]);
    const result = await service.post('/forge/drafts/d-1/generate/agents');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_500');
    expect(result.error?.message).toBe('AI generation failed');
  });
});
