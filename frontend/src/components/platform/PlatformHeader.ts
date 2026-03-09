import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { localeService } from '../../services/i18n/locale-service.js';
import type { Simulation } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

import './UserMenu.js';

@localized()
@customElement('velg-platform-header')
export class VelgPlatformHeader extends LitElement {
  static styles = css`
    :host {
      --hdr-bg: #0a0a0a;
      --hdr-surface: #111;
      --hdr-border: #333;
      --hdr-text: #ccc;
      --hdr-text-dim: #888;
      --hdr-text-muted: #555;
      --hdr-amber: #f59e0b;
      --hdr-amber-dim: #b45309;
      --hdr-amber-glow: rgba(245, 158, 11, 0.15);
      --hdr-amber-ghost: rgba(245, 158, 11, 0.06);
      --hdr-danger: #ef4444;

      display: block;
      position: relative;
      height: var(--header-height);
      background: var(--hdr-bg);
      overflow: visible;
    }

    /* Scanline overlay */
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(245, 158, 11, 0.008) 0px,
        rgba(245, 158, 11, 0.008) 3px,
        transparent 3px,
        transparent 6px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* Amber signal trace bottom border */
    :host::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--hdr-amber-dim) 15%,
        var(--hdr-amber) 35%,
        var(--hdr-amber-dim) 50%,
        var(--hdr-amber) 65%,
        var(--hdr-amber-dim) 85%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: header-border-flow 4s linear infinite;
      z-index: 1;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 0 var(--space-6);
      min-width: 0;
      position: relative;
      z-index: 2;
    }

    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-8);
      min-width: 0;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--hdr-amber);
      cursor: pointer;
      text-decoration: none;
    }

    .header__cursor {
      display: inline-block;
      width: 0.5em;
      height: 1.1em;
      background: var(--hdr-amber);
      vertical-align: text-bottom;
      margin-left: 2px;
      animation: cursor-blink 1s step-end infinite;
    }

    /* --- Favicon mark (mobile only) --- */

    .header__mark {
      display: none;
      align-items: center;
      justify-content: center;
      width: 51px;
      height: 51px;
      flex-shrink: 0;
      margin: 0;
      color: var(--hdr-amber);
      border: none;
      cursor: pointer;
      text-decoration: none;
    }

    .header__mark svg {
      width: 45px;
      height: 45px;
    }

    /* --- Hamburger button (mobile only) --- */

    .header__menu-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      background: none;
      border: 1px solid transparent;
      color: var(--hdr-text);
      cursor: pointer;
      padding: 0;
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .header__menu-btn:hover {
      color: var(--hdr-amber);
      border-color: rgba(245, 158, 11, 0.3);
    }

    /* --- Mobile menu panel --- */

    .header__backdrop {
      position: fixed;
      top: var(--header-height);
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: var(--z-dropdown);
      animation: backdrop-fade 0.2s ease forwards;
    }

    @keyframes backdrop-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .header__menu-panel {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #0d0d0d;
      border-bottom: 2px solid var(--hdr-amber);
      z-index: calc(var(--z-dropdown) + 1);
      padding: var(--space-4) var(--space-4) var(--space-5);
      animation: menu-slide-down 0.25s var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)) forwards;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    /* Corner brackets */
    .header__menu-panel::before,
    .header__menu-panel::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: var(--hdr-amber);
      border-style: solid;
      pointer-events: none;
      opacity: 0.5;
    }

    .header__menu-panel::before {
      top: var(--space-2);
      left: var(--space-2);
      border-width: 2px 0 0 2px;
    }

    .header__menu-panel::after {
      bottom: var(--space-2);
      right: var(--space-2);
      border-width: 0 2px 2px 0;
    }

    @keyframes menu-slide-down {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .header__menu-brand {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--hdr-amber);
      padding: 0 var(--space-2) var(--space-3);
      margin-bottom: var(--space-2);
      border-bottom: 1px dashed rgba(245, 158, 11, 0.2);
    }

    .header__menu-item {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 44px;
      padding: var(--space-2) var(--space-5) var(--space-2) var(--space-7);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      text-decoration: none;
      color: var(--hdr-text);
      cursor: pointer;
      border: 1px solid var(--hdr-border);
      background: transparent;
      margin-bottom: var(--space-2);
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  background 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  box-shadow 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
      animation: menu-item-enter 0.3s var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
    }

    /* Beacon dot on menu items */
    .header__menu-item::before {
      content: '';
      position: absolute;
      left: var(--space-3);
      top: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--hdr-amber);
      transform: translateY(-50%);
      box-shadow: 0 0 4px var(--hdr-amber);
      animation: beacon-pulse 2s ease-in-out infinite;
    }

    .header__menu-item:hover {
      color: var(--hdr-amber);
      border-color: var(--hdr-amber);
      background: var(--hdr-amber-ghost);
      box-shadow: 0 0 12px var(--hdr-amber-glow);
    }

    .header__menu-item--admin {
      color: var(--hdr-danger);
    }

    .header__menu-item--admin::before {
      background: var(--hdr-danger);
      box-shadow: 0 0 4px var(--hdr-danger);
    }

    .header__menu-item--admin:hover {
      color: var(--hdr-danger);
      border-color: var(--hdr-danger);
      background: rgba(239, 68, 68, 0.08);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);
    }

    .header__menu-item--active {
      background: var(--hdr-amber);
      color: var(--hdr-bg);
      border-color: var(--hdr-amber);
    }

    .header__menu-item--active::before {
      background: var(--hdr-bg);
      box-shadow: none;
    }

    @keyframes menu-item-enter {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .header__menu-divider {
      height: 1px;
      background: #222;
      margin: var(--space-2) 0 var(--space-3);
    }

    .header__menu-sim {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2);
      animation: menu-item-enter 0.3s var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
    }

    .header__menu-sim .sim-selector__label {
      display: block;
    }

    .header__menu-sim .sim-selector__select {
      flex: 1;
    }

    .header__menu-github {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      color: var(--hdr-text-muted);
      text-decoration: none;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
      animation: menu-item-enter 0.3s var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
    }

    .header__menu-github:hover {
      color: var(--hdr-text);
    }

    /* --- Nav links — terminal button style --- */

    .header__nav-link {
      position: relative;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      text-decoration: none;
      cursor: pointer;
      padding: var(--space-2) var(--space-5) var(--space-2) var(--space-7);
      color: var(--hdr-text);
      border: 1px solid var(--hdr-border);
      background: transparent;
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  background 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  box-shadow 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    /* Beacon dot */
    .header__nav-link::before {
      content: '';
      position: absolute;
      left: var(--space-3);
      top: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--hdr-amber);
      transform: translateY(-50%);
      box-shadow: 0 0 4px var(--hdr-amber);
      animation: beacon-pulse 2s ease-in-out infinite;
    }

    /* Hover: amber glow */
    .header__nav-link:hover {
      border-color: var(--hdr-amber);
      color: var(--hdr-amber);
      background: rgba(245, 158, 11, 0.08);
      box-shadow: 0 0 12px var(--hdr-amber-glow);
    }

    .header__nav-link:hover::before {
      box-shadow: 0 0 6px var(--hdr-amber), 0 0 12px rgba(245, 158, 11, 0.4);
      animation: beacon-pulse-fast 0.8s ease-in-out infinite;
    }

    .header__nav-link:active {
      box-shadow: none;
    }

    /* --- Admin link accent --- */

    .header__nav-link--admin {
      color: var(--hdr-danger);
    }

    .header__nav-link--admin::before {
      background: var(--hdr-danger);
      box-shadow: 0 0 4px var(--hdr-danger);
    }

    .header__nav-link--admin:hover {
      border-color: var(--hdr-danger);
      color: var(--hdr-danger);
      background: rgba(239, 68, 68, 0.08);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);
    }

    .header__nav-link--admin:hover::before {
      box-shadow: 0 0 6px var(--hdr-danger), 0 0 12px rgba(239, 68, 68, 0.4);
    }

    /* --- Active state (current page) --- */

    .header__nav-link--active {
      background: var(--hdr-amber);
      color: var(--hdr-bg);
      border-color: var(--hdr-amber);
    }

    .header__nav-link--active::before {
      background: var(--hdr-bg);
      box-shadow: none;
    }

    .header__nav-link--active:hover {
      background: #fbbf24;
      color: var(--hdr-bg);
      border-color: #fbbf24;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
    }

    /* --- Simulation selector --- */

    .sim-selector {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sim-selector__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--hdr-text-dim);
    }

    .sim-selector__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--hdr-border);
      background: var(--hdr-surface);
      color: var(--hdr-text);
      cursor: pointer;
      transition: border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  box-shadow 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .sim-selector__select:hover {
      border-color: var(--hdr-amber);
    }

    .sim-selector__select:focus {
      outline: none;
      border-color: var(--hdr-amber);
      box-shadow: 0 0 8px var(--hdr-amber-glow);
    }

    /* --- Mock mode badge --- */

    .header__mock-badge {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-2);
      background: rgba(245, 158, 11, 0.1);
      color: var(--hdr-amber);
      border: 1px solid var(--hdr-amber);
      border-radius: var(--border-radius);
      cursor: default;
    }

    /* --- Right side --- */

    .header__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    /* --- GitHub link --- */

    .header__github {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      color: var(--hdr-text-muted);
      border: 1px solid transparent;
      background: transparent;
      cursor: pointer;
      text-decoration: none;
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .header__github:hover {
      color: var(--hdr-text);
      border-color: var(--hdr-border);
    }

    .locale-toggle {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--hdr-border);
      background: var(--hdr-surface);
      color: var(--hdr-text);
      cursor: pointer;
      transition: color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  border-color 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .locale-toggle:hover {
      color: var(--hdr-amber);
      border-color: var(--hdr-amber);
    }

    .btn-sign-in {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-1-5) var(--space-4);
      background: var(--hdr-amber);
      color: var(--hdr-bg);
      border: 1px solid var(--hdr-amber);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: background 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1)),
                  box-shadow 200ms var(--ease-dramatic, cubic-bezier(0.23, 1, 0.32, 1));
    }

    .btn-sign-in:hover {
      background: #fbbf24;
      box-shadow: 0 0 16px var(--hdr-amber-glow);
    }

    .btn-sign-in:active {
      box-shadow: none;
    }

    /* --- Keyframes --- */

    @keyframes beacon-pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 4px var(--hdr-amber);
      }
      50% {
        opacity: 0.4;
        box-shadow: 0 0 8px var(--hdr-amber), 0 0 16px rgba(245, 158, 11, 0.4);
      }
    }

    @keyframes beacon-pulse-fast {
      0%, 100% {
        opacity: 1;
        transform: translateY(-50%) scale(1);
        box-shadow: 0 0 6px var(--hdr-amber);
      }
      50% {
        opacity: 0.6;
        transform: translateY(-50%) scale(1.5);
        box-shadow: 0 0 10px var(--hdr-amber), 0 0 20px rgba(245, 158, 11, 0.5);
      }
    }

    @keyframes header-border-flow {
      0% { background-position: 0% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* === Reduced motion === */

    @media (prefers-reduced-motion: reduce) {
      :host::before,
      :host::after,
      .header__nav-link::before,
      .header__menu-item::before,
      .header__cursor {
        animation: none !important;
      }
      .header__nav-link,
      .header__menu-item,
      .header__menu-btn,
      .locale-toggle,
      .header__github,
      .btn-sign-in,
      .sim-selector__select {
        transition: none !important;
      }
    }

    /* === Mobile: favicon mark + hamburger menu === */

    @media (max-width: 640px) {
      :host {
        height: auto;
        padding: 5px 0;
      }

      .header {
        padding: 0 var(--space-3);
        height: auto;
      }

      .header__left {
        gap: var(--space-2);
      }

      /* Show mobile-only elements */
      .header__mark { display: flex; }
      .header__menu-btn { display: flex; }

      /* Hide desktop-only elements */
      .header__title { display: none; }
      .header__nav-link { display: none; }
      .sim-selector { display: none; }
      .header__github { display: none; }

      .header__right {
        gap: var(--space-2);
      }
    }
  `;

