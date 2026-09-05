import { html, nothing, type TemplateResult } from 'lit';
import type { Cell, CellKind } from '../../utils/kontor-format.js';

/**
 * KONTOR — eine Betragszelle zeichnen.
 *
 * Die Bruecke zwischen `utils/kontor-format.ts` (was eine Zelle IST) und
 * `kontor-table-styles.ts` (wie sie AUSSIEHT). Sie existiert, damit die
 * Zuordnung Zustand → Klasse an genau einer Stelle steht.
 *
 * Ohne sie entsteht sie an jeder Tabelle neu, und die sechste Tabelle vergisst
 * einen Zustand — was sich nicht als Fehler zeigt, sondern als eine Zelle, die
 * aussieht wie eine gemessene und keine ist. `tests/kontor-cell.test.ts` bindet
 * beide Seiten aneinander: ein siebter Zustand ohne Regel ist ein roter Test.
 *
 * ── DIE VIER ZEICHEN GEHEN NICHT DURCH `msg()` ──────────────────────────────
 *
 * `·`, `—`, `░` und `−` sind Notation, nicht Interpunktion. Der Text der Zelle
 * kommt fertig aus `formatAmount` und wird hier nicht mehr angefasst. Was
 * uebersetzt wird, ist die VORLESBARE Fassung fuer Hilfsmittel — und die muss
 * uebersetzt werden, weil ein Screenreader „░" sonst als „Schattierung
 * hell" vorliest oder gar nicht.
 */

/** Die Klasse je Zustand. Vollstaendig ueber `CellKind`, nicht als Teilmenge. */
const CELL_CLASS: Record<CellKind, string> = {
  measured: 'kontor-cell--measured',
  zero: 'kontor-cell--zero',
  estimated: 'kontor-cell--estimated',
  below: 'kontor-cell--below',
  na: 'kontor-cell--na',
  unrecorded: 'kontor-cell--unrecorded',
};

/**
 * Eine Betragszelle als `<span>`.
 *
 * @param cell  das Ergebnis von `formatAmount`.
 * @param label die vorlesbare Fassung des Zustands. Die drei Zeichenzustaende
 *   BRAUCHEN sie — ein Screenreader liest `░` nicht als „nicht erfasst". Der
 *   Aufrufer liefert sie uebersetzt (`msg('not recorded')`), weil dieses Modul
 *   selbst keine Zeichenketten besitzt.
 */
export function renderCell(cell: Cell, label?: string): TemplateResult {
  const braucht = cell.kind === 'below' || cell.kind === 'na' || cell.kind === 'unrecorded';
  return html`<span
    class="kontor-cell ${CELL_CLASS[cell.kind]}"
    data-cell-kind=${cell.kind}
    title=${braucht && label ? label : nothing}
    aria-label=${braucht && label ? label : nothing}
    >${cell.text}</span
  >`;
}

/** Die Klassen, die das Stilmodul bereitstellen muss. Fuer den Test. */
export const CELL_CLASSES: readonly string[] = Object.values(CELL_CLASS);
