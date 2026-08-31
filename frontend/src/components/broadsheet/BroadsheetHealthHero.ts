/**
 * VelgBroadsheetHealthHero — the state of the colony, across the measure.
 *
 * Renders a frozen health/mood snapshot from the broadsheet edition:
 * health bar, mood summary stats, and aggregate statistics.
 * Styled like a war room status panel with corner brackets and
 * colour-coded status indicators.
 *
 * It was a 280px rail until the paper rule removed the rail (a newspaper has
 * no sidebar). It now runs the full type measure, so the column stack that
 * suited a narrow rail became a row: heading and health bar on the left, the
 * counts beside them instead of below.
 *
 * NOTE ON SCOPE: the handoff sketches this as "3 bars + a verdict quote" and
 * flags the difference for consultation itself ("bei Abweichung vom
 * gewünschten Umfang Rücksprache"). This keeps all seven readings rather than
 * silently dropping four of them to match a sketch - dropping data is a
 * decision for whoever owns the edition, not a side effect of a layout pass.
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
        display: grid;
        /* The readings sit BESIDE the bar, not under it: across the full
           measure a single column left two thirds of the row empty and
           pushed the fold down for nothing. */
        grid-template-columns: minmax(260px, 1fr) 2fr;
        align-items: start;
        gap: var(--space-3) var(--space-8);
        padding-block: var(--space-4);
        border-block: 1px solid var(--color-border-light);
      }

      .sitrep__heading,
      .sitrep__snapshot-label {
        grid-column: 1;
      }

      .sitrep .health {
        grid-column: 1;
      }

      .sitrep .stats {
        grid-column: 2;
      }

      @media (max-width: 768px) {
        .sitrep {
          grid-template-columns: 1fr;
        }
        .sitrep__heading,
        .sitrep__snapshot-label,
        .sitrep .health,
        .sitrep .stats {
          grid-column: 1;
        }
      }

      .sitrep__heading {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--color-text-quiet);
        padding-bottom: var(--space-1);
        border-bottom: 1px dashed var(--color-border-light);
        margin: 0;
      }

      .sitrep__snapshot-label {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--color-text-quiet);
        letter-spacing: 0.06em;
        font-style: italic;
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
  /**
   * The edition's editorial voice. `alarmed` turns the colony bar red.
   *
   * This property was DECLARED and PASSED and never read — it appeared exactly
   * once in this file, on this line. The parent hands it over
   * (`SimulationBroadsheet` line 660), so from the outside the wiring looked
   * complete: no compiler error, no runtime error, no missing binding. The
   * handoff's "Unruhe-Balken rot bei voice=alarmed" simply did not exist.
   *
   * `reflect: true` is what makes it visible to CSS. Without it the attribute
   * never reaches the DOM and a `:host([voice='alarmed'])` rule can never
   * match — which is the second half of the same trap: the rule would have
   * looked right and matched nothing.
   */
  @property({ type: String, reflect: true }) voice = 'neutral';

  protected render() {
    if (!this.health && !this.mood && !this.statistics) return nothing;

    return html`
      <div class="sitrep">
        <h3 class="sitrep__heading">${msg('Situation Report')}</h3>
        <span class="sitrep__snapshot-label">${msg('Current snapshot')}</span>
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
    // An alarmed edition reads its own health in red, whatever the number
    // says: a broadsheet that leads with "Situation Critical" and shows a calm
    // green bar is arguing with itself on the same page.
    //
    // Decided HERE and not in CSS, because `--_bar-color` is set inline on the
    // very element a `:host([voice='alarmed'])` rule would target — and an
    // inline custom property beats any rule in the stylesheet. The CSS version
    // of this was written first and would have matched nothing while looking
    // entirely correct.
    const barColor = this.voice === 'alarmed' ? 'var(--color-danger)' : this._getHealthColor(pct);

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
        <div class="dispatch-stat" style="--i: 6">
          <div class="dispatch-stat__value dispatch-stat__value--accent">
            ${stats.resonance_count ?? 0}
          </div>
          <div class="dispatch-stat__label">${msg('Resonances')}</div>
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
