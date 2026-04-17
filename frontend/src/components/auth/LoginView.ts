import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { captureError } from '../../services/SentryService.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import {
  terminalAnimations,
  terminalFormStyles,
  terminalFrameStyles,
  terminalOAuthStyles,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-login-view')
export class VelgLoginView extends LitElement {
  static styles = [
    terminalTokens,
    terminalAnimations,
    terminalFormStyles,
    terminalOAuthStyles,
    terminalFrameStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - var(--header-height, 56px));
        padding: var(--space-4);
        background: var(--hud-bg);
      }

      /* ── Header ── */
      .header {
        padding: 20px 28px;
        border-bottom: 1px dashed var(--hud-border);
      }

      .header__classification {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 4px;
        text-transform: uppercase;
        color: var(--amber);
        margin: 0 0 8px;
      }

      .header__title {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: var(--text-xl, 1.563rem);
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--hud-text);
        margin: 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .header__cursor {
        display: inline-block;
        width: 8px;
        height: 18px;
        background: var(--amber);
        animation: cursor-blink 1s step-end infinite;
        vertical-align: middle;
        margin-left: 2px;
      }

      .header__ref {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 10px;
        color: var(--hud-text-dim);
        margin: 6px 0 0;
        letter-spacing: 1px;
      }

      /* ── Lore Briefing ── */
      .briefing {
        padding: 20px 28px;
        border-bottom: 1px dashed var(--hud-border);
      }

      .briefing__text {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 12px;
        line-height: 1.7;
        color: var(--hud-text-dim);
        margin: 0;
      }

      /* ── Body / Form ── */
      .body {
        padding: 24px 28px;
      }

      /* ── Footer ── */
      .footer {
        padding: 16px 28px;
        border-top: 1px dashed var(--hud-border);
        text-align: center;
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 11px;
        color: var(--hud-text-dim);
      }

      .footer a {
        color: var(--amber);
        text-decoration: none;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
      }

      .footer a:hover {
        text-decoration: underline;
      }

      .footer a:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }

      @media (max-width: 640px) {
        :host {
          padding: var(--space-3);
        }

        .header {
          padding: 16px 20px;
        }

        .header__title {
          font-size: var(--text-lg, 1.25rem);
        }

        .briefing {
          padding: 16px 20px;
        }

        .body {
          padding: 20px;
        }

        .footer {
          padding: 14px 20px;
        }
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
        this._error = error.message;
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      captureError(err, { source: 'LoginView._handleSubmit' });
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
    } catch (err) {
      captureError(err, { source: 'LoginView._handleGoogleLogin' });
      this._error = msg('Failed to initiate Google sign-in.');
    }
  }

  private async _handleDiscordLogin(): Promise<void> {
    try {
      await authService.signInWithDiscord();
    } catch (err) {
      captureError(err, { source: 'LoginView._handleDiscordLogin' });
      this._error = msg('Failed to initiate Discord sign-in.');
    }
  }

  private _handleRegisterClick(e: Event): void {
    e.preventDefault();
    navigate('/register');
  }

  protected render() {
    return html`
      <div class="terminal">
        <div class="terminal__scanlines"></div>
        <div class="terminal__bottom-corners"></div>

        <div class="header">
          <p class="header__classification">${msg('Classified // Operative Access')}</p>
          <h1 class="header__title">
            ${msg('Authentication Terminal')}<span class="header__cursor"></span>
          </h1>
          <p class="header__ref">${msg('Bureau of Multiverse Observation')}</p>
        </div>

        <div class="briefing">
          <p class="briefing__text">
            ${msg('Present your credentials. The Bureau requires identity verification before granting terminal access.')}
          </p>
        </div>

        <div class="body">
          ${this._error ? html`<div class="msg--error">${this._error}</div>` : null}

          <form @submit=${this._handleSubmit}>
            <div class="form-group">
              <label class="form-label" for="email">${msg('Operative Identifier')}</label>
              <input
                class="form-input"
                id="email"
                type="email"
                placeholder="operative@example.com"
                .value=${this._email}
                @input=${this._handleEmailInput}
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="password">${msg('Access Code')}</label>
              <input
                class="form-input"
                id="password"
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
        </div>

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

        <div class="footer">
          ${msg('No clearance?')}
          <a href="/register" @click=${this._handleRegisterClick}>${msg('Request Access')}</a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-login-view': VelgLoginView;
  }
}
