/**
 * Card frame treatment — the four named recipes a simulation dresses its game
 * cards in, and the one mapping that reads them out of a theme config.
 *
 * ## Why this is its own module
 *
 * `ThemeService` owns the frame at runtime, but it also loads settings through
 * the API layer, which reaches the Supabase client at import time. Putting the
 * frame there would make every `<velg-game-card>` — the most widely used
 * component on the platform — transitively depend on a configured Supabase
 * environment just to know whether it wears brackets in its corners. This file
 * has no dependency beyond the signals primitive.
 *
 * ## Why these are data, not CSS custom properties
 *
 * Colours and fonts travel as tokens because a card can interpolate them. A
 * texture is a whole background construction and a nameplate is a different
 * arrangement of glyphs and rules; CSS cannot branch on a custom property's
 * string value without style queries. So the value travels as data and the card
 * turns it into a class.
 *
 * Every preset in `theme-presets.ts` has carried these four keys since the card
 * system was specified, and the Forge Darkroom has offered all 22 options —
 * but `THEME_TOKEN_MAP` had no entry for them, so `applyConfig` skipped them
 * silently and the card never saw a value. This module is the missing link.
 */
import { signal } from '@preact/signals-core';

export interface CardFrame {
  /** Surface pattern layered onto the card's background. */
  texture: string;
  /** Arrangement of the name band. */
  nameplate: string;
  /** Corner motif, or `none`. */
  corners: string;
  /** Sheen worn by legendary cards. */
  foil: string;
}

/**
 * The frame an unthemed context wears.
 *
 * Matches the platform's own brutalist preset: a plain surface with a terminal
 * name band and no corner motif.
 *
 * ABSENCE VALUES
 *   `<velg-game-card>` turns each key into a class (`card--tex-none`,
 *   `card--plate-plain`, `card--corner-none`, `card--foil-none`), so a value
 *   with no matching CSS rule IS the "off" state — that is how `none` has
 *   always worked for texture and corners. `plain` (nameplate) and `none`
 *   (foil) are the same word for the other two axes; the Atlas skin needs all
 *   four off, and paper wears no foil.
 *
 *   The corollary matters more: an INVENTED value is indistinguishable from
 *   "off". `card_frame_texture: 'paper'` would look like a design decision in
 *   the config and render as nothing at all. Only name a treatment that has a
 *   rule.
 */
export const DEFAULT_CARD_FRAME: CardFrame = {
  texture: 'none',
  nameplate: 'terminal',
  corners: 'none',
  foil: 'holographic',
};

/**
 * Frame of the simulation currently themed.
 *
 * Written by `ThemeService.applyConfig`, read by `<velg-game-card>`.
 */
export const activeCardFrame = signal<CardFrame>({ ...DEFAULT_CARD_FRAME });

/**
 * The frame of the OUTERMOST themed host — the platform skin on `document.body`.
 *
 * WHY THIS EXISTS
 *   `activeCardFrame` is one global signal, but a page has more than one themed
 *   host: the shell themes `document.body` with the platform skin, and
 *   `DriftView` / `DungeonView` pin `PLATFORM_DARK_CONFIG` onto THEMSELVES so
 *   their subtree stays phosphor whatever the world around them looks like.
 *
 *   Their own comments say a teardown is unnecessary because the element is
 *   destroyed on route change and takes its inline tokens with it. That is true
 *   of the tokens and false of this signal: it is global, so the nested view's
 *   frame outlives the nested view.
 *
 *   Measured in the browser on 03.09.2026, Atlas skin: frame `paper` before a
 *   nested dark host, `none` + `terminal` + `holographic` after that host left
 *   the tree — and it stayed that way. Every card on the paper skin lost its
 *   stock and gained a terminal nameplate for the rest of the session, until
 *   the next skin toggle happened to rewrite the signal.
 *
 *   It was invisible until now only because the Atlas skin asked for no
 *   texture, so both frames were the platform default and the leak had nothing
 *   to show. A latent bug, not a new one.
 *
 * THE OBLIGATION
 *   A host that themes a SUBTREE owes a `restorePlatformCardFrame()` when it
 *   leaves. That pairing is manual, which is why it is written down here rather
 *   than only at the two call sites; `tests/card-frame-restore.test.ts` pins
 *   the behaviour so a third nested host cannot quietly skip it.
 */
let platformCardFrame: CardFrame = { ...DEFAULT_CARD_FRAME };

/** Remember the outermost frame. Called by ThemeService for `document.body`. */
export function setPlatformCardFrame(frame: CardFrame): void {
  platformCardFrame = { ...frame };
}

/** Give the page its own frame back after a pinned subtree goes away. */
export function restorePlatformCardFrame(): void {
  activeCardFrame.value = { ...platformCardFrame };
}

/**
 * Read the four frame keys out of a flat theme config.
 *
 * Falls back per key rather than per object, so a config that names only a
 * texture keeps the default nameplate instead of losing the whole frame.
 */
export function cardFrameFromConfig(config: Record<string, string>): CardFrame {
  return {
    texture: config.card_frame_texture || DEFAULT_CARD_FRAME.texture,
    nameplate: config.card_frame_nameplate || DEFAULT_CARD_FRAME.nameplate,
    corners: config.card_frame_corners || DEFAULT_CARD_FRAME.corners,
    foil: config.card_frame_foil || DEFAULT_CARD_FRAME.foil,
  };
}
