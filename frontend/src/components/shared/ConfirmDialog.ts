import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import './BaseModal.js';

@localized()
@customElement('velg-confirm-dialog')
export class VelgConfirmDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .confirm__message {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }

    .confirm__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .confirm__btn {
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

    .confirm__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .confirm__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .confirm__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .confirm__btn--confirm {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .confirm__btn--danger {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .confirm__btn--danger:hover {
      background: var(--color-danger-hover);
    }
  `;

  @property({ type: String }) title = msg('Confirm');
  @property({ type: String }) message = msg('Are you sure?');
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = msg('Confirm');
  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = msg('Cancel');
  @property({ type: String }) variant: 'default' | 'danger' = 'default';
  @state() private _open = false;

  private _resolve: ((value: boolean) => void) | null = null;

  static async show(options: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
  }): Promise<boolean> {
    const dialog = document.createElement('velg-confirm-dialog');
    if (options.title) dialog.title = options.title;
    dialog.message = options.message;
    if (options.confirmLabel) dialog.confirmLabel = options.confirmLabel;
    if (options.cancelLabel) dialog.cancelLabel = options.cancelLabel;
    if (options.variant) dialog.variant = options.variant;

    document.body.appendChild(dialog);

    return new Promise<boolean>((resolve) => {
      dialog._resolve = (value: boolean) => {
        resolve(value);
        dialog.remove();
      };
      dialog._open = true;
    });
  }

  private _handleConfirm(): void {
    this._open = false;
    if (this._resolve) {
      this._resolve(true);
    }
  }

  private _handleCancel(): void {
    this._open = false;
    if (this._resolve) {
      this._resolve(false);
    }
  }

  private _handleModalClose(): void {
    this._handleCancel();
  }

  protected render() {
    const confirmClass =
      this.variant === 'danger'
        ? 'confirm__btn confirm__btn--danger'
        : 'confirm__btn confirm__btn--confirm';

    return html`
      <velg-base-modal
        ?open=${this._open}
        @modal-close=${this._handleModalClose}
      >
        <span slot="header">${this.title}</span>

        <div class="confirm__message">${this.message}</div>

        <div slot="footer" class="confirm__actions">
          <button
            class="confirm__btn confirm__btn--cancel"
            @click=${this._handleCancel}
          >
            ${this.cancelLabel}
          </button>
          <button
            class=${confirmClass}
            @click=${this._handleConfirm}
          >
            ${this.confirmLabel}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-confirm-dialog': VelgConfirmDialog;
  }
}
