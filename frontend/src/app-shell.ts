import { localized, msg } from '@lit/localize';
import { Router } from '@lit-labs/router';
import type { TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from './services/AnalyticsService.js';
import { appState } from './services/AppStateManager.js';
import { membersApi, settingsApi, simulationsApi, taxonomiesApi } from './services/api/index.js';
import { localeService } from './services/i18n/locale-service.js';
import { seoService } from './services/SeoService.js';
import { authService } from './services/supabase/SupabaseAuthService.js';
import type { Simulation } from './types/index.js';

import './components/auth/LoginView.js';
import './components/auth/LoginPanel.js';
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
import './components/lore/SimulationLoreView.js';
import './components/health/SimulationHealthView.js';
import './components/multiverse/CartographerMap.js';
import './components/epoch/EpochCommandCenter.js';
import './components/epoch/EpochInviteAcceptView.js';
import './components/how-to-play/HowToPlayView.js';
import './components/shared/CookieConsent.js';

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
        enter: async () => {
          const ok = await this._guardGuest();
          if (ok) {
            seoService.setTitle(['Sign In']);
            analyticsService.trackPageView('/login', document.title);
          }
          return ok;
        },
      },
      {
        path: '/register',
        render: () => html`<velg-register-view></velg-register-view>`,
        enter: async () => {
          const ok = await this._guardGuest();
          if (ok) {
            seoService.setTitle(['Register']);
            analyticsService.trackPageView('/register', document.title);
          }
          return ok;
        },
      },
      {
        path: '/dashboard',
        render: () => html`<velg-simulations-dashboard></velg-simulations-dashboard>`,
        enter: async () => {
          await this._authReady;
          seoService.reset();
          analyticsService.trackPageView('/dashboard', document.title);
          return true;
        },
      },
      {
        path: '/multiverse',
        render: () => html`<velg-cartographer-map></velg-cartographer-map>`,
        enter: async () => {
          await this._authReady;
          seoService.setTitle(['Multiverse Map']);
          analyticsService.trackPageView('/multiverse', document.title);
          return true;
        },
      },
      {
        path: '/epoch',
        render: () => html`<velg-epoch-command-center></velg-epoch-command-center>`,
        enter: async () => {
          await this._authReady;
          seoService.setTitle(['Epoch Command Center']);
          analyticsService.trackPageView('/epoch', document.title);
          return true;
        },
      },
      {
        path: '/epoch/join',
        render: () => html`<velg-epoch-invite-accept-view></velg-epoch-invite-accept-view>`,
        enter: async () => {
          await this._authReady;
          seoService.setTitle(['Epoch Summons']);
          analyticsService.trackPageView('/epoch/join', document.title);
          return true;
        },
      },
      {
        path: '/how-to-play',
        render: () => html`<velg-how-to-play></velg-how-to-play>`,
        enter: async () => {
          await this._authReady;
          seoService.setTitle(['How to Play']);
          analyticsService.trackPageView('/how-to-play', document.title);
          return true;
        },
      },
      {
        path: '/invitations/:token',
        render: ({ token }) =>
          html`<velg-invitation-accept-view .token=${token ?? ''}></velg-invitation-accept-view>`,
        enter: async () => {
          await this._authReady;
          seoService.setTitle(['Invitation']);
          analyticsService.trackPageView('/invitations', document.title);
          return true;
        },
      },
      {
        path: '/profile',
        render: () => html`<velg-user-profile-view></velg-user-profile-view>`,
        enter: async () => {
          const ok = await this._guardAuth();
          if (ok) {
            seoService.setTitle(['Profile']);
            analyticsService.trackPageView('/profile', document.title);
          }
          return ok;
        },
      },
      {
        path: '/new-simulation',
        render: () => html`<velg-create-simulation-wizard open></velg-create-simulation-wizard>`,
        enter: async () => {
          const ok = await this._guardAuth();
          if (ok) {
            seoService.setTitle(['New Simulation']);
            analyticsService.trackPageView('/new-simulation', document.title);
          }
          return ok;
        },
      },
      // --- Simulation-scoped routes (public read, auth for mutations) ---
      {
        path: '/simulations/:id/lore',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'lore'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/health',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'health'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/agents',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'agents'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/buildings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'buildings'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/events',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'events'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/chat',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'chat'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/social',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'social'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/locations',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'locations'),
        enter: async ({ id }) => this._enterSimulationRoute(id),
      },
      {
        path: '/simulations/:id/settings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'settings'),
        enter: async ({ id }) => {
          const ok = await this._guardAuth();
          if (!ok) return false;
          return this._enterSimulationRoute(id);
        },
      },
      {
        path: '/',
        render: () => html``,
        enter: async () => {
          await this._authReady;
          this._router.goto('/dashboard');
          return false;
        },
      },
    ],
    {
      fallback: {
        render: () => html`<velg-simulations-dashboard></velg-simulations-dashboard>`,
      },
    },
  );

  @state() private _initializing = true;
  @state() private _showLoginPanel = false;

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
    analyticsService.init();
    this.addEventListener('navigate', this._handleNavigate as EventListener);
    this.addEventListener('login-panel-open', this._handleLoginPanelOpen as EventListener);
    this.addEventListener('login-panel-close', this._handleLoginPanelClose as EventListener);
    await this._initAuth();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('navigate', this._handleNavigate as EventListener);
    this.removeEventListener('login-panel-open', this._handleLoginPanelOpen as EventListener);
    this.removeEventListener('login-panel-close', this._handleLoginPanelClose as EventListener);
  }

  private _handleNavigate = (e: CustomEvent<string>): void => {
    const path = e.detail;
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    this._router.goto(path);
  };

  private _handleLoginPanelOpen = (): void => {
    this._showLoginPanel = true;
  };

  private _handleLoginPanelClose = (): void => {
    this._showLoginPanel = false;
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

  /**
   * Shared enter guard for simulation routes.
   * Awaits auth, then resolves the slug/UUID to a simulation BEFORE render runs.
   * This eliminates the race condition where render fires with an unresolved slug.
   */
  private async _enterSimulationRoute(id: string | undefined): Promise<boolean> {
    await this._authReady;
    if (id) {
      const resolved = await this._resolveSimulation(id);
      if (!resolved) return false;
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

  /** UUID regex — used to distinguish slug vs UUID in route params */
  private static _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Resolve an ID-or-slug to a simulation UUID.
   * If a slug is provided, fetches the simulation by slug and returns its UUID.
   * If a UUID is provided and the simulation is loaded, swaps the URL to use the slug.
   */
  private async _resolveSimulation(idOrSlug: string): Promise<string | null> {
    const isUuid = VelgApp._UUID_RE.test(idOrSlug);

    if (isUuid) {
      // Fetch if we don't already have this simulation
      if (appState.currentSimulation.value?.id !== idOrSlug) {
        const simResponse = await simulationsApi.getById(idOrSlug);
        if (simResponse.success && simResponse.data) {
          appState.setCurrentSimulation(simResponse.data as Simulation);
        } else {
          return null;
        }
      }
      // Replace UUID in URL with slug for cleaner URLs
      const sim = appState.currentSimulation.value;
      if (sim?.slug) {
        const currentPath = window.location.pathname;
        const slugPath = currentPath.replace(idOrSlug, sim.slug);
        if (slugPath !== currentPath) {
          window.history.replaceState({}, '', slugPath);
        }
      }
      return idOrSlug;
    }

    // It's a slug — resolve to UUID
    const sim = appState.currentSimulation.value;
    if (sim?.slug === idOrSlug) {
      return sim.id;
    }

    const simResponse = await simulationsApi.getBySlug(idOrSlug);
    if (simResponse.success && simResponse.data) {
      appState.setCurrentSimulation(simResponse.data as Simulation);
      return (simResponse.data as Simulation).id;
    }
    return null;
  }

  private async _loadSimulationContext(idOrSlug: string): Promise<void> {
    const simulationId = await this._resolveSimulation(idOrSlug);
    if (!simulationId) return;

    // Allow re-load on re-entry (theme needs to reapply after switching sims)
    if (this._lastLoadedSimulationId === simulationId) return;
    this._lastLoadedSimulationId = simulationId;

    if (appState.isAuthenticated.value) {
      // Authenticated: load taxonomies, member role, and design settings in parallel
      const [taxResponse, membersResponse, settingsResponse] = await Promise.all([
        taxonomiesApi.list(simulationId, { limit: '500' }),
        membersApi.list(simulationId),
        settingsApi.list(simulationId, 'design'),
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

      if (settingsResponse.success && settingsResponse.data) {
        appState.setSettings(Array.isArray(settingsResponse.data) ? settingsResponse.data : []);
      }
    } else {
      // Anonymous: load taxonomies + design settings via public API, skip members
      appState.setCurrentRole(null);
      const [taxResponse, settingsResponse] = await Promise.all([
        taxonomiesApi.list(simulationId, { limit: '500' }),
        settingsApi.list(simulationId, 'design'),
      ]);

      if (taxResponse.success && taxResponse.data) {
        appState.setTaxonomies(Array.isArray(taxResponse.data) ? taxResponse.data : []);
      }

      if (settingsResponse.success && settingsResponse.data) {
        appState.setSettings(Array.isArray(settingsResponse.data) ? settingsResponse.data : []);
      }
    }
  }

  private _renderSimulationView(idOrSlug: string, view: string) {
    // Slug resolution already completed in enter() callback.
    // Fire context loading (taxonomies, role, settings) as background task.
    // No requestUpdate() needed — child components read signals directly.
    this._loadSimulationContext(idOrSlug);

    // Use resolved UUID for child components (API calls need UUIDs)
    const resolvedId = appState.currentSimulation.value?.id ?? idOrSlug;

    // SEO + analytics (safe even if resolvedId is still a slug)
    const sim = appState.currentSimulation.value;
    const simName = sim?.name ?? '';
    const slug = sim?.slug ?? idOrSlug;
    const viewLabel = view.charAt(0).toUpperCase() + view.slice(1);
    seoService.setTitle(simName ? [viewLabel, simName] : [viewLabel]);
    seoService.setCanonical(`/simulations/${slug}/${view}`);
    if (sim?.description) {
      seoService.setDescription(sim.description);
    }
    analyticsService.trackPageView(`/simulations/${slug}/${view}`, document.title);

    // Safety fallback: if slug resolution somehow failed, show bare loading spinner
    // (without SimulationShell, to prevent ThemeService 422s on non-UUID)
    if (!VelgApp._UUID_RE.test(resolvedId)) {
      return html`<div class="loading-container">${msg('Loading...')}</div>`;
    }

    let content: TemplateResult;
    switch (view) {
      case 'lore':
        content = html`<velg-simulation-lore-view .simulationId=${resolvedId}></velg-simulation-lore-view>`;
        break;
      case 'health':
        content = html`<velg-simulation-health-view .simulationId=${resolvedId}></velg-simulation-health-view>`;
        break;
      case 'agents':
        content = html`<velg-agents-view .simulationId=${resolvedId}></velg-agents-view>`;
        break;
      case 'buildings':
        content = html`<velg-buildings-view .simulationId=${resolvedId}></velg-buildings-view>`;
        break;
      case 'events':
        content = html`<velg-events-view .simulationId=${resolvedId}></velg-events-view>`;
        break;
      case 'chat':
        content = html`<velg-chat-view .simulationId=${resolvedId}></velg-chat-view>`;
        break;
      case 'settings':
        content = html`<velg-settings-view .simulationId=${resolvedId}></velg-settings-view>`;
        break;
      case 'social':
        content = html`<velg-social-trends-view .simulationId=${resolvedId}></velg-social-trends-view>`;
        break;
      case 'locations':
        content = html`<velg-locations-view .simulationId=${resolvedId}></velg-locations-view>`;
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
      <velg-simulation-shell .simulationId=${resolvedId}>
        ${content}
      </velg-simulation-shell>
    `;
  }

  protected render() {
    if (this._initializing) {
      return html`<div class="loading-container">${msg('Loading...')}</div>`;
    }

    return html`
      <velg-platform-header></velg-platform-header>
      <main class="app-main">
        ${this._router.outlet()}
      </main>
      ${this._showLoginPanel ? html`<velg-login-panel></velg-login-panel>` : nothing}
      <velg-cookie-consent></velg-cookie-consent>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-app': VelgApp;
  }
}
