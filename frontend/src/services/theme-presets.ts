/**
 * Theme Presets — predefined theme configurations for simulations.
 *
 * Each preset is a flat Record<string, string> matching setting keys
 * used in simulation_settings (category='design').
 */

import type { SimulationTheme } from '../types/index.js';

export type ThemePresetName =
  | 'brutalist'
  | 'sunless-sea'
  | 'solarpunk'
  | 'cyberpunk'
  | 'nordic-noir'
  | 'deep-space-horror'
  | 'arc-raiders'
  | 'illuminated-literary'
  | 'deep-fried-horror'
  | 'vbdos';

export const THEME_PRESETS: Record<ThemePresetName, Record<string, string>> = {
  brutalist: {
    color_primary: '#000000',
    color_secondary: '#3b82f6',
    color_accent: '#d97706',
    color_background: '#ffffff',
    color_surface: '#f5f5f5',
    color_surface_sunken: '#e5e5e5',
    color_surface_header: '#fafafa',
    color_text: '#0a0a0a',
    color_text_secondary: '#525252',
    color_text_muted: '#595959',
    color_border: '#000000',
    color_border_light: '#d4d4d4',
    color_danger: '#dc2626',
    color_success: '#16a34a',
    font_heading: "'Oswald', 'Arial Narrow', sans-serif",
    font_body: 'system-ui, -apple-system, sans-serif',
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '900',
    heading_transform: 'uppercase',
    heading_tracking: '1px',
    font_base_size: '16px',
    border_radius: '0',
    border_width: '3px',
    border_width_default: '2px',
    shadow_style: 'offset',
    shadow_color: '#000000',
    hover_effect: 'translate',
    animation_speed: '1',
    animation_easing: 'ease',
    text_inverse: '#ffffff',
    card_frame_texture: 'none',
    card_frame_nameplate: 'terminal',
    card_frame_corners: 'none',
    card_frame_foil: 'holographic',
  },

  'sunless-sea': {
    color_primary: '#0d7377',
    color_secondary: '#00e5cc',
    color_accent: '#f4a261',
    color_background: '#0a1628',
    color_surface: '#0f2236',
    color_surface_sunken: '#081320',
    color_surface_header: '#0d1d30',
    color_text: '#e8ede9',
    color_text_secondary: '#90aa9c',
    color_text_muted: '#82a898',
    color_border: '#1a3a4a',
    color_border_light: '#0f2a3a',
    color_danger: '#e74c3c',
    color_success: '#27ae60',
    font_heading: "'Cormorant Garamond', Georgia, serif",
    font_body: "'Lora', Georgia, serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '700',
    heading_transform: 'none',
    heading_tracking: '0.05em',
    font_base_size: '16px',
    border_radius: '6px',
    border_width: '1px',
    border_width_default: '1px',
    shadow_style: 'glow',
    shadow_color: '#00e5cc',
    hover_effect: 'glow',
    animation_speed: '1.5',
    animation_easing: 'ease-in-out',
    text_inverse: '#e8ede9',
    card_frame_texture: 'filigree',
    card_frame_nameplate: 'banner',
    card_frame_corners: 'tentacles',
    card_frame_foil: 'aquatic',
  },

  solarpunk: {
    color_primary: '#16a34a',
    color_secondary: '#b45309',
    color_accent: '#e11d48',
    color_background: '#fefce8',
    color_surface: '#fffbeb',
    color_surface_sunken: '#fef9c3',
    color_surface_header: '#fefdf0',
    color_text: '#1a2e05',
    color_text_secondary: '#4d7c0f',
    color_text_muted: '#4A7010',
    color_border: '#a3e635',
    color_border_light: '#d9f99d',
    color_danger: '#ef4444',
    color_success: '#059669',
    font_heading: "'Georgia', 'Playfair Display', serif",
    font_body: "'Nunito Sans', system-ui, sans-serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '600',
    heading_transform: 'capitalize',
    heading_tracking: '0.02em',
    font_base_size: '16px',
    border_radius: '12px',
    border_width: '1px',
    border_width_default: '1px',
    shadow_style: 'blur',
    shadow_color: '#16a34a',
    hover_effect: 'scale',
    animation_speed: '1.3',
    animation_easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    text_inverse: '#1a2e05',
    card_frame_texture: 'none',
    card_frame_nameplate: 'banner',
    card_frame_corners: 'none',
    card_frame_foil: 'holographic',
  },

  cyberpunk: {
    color_primary: '#ff6b2b',
    color_secondary: '#00d4ff',
    color_accent: '#a855f7',
    color_background: '#0a0a0a',
    color_surface: '#171717',
    color_surface_sunken: '#0a0a0a',
    color_surface_header: '#141414',
    color_text: '#fafafa',
    color_text_secondary: '#a3a3a3',
    color_text_muted: '#999999',
    color_border: '#ff6b2b',
    color_border_light: '#292524',
    color_danger: '#ef4444',
    color_success: '#22c55e',
    font_heading: "'Arial Narrow', 'Barlow Condensed', sans-serif",
    font_body: "'Rajdhani', system-ui, sans-serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '900',
    heading_transform: 'uppercase',
    heading_tracking: '0.08em',
    font_base_size: '15px',
    border_radius: '2px',
    border_width: '2px',
    border_width_default: '1px',
    shadow_style: 'glow',
    shadow_color: '#ff6b2b',
    hover_effect: 'glow',
    animation_speed: '0.7',
    animation_easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    text_inverse: '#0a0a0a',
    card_frame_texture: 'circuits',
    card_frame_nameplate: 'terminal',
    card_frame_corners: 'brackets',
    card_frame_foil: 'holographic',
  },

  'nordic-noir': {
    color_primary: '#64748b',
    color_secondary: '#3b82f6',
    color_accent: '#d97706',
    color_background: '#f8fafc',
    color_surface: '#ffffff',
    color_surface_sunken: '#f1f5f9',
    color_surface_header: '#f8fafc',
    color_text: '#1e293b',
    color_text_secondary: '#475569',
    color_text_muted: '#566676',
    color_border: '#cbd5e1',
    color_border_light: '#e2e8f0',
    color_danger: '#dc2626',
    color_success: '#16a34a',
    font_heading: "'Inter', system-ui, sans-serif",
    font_body: "'Inter', system-ui, sans-serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '500',
    heading_transform: 'none',
    heading_tracking: '-0.01em',
    font_base_size: '16px',
    border_radius: '4px',
    border_width: '1px',
    border_width_default: '1px',
    shadow_style: 'blur',
    shadow_color: '#64748b',
    hover_effect: 'scale',
    animation_speed: '1.2',
    animation_easing: 'ease-in-out',
    text_inverse: '#f8fafc',
    card_frame_texture: 'none',
    card_frame_nameplate: 'banner',
    card_frame_corners: 'none',
    card_frame_foil: 'holographic',
  },

  'deep-space-horror': {
    color_primary: '#00cc88',
    color_secondary: '#00ccff',
    color_accent: '#ff6633',
    color_background: '#050508',
    color_surface: '#0c0c14',
    color_surface_sunken: '#030306',
    color_surface_header: '#0a0a12',
    color_text: '#c8d0d8',
    color_text_secondary: '#7888a0',
    color_text_muted: '#80a0c0',
    color_border: '#1a2030',
    color_border_light: '#141820',
    color_danger: '#ff3344',
    color_success: '#00cc88',
    font_heading: "'Space Mono', 'Courier New', monospace",
    font_body: "'IBM Plex Sans', system-ui, sans-serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '700',
    heading_transform: 'uppercase',
    heading_tracking: '0.12em',
    font_base_size: '15px',
    border_radius: '0',
    border_width: '1px',
    border_width_default: '1px',
    shadow_style: 'glow',
    shadow_color: '#00cc88',
    hover_effect: 'glow',
    animation_speed: '1.8',
    animation_easing: 'ease-in',
    text_inverse: '#050508',
    card_frame_texture: 'scanlines',
    card_frame_nameplate: 'readout',
    card_frame_corners: 'crosshairs',
    card_frame_foil: 'phosphor',
  },

  'arc-raiders': {
    color_primary: '#C08A10',
    color_secondary: '#2B5BA8',
    color_accent: '#B84D1A',
    color_background: '#ECE2D0',
    color_surface: '#F5EDE0',
    color_surface_sunken: '#E0D4BE',
    color_surface_header: '#F0E8D8',
    color_text: '#130918',
    color_text_secondary: '#3D2E47',
    color_text_muted: '#5A4B65',
    color_border: '#8B7D6B',
    color_border_light: '#C9BBAA',
    color_danger: '#C42B1C',
    color_success: '#2D7A3A',
    font_heading: "'Barlow', 'Arial Narrow', sans-serif",
    font_body: "'Source Sans 3', system-ui, sans-serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '800',
    heading_transform: 'uppercase',
    heading_tracking: '0.06em',
    font_base_size: '16px',
    border_radius: '4px',
    border_width: '2px',
    border_width_default: '2px',
    shadow_style: 'offset',
    shadow_color: '#8B7D6B',
    hover_effect: 'translate',
    animation_speed: '0.9',
    animation_easing: 'ease-out',
    text_inverse: '#FFFFFF',
    card_frame_texture: 'rivets',
    card_frame_nameplate: 'plate',
    card_frame_corners: 'bolts',
    card_frame_foil: 'patina',
  },

  'illuminated-literary': {
    color_primary: '#1E3A8A',
    color_secondary: '#7B2D8E',
    color_accent: '#B8860B',
    color_background: '#F5E6CC',
    color_surface: '#FAF3E6',
    color_surface_sunken: '#EDE0C8',
    color_surface_header: '#F7EDD8',
    color_text: '#1C1008',
    color_text_secondary: '#3A2A18',
    color_text_muted: '#5A4B35',
    color_border: '#8B7D6B',
    color_border_light: '#C9BBAA',
    color_danger: '#9B111E',
    color_success: '#2D6B3A',
    font_heading: "'Libre Baskerville', Baskerville, Georgia, serif",
    font_body: "'Cormorant', Georgia, serif",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '700',
    heading_transform: 'none',
    heading_tracking: '0.02em',
    font_base_size: '16px',
    border_radius: '3px',
    border_width: '1px',
    border_width_default: '1px',
    shadow_style: 'blur',
    shadow_color: '#8B7D6B88',
    hover_effect: 'glow',
    animation_speed: '1.1',
    animation_easing: 'ease-in-out',
    text_inverse: '#FFFFFF',
    card_frame_texture: 'illumination',
    card_frame_nameplate: 'cartouche',
    card_frame_corners: 'floral',
    card_frame_foil: 'gilded',
  },

  'deep-fried-horror': {
    color_primary: '#FF00FF',
    color_secondary: '#00FFFF',
    color_accent: '#FF0000',
    color_background: '#FFFF00',
    color_surface: '#FFFFFF',
    color_surface_sunken: '#EEEEEE',
    color_surface_header: '#FFFF00',
    color_text: '#000000',
    color_text_secondary: '#333333',
    color_text_muted: '#555555',
    color_border: '#000000',
    color_border_light: '#CCCCCC',
    color_danger: '#FF0000',
    color_success: '#00FF00',
    font_heading: "'Comic Neue', 'Comic Sans MS', cursive",
    font_body: "'Courier New', Courier, monospace",
    font_mono: "SF Mono, Monaco, Inconsolata, 'Roboto Mono', monospace",
    heading_weight: '900',
    heading_transform: 'uppercase',
    heading_tracking: '0.2em',
    font_base_size: '16px',
    border_radius: '0',
    border_width: '3px',
    border_width_default: '3px',
    shadow_style: 'offset',
    shadow_color: '#FF0000',
    hover_effect: 'translate',
    animation_speed: '2.0',
    animation_easing: 'steps(4, end)',
    text_inverse: '#FFFFFF',
    card_frame_texture: 'none',
    card_frame_nameplate: 'terminal',
    card_frame_corners: 'none',
    card_frame_foil: 'holographic',
  },

  vbdos: {
    color_primary: '#AA00AA',
    color_secondary: '#00AAAA',
    color_accent: '#FFFF55',
    color_background: '#0a1818',
    color_surface: '#0c2424',
    color_surface_sunken: '#081414',
    color_surface_header: '#0a2020',
    color_text: '#AAAAAA',
    color_text_secondary: '#55AA88',
    color_text_muted: '#448877',
    color_border: '#00AAAA',
    color_border_light: '#1a3030',
    color_danger: '#FF5555',
    color_success: '#55FF55',
    font_heading: "'VT323', 'Share Tech Mono', 'Courier New', monospace",
    font_body: "'IBM Plex Mono', 'Courier New', monospace",
    font_mono: "'IBM Plex Mono', 'Courier New', monospace",
    heading_weight: '700',
    heading_transform: 'uppercase',
    heading_tracking: '0.15em',
    font_base_size: '15px',
    border_radius: '0',
    border_width: '2px',
    border_width_default: '1px',
    shadow_style: 'offset',
    shadow_color: '#000000',
    hover_effect: 'translate',
    animation_speed: '0.5',
    animation_easing: 'steps(3, end)',
    text_inverse: '#000000',
    card_frame_texture: 'scanlines',
    card_frame_nameplate: 'terminal',
    card_frame_corners: 'brackets',
    card_frame_foil: 'phosphor',
  },
};

