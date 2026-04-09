declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const CONSENT_KEY = 'analytics-consent';

/** Safely extract a string/number property from a CustomEvent detail object. */
function _s(d: unknown, key: string): string {
  if (d && typeof d === 'object' && key in d)
    return String((d as Record<string, unknown>)[key] ?? '');
  return '';
}
function _n(d: unknown, key: string): number {
  if (d && typeof d === 'object' && key in d)
    return Number((d as Record<string, unknown>)[key]) || 0;
  return 0;
}

interface EventMapping {
  domEvent: string;
  gaEvent: string;
  params?: (detail: unknown) => Record<string, string | number | boolean>;
}

const EVENT_MAP: EventMapping[] = [
  // Entity detail views
  {
    domEvent: 'agent-click',
    gaEvent: 'view_agent',
    params: (d) => ({ agent_name: _s(d, 'name') }),
  },
  {
    domEvent: 'building-click',
    gaEvent: 'view_building',
    params: (d) => ({ building_name: _s(d, 'name') }),
  },
  {
    domEvent: 'event-click',
    gaEvent: 'view_event',
    params: (d) => ({ event_title: _s(d, 'title') }),
  },
  {
    domEvent: 'campaign-click',
    gaEvent: 'view_campaign',
    params: (d) => ({ campaign_name: _s(d, 'name') }),
  },
  {
    domEvent: 'simulation-click',
    gaEvent: 'select_simulation',
    params: (d) => ({ simulation_name: _s(d, 'name') }),
  },

  // Entity CRUD
  {
    domEvent: 'agent-saved',
    gaEvent: 'save_agent',
    params: (d) => ({ agent_name: _s(d, 'name') }),
  },
  {
    domEvent: 'building-saved',
    gaEvent: 'save_building',
    params: (d) => ({ building_name: _s(d, 'name') }),
  },
  { domEvent: 'event-saved', gaEvent: 'save_event' },
  { domEvent: 'location-saved', gaEvent: 'save_location' },
  { domEvent: 'settings-saved', gaEvent: 'save_settings' },

  // Entity delete intent
  {
    domEvent: 'agent-delete',
    gaEvent: 'delete_agent',
    params: (d) => ({ agent_name: _s(d, 'name') }),
  },
  {
    domEvent: 'building-delete',
    gaEvent: 'delete_building',
    params: (d) => ({ building_name: _s(d, 'name') }),
  },
  { domEvent: 'event-delete', gaEvent: 'delete_event' },

  // Edit modals
  {
    domEvent: 'agent-edit',
    gaEvent: 'open_edit_modal',
    params: (d) => ({ entity_type: 'agent', entity_name: _s(d, 'name') }),
  },
  {
    domEvent: 'building-edit',
    gaEvent: 'open_edit_modal',
    params: (d) => ({ entity_type: 'building', entity_name: _s(d, 'name') }),
  },
  {
    domEvent: 'event-edit',
    gaEvent: 'open_edit_modal',
    params: (d) => ({ entity_type: 'event', entity_name: _s(d, 'title') }),
  },

  // Chat
  { domEvent: 'send-message', gaEvent: 'send_chat_message' },
  {
    domEvent: 'agents-selected',
    gaEvent: 'select_chat_agents',
    params: (d) => ({ count: Array.isArray(d) ? d.length : 0 }),
  },
  { domEvent: 'conversation-select', gaEvent: 'select_conversation' },

  // Social / Trends
  {
    domEvent: 'trend-transform',
    gaEvent: 'transform_trend',
    params: (d) => ({ trend_title: _s(d, 'title') }),
  },
  {
    domEvent: 'trend-integrate',
    gaEvent: 'integrate_trend',
    params: (d) => ({ trend_title: _s(d, 'title') }),
  },
  { domEvent: 'post-transform', gaEvent: 'transform_post' },
  { domEvent: 'post-analyze', gaEvent: 'analyze_post' },
  { domEvent: 'transform-complete', gaEvent: 'transform_complete' },

  // Location drill-down
  {
    domEvent: 'city-select',
    gaEvent: 'select_city',
    params: (d) => ({ city_name: _s(d, 'name') }),
  },
  {
    domEvent: 'zone-select',
    gaEvent: 'select_zone',
    params: (d) => ({ zone_name: _s(d, 'name') }),
  },

  // Search / Filter
  {
    domEvent: 'filter-change',
    gaEvent: 'apply_filter',
    params: (d) => ({
      search: _s(d, 'search'),
      filter_count: _n(d, 'filter_count'),
    }),
  },

  // Media
  {
    domEvent: 'lightbox-open',
    gaEvent: 'view_lightbox_image',
    params: (d) => ({ alt: _s(d, 'alt'), caption: _s(d, 'caption') }),
  },

  // Auth UI
  { domEvent: 'login-panel-open', gaEvent: 'open_login_panel' },

  // Landing page
  {
    domEvent: 'landing-cta-click',
    gaEvent: 'landing_cta_click',
    params: (d) => ({ location: _s(d, 'location') }),
  },
  {
    domEvent: 'landing-section-view',
    gaEvent: 'landing_section_view',
    params: (d) => ({ section: _s(d, 'section') }),
  },

  // Funnel events
  { domEvent: 'onboarding-complete', gaEvent: 'tutorial_complete' },
  {
    domEvent: 'simulation-created',
    gaEvent: 'create_simulation',
    params: (d) => ({ simulation_name: _s(d, 'name') }),
  },
  { domEvent: 'invitation-accepted', gaEvent: 'accept_invitation' },
  { domEvent: 'epoch-joined', gaEvent: 'join_epoch' },
];

