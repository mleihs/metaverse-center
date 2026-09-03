/**
 * The Atlas skin has to pass the platform's own contrast rule.
 *
 * WHY THIS TEST EXISTS AND NOT JUST A COMMENT
 *   The design handoff arrived with a table of contrast ratios in its header.
 *   Recomputed, three of them were wrong in the direction that matters: the
 *   primary was given as 4.6 : 1 and measures 3.61, the muted text as 4.9 : 1
 *   against a ground it never lands on alone. A number written next to a colour
 *   is a claim about it, not a measurement of it, and the difference is
 *   invisible on the page — a 3.6 : 1 label looks fine to whoever picked the
 *   colour.
 *
 *   So the numbers live here, recomputed from the config on every run. A future
 *   edit to a hex either keeps the guarantee or turns this red.
 *
 * WHAT IS CHECKED, AND AGAINST WHAT
 *   Every text role against all three platform surfaces — page, raised and
 *   sunken — because a role lands on all three and the worst one is the one
 *   that decides. This is the same set ThemeService.enforceTextContrast
 *   measures at runtime, and that is the point: a PLATFORM skin that needs the
 *   runtime lift is a palette nobody checked. The lift is there for worlds an
 *   architect invents, not for the two skins the platform ships.
 *
 *   Status colours (primary, danger, success) are NOT text roles — they land on
 *   tinted grounds as often as plain ones, and text in them goes through
 *   `--color-<status>-readable`. What IS checked for the primary is the one
 *   pairing that is spelled out everywhere: `--color-text-inverse` on a
 *   `--color-primary` fill, which is what `.btn--primary` paints.
 *
 * TWO FLOORS, NOT ONE
 *   The threshold is not a constant here — it comes from
 *   `PLATFORM_SKIN_CONTRAST`, because the two skins do not make the same
 *   promise. `dark` is the accessible skin and holds AA everywhere. `atlas` is
 *   an edition: AA on text (the runtime lift enforces that for every skin,
 *   whatever the skin promises) and the 3 : 1 non-text floor on its fills. The
 *   reasoning sits next to the declaration in theme-presets.ts; repeating it
 *   here would only give it a second place to go stale.
 */

import { describe, expect, it } from 'vitest';
import {
  PLATFORM_ATLAS_CONFIG,
  PLATFORM_DARK_CONFIG,
  PLATFORM_SKIN_CONTRAST,
  type PlatformSkin,
} from '../src/services/theme-presets.js';
import { contrastRatio, parseColor } from '../src/utils/contrast-lift.js';

/**
 * Hue in degrees, for the one thing a contrast ratio cannot see.
 *
 * Warning and danger can both clear their floor against the same ground and
 * still be the same colour to a reader — contrast is measured against the
 * BACKGROUND, never between two foregrounds. Nothing in a ratio would have
 * caught the handoff setting the accent equal to the primary.
 */
function hue(value: string): number {
  const c = parseColor(value);
  expect(c, `unparseable colour: ${value}`).not.toBeNull();
  // biome-ignore lint/style/noNonNullAssertion: the expect above is the guard.
  const { r, g, b } = c!;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/** Shortest distance between two hues on the wheel, in degrees (0…180). */
function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Two status colours have to be told apart at a glance, on a badge the size of
 * a word. 25° is the narrowest gap in the dark skin's own palette that still
 * reads as two colours; below it the pair is a shade difference, not a
 * distinction.
 */
const MIN_STATUS_HUE_GAP = 25;

function ratio(a: string, b: string): number {
  const fg = parseColor(a);
  const bg = parseColor(b);
  expect(fg, `unparseable colour: ${a}`).not.toBeNull();
  expect(bg, `unparseable colour: ${b}`).not.toBeNull();
  // biome-ignore lint/style/noNonNullAssertion: the two expects above are the guard.
  return contrastRatio(fg!, bg!);
}

const SKINS: Record<PlatformSkin, Record<string, string>> = {
  atlas: PLATFORM_ATLAS_CONFIG,
  dark: PLATFORM_DARK_CONFIG,
};

describe.each(Object.entries(SKINS))('%s skin holds its contrast floor', (name, config) => {
  const floor = PLATFORM_SKIN_CONTRAST[name as PlatformSkin];
  const grounds = [
    ['page', config.color_background],
    ['raised', config.color_surface],
    ['sunken', config.color_surface_sunken],
  ] as const;

  const textRoles = [
    ['text', config.color_text],
    ['text_secondary', config.color_text_secondary],
    ['text_muted', config.color_text_muted],
  ] as const;

  for (const [roleName, role] of textRoles) {
    for (const [groundName, ground] of grounds) {
      it(`${roleName} on the ${groundName} surface`, () => {
        expect(ratio(role, ground)).toBeGreaterThanOrEqual(floor.text);
      });
    }
  }

  it('the primary fill can carry its own label (.btn--primary)', () => {
    expect(ratio(config.text_inverse, config.color_primary)).toBeGreaterThanOrEqual(floor.fill);
  });

  it('the counter-block can carry its own ink', () => {
    expect(ratio(config.text_on_contrast, config.color_surface_contrast)).toBeGreaterThanOrEqual(
      floor.fill,
    );
  });

  /*
   * `color_accent` is what ThemeService writes into --color-warning, and a
   * warning badge carries a word.
   */
  it('the warning fill can carry its own label', () => {
    expect(ratio(config.text_inverse, config.color_accent)).toBeGreaterThanOrEqual(floor.fill);
  });

  /*
   * WARNING AGAINST DANGER, AND ONLY THAT PAIR.
   *
   * The handoff for the atlas skin set the accent equal to the primary, which
   * put warning and danger 9° apart — two reds that no ratio in this file would
   * have complained about, because contrast is always measured against the
   * ground and never between two foregrounds.
   *
   * The neighbouring pair, warning against PRIMARY, is deliberately NOT checked.
   * On the dark skin they are the same amber on purpose: `color_accent` doubles
   * as the theme's warning tone (see THEME_TOKEN_MAP in ThemeService), and a
   * theme with one accent has one accent. Asserting a gap there would encode a
   * rule the platform does not hold. It costs nothing here — atlas's primary is
   * a red, so an accent that collapsed back onto it would fail the danger check
   * on the next line anyway.
   */
  it('tells warning apart from danger by hue, not just by shade', () => {
    expect(hueGap(config.color_accent, config.color_danger)).toBeGreaterThanOrEqual(
      MIN_STATUS_HUE_GAP,
    );
  });

  /*
   * Ground and ink travel as a pair. ThemeService writes them together and
   * defaults them together; a config that names one without the other would put
   * a themed surface under un-themeable ink, which is the failure
   * `--color-on-surface-inverse` is documented for in _colors.css.
   */
  it('names both halves of the counter-block or neither', () => {
    expect(
      'color_surface_contrast' in config,
      'counter-block ground and ink must be declared together',
    ).toBe('text_on_contrast' in config);
  });
});
