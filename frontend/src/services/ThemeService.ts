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
import { activeCardFrame, cardFrameFromConfig, setPlatformCardFrame } from './card-frame.js';
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
  /*
   * The mono stacks. Every preset's `font_mono` names these before falling back
   * to `monospace`, and none of them exists on Google Fonts — measured in the
   * browser on 03.09.2026, the app was firing two doomed stylesheet requests
   * (`velg-gf-sf-mono`, `velg-gf-menlo`) on every theme application. They are
   * system faces; asking a font service for them was always wrong.
   * ('Inconsolata' and 'Roboto Mono' are NOT listed — those really are on
   * Google Fonts and are meant to load.)
   */
  'sf mono',
  'menlo',
  'monaco',
  'lucida console',
  'consolas',
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

/*
 * Six further setting keys are NOT in the map above and are handled in
 * `applyConfig` step 2b instead: `shadow_color`, `glow_strength`,
 * `label_transform`, `label_tracking`, `color_surface_contrast`,
 * `text_on_contrast`, `accent_on_contrast`.
 *
 * The map writes a token only when the config names it. That is correct while
 * :root is the only thing above a host, and wrong as soon as one themed host
 * can sit inside another — an unwritten token is not the platform default,
 * it is whatever the enclosing skin happens to say. These six are the ones a
 * skin actually diverges on, so they are written on every host, defaulted.
 * Step 2b carries the full argument.
 */

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
    result['--shadow-inset'] = 'none';
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
    /*
     * Cast in the shadow ink, not in the border colour.
     *
     * The old value here was `2px 2px 0 var(--color-border)`, which disagreed
     * with the token's own default in `_shadows.css`
     * (`2px 2px 0 var(--color-shadow)`) — and the disagreement only ever showed
     * on the two presets that cast offset shadows in something other than
     * black ("illuminated-literary" #8B7D6B, "deep-fried-horror" #FF0000),
     * because those were the only ones for which this function used to run at
     * all. Their whole --shadow-* scale is already in that ink; the pressed
     * state was the one step that jumped to the border. Now that the shadows
     * are computed for EVERY host (see applyConfig step 2), the two values had
     * to be reconciled, and the scale is the one that is right: pressed is a
     * shorter version of the same shadow, not a different one.
     *
     * Platform-dark and every #000000 preset are unaffected — for them this
     * evaluates to exactly the `_shadows.css` default.
     */
    case 'offset':
      result['--shadow-pressed'] = `2px 2px 0 ${color}`;
      break;
    case 'blur':
      result['--shadow-pressed'] = `0 1px 3px ${color}30`;
      break;
    case 'glow':
      result['--shadow-pressed'] = `0 0 4px ${color}40`;
      break;
  }

  /*
   * The recessed counterpart. `_shadows.css` declares it as a color-mix over
   * `--color-shadow`, but a var() inside a custom property is substituted where
   * it is DECLARED — on :root, against black — so the :root value inherits into
   * a themed subtree frozen against the platform ink. Emitting it here is what
   * actually themes it, exactly as for the rest of the scale.
   *
   * color-mix() rather than an appended `33` because `color` may arrive as any
   * CSS colour syntax; the hex-suffix idiom above predates this and is kept
   * only where it already ran.
   */
  const inset = `color-mix(in srgb, ${color} 20%, transparent)`;
  switch (style) {
    case 'offset':
      result['--shadow-inset'] = `inset 2px 2px 0 ${inset}`;
      break;
    case 'blur':
      result['--shadow-inset'] = `inset 0 2px 6px ${inset}`;
      break;
    case 'glow':
      result['--shadow-inset'] = `inset 0 0 12px ${inset}`;
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

    // 1b. Publish the theme's POLARITY. See `publishPolarity`. It needs only
    //     the two tokens step 1 just wrote, so it can run here; the contrast
    //     lift cannot, and now runs as step 7b.
    this.publishPolarity(hostElement, tokensApplied);

    /*
     * 2. Shadow tokens — computed for EVERY host, unconditionally.
     *
     * This used to skip the default case (`offset` in `#000000`) on the
     * reasoning that :root already says the same thing. That reasoning holds
     * only while :root is the sole thing above the host. It stopped holding
     * the moment a second platform skin existed: with Atlas on the app shell,
     * the shell carries --shadow-* cast in ink (#17201d), and a DriftView or
     * DungeonView nested inside it re-asserting PLATFORM_DARK_CONFIG would
     * take the default branch, write nothing, and INHERIT the ink shadows it
     * was re-asserting dark specifically to avoid.
     *
     * A skipped write is not a neutral write. Every token a skin can set has
     * to be set on every host, or the nested host reads its parent's skin.
     * The same rule governs 2b below.
     */
    const shadowStyle = (config.shadow_style as ShadowStyle | undefined) ?? 'offset';
    const shadowColor = config.shadow_color ?? '#000000';
    const shadows = computeShadows(shadowStyle, shadowColor);
    for (const [token, value] of Object.entries(shadows)) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
    }

    /*
     * 2b. Tokens that a skin may leave unspecified — written anyway, with the
     *     platform default, for the inheritance reason spelled out in step 2.
     *
     *     --color-shadow  the ink that hand-spelled offset shadows resolve at
     *                     the point of use (Sweep B, 19 sites). computeShadows
     *                     covers the scale; this covers the rest.
     *     --glow-strength multiplier on every CRT glow radius (Sweep D, 445
     *                     sites). Atlas sets 0. If it were merely absent from
     *                     PLATFORM_DARK_CONFIG, the Zwischenraum inside an
     *                     Atlas shell would inherit 0 and lose every glow —
     *                     the exact failure this block prevents, and one that
     *                     no test and no lint gate can see.
     *     --label-*       the label typography role (see THEME_TOKEN_MAP).
     */
    const inheritanceSafeDefaults: [string, string][] = [
      ['--color-shadow', shadowColor],
      ['--glow-strength', config.glow_strength ?? '1'],
      ['--label-transform', config.label_transform ?? 'uppercase'],
      ['--label-tracking', config.label_tracking ?? 'var(--tracking-wider)'],
      /*
       * The counter-block: one panel that reverses the page's polarity to draw
       * a hard edge (the Atlas session log, a footer CTA). On the dark chrome
       * there is nothing to reverse against, so the default is not an inversion
       * at all — the block is the raised surface and its ink the ordinary text
       * colour.
       *
       * Deliberately NOT `--color-surface-inverse`. That token is a platform
       * CONSTANT (#ffffff) whose ink `--color-on-surface-inverse` is documented
       * in `_colors.css` as un-themeable on purpose, and all three of its
       * consumers use it as a white CAMERA FLASH rather than as a surface:
       * `deploy-operative-styles .flash`, `dossier-reveal-styles .stamp__flash`,
       * `VelgDungeonDebrief` (amber 30% over it). Pointing a skin's dark block
       * at that name would turn every flash into a dark veil, silently — no
       * test reads a colour. Two names because there are two roles.
       *
       * Ground and ink are written as a pair and never half-set: a themeable
       * surface under un-themeable ink is precisely the failure
       * `--color-on-surface-inverse` exists to document.
       */
      ['--color-surface-contrast', config.color_surface_contrast ?? 'var(--color-surface-raised)'],
      ['--color-text-on-contrast', config.text_on_contrast ?? 'var(--color-text-primary)'],
      ['--color-accent-on-contrast', config.accent_on_contrast ?? 'var(--color-primary)'],
    ];
    for (const [token, value] of inheritanceSafeDefaults) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
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
    /*
     * `document.body` is the platform-skin host by construction — app-shell.ts
     * writes there and documents why. Remembering its frame is what lets a
     * pinned-dark subtree (DriftView, DungeonView) hand the page back its own
     * frame when it leaves; see restorePlatformCardFrame in card-frame.ts.
     */
    if (hostElement === document.body) {
      setPlatformCardFrame(activeCardFrame.value);
    }

    // 4. Bridge hover_effect setting to CSS custom properties
    const hoverEffect = config.hover_effect ?? 'translate';
    hostElement.style.setProperty('--hover-effect', hoverEffect);
    tokensApplied.push('--hover-effect');

    const hoverTransforms: Record<string, string> = {
      translate: 'translate(-2px, -2px)',
      scale: 'scale(1.03)',
      glow: 'translate(0)',
      /*
       * Atlas. A brutalist card slides diagonally out from under its own offset
       * shadow; a sheet of paper does not slide, it lifts — straight up, and
       * further (4px) because there is no shadow displacement to read the
       * movement against.
       */
      lift: 'translateY(-4px)',
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
      /*
       * Panel-tint overlays, re-derived here for the same reason as
       * --color-text-quiet above: declared on :root they would resolve
       * against the platform-dark text-primary and stay a near-white tint on
       * every themed subtree, including a paper skin where white-on-white is
       * invisible.
       */
      ['--color-overlay-ink', 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)'],
      [
        '--color-overlay-ink-strong',
        'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
      ],
      ['--color-scanline', 'color-mix(in srgb, var(--color-text-primary) 1.5%, transparent)'],
      /*
       * Die vierte Ink-Stufe, und der Beweis, dass diese Liste kein Ritual ist.
       *
       * Sie kam am 03.09.2026 zu den drei darüber und wurde NUR in `:root`
       * deklariert. Im Browser gemessen, Atlas-Skin: die drei Nachbarn lösten
       * zu `#17201d` auf, die neue zu `#e5e5e5` — der Tinte des DUNKLEN Skins,
       * auf jedem Skin, für immer. Eine weiße Markierung auf Papier.
       *
       * Kein Fehler, kein roter Test, nichts: das Token EXISTIERTE und hatte
       * einen gültigen Wert. Nur den falschen. Wer hier eine Stufe ergänzt,
       * ergänzt sie an zwei Orten.
       */
      [
        '--color-overlay-ink-bright',
        'color-mix(in srgb, var(--color-text-primary) 40%, transparent)',
      ],
      ['--color-grid', 'color-mix(in srgb, var(--color-text-primary) 12%, transparent)'],
      /*
       * VIER ALIASSE, DIE NIE EINEM THEME GEFOLGT SIND.
       *
       * `_colors.css` deklariert sie in `:root` als reine Weiterleitungen:
       * `--color-text-link: var(--color-info)` und so weiter. Eine
       * Weiterleitung sieht aus wie eine, die immer stimmt — sie nennt ja
       * gerade KEINEN Wert. Aber ein `var()` in einer Custom Property löst beim
       * deklarierenden Knoten auf, und der ist hier `:root`. Also stand in
       * allen vier seit immer der Plattform-Wert, festgeschrieben, und jedes
       * Theme erbte ihn.
       *
       * Am 03.09.2026 im Browser gemessen, Atlas-Skin: `--color-text-link`
       * stand auf `#3b82f6` statt auf dem Kohlepapier-Blau `#2f3f7a`,
       * `--color-text-danger` und `--color-border-danger` auf `#ef4444` statt
       * `#b3261e`, `--color-border-focus` auf Amber statt auf dem Zinnober.
       *
       * Das ist NICHT nur eine Sache des neuen Skins. Es galt für jede
       * Simulation mit eigenem Theme: eine Cyberpunk-Welt zeigte ihren
       * Gefahren-Text im Plattform-Rot, nicht im eigenen. Gefunden beim
       * Nachmessen der Ink-Stufe darüber, an derselben Falle.
       */
      ['--color-text-link', 'var(--color-info)'],
      ['--color-text-danger', 'var(--color-danger)'],
      ['--color-border-focus', 'var(--color-primary)'],
      ['--color-border-danger', 'var(--color-danger)'],
      /*
       * NICHT NUR FARBEN. Diese fünf hat das Tor gefunden, nachdem es von
       * `_colors.css` auf `styles/tokens/*.css` erweitert wurde — dieselbe
       * Falle, andere Datei. Die erste Fassung des Tores hätte genau das
       * gefangen, was man ihr gesagt hatte, und nichts darüber hinaus.
       *
       * `--heading-font: var(--font-brutalist)` ist der schwerste der fünf:
       * `_global.css` setzt damit die Schrift von h1–h6, und `--font-brutalist`
       * IST vom Theme gesetzt (`font_heading`). Also stand in jeder Welt das
       * Courier der Plattform in den Überschriften, egal welche Schrift ihr
       * Theme nannte. Im Browser nachgemessen, Atlas-Skin: `--font-body` war
       * Spectral (richtig), `--heading-font` Courier (falsch) — im selben
       * berechneten Stil, nebeneinander.
       *
       * Die drei `--transition-*` sind aus BEIDEN Hälften abgeleitet
       * (`--duration-*` skaliert applyConfig über `animation_speed`,
       * `--ease-default` kommt aus `animation_easing`) und froren trotzdem auf
       * `100ms ease` ein. Eine Welt mit animation_speed 1,5 hatte damit
       * `--duration-fast: 150ms` UND `--transition-fast: 100ms` — sich selbst
       * widersprechend, innerhalb eines Themes.
       *
       * `--h6-size` hängt an `--text-base`, dem einzigen Grad, den ein Theme
       * setzt (`font_base_size`). Atlas nennt 17px; h6 blieb bei 16. Die
       * anderen fünf Überschriftengrade hängen an Stufen, die kein Theme
       * anfasst, und stehen deshalb nicht hier — h1/h2 haben zudem eine
       * mobile Fassung in einer Medienabfrage, die ein Inline-Wert auf dem
       * Wirt schlagen würde.
       */
      ['--heading-font', 'var(--font-brutalist)'],
      ['--transition-fast', 'var(--duration-fast) var(--ease-default)'],
      ['--transition-normal', 'var(--duration-normal) var(--ease-default)'],
      ['--transition-slow', 'var(--duration-slow) var(--ease-default)'],
      ['--h6-size', 'var(--text-base)'],
    ];
    for (const [token, value] of granularityPairs) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
    }

    /*
     * 7b. Guarantee that the text roles are legible on this world's own
     *     surfaces. See `enforceTextContrast` for why this layer exists.
     *
     *     WHY HERE AND NOT AFTER STEP 1
     *       It used to run right after the direct token mappings, and it was
     *       measuring two roles that did not exist yet. `--color-text-quiet`
     *       and `--color-text-tertiary` are DERIVED — step 7 above writes them
     *       — so before that the probe read the values inherited from :root,
     *       which are mixed from the platform-dark palette. On a light skin
     *       those are near-white on paper, the guard duly "lifted" them, and
     *       step 7 then overwrote the correction two lines later.
     *
     *       Measured in the browser on 03.09.2026 with the Atlas skin: the
     *       shell reported `data-contrast-lifted="2"` while all four roles
     *       measured 4.68 : 1 or better on every ground. Two corrections that
     *       were neither needed nor kept — and the marker they left is the one
     *       signal that says "this palette was never checked against itself".
     *       A guard that cries wolf is read as noise on the day it is right.
     *
     *     WHY THE LATER POSITION IS ALSO STRONGER
     *       `--color-text-quiet` and `-tertiary` are declared as color-mix()
     *       over `var(--color-text-muted)`. Lifting muted here therefore moves
     *       both of them with it, instead of freezing them at a literal.
     *
     *     The count is published on the host rather than dropped. A correction
     *     nobody can see is a correction nobody can check, and the number
     *     separates the two cases that look identical from the outside: a
     *     world with one role lifted has a colour that drifted, a world with
     *     all of them lifted has a palette that was never checked at all.
     */
    const lifted = this.enforceTextContrast(hostElement, tokensApplied);
    if (lifted > 0) {
      hostElement.dataset.contrastLifted = String(lifted);
    } else {
      delete hostElement.dataset.contrastLifted;
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
    /*
     * Written on every host, like step 2b and for the same reason. The
     * skip-when-system-ui branch was correct while :root was the only thing
     * above a host — an unwritten --font-prose meant Spectral. It stopped being
     * correct with a second platform skin: Atlas sets Spectral as its BODY
     * font, so it writes --font-prose, and a DriftView re-asserting the dark
     * config underneath it took the system-ui branch, wrote nothing, and kept
     * the Atlas value. Caught by platform-skin-switch.test.ts, which compares
     * the two skins' written token sets rather than any one value.
     */
    const bodyFont = config.font_body ?? '';
    hostElement.style.setProperty(
      '--font-prose',
      bodyFont && !bodyFont.startsWith('system-ui') ? bodyFont : 'var(--font-bureau)',
    );
    tokensApplied.push('--font-prose');

    this.appliedTokensByHost.set(hostElement, tokensApplied);

    // 10. Dynamically load any Google Fonts referenced by the config
    const fontKeys = ['font_heading', 'font_body', 'font_mono'] as const;
    for (const key of fontKeys) {
      const family = config[key];
      if (family) loadGoogleFont(family);
    }
    // The heading weight is the one a theme routinely sets outside the standard
    // four; see loadGoogleFontWeight for why it travels in its own request.
    if (config.font_heading && config.heading_weight) {
      loadGoogleFontWeight(config.font_heading, config.heading_weight.trim());
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

    this.publishPlatformAccent(hostElement, polarity === '1', tokensApplied);
  }

  /**
   * Der Plattform-Akzent auf hellem Grund.
   *
   * DAS PROBLEM, GEMESSEN
   *   `--color-accent-amber` (#f59e0b) steht an 708 Stellen in 126 Dateien und
   *   ist die Signalfarbe der Plattform. Auf dem Papiergrund des Atlas-Skins
   *   misst es **1,82 : 1**. 318 dieser Stellen sind `color:`, also Text —
   *   Kicker, Etiketten, Zahlen in der Kopfleiste. Unlesbar, nicht knapp.
   *   `--color-accent-green` (#4ade80) steht bei 1,47 und hat dasselbe Problem.
   *
   *   Als FLAECHE traegt Amber (dunkle Tinte darauf: 7,76). Der Fehler
   *   entsteht nur dort, wo es selbst die Schrift ist.
   *
   * DIE ENTSCHEIDUNG (03.09.2026)
   *   Auf hellem Grund IST der Plattform-Akzent der Akzent des Themes. Eine
   *   gedruckte Karte hat einen Akzent; Amber neben dem Zinnober des
   *   Papier-Skins waeren zwei konkurrierende Signalfarben auf demselben Blatt,
   *   und die schwaechere davon waere die unlesbare.
   *
   *   Der Preis ist benannt und nicht klein: die Zusage "Plattform-Chrome ist
   *   immer Amber, egal welche Welt" gilt auf hellem Grund nicht mehr. Dort
   *   sind Plattform- und Welt-Akzent dieselbe Farbe. Auf dunklem Grund — also
   *   auf dem Dark-Skin und in jeder dunklen Welt — bleibt alles, wie es war.
   *
   * WARUM HIER UND NICHT ALS SWEEP
   *   Eine Regel statt 708 Aenderungen. Und vor allem: der Sweep haette die
   *   Frage an 708 Orte verteilt, wo sie jedes Mal neu falsch beantwortet
   *   werden kann. Hier steht sie einmal.
   *
   * WARUM DIE DUNKLE SEITE AUSDRUECKLICH GESCHRIEBEN WIRD
   *   Nicht "auf hell setzen, sonst nichts tun": ein dunkler Wirt INNERHALB
   *   eines hellen (DriftView, DungeonView) muss den Amber zurueckholen. Wird
   *   auf der dunklen Seite nichts geschrieben, erbt er den Zinnober des
   *   Papiers — genau die Klasse Fehler, gegen die
   *   tests/theme-token-redeclaration.test.ts angelegt wurde.
   */
  private publishPlatformAccent(
    hostElement: HTMLElement,
    light: boolean,
    tokensApplied: string[],
  ): void {
    const pairs: [string, string][] = light
      ? [
          ['--color-accent-amber', 'var(--color-primary)'],
          ['--color-accent-amber-hover', 'var(--color-primary-hover)'],
          [
            '--color-accent-amber-dim',
            'color-mix(in srgb, var(--color-primary) 70%, var(--color-text-primary))',
          ],
          ['--color-accent-amber-glow', 'var(--color-primary-glow)'],
          // Die Tinte AUF der Flaeche kippt mit: dunkle Tinte auf Amber traegt
          // (7,76), auf dem Zinnober nicht (3,90).
          ['--color-on-accent-amber', 'var(--color-text-inverse)'],
          // Das Lebenszeichen: auf Papier das Gruen des Themes (4,50), nicht
          // das Neongruen der Plattform (1,47).
          ['--color-accent-green', 'var(--color-success)'],
        ]
      : [
          ['--color-accent-amber', PLATFORM_AMBER],
          ['--color-accent-amber-hover', PLATFORM_AMBER_HOVER],
          ['--color-accent-amber-dim', PLATFORM_AMBER_DIM],
          ['--color-accent-amber-glow', PLATFORM_AMBER_GLOW],
          ['--color-on-accent-amber', PLATFORM_ON_AMBER],
          ['--color-accent-green', PLATFORM_GREEN],
        ];

    for (const [token, value] of pairs) {
      hostElement.style.setProperty(token, value);
      tokensApplied.push(token);
    }
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
    /*
      Der Wert eines Tokens muss AUFGELOEST gelesen werden, nicht roh.
      
      `getComputedStyle(el).getPropertyValue('--x')` gibt bei einer Custom
      Property den SPEZIFIZIERTEN Text zurueck, nicht die berechnete Farbe. Fuer
      `#a0a0a0` ist das dasselbe; fuer alles andere nicht:
      
          --color-text-secondary   #a0a0a0                         lesbar
          --color-text-muted       #888888                         lesbar
          --color-text-quiet       color-mix(in srgb, #888 70%, …)  NICHT lesbar
          --color-text-tertiary    color-mix(in srgb, #a0a0a0 60%, …) NICHT lesbar
      
      `parseColor` kennt `#hex`, `rgb()` und `color(srgb …)` — kein `color-mix`.
      Fuer die zwei gemischten Rollen gab es also `null`, sie wurden als
      unlesbar gemeldet und uebersprungen. Am 03.09.2026 auf Prod nachgemessen:
      `velg-app` trug ueberhaupt keinen `data-contrast-lifted`-Marker, die
      Hebung hatte NULL Token gehoben.
      
      Das war nicht folgenlos: `--color-text-quiet` ist mit 967 Verwendungen die
      meistgenutzte Schriftfarbe der App, `--color-text-tertiary` hat 124. Der
      Waechter sah 642 Stellen an und uebersprang 1091 — still, denn ein
      uebersprungener Token sieht aus wie ein Token, der keine Hebung brauchte.
      
      Ein Probe-Element loest es: dem Browser `color: var(--x)` geben und die
      BERECHNETE Farbe zurueckholen. Er rechnet `color-mix`, `oklch` und jede
      kuenftige Schreibweise selbst aus — gemessen liefert er
      `color(srgb 0.642745 …)`, und genau das kann `parseColor`.
      
      Das Element haengt am Wirt, damit es dessen Custom Properties erbt, und
      wird sofort wieder entfernt.
    */
    //     Und die Probe muss in den SCHATTEN, nicht an den Wirt.
    //
    //     `velg-app` hat einen Shadow-Root ohne `slot`. Ein Kind, das am Wirt
    //     haengt, wird keinem Slot zugewiesen, also nie gerendert — und
    //     `getComputedStyle` gibt fuer ein nicht gerendertes Element den
    //     leeren String zurueck. Am 03.09.2026 im Browser gegen Prod gemessen:
    //
    //         am Wirt              ""                                (unlesbar)
    //         im Schatten          color(srgb 0.642745 …)            (lesbar)
    //
    //     Die Probe im Schatten erbt die Custom Properties des Wirts genauso —
    //     Vererbung geht ueber die Schattengrenze, Slot-Zuweisung nicht.
    const scope = hostElement.shadowRoot ?? hostElement;
    const probe = hostElement.ownerDocument.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    scope.appendChild(probe);
    const read = (token: string): string => {
      probe.style.color = '';
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color.trim();
    };

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
    if (grounds.length === 0 || toward === null) {
      probe.remove();
      return 0;
    }

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
    // Die Probe hat ihren Zweck erfuellt. Sie MUSS weg: sie haengt am Wirt,
    // und ein vergessenes Element waechst mit jedem Themenwechsel.
    probe.remove();
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
/*
 * Der Plattform-Akzent auf DUNKLEM Grund, wortwoertlich aus _colors.css.
 *
 * Sie stehen hier ein zweites Mal, weil publishPlatformAccent sie auf jedem
 * dunklen Wirt AKTIV zurueckschreiben muss — ein var(--color-accent-amber)
 * wuerde dort den Wert des hellen Elternteils erben. Der Preis ist eine
 * Doppelung, die auseinanderlaufen kann; tests/platform-accent-polarity.test.ts
 * bindet sie deshalb an die CSS-Datei.
 */
const PLATFORM_AMBER = '#f59e0b';
const PLATFORM_AMBER_HOVER = '#fbbf24';
const PLATFORM_AMBER_DIM = '#be5e09';
const PLATFORM_AMBER_GLOW = 'rgba(245, 158, 11, 0.15)';
const PLATFORM_ON_AMBER = '#0a0a0a';
const PLATFORM_GREEN = '#4ade80';

/** The weights every family is requested at. A theme may need one more. */
const STANDARD_WEIGHTS = new Set(['400', '500', '700', '800']);

/**
 * Families that carry an `opsz` axis, with its range.
 *
 * WHY A NAMED LIST AND NOT A BLANKET REQUEST
 *   `css2` answers **400 Bad Request** for a family that lacks a requested
 *   axis — measured on 03.09.2026 against Lora, Oswald, Playfair Display,
 *   Spectral, Geist Mono and Rajdhani, all six. Asking every family for `opsz`
 *   would strip the heading font from six themes to give one theme a nicer
 *   `g`. So the axis is claimed per family, the same way the extra weight is.
 *
 * WHY IT MATTERS AT ALL
 *   `font-optical-sizing: auto` in `_global.css` only does something if the
 *   FILE has the axis, and pinning a weight takes it away. Measured, same day,
 *   via the served woff2's `fvar` table:
 *
 *     :wght@300               → no fvar table at all, a static instance
 *     :opsz,wght@12..96,300   → fvar: opsz 12–96, weight pinned
 *
 *   So the CSS line alone was dead: Atlas asked for weight 300, received a
 *   static cut, and optical sizing had nothing to act on. Nothing reported it
 *   — the font loaded and the headings rendered, drawn for the wrong size.
 *
 *   Note the axis DEFAULT is 96 (display). Even with the variable file, a
 *   16 px label would be drawn at display proportions without the `auto`.
 *   Neither half works alone.
 */
const OPSZ_AXIS = new Map<string, [number, number]>([
  // Verified against the served fvar table, not read off a spec sheet.
  ['bricolage grotesque', [12, 96]],
]);

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
 * Fetch ONE additional weight for a family, in its own <link>.
 *
 * WHY A SECOND REQUEST AND NOT A LONGER LIST
 *   The list above asks for 400/500/700/800. A theme that sets
 *   `heading_weight` outside it gets no such face and the browser renders the
 *   nearest one — Atlas asks Bricolage Grotesque for 300 and would silently
 *   receive 400, which is the whole difference between the skin's thin
 *   headings and ordinary ones. Nothing reports this: the font loads, the
 *   headings render, they are just wrong.
 *
 *   Appending 300 to the shared list is not the fix. `css2` answers
 *   400 Bad Request when ANY requested weight is missing from the family, and
 *   it answers it for the whole stylesheet — Lora (400–700) and Playfair
 *   Display (400–900) have no 300, so one extra entry would strip the body
 *   font from the themes that use them. A separate link fails alone: if the
 *   weight does not exist, that one request 400s and the base faces are
 *   already in the document.
 */
function loadGoogleFontWeight(cssFamily: string, weight: string): void {
  const [family] = extractAllFamilies(cssFamily);
  const key = family?.toLowerCase();
  if (!family || !key || SYSTEM_FONTS.has(key)) return;

  const opsz = OPSZ_AXIS.get(key);
  /*
   * A standard weight is already in the shared request, so normally there is
   * nothing to fetch. An opsz family is the exception: the shared request
   * pins its weights and hands back a static cut, so even a 400-weight
   * heading needs this second link to get the axis at all.
   */
  if (STANDARD_WEIGHTS.has(weight) && !opsz) return;

  const id = `${GOOGLE_FONTS_PREFIX}${key.replace(/\s+/g, '-')}-${weight}`;
  if (document.getElementById(id)) return;

  ensurePreconnect();

  // Axes go in alphabetical order, then one value or range each, same order.
  const axes = opsz ? `opsz,wght@${opsz[0]}..${opsz[1]},${weight}` : `wght@${weight}`;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:${axes}&display=swap`;
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
