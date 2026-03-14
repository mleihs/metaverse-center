import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import { icons } from '../../utils/icons.js';
import {
  terminalAnimations,
  terminalFormStyles,
  terminalFrameStyles,
  terminalOAuthStyles,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-register-view')
export class VelgRegisterView extends LitElement {
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

      /* 3rd form-group animation delay (confirm password field) */
      .form-group:nth-child(3) { animation-delay: 290ms; }

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
    `,
  ];

  @state() private _email = '';
  @state() private _password = '';
  @state() private _confirmPassword = '';
  @state() private _error: string | null = null;
  @state() private _success: string | null = null;
  @state() private _loading = false;

  private async _handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this._error = null;
    this._success = null;

    if (this._password !== this._confirmPassword) {
      this._error = msg('Passwords do not match.');
      return;
    }

    if (this._password.length < 8) {
      this._error = msg('Password must be at least 8 characters.');
      return;
    }

    this._loading = true;

    try {
      const { error } = await authService.signUp(this._email, this._password);
      if (error) {
        this._error = error.message;
      } else {
        analyticsService.trackEvent('sign_up', { method: 'email' });
        this._success = msg(
          'Registration successful. Please check your email to confirm your account.',
        );
        this._email = '';
        this._password = '';
        this._confirmPassword = '';
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

  private _handleConfirmPasswordInput(e: Event): void {
    this._confirmPassword = (e.target as HTMLInputElement).value;
  }

  private async _handleGoogleLogin(): Promise<void> {
    try {
      await authService.signInWithGoogle();
    } catch {
      this._error = msg('Failed to initiate Google sign-up.');
    }
  }

  private async _handleDiscordLogin(): Promise<void> {
    try {
      await authService.signInWithDiscord();
    } catch {
      this._error = msg('Failed to initiate Discord sign-up.');
    }
  }

  private _handleLoginClick(e: Event): void {
    e.preventDefault();
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  protected render() {
    return html`
      <div class="terminal">
        <div class="terminal__scanlines"></div>
        <div class="terminal__bottom-corners"></div>

        <div class="header">
          <p class="header__classification">${msg('Classified // New Operative Intake')}</p>
          <h1 class="header__title">
            ${msg('Registration Terminal')}<span class="header__cursor"></span>
          </h1>
          <p class="header__ref">${msg('Bureau of Multiverse Observation')}</p>
        </div>

        <div class="briefing">
          <p class="briefing__text">
            ${msg('Your signal has been detected across the fracture. Five sealed worlds await your observation. Complete this intake form to request Bureau clearance.')}
          </p>
        </div>

        <div class="body">
          ${this._error ? html`<div class="msg--error">${this._error}</div>` : null}
          ${this._success ? html`<div class="msg--success">${this._success}</div>` : null}

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
                minlength="8"
                autocomplete="new-password"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="confirm-password">${msg('Confirm Access Code')}</label>
              <input
                class="form-input"
                id="confirm-password"
                type="password"
                placeholder="&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;"
                .value=${this._confirmPassword}
                @input=${this._handleConfirmPasswordInput}
                required
                minlength="8"
                autocomplete="new-password"
              />
            </div>

            <button
              class="btn-submit"
              type="submit"
              ?disabled=${this._loading}
            >
              ${this._loading ? msg('Processing Intake...') : msg('Request Clearance')}
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
            aria-label=${msg('Sign up with Google')}
          >
            ${icons.googleOAuth(18)}
            ${msg('Sign up with Google')}
          </button>

          <button
            class="oauth-btn oauth-btn--discord"
            @click=${this._handleDiscordLogin}
            aria-label=${msg('Sign up with Discord')}
          >
            ${icons.discordOAuth(18)}
            ${msg('Sign up with Discord')}
          </button>
        </div>

        <div class="footer">
          ${msg('Already cleared?')}
          <a href="/login" @click=${this._handleLoginClick}>${msg('Authenticate')}</a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-register-view': VelgRegisterView;
  }
}
