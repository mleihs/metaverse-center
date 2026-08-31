/**
 * Control fixtures for measure-contrast-pairs.py — pairs whose ratio is known
 * BY HAND, not by the tool that measures them.
 *
 * WHY THIS FILE EXISTS
 *   On 2026-08-31 four sessions found twenty defects of one shape between
 *   them, and every one produced a PLAUSIBLE OUTPUT instead of an error. What
 *   actually caught them was almost never a compiler, a lint gate or a review:
 *   it was a second, independently known value that the result had to agree
 *   with.
 *
 *     a regex without the underscore     78 findings instead of 172
 *     color(srgb …) read as 0-255        17.62:1 instead of 4.55
 *     a luminance dividing 0-255 by 12.92  amber on black at 1.69, not 9.22
 *     a preset regex without quotes      4 themes of 10, in silence
 *     a walk starting at the element     0 elements, "all clean"
 *
 *   Each was found because somebody already knew what the answer should be.
 *   That knowledge lived in a person. This file is where it lives instead.
 *
 * HOW TO USE IT
 *   python3 scripts/measure-contrast-pairs.py --self-check
 *
 *   Every EXPECT below is checked against the tool's own output. A mismatch
 *   fails loudly, because a measuring instrument that has drifted reports a
 *   number and not a fault — that is the whole point.
 *
 * HOW TO ADD ONE
 *   Compute the ratio by hand (or with a second tool), write it in the EXPECT
 *   comment with its inputs, and never adjust the number to make the check
 *   pass. If the tool and the fixture disagree, exactly one of them is wrong
 *   and it is not automatically the fixture.
 */
import { css } from 'lit';

export const contrastControls = css`
  :host {
    background: var(--color-surface-sunken);
  }

  /* EXPECT 2.72 — #555555 on --color-surface-sunken (#060606).
     Hand-computed; independently measured at 2.80 by another session against a
     slightly different ground. Anything near 17 means the colour parser is
     reading a normalised form as 0-255. */
  .control-hex-on-sunken {
    color: #555555; /* lint-color-ok: a control value, not a design decision */
    font-size: 10px;
  }

  /* EXPECT 1.61 — color-mix(--color-text-muted 60%, transparent) over the same
     sunken ground. Checks that a translucent FOREGROUND is composited onto its
     ground rather than measured against nothing. */
  .control-translucent-fg {
    color: color-mix(in srgb, var(--color-text-muted) 60%, transparent);
    font-size: 11px;
  }

  /* EXPECT pass — --color-text-primary on the sunken ground. A control that
     must stay SILENT: a tool that reports everything is as useless as one that
     reports nothing. */
  .control-passes {
    color: var(--color-text-primary);
    font-size: var(--text-sm);
  }

  /* EXPECT pass — 28px amber. Checks the large-text threshold (3.0, not 4.5).
     If this ever appears as a finding, the size or weight parsing has drifted. */
  .control-large-text {
    color: var(--color-primary);
    font-size: 28px;
  }
`;

/**
 * Layered ground: :host sunken, a surface on top, a 6% tint over THAT.
 * EXPECT 2.09 — with the tool reporting "+1 layer(s) below".
 *
 * Added after a session pointed out that compositing a translucent ground
 * straight onto the page lands on a ground that is too light and reports a
 * value that is too GOOD. The friendlier error, and still an error.
 */
export const contrastControlsLayered = css`
  :host {
    background: var(--color-surface-sunken);
  }
  .tab {
    background: var(--color-surface);
  }
  .tab__tint {
    background: color-mix(in srgb, var(--color-accent-amber) 6%, transparent);
  }
  .tab__tint__label {
    color: color-mix(in srgb, var(--color-text-muted) 70%, transparent);
    font-size: 10px;
  }
`;
