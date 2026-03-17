import type { ApiResponse, Simulation } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class SimulationsApiService extends BaseApiService {
  list(params?: Record<string, string>): Promise<ApiResponse<Simulation[]>> {
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

  getBySlug(slug: string): Promise<ApiResponse<Simulation>> {
    return this.getPublic(`/simulations/by-slug/${slug}`);
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

  listPublic(params?: Record<string, string>): Promise<ApiResponse<Simulation[]>> {
    return this.getPublic('/simulations', params);
  }

  getAnchor(simulationId: string): Promise<ApiResponse<Record<string, string>>> {
    return this.getPublic(`/simulations/${simulationId}/anchor`);
  }

  getPlatformStats<T = Record<string, number>>(): Promise<ApiResponse<T>> {
    return this.getPublic<T>('/platform-stats');
  }
}

export const simulationsApi = new SimulationsApiService();
