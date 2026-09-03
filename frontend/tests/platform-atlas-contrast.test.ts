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

  /*
   * THE CROSS THAT WAS MISSING.
   *
   * The text roles above were already measured against all three grounds. The
   * STATUS roles were measured against none of them — only as fills, carrying
   * their own label. That left the most common use of a status colour on this
   * skin untested: as small type ON the page. Sheet numbers, terminal commands,
   * a caret, a link.
   *
   * Measured on production 2026-09-03, the gap was real and systematic. The
   * paper skin declares three grounds, and the step down to the sunken tone
   * costs 0.74 of ratio; the vermilion, tuned to 4.85 against the page, read
   * 4.49 on the raised ground under four sheet numbers, and success fell to
   * 3.81. Nothing was wrong with any component — the ink was tuned against one
   * ground and used on three.
   */
  const statusRoles = [
    ['primary', config.color_primary],
    ['accent', config.color_accent],
    ['danger', config.color_danger],
    ['success', config.color_success],
  ] as const;

  for (const [roleName, role] of statusRoles) {
    for (const [groundName, ground] of grounds) {
      it(`${roleName} carries small type on the ${groundName} surface`, () => {
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

  /*
   * THE THIRD HALF, AND WHY THE PAIR WAS NEVER A PAIR.
   *
   * Ground and ink were declared together and travelled together, and the test
   * above guarded exactly that. It was not enough, and the gap was invisible
   * for the same reason the pair looked complete: a counter-block reverses the
   * page, so it reverses what a STATUS colour is worth on it too — and nothing
   * in this file measured a status colour against anything but the page.
   *
   * Measured on production 2026-09-03: the paper skin's vermilion, tuned to
   * 4.85 : 1 against paper, reads 2.31 : 1 on the counter-block's #24332d. Seven
   * places in the Atlas session log stood at that ratio, all of them the accent,
   * none of them reachable by the ink check — the component had correctly
   * re-anchored its ink and had no third token to re-anchor its accent to.
   *
   * The floor is `fill`, not `text`: the accent marks commands and a caret bar,
   * which are small type and a solid rule, not running prose.
   */
  it('the counter-block can carry its own accent', () => {
    const accent = config.accent_on_contrast ?? config.color_primary;
    expect(ratio(accent, config.color_surface_contrast)).toBeGreaterThanOrEqual(floor.fill);
  });

  /*
   * And the default has to hold on its own. A skin that names a reversed ground
   * but no accent falls back to `var(--color-primary)` in ThemeService — which
   * is right only while the block is NOT reversed. Naming the ground is
   * therefore the moment the accent has to be named too.
   */
  it('a reversed ground names its accent', () => {
    /*
     * "Reversed" is a measurement, not a key comparison. The first version of
     * this test asked whether `color_surface_contrast` differed from
     * `color_surface_raised` — and the dark skin does not declare
     * `color_surface_raised` at all, so the comparison was against `undefined`
     * and every skin looked reversed. A test that fails for a reason it does
     * not name is worse than no test.
     *
     * _colors.css says what the block is for: it "reverses the page's polarity
     * to draw a hard edge". A hard edge is 3 : 1. On the dark chrome the block
     * is #111111 against a #0a0a0a page — 1.1 : 1, no edge, an ordinary raised
     * card, and the page's own accent is the right one there.
     */
    const reversed = ratio(config.color_surface_contrast, config.color_surface) >= 3;
    if (!reversed) return;
    expect(
      'accent_on_contrast' in config,
      'a counter-block that reverses the page must name the accent that survives there',
    ).toBe(true);
  });
});
