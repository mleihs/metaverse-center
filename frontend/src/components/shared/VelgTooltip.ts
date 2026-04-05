/**
 * VelgTooltip — Shared tooltip wrapper for the brutalist design system.
 *
 * Wraps any trigger element via <slot> and renders a positioned tooltip
 * on hover / focus-within. Pure CSS show/hide — zero JavaScript event
 * handlers for the visibility toggle.
 *
 * Supports two content modes:
 *   1. Text content via `content` property (simple, default)
 *   2. Rich HTML via named slot `tip` (agent cards, formatted lists, etc.)
 *
 * Usage (text):
 *   <velg-tooltip content="Explanation text">
 *     <button>Hover me</button>
 *   </velg-tooltip>
 *
 * Usage (rich):
 *   <velg-tooltip>
 *     <div class="badge">+2</div>
 *     <div slot="tip">
 *       <div class="agent-row">Avatar + Name</div>
 *     </div>
 *   </velg-tooltip>
 *
 * Accessibility:
 *   - role="tooltip" on the tip element
 *   - :host(:focus-within) reveals tooltip for keyboard users
 *   - prefers-reduced-motion: instant transition
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

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

    /* ── Rich content variant ── */

    .tip--rich {
      white-space: normal;
      min-width: 140px;
      max-width: 260px;
      padding: var(--space-2);
      font-family: var(--font-body);
      font-size: var(--text-xs);
    }

    /* Hide when no content at all */
    .tip[hidden] {
      display: none !important;
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

  /** Tooltip text content. Empty string hides the tooltip entirely (unless rich slot is used). */
  @property() content = '';

  /** Position relative to the trigger element. */
  @property({ reflect: true }) position: 'above' | 'below' = 'above';

  /** Tracks whether the named `tip` slot has slotted content. */
  @state() private _hasSlottedTip = false;

  private _handleTipSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this._hasSlottedTip = slot.assignedNodes({ flatten: true }).length > 0;
  }

  protected render() {
    const hasTip = !!this.content || this._hasSlottedTip;
    const tipClasses = {
      tip: true,
      'tip--rich': this._hasSlottedTip,
    };

    return html`
      <slot></slot>
      <span class=${classMap(tipClasses)} role="tooltip" ?hidden=${!hasTip}>
        <slot name="tip" @slotchange=${this._handleTipSlotChange}>
          ${this.content || nothing}
        </slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-tooltip': VelgTooltip;
  }
}
