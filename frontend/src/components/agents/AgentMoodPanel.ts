/**
 * AgentMoodPanel — Classified Psychological Profile Display.
 *
 * Bureau-aesthetic panel showing an agent's autonomous emotional state:
 * mood gauge (circular arc), stress bar, needs radar (SVG pentagon),
 * and active moodlets list. Designed as a classified intelligence
 * dossier from the Bureau of Impossible Geography.
 *
 * Features:
 * - SVG arc gauge with stroke-dashoffset draw animation
 * - Animated stress bar with critical-zone glow pulse
 * - 5-axis SVG radar chart with path morphing
 * - Staggered moodlet cascade entrance
 * - Auto-refresh via IntersectionObserver (30s interval)
 * - Full WCAG AA: role=meter, aria-valuenow, focus-visible, reduced-motion
 * - Responsive: mobile 320px → 4K 3840px
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  type AgentMood,
  type AgentMoodlet,
  type AgentNeeds,
  agentAutonomyApi,
} from '../../services/api/AgentAutonomyApiService.js';
import { captureError } from '../../services/SentryService.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { panelCascadeStyles } from '../shared/panel-cascade-styles.js';

// ── Constants ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

const GAUGE_RADIUS = 62;
const GAUGE_STROKE = 6;
const GAUGE_SIZE = 160;
const GAUGE_CENTER = GAUGE_SIZE / 2;
// Arc spans 240 degrees (from 150° to 390°)
const ARC_DEGREES = 240;
const ARC_CIRCUMFERENCE = (ARC_DEGREES / 360) * 2 * Math.PI * GAUGE_RADIUS;
const ARC_START_ANGLE = 150; // degrees

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 60;

const NEED_KEYS = ['social', 'purpose', 'safety', 'comfort', 'stimulation'] as const;
type NeedKey = (typeof NEED_KEYS)[number];

const NEED_LABELS: Record<NeedKey, () => string> = {
  social: () => msg('Social'),
  purpose: () => msg('Purpose'),
  safety: () => msg('Safety'),
  comfort: () => msg('Comfort'),
  stimulation: () => msg('Stimulation'),
};

const EMOTION_COLORS: Record<string, string> = {
  joy: 'var(--color-success)',
  satisfaction: 'var(--color-success)',
  pride: 'var(--color-info)',
  anxiety: 'var(--color-warning)',
  anger: 'var(--color-danger)',
  distress: 'var(--color-danger)',
  grief: 'var(--color-text-muted)',
  guilt: 'var(--color-warning)',
  neutral: 'var(--color-text-secondary)',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function moodToLabel(score: number): string {
  if (score > 50) return msg('Euphoric');
  if (score > 20) return msg('Content');
  if (score > -20) return msg('Neutral');
  if (score > -50) return msg('Troubled');
  return msg('Distressed');
}

function stressToLabel(level: number): string {
  if (level >= 800) return msg('Critical');
  if (level >= 500) return msg('High');
  if (level >= 200) return msg('Moderate');
  return msg('Calm');
}

function stressColor(level: number): string {
  if (level >= 800) return 'var(--color-danger)';
  if (level >= 500) return 'var(--color-danger-hover)';
  if (level >= 200) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function moodGaugeColor(score: number): string {
  if (score > 30) return 'var(--color-success)';
  if (score > -30) return 'var(--color-info)';
  return 'var(--color-danger)';
}

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-agent-mood-panel')
export class AgentMoodPanel extends LitElement {
  static styles = [
    panelCascadeStyles,
    infoBubbleStyles,
    css`
      /* ── Host ─────────────────────────────────────────── */

      :host {
        display: block;
        --_gauge-color: var(--color-info);
        --_stress-color: var(--color-success);
        /* Tier 3 micro-typography for instrument panel aesthetic */
        --_text-micro: 8px;
      }

      /* ── Panel Container ──────────────────────────────── */

      .mood-panel {
        position: relative;
        background: var(--color-surface-raised);
        border: var(--border-default);
        box-shadow: var(--shadow-md);
        padding: var(--space-5);
      }

      /* Corner brackets (Bureau aesthetic) */
      .mood-panel::before,
      .mood-panel::after {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        border-color: var(--color-primary);
        border-style: solid;
        opacity: 0.4;
        pointer-events: none;
        z-index: 2;
      }

      .mood-panel::before {
        top: -1px;
        left: -1px;
        border-width: 2px 0 0 2px;
      }

      .mood-panel::after {
        bottom: -1px;
        right: -1px;
        border-width: 0 2px 2px 0;
      }

      /* Scanline overlay */
      .mood-panel__scanlines {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255, 255, 255, 0.015) 2px,
          rgba(255, 255, 255, 0.015) 4px
        );
        pointer-events: none;
        z-index: 1;
      }

      /* Classification stamp */
      .mood-panel__stamp {
        display: block;
        text-align: right;
        margin-bottom: var(--space-2);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-primary);
        opacity: 0.6;
      }

      /* ── Layout Grid ──────────────────────────────────── */

      .mood-panel__grid {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: var(--space-4);
        align-items: start;
      }

      /* ── Mood Gauge (SVG Arc) ─────────────────────────── */

      .gauge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
      }

      .gauge__title {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
        text-align: center;
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
        padding-bottom: var(--space-1);
        width: 100%;
      }

      .gauge__svg {
        width: ${GAUGE_SIZE}px;
        height: ${GAUGE_SIZE}px;
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--_gauge-color) 25%, transparent));
      }

      .gauge__track {
        fill: none;
        stroke: var(--color-border);
        stroke-width: ${GAUGE_STROKE};
        stroke-linecap: round;
      }

      .gauge__fill {
        fill: none;
        stroke: var(--_gauge-color);
        stroke-width: ${GAUGE_STROKE};
        stroke-linecap: round;
        stroke-dasharray: ${ARC_CIRCUMFERENCE};
        stroke-dashoffset: ${ARC_CIRCUMFERENCE};
        transition: stroke-dashoffset 600ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)),
          stroke 300ms var(--ease-default);
      }

      .gauge__fill--animated {
        stroke-dashoffset: var(--_gauge-offset);
      }

      .gauge__value {
        font-family: var(--font-brutalist);
        font-size: var(--text-2xl);
        font-weight: var(--font-black);
        fill: var(--color-text-primary);
        text-anchor: middle;
        dominant-baseline: central;
      }

      .gauge__label-text {
        font-family: var(--font-brutalist);
        font-size: var(--_text-micro);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        fill: var(--color-text-secondary);
        text-anchor: middle;
      }

      .gauge__emotion {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--_gauge-color);
        text-align: center;
      }

      .gauge__mood-label {
        font-family: var(--font-brutalist);
        font-size: var(--_text-micro);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-muted);
        text-align: center;
      }

      /* ── Stress Bar ───────────────────────────────────── */

      .stress {
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--color-border-light);
        position: relative;
        z-index: 2;
      }

      .stress__header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
      }

      .stress__title {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-secondary);
      }

      .stress__value {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--_stress-color);
      }

      .stress__track {
        height: 6px;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
        overflow: hidden;
        position: relative;
      }

      .stress__fill {
        height: 100%;
        background: var(--_stress-color);
        width: 0%;
        transition: width 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) 200ms;
      }

      .stress__fill--animated {
        width: var(--_stress-pct);
      }

      .stress__label {
        font-family: var(--font-brutalist);
        font-size: var(--_text-micro);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-muted);
        margin-top: var(--space-1);
        text-align: right;
      }

      /* Critical stress pulse */
      .stress--critical .stress__track {
        animation: stress-pulse 2s ease-in-out infinite;
      }

      @keyframes stress-pulse {
        0%, 100% { box-shadow: 0 0 4px color-mix(in srgb, var(--color-danger) 30%, transparent); }
        50% { box-shadow: 0 0 12px color-mix(in srgb, var(--color-danger) 50%, transparent); }
      }

      /* ── Needs Radar (SVG) ────────────────────────────── */

      .needs {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
      }

      .needs__title {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
        text-align: center;
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
        padding-bottom: var(--space-1);
        width: 100%;
      }

      .needs__svg {
        width: 100%;
        max-width: ${RADAR_SIZE}px;
        height: auto;
        aspect-ratio: 1;
        overflow: visible;
      }

      .needs__grid-line {
        fill: none;
        stroke: var(--color-border);
        stroke-width: 1;
      }

      .needs__axis {
        stroke: var(--color-border);
        stroke-width: 1;
      }

      .needs__area {
        fill: color-mix(in srgb, var(--color-primary) 20%, transparent);
        stroke: var(--color-primary);
        stroke-width: 2.5;
        transition: d 500ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      }

      .needs__dot {
        fill: var(--color-primary);
        r: 4;
        transition: cx 500ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
          cy 500ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      }

      .needs__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        fill: var(--color-text-primary);
        text-anchor: middle;
        dominant-baseline: central;
      }

      .needs__value-label {
        font-family: var(--font-mono);
        font-size: var(--_text-micro);
        font-weight: var(--font-bold);
        fill: var(--color-text-muted);
      }

      /* HTML overlay labels (more reliable than SVG text in Shadow DOM) */
      .needs__wrapper {
        position: relative;
        width: 100%;
        max-width: ${RADAR_SIZE}px;
      }

      .needs__html-labels {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .needs__html-label {
        position: absolute;
        transform: translate(-50%, -50%);
        text-align: center;
        pointer-events: none;
      }

      .needs__html-label-name {
        font-family: var(--font-brutalist);
        font-size: var(--_text-micro);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-secondary);
        line-height: 1;
        white-space: nowrap;
      }

      .needs__html-label-value {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        color: var(--color-primary);
        line-height: 1.4;
      }
        text-anchor: middle;
        dominant-baseline: central;
      }

      /* ── Moodlets List ────────────────────────────────── */

      .moodlets {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .moodlets__title {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
        padding-bottom: var(--space-1);
      }

      .moodlets__list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
        max-height: 240px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }

      .moodlet {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
        opacity: 0;
        animation: moodlet-in 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
        animation-delay: var(--_delay);
      }

      @keyframes moodlet-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      .moodlet__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        background: var(--_moodlet-color);
      }

      .moodlet__info {
        flex: 1;
        min-width: 0;
      }

      .moodlet__type {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .moodlet__source {
        font-size: var(--_text-micro);
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .moodlet__strength {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        flex-shrink: 0;
        padding: var(--space-0-5) var(--space-1-5);
        border: var(--border-width-thin) solid;
      }

      .moodlet__strength--positive {
        color: var(--color-success);
        border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
      }

      .moodlet__strength--negative {
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
      }

      .moodlet__decay {
        flex-shrink: 0;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        opacity: 0.6;
      }

      .moodlet__decay--permanent { background: var(--color-text-secondary); }
      .moodlet__decay--timed { background: var(--color-warning); }
      .moodlet__decay--decaying {
        background: var(--color-info);
        animation: decay-fade 3s ease-in-out infinite;
      }

      @keyframes decay-fade {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 0.15; }
      }

      .moodlets__empty {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        font-style: italic;
        padding: var(--space-3);
        text-align: center;
      }

      /* ── Loading ──────────────────────────────────────── */

      .mood-panel--loading {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .loading-text {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-muted);
        animation: loading-pulse 1.5s ease-in-out infinite;
      }

      @keyframes loading-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }

      /* ── Reduced Motion ───────────────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .gauge__fill {
          transition: none;
        }

        .stress__fill {
          transition: none;
        }

        .needs__area,
        .needs__dot {
          transition: none;
        }

        .moodlet {
          opacity: 1;
          animation: none;
        }

        .stress--critical .stress__track {
          animation: none;
        }

        .moodlet__decay--decaying {
          animation: none;
        }

        .loading-text {
          animation: none;
          opacity: 1;
        }
      }

      /* ── Responsive ───────────────────────────────────── */

      /* 4K: generous spacing, larger gauge */
      @media (min-width: 2560px) {
        .mood-panel {
          padding: var(--space-8);
        }

        .mood-panel__grid {
          gap: var(--space-8);
        }

        .gauge__svg {
          width: 200px;
          height: 200px;
        }
      }

      /* Standard desktop: 3-column */
      /* (default grid above) */

      /* Narrow desktop / tablet landscape */
      @media (max-width: 1024px) {
        .mood-panel__grid {
          grid-template-columns: auto 1fr;
          grid-template-rows: auto auto;
        }

        .moodlets {
          grid-column: 1 / -1;
        }
      }

      /* Tablet portrait */
      @media (max-width: 768px) {
        .mood-panel__grid {
          grid-template-columns: 1fr 1fr;
        }

        .gauge {
          justify-self: center;
        }

        .needs {
          justify-self: center;
        }

        .moodlets {
          grid-column: 1 / -1;
        }
      }

      /* Mobile */
      @media (max-width: 480px) {
        .mood-panel {
          padding: var(--space-3);
        }

        .mood-panel__grid {
          grid-template-columns: 1fr;
          gap: var(--space-4);
        }

        .gauge__svg {
          width: 140px;
          height: 140px;
        }

        .moodlets__list {
          max-height: 180px;
        }

        .mood-panel__stamp {
          font-size: var(--_text-micro);
          top: var(--space-2);
          right: var(--space-2);
        }
      }
    `,
  ];

  // ── Properties ──────────────────────────────────────────────

  @property({ type: String }) agentId = '';
  @property({ type: String }) simulationId = '';

  @state() private _mood: AgentMood | null = null;
  @state() private _moodlets: AgentMoodlet[] = [];
  @state() private _needs: AgentNeeds | null = null;
  @state() private _loading = true;
  @state() private _animated = false;

  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _observer: IntersectionObserver | null = null;
  private _visible = false;

  // ── Lifecycle ───────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._setupObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearRefresh();
    this._observer?.disconnect();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('agentId') || changed.has('simulationId')) {
      if (this.agentId && this.simulationId) {
        this._fetchData();
      }
    }
  }

  private _setupObserver() {
    this._observer = new IntersectionObserver(
      ([entry]) => {
        this._visible = entry.isIntersecting;
        if (this._visible) {
          this._startRefresh();
        } else {
          this._clearRefresh();
        }
      },
      { threshold: 0.1 },
    );
    this._observer.observe(this);
  }

  private _startRefresh() {
    if (this._refreshTimer) return;
    this._refreshTimer = setInterval(() => {
      if (this._visible) this._fetchData();
    }, REFRESH_INTERVAL_MS);
  }

  private _clearRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  // ── Data Fetching ───────────────────────────────────────────

  private async _fetchData() {
    try {
      const [moodResp, moodletsResp, needsResp] = await Promise.all([
        agentAutonomyApi.getAgentMood(this.simulationId, this.agentId),
        agentAutonomyApi.getAgentMoodlets(this.simulationId, this.agentId),
        agentAutonomyApi.getAgentNeeds(this.simulationId, this.agentId),
      ]);

      this._mood = moodResp.data ?? null;
      this._moodlets = moodletsResp.data ?? [];
      this._needs = needsResp.data ?? null;
      this._loading = false;

      // Trigger animations after data arrives
      requestAnimationFrame(() => {
        this._animated = true;
      });
    } catch (err) {
      captureError(err, { source: 'AgentMoodPanel._fetchData' });
      this._loading = false;
    }
  }

  // ── Render ──────────────────────────────────────────────────

  render() {
    if (this._loading) {
      return html`
        <div class="mood-panel mood-panel--loading">
          <div class="mood-panel__scanlines"></div>
          <span class="loading-text">${msg('Analyzing psyche...')}</span>
        </div>
      `;
    }

    if (!this._mood) return nothing;

    return html`
      <div class="mood-panel">
        <div class="mood-panel__scanlines"></div>
        <span class="mood-panel__stamp">${msg('Psych profile')}</span>

        <div class="mood-panel__grid">
          ${this._renderGaugeSection()}
          ${this._renderNeedsRadar()}
          ${this._renderMoodlets()}
        </div>
        ${this._renderStressBar()}
      </div>
    `;
  }

  // ── Mood Gauge ──────────────────────────────────────────────

  private _renderGaugeSection() {
    const mood = this._mood!;
    const score = mood.mood_score;

    // Compute arc offset: -100 → full left, +100 → full right, 0 → middle
    const normalized = (score + 100) / 200; // 0..1
    const fillLength = normalized * ARC_CIRCUMFERENCE;
    const offset = ARC_CIRCUMFERENCE - fillLength;
    const gaugeColor = moodGaugeColor(score);

    return html`
      <div class="gauge panel__section">
        <span class="gauge__title">${msg('Mood')} ${renderInfoBubble(msg('Overall emotional state from \u2212100 (distressed) to +100 (euphoric). Computed from all active moodlets. Affects operative success in epochs.'))}</span>
        <svg
          class="gauge__svg"
          viewBox="0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}"
          role="meter"
          aria-valuenow=${score}
          aria-valuemin="-100"
          aria-valuemax="100"
          aria-label=${`${msg('Mood score')}: ${score}`}
          style="--_gauge-color: ${gaugeColor}"
        >
          <!-- Track arc -->
          <path
            class="gauge__track"
            d=${describeArc(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, ARC_START_ANGLE, ARC_START_ANGLE + ARC_DEGREES)}
          />
          <!-- Fill arc -->
          <path
            class="gauge__fill ${this._animated ? 'gauge__fill--animated' : ''}"
            d=${describeArc(GAUGE_CENTER, GAUGE_CENTER, GAUGE_RADIUS, ARC_START_ANGLE, ARC_START_ANGLE + ARC_DEGREES)}
            style="--_gauge-offset: ${offset}; --_gauge-color: ${gaugeColor}"
          />
          <!-- Score value -->
          <text class="gauge__value" x=${GAUGE_CENTER} y=${GAUGE_CENTER - 4}>
            ${score > 0 ? '+' : ''}${score}
          </text>
          <!-- Label -->
          <text class="gauge__label-text" x=${GAUGE_CENTER} y=${GAUGE_CENTER + 16}>
            ${moodToLabel(score).toUpperCase()}
          </text>
        </svg>

        <div class="gauge__emotion" style="color: ${gaugeColor}">
          ${mood.dominant_emotion.toUpperCase()}
        </div>
        <div class="gauge__mood-label">${msg('Dominant emotion')}</div>
      </div>
    `;
  }

  // ── Stress Bar (full-width below grid) ──────────────────────

  private _renderStressBar() {
    const mood = this._mood!;
    const stress = mood.stress_level;
    const sColor = stressColor(stress);

    return html`
      <div class="stress ${stress >= 800 ? 'stress--critical' : ''}" style="--_stress-color: ${sColor}">
        <div class="stress__header">
          <span class="stress__title">${msg('Stress level')} ${renderInfoBubble(msg('Stress accumulates when mood is negative and recovers when positive. Above 800: agent breakdown \u2013 a crisis event that spreads anxiety to nearby agents. Affects operative success (\u22123% above 500).'))}</span>
          <span class="stress__value" style="color: ${sColor}">${stress}</span>
        </div>
        <div
          class="stress__track"
          role="meter"
          aria-valuenow=${stress}
          aria-valuemin="0"
          aria-valuemax="1000"
          aria-label=${`${msg('Stress level')}: ${stress}`}
        >
          <div
            class="stress__fill ${this._animated ? 'stress__fill--animated' : ''}"
            style="--_stress-pct: ${(stress / 1000) * 100}%; background: ${sColor}"
          ></div>
        </div>
        <div class="stress__label">${stressToLabel(stress)}</div>
      </div>
    `;
  }

  // ── Needs Radar ─────────────────────────────────────────────

  private _renderNeedsRadar() {
    if (!this._needs) return nothing;

    const needs = this._needs;
    const values: number[] = NEED_KEYS.map((k) => needs[k]);

    // Compute polygon points
    const points = values.map((val, i) => {
      const angle = (i * 360) / 5 - 90; // Start from top
      const r = this._animated ? (val / 100) * RADAR_RADIUS : 0;
      return polarToCartesian(RADAR_CENTER, RADAR_CENTER, r, angle);
    });

    const pathD = `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;

    // Grid rings (25%, 50%, 75%, 100%)
    const gridRings = [0.25, 0.5, 0.75, 1].map((pct) => {
      const ringPoints = NEED_KEYS.map((_, i) => {
        const angle = (i * 360) / 5 - 90;
        return polarToCartesian(RADAR_CENTER, RADAR_CENTER, pct * RADAR_RADIUS, angle);
      });
      return `${ringPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} Z`;
    });

    // Axis lines
    const axes = NEED_KEYS.map((_, i) => {
      const angle = (i * 360) / 5 - 90;
      const end = polarToCartesian(RADAR_CENTER, RADAR_CENTER, RADAR_RADIUS, angle);
      return { x1: RADAR_CENTER, y1: RADAR_CENTER, x2: end.x, y2: end.y };
    });

    // Label positions (slightly outside the radar)
    const labelRadius = RADAR_RADIUS + 32;
    const labels = NEED_KEYS.map((key, i) => {
      const angle = (i * 360) / 5 - 90;
      const pos = polarToCartesian(RADAR_CENTER, RADAR_CENTER, labelRadius, angle);
      return { ...pos, key, value: values[i] };
    });

    const ariaLabel = NEED_KEYS.map((k, i) => `${NEED_LABELS[k]()}: ${Math.round(values[i])}`).join(
      ', ',
    );

    return html`
      <div class="needs panel__section">
        <span class="needs__title">${msg('Agent needs')} ${renderInfoBubble(msg('Five core drives (0\u2013100) that decay over time and are fulfilled by activities. Low needs push agents toward specific behaviors. Social: interaction craving. Purpose: meaningful work. Safety: zone security. Comfort: building quality. Stimulation: novelty.'))}</span>
        <div class="needs__wrapper">
          <svg
            class="needs__svg"
            viewBox="0 0 ${RADAR_SIZE} ${RADAR_SIZE}"
            role="img"
            aria-label=${`${msg('Needs radar')} - ${ariaLabel}`}
          >
            <!-- Grid rings -->
            ${gridRings.map((d) => html`<path class="needs__grid-line" d=${d} />`)}

            <!-- Axes -->
            ${axes.map(
              (a) => html`
              <line class="needs__axis" x1=${a.x1} y1=${a.y1} x2=${a.x2} y2=${a.y2} />
            `,
            )}

            <!-- Data area -->
            <path class="needs__area" d=${pathD} />

            <!-- Data points -->
            ${points.map(
              (p) => html`
              <circle class="needs__dot" cx=${p.x} cy=${p.y} />
            `,
            )}
          </svg>

          <!-- HTML overlay labels (reliable in Shadow DOM) -->
          <div class="needs__html-labels" aria-hidden="true">
            ${labels.map(
              (l) => html`
              <div
                class="needs__html-label"
                style="left: ${(l.x / RADAR_SIZE) * 100}%; top: ${(l.y / RADAR_SIZE) * 100}%"
              >
                <div class="needs__html-label-name">${NEED_LABELS[l.key]()}</div>
                <div class="needs__html-label-value">${Math.round(l.value)}</div>
              </div>
            `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  // ── Moodlets ────────────────────────────────────────────────

  private _renderMoodlets() {
    return html`
      <div class="moodlets panel__section">
        <span class="moodlets__title">${msg('Active influences')} ${renderInfoBubble(msg('Individual mood modifiers from events, social interactions, and zone conditions. Each has a strength (\u00b120) and a decay type: permanent (gray dot), timed (yellow dot, expires at set time), or decaying (blue dot, strength fades gradually).'))}</span>
        ${
          this._moodlets.length === 0
            ? html`<div class="moodlets__empty">${msg('No active influences')}</div>`
            : html`
            <div class="moodlets__list" role="list">
              ${this._moodlets.map((m, i) => this._renderMoodlet(m, i))}
            </div>
          `
        }
      </div>
    `;
  }

  private _renderMoodlet(moodlet: AgentMoodlet, index: number) {
    const color = EMOTION_COLORS[moodlet.emotion] ?? EMOTION_COLORS.neutral;
    const isPositive = moodlet.strength > 0;

    return html`
      <div
        class="moodlet"
        role="listitem"
        style="--_delay: ${index * 60}ms; --_moodlet-color: ${color}"
      >
        <div class="moodlet__dot"></div>
        <div class="moodlet__info">
          <div class="moodlet__type">${moodlet.moodlet_type.replace(/_/g, ' ')}</div>
          ${
            moodlet.source_description
              ? html`<div class="moodlet__source">${moodlet.source_description}</div>`
              : nothing
          }
        </div>
        <span class="moodlet__strength ${isPositive ? 'moodlet__strength--positive' : 'moodlet__strength--negative'}">
          ${isPositive ? '+' : ''}${moodlet.strength}
        </span>
        <div
          class="moodlet__decay moodlet__decay--${moodlet.decay_type}"
          title=${moodlet.decay_type}
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-mood-panel': AgentMoodPanel;
  }
}
