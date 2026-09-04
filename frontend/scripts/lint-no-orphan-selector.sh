#!/usr/bin/env bash
#
# EIN KOMMA INS NICHTS IST GUELTIGES CSS.
#
# Wird aus einer Selektorliste die letzte Zeile samt Koerper geloescht, bleibt
# die vorletzte mit ihrem Komma stehen:
#
#     .cta:hover,
#
#     .hero { position: relative; overflow: hidden; }
#
# Das ist syntaktisch tadellos. Der Browser liest eine Liste aus zwei
# Selektoren, und .cta:hover traegt ab sofort das Aussehen von .hero. Kein
# Parserfehler, keine Warnung, kein rotes Tor — nur eine Regel, die etwas
# anderes sagt als dasteht, und eine, die verschwunden ist.
#
# WARUM ES DIESES TOR GIBT
#   Der Atlas-Sweep 23283b1e hat aus LandingHero.ts 22 Regelkoepfe entfernt.
#   Dreizehn zu Recht — die Navigation wanderte nach LandingNav. Neun aus
#   Versehen, darunter .cta und .watch, die zwei Knoepfe des Helden. Sie
#   standen danach im Grau des Browsers (rgb(107,107,107), 2px outset), also
#   voellig ohne Regel, und fuenf Waisen hingen gemeinsam an .hero.
#
#   Vom Benutzer gemeldet, am 04.09.2026 — einen Tag lang auf Prod. Nichts hat
#   es gesehen: tsc liest kein CSS, biome pruefte TypeScript, lint-css-parses
#   liest nur .css-Dateien und nicht die css-Vorlagen in den Bauteilen, und
#   das Farbtor sucht nach rohen Hexwerten. Ein Knopf ohne Regel hat keine.
#
# WAS ES PRUEFT
#   Eine Selektorliste, in der zwischen zwei Eintraegen eine LEERZEILE steht.
#   Das ist die Signatur des Sweeps: er ersetzt Regelkoerper durch Leerzeilen.
#   Eine gewoehnliche mehrzeilige Liste steht Zeile an Zeile und faellt nicht
#   auf; ein Kommentar zwischen zwei Selektoren ebenfalls nicht, denn
#   Kommentare werden durch NICHT-LEERE Fuellzeilen ersetzt. Blosse Umbrueche
#   waeren falsch: ein mehrzeiliger Kommentar mitten in einer Liste wuerde
#   selbst zur Leerzeile und damit zum Fehlalarm — vom dritten Selbsttest
#   beim Bauen gefangen.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/*
 * Kommentare weg, aber die Zeilenzahl bleibt — sonst zeigt jede Meldung auf
 * die falsche Zeile. Ersetzt wird mit einem Fuellzeichen JE ZEILE, nicht mit
 * blossen Umbruechen: ein mehrzeiliger Kommentar MITTEN in einer
 * Selektorliste wuerde sonst selbst zur Leerzeile und damit zum Fehlalarm.
 * Genau das hat der dritte Selbsttest unten beim Bauen gefangen.
 */
const FUELL = '\u0001';
const entkommentieren = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => {
    const n = (m.match(/\n/g) || []).length;
    return FUELL + `\n${FUELL}`.repeat(n);
  });

/* Ein Komma, dann eine Zeile, die nur aus Weissraum besteht. */
const KLEBER = /,[^\S\n]*\n[^\S\n]*\n/;

function waisen(css) {
  const out = [];
  for (const m of entkommentieren(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (KLEBER.test(m[1])) out.push(m);
  }
  return out;
}

/* SELBSTTEST. Ein Tor, das gruen ist, weil es nichts gefunden hat, ist kein
   gruenes Tor — dieses hier haette ohne Selbsttest jede Datei durchgewunken,
   waere die Regex einen Anker daneben. */
{
  if (!waisen('.a:hover,\n\n    .b { color: red; }').length) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: das bekannte Wrack wird nicht erkannt.');
    process.exit(2);
  }
  if (waisen('.a:hover,\n    .b { color: red; }').length) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: eine gewoehnliche Liste wird gemeldet.');
    process.exit(2);
  }
  if (waisen('.a, /* Anmerkung\n   ueber zwei Zeilen */\n.b { color: red; }').length) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: ein Kommentar in der Liste wird gemeldet.');
    process.exit(2);
  }
}

const funde = [];
let dateien = 0;
let vorlagen = 0;

for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  dateien++;
  /* (?<![\w$]) — sonst trifft der Anker auch `xcss\`` oder eine Prosa-Stelle.
     Genau daran ist lint-backtick-in-css schon einmal gescheitert. */
  for (const m of src.matchAll(/(?<![\w$])css`/g)) {
    const i = m.index + m[0].length;
    const j = src.indexOf('`', i);
    if (j < 0) continue;
    vorlagen++;
    for (const w of waisen(src.slice(i, j))) {
      const zeile = src.slice(0, i + w.index).split('\n').length;
      const teile = w[1]
        .split(',')
        .map((s) => s.replaceAll(FUELL, '').trim())
        .filter(Boolean);
      funde.push({ file, zeile, teile });
    }
  }
}

if (funde.length) {
  console.error('FEHLER: Selektor mit Komma ohne eigenen Koerper — er erbt die naechste Regel.\n');
  for (const f of funde) {
    console.error(`  ${f.file}:${f.zeile}`);
    console.error('    Diese Selektoren teilen sich EINEN Regelkoerper, getrennt durch Leerzeilen:');
    for (const t of f.teile) console.error(`      ${t.slice(0, 70)}`);
    console.error('    Vermutlich wurde eine Regel geloescht und ihr Komma blieb stehen.\n');
  }
  process.exit(1);
}

console.log(`PASS: kein verwaister Selektor (${dateien} Dateien, ${vorlagen} css-Vorlagen).`);
NODE
