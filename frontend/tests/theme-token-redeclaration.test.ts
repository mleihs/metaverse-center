/**
 * EIN ABGELEITETES TOKEN MUSS AUF DEM THEME-WIRT NEU GESCHRIEBEN WERDEN.
 *
 * DIE FALLE
 *   Ein `var()` INNERHALB einer Custom Property löst dort auf, wo die Property
 *   DEKLARIERT ist — nicht dort, wo sie benutzt wird. `_colors.css` deklariert
 *   in `:root`:
 *
 *     --color-text-danger: var(--color-danger);
 *
 *   Das sieht aus wie eine Weiterleitung, die immer stimmt; sie nennt ja gerade
 *   keinen Wert. Aber der berechnete Wert entsteht an `:root`, mit dem Rot der
 *   Plattform, und was ein Theme-Wirt weiter unten erbt, ist dieses Rot als
 *   fertiger Hexwert. Das Theme kann `--color-danger` setzen, so oft es will.
 *
 *   Deshalb schreibt `ThemeService.applyConfig` in Schritt 7 eine Liste solcher
 *   Tokens auf JEDEN Theme-Wirt neu. Die Liste ist die einzige Stelle, an der
 *   dieser Fehler verhindert wird — und sie muss von Hand gepflegt werden.
 *
 * WARUM ALS TEST
 *   Der Fehler ist am 03.09.2026 fünf Mal auf einmal gefunden worden, beim
 *   Nachmessen im Browser und nicht durch einen Test:
 *
 *     --color-overlay-ink-bright  am selben Tag ergänzt, nur in :root
 *     --color-text-link           #3b82f6 statt Kohlepapier-Blau #2f3f7a
 *     --color-text-danger         #ef4444 statt #b3261e
 *     --color-border-danger       #ef4444 statt #b3261e
 *     --color-border-focus        Amber statt Zinnober #b63c24
 *
 *   Vier davon waren nicht neu. Sie galten für jede Simulation mit eigenem
 *   Theme, seit es Themes gibt: eine Cyberpunk-Welt zeigte ihren Gefahren-Text
 *   im Plattform-Rot.
 *
 *   Nichts daran war sichtbar. Das Token EXISTIERTE, hatte einen gültigen Wert,
 *   nur den falschen. Kein Fehler, keine Warnung, kein roter Test — und für
 *   `--color-text-link` auf Papier auch keine hässliche Farbe, bloß die eines
 *   anderen Skins.
 *
 * WAS GEPRÜFT WIRD
 *   Nicht ein Wert und keine Liste von Namen, die neben der echten Liste
 *   veralten würde: die Frage ist mechanisch. Jedes in `:root` deklarierte
 *   Token, dessen Wert auf ein Token zeigt, das ein Theme SETZT, muss nach
 *   `applyConfig` als Inline-Property auf dem Wirt stehen. `styles/tokens/`
 *   ist die eine Quelle der Tokens, `applyConfig` die eine Quelle der Wirkung.
 *   Kommt in der CSS eines dazu, wird dieser Test rot, ohne dass ihn jemand
 *   anfasst.
 *
 * WARUM ALLE TOKEN-DATEIEN UND NICHT NUR DIE FARBEN
 *   Die erste Fassung dieses Tests las nur `_colors.css` — weil die fünf zuerst
 *   gefundenen Fälle Farben waren. Sie war damit ein Tor, das genau das fängt,
 *   was man ihm gesagt hat. Beim Nachmessen der Schrift stand
 *   `--heading-font: var(--font-brutalist)` in `_typography.css`: dieselbe
 *   Falle, eine Datei weiter, und die schwerste von allen — `_global.css` setzt
 *   damit die Schrift von h1–h6, also erbte jede Welt das Courier der Plattform
 *   in ihren Überschriften. Auf dieselbe Weise kamen `--transition-fast/normal/
 *   slow` und `--h6-size` dazu.
 *
 *   Die Frage hat nichts mit Farbe zu tun. Der Test liest deshalb jede Datei
 *   in `styles/tokens/`, nicht die, in der der Fehler zuerst auffiel.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Wie in platform-skin-switch.test.ts: ThemeService zieht über settingsApi die
// Supabase-Kette herein, die ohne VITE_SUPABASE_* wirft.
vi.mock('../src/services/api/index.js', () => ({
  settingsApi: {},
}));

import { PLATFORM_ATLAS_CONFIG } from '../src/services/theme-presets.js';
import { themeService } from '../src/services/ThemeService.js';

/*
 * `new URL(rel, import.meta.url)` löst unter happy-dom gegen die Dokumentbasis
 * auf (gemessen: http://localhost:3000/src/…), und readFileSync verweigert das.
 * Deshalb node:path — dieselbe Korrektur wie in drift-platform-theme.test.ts.
 */
