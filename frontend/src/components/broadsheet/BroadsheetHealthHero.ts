/**
 * VelgBroadsheetHealthHero — Situation Report sidebar widget.
 *
 * Renders a frozen health/mood snapshot from the broadsheet edition:
 * health bar, mood summary stats, and aggregate statistics.
 * Styled like a war room status panel with corner brackets and
 * colour-coded status indicators.
 *
 * @element velg-broadsheet-health-hero
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';

interface HealthSnapshot {
  overall_health?: number;
  health_label?: string;
  avg_zone_stability?: number;
  [key: string]: unknown;
}

interface MoodSnapshot {
  avg_mood?: number;
  avg_stress?: number;
  crisis_count?: number;
  happy_count?: number;
  unhappy_count?: number;
}

interface StatisticsSnapshot {
  event_count?: number;
  activity_count?: number;
  resonance_count?: number;
}

@localized()
@customElement('velg-broadsheet-health-hero')
export class VelgBroadsheetHealthHero extends LitElement {
  static styles = [
    dispatchStyles,
    css`
      :host {
        display: block;
        --_bar-color: var(--color-success);
      }

      .sitrep {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .sitrep__heading {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--color-text-muted);
        padding-bottom: var(--space-1);
        border-bottom: 1px dashed var(--color-border-light);
        margin: 0;
      }

      /* ── Health Bar ────────────────────────── */

      .health {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .health__bar-track {
        height: 6px;
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border-light);
        overflow: hidden;
      }

      .health__bar-fill {
        height: 100%;
        background: var(--_bar-color);
        transition: width var(--transition-slow);
      }

      .health__label-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }

      .health__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--_bar-color);
      }

      .health__pct {
        font-family: var(--font-mono);
        font-size: var(--text-xl);
        font-weight: var(--font-black);
        color: var(--_bar-color);
        line-height: 1;
      }

      /* ── Stats Grid ────────────────────────── */

      .stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
      }

      /* ── Reduced Motion ────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .health__bar-fill {
          transition: none;
        }
      }
    `,
  ];

  @property({ type: Object }) health: HealthSnapshot | null = null;
  @property({ type: Object }) mood: MoodSnapshot | null = null;
  @property({ type: Object }) statistics: StatisticsSnapshot | null = null;
  @property({ type: String }) voice = 'neutral';

  protected render() {
    if (!this.health && !this.mood && !this.statistics) return nothing;

    return html`
      <div class="sitrep">
        <h3 class="sitrep__heading">${msg('Situation Report')}</h3>
        ${this._renderHealthBar()}
        ${this._renderMoodStats()}
        ${this._renderStatistics()}
      </div>
    `;
  }

  private _renderHealthBar() {
    const health = this.health;
    if (!health) return nothing;

    const pct = Math.round((health.overall_health ?? 0.5) * 100);
    const label = this._getHealthLabel(health.health_label);
    const barColor = this._getHealthColor(pct);

    return html`
      <div class="health" style="--_bar-color: ${barColor}">
        <div class="health__label-row">
          <span class="health__label">${label}</span>
          <span class="health__pct">${pct}%</span>
        </div>
        <div class="health__bar-track" role="progressbar"
             aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"
             aria-label=${msg('Simulation health')}>
          <div class="health__bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  private _renderMoodStats() {
    const mood = this.mood;
    if (!mood) return nothing;

    return html`
      <div class="stats">
        <div class="dispatch-stat" style="--i: 0">
          <div class="dispatch-stat__value dispatch-stat__value--positive">
            ${mood.happy_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('Content')}</div>
        </div>
        <div class="dispatch-stat" style="--i: 1">
          <div class="dispatch-stat__value dispatch-stat__value--critical">
            ${mood.unhappy_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('Distressed')}</div>
        </div>
        <div class="dispatch-stat" style="--i: 2">
          <div class="dispatch-stat__value dispatch-stat__value--critical">
            ${mood.crisis_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('In Crisis')}</div>
        </div>
        <div class="dispatch-stat" style="--i: 3">
          <div class="dispatch-stat__value dispatch-stat__value--accent">
            ${Math.round(mood.avg_stress ?? 0)}
          </div>
          <div class="dispatch-stat__label">${msg('Avg. Stress')}</div>
        </div>
      </div>
    `;
  }

  private _renderStatistics() {
    const stats = this.statistics;
    if (!stats) return nothing;

    return html`
      <div class="stats">
        <div class="dispatch-stat" style="--i: 4">
          <div class="dispatch-stat__value dispatch-stat__value--neutral">
            ${stats.event_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('Events')}</div>
        </div>
        <div class="dispatch-stat" style="--i: 5">
          <div class="dispatch-stat__value dispatch-stat__value--neutral">
            ${stats.activity_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('Activities')}</div>
        </div>
      </div>
    `;
  }

  private _getHealthLabel(raw?: string): string {
    switch (raw) {
      case 'critical':
        return msg('Critical');
      case 'unstable':
        return msg('Unstable');
      case 'stable':
        return msg('Stable');
      case 'thriving':
        return msg('Thriving');
      default:
        return msg('Stable');
    }
  }

  private _getHealthColor(pct: number): string {
    if (pct < 25) return 'var(--color-danger)';
    if (pct < 50) return 'var(--color-warning)';
    if (pct > 85) return 'var(--color-success)';
    return 'var(--color-text-secondary)';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-broadsheet-health-hero': VelgBroadsheetHealthHero;
  }
}
