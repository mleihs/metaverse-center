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
    :host {
      --amber: #f59e0b;
      --amber-dim: #b45309;
      --amber-glow: rgba(245, 158, 11, 0.15);
      --hud-bg: #0a0a0a;
      --hud-surface: #111;
      --hud-border: #333;
      --hud-text: #ccc;
      --hud-text-dim: #888;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @keyframes field-reveal {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .form-group { animation: none !important; }
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

    /* ── Form ── */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 24px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: field-reveal 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }
    .form-group:nth-child(1) { animation-delay: 100ms; }
    .form-group:nth-child(2) { animation-delay: 170ms; }

    .form-label {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--hud-text-dim);
    }

    .form-input {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm, 0.8rem);
      padding: 10px 14px;
      border: 1px solid var(--hud-border);
      border-radius: 0;
      background: var(--hud-bg);
      color: var(--hud-text);
      transition: border-color 150ms, box-shadow 150ms;
      width: 100%;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--amber);
      box-shadow: 0 0 0 1px var(--amber-glow), inset 0 0 12px var(--amber-glow);
    }

    .form-input::placeholder {
      color: #555;
    }

    /* ── CTA Button ── */
    .btn-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 14px 24px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 3px;
      background: var(--amber);
      color: var(--hud-bg);
      border: 1px solid var(--amber-dim);
      border-radius: 0;
      cursor: pointer;
      transition: all 150ms;
      margin-top: 4px;
    }

    .btn-submit:hover {
      background: #fbbf24;
      box-shadow: 0 0 20px var(--amber-glow);
    }

    .btn-submit:active {
      transform: scale(0.98);
    }

    .btn-submit:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* ── Error Message ── */
    .msg--error {
      padding: 12px 14px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-left: 3px solid #ef4444;
      color: #fca5a5;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
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
  `;

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
