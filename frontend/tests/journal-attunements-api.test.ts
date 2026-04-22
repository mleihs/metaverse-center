// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the supabase browser client so importing the api service chain
// (BaseApiService → SentryService → supabase client) does not require
// Vite-only env vars at test time.
vi.mock('../src/services/supabase/client.js', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}));

vi.mock('../src/services/AppStateManager.js', () => ({
  appState: { accessToken: { value: 'test-jwt' } },
}));

const { JournalApiService } = await import('../src/services/api/JournalApiService.js');

/**
 * Contract tests for the Resonance Journal attunement endpoint (P3).
 * Covers the GET /journal/attunements catalog method + the
 * AttunementCatalogEntry shape.
 */

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

function installFetchCapture(response: unknown = { data: [] }): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit = {}) => {
      captured.push({
        url,
        method: options.method ?? 'GET',
        headers: Object.fromEntries(
          Object.entries((options.headers ?? {}) as Record<string, string>),
        ),
      });
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return captured;
}

describe('JournalApiService — attunements endpoint (P3)', () => {
  let api: InstanceType<typeof JournalApiService>;
  let captured: CapturedRequest[];

  beforeEach(() => {
    api = new JournalApiService();
    captured = installFetchCapture();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listAttunements hits GET /attunements with the JWT attached', async () => {
    await api.listAttunements();
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toMatch(/\/api\/v1\/journal\/attunements$/);
    expect(captured[0].headers.Authorization).toBe('Bearer test-jwt');
  });

  it('listAttunements response carries per-entry unlock state', async () => {
    vi.unstubAllGlobals();
    const payload = {
      data: [
        {
          id: 'att-1',
          slug: 'einstimmung_zoegern',
          name_de: 'Einstimmung des Zögerns',
          name_en: 'Hesitation Attunement',
          description_de: 'DE',
          description_en: 'EN',
          system_hook: 'dungeon_option',
          effect: {},
          required_resonance_type: 'emotional',
          enabled: true,
          unlocked: false,
          unlocked_at: null,
          constellation_id: null,
        },
        {
          id: 'att-2',
          slug: 'einstimmung_gnade',
          name_de: 'Einstimmung der Gnade',
          name_en: 'Mercy Attunement',
          description_de: 'DE',
          description_en: 'EN',
          system_hook: 'epoch_option',
          effect: {},
          required_resonance_type: 'archetype',
          enabled: true,
          unlocked: true,
          unlocked_at: '2026-04-22T00:00:00Z',
          constellation_id: 'const-1',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const resp = await api.listAttunements();
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data).toHaveLength(2);
      const hesitation = resp.data.find((a) => a.slug === 'einstimmung_zoegern');
      const mercy = resp.data.find((a) => a.slug === 'einstimmung_gnade');
      expect(hesitation?.unlocked).toBe(false);
      expect(hesitation?.unlocked_at).toBeNull();
      expect(mercy?.unlocked).toBe(true);
      expect(mercy?.constellation_id).toBe('const-1');
      expect(mercy?.system_hook).toBe('epoch_option');
    }
  });

  it('listAttunements 401 surfaces as a structured ApiResponse error', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'not authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const resp = await api.listAttunements();
    expect(resp.success).toBe(false);
    if (!resp.success) {
      expect(resp.error.code).toBe('HTTP_401');
    }
  });
});
