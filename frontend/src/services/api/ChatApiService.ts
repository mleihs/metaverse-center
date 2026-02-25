import type {
  ApiResponse,
  ChatConversation,
  ChatEventReference,
  ChatMessage,
  PaginatedResponse,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class ChatApiService extends BaseApiService {
  listConversations(simulationId: string): Promise<ApiResponse<ChatConversation[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/simulations/${simulationId}/chat/conversations`);
    }
    return this.get(`/simulations/${simulationId}/chat/conversations`);
  }

  createConversation(
    simulationId: string,
    data: { agent_ids: string[]; title?: string },
  ): Promise<ApiResponse<ChatConversation>> {
    return this.post(`/simulations/${simulationId}/chat/conversations`, data);
  }

  getMessages(
    simulationId: string,
    conversationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<ChatMessage>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(
        `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
        params,
      );
    }
    return this.get(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      params,
    );
  }

  sendMessage(
    simulationId: string,
    conversationId: string,
    data: { content: string; metadata?: Record<string, unknown>; generate_response?: boolean },
  ): Promise<ApiResponse<ChatMessage | ChatMessage[]>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      data,
    );
  }

  addAgent(
    simulationId: string,
    conversationId: string,
    agentId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.post(`/simulations/${simulationId}/chat/conversations/${conversationId}/agents`, {
      agent_id: agentId,
    });
  }

  removeAgent(
    simulationId: string,
    conversationId: string,
    agentId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.delete(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/agents/${agentId}`,
    );
  }

  addEventReference(
    simulationId: string,
    conversationId: string,
    eventId: string,
  ): Promise<ApiResponse<ChatEventReference>> {
    return this.post(`/simulations/${simulationId}/chat/conversations/${conversationId}/events`, {
      event_id: eventId,
    });
  }

  removeEventReference(
    simulationId: string,
    conversationId: string,
    eventId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.delete(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/events/${eventId}`,
    );
  }

  getEventReferences(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatEventReference[]>> {
    return this.get(`/simulations/${simulationId}/chat/conversations/${conversationId}/events`);
  }

  archiveConversation(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.patch(`/simulations/${simulationId}/chat/conversations/${conversationId}`, {
      status: 'archived',
    });
  }

  deleteConversation(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.delete(`/simulations/${simulationId}/chat/conversations/${conversationId}`);
  }
}

export const chatApi = new ChatApiService();
