import type {
  ApiResponse,
  Event,
  EventChain,
  EventReaction,
  EventStatus,
  EventZoneLink,
} from '../../types/index.js';
import { CrudApiService } from './CrudApiService.js';

export class EventsApiService extends CrudApiService<Event> {
  protected readonly resource = 'events';

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

  updateStatus(
    simulationId: string,
    eventId: string,
    eventStatus: EventStatus,
  ): Promise<ApiResponse<Event>> {
    return this.put(`/simulations/${simulationId}/events/${eventId}/status`, {
      event_status: eventStatus,
    });
  }

  getChains(simulationId: string, eventId: string): Promise<ApiResponse<EventChain[]>> {
    return this.get(`/simulations/${simulationId}/events/${eventId}/chains`);
  }

  createChain(
    simulationId: string,
    eventId: string,
    data: { parent_event_id: string; child_event_id: string; chain_type: string },
  ): Promise<ApiResponse<EventChain>> {
    return this.post(`/simulations/${simulationId}/events/${eventId}/chains`, data);
  }

  deleteChain(simulationId: string, eventId: string, chainId: string): Promise<ApiResponse<void>> {
    return this.delete(`/simulations/${simulationId}/events/${eventId}/chains/${chainId}`);
  }

  getZoneLinks(simulationId: string, eventId: string): Promise<ApiResponse<EventZoneLink[]>> {
    return this.get(`/simulations/${simulationId}/events/${eventId}/zone-links`);
  }
}

export const eventsApi = new EventsApiService();
