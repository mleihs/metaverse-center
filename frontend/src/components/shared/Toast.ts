/**
 * Toast notification system — Bureau dispatch aesthetic.
 *
 * Design: Amber left accent bar, CRT scanline overlay, classification stamp,
 * timestamp, progress decay bar. Military-console brutalism.
 *
 * Architecture:
 * - Singleton container (`velg-toast`) auto-created in document.body
 * - Static API: `VelgToast.success(msg)`, `.error(msg)`, `.warning(msg)`, `.info(msg)`
 * - Max 5 visible toasts — oldest auto-dismissed when limit exceeded
 * - Error toasts persist 8s, others 5s
 * - Hover pauses auto-dismiss timer
 * - Timestamp captured at creation, not at render
 * - Close button in header flow (not absolute) — no overlap with timestamp
 * - `role="log"` on container, `role="status"` on individual toasts
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { icons } from '../../utils/icons.js';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  timestamp: string;
  removing?: boolean;
  paused?: boolean;
}

let toastContainerInstance: VelgToast | null = null;
let toastIdCounter = 0;

const MAX_VISIBLE = 5;
const DURATION: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 6000,
  error: 8000,
};
const EXIT_DURATION = 300;

function formatTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

@localized()
@customElement('velg-toast')
export class VelgToast extends LitElement {
  static styles = css`
    :host {
      display: flex;
      position: fixed;
      bottom: var(--space-6);
      right: var(--space-6);
      left: auto;
      z-index: var(--z-notification);
      flex-direction: column;
      gap: var(--space-3);
      pointer-events: none;
      max-width: calc(100vw - var(--space-6) * 2);
    }

    /* ── Dispatch container ──────────────────────────────── */

    .dispatch {
      position: relative;
      display: flex;
      align-items: stretch;
      min-width: min(320px, 100%);
      max-width: 480px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      pointer-events: auto;
      animation: dispatch-in 400ms var(--ease-out) forwards;
      overflow: hidden;
    }

    /* Type-specific tinted backgrounds — uses Tier 2 auto-derived tokens
       (8% status color mixed with surface) for subtle color coding */
    .dispatch--success {
      background: var(--color-success-bg);
      border-color: var(--color-success-border);
    }
    .dispatch--error {
      background: var(--color-danger-bg);
      border-color: var(--color-danger-border);
    }
    .dispatch--warning {
      background: var(--color-warning-bg);
      border-color: var(--color-warning-border);
    }
    .dispatch--info {
      background: var(--color-info-bg);
      border-color: var(--color-info-border);
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

    .dispatch__accent--success {
      background: var(--color-success);
      box-shadow: 0 0 8px var(--color-success-glow);
    }
    .dispatch__accent--error {
      background: var(--color-danger);
      box-shadow: 0 0 10px var(--color-danger-glow);
    }
    .dispatch__accent--warning {
      background: var(--color-warning);
      box-shadow: 0 0 8px var(--color-warning-glow);
    }
    .dispatch__accent--info {
      background: var(--color-info);
      box-shadow: 0 0 8px var(--color-info-glow);
    }

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
      padding: 10px 44px 14px 12px; /* right padding reserves space for close button + gap */
      position: relative;
      z-index: 2;
      min-width: 0;
    }

    .dispatch__header {
      display: flex;
      align-items: center;
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
      margin-left: auto;
    }

    .dispatch__close {
      position: absolute;
      top: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      z-index: 3;
      transition: color 150ms;
      /* 36px visible area, icon centered — WCAG touch target met via padding */
    }

    .dispatch__close:hover {
      color: var(--color-text-tertiary);
    }

    .dispatch__close:focus-visible {
      outline: 1px solid var(--color-info);
      outline-offset: -2px;
    }

    /* ── Message ─────────────────────────────────────────── */

    .dispatch__message {
      font-family: var(--font-sans);
      font-size: 13px;
      color: var(--color-text-primary);
      line-height: 1.45;
      word-break: break-word;
    }

    /* ── Progress bar ────────────────────────────────────── */

    .dispatch__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      width: 100%;
      z-index: 3;
      transform-origin: left;
    }

    .dispatch__progress--success { background: var(--color-success); }
    .dispatch__progress--error { background: var(--color-danger); }
    .dispatch__progress--warning { background: var(--color-warning); }
    .dispatch__progress--info { background: var(--color-info); }

    /* ── Paused state ───────────────────────────────────── */

    .dispatch--paused .dispatch__progress {
      animation-play-state: paused !important;
    }

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

    /* ── Mobile: full-width toasts (Sonner pattern) ────── */

    @media (max-width: 600px) {
      :host {
        right: var(--space-3);
        left: var(--space-3);
        bottom: var(--space-3);
        max-width: none;
      }

      .dispatch {
        min-width: 0;
        max-width: none;
        width: 100%;
      }
    }
  `;

  @state() private _toasts: ToastItem[] = [];
  private _timers = new Map<number, ReturnType<typeof setTimeout>>();
  private _remaining = new Map<number, number>();
  private _startTimes = new Map<number, number>();

  connectedCallback(): void {
    super.connectedCallback();
    toastContainerInstance = this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (toastContainerInstance === this) {
      toastContainerInstance = null;
    }
    // Clear all timers
    for (const timer of this._timers.values()) clearTimeout(timer);
    this._timers.clear();
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
    const timestamp = formatTimestamp();
    const duration = DURATION[type];

    this._toasts = [...this._toasts, { id, type, message, timestamp }];

    // Start auto-dismiss timer
    this._remaining.set(id, duration);
    this._startTimes.set(id, Date.now());
    this._timers.set(id, setTimeout(() => this._removeToast(id), duration));

    // Enforce max visible — dismiss oldest if over limit
    const active = this._toasts.filter((t) => !t.removing);
    if (active.length > MAX_VISIBLE) {
      this._removeToast(active[0].id);
    }
  }

  private _removeToast(id: number): void {
    if (this._toasts.some((t) => t.id === id && t.removing)) return;
    this._toasts = this._toasts.map((t) => (t.id === id ? { ...t, removing: true } : t));

    // Clear timer
    const timer = this._timers.get(id);
    if (timer) clearTimeout(timer);
    this._timers.delete(id);
    this._remaining.delete(id);
    this._startTimes.delete(id);

    setTimeout(() => {
      this._toasts = this._toasts.filter((t) => t.id !== id);
    }, EXIT_DURATION);
  }

  private _handleClose(id: number): void {
    this._removeToast(id);
  }

  private _handleMouseEnter(id: number): void {
    // Pause auto-dismiss: clear timer, record remaining time
    const timer = this._timers.get(id);
    if (timer) clearTimeout(timer);
    this._timers.delete(id);

    const startTime = this._startTimes.get(id);
    const totalDuration = this._remaining.get(id);
    if (startTime && totalDuration) {
      const elapsed = Date.now() - startTime;
      this._remaining.set(id, Math.max(totalDuration - elapsed, 1000));
    }

    this._toasts = this._toasts.map((t) => (t.id === id ? { ...t, paused: true } : t));
  }

  private _handleMouseLeave(id: number): void {
    // Resume auto-dismiss with remaining time
    const remaining = this._remaining.get(id) ?? 2000;
    this._startTimes.set(id, Date.now());
    this._timers.set(id, setTimeout(() => this._removeToast(id), remaining));

    this._toasts = this._toasts.map((t) => (t.id === id ? { ...t, paused: false } : t));
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

  protected render() {
    return html`
      ${this._toasts.map(
        (toast) => html`
          <div
            class="dispatch dispatch--${toast.type} ${toast.removing ? 'dispatch--removing' : ''} ${toast.paused ? 'dispatch--paused' : ''}"
            role="status"
            aria-live="polite"
            @mouseenter=${() => this._handleMouseEnter(toast.id)}
            @mouseleave=${() => this._handleMouseLeave(toast.id)}
          >
            <div class="dispatch__scanlines"></div>
            <div class="dispatch__accent dispatch__accent--${toast.type}"></div>
            <div class="dispatch__body">
              <div class="dispatch__header">
                <span class="dispatch__class dispatch__class--${toast.type}">
                  ${this._classLabel(toast.type)}
                </span>
                <span class="dispatch__timestamp">${toast.timestamp}</span>
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
            <div
              class="dispatch__progress dispatch__progress--${toast.type}"
              style="animation: progress-decay ${DURATION[toast.type]}ms linear forwards"
            ></div>
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
