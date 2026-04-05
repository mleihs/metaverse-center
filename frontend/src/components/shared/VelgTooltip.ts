/**
 * VelgTooltip — Shared tooltip wrapper for the brutalist design system.
 *
 * Wraps any trigger element via <slot> and renders a positioned tooltip
 * on hover / focus-within. Pure CSS show/hide — zero JavaScript event
 * handlers for the visibility toggle.
 *
 * Usage:
 *   <velg-tooltip content="Agent X, Agent Y">
 *     <div class="badge">+2</div>
 *   </velg-tooltip>
 *
 *   <velg-tooltip content="Explanation text" position="below">
 *     <button>Hover me</button>
 *   </velg-tooltip>
 *
 * Accessibility:
 *   - role="tooltip" on the tip element
 *   - :host(:focus-within) reveals tooltip for keyboard users
 *   - prefers-reduced-motion: instant transition
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-tooltip')
export class VelgTooltip extends LitElement {
  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }

    .tip {
      position: absolute;
      left: 50%;
      translate: -50% 0;
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: var(--leading-snug);
      white-space: nowrap;
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-sm);
      z-index: var(--z-tooltip, 50);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--transition-fast),
        visibility var(--transition-fast);
    }

    /* ── Position variants ── */

    :host([position='above']) .tip,
    .tip {
      bottom: calc(100% + 6px);
    }

    :host([position='below']) .tip {
      top: calc(100% + 6px);
      bottom: auto;
    }

    /* ── Reveal on hover / keyboard focus ── */

    :host(:hover) .tip,
    :host(:focus-within) .tip {
      opacity: 1;
      visibility: visible;
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .tip {
        transition-duration: 0.01ms;
      }
    }
  `;

  /** Tooltip text content. Empty string hides the tooltip entirely. */
  @property() content = '';

  /** Position relative to the trigger element. */
  @property({ reflect: true }) position: 'above' | 'below' = 'above';

  protected render() {
    return html`
      <slot></slot>
      ${this.content
        ? html`<span class="tip" role="tooltip">${this.content}</span>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-tooltip': VelgTooltip;
  }
}
