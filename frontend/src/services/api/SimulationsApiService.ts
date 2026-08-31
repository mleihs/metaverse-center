import type { ApiResponse, LandingSnapshot, Simulation } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';
import type { QueryParams } from './query-params';

export class SimulationsApiService extends BaseApiService {
  /**
   * List simulations.
   *  - `'public'` → `/api/v1/public/simulations` (curated community list)
   *  - `'member'` → `/api/v1/simulations` (includes drafts / owner-only sims)
   * The typical caller computes mode as
   * `isAuthenticated ? 'member' : 'public'`.
   */
  list(mode: 'public' | 'member', params?: QueryParams): Promise<ApiResponse<Simulation[]>> {
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

  listPublic(params?: QueryParams): Promise<ApiResponse<Simulation[]>> {
    return this.getPublic('/simulations', params);
  }

  getAnchor(simulationId: string): Promise<ApiResponse<Record<string, string>>> {
    return this.getPublic(`/simulations/${simulationId}/anchor`);
  }

  getPlatformStats<T = Record<string, number>>(): Promise<ApiResponse<T>> {
    return this.getPublic<T>('/platform-stats');
  }

  /**
   * Alles, was die Frontseite braucht, in einem Aufruf.
   *
   * Nicht `getPlatformStats`: dessen drei Zaehler messen anders (er filtert
   * `status` nicht mit und zaehlt Epochen allein am Status, auf Prod also 7
   * statt 0). Die Frontseite darf nicht an einem Zaehler haengen, der fuer
   * einen anderen Zweck geschnitten wurde.
   */
  getLandingSnapshot(): Promise<ApiResponse<LandingSnapshot>> {
    return this.getPublic<LandingSnapshot>('/landing');
  }
}

export const simulationsApi = new SimulationsApiService();
