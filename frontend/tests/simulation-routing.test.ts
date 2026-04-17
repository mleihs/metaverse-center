// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsService } from '../src/services/AnalyticsService.js';
import { applySimulationRouteMeta } from '../src/services/seo-patterns.js';
import type { Simulation } from '../src/types/index.js';

/**
 * Characterization tests for `applySimulationRouteMeta`.
 *
 * This function is the single pre-render seam for simulation routes. It
 * encapsulates the complete side effect of landing on a simulation route:
 * SEO meta (title, description, canonical, og:image), JSON-LD breadcrumbs,
 * and the GA4 page_view event.
 *
 * Locking in the contract before W1.1c (move call site from render to enter)
 * guarantees the refactor is a pure call-site move with no behavior change.
 *
 * Contract covered:
 * - List route (no entitySlug)   → canonical points to list URL.
 * - Entity route (entitySlug)    → canonical points to entity URL.
 * - Pre-resolution fallback      → minimal title + canonical using fallbackSlug.
 * - Breadcrumbs                  → Home > Dashboard > [SimName?] > View.
 * - Analytics                    → trackPageView(canonicalPath, document.title).
 */

// ── Test fixtures ────────────────────────────────────────────────────

const SIM: Simulation = {
  id: '12345678-1234-1234-1234-123456789abc',
  name: 'Velgarien',
  slug: 'velgarien',
  description: 'A shadow-haunted world.',
  theme: 'brutalist',
  status: 'active',
  simulation_type: 'game_instance',
  content_locale: 'en',
  additional_locales: [],
  owner_id: '00000000-0000-0000-0000-000000000000',
  created_at: '2026-04-17T00:00:00Z',
  updated_at: '2026-04-17T00:00:00Z',
} as Simulation;

const SIM_WITH_BANNER: Simulation = {
  ...SIM,
  banner_url: 'https://example.com/banner.webp',
} as Simulation;

// ── Test setup ───────────────────────────────────────────────────────

function setupDocumentHead(): void {
  document.title = 'metaverse.center \u2013 Multiplayer Worldbuilding & Strategy Platform';

  for (const el of document.querySelectorAll(
    'meta[name], meta[property], link[rel="canonical"], script[type="application/ld+json"]',
  )) {
    el.remove();
  }

  const defaults = [
    { kind: 'name', key: 'description', value: 'default' },
    { kind: 'property', key: 'og:title', value: 'default' },
    { kind: 'property', key: 'og:description', value: 'default' },
    { kind: 'property', key: 'og:url', value: 'https://metaverse.center/' },
    { kind: 'property', key: 'og:image', value: 'default' },
    { kind: 'property', key: 'og:image:alt', value: 'default' },
    { kind: 'property', key: 'og:type', value: 'website' },
    { kind: 'name', key: 'twitter:title', value: 'default' },
    { kind: 'name', key: 'twitter:description', value: 'default' },
    { kind: 'name', key: 'twitter:image', value: 'default' },
    { kind: 'name', key: 'twitter:image:alt', value: 'default' },
    { kind: 'name', key: 'robots', value: 'index, follow' },
  ];
  for (const m of defaults) {
    const el = document.createElement('meta');
    if (m.kind === 'name') el.name = m.key;
    else el.setAttribute('property', m.key);
    el.content = m.value;
    document.head.appendChild(el);
  }

  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://metaverse.center/';
  document.head.appendChild(canonical);
}

function resetDocumentHead(): void {
  for (const el of document.querySelectorAll(
    'meta[name], meta[property], link[rel="canonical"], script[type="application/ld+json"]',
  )) {
    el.remove();
  }
}

function getCanonical(): string {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '';
}

function getBreadcrumbNames(): string[] {
  const script = document.getElementById('velg-breadcrumbs');
  if (!script?.textContent) return [];
  const data = JSON.parse(script.textContent) as {
    itemListElement: Array<{ name: string }>;
  };
  return data.itemListElement.map((i) => i.name);
}

function getBreadcrumbData(): {
  '@type': string;
  itemListElement: Array<{ name: string; item: string; position: number }>;
} | null {
  const script = document.getElementById('velg-breadcrumbs');
  if (!script?.textContent) return null;
  return JSON.parse(script.textContent);
}

// ── List-route tests ─────────────────────────────────────────────────

