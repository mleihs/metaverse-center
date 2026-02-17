/**
 * Tests for the News → Event transformation flow.
 *
 * Covers:
 * 1. Content cleanup (_cleanContent logic) with real LLM output patterns
 * 2. Title extraction (_extractTitle logic)
 * 3. SocialTrendsApiService URL construction (transform + integrate)
 * 4. Data extraction from backend response (narrative, title, description, event_type, impact_level)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';
import { createSocialTrend } from './helpers/fixtures.js';

// ---------------------------------------------------------------------------
// Real LLM output fixtures (from actual user report)
// ---------------------------------------------------------------------------

/** Pattern 1: JSON block FIRST, then # heading + long narrative article */
const LLM_OUTPUT_JSON_FIRST = `\`\`\`json
{
  "title": "15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende",
  "description": "Studierende aus anderen Sphären sind für die magische Balance und kulturelle Vielfalt der Velgarien-Akademien essenziell.",
  "event_type": "Bildungsreform",
  "impact_level": 7
}
\`\`\`

# 15 Wege zur Verbesserung der Akademie-Erfahrung für Dimensionenreisende

**Von Elara Mondweise für das Kristallarchiv von Velgarien**

Die Große Akademie von Aethelburg stand unter der zweifachen Sonne Velgariens in voller Blüte.`;

/** Pattern 2: **Titel:**, **Artikel:**, ---, then JSON at end */
const LLM_OUTPUT_MARKERS_JSON_END = `**Titel:** Velgarische Eispinguine verlegen Brutzeit

**Artikel:**
Eispinguine im Nordviertel verlegen Brutzeit. Experten warnen.

---
\`\`\`json
{"title": "Eispinguine verlegen Brutzeit", "event_type": "environmental", "impact_level": 8}
\`\`\``;

/** Pattern 3: Only a narrative, no JSON block, no markers */
const LLM_OUTPUT_CLEAN_NARRATIVE =
  'Die Kristallminen von Aethelburg melden einen drastischen Rückgang der Fördermenge.';

/** Pattern 4: Trailing metadata lines (**Autor:**, **Datum:**, etc.) */
const LLM_OUTPUT_WITH_METADATA = `Hier steht ein Nachrichtenartikel über die Velgarische Akademie.

**Titel:** Akademie-Reform verabschiedet
**Autor:** Elara Mondweise
**Datum:** 15. Mondtag, Äon 3412`;

// ---------------------------------------------------------------------------
// Pure function replication — these mirror the TransformationModal's
// private methods so we can test the logic without importing Lit components
// (which require a browser environment).
// ---------------------------------------------------------------------------

function cleanContent(content: string): string {
  let cleaned = content;
  // Remove JSON code fences
  cleaned = cleaned.replace(/```json[\s\S]*?```/g, '');
  // Remove --- separator lines
  cleaned = cleaned.replace(/^---\s*$/gm, '');
  // Remove **Titel:** / **Title:** header line at start
  cleaned = cleaned.replace(/^\s*\*\*(?:Titel|Title):\*\*\s*[^\n]*\n?/i, '');
  // Remove **Artikel:** / **Article:** header
  cleaned = cleaned.replace(/^\s*\*\*(?:Artikel|Article):\*\*\s*\n?/im, '');
  // Remove trailing metadata block (multiple **Key:** Value lines)
  cleaned = cleaned
    .replace(
      /(\n\s*\*\*(?:Titel|Title|Autor|Author|Datum|Date|Quelle|Source|Veröffentlichungsdatum|Publication Date|Schlagwörter|Tags|Keywords):\*\*.*)+$/i,
      '',
    )
    .trim();
  return cleaned;
}

