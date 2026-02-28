/**
 * API service for the competitive layer — epochs, operatives, scores, battle log.
 */

import type {
  ApiResponse,
  BattleLogEntry,
  Epoch,
  EpochInvitation,
  EpochInvitationPublicInfo,
  EpochParticipant,
  EpochScore,
  EpochTeam,
  LeaderboardEntry,
  OperativeMission,
  PaginatedResponse,
} from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { BaseApiService } from './BaseApiService.js';

export class EpochsApiService extends BaseApiService {
  // ── Epochs ──────────────────────────────────────────

  listEpochs(params?: Record<string, string>): Promise<ApiResponse<PaginatedResponse<Epoch>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic('/epochs', params);
    }
    return this.get('/epochs', params);
  }

  getActiveEpochs(): Promise<ApiResponse<Epoch[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic('/epochs/active');
    }
    return this.get('/epochs/active');
  }

  getEpoch(epochId: string): Promise<ApiResponse<Epoch>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}`);
    }
    return this.get(`/epochs/${epochId}`);
  }

  createEpoch(data: {
    name: string;
    description?: string;
    config?: Partial<Epoch['config']>;
  }): Promise<ApiResponse<Epoch>> {
    return this.post('/epochs', data);
  }

  updateEpoch(epochId: string, data: Record<string, unknown>): Promise<ApiResponse<Epoch>> {
    return this.patch(`/epochs/${epochId}`, data);
  }

  // ── Lifecycle ───────────────────────────────────────

  startEpoch(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.post(`/epochs/${epochId}/start`);
  }

  advancePhase(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.post(`/epochs/${epochId}/advance`);
  }

  cancelEpoch(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.post(`/epochs/${epochId}/cancel`);
  }

  resolveCycle(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.post(`/epochs/${epochId}/resolve-cycle`);
  }

  // ── Participants ────────────────────────────────────

  listParticipants(epochId: string): Promise<ApiResponse<EpochParticipant[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}/participants`);
    }
    return this.get(`/epochs/${epochId}/participants`);
  }

  joinEpoch(epochId: string, simulationId: string): Promise<ApiResponse<EpochParticipant>> {
    return this.post(`/epochs/${epochId}/participants`, {
      simulation_id: simulationId,
    });
  }

  leaveEpoch(epochId: string, simulationId: string): Promise<ApiResponse<void>> {
    return this.delete(`/epochs/${epochId}/participants/${simulationId}`);
  }

  // ── Teams ───────────────────────────────────────────

  listTeams(epochId: string): Promise<ApiResponse<EpochTeam[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}/teams`);
    }
    return this.get(`/epochs/${epochId}/teams`);
  }

  createTeam(epochId: string, simulationId: string, name: string): Promise<ApiResponse<EpochTeam>> {
    return this.post(`/epochs/${epochId}/teams?simulation_id=${simulationId}`, { name });
  }

  joinTeam(epochId: string, teamId: string, simulationId: string): Promise<ApiResponse<void>> {
    return this.post(`/epochs/${epochId}/teams/${teamId}/join?simulation_id=${simulationId}`);
  }

  leaveTeam(epochId: string, simulationId: string): Promise<ApiResponse<void>> {
    return this.post(`/epochs/${epochId}/teams/leave?simulation_id=${simulationId}`);
  }

  // ── Operatives ──────────────────────────────────────

  listMissions(
    epochId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<OperativeMission>>> {
    return this.get(`/epochs/${epochId}/operatives`, params);
  }

  getMission(epochId: string, missionId: string): Promise<ApiResponse<OperativeMission>> {
    return this.get(`/epochs/${epochId}/operatives/${missionId}`);
  }

  deployOperative(
    epochId: string,
    simulationId: string,
    data: {
      agent_id: string;
      operative_type: string;
      target_simulation_id?: string;
      embassy_id?: string;
      target_entity_id?: string;
      target_entity_type?: string;
      target_zone_id?: string;
    },
  ): Promise<ApiResponse<OperativeMission>> {
    return this.post(`/epochs/${epochId}/operatives?simulation_id=${simulationId}`, data);
  }

  recallOperative(epochId: string, missionId: string): Promise<ApiResponse<OperativeMission>> {
    return this.post(`/epochs/${epochId}/operatives/${missionId}/recall`);
  }

  listThreats(epochId: string, simulationId: string): Promise<ApiResponse<OperativeMission[]>> {
    return this.get(`/epochs/${epochId}/operatives/threats`, {
      simulation_id: simulationId,
    });
  }

  counterIntelSweep(
    epochId: string,
    simulationId: string,
  ): Promise<ApiResponse<OperativeMission[]>> {
    return this.post(`/epochs/${epochId}/operatives/counter-intel?simulation_id=${simulationId}`);
  }

  // ── Scores ──────────────────────────────────────────

  getLeaderboard(epochId: string, cycle?: number): Promise<ApiResponse<LeaderboardEntry[]>> {
    const params: Record<string, string> = {};
    if (cycle !== undefined) params.cycle = String(cycle);

    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}/leaderboard`, params);
    }
    return this.get(`/epochs/${epochId}/scores/leaderboard`, params);
  }

  getFinalStandings(epochId: string): Promise<ApiResponse<LeaderboardEntry[]>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}/standings`);
    }
    return this.get(`/epochs/${epochId}/scores/standings`);
  }

  getScoreHistory(epochId: string, simulationId: string): Promise<ApiResponse<EpochScore[]>> {
    return this.get(`/epochs/${epochId}/scores/simulations/${simulationId}`);
  }

  // ── Battle Log ──────────────────────────────────────

  getBattleLog(
    epochId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<BattleLogEntry>>> {
    if (!appState.isAuthenticated.value) {
      return this.getPublic(`/epochs/${epochId}/battle-log`, params);
    }
    return this.get(`/epochs/${epochId}/battle-log`, params);
  }

  getBattleLogPublic(
    epochId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<PaginatedResponse<BattleLogEntry>>> {
    return this.getPublic(`/epochs/${epochId}/battle-log`, params);
  }

  // ── Invitations ────────────────────────────────────

  sendInvitation(
    epochId: string,
    data: { email: string; expires_in_hours?: number },
  ): Promise<ApiResponse<EpochInvitation>> {
    return this.post(`/epochs/${epochId}/invitations`, data);
  }

  listInvitations(epochId: string): Promise<ApiResponse<EpochInvitation[]>> {
    return this.get(`/epochs/${epochId}/invitations`);
  }

  revokeInvitation(epochId: string, invitationId: string): Promise<ApiResponse<EpochInvitation>> {
    return this.delete(`/epochs/${epochId}/invitations/${invitationId}`);
  }

  regenerateLore(epochId: string): Promise<ApiResponse<{ lore_text: string }>> {
    return this.post(`/epochs/${epochId}/invitations/regenerate-lore`);
  }

  validateEpochInvitation(token: string): Promise<ApiResponse<EpochInvitationPublicInfo>> {
    return this.getPublic(`/epoch-invitations/${token}`);
  }
}

export const epochsApi = new EpochsApiService();
