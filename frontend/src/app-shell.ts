import { localized, msg } from '@lit/localize';
import { Router } from '@lit-labs/router';
import type { TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from './services/AppStateManager.js';
import { membersApi, taxonomiesApi } from './services/api/index.js';
import { localeService } from './services/i18n/locale-service.js';
import { authService } from './services/supabase/SupabaseAuthService.js';

import './components/auth/LoginView.js';
import './components/auth/RegisterView.js';
import './components/platform/PlatformHeader.js';
import './components/platform/SimulationsDashboard.js';
import './components/layout/SimulationShell.js';
import './components/agents/AgentsView.js';
import './components/buildings/BuildingsView.js';
import './components/events/EventsView.js';
import './components/chat/ChatView.js';
import './components/settings/SettingsView.js';
import './components/social/SocialTrendsView.js';
import './components/social/SocialMediaView.js';
import './components/social/CampaignDashboard.js';
import './components/locations/LocationsView.js';
import './components/platform/InvitationAcceptView.js';
import './components/platform/CreateSimulationWizard.js';
import './components/platform/UserProfileView.js';

@localized()
@customElement('velg-app')
export class VelgApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      background: var(--color-surface);
    }

    .app-main {
      padding: 0;
    }

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .placeholder-view {
      padding: var(--content-padding);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 40vh;
      gap: var(--space-4);
    }

    .placeholder-view__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .placeholder-view__text {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
    }
  `;

  private _router = new Router(
    this,
    [
      {
        path: '/login',
        render: () => html`<velg-login-view></velg-login-view>`,
        enter: async () => this._guardGuest(),
      },
      {
        path: '/register',
        render: () => html`<velg-register-view></velg-register-view>`,
        enter: async () => this._guardGuest(),
      },
      {
        path: '/dashboard',
        render: () => html`<velg-simulations-dashboard></velg-simulations-dashboard>`,
        enter: async () => this._guardAuth(),
      },
      {
        path: '/invitations/:token',
        render: ({ token }) =>
          html`<velg-invitation-accept-view .token=${token ?? ''}></velg-invitation-accept-view>`,
      },
      {
        path: '/profile',
        render: () => html`<velg-user-profile-view></velg-user-profile-view>`,
        enter: async () => this._guardAuth(),
      },
      {
        path: '/new-simulation',
        render: () => html`<velg-create-simulation-wizard open></velg-create-simulation-wizard>`,
        enter: async () => this._guardAuth(),
      },
      // --- Simulation-scoped routes ---
      {
        path: '/simulations/:id/agents',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'agents'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/buildings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'buildings'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/events',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'events'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/chat',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'chat'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/social',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'social'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/locations',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'locations'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/simulations/:id/settings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'settings'),
        enter: async () => this._guardAuth(),
      },
      {
        path: '/',
        render: () => html``,
        enter: async () => {
          await this._authReady;
          if (appState.isAuthenticated.value) {
            this._router.goto('/dashboard');
          } else {
            this._router.goto('/login');
          }
          return false;
        },
      },
    ],
    {
      fallback: {
        render: () => html`<velg-login-view></velg-login-view>`,
      },
    },
  );

  @state() private _initializing = true;

  // Auth-ready gate: route guards await this before checking isAuthenticated.
  // Resolves after authService.initialize() completes (session restored or absent).
  private _authReady: Promise<void>;
  private _resolveAuthReady!: () => void;

  constructor() {
    super();
    this._authReady = new Promise((resolve) => {
      this._resolveAuthReady = resolve;
    });
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await localeService.initLocale();
    this.addEventListener('navigate', this._handleNavigate as EventListener);
    await this._initAuth();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('navigate', this._handleNavigate as EventListener);
  }

  private _handleNavigate = (e: CustomEvent<string>): void => {
    this._router.goto(e.detail);
  };

  /** Wait for auth to be ready, then check if user is authenticated. */
  private async _guardAuth(): Promise<boolean> {
    await this._authReady;
    if (!appState.isAuthenticated.value) {
      this._router.goto('/login');
      return false;
    }
    return true;
  }

  /** Wait for auth to be ready, then redirect authenticated users away from login/register. */
  private async _guardGuest(): Promise<boolean> {
    await this._authReady;
    if (appState.isAuthenticated.value) {
      this._router.goto('/dashboard');
      return false;
    }
    return true;
  }

  private async _initAuth(): Promise<void> {
    try {
      await authService.initialize();
    } finally {
      this._initializing = false;
      this._resolveAuthReady();
    }
  }

  private _lastLoadedSimulationId = '';

  private async _loadSimulationContext(simulationId: string): Promise<void> {
    if (this._lastLoadedSimulationId === simulationId) return;
    this._lastLoadedSimulationId = simulationId;

    // Load taxonomies and member role in parallel
    const [taxResponse, membersResponse] = await Promise.all([
      taxonomiesApi.list(simulationId, { limit: '500' }),
      membersApi.list(simulationId),
    ]);

    if (taxResponse.success && taxResponse.data) {
      appState.setTaxonomies(Array.isArray(taxResponse.data) ? taxResponse.data : []);
    }

    if (membersResponse.success && membersResponse.data) {
      const members = Array.isArray(membersResponse.data) ? membersResponse.data : [];
      const userId = appState.user.value?.id;
      const me = members.find((m) => m.user_id === userId);
      if (me) {
        appState.setCurrentRole(me.member_role as 'owner' | 'admin' | 'editor' | 'viewer');
      }
    }
  }

  private _renderSimulationView(simulationId: string, view: string) {
    this._loadSimulationContext(simulationId);
    let content: TemplateResult;
    switch (view) {
      case 'agents':
        content = html`<velg-agents-view .simulationId=${simulationId}></velg-agents-view>`;
        break;
      case 'buildings':
        content = html`<velg-buildings-view .simulationId=${simulationId}></velg-buildings-view>`;
        break;
      case 'events':
        content = html`<velg-events-view .simulationId=${simulationId}></velg-events-view>`;
        break;
      case 'chat':
        content = html`<velg-chat-view .simulationId=${simulationId}></velg-chat-view>`;
        break;
      case 'settings':
        content = html`<velg-settings-view .simulationId=${simulationId}></velg-settings-view>`;
        break;
      case 'social':
        content = html`<velg-social-trends-view .simulationId=${simulationId}></velg-social-trends-view>`;
        break;
      case 'locations':
        content = html`<velg-locations-view .simulationId=${simulationId}></velg-locations-view>`;
        break;
      default:
        content = html`
          <div class="placeholder-view">
            <div class="placeholder-view__title">${view}</div>
            <div class="placeholder-view__text">
              ${msg('This view is coming soon.')}
            </div>
          </div>
        `;
    }

    return html`
      <velg-simulation-shell .simulationId=${simulationId}>
        ${content}
      </velg-simulation-shell>
    `;
  }

  protected render() {
    if (this._initializing) {
      return html`<div class="loading-container">${msg('Loading...')}</div>`;
    }

    return html`
      ${appState.isAuthenticated.value ? html`<velg-platform-header></velg-platform-header>` : null}
      <main class="app-main">
        ${this._router.outlet()}
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-app': VelgApp;
  }
}
