import type {
  ApiResponse,
  BattleLogEntry,
  GazetteEntry,
  MapData,
  SimulationConnection,
} from '../../types/index.js';
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

  getBattleFeed(limit = 20): Promise<ApiResponse<BattleLogEntry[]>> {
    return this.getPublic(`/battle-feed?limit=${limit}`);
  }

  getBleedGazette(limit = 20): Promise<ApiResponse<GazetteEntry[]>> {
    return this.getPublic(`/bleed-gazette?limit=${limit}`);
  }
}

export const connectionsApi = new ConnectionsApiService();
