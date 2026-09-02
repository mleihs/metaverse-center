/**
 * Eine Beschriftung, die nie gefragt wird, bleibt englisch — auch wenn das
 * deutsche Wort danebensteht.
 *
 * WAS GEFUNDEN WURDE (01.09.2026, deutsche Oberfläche auf Prod)
 * Das Einsatzterminal zeigte in einer durchgehend deutschen Ansicht `Owner`
 * und `DYSTOPIAN`. Es fehlte keine Übersetzung: `Eigentümer` und `Dystopisch`
 * standen seit jeher im Wörterbuch. Die Anzeigestellen riefen `humanizeEnum()`,
 * und das ist ein VERSCHÖNERER — es macht aus `owner` ein `Owner`, in jeder
 * Sprache gleich, und fragt niemanden.
 *
 * EINE STELLE SAH SOGAR ÜBERSETZT AUS
 *     ${msg(str`${role} // ${theme}`)}
 * Die Vorlage steht im Wörterbuch. Der INHALT der Platzhalter nicht. Ein
 * `msg()` um einen Platzhalter herum besteht jede Prüfung auf unübersetzte
 * Zeichenketten und zeigt trotzdem Englisch.
 *
 * WAS DIESER TEST HÄLT
 * Nicht die Übersetzung selbst — die steht in `de.xlf` und wird dort geprüft.
 * Gehalten wird, dass jeder Aufzählungswert eine Funktion HAT, die ihn fragt,
 * und dass keine neue Anzeigestelle wieder am Wörterbuch vorbeigeht.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BLEED_VECTORS,
  SIMULATION_THEMES,
  bleedVectorLabel,
  effectivenessLabel,
  embassyStatusLabel,
  epochStatusLabel,
  memberRoleLabel,
  simulationThemeLabel,
  staffingStatusLabel,
} from '../src/utils/enum-labels.js';
import { getVectorLabels } from '../src/components/multiverse/map-data.js';

const SRC = resolve(process.cwd(), 'src');

describe('every enum value has a label function that asks for it', () => {
  const CASES: Array<[string, (v: string) => string, readonly string[]]> = [
    ['Themenwelt', simulationThemeLabel, SIMULATION_THEMES],
    ['Mitgliedsrolle', memberRoleLabel, ['owner', 'admin', 'editor', 'viewer', 'architect']],
    [
      'Epochenzustand',
      epochStatusLabel,
      ['lobby', 'foundation', 'competition', 'reckoning', 'completed', 'cancelled'],
    ],
    ['Botschaftszustand', embassyStatusLabel, ['proposed', 'active', 'suspended', 'dissolved']],
    ['Blutungsvektor', bleedVectorLabel, BLEED_VECTORS],
    [
      'Besetzung',
      staffingStatusLabel,
      ['n/a', 'critically_understaffed', 'understaffed', 'operational', 'overcrowded'],
    ],
    ['Wirksamkeit', effectivenessLabel, ['optimal', 'operational', 'limited', 'dormant']],
  ];

  for (const [name, fn, values] of CASES) {
    it(`${name}: jeder Wert bekommt ein Wort, und keines ist der Rohwert`, () => {
      for (const v of values) {
        const label = fn(v);
        expect(label, `${name}/${v} ohne Beschriftung`).toBeTruthy();
        // Der Rohwert selbst darf nie durchkommen: `owner` ist keine
        // Beschriftung, `Owner` schon (die Sprache prüft `de.xlf`).
        expect(label, `${name}/${v} zeigt den Rohwert`).not.toBe(v);
      }
    });
  }

  it('ein unbekannter Wert verschlechtert sich, statt zu verschwinden', () => {
    /* Die Datenbank hält mehr Wörter als der Code kennt — `simulation_members`
     * trägt keine CHECK-Bedingung. Eine Lücke wäre schlimmer als Englisch. */
    expect(memberRoleLabel('curator')).toBe('Curator');
    expect(simulationThemeLabel('solar_punk')).toBe('Solar Punk');
    expect(bleedVectorLabel('')).toBe('');
  });
});

describe('the vector list exists once', () => {
  it('die Multiversum-Karte beschriftet genau die Vektoren der gemeinsamen Quelle', () => {
    /* Vorher stand die Liste in `map-data.ts` ein zweites Mal, Wort für Wort
     * gleich. Eine Kopie, die stimmt, stimmt nur bis zum achten Vektor. */
    const fromMap = Object.keys(getVectorLabels()).sort();
    expect(fromMap).toEqual([...BLEED_VECTORS].sort());
    for (const v of BLEED_VECTORS) {
      expect(getVectorLabels()[v]).toBe(bleedVectorLabel(v));
    }
  });
});

describe('no display site walks past the dictionary again', () => {
  /**
   * Die erlaubten `humanizeEnum()`-Aufrufe, einzeln begründet.
   *
   * Alle sechs verschönern einen Wert, der seine Übersetzung SELBST mitbringt
   * (`t(entity, feld)` liest die lokalisierte Spalte). Für alles andere gibt es
   * eine Funktion in `utils/enum-labels.ts`. Kommt ein Aufruf dazu, ist das
   * eine Entscheidung und keine Nebensache — deshalb steht er hier oder das
   * Tor fällt.
   */
  const ALLOWED: Record<string, number> = {
    'components/buildings/BuildingCard.ts': 1,
    'components/social/SocialTrendsView.ts': 1,
    'components/forge/forge-card-data.ts': 3,
    'components/forge/VelgForgeCeremony.ts': 1,
  };

  it('jeder humanizeEnum-Aufruf in components/ ist begründet', async () => {
    const { globSync } = await import('node:fs');
    const files = globSync('components/**/*.ts', { cwd: SRC }) as string[];
    const found: Record<string, number> = {};
    for (const rel of files) {
      /* Kommentare zuerst entfernen. Der erste Lauf dieses Tests meldete
       * `GeneralSettingsPanel.ts` — und traf einen Fliesstext, der den Namen
       * bloss ERWÄHNT. Ein Tor, das eine Erwähnung für einen Aufruf hält,
       * meldet Verstösse, die keine sind, und wer ihm darin einmal misstraut,
       * misstraut ihm auch beim echten Treffer. */
      const code = readFileSync(resolve(SRC, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const n = (code.match(/humanizeEnum\(/g) ?? []).length;
      if (n > 0) found[rel.split(/[\\/]/).join('/')] = n;
    }
    expect(
      found,
      'Ein neuer humanizeEnum-Aufruf in components/: verschönert er einen Wert aus ' +
        't(entity, feld)? Dann hier eintragen. Ist es ein Aufzählungswert aus dem ' +
        'Code? Dann gehört er nach utils/enum-labels.ts — sonst bleibt er in jeder ' +
        'Sprache englisch.',
    ).toEqual(ALLOWED);
  });
});
