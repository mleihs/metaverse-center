/**
 * Dev Account Switcher — local development only.
 *
 * Compact header dropdown for switching between 5 test accounts
 * to verify the competitive layer from different player perspectives.
 * Vite tree-shakes the dynamic import in production builds.
 */

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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

@customElement('velg-dev-account-switcher')
export class VelgDevAccountSwitcher extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
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

    @media (max-width: 640px) {
      :host {
        display: none;
      }
    }
  `;

  @state() private _switching = false;

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

  protected render() {
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
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dev-account-switcher': VelgDevAccountSwitcher;
  }
}
