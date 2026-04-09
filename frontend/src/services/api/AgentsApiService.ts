import type {
  Agent,
  AgentAptitude,
  ApiResponse,
  AptitudeSet,
  EventReaction,
} from '../../types/index.js';
import { CrudApiService } from './CrudApiService.js';

export class AgentsApiService extends CrudApiService<Agent> {
  protected readonly resource = 'agents';

  override listPublic(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<Agent[]>> {
    return super.listPublic(simulationId, params);
  }

  override getBySlug(simulationId: string, slug: string): Promise<ApiResponse<Agent>> {
    return super.getBySlug(simulationId, slug);
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
