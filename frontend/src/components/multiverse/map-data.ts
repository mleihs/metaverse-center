/**
 * Static map configuration — node sizes, vector labels, and lore-based
 * connection descriptions (i18n-ready for when dynamic data replaces these).
 */

export { getGlowColor, getThemeColor, THEME_COLORS } from '../../utils/theme-colors.js';

/** Vector display labels */
export const VECTOR_LABELS: Record<string, string> = {
  commerce: 'Commerce',
  language: 'Language',
  memory: 'Memory',
  resonance: 'Resonance',
  architecture: 'Architecture',
  dream: 'Dream',
  desire: 'Desire',
};

/** Embassy edge color — warm orange, distinct from bleed purple */
export const EMBASSY_EDGE_COLOR = '#f97316';

/** Vector emoji for compact display */
export const VECTOR_ICONS: Record<string, string> = {
  commerce: '\u{1F4B0}',
  language: '\u{1F4DC}',
  memory: '\u{1F9E0}',
  resonance: '\u{1F50A}',
  architecture: '\u{1F3DB}',
  dream: '\u{1F311}',
  desire: '\u{2764}',
};
