import type { ApiResponse, EchoVector, EventEcho } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class EchoesApiService extends BaseApiService {
  listForSimulation(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<EventEcho[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/echoes`, mode, params);
  }

  listForEvent(
    simulationId: string,
    eventId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<EventEcho[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/events/${eventId}/echoes`, mode);
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
