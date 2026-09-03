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

import { formatRgb, liftForContrast, luminance, parseColor } from '../utils/contrast-lift.js';
import { settingsApi } from './api/index.js';
import { activeCardFrame, cardFrameFromConfig } from './card-frame.js';
import { captureError } from './SentryService.js';
import type { ThemePresetName } from './theme-presets.js';
import { THEME_PRESETS } from './theme-presets.js';

/**
 * WCAG AA for normal text. Used for every text role, including ones that only
 * ever render large: a token does not know the font size of its consumers, and
 * over-delivering contrast on a heading is a smaller error than under-
 * delivering it on a caption.
 */
const TEXT_CONTRAST_AA = 4.5;

/** Distinct unparseable colour values already reported this session. */
const unparseableSeen = new Set<string>();

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
  /**
   * Inline tokens applied per host element. Keyed by host so the service can theme
   * multiple hosts at once — the simulation shell AND a platform-level view that
   * re-asserts platform-dark on its own host (e.g. the DRIFT Zwischenraum). A single
   * shared list would let one host's clear-before-reapply corrupt the other's tokens.
   */
  private appliedTokensByHost = new WeakMap<HTMLElement, string[]>();

  /**
   * Load design settings for the given simulation and apply them
   * as CSS custom property overrides on the provided host element.
   */
  async applySimulationTheme(simulationId: string, hostElement: HTMLElement): Promise<void> {
    // Design category is publicly readable by anon RLS and is also fetched
    // during route entry (_loadSimulationContext) for signed-out browsers;
    // use `'public'` so the theme loads regardless of membership state.
    const response = await settingsApi.getByCategory(simulationId, 'design', 'public');

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

    // 1b. Guarantee that the text roles are legible on this world's own
    //     surfaces. See `enforceTextContrast` for why this layer exists.
    //
    //     The count is published on the host rather than dropped. A correction
    //     nobody can see is a correction nobody can check, and the number
    //     separates the two cases that look identical from the outside: a
    //     world with one role lifted has a colour that drifted, a world with
    //     both lifted has a palette that was never checked against itself.
    // 1c. Publish the theme's POLARITY. See `publishPolarity`.
    this.publishPolarity(hostElement, tokensApplied);

    const lifted = this.enforceTextContrast(hostElement, tokensApplied);
    if (lifted > 0) {
      hostElement.dataset.contrastLifted = String(lifted);
    } else {
      delete hostElement.dataset.contrastLifted;
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

    // 3b. Publish the card frame treatment. Not a token mapping: each value
    // names a construction the card assembles, not a value it interpolates.
    activeCardFrame.value = cardFrameFromConfig(config);

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
        /*
         * Text in der Statusfarbe auf einer Tönung DERSELBEN Farbe — 168 Regeln
         * in 74 Dateien. Die Tönung liegt nah am Grund, also muss der Text weit
         * vom Grund weg. `-hover` (80 %) reicht dafür messbar nicht: über fünf
         * echte Themes gerechnet kommt er auf 2,63 im schlechtesten Fall, 45 %
         * auf 5,26. Muss hier stehen und nicht nur in `_colors.css`, weil ein
         * `color-mix()` in einer Custom Property gegen das Element auflöst, auf
         * dem es deklariert ist.
         */
        [
          `--color-${status}-readable`,
          `color-mix(in srgb, var(--color-${status}) 45%, var(--color-text-primary))`,
        ],
        // Aliasname, bis die neun `-on-tint`-Fundstellen umgestellt sind.
        [`--color-${status}-on-tint`, `var(--color-${status}-readable)`],
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
      /*
       * Der Plattform-Akzent als Text. Reines Amber steht auf einer hellen
       * Welt-Flaeche bei 1,89 : 1 (gemessen), auf dunkler bei 9,22 — es ist
       * gegen die Theme-Primary immun, nicht gegen Unlesbarkeit. Muss hier
       * stehen, weil das color-mix() sonst gegen die Plattform-Vorgaben
       * aufloest statt gegen die des Themes.
       */
      [
        '--color-accent-amber-readable',
        'color-mix(in srgb, var(--color-accent-amber) 45%, var(--color-text-primary))',
      ],
      ['--color-separator', 'color-mix(in srgb, var(--color-border) 50%, transparent)'],
      /*
       * The quiet tone, re-derived here for the same reason as the rest of this
       * block: a `color-mix()` inside a custom property resolves against the
       * element it was DECLARED on. `--color-text-quiet` is declared on :root,
       * where the tokens are the platform-dark defaults, so a themed subtree
       * would inherit a colour mixed from the wrong two inputs — measured on the
       * light "State Pathography" theme: it arrived as the dark theme's #a4a4a4
       * on a cream ground, 2.10:1.
       *
       * Re-setting it on the themed host makes it resolve against the theme's
       * own muted and primary, and because it mixes toward text-primary the
       * direction takes care of itself: brighter on a dark ground, darker on a
       * light one.
       */
      [
        '--color-text-quiet',
        'color-mix(in srgb, var(--color-text-muted) 70%, var(--color-text-primary))',
      ],
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

    this.appliedTokensByHost.set(hostElement, tokensApplied);

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
  }

  // ensureGoogleFonts removed — fonts are now loaded on demand via loadGoogleFont()

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Remove only the tokens we applied to THIS host (avoids clearing unrelated inline
   *  styles, and avoids one host's reset touching another host's tokens). */
  /**
   * Say once whether this world's ground is light or dark.
   *
   * WHY A TOKEN AND NOT A CLASS
   *   Components keep making an assumption CSS cannot check. The masthead is
   *   the clearest case: it darkened its banner with
   *   `filter: brightness(0.62)` so that light text would read over an
   *   arbitrary generated image. On a light world the text is DARK, so the
   *   same filter pushes image and text toward each other — measured on prod
   *   on 2026-08-31 that is the grey void behind the world name.
   *
   *   CSS cannot compare two colours' luminance, so it cannot ask the
   *   question. JS can, and this is already the one place where every theme
   *   passes through with its colours parsed.
   *
   * WHY A NUMBER AND NOT A FLAG
   *   `--theme-polarity` is 0 (dark ground) or 1 (light ground), so a
   *   component can INTERPOLATE rather than branch:
   *
   *       filter: brightness(calc(0.62 + var(--theme-polarity, 0) * 0.46));
   *
   *   One declaration covers both worlds. A data attribute would force every
   *   consumer into a second rule set, and a consumer inside shadow DOM
   *   cannot select an ancestor's attribute at all — the token crosses that
   *   boundary by inheritance, which is how the rest of the theme travels.
   *
   *   The default in `var(--theme-polarity, 0)` is deliberate: the platform
   *   ground is dark, so an unthemed surface behaves exactly as before.
   *
   * WHAT "LIGHT" MEANS HERE
   *   The surface is lighter than the text that sits on it. Not an absolute
   *   luminance threshold — a world with a mid-grey ground and near-black
   *   text is light in every sense that matters to a component, and one with
   *   the same ground and white text is dark.
   */
  private publishPolarity(hostElement: HTMLElement, tokensApplied: string[]): void {
    const resolved = getComputedStyle(hostElement);
    const surface = parseColor(resolved.getPropertyValue('--color-surface').trim());
    const text = parseColor(resolved.getPropertyValue('--color-text-primary').trim());
    if (surface === null || text === null) return;

    const polarity = luminance(surface) > luminance(text) ? '1' : '0';
    hostElement.style.setProperty('--theme-polarity', polarity);
    tokensApplied.push('--theme-polarity');
  }

  /**
   * Lift the text roles until they are legible on this world's own surfaces.
   *
   * WHY THIS LAYER EXISTS
   *   Step 1 writes a world's stored colours straight through to CSS custom
   *   properties. Between the value a world saves and the text it paints,
   *   nothing looked. Measured on prod (Staatspathographie, a light world) on
   *   2026-08-31, on the page as rendered rather than against the palette:
   *
   *       --color-text-muted   rgb(138,138,158)   2.98 : 1   32 Stellen
   *       --color-accent-amber rgb(245,158,11)    1.89 : 1
   *       --color-primary      rgb(26,26,46)     15.04 : 1   (besteht)
   *
   *   The third line is why this is not a call-site problem. In that world
   *   `--color-primary` IS `--color-text-primary`, so the sweep first proposed
   *   here (81 files, `--color-primary` -> `-readable`) would have touched 81
   *   files and fixed none of the 32: mixing 45 % X with 55 % X is X.
   *
   *   Nor is it a data problem. rgb(138,138,158) appears in no preset — it is
   *   the world's own `simulation_settings` row. Repainting the worlds that
   *   fail today would not reach the world the Forge writes tomorrow.
   *
   *   So the guarantee belongs where every theme passes through, once.
   *
   * WHAT IT CHANGES, AND WHAT IT DOES NOT
   *   The colours belong to the worlds; legibility belongs to the platform.
   *   This moves a role along the line toward `--color-text-primary` by the
   *   smallest step that clears AA — the hue survives, the lightness moves.
   *   A world author who saved #8a8a9e will see it render a little darker on
   *   their cream, and that is deliberate, not drift.
   *
   *   `--color-text-primary` itself is measured but never moved: it is the
   *   target, and a world whose own text colour fails on its own background
   *   cannot be repaired by mixing it with itself. That case is reported
   *   rather than papered over.
   *
   *   Status colours (`--color-primary`, `--color-danger`, ...) stay untouched.
   *   They land on tinted grounds as often as on plain ones, so the honest
   *   fix there is the `-readable` pairing at the call site, not a lift here.
   *
   * @returns how many roles had to be lifted, for the caller that wants to
   *   know. A world where every role needs lifting has a different problem
   *   from one where a single role does.
   */
  private enforceTextContrast(hostElement: HTMLElement, tokensApplied: string[]): number {
    const resolved = getComputedStyle(hostElement);
    const read = (token: string): string => resolved.getPropertyValue(token).trim();

    // Only the three platform surfaces. A role lands on ~45 different grounds
    // across the codebase, but 856 of the ~880 `--color-text-muted` sites sit
    // on one of these three; the rest are tints layered OVER one of them, so
    // clearing the worst of the three is the conservative answer for those too.
    const grounds = ['--color-surface', '--color-surface-raised', '--color-surface-sunken']
      .map((t) => parseColor(read(t)))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const toward = parseColor(read('--color-text-primary'));

    // No measurable ground, or no target: leave the theme exactly as the world
    // saved it. Applying an unmeasured "correction" would be worse than none,
    // and the host is simply not laid out yet in that case.
    if (grounds.length === 0 || toward === null) return 0;

    let lifted = 0;
    // `--color-text-quiet` und `--color-text-tertiary` gehoeren dazu, und das
    // Fehlen war teuer.
    //
    // Am 03.09.2026 auf Prod gemessen: im Chat von Velgarien stand die
    // Initiale eines Avatars in `--color-text-quiet` = #414141 auf
    // `--color-surface-sunken` = #000000. Kontrast 2,12 : 1, verlangt sind
    // 4,5. Die Hebung lief — sie lief nur nicht ueber diese Farbe.
    //
    // Ausgezaehlt, wie oft jede Rolle als Schriftfarbe vorkommt:
    //
    //     --color-text-quiet       967   <- war NICHT gehoben
    //     --color-text-primary     660       (ist das Ziel der Hebung)
    //     --color-text-secondary   457       gehoben
    //     --color-text-muted       185       gehoben
    //     --color-text-tertiary    124   <- war NICHT gehoben
    //
    // Die Liste deckte 642 Stellen ab und liess 1091 aus — mehr als sie
    // schuetzte. Ein Waechter, der die Mehrheit nicht ansieht, ist keiner.
    for (const token of [
      '--color-text-secondary',
      '--color-text-muted',
      '--color-text-quiet',
      '--color-text-tertiary',
    ]) {
      const raw = read(token);
      const fg = parseColor(raw);
      if (fg === null) {
        this.reportUnparseable(token, raw);
        continue;
      }
      const out = liftForContrast(fg, grounds, toward, TEXT_CONTRAST_AA);
      if (out.moved === 0) continue;
      hostElement.style.setProperty(token, formatRgb(out.colour));
      tokensApplied.push(token);
      lifted++;
    }
    return lifted;
  }

  /**
   * A colour form none of our parsers has seen before.
   *
   * Reported once per distinct value per session: a theme that stores `hsl()`
   * would otherwise fire on every page view, and a channel that floods is a
   * channel nobody reads. Silence would be worse — `parseColor` returning
   * `null` means something is painting in a shape we cannot measure, which is
   * a finding about our own reach, not about the world.
   */
  private reportUnparseable(token: string, value: string): void {
    const key = `${token}:${value}`;
    if (unparseableSeen.has(key)) return;
    unparseableSeen.add(key);
    captureError(new Error(`ThemeService: cannot parse ${token} = "${value}"`), {
      source: 'ThemeService.enforceTextContrast',
    });
  }

  private clearInlineTokens(hostElement: HTMLElement): void {
    const tokens = this.appliedTokensByHost.get(hostElement);
    if (!tokens) return;
    for (const token of tokens) {
      hostElement.style.removeProperty(token);
    }
    this.appliedTokensByHost.delete(hostElement);
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