  @state() private _simulations: Simulation[] = [];
  @state() private _menuOpen = false;

  private _handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._menuOpen) {
      this._closeMenu();
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    this._simulations = appState.simulations.value;
    import('./DevAccountSwitcher.js');
    document.addEventListener('keydown', this._handleKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._handleKeyDown);
    super.disconnectedCallback();
  }

  private _toggleMenu(): void {
    this._menuOpen = !this._menuOpen;
  }

  private _closeMenu(): void {
    this._menuOpen = false;
  }

  private _handleTitleClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/dashboard', bubbles: true, composed: true }),
    );
  }

  private _preMapPath: string | null = null;

  private _handleMapClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    if (window.location.pathname === '/multiverse') {
      const target = this._preMapPath ?? '/dashboard';
      this._preMapPath = null;
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: target, bubbles: true, composed: true }),
      );
    } else {
      this._preMapPath = window.location.pathname;
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: '/multiverse', bubbles: true, composed: true }),
      );
    }
  }

  private _handleEpochClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/epoch', bubbles: true, composed: true }),
    );
  }

  private _handleGuideClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/how-to-play', bubbles: true, composed: true }),
    );
  }

  private _handleArchivesClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/archives', bubbles: true, composed: true }),
    );
  }

  private _handleAdminClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/admin', bubbles: true, composed: true }),
    );
  }

  private _handleSignInClick(): void {
    this.dispatchEvent(new CustomEvent('login-panel-open', { bubbles: true, composed: true }));
  }

  private async _toggleLocale(): Promise<void> {
    const next = localeService.currentLocale === 'en' ? 'de' : 'en';
    await localeService.setLocale(next);
  }

  private _handleSimulationChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const simId = select.value;
    const sim = this._simulations.find((s) => s.id === simId) || null;
    appState.setCurrentSimulation(sim);
    this._closeMenu();
    if (sim) {
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: `/simulations/${sim.slug}/agents`,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _renderMenuPanel() {
    if (!this._menuOpen) return nothing;

    const path = window.location.pathname;
    const isAdmin = appState.isPlatformAdmin.value;
    const currentSim = appState.currentSimulation.value;
    let navIdx = 0;

    return html`
      <div class="header__backdrop" @click=${this._closeMenu}></div>
      <nav class="header__menu-panel" role="navigation" aria-label=${msg('Main navigation')}>
        <div class="header__menu-brand">${msg('metaverse.center')}</div>

        <a href="/multiverse"
          class="header__menu-item ${path === '/multiverse' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${this._handleMapClick}>${msg('Map')}</a>

        <a href="/epoch"
          class="header__menu-item ${path === '/epoch' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${this._handleEpochClick}>${msg('Epoch')}</a>

        <a href="/how-to-play"
          class="header__menu-item ${path === '/how-to-play' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${this._handleGuideClick}>${msg('Guide')}</a>

        <a href="/archives"
          class="header__menu-item ${path === '/archives' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${this._handleArchivesClick}>${msg('Archives')}</a>

        ${
          isAdmin
            ? html`
          <a href="/admin"
            class="header__menu-item header__menu-item--admin ${path === '/admin' ? 'header__menu-item--active' : ''}"
            style="--i:${navIdx++}"
            @click=${this._handleAdminClick}>${msg('Admin')}</a>
        `
            : nothing
        }

        <div class="header__menu-divider"></div>

        ${
          this._simulations.length > 0
            ? html`
          <div class="header__menu-sim" style="--i:${navIdx++}">
            <span class="sim-selector__label">${msg('Simulation:')}</span>
            <select class="sim-selector__select" @change=${this._handleSimulationChange}>
              <option value="">${msg('-- Select --')}</option>
              ${this._simulations.map(
                (sim) => html`
                  <option value=${sim.id} ?selected=${currentSim?.id === sim.id}>
                    ${sim.name}
                  </option>
                `,
              )}
            </select>
          </div>
        `
            : nothing
        }

        <a class="header__menu-github"
          href="https://github.com/mleihs/velgarien-rebuild"
          target="_blank"
          rel="noopener noreferrer"
          style="--i:${navIdx}"
        >${icons.github(18)} ${msg('View source on GitHub')}</a>
      </nav>
    `;
  }

  protected render() {
    const currentSim = appState.currentSimulation.value;

    return html`
      <div class="header">
        <div class="header__left">
          <!-- Favicon mark (mobile only) -->
          <a href="/dashboard" class="header__mark" @click=${this._handleTitleClick}>
            <svg viewBox="0 0 360 360" aria-hidden="true">
              <g transform="translate(0,360) scale(0.1,-0.1)" fill="currentColor" stroke="none">
                <path d="M1660 3334 c-398 -48 -704 -189 -959 -445 -625 -624 -588 -1633 81
-2225 364 -323 864 -449 1356 -343 288 63 531 197 748 413 227 227 361 475
430 796 15 67 19 128 19 285 0 221 -15 317 -77 494 -181 521 -642 911 -1188
1005 -93 17 -340 28 -410 20z m134 -209 c25 -36 46 -76 45 -88 -1 -20 -2 -19
-9 4 -4 15 -26 54 -49 88 -23 33 -40 61 -37 61 2 0 25 -29 50 -65z m-137 -62
c-2 -21 -4 -4 -4 37 0 41 2 58 4 38 2 -21 2 -55 0 -75z m659 -60 c14 -74 24
-103 41 -119 30 -28 29 -39 -1 -18 -14 8 -28 30 -32 47 -9 47 -12 48 -45 32
-16 -9 -29 -13 -29 -11 0 3 14 13 31 21 25 14 29 21 25 43 -13 68 -18 102 -13
102 3 0 13 -44 23 -97z m-1085 15 c-11 -35 -17 -45 -19 -31 -3 18 22 83 32 83
1 0 -5 -23 -13 -52z m457 -45 c14 -12 14 -13 -1 -13 -10 0 -38 -19 -63 -42
-43 -40 -46 -45 -40 -81 7 -43 10 -39 -74 -98 -45 -31 -45 -30 9 18 50 46 53
52 47 84 -6 32 -2 39 44 84 32 32 50 58 51 75 1 20 2 21 6 5 3 -11 12 -26 21
-32z m229 -59 l48 -46 -49 38 c-44 35 -55 39 -130 45 l-81 6 82 1 81 2 49 -46z
m-988 -63 c33 -44 61 -87 61 -97 0 -22 62 -135 103 -189 l31 -40 -42 39 c-42
40 -103 143 -108 182 -1 12 -28 58 -59 103 -31 45 -55 81 -52 81 2 0 32 -36
66 -79z m291 66 c0 -7 -7 -22 -15 -33 -13 -17 -14 -16 -4 14 11 33 19 41 19
19z m1335 -167 c6 -25 5 -32 -3 -25 -6 6 -14 37 -16 70 -5 61 -1 51 19 -45z
m-548 -32 c-2 -18 -4 -6 -4 27 0 33 2 48 4 33 2 -15 2 -42 0 -60z m448 72 c3
-6 -1 -7 -9 -4 -18 7 -21 14 -7 14 6 0 13 -4 16 -10z m-1598 -76 c-3 -3 -12
-4 -19 -1 -8 3 -5 6 6 6 11 1 17 -2 13 -5z m1065 -20 c46 -9 85 -18 87 -20 7
-6 -133 -364 -142 -364 -12 0 -247 138 -317 188 -122 85 -35 15 215 -173 138
-103 254 -191 259 -195 5 -5 -29 -27 -75 -51 l-84 -42 -115 6 c-63 4 -150 10
-193 13 l-77 7 -61 101 c-34 56 -83 129 -110 163 l-49 63 67 96 c97 142 115
156 214 183 172 45 251 50 381 25z m244 -70 c129 -63 236 -168 309 -300 l28
-50 -113 -142 c-91 -114 -118 -141 -133 -136 -77 24 -112 51 -224 170 -97 103
-117 130 -115 151 4 35 74 245 102 306 26 57 31 57 146 1z m537 -121 c21 -3
39 -9 42 -13 7 -12 -56 -3 -104 14 -24 9 -46 14 -49 11 -3 -2 -13 -42 -23 -87
l-18 -83 5 75 c9 126 6 122 62 104 26 -8 64 -18 85 -21z m-1437 -235 c103
-145 116 -167 133 -212 9 -22 6 -27 -23 -44 -18 -11 -44 -27 -58 -36 -25 -16
-26 -16 -134 70 l-109 87 80 -82 79 -81 -69 -72 c-39 -40 -77 -77 -85 -83 -22
-15 -120 -36 -132 -29 -16 10 -3 208 17 274 35 113 165 350 193 350 4 0 53
-64 108 -142z m1297 -100 c42 -86 55 -138 63 -256 7 -97 -6 -205 -36 -290 -11
-30 -17 -58 -14 -61 3 -3 29 -11 57 -17 l52 -12 -57 -1 c-33 -1 -58 3 -58 9 0
6 -33 10 -80 10 -94 0 -81 -25 -110 215 l-20 170 23 85 c20 70 34 98 77 153
30 37 57 67 61 67 4 0 23 -33 42 -72z m-1970 55 c-13 -2 -33 -2 -45 0 -13 2
-3 4 22 4 25 0 35 -2 23 -4z m322 -13 c57 -7 55 -7 -35 -8 -52 0 -133 3 -180
7 l-85 8 120 0 c66 1 147 -3 180 -7z m1260 -240 c77 -34 144 -65 148 -69 4 -4
14 -75 22 -157 14 -159 15 -154 -31 -182 -11 -7 -78 -132 -71 -132 2 0 23 29
48 65 24 35 47 61 50 57 4 -4 23 -52 42 -108 l35 -101 -66 -66 c-37 -36 -76
-68 -88 -71 -15 -5 -41 10 -103 58 -45 36 -82 68 -82 73 0 4 19 13 43 20 56
14 34 16 -32 2 -99 -21 -266 42 -482 183 -100 65 -107 72 -102 97 20 86 37
149 55 192 26 67 23 74 -7 17 -13 -27 -29 -48 -34 -48 -5 0 -37 26 -72 58
l-62 59 45 26 c70 40 383 77 426 49 7 -5 21 -65 32 -138 l19 -129 -6 95 c-12
182 -16 169 53 196 33 13 65 21 70 19 6 -2 73 -31 150 -65z m-1499 -42 l19
-21 -27 18 c-29 18 -34 25 -20 25 5 0 17 -10 28 -22z m695 -96 c39 -47 68 -91
65 -98 -8 -22 -109 -144 -118 -144 -7 0 -263 53 -315 65 -19 4 -43 48 -43 80
0 6 31 23 70 36 61 20 80 33 146 101 76 75 77 76 101 61 14 -9 56 -54 94 -101z
m1684 -92 c3 -5 1 -10 -4 -10 -6 0 -11 5 -11 10 0 6 2 10 4 10 3 0 8 -4 11
-10z m-1986 -169 c36 -11 78 -23 94 -26 15 -4 27 -9 27 -11 0 -3 -16 -37 -36
-76 l-36 -71 -19 29 c-11 16 -36 58 -56 94 -20 36 -37 66 -38 67 0 1 -66 -17
-145 -40 l-145 -43 -140 6 c-119 6 -129 7 -65 11 41 2 100 3 130 1 41 -2 91 8
198 40 121 36 142 45 143 63 0 19 1 19 11 -2 7 -15 31 -28 77 -42z m1801 56
c0 -2 -15 -14 -32 -27 l-33 -23 24 26 c21 23 41 35 41 24z m-1285 -173 c30
-19 55 -37 55 -40 0 -4 -35 -4 -77 0 -117 9 -77 -1 102 -24 88 -12 161 -23
163 -25 9 -8 -234 -305 -250 -305 -49 0 -307 129 -308 153 0 5 5 5 11 1 15 -9
4 27 -31 96 -44 87 -45 99 -18 118 12 10 68 38 123 63 l100 46 38 -24 c20 -13
62 -39 92 -59z m1594 82 c-2 -2 -78 -32 -169 -66 -91 -34 -170 -68 -176 -76
-6 -7 -14 -11 -17 -8 -3 3 -45 -21 -94 -54 -54 -37 -111 -67 -148 -78 -33 -9
-66 -19 -72 -21 -7 -3 -13 0 -13 6 0 6 53 37 118 70 64 32 136 70 159 83 l42
24 -30 47 c-16 26 -29 50 -29 54 0 5 14 -14 31 -42 18 -27 32 -51 33 -52 1 -2
81 24 177 56 165 56 198 66 188 57z m-639 -11 c0 -15 -95 -154 -100 -148 -15
16 -42 115 -34 123 15 14 134 37 134 25z m-604 -356 l7 -127 -98 -7 c-53 -4
-124 -4 -156 1 l-60 9 132 143 c127 139 132 143 150 125 14 -14 19 -43 25
-144z m-803 68 c-12 -12 -33 -50 -46 -85 -18 -43 -49 -88 -101 -147 -42 -47
-97 -117 -122 -155 -26 -39 -49 -70 -51 -70 -2 0 -2 3 0 8 53 89 101 160 157
231 39 49 80 116 95 153 17 41 37 70 53 81 34 20 41 13 15 -16z m931 -15 c2
-4 -12 -6 -31 -4 -34 4 -36 3 -29 -19 10 -33 25 -229 24 -314 l-1 -70 -8 85
c-24 253 -30 340 -24 350 6 10 58 -11 69 -28z m-792 -101 c-15 -27 -28 -48
-30 -47 -5 6 41 96 49 96 4 0 -5 -22 -19 -49z m1193 4 c80 -25 85 -25 124 -9
l40 16 183 -96 c101 -52 180 -96 176 -96 -4 0 -87 37 -185 81 -160 73 -181 81
-213 73 -26 -7 -56 -4 -120 14 -53 14 -100 21 -125 18 l-40 -5 30 14 c39 18
35 19 130 -10z m-230 -15 c10 -11 16 -20 13 -20 -3 0 -13 9 -23 20 -10 11 -16
20 -13 20 3 0 13 -9 23 -20z m-525 -142 l24 -33 -29 26 c-55 49 -70 47 -108
-13 -19 -29 -50 -90 -68 -135 -18 -46 -34 -81 -36 -80 -8 9 61 188 87 227 30
45 30 45 10 62 -33 27 -23 28 37 3 37 -15 67 -35 83 -57z m699 -38 c-1 -13 -1
-13 -6 0 -3 8 -19 33 -35 55 l-30 40 36 -40 c20 -22 35 -47 35 -55z m-1134
-290 c36 -93 31 -99 -9 -10 -18 42 -41 89 -51 105 l-18 30 26 -30 c15 -16 38
-59 52 -95z m179 28 c-22 -24 -46 -58 -53 -76 -8 -18 -16 -31 -18 -28 -10 10
31 83 65 116 50 48 54 40 6 -12z m681 -53 c72 -25 118 -45 104 -45 -15 0 -70
16 -123 37 -56 21 -100 32 -105 27 -5 -5 -28 -60 -51 -122 -24 -62 -44 -111
-46 -109 -3 3 86 257 90 257 1 0 60 -20 131 -45z m270 5 c-4 -7 -23 -18 -42
-26 -18 -8 -38 -25 -43 -37 -5 -12 -9 -16 -9 -7 -1 24 11 37 52 53 20 9 37 21
37 28 0 7 3 10 6 6 3 -3 3 -11 -1 -17z m-1034 -97 c-12 -20 -14 -14 -5 12 4 9
9 14 11 11 3 -2 0 -13 -6 -23z"/>
              </g>
            </svg>
          </a>

          <!-- Menu toggle (mobile only) -->
          <button
            class="header__menu-btn"
            @click=${this._toggleMenu}
            aria-label=${msg('Menu')}
            aria-expanded=${this._menuOpen}
          >${this._menuOpen ? icons.close(16) : icons.menu(20)}</button>

          <a href="/dashboard" class="header__title" @click=${this._handleTitleClick}>${msg('metaverse.center')}<span class="header__cursor"></span></a>

          <a href="/multiverse" class="header__nav-link ${window.location.pathname === '/multiverse' ? 'header__nav-link--active' : ''}" @click=${this._handleMapClick}>${msg('Map')}</a>

          <a href="/epoch" class="header__nav-link ${window.location.pathname === '/epoch' ? 'header__nav-link--active' : ''}" @click=${this._handleEpochClick}>${msg('Epoch')}</a>

          <a href="/how-to-play" class="header__nav-link ${window.location.pathname === '/how-to-play' ? 'header__nav-link--active' : ''}" @click=${this._handleGuideClick}>${msg('Guide')}</a>

          <a href="/archives" class="header__nav-link ${window.location.pathname === '/archives' ? 'header__nav-link--active' : ''}" @click=${this._handleArchivesClick}>${msg('Archives')}</a>

          ${
            appState.canForge.value
              ? html`<a href="/forge" class="header__nav-link ${window.location.pathname === '/forge' ? 'header__nav-link--active' : ''}" @click=${(e: Event) => {
                  e.preventDefault();
                  this.dispatchEvent(new CustomEvent('navigate', { detail: '/forge', bubbles: true, composed: true }));
                }}>${msg('Forge')}</a>`
              : nothing
          }

          ${
            appState.isPlatformAdmin.value
              ? html`<a href="/admin" class="header__nav-link header__nav-link--admin ${window.location.pathname === '/admin' ? 'header__nav-link--active' : ''}" @click=${this._handleAdminClick}>${msg('Admin')}</a>`
              : null
          }

          ${
            this._simulations.length > 0
              ? html`
              <div class="sim-selector">
                <span class="sim-selector__label">${msg('Simulation:')}</span>
                <select class="sim-selector__select" @change=${this._handleSimulationChange}>
                  <option value="">${msg('-- Select --')}</option>
                  ${this._simulations.map(
                    (sim) => html`
                      <option value=${sim.id} ?selected=${currentSim?.id === sim.id}>
                        ${sim.name}
                      </option>
                    `,
                  )}
                </select>
              </div>
            `
              : null
          }
        </div>

        <div class="header__right">
          ${appState.mockMode.value ? html`<span class="header__mock-badge" title=${msg('Mock Mode')}>MOCK</span>` : nothing}
          ${html`<velg-dev-account-switcher></velg-dev-account-switcher>`}
          <a
            class="header__github"
            href="https://github.com/mleihs/velgarien-rebuild"
            target="_blank"
            rel="noopener noreferrer"
            aria-label=${msg('View source on GitHub')}
            title=${msg('View source on GitHub')}
          >${icons.github(18)}</a>
          <button class="locale-toggle" @click=${this._toggleLocale}>
            ${localeService.currentLocale === 'en' ? 'EN' : 'DE'}
          </button>
          ${
            appState.isAuthenticated.value
              ? html`<velg-user-menu></velg-user-menu>`
              : html`<button class="btn-sign-in" @click=${this._handleSignInClick}>${msg('Sign In')}</button>`
          }
        </div>
      </div>

      ${this._renderMenuPanel()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-header': VelgPlatformHeader;
  }
}
