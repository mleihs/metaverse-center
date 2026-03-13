/**
 * Shared simulation theme → color mapping.
 *
 * Single source of truth used by SimulationCard, EmbassyLink,
 * CartographerMap, and MapGraph. Add new themes here.
 */

/** Theme color map — hex accent per simulation theme preset */
export const THEME_COLORS: Record<string, string> = {
  dystopian: '#ef4444',
  dark: '#ef4444',
  fantasy: '#f59e0b',
  utopian: '#22c55e',
  scifi: '#06b6d4',
  historical: '#a78bfa',
  custom: '#a855f7',
  'deep-space-horror': '#06b6d4',
  'arc-raiders': '#d97706',
};

/** Map simulation theme → VelgBadge variant for consistent badge colors. */
export function getThemeVariant(theme: string): string {
  const map: Record<string, string> = {
    dystopian: 'danger',
    dark: 'danger',
    fantasy: 'warning',
    utopian: 'success',
    scifi: 'info',
    historical: 'default',
    custom: 'primary',
  };
  return map[theme] ?? 'default';
}

/** Get theme color with fallback */
export function getThemeColor(theme: string): string {
  return THEME_COLORS[theme] ?? '#888888';
}

/** Glow filter color (semi-transparent version of theme color) */
export function getGlowColor(theme: string): string {
  return `${getThemeColor(theme)}66`;
}
