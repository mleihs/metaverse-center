/**
 * DER PLATTFORM-AKZENT KIPPT MIT DER POLARITÄT — UND KIPPT ZURÜCK.
 *
 * DAS PROBLEM, GEMESSEN
 *   `--color-accent-amber` (#f59e0b) steht an 708 Stellen in 126 Dateien; 318
 *   davon sind `color:`, also Text. Auf dem Papiergrund des Atlas-Skins misst
 *   Amber **1,82 : 1** — unlesbar, nicht knapp. `--color-accent-green` steht
 *   bei 1,47.
 *
 *   Seit dem 03.09.2026 ist der Plattform-Akzent auf hellem Grund deshalb der
 *   Akzent des Themes. Auf dunklem Grund bleibt er Amber.
 *
 * WARUM DIESER TEST
 *   Zwei Dinge können still brechen, und beide wären unsichtbar:
 *
 *   1. DIE DOPPELUNG. Die sechs Werte der dunklen Seite stehen zweimal — in
 *      `styles/tokens/_colors.css` und als Konstanten in `ThemeService`. Sie
 *      müssen dort stehen, weil ein dunkler Wirt sie AKTIV zurückschreiben
 *      muss; ein `var(--color-accent-amber)` erbte sonst den Wert des hellen
 *      Elternteils. Eine Doppelung, die auseinanderläuft, ist genau die Art
 *      Fehler, die niemand bemerkt: die Plattform bliebe amber, nur eine Spur
 *      anders. Dieser Test bindet sie an die CSS-Datei.
 *
 *   2. DIE UMKEHRBARKEIT. `DriftView` und `DungeonView` setzen einen dunklen
 *      Wirt INNERHALB der hellen Hülle. Holt der den Amber nicht zurück, steht
 *      der Zwischenraum im Zinnober des Papiers — dieselbe Fehlerklasse, gegen
 *      die `theme-token-redeclaration` angelegt wurde, nur eine Ebene tiefer.
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

/** Die sechs Tokens, die der Plattform-Akzent umfasst. */
const ACCENT_TOKENS = [
  '--color-accent-amber',
  '--color-accent-amber-hover',
  '--color-accent-amber-dim',
  '--color-accent-amber-glow',
  '--color-on-accent-amber',
  '--color-accent-green',
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

describe('der Plattform-Akzent folgt der Polarität', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    // applyConfig hängt pro Schriftfamilie ein <link> an; happy-dom holt es
    // wirklich. Das Einfügen verschlucken.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  });

  it('schreibt auf JEDEM Wirt alle sechs — sonst erbt einer den falschen Wert', () => {
    for (const config of [PLATFORM_DARK_CONFIG, PLATFORM_ATLAS_CONFIG]) {
      const host = themedHost(config);
      for (const token of ACCENT_TOKENS) {
        expect(inline(host, token), `${token} fehlt auf dem Wirt`).not.toBe('');
      }
    }
  });

  it('auf dunklem Grund bleibt der Akzent das Amber der Plattform', () => {
    const host = themedHost(PLATFORM_DARK_CONFIG);
    expect(inline(host, '--color-accent-amber')).toBe('#f59e0b');
    expect(inline(host, '--color-accent-green')).toBe('#4ade80');
  });

  it('auf hellem Grund wird er der Akzent des Themes', () => {
    const host = themedHost(PLATFORM_ATLAS_CONFIG);
    expect(inline(host, '--color-accent-amber')).toBe('var(--color-primary)');
    expect(inline(host, '--color-accent-green')).toBe('var(--color-success)');
    // Die Tinte AUF der Fläche kippt mit: dunkle Tinte trägt auf Amber (7,76),
    // auf dem Zinnober nicht (3,90).
    expect(inline(host, '--color-on-accent-amber')).toBe('var(--color-text-inverse)');
  });

  /*
   * Der Fall, der DriftView und DungeonView betrifft: ein dunkler Wirt in einer
   * hellen Hülle. Ohne aktives Zurückschreiben stünde der Zwischenraum im
   * Zinnober des Papiers.
   */
  it('ein dunkler Wirt INNERHALB eines hellen holt das Amber zurück', () => {
    const paper = themedHost(PLATFORM_ATLAS_CONFIG);
    const crt = themedHost(PLATFORM_DARK_CONFIG, paper);

    expect(inline(paper, '--color-accent-amber')).toBe('var(--color-primary)');
    expect(inline(crt, '--color-accent-amber')).toBe('#f59e0b');
    expect(inline(crt, '--color-accent-green')).toBe('#4ade80');
  });

  /*
   * Die Doppelung an ihre Quelle binden. Ohne diesen Test wäre eine Korrektur
   * in _colors.css folgenlos: die Plattform bliebe amber, nur eine Spur anders,
   * und zwar nur auf jedem Theme-Wirt — nicht auf :root.
   */
  it('die Konstanten in ThemeService stimmen mit _colors.css überein', () => {
    const css = readFileSync(COLORS_CSS, 'utf-8');
    const ts = readFileSync(THEME_SERVICE, 'utf-8');

    const missing: string[] = [];
    for (const token of ACCENT_TOKENS) {
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
        'ThemeService.publishPlatformAccent. Ein dunkler Wirt schreibt dann',
        'einen ANDEREN Wert zurück als :root deklariert — die Plattform bliebe',
        'amber, nur eine Spur anders, und nur auf Theme-Wirten.',
        '',
        ...missing.map((m) => `  ${m}`),
        '',
      ].join('\n'),
    ).toEqual([]);
  });
});
