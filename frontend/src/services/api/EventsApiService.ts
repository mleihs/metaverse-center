import type { ApiResponse, Event, EventReaction, PaginatedResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class EventsApiService extends BaseApiService {
  list(
    simulationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<Event>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/events`, params);
    }
    return this.get(`/simulations/${simulationId}/events`, params);
  }

  getById(simulationId: string, eventId: string): Promise<ApiResponse<Event>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/events/${eventId}`);
    }
    return this.get(`/simulations/${simulationId}/events/${eventId}`);
  }

  create(simulationId: string, data: Partial<Event>): Promise<ApiResponse<Event>> {
    return this.post(`/simulations/${simulationId}/events`, data);
  }

  update(simulationId: string, eventId: string, data: Partial<Event>): Promise<ApiResponse<Event>> {
    return this.put(`/simulations/${simulationId}/events/${eventId}`, data);
  }

  remove(simulationId: string, eventId: string): Promise<ApiResponse<Event>> {
    return this.delete(`/simulations/${simulationId}/events/${eventId}`);
  }

  getReactions(simulationId: string, eventId: string): Promise<ApiResponse<EventReaction[]>> {
    return this.get(`/simulations/${simulationId}/events/${eventId}/reactions`);
  }

  addReaction(
    simulationId: string,
    eventId: string,
    data: Partial<EventReaction>,
  ): Promise<ApiResponse<EventReaction>> {
    return this.post(`/simulations/${simulationId}/events/${eventId}/reactions`, data);
  }

  deleteReaction(
    simulationId: string,
    eventId: string,
    reactionId: string,
  ): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/events/${eventId}/reactions/${reactionId}`);
  }

  generateReactions(
    simulationId: string,
    eventId: string,
    data?: { agent_ids?: string[]; max_agents?: number },
  ): Promise<ApiResponse<EventReaction[]>> {
    return this.post(
      `/simulations/${simulationId}/events/${eventId}/generate-reactions`,
      data || {},
    );
  }
}

export const eventsApi = new EventsApiService();