describe('applySimulationRouteMeta — list route (no entitySlug)', () => {
  beforeEach(() => {
    setupDocumentHead();
  });

  afterEach(() => {
    resetDocumentHead();
    vi.restoreAllMocks();
  });

  it('sets canonical link to list URL', () => {
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    expect(getCanonical()).toBe('https://metaverse.center/simulations/velgarien/agents');
  });

  it('sets title with capitalized view + sim name', () => {
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    expect(document.title).toContain('Agents');
    expect(document.title).toContain('Velgarien');
  });

  it('sets description from simulation', () => {
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    expect(desc?.content).toBe(SIM.description);
  });

  it('sets og:image when simulation has banner_url', () => {
    applySimulationRouteMeta(SIM_WITH_BANNER, 'agents', undefined, 'velgarien');
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    expect(ogImage?.content).toBe('https://example.com/banner.webp');
  });

  it('emits BreadcrumbList: Home > Dashboard > SimName > ViewLabel', () => {
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    expect(getBreadcrumbNames()).toEqual(['Home', 'Dashboard', 'Velgarien', 'Agents']);
  });

  it('breadcrumb JSON-LD has BreadcrumbList @type and absolute URLs', () => {
    applySimulationRouteMeta(SIM, 'lore', undefined, 'velgarien');
    const data = getBreadcrumbData();
    expect(data).not.toBeNull();
    expect(data!['@type']).toBe('BreadcrumbList');
    const urls = data!.itemListElement.map((i) => i.item);
    expect(urls).toEqual([
      'https://metaverse.center/',
      'https://metaverse.center/dashboard',
      'https://metaverse.center/simulations/velgarien/lore',
      'https://metaverse.center/simulations/velgarien/lore',
    ]);
  });

  it('tracks page_view with the list canonical path', () => {
    const spy = vi.spyOn(analyticsService, 'trackPageView').mockImplementation(() => {});
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('/simulations/velgarien/agents', expect.any(String));
  });
});

// ── Entity-route tests ───────────────────────────────────────────────

describe('applySimulationRouteMeta — entity route (entitySlug present)', () => {
  beforeEach(() => {
    setupDocumentHead();
  });

  afterEach(() => {
    resetDocumentHead();
    vi.restoreAllMocks();
  });

  it('sets canonical link to entity URL (overrides list canonical)', () => {
    applySimulationRouteMeta(SIM, 'agents', 'ada-sternwald', 'velgarien');
    expect(getCanonical()).toBe(
      'https://metaverse.center/simulations/velgarien/agents/ada-sternwald',
    );
  });

  it('still sets title + description (baseline meta unchanged by entity presence)', () => {
    applySimulationRouteMeta(SIM, 'agents', 'ada-sternwald', 'velgarien');
    expect(document.title).toContain('Agents');
    expect(document.title).toContain('Velgarien');
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    expect(desc?.content).toBe(SIM.description);
  });

  it('emits breadcrumbs to the view list (entity level is applied by child component)', () => {
    applySimulationRouteMeta(SIM, 'agents', 'ada-sternwald', 'velgarien');
    expect(getBreadcrumbNames()).toEqual(['Home', 'Dashboard', 'Velgarien', 'Agents']);
  });

  it('tracks page_view with the entity canonical path', () => {
    const spy = vi.spyOn(analyticsService, 'trackPageView').mockImplementation(() => {});
    applySimulationRouteMeta(SIM, 'agents', 'ada-sternwald', 'velgarien');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      '/simulations/velgarien/agents/ada-sternwald',
      expect.any(String),
    );
  });
});

// ── Pre-resolution fallback tests ────────────────────────────────────

describe('applySimulationRouteMeta — pre-resolution fallback (sim undefined)', () => {
  beforeEach(() => {
    setupDocumentHead();
  });

  afterEach(() => {
    resetDocumentHead();
    vi.restoreAllMocks();
  });

  it('uses fallbackSlug for canonical when sim is undefined', () => {
    applySimulationRouteMeta(undefined, 'lore', undefined, 'unknown-slug');
    expect(getCanonical()).toBe('https://metaverse.center/simulations/unknown-slug/lore');
  });

  it('sets minimal title with view label only (no sim name to embed)', () => {
    applySimulationRouteMeta(undefined, 'lore', undefined, 'unknown-slug');
    expect(document.title).toContain('Lore');
    expect(document.title).not.toContain('Velgarien');
  });

  it('breadcrumbs skip sim-name entry when sim is undefined', () => {
    applySimulationRouteMeta(undefined, 'lore', undefined, 'unknown-slug');
    expect(getBreadcrumbNames()).toEqual(['Home', 'Dashboard', 'Lore']);
  });

  it('entity-scoped fallback still includes entity slug in canonical', () => {
    applySimulationRouteMeta(undefined, 'agents', 'some-entity', 'unknown-slug');
    expect(getCanonical()).toBe(
      'https://metaverse.center/simulations/unknown-slug/agents/some-entity',
    );
  });

  it('tracks page_view with fallback-slug canonical', () => {
    const spy = vi.spyOn(analyticsService, 'trackPageView').mockImplementation(() => {});
    applySimulationRouteMeta(undefined, 'lore', undefined, 'unknown-slug');
    expect(spy).toHaveBeenCalledWith('/simulations/unknown-slug/lore', expect.any(String));
  });
});

// ── View capitalization tests ────────────────────────────────────────

describe('applySimulationRouteMeta — view capitalization', () => {
  beforeEach(() => {
    setupDocumentHead();
  });

  afterEach(() => {
    resetDocumentHead();
    vi.restoreAllMocks();
  });

  it('capitalizes single-word view in breadcrumb label', () => {
    applySimulationRouteMeta(SIM, 'agents', undefined, 'velgarien');
    expect(getBreadcrumbNames().at(-1)).toBe('Agents');
  });

  it('capitalizes only first letter (does not touch the rest)', () => {
    applySimulationRouteMeta(SIM, 'broadsheet', undefined, 'velgarien');
    expect(getBreadcrumbNames().at(-1)).toBe('Broadsheet');
  });
});
