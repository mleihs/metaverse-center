import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { campaignsApi } from '../../services/api/index.js';
import type { CampaignAnalytics } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';

const BAR_COLORS = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-info)',
];

@localized()
@customElement('velg-campaign-analytics-panel')
export class VelgCampaignAnalyticsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      padding: var(--space-5);
    }

    .analytics {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    /* ── Header ────────────────────────── */

    .analytics__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-bottom: var(--space-4);
      border-bottom: 2px solid var(--color-border-light);
    }

    .analytics__header-icon {
      color: var(--color-primary);
      opacity: 0.8;
    }

    .analytics__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    /* ── Metric Cards ──────────────────── */

    .metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-4);
    }

    .metric-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md, 6px);
      padding: var(--space-4) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      overflow: hidden;
      animation: cardEnter 0.4s ease-out both;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--card-accent, var(--color-primary));
      opacity: 0.6;
    }

    .metric-card:nth-child(1) { animation-delay: 0ms; --card-accent: var(--color-primary); }
    .metric-card:nth-child(2) { animation-delay: 80ms; --card-accent: var(--color-success); }
    .metric-card:nth-child(3) { animation-delay: 160ms; --card-accent: var(--color-warning); }

    .metric-card__icon {
      color: var(--card-accent, var(--color-primary));
      opacity: 0.7;
    }

    .metric-card__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-3xl);
      letter-spacing: -0.02em;
      line-height: 1;
      tabular-nums: true;
      font-variant-numeric: tabular-nums;
    }

    .metric-card__label {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @keyframes cardEnter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Event Type Breakdown ──────────── */

    .breakdown {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .breakdown__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin: 0;
    }

    .breakdown__bars {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .bar-row {
      display: grid;
      grid-template-columns: 140px 1fr 40px;
      align-items: center;
      gap: var(--space-3);
      animation: cardEnter 0.35s ease-out both;
    }

    .bar-row__label {
      font-size: var(--text-sm);
      color: var(--color-text-tertiary);
      text-transform: capitalize;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bar-row__track {
      height: 8px;
      background: var(--color-border-light);
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-row__fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .bar-row__count {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ── Sparkline Timeline ────────────── */

    .timeline {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .timeline__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin: 0;
    }

    .timeline__chart {
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md, 6px);
      padding: var(--space-3);
    }

    .timeline__svg {
      width: 100%;
      height: auto;
      display: block;
    }

    .timeline__empty {
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      text-align: center;
      padding: var(--space-4);
    }

    .timeline__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      padding-top: var(--space-2);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .legend-swatch {
      width: 10px;
      height: 3px;
      border-radius: 2px;
    }

    /* ── Empty ─────────────────────────── */

    .empty-section {
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      text-align: center;
      padding: var(--space-4);
    }

    /* ── Reduced motion ────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .metric-card,
      .bar-row {
        animation: none;
      }
      .bar-row__fill {
        transition: none;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: String }) campaignId = '';

  @state() private _data: CampaignAnalytics | null = null;
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _animatedValues = { events: 0, echoes: 0, impact: 0 };

  private _animationFrame = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId && this.campaignId) {
      this._load();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (
      (changed.has('simulationId') || changed.has('campaignId')) &&
      this.simulationId &&
      this.campaignId
    ) {
      this._load();
    }
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    const res = await campaignsApi.getAnalytics(this.simulationId, this.campaignId);
    if (res.success && res.data) {
      this._data = res.data as CampaignAnalytics;
      this._animateCounters();
    } else {
      this._error = res.error?.message || msg('Failed to load analytics');
    }
    this._loading = false;
  }

  private _animateCounters(): void {
    if (!this._data) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this._animatedValues = {
        events: this._data.event_count,
        echoes: this._data.echo_count,
        impact: this._data.avg_impact ?? 0,
      };
      return;
    }

    const targets = {
      events: this._data.event_count,
      echoes: this._data.echo_count,
      impact: this._data.avg_impact ?? 0,
    };
    const duration = 800;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - (1 - t) ** 3; // easeOutCubic
      this._animatedValues = {
        events: Math.round(targets.events * ease),
        echoes: Math.round(targets.echoes * ease),
        impact: Math.round(targets.impact * ease * 10) / 10,
      };
      if (t < 1) {
        this._animationFrame = requestAnimationFrame(tick);
      }
    };
    this._animationFrame = requestAnimationFrame(tick);
  }

  private _renderMetricCards() {
    return html`
      <div class="metrics-row">
        <div class="metric-card" role="group" aria-label=${msg('Event Count')}>
          <span class="metric-card__icon">${icons.target(20)}</span>
          <span class="metric-card__value">${this._animatedValues.events}</span>
          <span class="metric-card__label">${msg('Events')}</span>
        </div>
        <div class="metric-card" role="group" aria-label=${msg('Echo Reach')}>
          <span class="metric-card__icon">${icons.antenna(20)}</span>
          <span class="metric-card__value">${this._animatedValues.echoes}</span>
          <span class="metric-card__label">${msg('Echo Reach')}</span>
        </div>
        <div class="metric-card" role="group" aria-label=${msg('Average Impact')}>
          <span class="metric-card__icon">${icons.sparkle(20)}</span>
          <span class="metric-card__value">
            ${this._data?.avg_impact != null ? this._animatedValues.impact : '—'}
          </span>
          <span class="metric-card__label">${msg('Avg Impact')}</span>
        </div>
      </div>
    `;
  }

  private _renderBreakdown() {
    if (!this._data) return nothing;
    const entries = Object.entries(this._data.events_by_type);
    if (!entries.length) {
      return html`<div class="empty-section">${msg('No event type data')}</div>`;
    }

    const maxCount = Math.max(...entries.map(([, v]) => v));

    return html`
      <div class="breakdown">
        <h3 class="breakdown__title">${msg('Event Type Breakdown')}</h3>
        <div class="breakdown__bars" role="list" aria-label=${msg('Event types')}>
          ${entries.map(
            ([type, count], i) => html`
              <div
                class="bar-row"
                role="listitem"
                style="animation-delay: ${240 + i * 60}ms"
              >
                <span class="bar-row__label">${type.replace(/_/g, ' ')}</span>
                <div class="bar-row__track">
                  <div
                    class="bar-row__fill"
                    style="width: ${(count / maxCount) * 100}%; background: ${BAR_COLORS[i % BAR_COLORS.length]}"
                  ></div>
                </div>
                <span class="bar-row__count">${count}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderSparkline() {
    if (!this._data) return nothing;
    const timeline = this._data.metrics_timeline;
    if (!timeline.length) {
      return html`
        <div class="timeline">
          <h3 class="timeline__title">${msg('Metrics Timeline')}</h3>
          <div class="timeline__empty">${msg('No timeline data yet')}</div>
        </div>
      `;
    }

    // Group by metric_name
    const groups = new Map<string, Array<{ value: number; at: string }>>();
    for (const point of timeline) {
      const name = point.name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)?.push({ value: point.value, at: point.at });
    }

    // Find global min/max for Y scaling
    const allValues = timeline.map((p) => p.value);
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const range = maxV - minV || 1;

    const W = 300;
    const H = 80;
    const pad = 4;

    const lines: Array<{ name: string; color: string; points: string }> = [];
    let idx = 0;
    for (const [name, pts] of groups) {
      const sorted = [...pts].sort((a, b) => a.at.localeCompare(b.at));
      const polyPoints = sorted
        .map((p, i) => {
          const x = pad + (i / Math.max(sorted.length - 1, 1)) * (W - pad * 2);
          const y = pad + (1 - (p.value - minV) / range) * (H - pad * 2);
          return `${x},${y}`;
        })
        .join(' ');
      lines.push({ name, color: BAR_COLORS[idx % BAR_COLORS.length], points: polyPoints });
      idx++;
    }

    return html`
      <div class="timeline">
        <h3 class="timeline__title">${msg('Metrics Timeline')}</h3>
        <div class="timeline__chart">
          <svg
            class="timeline__svg"
            viewBox="0 0 ${W} ${H}"
            preserveAspectRatio="none"
            role="img"
            aria-label=${msg('Metrics over time')}
          >
            ${lines.map(
              (l) => svg`
                <polyline
                  points=${l.points}
                  fill="none"
                  stroke=${l.color}
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                />
              `,
            )}
          </svg>
          <div class="timeline__legend">
            ${lines.map(
              (l) => html`
                <span class="legend-item">
                  <span class="legend-swatch" style="background: ${l.color}"></span>
                  ${l.name}
                </span>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading analytics...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state message=${this._error} @retry=${this._load}></velg-error-state>`;
    }
    if (!this._data) return nothing;

    return html`
      <div class="analytics">
        <div class="analytics__header">
          <span class="analytics__header-icon">${icons.target(22)}</span>
          <h2 class="analytics__title">${msg('Campaign Analytics')}</h2>
        </div>
        ${this._renderMetricCards()}
        ${this._renderBreakdown()}
        ${this._renderSparkline()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-campaign-analytics-panel': VelgCampaignAnalyticsPanel;
  }
}
