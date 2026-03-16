import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import { icons } from '../../utils/icons.js';
import {
  terminalAnimations,
  terminalFormStyles,
  terminalOAuthStyles,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

import '../shared/VelgSidePanel.js';

/**
 * Slide-in login panel using VelgSidePanel.
 * Dispatches `login-panel-close` when dismissed (backdrop, Escape, or successful login).
 * Dispatches `navigate` to /register when the register link is clicked.
 */
@localized()
@customElement('velg-login-panel')
export class VelgLoginPanel extends LitElement {
  static styles = [
    terminalTokens,
    terminalAnimations,
    terminalFormStyles,
    terminalOAuthStyles,
    css`
      /* Override shared side-panel tokens for dark theme */
      velg-side-panel {
        --color-surface-raised: var(--hud-surface);
        --color-surface-header: var(--hud-bg);
        --color-text-primary: var(--hud-text);
        --color-text-inverse: var(--hud-bg);
        --color-primary: var(--amber);
        --border-default: 1px solid var(--hud-border);
        --border-medium: 1px solid var(--hud-border);
        --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.6);
      }

      @media (prefers-reduced-motion: reduce) {
        .panel-cursor { animation: none !important; }
      }

      /* ── Briefing below panel header ── */
      .panel-briefing {
        padding: 16px 24px;
        border-bottom: 1px dashed var(--hud-border);
        background: var(--hud-surface);
      }

      .panel-briefing__classification {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 4px;
        text-transform: uppercase;
        color: var(--amber);
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .panel-cursor {
        display: inline-block;
        width: 6px;
        height: 12px;
        background: var(--amber);
        animation: cursor-blink 1s step-end infinite;
      }

      .panel-briefing__text {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 11px;
        line-height: 1.7;
        color: var(--hud-text-dim);
        margin: 0;
      }

      /* ── Form layout overrides ── */
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 24px;
      }

      .login-form .form-group {
        margin-bottom: 0;
      }
      .login-form .form-group:nth-child(1) { animation-delay: 100ms; }
      .login-form .form-group:nth-child(2) { animation-delay: 170ms; }

      .login-form .msg--error {
        margin-bottom: 0;
      }

      /* ── Footer ── */
      .login-footer {
        padding: 16px 24px;
        text-align: center;
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 11px;
        color: var(--hud-text-dim);
      }

      .login-footer a {
        color: var(--amber);
        text-decoration: none;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
      }

      .login-footer a:hover {
        text-decoration: underline;
      }

      .login-footer a:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    `,
  ];

  @state() private _email = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? '') : '';
  @state() private _password = import.meta.env.DEV ? (import.meta.env.VITE_DEV_PASSWORD ?? '') : '';
  @state() private _error: string | null = null;
  @state() private _loading = false;

  private async _handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this._error = null;
    this._loading = true;

    try {
      const { error } = await authService.signIn(this._email, this._password);
      if (error) {
        this._error = msg('Invalid email or password.');
      } else {
        this._close();
        // Reload the current page to re-fetch data as authenticated user
        window.location.reload();
      }
    } catch {
      this._error = msg('An unexpected error occurred. Please try again.');
    } finally {
      this._loading = false;
    }
  }

  private _handleEmailInput(e: Event): void {
    this._email = (e.target as HTMLInputElement).value;
  }

  private _handlePasswordInput(e: Event): void {
    this._password = (e.target as HTMLInputElement).value;
  }

  private async _handleGoogleLogin(): Promise<void> {
    try {
      await authService.signInWithGoogle();
    } catch {
      this._error = msg('Failed to initiate Google sign-in.');
    }
  }

  private async _handleDiscordLogin(): Promise<void> {
    try {
      await authService.signInWithDiscord();
    } catch {
      this._error = msg('Failed to initiate Discord sign-in.');
    }
  }

  private _handleRegisterClick(e: Event): void {
    e.preventDefault();
    this._close();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/register', bubbles: true, composed: true }),
    );
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('login-panel-close', { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <velg-side-panel
        .title=${msg('Authentication Terminal')}
        ?open=${true}
        @panel-close=${this._close}
      >
        <div slot="content">
          <div class="panel-briefing">
            <p class="panel-briefing__classification">
              ${msg('Classified // Operative Access')}<span class="panel-cursor"></span>
            </p>
            <p class="panel-briefing__text">
              ${msg('Present your credentials. The Bureau requires identity verification before granting terminal access.')}
            </p>
          </div>

          <form class="login-form" @submit=${this._handleSubmit}>
            ${this._error ? html`<div class="msg--error">${this._error}</div>` : null}

            <div class="form-group">
              <label class="form-label" for="login-email">${msg('Operative Identifier')}</label>
              <input
                class="form-input"
                id="login-email"
                type="email"
                placeholder="operative@example.com"
                .value=${this._email}
                @input=${this._handleEmailInput}
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">${msg('Access Code')}</label>
              <input
                class="form-input"
                id="login-password"
                type="password"
                placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                .value=${this._password}
                @input=${this._handlePasswordInput}
                required
                autocomplete="current-password"
              />
            </div>

            <button
              class="btn-submit"
              type="submit"
              ?disabled=${this._loading}
            >
              ${this._loading ? msg('Verifying...') : msg('Authenticate')}
            </button>
          </form>

          <div class="oauth-section">
            <div class="oauth-divider">
              <div class="oauth-divider__line"></div>
              <span class="oauth-divider__text">${msg('or')}</span>
              <div class="oauth-divider__line"></div>
            </div>
            <button
              class="oauth-btn oauth-btn--google"
              @click=${this._handleGoogleLogin}
              aria-label=${msg('Sign in with Google')}
            >
              ${icons.googleOAuth(18)}
              ${msg('Sign in with Google')}
            </button>
            <button
              class="oauth-btn oauth-btn--discord"
              @click=${this._handleDiscordLogin}
              aria-label=${msg('Sign in with Discord')}
            >
              ${icons.discordOAuth(18)}
              ${msg('Sign in with Discord')}
            </button>
          </div>

          <div class="login-footer">
            ${msg('No clearance?')}
            <a @click=${this._handleRegisterClick}>${msg('Request Access')}</a>
          </div>
        </div>
      </velg-side-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-login-panel': VelgLoginPanel;
  }
}
