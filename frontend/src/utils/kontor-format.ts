/**
 * KONTOR — das Zahlenformat des Kostenpanels, an EINER Stelle.
 *
 * ── WARUM DIESE DATEI ZUERST ENTSTEHT ───────────────────────────────────────
 *
 * Weil sie sonst gar nicht entsteht. Im Admin standen am 05.09.2026 schon vier
 * verschiedene Betragsformate nebeneinander:
 *
 *     AdminAIUsageTab      `$${item.cost.toFixed(4)}`
 *     AdminForgeTab        `$${(cents / 100).toFixed(2)}`
 *     ForecastPanel        drei Stufen nach Groessenordnung, privat
 *     BurnRatePanel        `$${p.value.toFixed(4)}` in der Diagrammspitze
 *
 * `toFixed(4)` ist dabei nicht nur uneinheitlich, sondern falsch: unser
 * kleinster gemessener Betrag ist **$0.000012**, und der erscheint dort als
 * `$0.0000`. Eine Null, die keine ist.
 *
 * ── DIE SECHS ZELLZUSTAENDE ─────────────────────────────────────────────────
 *
 * Der eigentliche Beitrag des Panels. **206 von 1 646 Zeilen (12,5 %) tragen
 * keinen Betrag** — Uebersetzungen und Ankerlaeufe haben keine Preisliste. Das
 * ist nicht null und nicht klein, sondern NICHT ERFASST.
 *
 * Verbucht eine Aggregation sie als Null, sind alle Mittelwerte falsch **und
 * die Summe stimmt trotzdem** — der Fehler faellt nie auf. Gemessen an unseren
 * Daten: 14,3 % Abweichung im Gesamtmittel, **63 % bei `translation`** (320
 * Zeilen, davon 203 ohne Betrag). Deshalb steht `averageWithBasis` unten in
 * derselben Datei wie das Format: wer den einen Teil benutzt, stolpert ueber
 * den anderen.
 *
 *     gemessen      $0.0030    vom Anbieter abgerechnet, volle Tinte
 *     echte Null    $0.00      Aufruf aus dem Cache, kostete wirklich nichts
 *     geschaetzt    ~$0.0030   aus Tokenzaehlung gerechnet, nicht bestaetigt
 *     unter Anzeige ·          groesser als null, kleiner als $0.0001
 *     nicht anwendb.—          die Groesse gibt es fuer diese Zeile nicht
 *     nicht erfasst ░          anwendbar, aber nicht mitgeschrieben
 *
 * Alle sechs belegen dieselbe Zellbreite: die Spalte springt nicht, wenn eine
 * Zeile von „gemessen" auf „nicht erfasst" wechselt.
 *
 * ── WARUM DIE VIER ZEICHEN NICHT DURCH `msg()` GEHEN ────────────────────────
 *
 * `·` (U+00B7), `—` (U+2014), `░` (U+2591) und `−` (U+2212) sind NOTATION,
 * nicht Interpunktion. Gingen sie durch die i18n-Pipeline, waeren die
 * Zellzustaende beim ersten Locale-Wechsel kaputt — und der Geviertstrich
 * liefe zusaetzlich in den En-Dash-Sweep von `lint-llm-content.sh`.
 * Ausnahme #5 in `handoff/kostenpanel/DESIGN-AUTORITAET.md`.
 *
 * ── WARUM DER FORMATIERER FEST IST UND NICHT LOCALE-ABHAENGIG ───────────────
 *
 * Punkt als Dezimaltrenner, Komma als Tausendertrenner, `$` vorangestellt —
 * unabhaengig von der UI-Sprache. `toLocaleString` taeusche hier Sorgfalt vor:
 * locale-abhaengige Trenner tauschen Zeichenbreiten und zerstoeren die
 * `tabular-nums`-Spalte, an der die ganze Tabelle haengt. Uebersetzt werden
 * Beschriftungen, nicht Ziffern (Ausnahme #6 derselben Tabelle).
 */

import { captureError } from '../services/SentryService.js';

