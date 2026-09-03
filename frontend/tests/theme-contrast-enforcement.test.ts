/**
 * ThemeService step 1b — the legibility guarantee.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT PROVE
 *   happy-dom resolves custom properties that are set INLINE on an element,
 *   and does NOT resolve ones the element inherits from an ancestor. Measured,
 *   not assumed:
 *
 *       el.style.setProperty('--x', v);  getComputedStyle(el)  -> v      ✓
 *       parent.style.setProperty('--y', v); getComputedStyle(child) -> '' ✗
 *
 *   So every case below hands the host all three grounds explicitly, which is
 *   also what a saved world config does. The case where a world defines only
 *   `color_background` and inherits `--color-surface-raised` from `:root`
 *   CANNOT be exercised here — under happy-dom that ground silently resolves
 *   to '' and drops out of the list. A green run of this file is therefore not
 *   a statement about the inherited path; that one is verified in a real
 *   browser against prod.
 *
 *   Writing that down rather than letting the green tick imply coverage no
 *   test promised is the whole point — it is the same shape as the .css file
 *   that no gate was responsible for.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api/index.js', () => ({ settingsApi: {} }));
vi.mock('../src/services/SentryService.js', () => ({ captureError: vi.fn() }));

import { contrastRatio, parseColor } from '../src/utils/contrast-lift.js';
import { themeService } from '../src/services/ThemeService.js';

/** The world measured on prod on 2026-08-31: cream surfaces, mid-grey muted. */
const HELLE_WELT: Record<string, string> = {
  color_background: '#f5f0e8',
  color_surface: '#ffffff',
  color_surface_sunken: '#efe9df',
  color_text: '#1a1a2e',
  color_text_secondary: '#4a4a5e',
  color_text_muted: '#8a8a9e',
};

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function ratioAgainstGrounds(el: HTMLElement, token: string): number {
  const fg = parseColor(getComputedStyle(el).getPropertyValue(token).trim());
  expect(fg).not.toBeNull();
  const grounds = ['--color-surface', '--color-surface-raised', '--color-surface-sunken']
    .map((t) => parseColor(getComputedStyle(el).getPropertyValue(t).trim()))
    .filter((c) => c !== null);
  expect(grounds.length).toBe(3);
  return Math.min(...grounds.map((g) => contrastRatio(fg as NonNullable<typeof fg>, g as NonNullable<typeof fg>)));
}

describe('ThemeService 1b — Lesbarkeit der Textrollen', () => {
  it('hebt ein Grau, das auf der eigenen Flaeche durchfaellt', () => {
    const el = host();
    // Der gespeicherte Wert faellt durch: von Hand gerechnet 2,98 : 1 auf
    // #f5f0e8. Diese Zahl stammt aus der Messung auf der lebenden Seite, nicht
    // aus derselben Funktion, die der Test prueft.
    const vorher = contrastRatio(
      parseColor('#8a8a9e') as NonNullable<ReturnType<typeof parseColor>>,
      parseColor('#f5f0e8') as NonNullable<ReturnType<typeof parseColor>>,
    );
    expect(vorher).toBeCloseTo(2.98, 1);

    themeService.applyConfig(HELLE_WELT, el);

    expect(ratioAgainstGrounds(el, '--color-text-muted')).toBeGreaterThanOrEqual(4.5);
  });

  it('laesst eine Rolle, die schon traegt, unveraendert', () => {
    const el = host();
    // #4a4a5e auf #f5f0e8 = 7,61 : 1, von Hand gerechnet. Nichts zu tun.
    themeService.applyConfig(HELLE_WELT, el);
    expect(el.style.getPropertyValue('--color-text-secondary')).toBe('#4a4a5e');
  });

  it('haelt den Farbton — es wandert die Helligkeit, nicht die Farbe', () => {
    const el = host();
    themeService.applyConfig(HELLE_WELT, el);
    const gehoben = parseColor(el.style.getPropertyValue('--color-text-muted'));
    expect(gehoben).not.toBeNull();
    const g = gehoben as NonNullable<typeof gehoben>;
    // Zuerst: es MUSS sich bewegt haben. Ohne diese Zeile bestand der Test
    // auch bei abgeklemmtem 1b — #8a8a9e erfuellt die Farbton-Bedingungen
    // unten von sich aus, und ein Test, der eine Voraussetzung vorfindet
    // statt sie herzustellen, ist gruen, soweit er Glueck hat.
    const original = parseColor('#8a8a9e') as NonNullable<typeof gehoben>;
    expect(g.r).toBeLessThan(original.r);

    // Und dann: der Farbton ueberlebt. #8a8a9e ist blaustichig (B > R = G),
    // die Hebung Richtung #1a1a2e (ebenfalls blaustichig) muss das halten.
    expect(g.b).toBeGreaterThan(g.r);
    expect(Math.round(g.r)).toBe(Math.round(g.g));
  });

  it('meldet am Host, wie viele Rollen gehoben wurden', () => {
    const el = host();
    themeService.applyConfig(HELLE_WELT, el);
    expect(el.dataset.contrastLifted).toBe('1');
  });

  it('setzt die Meldung zurueck, wenn eine Welt nichts noetig hat', () => {
    const el = host();
    themeService.applyConfig(HELLE_WELT, el);
    expect(el.dataset.contrastLifted).toBe('1');
    themeService.applyConfig(
      { ...HELLE_WELT, color_text_muted: '#4a4a5e' },
      el,
    );
    expect(el.dataset.contrastLifted).toBeUndefined();
  });

  it('ruehrt --color-primary nicht an', () => {
    const el = host();
    // In dieser Welt IST primary gleich der Textfarbe — genau der Fall, an dem
    // der urspruengliche 81-Dateien-Vorschlag gescheitert waere.
    themeService.applyConfig({ ...HELLE_WELT, color_primary: '#1a1a2e' }, el);
    expect(el.style.getPropertyValue('--color-primary')).toBe('#1a1a2e');
  });
});

