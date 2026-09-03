/**
 * Drift-guard for PLATFORM_DARK_CONFIG (the DRIFT "Zwischenraum" theme).
 *
 * PLATFORM_DARK_CONFIG is a deliberate STATIC mirror of the platform-dark `:root` tokens
 * (the DRIFT view re-asserts them on its own host to escape the anchor sim's theme). Static
 * is the right call — reading `:root` at runtime via getComputedStyle would read the SHELL's
 * overridden values, not the platform defaults, and the wrong shape (applyConfig wants flat
 * setting keys, not CSS token names). The cost is a drift risk: edit a `:root` color and
 * forget the config. This test removes that risk by asserting every color value in the config
 * still equals the `:root` token it mirrors.
 *
 * Colors only: the platform color tokens are literal hex in `:root`, so an exact match is
 * clean. The font tokens are intentionally excluded — `:root` defines them with `var()`
 * indirection (e.g. `--font-body: var(--font-sans)`) while the config carries the resolved
 * literal stack, so they can't be compared by reading one file.
 *
 * The config→token map below is this test's explicit spec; it mirrors the color subset of
 * THEME_TOKEN_MAP (not imported — ThemeService pulls in the Supabase client chain).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLATFORM_DARK_CONFIG } from '../src/services/theme-presets.js';

/*
 * Resolve through node:path, not `new URL(rel, import.meta.url)`.
 *
 * The global URL under the happy-dom environment is happy-dom's, and it
 * resolves a relative reference against the DOCUMENT's base rather than the
 * base it was handed: measured, `new URL('../src/x.css', 'file:///…/tests/y.ts')`
 * comes back as `http://localhost:3000/src/x.css`, and readFileSync then
 * refuses it with "The URL must be of scheme file". The old spelling happened
 * to survive at collection time and fails inside a test body — a seam that
 * moves with the environment, so it is worth not standing on.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const COLORS_CSS_PATH = join(HERE, '../src/styles/tokens/_colors.css');

/** config setting key → the `:root` CSS color token it must equal (color subset of
 *  THEME_TOKEN_MAP — keep in sync if a new themeable color token is added). */
const COLOR_KEY_TO_TOKEN: Record<string, string> = {
  color_primary: '--color-primary',
  color_secondary: '--color-info',
  color_accent: '--color-warning',
  color_background: '--color-surface',
  color_surface: '--color-surface-raised',
  color_surface_sunken: '--color-surface-sunken',
  color_surface_header: '--color-surface-header',
  color_text: '--color-text-primary',
  color_text_secondary: '--color-text-secondary',
  color_text_muted: '--color-text-muted',
  color_border: '--color-border',
  color_border_light: '--color-border-light',
  color_danger: '--color-danger',
  color_success: '--color-success',
  text_inverse: '--color-text-inverse',
};

/**
 * Keys whose `:root` token is an ALIAS of another token rather than a literal.
 *
 * `--color-surface-contrast: var(--color-surface-raised)` cannot be compared by
 * reading a hex out of the stylesheet, but it still has to stay in sync — and
 * the alias itself is the part that can silently move. So each entry names both
 * halves: the alias token whose declaration is checked, and the literal token
 * its value must resolve to.
 */
const ALIAS_KEY_TO_TOKEN: Record<string, { alias: string; resolvesTo: string }> = {
  color_surface_contrast: { alias: '--color-surface-contrast', resolvesTo: '--color-surface-raised' },
  text_on_contrast: { alias: '--color-text-on-contrast', resolvesTo: '--color-text-primary' },
};

/** Parse the literal `--token: #hex;` declarations from a token CSS file (skips
 *  color-mix()/var() values, which aren't literal hex). */
function readLiteralHexTokens(path: string): Record<string, string> {
  const css = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null = re.exec(css);
  while (m !== null) {
    out[m[1]] = m[2].toLowerCase();
    m = re.exec(css);
  }
  return out;
}

describe('PLATFORM_DARK_CONFIG stays in sync with :root color tokens', () => {
  const rootTokens = readLiteralHexTokens(COLORS_CSS_PATH);
  const colorsCss = readFileSync(COLORS_CSS_PATH, 'utf8');

  it('every raw-hex config value is a mapped color key (no silent gap)', () => {
    const hexKeys = Object.entries(PLATFORM_DARK_CONFIG)
      .filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v))
      .map(([k]) => k);
    // shadow_color is a #hex but not a themeable color token (it feeds computeShadows) — allow it.
    const unmapped = hexKeys.filter(
      (k) => !(k in COLOR_KEY_TO_TOKEN) && !(k in ALIAS_KEY_TO_TOKEN) && k !== 'shadow_color',
    );
    expect(unmapped, `unmapped hex config keys: ${unmapped.join(', ')}`).toEqual([]);
  });

  for (const [key, { alias, resolvesTo }] of Object.entries(ALIAS_KEY_TO_TOKEN)) {
    it(`${key} (→ ${alias}) matches the token it aliases`, () => {
      // The alias must still BE an alias of the token this test compares against.
      // Repointing it at a third token, or spelling it out as a hex, would make
      // the equality below pass for the wrong reason.
      expect(colorsCss, `${alias} must be declared as var(${resolvesTo}) in _colors.css`).toContain(
        `${alias}: var(${resolvesTo});`,
      );
      expect(PLATFORM_DARK_CONFIG[key], `${key} missing from PLATFORM_DARK_CONFIG`).toBeTruthy();
      expect(rootTokens[resolvesTo], `${resolvesTo} must be a literal hex in :root`).toBeTruthy();
      expect(PLATFORM_DARK_CONFIG[key].toLowerCase()).toBe(rootTokens[resolvesTo]);
    });
  }

  for (const [key, token] of Object.entries(COLOR_KEY_TO_TOKEN)) {
    it(`${key} (→ ${token}) matches its :root value`, () => {
      expect(PLATFORM_DARK_CONFIG[key], `${key} missing from PLATFORM_DARK_CONFIG`).toBeTruthy();
      expect(
        rootTokens[token],
        `${token} must be a literal hex in :root (_colors.css); if it became color-mix/var, PLATFORM_DARK_CONFIG needs rethinking`,
      ).toBeTruthy();
      expect(PLATFORM_DARK_CONFIG[key].toLowerCase()).toBe(rootTokens[token]);
    });
  }
});
