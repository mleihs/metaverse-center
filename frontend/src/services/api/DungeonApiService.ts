/**
 * API service for Resonance Dungeons — 15 authenticated + 2 public endpoints.
 *
 * Backend router: backend/routers/resonance_dungeons.py
 * Public router:  backend/routers/public.py (dungeon section)
 *
 * Error capture handled by BaseApiService.request() → SentryService.captureError().
 */

import type {
  AgentLootEffect,
  AvailableDungeonResponse,
  CombatSubmission,
  CombatSubmitResponse,
  CreateRunResponse,
  DistributeConfirmResponse,
  DungeonAction,
  DungeonClientState,
  DungeonEventResponse,
  DungeonRunCreate,
  DungeonRunResponse,
  EncounterChoiceResponse,
  LootAssignmentRequest,
  LootAssignmentResponse,
  GroundResponse,
  MoveToRoomResponse,
  RallyResponse,
  RestResponse,
  RetreatResponse,
  SalvageResponse,
  ScoutResponse,
  SealBreachResponse,
} from '../../types/dungeon.js';
import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class DungeonApiService extends BaseApiService {
  // ── Authenticated Endpoints (12) ──────────────────────────────────────────

  /** List archetypes with active resonances above dungeon threshold. */
  getAvailable(simulationId: string): Promise<ApiResponse<AvailableDungeonResponse[]>> {
    return this.get('/dungeons/available', { simulation_id: simulationId });
  }

  /** Start a new dungeon run. */
  createRun(simulationId: string, body: DungeonRunCreate): Promise<ApiResponse<CreateRunResponse>> {
    return this.post(`/dungeons/runs?simulation_id=${simulationId}`, body);
  }

  /** Get run metadata (DB record). */
  getRun(runId: string): Promise<ApiResponse<DungeonRunResponse>> {
    return this.get(`/dungeons/runs/${runId}`);
  }

  /** Get full client state (fog-of-war filtered). Used for recovery. */
  getState(runId: string): Promise<ApiResponse<DungeonClientState>> {
    return this.get(`/dungeons/runs/${runId}/state`);
  }

  /** Move party to an adjacent room. */
  moveToRoom(runId: string, roomIndex: number): Promise<ApiResponse<MoveToRoomResponse>> {
    return this.post(`/dungeons/runs/${runId}/move`, { room_index: roomIndex });
  }

  /** Submit an encounter choice or interaction. */
  submitAction(
    runId: string,
    action: DungeonAction,
  ): Promise<ApiResponse<EncounterChoiceResponse>> {
    return this.post(`/dungeons/runs/${runId}/action`, action);
  }

  /** Submit combat actions for the planning phase. */
  submitCombat(
    runId: string,
    submission: CombatSubmission,
  ): Promise<ApiResponse<CombatSubmitResponse>> {
    return this.post(`/dungeons/runs/${runId}/combat/submit`, submission);
  }

  /** Spy: reveal adjacent rooms and restore visibility. */
  scout(runId: string, agentId: string): Promise<ApiResponse<ScoutResponse>> {
    return this.post(`/dungeons/runs/${runId}/scout`, { agent_id: agentId });
  }

  /** Guardian: Seal Breach — reduce water level, gain stress (Deluge only). */
  seal(runId: string, agentId: string): Promise<ApiResponse<SealBreachResponse>> {
    return this.post(`/dungeons/runs/${runId}/seal`, { agent_id: agentId });
  }

  /** Spy: Ground — reduce awareness, gain stress (Awakening only). */
  ground(runId: string, agentId: string): Promise<ApiResponse<GroundResponse>> {
    return this.post(`/dungeons/runs/${runId}/ground`, { agent_id: agentId });
  }

  /** Propagandist: Rally — reduce fracture, gain stress (Overthrow only). */
  rally(runId: string, agentId: string): Promise<ApiResponse<RallyResponse>> {
    return this.post(`/dungeons/runs/${runId}/rally`, { agent_id: agentId });
  }

  /** Salvage submerged loot — Guardian/Spy aptitude check (Deluge only). */
  salvage(
    runId: string,
    agentId: string,
    roomIndex: number,
  ): Promise<ApiResponse<SalvageResponse>> {
    return this.post(`/dungeons/runs/${runId}/salvage`, {
      agent_id: agentId,
      room_index: roomIndex,
    });
  }

  /** Rest at a rest site. */
  rest(runId: string, agentIds: string[]): Promise<ApiResponse<RestResponse>> {
    return this.post(`/dungeons/runs/${runId}/rest`, { agent_ids: agentIds });
  }

  /** Abandon dungeon (keep partial loot). */
  retreat(runId: string): Promise<ApiResponse<RetreatResponse>> {
    return this.post(`/dungeons/runs/${runId}/retreat`, {});
  }

  /** Assign a loot item to an agent during distribution phase. */
  assignLoot(
    runId: string,
    body: LootAssignmentRequest,
  ): Promise<ApiResponse<LootAssignmentResponse>> {
    return this.post(`/dungeons/runs/${runId}/distribute`, body);
  }

  /** Finalize loot distribution and complete the dungeon run. */
  confirmDistribution(runId: string): Promise<ApiResponse<DistributeConfirmResponse>> {
    return this.post(`/dungeons/runs/${runId}/distribute/confirm`, {});
  }

  /** Get dungeon event log (paginated). */
  getEvents(runId: string, limit = 50, offset = 0): Promise<ApiResponse<DungeonEventResponse[]>> {
    return this.get(`/dungeons/runs/${runId}/events`, {
      limit: String(limit),
      offset: String(offset),
    });
  }

  /** Get all persistent dungeon loot effects for an agent (provenance). */
  getAgentLootEffects(
    agentId: string,
    simulationId: string,
  ): Promise<ApiResponse<AgentLootEffect[]>> {
    return this.get(`/dungeons/agents/${agentId}/loot-effects`, {
      simulation_id: simulationId,
    });
  }

  /** List past dungeon runs for a simulation (paginated). */
  getHistory(
    simulationId: string,
    limit = 25,
    offset = 0,
  ): Promise<ApiResponse<DungeonRunResponse[]>> {
    return this.get('/dungeons/history', {
      simulation_id: simulationId,
      limit: String(limit),
      offset: String(offset),
    });
  }

  // ── Public Endpoints (2) ──────────────────────────────────────────────────

  /** Public: get a completed dungeon run. */
  getRunPublic(runId: string): Promise<ApiResponse<DungeonRunResponse>> {
    return this.getPublic(`/dungeons/runs/${runId}`);
  }

  /** Public: list completed dungeon runs for a simulation. */
  getHistoryPublic(
    simulationId: string,
    limit = 25,
    offset = 0,
  ): Promise<ApiResponse<DungeonRunResponse[]>> {
    return this.getPublic(`/simulations/${simulationId}/dungeons/history`, {
      limit: String(limit),
      offset: String(offset),
    });
  }

  /** Public: get global dungeon clearance configuration. */
  getClearanceConfig(): Promise<ApiResponse<DungeonClearanceConfig>> {
    return this.getPublic('/dungeons/clearance-config');
  }
}

export interface DungeonClearanceConfig {
  clearance_mode: 'off' | 'standard' | 'custom';
  clearance_threshold: number;
}

export const dungeonApi = new DungeonApiService();
