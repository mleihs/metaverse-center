import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';

@localized()
@customElement('velg-cookie-consent')
export class VelgCookieConsent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: var(--z-overlay);
      background: var(--color-gray-900);
      border-top: 2px solid var(--color-gray-700);
      padding: var(--space-4) var(--space-6);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .banner__text {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: rgba(255, 255, 255, 0.8);
    }

    .banner__actions {
      display: flex;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1-5) var(--space-4);
      border: var(--border-default);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn--accept {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .btn--accept:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }

    .btn--decline {
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
    }

    .btn--decline:hover {
      color: #fff;
    }

    .banner__link {
      color: rgba(255, 255, 255, 0.6);
      text-decoration: underline;
      font-size: var(--text-xs);
      transition: color var(--transition-fast);
    }

    .banner__link:hover {
      color: #fff;
    }
  `;

  @state() private _visible = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._visible = !analyticsService.hasConsentChoice();
  }

  private _handleAccept(): void {
    analyticsService.grantConsent();
    this._visible = false;
  }

  private _handleDecline(): void {
    analyticsService.revokeConsent();
    this._visible = false;
  }

  protected render() {
    if (!this._visible) return nothing;

    return html`
      <div class="banner">
        <span class="banner__text">
          ${msg('We use analytics to improve this site.')}
          <a class="banner__link" href="https://metaverse.center/privacy" target="_blank" rel="noopener">${msg('Privacy Policy')}</a>
        </span>
        <div class="banner__actions">
          <button class="btn btn--accept" @click=${this._handleAccept}>
            ${msg('Accept Analytics')}
          </button>
          <button class="btn btn--decline" @click=${this._handleDecline}>
            ${msg('Decline')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-cookie-consent': VelgCookieConsent;
  }
}
