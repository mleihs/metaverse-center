/**
 * Controls for `utils/contrast-lift.ts` — values known BY HAND, not by the
 * code under test.
 *
 * On 2026-08-31 the same colour-parsing mistake was written three times in two
 * sessions, and not one of them raised an error:
 *
 *   a luminance dividing a 0-255 channel by 12.92   amber on black at 1.69, not 9.22
 *   a probe reading color(srgb 0.41 …) as 0-255     17.62:1 instead of 4.55
 *   a probe reading the same string with /\d+/g     33 552 763 : 1
 *
 * All three returned a number, and a number looks like a result. Each of the
 * three would have been red here on its first run.
 *
 * NEVER adjust an expected value to make a test pass. If the code and the
 * fixture disagree, exactly one is wrong and it is not automatically the
 * fixture.
 */
import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  formatRgb,
  liftForContrast,
  luminance,
  parseColor,
} from '../src/utils/contrast-lift.js';

const BLACK = { r: 10, g: 10, b: 10 };   // --color-surface
const WHITE = { r: 255, g: 255, b: 255 };
const AMBER = { r: 245, g: 158, b: 11 }; // --color-accent-amber

describe('parseColor — the three forms a browser returns', () => {
  it('reads color(srgb …) as 0..1, not 0..255', () => {
    // The exact string that produced 17.62:1 and 33 552 763:1 on two probes.
    expect(parseColor('color(srgb 0.409412 0.409412 0.487843)')).toEqual({
      r: expect.closeTo(104.4, 1),
      g: expect.closeTo(104.4, 1),
      b: expect.closeTo(124.4, 1),
    });
  });

  it('reads rgb() as 0..255', () => {
    expect(parseColor('rgb(245, 158, 11)')).toEqual(AMBER);
  });

  it('reads hex, short and long', () => {
    expect(parseColor('#555555')).toEqual({ r: 85, g: 85, b: 85 });
    expect(parseColor('#fff')).toEqual(WHITE);
  });

  it('REFUSES what it does not know instead of guessing', () => {
    // A parser that falls back to black reports a ratio, and a ratio is
    // indistinguishable from a measurement.
    expect(parseColor('hsl(30 90% 50%)')).toBeNull();
    expect(parseColor('currentColor')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('luminance — the 12.92 applies to the NORMALISED value', () => {
  it('puts black at zero and white at one', () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6);
    expect(luminance(WHITE)).toBeCloseTo(1, 6);
  });

  it('gives amber on near-black the value two sessions knew independently', () => {
    // 9.22:1 — the number that exposed a luminance bug elsewhere precisely
    // because somebody already knew it.
    expect(contrastRatio(AMBER, BLACK)).toBeCloseTo(9.22, 1);
  });

  it('gives #555555 on the sunken surface the hand-computed 2.72', () => {
    expect(contrastRatio({ r: 85, g: 85, b: 85 }, { r: 6, g: 6, b: 6 })).toBeCloseTo(2.72, 1);
  });
});

describe('liftForContrast', () => {
  it('leaves a colour that already passes completely untouched', () => {
    const out = liftForContrast(WHITE, [BLACK], BLACK, 4.5);
    expect(out.moved).toBe(0);
    expect(out.colour).toEqual(WHITE);
  });

  it('satisfies the WORST ground, not the first one', () => {
    // A role that passes on black and fails on white must end up passing on
    // BOTH. Lifting against a single ground is the mistake this guards.
    const grey = { r: 138, g: 138, b: 158 };
    const out = liftForContrast(grey, [WHITE, BLACK], { r: 10, g: 10, b: 10 }, 4.5);
    expect(contrastRatio(out.colour, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('reports how far it moved, so a silent correction is visible', () => {
    const grey = { r: 138, g: 138, b: 158 };
    const out = liftForContrast(grey, [WHITE], { r: 10, g: 10, b: 10 }, 4.5);
    expect(out.moved).toBeGreaterThan(0);
    expect(out.moved).toBeLessThanOrEqual(1);
  });

  it('says so when even a full mix cannot reach the bar', () => {
    // Lifting white toward white can never clear 4.5 against white.
    const out = liftForContrast(WHITE, [WHITE], WHITE, 4.5);
    expect(out.reached).toBe(false);
  });

  it('takes the smallest step that clears the bar, not the largest', () => {
    const grey = { r: 138, g: 138, b: 158 };
    const out = liftForContrast(grey, [WHITE], { r: 10, g: 10, b: 10 }, 4.5);
    const oneStepLess = {
      r: grey.r * (1 - (out.moved - 0.01)) + 10 * (out.moved - 0.01),
      g: grey.g * (1 - (out.moved - 0.01)) + 10 * (out.moved - 0.01),
      b: grey.b * (1 - (out.moved - 0.01)) + 10 * (out.moved - 0.01),
    };
    expect(contrastRatio(oneStepLess, WHITE)).toBeLessThan(4.5);
  });

  it('formats back into a form a stylesheet can take', () => {
    expect(formatRgb({ r: 104.4, g: 104.4, b: 124.6 })).toBe('rgb(104, 104, 125)');
  });
});
