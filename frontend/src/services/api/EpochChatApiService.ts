/**
 * API service for epoch chat messages and ready signals.
 * REST endpoints for message persistence (catch-up) — live messages come via Realtime.
 */

import type { ApiResponse, EpochChatMessage } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class EpochChatApiServiceImpl extends BaseApiService {
  sendMessage(
    epochId: string,
    data: {
      content: string;
      channel_type: 'epoch' | 'team';
      simulation_id: string;
      team_id?: string;
    },
  ): Promise<ApiResponse<EpochChatMessage>> {
    return this.post(`/epochs/${epochId}/chat`, data);
  }

  listMessages(
    epochId: string,
    params?: { limit?: number; before?: string },
  ): Promise<ApiResponse<EpochChatMessage[]>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.before) queryParams.before = params.before;
    return this.get(`/epochs/${epochId}/chat`, queryParams);
  }

  listTeamMessages(
    epochId: string,
    teamId: string,
    params?: { limit?: number; before?: string },
  ): Promise<ApiResponse<EpochChatMessage[]>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.before) queryParams.before = params.before;
    return this.get(`/epochs/${epochId}/chat/team/${teamId}`, queryParams);
  }

  setReady(epochId: string, simulationId: string, ready: boolean): Promise<ApiResponse<unknown>> {
    return this.post(`/epochs/${epochId}/ready`, {
      simulation_id: simulationId,
      ready,
    });
  }

  passCycle(epochId: string, simulationId: string): Promise<ApiResponse<{ passed: boolean }>> {
    return this.post(`/epochs/${epochId}/pass-cycle?simulation_id=${simulationId}`, {});
  }
}

export const epochChatApi = new EpochChatApiServiceImpl();
