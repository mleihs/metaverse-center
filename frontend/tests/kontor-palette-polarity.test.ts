/**
 * DIE ZEHN KONTOR-ROLLEN KIPPEN MIT DER POLARITÄT — UND KIPPEN ZURÜCK.
 *
 * WOHER SIE KOMMEN
 *   Das Kostenpanel „Kontor" brachte zehn Rollen mit, die es vorher nicht gab:
 *   der Zeichenton der Zellzustände, das invertierte Kostenpaar, zwei
 *   Diagrammserien, die Hochrechnung, zwei Schraffuren, die Gitterlinie und
 *   der Zeilen-Hover.
 *
 * WARUM SIE NICHT IN THEME_TOKEN_MAP STEHEN
 *   Der Entwurf schlug zehn Einstellungsschlüssel vor. Das hätte den
 *   Atlas-Skin bedient und die sechs hellen WELT-Themes still auf den dunklen
 *   Werten stehen lassen — ein nicht geschriebenes Token ist kein Vorgabewert,
 *   sondern ein geerbter. Gemessen, bevor eine Zeile gebaut war: der
 *   Serientext #94a3b8 misst auf hellem Papier 1,9 : 1.
 *
 *   Diese zehn beschreiben, wie eine ZAHL AUF EINEM GRUND liegt, nicht welche
 *   Farbe eine Welt hat. Deshalb dieselbe Behandlung wie der Plattform-Akzent
 *   eine Etage darüber: einmal in JS an der Polarität gekippt.
 *
 * WARUM DIESER TEST
 *   Dieselben zwei Dinge, die beim Akzent still brechen können:
 *
 *   1. DIE DOPPELUNG. Der dunkle Satz steht zweimal — in
 *      `styles/tokens/_colors.css` und als `KONTOR_DARK` in `ThemeService`. Er
 *      MUSS dort stehen, weil ein dunkler Wirt ihn aktiv zurückschreiben muss.
 *      Läuft die Doppelung auseinander, sieht das Panel auf :root anders aus
 *      als auf jedem Theme-Wirt — und niemand bemerkt es, weil beide Zustände
 *      für sich plausibel sind.
 *
 *   2. DIE UMKEHRBARKEIT. Ein dunkler Wirt INNERHALB eines hellen (DriftView,
 *      DungeonView) muss den dunklen Satz zurückholen, sonst erbt er das
 *      Papier.
 *
 *   Die KONTRASTE der Werte prüft dieser Test nicht — das tut
 *   `scripts/lint-series-palette-grounds.mjs` (Teil 2) gegen die drei Gründe
 *   jedes Themes. Hier geht es nur darum, DASS geschrieben wird und WAS.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Wie in den anderen ThemeService-Tests: settingsApi zieht die Supabase-Kette
// herein, die ohne VITE_SUPABASE_* wirft.
vi.mock('../src/services/api/index.js', () => ({
  settingsApi: {},
}));

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORM_ATLAS_CONFIG, PLATFORM_DARK_CONFIG } from '../src/services/theme-presets.js';
import { themeService } from '../src/services/ThemeService.js';

/** Die zehn Rollen, die `publishKontorPalette` schreibt. */
const KONTOR_TOKENS = [
  '--color-chart-grid',
  '--color-text-glyph',
  '--color-delta-adverse',
  '--color-delta-benign',
  '--color-series-image',
  '--color-series-text',
  '--color-series-forecast',
  '--color-hatch',
  '--color-hatch-bg',
  '--color-row-hover',
] as const;

/*
 * node:path statt new URL(rel, import.meta.url): letzteres löst unter happy-dom
 * gegen die Dokumentbasis auf, und readFileSync verweigert das.
 */
const COLORS_CSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/styles/tokens/_colors.css',
);
const THEME_SERVICE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/services/ThemeService.ts',
);

function themedHost(config: Record<string, string>, parent?: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  (parent ?? document.body).appendChild(host);
  themeService.applyConfig(config, host);
  return host;
}

/** Was auf diesem Wirt als Inline-Style steht — nicht der geerbte Wert. */
function inline(el: HTMLElement, token: string): string {
  return el.style.getPropertyValue(token).trim();
}

