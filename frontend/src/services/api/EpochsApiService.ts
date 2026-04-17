/**
 * API service for the competitive layer — epochs, operatives, scores, battle log.
 */

import type {
  AllianceProposal,
  AllianceVote,
  ApiResponse,
  BattleLogEntry,
  BattleSummary,
  Epoch,
  EpochInvitation,
  EpochInvitationPublicInfo,
  EpochParticipant,
  EpochScore,
  EpochTeam,
  IntelDossier,
  LeaderboardEntry,
  OperativeMission,
  ResultsSummary,
  Sitrep,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class EpochsApiService extends BaseApiService {
  // ── Epochs ──────────────────────────────────────────

  /**
   * List epochs.
   *  - `'public'` → `/api/v1/public/epochs`
   *  - `'member'` → `/api/v1/epochs`
   * Epochs are a global collection, not sim-scoped; the typical caller
   * computes mode as `isAuthenticated ? 'member' : 'public'`.
   */
  listEpochs(
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<Epoch[]>> {
    return mode === 'public' ? this.getPublic('/epochs', params) : this.get('/epochs', params);
  }

  /** See `listEpochs` for the mode convention. */
  getActiveEpochs(mode: 'public' | 'member'): Promise<ApiResponse<Epoch[]>> {
    return mode === 'public' ? this.getPublic('/epochs/active') : this.get('/epochs/active');
  }

  /** See `listEpochs` for the mode convention. */
  getEpoch(epochId: string, mode: 'public' | 'member'): Promise<ApiResponse<Epoch>> {
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}`)
      : this.get(`/epochs/${epochId}`);
  }

  createEpoch(data: {
    name: string;
    description?: string;
    config?: Partial<Epoch['config']>;
    epoch_type?: Epoch['epoch_type'];
  }): Promise<ApiResponse<Epoch>> {
    return this.post('/epochs', data);
  }

  createQuickAcademy(): Promise<ApiResponse<Epoch>> {
    return this.post('/epochs/quick-academy');
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

  deleteEpoch(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.delete(`/epochs/${epochId}`);
  }

  resolveCycle(epochId: string): Promise<ApiResponse<Epoch>> {
    return this.post(`/epochs/${epochId}/resolve-cycle`);
  }

  resolveOperatives(epochId: string): Promise<ApiResponse<unknown>> {
    return this.post(`/epochs/${epochId}/operatives/resolve`);
  }

  computeScores(epochId: string): Promise<ApiResponse<unknown>> {
    return this.post(`/epochs/${epochId}/scores/compute`);
  }

  // ── Participants ────────────────────────────────────

  /** See `listEpochs` for the mode convention. */
  listParticipants(
    epochId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<EpochParticipant[]>> {
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}/participants`)
      : this.get(`/epochs/${epochId}/participants`);
  }

  joinEpoch(epochId: string, simulationId: string): Promise<ApiResponse<EpochParticipant>> {
    return this.post(`/epochs/${epochId}/participants`, {
      simulation_id: simulationId,
    });
  }

  leaveEpoch(epochId: string, simulationId: string): Promise<ApiResponse<void>> {
    return this.delete(`/epochs/${epochId}/participants/${simulationId}`);
  }

  draftAgents(
    epochId: string,
    simulationId: string,
    agentIds: string[],
  ): Promise<ApiResponse<EpochParticipant>> {
    return this.post(`/epochs/${epochId}/participants/${simulationId}/draft`, {
      agent_ids: agentIds,
    });
  }

  // ── Teams ───────────────────────────────────────────

  /** See `listEpochs` for the mode convention. */
  listTeams(epochId: string, mode: 'public' | 'member'): Promise<ApiResponse<EpochTeam[]>> {
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}/teams`)
      : this.get(`/epochs/${epochId}/teams`);
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

  // ── Alliance Proposals ─────────────────────────────

  listProposals(epochId: string): Promise<ApiResponse<AllianceProposal[]>> {
    return this.get(`/epochs/${epochId}/proposals`);
  }

  createProposal(
    epochId: string,
    simulationId: string,
    teamId: string,
  ): Promise<ApiResponse<AllianceProposal>> {
    return this.post(`/epochs/${epochId}/proposals?simulation_id=${simulationId}`, {
      team_id: teamId,
    });
  }

  inviteToTeam(
    epochId: string,
    teamId: string,
    simulationId: string,
    targetSimulationId: string,
  ): Promise<ApiResponse<AllianceProposal>> {
    return this.post(`/epochs/${epochId}/teams/${teamId}/invite?simulation_id=${simulationId}`, {
      target_simulation_id: targetSimulationId,
    });
  }

  voteOnProposal(
    epochId: string,
    proposalId: string,
    simulationId: string,
    vote: 'accept' | 'reject',
  ): Promise<ApiResponse<AllianceVote>> {
    return this.post(
      `/epochs/${epochId}/proposals/${proposalId}/vote?simulation_id=${simulationId}`,
      { vote },
    );
  }

  // ── Operatives ──────────────────────────────────────

  listMissions(
    epochId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<OperativeMission[]>> {
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

  recallOperative(
    epochId: string,
    missionId: string,
    simulationId: string,
  ): Promise<ApiResponse<OperativeMission>> {
    return this.post(
      `/epochs/${epochId}/operatives/${missionId}/recall?simulation_id=${simulationId}`,
    );
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

  fortifyZone(
    epochId: string,
    simulationId: string,
    zoneId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(
      `/epochs/${epochId}/operatives/fortify-zone?simulation_id=${simulationId}&zone_id=${zoneId}`,
    );
  }

  // ── Scores ──────────────────────────────────────────

  /**
   * Leaderboard. Public and member routes use DIFFERENT paths — public
   * serves `/epochs/{id}/leaderboard` (curated), member serves
   * `/epochs/{id}/scores/leaderboard` (full). See the inline split.
   */
  getLeaderboard(
    epochId: string,
    mode: 'public' | 'member',
    cycle?: number,
  ): Promise<ApiResponse<LeaderboardEntry[]>> {
    const params: Record<string, string> = {};
    if (cycle !== undefined) params.cycle = String(cycle);
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}/leaderboard`, params)
      : this.get(`/epochs/${epochId}/scores/leaderboard`, params);
  }

  /** See `getLeaderboard` — public and member use different paths. */
  getFinalStandings(
    epochId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<LeaderboardEntry[]>> {
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}/standings`)
      : this.get(`/epochs/${epochId}/scores/standings`);
  }

  getScoreHistory(epochId: string, simulationId: string): Promise<ApiResponse<EpochScore[]>> {
    return this.get(`/epochs/${epochId}/scores/simulations/${simulationId}`);
  }

  getResultsSummary(epochId: string): Promise<ApiResponse<ResultsSummary>> {
    return this.get(`/epochs/${epochId}/results-summary`);
  }

  getIntelDossiers(epochId: string, simulationId: string): Promise<ApiResponse<IntelDossier[]>> {
    return this.get(`/epochs/${epochId}/scores/intel-dossiers?simulation_id=${simulationId}`);
  }

  // ── War Room ──────────────────────────────────────

  getCycleSummary(
    epochId: string,
    cycle: number,
    simulationId?: string,
  ): Promise<ApiResponse<BattleSummary>> {
    const params: Record<string, string> = { cycle: String(cycle) };
    if (simulationId) params.simulation_id = simulationId;
    return this.get(`/epochs/${epochId}/battle-log/summary`, params);
  }

  getSitrep(
    epochId: string,
    cycleNumber: number,
    simulationId?: string,
  ): Promise<ApiResponse<Sitrep>> {
    const params: Record<string, string> = {};
    if (simulationId) params.simulation_id = simulationId;
    return this.get(`/epochs/${epochId}/sitrep/${cycleNumber}`, params);
  }

  // ── Battle Log ──────────────────────────────────────

  /** See `listEpochs` for the mode convention. */
  getBattleLog(
    epochId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<BattleLogEntry[]>> {
    return mode === 'public'
      ? this.getPublic(`/epochs/${epochId}/battle-log`, params)
      : this.get(`/epochs/${epochId}/battle-log`, params);
  }

  getBattleLogPublic(
    epochId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<BattleLogEntry[]>> {
    return this.getPublic(`/epochs/${epochId}/battle-log`, params);
  }

  // ── Invitations ────────────────────────────────────

  sendInvitation(
    epochId: string,
    data: { email: string; expires_in_hours?: number; locale?: string },
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
