import type { AgentRelationship, ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class RelationshipsApiService extends BaseApiService {
  listForAgent(
    simulationId: string,
    agentId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<AgentRelationship[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/agents/${agentId}/relationships`,
      mode,
    );
  }

  listForSimulation(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<AgentRelationship[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/relationships`, mode, params);
  }

  create(
    simulationId: string,
    agentId: string,
    data: {
      target_agent_id: string;
      relationship_type: string;
      is_bidirectional?: boolean;
      intensity?: number;
      description?: string;
    },
  ): Promise<ApiResponse<AgentRelationship>> {
    return this.post(`/simulations/${simulationId}/agents/${agentId}/relationships`, data);
  }

  update(
    simulationId: string,
    relationshipId: string,
    data: {
      relationship_type?: string;
      is_bidirectional?: boolean;
      intensity?: number;
      description?: string;
    },
  ): Promise<ApiResponse<AgentRelationship>> {
    return this.patch(`/simulations/${simulationId}/relationships/${relationshipId}`, data);
  }

  remove(simulationId: string, relationshipId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/simulations/${simulationId}/relationships/${relationshipId}`);
  }
}

export const relationshipsApi = new RelationshipsApiService();
