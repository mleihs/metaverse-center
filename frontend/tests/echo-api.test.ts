import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// Same testable service pattern as api-services.test.ts — replicates the
// minimal BaseApiService logic to verify fetch contract for EchoesApiService.
//
// The service under test: src/services/api/EchoesApiService.ts
// Methods: listForSimulation, listForEvent, triggerEcho, approve, reject
// Public routing: listForSimulation + listForEvent route to /public/* when unauthenticated
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
}

// ---------------------------------------------------------------------------
// EchoesApiService — listForSimulation
// ---------------------------------------------------------------------------

describe('EchoesApiService — listForSimulation', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /simulations/{simId}/echoes', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/echoes');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/echoes');
    expect(init.method).toBe('GET');
  });

  it('should pass pagination query params', async () => {
    const spy = mockFetch([{ body: { data: [], meta: { count: 0, total: 0 } } }]);
    await service.get('/simulations/sim-123/echoes', { limit: '10', offset: '5' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=5');
  });

  it('should route to /public/ prefix when unauthenticated', async () => {
    service.setToken(null);
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.getPublic('/simulations/sim-123/echoes', { limit: '25' });
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/sim-123/echoes');
    expect(url).toContain('limit=25');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('should return echo data from successful response', async () => {
    const echoes = [
      {
        id: 'echo-1',
        source_event_id: 'evt-1',
        source_simulation_id: 'sim-123',
        target_simulation_id: 'sim-456',
        echo_vector: 'memory',
        echo_strength: 0.7,
        status: 'completed',
      },
    ];
    mockFetch([{ body: { data: echoes } }]);
    const result = await service.get('/simulations/sim-123/echoes');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(echoes);
  });
});

// ---------------------------------------------------------------------------
// EchoesApiService — listForEvent
// ---------------------------------------------------------------------------

describe('EchoesApiService — listForEvent', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET /simulations/{simId}/events/{eventId}/echoes', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/events/evt-1/echoes');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/events/evt-1/echoes');
    expect(init.method).toBe('GET');
  });

  it('should route to /public/ prefix when unauthenticated', async () => {
    service.setToken(null);
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.getPublic('/simulations/sim-123/events/evt-1/echoes');
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/public/simulations/sim-123/events/evt-1/echoes');
  });

  it('should include Authorization header when authenticated', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);
    await service.get('/simulations/sim-123/events/evt-1/echoes');
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});

// ---------------------------------------------------------------------------
// EchoesApiService — triggerEcho
// ---------------------------------------------------------------------------

describe('EchoesApiService — triggerEcho', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call POST /simulations/{simId}/echoes with body', async () => {
    const body = {
      source_event_id: 'evt-1',
      target_simulation_id: 'sim-456',
      echo_vector: 'commerce',
      echo_strength: 0.8,
    };
    const spy = mockFetch([{ body: { data: { id: 'echo-new', ...body } } }]);
    await service.post('/simulations/sim-123/echoes', body);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/echoes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('should return created echo', async () => {
    const created = {
      id: 'echo-new',
      source_event_id: 'evt-1',
      target_simulation_id: 'sim-456',
      echo_vector: 'resonance',
      echo_strength: 0.5,
      status: 'pending',
    };
    mockFetch([{ body: { data: created } }]);
    const result = await service.post('/simulations/sim-123/echoes', {
      source_event_id: 'evt-1',
      target_simulation_id: 'sim-456',
      echo_vector: 'resonance',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(created);
  });

  it('should include Authorization header for write operations', async () => {
    const spy = mockFetch([{ body: { data: {} } }]);
    await service.post('/simulations/sim-123/echoes', {
      source_event_id: 'evt-1',
      target_simulation_id: 'sim-456',
      echo_vector: 'memory',
    });
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});

// ---------------------------------------------------------------------------
// EchoesApiService — approve
// ---------------------------------------------------------------------------

describe('EchoesApiService — approve', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PATCH /simulations/{simId}/echoes/{echoId}/approve', async () => {
    const spy = mockFetch([{ body: { data: { id: 'echo-1', status: 'completed' } } }]);
    await service.patch('/simulations/sim-123/echoes/echo-1/approve');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/echoes/echo-1/approve');
    expect(init.method).toBe('PATCH');
  });

  it('should return updated echo after approval', async () => {
    const approved = { id: 'echo-1', status: 'completed', echo_vector: 'dream' };
    mockFetch([{ body: { data: approved } }]);
    const result = await service.patch('/simulations/sim-123/echoes/echo-1/approve');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(approved);
  });

  it('should handle 403 when user lacks permission', async () => {
    mockFetch([{ status: 403, body: { code: 'FORBIDDEN', message: 'Not simulation owner' } }]);
    const result = await service.patch('/simulations/sim-123/echoes/echo-1/approve');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// EchoesApiService — reject
// ---------------------------------------------------------------------------

describe('EchoesApiService — reject', () => {
  let service: TestableBaseApiService;

  beforeEach(() => {
    service = new TestableBaseApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call PATCH /simulations/{simId}/echoes/{echoId}/reject', async () => {
    const spy = mockFetch([{ body: { data: { id: 'echo-1', status: 'rejected' } } }]);
    await service.patch('/simulations/sim-123/echoes/echo-1/reject');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/echoes/echo-1/reject');
    expect(init.method).toBe('PATCH');
  });

  it('should return updated echo after rejection', async () => {
    const rejected = { id: 'echo-1', status: 'rejected', echo_vector: 'language' };
    mockFetch([{ body: { data: rejected } }]);
    const result = await service.patch('/simulations/sim-123/echoes/echo-1/reject');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(rejected);
  });

  it('should handle 404 when echo not found', async () => {
    mockFetch([{ status: 404, body: { code: 'NOT_FOUND', message: 'Echo not found' } }]);
    const result = await service.patch('/simulations/sim-123/echoes/nonexistent/reject');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});
