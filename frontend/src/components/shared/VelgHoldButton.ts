/**
 * VelgHoldButton -- Shared hold-to-confirm button component.
 *
 * Nuclear launch key pattern: user must hold the button for a configurable
 * duration to confirm a destructive or irreversible action.
 *
 * Uses CSS @keyframes animation + animationend for GPU-accelerated timing.
 * Pointer Events API with setPointerCapture for robust cross-input hold.
 * Two-step keyboard confirm: press once to arm, press again within 3s.
 *
 * @fires hold-confirmed - Fires when the hold duration completes successfully.
 *
 * @cssprop [--hold-btn-fill=color-mix(in srgb, var(--color-danger) 20%, transparent)]
 *   Fill bar background color during hold.
 * @cssprop [--hold-btn-active-color=var(--color-danger)]
 *   Text color during active hold.
 * @cssprop [--hold-btn-active-border=var(--color-danger)]
 *   Border color during active hold.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { a11yStyles } from './a11y-styles.js';

@localized()
@customElement('velg-hold-button')
export class VelgHoldButton extends LitElement {
  static styles = [
    a11yStyles,
    css`
      :host {
        display: inline-flex;
      }

      /* ── Button ── */
      button {
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: var(--space-2, 8px) var(--space-4, 16px);
        border: 2px solid currentColor;
        background: transparent;
        font: inherit;
        color: inherit;
        text-transform: uppercase;
        letter-spacing: inherit;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        -webkit-touch-callout: none;
      }

      button:disabled,
      button[aria-disabled='true'] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      button:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      /* ── Fill Bar ── */
      .fill {
        position: absolute;
        inset: 0;
        background: var(
          --hold-btn-fill,
          color-mix(in srgb, var(--color-danger, #ef4444) 20%, transparent)
        );
        transform: scaleX(0);
        transform-origin: left;
        pointer-events: none;
      }

      button[data-holding] {
        color: var(--hold-btn-active-color, var(--color-danger, #ef4444));
        border-color: var(
          --hold-btn-active-border,
          var(--color-danger, #ef4444)
        );
      }

      button[data-holding] .fill {
        animation: hold-fill var(--_hold-duration, 2000ms) linear forwards;
      }

      @keyframes hold-fill {
        to {
          transform: scaleX(1);
        }
      }

      /* ── Label ── */
      .label {
        position: relative;
        z-index: 1;
      }

      /* ── Reduced Motion ── */
      @media (prefers-reduced-motion: reduce) {
        button[data-holding] .fill {
          animation-duration: 300ms;
        }
      }

      /* ── Mobile: WCAG 44px minimum touch target ── */
      @media (max-width: 640px) {
        button {
          min-height: 44px;
        }
      }
    `,
  ];

  // ── Public API ──────────────────────────────────────────────────────────

  /** Hold duration in milliseconds. */
  @property({ type: Number }) duration = 2000;

  /** Label text in idle state. */
  @property() label = '';

  /** Label text during active hold. Falls back to `label`. */
  @property({ attribute: 'holding-label' }) holdingLabel = '';

  /** Label text when `executing` is true. Falls back to `label`. */
  @property({ attribute: 'executing-label' }) executingLabel = '';

  /** Disables all interaction. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** External busy state (e.g., async operation in progress). */
  @property({ type: Boolean, reflect: true }) executing = false;

  // ── Internal State ─────────────────────────────────────────────────────

  @state() private _holding = false;
  @state() private _keyArmed = false;

  private _keyArmTimer?: ReturnType<typeof setTimeout>;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('duration')) {
      this.style.setProperty('--_hold-duration', `${this.duration}ms`);
    }
  }

  override disconnectedCallback(): void {
    clearTimeout(this._keyArmTimer);
    super.disconnectedCallback();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    const activeLabel = this.executing
      ? this.executingLabel || this.label
      : this._holding
        ? this.holdingLabel || this.label
        : this.label;

    const isDisabled = this.disabled || this.executing;

    return html`
      <button
        ?data-holding=${this._holding}
        ?disabled=${isDisabled}
        @pointerdown=${this._onPointerDown}
        @pointerup=${this._onPointerUp}
        @pointerleave=${this._onPointerUp}
        @pointercancel=${this._onPointerUp}
        @contextmenu=${(e: Event) => e.preventDefault()}
        @keydown=${this._onKeyDown}
      >
        <span class="fill" @animationend=${this._onAnimationEnd}></span>
        <span class="label">${activeLabel}</span>
        ${
          this._keyArmed
            ? html`<span class="visually-hidden" role="status" aria-live="assertive">
              ${msg('Press again to confirm')}
            </span>`
            : ''
        }
      </button>
    `;
  }

  // ── Pointer Handlers ───────────────────────────────────────────────────

  private _onPointerDown(e: PointerEvent): void {
    if (this.disabled || this.executing) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this._holding = true;
  }

  private _onPointerUp(): void {
    this._holding = false;
  }

  private _onAnimationEnd(): void {
    this._holding = false;
    this._emitConfirmed();
  }

  // ── Keyboard Handlers (two-step confirm) ───────────────────────────────

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (this.disabled || this.executing) return;
    e.preventDefault();

    if (this._keyArmed) {
      clearTimeout(this._keyArmTimer);
      this._keyArmed = false;
      this._emitConfirmed();
    } else {
      this._keyArmed = true;
      this._keyArmTimer = setTimeout(() => {
        this._keyArmed = false;
      }, 3000);
    }
  }

  // ── Event Emission ─────────────────────────────────────────────────────

  private _emitConfirmed(): void {
    this.dispatchEvent(
      new CustomEvent('hold-confirmed', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-hold-button': VelgHoldButton;
  }
}
