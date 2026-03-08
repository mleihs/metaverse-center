import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, mockFetchNetworkError, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// We replicate the minimal BaseApiService logic (same pattern as echo-api.test.ts)
// to test the StyleReferenceApiService fetch contract without pulling in the full
// dependency tree (appState, Supabase client, import.meta.env, etc.).
//
// The service under test: src/services/api/StyleReferenceApiService.ts
// Methods: upload, list, remove
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

  delete<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('DELETE', path, undefined, params);
  }

  /**
   * POST with multipart/form-data body.
   * Does NOT set Content-Type header — browser auto-sets boundary.
   */
  async postFormData<T>(
    path: string,
    formData: FormData,
  ): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    try {
      const url = this.buildUrl(path);
      const headers: Record<string, string> = {};
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
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
}

/**
 * Mirrors StyleReferenceApiService method signatures,
 * delegating to TestableBaseApiService.
 */
class TestableStyleReferenceApiService {
  private base: TestableBaseApiService;

  constructor(baseUrl = '/api/v1', token: string | null = null) {
    this.base = new TestableBaseApiService(baseUrl, token);
  }

  async upload(
    simulationId: string,
    file?: File,
    imageUrl?: string,
    entityType: string = 'portrait',
    scope: string = 'global',
    entityId?: string,
    strength: number = 0.75,
  ) {
    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('scope', scope);
    formData.append('strength', String(strength));
    if (file) formData.append('file', file);
    if (imageUrl) formData.append('image_url', imageUrl);
    if (entityId) formData.append('entity_id', entityId);

    return this.base.postFormData(
      `/simulations/${simulationId}/style-references/upload`,
      formData,
    );
  }

  async list(simulationId: string, entityType: string) {
    return this.base.get(`/simulations/${simulationId}/style-references/${entityType}`);
  }

  async remove(
    simulationId: string,
    entityType: string,
    scope: string = 'global',
    entityId?: string,
  ) {
    const params: Record<string, string> = { scope };
    if (entityId) params.entity_id = entityId;
    return this.base.delete(
      `/simulations/${simulationId}/style-references/${entityType}`,
      params,
    );
  }
}

