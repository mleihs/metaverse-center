/**
 * Bureau Notice — Non-blocking inline banner for first-visit feature discovery.
 *
 * Replaces the auto-opening Bureau Dispatch modal with a compact 44px strip
 * that teaches users where the hexagon button lives. Follows the GuestBanner
 * pattern: slide-in, dismissible, one-line.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@localized()
@customElement('velg-bureau-notice')
export class VelgBureauNotice extends LitElement {
  static styles = css`
    :host {
      display: block;
      animation: notice-enter 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    :host(.dismissing) {
      animation: notice-exit 250ms ease-in forwards;
      pointer-events: none;
    }

    @keyframes notice-enter {
      from { opacity: 0; transform: translateY(-100%); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes notice-exit {
      to { opacity: 0; transform: translateY(-100%); }
    }

    @keyframes cta-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.15); }
      50%      { box-shadow: 0 0 12px 2px rgba(245, 158, 11, 0.2); }
    }

    .notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      height: 44px;
      padding: 0 16px;
      background: var(--color-surface-sunken);
      border-bottom: 1px solid var(--color-border);
      position: relative;
      overflow: hidden;
    }

    .notice::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(245, 158, 11, 0.4) 30%,
        rgba(245, 158, 11, 0.6) 50%,
        rgba(245, 158, 11, 0.4) 70%,
        transparent 100%
      );
    }

    .notice__marker {
      flex-shrink: 0;
      width: 6px;
      height: 6px;
      background: var(--color-accent-amber);
      clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    }

    .notice__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .notice__cta {
      flex-shrink: 0;
      padding: 4px 14px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-surface-sunken);
      background: var(--color-accent-amber);
      border: none;
      cursor: pointer;
      transition: background 150ms, transform 150ms;
      animation: cta-glow 3s ease-in-out infinite 2s;
    }

    .notice__cta:hover {
      background: var(--color-accent-amber-hover);
      transform: translateY(-1px);
    }

    .notice__cta:active {
      transform: translateY(0);
    }

    .notice__dismiss {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: 1px solid transparent;
      color: var(--color-icon);
      cursor: pointer;
      padding: 0;
      transition: color 150ms, border-color 150ms;
    }

    .notice__dismiss:hover {
      color: var(--color-text-muted);
      border-color: var(--color-border);
    }

    .notice__dismiss:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    .notice__dismiss svg {
      width: 12px;
      height: 12px;
    }

    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; opacity: 1; }
      :host(.dismissing) { animation: none; display: none; }
    }

    @media (max-width: 480px) {
      .notice { gap: 8px; padding: 0 12px; }
      .notice__text { font-size: 10px; }
      .notice__cta { padding: 4px 10px; font-size: 9px; letter-spacing: 1px; }
    }
  `;

  private _dismiss(): void {
    this.classList.add('dismissing');
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('notice-dismiss', { bubbles: true, composed: true }));
    }, 250);
  }

  private _openDispatch(): void {
    this.dispatchEvent(new CustomEvent('notice-open-dispatch', { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <div class="notice" role="status" aria-live="polite">
        <div class="notice__marker" aria-hidden="true"></div>
        <span class="notice__text">
          ${msg('Bureau Notice // Classified services available – access via ⬡ in header')}
        </span>
        <button
          class="notice__cta"
          @click=${this._openDispatch}
        >${msg('Review Dispatch')}</button>
        <button
          class="notice__dismiss"
          @click=${this._dismiss}
          aria-label=${msg('Dismiss')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-notice': VelgBureauNotice;
  }
}
