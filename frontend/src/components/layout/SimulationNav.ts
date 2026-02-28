import { localized, msg } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { icons } from '../../utils/icons.js';

interface NavTab {
  label: string;
  path: string;
  icon: () => TemplateResult;
  requireAdmin?: boolean;
}

function getTabs(): NavTab[] {
  return [
    { label: msg('Lore'), path: 'lore', icon: () => icons.book(14) },
    { label: msg('Health'), path: 'health', icon: () => icons.heartbeat(14) },
    { label: msg('Agents'), path: 'agents', icon: () => icons.users(14) },
    { label: msg('Buildings'), path: 'buildings', icon: () => icons.building(14) },
    { label: msg('Events'), path: 'events', icon: () => icons.bolt(14) },
    { label: msg('Chat'), path: 'chat', icon: () => icons.messageCircle(14) },
    { label: msg('Social'), path: 'social', icon: () => icons.megaphone(14) },
    { label: msg('Locations'), path: 'locations', icon: () => icons.mapPin(14) },
    { label: msg('Settings'), path: 'settings', icon: () => icons.gear(14), requireAdmin: true },
  ];
}

@localized()
@customElement('velg-simulation-nav')
export class VelgSimulationNav extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface);
      border-bottom: var(--border-default);
    }

    .instance-badge {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-6);
      background: var(--color-epoch-influence, #a78bfa);
      color: #fff;
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .nav {
      display: flex;
      align-items: stretch;
      gap: 0;
      padding: 0 var(--space-6);
      overflow-x: auto;
    }

    /* Hide scrollbar but keep scrollability */
    .nav::-webkit-scrollbar {
      display: none;
    }
    .nav {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .nav__tab {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      overflow: hidden;
      transition:
        color 0.25s ease,
        letter-spacing 0.3s ease,
        text-shadow 0.3s ease,
        transform 0.25s ease;

      /* Staggered entrance */
      opacity: 0;
      transform: translateY(6px);
      animation: nav-enter 0.35s ease forwards;
    }

    /* --- Icon --- */

    .nav__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
    }

    .nav__icon svg {
      display: block;
    }

    /* --- Flowing diagonal gradient (::before) — appears on sustained hover --- */

    .nav__tab::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-primary) 12%, transparent),
        color-mix(in srgb, var(--color-text-secondary) 8%, transparent),
        color-mix(in srgb, var(--color-primary) 15%, transparent),
        color-mix(in srgb, var(--color-text-secondary) 8%, transparent),
        color-mix(in srgb, var(--color-primary) 12%, transparent)
      );
      background-size: 300% 300%;
      opacity: 0;
      transition: opacity 0.4s ease 0.3s;
      pointer-events: none;
      z-index: 0;
    }

    .nav__tab:hover::before {
      opacity: 1;
      animation: nav-gradient-flow 3s linear infinite;
    }

    .nav__tab .nav__icon,
    .nav__tab .nav__label {
      position: relative;
      z-index: 1;
    }

    /* --- Underline bar (::after) --- */

    .nav__tab::after {
      content: '';
      position: absolute;
      bottom: -3px;
      left: 50%;
      width: 0;
      height: 3px;
      background: var(--color-primary);
      transition: width 0.15s ease, left 0.15s ease;
      z-index: 1;
    }

    .nav__tab:hover::after {
      left: 0;
      width: 100%;
    }

    /* --- Hover state — hard/sharp, gradient fills on dwell --- */

    .nav__tab:hover {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    .nav__tab:hover .nav__icon {
      transform: translateY(-4px) rotate(-12deg) scale(1.3);
    }

    /* --- Active state --- */

    .nav__tab--active {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    .nav__tab--active::after {
      left: 0;
      width: 100%;
      background: var(--color-primary);
    }

    .nav__tab--active .nav__icon {
      animation: nav-icon-float 2.5s ease-in-out infinite;
    }

    /* Active + hover = extra kick */
    .nav__tab--active:hover {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .nav__tab--active:hover .nav__icon {
      animation: none;
      transform: translateY(-4px) rotate(-12deg) scale(1.3);
    }

    /* --- Keyframes --- */

    @keyframes nav-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Diagonal gradient flow — same pattern as embassy cards */
    @keyframes nav-gradient-flow {
      0% { background-position: 0% 0%; }
      100% { background-position: 100% 100%; }
    }

    /* Active icon float: gentle bob + rotate */
    @keyframes nav-icon-float {
      0%, 100% {
        transform: translateY(0) rotate(0deg) scale(1);
      }
      25% {
        transform: translateY(-2px) rotate(-3deg) scale(1.05);
      }
      75% {
        transform: translateY(1px) rotate(2deg) scale(0.98);
      }
    }

    /* === Mobile: hamburger menu === */

    .mobile-bar {
      display: none;
    }

    .mobile-menu {
      display: none;
    }

    @media (max-width: 640px) {
      .nav {
        display: none;
      }

      .mobile-bar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
      }

      .mobile-bar__hamburger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        background: transparent;
        border: var(--border-default);
        cursor: pointer;
        color: var(--color-text-primary);
        transition: all var(--transition-fast);
        flex-shrink: 0;
        padding: 0;
      }

      .mobile-bar__hamburger:hover {
        background: var(--color-surface-raised);
      }

      .mobile-bar__current {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-primary);
      }

      .mobile-menu {
        display: none;
        flex-direction: column;
        border-top: var(--border-default);
        background: var(--color-surface);
      }

      .mobile-menu--open {
        display: flex;
      }

      .mobile-menu__item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        text-decoration: none;
        border: none;
        border-left: 3px solid transparent;
        background: transparent;
        cursor: pointer;
        transition: color var(--transition-fast), background var(--transition-fast);
        min-height: 44px;
      }

      .mobile-menu__item:hover {
        background: var(--color-surface-raised);
        color: var(--color-primary);
      }

      .mobile-menu__item--active {
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
        border-left-color: var(--color-primary);
      }

      .mobile-menu__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @state() private _activeTab = 'lore';
  @state() private _menuOpen = false;

  private _boundClickOutside: ((e: MouseEvent) => void) | null = null;
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._detectActiveTab();
    this._boundClickOutside = this._handleClickOutside.bind(this);
    this._boundKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('click', this._boundClickOutside);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._boundClickOutside) {
      document.removeEventListener('click', this._boundClickOutside);
    }
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
  }

  private _detectActiveTab(): void {
    const path = window.location.pathname;
    const tab = getTabs().find((t) => path.includes(`/${t.path}`));
    if (tab) {
      this._activeTab = tab.path;
    }
  }

  private get _slug(): string {
    return appState.currentSimulation.value?.slug ?? this.simulationId;
  }

  private _handleTabClick(e: Event, tab: NavTab): void {
    e.preventDefault();
    this._activeTab = tab.path;
    this._menuOpen = false;
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: `/simulations/${this._slug}/${tab.path}`,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleMenu(e: Event): void {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _handleClickOutside(e: MouseEvent): void {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._menuOpen) {
      this._menuOpen = false;
    }
  }

  private get _visibleTabs(): NavTab[] {
    return getTabs().filter((tab) => {
      if (tab.requireAdmin && !appState.canAdmin.value) return false;
      return true;
    });
  }

  private get _activeLabel(): string {
    const tab = this._visibleTabs.find((t) => t.path === this._activeTab);
    return tab?.label ?? '';
  }

  private get _isGameInstance(): boolean {
    return appState.currentSimulation.value?.simulation_type === 'game_instance';
  }

  protected render() {
    const tabs = this._visibleTabs;

    return html`
      ${
        this._isGameInstance
          ? html`<div class="instance-badge">${icons.bolt(12)} ${msg('Game Instance')}</div>`
          : ''
      }
      <!-- Desktop: horizontal tabs -->
      <nav class="nav">
        ${tabs.map(
          (tab, i) => html`
            <a
              href="/simulations/${this._slug}/${tab.path}"
              class="nav__tab ${this._activeTab === tab.path ? 'nav__tab--active' : ''}"
              style="animation-delay: ${i * 0.04}s"
              @click=${(e: Event) => this._handleTabClick(e, tab)}
            >
              <span class="nav__icon">${tab.icon()}</span>
              <span class="nav__label">${tab.label}</span>
            </a>
          `,
        )}
      </nav>

      <!-- Mobile: hamburger bar + dropdown -->
      <div class="mobile-bar">
        <button
          class="mobile-bar__hamburger"
          @click=${this._toggleMenu}
          aria-label=${msg('Navigation menu')}
          aria-expanded=${this._menuOpen}
        >
          ${this._menuOpen ? icons.close(18) : icons.menu(20)}
        </button>
        <span class="mobile-bar__current">${this._activeLabel}</span>
      </div>
      <div class="mobile-menu ${this._menuOpen ? 'mobile-menu--open' : ''}">
        ${tabs.map(
          (tab) => html`
            <a
              class="mobile-menu__item ${this._activeTab === tab.path ? 'mobile-menu__item--active' : ''}"
              href="/simulations/${this._slug}/${tab.path}"
              @click=${(e: Event) => this._handleTabClick(e, tab)}
            >
              <span class="mobile-menu__icon">${tab.icon()}</span>
              ${tab.label}
            </a>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-nav': VelgSimulationNav;
  }
}
