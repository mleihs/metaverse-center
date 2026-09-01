import { appState } from '../services/AppStateManager.js';
import { localeService } from '../services/i18n/locale-service.js';

/**
 * Der Anzeigename eines Taxonomie-Wertes — an EINER Stelle.
 *
 * WARUM ES DIESE DATEI GIBT
 *   `buildings.building_type` traegt einen Datenbankwert: `commercial`,
 *   `trading_post`, `void_structure`. Die WOERTER dazu stehen in
 *   `simulation_taxonomies.label`, einem jsonb `{de, en}` — und zwar PRO WELT.
 *   Dieselbe Kennung heisst in einer Welt „Gewerbegebaeude" und in einer
 *   anderen „Einzelhandels-Fegefeuer". Das ist kein Uebersetzungsdetail,
 *   sondern der Kern des Weltenbaus: jede Welt benennt ihre Dinge selbst.
 *
 *   Am 01.09.2026 haben drei Stellen das unterschiedlich gehandhabt:
 *
 *       BuildingsView          bildet das Label selbst ab (Filterliste)
 *       BuildingDetailsPanel   zeigt den ROHEN Wert
 *       SimulationOverview     zeigt den ROHEN Wert
 *
 *   Auf Prod gemessen: 324 Bauten mit Typ, davon nur 90 mit deutschem Feld —
 *   also standen bei 234 die englische Kennung auf dem Schirm, und bei vieren
 *   davon mit Unterstrich: `comms_array`, `restricted_zone`, `trading_post`,
 *   `void_structure`. Ein Datenbankbezeichner auf einer Karte.
 *
 * WELCHE SPRACHE
 *   Die des LESERS, nicht die der Welt. `BuildingsView` nahm bisher
 *   `content_locale` — die Sprache, in der die Welt verfasst wurde. Das ist die
 *   richtige Wahl fuer die Frage „in welcher Sprache wurde das geschrieben",
 *   aber nicht fuer „was soll hier stehen": ein deutscher Leser einer englisch
 *   verfassten Welt bekommt das deutsche Label, wenn es eines gibt, und sonst
 *   das englische. Beides steht in derselben Zeile.
 *
 * DER LETZTE RUECKFALL IST KEIN ROHWERT
 *   Gibt es zu einem Wert gar keine Taxonomie-Zeile — moeglich, denn die Zeilen
 *   sind pro Welt und ein Generator kann einen Wert erfinden —, wird die
 *   Kennung lesbar gemacht statt durchgereicht. `trading_post` wird
 *   „Trading Post". Nicht schoen, aber nie ein Bezeichner.
 */

/** `trading_post` → `Trading Post`. Der letzte Ausweg, nie die erste Wahl. */
function humanise(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * @param type  der `taxonomy_type`, z. B. `building_type`
 * @param value der rohe Wert aus der Zeile, oder null
 * @returns das Wort dieser Welt fuer diesen Wert, oder '' wenn es keinen gibt.
 *   Leerstring und nicht der Rohwert: eine Karte ohne Untertitel ist
 *   ehrlicher als eine mit einer Kennung darauf.
 */
export function taxonomyLabel(type: string, value: string | null | undefined): string {
  const key = value?.trim();
  if (!key) return '';

  const locale = localeService.currentLocale;
  const eintrag = appState.getTaxonomiesByType(type).find((t) => t.value === key);
  if (eintrag) {
    const label = eintrag.label as Record<string, string> | null | undefined;
    const wort = label?.[locale] || label?.en || label?.de;
    if (wort?.trim()) return wort.trim();
  }
  return humanise(key);
}
