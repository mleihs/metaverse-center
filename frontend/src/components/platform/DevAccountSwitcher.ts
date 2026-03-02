/**
 * Dev Account Switcher.
 *
 * Compact header dropdown for switching between 5 test accounts
 * to verify the competitive layer from different player perspectives.
 *
 * In production: a password gate (sessionStorage-backed) protects access.
 * In dev: the dropdown renders immediately with no gate.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { supabase } from '../../services/supabase/client.js';

interface DevAccount {
  label: string;
  email: string;
}

const DEV_ACCOUNTS: DevAccount[] = [
  { label: 'Admin', email: 'admin@velgarien.dev' },
  { label: 'Voss (Vel)', email: 'player-velgarien@velgarien.dev' },
  { label: 'Whiskers (Cap)', email: 'player-capybara@velgarien.dev' },
  { label: 'Vasquez (SN)', email: 'player-station-null@velgarien.dev' },
  { label: 'Rosa (Spe)', email: 'player-speranza@velgarien.dev' },
];

const DEV_PASSWORD = 'velgarien-dev-2026';
const GATE_PASSWORD = 'met123';
const GATE_STORAGE_KEY = 'dev-switcher-unlocked';

@customElement('velg-dev-account-switcher')
export class VelgDevAccountSwitcher extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      position: relative;
    }

    .tag {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 2px 5px;
      color: #111;
      background: #f59e0b;
      line-height: 1;
      user-select: none;
    }

    .tag--btn {
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .tag--btn:hover {
      opacity: 0.8;
    }

    select {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: 2px var(--space-2);
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-900);
      color: var(--color-gray-300);
      cursor: pointer;
      transition: border-color 0.2s ease;
      max-width: 150px;
    }

    select:hover {
      border-color: #f59e0b;
    }

    select:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 6px rgba(245 158 11 / 0.3);
    }

    :host(.switching) {
      opacity: 0.5;
      pointer-events: none;
    }

    /* Password gate popup */
    .gate-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay);
    }

    .gate {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: var(--z-modal);
      background: #1a1a1a;
      border: 1px solid #333;
      padding: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0 0 0 / 0.5);
    }

    .gate__input {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: 3px 6px;
      width: 80px;
      border: 1px solid #444;
      background: #111;
      color: #ccc;
      outline: none;
    }

    .gate__input:focus {
      border-color: #f59e0b;
    }

    .gate__input--error {
      border-color: #ef4444;
    }

    .gate__btn {
      font-family: var(--font-brutalist);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border: 1px solid #f59e0b;
      background: transparent;
      color: #f59e0b;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .gate__btn:hover {
      background: rgba(245 158 11 / 0.15);
    }

    .gate__error {
      position: absolute;
      top: 100%;
      left: 10px;
      margin-top: 4px;
      font-size: 9px;
      color: #ef4444;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      :host {
        display: none;
      }
    }
  `;

  @state() private _switching = false;
  @state() private _unlocked = sessionStorage.getItem(GATE_STORAGE_KEY) === 'true';
  @state() private _gateOpen = false;
  @state() private _gateError = '';

  @query('.gate__input') private _gateInput!: HTMLInputElement;

  private _boundDismiss = this._dismissGate.bind(this);

  private _getCurrentEmail(): string {
    return appState.user.value?.email ?? '';
  }

  private async _handleChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const email = select.value;
    if (!email || email === this._getCurrentEmail()) return;

    this._switching = true;
    this.classList.add('switching');

    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });

    if (error) {
      console.error('[DevSwitcher] Sign-in failed:', error.message);
      this._switching = false;
      this.classList.remove('switching');
      return;
    }

    window.location.reload();
  }

  private _openGate() {
    this._gateOpen = true;
    this._gateError = '';
    requestAnimationFrame(() => this._gateInput?.focus());
  }

  private _dismissGate(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this._gateOpen = false;
      this._gateError = '';
    }
  }

  private _handleGateSubmit() {
    const value = this._gateInput?.value ?? '';
    if (value === GATE_PASSWORD) {
      this._unlocked = true;
      this._gateOpen = false;
      this._gateError = '';
      sessionStorage.setItem(GATE_STORAGE_KEY, 'true');
    } else {
      this._gateError = 'Wrong code';
      if (this._gateInput) {
        this._gateInput.value = '';
        this._gateInput.focus();
      }
    }
  }

  private _handleGateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this._handleGateSubmit();
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._boundDismiss);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._boundDismiss);
  }

  private _renderDropdown() {
    const currentEmail = this._getCurrentEmail();
    return html`
      <span class="tag">DEV</span>
      <select @change=${this._handleChange} .value=${currentEmail} ?disabled=${this._switching}>
        ${DEV_ACCOUNTS.map(
          (a) => html`
            <option value=${a.email} ?selected=${a.email === currentEmail}>
              ${a.label}
            </option>
          `,
        )}
      </select>
    `;
  }

  private _renderGate() {
    return html`
      <span class="tag tag--btn" @click=${this._openGate}>DEV</span>
      ${
        this._gateOpen
          ? html`
            <div class="gate-backdrop" @click=${() => {
              this._gateOpen = false;
              this._gateError = '';
            }}></div>
            <div class="gate">
              <input
                class="gate__input ${this._gateError ? 'gate__input--error' : ''}"
                type="password"
                placeholder="Code"
                @keydown=${this._handleGateKeydown}
              />
              <button class="gate__btn" @click=${this._handleGateSubmit}>OK</button>
              ${this._gateError ? html`<span class="gate__error">${this._gateError}</span>` : nothing}
            </div>
          `
          : nothing
      }
    `;
  }

  protected render() {
    if (import.meta.env.PROD && !this._unlocked) {
      return this._renderGate();
    }
    return this._renderDropdown();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dev-account-switcher': VelgDevAccountSwitcher;
  }
}