/**
 * Platform-dark "Zwischenraum" config — the platform-chrome theme (amber-on-near-black,
 * Courier headings), mirroring the `:root` token values in `styles/tokens/`.
 *
 * Unlike the 10 sim presets above, this is NOT a selectable simulation theme (it is
 * absent from PRESET_NAMES, so it never appears in the design-settings picker). It exists
 * so a PLATFORM-LEVEL view that happens to render INSIDE a themed simulation shell can
 * re-assert the platform defaults on its own host, neutralising the inherited per-sim
 * theme. The DRIFT view (the Zwischenraum between worlds) applies it so the chart, HUD,
 * labels and dock dossier stay dark-brutalist regardless of which world the traveller is
 * anchored to. Apply via `themeService.applyConfig(PLATFORM_DARK_CONFIG, hostElement)`.
 *
 * Values are kept in sync with `styles/tokens/_colors.css`, `_typography.css`, `_borders.css`.
 */
export const PLATFORM_DARK_CONFIG: Record<string, string> = {
  color_primary: '#f59e0b',
  color_secondary: '#3b82f6',
  color_accent: '#f59e0b',
  color_background: '#0a0a0a',
  color_surface: '#111111',
  color_surface_sunken: '#060606',
  color_surface_header: '#0a0a0a',
  color_text: '#e5e5e5',
  color_text_secondary: '#a0a0a0',
  color_text_muted: '#888888',
  color_border: '#333333',
  color_border_light: '#222222',
  color_danger: '#ef4444',
  color_success: '#22c55e',
  text_inverse: '#0a0a0a',
  font_heading: "'Courier New', 'Monaco', 'Lucida Console', monospace",
  font_body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  font_mono: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
  heading_weight: '700',
  heading_transform: 'uppercase',
  heading_tracking: '0.08em',
  font_base_size: '16px',
  border_radius: '0',
  border_width: '3px',
  border_width_default: '2px',
  shadow_style: 'offset',
  shadow_color: '#000000',
  hover_effect: 'translate',
  animation_speed: '1',
  animation_easing: 'ease',

  /*
   * Spelled out rather than left to ThemeService's defaults.
   *
   * These six are the keys the two platform skins disagree on, and this config
   * exists precisely to be re-asserted on a host INSIDE another themed host —
   * a DriftView inside an Atlas shell. Relying on a default would mean the dark
   * chrome is defined by what ThemeService happens to fall back to rather than
   * by what this file says; the day someone changes a default, the Zwischenraum
   * changes with it and nothing points here. A skin should state its own values.
   */
  glow_strength: '1',
  label_transform: 'uppercase',
  label_tracking: '0.05em',
  color_surface_contrast: '#111111',
  text_on_contrast: '#e5e5e5',
};

