import type { ApiResponse, City, CityStreet, Zone } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class LocationsApiService extends BaseApiService {
  // --- Cities ---

  listCities(simulationId: string, params?: Record<string, string>): Promise<ApiResponse<City[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/locations/cities`, params);
    }
    return this.get(`/simulations/${simulationId}/locations/cities`, params);
  }

  getCity(simulationId: string, cityId: string): Promise<ApiResponse<City>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/locations/cities/${cityId}`);
    }
    return this.get(`/simulations/${simulationId}/locations/cities/${cityId}`);
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

  listZones(simulationId: string, params?: Record<string, string>): Promise<ApiResponse<Zone[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/locations/zones`, params);
    }
    return this.get(`/simulations/${simulationId}/locations/zones`, params);
  }

  getZone(simulationId: string, zoneId: string): Promise<ApiResponse<Zone>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/locations/zones/${zoneId}`);
    }
    return this.get(`/simulations/${simulationId}/locations/zones/${zoneId}`);
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
    params?: Record<string, string>,
  ): Promise<ApiResponse<CityStreet[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/locations/streets`, params);
    }
    return this.get(`/simulations/${simulationId}/locations/streets`, params);
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
