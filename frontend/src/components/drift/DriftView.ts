/**
 * VelgDriftView — the first playable DRIFT loop (plan §11, P0a vertical slice).
 *
 * Fetches the active chart + the traveler's run, feeds them to the playable
 * `<velg-drift-chart>` board, and drives the loop: a click on a reachable node
 * (the board's drift-node-pick) calls the move RPC; Aufbruch opens a run,
 * Entladung completes it at home, Rückzug abandons it. The HUD reads the run's
 * Kohärenz / Bandbreite / Dissonanz. All mutations are authorised server-side
 * (the RPC validates ownership + adjacency); a refused action resyncs the run.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import { driftApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type { DriftChart, TravelRun } from '../../types/drift.js';
import type { ApiResponse } from '../../types/index.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import './DriftChartHost.js';

const FREQUENCIES = [
  'commerce',
  'language',
  'memory',
  'resonance',
  'architecture',
  'dream',
  'desire',
] as const;
const DZ_CAP = 20; // the P0 Dissonanz ceiling (mirrors drift_tuning dz_p0_cap)
const BB_SCALE = 6; // class-I bandwidth max (mirrors drift_tuning bandwidth_class_bb_max)
const WINDOW_BASE = 6; // Aufenthaltsfenster Takte (mirrors drift_tuning window_base)

@localized()
@customElement('velg-drift-view')
export class VelgDriftView extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: block;
        --_kh: var(--color-success);
        --_bb: var(--color-info);
        --_dz: var(--color-danger);
      }
      .drift {
        position: relative;
        width: 100%;
        height: clamp(540px, calc(100vh - 220px), 920px);
        background: var(--color-surface-sunken);
        border: var(--border-medium);
        box-shadow: var(--shadow-lg);
      }
      .drift__board {
        position: absolute;
        inset: 0;
      }
      .hud {
        position: absolute;
        top: var(--space-4);
        left: var(--space-4);
        width: min(320px, calc(100% - var(--space-8)));
        padding: var(--space-4);
        background: color-mix(in srgb, var(--color-surface) 86%, transparent);
        border: var(--border-medium);
        border-left: var(--border-width-heavy) solid var(--color-primary);
        box-shadow: var(--shadow-md);
        backdrop-filter: blur(2px);
        z-index: var(--z-raised);
      }
      .hud__title {
        margin: 0 0 var(--space-3);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .hud__haul {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin: 0 0 var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: var(--color-primary-bg);
        border-left: var(--border-width-thick) solid var(--color-primary);
      }
      .hud__haul-label {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .hud__haul-value {
        font-family: var(--font-mono);
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--color-primary);
      }
      .hud__warn {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-warning);
      }
      .hud__hint {
        margin: 0 0 var(--space-4);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }
      .hud__stats {
        margin: 0 0 var(--space-3);
        display: grid;
        gap: var(--space-3);
      }
      .stat {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: baseline;
        gap: var(--space-1) var(--space-2);
      }
      .stat__label {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      .stat__value {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-md);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }
      .stat__bar {
        grid-column: 1 / -1;
        height: 4px;
        background: var(--color-surface-raised);
        overflow: hidden;
      }
      .stat__bar > span {
        display: block;
        height: 100%;
        transition: width var(--transition-slow);
      }
      .stat--kh .stat__bar > span {
        background: var(--_kh);
      }
      .stat--bb .stat__bar > span {
        background: var(--_bb);
      }
      .stat--dz .stat__bar > span {
        background: var(--_dz);
      }
      .hud__takt {
        margin: 0 0 var(--space-4);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .hud__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      @media (prefers-reduced-motion: reduce) {
        .stat__bar > span {
          transition-duration: 0.01ms;
        }
      }
    `,
  ];

  /** The traveler's home (anchor) sim; falls back to the current simulation. */
  @property({ type: String, attribute: 'anchor-simulation-id' }) anchorSimulationId = '';

  @state() private _chart: DriftChart | null = null;
  @state() private _run: TravelRun | null = null;
  @state() private _loading = true;
  @state() private _error = false;
  @state() private _busy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private _load = async (): Promise<void> => {
    this._loading = true;
    this._error = false;
    try {
      const [chartRes, runRes] = await Promise.all([driftApi.getChart(), driftApi.getRun()]);
      this._chart = chartRes.success ? (chartRes.data ?? null) : null;
      this._run = runRes.success ? (runRes.data ?? null) : null;
      if (!chartRes.success) this._error = true;
    } catch (err) {
      captureError(err, { source: 'VelgDriftView._load' });
      this._error = true;
    } finally {
      this._loading = false;
    }
  };

  private async _refreshRun(): Promise<void> {
    const res = await driftApi.getRun();
    if (res.success) this._run = res.data ?? null;
  }

  /** Run a mutation, adopt the returned run, resync on a refused action. */
  private async _act(fn: () => Promise<ApiResponse<TravelRun>>, source: string): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      const res = await fn();
      if (res.success) {
        const run = res.data;
        if (run.status === 'completed' || run.status === 'abandoned') {
          // Terminal: announce the haul banked / lost, then drop back to the "Aufbruch"
          // state (don't keep showing a finished run as if it were still active).
          this._run = null;
          this._announceClose(run);
        } else {
          this._run = run;
        }
      } else {
        VelgToast.error(this._friendlyError(res.error.message ?? ''));
        await this._refreshRun();
      }
    } catch (err) {
      captureError(err, { source });
      VelgToast.error(msg('Something faltered on the chart.'));
    } finally {
      this._busy = false;
    }
  }

  /** Toast a closed run's outcome: haul banked (Entladung), lost (recall), or Rückzug. */
  private _announceClose(run: TravelRun): void {
    const cp = run.checkpoint;
    const recall = typeof cp.recall === 'string' ? cp.recall : null;
    if (run.status === 'completed') {
      VelgToast.success(msg(str`Entladung: ${Number(cp.haul_banked ?? 0)} Vermessung gesichert.`));
    } else if (recall) {
      const reason = recall === 'kohaerenz' ? msg('Kohärenz zerfasert') : msg('Fenster abgelaufen');
      VelgToast.error(msg(str`Recall (${reason}): ${Number(cp.haul_lost ?? 0)} Vermessung verloren.`));
    } else {
      VelgToast.info(msg('Rückzug eingeleitet.'));
    }
  }

  private _open(): void {
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    if (!anchor) {
      VelgToast.error(msg('Anchor to a home simulation before you set out.'));
      return;
    }
    void this._act(() => driftApi.openRun(anchor), 'VelgDriftView._open');
  }

  private _onNodePick(e: CustomEvent<{ nodeId: string }>): void {
    const run = this._run;
    if (!run) return;
    void this._act(
      () => driftApi.move(run.id, run.run_version, e.detail.nodeId),
      'VelgDriftView._move',
    );
  }

  private _complete(): void {
    const run = this._run;
    if (!run) return;
    void this._act(() => driftApi.complete(run.id, run.run_version), 'VelgDriftView._complete');
  }

  private _abandon(): void {
    const run = this._run;
    if (!run) return;
    void this._act(() => driftApi.abandon(run.id, run.run_version), 'VelgDriftView._abandon');
  }

  /** Map a raw RPC error to a friendly, in-world German message. */
  private _friendlyError(message: string): string {
    if (message.includes('NOT_AT_HOME')) return msg('Entladung nur an deiner Heimat-Broadcast.');
    if (message.includes('NOT_ADJACENT')) return msg('Dieser Node ist von hier nicht erreichbar.');
    if (message.includes('RUN_STALE')) return msg('Aus dem Takt geraten, neu synchronisiert.');
    return message || msg('Der Drift hat das verweigert.');
  }

  private _positionName(): string {
    const id = this._run?.position_node_id;
    const node = id ? this._chart?.nodes.find((n) => n.id === id) : null;
    return node?.stable_key ?? msg('Ortung läuft');
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state .message=${msg('Tuning the Driftkarte…')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        .message=${msg('The Driftkarte is unreachable.')}
        show-retry
        @retry=${this._load}
      ></velg-error-state>`;
    }

    const run = this._run;
    const freqIndex = run ? Math.max(0, FREQUENCIES.indexOf(run.frequency)) : 2;
    const dz = run ? Math.min(1, run.dissonanz / DZ_CAP) : 0.12;

    return html`
      <div class="drift">
        <velg-drift-chart
          class="drift__board"
          .chartData=${this._chart}
          .run=${run}
          .frequency=${freqIndex}
          .dissonance=${dz}
          @drift-node-pick=${this._onNodePick}
        ></velg-drift-chart>
        ${this._renderHud(run)}
      </div>
    `;
  }

  private _renderHud(run: TravelRun | null) {
    if (!run) {
      return html`
        <div class="hud">
          <p class="hud__title">${msg('No active drift')}</p>
          <p class="hud__hint">
            ${msg('Open a run at your home broadcast, then click a lit node to cross the Bleed.')}
          </p>
          <button class="btn btn--primary" ?disabled=${this._busy} @click=${this._open}>
            ${msg('Aufbruch')}
          </button>
        </div>
      `;
    }
    const posNode = this._chart?.nodes.find((n) => n.id === run.position_node_id);
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    const atHome = posNode?.node_type === 'broadcast_rand' && posNode.simulation_id === anchor;
    return html`
      <div class="hud">
        <p class="hud__title">${msg('Träger')} · ${this._positionName()}</p>
        <div class="hud__haul">
          <span class="hud__haul-label">${msg('Vermessung (Haul)')}</span>
          <span class="hud__haul-value">${Number(run.checkpoint.haul ?? 0)}</span>
        </div>
        <dl class="hud__stats">
          ${this._stat(msg('Kohärenz'), run.kohaerenz, 100, 'kh')}
          ${this._stat(msg('Bandbreite'), run.bandbreite, BB_SCALE, 'bb')}
          ${this._stat(msg('Dissonanz'), run.dissonanz, DZ_CAP, 'dz')}
        </dl>
        <p class="hud__takt">
          ${msg('Takte übrig')} ${run.window_remaining}/${WINDOW_BASE} · ${msg('Takt')} ${run.takt_count}
        </p>
        ${atHome
          ? ''
          : html`<p class="hud__warn">
              ${msg('Entladung nur an deiner Heimat-Broadcast. Kehre zurück.')}
            </p>`}
        <div class="hud__actions">
          <button
            class="btn btn--secondary"
            ?disabled=${this._busy || !atHome}
            @click=${this._complete}
          >
            ${msg('Entladung')}
          </button>
          <button class="btn btn--ghost" ?disabled=${this._busy} @click=${this._abandon}>
            ${msg('Rückzug')}
          </button>
        </div>
      </div>
    `;
  }

  private _stat(label: string, value: number, max: number, kind: 'kh' | 'bb' | 'dz') {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return html`
      <div class="stat stat--${kind}">
        <dt class="stat__label">${label}</dt>
        <dd class="stat__value">${value}</dd>
        <div class="stat__bar"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-view': VelgDriftView;
  }
}
