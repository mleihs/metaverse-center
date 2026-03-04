/**
 * Static map configuration — node sizes, vector labels, and lore-based
 * connection descriptions (i18n-ready for when dynamic data replaces these).
 */

import { msg } from '@lit/localize';

export { getGlowColor, getThemeColor, THEME_COLORS } from '../../utils/theme-colors.js';

/** Vector display labels (function for locale-aware evaluation) */
export function getVectorLabels(): Record<string, string> {
  return {
    commerce: msg('Commerce'),
    language: msg('Language'),
    memory: msg('Memory'),
    resonance: msg('Resonance'),
    architecture: msg('Architecture'),
    dream: msg('Dream'),
    desire: msg('Desire'),
  };
}

/** Embassy edge color — warm orange, distinct from bleed purple */
export const EMBASSY_EDGE_COLOR = '#f97316';

/** Operative type → trail color */
export const OPERATIVE_COLORS: Record<string, string> = {
  spy: '#3b82f6', // blue
  saboteur: '#f59e0b', // amber
  propagandist: '#a78bfa', // purple
  assassin: '#ef4444', // red
  guardian: '#22c55e', // green
  infiltrator: '#06b6d4', // cyan
};

/** Score dimension → color */
export const SCORE_DIMENSION_COLORS: Record<string, string> = {
  stability: '#22c55e', // green
  influence: '#a78bfa', // purple
  sovereignty: '#3b82f6', // blue
  diplomatic: '#f59e0b', // amber
  military: '#ef4444', // red
};
