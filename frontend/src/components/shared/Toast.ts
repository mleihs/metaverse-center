import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let toastContainerInstance: VelgToast | null = null;
let toastIdCounter = 0;

@customElement('velg-toast')
export class VelgToast extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: fixed;
      bottom: var(--space-6);
      right: var(--space-6);
      z-index: var(--z-notification);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 300px;
      max-width: 480px;
      padding: var(--space-3) var(--space-4);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
      background: var(--color-surface-raised);
      pointer-events: auto;
      animation: slide-in var(--duration-slow) var(--ease-out) forwards;
    }

    .toast--removing {
      animation: slide-out var(--duration-normal) var(--ease-in) forwards;
    }

    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slide-out {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .toast__indicator {
      width: 4px;
      align-self: stretch;
      flex-shrink: 0;
    }

    .toast__indicator--success {
      background: var(--color-success);
    }

    .toast__indicator--error {
      background: var(--color-danger);
    }

    .toast__indicator--warning {
      background: var(--color-warning);
    }

    .toast__indicator--info {
      background: var(--color-info);
    }

    .toast__content {
      flex: 1;
    }

    .toast__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin-bottom: var(--space-0-5);
    }

    .toast__type--success {
      color: var(--color-success);
    }

    .toast__type--error {
      color: var(--color-danger);
    }

    .toast__type--warning {
      color: var(--color-warning);
    }

    .toast__type--info {
      color: var(--color-info);
    }

    .toast__message {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-snug);
    }

    .toast__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      line-height: 1;
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      flex-shrink: 0;
      transition: background var(--transition-fast);
    }

    .toast__close:hover {
      background: var(--color-surface-sunken);
    }
  `;

  @state() private _toasts: ToastItem[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    toastContainerInstance = this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (toastContainerInstance === this) {
      toastContainerInstance = null;
    }
  }

  private static _ensureContainer(): VelgToast {
    if (!toastContainerInstance) {
      const container = document.createElement('velg-toast');
      document.body.appendChild(container);
    }
    return toastContainerInstance as VelgToast;
  }

  static success(message: string): void {
    VelgToast._ensureContainer()._addToast('success', message);
  }

  static error(message: string): void {
    VelgToast._ensureContainer()._addToast('error', message);
  }

  static warning(message: string): void {
    VelgToast._ensureContainer()._addToast('warning', message);
  }

  static info(message: string): void {
    VelgToast._ensureContainer()._addToast('info', message);
  }

  private _addToast(type: ToastType, message: string): void {
    const id = ++toastIdCounter;
    this._toasts = [...this._toasts, { id, type, message }];

    setTimeout(() => {
      this._removeToast(id);
    }, 5000);
  }

  private _removeToast(id: number): void {
    this._toasts = this._toasts.filter((t) => t.id !== id);
  }

  private _handleClose(id: number): void {
    this._removeToast(id);
  }

  protected render() {
    return html`
      ${this._toasts.map(
        (toast) => html`
          <div class="toast">
            <div class="toast__indicator toast__indicator--${toast.type}"></div>
            <div class="toast__content">
              <div class="toast__type toast__type--${toast.type}">
                ${toast.type}
              </div>
              <div class="toast__message">${toast.message}</div>
            </div>
            <button
              class="toast__close"
              @click=${() => this._handleClose(toast.id)}
              aria-label="Close"
            >
              X
            </button>
          </div>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-toast': VelgToast;
  }
}
