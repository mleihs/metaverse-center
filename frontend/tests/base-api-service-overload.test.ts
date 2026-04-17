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
const { appState } = await import('../src/services/AppStateManager.js');

/**
 * Contract test for `BaseApiService.getSimulationData` overload dispatch.
 *
 * Pins the behavior of the two-overload surface introduced in W2.1 C2:
 *  - `(path, 'member', params)`     → routes through `get()`    (authenticated)
 *  - `(path, 'public', params)`     → routes through `getPublic()`
 *  - `(path, params?)` (deprecated) → falls back to `appState.currentSimulationMode`
 *
 * This test must stay green through C3/C4/C5 (callers migrate) and protect
 * against regression until C6 deletes the deprecated overload.
 */

type Call = { path: string; params?: Record<string, string> };

class ProbeApiService extends BaseApiService {
  public readonly getCalls: Call[] = [];
  public readonly getPublicCalls: Call[] = [];

  protected override get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    this.getCalls.push({ path, params });
    return Promise.resolve({ success: true, data: null as unknown as T });
  }

  protected override async getPublic<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    this.getPublicCalls.push({ path, params });
    return { success: true, data: null as unknown as T };
  }

  /** Public probe for the protected overloaded method. */
  public async probe(
    path: string,
    arg2?: 'public' | 'member' | Record<string, string>,
    arg3?: Record<string, string>,
  ): Promise<ApiResponse<unknown>> {
    // Dispatch to both overload shapes depending on arg2 type.
    if (arg2 === 'public' || arg2 === 'member') {
      return this.getSimulationData(path, arg2, arg3);
    }
    return this.getSimulationData(path, arg2);
  }
}

describe("BaseApiService.getSimulationData — explicit 'mode' overload", () => {
  let service: ProbeApiService;

  beforeEach(() => {
    service = new ProbeApiService();
    // Reset appState to a clean baseline for the deprecated-path tests.
    appState.setUser(null);
    appState.setCurrentRole(null);
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

  it('routes explicit mode even when params are omitted', async () => {
    await service.probe('/simulations/abc/agents', 'public');
    expect(service.getPublicCalls).toEqual([
      { path: '/simulations/abc/agents', params: undefined },
    ]);
    expect(service.getCalls).toEqual([]);
  });
});

describe("BaseApiService.getSimulationData — deprecated signature (no 'mode')", () => {
  let service: ProbeApiService;

  beforeEach(() => {
    service = new ProbeApiService();
    appState.setUser(null);
    appState.setCurrentRole(null);
  });

  it('falls through to getPublic() when appState is guest (mode: public)', async () => {
    expect(appState.currentSimulationMode.value).toBe('public');

    await service.probe('/simulations/abc/agents', { limit: '10' });
    expect(service.getPublicCalls).toEqual([
      { path: '/simulations/abc/agents', params: { limit: '10' } },
    ]);
    expect(service.getCalls).toEqual([]);
  });

  it('falls through to get() when appState indicates member (mode: member)', async () => {
    appState.setUser({ id: 'u-1' } as Parameters<typeof appState.setUser>[0]);
    appState.setCurrentRole('owner');
    expect(appState.currentSimulationMode.value).toBe('member');

    await service.probe('/simulations/abc/agents');
    expect(service.getCalls).toEqual([
      { path: '/simulations/abc/agents', params: undefined },
    ]);
    expect(service.getPublicCalls).toEqual([]);
  });

  it('tracks runtime mode flips via the shared signal', async () => {
    // Start as guest.
    await service.probe('/path1');
    // Become member.
    appState.setUser({ id: 'u-1' } as Parameters<typeof appState.setUser>[0]);
    appState.setCurrentRole('editor');
    await service.probe('/path2');
    // Sign out.
    appState.setUser(null);
    await service.probe('/path3');

    expect(service.getPublicCalls.map((c) => c.path)).toEqual(['/path1', '/path3']);
    expect(service.getCalls.map((c) => c.path)).toEqual(['/path2']);
  });
});
