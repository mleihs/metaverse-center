/**
 * VelgKineticCounter — rolling-digit numeric display.
 *
 * Bureau-Dispatch aesthetic: counter animates from its previous value to
 * the new value over ``duration`` ms when ``value`` changes. A monospace
 * tabular-nums column keeps column widths stable through the roll.
 *
 * Accessibility:
 *   - ``role="status" aria-live="polite"`` announces the *final* value
 *     only, not intermediate frames.
 *   - ``prefers-reduced-motion`` fast-tracks to the final value in one
 *     frame.
 *
 * Usage:
 *   <velg-kinetic-counter
 *     value=${1247.5}
 *     prefix="$"
 *     precision=${2}
 *   ></velg-kinetic-counter>
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const DEFAULT_DURATION_MS = 800;

@customElement('velg-kinetic-counter')
export class VelgKineticCounter extends LitElement {
  static styles = css`
    :host {
      --_digit: var(--color-text-primary);
      --_affix: var(--color-text-secondary);
      display: inline-flex;
      align-items: baseline;
      gap: 0.12em;
      font-family: var(--font-brutalist, var(--font-mono, monospace));
      font-variant-numeric: tabular-nums;
      color: var(--_digit);
    }

    .affix {
      font-size: 0.62em;
      color: var(--_affix);
      letter-spacing: var(--tracking-wider, 0.05em);
    }

    .digits {
      font-weight: var(--font-black, 900);
      line-height: 1;
      color: var(--_digit);
    }
  `;

  @property({ type: Number }) value = 0;
  @property({ type: Number }) precision = 0;
  @property({ type: String }) prefix = '';
  @property({ type: String }) suffix = '';
  @property({ type: Number }) duration = DEFAULT_DURATION_MS;

  @state() private _display = 0;

  private _animationHandle: number | null = null;
  private _animationStart = 0;
  private _animationFrom = 0;
  private _animationTo = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._display = this.value;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cancelAnimation();
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (!changed.has('value')) return;

    const target = this.value;
    const from = this._display;
    if (target === from) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || this.duration <= 0) {
      this._cancelAnimation();
      this._display = target;
      return;
    }

    this._cancelAnimation();
    this._animationFrom = from;
    this._animationTo = target;
    this._animationStart = performance.now();
    this._animationHandle = window.requestAnimationFrame(this._tick);
  }

  private _tick = (now: number): void => {
    const elapsed = now - this._animationStart;
    const progress = Math.min(1, elapsed / this.duration);
    // Cubic ease-out — the classic "settle" curve.
    const eased = 1 - Math.pow(1 - progress, 3);
    this._display = this._animationFrom + (this._animationTo - this._animationFrom) * eased;
    if (progress < 1) {
      this._animationHandle = window.requestAnimationFrame(this._tick);
    } else {
      this._display = this._animationTo;
      this._animationHandle = null;
    }
  };

  private _cancelAnimation(): void {
    if (this._animationHandle !== null) {
      window.cancelAnimationFrame(this._animationHandle);
      this._animationHandle = null;
    }
  }

  private _format(value: number): string {
    const p = Math.max(0, this.precision | 0);
    return value.toLocaleString(undefined, {
      minimumFractionDigits: p,
      maximumFractionDigits: p,
    });
  }

  protected render() {
    const ariaValue = `${this.prefix}${this._format(this.value)}${this.suffix}`;
    return html`
      <span role="status" aria-live="polite" aria-atomic="true" style="position:absolute;left:-9999px">${ariaValue}</span>
      ${this.prefix ? html`<span class="affix" aria-hidden="true">${this.prefix}</span>` : nothing}
      <span class="digits" aria-hidden="true">${this._format(this._display)}</span>
      ${this.suffix ? html`<span class="affix" aria-hidden="true">${this.suffix}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-kinetic-counter': VelgKineticCounter;
  }
}
