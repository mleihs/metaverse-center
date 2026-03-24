#!/bin/bash
# lint-color-contrast.sh — Enforce WCAG AA contrast ratios between design token color pairs.
# Run: bash frontend/scripts/lint-color-contrast.sh
#
# Reads color tokens from _colors.css, computes contrast ratios, and reports
# any pairs below WCAG AA thresholds (4.5:1 normal text, 3:1 large text).
# Exit code: 0 = pass, 1 = violations found.

set -euo pipefail

# Support running from project root or frontend/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKENS_FILE="$SCRIPT_DIR/../src/styles/tokens/_colors.css"

if [ ! -f "$TOKENS_FILE" ]; then
  echo "ERROR: $TOKENS_FILE not found."
  exit 1
fi

# Use inline Node.js for precise WCAG luminance calculation (no npm deps needed).
node --eval "
const fs = require('fs');
const css = fs.readFileSync('$TOKENS_FILE', 'utf8');

// Extract hex color tokens from :root { ... }
const tokens = {};
for (const m of css.matchAll(/--([a-z0-9_-]+):\s*(#[0-9a-fA-F]{3,8})\b/g)) {
  tokens[m[1]] = m[2];
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Define critical text-on-surface pairs to check.
// Format: [fg token, bg token, context, threshold]
// WCAG AA: 4.5:1 normal text, 3:1 large text (18px+ bold or 24px+ regular).
const pairs = [
  // Normal text on surfaces
  ['color-text-primary', 'color-surface', 'Body text on page background', 4.5],
  ['color-text-primary', 'color-surface-raised', 'Body text on cards', 4.5],
  ['color-text-secondary', 'color-surface', 'Secondary text on page background', 4.5],
  ['color-text-secondary', 'color-surface-raised', 'Secondary text on cards', 4.5],
  ['color-text-muted', 'color-surface', 'Muted text on page background', 4.5],
  ['color-text-muted', 'color-surface-raised', 'Muted text on cards', 4.5],
  ['color-text-muted', 'color-surface-sunken', 'Muted text on sunken surfaces', 4.5],
  // Inverse text
  ['color-text-inverse', 'color-surface-inverse', 'Inverse text on light background', 4.5],
  // Semantic colors on surfaces (large text = brutalist headings)
  ['color-primary', 'color-surface', 'Primary accent on dark bg', 3.0],
  ['color-danger', 'color-surface', 'Danger accent on dark bg', 3.0],
  ['color-success', 'color-surface', 'Success accent on dark bg', 3.0],
  ['color-info', 'color-surface', 'Info accent on dark bg', 3.0],
  // Link color
  ['color-info', 'color-surface-raised', 'Link text on cards', 4.5],
];

let violations = 0;

for (const [fg, bg, context, threshold] of pairs) {
  const fgHex = tokens[fg];
  const bgHex = tokens[bg];
  if (!fgHex || !bgHex) {
    console.error('WARN: Missing token: ' + (!fgHex ? fg : bg));
    continue;
  }
  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio < threshold) {
    console.error(
      'FAIL: ' + fg + ' on ' + bg +
      ' = ' + ratio.toFixed(2) + ':1 (need ' + threshold + ':1) — ' + context
    );
    violations++;
  }
}

if (violations > 0) {
  console.error('');
  console.error(violations + ' WCAG AA contrast violation(s) found.');
  process.exit(1);
} else {
  console.log('PASS: All ' + pairs.length + ' color pairs meet WCAG AA contrast requirements.');
  process.exit(0);
}
"
