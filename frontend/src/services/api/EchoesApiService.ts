import type { ApiResponse, EchoVector, EventEcho, PaginatedResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class EchoesApiService extends BaseApiService {
  listForSimulation(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<EventEcho>>> {
    const path = `/simulations/${simulationId}/echoes`;
    if (!appState.isAuthenticated.value) {
      return this.getPublic(path, params);
    }
    return this.get(path, params);
  }

  listForEvent(simulationId: string, eventId: string): Promise<ApiResponse<EventEcho[]>> {
    const path = `/simulations/${simulationId}/events/${eventId}/echoes`;
    if (!appState.isAuthenticated.value) {
      return this.getPublic(path);
    }
    return this.get(path);
  }

  triggerEcho(
    simulationId: string,
    data: {
      source_event_id: string;
      target_simulation_id: string;
      echo_vector: EchoVector;
      echo_strength?: number;
    },
  ): Promise<ApiResponse<EventEcho>> {
    return this.post(`/simulations/${simulationId}/echoes`, data);
  }

  approve(simulationId: string, echoId: string): Promise<ApiResponse<EventEcho>> {
    return this.patch(`/simulations/${simulationId}/echoes/${echoId}/approve`);
  }

  reject(simulationId: string, echoId: string): Promise<ApiResponse<EventEcho>> {
    return this.patch(`/simulations/${simulationId}/echoes/${echoId}/reject`);
  }
}

export const echoesApi = new EchoesApiService();
