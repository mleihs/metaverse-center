import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, mockFetchNetworkError, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// Testable service replicating BaseApiService contract for AdminApiService
// forge-related methods. See api-services.test.ts header comment for rationale.
// ---------------------------------------------------------------------------

class TestableBaseApiService {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl = '/api/v1', token: string | null = null) {
    this.baseUrl = baseUrl;
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

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }
}

// ---------------------------------------------------------------------------
// AdminApiService — Token Economy Stats
// ---------------------------------------------------------------------------

describe('AdminApiService — getTokenEconomyStats', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/admin/economy', async () => {
    const spy = mockFetch([{ body: { data: { total_purchases: 50 } } }]);
    await service.get('/forge/admin/economy');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/economy');
    expect(init.method).toBe('GET');
  });

  it('should return full economy stats', async () => {
    const stats = {
      total_purchases: 50,
      mock_purchases: 45,
      admin_grants: 5,
      total_revenue_cents: 0,
      total_tokens_granted: 2500,
      tokens_in_circulation: 1800,
      unique_buyers: 12,
      active_bundles: 3,
    };
    mockFetch([{ body: { data: stats } }]);
    const result = await service.get('/forge/admin/economy');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(stats);
  });

  it('should include admin Authorization header', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.get('/forge/admin/economy');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer admin-jwt-token');
  });
});

// ---------------------------------------------------------------------------
// AdminApiService — Bundle Management
// ---------------------------------------------------------------------------

describe('AdminApiService — listAllBundles', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/admin/bundles', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/admin/bundles');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/bundles');
  });

  it('should return bundles including inactive ones', async () => {
    const bundles = [
      { id: 'b-1', slug: 'starter', display_name: 'Starter', tokens: 50, is_active: true },
      { id: 'b-2', slug: 'legacy', display_name: 'Legacy', tokens: 100, is_active: false },
    ];
    mockFetch([{ body: { data: bundles } }]);
    const result = await service.get('/forge/admin/bundles');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });
});

describe('AdminApiService — updateBundle', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/admin/bundles/{bundleId} with body', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.put('/forge/admin/bundles/b-1', { tokens: 75, is_active: false });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/bundles/b-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ tokens: 75, is_active: false });
  });

  it('should handle 422 for no fields to update', async () => {
    mockFetch([{ status: 422, body: { detail: 'No fields to update' } }]);
    const result = await service.put('/forge/admin/bundles/b-1', {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_422');
  });
});

// ---------------------------------------------------------------------------
// AdminApiService — Purchase Ledger
// ---------------------------------------------------------------------------

describe('AdminApiService — listPurchases', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/admin/purchases with pagination', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/admin/purchases', { limit: '50', offset: '0' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/purchases');
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=0');
  });

  it('should pass payment_method filter', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/forge/admin/purchases', {
      limit: '50',
      offset: '0',
      payment_method: 'mock',
    });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('payment_method=mock');
  });

  it('should return ledger entries', async () => {
    const entries = [{
      id: 'p-1',
      user_id: 'user-1',
      tokens_granted: 50,
      price_cents: 0,
      payment_method: 'mock',
      balance_before: 0,
      balance_after: 50,
      created_at: '2026-03-10T10:00:00Z',
    }];
    mockFetch([{ body: { data: entries } }]);
    const result = await service.get('/forge/admin/purchases', { limit: '50', offset: '0' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AdminApiService — Grant Tokens
// ---------------------------------------------------------------------------

describe('AdminApiService — grantTokens', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /forge/admin/grant with user_id, tokens, reason', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/forge/admin/grant', {
      user_id: 'user-1',
      tokens: 100,
      reason: 'Beta tester reward',
    });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/grant');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.user_id).toBe('user-1');
    expect(body.tokens).toBe(100);
    expect(body.reason).toBe('Beta tester reward');
  });
});

// ---------------------------------------------------------------------------
// AdminApiService — BYOK System Settings
// ---------------------------------------------------------------------------

