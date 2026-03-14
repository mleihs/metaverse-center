/**
 * PlatformHeader — Main site header.
 *
 * Desktop layout (single row, 60px):
 *   METAVERSE.CENTER  [● OPS ▾] [● INTEL ▾]  ◆ Velgarien ▾  [⌘K]  [⚙ SYS ▾]  user@email
 *
 * Mobile: favicon mark + hamburger → slide-down panel.
 *
 * Clusters use HeaderCluster for hover-to-open dropdowns.
 * Links inside cluster panels use semantic <a> tags with proper href
 * for SEO crawlability and keyboard navigation.
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { localeService } from '../../services/i18n/locale-service.js';
import type { Simulation } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

import '../forge/VelgForgeWalletBadge.js';
import '../forge/VelgForgeMint.js';
import './UserMenu.js';
import './HeaderCluster.js';
import './SimulationSwitcher.js';
import './CommandPalette.js';

/** Routes that belong to the OPS cluster. */
const OPS_PATHS = ['/multiverse', '/epoch', '/how-to-play', '/archives'];

/** Routes that belong to the INTEL cluster. */
const INTEL_PATHS = ['/forge', '/admin'];

@localized()
@customElement('velg-platform-header')
export class VelgPlatformHeader extends SignalWatcher(LitElement) {
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
      z-index: var(--z-header, 200);
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

    /* ── Layout ── */

