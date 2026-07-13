import type {
  DriftChart,
  DriftClearanceExam,
  DriftDock,
  DriftHavarieChoice,
  DriftHonor,
  DriftProfile,
  DriftPublicState,
  DriftQuestAcceptResult,
  DriftQuestDeliverResult,
  DriftQuestState,
  DriftTuning,
  TravelRun,
} from '../../types/drift.js';
import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

/**
 * DRIFT travel API (P0a vertical slice) — the run-lifecycle loop + chart read.
 *
 * All endpoints sit behind the drift_p0_enabled gate (404 when off). The four
 * mutations are owner-scoped on the server via the JWT (auth.uid()); the client
 * just passes the run id + the optimistic-lock run_version it last saw — a 409
 * (RUN_STALE) means another tab advanced the run, so refetch and retry.
 */
export class DriftApiService extends BaseApiService {
  /** Active chart version's topology; data is null until a chart is seeded. The chart is
   *  public-first (plan §22.2): pass 'public' for an anonymous spectator (no JWT, hits
   *  /api/v1/public/drift/chart) or 'member' for an authenticated traveler. */
  getChart(mode: 'public' | 'member'): Promise<ApiResponse<DriftChart | null>> {
    return this.getSimulationData('/drift/chart', mode);
  }

  /** Public DRIFT phase-gate snapshot (no JWT) — drives the gated nav tab + view. */
  getPublicState(): Promise<ApiResponse<DriftPublicState>> {
    return this.getPublic('/drift/state');
  }

  /** HUD gauge scalars (window/Dissonanz cap/Bandbreite max) from drift_tuning. */
  getTuning(): Promise<ApiResponse<DriftTuning>> {
    return this.get('/drift/tuning');
  }

  /** The traveller's Bureau account (Siegel, VP, rank + progress, scars); null before the
   *  first run. Not gated on the Fun-Kern — with the gate closed it simply reads zeroes. */
  getProfile(): Promise<ApiResponse<DriftProfile | null>> {
    return this.get('/drift/profile');
  }

  /** Sit the Bureau clearance exam (VP threshold + Siegel fee → promotion). */
  sitClearanceExam(rank: string): Promise<ApiResponse<DriftClearanceExam>> {
    return this.post('/drift/clearance-exam', { rank });
  }

  /** Decide a Havarie: jettison, call for rescue, overstay, recall, or unravel. Returns the
   *  run AFTER the choice — active again, banked, or abandoned. `jettisonCargoIds` belongs
   *  to `notabwurf` only; the server validates both the choice against the options the
   *  Havarie actually offered and every id against the run's own manifest. */
  resolveHavarie(
    runId: string,
    runVersion: number,
    choice: DriftHavarieChoice,
    jettisonCargoIds?: string[],
  ): Promise<ApiResponse<TravelRun>> {
    return this.post(`/drift/run/${runId}/havarie/resolve`, {
      run_version: runVersion,
      choice,
      jettison_cargo_ids: jettisonCargoIds ?? null,
    });
  }

  /** A world's identity for the dock panel (name + lore voice + a few Träger). */
  getDock(simulationId: string): Promise<ApiResponse<DriftDock | null>> {
    return this.get(`/drift/dock/${simulationId}`);
  }

  /** Erstvermessung claims on the shared chart (seal-per-node overlay; is_self = yours). */
  getHonors(): Promise<ApiResponse<DriftHonor[]>> {
    return this.get('/drift/honors');
  }

  /** The caller's current open run, or null. */
  getRun(): Promise<ApiResponse<TravelRun | null>> {
    return this.get('/drift/run');
  }

  /** Open (or resume) the single active run anchored to the traveler's home sim. */
  openRun(anchorSimulationId: string): Promise<ApiResponse<TravelRun>> {
    return this.post('/drift/run', { anchor_simulation_id: anchorSimulationId });
  }

  /** A single Drift move to an adjacent node (run_version = the optimistic lock). */
  move(runId: string, runVersion: number, toNodeId: string): Promise<ApiResponse<TravelRun>> {
    return this.post(`/drift/run/${runId}/move`, {
      run_version: runVersion,
      to_node_id: toNodeId,
    });
  }

  /** Close the run at the home broadcast edge (Entladung). */
  complete(runId: string, runVersion: number): Promise<ApiResponse<TravelRun>> {
    return this.post(`/drift/run/${runId}/complete`, { run_version: runVersion });
  }

  /** Rückzug — abandon the run (unanchored cargo forfeited). */
  abandon(runId: string, runVersion: number): Promise<ApiResponse<TravelRun>> {
    return this.post(`/drift/run/${runId}/abandon`, { run_version: runVersion });
  }

  /** The caller's quest snapshot: acceptable Depeschen here + the carried one + manifest. */
  getQuests(): Promise<ApiResponse<DriftQuestState>> {
    return this.get('/drift/quests');
  }

  /** Take a deliver Depesche at the current world edge (cargo bound to the run). */
  acceptQuest(
    runId: string,
    runVersion: number,
    templateKey: string,
    targetSimulationId: string,
  ): Promise<ApiResponse<DriftQuestAcceptResult>> {
    return this.post('/drift/quests/accept', {
      run_id: runId,
      run_version: runVersion,
      template_key: templateKey,
      target_simulation_id: targetSimulationId,
    });
  }

  /** Deliver a Depesche at the target world's broadcast edge (fires the hospitality gate). */
  advanceQuest(
    instanceId: string,
    runId: string,
    runVersion: number,
  ): Promise<ApiResponse<DriftQuestDeliverResult>> {
    return this.post(`/drift/quests/${instanceId}/advance`, {
      run_id: runId,
      run_version: runVersion,
    });
  }
}

export const driftApi = new DriftApiService();
