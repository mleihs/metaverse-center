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
export function localized(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object') return '';
  const record = obj as Record<string, unknown>;
  const useDe = localeService.currentLocale !== 'en';
  const deVal = record[`${key}_de`];
  const enVal = record[`${key}_en`];
  const picked = useDe && deVal ? deVal : enVal;
  return typeof picked === 'string' ? picked : '';
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

/**
 * Der Erzähltext eines Herzschlag-Eintrags in der Sprache des Lesenden.
 *
 * WARUM ES DAFÜR EINEN EIGENEN NAMEN GIBT und nicht bloß `localized(e,
 * 'narrative')`: dieselbe Frage wurde an fünf Stellen fünfmal neu beantwortet
 * — Puls-Ansicht, `weather`-Befehl, Feed-Zeile, `look`-Befehl und
 * Tageslagebericht. Vier davon fragten nur `narrative_en` und zeigten dem
 * deutschen Publikum englische Chronik (gemessen 31.08.2026). Die fünfte
 * baute sich ein Wegwerf-Objekt mit umbenanntem Schlüssel, um den
 * FALSCHEN der beiden Helfer passend zu machen:
 *
 *     t({ narrative: zone.narrative_en, narrative_de: zone.narrative_de },
 *       'narrative') as string
 *
 * Das ist kein Schlamperei-Befund, sondern ein Bauartbefund: es gibt zwei
 * Helfer mit fast gleichem Namen und VERSCHIEDENER Endungskonvention (`t`
 * erwartet `feld`/`feld_de`, `localized` erwartet `feld_en`/`feld_de`), und
 * die Wahl zwischen ihnen fällt an jeder Aufrufstelle neu. Ein benannter
 * Zugriff nimmt sie einmal ab.
 *
 * NICHT hierher gehört das Rendern. Eine Terminalzeile und ein HTML-Span sind
 * zu Recht verschiedene Dinge, und die Kanal-Logik (`INTEL`/`ALERT`/
 * `DISTANT`) von `formatFeedEntry` ist echte Terminalsemantik. Vereinheitlicht
 * wird der ZUGRIFF, nicht die Darstellung.
 *
 * UND EINE STELLE BLEIBT ABSICHTLICH ENGLISCH: `BureauTerminal` entdoppelt
 * Feed-Einträge über `narrative_en`. Das ist richtig so — ein Schlüssel, der
 * mit der Lesesprache wechselt, entdoppelt für deutsche und englische
 * Lesende verschieden. Ein pauschales Ersetzen hätte genau das kaputt
 * gemacht.
 */
export function entryNarrative(entry: { narrative_en?: string; narrative_de?: string }): string {
  return localized(entry, 'narrative');
}
