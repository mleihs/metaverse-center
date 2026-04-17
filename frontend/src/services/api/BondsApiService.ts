/**
 * Agent Bonds API service.
 *
 * Uses query-param pattern (simulation_id as query param, not path segment)
 * because bonds are player-scoped across simulations, matching the backend
 * router at /api/v1/bonds.
 */

import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface Bond {
  id: string;
  user_id: string;
  agent_id: string;
  simulation_id: string;
  depth: number;
  status: 'forming' | 'active' | 'strained' | 'farewell';
  attention_score: number;
  formed_at: string | null;
  created_at: string;
  updated_at: string;
  agent_name: string | null;
  agent_portrait_url: string | null;
}

export interface BondDetail extends Bond {
  recent_whispers: Whisper[];
  unread_count: number;
  agent_mood_score: number | null;
  agent_dominant_emotion: string | null;
  agent_stress_level: number | null;
}

export interface Whisper {
  id: string;
  bond_id: string;
  whisper_type: 'state' | 'event' | 'memory' | 'question' | 'reflection';
  content_de: string;
  content_en: string;
  trigger_context: Record<string, unknown>;
  read_at: string | null;
  acted_on: boolean;
  action_acknowledged: boolean;
  created_at: string;
}

export interface RecognitionCandidate {
  agent_id: string;
  agent_name: string;
  agent_portrait_url: string | null;
  attention_score: number;
  simulation_id: string;
}

export class BondsApiService extends BaseApiService {
  private readonly base = '/bonds';

  /** List all bonds for the current user in a simulation. */
  listBonds(simulationId: string): Promise<ApiResponse<Bond[]>> {
    return this.get(this.base, { simulation_id: simulationId });
  }

  /** Get detailed bond info with recent whispers and agent mood. */
  getBondDetail(bondId: string): Promise<ApiResponse<BondDetail>> {
    return this.get(`${this.base}/${bondId}`);
  }

  /** Track that the user viewed an agent's detail page. */
  trackAttention(
    simulationId: string,
    agentId: string,
  ): Promise<ApiResponse<Bond>> {
    return this.post(
      `${this.base}/track-attention?simulation_id=${simulationId}`,
      { agent_id: agentId },
    );
  }

  /** Check for agents that crossed the recognition threshold. */
  getRecognitionCandidates(
    simulationId: string,
  ): Promise<ApiResponse<RecognitionCandidate[]>> {
    return this.get(`${this.base}/recognition-candidates`, {
      simulation_id: simulationId,
    });
  }

  /** Accept a bond with an agent after recognition. */
  formBond(
    simulationId: string,
    agentId: string,
  ): Promise<ApiResponse<Bond>> {
    return this.post(
      `${this.base}/form?simulation_id=${simulationId}`,
      { agent_id: agentId },
    );
  }

  /** Get paginated whispers for a bond. */
  listWhispers(
    bondId: string,
    limit = 25,
    offset = 0,
  ): Promise<ApiResponse<Whisper[]>> {
    return this.get(`${this.base}/${bondId}/whispers`, {
      limit: String(limit),
      offset: String(offset),
    });
  }

  /** Mark a whisper as read. */
  markWhisperRead(
    bondId: string,
    whisperId: string,
  ): Promise<ApiResponse<Whisper>> {
    return this.post(
      `${this.base}/${bondId}/whispers/${whisperId}/read`,
    );
  }

  /** Mark a whisper as acted upon. */
  markWhisperActed(
    bondId: string,
    whisperId: string,
  ): Promise<ApiResponse<Whisper>> {
    return this.post(
      `${this.base}/${bondId}/whispers/${whisperId}/acted`,
    );
  }
}

export const bondsApi = new BondsApiService();
