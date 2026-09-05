/**
 * DAS ZAHLENFORMAT DES KOSTENPANELS.
 *
 * Geprüft wird nicht, dass die Funktion etwas zurückgibt, sondern dass sie die
 * drei Aussagen hält, an denen das Panel hängt:
 *
 *   1. Eine Null steht nur, wenn der Wert eine echte Null ist.
 *   2. Ein Mittelwert kennt seine Zählbasis — und zählt eine fehlende Zeile
 *      nie als Null.
 *   3. Das Format ist unabhängig von der UI-Sprache.
 *
 * Die Sollwerte für (2) stammen aus `handoff/kostenpanel/MESSUNG-EIGENE-DATEN.md`,
 * also aus einer Messung an unseren Daten, nicht aus einer erfundenen Reihe.
 */

import { describe, expect, it, vi } from 'vitest';

// captureError zieht die Sentry-Kette herein; hier interessiert nur, DASS
// gemeldet wird.
const captureError = vi.fn();
vi.mock('../src/services/SentryService.js', () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

import {
  averageWithBasis,
  CELL_BELOW,
  CELL_NA,
  CELL_UNRECORDED,
  compareCells,
  formatAmount,
  formatCount,
  formatPercent,
  formatSignedAmount,
  MINUS,
} from '../src/utils/kontor-format.js';

describe('die sechs Zellzustände', () => {
  it('gemessen — voller Betrag', () => {
    expect(formatAmount(0.003)).toEqual({ kind: 'measured', text: '$0.0030', sortValue: 0.003 });
  });

  it('echte Null — und nur sie darf als Null erscheinen', () => {
    expect(formatAmount(0)).toEqual({ kind: 'zero', text: '$0.00', sortValue: 0 });
  });

  it('geschätzt — Tilde, und sortiert trotzdem an seinem Zahlenwert', () => {
    const cell = formatAmount(0.003, { estimated: true });
    expect(cell.kind).toBe('estimated');
    expect(cell.text).toBe('~$0.0030');
    expect(cell.sortValue).toBe(0.003);
  });

  /*
   * Der Zustand, den `toFixed(4)` im AdminAIUsageTab bis heute als `$0.0000`
   * zeigt. Unser kleinster gemessener Betrag ist $0.000012.
   */
  it('unter Anzeigegenauigkeit — niemals auf $0.0000 gerundet', () => {
    const cell = formatAmount(0.000012);
    expect(cell.kind).toBe('below');
    expect(cell.text).toBe(CELL_BELOW);
    expect(cell.text).not.toContain('0.0000');
  });

  it('nicht anwendbar — Geviertstrich, nicht leer und nicht „N/A“', () => {
    const cell = formatAmount(null, { applicable: false });
    expect(cell.kind).toBe('na');
    expect(cell.text).toBe(CELL_NA);
  });

  /*
   * Die wichtigste Zeile der Datei: null ist NICHT null.
   */
  it('nicht erfasst — null und undefined ergeben die Schraffur, nicht $0.00', () => {
    for (const leer of [null, undefined]) {
      const cell = formatAmount(leer);
      expect(cell.kind).toBe('unrecorded');
      expect(cell.text).toBe(CELL_UNRECORDED);
      expect(cell.text).not.toBe('$0.00');
    }
  });

  it('„nicht anwendbar“ gewinnt über „nicht erfasst“ — eine Größe, die es nicht gibt, fehlt nicht', () => {
    expect(formatAmount(null, { applicable: false }).kind).toBe('na');
  });

  it('alle sechs Zustände sind unterscheidbar', () => {
    const kinds = [
      formatAmount(0.003).kind,
      formatAmount(0).kind,
      formatAmount(0.003, { estimated: true }).kind,
      formatAmount(0.000012).kind,
      formatAmount(1, { applicable: false }).kind,
      formatAmount(null).kind,
    ];
    expect(new Set(kinds).size).toBe(6);
  });
});

describe('die Rundungsleiter — zwei signifikante Stellen', () => {
  it.each([
    [11.87, '$11.87'],
    [7.86, '$7.86'],
    [0.073, '$0.073'],
    [0.003, '$0.0030'],
    [0.0003, '$0.00030'],
    [0.0001, '$0.00010'],
  ])('%s → %s', (wert, erwartet) => {
    expect(formatAmount(wert).text).toBe(erwartet);
  });

  it('trennt Tausender mit Komma und Dezimalen mit Punkt', () => {
    expect(formatAmount(1234567.891).text).toBe('$1,234,567.89');
  });

  /*
   * Der Grund, warum kein `toLocaleString` verwendet wird: ein Locale-Wechsel
   * tauscht Punkt und Komma, das ändert die Zeichenbreiten und zerstört die
   * tabular-nums-Spalte.
   */
  it('ist unabhängig von der UI-Sprache', () => {
    const original = Intl.NumberFormat;
    try {
      // Ein Formatierer, der deutsch formatieren WÜRDE, wenn er benutzt würde.
      // @ts-expect-error — absichtlich ersetzt, um einen Zugriff sichtbar zu machen.
      Intl.NumberFormat = () => {
        throw new Error('kontor-format darf Intl.NumberFormat nicht benutzen');
      };
      expect(formatAmount(1234.5).text).toBe('$1,234.50');
      expect(formatCount(1646)).toBe('1,646');
    } finally {
      Intl.NumberFormat = original;
    }
  });
});

describe('Zähler und Vorzeichen', () => {
  it('Zähler sind ganzzahlig mit Komma', () => {
    expect(formatCount(1646)).toBe('1,646');
    expect(formatCount(206)).toBe('206');
  });

  it('benutzt U+2212, nie den Bindestrich', () => {
    expect(formatSignedAmount(-0.5)).toBe(`${MINUS}$0.50`);
    expect(formatSignedAmount(-0.5)).not.toContain('-');
    expect(formatCount(-12)).toBe(`${MINUS}12`);
  });

  it('setzt bei steigenden Kosten ein Plus', () => {
    expect(formatSignedAmount(0.5)).toBe('+$0.50');
  });

  it('Prozent in Prosa trägt das Komma', () => {
    expect(formatPercent(0.125)).toBe('12,5 %');
  });
});

describe('der Mittelwert kennt seine Zählbasis', () => {
  /*
   * Die ZÄHLUNGEN stammen aus MESSUNG-EIGENE-DATEN.md (1 646 Zeilen, davon 206
   * ohne Betrag, Gesamtbetrag $11.87); die beiden Mittelwerte hier sind daraus
   * gerechnet, nicht aus dem Dokument abgeschrieben:
   *
   *     mit den Nullen     11.87 / 1646 = $0.007211
   *     ohne die Nullen    11.87 / 1440 = $0.008243
   *
   * ⚠ Das Dokument nennt $0.007223 und $0.008256 — beide eine Spur höher, weil
   * dort über die echte Verteilung gemittelt wurde und $11.87 die gerundete
   * Summe ist (rückgerechnet ≈ $11.888). Die Zahlen sind also NICHT dieselben,
   * und dieser Test behauptet das auch nicht.
   *
   * Die ABWEICHUNG dagegen ist es: 14,3 %, auf die Nachkommastelle wie im
   * Dokument. Sie hängt nur am Verhältnis 1646 : 1440, nicht an der Summe —
   * und genau sie ist der Fehler, der nie auffällt, weil die Summe stimmt.
   */
  it('zählt fehlende Zeilen nicht als Null — 14 % Unterschied an echten Zahlen', () => {
    const zeilen: (number | null)[] = [
      ...Array.from({ length: 1440 }, () => 11.87 / 1440),
      ...Array.from({ length: 206 }, () => null),
    ];

    const { average, n, of } = averageWithBasis(zeilen);
    expect(of).toBe(1646);
    expect(n).toBe(1440);
    // biome-ignore lint/style/noNonNullAssertion: n ist 1440, average kann nicht null sein.
    expect(average!).toBeCloseTo(0.008243, 6);

    // Das falsche Ergebnis, wenn null als 0 verbucht würde:
    const falsch = zeilen.reduce<number>((s, w) => s + (w ?? 0), 0) / zeilen.length;
    expect(falsch).toBeCloseTo(0.007211, 6);
    // biome-ignore lint/style/noNonNullAssertion: siehe oben.
    expect(((average! - falsch) / falsch) * 100).toBeCloseTo(14.3, 1);
  });

  it('die Summe bleibt dabei richtig — deshalb fällt der Fehler nie auf', () => {
    const zeilen: (number | null)[] = [1, 2, null, 3];
    const summeMitNull = zeilen.reduce<number>((s, w) => s + (w ?? 0), 0);
    expect(summeMitNull).toBe(6);
    const { average, n, of } = averageWithBasis(zeilen);
    expect(average).toBe(2); // 6 / 3, nicht 6 / 4
    expect(`${n} von ${of}`).toBe('3 von 4');
  });

  it('gibt null zurück, wenn keine einzige Zeile einen Betrag trägt', () => {
    expect(averageWithBasis([null, null, undefined])).toEqual({ average: null, n: 0, of: 3 });
  });
});

describe('Sortierung — Zellen ohne Wert haben keine Position', () => {
  const gemessen = formatAmount(0.005);
  const klein = formatAmount(0.001);
  const nichts = formatAmount(null);
  const unteranzeige = formatAmount(0.00001);

  it('sortiert absteigend nach Wert', () => {
    expect(compareCells(gemessen, klein, 'desc')).toBeLessThan(0);
  });

  it('sortiert aufsteigend nach Wert', () => {
    expect(compareCells(gemessen, klein, 'asc')).toBeGreaterThan(0);
  });

  it('stellt zustandslose Zellen in BEIDEN Richtungen ans Ende', () => {
    for (const richtung of ['asc', 'desc'] as const) {
      expect(compareCells(nichts, gemessen, richtung)).toBeGreaterThan(0);
      expect(compareCells(gemessen, nichts, richtung)).toBeLessThan(0);
      expect(compareCells(unteranzeige, klein, richtung)).toBeGreaterThan(0);
    }
  });

  it('geschätzte Werte sortieren an ihrem Zahlenwert, nicht ans Ende', () => {
    const geschaetzt = formatAmount(0.01, { estimated: true });
    expect(compareCells(geschaetzt, gemessen, 'desc')).toBeLessThan(0);
  });
});

describe('unbrauchbare Eingaben werden gemeldet, nicht verschluckt', () => {
  it('NaN ergibt „nicht erfasst“ UND einen Sentry-Eintrag', () => {
    captureError.mockClear();
    const cell = formatAmount(Number.NaN);
    expect(cell.kind).toBe('unrecorded');
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it('Infinity ebenso', () => {
    captureError.mockClear();
    expect(formatAmount(Number.POSITIVE_INFINITY).kind).toBe('unrecorded');
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});
