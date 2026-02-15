import type {
  ApiResponse,
  Building,
  BuildingAgentRelation,
  BuildingProfessionRequirement,
  PaginatedResponse,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class BuildingsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Building>>> {
    return this.get(`/simulations/${simulationId}/buildings`, params);
  }

  getById(simulationId: string, buildingId: string): Promise<ApiResponse<Building>> {
    return this.get(`/simulations/${simulationId}/buildings/${buildingId}`);
  }

  create(simulationId: string, data: Partial<Building>): Promise<ApiResponse<Building>> {
    return this.post(`/simulations/${simulationId}/buildings`, data);
  }

  update(
    simulationId: string,
    buildingId: string,
    data: Partial<Building>,
  ): Promise<ApiResponse<Building>> {
    return this.put(`/simulations/${simulationId}/buildings/${buildingId}`, data);
  }

  remove(simulationId: string, buildingId: string): Promise<ApiResponse<Building>> {
    return this.delete(`/simulations/${simulationId}/buildings/${buildingId}`);
  }

  getAgents(
    simulationId: string,
    buildingId: string,
  ): Promise<ApiResponse<BuildingAgentRelation[]>> {
    return this.get(`/simulations/${simulationId}/buildings/${buildingId}/agents`);
  }

  assignAgent(
    simulationId: string,
    buildingId: string,
    agentId: string,
    relationType?: string,
  ): Promise<ApiResponse<BuildingAgentRelation>> {
    return this.post(`/simulations/${simulationId}/buildings/${buildingId}/agents`, {
      agent_id: agentId,
      relation_type: relationType,
    });
  }

  unassignAgent(
    simulationId: string,
    buildingId: string,
    agentId: string,
  ): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/buildings/${buildingId}/agents/${agentId}`);
  }

  getProfessionRequirements(
    simulationId: string,
    buildingId: string,
  ): Promise<ApiResponse<BuildingProfessionRequirement[]>> {
    return this.get(`/simulations/${simulationId}/buildings/${buildingId}/profession-requirements`);
  }

  setProfessionRequirement(
    simulationId: string,
    buildingId: string,
    data: Partial<BuildingProfessionRequirement>,
  ): Promise<ApiResponse<BuildingProfessionRequirement>> {
    return this.post(
      `/simulations/${simulationId}/buildings/${buildingId}/profession-requirements`,
      data,
    );
  }
}

export const buildingsApi = new BuildingsApiService();
