/**
 * Bureau Ops panel frame styles -- shared "Cold War dossier" decoration.
 *
 * Applied to every `velg-ops-*-panel` as the final element of its
 * `static styles` array so per-panel tokens (especially `--_accent`) are
 * already declared by the host rule. Composes cleanly with the existing
 * `:host::before` amber accent-bar on each panel -- we only use
 * background-image layers on `:host` and `:host::after`, so there is no
 * pseudo-element collision.
 *
 * Visual contract:
 *   - 4 amber L-shaped corner brackets (`--_bracket-size`, `--_accent`)
 *   - Horizontal scanline overlay at 3% opacity, stepping every 3px
 *   - Entirely static (no animation) — works identically under
 *     `prefers-reduced-motion`. A future "scanline drift" variant would
 *     need its own `::after` animation + reduced-motion guard.
 *
 * Opt-outs:
 *   - `:host([no-frame])` disables brackets + scanlines entirely (used for
 *     the DispatchTicker and IncidentDossierDrawer, which are not panels)
 *
 * Why `background-image` instead of pseudo-elements:
 *   - Each panel already uses `:host::before` for the 3px accent top-bar.
 *   - `:host::after` is reserved for future motion (scanline drift, etc.).
 *   - Corner brackets via layered `linear-gradient` backgrounds avoid the
 *     need for a wrapper <div> in each panel template.
 *
 * IMPORTANT — cascade contract:
 *   This module MUST be the LAST element in each panel's
 *   `static styles = [...css`...`, bureauPanelFrameStyles]` array, because
 *   it relies on a later `:host { background: ... }` rule overriding the
 *   panel's own `:host { background: var(--color-surface-raised) }`. If
 *   reordered, the frame silently disappears. Keep this invariant.
 *
 * Tokens consumed:
 *   - `--_accent` -- per-panel accent color (Tier 3, defined on `:host`)
 *   - `--color-surface-raised` -- falls through unchanged
 */

import { css } from 'lit';

export const bureauPanelFrameStyles = css`
  :host {
    --_bracket-size: 14px;
    --_bracket-thickness: 2px;
    --_scanline-alpha: 3%;
    --_scanline-step: 3px;

    /* Corner brackets + scanline overlay, layered over the existing
     * surface-raised background. The per-panel 3px amber top-bar rendered
     * via :host::before paints OVER these background layers, so the
     * top-left/top-right bracket corners visually tuck under the accent
     * bar (which is exactly what we want for the dossier look). */
    background:
      /* Top-left bracket */
      linear-gradient(to right, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        top left / var(--_bracket-size) var(--_bracket-thickness) no-repeat,
      linear-gradient(to bottom, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        top left / var(--_bracket-thickness) var(--_bracket-size) no-repeat,

      /* Top-right bracket */
      linear-gradient(to left, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        top right / var(--_bracket-size) var(--_bracket-thickness) no-repeat,
      linear-gradient(to bottom, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        top right / var(--_bracket-thickness) var(--_bracket-size) no-repeat,

      /* Bottom-left bracket */
      linear-gradient(to right, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        bottom left / var(--_bracket-size) var(--_bracket-thickness) no-repeat,
      linear-gradient(to top, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        bottom left / var(--_bracket-thickness) var(--_bracket-size) no-repeat,

      /* Bottom-right bracket */
      linear-gradient(to left, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        bottom right / var(--_bracket-size) var(--_bracket-thickness) no-repeat,
      linear-gradient(to top, var(--_accent) var(--_bracket-size), transparent var(--_bracket-size))
        bottom right / var(--_bracket-thickness) var(--_bracket-size) no-repeat,

      /* Scanline overlay (stepped horizontal lines, very low contrast) */
      repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent calc(var(--_scanline-step) - 1px),
        color-mix(in srgb, var(--_accent) var(--_scanline-alpha), transparent) calc(var(--_scanline-step) - 1px),
        color-mix(in srgb, var(--_accent) var(--_scanline-alpha), transparent) var(--_scanline-step)
      ),

      /* Original surface color */
      var(--color-surface-raised);
  }

  :host([no-frame]) {
    background: var(--color-surface-raised);
  }
`;
