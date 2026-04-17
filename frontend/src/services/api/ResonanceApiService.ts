import type { ApiResponse, Resonance, ResonanceImpact, SourceCategory } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class ResonanceApiService extends BaseApiService {
  /**
   * List all resonances. Mode determines routing:
   *  - `'public'` → `/api/v1/public/resonances` (anon-safe)
   *  - `'member'` → `/api/v1/resonances` (authenticated)
   * Resonances are a global collection (not sim-scoped), so the typical
   * caller computes mode as `isAuthenticated ? 'member' : 'public'`.
   */
  list(
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<Resonance[]>> {
    return mode === 'public'
      ? this.getPublic('/resonances', params)
      : this.get('/resonances', params);
  }

  /** Get a single resonance by ID. See `list` for the mode convention. */
  getById(resonanceId: string, mode: 'public' | 'member'): Promise<ApiResponse<Resonance>> {
    return mode === 'public'
      ? this.getPublic(`/resonances/${resonanceId}`)
      : this.get(`/resonances/${resonanceId}`);
  }

  /**
   * Create a new resonance (platform admin only).
   */
  create(data: {
    source_category: SourceCategory;
    title: string;
    description?: string;
    bureau_dispatch?: string;
    real_world_source?: Record<string, unknown>;
    magnitude?: number;
    impacts_at: string;
  }): Promise<ApiResponse<Resonance>> {
    return this.post('/resonances', data);
  }

  /**
   * Update an existing resonance (platform admin only).
   */
  update(resonanceId: string, data: Partial<Resonance>): Promise<ApiResponse<Resonance>> {
    return this.put(`/resonances/${resonanceId}`, data);
  }

  /**
   * Process resonance impact across simulations (platform admin only).
   */
  processImpact(
    resonanceId: string,
    data?: {
      simulation_ids?: string[];
      generate_narratives?: boolean;
      locale?: string;
    },
  ): Promise<ApiResponse<ResonanceImpact[]>> {
    return this.post(`/resonances/${resonanceId}/process-impact`, data ?? {});
  }

  /** List impact records for a resonance. See `list` for the mode convention. */
  listImpacts(
    resonanceId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<ResonanceImpact[]>> {
    return mode === 'public'
      ? this.getPublic(`/resonances/${resonanceId}/impacts`)
      : this.get(`/resonances/${resonanceId}/impacts`);
  }

  /**
   * Update resonance status (platform admin only).
   */
  updateStatus(resonanceId: string, newStatus: string): Promise<ApiResponse<Resonance>> {
    return this.put(`/resonances/${resonanceId}/status?new_status=${newStatus}`, {});
  }

  /**
   * Restore a soft-deleted resonance (platform admin only).
   */
  restore(resonanceId: string): Promise<ApiResponse<Resonance>> {
    return this.post(`/resonances/${resonanceId}/restore`, {});
  }

  /**
   * Soft-delete a resonance (platform admin only).
   */
  remove(resonanceId: string): Promise<ApiResponse<Resonance>> {
    return this.delete(`/resonances/${resonanceId}`);
  }
}

export const resonanceApi = new ResonanceApiService();
