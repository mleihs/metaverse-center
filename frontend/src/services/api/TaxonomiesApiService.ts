import type { ApiResponse, SimulationTaxonomy, TaxonomyType } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class TaxonomiesApiService extends BaseApiService {
  list(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<SimulationTaxonomy[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/taxonomies`, mode, params);
  }

  getByType(simulationId: string, type: TaxonomyType): Promise<ApiResponse<SimulationTaxonomy[]>> {
    return this.get(`/simulations/${simulationId}/taxonomies`, {
      taxonomy_type: type,
    });
  }

  create(
    simulationId: string,
    data: Partial<SimulationTaxonomy>,
  ): Promise<ApiResponse<SimulationTaxonomy>> {
    return this.post(`/simulations/${simulationId}/taxonomies`, data);
  }

  update(
    simulationId: string,
    taxonomyId: string,
    data: Partial<SimulationTaxonomy>,
  ): Promise<ApiResponse<SimulationTaxonomy>> {
    return this.put(`/simulations/${simulationId}/taxonomies/${taxonomyId}`, data);
  }

  deactivate(simulationId: string, taxonomyId: string): Promise<ApiResponse<SimulationTaxonomy>> {
    return this.put(`/simulations/${simulationId}/taxonomies/${taxonomyId}`, {
      is_active: false,
    });
  }
}

export const taxonomiesApi = new TaxonomiesApiService();
