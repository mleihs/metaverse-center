import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ThreatLevel } from './lore-content.js';

/**
 * Compact threat level badge widget for the simulation header.
 * Shows Bureau assessment level with color-coded indicator.
 * Clicking navigates to the lore tab / ZETA section.
 */
@localized()
@customElement('velg-threat-level')
export class VelgThreatLevel extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    .threat {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid;
      cursor: pointer;
      transition: all 0.2s;
      background: transparent;
      text-decoration: none;
      min-height: 24px;
    }

    .threat:hover {
      opacity: 0.8;
    }

    .threat:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .threat__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Level colors */
    .threat--low {
      color: var(--color-success, #22c55e);
      border-color: color-mix(in srgb, var(--color-success, #22c55e) 40%, transparent);
    }
    .threat--low .threat__dot { background: var(--color-success, #22c55e); }

    .threat--moderate {
      color: var(--color-warning, #eab308);
      border-color: color-mix(in srgb, var(--color-warning, #eab308) 40%, transparent);
    }
    .threat--moderate .threat__dot { background: var(--color-warning, #eab308); }

    .threat--high {
      color: var(--color-danger, #ef4444);
      border-color: color-mix(in srgb, var(--color-danger, #ef4444) 40%, transparent);
    }
    .threat--high .threat__dot {
      background: var(--color-danger, #ef4444);
      animation: threat-pulse 2s ease-in-out infinite;
    }

    .threat--critical {
      color: var(--color-danger, #ef4444);
      border-color: var(--color-danger, #ef4444);
      animation: threat-glow 1.5s ease-in-out infinite;
    }
    .threat--critical .threat__dot {
      background: var(--color-danger, #ef4444);
      animation: threat-pulse 0.8s ease-in-out infinite;
    }

    @keyframes threat-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    @keyframes threat-glow {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: 0 0 6px rgba(239, 68, 68, 0.3); }
    }

    @media (prefers-reduced-motion: reduce) {
      .threat--high .threat__dot,
      .threat--critical .threat__dot,
      .threat--critical {
        animation: none;
      }
    }
  `;

  @property({ type: Object }) threatLevel: ThreatLevel | null = null;

  private _handleClick(): void {
    this.dispatchEvent(new CustomEvent('navigate-to-zeta', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.threatLevel) return nothing;

    const { level, label } = this.threatLevel;
    const cssClass = label.toLowerCase();

    return html`
      <button
        class="threat threat--${cssClass}"
        role="link"
        aria-label="${msg('Threat level')}: ${level}/10 ${label}. ${msg('Click to view Bureau recommendation.')}"
        @click=${this._handleClick}
      >
        <span class="threat__dot" aria-hidden="true"></span>
        ${msg('THREAT')} ${level}/10
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-threat-level': VelgThreatLevel;
  }
}
