import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

@localized()
@customElement('velg-register-view')
export class VelgRegisterView extends LitElement {
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
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      padding: var(--space-4);
    }

    /* ── Entrance ── */
    @keyframes terminal-boot {
      0% {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
        filter: brightness(1.5);
      }
      40% { opacity: 1; filter: brightness(1.2); }
      100% { transform: translateY(0) scale(1); filter: brightness(1); }
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
      .terminal, .form-group { animation: none !important; }
      .header__cursor { animation: none !important; }
    }

    /* ── Terminal Frame ── */
    .terminal {
      width: 100%;
      max-width: 460px;
      background: var(--hud-surface);
      border: 1px dashed var(--hud-border);
      position: relative;
      animation: terminal-boot 600ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    /* Corner brackets */
    .terminal::before,
    .terminal::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: var(--amber);
      border-style: solid;
      pointer-events: none;
    }
    .terminal::before {
      top: -1px; left: -1px;
      border-width: 2px 0 0 2px;
    }
    .terminal::after {
      top: -1px; right: -1px;
      border-width: 2px 2px 0 0;
    }

    .terminal__bottom-corners {
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 0;
      pointer-events: none;
    }
    .terminal__bottom-corners::before,
    .terminal__bottom-corners::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: var(--amber);
      border-style: solid;
    }
    .terminal__bottom-corners::before {
      bottom: 0; left: -1px;
      border-width: 0 0 2px 2px;
    }
    .terminal__bottom-corners::after {
      bottom: 0; right: -1px;
      border-width: 0 2px 2px 0;
    }

    /* Scanline overlay */
    .terminal__scanlines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(245, 158, 11, 0.012) 3px,
        rgba(245, 158, 11, 0.012) 6px
      );
      z-index: 1;
    }

    .terminal > *:not(.terminal__scanlines):not(.terminal__bottom-corners) {
      position: relative;
      z-index: 2;
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

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 20px;
      animation: field-reveal 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }
    .form-group:nth-child(1) { animation-delay: 150ms; }
    .form-group:nth-child(2) { animation-delay: 220ms; }
    .form-group:nth-child(3) { animation-delay: 290ms; }

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

    /* ── Status Messages ── */
    .msg--error {
      padding: 12px 14px;
      margin-bottom: 20px;
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

    .msg--success {
      padding: 12px 14px;
      margin-bottom: 20px;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-left: 3px solid #22c55e;
      color: #86efac;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
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
      <div class="terminal">
        <div class="terminal__scanlines"></div>
        <div class="terminal__bottom-corners"></div>

        <div class="header">
          <p class="header__classification">${msg('Classified // New Operative Intake')}</p>
          <h1 class="header__title">
            ${msg('Registration Terminal')}<span class="header__cursor"></span>
          </h1>
          <p class="header__ref">BUREAU OF MULTIVERSE OBSERVATION</p>
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
