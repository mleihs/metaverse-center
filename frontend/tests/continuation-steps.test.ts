/**
 * Die fünf Stufen — und die drei Orte, an denen sie dieselben sein müssen.
 *
 * Eine Zahl, die dreimal getippt wird, kann dreimal falsch getippt werden.
 * Diese Datei bindet den Regler an die Migration; `test_conversation_
 * continuation.py` bindet die Migration an das Backend-Modell. Fehlt eine der
 * beiden Bindungen, weist Postgres eine sechste Zahl mit 23514 ab – aus der
 * Tiefe, ohne Hinweis darauf, wo sie herkam.
 *
 * Der zweite Gegenstand ist das geschützte Leerzeichen. Es ist die Art Detail,
 * die niemand vermisst, bis die Zahl allein am Zeilenende steht – und dann
 * sucht sie dort niemand. Eine Prüfung, die gegen ein GEWÖHNLICHES
 * Leerzeichen verglichen hätte, wäre grün gewesen, ohne etwas zu prüfen.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const {
  CONTINUE_DEFAULT_HOURS,
  CONTINUE_DEFAULT_INDEX,
  CONTINUE_HOURS,
  continueIndexOf,
  continueMarks,
} = await import('../src/components/chat/continuation-steps.js');

const MIGRATION =
  '../../supabase/migrations/20260904110000_357_ein_gespraech_darf_ohne_zuhoerer_weitergehen.sql';

describe('Regler und Migration kennen dieselben fünf Stunden', () => {
  it('die Stundenschranke in 357 trägt genau diese Menge', () => {
    const sql = readFileSync(new URL(MIGRATION, import.meta.url), 'utf8');
    const treffer = sql.match(/continue_interval_hours IN \(([^)]+)\)/);
    expect(treffer, 'die Stundenschranke steht nicht mehr in 357').not.toBeNull();
    const ausDerMigration = new Set(treffer?.[1].split(',').map((x) => Number(x.trim())));
    expect(ausDerMigration).toEqual(new Set(CONTINUE_HOURS));
  });

  it('der Vorgabewert der Spalte ist der Vorgabewert des Reglers', () => {
    const sql = readFileSync(new URL(MIGRATION, import.meta.url), 'utf8');
    expect(sql).toMatch(/continue_interval_hours SMALLINT NOT NULL DEFAULT 12/);
    expect(CONTINUE_DEFAULT_HOURS).toBe(12);
  });

  it('die Vorgabe hat eine Rastenposition, keine -1', () => {
    expect(CONTINUE_DEFAULT_INDEX).toBeGreaterThanOrEqual(0);
    expect(CONTINUE_HOURS[CONTINUE_DEFAULT_INDEX]).toBe(CONTINUE_DEFAULT_HOURS);
  });
});

describe('Die Bahn läuft nach rechts hin häufiger', () => {
  it('die Stunden fallen streng monoton', () => {
    // Ein Regler, dessen Bahn nach rechts WENIGER bedeutet, wird falsch
    // bedient, und niemand merkt es: beide Enden sehen plausibel aus.
    const sortiert = [...CONTINUE_HOURS].sort((a, b) => b - a);
    expect([...CONTINUE_HOURS]).toEqual(sortiert);
    expect(new Set(CONTINUE_HOURS).size).toBe(CONTINUE_HOURS.length);
  });
});

describe('Ein unbekannter Wert landet auf der Vorgabe', () => {
  it('bekannte Stunden treffen ihre Raste', () => {
    for (const [i, h] of CONTINUE_HOURS.entries()) {
      expect(continueIndexOf(h)).toBe(i);
    }
  });

  it('eine Stufe, die dieser Build nicht kennt, fällt auf die Vorgabe', () => {
    // Kann während eines Ausrollens vorkommen: die Datenbank kennt eine
    // Stufe, dieser Build noch nicht. -1 stellte den Regler links neben seine
    // erste Raste, und die Anzeige nennte keinen Namen.
    expect(continueIndexOf(3)).toBe(CONTINUE_DEFAULT_INDEX);
    expect(continueIndexOf(undefined)).toBe(CONTINUE_DEFAULT_INDEX);
  });
});

describe('Jede Stufe trägt Wort und Stundenzahl', () => {
  const marken = continueMarks();

  it('es sind fünf, und sie sitzen auf 0 bis 4', () => {
    expect(marken.map((m) => m.value)).toEqual([0, 1, 2, 3, 4]);
    expect(marken).toHaveLength(CONTINUE_HOURS.length);
  });

  it('die Kerbenbeschriftung ist die Stundenzahl der Stufe', () => {
    for (const [i, mark] of marken.entries()) {
      expect(mark.tick).toBe(String(CONTINUE_HOURS[i]));
    }
  });

  it('jede Stufe hat einen Namen UND eine Stundenangabe', () => {
    for (const mark of marken) {
      expect(mark.label.trim()).not.toBe('');
      expect(mark.hint).toMatch(/\d/);
    }
  });

  it('die Zahl klebt per U+00A0 an ihrem Wort', () => {
    for (const mark of marken) {
      expect(mark.hint, `"${mark.hint}" trägt ein gewöhnliches Leerzeichen`).toContain(' ');
      expect(mark.hint).not.toMatch(/\d /);
    }
  });
});
