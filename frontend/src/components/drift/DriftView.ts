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
import { themeService } from '../../services/ThemeService.js';
import { PLATFORM_DARK_CONFIG } from '../../services/theme-presets.js';
import type {
  DriftChart,
  DriftDock,
  DriftQuestOffer,
  DriftQuestState,
  DriftTuning,
  TravelRun,
} from '../../types/drift.js';
import type { ApiResponse } from '../../types/index.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import './DriftChartHost.js';
import './DriftDockPanel.js';
import { FREQUENCIES, freqColorByName } from './palette.js';

// Gauge maxima come from the tuning API (drift_tuning is the source of truth); these
// are only the fail-soft fallbacks if that fetch fails. P0 travellers are class 1.
const DZ_CAP_FALLBACK = 20;
const BB_MAX_FALLBACK = 11;
const WINDOW_BASE_FALLBACK = 8;

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
      .hud__section-label {
        margin: 0 0 var(--space-2);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      .hud__manifest,
      .hud__depesche {
        margin: 0 0 var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-raised);
        border-left: var(--border-width-thick) solid var(--color-info);
      }
      .hud__depesche {
        border-left-color: var(--color-primary);
      }
      .manifest__item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-0-5) 0;
      }
      .manifest__dot {
        width: 8px;
        height: 8px;
        flex: none;
        background: var(--_v, var(--color-text-muted));
        box-shadow: 0 0 6px var(--_v, transparent);
      }
      .manifest__name {
        flex: 1;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .manifest__vec {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        color: var(--color-text-muted);
      }
      .depesche__title {
        margin: 0 0 var(--space-1);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .depesche__route,
      .depesche__hint {
        margin: 0 0 var(--space-2);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }
      .depesche__hint {
        color: var(--color-warning);
      }
      .depesche__offers {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .depesche__offer {
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-primary);
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-primary-border);
        cursor: pointer;
        transition:
          background var(--transition-fast),
          border-color var(--transition-fast);
      }
      .depesche__offer:hover:not(:disabled) {
        background: var(--color-primary-bg);
        border-color: var(--color-primary);
      }
      .depesche__offer:disabled {
        opacity: 0.5;
        cursor: default;
      }
      @media (prefers-reduced-motion: reduce) {
        .stat__bar > span,
        .depesche__offer {
          transition-duration: 0.01ms;
        }
      }
    `,
  ];

  /** The traveler's home (anchor) sim; falls back to the current simulation. */
  @property({ type: String, attribute: 'anchor-simulation-id' }) anchorSimulationId = '';

  @state() private _chart: DriftChart | null = null;
  @state() private _run: TravelRun | null = null;
  @state() private _tuning: DriftTuning | null = null;
  @state() private _quests: DriftQuestState | null = null;
  @state() private _dock: DriftDock | null = null;
  @state() private _dockOpen = false;
  @state() private _loading = true;
  @state() private _error = false;
  @state() private _busy = false;

  /** The sim whose dock is currently surfaced — avoids refetching while you stand on it. */
  private _dockSimId: string | null = null;

  /** Gauge maxima — from drift_tuning when loaded, else the fail-soft fallbacks. */
  private get _dzCap(): number {
    return this._tuning?.dz_cap ?? DZ_CAP_FALLBACK;
  }
  private get _bbMax(): number {
    return this._tuning?.bandwidth_class_bb_max?.['1'] ?? BB_MAX_FALLBACK;
  }
  private get _windowBase(): number {
    return this._tuning?.window_base ?? WINDOW_BASE_FALLBACK;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // DRIFT is the Zwischenraum between worlds, not a simulation interior. The shell
    // applies the anchor sim's per-sim theme to its own host, which cascades into this
    // view (Velgarien → light surfaces + Oswald). Re-assert platform-dark on our own
    // host so the chart, HUD, node labels and dock dossier stay dark-brutalist no matter
    // which world is the anchor. The element is destroyed on route change, taking these
    // inline tokens with it — no teardown needed (and we must not call resetTheme, which
    // would remove the shell's shared custom-CSS element).
    themeService.applyConfig(PLATFORM_DARK_CONFIG, this);
    void this._load();
  }

  private _load = async (): Promise<void> => {
    this._loading = true;
    this._error = false;
    try {
      const [chartRes, runRes, tuningRes, questRes] = await Promise.all([
        driftApi.getChart(),
        driftApi.getRun(),
        driftApi.getTuning(),
        driftApi.getQuests(),
      ]);
      this._chart = chartRes.success ? (chartRes.data ?? null) : null;
      this._run = runRes.success ? (runRes.data ?? null) : null;
      if (tuningRes.success) this._tuning = tuningRes.data;
      if (questRes.success) this._quests = questRes.data;
      if (!chartRes.success) this._error = true;
      // Resumed onto a foreign broadcast edge? Surface its dossier.
      if (this._run) void this._maybeDock(this._run);
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

  private async _refreshQuests(): Promise<void> {
    const res = await driftApi.getQuests();
    if (res.success) this._quests = res.data;
  }

  /** Accept a deliver Depesche at the current world edge → cargo bound to the run. */
  private _acceptOffer(offer: DriftQuestOffer): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () =>
        driftApi.acceptQuest(
          run.id,
          run.run_version,
          offer.template_key,
          offer.target_simulation_id,
        ),
      async (data) => {
        this._run = data.run;
        await this._refreshQuests();
        VelgToast.success(msg(str`Depesche angenommen – Ziel: ${offer.target_simulation_name}.`));
      },
      'VelgDriftView._acceptOffer',
    );
  }

  /** Deliver the carried Depesche at the target broadcast edge → fires the gate. */
  private _deliver(): void {
    const run = this._run;
    const active = this._quests?.active;
    if (!run || !active) return;
    void this._mutate(
      () => driftApi.advanceQuest(active.id, run.id, run.run_version),
      async (data) => {
        this._run = data.run;
        const fired = data.effects.applied.length;
        await this._refreshQuests();
        VelgToast.success(
          msg(str`Depesche abgeliefert – ${fired} Wirkung${fired === 1 ? '' : 'en'} ausgelöst.`),
        );
      },
      'VelgDriftView._deliver',
    );
  }

  /** Display label for a cargo family (the 7 frequency-matter slugs, concept §7.8). */
  private _cargoLabel(family: string): string {
    switch (family) {
      case 'kontrakte':
        return msg('Kontrakte');
      case 'idiome':
        return msg('Idiome');
      case 'erinnerungsstuecke':
        return msg('Erinnerungsstück');
      case 'resonanzkerne':
        return msg('Resonanzkern');
      case 'blaupausen':
        return msg('Blaupause');
      case 'traumfracht':
        return msg('Traumfracht');
      case 'sehnsuchtsgut':
        return msg('Sehnsuchtsgut');
      default:
        return family;
    }
  }

  /** Surface a FOREIGN world's dossier on docking at its broadcast edge; dismiss it
   *  when the traveller is anywhere else (home, an interstitial, the core). */
  private async _maybeDock(run: TravelRun): Promise<void> {
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    const node = this._chart?.nodes.find((n) => n.id === run.position_node_id);
    const foreignSim =
      node?.node_type === 'broadcast_rand' && node.simulation_id && node.simulation_id !== anchor
        ? node.simulation_id
        : null;
    if (!foreignSim) {
      this._dockOpen = false;
      this._dockSimId = null;
      return;
    }
    if (foreignSim === this._dockSimId) return; // already showing this world
    this._dockSimId = foreignSim;
    try {
      const res = await driftApi.getDock(foreignSim);
      if (res.success && res.data) {
        this._dock = res.data;
        this._dockOpen = true;
      }
    } catch (err) {
      captureError(err, { source: 'VelgDriftView._maybeDock' });
    }
  }

  private _closeDock = (): void => {
    this._dockOpen = false;
  };

  /**
   * The one mutation runner: busy-guard, call the RPC, hand a success payload to the
   * caller's `onSuccess`, and on a refused action map the error to a friendly toast +
   * resync (the server is the only truth). Generic over the response type so the run
   * lifecycle, accept and deliver all share the guard + error/resync path.
   */
  private async _mutate<T>(
    fn: () => Promise<ApiResponse<T>>,
    onSuccess: (data: T) => void | Promise<void>,
    source: string,
  ): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      const res = await fn();
      if (res.success) {
        await onSuccess(res.data);
      } else {
        VelgToast.error(this._friendlyError(res.error.message ?? ''));
        await this._refreshRun();
        await this._refreshQuests();
      }
    } catch (err) {
      captureError(err, { source });
      VelgToast.error(msg('Etwas im Drift hat versagt.'));
    } finally {
      this._busy = false;
    }
  }

  /** onSuccess for the run-lifecycle mutations (open/move/complete/abandon): a terminal
   *  status drops back to the Aufbruch state + announces the outcome; otherwise adopt the
   *  run, surface a foreign dock, and refresh the quest snapshot (position/cargo changed). */
  private _adoptRun = (run: TravelRun): void => {
    if (run.status === 'completed' || run.status === 'abandoned') {
      this._run = null;
      this._quests = null;
      this._closeDock();
      this._announceClose(run);
    } else {
      this._run = run;
      void this._maybeDock(run);
      void this._refreshQuests();
    }
  };

  /** Toast a closed run's outcome: haul banked (Entladung), lost (recall), or Rückzug. */
  private _announceClose(run: TravelRun): void {
    const cp = run.checkpoint;
    const recall = typeof cp.recall === 'string' ? cp.recall : null;
    if (run.status === 'completed') {
      VelgToast.success(msg(str`Entladung: ${Number(cp.haul_banked ?? 0)} Vermessung gesichert.`));
    } else if (recall) {
      const reason = recall === 'kohaerenz' ? msg('Kohärenz zerfasert') : msg('Fenster abgelaufen');
      VelgToast.error(
        msg(str`Recall (${reason}): ${Number(cp.haul_lost ?? 0)} Vermessung verloren.`),
      );
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
    void this._mutate(() => driftApi.openRun(anchor), this._adoptRun, 'VelgDriftView._open');
  }

  private _onNodePick(e: CustomEvent<{ nodeId: string }>): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.move(run.id, run.run_version, e.detail.nodeId),
      this._adoptRun,
      'VelgDriftView._move',
    );
  }

  private _complete(): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.complete(run.id, run.run_version),
      this._adoptRun,
      'VelgDriftView._complete',
    );
  }

  private _abandon(): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.abandon(run.id, run.run_version),
      this._adoptRun,
      'VelgDriftView._abandon',
    );
  }

  /** Map a raw RPC error to a friendly, in-world German message. */
  private _friendlyError(message: string): string {
    if (message.includes('NOT_AT_HOME')) return msg('Entladung nur an deiner Heimat-Broadcast.');
    if (message.includes('NOT_ADJACENT')) return msg('Dieser Node ist von hier nicht erreichbar.');
    if (message.includes('NOT_AT_TARGET'))
      return msg('Trage die Depesche erst zur Ziel-Broadcast.');
    if (message.includes('QUEST_ACTIVE')) return msg('Du trägst bereits eine Depesche.');
    if (message.includes('CARGO_MISSING')) return msg('Die Fracht ist nicht mehr an Bord.');
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
    const dz = run ? Math.min(1, run.dissonanz / this._dzCap) : 0.12;

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
        ${
          this._dockOpen && this._dock
            ? html`<velg-drift-dock-panel
              .dock=${this._dock}
              @dock-close=${this._closeDock}
            ></velg-drift-dock-panel>`
            : ''
        }
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
          ${this._stat(msg('Bandbreite'), run.bandbreite, this._bbMax, 'bb')}
          ${this._stat(msg('Dissonanz'), run.dissonanz, this._dzCap, 'dz')}
        </dl>
        <p class="hud__takt">
          ${msg('Takte übrig')} ${run.window_remaining}/${this._windowBase} · ${msg('Takt')} ${run.takt_count}
        </p>
        ${this._renderQuests(run)}
        ${
          atHome
            ? ''
            : html`<p class="hud__warn">
              ${msg('Entladung nur an deiner Heimat-Broadcast. Kehre zurück.')}
            </p>`
        }
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

  /** Manifest (carried cargo) + Depesche section (the active quest's deliver control, or
   *  the offers acceptable at this world edge). Hidden when nothing applies. */
  private _renderQuests(run: TravelRun) {
    const q = this._quests;
    if (!q) return '';
    const active = q.active;
    const atTarget = !!active && run.position_node_id === active.slots.target_node;
    return html`
      ${
        q.cargo.length
          ? html`<div class="hud__manifest">
            <p class="hud__section-label">${msg('Fracht')}</p>
            ${q.cargo.map(
              (c) => html`<div class="manifest__item">
                <span class="manifest__dot" style="--_v:${freqColorByName(c.vector)}"></span>
                <span class="manifest__name">${this._cargoLabel(c.family)}</span>
                <span class="manifest__vec">${c.vector}</span>
              </div>`,
            )}
          </div>`
          : ''
      }
      ${
        active
          ? html`<div class="hud__depesche">
            <p class="hud__section-label">${msg('Depesche')}</p>
            <p class="depesche__title">${active.title ?? msg('Depesche')}</p>
            <p class="depesche__route">
              ${msg('Ziel')}: ${active.target_simulation_name ?? msg('Unbekannt')}
            </p>
            ${
              atTarget
                ? html`<button
                    class="btn btn--primary btn--sm"
                    ?disabled=${this._busy}
                    @click=${this._deliver}
                  >
                    ${msg('Depesche abliefern')}
                  </button>`
                : html`<p class="depesche__hint">${msg('Trage sie zur Ziel-Broadcast.')}</p>`
            }
          </div>`
          : q.offers.length
            ? html`<div class="hud__depesche">
              <p class="hud__section-label">${msg('Depeschen verfügbar')}</p>
              <div class="depesche__offers">
                ${q.offers.map(
                  (o) => html`<button
                    class="depesche__offer"
                    ?disabled=${this._busy}
                    title=${o.brief}
                    aria-label=${str`Depesche annehmen – Ziel ${o.target_simulation_name}`}
                    @click=${() => this._acceptOffer(o)}
                  >
                    ${o.target_simulation_name}
                  </button>`,
                )}
              </div>
            </div>`
            : ''
      }
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