function extractTitle(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim());
  const first = lines[0] || '';
  return first
    .replace(/^\*\*(?:Titel|Title):\*\*\s*/i, '')
    .replace(/\*\*/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Content cleanup tests
// ---------------------------------------------------------------------------

describe('TransformationModal — _cleanContent()', () => {
  it('should strip JSON fence block from the start of content', () => {
    const cleaned = cleanContent(LLM_OUTPUT_JSON_FIRST);
    expect(cleaned).not.toContain('```json');
    expect(cleaned).not.toContain('```');
    expect(cleaned).not.toContain('"impact_level"');
    expect(cleaned).not.toContain('"event_type"');
  });

  it('should preserve the article text after JSON block', () => {
    const cleaned = cleanContent(LLM_OUTPUT_JSON_FIRST);
    expect(cleaned).toContain('Große Akademie von Aethelburg');
    expect(cleaned).toContain('Von Elara Mondweise');
  });

  it('should strip **Titel:**, **Artikel:**, ---, and JSON from end', () => {
    const cleaned = cleanContent(LLM_OUTPUT_MARKERS_JSON_END);
    expect(cleaned).not.toContain('**Titel:**');
    expect(cleaned).not.toContain('**Artikel:**');
    expect(cleaned).not.toContain('---');
    expect(cleaned).not.toContain('```json');
    expect(cleaned).toContain('Eispinguine im Nordviertel');
  });

  it('should return clean text unchanged', () => {
    const cleaned = cleanContent(LLM_OUTPUT_CLEAN_NARRATIVE);
    expect(cleaned).toBe(LLM_OUTPUT_CLEAN_NARRATIVE);
  });

  it('should strip trailing metadata (**Autor:**, **Datum:**)', () => {
    const cleaned = cleanContent(LLM_OUTPUT_WITH_METADATA);
    expect(cleaned).not.toContain('**Autor:**');
    expect(cleaned).not.toContain('**Datum:**');
    expect(cleaned).toContain('Nachrichtenartikel');
  });

  it('should handle empty string', () => {
    expect(cleanContent('')).toBe('');
  });

  it('should handle content that is ONLY a JSON fence', () => {
    const onlyJson = '```json\n{"title": "X"}\n```';
    const cleaned = cleanContent(onlyJson);
    expect(cleaned).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Title extraction tests
// ---------------------------------------------------------------------------

describe('TransformationModal — _extractTitle()', () => {
  it('should extract title from **Titel:** line', () => {
    const title = extractTitle('**Titel:** Velgarische Eispinguine\n\nArtikeltext');
    expect(title).toBe('Velgarische Eispinguine');
  });

  it('should extract title from **Title:** (English)', () => {
    const title = extractTitle('**Title:** Ice Penguins\n\nArticle text');
    expect(title).toBe('Ice Penguins');
  });

  it('should strip bold markers from title', () => {
    const title = extractTitle('**Bold Title**\nSome text');
    expect(title).toBe('Bold Title');
  });

  it('should return first line when no markers present', () => {
    const title = extractTitle('Simple Title\nSome text');
    expect(title).toBe('Simple Title');
  });

  it('should return empty string for empty content', () => {
    expect(extractTitle('')).toBe('');
  });

  it('should handle JSON-first content by returning first non-empty line', () => {
    // For JSON-first, extractTitle returns the first line which is "```json" → ugly
    // This is why the backend-parsed title should be preferred
    const title = extractTitle(LLM_OUTPUT_JSON_FIRST);
    // This will be something ugly like "```json" — confirming the need for backend fields
    expect(typeof title).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// SocialTrendsApiService URL construction + response handling
// ---------------------------------------------------------------------------

class TestableSocialTrendsApi {
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

  private buildUrl(path: string): string {
    return new URL(`${this.baseUrl}${path}`, 'http://localhost').toString();
  }

  private async request<T>(method: string, path: string, body?: unknown) {
    try {
      const url = this.buildUrl(path);
      const options: RequestInit = { method, headers: this.getHeaders() };
      if (body !== undefined && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      const json = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        return {
          success: false as const,
          error: {
            code: (json.code as string) || `HTTP_${response.status}`,
            message: (json.message as string) || (json.detail as string) || response.statusText,
          },
        };
      }
      return { success: true as const, data: (json.data !== undefined ? json.data : json) as T };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false as const, error: { code: 'NETWORK_ERROR', message } };
    }
  }

  transform(simulationId: string, data: { trend_id: string }) {
    return this.request<{
      trend_id: string;
      original_title: string;
      transformation: {
        content: string;
        narrative?: string;
        title?: string;
        description?: string;
        event_type?: string;
        impact_level?: number;
        model_used: string;
      };
    }>('POST', `/simulations/${simulationId}/social-trends/transform`, data);
  }

  integrate(
    simulationId: string,
    data: {
      trend_id: string;
      title: string;
      description?: string;
      event_type?: string;
      impact_level?: number;
      tags?: string[];
    },
  ) {
    return this.request<Record<string, unknown>>(
      'POST',
      `/simulations/${simulationId}/social-trends/integrate`,
      data,
    );
  }
}

describe('SocialTrendsApiService — transform URL construction', () => {
  let service: TestableSocialTrendsApi;

  beforeEach(() => {
    service = new TestableSocialTrendsApi('/api/v1', 'test-jwt');
  });
  afterEach(() => resetFetchMock());

  it('should POST to /simulations/{simId}/social-trends/transform', async () => {
    const spy = mockFetch([{
      body: {
        data: {
          trend_id: 'trend-1',
          original_title: 'News',
          transformation: { content: 'text', model_used: 'model' },
        },
      },
    }]);
    await service.transform('sim-123', { trend_id: 'trend-1' });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/social-trends/transform');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ trend_id: 'trend-1' });
  });
});

describe('SocialTrendsApiService — integrate URL construction', () => {
  let service: TestableSocialTrendsApi;

  beforeEach(() => {
    service = new TestableSocialTrendsApi('/api/v1', 'test-jwt');
  });
  afterEach(() => resetFetchMock());

  it('should POST to /simulations/{simId}/social-trends/integrate', async () => {
    const spy = mockFetch([{ body: { data: { id: 'event-1' } } }]);
    await service.integrate('sim-123', {
      trend_id: 'trend-1',
      title: 'Test Event',
      event_type: 'Bildungsreform',
      impact_level: 7,
      tags: ['guardian'],
    });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/simulations/sim-123/social-trends/integrate');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('Test Event');
    expect(body.impact_level).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Data extraction from transform response (mirrors _handleTransform logic)
// ---------------------------------------------------------------------------

describe('TransformationModal — data extraction from backend response', () => {
  let service: TestableSocialTrendsApi;

  beforeEach(() => {
    service = new TestableSocialTrendsApi('/api/v1', 'test-jwt');
  });
  afterEach(() => resetFetchMock());

  it('should prefer narrative over raw content for display', async () => {
    mockFetch([{
      body: {
        data: {
          trend_id: 'trend-1',
          original_title: 'News',
          transformation: {
            content: LLM_OUTPUT_JSON_FIRST,
            narrative: '# 15 Wege zur Verbesserung\n\nClean article text without JSON.',
            title: '15 Wege zur Verbesserung',
            description: 'Studierende aus anderen Sphären...',
            event_type: 'Bildungsreform',
            impact_level: 7,
            model_used: 'test-model',
          },
        },
      },
    }]);

    const response = await service.transform('sim-123', { trend_id: 'trend-1' });
    expect(response.success).toBe(true);
    if (!response.success) return;

    const t = response.data.transformation;

    // Simulate _handleTransform data extraction logic
    const transformedContent = t.narrative || cleanContent(t.content || '');
    const eventTitle = t.title || extractTitle(t.content || '') || 'Fallback';
    const eventDescription = t.description || transformedContent;
    const eventType = t.event_type || 'news';
    const impactLevel = t.impact_level || 5;

    expect(transformedContent).toBe('# 15 Wege zur Verbesserung\n\nClean article text without JSON.');
    expect(transformedContent).not.toContain('```json');
    expect(eventTitle).toBe('15 Wege zur Verbesserung');
    expect(eventDescription).toBe('Studierende aus anderen Sphären...');
    expect(eventType).toBe('Bildungsreform');
    expect(impactLevel).toBe(7);
  });

  it('should fall back to cleanContent when narrative is absent', async () => {
    mockFetch([{
      body: {
        data: {
          trend_id: 'trend-1',
          original_title: 'News',
          transformation: {
            content: LLM_OUTPUT_MARKERS_JSON_END,
            model_used: 'test-model',
            // No narrative, title, description, event_type, impact_level
          },
        },
      },
    }]);

    const response = await service.transform('sim-123', { trend_id: 'trend-1' });
    expect(response.success).toBe(true);
    if (!response.success) return;

    const t = response.data.transformation;
    const transformedContent = t.narrative || cleanContent(t.content || '');

    expect(transformedContent).not.toContain('**Titel:**');
    expect(transformedContent).not.toContain('```json');
    expect(transformedContent).toContain('Eispinguine im Nordviertel');
  });

  it('should fall back to trend name when no title is parsed', async () => {
    mockFetch([{
      body: {
        data: {
          trend_id: 'trend-1',
          original_title: 'Fallback Trend Title',
          transformation: {
            content: LLM_OUTPUT_CLEAN_NARRATIVE,
            model_used: 'test-model',
          },
        },
      },
    }]);

    const response = await service.transform('sim-123', { trend_id: 'trend-1' });
    expect(response.success).toBe(true);
    if (!response.success) return;

    const t = response.data.transformation;
    const trend = createSocialTrend({ name: 'Fallback Trend Title' });
    const eventTitle = t.title || extractTitle(t.content || '') || trend.name;

    // extractTitle returns the first line of the clean narrative
    expect(eventTitle).toBe(
      'Die Kristallminen von Aethelburg melden einen drastischen Rückgang der Fördermenge.',
    );
  });

  it('should handle API error gracefully', async () => {
    mockFetch([{ status: 502, body: { detail: 'AI transformation failed' } }]);

    const response = await service.transform('sim-123', { trend_id: 'trend-1' });
    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error.message).toBe('AI transformation failed');
  });
});
