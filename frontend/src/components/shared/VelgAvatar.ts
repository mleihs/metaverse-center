import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { getInitials } from '../../utils/text.js';

@customElement('velg-avatar')
export class VelgAvatar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .avatar-wrap {
      position: relative;
      display: inline-block;
    }

    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--color-surface-sunken);
      position: relative;
      z-index: 1;
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
      aspect-ratio: var(--avatar-aspect, 1 / 1);
      height: var(--avatar-height, auto);
      border-bottom: var(--border-medium);
    }

    /* ── Mood ring ──────────────────────────────────── */

    .mood-ring {
      position: absolute;
      inset: -3px;
      border: 2px solid var(--_mood-color, transparent);
      z-index: 0;
      animation: mood-pulse 3s ease-in-out infinite;
      /* Glow effect matching ring color */
      box-shadow: 0 0 6px 0 var(--_mood-color, transparent);
    }

    @keyframes mood-pulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .mood-ring {
        animation: none;
        opacity: 0.8;
      }
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
  /** Agent mood ring color (CSS value). When set, renders a pulsing ring around the avatar. */
  @property({ type: String }) moodColor = '';

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

  private _renderMoodRing() {
    if (!this.moodColor) return nothing;
    return html`<div
      class="mood-ring"
      style=${styleMap({ '--_mood-color': this.moodColor })}
      aria-hidden="true"
    ></div>`;
  }

  protected render() {
    if (this.src) {
      return html`
        <div class="avatar-wrap">
          ${this._renderMoodRing()}
          <div class="avatar">
            <img
              class="avatar__img"
              src=${this.src}
              alt=${this.altText || this.name}
              loading="lazy"
              @click=${this.clickable ? this._handleClick : nothing}
            />
          </div>
        </div>
      `;
    }

    return html`
      <div class="avatar-wrap">
        ${this._renderMoodRing()}
        <div class="avatar">
          <span class="avatar__initials">${getInitials(this.name)}</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-avatar': VelgAvatar;
  }
}