const TOKENS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles/tokens');

/** Token → { wert, datei } aus dem ERSTEN `:root`-Block jeder Token-Datei. */
function rootDeclarations(): Map<string, { value: string; file: string }> {
  const files = readdirSync(TOKENS_DIR).filter((f) => f.endsWith('.css'));
  expect(files.length, 'keine Token-Dateien gefunden').toBeGreaterThan(5);

  const decls = new Map<string, { value: string; file: string }>();
  for (const file of files) {
    const css = readFileSync(resolve(TOKENS_DIR, file), 'utf-8');
    const open = css.indexOf(':root');
    if (open < 0) continue;
    const brace = css.indexOf('{', open);
    const close = css.indexOf('\n}', brace);
    if (brace < 0 || close < brace) continue;

    // Kommentare weg, sonst zählt ein Beispiel in Prosa als Deklaration.
    const body = css.slice(brace + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const line of body.split(';')) {
      const m = line.match(/(--[a-z0-9-]+)\s*:\s*([\s\S]+)/i);
      // Erste Deklaration gewinnt, wie in der Kaskade bei gleicher Spezifität
      // nicht — aber hier geht es nur darum, den Namen überhaupt zu kennen.
      if (m && !decls.has(m[1])) decls.set(m[1], { value: m[2].trim(), file });
    }
  }
  expect(decls.size, 'keine Deklarationen gelesen — Parser oder Dateien kaputt').toBeGreaterThan(
    100,
  );
  return decls;
}

/** Die Custom Properties, die als Inline-Style auf dem Wirt stehen. */
function inlineTokens(el: HTMLElement): Set<string> {
  const names = new Set<string>();
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    if (name.startsWith('--')) names.add(name);
  }
  return names;
}

describe('jedes abgeleitete Farbtoken folgt seinem Theme', () => {
  let written: Set<string>;
  let decls: Map<string, { value: string; file: string }>;

  beforeEach(() => {
    document.body.replaceChildren();
    // applyConfig hängt pro Schriftfamilie ein <link> an; happy-dom holt es
    // wirklich. Das Einfügen verschlucken, hier geht es um Tokens.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);

    const host = document.createElement('div');
    document.body.appendChild(host);
    themeService.applyConfig(PLATFORM_ATLAS_CONFIG, host);

    written = inlineTokens(host);
    decls = rootDeclarations();
  });

  it('schreibt überhaupt Tokens auf den Wirt', () => {
    expect(written.size).toBeGreaterThan(40);
  });

  it('schreibt jedes :root-Token neu, das auf ein vom Theme gesetztes zeigt', () => {
    /*
     * „Vom Theme gesetzt" heißt: applyConfig hat es auf den Wirt geschrieben.
     * Das ist die Wirkung selbst, nicht eine zweite Aufzählung davon — genau
     * darum kann diese Prüfung nicht an einer veralteten Liste vorbeilaufen.
     */
    const offenders: string[] = [];

    for (const [token, { value, file }] of decls) {
      if (written.has(token)) continue;

      const referenced = [...value.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]);
      const themed = referenced.filter((r) => written.has(r));
      if (themed.length > 0) {
        offenders.push(`${file}  ${token}: ${value}  →  erbt fest: ${themed.join(', ')}`);
      }
    }

    expect(
      offenders,
      [
        'Diese Tokens sind in :root über ein vom Theme gesetztes Token deklariert,',
        'werden aber auf dem Theme-Wirt NICHT neu geschrieben. Ihr Wert entsteht',
        'an :root, mit der Palette der Plattform, und jedes Theme erbt ihn als',
        'fertigen Hexwert — lautlos.',
        '',
        'Behebung: das Token in granularityPairs (ThemeService, Schritt 7)',
        'aufnehmen, mit demselben Ausdruck wie in der Token-Datei.',
        '',
        ...offenders.map((o) => `  ${o}`),
        '',
      ].join('\n'),
    ).toEqual([]);
  });
});
