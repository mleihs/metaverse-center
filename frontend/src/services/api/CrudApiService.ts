import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

/**
 * Abstract base for simulation-scoped CRUD API services.
 *
 * Subclasses define the resource name (e.g. "agents") and get
 * list / getById / create / update / remove for free.
 * Override any method to customise behaviour.
 */
export abstract class CrudApiService<T> extends BaseApiService {
  /** Resource segment appended to `/simulations/${id}/` (e.g. "agents"). */
  protected abstract readonly resource: string;

  protected basePath(simulationId: string): string {
    return `/simulations/${simulationId}/${this.resource}`;
  }

  list(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<T[]>> {
    return this.getSimulationData(this.basePath(simulationId), mode, params);
  }

  getById(
    simulationId: string,
    entityId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<T>> {
    return this.getSimulationData(`${this.basePath(simulationId)}/${entityId}`, mode);
  }

  create(simulationId: string, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.post(this.basePath(simulationId), data);
  }

  update(simulationId: string, entityId: string, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.put(`${this.basePath(simulationId)}/${entityId}`, data);
  }

  remove(simulationId: string, entityId: string): Promise<ApiResponse<T>> {
    return this.delete(`${this.basePath(simulationId)}/${entityId}`);
  }

  /* Optional public-access helpers for services that need them. */

  protected listPublic(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T[]>> {
    return this.getPublic(this.basePath(simulationId), params);
  }

  protected getBySlug(simulationId: string, slug: string): Promise<ApiResponse<T>> {
    return this.getPublic(`${this.basePath(simulationId)}/by-slug/${slug}`);
  }
}
