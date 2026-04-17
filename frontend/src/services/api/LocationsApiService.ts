import type { ApiResponse, City, CityStreet, Zone } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class LocationsApiService extends BaseApiService {
  // --- Cities ---

  listCities(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<City[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/locations/cities`,
      mode,
      params,
    );
  }

  getCity(
    simulationId: string,
    cityId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<City>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/locations/cities/${cityId}`,
      mode,
    );
  }

  createCity(simulationId: string, data: Partial<City>): Promise<ApiResponse<City>> {
    return this.post(`/simulations/${simulationId}/locations/cities`, data);
  }

  updateCity(
    simulationId: string,
    cityId: string,
    data: Partial<City>,
  ): Promise<ApiResponse<City>> {
    return this.put(`/simulations/${simulationId}/locations/cities/${cityId}`, data);
  }

  // --- Zones ---

  listZones(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<Zone[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/locations/zones`,
      mode,
      params,
    );
  }

  getZone(
    simulationId: string,
    zoneId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Zone>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/locations/zones/${zoneId}`,
      mode,
    );
  }

  createZone(simulationId: string, data: Partial<Zone>): Promise<ApiResponse<Zone>> {
    return this.post(`/simulations/${simulationId}/locations/zones`, data);
  }

  updateZone(
    simulationId: string,
    zoneId: string,
    data: Partial<Zone>,
  ): Promise<ApiResponse<Zone>> {
    return this.put(`/simulations/${simulationId}/locations/zones/${zoneId}`, data);
  }

  // --- Streets ---

  listStreets(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<CityStreet[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/locations/streets`,
      mode,
      params,
    );
  }

  createStreet(simulationId: string, data: Partial<CityStreet>): Promise<ApiResponse<CityStreet>> {
    return this.post(`/simulations/${simulationId}/locations/streets`, data);
  }

  updateStreet(
    simulationId: string,
    streetId: string,
    data: Partial<CityStreet>,
  ): Promise<ApiResponse<CityStreet>> {
    return this.put(`/simulations/${simulationId}/locations/streets/${streetId}`, data);
  }
}

export const locationsApi = new LocationsApiService();
