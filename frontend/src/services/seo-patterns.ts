/**
 * Declarative SEO patterns for simulation views and entity detail pages.
 *
 * Every route / detail handler calls the appropriate `apply*Seo` helper to
 * set title + description + canonical + og:image + og:image:alt + og:type +
 * JSON-LD structured data in one consistent step. The helpers build on top
 * of SeoService.setTitle — which implicitly resets all route-ephemeral meta
 * to platform defaults before the overrides land, so no state leaks between
 * SPA navigations.
 *
 * Backend parallel (for crawlers with no JS): detail builders in
 * backend/middleware/seo_content.py return EntityDetailResult with matching
 * EntityMeta fields. Frontend and backend emit the same title/description
 * for the same URL — the audit's entity-detail complaint resolved on both
 * ends.
 */
import type { Agent, Building, Simulation } from '../types/index.js';
import { t } from '../utils/locale-fields.js';
import type { ForgeLoreSection } from './api/ForgeApiService.js';
import { seoService } from './SeoService.js';

const BASE_URL = 'https://metaverse.center';
const MAX_DESCRIPTION_LENGTH = 160;

function truncate(text: string | undefined | null, limit = MAX_DESCRIPTION_LENGTH): string {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.substring(0, limit).trimEnd()}…`;
}

function titleCase(view: string): string {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function simSlug(sim: Simulation): string {
  return sim.slug || sim.id;
}

function simName(sim: Simulation): string {
  return t(sim, 'name');
}

/**
 * Apply SEO meta for a simulation-scoped list view (e.g. /simulations/:id/agents).
 * Called from app-shell when routing into a simulation view, and from detail-close
 * handlers to revert entity-level overrides back to the collection-level state.
 */
export function applySimulationViewSeo(sim: Simulation, view: string): void {
  const name = simName(sim);
  const slug = simSlug(sim);
  seoService.setTitle([titleCase(view), name]);
  seoService.setCanonical(`/simulations/${slug}/${view}`);
  const description = t(sim, 'description');
  if (description) {
    seoService.setDescription(description);
  }
  if (sim.banner_url) {
    seoService.setOgImage(sim.banner_url);
    seoService.setOgImageAlt(`${name} — simulation banner`);
  }
}

/**
 * Apply SEO meta for an agent detail panel.
 * og:type = 'profile'. Emits Person schema.org JSON-LD.
 * Call applySimulationViewSeo(sim, 'agents') on detail-close to revert.
 */
export function applyAgentDetailSeo(sim: Simulation, agent: Agent): void {
  const name = simName(sim);
  const slug = simSlug(sim);
  const entitySlug = agent.slug || agent.id;
  const agentName = agent.name;
  const character = t(agent, 'character');
  const profession = t(agent, 'primary_profession');
  const portrait = agent.portrait_image_url;

  seoService.setTitle([agentName, name]);
  seoService.setDescription(truncate(character) || `Operative in ${name}.`);
  seoService.setCanonical(`/simulations/${slug}/agents/${entitySlug}`);
  if (portrait) {
    seoService.setOgImage(portrait);
    seoService.setOgImageAlt(`${agentName} — portrait`);
  }
  seoService.setOgType('profile');
  seoService.setStructuredData({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: agentName,
    ...(character ? { description: truncate(character, 300) } : {}),
    ...(portrait ? { image: portrait } : {}),
    ...(profession ? { jobTitle: profession } : {}),
    affiliation: { '@type': 'Organization', name },
    url: `${BASE_URL}/simulations/${slug}/agents/${entitySlug}`,
  });
}

/**
 * Apply SEO meta for a building detail panel.
 * og:type stays 'website' (Open Graph has no Place type).
 * JSON-LD carries the schema.org Place semantics.
 * Call applySimulationViewSeo(sim, 'buildings') on detail-close to revert.
 */
export function applyBuildingDetailSeo(sim: Simulation, building: Building): void {
  const name = simName(sim);
  const slug = simSlug(sim);
  const entitySlug = building.slug || building.id;
  const buildingName = building.name;
  const description = t(building, 'description');
  const btype = t(building, 'building_type');
  const image = building.image_url;

  seoService.setTitle([buildingName, name]);
  seoService.setDescription(
    truncate(description) || (btype ? `${btype} in ${name}.` : `Building in ${name}.`),
  );
  seoService.setCanonical(`/simulations/${slug}/buildings/${entitySlug}`);
  if (image) {
    seoService.setOgImage(image);
    const altParts = btype ? `${buildingName} — ${btype}` : buildingName;
    seoService.setOgImageAlt(altParts);
  }
  seoService.setStructuredData({
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: buildingName,
    ...(description ? { description: truncate(description, 300) } : {}),
    ...(image ? { image } : {}),
    ...(btype ? { additionalType: btype } : {}),
    containedInPlace: { '@type': 'VirtualLocation', name },
    url: `${BASE_URL}/simulations/${slug}/buildings/${entitySlug}`,
  });
}

/**
 * Apply SEO meta for a lore section (deep-linked via /simulations/:id/lore/:entitySlug).
 * og:type = 'article'. JSON-LD Article schema with created_at as datePublished.
 */
export function applyLoreDetailSeo(sim: Simulation, section: ForgeLoreSection): void {
  const name = simName(sim);
  const slug = simSlug(sim);
  const entitySlug = section.slug;
  const sectionTitle = t(section, 'title') || section.title;
  const chapter = section.chapter;
  const body = t(section, 'body') || section.body;
  const headline = chapter ? `${chapter}: ${sectionTitle}` : sectionTitle;

  seoService.setTitle([headline, name]);
  seoService.setDescription(truncate(body) || section.epigraph || `Lore of ${name}.`);
  seoService.setCanonical(`/simulations/${slug}/lore/${entitySlug}`);
  seoService.setOgType('article');
  if (sim.banner_url) {
    seoService.setOgImage(sim.banner_url);
    seoService.setOgImageAlt(`${name} — lore`);
  }
  seoService.setStructuredData({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description: truncate(body, 300),
    url: `${BASE_URL}/simulations/${slug}/lore/${entitySlug}`,
    author: { '@type': 'Organization', name },
    publisher: {
      '@type': 'Organization',
      name: 'metaverse.center',
      url: BASE_URL,
    },
    genre: 'Interactive Fiction',
  });
}
