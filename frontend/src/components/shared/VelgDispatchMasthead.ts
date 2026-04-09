/**
 * VelgDispatchMasthead -- Newspaper masthead with theme-adaptive styling.
 *
 * Renders a publication header with:
 *   - Classification line (small caps, tracked)
 *   - Title (brutalist heading, fluid typography)
 *   - Subtitle (monospace description)
 *   - Optional theme color radial glow
 *
 * Extracted from ChronicleFeed wire-header, adaptable to per-simulation
 * newspaper views.
 *
 * @element velg-dispatch-masthead
 * @attr {string} classification - Top classification line
 * @attr {string} title - Main title
 * @attr {string} subtitle - Description text
 * @attr {string} themeColor - Optional CSS color for radial glow accent
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-dispatch-masthead')
export class VelgDispatchMasthead extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-16, 64px) var(--space-6, 24px) var(--space-6, 24px);
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    /* Radial glow from theme color */
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse at 50% 0%,
        color-mix(in srgb, var(--_glow-color, var(--color-primary)) 4%, transparent) 0%,
        transparent 60%
      );
      pointer-events: none;
    }

    .classification {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4, 16px);
    }

    .title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.15em);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-3, 12px);
      line-height: 1.1;
      text-wrap: balance;
    }

    .subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.2vw, 0.875rem);
      color: var(--color-text-secondary);
      max-width: 640px;
      margin: 0 auto;
      line-height: 1.6;
      letter-spacing: 0.5px;
    }

    /* ── Responsive ─────────────────────── */

    @media (max-width: 640px) {
      :host {
        padding: var(--space-10, 40px) var(--space-4, 16px) var(--space-4, 16px);
      }
    }
  `;

  @property({ type: String }) classification = '';
  @property({ type: String }) override title = '';
  @property({ type: String }) subtitle = '';
  @property({ type: String }) themeColor = '';

  protected render() {
    return html`
      ${
        this.themeColor
          ? html`<style>:host { --_glow-color: ${this.themeColor}; }</style>`
          : nothing
      }

      ${this.classification ? html`<p class="classification">${this.classification}</p>` : nothing}

      <h1 class="title">${this.title || msg('Dispatch Feed')}</h1>

      ${this.subtitle ? html`<p class="subtitle">${this.subtitle}</p>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dispatch-masthead': VelgDispatchMasthead;
  }
}
