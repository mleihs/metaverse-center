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
 * Falls back bidirectionally: DE→EN if _de is empty, EN→DE if base is empty.
 */
export function t<T extends object>(entity: T, field: string): string {
  const useDe = localeService.currentLocale !== 'en';
  const deKey = `${field}_de`;
  const record = entity as Record<string, unknown>;
  if (useDe) {
    return (record[deKey] as string) || (record[field] as string) || '';
  }
  return (record[field] as string) || (record[deKey] as string) || '';
}

/**
 * Locale-aware accessor for objects with `${key}_en` / `${key}_de` suffixes.
 *
 * Dungeon API responses use this pattern for bilingual content:
 *   { text_en: "...", text_de: "..." }
 *   { description_en: "...", description_de: "..." }
 *   { label_en: "...", label_de: "..." }
 *   { name_en: "...", name_de: "..." }
 *   { narrative_en: "...", narrative_de: "..." }
 *
 * Usage:
 *   localized(banter, 'text')       // banter.text_de when DE, else banter.text_en
 *   localized(encounter, 'description')  // encounter.description_de when DE
 *   localized(item, 'name')         // item.name_de when DE
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function localized(obj: any, key: string): string {
  if (!obj) return '';
  const useDe = localeService.currentLocale !== 'en';
  const deVal = obj[`${key}_de`];
  const enVal = obj[`${key}_en`];
  return ((useDe && deVal) || enVal || '') as string;
}

/**
 * Array variant of `localized()` for `${key}_en` / `${key}_de` fields that
 * hold `string[]` instead of `string` (e.g. dungeon `narrative_effects_*`,
 * encounter `options_*`). Returns `[]` if neither side is present or neither
 * side is an array. Filters non-string entries defensively.
 *
 * Typed against `unknown` to avoid laundering `any` through the helper —
 * runtime validates array-ness before returning.
 */
export function localizedArray(obj: unknown, key: string): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const record = obj as Record<string, unknown>;
  const useDe = localeService.currentLocale !== 'en';
  const deVal = record[`${key}_de`];
  const enVal = record[`${key}_en`];
  const picked = useDe && Array.isArray(deVal) ? deVal : Array.isArray(enVal) ? enVal : [];
  return picked.filter((v): v is string => typeof v === 'string');
}
