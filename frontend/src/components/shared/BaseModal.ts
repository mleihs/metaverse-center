import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-base-modal')
export class VelgBaseModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--transition-normal), visibility var(--transition-normal);
    }

    .backdrop--open {
      opacity: 1;
      visibility: visible;
    }

    .modal {
      position: relative;
      width: 100%;
      max-width: 560px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-xl);
      transform: translateY(20px);
      transition: transform var(--transition-normal);
    }

    .backdrop--open .modal {
      transform: translateY(0);
    }

    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
    }

    .modal__header-content {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .modal__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      line-height: 1;
      color: var(--color-text-primary);
      background: transparent;
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .modal__close:hover {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .modal__body {
      padding: var(--space-6);
      overflow-y: auto;
      flex: 1;
    }

    .modal__footer {
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-light);
      flex-shrink: 0;
    }

    /* === Mobile overrides === */
    @media (max-width: 640px) {
      .modal {
        max-width: none;
        margin: var(--space-3);
        max-height: 90vh;
      }

      .modal__header {
        padding: var(--space-3) var(--space-4);
      }

      .modal__close {
        min-width: 44px;
        min-height: 44px;
      }

      .modal__body {
        padding: var(--space-4);
      }

      .modal__footer {
        padding: var(--space-3) var(--space-4);
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._handleKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._focusFirstElement();
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;
    if (e.key === 'Escape') {
      this._close();
      return;
    }
    if (e.key === 'Tab') {
      this._trapFocus(e);
    }
  }

  private _trapFocus(e: KeyboardEvent): void {
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = this.shadowRoot?.querySelector('.modal');
    if (!modal) return;

    const focusable = [
      ...modal.querySelectorAll<HTMLElement>(focusableSelector),
      ...(this.querySelectorAll<HTMLElement>(focusableSelector) || []),
    ];
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) {
      this._close();
    }
  }

  private _close(): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _focusFirstElement(): void {
    requestAnimationFrame(() => {
      const focusable = this.shadowRoot?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });
  }

  protected render() {
    return html`
      <div
        class="backdrop ${this.open ? 'backdrop--open' : ''}"
        @click=${this._handleBackdropClick}
      >
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <div class="modal__header-content">
              <slot name="header"></slot>
            </div>
            <button
              class="modal__close"
              @click=${this._close}
              aria-label=${msg('Close')}
            >
              X
            </button>
          </div>

          <div class="modal__body">
            <slot></slot>
          </div>

          <div class="modal__footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-base-modal': VelgBaseModal;
  }
}
