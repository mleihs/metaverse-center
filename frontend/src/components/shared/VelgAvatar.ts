import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getInitials } from '../../utils/text.js';

@customElement('velg-avatar')
export class VelgAvatar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--color-surface-sunken);
    }

    :host([size='xs']) .avatar {
      width: 24px;
      height: 24px;
      border: var(--border-width-thin) solid var(--color-border);
    }

    :host([size='sm']) .avatar {
      width: 32px;
      height: 32px;
      border: var(--border-width-thin) solid var(--color-border);
    }

    :host([size='full']) .avatar {
      width: 100%;
      aspect-ratio: 1 / 1;
      border-bottom: var(--border-medium);
    }

    .avatar__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    :host([clickable]) .avatar__img {
      cursor: pointer;
    }

    .avatar__initials {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    :host([size='xs']) .avatar__initials {
      font-size: 9px;
    }

    :host([size='sm']) .avatar__initials {
      font-size: var(--text-xs);
    }

    :host([size='full']) .avatar__initials {
      font-size: var(--text-3xl);
    }
  `;

  @property({ type: String }) src = '';
  @property({ type: String }) name = '';
  @property({ type: String, attribute: 'alt' }) altText = '';
  @property({ type: String, reflect: true }) size: 'xs' | 'sm' | 'full' = 'sm';
  @property({ type: Boolean, reflect: true }) clickable = false;

  private _handleClick(e: Event): void {
    if (this.clickable && this.src) {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent('avatar-click', {
          detail: { src: this.src },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected render() {
    if (this.src) {
      return html`
        <div class="avatar">
          <img
            class="avatar__img"
            src=${this.src}
            alt=${this.altText || this.name}
            loading="lazy"
            @click=${this.clickable ? this._handleClick : nothing}
          />
        </div>
      `;
    }

    return html`
      <div class="avatar">
        <span class="avatar__initials">${getInitials(this.name)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-avatar': VelgAvatar;
  }
}
