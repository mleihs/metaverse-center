import { localized, msg, str } from '@lit/localize';
import { Router } from '@lit-labs/router';
import type { TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from './services/AnalyticsService.js';
import { appState } from './services/AppStateManager.js';
import { epochsApi } from './services/api/EpochsApiService.js';
import { forgeApi } from './services/api/ForgeApiService.js';
import { membersApi, settingsApi, simulationsApi, taxonomiesApi } from './services/api/index.js';
import { usersApi } from './services/api/UsersApiService.js';
import { localeService } from './services/i18n/locale-service.js';
import { seoService } from './services/SeoService.js';
import { authService } from './services/supabase/SupabaseAuthService.js';
import type { Simulation } from './types/index.js';

import { lazyRoute } from './utils/lazy-route.js';
import { getSimViewImport } from './utils/sim-view-imports.js';

// Always-loaded: auth, layout, overlays, SEO-critical landing
import './components/auth/LoginView.js';
import './components/auth/LoginPanel.js';
import './components/auth/RegisterView.js';
import './components/platform/PlatformHeader.js';
import './components/platform/SimulationsDashboard.js';
import './components/layout/SimulationShell.js';
import './components/platform/InvitationAcceptView.js';
import './components/platform/CreateSimulationWizard.js';
import './components/platform/UserProfileView.js';
import './components/shared/CookieConsent.js';
import './components/shared/GuestBanner.js';
import './components/landing/LandingPage.js';
import './components/onboarding/OnboardingWizard.js';
import './components/content/ContentPageView.js';
import './components/platform/VelgAchievementToast.js';

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

    .skip-nav {
      position: absolute;
      top: -100%;
      left: var(--space-4);
      z-index: 9999;
      padding: var(--space-2) var(--space-4);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 2px solid var(--color-primary);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      text-decoration: none;
    }

    .skip-nav:focus {
      top: var(--space-2);
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

    .route-progress {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--color-primary);
      z-index: 10000;
      animation: route-slide 1.2s ease-in-out infinite;
    }

    @keyframes route-slide {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0); }
      100% { transform: translateX(100%); }
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
            seoService.setDescription(
              'Sign in to metaverse.center — access your operative terminal and explore simulated worlds.',
            );
            seoService.setCanonical('/login');
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
            seoService.setDescription(
              'Create your operative account on metaverse.center — join the Bureau of Multiverse Observation.',
            );
            seoService.setCanonical('/register');
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
          seoService.setTitle(['Operative Terminal']);
          seoService.setDescription(
            'Your operative command center — monitor active epochs, browse simulation worlds, and track substrate anomalies.',
          );
          seoService.setCanonical('/dashboard');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Dashboard', url: 'https://metaverse.center/dashboard' },
          ]);
          analyticsService.trackPageView('/dashboard', document.title);
          return true;
        },
      },
      {
        path: '/multiverse',
        render: () => html`<velg-cartographer-map></velg-cartographer-map>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/multiverse/CartographerMap.js'))))
            return false;
          seoService.setTitle(['Multiverse Map']);
          seoService.setDescription(
            'Explore the multiverse map — view active simulations, connections, and live battle statistics.',
          );
          seoService.setCanonical('/multiverse');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Multiverse Map', url: 'https://metaverse.center/multiverse' },
          ]);
          analyticsService.trackPageView('/multiverse', document.title);
          return true;
        },
      },
      {
        path: '/epoch',
        render: () => html`<velg-epoch-command-center></velg-epoch-command-center>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/epoch/EpochCommandCenter.js'))))
            return false;
          seoService.setTitle(['Epoch Command Center']);
          seoService.setCanonical('/epoch');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Epoch', url: 'https://metaverse.center/epoch' },
          ]);
          analyticsService.trackPageView('/epoch', document.title);
          return true;
        },
      },
      {
        path: '/epoch/join',
        render: () => html`<velg-epoch-invite-accept-view></velg-epoch-invite-accept-view>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/epoch/EpochInviteAcceptView.js'))))
            return false;
          seoService.setTitle(['Epoch Summons']);
          seoService.setDescription(
            'Accept an epoch invitation — join competitive PvP operations and deploy your simulation.',
          );
          seoService.setCanonical('/epoch/join');
          analyticsService.trackPageView('/epoch/join', document.title);
          return true;
        },
      },
      {
        path: '/forge',
        render: () => html`<velg-forge-wizard></velg-forge-wizard>`,
        enter: async () => {
          const ok = await this._guardAuth();
          if (!ok) return false;
          if (!appState.canForge.value) {
            this._router.goto('/dashboard');
            return false;
          }
          if (!(await this._lazy(() => import('./components/forge/VelgForgeWizard.js'))))
            return false;
          seoService.setTitle(['The Simulation Forge']);
          seoService.setDescription(
            'Create new simulations with the Simulation Forge — design worlds, set parameters, and launch your game.',
          );
          seoService.setCanonical('/forge');
          analyticsService.trackPageView('/forge', document.title);
          return true;
        },
      },
      {
        path: '/how-to-play',
        render: () => html`<velg-how-to-play-landing></velg-how-to-play-landing>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/how-to-play/HowToPlayLanding.js'))))
            return false;
          // SEO handled inside component
          return true;
        },
      },
      {
        path: '/how-to-play/quickstart',
        render: () => html`<velg-how-to-play-quickstart></velg-how-to-play-quickstart>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/how-to-play/HowToPlayQuickstart.js'))))
            return false;
          return true;
        },
      },
      {
        path: '/how-to-play/guide',
        render: () => html`<velg-how-to-play-guide-hub></velg-how-to-play-guide-hub>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/how-to-play/HowToPlayGuideHub.js'))))
            return false;
          return true;
        },
      },
      {
        path: '/how-to-play/guide/:topic',
        render: ({ topic }) =>
          html`<velg-how-to-play-topic .topic=${topic ?? ''}></velg-how-to-play-topic>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/how-to-play/HowToPlayTopic.js'))))
            return false;
          return true;
        },
      },
      {
        path: '/how-to-play/competitive',
        render: () => html`<velg-how-to-play-war-room></velg-how-to-play-war-room>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/how-to-play/HowToPlayWarRoom.js'))))
            return false;
          return true;
        },
      },
      // Legacy /how-to-play/legacy route removed — monolith HowToPlayView.ts deleted.
      // All content migrated to Landing + Quickstart + GuideHub + Topic + WarRoom.
      {
        path: '/archives',
        render: () => html`<velg-bureau-archives></velg-bureau-archives>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/lore/BureauArchives.js'))))
            return false;
          seoService.setTitle(['Bureau Archives']);
          seoService.setDescription(
            'Declassified archives of the Bureau of Impossible Geography — the complete mythology of the Fracture, the Bleed, and the Convergence.',
          );
          seoService.setCanonical('/archives');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Archives', url: 'https://metaverse.center/archives' },
          ]);
          analyticsService.trackPageView('/archives', document.title);
          return true;
        },
      },
      {
        path: '/commendations',
        render: () => html`<velg-achievement-grid></velg-achievement-grid>`,
        enter: async () => {
          const ok = await this._guardAuth();
          if (!ok) return false;
          if (!(await this._lazy(() => import('./components/platform/VelgAchievementGrid.js'))))
            return false;
          seoService.setTitle(['Commendations']);
          seoService.setDescription(
            'Your operative commendations and earned badges across dungeons, epochs, and challenges.',
          );
          seoService.setCanonical('/commendations');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Dashboard', url: 'https://metaverse.center/dashboard' },
            { name: 'Commendations', url: 'https://metaverse.center/commendations' },
          ]);
          analyticsService.trackPageView('/commendations', document.title);
          return true;
        },
      },
      {
        path: '/archetypes/:archetypeId',
        render: ({ archetypeId }) =>
          html`<velg-archetype-detail .archetypeId=${archetypeId ?? ''}></velg-archetype-detail>`,
        enter: async () => {
          await this._authReady;
          if (
            !(await this._lazy(
              () => import('./components/archetypes/ArchetypeDetailView.js'),
            ))
          )
            return false;
          return true;
        },
      },
      {
        path: '/bureau/dispatch',
        render: () => html`<velg-bureau-dispatch-terminal></velg-bureau-dispatch-terminal>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/bureau/BureauDispatchView.js'))))
            return false;
          seoService.setTitle(['Bureau Dispatch Terminal']);
          seoService.setDescription(
            'Decode classified Bureau transmissions. Enter your cipher code to unlock declassified dispatches.',
          );
          seoService.setCanonical('/bureau/dispatch');
          analyticsService.trackPageView('/bureau/dispatch', document.title);
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
          seoService.setDescription(
            'Accept your invitation to join a simulation on metaverse.center.',
          );
          seoService.setCanonical('/invitations');
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
            seoService.setDescription(
              'Manage your operative profile, wallet, preferences, and account settings.',
            );
            seoService.setCanonical('/profile');
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
            seoService.setDescription(
              'Create a new simulation — build your world and launch it to the metaverse.',
            );
            seoService.setCanonical('/new-simulation');
            analyticsService.trackPageView('/new-simulation', document.title);
          }
          return ok;
        },
      },
      {
        path: '/admin',
        render: () => html`<velg-admin-panel></velg-admin-panel>`,
        enter: async () => {
          const ok = await this._guardAuth();
          if (!ok) return false;
          if (!appState.isPlatformAdmin.value) {
            this._router.goto('/dashboard');
            return false;
          }
          if (!(await this._lazy(() => import('./components/admin/AdminPanel.js')))) return false;
          seoService.setTitle(['Admin']);
          seoService.setDescription(
            'Platform administration — manage users, simulations, settings, and system health.',
          );
          seoService.setCanonical('/admin');
          analyticsService.trackPageView('/admin', document.title);
          return true;
        },
      },
      // --- Simulation-scoped routes (public read, auth for mutations) ---
      {
        path: '/simulations/:id/lore/:entitySlug',
        render: ({ id, entitySlug }) => this._renderSimulationView(id ?? '', 'lore', entitySlug),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'lore'),
      },
      {
        path: '/simulations/:id/lore',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'lore'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'lore'),
      },
      {
        path: '/simulations/:id/broadsheet',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'broadsheet'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'broadsheet'),
      },
      {
        path: '/simulations/:id/chronicle',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'chronicle'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'chronicle'),
      },
      {
        path: '/simulations/:id/health',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'health'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'health'),
      },
      {
        path: '/simulations/:id/pulse',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'pulse'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'pulse'),
      },
      // Entity slug routes BEFORE list routes (first-match routing)
      {
        path: '/simulations/:id/agents/:entitySlug',
        render: ({ id, entitySlug }) => this._renderSimulationView(id ?? '', 'agents', entitySlug),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'agents'),
      },
      {
        path: '/simulations/:id/buildings/:entitySlug',
        render: ({ id, entitySlug }) =>
          this._renderSimulationView(id ?? '', 'buildings', entitySlug),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'buildings'),
      },
      {
        path: '/simulations/:id/agents',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'agents'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'agents'),
      },
      {
        path: '/simulations/:id/buildings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'buildings'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'buildings'),
      },
      {
        path: '/simulations/:id/events',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'events'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'events'),
      },
      {
        path: '/simulations/:id/chat',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'chat'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'chat'),
      },
      {
        path: '/simulations/:id/social',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'social'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'social'),
      },
      {
        path: '/simulations/:id/locations',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'locations'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'locations'),
      },
      {
        path: '/simulations/:id/terminal',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'terminal'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'terminal'),
      },
      {
        path: '/simulations/:id/dungeon',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'dungeon'),
        enter: async ({ id }) => this._enterSimulationRoute(id, 'dungeon'),
      },
      {
        path: '/simulations/:id/settings',
        render: ({ id }) => this._renderSimulationView(id ?? '', 'settings'),
        enter: async ({ id }) => {
          const ok = await this._guardAuth();
          if (!ok) return false;
          return this._enterSimulationRoute(id, 'settings');
        },
      },
      {
        path: '/simulations/:id/epoch',
        render: () => html``,
        enter: async () => {
          await this._authReady;
          window.history.replaceState(null, '', '/epoch');
          this._router.goto('/epoch');
          return false;
        },
      },
      {
        path: '/worlds',
        render: () => html`<velg-worlds-gallery></velg-worlds-gallery>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/landing/WorldsGallery.js'))))
            return false;
          seoService.setTitle(['Explore Living Worlds']);
          seoService.setDescription(
            'Browse player-created civilizations — each with AI-powered characters, evolving cities, and stories that write themselves.',
          );
          seoService.setCanonical('/worlds');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Worlds', url: 'https://metaverse.center/worlds' },
          ]);
          analyticsService.trackPageView('/worlds', document.title);
          return true;
        },
      },
      {
        path: '/chronicles',
        render: () => html`<velg-chronicle-feed></velg-chronicle-feed>`,
        enter: async () => {
          await this._authReady;
          if (!(await this._lazy(() => import('./components/landing/ChronicleFeed.js'))))
            return false;
          seoService.setTitle(['The Chronicle Feed']);
          seoService.setDescription(
            'Every world writes its own newspaper. Read AI-generated broadsheets from active simulations — fiction tied to real gameplay events.',
          );
          seoService.setCanonical('/chronicles');
          seoService.setBreadcrumbs([
            { name: 'Home', url: 'https://metaverse.center/' },
            { name: 'Chronicles', url: 'https://metaverse.center/chronicles' },
          ]);
          analyticsService.trackPageView('/chronicles', document.title);
          return true;
        },
      },
      // --- Legal pages ---
      {
        path: '/privacy',
        render: () => html`<velg-content-page .slug=${'privacy'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          return true;
        },
      },
      {
        path: '/terms',
        render: () => html`<velg-content-page .slug=${'terms'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          return true;
        },
      },
      {
        path: '/data-deletion',
        render: () => html`<velg-content-page .slug=${'data-deletion'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          return true;
        },
      },
      // --- Content pages (landing + perspectives) ---
      {
        path: '/worldbuilding',
        render: () => html`<velg-content-page .slug=${'worldbuilding'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          analyticsService.trackPageView('/worldbuilding', document.title);
          return true;
        },
      },
      {
        path: '/ai-characters',
        render: () => html`<velg-content-page .slug=${'ai-characters'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          analyticsService.trackPageView('/ai-characters', document.title);
          return true;
        },
      },
      {
        path: '/strategy-game',
        render: () => html`<velg-content-page .slug=${'strategy-game'}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          analyticsService.trackPageView('/strategy-game', document.title);
          return true;
        },
      },
      {
        path: '/perspectives/:slug',
        render: ({ slug }) =>
          html`<velg-content-page .slug=${`perspectives/${slug}`}></velg-content-page>`,
        enter: async () => {
          await this._authReady;
          analyticsService.trackPageView(window.location.pathname, document.title);
          return true;
        },
      },
      {
        path: '/',
        render: () => html`<velg-landing-page></velg-landing-page>`,
        enter: async () => {
          await this._authReady;
          if (appState.isAuthenticated.value) {
            this._router.goto('/dashboard');
            return false;
          }
          seoService.setTitle(['Build a World. Watch It Live.']);
          seoService.setDescription(
            'Create AI-powered civilizations with characters who remember, cities that evolve, and stories that write themselves. Build your own world or explore others.',
          );
          seoService.setCanonical('/');
          analyticsService.trackPageView('/', document.title);
          return true;
        },
      },
    ],
    {
      fallback: {
        render: () => html`<velg-not-found></velg-not-found>`,
        enter: async () => {
          await import('./components/platform/NotFoundView.js');
          return true;
        },
      },
    },
  );

  @state() private _initializing = true;
  @state() private _showLoginPanel = false;
  @state() private _showOnboarding = false;
  @state() private _routeLoading = false;

  private _loadingTimer: ReturnType<typeof setTimeout> | undefined;

  /** Lazy-load a chunk with 200ms delayed progress bar. */
  private async _lazy(factory: () => Promise<unknown>): Promise<boolean> {
    this._loadingTimer = setTimeout(() => {
      this._routeLoading = true;
    }, 200);
    try {
      return await lazyRoute(factory);
    } finally {
      clearTimeout(this._loadingTimer);
      this._routeLoading = false;
    }
  }

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
    document.addEventListener('keydown', this._handleGlobalKeydown);
    await this._initAuth();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('navigate', this._handleNavigate as EventListener);
    this.removeEventListener('login-panel-open', this._handleLoginPanelOpen as EventListener);
    this.removeEventListener('login-panel-close', this._handleLoginPanelClose as EventListener);
    document.removeEventListener('keydown', this._handleGlobalKeydown);
  }

  /** Global Ctrl+K / Cmd+K → open command palette in header. */
  private _handleGlobalKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const header = this.shadowRoot?.querySelector('velg-platform-header');
      header?.dispatchEvent(new CustomEvent('open-command-palette'));
    }
  };

  private _handleNavigate = (e: CustomEvent<string>): void => {
    const fullPath = e.detail;
    seoService.removeServerContent();
    // Push the full path (with query/hash) into the browser URL
    const currentFull = window.location.pathname + window.location.search;
    if (fullPath !== currentFull) {
      window.history.pushState({}, '', fullPath);
    }
    // Lit Router matches on pathname only — strip query params and hash.
    // Target components read query params from window.location.search.
    const url = new URL(fullPath, window.location.origin);
    this._router.goto(url.pathname);
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
   * Awaits auth, resolves slug/UUID to a simulation, and determines membership
   * BEFORE render runs. This ensures API services route correctly (public vs
   * authenticated) based on `currentRole` being set.
   */
  private async _enterSimulationRoute(id: string | undefined, view?: string): Promise<boolean> {
    await this._authReady;
    if (id) {
      const resolved = await this._resolveSimulation(id);
      if (!resolved) {
        // Simulation not found — the fallback route will render velg-not-found
        return false;
      }
      await this._checkMembership(resolved);
    }
    if (view) {
      const importFn = getSimViewImport(view);
      if (importFn && !(await this._lazy(importFn))) return false;
    }
    return true;
  }

  /** Determine current user's membership role for a simulation. */
  private async _checkMembership(simulationId: string): Promise<void> {
    if (!appState.isAuthenticated.value) {
      appState.setCurrentRole(null);
      return;
    }
    const response = await membersApi.list(simulationId);
    if (response.success && response.data) {
      const members = Array.isArray(response.data) ? response.data : [];
      const userId = appState.user.value?.id;
      const me = members.find((m) => m.user_id === userId);
      appState.setCurrentRole(
        me ? (me.member_role as 'owner' | 'admin' | 'editor' | 'viewer') : null,
      );
    } else {
      appState.setCurrentRole(null);
    }
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
      await Promise.all([authService.initialize(), this._fetchMockMode()]);
      // After auth is ready, fetch /me (admin status + onboarding) before resolving
      // _authReady — route guards for /admin and /forge depend on isPlatformAdmin.
      if (appState.isAuthenticated.value) {
        await this._fetchOnboardingState();
      }
      // Load simulations for all users (public-first: guests browse too)
      this._loadSimulations();
    } finally {
      this._initializing = false;
      this._resolveAuthReady();
    }
  }

  /** Load simulations into appState — merges member + public for auth users. */
  private async _loadSimulations(): Promise<void> {
    try {
      if (appState.isAuthenticated.value) {
        const [memberResp, publicResp] = await Promise.all([
          simulationsApi.list(),
          simulationsApi.listPublic(),
        ]);
        const memberSims =
          memberResp.success && Array.isArray(memberResp.data)
            ? (memberResp.data as Simulation[])
            : [];
        const publicSims =
          publicResp.success && Array.isArray(publicResp.data)
            ? (publicResp.data as Simulation[])
            : [];
        const memberIds = new Set(memberSims.map((s) => s.id));
        appState.setMemberSimulationIds(memberIds);
        const community = publicSims.filter((s) => !memberIds.has(s.id));
        appState.setSimulations([...memberSims, ...community]);
      } else {
        const resp = await simulationsApi.listPublic();
        if (resp.success && Array.isArray(resp.data)) {
          appState.setSimulations(resp.data as Simulation[]);
        }
      }
    } catch {
      // Non-critical — dashboard fetches its own copy
    }
  }

  private async _fetchOnboardingState(): Promise<void> {
    try {
      const resp = await usersApi.getMe();
      if (resp.success && resp.data) {
        const data = resp.data as unknown as Record<string, unknown>;
        const completed = data.onboarding_completed !== false;
        appState.setOnboardingCompleted(completed);
        appState.setPlatformAdmin(data.is_platform_admin === true);
        if (!completed) {
          this._showOnboarding = true;
        }
        // Update GA4 with correct admin status now that /me has resolved
        const userType = appState.isPlatformAdmin.value
          ? 'admin'
          : appState.isArchitect.value
            ? 'architect'
            : 'member';
        analyticsService.setUserProperties({
          user_type: userType,
          has_forge_access: appState.canForge.value,
          locale: localeService.currentLocale,
        });
        // Admin: check pending clearance requests
        if (appState.isPlatformAdmin.value) {
          this._checkPendingForgeRequests();
        }
      }
    } catch {
      // Non-critical — default to onboarding completed
    }
  }

  private async _checkPendingForgeRequests(): Promise<void> {
    try {
      const countResp = await forgeApi.getPendingRequestCount();
      if (countResp.success && typeof countResp.data === 'number') {
        appState.setPendingForgeRequestCount(countResp.data);
        const toastKey = 'velg_admin_pending_toast_shown';
        if (countResp.data > 0 && !sessionStorage.getItem(toastKey)) {
          const { VelgToast } = await import('./components/shared/Toast.js');
          VelgToast.info(msg(str`${countResp.data} pending clearance request(s)`));
          sessionStorage.setItem(toastKey, '1');
        }
      }
    } catch {
      // Non-critical
    }
  }

  private async _fetchMockMode(): Promise<void> {
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const data = await res.json();
        appState.setMockMode(data.mock_mode === true);
      }
    } catch {
      // Health check failure is non-critical
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

    // Membership already determined in _enterSimulationRoute().
    // Load taxonomies + public settings (design + features use public endpoints via anon RLS).
    const [taxResponse, designResponse, featuresResponse] = await Promise.all([
      taxonomiesApi.list(simulationId, { limit: '500' }),
      settingsApi.list(simulationId, 'design'),
      settingsApi.list(simulationId, 'features'),
    ]);

    if (taxResponse.success && taxResponse.data) {
      appState.setTaxonomies(Array.isArray(taxResponse.data) ? taxResponse.data : []);
    }

    // Merge design + features settings into a single array
    const allSettings = [
      ...(designResponse.success && Array.isArray(designResponse.data) ? designResponse.data : []),
      ...(featuresResponse.success && Array.isArray(featuresResponse.data) ? featuresResponse.data : []),
    ];
    appState.setSettings(allSettings);
  }

  private _renderSimulationView(idOrSlug: string, view: string, entitySlug?: string) {
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
    const canonicalPath = entitySlug
      ? `/simulations/${slug}/${view}/${entitySlug}`
      : `/simulations/${slug}/${view}`;
    seoService.setTitle(simName ? [viewLabel, simName] : [viewLabel]);
    seoService.setCanonical(canonicalPath);
    if (sim?.description) {
      seoService.setDescription(sim.description);
    }
    if (sim?.banner_url) {
      seoService.setOgImage(sim.banner_url);
    }
    // Breadcrumbs: Home > Dashboard > SimName > View
    const breadcrumbs = [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Dashboard', url: 'https://metaverse.center/dashboard' },
    ];
    if (simName) {
      breadcrumbs.push({ name: simName, url: `https://metaverse.center/simulations/${slug}/lore` });
    }
    breadcrumbs.push({
      name: viewLabel,
      url: `https://metaverse.center/simulations/${slug}/${view}`,
    });
    seoService.setBreadcrumbs(breadcrumbs);
    analyticsService.trackPageView(canonicalPath, document.title);

    // Safety fallback: if slug resolution somehow failed, show bare loading spinner
    // (without SimulationShell, to prevent ThemeService 422s on non-UUID)
    if (!VelgApp._UUID_RE.test(resolvedId)) {
      return html`<div class="loading-container">${msg('Loading...')}</div>`;
    }

    let content: TemplateResult;
    switch (view) {
      case 'lore':
        content = html`<velg-simulation-lore-view .simulationId=${resolvedId} .entitySlug=${entitySlug ?? ''}></velg-simulation-lore-view>`;
        break;
      case 'broadsheet':
        content = html`<velg-simulation-broadsheet .simulationId=${resolvedId}></velg-simulation-broadsheet>`;
        break;
      case 'chronicle':
        content = html`<velg-chronicle-view .simulationId=${resolvedId}></velg-chronicle-view>`;
        break;
      case 'health':
        content = html`<velg-simulation-health-view .simulationId=${resolvedId}></velg-simulation-health-view>`;
        break;
      case 'pulse':
        content = html`<velg-simulation-pulse .simulationId=${resolvedId}></velg-simulation-pulse>`;
        break;
      case 'agents':
        content = html`<velg-agents-view .simulationId=${resolvedId} .entitySlug=${entitySlug ?? ''}></velg-agents-view>`;
        break;
      case 'buildings':
        content = html`<velg-buildings-view .simulationId=${resolvedId} .entitySlug=${entitySlug ?? ''}></velg-buildings-view>`;
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
      case 'terminal':
        content = html`<velg-terminal-view .simulationId=${resolvedId}></velg-terminal-view>`;
        break;
      case 'dungeon':
        content = html`<velg-dungeon-terminal-view .simulationId=${resolvedId}></velg-dungeon-terminal-view>`;
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
      <velg-simulation-shell .simulationId=${resolvedId} .view=${view}>
        ${content}
      </velg-simulation-shell>
    `;
  }

  protected render() {
    if (this._initializing) {
      return html`<div class="loading-container">${msg('Loading...')}</div>`;
    }

    const isGuest = !appState.isAuthenticated.value;
    const isLanding = window.location.pathname === '/';

    return html`
      <a class="skip-nav" href="#main-content">${msg('Skip to main content')}</a>
      ${isGuest && !isLanding ? html`<velg-guest-banner></velg-guest-banner>` : nothing}
      ${this._routeLoading ? html`<div class="route-progress"></div>` : nothing}
      <velg-platform-header></velg-platform-header>
      <main class="app-main" id="main-content">
        ${this._router.outlet()}
      </main>
      ${this._showLoginPanel ? html`<velg-login-panel></velg-login-panel>` : nothing}
      ${
        this._showOnboarding
          ? html`
        <velg-onboarding-wizard
          .open=${true}
          @onboarding-complete=${this._handleOnboardingComplete}
          @onboarding-start-academy=${this._handleOnboardingAcademy}
          @onboarding-create-simulation=${this._handleOnboardingCreateSim}
          @onboarding-browse=${this._handleOnboardingBrowse}
        ></velg-onboarding-wizard>
      `
          : nothing
      }
      <velg-cookie-consent></velg-cookie-consent>
      <velg-achievement-toast></velg-achievement-toast>
    `;
  }

  private _handleOnboardingComplete(): void {
    this._showOnboarding = false;
  }

  private _handleOnboardingAcademy(): void {
    this._showOnboarding = false;
    epochsApi
      .createQuickAcademy()
      .then((resp) => {
        if (resp.success && resp.data) {
          window.history.pushState({}, '', `/epochs/${resp.data.id}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      })
      .catch(() => {});
  }

  private _handleOnboardingCreateSim(): void {
    this._showOnboarding = false;
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
    // CreateSimulationWizard is opened from the dashboard
  }

  private _handleOnboardingBrowse(): void {
    this._showOnboarding = false;
    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-app': VelgApp;
  }
}
