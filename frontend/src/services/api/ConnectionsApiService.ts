import type {
  ApiResponse,
  BattleLogEntry,
  GazetteEntry,
  MapData,
  SimulationConnection,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class ConnectionsApiService extends BaseApiService {
  /**
   * List all active simulation connections.
   *  - `'public'` → `/api/v1/public/connections`
   *  - `'member'` → `/api/v1/connections`
   */
  listAll(mode: 'public' | 'member'): Promise<ApiResponse<SimulationConnection[]>> {
    return mode === 'public' ? this.getPublic('/connections') : this.get('/connections');
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
