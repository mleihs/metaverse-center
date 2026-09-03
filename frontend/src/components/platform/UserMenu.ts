import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import '../shared/VelgEditionSwitch.js';
import { navigate } from '../../utils/navigation.js';

@localized()
@customElement('velg-user-menu')
export class VelgUserMenu extends SignalWatcher(LitElement) {
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
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-wide);
      border: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      background: transparent;
      cursor: pointer;
      transition: background var(--transition-fast),
                  border-color var(--transition-fast);
    }

    .user-btn:hover {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      min-width: 180px;
      background: var(--color-surface);
      border: 1px solid var(--color-surface-raised);
      box-shadow: var(--shadow-lg);
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
      color: var(--color-text-tertiary);
      cursor: pointer;
      transition: background var(--transition-fast),
                  color var(--transition-fast);
    }

    .dropdown__item:hover,
    .dropdown__item:focus-visible {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      color: var(--color-primary);
      outline: none;
    }

    .dropdown__divider {
      border-top: 1px solid var(--color-separator);
      margin: var(--space-1) 0;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @state() private _open = false;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._handleOutsideClick);
    document.addEventListener('keydown', this._handleEscape);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleOutsideClick);
    document.removeEventListener('keydown', this._handleEscape);
  }

  private _handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._open) {
      this._open = false;
    }
  };

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
    navigate('/login');
  }

  private _handleProfile(): void {
    this._open = false;
    navigate('/profile');
  }

  protected render() {
    const user = appState.user.value;
    // The display name if one is set, the address otherwise. Until 30.08.2026
    // this only ever read the address - the field existed on the profile page,
    // but its Save button called a route that was never written, so no account
    // had a display name to show.
    const label =
      (user?.user_metadata?.display_name as string | undefined)?.trim() ||
      user?.email ||
      msg('User');

    return html`
      <button
        class="user-btn"
        aria-haspopup="menu"
        aria-expanded=${this._open}
        @click=${this._toggleMenu}
      >
        ${label}
      </button>

      <div class="dropdown ${this._open ? 'dropdown--open' : ''}" role="menu">
        <button class="dropdown__item" role="menuitem" @click=${this._handleProfile}>
          ${msg('Personnel File')}
        </button>
        <div class="dropdown__divider"></div>
        <velg-edition-switch context="menu"></velg-edition-switch>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item" role="menuitem" @click=${this._handleSignOut}>
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
