import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { socialMediaApi } from '../../services/api/index.js';
import type { SocialMediaPost } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

@localized()
@customElement('velg-post-transform-modal')
export class VelgPostTransformModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .transform {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .transform__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin-bottom: var(--space-1-5);
    }

    .transform__original {
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      font-size: var(--text-sm);
    }

    .transform__types {
      display: flex;
      gap: var(--space-2);
    }

    .transform__type-btn {
      flex: 1;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-raised);
      border: var(--border-default);
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: center;
    }

    .transform__type-btn:hover {
      background: var(--color-surface-sunken);
    }

    .transform__type-btn--active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .footer__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .footer__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .footer__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .footer__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .footer__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .footer__btn--save {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }
  `;

  @property({ type: Object }) post!: SocialMediaPost;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _type: 'dystopian' | 'propaganda' | 'surveillance' = 'dystopian';
  @state() private _loading = false;

  private async _handleTransform(): Promise<void> {
    this._loading = true;
    const response = await socialMediaApi.transformPost(this.simulationId, this.post.id, {
      transformation_type: this._type,
    });
    if (response.success) {
      VelgToast.success(msg('Post transformed'));
      this.dispatchEvent(
        new CustomEvent('transform-complete', {
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      VelgToast.error(response.error?.message || msg('Transform failed'));
    }
    this._loading = false;
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${msg('Transform Post')}</span>

        <div class="transform">
          <div>
            <div class="transform__label">${msg('Original Message')}</div>
            <div class="transform__original">${this.post.message || msg('No content')}</div>
          </div>
          <div>
            <div class="transform__label">${msg('Transformation Type')}</div>
            <div class="transform__types">
              ${(['dystopian', 'propaganda', 'surveillance'] as const).map(
                (t) => html`
                <button
                  class="transform__type-btn ${this._type === t ? 'transform__type-btn--active' : ''}"
                  @click=${() => {
                    this._type = t;
                  }}
                >${t}</button>
              `,
              )}
            </div>
          </div>
        </div>

        <div slot="footer" class="footer">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._loading}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleTransform}
            ?disabled=${this._loading}
          >
            ${this._loading ? msg('Transforming...') : msg('Transform')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-post-transform-modal': VelgPostTransformModal;
  }
}
