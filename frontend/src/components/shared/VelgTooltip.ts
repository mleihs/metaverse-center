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
      transform-origin: var(--_arrow-side, bottom) center;
      transition:
        opacity 150ms ease,
        visibility 150ms ease,
        transform 150ms var(--ease-out, ease-out);
      transform: translateX(-50%) scale(0.97);
      max-width: min(320px, 90vw);
    }

    /* ── Arrow ── */

    .tip::after {
      content: '';
      position: absolute;
      left: var(--_arrow-x, 50%);
      transform: translateX(-50%);
      border: 5px solid transparent;
    }

    /* Arrow pointing down (tooltip above trigger) */
    .tip--above::after {
      top: 100%;
      border-top-color: var(--color-border);
    }

    /* Arrow pointing up (tooltip below trigger) */
    .tip--below::after {
      bottom: 100%;
      border-bottom-color: var(--color-border);
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

    /* Kennzahl-Erklärung (H7): drei Teile — Was / Warum / Was tun. Braucht mehr
       Breite als die Info-Variante, sonst bricht jede Zeile mehrfach um und
       die drei Teile verlieren ihre Gestalt. */
    .tip--explainer {
      white-space: normal;
      width: min(320px, 92vw);
      /* .tip--rich gilt gleichzeitig (es gibt Schlitzinhalt) und deckelt mit
         max-width: 260px. Ohne diese Zeile ist die Breite oben wirkungslos. */
      max-width: min(320px, 92vw);
      padding: var(--space-3);
      font-family: var(--font-body);
      font-size: var(--text-xs);
      line-height: var(--leading-normal);
      text-align: left;
    }

    /* Hide when no content at all */
    .tip[hidden] {
      display: none !important;
    }

    /* ── Reveal ── */

    .tip--visible {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) scale(1);
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

  /**
   * Variant: 'default' for compact mono, 'info' for wider info-bubble style,
   * 'explainer' for the three-part metric explanation (H7).
   */
  @property() variant: 'default' | 'info' | 'explainer' = 'default';

  /** Tracks whether the named `tip` slot has slotted content. */
  @state() private _hasSlottedTip = false;

  /** Whether the tooltip is currently visible. */
  @state() private _visible = false;

  /** Computed fixed position for the tooltip. */
  @state() private _tipPos: Record<string, string> = {};

  /** Unique ID for aria-describedby linkage. */
  private _tipId = `velg-tip-${++_tipIdCounter}`;

  /** Hover delay timer — prevents flicker when cursor crosses multiple triggers. */
  private _showTimer: ReturnType<typeof setTimeout> | null = null;

  /** Resolved position direction (after flip). */
  @state() private _resolvedPos: 'above' | 'below' = 'above';

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('mouseenter', this._scheduleShow);
    this.addEventListener('mouseleave', this._hide);
    this.addEventListener('focusin', this._showImmediate);
    this.addEventListener('focusout', this._hide);
    this.addEventListener('keydown', this._handleKeydown);
    window.addEventListener('scroll', this._hide, { capture: true, passive: true });
  }

  disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this._scheduleShow);
    this.removeEventListener('mouseleave', this._hide);
    this.removeEventListener('focusin', this._showImmediate);
    this.removeEventListener('focusout', this._hide);
    this.removeEventListener('keydown', this._handleKeydown);
    window.removeEventListener('scroll', this._hide, { capture: true });
    if (this._showTimer) clearTimeout(this._showTimer);
    super.disconnectedCallback();
  }

  /** Hover: 150ms delay to prevent flicker across adjacent triggers. */
  private _scheduleShow = (): void => {
    if (this._showTimer) clearTimeout(this._showTimer);
    this._showTimer = setTimeout(() => this._computeAndShow(), 150);
  };

  /** Focus: immediate show (keyboard users shouldn't wait). */
  private _showImmediate = (): void => {
    if (this._showTimer) clearTimeout(this._showTimer);
    this._computeAndShow();
  };

  private _computeAndShow(): void {
    const rect = this.getBoundingClientRect();
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: auf den Auslöser zentrieren und die BOX im Bild halten.
    //
    // Bis 31.08.2026 stand hier `Math.max(margin, Math.min(centerX, vw - margin))`
    // mit dem Kommentar „clamp to viewport". Geklemmt wurde aber der MITTELPUNKT,
    // und die Box hängt an `translateX(-50%)` — sie reicht also je eine halbe
    // Breite nach beiden Seiten darüber hinaus. Gemessen mit einer 336 px
    // breiten Blase am Fensterrand: links 152 px, rechts 138 px außerhalb des
    // Bildes. Der Kommentar beschrieb eine Absicht, die der Code nie ausführte.
    const centerX = rect.left + rect.width / 2;
    const margin = 16;
    const tipEl = this.shadowRoot?.querySelector('.tip') as HTMLElement | null;
    // `.tip` ist versteckt, aber nicht `display: none` — es hat Maße.
    const half = (tipEl?.offsetWidth ?? 0) / 2;
    const minLeft = margin + half;
    const maxLeft = vw - margin - half;
    // Passt die Blase überhaupt nicht ins Fenster, ist die Mitte das kleinste
    // Übel: dann ragt sie beidseitig gleich weit hinaus statt einseitig ganz.
    const left = maxLeft < minLeft ? vw / 2 : Math.min(Math.max(centerX, minLeft), maxLeft);
    // Der Pfeil zeigt weiterhin auf den Auslöser, auch wenn die Box verschoben
    // wurde. Ohne das behauptet er, zu einem anderen Element zu gehören.
    const arrowX = half > 0 ? Math.min(Math.max(centerX - (left - half), 10), half * 2 - 10) : 0;

    // Auto-flip: if preferred position has no room, flip
    let pos = this.position;
    if (pos === 'above' && rect.top < 80) pos = 'below';
    if (pos === 'below' && vh - rect.bottom < 80) pos = 'above';
    this._resolvedPos = pos;

    if (pos === 'below') {
      this._tipPos = {
        top: `${rect.bottom + gap}px`,
        left: `${left}px`,
        bottom: 'auto',
        '--_arrow-side': 'top',
        '--_arrow-x': half > 0 ? `${arrowX}px` : '50%',
      };
    } else {
      this._tipPos = {
        bottom: `${vh - rect.top + gap}px`,
        left: `${left}px`,
        top: 'auto',
        '--_arrow-side': 'bottom',
        '--_arrow-x': half > 0 ? `${arrowX}px` : '50%',
      };
    }
    this._visible = true;
  }

  private _hide = (): void => {
    if (this._showTimer) clearTimeout(this._showTimer);
    this._visible = false;
  };

  /** Escape dismisses tooltip (WCAG requirement). */
  private _handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._visible) {
      this._hide();
    }
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
      'tip--explainer': this.variant === 'explainer',
      'tip--visible': this._visible,
      'tip--above': this._resolvedPos === 'above',
      'tip--below': this._resolvedPos === 'below',
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
