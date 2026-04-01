import type { ApiResponse, Chronicle } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class ChronicleApiService extends BaseApiService {
  /** Cross-simulation chronicle feed — recent chronicles from all worlds. */
  listGlobal(params?: { limit?: number; offset?: number }): Promise<ApiResponse<Chronicle[]>> {
    const p: Record<string, string> = {};
    if (params?.limit != null) p.limit = String(params.limit);
    if (params?.offset != null) p.offset = String(params.offset);
    return this.getPublic('/chronicles', p);
  }

  list(
    simulationId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<ApiResponse<Chronicle[]>> {
    const p: Record<string, string> = {};
    if (params?.limit != null) p.limit = String(params.limit);
    if (params?.offset != null) p.offset = String(params.offset);
    return this.getSimulationData(`/simulations/${simulationId}/chronicles`, p);
  }

  getOne(simulationId: string, chronicleId: string): Promise<ApiResponse<Chronicle>> {
    return this.getSimulationData(`/simulations/${simulationId}/chronicles/${chronicleId}`);
  }

  generate(
    simulationId: string,
    data: { period_start: string; period_end: string; epoch_id?: string; locale?: string },
  ): Promise<ApiResponse<Chronicle>> {
    return this.post(`/simulations/${simulationId}/chronicles`, data);
  }
}

export const chronicleApi = new ChronicleApiService();
