import type { BleedStatus } from '../../types/health.js';
import type {
  ApiResponse,
  BuildingReadiness,
  SimulationHealthDashboard,
  ZoneStability,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class HealthApiService extends BaseApiService {
  getDashboard(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<SimulationHealthDashboard>> {
    return this.getSimulationData(`/simulations/${simulationId}/health`, mode);
  }

  listBuildingReadiness(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<BuildingReadiness[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/buildings`, mode, params);
  }

  listZoneStability(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<ZoneStability[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/health/zones`, mode);
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
