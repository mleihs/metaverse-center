/**
 * VelgDispatchStamp -- Configurable classified document stamp.
 *
 * Variants:
 *   inline    — Small inline label (default). "DECODED // 2026-04-09"
 *   badge     — Bordered badge, top-right positioning. "CLASSIFIED"
 *   watermark — Diagonal rotated watermark overlay. "CLASSIFIED"
 *
 * Used by: ChronicleFeed (inline "DECODED"), DailyBriefingModal
 * (badge "CLASSIFIED" + watermark), BleedGazetteSidebar (inline "FILED").
 *
 * @element velg-dispatch-stamp
 * @attr {string} text - Stamp text content
 * @attr {'inline'|'badge'|'watermark'} variant - Visual variant
 * @attr {'default'|'success'|'danger'|'warning'|'muted'} tone - Color tone
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-dispatch-stamp')
export class VelgDispatchStamp extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
    }

    :host([variant='watermark']) {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    /* ── Inline Stamp ───────────────────────── */

    .stamp--inline {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .stamp--inline.tone--default { color: var(--color-text-muted); }
    .stamp--inline.tone--success { color: var(--color-success-glow); }
    .stamp--inline.tone--danger  { color: var(--color-danger); }
    .stamp--inline.tone--warning { color: var(--color-warning); }
    .stamp--inline.tone--muted   { color: var(--color-separator); }

    /* ── Badge Stamp ────────────────────────── */

    .stamp--badge {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 2px 6px;
      border: 1px solid;
    }

    .stamp--badge.tone--default {
      color: var(--color-text-muted);
      border-color: var(--color-border);
    }
    .stamp--badge.tone--success {
      color: var(--color-success);
      border-color: var(--color-success-border);
    }
    .stamp--badge.tone--danger {
      color: var(--color-danger);
      border-color: var(--color-danger-border);
    }
    .stamp--badge.tone--warning {
      color: var(--color-warning);
      border-color: var(--color-warning-border);
    }
    .stamp--badge.tone--muted {
      color: var(--color-separator);
      border-color: var(--color-border-light);
    }

    /* ── Watermark ──────────────────────────── */

    .stamp--watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 42px;
      font-weight: 900;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--color-text-primary);
      opacity: 0.04;
      white-space: nowrap;
      user-select: none;
    }
  `;

  @property({ type: String }) text = '';
  @property({ type: String, reflect: true }) variant: 'inline' | 'badge' | 'watermark' = 'inline';
  @property({ type: String }) tone: 'default' | 'success' | 'danger' | 'warning' | 'muted' =
    'default';

  protected render() {
    const cls = `stamp--${this.variant} tone--${this.tone}`;
    return html`<span class=${cls} aria-hidden=${this.variant === 'watermark' ? 'true' : 'false'}>${this.text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dispatch-stamp': VelgDispatchStamp;
  }
}
