import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

@localized()
@customElement('velg-login-view')
export class VelgLoginView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }

    .login-container {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
    }

    .login-header {
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-default);
    }

    .login-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .login-body {
      padding: var(--space-6);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      margin-bottom: var(--space-4);
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
      margin-bottom: var(--space-4);
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
      border-top: var(--border-light);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .login-footer a {
      color: var(--color-text-link);
      text-decoration: underline;
      font-weight: var(--font-bold);
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
        this._error = error.message;
      } else {
        window.history.pushState({}, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
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
    window.history.pushState({}, '', '/register');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  protected render() {
    return html`
      <div class="login-container">
        <div class="login-header">
          <h1 class="login-title">${msg('Sign In')}</h1>
        </div>

        <div class="login-body">
          ${this._error ? html`<div class="error-message">${this._error}</div>` : null}

          <form @submit=${this._handleSubmit}>
            <div class="form-group">
              <label class="form-label" for="email">${msg('Email')}</label>
              <input
                class="form-input"
                id="email"
                type="email"
                .value=${this._email}
                @input=${this._handleEmailInput}
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="password">${msg('Password')}</label>
              <input
                class="form-input"
                id="password"
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
              ${this._loading ? msg('Signing In...') : msg('Sign In')}
            </button>
          </form>
        </div>

        <div class="login-footer">
          ${msg('No account yet?')}
          <a href="/register" @click=${this._handleRegisterClick}>${msg('Register')}</a>
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
