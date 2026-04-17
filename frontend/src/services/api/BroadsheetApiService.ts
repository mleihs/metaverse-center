import type { ApiResponse, Broadsheet } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class BroadsheetApiService extends BaseApiService {
  list(
    simulationId: string,
    mode: 'public' | 'member',
    params?: { limit?: number; offset?: number } | Record<string, string>,
  ): Promise<ApiResponse<Broadsheet[]>> {
    const p: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null) p[k] = String(v);
      }
    }
    return this.getSimulationData(`/simulations/${simulationId}/broadsheets`, mode, p);
  }

  getLatest(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Broadsheet | null>> {
    return this.getSimulationData(`/simulations/${simulationId}/broadsheets/latest`, mode);
  }

  getOne(
    simulationId: string,
    broadsheetId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Broadsheet>> {
    return this.getSimulationData(`/simulations/${simulationId}/broadsheets/${broadsheetId}`, mode);
  }

  generate(
    simulationId: string,
    data: { period_start: string; period_end: string },
  ): Promise<ApiResponse<Broadsheet>> {
    return this.post(`/simulations/${simulationId}/broadsheets`, data);
  }
}

export const broadsheetApi = new BroadsheetApiService();
