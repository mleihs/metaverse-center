/**
 * Guest Banner — Sticky top banner for unauthenticated browsing sessions.
 *
 * Aesthetic: Classified access warning strip on a military terminal.
 * Compact, authoritative, dismissible per session.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { navigate } from '../../utils/navigation.js';

const STORAGE_KEY = 'guest-banner-dismissed';

@localized()
@customElement('velg-guest-banner')
export class VelgGuestBanner extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: var(--z-raised);
      animation: banner-enter 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    :host(.dismissing) {
      animation: banner-exit 250ms ease-in forwards;
      pointer-events: none;
    }

    @keyframes banner-enter {
      from { opacity: 0; transform: translateY(-100%); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes banner-exit {
      to { opacity: 0; transform: translateY(-100%); }
    }

    @keyframes cta-glow {
      0%, 100% { box-shadow: 0 0 0 0 var(--color-warning-glow); }
      50%      { box-shadow: 0 0 12px 2px var(--color-warning-glow); }
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      height: 44px;
      padding: 0 16px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-light);
      position: relative;
      overflow: hidden;
    }

    /* Subtle amber accent line at top */
    .banner::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--color-primary) 40%, transparent) 30%,
        color-mix(in srgb, var(--color-primary) 60%, transparent) 50%,
        color-mix(in srgb, var(--color-primary) 40%, transparent) 70%,
        transparent 100%
      );
    }

    .banner__marker {
      flex-shrink: 0;
      width: 6px;
      height: 6px;
      background: var(--color-primary);
      clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    }

    .banner__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .banner__cta {
      flex-shrink: 0;
      padding: 4px 14px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-inverse);
      background: var(--color-primary);
      border: none;
      cursor: pointer;
      transition: background 150ms, transform 150ms;
      text-decoration: none;
      animation: cta-glow 3s ease-in-out infinite 2s;
    }

    .banner__cta:hover {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
    }

    .banner__cta:active {
      transform: translateY(0);
    }

    .banner__dismiss {
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

    .banner__dismiss:hover {
      color: var(--color-text-muted);
      border-color: var(--color-border);
    }

    .banner__dismiss:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
    }

    .banner__dismiss svg {
      width: 12px;
      height: 12px;
    }

    @media (max-width: 480px) {
      .banner { gap: 8px; padding: 0 12px; }
      .banner__text { font-size: 10px; }
      .banner__cta { padding: 4px 10px; font-size: 9px; letter-spacing: 1px; }
    }
  `;

  @state() private _visible = true;

  connectedCallback(): void {
    super.connectedCallback();
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
      this._visible = false;
    }
  }

  private _dismiss(): void {
    this.classList.add('dismissing');
    sessionStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => {
      this._visible = false;
      this.dispatchEvent(
        new CustomEvent('guest-banner-dismiss', { bubbles: true, composed: true }),
      );
    }, 250);
  }

  private _navigate(e: Event): void {
    e.preventDefault();
    navigate('/register');
  }

  protected render() {
    if (!this._visible) return null;

    return html`
      <div class="banner" role="banner">
        <div class="banner__marker" aria-hidden="true"></div>
        <span class="banner__text">${msg("You're browsing as a guest.")}</span>
        <a
          class="banner__cta"
          href="/register"
          @click=${this._navigate}
        >${msg('Sign Up')}</a>
        <button
          class="banner__dismiss"
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
    'velg-guest-banner': VelgGuestBanner;
  }
}
