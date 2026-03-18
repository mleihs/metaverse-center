import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { icons } from '../../utils/icons.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  removing?: boolean;
}

let toastContainerInstance: VelgToast | null = null;
let toastIdCounter = 0;

const TOAST_DURATION = 5000;
const EXIT_DURATION = 300;

@localized()
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

    /* ── Dispatch container ──────────────────────────────── */

    .dispatch {
      position: relative;
      display: flex;
      align-items: stretch;
      min-width: 320px;
      max-width: 480px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      pointer-events: auto;
      animation: dispatch-in 400ms var(--ease-out) forwards;
      overflow: hidden;
    }

    .dispatch::before,
    .dispatch::after {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      border-color: var(--color-border);
      border-style: solid;
      pointer-events: none;
      z-index: 2;
    }

    .dispatch::before {
      top: -1px;
      right: -1px;
      border-width: 1px 1px 0 0;
    }

    .dispatch::after {
      bottom: -1px;
      left: -1px;
      border-width: 0 0 1px 1px;
    }

    /* Scanline overlay */
    .dispatch__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.015) 2px,
        rgba(255, 255, 255, 0.015) 4px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* ── Accent bar ──────────────────────────────────────── */

    .dispatch__accent {
      width: 3px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }

    .dispatch__accent--success { background: var(--color-success); }
    .dispatch__accent--error { background: var(--color-danger); }
    .dispatch__accent--warning { background: var(--color-warning); }
    .dispatch__accent--info { background: var(--color-info); }

    .dispatch__accent--error::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--color-danger);
      animation: accent-pulse 1.6s ease-in-out infinite;
    }

    /* ── Body ────────────────────────────────────────────── */

    .dispatch__body {
      flex: 1;
      padding: 10px 12px 14px;
      position: relative;
      z-index: 2;
      min-width: 0;
    }

    .dispatch__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: 4px;
    }

    /* ── Classification stamp ────────────────────────────── */

    .dispatch__class {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-black);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      line-height: 1;
      padding: 2px 0;
    }

    .dispatch__class--success { color: var(--color-success); }
    .dispatch__class--error { color: var(--color-danger); }
    .dispatch__class--warning { color: var(--color-warning); }
    .dispatch__class--info { color: var(--color-info); }

    .dispatch__timestamp {
      font-family: var(--font-brutalist);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 0.08em;
      flex-shrink: 0;
    }

    /* ── Message ─────────────────────────────────────────── */

    .dispatch__message {
      font-family: var(--font-sans);
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.45;
      word-break: break-word;
    }

    /* ── Close button ────────────────────────────────────── */

    .dispatch__close {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      z-index: 3;
      transition: color 150ms, border-color 150ms;
    }

    .dispatch__close:hover {
      color: var(--color-text-tertiary);
      border-color: var(--color-border);
    }

    .dispatch__close:focus-visible {
      outline: 1px solid var(--color-info);
      outline-offset: 1px;
    }

    /* ── Progress bar ────────────────────────────────────── */

    .dispatch__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 100%;
      z-index: 3;
      animation: progress-decay ${TOAST_DURATION}ms linear forwards;
      transform-origin: left;
    }

    .dispatch__progress--success { background: var(--color-success); }
    .dispatch__progress--error { background: var(--color-danger); }
    .dispatch__progress--warning { background: var(--color-warning); }
    .dispatch__progress--info { background: var(--color-info); }

    /* ── Animations ──────────────────────────────────────── */

    @keyframes dispatch-in {
      0% {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
        clip-path: inset(0 100% 0 0);
      }
      40% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      100% {
        clip-path: inset(0 0 0 0);
      }
    }

    .dispatch--removing {
      animation: dispatch-out ${EXIT_DURATION}ms var(--ease-in) forwards;
    }

    @keyframes dispatch-out {
      to {
        opacity: 0;
        transform: scale(0.95);
      }
    }

    @keyframes accent-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    @keyframes progress-decay {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    /* ── Reduced motion ──────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .dispatch {
        animation: none;
        opacity: 1;
      }

      .dispatch--removing {
        animation: none;
        opacity: 0;
      }

      .dispatch__accent--error::after {
        animation: none;
      }

      .dispatch__progress {
        animation: none;
        transform: scaleX(0);
      }
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
    }, TOAST_DURATION);
  }

  private _removeToast(id: number): void {
    if (this._toasts.some((t) => t.id === id && t.removing)) return;
    this._toasts = this._toasts.map((t) => (t.id === id ? { ...t, removing: true } : t));

    setTimeout(() => {
      this._toasts = this._toasts.filter((t) => t.id !== id);
    }, EXIT_DURATION);
  }

  private _handleClose(id: number): void {
    this._removeToast(id);
  }

  private _classLabel(type: ToastType): string {
    switch (type) {
      case 'success':
        return msg('SIGNAL CONFIRMED');
      case 'error':
        return msg('BREACH DETECTED');
      case 'warning':
        return msg('ADVISORY');
      case 'info':
        return msg('DISPATCH');
    }
  }

  private _timestamp(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  protected render() {
    return html`
      ${this._toasts.map(
        (toast) => html`
          <div
            class="dispatch ${toast.removing ? 'dispatch--removing' : ''}"
            role="status"
            aria-live="polite"
          >
            <div class="dispatch__scanlines"></div>
            <div class="dispatch__accent dispatch__accent--${toast.type}"></div>
            <div class="dispatch__body">
              <div class="dispatch__header">
                <span class="dispatch__class dispatch__class--${toast.type}">
                  ${this._classLabel(toast.type)}
                </span>
                <span class="dispatch__timestamp">${this._timestamp()}</span>
              </div>
              <div class="dispatch__message">${toast.message}</div>
            </div>
            <button
              class="dispatch__close"
              @click=${() => this._handleClose(toast.id)}
              aria-label=${msg('Close')}
            >
              ${icons.close(10)}
            </button>
            <div class="dispatch__progress dispatch__progress--${toast.type}"></div>
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
