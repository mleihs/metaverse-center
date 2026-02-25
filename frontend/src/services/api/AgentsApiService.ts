import type { Agent, ApiResponse, EventReaction, PaginatedResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class AgentsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Agent>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/agents`, params);
    }
    return this.get(`/simulations/${simulationId}/agents`, params);
  }

  getById(simulationId: string, agentId: string): Promise<ApiResponse<Agent>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/agents/${agentId}`);
    }
    return this.get(`/simulations/${simulationId}/agents/${agentId}`);
  }

  create(simulationId: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> {
    return this.post(`/simulations/${simulationId}/agents`, data);
  }

  update(simulationId: string, agentId: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> {
    return this.put(`/simulations/${simulationId}/agents/${agentId}`, data);
  }

  remove(simulationId: string, agentId: string): Promise<ApiResponse<Agent>> {
    return this.delete(`/simulations/${simulationId}/agents/${agentId}`);
  }

  getReactions(simulationId: string, agentId: string): Promise<ApiResponse<EventReaction[]>> {
    return this.get(`/simulations/${simulationId}/agents/${agentId}/reactions`);
  }

  deleteReaction(
    simulationId: string,
    agentId: string,
    reactionId: string,
  ): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/agents/${agentId}/reactions/${reactionId}`);
  }

  generatePortrait(
    simulationId: string,
    agentId: string,
  ): Promise<ApiResponse<{ image_url: string }>> {
    return this.post(`/simulations/${simulationId}/agents/${agentId}/generate-portrait`);
  }
}

export const agentsApi = new AgentsApiService();