/**
 * Platform-Atlas config — the second global skin: map paper, ink, vermilion.
 *
 * The counterpart to PLATFORM_DARK_CONFIG and, like it, not a selectable
 * simulation theme (absent from PRESET_NAMES). Both are applied to the app
 * shell by `app-shell.ts` from `appState.platformSkin`; DriftView and
 * DungeonView keep re-asserting PLATFORM_DARK_CONFIG on their own hosts
 * whatever the user picked, because the Zwischenraum and the CRT are diegetic,
 * not decorative.
 *
 * MEASURED CONTRAST (this file's own numbers, not the handoff's — recomputed
 * against every surface the role actually lands on; AA = 4.5):
 *
 *                        on #e9ede9   on #dfe5e0   on #d5dcd6
 *   text     #17201d       14.08        13.03        11.93
 *   secondary #3a463f       8.34         7.72         7.07
 *   muted    #55605b        5.53         5.12         4.68
 *   info     #2f3f7a        8.40         7.77         7.12
 *   danger   #b3261e        5.53         5.11         4.68
 *   success  #1f7a4d        4.50         4.16         3.81   (status colour —
 *            text use goes through --color-success-readable, see _colors.css)
 *   primary  #b63c24        4.85         4.49         4.11
 *   #e9ede9 on the primary fill                       4.85
 *   #e9ede9 on the counter-block #24332d             11.19
 *
 * TWO VALUES DEVIATE FROM THE DESIGN HANDOFF, both because its stated
 * contrasts did not survive measurement:
 *
 *   color_primary  #d9482b -> #b63c24. The handoff reads "4.6 : 1"; measured
 *     it is 3.61, and no ink passes AA on #d9482b from either side (paper
 *     3.61, ink 3.90) — its own maximum is below the threshold. That matters
 *     beyond the token itself: `--color-text-inverse` on a `--color-primary`
 *     fill is the pairing `.btn--primary` uses, 114 sites. #b63c24 is the same
 *     vermilion one step down, the lightest value at which both directions
 *     clear 4.5.
 *
 *   color_text_muted  #5f6b66 -> #55605b. The handoff reads "4.9 : 1" against
 *     the page ground and calls the raised surface "4.5 – Grenze"; measured,
 *     the ground gives 4.70, raised 4.34 and sunken 3.98. ThemeService's
 *     enforceTextContrast would have lifted it automatically — which is the
 *     point: a PLATFORM skin that trips the platform's own emergency guard is
 *     a palette that was never checked against itself. #55605b clears the
 *     darkest of the three grounds on its own.
 *
 * DECIDED 2026-09-03: `color_accent` maps to --color-warning, and the handoff
 * set it equal to the primary. Warning and danger then read as the same red and
 * a warning badge stops being distinguishable from a danger one — the dark skin
 * separates them by hue (amber vs. red). The accent now carries its own ochre;
 * see the note on the key itself.
 */
