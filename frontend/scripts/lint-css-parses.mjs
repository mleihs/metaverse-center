#!/usr/bin/env node
/**
 * lint-css-parses.mjs — jede .css-Datei muss sich parsen lassen.
 *
 * WARUM ES DIESES TOR GIBT
 * Am 31.08.2026 ging ein Produktions-Deploy kaputt, weil in
 * `styles/tokens/_colors.css` ein Kommentar-Ende an der falschen Stelle stand:
 * ein erklärender Absatz landete hinter dem schliessenden `* /` und damit als
 * nacktes CSS. postcss meldete `Unknown word NACHTRAG`.
 *
 * Gefunden hat es NICHTS von 24 Toren, und das ist kein Versäumnis der Tore,
 * sondern ihrer Zuständigkeit:
 *
 *   tsc                  sieht .css-Dateien nicht an
 *   biome                formatiert und lintet TS, nicht CSS
 *   lint-color-tokens    grept nach rohen Hex, parst nicht
 *   lint-backtick-in-css prüft css`…`-Vorlagen IN TypeScript, keine .css-Dateien
 *
 * Die einzige Stelle, die es bemerkt hätte, war `vite build` — der läuft lokal
 * nicht und braucht eine Minute. Dieses Tor stellt dieselbe Frage in unter einer
 * Sekunde und bricht, wo der Build gebrochen hätte.
 *
 * ⚠ Es prüft NUR, ob sich die Datei parsen lässt. Ob die Regeln sinnvoll sind,
 * ob die Token existieren, ob man die Farben lesen kann — das prüfen andere
 * Tore. Ein Tor, das alles verspricht, prüft am Ende nichts.
 *
 * Exit: 0 = alle parsen, 1 = mindestens eine nicht.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import postcss from 'postcss';

const ROOT = new URL('../src', import.meta.url).pathname;

async function* cssFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* cssFiles(full);
    else if (entry.name.endsWith('.css')) yield full;
  }
}

let checked = 0;
const broken = [];
for await (const file of cssFiles(ROOT)) {
  checked++;
  const css = await readFile(file, 'utf8');
  try {
    postcss.parse(css, { from: file });
  } catch (err) {
    broken.push({
      file: relative(ROOT, file),
      line: err.line ?? '?',
      column: err.column ?? '?',
      reason: err.reason ?? String(err),
    });
  }
}

if (broken.length) {
  console.error('ERROR: CSS parst nicht — der Produktions-Build würde hier brechen:\n');
  for (const b of broken) {
    console.error(`  src/${b.file}:${b.line}:${b.column}  ${b.reason}`);
  }
  console.error(
    '\nHäufigste Ursache: ein Kommentar, dessen Ende an der falschen Stelle steht —\n' +
      'der Text dahinter wird als CSS gelesen. postcss meldet ihn als "Unknown word".\n',
  );
  process.exit(1);
}

console.log(`PASS: alle ${checked} CSS-Dateien parsen.`);
