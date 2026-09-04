/**
 * DIE WAHL DES LESERS UND DIE VORGABE DES HAUSES SIND ZWEI DINGE.
 *
 * Seit dem 04.09.2026 kann die Verwaltung festlegen, welche Ausgabe jemand
 * bekommt, der noch keine gewaehlt hat. Das ist eine Auskunft vom Server, und
 * damit gibt es drei Werte, wo vorher einer war:
 *
 *     velg-platform-skin   die eigene Wahl. Gehoert dem Leser.
 *     velg-default-skin    die zuletzt gemeldete Vorgabe. Gehoert dem Haus.
 *     'dark'               wenn keines von beiden vorliegt.
 *
 * WARUM DAS GEPRUEFT WIRD UND NICHT NUR DASTEHT
 *   Zwei Fehler waeren hier moeglich und beide waeren unsichtbar, solange
 *   Vorgabe und Wahl zufaellig uebereinstimmen — genau der Zustand, in dem so
 *   ein Fehler monatelang lebt:
 *
 *   1. DIE VORGABE UEBERSCHREIBT EINE WAHL. Wer Phosphor gewaehlt hat und
 *      morgens Papier vorfindet, weil die Verwaltung etwas umgestellt hat,
 *      erlebt einen Fehler, kein Merkmal. Die Bedingung dagegen steht in EINER
 *      Zeile in applyDefaultSkin, und eine Zeile faellt beim Umbauen leicht weg.
 *
 *   2. DIE VORGABE WIRD ZUR WAHL. Wuerden beide in denselben Schluessel
 *      geschrieben, waere die erste Anwendung zugleich eine Wahl: der Gast
 *      behielte fuer immer das Aussehen vom Tag seines ersten Besuchs, und
 *      keine spaetere Aenderung erreichte ihn je wieder.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Wie in den anderen AppState-Tests: die API-Kette zieht Supabase herein, das
// ohne VITE_SUPABASE_* wirft.
vi.mock('../src/services/api/index.js', () => ({ settingsApi: {}, adminApi: {} }));

import { AppStateManager } from '../src/services/AppStateManager.js';
import { isPlatformSkin } from '../src/services/theme-presets.js';

const WAHL = 'velg-platform-skin';
const VORGABE = 'velg-default-skin';

describe('die Vorgabe des Hauses gegen die Wahl des Lesers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ohne alles ist es Phosphor', () => {
    expect(new AppStateManager().platformSkin.value).toBe('dark');
  });

  it('die gemeldete Vorgabe gilt, wenn niemand gewaehlt hat', () => {
    localStorage.setItem(VORGABE, 'atlas');
    expect(new AppStateManager().platformSkin.value).toBe('atlas');
  });

  it('die eigene Wahl schlaegt die Vorgabe', () => {
    localStorage.setItem(VORGABE, 'atlas');
    localStorage.setItem(WAHL, 'dark');
    expect(new AppStateManager().platformSkin.value).toBe('dark');
  });

  /*
   * Der Fall, um den es der Sache nach geht: der Abruf kommt zurueck, waehrend
   * jemand mit eigener Wahl auf der Seite ist.
   */
  it('applyDefaultSkin ruehrt eine getroffene Wahl NICHT an', () => {
    const s = new AppStateManager();
    s.setPlatformSkin('dark');
    s.applyDefaultSkin('atlas');
    expect(s.platformSkin.value).toBe('dark');
    expect(localStorage.getItem(WAHL)).toBe('dark');
  });

  it('applyDefaultSkin merkt sich die Vorgabe trotzdem — fuer den naechsten Aufruf', () => {
    const s = new AppStateManager();
    s.setPlatformSkin('dark');
    s.applyDefaultSkin('atlas');
    expect(localStorage.getItem(VORGABE)).toBe('atlas');
  });

  it('applyDefaultSkin wirkt sofort, wenn niemand gewaehlt hat', () => {
    const s = new AppStateManager();
    expect(s.platformSkin.value).toBe('dark');
    s.applyDefaultSkin('atlas');
    expect(s.platformSkin.value).toBe('atlas');
    expect(localStorage.getItem(WAHL)).toBeNull();
  });

  /*
   * Das Trennen der zwei Schluessel ist die eigentliche Entscheidung. Fielen
   * sie zusammen, waere jeder Test darueber gruen und die Sache trotzdem
   * kaputt — deshalb hier ausdruecklich.
   */
  it('die Vorgabe wird nie zur Wahl', () => {
    const s = new AppStateManager();
    s.applyDefaultSkin('atlas');
    expect(localStorage.getItem(WAHL)).toBeNull();

    // Und eine spaetere Aenderung des Hauses erreicht denselben Leser noch.
    s.applyDefaultSkin('dark');
    expect(s.platformSkin.value).toBe('dark');
  });

  /*
   * Was auf der Leitung ankommt, ist eine Zeichenkette aus einer Datenbank.
   * Der Waechter nimmt seit dem 04.09.2026 `unknown`, weil seine drei Aufrufer
   * (Ablage, JSON, Verwaltungsformular) alle nichts versprechen koennen.
   */
  it('der Waechter weist alles zurueck, was keine Ausgabe ist', () => {
    for (const gut of ['dark', 'atlas']) expect(isPlatformSkin(gut)).toBe(true);
    for (const schlecht of [null, undefined, '', 'Dark', 'papier', 42, {}, ['atlas']]) {
      expect(isPlatformSkin(schlecht), String(schlecht)).toBe(false);
    }
  });

  it('ein unbekannter Name in der Ablage faellt auf Phosphor zurueck, nicht auf sich selbst', () => {
    localStorage.setItem(VORGABE, 'sepia');
    expect(new AppStateManager().platformSkin.value).toBe('dark');
  });
});
