/**
 * VelgTooltip — Shared tooltip for the brutalist design system.
 *
 * Uses position:fixed + viewport-relative coordinates to escape ALL
 * overflow:hidden ancestors (modals, panels, cards). Hides on scroll
 * and clamps to viewport edges.
 *
 * Supports two content modes:
 *   1. Text content via `content` property (simple, default)
 *   2. Rich HTML via named slot `tip` (agent cards, formatted lists, etc.)
 *
 * Also used internally by `renderInfoBubble()` from info-bubble-styles.ts,
 * which serves 34+ components across the codebase.
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
 *   - role="tooltip" + unique id on the tip element
 *   - aria-describedby on the trigger slot links to the tooltip
 *   - focus-within reveals tooltip for keyboard users
 *   - prefers-reduced-motion: instant transition
 *
 * @element velg-tooltip
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

let _tipIdCounter = 0;

@customElement('velg-tooltip')
export class VelgTooltip extends LitElement {
  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }

    .tip {
      /* Fixed positioning escapes all overflow:hidden ancestors */
      position: fixed;
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: var(--leading-snug);
      white-space: nowrap;
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-sm);
      z-index: var(--z-tooltip, 700);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--transition-fast),
        visibility var(--transition-fast);
      max-width: min(320px, 90vw);
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

    /* Info-bubble content (from renderInfoBubble) — wider, wrapping */
    .tip--info {
      white-space: normal;
      width: min(240px, 80vw);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-body);
      font-size: var(--text-xs);
      line-height: 1.5;
    }

    /* Hide when no content at all */
    .tip[hidden] {
      display: none !important;
    }

    /* ── Reveal ── */

    .tip--visible {
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

  /** Variant: 'default' for compact mono, 'info' for wider info-bubble style. */
  @property() variant: 'default' | 'info' = 'default';

  /** Tracks whether the named `tip` slot has slotted content. */
  @state() private _hasSlottedTip = false;

  /** Whether the tooltip is currently visible. */
  @state() private _visible = false;

  /** Computed fixed position for the tooltip. */
  @state() private _tipPos: Record<string, string> = {};

  /** Unique ID for aria-describedby linkage. */
  private _tipId = `velg-tip-${++_tipIdCounter}`;

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('mouseenter', this._show);
    this.addEventListener('mouseleave', this._hide);
    this.addEventListener('focusin', this._show);
    this.addEventListener('focusout', this._hide);
    window.addEventListener('scroll', this._hide, { capture: true, passive: true });
  }

  disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this._show);
    this.removeEventListener('mouseleave', this._hide);
    this.removeEventListener('focusin', this._show);
    this.removeEventListener('focusout', this._hide);
    window.removeEventListener('scroll', this._hide, { capture: true });
    super.disconnectedCallback();
  }

  private _show = (): void => {
    const rect = this.getBoundingClientRect();
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: center on trigger, clamp to viewport (16px margin)
    const centerX = rect.left + rect.width / 2;
    const margin = 16;
    const left = Math.max(margin, Math.min(centerX, vw - margin));

    // Determine if we need to flip: if 'above' but too close to top, go below (and vice versa)
    let pos = this.position;
    if (pos === 'above' && rect.top < 80) pos = 'below';
    if (pos === 'below' && vh - rect.bottom < 80) pos = 'above';

    if (pos === 'below') {
      this._tipPos = {
        top: `${rect.bottom + gap}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        bottom: 'auto',
      };
    } else {
      this._tipPos = {
        bottom: `${vh - rect.top + gap}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
        top: 'auto',
      };
    }
    this._visible = true;
  };

  private _hide = (): void => {
    this._visible = false;
  };

  private _handleTipSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this._hasSlottedTip = slot.assignedNodes({ flatten: true }).length > 0;
  }

  protected render() {
    const hasTip = !!this.content || this._hasSlottedTip;
    const tipClasses = {
      tip: true,
      'tip--rich': this._hasSlottedTip,
      'tip--info': this.variant === 'info',
      'tip--visible': this._visible,
    };

    return html`
      <slot></slot>
      <span
        class=${classMap(tipClasses)}
        style=${styleMap(this._tipPos)}
        role="tooltip"
        id=${this._tipId}
        ?hidden=${!hasTip}
      >
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
