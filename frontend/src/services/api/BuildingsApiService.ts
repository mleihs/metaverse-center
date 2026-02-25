import type {
  ApiResponse,
  Building,
  BuildingAgentRelation,
  BuildingProfessionRequirement,
  PaginatedResponse,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class BuildingsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Building>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/buildings`, params);
    }
    return this.get(`/simulations/${simulationId}/buildings`, params);
  }

  getById(simulationId: string, buildingId: string): Promise<ApiResponse<Building>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/buildings/${buildingId}`);
    }
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
    const params = new URLSearchParams({ agent_id: agentId });
    if (relationType) params.set('relation_type', relationType);
    return this.post(`/simulations/${simulationId}/buildings/${buildingId}/assign-agent?${params}`);
  }

  unassignAgent(
    simulationId: string,
    buildingId: string,
    agentId: string,
  ): Promise<ApiResponse<void>> {
    return this.delete(
      `/simulations/${simulationId}/buildings/${buildingId}/unassign-agent?agent_id=${agentId}`,
    );
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
    const params = new URLSearchParams();
    if (data.profession) params.set('profession', data.profession);
    if (data.min_qualification_level != null)
      params.set('min_qualification_level', String(data.min_qualification_level));
    if (data.is_mandatory != null) params.set('is_mandatory', String(data.is_mandatory));
    return this.post(
      `/simulations/${simulationId}/buildings/${buildingId}/profession-requirements?${params}`,
    );
  }
}

export const buildingsApi = new BuildingsApiService();
