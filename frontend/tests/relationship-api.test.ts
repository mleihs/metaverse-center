import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// We replicate the minimal BaseApiService logic (same pattern as api-services.test.ts)
// to test the RelationshipsApiService fetch contract without pulling in the full
// dependency tree (appState, Supabase client, import.meta.env, etc.).
//
// The service under test: src/services/api/RelationshipsApiService.ts
// Methods: listForAgent, listForSimulation, create, update, remove
// Public routing: listForAgent + listForSimulation route to /public/* when unauthenticated
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
    return this.request<T>('GET', `/public${path}`, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

// ---------------------------------------------------------------------------
// RelationshipsApiService — listForAgent
// ---------------------------------------------------------------------------

describe('RelationshipsApiService — listForAgent', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /simulations/{simId}/agents/{agentId}/relationships', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/agents/agent-456/relationships');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/agents/agent-456/relationships');
    expect(init.method).toBe('GET');
  });

  it('should include Authorization header when authenticated', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/agents/agent-456/relationships');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('should route to /public/ prefix when unauthenticated', async () => {
    service.setToken(null);
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.getPublic('/simulations/sim-123/agents/agent-456/relationships');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/sim-123/agents/agent-456/relationships');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('should return relationship data from successful response', async () => {
    const relationships = [
      {
        id: 'rel-1',
        source_agent_id: 'agent-456',
        target_agent_id: 'agent-789',
        relationship_type: 'ally',
        intensity: 0.8,
      },
    ];
    mockFetch([{ body: { data: relationships } }]);
    const result = await service.get('/simulations/sim-123/agents/agent-456/relationships');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(relationships);
  });
});

// ---------------------------------------------------------------------------
// RelationshipsApiService — listForSimulation
// ---------------------------------------------------------------------------

describe('RelationshipsApiService — listForSimulation', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /simulations/{simId}/relationships', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/relationships');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/relationships');
    expect(init.method).toBe('GET');
  });

  it('should pass query params for pagination', async () => {
    const spy = mockFetch([{ body: { data: [], meta: { count: 0, total: 0 } } }]);
    await service.get('/simulations/sim-123/relationships', { limit: '25', offset: '0' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('limit=25');
    expect(url).toContain('offset=0');
  });

  it('should route to /public/ prefix when unauthenticated', async () => {
    service.setToken(null);
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.getPublic('/simulations/sim-123/relationships', { limit: '10' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/sim-123/relationships');
    expect(url).toContain('limit=10');
  });
});

// ---------------------------------------------------------------------------
// RelationshipsApiService — create
// ---------------------------------------------------------------------------

describe('RelationshipsApiService — create', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /simulations/{simId}/agents/{agentId}/relationships with body', async () => {
    const body = {
      target_agent_id: 'agent-789',
      relationship_type: 'rival',
      is_bidirectional: true,
      intensity: 0.6,
      description: 'Long-standing rivalry',
    };
    const spy = mockFetch([{ body: { data: { id: 'rel-new', ...body } } }]);
    await service.post('/simulations/sim-123/agents/agent-456/relationships', body);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/agents/agent-456/relationships');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('should return created relationship', async () => {
    const created = {
      id: 'rel-new',
      source_agent_id: 'agent-456',
      target_agent_id: 'agent-789',
      relationship_type: 'ally',
      intensity: 0.5,
    };
    mockFetch([{ body: { data: created } }]);
    const result = await service.post(
      '/simulations/sim-123/agents/agent-456/relationships',
      { target_agent_id: 'agent-789', relationship_type: 'ally' },
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual(created);
  });

  it('should include Authorization header for write operations', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/simulations/sim-123/agents/agent-456/relationships', {
      target_agent_id: 'agent-789',
      relationship_type: 'ally',
    });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});

// ---------------------------------------------------------------------------
// RelationshipsApiService — update
// ---------------------------------------------------------------------------

describe('RelationshipsApiService — update', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PATCH /simulations/{simId}/relationships/{relationshipId} with body', async () => {
    const body = { intensity: 0.9, description: 'Updated description' };
    const spy = mockFetch([{ body: { data: { id: 'rel-1', ...body } } }]);
    await service.patch('/simulations/sim-123/relationships/rel-1', body);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/relationships/rel-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('should return updated relationship', async () => {
    const updated = {
      id: 'rel-1',
      relationship_type: 'mentor',
      intensity: 0.95,
    };
    mockFetch([{ body: { data: updated } }]);
    const result = await service.patch('/simulations/sim-123/relationships/rel-1', {
      relationship_type: 'mentor',
      intensity: 0.95,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// RelationshipsApiService — remove
// ---------------------------------------------------------------------------

describe('RelationshipsApiService — remove', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call DELETE /simulations/{simId}/relationships/{relationshipId}', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.delete('/simulations/sim-123/relationships/rel-1');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/relationships/rel-1');
    expect(init.method).toBe('DELETE');
  });

  it('should not include a body', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.delete('/simulations/sim-123/relationships/rel-1');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('should handle 404 when relationship not found', async () => {
    mockFetch([{ status: 404, body: { code: 'NOT_FOUND', message: 'Relationship not found' } }]);
    const result = await service.delete('/simulations/sim-123/relationships/nonexistent');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});
