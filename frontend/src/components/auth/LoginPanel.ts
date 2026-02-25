import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

import '../shared/VelgSidePanel.js';

/**
 * Slide-in login panel using VelgSidePanel.
 * Dispatches `login-panel-close` when dismissed (backdrop, Escape, or successful login).
 * Dispatches `navigate` to /register when the register link is clicked.
 */
@localized()
@customElement('velg-login-panel')
export class VelgLoginPanel extends LitElement {
  static styles = css`
    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-6);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .form-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .form-input {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2-5) var(--space-3);
      border: var(--border-default);
      border-radius: var(--border-radius);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      width: 100%;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      margin-top: var(--space-2);
    }

    .btn-primary:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn-primary:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .error-message {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger-border);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
    }

    .login-footer {
      padding: var(--space-4) var(--space-6);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .login-footer a {
      color: var(--color-text-link);
      text-decoration: underline;
      font-weight: var(--font-bold);
      cursor: pointer;
    }

    .login-footer a:hover {
      color: var(--color-info-hover);
    }
  `;

  @state() private _email = '';
  @state() private _password = '';
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
        .title=${msg('Sign In')}
        ?open=${true}
        @panel-close=${this._close}
      >
        <div slot="content">
          <form class="login-form" @submit=${this._handleSubmit}>
            ${this._error ? html`<div class="error-message">${this._error}</div>` : null}

            <div class="form-group">
              <label class="form-label" for="login-email">${msg('Email')}</label>
              <input
                class="form-input"
                id="login-email"
                type="email"
                .value=${this._email}
                @input=${this._handleEmailInput}
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">${msg('Password')}</label>
              <input
                class="form-input"
                id="login-password"
                type="password"
                .value=${this._password}
                @input=${this._handlePasswordInput}
                required
                autocomplete="current-password"
              />
            </div>

            <button
              class="btn-primary"
              type="submit"
              ?disabled=${this._loading}
            >
              ${this._loading ? msg('Signing in...') : msg('Sign In')}
            </button>
          </form>

          <div class="login-footer">
            ${msg("Don't have an account?")}
            <a @click=${this._handleRegisterClick}>${msg('Register')}</a>
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