export const PLATFORM_ATLAS_CONFIG: Record<string, string> = {
  // Colours — paper, ink, vermilion
  color_primary: '#ab3922', // vermilion: accent, active states, CTA
  color_secondary: '#2f3f7a', // carbon-paper blue: info, links in prose
  /*
   * Ochre — the third ink, and NOT a copy of the primary.
   *
   * `color_accent` is what ThemeService writes into --color-warning (119 files
   * read it). The handoff set it to the vermilion, which would have put warning
   * (#b63c24) and danger (#b3261e) within a hair of each other: two reds that
   * differ by 9 degrees of hue and nothing else. On the dark skin the same two
   * roles are amber and red — a distinction you can see across a room, and one
   * that survives being printed, dimmed or looked at by someone who reads red
   * poorly. Losing it on paper would have been a regression with no error.
   *
   * #7b5a0e is a printer's ochre at 42° — 29° off the vermilion, 38° off the
   * danger red — and it sits at the same strength as the primary on the page
   * (5.36 against 5.32), which is what makes the two read as one hand.
   *
   * THE NUMBER IS AGAINST THE DARKEST PAPER, NOT THE PAGE.
   *   These four inks were first tuned against the page ground alone
   *   (#e9ede9), where the ochre read 4.87 and the vermilion 4.85. Measured on
   *   production 2026-09-03, the skin has THREE paper grounds, and the ladder
   *   down to the sunken tone costs 0.74 of ratio: the same vermilion read
   *   4.49 on the raised ground under every sheet number, and success fell to
   *   3.81 on the sunken one. Four inks, tuned against one ground, used on
   *   three.
   *
   *   They are now tuned against #d5dcd6, the darkest of the three, so the
   *   floor holds wherever the ink actually lands. The hue moved by at most
   *   0.2°; only the lightness did. The full cross of ink against ground is in
   *   tests/platform-atlas-contrast.test.ts.
   */
  color_accent: '#7b5a0e',
  color_background: '#e9ede9', // map paper
  color_surface: '#dfe5e0', // raised: active rows, cells, sticky heads
  color_surface_sunken: '#d5dcd6',
  color_surface_header: '#e9ede9',
  color_text: '#17201d', // ink
  color_text_secondary: '#3a463f',
  color_text_muted: '#55605b',
  color_border: '#17201d', // grid lines are ink, 1px
  color_border_light: '#c3cdc6',
  color_danger: '#b3261e',
  color_success: '#1c6d45',
  text_inverse: '#e9ede9',
  color_surface_contrast: '#24332d', // the one dark block: session log, footer CTA
  text_on_contrast: '#e9ede9',
  // Der Gegenblock zeigt ein Terminal, und ein Terminal ist im ganzen Projekt
  // amber auf dunkel. Gemessen gegen #24332d: 6,16 : 1 — der Zinnober des
  // Papiers stand dort bei 2,31.
  accent_on_contrast: '#f59e0b',

  // Typography
  font_heading: "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif",
  font_body: "'Spectral', Georgia, 'Times New Roman', serif",
  font_mono: "'Geist Mono', 'SF Mono', Menlo, monospace",
  heading_weight: '300',
  heading_transform: 'none', // lowercase headings — the core of the skin
  heading_tracking: '-0.035em',
  label_transform: 'uppercase', // kickers stay versal mono
  label_tracking: '0.04em',
  font_base_size: '17px', // Spectral runs small; 17px ≈ 16px sans

  // Character
  border_radius: '0',
  border_width: '1px', // "thick" is 1px: the atlas has no heavy rules
  border_width_default: '1px',
  shadow_style: 'offset',
  shadow_color: '#17201d', // offset shadows in ink, not black
  glow_strength: '0', // no CRT glow on paper
  hover_effect: 'lift', // translateY(-4px), see ThemeService hoverTransforms
  animation_speed: '1',
  animation_easing: 'cubic-bezier(.2,.7,.2,1)',

  /*
   * Card frame — laid paper, and otherwise nothing.
   *
   * The handoff asked for `card_frame_texture: 'paper'`, and until 03.09.2026
   * this key said 'none' for an honest reason: VelgGameCard renders these as
   * `card--tex-*` / `card--plate-*` class names, so a value with no matching
   * rule is silently the same as no treatment at all. 'paper' would have been
   * a name that looks like a design and resolves to nothing — the failure
   * `DEFAULT_CARD_FRAME` in card-frame.ts is documented for.
   *
   * `.card--tex-paper` now exists (VelgGameCard, next to the other five), so
   * the name is a decision again. The other three stay off: paper wears no
   * foil, and the plate is plain.
   */
  card_frame_texture: 'paper',
  card_frame_nameplate: 'plain',
  card_frame_corners: 'none',
  card_frame_foil: 'none',
};

