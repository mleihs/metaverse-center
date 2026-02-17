import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

@localized()
@customElement('velg-register-view')
export class VelgRegisterView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }

    .register-container {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
    }

    .register-header {
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-default);
    }

    .register-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .register-body {
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

    .success-message {
      padding: var(--space-3);
      margin-bottom: var(--space-4);
      background: var(--color-success-bg);
      border: var(--border-width-default) solid var(--color-success-border);
      color: var(--color-success);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
    }

    .register-footer {
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-light);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .register-footer a {
      color: var(--color-text-link);
      text-decoration: underline;
      font-weight: var(--font-bold);
    }

    .register-footer a:hover {
      color: var(--color-info-hover);
    }
  `;

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

  private _handleLoginClick(e: Event): void {
    e.preventDefault();
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  protected render() {
    return html`
      <div class="register-container">
        <div class="register-header">
          <h1 class="register-title">${msg('Register')}</h1>
        </div>

        <div class="register-body">
          ${this._error ? html`<div class="error-message">${this._error}</div>` : null}

          ${this._success ? html`<div class="success-message">${this._success}</div>` : null}

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
                minlength="8"
                autocomplete="new-password"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="confirm-password">${msg('Confirm Password')}</label>
              <input
                class="form-input"
                id="confirm-password"
                type="password"
                .value=${this._confirmPassword}
                @input=${this._handleConfirmPasswordInput}
                required
                minlength="8"
                autocomplete="new-password"
              />
            </div>

            <button
              class="btn-primary"
              type="submit"
              ?disabled=${this._loading}
            >
              ${this._loading ? msg('Registering...') : msg('Register')}
            </button>
          </form>
        </div>

        <div class="register-footer">
          ${msg('Already have an account?')}
          <a href="/login" @click=${this._handleLoginClick}>${msg('Sign In')}</a>
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
