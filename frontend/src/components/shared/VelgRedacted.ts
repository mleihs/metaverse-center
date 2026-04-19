/**
 * VelgRedacted -- Inline "redacted" marker, replaces its slotted text with a
 * black bar. On hover/focus the bar reveals a short declassification label.
 *
 * Usage:
 *   <velg-redacted label="freigegeben in epoche iii">Prophezeiung</velg-redacted>
 *
 * Lives outside the `/alpha` folder because redacted markers are part of the
 * Bureau vocabulary and may outlive the alpha phase.
 *
 * @element velg-redacted
 * @attr {string} label - Declassification label (shown on hover/focus)
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-redacted')
export class VelgRedacted extends LitElement {
  static styles = css`
    :host {
      --_bar: var(--color-text-primary);
      --_label: var(--color-accent-amber);
      display: inline-block;
      position: relative;
    }

    svg.defs {
      position: absolute;
      width: 0;
      height: 0;
      overflow: hidden;
    }

    .bar {
      display: inline-block;
      padding: 0 0.3ch;
      background: var(--_bar);
      color: transparent;
      user-select: none;
      border-radius: 1px;
      cursor: help;
      transition: background var(--transition-fast), color var(--transition-fast);
      outline: none;
    }

    .bar::after {
      content: '';
      position: absolute;
      inset: 0;
      filter: url(#velg-redacted-grain);
      mix-blend-mode: multiply;
      opacity: 0.18;
      pointer-events: none;
    }

    .bar:hover,
    .bar:focus-visible {
      background: color-mix(in srgb, var(--_bar) 18%, transparent);
      color: var(--_label);
    }

    .bar:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `;

  @property({ type: String }) label = '';

  protected render() {
    const labelText = this.label || msg('classified');
    return html`<svg class="defs" aria-hidden="true">
      <defs>
        <filter id="velg-redacted-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" />
        </filter>
      </defs>
    </svg><span
      class="bar"
      role="mark"
      tabindex="0"
      title=${labelText}
      aria-label=${msg(str`redacted: ${labelText}`)}
    ><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-redacted': VelgRedacted;
  }
}
