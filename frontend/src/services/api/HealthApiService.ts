import type { BleedStatus } from '../../types/health.js';
import type {
  ApiResponse,
  BuildingReadiness,
  EmbassyEffectiveness,
  SimulationHealth,
  SimulationHealthDashboard,
  ZoneStability,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class HealthApiService extends BaseApiService {
  getDashboard(simulationId: string): Promise<ApiResponse<SimulationHealthDashboard>> {
    return this.getSimulationData(`/simulations/${simulationId}/health`);
  }

  getSimulationHealth(simulationId: string): Promise<ApiResponse<SimulationHealth>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/simulation`);
  }

  listBuildingReadiness(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<BuildingReadiness[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/buildings`, params);
  }

  listZoneStability(simulationId: string): Promise<ApiResponse<ZoneStability[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/zones`);
  }

  listEmbassyEffectiveness(simulationId: string): Promise<ApiResponse<EmbassyEffectiveness[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/embassies`);
  }

  listAllSimulationsHealth(): Promise<ApiResponse<SimulationHealth[]>> {
    return this.getPublic('/health/all');
  }

  getBleedStatus(simulationId: string): Promise<ApiResponse<BleedStatus>> {
    return this.getPublic(`/simulations/${simulationId}/bleed-status`);
  }

  executeThresholdAction(
    simulationId: string,
    actionType: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.post(`/simulations/${simulationId}/threshold-actions/${actionType}${query}`);
  }

  refreshMetrics(simulationId: string): Promise<ApiResponse<{ message: string }>> {
    return this.post(`/simulations/${simulationId}/health/refresh`);
  }
}

export const healthApi = new HealthApiService();
