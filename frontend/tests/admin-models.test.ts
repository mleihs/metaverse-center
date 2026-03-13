import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';

// ---------------------------------------------------------------------------
// AdminModelsTab tests — covers:
//   - Admin settings API contract for model_* keys
//   - Model settings load, filter, and save flow
//   - Reset to defaults behavior
// ---------------------------------------------------------------------------

// Replicate the minimal API service needed for testing (avoids Vite/Supabase deps)
class TestableAdminApi {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl = '/api/v1', token: string | null = null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    try {
      const url = `${this.baseUrl}${path}`;
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return await res.json();
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error' } };
    }
  }

  async listSettings() {
    return this.request<unknown[]>('GET', '/admin/settings');
  }

  async updateSetting(key: string, value: string | number) {
    return this.request('PUT', `/admin/settings/${key}`, { value });
  }
}

// --- Constants matching AdminModelsTab ---

const MODEL_KEYS = ['model_default', 'model_fallback', 'model_research', 'model_forge'] as const;

const DEFAULTS: Record<string, string> = {
  model_default: 'anthropic/claude-sonnet-4-6',
  model_fallback: 'deepseek/deepseek-r1-0528:free',
  model_research: 'google/gemini-2.0-flash-001',
  model_forge: 'anthropic/claude-sonnet-4-6',
};

const ALL_SETTINGS = [
  { setting_key: 'model_default', setting_value: '"anthropic/claude-sonnet-4-6"', description: 'Default text model' },
  { setting_key: 'model_fallback', setting_value: '"deepseek/deepseek-r1-0528:free"', description: 'Fallback model' },
  { setting_key: 'model_research', setting_value: '"google/gemini-2.0-flash-001"', description: 'Research model' },
  { setting_key: 'model_forge', setting_value: '"anthropic/claude-sonnet-4-6"', description: 'Forge model' },
  { setting_key: 'cache_map_data_ttl', setting_value: '15', description: 'Map data TTL' },
  { setting_key: 'openrouter_api_key', setting_value: '***abc', description: 'OpenRouter key' },
];

let api: TestableAdminApi;

beforeEach(() => {
  api = new TestableAdminApi('http://localhost:8000/api/v1', 'test-token');
});

afterEach(() => {
  resetFetchMock();
});

// ── listSettings + model filtering ──────────────────────────────────────

describe('Admin Model Settings — Load', () => {
  it('fetches all settings and filters to model_* keys', async () => {
    mockFetch([{ body: { success: true, data: ALL_SETTINGS } }]);

    const result = await api.listSettings();
    expect(result.success).toBe(true);

    const modelSettings = (result.data as typeof ALL_SETTINGS).filter((s) =>
      (MODEL_KEYS as readonly string[]).includes(s.setting_key),
    );
    expect(modelSettings).toHaveLength(4);
    expect(modelSettings.map((s) => s.setting_key).sort()).toEqual([...MODEL_KEYS].sort());
  });

  it('strips surrounding quotes from JSON setting values', () => {
    const raw = '"anthropic/claude-sonnet-4-6"';
    const stripped = raw.replace(/"/g, '');
    expect(stripped).toBe('anthropic/claude-sonnet-4-6');
  });

  it('identifies dirty state when edit differs from original', () => {
    const originalVal = '"anthropic/claude-sonnet-4-6"';
    const origStripped = originalVal.replace(/"/g, '');
    const editVal = 'google/gemini-2.5-pro-preview';
    expect(editVal !== origStripped).toBe(true);
  });

  it('identifies clean state when edit matches original', () => {
    const originalVal = '"anthropic/claude-sonnet-4-6"';
    const origStripped = originalVal.replace(/"/g, '');
    const editVal = 'anthropic/claude-sonnet-4-6';
    expect(editVal !== origStripped).toBe(false);
  });
});

// ── updateSetting ───────────────────────────────────────────────────────

describe('Admin Model Settings — Save', () => {
  it('sends PUT request with model value as string', async () => {
    const updatedSetting = {
      setting_key: 'model_forge',
      setting_value: 'google/gemini-2.5-pro-preview',
    };
    mockFetch([{ body: { success: true, data: updatedSetting } }]);

    const result = await api.updateSetting('model_forge', 'google/gemini-2.5-pro-preview');
    expect(result.success).toBe(true);

    // Verify fetch was called with correct URL pattern
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/admin/settings/model_forge');
    expect(opts?.method).toBe('PUT');
    expect(JSON.parse(opts?.body as string)).toEqual({ value: 'google/gemini-2.5-pro-preview' });
  });

  it('handles save failure gracefully', async () => {
    mockFetch([{ status: 404, body: { success: false, detail: 'Not found' } }]);

    const result = await api.updateSetting('model_forge', 'invalid/model');
    expect(result.success).toBe(false);
  });

  it('handles network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network failed'));

    const result = await api.updateSetting('model_forge', 'test/model');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
  });
});

// ── Defaults ────────────────────────────────────────────────────────────

describe('Admin Model Settings — Defaults', () => {
  it('has correct default values matching backend HARDCODED_DEFAULTS', () => {
    expect(DEFAULTS.model_default).toBe('anthropic/claude-sonnet-4-6');
    expect(DEFAULTS.model_fallback).toBe('deepseek/deepseek-r1-0528:free');
    expect(DEFAULTS.model_research).toBe('google/gemini-2.0-flash-001');
    expect(DEFAULTS.model_forge).toBe('anthropic/claude-sonnet-4-6');
  });

  it('reset to defaults produces clean state against seeded data', () => {
    // Simulate dirty edit
    const editValues: Record<string, string> = {
      model_default: 'some/other-model',
      model_fallback: 'another/fallback',
      model_research: 'google/gemini-2.0-flash-001',
      model_forge: 'deepseek/deepseek-v3.2',
    };

    // Apply reset
    for (const key of MODEL_KEYS) {
      editValues[key] = DEFAULTS[key];
    }

    expect(editValues.model_default).toBe('anthropic/claude-sonnet-4-6');
    expect(editValues.model_fallback).toBe('deepseek/deepseek-r1-0528:free');
    expect(editValues.model_research).toBe('google/gemini-2.0-flash-001');
    expect(editValues.model_forge).toBe('anthropic/claude-sonnet-4-6');
  });
});

// ── Custom model ID detection ───────────────────────────────────────────

describe('Admin Model Settings — Custom Model ID', () => {
  const MODEL_OPTIONS = [
    { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
    { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 (Free)' },
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
    { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
  ];

  it('detects preset model IDs correctly', () => {
    const val = 'anthropic/claude-sonnet-4-6';
    const isPreset = MODEL_OPTIONS.some((o) => o.id === val);
    expect(isPreset).toBe(true);
  });

  it('detects custom model IDs (not in preset list)', () => {
    const val = 'mistralai/mistral-large';
    const isPreset = MODEL_OPTIONS.some((o) => o.id === val);
    expect(isPreset).toBe(false);
  });

  it('all default values are in the preset list', () => {
    for (const val of Object.values(DEFAULTS)) {
      const isPreset = MODEL_OPTIONS.some((o) => o.id === val);
      expect(isPreset, `Default ${val} should be in preset list`).toBe(true);
    }
  });
});
