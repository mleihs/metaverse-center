/**
 * ThemeService — Loads simulation design settings and applies them
 * as CSS Custom Property overrides on the SimulationShell host element.
 *
 * Architecture: :root tokens are platform-dark (amber accent, dark surfaces).
 * ThemeService overrides them on the shell element, so CSS inheritance
 * cascades to all children (including through Shadow DOM boundaries).
 * Simulations with no saved settings get the brutalist (light) preset
 * as default to prevent inheriting the dark platform tokens.
 *
 * Setting keys are flat (e.g. `color_primary`, `shadow_style`) matching
 * how DesignSettingsPanel saves them.
 */

import { settingsApi } from './api/index.js';
import type { ThemePresetName } from './theme-presets.js';
import { THEME_PRESETS } from './theme-presets.js';

/** Maximum allowed size for custom CSS (bytes). */
const MAX_CUSTOM_CSS_BYTES = 10_240;

/** ID of the injected <style> element for custom CSS. */
const CUSTOM_STYLE_ID = 'velg-simulation-custom-css';

/** Prefix for dynamically injected Google Fonts <link> elements. */
const GOOGLE_FONTS_PREFIX = 'velg-gf-';

/** System fonts that should never be loaded from Google Fonts. */
const SYSTEM_FONTS = new Set([
  'system-ui',
  '-apple-system',
  'segoe ui',
  'arial',
  'arial narrow',
  'helvetica',
  'helvetica neue',
  'georgia',
  'times new roman',
  'courier new',
  'comic sans ms',
  'inherit',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
]);

/** Track which Google Fonts have been loaded to avoid duplicate requests. */
const loadedFonts = new Set<string>();
let preconnectInjected = false;

// ---------------------------------------------------------------------------
// Token Mapping: setting key → base CSS custom property
// ---------------------------------------------------------------------------

/**
 * Maps flat setting keys to the base CSS token names they override.
 * These are the direct 1:1 mappings — computed tokens (shadow, animation)
 * are handled separately.
 */
const THEME_TOKEN_MAP: Record<string, string> = {
  // Colors — setting key names are stored in DB, do not rename without migration.
  // color_secondary → --color-info: info is the secondary status color in the UI hierarchy.
  // color_accent → --color-warning: the theme's accent tone doubles as the warning/attention color.
  color_primary: '--color-primary',
  color_secondary: '--color-info',
  color_accent: '--color-warning',
  color_background: '--color-surface',
  color_surface: '--color-surface-raised',
  color_surface_sunken: '--color-surface-sunken',
  color_surface_header: '--color-surface-header',
  color_text: '--color-text-primary',
  color_text_secondary: '--color-text-secondary',
  color_text_muted: '--color-text-muted',
  color_border: '--color-border',
  color_border_light: '--color-border-light',
  color_danger: '--color-danger',
  color_success: '--color-success',
  text_inverse: '--color-text-inverse',

  // Typography
  font_heading: '--font-brutalist',
  font_body: '--font-body',
  font_mono: '--font-mono',
  heading_weight: '--heading-weight',
  heading_transform: '--heading-transform',
  heading_tracking: '--heading-tracking',
  font_base_size: '--text-base',

  // Character — direct mappings
  border_radius: '--border-radius',
  border_width: '--border-width-thick',
  border_width_default: '--border-width-default',
  animation_easing: '--ease-default',
};

// ---------------------------------------------------------------------------
// Shadow computation
// ---------------------------------------------------------------------------

type ShadowStyle = 'offset' | 'blur' | 'glow' | 'none';

const SHADOW_SCALES = {
  xs: { offset: 2, blur: 4, glow: 4 },
  sm: { offset: 3, blur: 8, glow: 6 },
  md: { offset: 4, blur: 12, glow: 12 },
  lg: { offset: 6, blur: 16, glow: 16 },
  xl: { offset: 8, blur: 24, glow: 20 },
  '2xl': { offset: 12, blur: 32, glow: 28 },
} as const;

