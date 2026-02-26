/**
 * Static map configuration — theme colors, node sizes, and lore-based
 * connection descriptions (i18n-ready for when dynamic data replaces these).
 */

/** Theme color map — matches SimulationCard.ts THEME_COLORS */
export const THEME_COLORS: Record<string, string> = {
  dystopian: '#ef4444',
  dark: '#ef4444', // Velgarien uses 'dark' theme
  fantasy: '#f59e0b',
  utopian: '#22c55e',
  scifi: '#06b6d4',
  historical: '#a78bfa',
  custom: '#a855f7',
};

/** Get theme color with fallback */
export function getThemeColor(theme: string): string {
  return THEME_COLORS[theme] ?? '#888888';
}

/** Glow filter color (semi-transparent version of theme color) */
export function getGlowColor(theme: string): string {
  return `${getThemeColor(theme)}66`;
}

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
