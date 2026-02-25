import type { ApiResponse, PaginatedResponse, Simulation } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class SimulationsApiService extends BaseApiService {
  list(params?: Record<string, string>): Promise<ApiResponse<PaginatedResponse<Simulation>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic('/simulations', params);
    }
    return this.get('/simulations', params);
  }

  getById(id: string): Promise<ApiResponse<Simulation>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${id}`);
    }
    return this.get(`/simulations/${id}`);
  }

  create(data: Partial<Simulation>): Promise<ApiResponse<Simulation>> {
    return this.post('/simulations', data);
  }

  update(id: string, data: Partial<Simulation>): Promise<ApiResponse<Simulation>> {
    return this.put(`/simulations/${id}`, data);
  }

  remove(id: string): Promise<ApiResponse<Simulation>> {
    return this.delete(`/simulations/${id}`);
  }
}

export const simulationsApi = new SimulationsApiService();