/**
 * The two global skins the platform chrome can wear.
 *
 * Not the same axis as `ThemePresetName`: a preset dresses ONE simulation and
 * is chosen by its architect; a skin dresses the platform around every
 * simulation and is chosen by the reader. A world's own theme still wins inside
 * its shell — the skin is what the reader sees on the way there, and what a
 * world with no theme of its own inherits.
 */
export type PlatformSkin = 'dark' | 'atlas';

/**
 * Welche Layout-Vorlage Frontseite und Dashboard tragen.
 *
 * Steht hier neben dem Skin, weil sie heute von ihm abgeleitet ist
 * (`appState.landingTemplate`) — und weil der Name dann an EINER Stelle
 * definiert ist statt in jeder der Komponenten, die ihn als Attribut annimmt.
 */
export type LandingTemplate = 'editorial' | 'atlas';

/**
 * WHICH SKIN CARRIES THE ACCESSIBILITY PROMISE
 *
 * `dark` is the accessible skin. It is what an account gets before it has ever
 * chosen anything, what an anonymous visitor is shown, and the one the platform
 * warrants: every text role clears WCAG AA against every surface, and so does
 * every fill that carries a label. A change that drops a number there is a bug.
 *
 * `atlas` is an EDITION — an alternative a reader opts into. It is held to the
 * same rule for text and to the non-text floor (3 : 1, WCAG 1.4.11) for the
 * coloured fills, so a status stays perceivable without the palette having to
 * behave like the baseline.
 *
 * The split for text is not a matter of taste, it is mechanical:
 * `ThemeService.enforceTextContrast` lifts ANY text role below 4.5 : 1 at
 * runtime, for every skin. A skin whose text sits below AA does not render as
 * designed — the platform quietly rewrites it. So the AA line on text roles
 * holds for atlas too, not because atlas promises AA but because falling under
 * it means the design never reaches the screen. (As it happens atlas clears AA
 * on its fills as well today; the floor below is the room it is allowed, not a
 * description of where it stands.)
 *
 * tests/platform-atlas-contrast.test.ts recomputes both floors on every run.
 */
