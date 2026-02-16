import { Router } from '@lit-labs/router';
import type { TemplateResult } from 'lit';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from './services/AppStateManager.js';
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
        enter: async () => {
          if (appState.isAuthenticated.value) {
            this._router.goto('/dashboard');
            return false;
          }
          return true;
        },
      },
      {
        path: '/register',
        render: () => html`<velg-register-view></velg-register-view>`,
        enter: async () => {
          if (appState.isAuthenticated.value) {
            this._router.goto('/dashboard');
            return false;
          }
          return true;
        },
      },
      {
        path: '/dashboard',
        render: () => html`<velg-simulations-dashboard></velg-simulations-dashboard>`,
        enter: async () => {
          if (!appState.isAuthenticated.value) {
            this._router.goto('/login');
            return false;
          }
          return true;
        },
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

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
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

  private async _guardAuth(): Promise<boolean> {
    if (!appState.isAuthenticated.value) {
      this._router.goto('/login');
      return false;
    }
    return true;
  }

  private async _initAuth(): Promise<void> {
    try {
      const { session } = await authService.getSession();
      if (session) {
        appState.setUser(session.user);
        appState.setAccessToken(session.access_token);
      }
    } finally {
      this._initializing = false;
    }
  }

  private _renderSimulationView(simulationId: string, view: string) {
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
      default:
        content = html`
          <div class="placeholder-view">
            <div class="placeholder-view__title">${view}</div>
            <div class="placeholder-view__text">
              This view is coming soon.
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
      return html`<div class="loading-container">Loading...</div>`;
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
