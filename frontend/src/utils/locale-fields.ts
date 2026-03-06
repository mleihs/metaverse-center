/**
 * Locale-aware field accessor for entity _de suffix columns.
 *
 * Uses the same pattern as mapLoreSectionsForLocale:
 * if current locale is not English and a _de field exists, use it;
 * otherwise fall back to the English base field.
 *
 * Usage: ${t(agent, 'character')} instead of ${agent.character}
 */
import { localeService } from '../services/i18n/locale-service.js';

/**
 * Returns the locale-appropriate value for an entity field.
 * Looks up `${field}_de` when locale is not English.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function t(entity: any, field: string): string {
  const useDe = localeService.currentLocale !== 'en';
  const deKey = `${field}_de`;
  return ((useDe && entity[deKey]) || entity[field] || '') as string;
}
