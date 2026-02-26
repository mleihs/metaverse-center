import { describe, expect, it } from 'vitest';
import {
  THEME_COLORS,
  VECTOR_ICONS,
  VECTOR_LABELS,
  getGlowColor,
  getThemeColor,
} from '../src/components/multiverse/map-data.js';

// ---------------------------------------------------------------------------
// THEME_COLORS
// ---------------------------------------------------------------------------

describe('THEME_COLORS', () => {
  it('should have entries for all known simulation themes', () => {
    const expectedThemes = ['dystopian', 'dark', 'fantasy', 'utopian', 'scifi', 'historical', 'custom'];
    for (const theme of expectedThemes) {
      expect(THEME_COLORS[theme]).toBeDefined();
      expect(THEME_COLORS[theme]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should map dark and dystopian to the same color (Velgarien alias)', () => {
    expect(THEME_COLORS.dark).toBe(THEME_COLORS.dystopian);
  });

  it('should have distinct colors for non-alias themes', () => {
    const uniqueThemes = ['dystopian', 'fantasy', 'utopian', 'scifi', 'historical', 'custom'];
    const colors = uniqueThemes.map((t) => THEME_COLORS[t]);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(uniqueThemes.length);
  });
});

// ---------------------------------------------------------------------------
// getThemeColor
// ---------------------------------------------------------------------------

describe('getThemeColor', () => {
  it('should return the correct color for known themes', () => {
    expect(getThemeColor('dystopian')).toBe('#ef4444');
    expect(getThemeColor('fantasy')).toBe('#f59e0b');
    expect(getThemeColor('scifi')).toBe('#06b6d4');
  });

  it('should return fallback gray for unknown themes', () => {
    expect(getThemeColor('nonexistent')).toBe('#888888');
    expect(getThemeColor('')).toBe('#888888');
  });

  it('should return a valid hex color for all known themes', () => {
    for (const theme of Object.keys(THEME_COLORS)) {
      const color = getThemeColor(theme);
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// getGlowColor
// ---------------------------------------------------------------------------

describe('getGlowColor', () => {
  it('should append 66 (alpha) to the theme color', () => {
    expect(getGlowColor('dystopian')).toBe('#ef444466');
    expect(getGlowColor('fantasy')).toBe('#f59e0b66');
  });

  it('should use fallback color for unknown themes', () => {
    expect(getGlowColor('nonexistent')).toBe('#88888866');
  });
});

// ---------------------------------------------------------------------------
// VECTOR_LABELS
// ---------------------------------------------------------------------------

describe('VECTOR_LABELS', () => {
  const expectedVectors = ['commerce', 'language', 'memory', 'resonance', 'architecture', 'dream', 'desire'];

  it('should have labels for all expected echo vectors', () => {
    for (const vector of expectedVectors) {
      expect(VECTOR_LABELS[vector]).toBeDefined();
      expect(typeof VECTOR_LABELS[vector]).toBe('string');
      expect(VECTOR_LABELS[vector].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly the expected number of entries', () => {
    expect(Object.keys(VECTOR_LABELS).length).toBe(expectedVectors.length);
  });

  it('should have capitalized display labels', () => {
    for (const label of Object.values(VECTOR_LABELS)) {
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});

// ---------------------------------------------------------------------------
// VECTOR_ICONS
// ---------------------------------------------------------------------------

describe('VECTOR_ICONS', () => {
  const expectedVectors = ['commerce', 'language', 'memory', 'resonance', 'architecture', 'dream', 'desire'];

  it('should have icons for all expected echo vectors', () => {
    for (const vector of expectedVectors) {
      expect(VECTOR_ICONS[vector]).toBeDefined();
      expect(typeof VECTOR_ICONS[vector]).toBe('string');
      expect(VECTOR_ICONS[vector].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly the same keys as VECTOR_LABELS', () => {
    const labelKeys = Object.keys(VECTOR_LABELS).sort();
    const iconKeys = Object.keys(VECTOR_ICONS).sort();
    expect(iconKeys).toEqual(labelKeys);
  });

  it('should have exactly the expected number of entries', () => {
    expect(Object.keys(VECTOR_ICONS).length).toBe(expectedVectors.length);
  });
});
