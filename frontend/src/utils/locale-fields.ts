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
export function t<T extends object>(entity: T, field: string): string {
  const useDe = localeService.currentLocale !== 'en';
  const deKey = `${field}_de`;
  const record = entity as Record<string, unknown>;
  return ((useDe && record[deKey]) || record[field] || '') as string;
}
