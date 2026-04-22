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
 * Contract tests for the Resonance Journal constellation API methods
 * (P2). The tests intercept `fetch` and assert:
 *   - each method targets the correct path + HTTP verb
 *   - query params are passed only when supplied
 *   - POST / PATCH bodies carry the exact shape the FastAPI router
 *     expects (see backend/routers/journal.py, ConstellationCreateRequest
 *     / ConstellationRenameRequest / ConstellationPlaceRequest).
 *
 * These tests encode the wire contract; if the router's shape changes
 * we want the frontend to break loudly at test time, not at runtime.
 */

interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function installFetchCapture(response: unknown = { data: {} }): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit = {}) => {
      captured.push({
        url,
        method: options.method ?? 'GET',
        body: options.body ? JSON.parse(String(options.body)) : undefined,
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

describe('JournalApiService — constellation endpoints', () => {
  let api: InstanceType<typeof JournalApiService>;
  let captured: CapturedRequest[];

  beforeEach(() => {
    api = new JournalApiService();
    captured = installFetchCapture({ data: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listConstellations without a status hits GET /constellations with no query', async () => {
    await api.listConstellations();
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toMatch(/\/api\/v1\/journal\/constellations$/);
    expect(captured[0].body).toBeUndefined();
  });

  it('listConstellations("drafting") adds the status query parameter', async () => {
    await api.listConstellations('drafting');
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toMatch(
      /\/api\/v1\/journal\/constellations\?status=drafting$/,
    );
  });

  it('getConstellation hits GET /constellations/{id}', async () => {
    await api.getConstellation('abc-123');
    expect(captured[0].method).toBe('GET');
    expect(captured[0].url).toMatch(/\/api\/v1\/journal\/constellations\/abc-123$/);
  });

  it('placeFragment POSTs with {fragment_id, position_x, position_y}', async () => {
    await api.placeFragment('const-1', {
      fragment_id: 'frag-2',
      position_x: 140,
      position_y: -80,
    });
    expect(captured[0].method).toBe('POST');
    expect(captured[0].url).toMatch(
      /\/api\/v1\/journal\/constellations\/const-1\/place$/,
    );
    expect(captured[0].body).toEqual({
      fragment_id: 'frag-2',
      position_x: 140,
      position_y: -80,
    });
  });

  it('crystallizeConstellation POSTs to /crystallize with the JWT attached', async () => {
    await api.crystallizeConstellation('const-7');
    expect(captured[0].method).toBe('POST');
    expect(captured[0].url).toMatch(
      /\/api\/v1\/journal\/constellations\/const-7\/crystallize$/,
    );
    expect(captured[0].headers.Authorization).toBe('Bearer test-jwt');
  });

  it('crystallize HTTP 429 surfaces as a structured ApiResponse error', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'insight blocked: credit' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    const resp = await api.crystallizeConstellation('const-x');
    expect(resp.success).toBe(false);
    if (!resp.success) {
      expect(resp.error.code).toBe('HTTP_429');
      expect(resp.error.message).toContain('credit');
    }
  });

  it('crystallize response returns the CrystallizeResult shape verbatim (P3)', async () => {
    vi.unstubAllGlobals();
    const payload = {
      data: {
        constellation: {
          id: 'const-3',
          user_id: 'u-1',
          name_de: null,
          name_en: 'Mercy pattern',
          status: 'crystallized',
          insight_de: 'DE insight',
          insight_en: 'EN insight',
          resonance_type: 'archetype',
          attunement_id: 'att-2',
          created_at: '2026-04-22T00:00:00Z',
          crystallized_at: '2026-04-22T00:01:00Z',
          archived_at: null,
          updated_at: '2026-04-22T00:01:00Z',
          fragments: [],
          pair_matches: [
            {
              fragment_a_id: 'f-1',
              fragment_b_id: 'f-2',
              resonance_type: 'archetype',
              evidence_tags: ['shadow'],
            },
          ],
        },
        newly_unlocked_attunement: {
          id: 'att-2',
          slug: 'einstimmung_gnade',
          name_de: 'Einstimmung der Gnade',
          name_en: 'Mercy Attunement',
          description_de: 'DE',
          description_en: 'EN',
          system_hook: 'epoch_option',
          effect: { hook: 'epoch_operative_class', class_slug: 'observer' },
          required_resonance_type: 'archetype',
          enabled: true,
        },
      },
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
    const resp = await api.crystallizeConstellation('const-3');
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.constellation.id).toBe('const-3');
      expect(resp.data.constellation.pair_matches).toHaveLength(1);
      expect(resp.data.constellation.pair_matches[0].resonance_type).toBe('archetype');
      expect(resp.data.newly_unlocked_attunement?.slug).toBe('einstimmung_gnade');
    }
  });

  it('crystallize response with newly_unlocked_attunement=null is valid', async () => {
    vi.unstubAllGlobals();
    const payload = {
      data: {
        constellation: {
          id: 'const-4',
          user_id: 'u-1',
          name_de: null,
          name_en: null,
          status: 'crystallized',
          insight_de: 'X',
          insight_en: 'Y',
          resonance_type: 'contradiction',
          attunement_id: null,
          created_at: '2026-04-22T00:00:00Z',
          crystallized_at: '2026-04-22T00:01:00Z',
          archived_at: null,
          updated_at: '2026-04-22T00:01:00Z',
          fragments: [],
          pair_matches: [],
        },
        newly_unlocked_attunement: null,
      },
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
    const resp = await api.crystallizeConstellation('const-4');
    expect(resp.success).toBe(true);
    if (resp.success) {
      expect(resp.data.newly_unlocked_attunement).toBeNull();
      expect(resp.data.constellation.resonance_type).toBe('contradiction');
    }
  });
});
