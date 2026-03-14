/**
 * Epoch Invite Accept View — split-screen military terminal for epoch invitation tokens.
 *
 * Route: /epoch/join?token=...
 *
 * Left panel: classified lore/intel briefing
 * Right panel: authentication terminal (login/register) or direct access if already authed
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import type { EpochInvitationPublicInfo } from '../../types/index.js';

type AuthMode = 'login' | 'register';

@localized()
@customElement('velg-epoch-invite-accept-view')
export class VelgEpochInviteAcceptView extends LitElement {
  static styles = css`
    :host {
      --amber: var(--color-warning);
      --amber-light: var(--color-warning-border);
      --amber-glow: color-mix(in srgb, var(--color-warning) 15%, transparent);
      --hud-bg: var(--color-gray-950);
      --hud-surface: var(--color-gray-900);
      --hud-border: var(--color-gray-800);
      --hud-border-dim: var(--color-gray-700);
      --hud-text: var(--color-gray-200);
      --hud-text-dim: var(--color-gray-400);
      --hud-text-muted: var(--color-gray-400);
      display: block;
      min-height: 100vh;
      background: var(--hud-bg);
      color: var(--hud-text);
      font-family: var(--font-brutalist, 'Courier New', Courier, monospace);
    }

    /* ── Split Layout ── */
    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 100vh;
    }

    @media (max-width: 768px) {
      .split {
        grid-template-columns: 1fr;
      }
    }

    /* ── Left: Intel Briefing ── */
    .intel {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: clamp(32px, 6vw, 80px);
      border-right: 1px solid var(--hud-surface);
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .intel {
        border-right: none;
        border-bottom: 1px solid var(--hud-surface);
        padding: 40px 24px;
      }
    }

    /* Scan-line overlay */
    .intel::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--amber) 1.2%, transparent) 3px,
        color-mix(in srgb, var(--amber) 1.2%, transparent) 6px
      );
      z-index: 1;
    }

    .intel > * {
      position: relative;
      z-index: 2;
    }

    .intel__classification {
      margin: 0 0 40px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--hud-text-dim);
      animation: flicker-in 0.6s ease-out;
    }

    .intel__classification span {
      color: var(--amber);
    }

    @keyframes flicker-in {
      0%, 20% { opacity: 0; }
      25% { opacity: 0.8; }
      30% { opacity: 0.2; }
      50% { opacity: 1; }
    }

    .intel__epoch-name {
      margin: 0 0 32px;
      font-size: clamp(28px, 4vw, 44px);
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--amber);
      line-height: 1.1;
      animation: slide-up 0.5s ease-out 0.2s both;
    }

    @keyframes slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .intel__dossier {
      border: 1px dashed var(--hud-border-dim);
      padding: 20px 24px;
      background: var(--color-gray-950);
      animation: slide-up 0.5s ease-out 0.35s both;
    }

    .intel__dossier-label {
      margin: 0 0 12px;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--hud-text-dim);
    }

    .intel__dossier-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.8;
      color: var(--hud-text-muted);
      font-style: italic;
    }

    .intel__status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 24px;
      padding: 4px 12px;
      border: 1px solid var(--hud-border-dim);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--hud-text-dim);
      animation: slide-up 0.5s ease-out 0.5s both;
    }

    .intel__status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--amber);
      box-shadow: 0 0 6px var(--amber);
    }

    /* ── Right: Auth Terminal ── */
    .terminal {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: clamp(32px, 6vw, 80px);
      position: relative;
    }

    .terminal__header {
      margin: 0 0 32px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--hud-text-dim);
    }

    /* ── Auth Tabs ── */
    .auth-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 28px;
      border-bottom: 1px solid var(--hud-border);
    }

    .auth-tab {
      flex: 1;
      padding: 10px 0;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--hud-text-dim);
      font-family: inherit;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s;
    }

    .auth-tab:hover {
      color: var(--hud-text-muted);
    }

    .auth-tab--active {
      color: var(--amber);
      border-bottom-color: var(--amber);
    }

    /* ── Form ── */
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field__label {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--hud-text-dim);
    }

    .field__input {
      padding: 10px 14px;
      background: var(--hud-surface);
      border: 1px solid var(--hud-border);
      color: var(--hud-text);
      font-family: inherit;
      font-size: 13px;
      letter-spacing: 0.5px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .field__input:focus {
      border-color: var(--amber);
      box-shadow: 0 0 0 1px var(--amber-glow);
    }

    .field__input::placeholder {
      color: var(--hud-border-dim);
    }

    .auth-btn {
      margin-top: 8px;
      padding: 12px 24px;
      background: var(--amber);
      color: var(--hud-bg);
      border: none;
      font-family: inherit;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
    }

    .auth-btn:hover:not(:disabled) {
      background: var(--amber-light);
      box-shadow: 0 0 20px color-mix(in srgb, var(--amber) 20%, transparent);
    }

    .auth-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .auth-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .auth-error {
      padding: 8px 12px;
      border: 1px solid var(--color-danger-hover);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
      color: var(--color-danger);
      font-size: 11px;
      letter-spacing: 0.5px;
    }

    /* ── Access Granted State ── */
    .access-granted {
      text-align: center;
      animation: granted-flash 0.6s ease-out;
    }

    @keyframes granted-flash {
      0% { opacity: 0; transform: scale(0.95); }
      40% { opacity: 1; transform: scale(1.02); }
      100% { transform: scale(1); }
    }

    .access-granted__label {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--color-success);
    }

    .access-granted__msg {
      margin: 0 0 28px;
      font-size: 10px;
      letter-spacing: 1px;
      color: var(--hud-text-dim);
    }

    .enter-btn {
      display: inline-block;
      padding: 14px 32px;
      background: var(--amber);
      color: var(--hud-bg);
      border: 2px solid var(--amber);
      font-family: inherit;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s;
    }

    .enter-btn:hover {
      background: var(--amber-light);
      box-shadow: 0 0 24px color-mix(in srgb, var(--amber) 25%, transparent);
    }

    /* ── Loading / Error / Expired states ── */
    .state-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 40px;
    }

    .state-card {
      max-width: 480px;
      width: 100%;
      padding: 40px;
      border: 1px solid var(--hud-border);
      text-align: center;
    }

    .state-card__title {
      margin: 0 0 16px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    .state-card__title--error {
      color: var(--color-danger);
    }

    .state-card__title--expired {
      color: var(--amber);
    }

    .state-card__title--loading {
      color: var(--hud-text-dim);
    }

    .state-card__text {
      margin: 0;
      font-size: 12px;
      line-height: 1.7;
      color: var(--hud-text-dim);
    }

    .state-card__link {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 24px;
      border: 1px solid var(--hud-border-dim);
      color: var(--hud-text-muted);
      font-family: inherit;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .state-card__link:hover {
      border-color: var(--amber);
      color: var(--amber);
    }

    /* Loading pulse */
    @keyframes pulse-dim {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    .state-card__title--loading {
      animation: pulse-dim 1.5s ease-in-out infinite;
    }
  `;

  @property() token = '';

  @state() private _invitation: EpochInvitationPublicInfo | null = null;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _authMode: AuthMode = 'login';
  @state() private _email = '';
  @state() private _password = '';
  @state() private _confirmPassword = '';
  @state() private _authLoading = false;
  @state() private _authError: string | null = null;
  @state() private _authenticated = false;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Extract token from query params if not set via property
    if (!this.token) {
      const params = new URLSearchParams(window.location.search);
      this.token = params.get('token') ?? '';
    }

    if (this.token) {
      await this._loadInvitation();
    } else {
      this._error = 'No invitation token provided.';
      this._loading = false;
    }

    // Check if already authenticated
    if (appState.isAuthenticated.value) {
      this._authenticated = true;
    }
  }

  private async _loadInvitation(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await epochsApi.validateEpochInvitation(this.token);
      if (response.success && response.data) {
        this._invitation = response.data as EpochInvitationPublicInfo;
      } else {
        this._error = msg('Invalid or expired invitation token.');
      }
    } catch {
      this._error = msg('Failed to load invitation.');
    } finally {
      this._loading = false;
    }
  }

  private async _handleAuth(): Promise<void> {
    if (this._authLoading) return;
    this._authError = null;

    if (this._authMode === 'register' && this._password !== this._confirmPassword) {
      this._authError = msg('Passwords do not match.');
      return;
    }

    if (!this._email.trim() || !this._password) {
      this._authError = msg('Please fill in all fields.');
      return;
    }

    this._authLoading = true;

    try {
      const result =
        this._authMode === 'login'
          ? await authService.signIn(this._email.trim(), this._password)
          : await authService.signUp(this._email.trim(), this._password);

      if (result.error) {
        this._authError = result.error.message;
      } else {
        this._authenticated = true;
      }
    } catch {
      this._authError = msg('Authentication failed. Please try again.');
    } finally {
      this._authLoading = false;
    }
  }

  private _handleEnter(): void {
    document.dispatchEvent(
      new CustomEvent('epoch-joined', { bubbles: true }),
    );
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: '/epoch',
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this._handleAuth();
  }

  private _handleBackClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: '/epoch',
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    if (this._loading) {
      return html`
        <div class="state-screen">
          <div class="state-card">
            <h1 class="state-card__title state-card__title--loading">
              ${msg('Decrypting transmission...')}
            </h1>
          </div>
        </div>
      `;
    }

    if (this._error && !this._invitation) {
      return html`
        <div class="state-screen">
          <div class="state-card">
            <h1 class="state-card__title state-card__title--error">
              ${msg('Transmission Error')}
            </h1>
            <p class="state-card__text">${this._error}</p>
            <a class="state-card__link" href="/epoch" @click=${this._handleBackClick}>
              ${msg('Return to Command Center')}
            </a>
          </div>
        </div>
      `;
    }

    const inv = this._invitation;
    if (!inv) return nothing;

    if (inv.is_expired) {
      return html`
        <div class="state-screen">
          <div class="state-card">
            <h1 class="state-card__title state-card__title--expired">
              ${msg('Summons Expired')}
            </h1>
            <p class="state-card__text">
              ${msg('This epoch invitation has expired. Request a new summons from the epoch creator.')}
            </p>
            <a class="state-card__link" href="/epoch" @click=${this._handleBackClick}>
              ${msg('Return to Command Center')}
            </a>
          </div>
        </div>
      `;
    }

    if (inv.is_accepted) {
      return html`
        <div class="state-screen">
          <div class="state-card">
            <h1 class="state-card__title" style="color: var(--color-success);">
              ${msg('Summons Already Accepted')}
            </h1>
            <p class="state-card__text">
              ${msg('This invitation has already been used.')}
            </p>
            <a class="state-card__link" href="/epoch" @click=${this._handleBackClick}>
              ${msg('Enter Command Center')}
            </a>
          </div>
        </div>
      `;
    }

    return html`
      <div class="split">
        ${this._renderIntel(inv)}
        ${this._renderTerminal()}
      </div>
    `;
  }

  private _renderIntel(inv: EpochInvitationPublicInfo) {
    return html`
      <div class="intel">
        <p class="intel__classification">
          <span>${msg('CLASSIFIED')}</span> // ${msg('EPOCH SUMMONS')}
        </p>

        <h1 class="intel__epoch-name">${inv.epoch_name}</h1>

        ${
          inv.lore_text
            ? html`
              <div class="intel__dossier">
                <p class="intel__dossier-label">${msg('Intel Dispatch')}</p>
                <p class="intel__dossier-text">${inv.lore_text}</p>
              </div>
            `
            : inv.epoch_description
              ? html`
                <div class="intel__dossier">
                  <p class="intel__dossier-label">${msg('Briefing')}</p>
                  <p class="intel__dossier-text">${inv.epoch_description}</p>
                </div>
              `
              : nothing
        }

        <div class="intel__status">
          <span class="intel__status-dot"></span>
          ${inv.epoch_status}
        </div>
      </div>
    `;
  }

  private _renderTerminal() {
    if (this._authenticated) {
      return html`
        <div class="terminal">
          <div class="access-granted">
            <span class="access-granted__label">${msg('Access Granted')}</span>
            <p class="access-granted__msg">
              ${msg('Authentication verified. Proceed to the command center.')}
            </p>
            <button class="enter-btn" @click=${this._handleEnter}>
              ${msg('Enter the Command Center')}
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="terminal">
        <p class="terminal__header">${msg('Authentication Required')}</p>

        <div class="auth-tabs">
          <button
            class="auth-tab ${this._authMode === 'login' ? 'auth-tab--active' : ''}"
            @click=${() => {
              this._authMode = 'login';
              this._authError = null;
            }}
          >
            ${msg('Log In')}
          </button>
          <button
            class="auth-tab ${this._authMode === 'register' ? 'auth-tab--active' : ''}"
            @click=${() => {
              this._authMode = 'register';
              this._authError = null;
            }}
          >
            ${msg('Create Account')}
          </button>
        </div>

        <div class="auth-form">
          ${this._authError ? html`<div class="auth-error">${this._authError}</div>` : nothing}

          <div class="field">
            <label class="field__label">${msg('Email')}</label>
            <input
              class="field__input"
              type="email"
              placeholder="operative@example.com"
              .value=${this._email}
              @input=${(e: InputEvent) => {
                this._email = (e.target as HTMLInputElement).value;
              }}
              @keydown=${this._handleKeydown}
            />
          </div>

          <div class="field">
            <label class="field__label">${msg('Password')}</label>
            <input
              class="field__input"
              type="password"
              placeholder="••••••••"
              .value=${this._password}
              @input=${(e: InputEvent) => {
                this._password = (e.target as HTMLInputElement).value;
              }}
              @keydown=${this._handleKeydown}
            />
          </div>

          ${
            this._authMode === 'register'
              ? html`
                <div class="field">
                  <label class="field__label">${msg('Confirm Password')}</label>
                  <input
                    class="field__input"
                    type="password"
                    placeholder="••••••••"
                    .value=${this._confirmPassword}
                    @input=${(e: InputEvent) => {
                      this._confirmPassword = (e.target as HTMLInputElement).value;
                    }}
                    @keydown=${this._handleKeydown}
                  />
                </div>
              `
              : nothing
          }

          <button
            class="auth-btn"
            @click=${this._handleAuth}
            ?disabled=${this._authLoading}
          >
            ${this._authLoading ? msg('Authenticating...') : msg('Authenticate')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-invite-accept-view': VelgEpochInviteAcceptView;
  }
}