class AnalyticsService {
  private _initialized = false;
  private _measurementId: string;
  private _listeners: Array<{ event: string; handler: EventListener }> = [];

  constructor() {
    this._measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID ?? '';
  }

  /** Initialize GA4 with consent mode v2.
   *
   * Sets up the dataLayer queue immediately (so events are buffered),
   * but defers the actual gtag.js script load until the main thread is
   * idle. This avoids blocking LCP/FCP while preserving all event data
   * — the dataLayer queue is processed retroactively when gtag.js loads.
   */
  init(): void {
    if (this._initialized || !this._measurementId || !import.meta.env.PROD) return;
    this._initialized = true;

    // Set up dataLayer queue immediately — events are buffered until gtag.js loads.
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };

    // TEMPORARY: default granted to verify GA4 data flow (revert after confirmed)
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    // Restore previous consent choice
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === 'granted') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }

    // Pre-configure GA4 (queued in dataLayer, processed when gtag.js loads)
    window.gtag('js', new Date());
    window.gtag('config', this._measurementId, {
      send_page_view: false,
      link_attribution: true,
    });

    // Defer the heavy gtag.js script load until main thread is idle.
    // Safari lacks requestIdleCallback — setTimeout(fn, 1) is equivalent.
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
    schedule(() => this._loadGtagScript(), { timeout: 3000 } as IdleRequestOptions);

    this._initWebVitals();
    this._registerEventListeners();
  }

  /** Inject the gtag.js script tag. Called after main thread is idle. */
  private _loadGtagScript(): void {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this._measurementId}`;
    document.head.appendChild(script);
  }

  /** Set GA4 user properties for audience segmentation. */
  setUserProperties(props: Record<string, string | number | boolean>): void {
    if (!this._initialized) return;
    window.gtag('set', 'user_properties', props);
  }

  /** Send a custom GA4 event. */
  trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
    if (!this._initialized) return;
    window.gtag('event', name, params);
  }

  /** Send a manual page_view event (called on SPA route changes). */
  trackPageView(path: string, title: string): void {
    if (!this._initialized) return;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  }

  /** Grant analytics consent and persist the choice. */
  grantConsent(): void {
    localStorage.setItem(CONSENT_KEY, 'granted');
    if (this._initialized) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    this.trackEvent('consent_granted');
  }

  /** Revoke analytics consent and persist the choice. */
  revokeConsent(): void {
    localStorage.setItem(CONSENT_KEY, 'denied');
    if (this._initialized) {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    this.trackEvent('consent_revoked');
  }

  /** Check if the user has made a consent choice. */
  hasConsentChoice(): boolean {
    return localStorage.getItem(CONSENT_KEY) !== null;
  }

  /** Remove all document listeners. For tests. */
  dispose(): void {
    for (const { event, handler } of this._listeners) {
      document.removeEventListener(event, handler);
    }
    this._listeners = [];
    this._initialized = false;
  }

  private _initWebVitals(): void {
    import('web-vitals').then(({ onCLS, onLCP, onINP, onTTFB }) => {
      const send = ({ name, value, id }: { name: string; value: number; id: string }) => {
        this.trackEvent('web_vitals', { metric_name: name, metric_value: value, metric_id: id });
      };
      onCLS(send);
      onLCP(send);
      onINP(send);
      onTTFB(send);
    });
  }

  private _registerEventListeners(): void {
    for (const mapping of EVENT_MAP) {
      const handler = ((e: CustomEvent) => {
        const params = mapping.params ? mapping.params(e.detail) : undefined;
        this.trackEvent(mapping.gaEvent, params);
      }) as EventListener;

      document.addEventListener(mapping.domEvent, handler);
      this._listeners.push({ event: mapping.domEvent, handler });
    }
  }
}

export type { EventMapping };
export { EVENT_MAP };
export const analyticsService = new AnalyticsService();
