import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';

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
      border: var(--border-default);
      background: transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .user-btn:hover {
      background: var(--color-surface-sunken);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      min-width: 180px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
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
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .dropdown__item:hover {
      background: var(--color-surface-sunken);
    }

    .dropdown__divider {
      border-top: var(--border-default);
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
    if (!this.contains(e.target as Node)) {
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
    const email = user?.email || 'User';

    return html`
      <button class="user-btn" @click=${this._toggleMenu}>
        ${email}
      </button>

      <div class="dropdown ${this._open ? 'dropdown--open' : ''}">
        <button class="dropdown__item" @click=${this._handleSignOut}>
          Sign Out
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
