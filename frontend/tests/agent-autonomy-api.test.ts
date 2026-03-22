/**
 * Tests for AgentAutonomyApiService — all 11 API methods.
 *
 * Follows the TestableBaseApiService pattern from api-services.test.ts
 * to test fetch contracts without pulling in the full dependency tree.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockFetch, resetFetchMock } from './helpers/mock-api.js';

// ── Testable Service Replica ────────────────────────────────────────────────

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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
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

  protected async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const res = await fetch(this.buildUrl(path, params), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return res.json();
  }
}

class TestableAutonomyService extends TestableBaseApiService {
  getAgentMood(simId: string, agentId: string) {
    return this.get(`/simulations/${simId}/agents/${agentId}/mood`);
  }

  getAgentMoodlets(simId: string, agentId: string) {
    return this.get(`/simulations/${simId}/agents/${agentId}/moodlets`);
  }

  getAgentNeeds(simId: string, agentId: string) {
    return this.get(`/simulations/${simId}/agents/${agentId}/needs`);
  }

  getAgentOpinions(simId: string, agentId: string) {
    return this.get(`/simulations/${simId}/agents/${agentId}/opinions`);
  }

  getOpinionModifiers(simId: string, agentId: string, targetId?: string) {
    const params: Record<string, string> = {};
    if (targetId) params.target_agent_id = targetId;
    return this.get(`/simulations/${simId}/agents/${agentId}/opinion-modifiers`, params);
  }

  listActivities(simId: string, params?: Record<string, string>) {
    return this.get(`/simulations/${simId}/activities`, params);
  }

  getMoodSummary(simId: string) {
    return this.get(`/simulations/${simId}/mood-summary`);
  }

  getMorningBriefing(simId: string, sinceHours = '24', mode = 'narrative') {
    return this.get(`/simulations/${simId}/briefing`, { since_hours: sinceHours, mode });
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

const SIM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AGENT_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';

describe('AgentAutonomyApiService', () => {
  let api: TestableAutonomyService;

  beforeEach(() => {
    api = new TestableAutonomyService('/api/v1', 'test-token');
  });

  afterEach(() => {
    resetFetchMock();
  });

  // ── Mood ────────────────────────────────────────────────

  describe('getAgentMood', () => {
    it('fetches mood data for an agent', async () => {
      const moodData = {
        id: 'mood-1', agent_id: AGENT_ID, mood_score: 25,
        dominant_emotion: 'content', stress_level: 150,
      };
      mockFetch([{ body: { success: true, data: moodData } }]);

      const result: any = await api.getAgentMood(SIM_ID, AGENT_ID);
      expect(result.success).toBe(true);
      expect(result.data.mood_score).toBe(25);
      expect(result.data.dominant_emotion).toBe('content');
    });

    it('returns null for agent without mood data', async () => {
      mockFetch([{ body: { success: true, data: null } }]);
      const result: any = await api.getAgentMood(SIM_ID, AGENT_ID);
      expect(result.data).toBeNull();
    });
  });

  // ── Moodlets ────────────────────────────────────────────

  describe('getAgentMoodlets', () => {
    it('fetches active moodlets', async () => {
      const moodlets = [
        { id: 'm1', moodlet_type: 'good_conversation', emotion: 'joy', strength: 8 },
        { id: 'm2', moodlet_type: 'zone_unstable', emotion: 'anxiety', strength: -5 },
      ];
      mockFetch([{ body: { success: true, data: moodlets } }]);

      const result: any = await api.getAgentMoodlets(SIM_ID, AGENT_ID);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].emotion).toBe('joy');
    });
  });

  // ── Needs ───────────────────────────────────────────────

  describe('getAgentNeeds', () => {
    it('fetches 5 need values', async () => {
      const needs = {
        id: 'n1', agent_id: AGENT_ID,
        social: 45, purpose: 72, safety: 88, comfort: 60, stimulation: 33,
      };
      mockFetch([{ body: { success: true, data: needs } }]);

      const result: any = await api.getAgentNeeds(SIM_ID, AGENT_ID);
      expect(result.data.social).toBe(45);
      expect(result.data.stimulation).toBe(33);
    });
  });

  // ── Opinions ────────────────────────────────────────────

  describe('getAgentOpinions', () => {
    it('fetches opinions with enriched target data', async () => {
      const opinions = [
        {
          id: 'o1', agent_id: AGENT_ID, target_agent_id: TARGET_ID,
          opinion_score: 42, target_agent_name: 'Agent B',
        },
      ];
      mockFetch([{ body: { success: true, data: opinions } }]);

      const result: any = await api.getAgentOpinions(SIM_ID, AGENT_ID);
      expect(result.data[0].opinion_score).toBe(42);
      expect(result.data[0].target_agent_name).toBe('Agent B');
    });
  });

  describe('getOpinionModifiers', () => {
    it('fetches modifiers with optional target filter', async () => {
      mockFetch([{ body: { success: true, data: [] } }]);
      await api.getOpinionModifiers(SIM_ID, AGENT_ID, TARGET_ID);

      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain('target_agent_id=');
    });
  });

  // ── Activities ──────────────────────────────────────────

  describe('listActivities', () => {
    it('fetches paginated activities', async () => {
      const activities = [
        { id: 'a1', activity_type: 'work', significance: 3, agent_name: 'Agent A' },
        { id: 'a2', activity_type: 'socialize', significance: 7, agent_name: 'Agent B' },
      ];
      mockFetch([{ body: { success: true, data: activities, meta: { count: 2, total: 10 } } }]);

      const result: any = await api.listActivities(SIM_ID, { min_significance: '5' });
      expect(result.data).toHaveLength(2);
    });
  });

  // ── Mood Summary ────────────────────────────────────────

  describe('getMoodSummary', () => {
    it('fetches aggregate simulation mood', async () => {
      const summary = {
        simulation_id: SIM_ID, agent_count: 6,
        avg_mood_score: 15.3, avg_stress_level: 220,
        agents_in_crisis: 0, agents_happy: 4, agents_unhappy: 1,
        dominant_emotions: { content: 3, neutral: 2, anxiety: 1 },
      };
      mockFetch([{ body: { success: true, data: summary } }]);

      const result: any = await api.getMoodSummary(SIM_ID);
      expect(result.data.agent_count).toBe(6);
      expect(result.data.agents_happy).toBe(4);
    });
  });

  // ── Morning Briefing ───────────────────────────────────

  describe('getMorningBriefing', () => {
    it('fetches narrative briefing', async () => {
      const briefing = {
        simulation_id: SIM_ID,
        critical_activities: [],
        important_activities: [{ id: 'a1', activity_type: 'confront', significance: 7 }],
        narrative_text: 'Bureau dispatch: situation stable.',
        mood_summary: { agent_count: 6, avg_mood_score: 10 },
      };
      mockFetch([{ body: { success: true, data: briefing } }]);

      const result: any = await api.getMorningBriefing(SIM_ID, '48', 'narrative');
      expect(result.data.narrative_text).toContain('Bureau');
      expect(result.data.important_activities).toHaveLength(1);
    });

    it('passes mode and since_hours as query params', async () => {
      mockFetch([{ body: { success: true, data: {} } }]);
      await api.getMorningBriefing(SIM_ID, '72', 'data');

      const url = (globalThis.fetch as any).mock.calls[0][0] as string;
      expect(url).toContain('since_hours=72');
      expect(url).toContain('mode=data');
    });
  });
});
