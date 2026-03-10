/**
 * WCAG 2.1 AA contrast validation for all theme presets.
 *
 * Ensures every foreground/background pair used in the UI meets minimum
 * contrast ratios. Thresholds are based on how each pair is used:
 *
 *   4.5:1 — Normal text (primary & secondary text on surfaces)
 *   3.0:1 — Large/bold text & decorative (badges, buttons, muted text)
 *
 * The pair definitions encode the actual CSS usage. For example, badges use
 * `color: var(--color-info); background: var(--color-info-bg)` — and since
 * `--color-info` comes from the preset key `color_secondary`, the test
 * checks `color_secondary` against `color_info_bg`.
 *
 * Run: npx vitest run tests/theme-contrast.test.ts
 */

import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '../src/services/theme-presets.js';

// ---------------------------------------------------------------------------
// WCAG 2.1 relative luminance & contrast ratio
// ---------------------------------------------------------------------------

function hexToLinear(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const linearize = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [
    linearize(Number.parseInt(h.slice(0, 2), 16)),
    linearize(Number.parseInt(h.slice(2, 4), 16)),
    linearize(Number.parseInt(h.slice(4, 6), 16)),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Contrast pair definitions
// ---------------------------------------------------------------------------

interface ContrastPair {
  /** Preset key used as foreground color */
  fg: string;
  /** Preset key used as background color */
  bg: string;
  /** Human-readable description of the UI pattern */
  label: string;
  /** Minimum WCAG contrast ratio required */
  minRatio: number;
}

/**
 * Every foreground/background pair the UI actually renders.
 *
 * Key mapping reminder (ThemeService THEME_TOKEN_MAP):
 *   color_secondary  → --color-info      (badges, gen-buttons)
 *   color_accent     → --color-warning   (badges, highlights)
 *   color_background → --color-surface   (page bg, gen-btn hover text)
 *   color_surface    → --color-surface-raised  (card/panel bg)
 */
const CONTRAST_PAIRS: ContrastPair[] = [
  // ── Text readability on card surfaces (WCAG AA normal text = 4.5:1) ──
  { fg: 'color_text', bg: 'color_surface', label: 'primary text on card', minRatio: 4.5 },
  {
    fg: 'color_text_secondary',
    bg: 'color_surface',
    label: 'secondary text on card',
    minRatio: 4.5,
  },

  // ── Text readability on page background ──
  { fg: 'color_text', bg: 'color_background', label: 'primary text on page', minRatio: 4.5 },
  {
    fg: 'color_text_secondary',
    bg: 'color_background',
    label: 'secondary text on page',
    minRatio: 4.5,
  },

  // ── Muted text — intentionally subtle, 3:1 minimum ──
  { fg: 'color_text_muted', bg: 'color_surface', label: 'muted text on card', minRatio: 3.0 },
  { fg: 'color_text_muted', bg: 'color_background', label: 'muted text on page', minRatio: 3.0 },

  // ── Button text (bold uppercase = functional large text, 3:1) ──
  { fg: 'text_inverse', bg: 'color_primary', label: 'text on primary button', minRatio: 3.0 },
  { fg: 'text_inverse', bg: 'color_danger', label: 'text on danger button', minRatio: 3.0 },

  // ── Badge text on tinted backgrounds (bold, short labels, 3:1) ──
  { fg: 'color_primary', bg: 'color_primary_bg', label: 'primary badge', minRatio: 3.0 },
  { fg: 'color_secondary', bg: 'color_info_bg', label: 'info badge', minRatio: 3.0 },
  { fg: 'color_accent', bg: 'color_warning_bg', label: 'warning badge', minRatio: 3.0 },
  { fg: 'color_danger', bg: 'color_danger_bg', label: 'danger badge', minRatio: 3.0 },
  { fg: 'color_success', bg: 'color_success_bg', label: 'success badge', minRatio: 3.0 },

  // ── Generate button hover: surface text on info background ──
  { fg: 'color_background', bg: 'color_secondary', label: 'gen-button hover', minRatio: 3.0 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Intentionally absurd presets that are exempt from WCAG compliance
const WCAG_EXEMPT_PRESETS = new Set(['deep-fried-horror']);

describe('Theme preset contrast (WCAG)', () => {
  for (const [name, preset] of Object.entries(THEME_PRESETS)) {
    if (WCAG_EXEMPT_PRESETS.has(name)) continue;
    describe(name, () => {
      for (const pair of CONTRAST_PAIRS) {
        const fgHex = preset[pair.fg];
        const bgHex = preset[pair.bg];

        // Skip non-hex values (font stacks, numbers, etc.)
        if (!fgHex?.startsWith('#') || !bgHex?.startsWith('#')) continue;

        it(`${pair.label} (${pair.fg} on ${pair.bg}) >= ${pair.minRatio}:1`, () => {
          const ratio = contrastRatio(fgHex, bgHex);
          expect(
            ratio,
            `${fgHex} on ${bgHex} = ${ratio.toFixed(2)}:1, need >= ${pair.minRatio}:1`,
          ).toBeGreaterThanOrEqual(pair.minRatio);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Platform dark token contrast (always-dark platform chrome)
// ---------------------------------------------------------------------------

describe('Platform dark token contrast (WCAG)', () => {
  const platform: Record<string, string> = {
    color_text: '#e5e5e5',
    color_text_secondary: '#a0a0a0',
    color_text_muted: '#888888',
    text_inverse: '#0a0a0a',
    color_surface: '#0a0a0a',
    color_surface_raised: '#111111',
    color_primary: '#f59e0b',
    color_danger: '#ef4444',
    color_success: '#22c55e',
    color_info: '#3b82f6',
    color_info_bg: '#0f1a2a',
    color_danger_bg: '#2a1010',
    color_success_bg: '#0f2a10',
    color_warning_bg: '#2a1f0f',
    color_primary_bg: '#141004',
    color_accent_amber: '#f59e0b',
  };

  const platformPairs: ContrastPair[] = [
    { fg: 'color_text', bg: 'color_surface', label: 'primary text on surface', minRatio: 4.5 },
    { fg: 'color_text', bg: 'color_surface_raised', label: 'primary text on raised', minRatio: 4.5 },
    { fg: 'color_text_secondary', bg: 'color_surface', label: 'secondary text on surface', minRatio: 4.5 },
    { fg: 'color_text_secondary', bg: 'color_surface_raised', label: 'secondary on raised', minRatio: 4.5 },
    { fg: 'color_text_muted', bg: 'color_surface', label: 'muted text on surface', minRatio: 3.0 },
    { fg: 'color_text_muted', bg: 'color_surface_raised', label: 'muted text on raised', minRatio: 3.0 },
    { fg: 'color_accent_amber', bg: 'color_surface', label: 'amber accent on surface', minRatio: 3.0 },
    { fg: 'text_inverse', bg: 'color_primary', label: 'text on amber button', minRatio: 4.5 },
    { fg: 'color_info', bg: 'color_info_bg', label: 'info badge (platform)', minRatio: 3.0 },
    { fg: 'color_danger', bg: 'color_danger_bg', label: 'danger badge (platform)', minRatio: 3.0 },
    { fg: 'color_success', bg: 'color_success_bg', label: 'success badge (platform)', minRatio: 3.0 },
    { fg: 'color_primary', bg: 'color_warning_bg', label: 'warning badge (platform)', minRatio: 3.0 },
  ];

  for (const pair of platformPairs) {
    const fgHex = platform[pair.fg];
    const bgHex = platform[pair.bg];
    if (!fgHex || !bgHex) continue;

    it(`${pair.label} (${fgHex} on ${bgHex}) >= ${pair.minRatio}:1`, () => {
      const ratio = contrastRatio(fgHex, bgHex);
      expect(
        ratio,
        `${fgHex} on ${bgHex} = ${ratio.toFixed(2)}:1, need >= ${pair.minRatio}:1`,
      ).toBeGreaterThanOrEqual(pair.minRatio);
    });
  }
});

// ---------------------------------------------------------------------------
// Utility tests — verify the math is correct
// ---------------------------------------------------------------------------

describe('WCAG contrast utilities', () => {
  it('black on white = 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('white on white = 1:1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
  });

  it('is commutative (order-independent)', () => {
    const ab = contrastRatio('#3b82f6', '#eff6ff');
    const ba = contrastRatio('#eff6ff', '#3b82f6');
    expect(ab).toBeCloseTo(ba, 4);
  });

  it('known value: #767676 on #ffffff ≈ 4.54:1 (WCAG reference)', () => {
    // #767676 on white is the classic WCAG boundary for AA at 4.5:1
    const ratio = contrastRatio('#767676', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.7);
  });
});
