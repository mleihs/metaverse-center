import type {
  ApiResponse,
  BureauResponse,
  CascadeRule,
  CollaborativeAnchor,
  HeartbeatDashboard,
  HeartbeatEntry,
  HeartbeatOverview,
  HeartbeatTick,
  NarrativeArc,
  SubstrateAttunement,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export class HeartbeatApiService extends BaseApiService {
  // ── Heartbeat Data ──────────────────────────────────────────

  getOverview(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<HeartbeatOverview>> {
    return this.getSimulationData(`/simulations/${simulationId}/heartbeat`, mode);
  }

  getDailyBriefing(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/heartbeat/briefing`,
      mode,
    );
  }

  listEntries(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<HeartbeatEntry[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/heartbeat/entries`,
      mode,
      params,
    );
  }

  listArcs(
    simulationId: string,
    mode: 'public' | 'member',
    params?: Record<string, string>,
  ): Promise<ApiResponse<NarrativeArc[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/heartbeat/arcs`,
      mode,
      params,
    );
  }

  // ── Bureau Responses ────────────────────────────────────────

  listResponses(
    simulationId: string,
    eventId: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<BureauResponse[]>> {
    return this.get(`/simulations/${simulationId}/events/${eventId}/responses`, params);
  }

  createResponse(
    simulationId: string,
    eventId: string,
    body: { response_type: string; assigned_agent_ids: string[] },
  ): Promise<ApiResponse<BureauResponse>> {
    return this.post(`/simulations/${simulationId}/events/${eventId}/responses`, body);
  }

  cancelResponse(
    simulationId: string,
    eventId: string,
    responseId: string,
  ): Promise<ApiResponse<BureauResponse>> {
    return this.delete(`/simulations/${simulationId}/events/${eventId}/responses/${responseId}`);
  }

  // ── Attunements ─────────────────────────────────────────────

  listAttunements(simulationId: string): Promise<ApiResponse<SubstrateAttunement[]>> {
    return this.get(`/simulations/${simulationId}/attunements`);
  }

  setAttunement(
    simulationId: string,
    body: { resonance_signature: string },
  ): Promise<ApiResponse<SubstrateAttunement>> {
    return this.post(`/simulations/${simulationId}/attunements`, body);
  }

  removeAttunement(
    simulationId: string,
    signature: string,
  ): Promise<ApiResponse<SubstrateAttunement>> {
    return this.delete(`/simulations/${simulationId}/attunements/${signature}`);
  }

  // ── Anchors ─────────────────────────────────────────────────

  listAnchors(params?: Record<string, string>): Promise<ApiResponse<CollaborativeAnchor[]>> {
    return this.get('/anchors', params);
  }

  createAnchor(
    body: { name: string; resonance_id: string; resonance_signature: string },
    simulationId: string,
  ): Promise<ApiResponse<CollaborativeAnchor>> {
    return this.post(`/anchors?simulation_id=${simulationId}`, body);
  }

  joinAnchor(anchorId: string, simulationId: string): Promise<ApiResponse<CollaborativeAnchor>> {
    return this.post(`/anchors/${anchorId}/join?simulation_id=${simulationId}`);
  }

  leaveAnchor(anchorId: string, simulationId: string): Promise<ApiResponse<CollaborativeAnchor>> {
    return this.post(`/anchors/${anchorId}/leave?simulation_id=${simulationId}`);
  }

  // ── Admin ───────────────────────────────────────────────────

  getDashboard(): Promise<ApiResponse<HeartbeatDashboard>> {
    return this.get('/admin/heartbeat/dashboard');
  }

  listCascadeRules(): Promise<ApiResponse<CascadeRule[]>> {
    return this.get('/admin/heartbeat/cascade-rules');
  }

  forceTick(simulationId: string): Promise<ApiResponse<HeartbeatTick>> {
    return this.post(`/admin/heartbeat/force-tick/${simulationId}`);
  }
}

export const heartbeatApi = new HeartbeatApiService();
