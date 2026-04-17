import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { healthApi } from '../../services/api/HealthApiService.js';
import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import { zoneActionsApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type {
  BuildingReadiness,
  EmbassyEffectiveness,
  SimulationHealth,
  SimulationHealthDashboard,
  ZoneActionType,
  ZoneStability,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { titleGroupStyles } from '../shared/title-group-styles.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/VelgHelpTip.js';

import '../shared/LoadingState.js';
import '../shared/ErrorState.js';

/**
 * Health label → CSS color token mapping.
 */
function healthColor(label: string): string {
  switch (label) {
    case 'exemplary':
      return 'var(--color-success)';
    case 'stable':
      return 'var(--color-success)';
    case 'functional':
      return 'var(--color-info, var(--color-secondary))';
    case 'unstable':
      return 'var(--color-warning, var(--color-accent))';
    case 'critical':
      return 'var(--color-danger)';
    default:
      return 'var(--color-text-muted)';
  }
}

function staffingColor(status: string): string {
  switch (status) {
    case 'operational':
      return 'var(--color-success)';
    case 'overcrowded':
      return 'var(--color-info, var(--color-secondary))';
    case 'understaffed':
      return 'var(--color-warning, var(--color-accent))';
    case 'critically_understaffed':
      return 'var(--color-danger)';
    default:
      return 'var(--color-text-muted)';
  }
}

@localized()
@customElement('velg-simulation-health-view')
export class VelgSimulationHealthView extends LitElement {
  static styles = [
    viewHeaderStyles,
    titleGroupStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }

      /* ── Overall health hero ── */

      .health-hero {
        display: flex;
        align-items: center;
        gap: var(--space-6);
        padding: var(--space-6);
        background: var(--color-surface-raised, var(--color-surface));
        border: var(--border-default);
        box-shadow: var(--shadow-md);
        margin-bottom: var(--space-6);
      }

      .health-hero__meter {
        position: relative;
        width: 100px;
        height: 100px;
        flex-shrink: 0;
      }

      .health-hero__meter svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .health-hero__meter-bg {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 8;
      }

      .health-hero__meter-fill {
        fill: none;
        stroke-width: 8;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.8s ease;
      }

      .health-hero__meter-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-xl);
      }

      .health-hero__info {
        flex: 1;
        min-width: 0;
      }

      .health-hero__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-2xl);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        margin: 0 0 var(--space-2);
      }

      .health-hero__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-lg);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      .health-hero__stats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-4);
        margin-top: var(--space-3);
      }

      .health-hero__stat {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .health-hero__stat strong {
        color: var(--color-text-primary);
      }

      /* ── Grid layout ── */

      .health-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-5);
      }

      @media (max-width: 768px) {
        .health-grid {
          grid-template-columns: 1fr;
        }
        .health-hero {
          flex-direction: column;
          text-align: center;
        }
      }

      /* ── Section panels ── */

      .panel {
        background: var(--color-surface-raised, var(--color-surface));
        border: var(--border-default);
        box-shadow: var(--shadow-sm);
        padding: var(--space-5);
      }

      .panel--full {
        grid-column: 1 / -1;
      }

      .panel__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }

      .panel__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-base);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        margin: 0;
      }

      .panel__icon {
        display: flex;
        align-items: center;
        color: var(--color-text-muted);
      }

      /* ── Zone stability bars ── */

      .zone-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .zone-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .zone-item__name {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        min-width: 140px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .zone-item__bar {
        flex: 1;
        height: 18px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        position: relative;
        overflow: hidden;
      }

      .zone-item__fill {
        height: 100%;
        transition: width 0.6s ease;
      }

      .zone-item__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        min-width: 60px;
        text-align: right;
      }

      .zone-item__label {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        min-width: 70px;
        text-align: right;
      }

      /* ── Zone fortification overlays ── */

      .zone-item-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .zone-item--quarantined {
        background: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 6px,
          color-mix(in srgb, var(--color-warning) 8%, transparent) 6px,
          color-mix(in srgb, var(--color-warning) 8%, transparent) 12px
        );
        padding: var(--space-2) var(--space-3);
        margin: 0 calc(var(--space-3) * -1);
      }

      .zone-item__shield-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        border: var(--border-width-thin) solid var(--color-border);
        color: var(--color-text-secondary);
        cursor: pointer;
        flex-shrink: 0;
        transition: all var(--transition-fast);
      }

      .zone-item__shield-btn:hover {
        color: var(--color-success);
        border-color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 8%, transparent);
      }

      .zone-item__shield-btn--active {
        color: var(--color-success);
        border-color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        box-shadow: 0 0 8px color-mix(in srgb, var(--color-success) 30%, transparent);
        animation: shield-glow 2s ease-in-out infinite;
      }

      .zone-item__shield-btn--quarantined {
        color: var(--color-warning);
        border-color: var(--color-warning);
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
      }

      @keyframes shield-glow {
        0%, 100% { box-shadow: 0 0 6px color-mix(in srgb, var(--color-success) 25%, transparent); }
        50% { box-shadow: 0 0 14px color-mix(in srgb, var(--color-success) 50%, transparent); }
      }

      @media (prefers-reduced-motion: reduce) {
        .zone-item__shield-btn--active { animation: none; }
        .zone-item__cascade-dot { animation: none; }
      }

      .zone-item__overlays {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
        flex-shrink: 0;
      }

      .zone-item__overlay-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-0-5);
        padding: var(--space-0-5) var(--space-1-5);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        white-space: nowrap;
      }

      .zone-item__overlay-badge--fortified {
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        border: var(--border-width-thin) solid color-mix(in srgb, var(--color-success) 40%, transparent);
        color: var(--color-success);
      }

      .zone-item__overlay-badge--quarantine {
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
        border: var(--border-width-thin) solid color-mix(in srgb, var(--color-warning) 40%, transparent);
        color: var(--color-warning);
      }

      .zone-item__overlay-badge--cascade {
        background: color-mix(in srgb, var(--color-danger) 12%, transparent);
        border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 40%, transparent);
        color: var(--color-danger);
      }

      .zone-item__cascade-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-danger);
        animation: cascade-pulse 1.5s ease-in-out infinite;
      }

      @keyframes cascade-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.4); }
      }

      .zone-item__pressure-text {
        font-family: var(--font-brutalist);
        font-size: 10px;
        color: var(--color-text-secondary);
        padding-left: calc(140px + var(--space-3));
        margin-top: var(--space-0-5);
      }

      /* ── Zone action selector ── */

      .zone-action-selector {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-2);
        border: none;
        padding: 0;
        margin: 0;
        padding: var(--space-3) 0 var(--space-1);
        padding-left: calc(140px + var(--space-3));
      }

      .zone-action-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-sunken, var(--color-surface));
        border: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        transition: all var(--transition-fast);
        font: inherit;
        color: inherit;
        text-align: left;
      }

      .zone-action-card:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .zone-action-card:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .zone-action-card:hover {
        border-color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-sunken, var(--color-surface)));
      }

      .zone-action-card--loading {
        opacity: 0.5;
        pointer-events: none;
      }

      .zone-action-card__header {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      .zone-action-card__icon {
        display: flex;
        color: var(--color-text-muted);
      }

      .zone-action-card__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      .zone-action-card__desc {
        font-family: var(--font-body);
        font-size: 10px;
        color: var(--color-text-secondary);
        line-height: 1.3;
      }

      .zone-action-card__effect {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: 10px;
        color: var(--color-success);
      }

      .zone-action-cancel {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        margin-left: calc(140px + var(--space-3));
        margin-top: var(--space-1);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: transparent;
        color: var(--color-danger);
        border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 40%, transparent);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .zone-action-cancel:hover {
        background: color-mix(in srgb, var(--color-danger) 10%, transparent);
        border-color: var(--color-danger);
      }

      .zone-action-cancel--loading {
        opacity: 0.5;
        pointer-events: none;
      }

      /* ── Building readiness list ── */

      .building-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .building-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      }

      .building-item:last-child {
        border-bottom: none;
      }

      .building-item__name {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .building-item__type {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        min-width: 80px;
      }

      .building-item__staffing {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        min-width: 50px;
        text-align: right;
      }

      .building-item__readiness {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        min-width: 40px;
        text-align: right;
      }

      .building-item__indicator {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* ── Diplomacy ── */

      .diplo-stats {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .diplo-stat {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: var(--font-body);
        font-size: var(--text-sm);
      }

      .diplo-stat__label {
        color: var(--color-text-secondary);
      }

      .diplo-stat__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
      }

      .embassy-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      }

      .embassy-item:last-child {
        border-bottom: none;
      }

      .embassy-item__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .embassy-item__sims {
        flex: 1;
        font-family: var(--font-body);
        font-size: var(--text-sm);
      }

      .embassy-item__vector {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      .embassy-item__score {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        min-width: 40px;
        text-align: right;
      }

      /* ── Bleed activity ── */

      .bleed-stats {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      /* ── Events list ── */

      .event-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .event-item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      }

      .event-item:last-child {
        border-bottom: none;
      }

      .event-item__impact {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        color: var(--color-danger);
        flex-shrink: 0;
        min-width: 24px;
      }

      .event-item__info {
        flex: 1;
        min-width: 0;
      }

      .event-item__title {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }

      .event-item__meta {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        margin-top: 2px;
      }

      /* ── Heartbeat Systems ── */

      .hb-subsection {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }

      .hb-subsection:last-child {
        margin-bottom: 0;
      }

      .hb-subsection__label {
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-text-muted);
        margin-bottom: var(--space-1);
      }

      .hb-meter {
        display: grid;
        grid-template-columns: 110px 1fr 40px;
        align-items: center;
        gap: var(--space-2);
      }

      .hb-meter__label {
        font-family: var(--font-body);
        font-size: var(--text-xs);
        text-transform: capitalize;
        color: var(--color-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hb-meter__bar {
        height: 6px;
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        position: relative;
        overflow: hidden;
      }

      .hb-meter__fill {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.6s ease;
      }

      .hb-meter__fill--harmonized {
        background: var(--color-success);
      }

      .hb-meter__fill--anchor {
        background: var(--color-info);
      }

      .hb-meter__threshold {
        position: absolute;
        top: -2px;
        bottom: -2px;
        width: 2px;
        background: var(--color-warning);
        z-index: 1;
      }

      .hb-meter__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-align: right;
        color: var(--color-text-secondary);
      }

      .hb-meter__value--harmonized {
        color: var(--color-success);
      }

      /* ── Empty state ── */

      .panel__empty {
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        text-align: center;
        padding: var(--space-4);
      }

      /* ── Refresh button ── */

      .refresh-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .refresh-btn:hover {
        color: var(--color-primary);
        border-color: var(--color-primary);
      }
    `,
  ];

  @property({ type: String }) simulationId = '';
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _dashboard: SimulationHealthDashboard | null = null;
  @state() private _refreshing = false;
  @state() private _selectedZoneForAction: string | null = null;
  @state() private _actionLoading = false;
  @state() private _attunements: Array<{
    resonance_signature: string;
    depth: number;
    positive_threshold: number;
  }> = [];
  @state() private _anchors: Array<{
    name: string;
    strength: number;
    status: string;
    anchor_simulation_ids: string[];
  }> = [];

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const [healthResult, attResult, anchorResult] = await Promise.all([
        healthApi.getDashboard(this.simulationId, appState.currentSimulationMode.value),
        heartbeatApi.listAttunements(this.simulationId).catch((err) => {
          captureError(err, { source: 'VelgSimulationHealthView._load.listAttunements' });
          return { success: false, data: null };
        }),
        heartbeatApi.listAnchors({ simulation_id: this.simulationId }).catch((err) => {
          captureError(err, { source: 'VelgSimulationHealthView._load.listAnchors' });
          return { success: false, data: null };
        }),
      ]);
      if (healthResult.success && healthResult.data) {
        this._dashboard = healthResult.data;
      } else {
        this._error = healthResult.error?.message ?? msg('Failed to load health data.');
      }
      if (attResult.success && attResult.data) {
        this._attunements = attResult.data as typeof this._attunements;
      }
      if (anchorResult.success && anchorResult.data) {
        this._anchors = anchorResult.data as typeof this._anchors;
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unexpected error occurred.');
    } finally {
      this._loading = false;
    }
  }

  private async _handleRefresh(): Promise<void> {
    if (this._refreshing || !appState.canAdmin.value) return;
    this._refreshing = true;
    try {
      await healthApi.refreshMetrics(this.simulationId);
      await this._load();
    } finally {
      this._refreshing = false;
    }
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading health data...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state message=${this._error}></velg-error-state>`;
    }
    if (!this._dashboard) return nothing;

    const { health, zones, buildings, embassies, recent_high_impact_events } = this._dashboard;

    return html`
      <div class="view">
        <div class="view__header">
          <div class="title-group">
            <h1 class="view__title">${msg('Simulation Health')}</h1>
            <velg-help-tip
              topic="world"
              label=${msg('What drives simulation health?')}
            ></velg-help-tip>
          </div>
          ${
            appState.canAdmin.value
              ? html`
                <button
                  class="refresh-btn"
                  ?disabled=${this._refreshing}
                  @click=${this._handleRefresh}
                >
                  ${icons.sparkle(12)}
                  ${this._refreshing ? msg('Refreshing...') : msg('Refresh Metrics')}
                </button>
              `
              : nothing
          }
        </div>

        ${this._renderHero(health)}

        <div class="health-grid">
          ${this._renderZonePanel(zones)}
          ${this._renderStaffingPanel(health, buildings)}
          ${this._renderDiplomacyPanel(health, embassies)}
          ${this._renderBleedPanel(health)}
          ${this._renderHeartbeatSystemsPanel()}
          ${this._renderEventsPanel(recent_high_impact_events)}
        </div>
      </div>
    `;
  }

  private _renderHero(h: SimulationHealth) {
    const pct = Math.round(h.overall_health * 100);
    const color = healthColor(h.health_label);
    const circumference = 2 * Math.PI * 40;
    const dashoffset = circumference * (1 - h.overall_health);

    return html`
      <div class="health-hero">
        <div
          class="health-hero__meter"
          role="meter"
          aria-valuenow=${pct}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label=${msg(str`Overall health: ${pct} percent`)}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="health-hero__meter-bg" cx="50" cy="50" r="40" />
            <circle
              class="health-hero__meter-fill"
              cx="50" cy="50" r="40"
              stroke=${color}
              stroke-dasharray=${circumference}
              stroke-dashoffset=${dashoffset}
            />
          </svg>
          <span class="health-hero__meter-text" style="color: ${color}" aria-hidden="true">${pct}</span>
        </div>
        <div class="health-hero__info">
          <h2 class="health-hero__title">${h.simulation_name}</h2>
          <span class="health-hero__label" style="color: ${color}">
            ${h.health_label.toUpperCase()}
          </span>
          <div class="health-hero__stats">
            <span class="health-hero__stat">
              <strong>${h.zone_count}</strong> ${msg('zones')}
            </span>
            <span class="health-hero__stat">
              <strong>${h.building_count}</strong> ${msg('buildings')}
            </span>
            <span class="health-hero__stat">
              <strong>${h.total_agents_assigned}</strong> / ${h.total_capacity} ${msg('staffing')}
            </span>
            <span class="health-hero__stat">
              <strong>${h.active_embassy_count}</strong> ${msg('embassies')}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private _toggleActionSelector(zoneId: string): void {
    this._selectedZoneForAction = this._selectedZoneForAction === zoneId ? null : zoneId;
  }

  private async _handleZoneAction(zoneId: string, actionType: ZoneActionType): Promise<void> {
    if (this._actionLoading) return;
    this._actionLoading = true;
    try {
      await zoneActionsApi.create(this.simulationId, zoneId, { action_type: actionType });
      this._selectedZoneForAction = null;
      await this._load();
    } catch (err) {
      // API layer surfaces the user-facing toast — capture here for Sentry visibility.
      captureError(err, { source: 'VelgSimulationHealthView._handleZoneAction' });
    } finally {
      this._actionLoading = false;
    }
  }

  private async _handleCancelAction(zoneId: string): Promise<void> {
    if (this._actionLoading) return;
    this._actionLoading = true;
    try {
      const listResult = await zoneActionsApi.list(this.simulationId, zoneId);
      if (listResult.success && listResult.data) {
        const active = listResult.data.find(
          (a) => !a.deleted_at && new Date(a.expires_at) > new Date(),
        );
        if (active) {
          await zoneActionsApi.cancel(this.simulationId, zoneId, active.id);
        }
      }
      this._selectedZoneForAction = null;
      await this._load();
    } catch (err) {
      // API layer surfaces the user-facing toast — capture here for Sentry visibility.
      captureError(err, { source: 'VelgSimulationHealthView._handleCancelAction' });
    } finally {
      this._actionLoading = false;
    }
  }

  private _renderZoneOverlays(z: ZoneStability) {
    const hasFortification = z.fortification_reduction > 0;
    const hasCascadeRisk = z.event_pressure > 0.7;

    if (!hasFortification && !z.is_quarantined && !hasCascadeRisk) return nothing;

    return html`
      <div class="zone-item__overlays">
        ${
          hasFortification && !z.is_quarantined
            ? html`<span class="zone-item__overlay-badge zone-item__overlay-badge--fortified"
              >${icons.fortify(10)} ${msg('Fortified')}</span>`
            : nothing
        }
        ${
          z.is_quarantined
            ? html`<span class="zone-item__overlay-badge zone-item__overlay-badge--quarantine"
              aria-label=${msg('Zone quarantined')}
              >${msg('Quarantined')}</span>`
            : nothing
        }
        ${
          hasCascadeRisk
            ? html`<span class="zone-item__overlay-badge zone-item__overlay-badge--cascade"
              aria-label=${msg('Cascade risk: zone pressure exceeds threshold')}
              ><span class="zone-item__cascade-dot"></span> ${msg('Cascade Risk')}</span>`
            : nothing
        }
      </div>
    `;
  }

  private _renderActionSelector(z: ZoneStability) {
    if (this._selectedZoneForAction !== z.zone_id) return nothing;

    const canEdit = appState.canEdit.value;
    // If zone has an active action (fortification_reduction > 0 or is_quarantined), show cancel option
    const hasActiveAction = z.fortification_reduction > 0 || z.is_quarantined;

    if (hasActiveAction && canEdit) {
      // We need the action ID — for now show a cancel-by-zone button
      return html`
        <button
          class="zone-action-cancel ${this._actionLoading ? 'zone-action-cancel--loading' : ''}"
          @click=${() => this._handleCancelAction(z.zone_id)}
          ?disabled=${this._actionLoading}
        >
          ${icons.close(10)} ${this._actionLoading ? msg('Cancelling...') : msg('Cancel Active Action')}
        </button>
      `;
    }

    if (!canEdit) return nothing;

    const actions: {
      type: ZoneActionType;
      name: string;
      desc: string;
      effect: string;
      icon: typeof icons.fortify;
    }[] = [
      {
        type: 'fortify',
        name: msg('Fortify'),
        desc: msg('Deploy resources to stabilize zone'),
        effect: msg('-30% pressure / 7 days'),
        icon: icons.fortify,
      },
      {
        type: 'quarantine',
        name: msg('Quarantine'),
        desc: msg('Isolate zone to prevent cascade spreading'),
        effect: msg('Block cascades / 14 days'),
        icon: icons.alertTriangle,
      },
      {
        type: 'deploy_resources',
        name: msg('Deploy'),
        desc: msg('Emergency intervention, strong but short'),
        effect: msg('-50% pressure / 3 days'),
        icon: icons.deploy,
      },
    ];

    return html`
      <fieldset class="zone-action-selector" role="radiogroup" aria-label=${msg('Zone actions')}>
        <legend class="sr-only">${msg('Choose zone action')}</legend>
        ${actions.map(
          (a) => html`
            <button
              type="button"
              class="zone-action-card ${this._actionLoading ? 'zone-action-card--loading' : ''}"
              ?disabled=${this._actionLoading}
              @click=${() => this._handleZoneAction(z.zone_id, a.type)}
            >
              <div class="zone-action-card__header">
                <span class="zone-action-card__icon">${a.icon(12)}</span>
                <span class="zone-action-card__name">${a.name}</span>
              </div>
              <span class="zone-action-card__desc">${a.desc}</span>
              <span class="zone-action-card__effect">${a.effect}</span>
            </button>
          `,
        )}
      </fieldset>
    `;
  }

  private _renderZonePanel(zones: ZoneStability[]) {
    const canEdit = appState.canEdit.value;

    return html`
      <div class="panel">
        <div class="panel__header">
          <span class="panel__icon">${icons.mapPin(16)}</span>
          <h3 class="panel__title">${msg('Zone Stability')}</h3>
        </div>
        ${
          zones.length === 0
            ? html`<div class="panel__empty">${msg('No zones found.')}</div>`
            : html`
              <div class="zone-list">
                ${zones.map((z) => {
                  const isQuarantined = z.is_quarantined;
                  const hasFortification = z.fortification_reduction > 0;
                  const hasActiveAction = hasFortification || isQuarantined;
                  const isSelected = this._selectedZoneForAction === z.zone_id;

                  return html`
                    <div class="zone-item-wrapper">
                      <div class="zone-item ${isQuarantined ? 'zone-item--quarantined' : ''}">
                        <span class="zone-item__name">${z.zone_name}</span>
                        <div class="zone-item__bar">
                          <div
                            class="zone-item__fill"
                            style="width: ${Math.round(z.stability * 100)}%; background: ${healthColor(z.stability_label)}"
                          ></div>
                        </div>
                        <span
                          class="zone-item__value"
                          style="color: ${healthColor(z.stability_label)}"
                          aria-label=${msg(str`Zone stability: ${(z.stability * 100).toFixed(0)} percent`)}
                        >
                          ${(z.stability * 100).toFixed(0)}%
                        </span>
                        <span class="zone-item__label">${z.stability_label}</span>
                        ${this._renderZoneOverlays(z)}
                        ${
                          canEdit
                            ? html`
                            <button
                              class="zone-item__shield-btn ${hasActiveAction ? (isQuarantined ? 'zone-item__shield-btn--quarantined' : 'zone-item__shield-btn--active') : ''}"
                              aria-label=${msg(str`Fortify zone: ${z.zone_name}`)}
                              aria-expanded=${isSelected}
                              @click=${() => this._toggleActionSelector(z.zone_id)}
                            >
                              ${icons.fortify(14)}
                            </button>
                          `
                            : nothing
                        }
                      </div>
                      ${
                        z.total_pressure > 0
                          ? html`<div class="zone-item__pressure-text">
                            ${msg(str`Pressure: ${Math.round(z.event_pressure * 100)}% targeted + ${Math.round(z.ambient_pressure * 100)}% ambient${z.fortification_reduction > 0 ? ` - ${Math.round(z.fortification_reduction * 100)}% fortification` : ''}`)}
                          </div>`
                          : nothing
                      }
                      ${this._renderActionSelector(z)}
                    </div>
                  `;
                })}
              </div>
            `
        }
      </div>
    `;
  }

  private _renderStaffingPanel(health: SimulationHealth, buildings: BuildingReadiness[]) {
    const critical = buildings.filter((b) => b.staffing_status === 'critically_understaffed');
    const overcrowded = buildings.filter((b) => b.staffing_status === 'overcrowded');

    return html`
      <div class="panel">
        <div class="panel__header">
          <span class="panel__icon">${icons.building(16)}</span>
          <h3 class="panel__title">${msg('Staffing Overview')}</h3>
        </div>
        <div class="diplo-stats" style="margin-bottom: var(--space-4)">
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Avg Readiness')}</span>
            <span class="diplo-stat__value" aria-label=${msg(str`Average readiness: ${(health.avg_readiness * 100).toFixed(0)} percent`)}>${(health.avg_readiness * 100).toFixed(0)}%</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Critical')}</span>
            <span class="diplo-stat__value" style="color: var(--color-danger)">
              ${health.critically_understaffed_buildings}
            </span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Overcrowded')}</span>
            <span class="diplo-stat__value" style="color: var(--color-info, var(--color-secondary))">
              ${health.overcrowded_buildings}
            </span>
          </div>
        </div>
        ${
          critical.length > 0
            ? html`
              <div class="building-list">
                ${critical.slice(0, 8).map(
                  (b) => html`
                    <div class="building-item">
                      <span
                        class="building-item__indicator"
                        style="background: ${staffingColor(b.staffing_status)}"
                      ></span>
                      <span class="building-item__name">${b.building_name}</span>
                      <span class="building-item__type">${b.building_type ?? ''}</span>
                      <span
                        class="building-item__staffing"
                        style="color: ${staffingColor(b.staffing_status)}"
                        aria-label=${msg(str`Staffing ratio: ${Math.round(b.staffing_ratio * 100)} percent`)}
                      >
                        ${Math.round(b.staffing_ratio * 100)}%
                      </span>
                    </div>
                  `,
                )}
              </div>
            `
            : nothing
        }
        ${
          overcrowded.length > 0
            ? html`
              <div class="building-list" style="margin-top: var(--space-3)">
                ${overcrowded.slice(0, 4).map(
                  (b) => html`
                    <div class="building-item">
                      <span
                        class="building-item__indicator"
                        style="background: ${staffingColor(b.staffing_status)}"
                      ></span>
                      <span class="building-item__name">${b.building_name}</span>
                      <span class="building-item__type">${b.building_type ?? ''}</span>
                      <span
                        class="building-item__staffing"
                        style="color: ${staffingColor(b.staffing_status)}"
                        aria-label=${msg(str`Staffing ratio: ${Math.round(b.staffing_ratio * 100)} percent`)}
                      >
                        ${Math.round(b.staffing_ratio * 100)}%
                      </span>
                    </div>
                  `,
                )}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderDiplomacyPanel(health: SimulationHealth, embassies: EmbassyEffectiveness[]) {
    return html`
      <div class="panel">
        <div class="panel__header">
          <span class="panel__icon">${icons.brain(16)}</span>
          <h3 class="panel__title">${msg('Diplomacy')}</h3>
        </div>
        <div class="diplo-stats">
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Diplomatic Reach')}</span>
            <span class="diplo-stat__value">${health.diplomatic_reach.toFixed(2)}</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Active Embassies')}</span>
            <span class="diplo-stat__value">${health.active_embassy_count}</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Avg Effectiveness')}</span>
            <span class="diplo-stat__value" aria-label=${msg(str`Average effectiveness: ${(health.avg_embassy_effectiveness * 100).toFixed(0)} percent`)}>
              ${(health.avg_embassy_effectiveness * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        ${
          embassies.length > 0
            ? html`
              <div style="margin-top: var(--space-4)">
                ${embassies.map((e) => {
                  const color = healthColor(e.effectiveness_label);
                  return html`
                    <div class="embassy-item">
                      <span class="embassy-item__dot" style="background: ${color}"></span>
                      <span class="embassy-item__sims">
                        ${e.bleed_vector ?? msg('general')}
                      </span>
                      <span class="embassy-item__vector">${e.effectiveness_label}</span>
                      <span class="embassy-item__score" style="color: ${color}" aria-label=${msg(str`Embassy effectiveness: ${(e.effectiveness * 100).toFixed(0)} percent`)}>
                        ${(e.effectiveness * 100).toFixed(0)}%
                      </span>
                    </div>
                  `;
                })}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderHeartbeatSystemsPanel() {
    if (this._attunements.length === 0 && this._anchors.length === 0) return nothing;

    return html`
      <div class="panel">
        <div class="panel__header">
          <span class="panel__icon">${icons.radar(16)}</span>
          <h3 class="panel__title">
            ${msg('Heartbeat Systems')}
            ${renderInfoBubble(msg('Attunements deepen each tick, eventually spawning positive events. Anchors pool stability across embassy-connected simulations.'))}
          </h3>
        </div>

        ${
          this._attunements.length > 0
            ? html`
          <div class="hb-subsection">
            <span class="hb-subsection__label">${msg('Attunements')}</span>
            ${this._attunements.map((att) => {
              const pct = Math.round(att.depth * 100);
              const thresh = Math.round(att.positive_threshold * 100);
              const harmonized = att.depth >= att.positive_threshold;
              return html`
                <div class="hb-meter" aria-label=${msg(str`${att.resonance_signature}: ${pct}% depth`)}>
                  <span class="hb-meter__label">${att.resonance_signature.replace(/_/g, ' ')}</span>
                  <div class="hb-meter__bar">
                    <div class="hb-meter__fill ${harmonized ? 'hb-meter__fill--harmonized' : ''}" style="width: ${pct}%"></div>
                    <div class="hb-meter__threshold" style="left: ${thresh}%"></div>
                  </div>
                  <span class="hb-meter__value ${harmonized ? 'hb-meter__value--harmonized' : ''}">${pct}%</span>
                </div>
              `;
            })}
          </div>
        `
            : nothing
        }

        ${
          this._anchors.length > 0
            ? html`
          <div class="hb-subsection">
            <span class="hb-subsection__label">${msg('Anchors')}</span>
            ${this._anchors.map((anchor) => {
              const pct = Math.round(anchor.strength * 100);
              return html`
                <div class="hb-meter" aria-label=${msg(str`${anchor.name}: ${pct}% strength`)}>
                  <span class="hb-meter__label">${anchor.name}</span>
                  <div class="hb-meter__bar">
                    <div class="hb-meter__fill hb-meter__fill--anchor" style="width: ${pct}%"></div>
                  </div>
                  <span class="hb-meter__value">${pct}%</span>
                </div>
              `;
            })}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private _renderBleedPanel(health: SimulationHealth) {
    return html`
      <div class="panel">
        <div class="panel__header">
          <span class="panel__icon">${icons.sparkle(16)}</span>
          <h3 class="panel__title">${msg('Bleed Activity')}</h3>
        </div>
        <div class="bleed-stats">
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Permeability')}</span>
            <span class="diplo-stat__value" aria-label=${msg(str`Permeability: ${(health.bleed_permeability * 100).toFixed(0)} percent`)}>${(health.bleed_permeability * 100).toFixed(0)}%</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Outbound Echoes')}</span>
            <span class="diplo-stat__value">${health.outbound_echoes}</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Inbound Echoes')}</span>
            <span class="diplo-stat__value">${health.inbound_echoes}</span>
          </div>
          <div class="diplo-stat">
            <span class="diplo-stat__label">${msg('Avg Outbound Strength')}</span>
            <span class="diplo-stat__value" aria-label=${msg(str`Average outbound strength: ${(health.avg_outbound_strength * 100).toFixed(0)} percent`)}>
              ${(health.avg_outbound_strength * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderEventsPanel(events: Record<string, unknown>[]) {
    return html`
      <div class="panel panel--full">
        <div class="panel__header">
          <span class="panel__icon">${icons.bolt(16)}</span>
          <h3 class="panel__title">${msg('Recent High-Impact Events')}</h3>
        </div>
        ${
          events.length === 0
            ? html`<div class="panel__empty">${msg('No recent high-impact events.')}</div>`
            : html`
              <div class="event-list">
                ${events.map((e) => {
                  const title = (e.title as string) ?? msg('Unknown event');
                  const impact = (e.impact_level as number) ?? 0;
                  const location = (e.location as string) ?? '';
                  const eventType = (e.event_type as string) ?? '';
                  return html`
                    <div class="event-item">
                      <span class="event-item__impact">${impact}</span>
                      <div class="event-item__info">
                        <div class="event-item__title">${title}</div>
                        <div class="event-item__meta">
                          ${eventType}${location ? ` · ${location}` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                })}
              </div>
            `
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-health-view': VelgSimulationHealthView;
  }
}
