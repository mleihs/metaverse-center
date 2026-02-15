import type {
  ApiResponse,
  ChatConversation,
  ChatMessage,
  PaginatedResponse,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class ChatApiService extends BaseApiService {
  listConversations(simulationId: string): Promise<ApiResponse<ChatConversation[]>> {
    return this.get(`/simulations/${simulationId}/chat/conversations`);
  }

  createConversation(
    simulationId: string,
    data: Partial<ChatConversation>,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.post(`/simulations/${simulationId}/chat/conversations`, data);
  }

  getMessages(
    simulationId: string,
    conversationId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<ChatMessage>>> {
    return this.get(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      params,
    );
  }

  sendMessage(
    simulationId: string,
    conversationId: string,
    data: { content: string; metadata?: Record<string, unknown> },
  ): Promise<ApiResponse<ChatMessage>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      data,
    );
  }

  archiveConversation(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.put(`/simulations/${simulationId}/chat/conversations/${conversationId}`, {
      status: 'archived',
    });
  }
}

export const chatApi = new ChatApiService();