/**
 * Der Fall, den dieses Testfeld nicht ausfuehren, aber festhalten kann.
 *
 * Am 03.09.2026 auf Prod gemessen: `velg-app` trug KEINEN
 * `data-contrast-lifted`-Marker — die Hebung hatte null Token gehoben, in
 * jedem Theme, seit es sie gibt. Der Grund war nicht die Auswahl der Token,
 * sondern das LESEN:
 *
 *     getComputedStyle(el).getPropertyValue('--x')
 *
 * gibt bei einer Custom Property den SPEZIFIZIERTEN Text zurueck. Fuer
 * `#a0a0a0` ist das dasselbe wie die Farbe, fuer `color-mix(...)` nicht — und
 * `parseColor` kennt kein `color-mix`. Genau die zwei meistgenutzten Rollen
 * sind so definiert:
 *
 *     --color-text-quiet      967 Verwendungen   color-mix(...)   uebersprungen
 *     --color-text-tertiary   124 Verwendungen   color-mix(...)   uebersprungen
 *     --color-text-secondary  457               #a0a0a0          gehoben
 *     --color-text-muted      185               #888888          gehoben
 *
 * Der Waechter sah 642 Stellen an und uebersprang 1091 — still, denn ein
 * uebersprungener Token sieht aus wie einer, der keine Hebung brauchte.
 *
 * happy-dom rechnet `color-mix` nicht aus, der Lauf laesst sich hier also
 * nicht nachstellen. Was hier steht, bindet stattdessen die FORM der Loesung:
 * gelesen wird ueber ein Probe-Element, dem der Browser `color: var(--x)`
 * ausrechnet, und nicht mehr ueber `getPropertyValue`. Im echten Browser
 * gegen Prod gemessen:
 *
 *     roh          color-mix(in srgb, #888 70%, #e5e5e5)
 *     aufgeloest   color(srgb 0.642745 0.642745 0.642745)   <- parseColor kann das
 */
describe('die Token werden AUFGELOEST gelesen, nicht roh', () => {
  const quelle = readFileSync(
    resolve(process.cwd(), 'src/services/ThemeService.ts'),
    'utf-8',
  );
  const block = quelle.slice(
    quelle.indexOf('private enforceTextContrast'),
    quelle.indexOf('private reportUnparseable'),
  );

  it('liest ueber ein Probe-Element statt ueber getPropertyValue', () => {
    expect(block).toContain("probe.style.color = `var(${token})`");
    expect(block).toContain('getComputedStyle(probe).color');
    expect(
      /const read = \(token: string\): string =>\s*resolved\.getPropertyValue/.test(block),
      'getPropertyValue kann color-mix nicht aufloesen — dann wird still uebersprungen',
    ).toBe(false);
  });

  it('raeumt die Probe auf jedem Ausgang wieder ab', () => {
    // Sie haengt am Wirt; eine vergessene waechst mit jedem Themenwechsel.
    expect((block.match(/probe\.remove\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('hebt auch die zwei meistgenutzten Rollen', () => {
    for (const token of [
      '--color-text-secondary',
      '--color-text-muted',
      '--color-text-quiet',
      '--color-text-tertiary',
    ]) {
      expect(block).toContain(`'${token}'`);
    }
  });
});