    .header {
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0 var(--space-6);
      min-width: 0;
      position: relative;
      z-index: 2;
      gap: var(--space-4);
    }

    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-width: 0;
    }

    .header__center {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
    }

    .header__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
    }

    /* ── Logo ── */

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--hdr-amber);
      cursor: pointer;
      text-decoration: none;
      flex-shrink: 0;
    }

    /* ── Favicon mark (mobile only) ── */

    .header__mark {
      display: none;
      align-items: center;
      justify-content: center;
      width: 51px;
      height: 51px;
      flex-shrink: 0;
      color: var(--hdr-amber);
      cursor: pointer;
      text-decoration: none;
    }

    .header__mark svg {
      width: 45px;
      height: 45px;
    }

    /* ── Hamburger button (mobile only) ── */

    .header__menu-btn {
      display: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      background: none;
      border: 1px solid transparent;
      color: var(--hdr-text);
      cursor: pointer;
      padding: 0;
      transition: color 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  border-color 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .header__menu-btn:hover {
      color: var(--hdr-amber);
      border-color: rgba(245, 158, 11, 0.3);
    }

    /* ── Cmd+K trigger button ── */

    .cmd-k-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--hdr-text-muted);
      background: transparent;
      border: 1px solid var(--hdr-border);
      cursor: pointer;
      transition: color 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  border-color 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .cmd-k-btn:hover {
      color: var(--hdr-amber);
      border-color: var(--hdr-amber);
    }

    .cmd-k-btn kbd {
      font-family: inherit;
      font-size: inherit;
    }

    /* ── Cluster panel link items ── */

    .cluster-link {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3) var(--space-2) var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-decoration: none;
      color: var(--hdr-text);
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      transition:
        color 150ms ease,
        background 150ms ease;
    }

    /* Beacon dot */
    .cluster-link::before {
      content: '';
      position: absolute;
      left: var(--space-2);
      top: 50%;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--hdr-amber);
      transform: translateY(-50%);
      box-shadow: 0 0 4px var(--hdr-amber);
    }

    .cluster-link:hover {
      color: var(--hdr-amber);
      background: var(--hdr-amber-ghost);
    }

    .cluster-link--active {
      color: var(--hdr-amber);
      background: var(--hdr-amber-ghost);
    }

    .cluster-link--active::before {
      background: var(--hdr-amber);
      box-shadow: 0 0 6px var(--hdr-amber), 0 0 12px rgba(245, 158, 11, 0.4);
    }

    .cluster-link--admin {
      color: var(--hdr-danger);
    }

    .cluster-link--admin::before {
      background: var(--hdr-danger);
      box-shadow: 0 0 4px var(--hdr-danger);
    }

    .cluster-link--admin:hover {
      color: var(--hdr-danger);
      background: rgba(239, 68, 68, 0.06);
    }

    .cluster-divider {
      height: 1px;
      background: #222;
      margin: var(--space-1) 0;
    }

    /* ── SYS panel items ── */

    .sys-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--hdr-text-dim);
      text-decoration: none;
      cursor: pointer;
      transition: color 150ms ease;
      background: none;
      border: none;
      width: 100%;
    }

    .sys-item:hover {
      color: var(--hdr-text);
    }

    .sys-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--hdr-text-muted);
      padding: var(--space-2) var(--space-3) var(--space-1);
    }

    .sys-badge {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 2px 6px;
      line-height: 1;
    }

    .sys-badge--mock {
      color: var(--hdr-amber);
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .sys-badge--dev {
      color: var(--hdr-amber);
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    /* ── Sign-in button ── */

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
      cursor: pointer;
      transition: background 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .btn-sign-in:hover {
      background: #fbbf24;
      box-shadow: 0 0 16px var(--hdr-amber-glow);
    }

    /* ── Mobile menu panel ── */

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
      animation: menu-slide-down 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

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
    .header__menu-panel::before { top: var(--space-2); left: var(--space-2); border-width: 2px 0 0 2px; }
    .header__menu-panel::after { bottom: var(--space-2); right: var(--space-2); border-width: 0 2px 2px 0; }

    @keyframes menu-slide-down {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
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
      transition: color 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  background 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  border-color 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1);
      animation: menu-item-enter 0.3s cubic-bezier(0.23, 1, 0.32, 1) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
    }

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

    .header__menu-item--admin { color: var(--hdr-danger); }
    .header__menu-item--admin::before { background: var(--hdr-danger); box-shadow: 0 0 4px var(--hdr-danger); }
    .header__menu-item--admin:hover { color: var(--hdr-danger); border-color: var(--hdr-danger); background: rgba(239, 68, 68, 0.08); }

    .header__menu-item--active { background: var(--hdr-amber); color: var(--hdr-bg); border-color: var(--hdr-amber); }
    .header__menu-item--active::before { background: var(--hdr-bg); box-shadow: none; }

    @keyframes menu-item-enter {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
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
      animation: menu-item-enter 0.3s cubic-bezier(0.23, 1, 0.32, 1) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
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
      flex: 1;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--hdr-border);
      background: var(--hdr-surface);
      color: var(--hdr-text);
      cursor: pointer;
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
      animation: menu-item-enter 0.3s cubic-bezier(0.23, 1, 0.32, 1) backwards;
      animation-delay: calc(var(--i, 0) * 60ms + 100ms);
    }

    .header__menu-github:hover { color: var(--hdr-text); }

    /* ── Keyframes ── */

    @keyframes beacon-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 4px var(--hdr-amber); }
      50% { opacity: 0.4; box-shadow: 0 0 8px var(--hdr-amber), 0 0 16px rgba(245, 158, 11, 0.4); }
    }

    @keyframes header-border-flow {
      0% { background-position: 0% 0; }
      100% { background-position: 200% 0; }
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      :host::before,
      :host::after,
      .header__menu-item::before { animation: none !important; }
      .header__menu-item,
      .header__menu-btn,
      .btn-sign-in,
      .cmd-k-btn,
      .cluster-link,
      .sys-item { transition: none !important; }
    }

    /* ── Mobile ── */

    @media (max-width: 640px) {
      :host {
        height: auto;
        padding: 5px 0;
      }

      .header {
        padding: 0 var(--space-3);
        height: auto;
        gap: var(--space-2);
      }

      .header__mark { display: flex; }
      .header__menu-btn { display: flex; }

      .header__title { display: none; }
      .header__center { display: none; }
      .cmd-k-btn { display: none; }

      .header__right {
        gap: var(--space-2);
      }
    }
  `;

  @state() private _simulations: Simulation[] = [];
  @state() private _menuOpen = false;
  @state() private _paletteOpen = false;

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
    // Listen for Ctrl+K from app-shell
    this.addEventListener('open-command-palette', () => {
      this._paletteOpen = true;
    });
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._handleKeyDown);
    super.disconnectedCallback();
  }

  // ── Navigation helpers ──

  private _navigate(path: string, e?: Event): void {
    e?.preventDefault();
    this._closeMenu();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
  }

  private _toggleMenu(): void {
    this._menuOpen = !this._menuOpen;
  }

  private _closeMenu(): void {
    this._menuOpen = false;
  }

  private _preMapPath: string | null = null;

  private _handleMapClick(e: Event): void {
    e.preventDefault();
    this._closeMenu();
    if (window.location.pathname === '/multiverse') {
      const target = this._preMapPath ?? '/dashboard';
      this._preMapPath = null;
      this._navigate(target);
    } else {
      this._preMapPath = window.location.pathname;
      this._navigate('/multiverse');
    }
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
      this._navigate(`/simulations/${sim.slug}/agents`);
    }
  }

  // ── Computed ──

  private get _path(): string {
    return window.location.pathname;
  }

  private get _opsActive(): boolean {
    return OPS_PATHS.some((p) => this._path.startsWith(p));
  }

  private get _intelActive(): boolean {
    return INTEL_PATHS.some((p) => this._path.startsWith(p));
  }

  private get _showIntel(): boolean {
    return appState.canForge.value || appState.isPlatformAdmin.value;
  }

  // ── Cluster panel renderers ──

  private _renderOpsPanel() {
    const path = this._path;
    return html`
      <a href="/multiverse" class="cluster-link ${path === '/multiverse' ? 'cluster-link--active' : ''}"
        @click=${(e: Event) => this._handleMapClick(e)}>${msg('Map')}</a>
      <a href="/epoch" class="cluster-link ${path === '/epoch' ? 'cluster-link--active' : ''}"
        @click=${(e: Event) => this._navigate('/epoch', e)}>${msg('Epoch')}</a>
      <a href="/how-to-play" class="cluster-link ${path === '/how-to-play' ? 'cluster-link--active' : ''}"
        @click=${(e: Event) => this._navigate('/how-to-play', e)}>${msg('Guide')}</a>
      <a href="/archives" class="cluster-link ${path === '/archives' ? 'cluster-link--active' : ''}"
        @click=${(e: Event) => this._navigate('/archives', e)}>${msg('Archives')}</a>
    `;
  }

  private _renderIntelPanel() {
    const path = this._path;
    return html`
      ${appState.canForge.value
        ? html`<a href="/forge" class="cluster-link ${path === '/forge' ? 'cluster-link--active' : ''}"
            @click=${(e: Event) => this._navigate('/forge', e)}>${msg('Forge')}</a>`
        : nothing}
      ${appState.isPlatformAdmin.value
        ? html`<a href="/admin" class="cluster-link cluster-link--admin ${path === '/admin' ? 'cluster-link--active' : ''}"
            @click=${(e: Event) => this._navigate('/admin', e)}>${msg('Admin')}</a>`
        : nothing}
    `;
  }

  private _renderSysPanel() {
    return html`
      ${appState.canForge.value
        ? html`
            <div class="sys-label">${msg('Forge')}</div>
            <div style="padding: 0 12px 8px;">
              <velg-forge-wallet-badge
                @open-mint=${() => { forgeStateManager.mintOpen.value = true; }}
              ></velg-forge-wallet-badge>
            </div>
            <div class="cluster-divider"></div>
          `
        : nothing}

      <div class="sys-label">${msg('Tools')}</div>
      <a class="sys-item"
        href="https://github.com/mleihs/velgarien-rebuild"
        target="_blank"
        rel="noopener noreferrer"
      >${icons.github(14)} ${msg('GitHub Repository')}</a>

      <button class="sys-item" @click=${this._toggleLocale}>
        ${icons.compassRose(14)}
        ${localeService.currentLocale === 'en'
          ? msg('Sprache: EN \u2192 DE')
          : msg('Language: DE \u2192 EN')}
      </button>

      <div class="cluster-divider"></div>
      <div class="sys-label">${msg('System')}</div>

      <div style="padding: 0 12px 4px;">
        <velg-dev-account-switcher></velg-dev-account-switcher>
      </div>

      ${appState.mockMode.value
        ? html`<div style="padding: 2px 12px 8px;">
            <span class="sys-badge sys-badge--mock">${msg('Mock Mode Active')}</span>
          </div>`
        : nothing}
    `;
  }

  // ── Mobile menu panel (same as before) ──

  private _renderMenuPanel() {
    if (!this._menuOpen) return nothing;

    const path = this._path;
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
          @click=${(e: Event) => this._handleMapClick(e)}>${msg('Map')}</a>

        <a href="/epoch"
          class="header__menu-item ${path === '/epoch' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${(e: Event) => this._navigate('/epoch', e)}>${msg('Epoch')}</a>

        <a href="/how-to-play"
          class="header__menu-item ${path === '/how-to-play' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${(e: Event) => this._navigate('/how-to-play', e)}>${msg('Guide')}</a>

        <a href="/archives"
          class="header__menu-item ${path === '/archives' ? 'header__menu-item--active' : ''}"
          style="--i:${navIdx++}"
          @click=${(e: Event) => this._navigate('/archives', e)}>${msg('Archives')}</a>

        ${appState.canForge.value
          ? html`<a href="/forge"
              class="header__menu-item ${path === '/forge' ? 'header__menu-item--active' : ''}"
              style="--i:${navIdx++}"
              @click=${(e: Event) => this._navigate('/forge', e)}>${msg('Forge')}</a>`
          : nothing}

        ${isAdmin
          ? html`<a href="/admin"
              class="header__menu-item header__menu-item--admin ${path === '/admin' ? 'header__menu-item--active' : ''}"
              style="--i:${navIdx++}"
              @click=${(e: Event) => this._navigate('/admin', e)}>${msg('Admin')}</a>`
          : nothing}

        <div class="header__menu-divider"></div>

        ${this._simulations.length > 0
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
          : nothing}

        <button class="header__menu-item"
          style="--i:${navIdx++}"
          @click=${this._toggleLocale}
        >${localeService.currentLocale === 'en'
            ? msg('Sprache: EN \u2192 DE')
            : msg('Language: DE \u2192 EN')}</button>

        <div style="padding: 0 var(--space-3); --i:${navIdx++}">
          <velg-dev-account-switcher></velg-dev-account-switcher>
        </div>

        <a class="header__menu-github"
          href="https://github.com/mleihs/velgarien-rebuild"
          target="_blank"
          rel="noopener noreferrer"
          style="--i:${navIdx}"
        >${icons.github(18)} ${msg('View source on GitHub')}</a>
      </nav>
    `;
  }

  // ── Main render ──

  protected render() {
    return html`
      <header class="header" role="banner">
        <!-- Mobile: favicon mark -->
        <a href="/dashboard" class="header__mark" aria-label=${msg('Home')}
          @click=${(e: Event) => this._navigate('/dashboard', e)}>
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
19z"/>
            </g>
          </svg>
        </a>

        <!-- Mobile: hamburger -->
        <button
          class="header__menu-btn"
          @click=${this._toggleMenu}
          aria-label=${msg('Menu')}
          aria-expanded=${this._menuOpen}
        >${this._menuOpen ? icons.close(16) : icons.menu(20)}</button>

        <!-- Desktop: logo -->
        <a href="/dashboard" class="header__title"
          @click=${(e: Event) => this._navigate('/dashboard', e)}>${msg('metaverse.center')}</a>

        <!-- Desktop: left clusters -->
        <div class="header__left">
          <velg-header-cluster
            label=${msg('OPS')}
            ?active=${this._opsActive}
          >${this._renderOpsPanel()}</velg-header-cluster>

          ${this._showIntel
            ? html`
                <velg-header-cluster
                  label=${msg('INTEL')}
                  variant=${appState.isPlatformAdmin.value ? 'danger' : 'default'}
                  ?active=${this._intelActive}
                >${this._renderIntelPanel()}</velg-header-cluster>
              `
            : nothing}
        </div>

        <!-- Center: sim switcher -->
        <div class="header__center">
          <velg-simulation-switcher></velg-simulation-switcher>
        </div>

        <!-- Right: cmd-k, sys cluster, user -->
        <div class="header__right">
          <button
            class="cmd-k-btn"
            @click=${() => { this._paletteOpen = true; }}
            aria-label=${msg('Open command palette')}
            title=${msg('Command palette (Ctrl+K)')}
          >
            <kbd>${navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}K</kbd>
          </button>

          <velg-header-cluster
            label=${msg('SYS')}
            .icon=${icons.gear(12)}
          >${this._renderSysPanel()}</velg-header-cluster>

          ${appState.isAuthenticated.value
            ? html`<velg-user-menu></velg-user-menu>`
            : html`<button class="btn-sign-in" @click=${this._handleSignInClick}>${msg('Sign In')}</button>`}
        </div>
      </header>

      ${this._renderMenuPanel()}

      <velg-command-palette
        .open=${this._paletteOpen}
        @command-palette-close=${() => { this._paletteOpen = false; }}
      ></velg-command-palette>

      <velg-forge-mint></velg-forge-mint>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-header': VelgPlatformHeader;
  }
}
