import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import './AdminUsersTab.js';
import './AdminCachingTab.js';
import './AdminCleanupTab.js';
import './AdminForgeTab.js';
import './AdminSimulationsTab.js';

type AdminTab = 'users' | 'simulations' | 'caching' | 'cleanup' | 'forge';

@localized()
@customElement('velg-admin-panel')
export class VelgAdminPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - 56px);
      background: var(--color-background);
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
    }

    .admin-hero {
      position: relative;
      border-bottom: 3px solid var(--color-border);
      overflow: hidden;
    }

    .admin-hero__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255 255 255 / 0.015) 2px,
        rgba(255 255 255 / 0.015) 4px
      );
      pointer-events: none;
    }

    .admin-hero__inner {
      position: relative;
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-10) var(--space-6) var(--space-6);
    }

    .admin-hero__classification {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-danger);
      border: 2px solid var(--color-danger);
      padding: var(--space-0-5) var(--space-3);
      margin-bottom: var(--space-4);
    }

    .admin-hero__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1.5rem, 4vw, var(--text-3xl));
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2) 0;
    }

    .admin-hero__subtitle {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .admin-tabs {
      display: flex;
      gap: 0;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6);
      border-bottom: 2px solid var(--color-border);
    }

    .admin-tabs__tab {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-3) var(--space-5);
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      position: relative;
      transition:
        color 0.2s ease,
        background 0.2s ease;
    }

    .admin-tabs__tab:hover {
      color: var(--color-text-primary);
      background: rgba(255 255 255 / 0.04);
    }

    .admin-tabs__tab--active {
      color: var(--color-danger);
    }

    .admin-tabs__tab--active::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-danger);
    }

    .admin-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--space-6);
      animation: admin-fade-in var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    @keyframes admin-fade-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .admin-hero__inner {
        padding: var(--space-6) var(--space-4) var(--space-4);
      }

      .admin-content {
        padding: var(--space-4);
      }

      .admin-tabs {
        padding: 0 var(--space-4);
      }
    }
  `;

  @state() private _activeTab: AdminTab = 'users';

  private _setTab(tab: AdminTab): void {
    this._activeTab = tab;
  }

  protected render() {
    return html`
      <div class="admin-hero">
        <div class="admin-hero__scanlines"></div>
        <div class="admin-hero__inner">
          <div class="admin-hero__classification">${msg('Restricted Access')}</div>
          <h1 class="admin-hero__title">${msg('Platform Admin')}</h1>
          <p class="admin-hero__subtitle">${msg('Manage users, memberships, platform settings, and data cleanup.')}</p>
        </div>
      </div>

      <div class="admin-tabs" role="tablist">
        <button
          class="admin-tabs__tab ${this._activeTab === 'users' ? 'admin-tabs__tab--active' : ''}"
          role="tab"
          aria-selected=${this._activeTab === 'users'}
          aria-controls="admin-tabpanel"
          @click=${() => this._setTab('users')}
        >${msg('Users')}</button>
        <button
          class="admin-tabs__tab ${this._activeTab === 'simulations' ? 'admin-tabs__tab--active' : ''}"
          role="tab"
          aria-selected=${this._activeTab === 'simulations'}
          aria-controls="admin-tabpanel"
          @click=${() => this._setTab('simulations')}
        >${msg('Simulations')}</button>
        <button
          class="admin-tabs__tab ${this._activeTab === 'forge' ? 'admin-tabs__tab--active' : ''}"
          role="tab"
          aria-selected=${this._activeTab === 'forge'}
          aria-controls="admin-tabpanel"
          @click=${() => this._setTab('forge')}
        >${msg('Forge')}</button>
        <button
          class="admin-tabs__tab ${this._activeTab === 'caching' ? 'admin-tabs__tab--active' : ''}"
          role="tab"
          aria-selected=${this._activeTab === 'caching'}
          aria-controls="admin-tabpanel"
          @click=${() => this._setTab('caching')}
        >${msg('Caching')}</button>
        <button
          class="admin-tabs__tab ${this._activeTab === 'cleanup' ? 'admin-tabs__tab--active' : ''}"
          role="tab"
          aria-selected=${this._activeTab === 'cleanup'}
          aria-controls="admin-tabpanel"
          @click=${() => this._setTab('cleanup')}
        >${msg('Data Cleanup')}</button>
      </div>

      <div class="admin-content" id="admin-tabpanel" role="tabpanel">
        ${this._renderActiveTab()}
      </div>
    `;
  }

  private _renderActiveTab() {
    switch (this._activeTab) {
      case 'users':
        return html`<velg-admin-users-tab></velg-admin-users-tab>`;
      case 'simulations':
        return html`<velg-admin-simulations-tab></velg-admin-simulations-tab>`;
      case 'forge':
        return html`<velg-admin-forge-tab></velg-admin-forge-tab>`;
      case 'caching':
        return html`<velg-admin-caching-tab></velg-admin-caching-tab>`;
      case 'cleanup':
        return html`<velg-admin-cleanup-tab></velg-admin-cleanup-tab>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-panel': VelgAdminPanel;
  }
}