function computeShadows(style: ShadowStyle, color: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (style === 'none') {
    for (const size of Object.keys(SHADOW_SCALES)) {
      result[`--shadow-${size}`] = 'none';
    }
    result['--shadow-pressed'] = 'none';
    return result;
  }

  for (const [size, scale] of Object.entries(SHADOW_SCALES)) {
    switch (style) {
      case 'offset':
        result[`--shadow-${size}`] = `${scale.offset}px ${scale.offset}px 0 ${color}`;
        break;
      case 'blur':
        result[`--shadow-${size}`] =
          `0 ${Math.round(scale.blur * 0.3)}px ${scale.blur}px ${color}40`;
        break;
      case 'glow':
        result[`--shadow-${size}`] =
          `0 0 ${scale.glow}px ${color}60, 0 0 ${Math.round(scale.glow * 0.3)}px ${color}30`;
        break;
    }
  }

  // Pressed state
  switch (style) {
    case 'offset':
      result['--shadow-pressed'] = '2px 2px 0 var(--color-border)';
      break;
    case 'blur':
      result['--shadow-pressed'] = `0 1px 3px ${color}30`;
      break;
    case 'glow':
      result['--shadow-pressed'] = `0 0 4px ${color}40`;
      break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Animation speed computation
// ---------------------------------------------------------------------------

const BASE_DURATIONS: Record<string, number> = {
  '--duration-fast': 100,
  '--duration-normal': 200,
  '--duration-slow': 300,
  '--duration-slower': 500,
  '--duration-entrance': 350,
  '--duration-stagger': 40,
  '--duration-cascade': 60,
};

function computeAnimationDurations(speed: number): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [token, baseMs] of Object.entries(BASE_DURATIONS)) {
    result[token] = `${Math.round(baseMs * speed)}ms`;
  }
  return result;
}

// ---------------------------------------------------------------------------
// ThemeService class
// ---------------------------------------------------------------------------

class ThemeService {
  private styleElement: HTMLStyleElement | null = null;
  private appliedTokens: string[] = [];

  /**
   * Load design settings for the given simulation and apply them
   * as CSS custom property overrides on the provided host element.
   */
  async applySimulationTheme(simulationId: string, hostElement: HTMLElement): Promise<void> {
    const response = await settingsApi.getByCategory(simulationId, 'design');

    if (!response.success || !response.data) {
      if (import.meta.env.DEV) {
        console.warn('[ThemeService] Failed to load design settings:', response.error?.message);
      }
      return;
    }

    const settings = response.data;

    // Build a flat config from settings
    const config: Record<string, string> = {};
    let customCss = '';
    let presetName: ThemePresetName = 'brutalist';

    for (const setting of settings) {
      const { setting_key, setting_value } = setting;
      if (setting_key === 'custom_css') {
        customCss = String(setting_value ?? '');
        continue;
      }
      if (setting_key === 'logo_url' || setting_key === 'theme_preset') {
        // theme_preset is metadata — resolve it as the base preset below
        if (setting_key === 'theme_preset') {
          const raw = String(setting_value ?? '').replace(/^"|"$/g, '');
          if (raw in THEME_PRESETS) presetName = raw as ThemePresetName;
        }
        continue;
      }
      if (setting_value != null && String(setting_value).trim() !== '') {
        config[setting_key] = String(setting_value);
      }
    }

    // Merge base preset defaults with saved settings (saved settings win).
    // This ensures simulations always get a complete base even with
    // partial settings, preventing dark platform tokens from bleeding through.
    const mergedConfig = { ...THEME_PRESETS[presetName], ...config };

    this.applyConfig(mergedConfig, hostElement);

    // Set data-simulation attribute for custom CSS targeting
    hostElement.dataset.simulation = simulationId;

    // Inject custom CSS if present
    if (customCss) {
      this.injectCustomCSS(customCss);
    }
  }

