import type {
  ApiResponse,
  ChatConversation,
  ChatEventReference,
  ChatMessage,
  ChatReactionSummary,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class ChatApiService extends BaseApiService {
  listConversations(simulationId: string): Promise<ApiResponse<ChatConversation[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/chat/conversations`);
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
  ): Promise<ApiResponse<ChatMessage[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      params,
    );
  }

  sendMessage(
    simulationId: string,
    conversationId: string,
    data: { content: string; metadata?: Record<string, unknown>; generate_response?: boolean },
  ): Promise<ApiResponse<ChatMessage[]>> {
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

  toggleReaction(
    simulationId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<ApiResponse<{ action: string; message_id: string; emoji: string }>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
      { emoji },
    );
  }

  getReactions(
    simulationId: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResponse<ChatReactionSummary[]>> {
    return this.get(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    );
  }

  renameConversation(
    simulationId: string,
    conversationId: string,
    title: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.put(`/simulations/${simulationId}/chat/conversations/${conversationId}/title`, {
      title,
    });
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

  /** Contextual conversation starters for empty conversations. */
  getStarters(
    simulationId: string,
    conversationId: string,
    locale: string = 'de',
  ): Promise<ApiResponse<string[]>> {
    return this.get(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/starters`,
      { locale },
    );
  }

  /** URL for the regenerate SSE endpoint (used by ChatStreamConsumer). */
  regenerateStreamUrl(simulationId: string, conversationId: string): string {
    return `/api/v1/simulations/${simulationId}/chat/conversations/${conversationId}/regenerate`;
  }
}

export const chatApi = new ChatApiService();
