/**
 * Content page registry — maps slugs to lazy-loaded content getter functions.
 *
 * Each entry is an async factory that dynamically imports the content module
 * and calls its getter (not a const, because msg() must evaluate at render time).
 */

import type { ContentPageData } from './content-types.js';

type ContentGetter = () => Promise<ContentPageData>;

const registry: Record<string, ContentGetter> = {
  /* ── Landing pages ─────────────────────────────── */
  worldbuilding: async () => {
    const m = await import('./pages/worldbuilding.js');
    return m.getWorldbuildingPage();
  },
  'ai-characters': async () => {
    const m = await import('./pages/ai-characters.js');
    return m.getAiCharactersPage();
  },
  'strategy-game': async () => {
    const m = await import('./pages/strategy-game.js');
    return m.getStrategyGamePage();
  },

  /* ── Legal pages ────────────────────────────────── */
  privacy: async () => {
    const m = await import('./pages/privacy.js');
    return m.getPrivacyPage();
  },
  terms: async () => {
    const m = await import('./pages/terms.js');
    return m.getTermsPage();
  },
  'data-deletion': async () => {
    const m = await import('./pages/data-deletion.js');
    return m.getDataDeletionPage();
  },

  /* ── Perspective articles ──────────────────────── */
  'perspectives/what-is-the-metaverse': async () => {
    const m = await import('./perspectives/what-is-the-metaverse.js');
    return m.getWhatIsTheMetaversePage();
  },
  'perspectives/ai-powered-worldbuilding': async () => {
    const m = await import('./perspectives/ai-powered-worldbuilding.js');
    return m.getAiPoweredWorldbuildingPage();
  },
  'perspectives/digital-sovereignty': async () => {
    const m = await import('./perspectives/digital-sovereignty.js');
    return m.getDigitalSovereigntyPage();
  },
  'perspectives/virtual-civilizations': async () => {
    const m = await import('./perspectives/virtual-civilizations.js');
    return m.getVirtualCivilizationsPage();
  },
  'perspectives/competitive-strategy': async () => {
    const m = await import('./perspectives/competitive-strategy.js');
    return m.getCompetitiveStrategyPage();
  },
};

/**
 * Load content page data by slug.
 * Returns null if the slug is not registered.
 */
export async function loadContentPage(slug: string): Promise<ContentPageData | null> {
  const getter = registry[slug];
  if (!getter) return null;
  return getter();
}