  /**
   * Apply a theme config object directly to a host element.
   * Used for live preview and preset application.
   */
  applyConfig(config: Record<string, string>, hostElement: HTMLElement): void {
    // Clear previous overrides
    this.clearInlineTokens(hostElement);

    const tokensApplied: string[] = [];

    // 1. Apply direct token mappings
    for (const [key, value] of Object.entries(config)) {
      const cssToken = THEME_TOKEN_MAP[key];
      if (cssToken && value) {
        hostElement.style.setProperty(cssToken, value);
        tokensApplied.push(cssToken);
      }
    }

    // 2. Compute and apply shadow tokens
    const shadowStyle = config.shadow_style as ShadowStyle | undefined;
    const shadowColor = config.shadow_color ?? '#000000';
    if (shadowStyle && shadowStyle !== 'offset') {
      // Only override if not the default brutalist offset style
      const shadows = computeShadows(shadowStyle, shadowColor);
      for (const [token, value] of Object.entries(shadows)) {
        hostElement.style.setProperty(token, value);
        tokensApplied.push(token);
      }
    } else if (shadowStyle === 'offset' && shadowColor !== '#000000') {
      // Offset style with non-default color
      const shadows = computeShadows('offset', shadowColor);
      for (const [token, value] of Object.entries(shadows)) {
        hostElement.style.setProperty(token, value);
        tokensApplied.push(token);
      }
    }

    // 3. Compute and apply animation duration tokens
    const animSpeed = config.animation_speed ? Number.parseFloat(config.animation_speed) : null;
    if (animSpeed && animSpeed !== 1) {
      const durations = computeAnimationDurations(animSpeed);
      for (const [token, value] of Object.entries(durations)) {
        hostElement.style.setProperty(token, value);
        tokensApplied.push(token);
      }
    }

    // 4. Bridge hover_effect setting to CSS custom properties
    const hoverEffect = config.hover_effect ?? 'translate';
    hostElement.style.setProperty('--hover-effect', hoverEffect);
    tokensApplied.push('--hover-effect');

    const hoverTransforms: Record<string, string> = {
      translate: 'translate(-2px, -2px)',
      scale: 'scale(1.03)',
      glow: 'translate(0)',
    };
    hostElement.style.setProperty(
      '--hover-transform',
      hoverTransforms[hoverEffect] ?? hoverTransforms.translate,
    );
    tokensApplied.push('--hover-transform');

    // 5. Update composed border tokens that depend on border_width
    if (config.border_width_default) {
      const w = config.border_width_default;
      hostElement.style.setProperty('--border-default', `${w} solid var(--color-border)`);
      tokensApplied.push('--border-default');
      hostElement.style.setProperty('--border-light', `${w} solid var(--color-border-light)`);
      tokensApplied.push('--border-light');
    }
    if (config.border_width) {
      hostElement.style.setProperty(
        '--border-medium',
        `${config.border_width} solid var(--color-border)`,
      );
      tokensApplied.push('--border-medium');
    }

    // 6. Auto-derive status color variants on the shell element.
    //    color-mix() expressions resolve using the shell's overridden base values.
    const STATUS_COLORS = ['primary', 'danger', 'success', 'warning', 'info'] as const;
    for (const status of STATUS_COLORS) {
      const pairs: [string, string][] = [
        [`--color-${status}-glow`, `color-mix(in srgb, var(--color-${status}) 15%, transparent)`],
        [`--color-${status}-border`, `color-mix(in srgb, var(--color-${status}) 30%, transparent)`],
        [
          `--color-${status}-bg`,
          `color-mix(in srgb, var(--color-${status}) 8%, var(--color-surface))`,
        ],
        [
          `--color-${status}-hover`,
          `color-mix(in srgb, var(--color-${status}) 80%, var(--color-text-primary))`,
        ],
      ];
      for (const [token, value] of pairs) {
        hostElement.style.setProperty(token, value);
        tokensApplied.push(token);
      }
    }
    // primary-active
    hostElement.style.setProperty(
      '--color-primary-active',
      'color-mix(in srgb, var(--color-primary) 70%, var(--color-text-primary))',
    );
    tokensApplied.push('--color-primary-active');

    // 7. Auto-derive new granularity tokens
    const granularityPairs: [string, string][] = [
      [
        '--color-text-tertiary',
        'color-mix(in srgb, var(--color-text-secondary) 60%, var(--color-text-muted))',
      ],
      ['--color-icon', 'var(--color-text-muted)'],
      ['--color-separator', 'color-mix(in srgb, var(--color-border) 50%, transparent)'],
    ];
    for (const [token, value] of granularityPairs) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
    }