describe('die Kontor-Rollen folgen der Polarität', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    // applyConfig hängt pro Schriftfamilie ein <link> an; happy-dom holt es
    // wirklich. Das Einfügen verschlucken.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  });

  it('schreibt auf JEDEM Wirt alle zehn — sonst erbt einer den falschen Wert', () => {
    for (const config of [PLATFORM_DARK_CONFIG, PLATFORM_ATLAS_CONFIG]) {
      const host = themedHost(config);
      for (const token of KONTOR_TOKENS) {
        expect(inline(host, token), `${token} fehlt auf dem Wirt`).not.toBe('');
      }
    }
  });

  it('auf dunklem Grund steht der Phosphorsatz', () => {
    const host = themedHost(PLATFORM_DARK_CONFIG);
    expect(inline(host, '--color-series-text')).toBe('#94a3b8');
    expect(inline(host, '--color-text-glyph')).toBe('#6b6b6b');
    expect(inline(host, '--color-hatch-bg')).toBe('#2e2e2e');
  });

  it('auf hellem Grund steht der Papiersatz', () => {
    const host = themedHost(PLATFORM_ATLAS_CONFIG);
    expect(inline(host, '--color-series-text')).toBe('#4b5f57');
    expect(inline(host, '--color-text-glyph')).toBe('#6b7a72');
    expect(inline(host, '--color-hatch-bg')).toBe('#c2ccc4');
  });

  /*
   * Der Wert, der beim Nachmessen gehoben werden musste. Er steht hier
   * namentlich, damit eine Rückkehr auf #b3261e („der Entwurf sagt doch…")
   * eine rote Zeile ergibt und keine stille Regression: #b3261e misst auf der
   * cremefarbenen `sunken`-Auflage von Illuminated (#E0D4BE) 4,46 : 1.
   */
  it('das teurer-Zeichen steht auf dem gehobenen Wert, nicht auf dem des Entwurfs', () => {
    const host = themedHost(PLATFORM_ATLAS_CONFIG);
    expect(inline(host, '--color-delta-adverse')).toBe('#b1261e');
  });

  /*
   * Der Fall, der DriftView und DungeonView betrifft: ein dunkler Wirt in einer
   * hellen Hülle. Ohne aktives Zurückschreiben stünde das Panel dort auf dem
   * Papiersatz.
   */
  it('ein dunkler Wirt INNERHALB eines hellen holt den Phosphorsatz zurück', () => {
    const paper = themedHost(PLATFORM_ATLAS_CONFIG);
    const crt = themedHost(PLATFORM_DARK_CONFIG, paper);

    expect(inline(paper, '--color-series-text')).toBe('#4b5f57');
    expect(inline(crt, '--color-series-text')).toBe('#94a3b8');
    expect(inline(crt, '--color-hatch-bg')).toBe('#2e2e2e');
  });

  /*
   * Die Doppelung an ihre Quelle binden. Ohne diesen Test wäre eine Korrektur
   * in _colors.css folgenlos: :root sähe anders aus als jeder Theme-Wirt.
   */
  it('KONTOR_DARK stimmt mit _colors.css überein', () => {
    const css = readFileSync(COLORS_CSS, 'utf-8');
    const ts = readFileSync(THEME_SERVICE, 'utf-8');

    const missing: string[] = [];
    for (const token of KONTOR_TOKENS) {
      const declared = css.match(new RegExp(`${token}:\\s*([^;]+);`));
      expect(declared, `${token} steht nicht in _colors.css`).not.toBeNull();
      // biome-ignore lint/style/noNonNullAssertion: das expect darüber ist der Schutz.
      const value = declared![1].trim();
      if (!ts.includes(`'${value}'`)) missing.push(`${token}: ${value}`);
    }

    expect(
      missing,
      [
        'Diese Werte stehen in _colors.css, aber nicht als Konstante in',
        'ThemeService.publishKontorPalette. Ein dunkler Wirt schreibt dann',
        'einen ANDEREN Wert zurück als :root deklariert — das Panel sähe auf',
        ':root anders aus als auf jedem Theme-Wirt.',
        '',
        ...missing.map((m) => `  ${m}`),
        '',
      ].join('\n'),
    ).toEqual([]);
  });
});