export const PLATFORM_SKIN_CONTRAST: Record<
  PlatformSkin,
  { readonly text: number; readonly fill: number }
> = {
  dark: { text: 4.5, fill: 4.5 },
  atlas: { text: 4.5, fill: 3 },
};

/** Skin name → config, so a call site can look one up instead of branching. */
export const PLATFORM_SKINS: Record<PlatformSkin, Record<string, string>> = {
  dark: PLATFORM_DARK_CONFIG,
  atlas: PLATFORM_ATLAS_CONFIG,
};

/** Narrow an arbitrary stored string to a skin, or nothing. */
export function isPlatformSkin(value: string | null): value is PlatformSkin {
  return value !== null && value in PLATFORM_SKINS;
}

/** Maps SimulationTheme types to suggested preset names. */
export function getPresetForTheme(theme: SimulationTheme, slug?: string): ThemePresetName {
  if (slug === 'spengbabs-grease-pit') return 'deep-fried-horror';
  if (slug === 'conventional-memory') return 'vbdos';

  switch (theme) {
    case 'dystopian':
      return 'cyberpunk';
    case 'utopian':
      return 'illuminated-literary';
    case 'fantasy':
      return 'sunless-sea';
    case 'scifi':
      return 'cyberpunk';
    case 'historical':
      return 'nordic-noir';
    default:
      return 'brutalist';
  }
}

/** All available preset names for UI display. */
export const PRESET_NAMES: ThemePresetName[] = [
  'brutalist',
  'sunless-sea',
  'solarpunk',
  'cyberpunk',
  'nordic-noir',
  'deep-space-horror',
  'arc-raiders',
  'illuminated-literary',
  'deep-fried-horror',
  'vbdos',
];
