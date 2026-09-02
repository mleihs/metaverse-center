/**
 * Der Beruf ist ausgeblendet — an EINER Stelle, und keine geht daran vorbei.
 *
 * Am 02.09.2026 auf Prod gemessen: es gibt drei Berufssysteme, und keines
 * kennt ein anderes.
 *
 *   agents.primary_profession            111 Zeilen · 104 verschiedene Werte
 *   simulation_taxonomies (profession)   187 Zeilen · von niemandem gelesen
 *   agent_professions                    180 Zeilen · mit Qualifikationsgrad
 *   building_profession_requirements       0 Zeilen · die verbrauchende Seite
 *
 * Ein Beruf bewirkt also nichts. Bis eines der drei Systeme trägt, zeigt die
 * Oberfläche ihn nicht an — sonst behauptet sie eine Spielbedeutung, die es
 * nicht gibt.
 *
 * Dieser Test hält zwei Dinge fest, die beim Zurückschalten sofort wieder
 * gelten sollen:
 *
 *   1. Das Ausblenden hängt an EINEM Schalter. Wer ihn umlegt, holt alle
 *      dreizehn Anzeigestellen gleichzeitig zurück.
 *   2. Keine Anzeigestelle liest den Beruf an dem Schalter vorbei. Ohne diese
 *      Zusicherung bringt die nächste neue Karte ihn stillschweigend wieder
 *      auf den Schirm, und niemand merkt es, weil nichts rot wird.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROFESSION_DISPLAY_ENABLED, professionLabel } from '../src/utils/profession.js';

const COMPONENTS = resolve(process.cwd(), 'src/components');

function allTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allTs(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('der Schalter', () => {
  it('steht auf aus, solange ein Beruf nichts bewirkt', () => {
    expect(PROFESSION_DISPLAY_ENABLED).toBe(false);
  });

  it('liefert leer, egal was ankommt', () => {
    expect(professionLabel('Bildredakteurin beim Staatsrundfunk')).toBe('');
    expect(professionLabel(null)).toBe('');
    expect(professionLabel(undefined)).toBe('');
  });
});

describe('keine Anzeigestelle geht am Schalter vorbei', () => {
  /**
   * `WorldSettingsPanel` ist die Ausnahme und bleibt es: dort ist
   * `profession` kein Beruf, sondern der NAME einer Taxonomie in einer
   * Auswahlliste. Ihn auszublenden würde dem Administrator eine Zeile
   * wegnehmen, die er pflegen können muss.
   */
  const AUSNAHMEN = ['WorldSettingsPanel.ts'];

  it('jede Stelle, die einen Beruf liest, ruft professionLabel', () => {
    const verstoesse: string[] = [];

    for (const file of allTs(COMPONENTS)) {
      if (AUSNAHMEN.some((a) => file.endsWith(a))) continue;
      const src = readFileSync(file, 'utf-8');

      for (const [i, line] of src.split('\n').entries()) {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
        const liestBeruf =
          line.includes('primary_profession') || /t\([^)]*,\s*'profession'\)/.test(line);
        if (!liestBeruf) continue;
        if (line.includes('professionLabel')) continue;
        verstoesse.push(`${file.replace(process.cwd() + '/', '')}:${i + 1}  ${line.trim()}`);
      }
    }

    expect(
      verstoesse,
      'Diese Stellen lesen den Beruf direkt statt ueber professionLabel() — sie ' +
        'wuerden ihn wieder anzeigen, ohne dass der Schalter etwas davon weiss:\n  ' +
        verstoesse.join('\n  '),
    ).toEqual([]);
  });
});
