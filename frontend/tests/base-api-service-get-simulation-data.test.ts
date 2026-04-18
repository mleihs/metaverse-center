// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse } from '../src/types/index.js';

// Stub the supabase browser client so importing BaseApiService (via captureError
// → SentryService, and via its own `import { supabase }`) does not require
// Vite-only `import.meta.env.VITE_SUPABASE_*` variables at test time.
vi.mock('../src/services/supabase/client.js', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}));

const { BaseApiService } = await import('../src/services/api/BaseApiService.js');

/**
 * Contract test for `BaseApiService.getSimulationData(path, mode, params?)`.
 *
 * Pins the explicit-mode dispatch table:
 *  - `(path, 'member', params?)` → routes through `get()` (authenticated)
 *  - `(path, 'public', params?)` → routes through `getPublic()`
 *
 * The API layer does not read `appState` for routing — this is enforced at
 * compile time by requiring `mode`, at runtime by the pure dispatch here,
 * and at review time by `scripts/lint-no-appstate-access-reads.sh`.
 */

type Call = { path: string; params?: Record<string, string> };

/**
 * Canonical "empty-payload" stub for routing-only tests. The assertions below
 * verify which underlying method (`get` vs `getPublic`) was invoked with which
 * args — the response payload is irrelevant. `null as T` is the minimal
 * type-seam for satisfying the generic return shape without fabricating a T.
 */
function emptySuccessStub<T>(): ApiResponse<T> {
  return { success: true, data: null as T };
}

class ProbeApiService extends BaseApiService {
  public readonly getCalls: Call[] = [];
  public readonly getPublicCalls: Call[] = [];

  protected override get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    this.getCalls.push({ path, params });
    return Promise.resolve(emptySuccessStub<T>());
  }

  protected override async getPublic<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    this.getPublicCalls.push({ path, params });
    return emptySuccessStub<T>();
  }

  /** Public probe for the protected method. */
  public async probe(
    path: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<unknown>> {
    return this.getSimulationData(path, mode, params);
  }
}

describe('BaseApiService.getSimulationData', () => {
  let service: ProbeApiService;

  beforeEach(() => {
    service = new ProbeApiService();
  });

  it("routes 'member' mode through the authenticated get()", async () => {
    await service.probe('/simulations/abc/agents', 'member', { limit: '10' });
    expect(service.getCalls).toEqual([
      { path: '/simulations/abc/agents', params: { limit: '10' } },
    ]);
    expect(service.getPublicCalls).toEqual([]);
  });

  it("routes 'public' mode through getPublic()", async () => {
    await service.probe('/simulations/abc/agents', 'public', { limit: '10' });
    expect(service.getPublicCalls).toEqual([
      { path: '/simulations/abc/agents', params: { limit: '10' } },
    ]);
    expect(service.getCalls).toEqual([]);
  });

  it('routes correctly when params are omitted', async () => {
    await service.probe('/simulations/abc/agents', 'public');
    expect(service.getPublicCalls).toEqual([
      { path: '/simulations/abc/agents', params: undefined },
    ]);
    expect(service.getCalls).toEqual([]);

    await service.probe('/simulations/abc/agents', 'member');
    expect(service.getCalls).toEqual([{ path: '/simulations/abc/agents', params: undefined }]);
  });
});
