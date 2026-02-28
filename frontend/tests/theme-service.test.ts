import { describe, expect, it, vi } from 'vitest';

// Mock the settingsApi import chain to avoid Supabase env var requirement.
// ThemeService imports settingsApi which transitively loads supabase/client.ts
// that throws at module level without VITE_SUPABASE_* env vars.
vi.mock('../src/services/api/index.js', () => ({
  settingsApi: {},
}));

import {
  THEME_TOKEN_MAP,
  computeAnimationDurations,
  computeShadows,
} from '../src/services/ThemeService.js';
import type { ShadowStyle } from '../src/services/ThemeService.js';

// ---------------------------------------------------------------------------
// THEME_TOKEN_MAP
// ---------------------------------------------------------------------------

describe('THEME_TOKEN_MAP', () => {
  it('maps all 21 color keys to --color-* CSS variables', () => {
    const colorKeys = [
      'color_primary',
      'color_primary_hover',
      'color_primary_active',
      'color_secondary',
      'color_accent',
      'color_background',
      'color_surface',
      'color_surface_sunken',
      'color_surface_header',
      'color_text',
      'color_text_secondary',
      'color_text_muted',
      'color_border',
      'color_border_light',
      'color_danger',
      'color_success',
      'color_primary_bg',
      'color_info_bg',
      'color_danger_bg',
      'color_success_bg',
      'color_warning_bg',
    ];

    for (const key of colorKeys) {
      expect(THEME_TOKEN_MAP[key]).toBeDefined();
      expect(THEME_TOKEN_MAP[key]).toMatch(/^--color-/);
    }
  });

  it('maps text_inverse to --color-text-inverse', () => {
    expect(THEME_TOKEN_MAP.text_inverse).toBe('--color-text-inverse');
  });

  it('maps all 7 typography keys to correct CSS variables', () => {
    expect(THEME_TOKEN_MAP.font_heading).toBe('--font-brutalist');
    expect(THEME_TOKEN_MAP.font_body).toBe('--font-sans');
    expect(THEME_TOKEN_MAP.font_mono).toBe('--font-mono');
    expect(THEME_TOKEN_MAP.heading_weight).toBe('--heading-weight');
    expect(THEME_TOKEN_MAP.heading_transform).toBe('--heading-transform');
    expect(THEME_TOKEN_MAP.heading_tracking).toBe('--heading-tracking');
    expect(THEME_TOKEN_MAP.font_base_size).toBe('--text-base');
  });

  it('maps character keys (border_radius, border_width, animation_easing)', () => {
    expect(THEME_TOKEN_MAP.border_radius).toBe('--border-radius');
    expect(THEME_TOKEN_MAP.border_width).toBe('--border-width-thick');
    expect(THEME_TOKEN_MAP.border_width_default).toBe('--border-width-default');
    expect(THEME_TOKEN_MAP.animation_easing).toBe('--ease-default');
  });

  it('does NOT contain computed keys (shadow_style, shadow_color, animation_speed, hover_effect)', () => {
    expect(THEME_TOKEN_MAP.shadow_style).toBeUndefined();
    expect(THEME_TOKEN_MAP.shadow_color).toBeUndefined();
    expect(THEME_TOKEN_MAP.animation_speed).toBeUndefined();
    expect(THEME_TOKEN_MAP.hover_effect).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeShadows
// ---------------------------------------------------------------------------

describe('computeShadows', () => {
  describe('offset', () => {
    it('generates 6 sizes with "Npx Npx 0 <color>" pattern', () => {
      const result = computeShadows('offset', '#000000');

      expect(result['--shadow-xs']).toBe('2px 2px 0 #000000');
      expect(result['--shadow-sm']).toBe('3px 3px 0 #000000');
      expect(result['--shadow-md']).toBe('4px 4px 0 #000000');
      expect(result['--shadow-lg']).toBe('6px 6px 0 #000000');
      expect(result['--shadow-xl']).toBe('8px 8px 0 #000000');
      expect(result['--shadow-2xl']).toBe('12px 12px 0 #000000');
    });

    it('uses correct offset scales (xs=2, sm=3, md=4, lg=6, xl=8, 2xl=12)', () => {
      const result = computeShadows('offset', '#abc');
      const sizes = [
        ['xs', 2],
        ['sm', 3],
        ['md', 4],
        ['lg', 6],
        ['xl', 8],
        ['2xl', 12],
      ] as const;

      for (const [size, px] of sizes) {
        expect(result[`--shadow-${size}`]).toBe(`${px}px ${px}px 0 #abc`);
      }
    });

    it('pressed = "2px 2px 0 var(--color-border)"', () => {
      const result = computeShadows('offset', '#ff0000');
      expect(result['--shadow-pressed']).toBe('2px 2px 0 var(--color-border)');
    });
  });

  describe('blur', () => {
    it('generates "0 Npx Npx <color>40" pattern', () => {
      const result = computeShadows('blur', '#000000');

      // blur values: xs=4, sm=8, md=12, lg=16, xl=24, 2xl=32
      // formula: 0 round(blur*0.3)px blurpx color40
      expect(result['--shadow-xs']).toBe('0 1px 4px #00000040');
      expect(result['--shadow-sm']).toBe('0 2px 8px #00000040');
      expect(result['--shadow-md']).toBe('0 4px 12px #00000040');
      expect(result['--shadow-lg']).toBe('0 5px 16px #00000040');
      expect(result['--shadow-xl']).toBe('0 7px 24px #00000040');
      expect(result['--shadow-2xl']).toBe('0 10px 32px #00000040');
    });

    it('pressed uses <color>30', () => {
      const result = computeShadows('blur', '#ff6b2b');
      expect(result['--shadow-pressed']).toBe('0 1px 3px #ff6b2b30');
    });
  });

  describe('glow', () => {
    it('generates double box-shadow with <color>60 and <color>30', () => {
      const result = computeShadows('glow', '#00e5cc');

      // glow values: xs=4, sm=6, md=12, lg=16, xl=20, 2xl=28
      // formula: 0 0 glowpx color60, 0 0 round(glow*0.3)px color30
      expect(result['--shadow-xs']).toBe('0 0 4px #00e5cc60, 0 0 1px #00e5cc30');
      expect(result['--shadow-sm']).toBe('0 0 6px #00e5cc60, 0 0 2px #00e5cc30');
      expect(result['--shadow-md']).toBe('0 0 12px #00e5cc60, 0 0 4px #00e5cc30');
      expect(result['--shadow-lg']).toBe('0 0 16px #00e5cc60, 0 0 5px #00e5cc30');
      expect(result['--shadow-xl']).toBe('0 0 20px #00e5cc60, 0 0 6px #00e5cc30');
      expect(result['--shadow-2xl']).toBe('0 0 28px #00e5cc60, 0 0 8px #00e5cc30');
    });

    it('pressed uses <color>40', () => {
      const result = computeShadows('glow', '#00e5cc');
      expect(result['--shadow-pressed']).toBe('0 0 4px #00e5cc40');
    });
  });

  describe('none', () => {
    it('all 6 sizes = "none"', () => {
      const result = computeShadows('none', '#000000');

      expect(result['--shadow-xs']).toBe('none');
      expect(result['--shadow-sm']).toBe('none');
      expect(result['--shadow-md']).toBe('none');
      expect(result['--shadow-lg']).toBe('none');
      expect(result['--shadow-xl']).toBe('none');
      expect(result['--shadow-2xl']).toBe('none');
    });

    it('pressed = "none"', () => {
      const result = computeShadows('none', '#000000');
      expect(result['--shadow-pressed']).toBe('none');
    });
  });

  describe('color passthrough', () => {
    it('custom color appears in all shadow values for offset', () => {
      const result = computeShadows('offset', '#ff6b2b');
      for (const [key, value] of Object.entries(result)) {
        if (key !== '--shadow-pressed') {
          expect(value).toContain('#ff6b2b');
        }
      }
    });

    it('custom color appears in all shadow values for blur', () => {
      const result = computeShadows('blur', '#4ade80');
      for (const value of Object.values(result)) {
        expect(value).toContain('#4ade80');
      }
    });

    it('custom color appears in all shadow values for glow', () => {
      const result = computeShadows('glow', '#a855f7');
      for (const value of Object.values(result)) {
        expect(value).toContain('#a855f7');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// computeAnimationDurations
// ---------------------------------------------------------------------------

describe('computeAnimationDurations', () => {
  it('multiplier 1.0 returns base values (100, 200, 300, 500 ms)', () => {
    const result = computeAnimationDurations(1.0);

    expect(result['--duration-fast']).toBe('100ms');
    expect(result['--duration-normal']).toBe('200ms');
    expect(result['--duration-slow']).toBe('300ms');
    expect(result['--duration-slower']).toBe('500ms');
  });

  it('multiplier 0.5 returns halved values (50, 100, 150, 250)', () => {
    const result = computeAnimationDurations(0.5);

    expect(result['--duration-fast']).toBe('50ms');
    expect(result['--duration-normal']).toBe('100ms');
    expect(result['--duration-slow']).toBe('150ms');
    expect(result['--duration-slower']).toBe('250ms');
  });

  it('multiplier 2.0 returns doubled values (200, 400, 600, 1000)', () => {
    const result = computeAnimationDurations(2.0);

    expect(result['--duration-fast']).toBe('200ms');
    expect(result['--duration-normal']).toBe('400ms');
    expect(result['--duration-slow']).toBe('600ms');
    expect(result['--duration-slower']).toBe('1000ms');
  });

  it('multiplier 0.7 returns rounded values (70, 140, 210, 350)', () => {
    const result = computeAnimationDurations(0.7);

    expect(result['--duration-fast']).toBe('70ms');
    expect(result['--duration-normal']).toBe('140ms');
    expect(result['--duration-slow']).toBe('210ms');
    expect(result['--duration-slower']).toBe('350ms');
  });

  it('returns exactly 7 tokens (4 base + 3 entrance)', () => {
    const result = computeAnimationDurations(1.0);
    expect(Object.keys(result)).toHaveLength(7);
    expect(result['--duration-entrance']).toBe('350ms');
    expect(result['--duration-stagger']).toBe('40ms');
    expect(result['--duration-cascade']).toBe('60ms');
  });
});
