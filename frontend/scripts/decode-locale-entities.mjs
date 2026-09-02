#!/usr/bin/env node
/**
 * Entity-Reste aus den erzeugten Übersetzungen holen.
 *
 * BEFUND (gemessen 02.09.2026): `src/locales/generated/de.ts` trug 67 kaputte
 * HTML-Entities — 27 × `&lt;`, 40 × `&gt;` — und die englische Quelle NULL.
 * Deutsche Nutzer lasen also `salvage &lt;raum_index&gt;` statt
 * `salvage <raum_index>` und „Stimmung &gt; 50" statt „Stimmung > 50". Der
 * Nutzer hat eine davon auf der Hilfeseite gesehen.
 *
 * URSACHE. Im XLIFF ist `&lt;` KORREKT — XML muss maskieren. `lit-localize
 * build` schreibt die maskierte Form aber unverändert in den TypeScript-String
 * weiter, statt sie zu dekodieren. Für `&amp;` war das seit langem bekannt und
 * stand als `sed`-Zeile in einem Gedächtnis-Eintrag; die anderen beiden
 * Entities kamen darin nicht vor, also blieben sie stehen. Ein Rezept, das nur
 * im Kopf einer Sitzung lebt, deckt genau so viel ab, wie am Tag seiner
 * Niederschrift auffiel.
 *
 * REIHENFOLGE ist nicht beliebig: `&amp;` MUSS zuletzt, sonst wird aus
 * `&amp;lt;` erst `&lt;` und dann fälschlich `<`.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATED = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales', 'generated');

// Reihenfolge beachten — `&amp;` zuletzt.
const REPLACEMENTS = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
];

let touched = 0;
let total = 0;

for (const name of readdirSync(GENERATED)) {
  if (!name.endsWith('.ts')) continue;
  const path = join(GENERATED, name);
  const before = readFileSync(path, 'utf8');
  let after = before;
  for (const [pattern, replacement] of REPLACEMENTS) {
    after = after.replace(pattern, replacement);
  }
  if (after !== before) {
    const count = before.length - after.length;
    writeFileSync(path, after);
    touched += 1;
    total += count;
    console.log(`decoded entities in locales/generated/${name}`);
  }
}

console.log(
  touched === 0
    ? 'locales/generated: no HTML entities to decode'
    : `locales/generated: ${touched} file(s) cleaned (${total} characters removed)`,
);
