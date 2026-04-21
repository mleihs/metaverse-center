/**
 * AdminOpsTab — Bureau Ops admin cockpit (P3).
 *
 * Single-tab home for the ops control-surface panels defined in
 * docs/plans/bureau-ops-implementation-plan.md §6.1. Ships eight
 * stacked panels plus an on-demand incident-audit drawer and an
 * ambient dispatch-ticker footer:
 *
 *   1. Ledger          — today/month/last-hour tiles + breakdowns.
 *   2. BurnRate        — 24h sparkline + naive projection.
 *   3. CircuitMatrix   — dot-matrix glyph per scope (observational).
 *   4. Quarantine      — CUT ALL AI + kill-switch controls (kept
 *                        above the fold so operators find it fast
 *                        during an incident).
 *   5. Heatmap         — hour × key cost attribution (P2.6 MV-backed).
 *   6. Forecast        — end-of-month projection + 5 what-if sliders
 *                        with client-side delta computation (P3.1/P3.3).
 *   7. SentryRules     — CRUD UI for sentry_rules (P2.4).
 *   8. Firehose        — Supabase Realtime stream of ai_usage_log.
 *
 *   + IncidentDossierDrawer opens from the header button; reads
 *     ops_audit_log with action-type + window filters.
 *   + DispatchTicker footer streams the last 20 ops_audit_log entries
 *     as an ambient horizontal crawl (P3.4).
 *
 * Refresh cadences (parent-owned where shared, panel-owned otherwise):
 *   - /admin/ops/ledger: 30s, feeds Ledger + BurnRate + Forecast (purpose share).
 *   - /admin/ops/circuit: 10s, feeds CircuitMatrix + Quarantine.
 *   - Heatmap / SentryRules / Forecast (baseline): panel-owned (5 min /
 *     on-mount+mutate / on-mount+manual refresh respectively).
 *   - DispatchTicker: panel-owned 30s poll of /admin/ops/audit.
 *   - Firehose: Supabase Realtime push (no poll).
 *
 * Aesthetic: Bureau-Dispatch cockpit — corner brackets, scanline veil,
 * amber accents on a near-black surface. All animations respect
 * ``prefers-reduced-motion``.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  bureauOpsApi,
  type CircuitMatrix,
  type LedgerSnapshot,
} from '../../services/api/BureauOpsApiService.js';
import { captureError } from '../../services/SentryService.js';
import './ops/BurnRatePanel.js';
import './ops/CircuitMatrixPanel.js';
import './ops/DispatchTicker.js';
import './ops/FirehosePanel.js';
import './ops/ForecastPanel.js';
import './ops/HeatmapPanel.js';
import './ops/IncidentDossierDrawer.js';
import './ops/LedgerPanel.js';
import './ops/QuarantinePanel.js';
import './ops/SentryRulesPanel.js';

const LEDGER_POLL_MS = 30_000;
const CIRCUIT_POLL_MS = 10_000;

@localized()
@customElement('velg-admin-ops-tab')
export class VelgAdminOpsTab extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber, #d4a24e);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      display: block;
      position: relative;
      font-family: var(--font-mono);
      animation: ops-enter var(--duration-entrance, 350ms) var(--ease-dramatic);
    }

    @keyframes ops-enter {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
    }

    .ops-classification {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-danger);
      border: 2px solid var(--color-danger);
      padding: var(--space-0-5) var(--space-3);
      display: inline-block;
      margin-bottom: var(--space-3);
    }

    .ops-title {
      font-family: var(--font-brutalist);
      font-size: var(--text-2xl);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1) 0;
    }

    .ops-subtitle {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-6) 0;
    }

    .ops-dossier-btn {
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      margin-bottom: var(--space-4);
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .ops-dossier-btn:hover,
    .ops-dossier-btn:focus-visible {
      background: var(--color-accent-amber);
      color: var(--color-text-inverse);
      border-color: var(--color-accent-amber);
      outline: none;
    }

    .ops-error {
      padding: var(--space-4);
      background: var(--color-danger-bg);
      border: 2px solid var(--color-danger-border);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      margin-bottom: var(--space-6);
    }

    .ops-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
    }

    .ops-grid > velg-ops-ledger-panel,
    .ops-grid > velg-ops-circuit-matrix-panel,
    .ops-grid > velg-ops-heatmap-panel,
    .ops-grid > velg-ops-forecast-panel,
    .ops-grid > velg-ops-sentry-rules-panel,
    .ops-grid > velg-ops-firehose-panel {
      grid-column: 1 / -1;
    }

    @media (max-width: 900px) {
      .ops-grid { grid-template-columns: 1fr; }
      .ops-grid > velg-ops-ledger-panel,
      .ops-grid > velg-ops-circuit-matrix-panel,
      .ops-grid > velg-ops-heatmap-panel,
      .ops-grid > velg-ops-forecast-panel,
      .ops-grid > velg-ops-sentry-rules-panel,
      .ops-grid > velg-ops-firehose-panel { grid-column: auto; }
    }
  `;

  @state() private _ledger: LedgerSnapshot | null = null;
  @state() private _circuit: CircuitMatrix | null = null;
  @state() private _ledgerLoading = true;
  @state() private _circuitLoading = true;
  @state() private _error: string | null = null;
  @state() private _dossierOpen = false;

  private _ledgerTimer: number | null = null;
  private _circuitTimer: number | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await Promise.all([this._fetchLedger(), this._fetchCircuit()]);
    this._ledgerTimer = window.setInterval(() => void this._fetchLedger(), LEDGER_POLL_MS);
    this._circuitTimer = window.setInterval(() => void this._fetchCircuit(), CIRCUIT_POLL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._ledgerTimer !== null) {
      window.clearInterval(this._ledgerTimer);
      this._ledgerTimer = null;
    }
    if (this._circuitTimer !== null) {
      window.clearInterval(this._circuitTimer);
      this._circuitTimer = null;
    }
  }

  private async _fetchLedger(): Promise<void> {
    const resp = await bureauOpsApi.getLedger();
    if (resp.success) {
      this._ledger = resp.data;
      this._ledgerLoading = false;
      this._error = null;
    } else {
      this._ledgerLoading = false;
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'AdminOpsTab._fetchLedger',
        code: resp.error.code,
      });
    }
  }

  private async _fetchCircuit(): Promise<void> {
    const resp = await bureauOpsApi.getCircuit();
    if (resp.success) {
      this._circuit = resp.data;
      this._circuitLoading = false;
    } else {
      this._circuitLoading = false;
      captureError(new Error(resp.error.message), {
        source: 'AdminOpsTab._fetchCircuit',
        code: resp.error.code,
      });
    }
  }

  private async _handleCircuitChanged(): Promise<void> {
    // QuarantinePanel mutation just completed — pull fresh state.
    await this._fetchCircuit();
  }

  protected render() {
    return html`
      <div class="ops-classification">${msg('Ops // Control Surface')}</div>
      <h2 class="ops-title">${msg('Bureau Ops')}</h2>
      <p class="ops-subtitle">
        ${msg('Live AI spend, circuit posture, and incident audit log. Mutations require a reason.')}
      </p>

      <button
        class="ops-dossier-btn"
        type="button"
        @click=${() => {
          this._dossierOpen = true;
        }}
      >
        ${msg('Open incident dossier')}
      </button>

      ${this._error ? html`<div class="ops-error">${msg('Ledger unavailable:')} ${this._error}</div>` : nothing}

      <div class="ops-grid">
        <velg-ops-ledger-panel
          .snapshot=${this._ledger}
          .loading=${this._ledgerLoading}
        ></velg-ops-ledger-panel>

        <velg-ops-burn-rate-panel
          .snapshot=${this._ledger}
          .loading=${this._ledgerLoading}
        ></velg-ops-burn-rate-panel>

        <velg-ops-circuit-matrix-panel
          .matrix=${this._circuit}
          .loading=${this._circuitLoading}
        ></velg-ops-circuit-matrix-panel>

        <velg-ops-quarantine-panel
          .matrix=${this._circuit}
          .loading=${this._circuitLoading}
          @ops-circuit-changed=${this._handleCircuitChanged}
        ></velg-ops-quarantine-panel>

        <velg-ops-heatmap-panel></velg-ops-heatmap-panel>

        <velg-ops-forecast-panel .snapshot=${this._ledger}></velg-ops-forecast-panel>

        <velg-ops-sentry-rules-panel></velg-ops-sentry-rules-panel>

        <velg-ops-firehose-panel></velg-ops-firehose-panel>
      </div>

      <velg-ops-dispatch-ticker></velg-ops-dispatch-ticker>

      <velg-ops-incident-dossier-drawer
        ?open=${this._dossierOpen}
        @dossier-close=${() => {
          this._dossierOpen = false;
        }}
      ></velg-ops-incident-dossier-drawer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-ops-tab': VelgAdminOpsTab;
  }
}
