import type { DriftChart, DriftTuning, TravelRun } from '../../types/drift.js';
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
  /** Active chart version's public topology; data is null until a chart is seeded. */
  getChart(): Promise<ApiResponse<DriftChart | null>> {
    return this.get('/drift/chart');
  }

  /** HUD gauge scalars (window/Dissonanz cap/Bandbreite max) from drift_tuning. */
  getTuning(): Promise<ApiResponse<DriftTuning>> {
    return this.get('/drift/tuning');
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
}

export const driftApi = new DriftApiService();
