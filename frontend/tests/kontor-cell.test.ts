/**
 * DIE ZELLE: ZUSTAND, KLASSE UND REGEL MÜSSEN ZUSAMMENBLEIBEN.
 *
 * Drei Dateien beschreiben dieselbe Sache aus drei Richtungen:
 *
 *   utils/kontor-format.ts            was eine Zelle IST   (CellKind)
 *   shared/kontor-cell.ts             wie sie heißt        (CELL_CLASS)
 *   shared/kontor-table-styles.ts     wie sie aussieht     (.kontor-cell--*)
 *
 * Laufen sie auseinander, gibt es keinen Fehler — nur eine Zelle, die aussieht
 * wie eine gemessene und keine ist. Dieser Test bindet alle drei aneinander:
 * ein siebter Zustand ohne Klasse oder ohne Regel ist rot.
 *
 * Die KONTRASTE der Paarung Schraffur/Tinte prüft dieser Test nicht — das tut
 * `scripts/lint-series-palette-grounds.mjs` Teil 3, das die Regel selbst
 * nachmisst.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CELL_CLASSES, renderCell } from '../src/components/shared/kontor-cell.js';
import { type CellKind, formatAmount } from '../src/utils/kontor-format.js';

const STYLES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/components/shared/kontor-table-styles.ts',
);

/** Die sechs Zustände, einmal ausgeschrieben — nicht aus dem Code abgeleitet. */
const ALLE_ZUSTAENDE: readonly CellKind[] = [
  'measured',
  'zero',
  'estimated',
  'below',
  'na',
  'unrecorded',
];

describe('Zustand, Klasse und Regel bleiben zusammen', () => {
  it('jeder Zustand hat genau eine Klasse', () => {
    expect(CELL_CLASSES).toHaveLength(ALLE_ZUSTAENDE.length);
    expect(new Set(CELL_CLASSES).size).toBe(ALLE_ZUSTAENDE.length);
  });

  /*
   * Der eigentliche Bindungspunkt. Ohne ihn kann ein Zustand eine Klasse
   * tragen, die im Stilmodul nicht vorkommt — die Zelle fällt dann auf die
   * Grundtinte zurück und sieht aus wie „gemessen".
   */
  it('jede Klasse kommt im Stilmodul als Regel vor', () => {
    const css = readFileSync(STYLES, 'utf-8');
    const fehlend = CELL_CLASSES.filter((klasse) => !css.includes(`.${klasse}`));
    expect(
      fehlend,
      [
        'Diese Klassen setzt kontor-cell.ts, aber kontor-table-styles.ts hat',
        'keine Regel dafür. Die Zelle fiele auf die Grundtinte zurück und',
        'sähe aus wie eine gemessene.',
        '',
        ...fehlend.map((k) => `  .${k}`),
      ].join('\n'),
    ).toEqual([]);
  });

  it('das Stilmodul trägt keine Zellklasse, die niemand setzt', () => {
    const css = readFileSync(STYLES, 'utf-8');
    const imStil = [...css.matchAll(/\.(kontor-cell--[a-z]+)/g)].map((m) => m[1]);
    const verwaist = [...new Set(imStil)].filter((k) => !CELL_CLASSES.includes(k));
    expect(verwaist, `Regeln ohne Zustand: ${verwaist.join(', ')}`).toEqual([]);
  });
});

describe('die Zelle trägt ihren Zustand ins Markup', () => {
  it.each(ALLE_ZUSTAENDE)('%s bekommt seine eigene Klasse', (kind) => {
    const zellen: Record<CellKind, ReturnType<typeof formatAmount>> = {
      measured: formatAmount(0.003),
      zero: formatAmount(0),
      estimated: formatAmount(0.003, { estimated: true }),
      below: formatAmount(0.000012),
      na: formatAmount(1, { applicable: false }),
      unrecorded: formatAmount(null),
    };
    /*
     * Nicht `.join(' ')`: Lits `nothing` ist ein SYMBOL, und join wirft darauf
     * („Cannot convert a Symbol value to a string“) — der Test wäre an seinem
     * eigenen Zugriff gescheitert, nicht am Gegenstand.
     */
    const werte = renderCell(zellen[kind]).values.filter(
      (v): v is string => typeof v === 'string',
    );
    expect(werte.join(' ')).toContain(`kontor-cell--${kind}`);
  });

  /*
   * Ein Screenreader liest `░` als „Schattierung hell“ vor, oder gar nicht.
   * Die drei Zeichenzustände sind ohne vorlesbare Fassung stumm — und stumm
   * ist hier dasselbe wie leer, also dasselbe wie null.
   */
  it('die drei Zeichenzustände bekommen eine vorlesbare Fassung', () => {
    for (const [kind, cell] of [
      ['below', formatAmount(0.000012)],
      ['na', formatAmount(1, { applicable: false })],
      ['unrecorded', formatAmount(null)],
    ] as const) {
      const werte = renderCell(cell, 'nicht erfasst').values;
      expect(werte, `${kind} ohne aria-label`).toContain('nicht erfasst');
    }
  });

  it('die Zahlzustände brauchen keine — die Zahl liest sich selbst', () => {
    const werte = renderCell(formatAmount(0.003), 'nicht erfasst').values;
    expect(werte).not.toContain('nicht erfasst');
  });
});
