import type { ApiResponse, EchoVector, Embassy } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class EmbassiesApiService extends BaseApiService {
  listForSimulation(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<Embassy[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/embassies`, mode, params);
  }

  getById(
    simulationId: string,
    embassyId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Embassy>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/embassies/${embassyId}`,
      mode,
    );
  }

  getForBuilding(
    simulationId: string,
    buildingId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Embassy | null>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/buildings/${buildingId}/embassy`,
      mode,
    );
  }

  create(
    simulationId: string,
    data: {
      building_a_id: string;
      simulation_a_id: string;
      building_b_id: string;
      simulation_b_id: string;
      connection_type?: string;
      description?: string;
      established_by?: string;
      bleed_vector?: EchoVector;
      event_propagation?: boolean;
      embassy_metadata?: Record<string, unknown>;
    },
  ): Promise<ApiResponse<Embassy>> {
    return this.post(`/simulations/${simulationId}/embassies`, data);
  }

  update(
    simulationId: string,
    embassyId: string,
    data: {
      description?: string;
      established_by?: string;
      bleed_vector?: EchoVector;
      event_propagation?: boolean;
      embassy_metadata?: Record<string, unknown>;
    },
  ): Promise<ApiResponse<Embassy>> {
    return this.patch(`/simulations/${simulationId}/embassies/${embassyId}`, data);
  }

  activate(simulationId: string, embassyId: string): Promise<ApiResponse<Embassy>> {
    return this.patch(`/simulations/${simulationId}/embassies/${embassyId}/activate`);
  }

  suspend(simulationId: string, embassyId: string): Promise<ApiResponse<Embassy>> {
    return this.patch(`/simulations/${simulationId}/embassies/${embassyId}/suspend`);
  }

  dissolve(simulationId: string, embassyId: string): Promise<ApiResponse<Embassy>> {
    return this.patch(`/simulations/${simulationId}/embassies/${embassyId}/dissolve`);
  }

  listAllActive(): Promise<ApiResponse<Embassy[]>> {
    return this.getPublic('/embassies');
  }
}

export const embassiesApi = new EmbassiesApiService();
