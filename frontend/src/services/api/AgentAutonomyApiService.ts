import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

// ── Response Types ──────────────────────────────────────────────────────────

export interface AgentMood {
  id: string;
  agent_id: string;
  simulation_id: string;
  mood_score: number;
  dominant_emotion: string;
  stress_level: number;
  resilience: number;
  volatility: number;
  sociability: number;
  last_tick_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMoodlet {
  id: string;
  agent_id: string;
  moodlet_type: string;
  emotion: string;
  strength: number;
  source_type: string;
  source_id: string | null;
  source_description: string | null;
  decay_type: 'permanent' | 'timed' | 'decaying';
  initial_strength: number;
  expires_at: string | null;
  stacking_group: string | null;
  created_at: string;
}

export interface AgentNeeds {
  id: string;
  agent_id: string;
  simulation_id: string;
  social: number;
  purpose: number;
  safety: number;
  comfort: number;
  stimulation: number;
  social_decay: number;
  purpose_decay: number;
  safety_decay: number;
  comfort_decay: number;
  stimulation_decay: number;
  updated_at: string;
}

export interface AgentOpinion {
  id: string;
  agent_id: string;
  target_agent_id: string;
  simulation_id: string;
  opinion_score: number;
  base_compatibility: number;
  last_interaction_at: string | null;
  interaction_count: number;
  target_agent_name: string | null;
  target_agent_portrait: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpinionModifier {
  id: string;
  agent_id: string;
  target_agent_id: string;
  modifier_type: string;
  opinion_change: number;
  decay_type: string;
  initial_value: number;
  expires_at: string | null;
  stacking_group: string | null;
  source_event_id: string | null;
  description: string | null;
  created_at: string;
}

export interface AgentActivity {
  id: string;
  agent_id: string;
  simulation_id: string;
  activity_type: string;
  activity_subtype: string | null;
  location_zone_id: string | null;
  location_building_id: string | null;
  target_agent_id: string | null;
  related_event_id: string | null;
  narrative_text: string | null;
  narrative_text_de: string | null;
  significance: number;
  effects: Record<string, unknown>;
  heartbeat_tick_id: string | null;
  created_at: string;
  agent_name: string | null;
  agent_portrait: string | null;
  target_agent_name: string | null;
  zone_name: string | null;
  building_name: string | null;
}

export interface SimulationMoodSummary {
  simulation_id: string;
  agent_count: number;
  avg_mood_score: number;
  avg_stress_level: number;
  agents_in_crisis: number;
  agents_happy: number;
  agents_unhappy: number;
  dominant_emotions: Record<string, number>;
}

export interface MorningBriefing {
  simulation_id: string;
  since: string;
  critical_activities: AgentActivity[];
  important_activities: AgentActivity[];
  routine_summary: string | null;
  routine_summary_de: string | null;
  mood_summary: SimulationMoodSummary | null;
  opinion_changes: Record<string, unknown>[];
  relationship_events: Record<string, unknown>[];
  narrative_text: string | null;
  narrative_text_de: string | null;
}

// ── API Service ─────────────────────────────────────────────────────────────

export class AgentAutonomyApiService extends BaseApiService {
  // ── Agent Mood ────────────────────────────────────────────────

  getAgentMood(simulationId: string, agentId: string): Promise<ApiResponse<AgentMood | null>> {
    return this.get(`/simulations/${simulationId}/agents/${agentId}/mood`);
  }

  getAgentMoodlets(simulationId: string, agentId: string): Promise<ApiResponse<AgentMoodlet[]>> {
    return this.get(`/simulations/${simulationId}/agents/${agentId}/moodlets`);
  }

  // ── Agent Needs ───────────────────────────────────────────────

  getAgentNeeds(simulationId: string, agentId: string): Promise<ApiResponse<AgentNeeds | null>> {
    return this.get(`/simulations/${simulationId}/agents/${agentId}/needs`);
  }

  // ── Agent Opinions ────────────────────────────────────────────

  getAgentOpinions(simulationId: string, agentId: string): Promise<ApiResponse<AgentOpinion[]>> {
    return this.get(`/simulations/${simulationId}/agents/${agentId}/opinions`);
  }

  getOpinionModifiers(
    simulationId: string,
    agentId: string,
    targetAgentId?: string,
  ): Promise<ApiResponse<OpinionModifier[]>> {
    const params: Record<string, string> = {};
    if (targetAgentId) params.target_agent_id = targetAgentId;
    return this.get(
      `/simulations/${simulationId}/agents/${agentId}/opinion-modifiers`,
      params,
    );
  }

  // ── Activities ────────────────────────────────────────────────

  listActivities(
    simulationId: string,
    params?: {
      limit?: number;
      offset?: number;
      agent_id?: string;
      activity_type?: string;
      min_significance?: number;
      since_hours?: number;
    },
  ): Promise<ApiResponse<AgentActivity[]>> {
    const queryParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) queryParams[k] = String(v);
      }
    }
    return this.get(`/simulations/${simulationId}/activities`, queryParams);
  }

  // ── Simulation-Level ──────────────────────────────────────────

  getMoodSummary(simulationId: string): Promise<ApiResponse<SimulationMoodSummary>> {
    return this.get(`/simulations/${simulationId}/mood-summary`);
  }

  getMorningBriefing(
    simulationId: string,
    sinceHours = 24,
    mode: 'narrative' | 'data' = 'narrative',
  ): Promise<ApiResponse<MorningBriefing>> {
    return this.get(`/simulations/${simulationId}/briefing`, {
      since_hours: String(sinceHours),
      mode,
    });
  }
}

export const agentAutonomyApi = new AgentAutonomyApiService();
