#!/usr/bin/env node
/**
 * lint-series-palette-grounds.mjs — die Serienfarben gegen JEDEN Grund.
 *
 * ── WOHER DIESES TOR KOMMT ──────────────────────────────────────────────────
 *
 * Zweimal unabhaengig derselbe Fehler:
 *
 *   03.09.2026  `theme-presets.ts` — vier Tinten waren gegen EINEN Grund
 *               getunt und standen auf dreien („eine Tinte gegen einen Grund
 *               steht auf dreien"). Behoben.
 *   05.09.2026  `EchartsChart.ts` — die Serienpalette SERIES_LIGHT war gegen
 *               `page` getunt (3,00–3,06 : 1) und fiel auf `sunken` durch:
 *
 *                              page   raised   sunken
 *                 Speranza     3,06     2,83     2,59  ✗
 *                 Gaslit       3,01     2,78     2,55  ✗
 *                 Velgarien    3,00     2,77     2,54  ✗
 *                 Nova         4,61     4,27     3,91  ✓
 *                 Station      3,06     2,83     2,59  ✗
 *
 * Vier von fuenf. Und genau dort, wo Tabellen und Kacheln stehen — auf der
 * gesenkten Auflage.
 *
 * ⚠ **Ein Skin hat mehrere Gruende.** Die Korrektur an der einen Stelle ist
 * nicht bei der anderen angekommen, weil kein Tor die Frage gestellt hat.
 *
 * ── WAS ES PRUEFT ───────────────────────────────────────────────────────────
 *
 * Jede Serienfarbe gegen ALLE DREI Gruende (`color_background`,
 * `color_surface`, `color_surface_sunken`) JEDES Themes der passenden
 * Polaritaet. Schwelle 3 : 1 nach WCAG SC 1.4.11 — eine Serienflaeche ist ein
 * bedeutungstragender Teil einer Grafik, kein Text.
 *
 * Nicht gerundet: SC 1.4.11 sagt woertlich „2.999:1 would not meet the 3:1
 * threshold".
 *
 * ── WAS ES NICHT PRUEFT ─────────────────────────────────────────────────────
 *
 * Ob die fuenf Toene UNTEREINANDER unterscheidbar sind. Das ist eine andere
 * Frage (Szafir: bei kleinen Marken braucht es 5–6 ΔE, nicht 1) und braucht
 * ein anderes Mass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SCHWELLE = 3.0;

// ── Kontrast ────────────────────────────────────────────────────────────────
const kanal = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminanz = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
};
const kontrast = (a, b) => {
  const [la, lb] = [luminanz(a), luminanz(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// ── Die Serienpaletten aus dem Diagramm-Wrapper ─────────────────────────────
const chartSrc = read('src/components/shared/EchartsChart.ts');
const palette = (name) => {
  const m = chartSrc.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) return [];
  return [...m[1].matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((x) => x[1]);
};
const SERIES_LIGHT = palette('SERIES_LIGHT');
const SERIES_DARK = palette('SERIES_DARK');

// ── Die Themes mit ihren drei Gruenden ──────────────────────────────────────
const themeSrc = read('src/services/theme-presets.ts');
const themen = [];
const bloecke = [...themeSrc.matchAll(
  /color_background:\s*'(#[0-9a-fA-F]{6})'[\s\S]{0,4000}?color_surface_sunken:\s*'(#[0-9a-fA-F]{6})'/g,
)];
for (const b of bloecke) {
  const abschnitt = themeSrc.slice(b.index, b.index + b[0].length);
  const surface = abschnitt.match(/color_surface:\s*'(#[0-9a-fA-F]{6})'/);
  const text = themeSrc.slice(b.index, b.index + 6000).match(/color_text:\s*'(#[0-9a-fA-F]{6})'/);
  const name = themeSrc.slice(Math.max(0, b.index - 700), b.index).match(/(\w[\w-]*):\s*\{[^{]*$/);
  themen.push({
    name: name ? name[1] : `theme@${b.index}`,
    gruende: [b[1], surface ? surface[1] : b[1], b[2]],
    hell: text ? luminanz(b[1]) > luminanz(text[1]) : null,
  });
}

// ── Erst die Bedingung herstellen, dann pruefen ─────────────────────────────
//
// Ohne diese drei Zeilen bestuende das Tor auch dann, wenn eine Umbenennung
// die Suche ins Leere laufen liesse — und meldete jahrelang gruen, ohne je
// etwas angesehen zu haben.
const fehler = [];
if (SERIES_LIGHT.length < 3) fehler.push(`SERIES_LIGHT: nur ${SERIES_LIGHT.length} Farben gefunden`);
if (SERIES_DARK.length < 3) fehler.push(`SERIES_DARK: nur ${SERIES_DARK.length} Farben gefunden`);
if (themen.length < 5) fehler.push(`nur ${themen.length} Themes gefunden`);
if (fehler.length) {
  console.error('FAIL: das Tor findet seinen Gegenstand nicht mehr.');
  for (const f of fehler) console.error(`  ${f}`);
  process.exit(1);
}

// ── Die Pruefung ────────────────────────────────────────────────────────────
const ROLLEN = ['page', 'raised', 'sunken'];
const funde = [];
let geprueft = 0;
for (const t of themen) {
  if (t.hell === null) continue;
  const serie = t.hell ? SERIES_LIGHT : SERIES_DARK;
  const wie = t.hell ? 'SERIES_LIGHT' : 'SERIES_DARK';
  t.gruende.forEach((grund, i) => {
    for (const farbe of serie) {
      geprueft++;
      const k = kontrast(farbe, grund);
      if (k < SCHWELLE) {
        funde.push(`${t.name} · ${ROLLEN[i]} ${grund} · ${wie} ${farbe} = ${k.toFixed(2)} : 1`);
      }
    }
  });
}

if (funde.length) {
  console.error(`FAIL: ${funde.length} Serienfarbe(n) unter ${SCHWELLE} : 1 (SC 1.4.11).`);
  console.error('      Ein Skin hat MEHRERE Gruende — gegen alle messen, nicht gegen einen.\n');
  for (const f of funde) console.error(`  ${f}`);
  process.exit(1);
}

console.log(
  `PASS: alle Serienfarben ueber ${SCHWELLE} : 1 ` +
    `(${geprueft} Paarungen, ${themen.length} Themes x 3 Gruende).`,
);
