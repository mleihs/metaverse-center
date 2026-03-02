import type {
  ApiResponse,
  BotDifficulty,
  BotPersonality,
  BotPlayer,
  EpochParticipant,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class BotApiService extends BaseApiService {
  /** List current user's bot presets. */
  listPresets(): Promise<ApiResponse<BotPlayer[]>> {
    return this.get('/bot-players');
  }

  /** Create a new bot preset. */
  createPreset(data: {
    name: string;
    personality: BotPersonality;
    difficulty: BotDifficulty;
    config?: Record<string, unknown>;
  }): Promise<ApiResponse<BotPlayer>> {
    return this.post('/bot-players', data);
  }

  /** Update a bot preset. */
  updatePreset(
    botId: string,
    data: Partial<{
      name: string;
      personality: BotPersonality;
      difficulty: BotDifficulty;
      config: Record<string, unknown>;
    }>,
  ): Promise<ApiResponse<BotPlayer>> {
    return this.patch(`/bot-players/${botId}`, data);
  }

  /** Delete a bot preset. */
  deletePreset(botId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/bot-players/${botId}`);
  }

  /** Add a bot to an epoch lobby. */
  addBotToEpoch(
    epochId: string,
    botPlayerId: string,
    simulationId: string,
  ): Promise<ApiResponse<EpochParticipant>> {
    return this.post(`/epochs/${epochId}/add-bot`, {
      bot_player_id: botPlayerId,
      simulation_id: simulationId,
    });
  }

  /** Remove a bot from an epoch lobby. */
  removeBotFromEpoch(epochId: string, participantId: string): Promise<ApiResponse<unknown>> {
    return this.delete(`/epochs/${epochId}/remove-bot/${participantId}`);
  }
}

export const botApi = new BotApiService();