// ── Die vier Notationszeichen ───────────────────────────────────────────────
//
// Als Konstante und nicht als Literal an der Verwendungsstelle: ein `—` im
// Quelltext ist von einem Em-Dash in Prosa nicht zu unterscheiden, und genau
// den verbietet das Regelwerk.

/** U+00B7 MIDDLE DOT — groesser als null, kleiner als die Anzeigegenauigkeit. */
export const CELL_BELOW = '·';
/** U+2014 EM DASH — die Groesse gibt es fuer diese Zeile nicht. */
export const CELL_NA = '—';
/** U+2591 LIGHT SHADE — anwendbar, aber nicht mitgeschrieben. */
export const CELL_UNRECORDED = '░';
/** U+2212 MINUS SIGN, nie der Bindestrich: 1,8 px Versatz bei 13 px. */
export const MINUS = '−';

/**
 * Die Anzeigegenauigkeit des Panels.
 *
 * Darunter wird nicht gerundet, sondern `·` gesetzt. `$0.0000` waere eine
 * Luege, und ein sechsstelliger Nachkommawert (`$0.000012`) in einer Spalte
 * vierstelliger macht die Spalte unlesbar — beides schlechter als das Zeichen.
 */
export const DISPLAY_FLOOR_USD = 0.0001;

/** Die sechs Zustaende, die eine Betragszelle annehmen kann. */
export type CellKind = 'measured' | 'zero' | 'estimated' | 'below' | 'na' | 'unrecorded';

export interface Cell {
  readonly kind: CellKind;
  /** Der fertige Zellinhalt, inklusive `$`, `~` und Trennzeichen. */
  readonly text: string;
  /**
   * Die Position auf der Achse — oder `null`, wenn es keine gibt.
   *
   * `·`, `—` und `░` sortieren in BEIDEN Richtungen ans Ende, nie zwischen die
   * Zahlen: eine Zelle ohne ablesbaren Wert an eine Stelle zu setzen, die eine
   * Groesse behauptet, ist eine Aussage, die der Leser nicht pruefen kann.
   * Geschaetzte Werte sortieren dagegen an ihrem Zahlenwert — die Tilde sagt,
   * woher die Zahl kommt, nicht dass es keine gibt.
   */
  readonly sortValue: number | null;
}

export interface AmountOptions {
  /** Aus Tokenzaehlung gerechnet statt vom Anbieter abgerechnet. */
  readonly estimated?: boolean;
  /**
   * Ob die Groesse fuer diese Zeile ueberhaupt existiert. `false` ergibt `—`.
   *
   * Ausdruecklich getrennt von „kein Wert": die Gespraechskosten eines
   * Bildaufrufs sind nicht unerfasst, es gibt sie nicht.
   */
  readonly applicable?: boolean;
}

/** Ganzzahliger Teil mit Komma als Tausendertrenner: `1646` → `1,646`. */
function withThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Nachkommastellen nach Groessenordnung — zwei signifikante Stellen.
 *
 *     min(max(2, 1 − ⌊log₁₀|v|⌋), 10)
 *
 * PostHogs Leiter, weil sie als einzige der untersuchten sechs vier
 * Groessenordnungen in EINER Spalte traegt:
 *
 *     11.87    → 2 Stellen  → $11.87
 *      0.073   → 3 Stellen  → $0.073
 *      0.003   → 4 Stellen  → $0.0030
 *      0.0003  → 5 Stellen  → $0.00030
 *
 * Die Dezimalpunkte stehen dadurch NICHT untereinander. Das ist Absicht und
 * Grafanas Weg: die Alternative (Punkte ausgerichtet) laesst die Spalte rechts
 * ausfransen, und rechts steht die Groessenordnung, auf die es ankommt.
 * Umkehrbar — aber nur ganz.
 */
function decimalsFor(abs: number): number {
  return Math.min(Math.max(2, 1 - Math.floor(Math.log10(abs))), 10);
}

