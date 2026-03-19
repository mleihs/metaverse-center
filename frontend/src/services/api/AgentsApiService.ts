import type {
  Agent,
  AgentAptitude,
  ApiResponse,
  AptitudeSet,
  EventReaction,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class AgentsApiService extends BaseApiService {
  list(simulationId: string, params?: Record<string, string>): Promise<ApiResponse<Agent[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/agents`, params);
  }

  getById(simulationId: string, agentId: string): Promise<ApiResponse<Agent>> {
    return this.getSimulationData(`/simulations/${simulationId}/agents/${agentId}`);
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

  getBySlug(simulationId: string, slug: string): Promise<ApiResponse<Agent>> {
    return this.getPublic(`/simulations/${simulationId}/agents/by-slug/${slug}`);
  }

  listPublic(simulationId: string, params?: Record<string, string>): Promise<ApiResponse<Agent[]>> {
    return this.getPublic(`/simulations/${simulationId}/agents`, params);
  }

  getAptitudes(simulationId: string, agentId: string): Promise<ApiResponse<AgentAptitude[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/agents/${agentId}/aptitudes`);
  }

  setAptitudes(
    simulationId: string,
    agentId: string,
    aptitudes: AptitudeSet,
  ): Promise<ApiResponse<AgentAptitude[]>> {
    return this.put(`/simulations/${simulationId}/agents/${agentId}/aptitudes`, aptitudes);
  }

  getAllAptitudes(simulationId: string): Promise<ApiResponse<AgentAptitude[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/aptitudes`);
  }
}

export const agentsApi = new AgentsApiService();
