import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Golden celestial aura overlay when threshold_state === 'ascendant'.
 *
 * Renders ascending light rays, floating golden particles, warm vignette,
 * gilded border, and a prominent ASCENDANT badge. All decorative except
 * the badge which carries an aria-label for screen readers.
 */
@localized()
@customElement('velg-ascendancy-aura')
export class AscendancyAura extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ── Golden vignette + border ─────────────── */

    .aura {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      animation: aura-in 2s ease forwards;
    }

    .aura::before {
      content: '';
      position: absolute;
      inset: 0;
      box-shadow:
        inset 0 0 120px rgba(245, 158, 11, 0.04),
        inset 0 0 40px rgba(245, 158, 11, 0.02);
      border-top: 2px solid var(--color-accent-amber);
      border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    }

    /* Warm golden corner vignette */
    .aura::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at 50% 0%, rgba(245, 158, 11, 0.03) 0%, transparent 60%),
        radial-gradient(ellipse at 50% 100%, rgba(245, 158, 11, 0.02) 0%, transparent 50%);
    }

    @keyframes aura-in {
      to {
        opacity: 1;
      }
    }

    /* ── Light rays ──────────────────────────── */

    .rays {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
      overflow: hidden;
      opacity: 0;
      animation: aura-in 3s ease 0.5s forwards;
    }

    .ray {
      position: absolute;
      bottom: -20%;
      width: 2px;
      height: 140%;
      background: linear-gradient(to top, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.01), transparent);
      transform-origin: bottom center;
      animation: ray-sway 8s ease-in-out infinite;
    }

    @keyframes ray-sway {
      0%,
      100% {
        transform: rotate(var(--ray-angle)) scaleY(1);
        opacity: var(--ray-opacity);
      }
      50% {
        transform: rotate(calc(var(--ray-angle) + 1.5deg)) scaleY(1.05);
        opacity: calc(var(--ray-opacity) * 1.3);
      }
    }

    /* ── Floating particles ──────────────────── */

    .particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 7;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      bottom: -4px;
      width: var(--p-size, 3px);
      height: var(--p-size, 3px);
      background: var(--color-accent-amber);
      border-radius: 50%;
      opacity: 0;
      filter: blur(0.5px);
      animation: float-up var(--p-dur, 6s) ease-in-out var(--p-del, 0s) infinite;
    }

    @keyframes float-up {
      0% {
        opacity: 0;
        transform: translateY(0) scale(0.3);
      }
      15% {
        opacity: 0.7;
      }
      85% {
        opacity: 0.15;
      }
      100% {
        opacity: 0;
        transform: translateY(-100vh) scale(0.1);
      }
    }

    /* ── Ascendant badge ─────────────────────── */

    .badge {
      position: fixed;
      top: calc(var(--header-height, 56px) + var(--space-2, 8px));
      right: var(--space-4, 16px);
      z-index: 15;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1, 4px) var(--space-4, 16px);
      font-family: var(--font-brutalist, sans-serif);
      font-size: var(--text-xs, 12px);
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      background: linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(20, 15, 5, 0.95));
      border: 1px solid var(--color-accent-amber);
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.25), inset 0 0 12px rgba(245, 158, 11, 0.05);
      animation: badge-breathe 4s ease-in-out infinite;
      transform: translateY(-4px);
      opacity: 0;
      animation:
        badge-enter 0.6s var(--ease-spring, ease) 1s forwards,
        badge-breathe 4s ease-in-out 1.6s infinite;
    }

    .badge__icon {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--color-accent-amber);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
      animation: core-pulse 3s ease-in-out infinite;
    }

    @keyframes badge-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes badge-breathe {
      0%,
      100% {
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.03);
      }
      50% {
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.35), inset 0 0 16px rgba(245, 158, 11, 0.06);
      }
    }

    @keyframes core-pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.15);
        opacity: 1;
      }
    }

    /* ── Reduced motion ──────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .aura {
        opacity: 1;
        animation: none;
      }

      .rays {
        opacity: 0.5;
        animation: none;
      }

      .ray {
        animation: none;
        opacity: var(--ray-opacity) !important;
      }

      .particle {
        display: none;
      }

      .badge {
        opacity: 1;
        transform: translateY(0);
        animation: none;
        box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
      }

      .badge__icon {
        animation: none;
      }
    }
  `;

  @property({ type: Boolean }) active = false;

  /** 7 light rays with pre-computed angles and opacities. */
  private _rays = [
    { left: '8%', angle: '-6deg', opacity: 0.5, delay: '0s' },
    { left: '20%', angle: '-3deg', opacity: 0.7, delay: '1.2s' },
    { left: '35%', angle: '-1deg', opacity: 0.4, delay: '0.5s' },
    { left: '50%', angle: '0deg', opacity: 0.8, delay: '2s' },
    { left: '65%', angle: '1.5deg', opacity: 0.5, delay: '0.8s' },
    { left: '80%', angle: '3deg', opacity: 0.6, delay: '1.5s' },
    { left: '92%', angle: '5deg', opacity: 0.4, delay: '0.3s' },
  ];

  /** 14 floating golden particles with pre-computed positions. */
  private _particles = Array.from({ length: 14 }, (_, i) => ({
    left: `${5 + (i * 97) / 14 + ((i * 7) % 5)}%`,
    size: `${2 + (i % 3)}px`,
    dur: `${5 + (i % 4) * 1.5}s`,
    del: `${(i * 0.7) % 5}s`,
  }));

  protected render() {
    if (!this.active) return html``;

    return html`
      <div class="aura" aria-hidden="true"></div>

      <div class="rays" aria-hidden="true">
        ${this._rays.map(
          (r) => html`
            <div
              class="ray"
              style="left:${r.left};--ray-angle:${r.angle};--ray-opacity:${r.opacity};animation-delay:${r.delay}"
            ></div>
          `,
        )}
      </div>

      <div class="particles" aria-hidden="true">
        ${this._particles.map(
          (p) => html`
            <div class="particle" style="left:${p.left};--p-size:${p.size};--p-dur:${p.dur};--p-del:${p.del}"></div>
          `,
        )}
      </div>

      <div class="badge" role="status" aria-label=${msg('Simulation has achieved Ascendant status')}>
        <span class="badge__icon" aria-hidden="true"></span>
        ${msg('Ascendant')}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ascendancy-aura': AscendancyAura;
  }
}
