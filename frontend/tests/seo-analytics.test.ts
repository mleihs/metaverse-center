// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventMapping } from '../src/services/AnalyticsService.js';
import { agentAltText, buildingAltText } from '../src/utils/text.js';

// ── Alt Text Utilities ───────────────────────────────────────────────

describe('agentAltText', () => {
  it('returns name only when no other fields', () => {
    expect(agentAltText({ name: 'Viktor' })).toBe('Portrait of Viktor');
  });

  it('includes profession when available', () => {
    const result = agentAltText({ name: 'Viktor', primary_profession: 'Commander' });
    expect(result).toBe('Portrait of Viktor – Commander');
  });

  it('includes character and background', () => {
    const result = agentAltText({
      name: 'Viktor',
      character: 'Stern and disciplined',
      background: 'Former garrison leader',
    });
    expect(result).toBe('Portrait of Viktor – Stern and disciplined – Former garrison leader');
  });

  it('includes all fields in correct order', () => {
    const result = agentAltText({
      name: 'Viktor',
      primary_profession: 'Commander',
      character: 'Stern',
      background: 'Military veteran',
    });
    expect(result).toBe('Portrait of Viktor – Commander – Stern – Military veteran');
  });

  it('skips undefined fields', () => {
    const result = agentAltText({
      name: 'Viktor',
      primary_profession: undefined,
      character: 'Stern',
      background: undefined,
    });
    expect(result).toBe('Portrait of Viktor – Stern');
  });
});

describe('buildingAltText', () => {
  it('returns name only when no other fields', () => {
    expect(buildingAltText({ name: 'Rathaus' })).toBe('Rathaus');
  });

  it('includes building type', () => {
    const result = buildingAltText({ name: 'Rathaus', building_type: 'government' });
    expect(result).toBe('Rathaus – government');
  });

  it('includes zone with "in" prefix', () => {
    const result = buildingAltText({
      name: 'Rathaus',
      zone: { name: 'Altstadt' },
    });
    expect(result).toBe('Rathaus – in Altstadt');
  });

  it('includes description and condition', () => {
    const result = buildingAltText({
      name: 'Rathaus',
      description: 'City hall building',
      building_condition: 'good',
    });
    expect(result).toBe('Rathaus – City hall building – condition: good');
  });

  it('includes all fields in correct order', () => {
    const result = buildingAltText({
      name: 'Rathaus',
      building_type: 'government',
      description: 'City hall',
      building_condition: 'good',
      zone: { name: 'Altstadt' },
    });
    expect(result).toBe('Rathaus – government – in Altstadt – City hall – condition: good');
  });

  it('handles null zone', () => {
    const result = buildingAltText({ name: 'Rathaus', zone: null });
    expect(result).toBe('Rathaus');
  });
});

// ── SeoService ───────────────────────────────────────────────────────

describe('SeoService', () => {
  let seoService: typeof import('../src/services/SeoService.js')['seoService'];

  beforeEach(async () => {
    // Reset DOM between tests
    document.title = 'metaverse.center \u2013 Multiplayer Worldbuilding & Strategy Platform';

    // Remove any existing meta tags
    for (const el of document.querySelectorAll('meta[name], meta[property], link[rel="canonical"]')) {
      el.remove();
    }

    // Add default meta tags that SeoService expects
    const desc = document.createElement('meta');
    desc.name = 'description';
    desc.content = 'default';
    document.head.appendChild(desc);

    const ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.content = 'default';
    document.head.appendChild(ogTitle);

    const ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    ogDesc.content = 'default';
    document.head.appendChild(ogDesc);

    const ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    ogUrl.content = 'https://metaverse.center/';
    document.head.appendChild(ogUrl);

    const ogImage = document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    ogImage.content = 'default';
    document.head.appendChild(ogImage);

    const twTitle = document.createElement('meta');
    twTitle.name = 'twitter:title';
    twTitle.content = 'default';
    document.head.appendChild(twTitle);

    const twDesc = document.createElement('meta');
    twDesc.name = 'twitter:description';
    twDesc.content = 'default';
    document.head.appendChild(twDesc);

    const twImage = document.createElement('meta');
    twImage.name = 'twitter:image';
    twImage.content = 'default';
    document.head.appendChild(twImage);

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://metaverse.center/';
    document.head.appendChild(canonical);

    // Fresh import to get a clean singleton
    const mod = await import('../src/services/SeoService.js');
    seoService = mod.seoService;
  });

  afterEach(() => {
    for (const el of document.querySelectorAll('meta[name], meta[property], link[rel="canonical"]')) {
      el.remove();
    }
  });

  it('setTitle with parts joins with separator', () => {
    seoService.setTitle(['Agents', 'Station Null']);
    expect(document.title).toBe('Agents \u2013 Station Null | metaverse.center');
  });

  it('setTitle with empty array sets default', () => {
    seoService.setTitle([]);
    expect(document.title).toBe('metaverse.center \u2013 Multiplayer Worldbuilding & Strategy Platform');
  });

  it('setTitle with single part', () => {
    seoService.setTitle(['Sign In']);
    expect(document.title).toBe('Sign In | metaverse.center');
  });

  it('setTitle updates og:title and twitter:title', () => {
    seoService.setTitle(['Buildings', 'Velgarien']);
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const twTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    expect(ogTitle?.content).toBe('Buildings \u2013 Velgarien | metaverse.center');
    expect(twTitle?.content).toBe('Buildings \u2013 Velgarien | metaverse.center');
  });

  it('setDescription updates all three meta tags', () => {
    seoService.setDescription('A dark simulation');
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const twDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    expect(desc?.content).toBe('A dark simulation');
    expect(ogDesc?.content).toBe('A dark simulation');
    expect(twDesc?.content).toBe('A dark simulation');
  });

  it('setCanonical updates link and og:url', () => {
    seoService.setCanonical('/simulations/abc/agents');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    expect(canonical?.href).toBe('https://metaverse.center/simulations/abc/agents');
    expect(ogUrl?.content).toBe('https://metaverse.center/simulations/abc/agents');
  });

  it('setOgImage updates og:image and twitter:image', () => {
    seoService.setOgImage('https://example.com/img.webp');
    const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    const twImg = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    expect(ogImg?.content).toBe('https://example.com/img.webp');
    expect(twImg?.content).toBe('https://example.com/img.webp');
  });

  it('reset restores all defaults', () => {
    seoService.setTitle(['Test']);
    seoService.setDescription('Custom');
    seoService.reset();
    expect(document.title).toBe('metaverse.center \u2013 Multiplayer Worldbuilding & Strategy Platform');
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    expect(desc?.content).toContain('Build civilizations');
  });

  it('creates meta element if not found', () => {
    // Remove og:title and re-set it
    document.querySelector('meta[property="og:title"]')?.remove();
    seoService.setTitle(['New']);
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    expect(ogTitle).not.toBeNull();
    expect(ogTitle?.content).toBe('New | metaverse.center');
  });
});

