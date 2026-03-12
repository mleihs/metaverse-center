import { localized } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { BleedStatus } from '../../types/health.js';

/**
 * Transparent overlay placed inside SimulationShell that renders bleed effects:
 * ghost text, Bureau watermark, and fracture warning banner.
 * All decorative elements are aria-hidden except the fracture warning.
 */
@localized()
@customElement('velg-bleed-palimpsest-overlay')
export class BleedPalimpsestOverlay extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      overflow: hidden;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ── Ghost Text Layer ── */

    .ghost-text {
      position: absolute;
      inset: 0;
      overflow: hidden;
      user-select: none;
    }

    .ghost-text__fragment {
      position: absolute;
      font-family: var(--font-bureau, 'Spectral', serif);
      font-style: italic;
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-bleed-ghost, rgba(229, 229, 229, 0.06));
      white-space: nowrap;
      transform: rotate(-2deg);
      animation: ghost-text-drift var(--duration-bleed-drift, 20s) linear infinite;
    }

    .ghost-text__fragment--intense {
      color: var(--color-bleed-ghost-intense, rgba(229, 229, 229, 0.12));
    }

    @keyframes ghost-text-drift {
      0% { transform: rotate(-2deg) translateY(0); }
      100% { transform: rotate(-2deg) translateY(-100px); }
    }

    /* ── Bureau Watermark ── */

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-8deg);
      width: 280px;
      height: 280px;
      opacity: 0.06;
      filter: invert(1);
      animation: watermark-pulse 8s ease-in-out infinite alternate;
    }

    @keyframes watermark-pulse {
      0% { opacity: 0.06; }
      100% { opacity: 0.12; }
    }

    .watermark img {
      width: 100%;
      height: 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      .ghost-text__fragment {
        animation: none;
        transform: rotate(-2deg);
      }
      .watermark {
        opacity: 0.08;
        animation: none;
      }
    }
  `;

  @property({ type: Object }) bleedStatus: BleedStatus | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Number }) intensity = 1;

  protected render() {
    if (!this.bleedStatus || this.bleedStatus.active_bleeds.length === 0) {
      return nothing;
    }

    return html`
      ${this._renderGhostText()}
      ${this._renderWatermark()}
    `;
  }

  private _renderGhostText() {
    const bleeds = this.bleedStatus!.active_bleeds;
    const fragments = bleeds
      .filter(b => b.lore_fragment)
      .slice(0, 3);

    if (fragments.length === 0) return nothing;

    return html`
      <div class="ghost-text" aria-hidden="true" role="presentation">
        ${fragments.map((bleed, i) => {
          const top = 15 + i * 28;
          const left = 5 + i * 12;
          const intense = bleed.echo_strength > 0.6;
          return html`
            <span
              class="ghost-text__fragment ${intense ? 'ghost-text__fragment--intense' : ''}"
              style="top: ${top}%; left: ${left}%; animation-delay: ${i * 3}s; opacity: ${0.06 + bleed.echo_strength * 0.06}"
            >${bleed.lore_fragment}</span>
          `;
        })}
      </div>
    `;
  }

  private _renderWatermark() {
    return html`
      <div class="watermark" aria-hidden="true" role="presentation">
        <img src="/compass-rose.svg" alt="" />
      </div>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bleed-palimpsest-overlay': BleedPalimpsestOverlay;
  }
}
