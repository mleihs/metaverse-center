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
