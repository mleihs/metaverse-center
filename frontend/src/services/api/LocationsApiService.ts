import type { ApiResponse, City, CityStreet, PaginatedResponse, Zone } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class LocationsApiService extends BaseApiService {
  // --- Cities ---

  listCities(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<City>>> {
    return this.get(`/simulations/${simulationId}/cities`, params);
  }

  getCity(simulationId: string, cityId: string): Promise<ApiResponse<City>> {
    return this.get(`/simulations/${simulationId}/cities/${cityId}`);
  }

  createCity(simulationId: string, data: Partial<City>): Promise<ApiResponse<City>> {
    return this.post(`/simulations/${simulationId}/cities`, data);
  }

  updateCity(
    simulationId: string,
    cityId: string,
    data: Partial<City>,
  ): Promise<ApiResponse<City>> {
    return this.put(`/simulations/${simulationId}/cities/${cityId}`, data);
  }

  // --- Zones ---

  listZones(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Zone>>> {
    return this.get(`/simulations/${simulationId}/zones`, params);
  }

  getZone(simulationId: string, zoneId: string): Promise<ApiResponse<Zone>> {
    return this.get(`/simulations/${simulationId}/zones/${zoneId}`);
  }

  createZone(simulationId: string, data: Partial<Zone>): Promise<ApiResponse<Zone>> {
    return this.post(`/simulations/${simulationId}/zones`, data);
  }

  updateZone(
    simulationId: string,
    zoneId: string,
    data: Partial<Zone>,
  ): Promise<ApiResponse<Zone>> {
    return this.put(`/simulations/${simulationId}/zones/${zoneId}`, data);
  }

  // --- Streets ---

  listStreets(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<CityStreet>>> {
    return this.get(`/simulations/${simulationId}/streets`, params);
  }

  createStreet(simulationId: string, data: Partial<CityStreet>): Promise<ApiResponse<CityStreet>> {
    return this.post(`/simulations/${simulationId}/streets`, data);
  }

  updateStreet(
    simulationId: string,
    streetId: string,
    data: Partial<CityStreet>,
  ): Promise<ApiResponse<CityStreet>> {
    return this.put(`/simulations/${simulationId}/streets/${streetId}`, data);
  }
}

export const locationsApi = new LocationsApiService();
