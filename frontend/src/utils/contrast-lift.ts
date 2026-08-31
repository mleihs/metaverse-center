/**
 * Lift a colour until it can be read on the grounds it actually lands on.
 *
 * WHY THIS EXISTS
 *   `ThemeService.applyConfig` writes a world's stored colours straight onto
 *   the host. Between the value a world saves and the text it paints, nothing
 *   checks anything — not a gate that fails to fire, but no gate at all. On a
 *   real light world, measured on prod: 32 text nodes under WCAG AA, with
 *   `--color-text-muted` at 2.98:1 and `--color-accent-amber` at 1.89:1.
 *
 *   The obvious repair — sweeping call sites onto a `-readable` token — was
 *   measured and does nothing in the case that matters: in that world
 *   `--color-primary` IS `--color-text-primary`, and 45 % X + 55 % X is X.
 *   The fix belongs in the one place the colours enter, not in 81 files.
 *
 * ⚠ A ROLE DOES NOT HAVE ONE GROUND
 *   Measured across the components: `--color-text-muted` is painted on
 *   `--color-surface` 652 times, on `--color-surface-sunken` 127 times and on
 *   `--color-surface-raised` 77 times — 43 distinct grounds in all. Lifting
 *   against a single ground leaves the other 42 where they were. So this takes
 *   a LIST and satisfies the worst of them.
 *
 * ⚠ IT CHANGES WHAT AN AUTHOR CHOSE
 *   Deliberately, and the rule behind it is: the colours belong to the worlds,
 *   the legibility belongs to the platform. The hue is preserved — only the
 *   lightness travels, toward `--color-text-primary`, in the smallest step
 *   that clears the bar. It is still a silent correction, which is why
 *   `liftForContrast` reports HOW FAR it moved: a lift nobody can see is a
 *   lift nobody can check, and a world where ten of ten roles need lifting has
 *   a different problem than one where a single role does.
 *
 * THE COLOUR PARSER IS THE POINT OF THIS FILE
 *   On 2026-08-31 the same parsing mistake was written three times in two
 *   sessions: a luminance dividing a 0-255 channel by 12.92; a probe reading
 *   `color(srgb 0.41 0.41 0.49)` as 0-255; a probe reading the same string
 *   with `/\d+/g` and getting `0, 41, 0, 41`, which produced a contrast ratio
 *   of 33 552 763 : 1. None of the three raised an error. All three returned a
 *   number.
 *
 *   So this parser is written once, here, and it is checked against known
 *   values in `contrast-lift.test-values.ts`. A fourth hand-rolled colour
 *   parser in this codebase is a bug that has not happened yet.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse the colour forms a browser actually returns, and REFUSE the rest.
 *
 * Returns `null` rather than a guess: a parser that falls back to black on an
 * unknown form reports a contrast ratio, and a ratio is indistinguishable from
 * a measurement.
 */
export function parseColor(value: string): Rgb | null {
  const v = value.trim();

  // color(srgb 0.41 0.41 0.49) — components are 0..1, NOT 0..255.
  const srgb = v.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
    };
  }

  // rgb(…) / rgba(…) — components are 0..255.
  const rgb = v.match(/^rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1]
      .split(/[,/\s]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  // #rgb / #rrggbb
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }

  return null;
}

const channel = (c: number): number => {
  const x = Math.min(255, Math.max(0, c)) / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. The division by 12.92 applies to the NORMALISED
 *  value — dividing a 0-255 channel by it makes every dark colour 255 times
 *  too bright, which is how amber on black came out at 1.69 instead of 9.22. */
export function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r * (1 - t) + b.r * t,
  g: a.g * (1 - t) + b.g * t,
  b: a.b * (1 - t) + b.b * t,
});

export interface LiftResult {
  /** The colour to use. Equal to the input when no lift was needed. */
  colour: Rgb;
  /** How far it travelled toward `toward`, 0..1. Zero means untouched. */
  moved: number;
  /** The worst ratio across all grounds, after the lift. */
  ratio: number;
  /** `false` when even a full mix cannot reach `need` — the caller decides. */
  reached: boolean;
}

/**
 * Move `fg` toward `toward` until it clears `need` against the WORST of
 * `grounds`.
 *
 * @param grounds every surface this role actually lands on. Passing one is
 *   allowed and is usually wrong — see the note at the top of this file.
 * @param toward normally `--color-text-primary`, which is the contrast-strong
 *   end in every theme, so the direction is right without anyone choosing it.
 *
 * The search is a plain scan in 1 % steps rather than a bisection: the range
 * is 100 wide, the function is called once per role per theme application, and
 * a scan cannot land on the wrong side of a threshold the way an off-by-one
 * bisection can. Correctness is worth more than the microseconds here.
 */
export function liftForContrast(
  fg: Rgb,
  grounds: readonly Rgb[],
  toward: Rgb,
  need = 4.5,
): LiftResult {
  const worst = (c: Rgb): number =>
    grounds.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...grounds.map((g) => contrastRatio(c, g)));

  const start = worst(fg);
  if (start >= need) return { colour: fg, moved: 0, ratio: start, reached: true };

  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    const candidate = mix(fg, toward, t);
    const r = worst(candidate);
    if (r >= need) return { colour: candidate, moved: t, ratio: r, reached: true };
  }

  // Even the full mix falls short. Hand back the best available and say so,
  // rather than pretending: `toward` itself may not clear `need` on a ground
  // that is close to it, and inventing a colour outside the pair would trade
  // a measured shortfall for an unmeasured one.
  const full = mix(fg, toward, 1);
  return { colour: full, moved: 1, ratio: worst(full), reached: false };
}

/** `rgb(r, g, b)`, rounded — the form a stylesheet can take back. */
export function formatRgb(c: Rgb): string {
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}
