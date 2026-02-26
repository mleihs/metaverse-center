import type { ApiResponse, MapData, SimulationConnection } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class ConnectionsApiService extends BaseApiService {
  listAll(): Promise<ApiResponse<SimulationConnection[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic('/connections');
    }
    return this.get('/connections');
  }

  getMapData(): Promise<ApiResponse<MapData>> {
    return this.getPublic('/map-data');
  }
}

export const connectionsApi = new ConnectionsApiService();
