/**
 * Der Übersichtsstreifen: eine volle Reihe, und die Angaben, die er trägt.
 *
 * Drei Befunde, alle am 02.09.2026 auf der Welt Velgarien gemessen, alle mit
 * einer anderen Ursache — deshalb drei getrennte Prüfungen:
 *
 * 1. 268 px Loch zwischen "Dossier öffnen" und "Kader". Die Übersicht war ein
 *    zweispaltiges Gitter (Akte | Schiene) und die Streifen kamen als eigene
 *    Reihen DARUNTER. Die Gitterreihe ist so hoch wie ihre höhere Spalte, und
 *    Velgarien hat keinen philosophischen Anker, also stand links ein einziges
 *    Feld von 240 px neben einer Schiene von 468 px. Gemessen: linke Spalte
 *    Inhalt 240, Kasten 468, Lücke 268. Der Fehler hing an den DATEN der Welt:
 *    Welten mit Anker hatten zwei Felder links und zufällig kein Loch.
 *
 * 2. Karten in `sm` (120 px). In dieser Größe verwirft `<velg-game-card>`
 *    selbst, was ihr übergeben wird — Untertitel 8 px, Abzeichen 6 px,
 *    Pip-Beschriftung `display: none`. Eine feste Anzahl von acht Karten kann
 *    das nicht heilen, weil sie nur auf einem Bildschirm aufgeht.
 *
 * 3. Agentenkarten ohne Angaben, Gebäudekarten mit. Zwei verschiedene
 *    Ursachen: der Beruf war auf Prod schlicht NULL (156 von 258 Agenten
 *    plattformweit), und die Eignungswerte lagen geladen im Bauteil, wurden
 *    aber nie an die Karte weitergereicht.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CARD_WIDTH,
  MD_MIN_WIDTH,
  STRIP_GAP,
  STRIP_LIMIT,
  stripLayout,
} from '../src/components/simulation/overview-strip.js';

const OVERVIEW = readFileSync(
  resolve(process.cwd(), 'src/components/simulation/SimulationOverview.ts'),
  'utf-8',
);

describe('der Streifen zeigt genau eine volle Reihe', () => {
  it('lässt keinen Rest in einer zweiten Reihe stehen', () => {
    // Jede Breite von 300 bis 2600 px: was gezeigt wird, muss in eine Reihe passen.
    for (let width = 300; width <= 2600; width += 7) {
      const { size, shown } = stripLayout(width, 40);
      const needed = shown * CARD_WIDTH[size] + (shown - 1) * STRIP_GAP;
      // Unterhalb von zwei Karten gibt die Rechnung bewusst zwei aus — ein
      // Streifen mit einer Karte ist kein Streifen. Nur dort darf es umbrechen.
      if (shown > 2) {
        expect(needed, `${width}px: ${shown}×${size} braucht ${needed}px`).toBeLessThanOrEqual(
          width,
        );
      }
    }
  });

  it('nimmt die große Karte, sobald die Spalte sie trägt', () => {
    expect(stripLayout(MD_MIN_WIDTH, 9).size).toBe('md');
    expect(stripLayout(MD_MIN_WIDTH - 1, 9).size).toBe('sm');
  });

  it('zeigt auf der gemessenen Spalte von Velgarien fünf große Karten', () => {
    // 1129 px ist die linke Spalte auf der Bühne, am Bildschirm gemessen.
    expect(stripLayout(1129, 9)).toEqual({ size: 'md', shown: 5 });
  });

  it('zeigt nie mehr, als es gibt, und nie mehr als das Limit', () => {
    expect(stripLayout(2600, 3).shown).toBe(3);
    expect(stripLayout(2600, 40).shown).toBe(STRIP_LIMIT);
  });

  it('fällt vor der ersten Messung auf den bisherigen Zustand zurück', () => {
    // Nicht auf eine einzelne Karte: ein Streifen, der im ersten Bild leer
    // aussieht und im zweiten voll, springt vor den Augen des Lesers.
    expect(stripLayout(0, 9)).toEqual({ size: 'sm', shown: STRIP_LIMIT });
  });

  it('gibt auf einem Telefon zwei Karten aus statt einer', () => {
    expect(stripLayout(380, 9).shown).toBe(2);
  });
});

describe('die Streifen stehen neben der Schiene, nicht darunter', () => {
  it('alle vier Blöcke liegen in derselben Spalte', () => {
    expect(OVERVIEW).toMatch(
      /<div class="main">\s*\$\{this\._renderAnchor\(\)\} \$\{this\._renderDossier\(\)\}\s*\$\{this\._renderRoster\(\)\} \$\{this\._renderFootprint\(\)\}/,
    );
  });

  it('kein Streifen ist mehr selbst ein Bühnenbehälter', () => {
    // Zwei Rinnen übereinander sind eine zu viel, sobald der Streifen INNERHALB
    // eines stage-container liegt.
    expect(OVERVIEW).not.toContain('class="strip stage-container"');
  });

  it('die Schiene wird nicht mehr auf die Reihenhöhe gedehnt', () => {
    expect(OVERVIEW).toMatch(/\.overview \{[^}]*align-items: start;/);
  });
});

describe('was die Karte zeigen kann, bekommt sie auch', () => {
  it('die Eignungswerte werden durchgereicht', () => {
    // Sie lagen als 54 Zeilen im Bauteil und wurden zu Summe und Bestwert
    // verrechnet; die sechs Einzelwerte warf der Streifen weg.
    expect(OVERVIEW).toContain('.aptitudes=${entry.aptitudes}');
    expect(OVERVIEW).toContain('aptitudes: AptitudeSet;');
  });

  it('beide Streifen tragen die gemessene Größe, keine fest geschriebene', () => {
    expect(OVERVIEW).not.toMatch(/size="sm"/);
    expect(OVERVIEW.match(/size=\$\{size\}/g)?.length).toBe(2);
  });

  it('die Spalte wird gemessen, nicht geraten', () => {
    expect(OVERVIEW).toContain('new ResizeObserver');
    expect(OVERVIEW).toMatch(/this\._stripObserver\?\.disconnect\(\)/);
  });
});
