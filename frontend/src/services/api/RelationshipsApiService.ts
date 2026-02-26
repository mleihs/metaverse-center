import type { AgentRelationship, ApiResponse, PaginatedResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class RelationshipsApiService extends BaseApiService {
  listForAgent(simulationId: string, agentId: string): Promise<ApiResponse<AgentRelationship[]>> {
    const path = `/simulations/${simulationId}/agents/${agentId}/relationships`;
    if (!appState.isAuthenticated.value) {
      return this.getPublic(path);
    }
    return this.get(path);
  }

  listForSimulation(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<AgentRelationship>>> {
    const path = `/simulations/${simulationId}/relationships`;
    if (!appState.isAuthenticated.value) {
      return this.getPublic(path, params);
    }
    return this.get(path, params);
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