/** Ein Betrag als `$1,234.56`, ohne Vorzeichen und ohne Zustand. */
function plainAmount(abs: number): string {
  const [ganz, bruch] = abs.toFixed(decimalsFor(abs)).split('.');
  return `$${withThousands(ganz)}${bruch ? `.${bruch}` : ''}`;
}

/**
 * Einen Betrag in seinen Zellzustand ueberfuehren.
 *
 * ⚠ `null` und `undefined` bedeuten **nicht erfasst**, nicht null. Das ist die
 * Vorgabe und nicht verhandelbar: in `ai_usage_log` ist die Kostenspalte fuer
 * 206 von 1 646 Zeilen NULL, und jede Stelle, die daraus eine 0 macht, macht
 * die Summe richtig und jeden Mittelwert falsch.
 *
 * @param usd    Betrag in USD, oder `null`/`undefined` fuer „nicht erfasst".
 * @param options `applicable: false` ergibt `—`; `estimated: true` ergibt `~`.
 */
export function formatAmount(usd: number | null | undefined, options: AmountOptions = {}): Cell {
  // Zuerst: eine Groesse, die es nicht gibt, ist nicht unerfasst.
  if (options.applicable === false) {
    return { kind: 'na', text: CELL_NA, sortValue: null };
  }

  if (usd === null || usd === undefined) {
    return { kind: 'unrecorded', text: CELL_UNRECORDED, sortValue: null };
  }

  if (!Number.isFinite(usd)) {
    /*
     * NaN oder Infinity ist ein Fehler stromaufwaerts, kein Zellzustand. Er
     * wird als „nicht erfasst" gezeigt (die einzige ehrliche Anzeige) UND
     * gemeldet — sonst verschwindet ein kaputter Aggregatwert lautlos in einer
     * Schraffur.
     */
    captureError(new Error(`formatAmount: unbrauchbarer Betrag ${String(usd)}`), {
      source: 'kontor-format.formatAmount',
    });
    return { kind: 'unrecorded', text: CELL_UNRECORDED, sortValue: null };
  }

  if (usd === 0) {
    // Die einzige Stelle, an der eine Null stehen darf: sie ist eine.
    return { kind: 'zero', text: '$0.00', sortValue: 0 };
  }

  const abs = Math.abs(usd);
  if (abs < DISPLAY_FLOOR_USD) {
    return { kind: 'below', text: CELL_BELOW, sortValue: null };
  }

  const zeichen = usd < 0 ? MINUS : '';
  const text = `${options.estimated ? '~' : ''}${zeichen}${plainAmount(abs)}`;
  return {
    kind: options.estimated ? 'estimated' : 'measured',
    text,
    sortValue: usd,
  };
}

/**
 * Ein Zaehler: ganzzahlig, Komma als Tausendertrenner, nie mit Nachkomma.
 *
 * `1646` → `1,646`. Ein Zaehler bekommt ausdruecklich KEIN Gegenpaar
 * (teurer/billiger) — „mehr Aufrufe" ist weder gut noch schlecht.
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    captureError(new Error(`formatCount: unbrauchbarer Zaehler ${String(value)}`), {
      source: 'kontor-format.formatCount',
    });
    return CELL_UNRECORDED;
  }
  const gerundet = Math.round(value);
  const zeichen = gerundet < 0 ? MINUS : '';
  return `${zeichen}${withThousands(Math.abs(gerundet).toFixed(0))}`;
}

/**
 * Ein Anteil in Prozent, eine Nachkommastelle: `0.125` → `12,5 %`.
 *
 * Komma als Dezimaltrenner, weil Prozentwerte im Panel in deutscher Prosa
 * stehen („206 von 1,646 Zeilen — 12,5 %") und nicht in der Zahlenspalte. Die
 * Spalte ist der Ort, an dem der Punkt gilt; die Prosa ist es nicht.
 */
export function formatPercent(fraction: number, decimals = 1): string {
  if (!Number.isFinite(fraction)) {
    captureError(new Error(`formatPercent: unbrauchbarer Anteil ${String(fraction)}`), {
      source: 'kontor-format.formatPercent',
    });
    return CELL_UNRECORDED;
  }
  return `${(fraction * 100).toFixed(decimals).replace('.', ',')} %`;
}

