/**
 * DriftStatusService — runtime phase-gate state for DRIFT.
 *
 * Owns the single reactive signal the nav consults to decide whether to surface
 * the DRIFT tab: `enabled`, read from the public GET /api/v1/public/drift/state
 * (no JWT — the gate state is part of the public face, plan §11/§22.2).
 *
 * Kept deliberately separate from AppStateManager on the AlphaStatusService
 * precedent (plan §22): DRIFT is phase-gated and must be disable-able / removable
 * as a single-file operation. The view fetches its own data; this owns only the gate.
 */

import { signal } from '@preact/signals-core';
import { driftApi } from './api/DriftApiService.js';
import { captureError } from './SentryService.js';

class DriftStatusService {
  /** drift_p0_enabled — the master gate. False until the public state resolves. */
  readonly enabled = signal<boolean>(false);

  private _loaded = false;

  /**
   * Resolve the gate snapshot once per session. Safe to call from every consumer's
   * connectedCallback — re-mounts after the first success are no-ops. Never rejects:
   * the fetch-failure path is observed internally (captureError), leaving the gate
   * fail-closed (the tab stays hidden) until a later refresh succeeds.
   */
  async ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    await this.refresh();
  }

  /** Force a re-read of the gate (e.g. after an admin toggles drift_p0_enabled). */
  async refresh(): Promise<void> {
    const result = await driftApi.getPublicState();
    if (!result.success || !result.data) {
      if (!result.success) {
        captureError(new Error(result.error?.message ?? 'drift-state fetch failed'), {
          source: 'DriftStatusService.refresh',
          code: result.error?.code ?? '',
        });
      }
      return;
    }
    this.enabled.value = result.data.enabled;
    this._loaded = true;
  }
}

export const driftStatus = new DriftStatusService();
