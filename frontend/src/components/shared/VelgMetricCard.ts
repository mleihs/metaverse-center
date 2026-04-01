/**
 * VelgMetricCard -- Classified intelligence metric display.
 *
 * Replaces duplicated `.stat-card` / `.intel-card` patterns across admin
 * tabs (ForgeTab, InstagramTab, AIUsageTab). Corner bracket decoration
 * evokes classified document stamping.
 *
 * @example
 * <velg-metric-card
 *   label="Total Calls"
 *   value="1,247"
 *   sublabel="last 30 days"
 * ></velg-metric-card>
 *
 * <velg-metric-card
 *   label="Health"
 *   value="21%"
 *   variant="danger"
 * ></velg-metric-card>
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-metric-card')
export class VelgMetricCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      padding: var(--space-3, 12px) var(--space-4, 16px);
      background: var(--color-surface-elevated, #1e1e1e);
      border: 1px solid var(--color-border, #333);
      overflow: hidden;
      animation: metric-enter 0.3s ease-out both;
    }

    @keyframes metric-enter {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      :host { animation: none !important; }
    }

    /* ── Corner brackets (classified document stamp) ── */

    .corner {
      position: absolute;
      width: 6px;
      height: 6px;
      border-style: solid;
      opacity: 0.3;
      z-index: 1;
      border-color: var(--_accent, var(--color-text-muted, #888));
    }

    .corner--tl { top: 3px; left: 3px; border-width: 1px 0 0 1px; }
    .corner--tr { top: 3px; right: 3px; border-width: 1px 1px 0 0; }
    .corner--bl { bottom: 3px; left: 3px; border-width: 0 0 1px 1px; }
    .corner--br { bottom: 3px; right: 3px; border-width: 0 1px 1px 0; }

    /* ── Top accent bar ── */

    :host::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--_accent, transparent);
      opacity: 0.6;
    }

    /* ── Variant colors ── */

    :host([variant='danger']) { --_accent: var(--color-danger, #ef4444); }
    :host([variant='success']) { --_accent: var(--color-success, #22c55e); }
    :host([variant='warning']) { --_accent: var(--color-accent, #d4a24e); }

    /* ── Label ── */

    .label {
      font-family: var(--font-brutalist, var(--font-mono, monospace));
      font-size: 8px;
      font-weight: var(--font-bold, 700);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted, #777);
      margin-bottom: 2px;
    }

    /* ── Value ── */

    .value {
      font-family: var(--font-brutalist, var(--font-mono, monospace));
      font-size: var(--text-xl, 20px);
      font-weight: var(--font-black, 900);
      color: var(--color-text-primary, #eee);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    :host([variant='danger']) .value { color: var(--color-danger, #ef4444); }
    :host([variant='success']) .value { color: var(--color-success, #22c55e); }
    :host([variant='warning']) .value { color: var(--color-accent, #d4a24e); }

    /* ── Sublabel ── */

    .sublabel {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted, #777);
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  `;

  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) sublabel = '';
  @property({ type: String, reflect: true }) variant: 'default' | 'danger' | 'success' | 'warning' =
    'default';

  protected render() {
    return html`
      <span class="corner corner--tl"></span>
      <span class="corner corner--br"></span>
      <div class="label">${this.label}</div>
      <div class="value">${this.value}</div>
      ${this.sublabel ? html`<div class="sublabel">${this.sublabel}</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-metric-card': VelgMetricCard;
  }
}