/**
 * Ein Delta mit Vorzeichen, fuer das invertierte Kostenpaar.
 *
 * ⚠ Steigende Kosten sind SCHLECHT. Diese Funktion liefert nur den Text; die
 * Farbe kommt aus `--color-delta-adverse` / `--color-delta-benign` und ist
 * gegenueber der ueblichen Zuordnung vertauscht. Wer hier `--color-danger`
 * und `--color-success` nimmt, hat das Vorzeichen richtig und die Bedeutung
 * falsch.
 */
export function formatSignedAmount(usd: number): string {
  if (!Number.isFinite(usd)) {
    captureError(new Error(`formatSignedAmount: unbrauchbarer Betrag ${String(usd)}`), {
      source: 'kontor-format.formatSignedAmount',
    });
    return CELL_UNRECORDED;
  }
  if (usd === 0) return '$0.00';
  const abs = Math.abs(usd);
  if (abs < DISPLAY_FLOOR_USD) return `${usd < 0 ? MINUS : '+'}${CELL_BELOW}`;
  return `${usd < 0 ? MINUS : '+'}${plainAmount(abs)}`;
}

export interface AverageWithBasis {
  /** `null`, wenn keine einzige Zeile einen Betrag trug. */
  readonly average: number | null;
  /** Zeilen, die einen Betrag tragen — die Zaehlbasis des Mittelwerts. */
  readonly n: number;
  /** Zeilen insgesamt. */
  readonly of: number;
}

/**
 * Ein Mittelwert, der weiss, wie viele Zeilen ihn tragen.
 *
 * ⚠ **DER FEHLER, DEN DIESE FUNKTION VERHINDERT, HAT KEINE FEHLERMELDUNG.**
 *
 * Zeilen ohne Betrag als Null zu verbuchen laesst die SUMME richtig und macht
 * jeden MITTELWERT falsch. Gemessen an unseren Daten am 05.09.2026:
 *
 *     Ø je Aufruf MIT den Nullen      $0.007223
 *     Ø je Aufruf OHNE die Nullen     $0.008256
 *     Abweichung                          14,3 %
 *
 * Je Zweck wird es schlimmer: `translation` traegt 320 Zeilen, davon 203 ohne
 * Betrag — dort ist der Mittelwert nicht ungenau, sondern um **63 %** falsch,
 * und die Summe daneben stimmt, weshalb es niemandem auffaellt.
 *
 * Deshalb gibt es keine Variante ohne Zaehlbasis. `n` und `of` gehoeren an die
 * Zahl, nicht in eine Fussnote — und sie muessen **nach** jedem Filter neu
 * gerechnet werden: eine gecachte Basis behauptet eine Grundgesamtheit, die es
 * unter dem Filter nicht mehr gibt.
 */
export function averageWithBasis(
  amounts: readonly (number | null | undefined)[],
): AverageWithBasis {
  let summe = 0;
  let n = 0;
  for (const wert of amounts) {
    if (wert === null || wert === undefined || !Number.isFinite(wert)) continue;
    summe += wert;
    n += 1;
  }
  return { average: n === 0 ? null : summe / n, n, of: amounts.length };
}

/**
 * Zwei Zellen vergleichen — zustandslose Zellen immer ans Ende.
 *
 * In BEIDEN Richtungen: `·`, `—` und `░` haben keine Position auf der Achse,
 * und eine absteigende Sortierung, die sie nach oben holt, behauptet, sie
 * waeren die groessten Werte.
 *
 * @param direction `'desc'` (Vorgabe der Tabelle) oder `'asc'`.
 */
export function compareCells(a: Cell, b: Cell, direction: 'asc' | 'desc'): number {
  if (a.sortValue === null && b.sortValue === null) return 0;
  if (a.sortValue === null) return 1;
  if (b.sortValue === null) return -1;
  return direction === 'desc' ? b.sortValue - a.sortValue : a.sortValue - b.sortValue;
}