// ── AnalyticsService ─────────────────────────────────────────────────

describe('AnalyticsService', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset window globals
    delete (window as Record<string, unknown>).dataLayer;
    delete (window as Record<string, unknown>).gtag;
  });

  afterEach(() => {
    localStorage.clear();
    // Remove any injected gtag scripts
    for (const el of document.querySelectorAll('script[src*="googletagmanager"]')) {
      el.remove();
    }
    vi.restoreAllMocks();
  });

  it('hasConsentChoice returns false when no choice made', async () => {
    const { analyticsService } = await import('../src/services/AnalyticsService.js');
    expect(analyticsService.hasConsentChoice()).toBe(false);
  });

  it('grantConsent persists to localStorage', async () => {
    const { analyticsService } = await import('../src/services/AnalyticsService.js');
    analyticsService.grantConsent();
    expect(localStorage.getItem('analytics-consent')).toBe('granted');
  });

  it('revokeConsent persists to localStorage', async () => {
    const { analyticsService } = await import('../src/services/AnalyticsService.js');
    analyticsService.revokeConsent();
    expect(localStorage.getItem('analytics-consent')).toBe('denied');
  });

  it('hasConsentChoice returns true after granting', async () => {
    const { analyticsService } = await import('../src/services/AnalyticsService.js');
    analyticsService.grantConsent();
    expect(analyticsService.hasConsentChoice()).toBe(true);
  });

  it('hasConsentChoice returns true after revoking', async () => {
    const { analyticsService } = await import('../src/services/AnalyticsService.js');
    analyticsService.revokeConsent();
    expect(analyticsService.hasConsentChoice()).toBe(true);
  });
});

// ── AnalyticsService — Event Hub ─────────────────────────────────────

describe('AnalyticsService — Event Hub', () => {
  let analyticsService: typeof import('../src/services/AnalyticsService.js')['analyticsService'];
  let EVENT_MAP: EventMapping[];
  let gtagCalls: unknown[][];

  beforeEach(async () => {
    localStorage.clear();
    delete (window as Record<string, unknown>).dataLayer;
    delete (window as Record<string, unknown>).gtag;

    vi.resetModules();

    // Set up gtag capture before importing
    gtagCalls = [];
    window.gtag = (...args: unknown[]) => {
      gtagCalls.push(args);
    };

    const mod = await import('../src/services/AnalyticsService.js');
    analyticsService = mod.analyticsService;
    EVENT_MAP = mod.EVENT_MAP;
  });

  /** Bypass PROD guard — directly set _initialized and register listeners. */
  function initForTest() {
    (analyticsService as any)._initialized = true;
    (analyticsService as any)._registerEventListeners();
  }

  afterEach(() => {
    analyticsService.dispose();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('trackEvent is a no-op when not initialized', () => {
    analyticsService.trackEvent('test_event', { foo: 'bar' });
    const testCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'test_event');
    expect(testCalls).toHaveLength(0);
  });

  it('trackEvent sends gtag event with params when initialized', () => {
    initForTest();
    analyticsService.trackEvent('test_event', { key: 'value' });
    const testCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'test_event');
    expect(testCalls).toHaveLength(1);
    expect(testCalls[0][2]).toEqual({ key: 'value' });
  });

  it('registers document listeners on init', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    initForTest();
    const registeredEvents = addSpy.mock.calls.map((c) => c[0]);
    for (const mapping of EVENT_MAP) {
      expect(registeredEvents).toContain(mapping.domEvent);
    }
  });

  it('tracks custom events via EVENT_MAP', () => {
    initForTest();
    document.dispatchEvent(new CustomEvent('send-message', { detail: {} }));
    const msgCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'send_chat_message');
    expect(msgCalls).toHaveLength(1);
  });

  it('extracts params from event detail', () => {
    initForTest();
    document.dispatchEvent(
      new CustomEvent('agent-click', { detail: { name: 'Viktor' } }),
    );
    const agentCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'view_agent');
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0][2]).toEqual({ agent_name: 'Viktor' });
  });

  it('dispose removes all listeners', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    initForTest();
    analyticsService.dispose();
    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    for (const mapping of EVENT_MAP) {
      expect(removedEvents).toContain(mapping.domEvent);
    }
    // After dispose, dispatching should not trigger tracking
    gtagCalls = [];
    document.dispatchEvent(new CustomEvent('agent-click', { detail: { name: 'Test' } }));
    const agentCalls = gtagCalls.filter((c) => c[0] === 'event' && c[1] === 'view_agent');
    expect(agentCalls).toHaveLength(0);
  });
});
