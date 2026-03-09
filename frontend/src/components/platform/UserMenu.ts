import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

@localized()
@customElement('velg-user-menu')
export class VelgUserMenu extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid #333;
      color: #ccc;
      background: transparent;
      cursor: pointer;
      transition: background var(--transition-fast),
                  border-color var(--transition-fast);
    }

    .user-btn:hover {
      background: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.3);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      min-width: 180px;
      background: var(--color-gray-900, #111827);
      border: 1px solid var(--color-gray-700, #374151);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
      z-index: var(--z-dropdown, 300);
      display: none;
    }

    .dropdown--open {
      display: block;
    }

    .dropdown__item {
      display: block;
      width: 100%;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      text-align: left;
      background: transparent;
      border: none;
      color: #ccc;
      cursor: pointer;
      transition: background var(--transition-fast),
                  color var(--transition-fast);
    }

    .dropdown__item:hover {
      background: rgba(245, 158, 11, 0.08);
      color: #f59e0b;
    }

    .dropdown__divider {
      border-top: 1px solid #222;
      margin: var(--space-1) 0;
    }
  `;

  @state() private _open = false;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._handleOutsideClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleOutsideClick);
  }

  private _handleOutsideClick = (e: Event): void => {
    if (!e.composedPath().includes(this)) {
      this._open = false;
    }
  };

  private _toggleMenu(): void {
    this._open = !this._open;
  }

  private async _handleSignOut(): Promise<void> {
    this._open = false;
    await authService.signOut();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/login', bubbles: true, composed: true }),
    );
  }

  protected render() {
    const user = appState.user.value;
    const email = user?.email || msg('User');

    return html`
      <button class="user-btn" @click=${this._toggleMenu}>
        ${email}
      </button>

      <div class="dropdown ${this._open ? 'dropdown--open' : ''}">
        <button class="dropdown__item" @click=${this._handleSignOut}>
          ${msg('Sign Out')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-user-menu': VelgUserMenu;
  }
}
