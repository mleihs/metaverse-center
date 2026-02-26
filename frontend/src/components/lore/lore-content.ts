import type { LoreSection } from '../platform/LoreScroll.js';
import { getCapybaraLoreSections } from './content/capybara-lore.js';
import { getSperanzaLoreSections } from './content/speranza-lore.js';
import { getStationNullLoreSections } from './content/station-null-lore.js';
import { getVelgarienLoreSections } from './content/velgarien-lore.js';

const registry: Record<string, () => LoreSection[]> = {
  velgarien: getVelgarienLoreSections,
  'capybara-kingdom': getCapybaraLoreSections,
  'station-null': getStationNullLoreSections,
  speranza: getSperanzaLoreSections,
};

export function getLoreSectionsForSlug(slug: string): LoreSection[] | null {
  const fn = registry[slug];
  return fn ? fn() : null;
}