// ---------------------------------------------------------------------------
// StyleReferenceApiService — upload with file
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — upload with file', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should POST to correct upload URL with FormData body', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);
    const file = new File(['image-data'], 'style.png', { type: 'image/png' });

    await service.upload('sim-123', file);

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/style-references/upload');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('should include file in FormData', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);
    const file = new File(['image-data'], 'style.png', { type: 'image/png' });

    await service.upload('sim-123', file);

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
    expect((formData.get('file') as File).name).toBe('style.png');
  });

  it('should include default fields in FormData', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    await service.upload('sim-123', file);

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get('entity_type')).toBe('portrait');
    expect(formData.get('scope')).toBe('global');
    expect(formData.get('strength')).toBe('0.75');
  });

  it('should not set Content-Type header (browser auto-sets boundary)', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    await service.upload('sim-123', file);

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('should return uploaded reference data', async () => {
    const responseData = {
      url: 'https://cdn.example.com/ref.png',
      scope: 'global' as const,
      entity_type: 'portrait' as const,
    };
    mockFetch([{ body: { data: responseData } }]);
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    const result = await service.upload('sim-123', file);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(responseData);
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — upload with URL
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — upload with URL', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should include image_url in FormData instead of file', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);

    await service.upload('sim-123', undefined, 'https://example.com/image.png');

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get('image_url')).toBe('https://example.com/image.png');
    expect(formData.get('file')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — upload with entity scope
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — upload with entity scope', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should include entity_id in FormData when scope is entity', async () => {
    const spy = mockFetch([{
      body: {
        data: {
          url: 'https://cdn.example.com/ref.png',
          scope: 'entity',
          entity_type: 'building',
          entity_id: 'building-42',
        },
      },
    }]);
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    await service.upload('sim-123', file, undefined, 'building', 'entity', 'building-42');

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get('entity_type')).toBe('building');
    expect(formData.get('scope')).toBe('entity');
    expect(formData.get('entity_id')).toBe('building-42');
  });

  it('should not include entity_id when scope is global', async () => {
    const spy = mockFetch([{
      body: { data: { url: 'https://cdn.example.com/ref.png', scope: 'global', entity_type: 'portrait' } },
    }]);
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    await service.upload('sim-123', file, undefined, 'portrait', 'global');

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get('entity_id')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — upload error handling
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — upload error handling', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should return error on network failure', async () => {
    mockFetchNetworkError('Network request failed');
    const file = new File(['data'], 'ref.png', { type: 'image/png' });

    const result = await service.upload('sim-123', file);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
    expect(result.error?.message).toBe('Network request failed');
  });

  it('should return error on HTTP 413 (file too large)', async () => {
    mockFetch([{
      status: 413,
      body: { code: 'FILE_TOO_LARGE', message: 'Image exceeds 5 MB limit' },
    }]);
    const file = new File(['data'], 'huge.png', { type: 'image/png' });

    const result = await service.upload('sim-123', file);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FILE_TOO_LARGE');
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — list
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — list', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call GET on correct endpoint', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);

    await service.list('sim-123', 'portrait');

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/style-references/portrait');
    expect(init.method).toBe('GET');
  });

  it('should contain the entity type in the URL', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);

    await service.list('sim-456', 'building');

    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-456/style-references/building');
  });

  it('should return style reference data from successful response', async () => {
    const references = [
      {
        id: 'ref-1',
        url: 'https://cdn.example.com/ref1.png',
        scope: 'global',
        entity_type: 'portrait',
        strength: 0.75,
      },
      {
        id: 'ref-2',
        url: 'https://cdn.example.com/ref2.png',
        scope: 'entity',
        entity_type: 'portrait',
        entity_id: 'agent-42',
        strength: 0.8,
      },
    ];
    mockFetch([{ body: { data: references } }]);

    const result = await service.list('sim-123', 'portrait');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(references);
  });

  it('should include Authorization header', async () => {
    const spy = mockFetch([{ body: { data: [] } }]);

    await service.list('sim-123', 'portrait');

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — remove global
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — remove global', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call DELETE with scope=global param', async () => {
    const spy = mockFetch([{ body: { data: { deleted: true } } }]);

    await service.remove('sim-123', 'portrait', 'global');

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/style-references/portrait');
    expect(url).toContain('scope=global');
    expect(init.method).toBe('DELETE');
  });

  it('should not include entity_id param for global scope', async () => {
    const spy = mockFetch([{ body: { data: { deleted: true } } }]);

    await service.remove('sim-123', 'portrait', 'global');

    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('entity_id');
  });

  it('should return deleted confirmation', async () => {
    mockFetch([{ body: { data: { deleted: true } } }]);

    const result = await service.remove('sim-123', 'portrait', 'global');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ deleted: true });
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — remove entity
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — remove entity', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should call DELETE with entity_id param', async () => {
    const spy = mockFetch([{ body: { data: { deleted: true } } }]);

    await service.remove('sim-123', 'building', 'entity', 'building-42');

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/style-references/building');
    expect(url).toContain('scope=entity');
    expect(url).toContain('entity_id=building-42');
    expect(init.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// StyleReferenceApiService — remove error handling
// ---------------------------------------------------------------------------

describe('StyleReferenceApiService — remove error handling', () => {
  let service: TestableStyleReferenceApiService;

  beforeEach(() => {
    service = new TestableStyleReferenceApiService('/api/v1', 'test-jwt-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  it('should handle 404 when style reference not found', async () => {
    mockFetch([{
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Style reference not found' },
    }]);

    const result = await service.remove('sim-123', 'portrait', 'global');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('should handle network error on remove', async () => {
    mockFetchNetworkError('Connection refused');

    const result = await service.remove('sim-123', 'portrait', 'global');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
    expect(result.error?.message).toBe('Connection refused');
  });
});
