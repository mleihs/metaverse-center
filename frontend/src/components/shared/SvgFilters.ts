import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * Reusable SVG filter definitions for bleed, parchment, and fracture effects.
 * Renders an invisible `<svg>` with `<defs>` that other components reference
 * via `url(#filter-id)`.
 */
@customElement('velg-svg-filters')
export class VelgSvgFilters extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      width: 0;
      height: 0;
      overflow: hidden;
      pointer-events: none;
    }
  `;

  protected render() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">
        <defs>
          <!-- Ink bleed: feathered hand-drawn ink edges -->
          <filter id="ink-bleed" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          </filter>

          <!-- Parchment noise: paper grain texture -->
          <filter id="parchment-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" result="grain" />
            <feComposite in="SourceGraphic" in2="grain" operator="in" />
          </filter>

          <!-- Crack roughen: eroded fracture edges -->
          <filter id="crack-roughen" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
          </filter>

          <!-- Ghost text blur: barely-visible bleed text -->
          <filter id="ghost-text-blur">
            <feGaussianBlur stdDeviation="0.3" />
          </filter>

          <!-- Entropy dissolve: subtle displacement noise -->
          <filter id="entropy-dissolve" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
          </filter>
        </defs>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-svg-filters': VelgSvgFilters;
  }
}
