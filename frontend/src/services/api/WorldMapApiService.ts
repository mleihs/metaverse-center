import type { ApiResponse } from '../../types/index.js';
import type {
  MapGenerationResult,
  MapRegenerateRequest,
  WorldMapResponse,
} from '../../types/world-map.js';
import { BaseApiService } from './BaseApiService.js';

export class WorldMapApiService extends BaseApiService {
  /**
   * The world-map endpoint is public-only by design — there is no member
   * counterpart at /api/v1/simulations/{id}/map. Map geometry has identical
   * visibility for anonymous users and members, so we always go through the
   * public endpoint regardless of auth state.
   */
  getMap(slugOrId: string): Promise<ApiResponse<WorldMapResponse>> {
    return this.getSimulationData(`/simulations/${slugOrId}/map`, 'public');
  }

  regenerate(
    simulationId: string,
    body: MapRegenerateRequest = {},
  ): Promise<ApiResponse<MapGenerationResult>> {
    return this.post(`/admin/simulations/${simulationId}/map/regenerate`, body);
  }
}

export const worldMapApi = new WorldMapApiService();
