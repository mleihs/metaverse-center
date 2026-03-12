import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Entropy overlay — cold vignette + dying heartbeat pulse.
 *
 * Pure CSS, no external assets. Renders when `active` is true
 * (threshold_state === 'critical'). Vignette intensity scales
 * inversely with health.
 */
@customElement('velg-entropy-overlay')
export class EntropyOverlay extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 10;
      overflow: hidden;
    }

    /* ── Dark cold vignette ─────────────── */

    .vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        var(--color-entropy-vignette, rgba(0, 0, 0, 0.5)) 100%
      );
      opacity: 0;
      animation: vignette-in var(--duration-entropy-transition, 3s) ease forwards;
    }

    @keyframes vignette-in {
      to {
        opacity: var(--entropy-vignette-opacity, 0.8);
      }
    }

    /* ── Dying heartbeat pulse ──────────── */

    .pulse {
      position: absolute;
      inset: 0;
      background: rgba(239, 68, 68, 1);
      opacity: 0;
      animation: dying-pulse var(--duration-entropy-pulse, 12s) ease-in-out 2s infinite;
    }

    @keyframes dying-pulse {
      0%,
      100% {
        opacity: 0;
      }
      50% {
        opacity: 0.03;
      }
    }

    /* ── Screen reader ─────────────────── */

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ── Reduced motion ────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .vignette {
        animation: none;
        opacity: var(--entropy-vignette-opacity, 0.8);
      }

      .pulse {
        opacity: 0.02;
        animation: none;
      }
    }
  `;

  @property({ type: Boolean }) active = false;
  @property({ type: Number }) healthPercent = 50;
  @property({ type: Number }) overallHealth = 0.5;

  protected render() {
    if (!this.active) return html``;

    // Scale vignette intensity: lower health → darker edges
    // At health 0.25 (critical threshold): ~0.6, at 0: ~1.0
    const vignetteOpacity = Math.min(1, 0.5 + (1 - this.overallHealth) * 0.6);

    return html`
      <div
        role="alert"
        class="sr-only"
      >Simulation entering entropy state. Systems decelerating.</div>
      <div
        class="vignette"
        style="--entropy-vignette-opacity: ${vignetteOpacity}"
      ></div>
      <div class="pulse"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-entropy-overlay': EntropyOverlay;
  }
}
