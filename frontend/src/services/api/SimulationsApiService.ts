import type { ApiResponse, Simulation } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class SimulationsApiService extends BaseApiService {
  /**
   * List simulations.
   *  - `'public'` → `/api/v1/public/simulations` (curated community list)
   *  - `'member'` → `/api/v1/simulations` (includes drafts / owner-only sims)
   * The typical caller computes mode as
   * `isAuthenticated ? 'member' : 'public'`.
   */
  list(
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<Simulation[]>> {
    return mode === 'public'
      ? this.getPublic('/simulations', params)
      : this.get('/simulations', params);
  }

  /** Get a simulation by id. See `list` for the mode convention. */
  getById(id: string, mode: 'public' | 'member'): Promise<ApiResponse<Simulation>> {
    return mode === 'public'
      ? this.getPublic(`/simulations/${id}`)
      : this.get(`/simulations/${id}`);
  }

  getBySlug(slug: string): Promise<ApiResponse<Simulation>> {
    return this.getPublic(`/simulations/${slug}`);
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