describe('AdminApiService — getBYOKSystemSetting', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /forge/admin/byok-setting', async () => {
    const spy = mockFetch([{
      body: { data: { byok_bypass_enabled: false, byok_access_policy: 'per_user' } },
    }]);
    await service.get('/forge/admin/byok-setting');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/byok-setting');
  });

  it('should return bypass and policy settings', async () => {
    const settings = { byok_bypass_enabled: true, byok_access_policy: 'all' };
    mockFetch([{ body: { data: settings } }]);
    const result = await service.get('/forge/admin/byok-setting');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(settings);
  });
});

describe('AdminApiService — updateBYOKSystemSetting', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/admin/byok-setting?enabled=true', async () => {
    const spy = mockFetch([{ body: { data: { byok_bypass_enabled: true } } }]);
    await service.put('/forge/admin/byok-setting?enabled=true', {});
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/byok-setting');
    expect(url).toContain('enabled=true');
    expect(init.method).toBe('PUT');
  });

  it('should call PUT /forge/admin/byok-setting?enabled=false', async () => {
    const spy = mockFetch([{ body: { data: { byok_bypass_enabled: false } } }]);
    await service.put('/forge/admin/byok-setting?enabled=false', {});
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('enabled=false');
  });
});

describe('AdminApiService — updateBYOKAccessPolicy', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/admin/byok-access-policy?policy=all', async () => {
    const spy = mockFetch([{ body: { data: { byok_access_policy: 'all' } } }]);
    await service.put('/forge/admin/byok-access-policy?policy=all', {});
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/byok-access-policy');
    expect(url).toContain('policy=all');
    expect(init.method).toBe('PUT');
  });

  it('should support none policy', async () => {
    const spy = mockFetch([{ body: { data: { byok_access_policy: 'none' } } }]);
    await service.put('/forge/admin/byok-access-policy?policy=none', {});
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('policy=none');
  });

  it('should support per_user policy', async () => {
    const spy = mockFetch([{ body: { data: { byok_access_policy: 'per_user' } } }]);
    await service.put('/forge/admin/byok-access-policy?policy=per_user', {});
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('policy=per_user');
  });
});

describe('AdminApiService — updateUserBYOKBypass', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/admin/user-byok-bypass/{userId}?enabled=true', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.put('/forge/admin/user-byok-bypass/user-1?enabled=true', {});
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/user-byok-bypass/user-1');
    expect(url).toContain('enabled=true');
    expect(init.method).toBe('PUT');
  });

  it('should handle 404 when wallet not found', async () => {
    mockFetch([{ status: 404, body: { detail: 'User wallet not found.' } }]);
    const result = await service.put('/forge/admin/user-byok-bypass/nonexistent?enabled=true', {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_404');
  });
});

describe('AdminApiService — updateUserBYOKAllowed', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PUT /forge/admin/user-byok-allowed/{userId}?enabled=true', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.put('/forge/admin/user-byok-allowed/user-1?enabled=true', {});
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forge/admin/user-byok-allowed/user-1');
    expect(url).toContain('enabled=true');
    expect(init.method).toBe('PUT');
  });

  it('should call with enabled=false to revoke', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.put('/forge/admin/user-byok-allowed/user-1?enabled=false', {});
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('enabled=false');
  });

  it('should handle 404 when wallet not found', async () => {
    mockFetch([{ status: 404, body: { detail: 'User wallet not found.' } }]);
    const result = await service.put('/forge/admin/user-byok-allowed/nonexistent?enabled=false', {});
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_404');
  });
});

// ---------------------------------------------------------------------------
// AdminApiService — error handling
// ---------------------------------------------------------------------------

describe('AdminApiService — forge error handling', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'admin-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should handle network errors on admin endpoints', async () => {
    mockFetchNetworkError('Connection refused');
    const result = await service.get('/forge/admin/economy');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
  });

  it('should handle 403 for non-admin users', async () => {
    mockFetch([{ status: 403, body: { code: 'FORBIDDEN', message: 'Platform admin required' } }]);
    const result = await service.get('/forge/admin/stats');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});
