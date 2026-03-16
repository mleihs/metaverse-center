import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Entropy countdown timer badge.
 *
 * Fixed position top-right, below header. Shows remaining entropy
 * cycles with pulsing digits. Mutually exclusive with ascendancy badge.
 */
@localized()
@customElement('velg-entropy-timer')
export class EntropyTimer extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .timer {
      position: fixed;
      top: calc(var(--header-height, 56px) + var(--space-3, 12px));
      right: var(--space-4, 16px);
      z-index: 30;
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1-5, 6px) var(--space-3, 12px);
      background: var(--color-entropy-timer-bg, rgba(10, 0, 0, 0.9));
      border: 1px solid var(--color-entropy-timer-border, rgba(239, 68, 68, 0.4));
      box-shadow: 0 0 12px var(--color-entropy-timer-glow, rgba(239, 68, 68, 0.15));
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--color-danger, #ef4444);
      animation: timer-enter 0.5s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes timer-enter {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .timer__label {
      opacity: 0.7;
    }

    .timer__sep {
      opacity: 0.3;
    }

    .timer__digits {
      text-shadow: 0 0 4px var(--color-danger, #ef4444);
      animation: digit-pulse 6s ease-in-out infinite;
      min-width: 1.6em;
      text-align: center;
    }

    .timer__digits--flash {
      animation: digit-flash var(--duration-entropy-digit-flash, 200ms) ease;
    }

    @keyframes digit-pulse {
      0%,
      100% {
        opacity: 0.6;
      }
      50% {
        opacity: 1;
      }
    }

    @keyframes digit-flash {
      0% {
        filter: brightness(2);
      }
      100% {
        filter: brightness(1);
      }
    }

    .timer__suffix {
      opacity: 0.7;
    }

    /* ── Reduced motion ────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .timer {
        animation: none;
      }

      .timer__digits {
        animation: none;
        opacity: 1;
      }

      .timer__digits--flash {
        animation: none;
      }
    }
  `;

  @property({ type: Number }) cyclesRemaining: number | null = null;

  @state() private _flashing = false;
  private _prevCycles: number | null = null;

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (
      changed.has('cyclesRemaining') &&
      this._prevCycles !== null &&
      this.cyclesRemaining !== this._prevCycles
    ) {
      this._flashing = true;
      setTimeout(() => {
        this._flashing = false;
      }, 200);
    }
    this._prevCycles = this.cyclesRemaining;
  }

  protected render() {
    if (this.cyclesRemaining == null) return nothing;

    const count = String(this.cyclesRemaining).padStart(2, '0');
    const label = `${msg('ENTROPY')}: ${this.cyclesRemaining} ${msg('CYCLES')}`;

    return html`
      <div
        class="timer"
        role="timer"
        aria-label=${label}
      >
        <span class="timer__label">${msg('ENTROPY')}</span>
        <span class="timer__sep">|</span>
        <span class="timer__digits ${this._flashing ? 'timer__digits--flash' : ''}">${count}</span>
        <span class="timer__sep">|</span>
        <span class="timer__suffix">${msg('CYCLES')}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-entropy-timer': EntropyTimer;
  }
}