    // 8. Auto-derive focus rings so they adapt to themed status colors
    const ringPairs: [string, string][] = [
      ['--ring-danger', '0 0 0 3px color-mix(in srgb, var(--color-danger) 40%, transparent)'],
      ['--ring-success', '0 0 0 3px color-mix(in srgb, var(--color-success) 40%, transparent)'],
      ['--ring-warning', '0 0 0 3px color-mix(in srgb, var(--color-warning) 40%, transparent)'],
      ['--ring-focus', '0 0 0 3px color-mix(in srgb, var(--color-border-focus) 40%, transparent)'],
    ];
    for (const [token, value] of ringPairs) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
    }

    // 9. Override --font-prose so literary text (LoreScroll, BureauArchives,
    //    Resonance) inherits the simulation's body font inside the shell.
    //    Skip if the body font is the default system stack — let --font-prose
    //    inherit from :root (Spectral) so prose stays readable in serif.
    if (config.font_body && !config.font_body.startsWith('system-ui')) {
      hostElement.style.setProperty('--font-prose', config.font_body);
      tokensApplied.push('--font-prose');
    }

    this.appliedTokens = tokensApplied;

    // 10. Dynamically load any Google Fonts referenced by the config
    const fontKeys = ['font_heading', 'font_body', 'font_mono'] as const;
    for (const key of fontKeys) {
      const family = config[key];
      if (family) loadGoogleFont(family);
    }
  }

  /** Remove all theme overrides from the host element and clean up. */
  resetTheme(hostElement: HTMLElement): void {
    this.clearInlineTokens(hostElement);
    delete hostElement.dataset.simulation;
    this.removeCustomStyleElement();
    this.appliedTokens = [];
  }

  // ensureGoogleFonts removed — fonts are now loaded on demand via loadGoogleFont()

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Remove only the tokens we applied (avoids clearing unrelated inline styles). */
  private clearInlineTokens(hostElement: HTMLElement): void {
    for (const token of this.appliedTokens) {
      hostElement.style.removeProperty(token);
    }
    this.appliedTokens = [];
  }

  /**
   * Inject custom CSS provided by the simulation owner.
   * The CSS is sanitized before insertion.
   */
  private injectCustomCSS(css: string): void {
    this.removeCustomStyleElement();

    const sanitized = this.sanitizeCSS(css);
    if (!sanitized) return;

    const style = document.createElement('style');
    style.id = CUSTOM_STYLE_ID;
    style.textContent = sanitized;
    document.head.appendChild(style);
    this.styleElement = style;
  }

  /** Remove the previously injected custom CSS <style> element if present. */
  private removeCustomStyleElement(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
      return;
    }

    // Fallback: look up by id in case reference was lost
    const existing = document.getElementById(CUSTOM_STYLE_ID);
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Basic sanitization for user-provided CSS.
   *
   * Strips:
   *  - @import rules (potential data exfiltration)
   *  - javascript: URIs
   *  - expression() (legacy IE vector)
   *  - -moz-binding (Firefox XBL vector)
   *  - behavior: (IE HTC vector)
   *
   * Enforces a maximum of MAX_CUSTOM_CSS_BYTES.
   */
  private sanitizeCSS(css: string): string {
    if (!css || typeof css !== 'string') return '';

    if (new Blob([css]).size > MAX_CUSTOM_CSS_BYTES) {
      if (import.meta.env.DEV) {
        console.warn('[ThemeService] Custom CSS exceeds 10 KB limit — skipping.');
      }
      return '';
    }

    let sanitized = css;
    sanitized = sanitized.replace(/@import\s+[^;]+;?/gi, '/* @import removed */');
    sanitized = sanitized.replace(/javascript\s*:/gi, '/* javascript: removed */');
    sanitized = sanitized.replace(/expression\s*\(/gi, '/* expression( removed */');
    sanitized = sanitized.replace(/-moz-binding\s*:/gi, '/* -moz-binding removed */');
    sanitized = sanitized.replace(/behavior\s*:/gi, '/* behavior: removed */');

    return sanitized;
  }
}

export const themeService = new ThemeService();
export type { ShadowStyle };
export { computeAnimationDurations, computeShadows, THEME_TOKEN_MAP };

// ---------------------------------------------------------------------------
// Dynamic Google Font loader — used by ThemeService and VelgFontPicker
// ---------------------------------------------------------------------------

/**
 * Ensure preconnect hints for Google Fonts are in <head>.
 * Called once on first font load request.
 */
function ensurePreconnect(): void {
  if (preconnectInjected) return;
  preconnectInjected = true;

  const pc1 = document.createElement('link');
  pc1.rel = 'preconnect';
  pc1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(pc1);

  const pc2 = document.createElement('link');
  pc2.rel = 'preconnect';
  pc2.href = 'https://fonts.gstatic.com';
  pc2.crossOrigin = '';
  document.head.appendChild(pc2);
}

/**
 * Extract all font family names from a CSS font-family value.
 * E.g. "'Playfair Display', Georgia, serif" → ["Playfair Display", "Georgia", "serif"]
 */
function extractAllFamilies(cssValue: string): string[] {
  return cssValue
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * Dynamically load a single Google Font family.
 * Idempotent — skips system fonts and already-loaded families.
 */
function loadSingleGoogleFont(family: string): void {
  const key = family.toLowerCase();
  if (!family || SYSTEM_FONTS.has(key) || loadedFonts.has(key)) return;
  loadedFonts.add(key);

  ensurePreconnect();

  const encoded = family.replace(/\s+/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap`;

  const link = document.createElement('link');
  link.id = `${GOOGLE_FONTS_PREFIX}${key.replace(/\s+/g, '-')}`;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Dynamically load all non-system Google Fonts in a CSS font-family stack.
 * E.g. "'Lora', Georgia, serif" loads Lora, skips Georgia and serif.
 */
export function loadGoogleFont(cssFamily: string): void {
  for (const family of extractAllFamilies(cssFamily)) {
    loadSingleGoogleFont(family);
  }
}
