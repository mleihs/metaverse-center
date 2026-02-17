import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Shared lightbox component for displaying images in a fullscreen overlay.
 *
 * Usage:
 *   <velg-lightbox .src=${imageUrl} @lightbox-close=${handler}></velg-lightbox>
 *
 * Pass a truthy `src` to open, set to `null`/`''` to close.
 * Fires `lightbox-close` when the user clicks the backdrop, the close button, or presses Escape.
 */
@customElement('velg-lightbox')
export class VelgLightbox extends LitElement {
  static styles = css`
    :host { display: block; }

    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.85);
      cursor: pointer;
      animation: lightbox-fade-in 0.15s ease-out;
    }

    @keyframes lightbox-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .lightbox__img {
      max-width: 90vw;
      max-height: 85vh;
      object-fit: contain;
      border: var(--border-width-thick, 3px) solid var(--color-surface, #fff);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
      cursor: default;
    }

    .lightbox__close {
      position: absolute;
      top: var(--space-4, 16px);
      right: var(--space-4, 16px);
      background: var(--color-surface, #fff);
      color: var(--color-text-primary, #000);
      border: var(--border-default, 2px solid #000);
      box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.2));
      width: 40px;
      height: 40px;
      font-family: var(--font-brutalist, sans-serif);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg, 18px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background var(--transition-fast, 0.1s), color var(--transition-fast, 0.1s);
    }

    .lightbox__close:hover {
      background: var(--color-danger, #e53e3e);
      color: var(--color-text-inverse, #fff);
    }
  `;

  @property({ type: String }) src: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('src')) {
      if (this.src) {
        document.addEventListener('keydown', this._onKeyDown);
      } else {
        document.removeEventListener('keydown', this._onKeyDown);
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._close();
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('lightbox-close', { bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.src) return nothing;

    return html`
      <div class="lightbox" @click=${this._close}>
        <img
          class="lightbox__img"
          src=${this.src}
          alt=""
          @click=${(e: Event) => e.stopPropagation()}
        />
        <button class="lightbox__close" aria-label="Close">&times;</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-lightbox': VelgLightbox;
  }
}
