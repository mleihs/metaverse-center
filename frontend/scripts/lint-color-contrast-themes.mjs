#!/usr/bin/env node
/**
 * lint-color-contrast-themes.mjs — the 13 base pairs, once per simulation theme.
 *
 * WHY, next to lint-color-contrast.sh
 *   That gate checks the same 13 pairs against ONE palette: the platform
 *   default in `_colors.css`. Ten simulation themes overwrite those tokens at
 *   runtime, and six of them are light. So it can report PASS on all 13 while
 *   `--color-success` sits at 1.28:1 in deep-fried-horror (#00FF00 on #FFFF00)
 *   — a palette question the gate was built for and cannot see.
 *
 *   This is not a second opinion on the same question. It is the same question
 *   asked ten more times.
 *
 * ONE FINDING IS NOT A THEME'S FAULT
 *   `color-text-inverse on color-surface-inverse` comes out at 1.00:1 in six
 *   themes, and no theme wrote that pair. `--color-surface-inverse` is NOT in
 *   THEME_TOKEN_MAP — it is a platform constant, #ffffff — while `text_inverse`
 *   IS themeable, and a LIGHT theme correctly sets its inverse ink to white.
 *   White ink on the constant white surface. The same structural gap as the
 *   amber CTA: a constant surface with a themeable ink on it.
 *
 * REPORTING ONLY, for now
 *   Exit code is always 0. Four sessions share this working tree; a gate that
 *   turns red for work nobody has agreed to do teaches everyone to skip it.
 *   The number comes first, the decision second, the exit code last.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── The same 13 pairs the sibling gate checks ────────────────────────────────
const PAIRS = [
  ['color-text-primary', 'color-surface', 'Body text on page background', 4.5],
  ['color-text-primary', 'color-surface-raised', 'Body text on cards', 4.5],
  ['color-text-secondary', 'color-surface', 'Secondary text on page background', 4.5],
  ['color-text-secondary', 'color-surface-raised', 'Secondary text on cards', 4.5],
  ['color-text-muted', 'color-surface', 'Muted text on page background', 4.5],
  ['color-text-muted', 'color-surface-raised', 'Muted text on cards', 4.5],
  ['color-text-muted', 'color-surface-sunken', 'Muted text on sunken surfaces', 4.5],
  ['color-text-inverse', 'color-surface-inverse', 'Inverse text on light background', 4.5],
  ['color-primary', 'color-surface', 'Primary accent on dark bg', 3.0],
  ['color-danger', 'color-surface', 'Danger accent on dark bg', 3.0],
  ['color-success', 'color-surface', 'Success accent on dark bg', 3.0],
  ['color-info', 'color-surface', 'Info accent on dark bg', 3.0],
  ['color-info', 'color-surface-raised', 'Link text on cards', 4.5],
];

// ── Tokens, themes, and the map between them ─────────────────────────────────
function baseTokens() {
  const css = read('src/styles/tokens/_colors.css');
  const out = {};
  for (const m of css.matchAll(/--([a-z0-9_-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}

/** Read the setting-key → token map from ThemeService rather than rebuilding it.
 *  Guessing it is wrong twice over: color_background is --color-surface, and
 *  color_surface is --color-surface-RAISED. */
function tokenMap() {
  const src = read('src/services/ThemeService.ts');
  const block = src.match(/THEME_TOKEN_MAP[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!block) return {};
  const out = {};
  for (const m of block[1].matchAll(/([a-z0-9_]+):\s*'(--[a-z0-9-]+)'/g)) out[m[1]] = m[2].slice(2);
  return out;
}

function themes(map) {
  const src = read('src/services/theme-presets.ts');
  const out = {};
  // Six of ten preset keys are quoted because they contain a hyphen.
  for (const m of src.matchAll(/^ {2}'?([a-z0-9-]+)'?:\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const entries = {};
    for (const e of m[2].matchAll(/([a-z0-9_]+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
      const tok = map[e[1]];
      if (tok) entries[tok] = e[2];
    }
    if (Object.keys(entries).length) out[m[1]] = entries;
  }
  return out;
}

// ── Contrast ─────────────────────────────────────────────────────────────────
const toRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (c) =>
  0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
function ch(x) {
  x /= 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
const ratio = (a, b) => {
  const [x, y] = [lum(toRgb(a)), lum(toRgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// ── Report ───────────────────────────────────────────────────────────────────
const base = baseTokens();
const map = tokenMap();
const presets = themes(map);
const names = Object.keys(presets).sort();

if (names.length === 0) {
  console.error('WARN: no theme presets parsed — nothing measured.');
  process.exit(0);
}

let totalFail = 0;
const perTheme = [];
const perPair = new Map();

for (const name of names) {
  const tok = { ...base, ...presets[name] };
  const fails = [];
  for (const [fg, bg, ctx, need] of PAIRS) {
    if (!tok[fg] || !tok[bg]) continue;
    const r = ratio(tok[fg], tok[bg]);
    if (r < need) {
      fails.push({ fg, bg, ctx, need, r });
      perPair.set(`${fg} on ${bg}`, (perPair.get(`${fg} on ${bg}`) ?? 0) + 1);
    }
  }
  totalFail += fails.length;
  perTheme.push([name, fails]);
}

console.log('── WCAG AA of the 13 base pairs, per simulation theme ──');
console.log();
for (const [name, fails] of perTheme.sort((a, b) => b[1].length - a[1].length)) {
  if (fails.length === 0) {
    console.log(`  ${name.padEnd(24)} all 13 pass`);
    continue;
  }
  console.log(`  ${name.padEnd(24)} ${fails.length} of 13 below AA`);
  for (const f of fails.sort((a, b) => a.r - b.r)) {
    console.log(`      ${f.r.toFixed(2).padStart(5)}:1 (need ${f.need})  ${f.fg} on ${f.bg}`);
  }
}
console.log();
console.log('── the same failures, by pair ──');
for (const [pair, n] of [...perPair].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)} theme(s)  ${pair}`);
}
console.log();
console.log(`${totalFail} pair-in-theme failure(s) across ${names.length} themes, `
  + `${perPair.size} distinct token pair(s).`);
console.log('REPORT ONLY — this check does not fail the build. Sharpen it once the');
console.log('pairs above are decided; the exit code is the last step, not the first.');
process.exit(0);
