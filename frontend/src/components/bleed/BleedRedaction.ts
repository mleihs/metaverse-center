import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Animates de-redaction of [CLASSIFIED] text blocks when bleed activates.
 * Shows a solid black bar that cracks open to reveal hidden text.
 */
@localized()
@customElement('velg-bleed-redaction')
export class BleedRedaction extends LitElement {
  static styles = css`
    :host {
      display: inline;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .redaction {
      position: relative;
      display: inline;
      cursor: default;
    }

    .redaction__text {
      display: inline;
      color: var(--color-text-primary, #e5e5e5);
    }

    .redaction__cover {
      position: absolute;
      inset: -1px -2px;
      background: currentColor;
      transition: mask-size var(--duration-redaction-reveal, 6s) ease;
    }

    /* Sealed state: fully covered */
    .redaction--sealed .redaction__cover {
      mask-image: none;
      -webkit-mask-image: none;
    }

    /* Cracking state: mask reveals through gaps */
    .redaction--cracking .redaction__cover {
      mask-image: repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 2px,
        black 2px,
        black 8px
      );
      -webkit-mask-image: repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 2px,
        black 2px,
        black 8px
      );
      animation: redaction-crack var(--duration-redaction-reveal, 6s) ease forwards;
    }

    @keyframes redaction-crack {
      0% {
        mask-size: 100% 100%;
        -webkit-mask-size: 100% 100%;
        opacity: 1;
      }
      60% {
        opacity: 0.7;
      }
      100% {
        mask-size: 100% 0%;
        -webkit-mask-size: 100% 0%;
        opacity: 0;
      }
    }

    /* Revealed: cover gone */
    .redaction--revealed .redaction__cover {
      display: none;
    }

    /* Hover to peek when sealed + active */
    .redaction--sealed.redaction--active:hover .redaction__cover {
      opacity: 0.7;
    }

    @media (prefers-reduced-motion: reduce) {
      .redaction--cracking .redaction__cover {
        animation: none;
        opacity: 0;
      }
    }
  `;

  @property({ type: String }) text = '';
  @property({ type: Boolean }) active = false;
  @property({ type: Number }) duration = 6000;

  @state() private _state: 'sealed' | 'cracking' | 'revealed' = 'sealed';

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('active') && this.active && this._state === 'sealed') {
      this._state = 'cracking';
      // After animation, mark as revealed
      setTimeout(() => {
        this._state = 'revealed';
      }, this.duration);
    }
    if (changed.has('active') && !this.active) {
      this._state = 'sealed';
    }
  }

  protected render() {
    const stateClass = `redaction--${this._state}`;
    const activeClass = this.active ? 'redaction--active' : '';

    return html`
      <span
        class="redaction ${stateClass} ${activeClass}"
        aria-expanded=${this._state === 'revealed' ? 'true' : 'false'}
        aria-label=${msg('Classified content, partially revealed through bleed contamination')}
      >
        <span class="redaction__text">${this.text}</span>
        <span class="redaction__cover" aria-hidden="true"></span>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bleed-redaction': BleedRedaction;
  }
}
