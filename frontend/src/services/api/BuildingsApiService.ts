import type {
  ApiResponse,
  Building,
  BuildingAgentRelation,
  BuildingProfessionRequirement,
} from '../../types/index.js';
import { CrudApiService } from './CrudApiService.js';

export class BuildingsApiService extends CrudApiService<Building> {
  protected readonly resource = 'buildings';

  override listPublic(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<Building[]>> {
    return super.listPublic(simulationId, params);
  }

  override getBySlug(simulationId: string, slug: string): Promise<ApiResponse<Building>> {
    return super.getBySlug(simulationId, slug);
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
