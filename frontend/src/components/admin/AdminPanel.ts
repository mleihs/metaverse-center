import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { TabDef } from '../shared/VelgTabs.js';

import '../shared/VelgTabs.js';
import './AdminUsersTab.js';
import './AdminCleanupTab.js';
import './AdminForgeTab.js';
import './AdminResonancesTab.js';
import './AdminScannerTab.js';
import './AdminSimulationsTab.js';
import './AdminHeartbeatTab.js';
import './AdminHealthTab.js';
import './AdminSocialTab.js';
import './AdminPlatformConfigTab.js';
import './AdminAIUsageTab.js';

type AdminTab =
  | 'users'
  | 'simulations'
  | 'health'
  | 'heartbeat'
  | 'resonances'
  | 'scanner'
  | 'forge'
  | 'ai_usage'
  | 'platform'
  | 'social'
  | 'cleanup';

@localized()
@customElement('velg-admin-panel')
export class VelgAdminPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: calc(100vh - 56px);
      background: var(--color-surface);
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

    .admin-tabs-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6);
    }

    /* Override VelgTabs active indicator for admin's classified-document theme.
       Uses --tab-active-color (not --color-primary) to avoid coloring badges red. */
    velg-tabs {
      --tab-active-color: var(--color-danger);
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

      .admin-tabs-wrapper {
        padding: 0 var(--space-4);
      }
    }
  `;

  @state() private _activeTab: AdminTab = 'users';

  private _getAdminTabs(): TabDef[] {
    const forgeCount = appState.pendingForgeRequestCount.value;
    return [
      // Content Management
      { key: 'users', label: msg('Users'), group: msg('Content') },
      { key: 'simulations', label: msg('Simulations'), group: msg('Content') },
      // World Systems
      { key: 'health', label: msg('Health'), group: msg('Systems') },
      { key: 'heartbeat', label: msg('Heartbeat'), group: msg('Systems') },
      { key: 'resonances', label: msg('Resonances'), group: msg('Systems') },
      // AI & Generation
      { key: 'forge', label: msg('Forge'), group: msg('AI & Gen'), badge: forgeCount > 0 ? forgeCount : undefined },
      { key: 'ai_usage', label: msg('AI Usage'), group: msg('AI & Gen') },
      { key: 'scanner', label: msg('Scanner'), group: msg('AI & Gen') },
      // Configuration
      { key: 'platform', label: msg('Platform Config'), group: msg('Config') },
      { key: 'social', label: msg('Social Media'), group: msg('Config') },
      { key: 'cleanup', label: msg('Data Cleanup'), group: msg('Config') },
    ];
  }

  private _handleTabChange(e: CustomEvent<{ key: string }>): void {
    this._activeTab = e.detail.key as AdminTab;
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

      <div class="admin-tabs-wrapper">
        <velg-tabs
          .tabs=${this._getAdminTabs()}
          .active=${this._activeTab}
          @tab-change=${this._handleTabChange}
        ></velg-tabs>
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
      case 'health':
        return html`<velg-admin-health-tab></velg-admin-health-tab>`;
      case 'heartbeat':
        return html`<velg-admin-heartbeat-tab></velg-admin-heartbeat-tab>`;
      case 'resonances':
        return html`<velg-admin-resonances-tab></velg-admin-resonances-tab>`;
      case 'scanner':
        return html`<velg-admin-scanner-tab></velg-admin-scanner-tab>`;
      case 'forge':
        return html`<velg-admin-forge-tab></velg-admin-forge-tab>`;
      case 'ai_usage':
        return html`<velg-admin-ai-usage-tab></velg-admin-ai-usage-tab>`;
      case 'platform':
        return html`<velg-admin-platform-config-tab></velg-admin-platform-config-tab>`;
      case 'social':
        return html`<velg-admin-social-tab></velg-admin-social-tab>`;
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
