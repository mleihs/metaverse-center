// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LANDING_IMAGE_SETS,
  LANDING_IMAGE_SIZES,
  LANDING_IMAGE_WIDTHS,
  landingFallbackUrl,
  landingSrcset,
} from '../src/components/landing/landing-images.js';

/**
 * Der Vertrag zwischen `landing-images.ts` und `derive_landing_images.py`.
 *
 * Der Kopf des TS-Moduls versprach seit jeher: „ein Ableitungslauf, der andere
 * Breiten schreibt, macht `landing-images.spec` rot statt die Seite still
 * kaputt." Diese Datei gab es nicht — nirgends im Repo, unter keinem Namen, und
 * `vitest.config.ts` haette ein `.spec` ohnehin nicht eingesammelt. Der Vertrag
 * hatte also null Durchsetzung, waehrend die Zahl der Kopplungspunkte auf acht
 * Staemme mal Rollen mal Breiten gewachsen ist.
 *
 * Was ein Bruch bedeutet: `tsc` bleibt gruen, das Linten bleibt gruen, CI bleibt
 * gruen — und die Frontseite liefert eine 404 auf ihr LCP-Bild. `<picture>`
 * waehlt nur nach `type` und `media` und versucht bei einem Fehlschlag keine
 * andere Quelle; ein Kandidat, den es nicht gibt, ist ein leerer Rahmen.
 *
 * Deshalb wird hier die PYTHON-Tabelle gelesen und gegen die TS-Tabelle
 * gestellt. Nicht umgekehrt: gemessen und gewaehlt werden die Breiten in
 * Python, TypeScript spiegelt sie nur.
 */

const PY = readFileSync(
  resolve(process.cwd(), '..', 'scripts', 'derive_landing_images.py'),
  'utf8',
);

/** Python-Variablenname (`_HERO_PORTRAIT`) -> Rollenname (`heroPortrait`). */
function pythonRoleVars(): Map<string, string> {
  const vars = new Map<string, string>();
  for (const [, variable, name] of PY.matchAll(/^(_[A-Z_]+) = Role\(\s*\n\s*name="(\w+)"/gm)) {
    vars.set(variable, name);
  }
  return vars;
}

/** Alle `Role(...)`-Bloecke aus dem Python-Modul, mit Namen und Breiten. */
function pythonRoles(): Map<string, number[]> {
  const roles = new Map<string, number[]>();
  const blockRe = /Role\(\s*\n\s*name="([a-zA-Z]+)",([\s\S]*?)\n\)/g;
  for (const [, name, body] of PY.matchAll(blockRe)) {
    const widths = /widths=\(([^)]*)\)/.exec(body);
    if (!widths) continue;
    roles.set(
      name,
      widths[1]
        .split(',')
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter((n) => Number.isFinite(n)),
    );
  }
  return roles;
}

/** `_SOURCES` als Kennung -> Rollennamen. */
function pythonSets(): Map<string, string[]> {
  const table = /_SOURCES:[^=]*= \{([\s\S]*?)\n\}/.exec(PY);
  if (!table) throw new Error('_SOURCES nicht gefunden');
  const vars = pythonRoleVars();
  const sets = new Map<string, string[]>();
  const rowRe = /"[^"]+":\s*\("([^"]+)",\s*\(([^)]*)\)\)/g;
  for (const [, stem, roles] of table[1].matchAll(rowRe)) {
    sets.set(
      stem,
      roles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => vars.get(r) ?? r),
    );
  }
  return sets;
}

describe('landing-images: der Vertrag mit derive_landing_images.py', () => {
  it('kennt dieselben Rollen wie Python', () => {
    expect(new Set(pythonRoles().keys())).toEqual(new Set(Object.keys(LANDING_IMAGE_WIDTHS)));
  });

  it('kennt je Rolle dieselben Breiten wie Python', () => {
    // Als MENGE verglichen, nicht als Folge: Python sortiert absteigend,
    // TypeScript aufsteigend. Genau diese Abweichung hat `landingFallbackUrl`
    // beinahe an die falsche Datei gehaengt - siehe dort.
    for (const [name, widths] of pythonRoles()) {
      const ts = LANDING_IMAGE_WIDTHS[name as keyof typeof LANDING_IMAGE_WIDTHS];
      expect(new Set(ts), `Breiten der Rolle ${name}`).toEqual(new Set(widths));
    }
  });

  it('kennt dieselben Staemme wie Python, mit denselben Rollen', () => {
    const py = pythonSets();
    expect(new Set(py.keys())).toEqual(new Set(Object.keys(LANDING_IMAGE_SETS)));
    for (const [stem, roles] of py) {
      const ts = LANDING_IMAGE_SETS[stem as keyof typeof LANDING_IMAGE_SETS];
      expect(new Set<string>(ts), `Rollen von ${stem}`).toEqual(new Set(roles));
    }
  });

  it('hat fuer jede Rolle ein sizes', () => {
    // Eine Rolle ohne `sizes` liefert `sizes=undefined` ins Markup, und der
    // Browser faellt still auf 100vw zurueck - also auf die groesste Stufe.
    for (const role of Object.keys(LANDING_IMAGE_WIDTHS)) {
      expect(LANDING_IMAGE_SIZES[role as keyof typeof LANDING_IMAGE_SIZES]).toBeTruthy();
    }
  });
});

describe('landing-images: die Erzeuger', () => {
  it('baut ein srcset ueber alle Breiten der Rolle', () => {
    const set = landingSrcset('hero-intake-hall', 'heroWide', 'avif');
    expect(set.split(', ')).toHaveLength(LANDING_IMAGE_WIDTHS.heroWide.length);
    expect(set).toContain('hero-intake-hall-heroWide-1280.avif 1280w');
  });

  it('nimmt fuer den Rueckfall die groesste Breite, nicht die letzte', () => {
    // Der Grund fuer `Math.max`: waere die Leiter absteigend eingetragen -
    // so wie in der Python-Tabelle -, haette das letzte Element die KLEINSTE
    // Breite geliefert, und zwar ohne dass irgendetwas rot geworden waere.
    expect(landingFallbackUrl('hero-intake-hall', 'heroPortrait')).toContain(
      `heroPortrait-${Math.max(...LANDING_IMAGE_WIDTHS.heroPortrait)}.webp`,
    );
    const absteigend = [...LANDING_IMAGE_WIDTHS.heroPortrait].sort((a, b) => b - a);
    expect(Math.max(...absteigend)).toBe(Math.max(...LANDING_IMAGE_WIDTHS.heroPortrait));
  });
});
