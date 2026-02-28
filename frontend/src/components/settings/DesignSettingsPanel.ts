import { localized, msg, str } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import { themeService } from '../../services/ThemeService.js';
import { PRESET_NAMES, THEME_PRESETS, type ThemePresetName } from '../../services/theme-presets.js';
import type { SimulationSetting } from '../../types/index.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';

// ---------------------------------------------------------------------------
// Field definitions — functions so msg() evaluates at render time
// ---------------------------------------------------------------------------

interface ColorFieldDef {
  key: string;
  label: string;
  info: string;
  defaultValue: string;
}

function getColorFields(): ColorFieldDef[] {
  return [
    {
      key: 'color_primary',
      label: msg('Primary'),
      info: msg(
        'Main brand color for buttons, active states, and accents. Appears on primary buttons, active tabs, and focus rings.',
      ),
      defaultValue: '#000000',
    },
    {
      key: 'color_primary_hover',
      label: msg('Primary Hover'),
      info: msg('Hover state of primary elements. Slightly lighter or darker than primary.'),
      defaultValue: '#1a1a1a',
    },
    {
      key: 'color_primary_active',
      label: msg('Primary Active'),
      info: msg('Active/pressed state of primary elements.'),
      defaultValue: '#333333',
    },
    {
      key: 'color_secondary',
      label: msg('Secondary'),
      info: msg('Secondary accent color used for info badges, links, and highlights.'),
      defaultValue: '#3b82f6',
    },
    {
      key: 'color_accent',
      label: msg('Accent'),
      info: msg('Accent color for warnings, highlights, and decorative elements.'),
      defaultValue: '#f59e0b',
    },
    {
      key: 'color_background',
      label: msg('Background'),
      info: msg('Main page background color. The base layer behind all content.'),
      defaultValue: '#ffffff',
    },
    {
      key: 'color_surface',
      label: msg('Surface'),
      info: msg('Raised surface color for cards, panels, and modals.'),
      defaultValue: '#f5f5f5',
    },
    {
      key: 'color_surface_sunken',
      label: msg('Surface Sunken'),
      info: msg('Recessed surface color for inset areas and input backgrounds.'),
      defaultValue: '#e5e5e5',
    },
    {
      key: 'color_surface_header',
      label: msg('Surface Header'),
      info: msg('Background color for headers and navigation bars.'),
      defaultValue: '#fafafa',
    },
    {
      key: 'color_text',
      label: msg('Text'),
      info: msg('Primary text color used for headings and body text.'),
      defaultValue: '#0a0a0a',
    },
    {
      key: 'color_text_secondary',
      label: msg('Text Secondary'),
      info: msg('Secondary text color for labels, captions, and less prominent text.'),
      defaultValue: '#525252',
    },
    {
      key: 'color_text_muted',
      label: msg('Text Muted'),
      info: msg('Muted text color for placeholders, disabled text, and hints.'),
      defaultValue: '#a3a3a3',
    },
    {
      key: 'color_border',
      label: msg('Border'),
      info: msg('Primary border color for cards, inputs, and dividers.'),
      defaultValue: '#000000',
    },
    {
      key: 'color_border_light',
      label: msg('Border Light'),
      info: msg('Subtle border color for light dividers and secondary borders.'),
      defaultValue: '#d4d4d4',
    },
    {
      key: 'color_danger',
      label: msg('Danger'),
      info: msg('Color for error states, destructive actions, and danger alerts.'),
      defaultValue: '#dc2626',
    },
    {
      key: 'color_success',
      label: msg('Success'),
      info: msg('Color for success states, confirmations, and positive feedback.'),
      defaultValue: '#16a34a',
    },
    {
      key: 'color_primary_bg',
      label: msg('Primary Background'),
      info: msg('Tinted background for primary badges, selected states, and highlights.'),
      defaultValue: '#f3f4f6',
    },
    {
      key: 'color_info_bg',
      label: msg('Info Background'),
      info: msg('Tinted background for info badges, generate buttons, and informational panels.'),
      defaultValue: '#eff6ff',
    },
    {
      key: 'color_danger_bg',
      label: msg('Danger Background'),
      info: msg('Tinted background for error messages and danger alerts.'),
      defaultValue: '#fef2f2',
    },
    {
      key: 'color_success_bg',
      label: msg('Success Background'),
      info: msg('Tinted background for success states and positive feedback.'),
      defaultValue: '#f0fdf4',
    },
    {
      key: 'color_warning_bg',
      label: msg('Warning Background'),
      info: msg('Tinted background for warning messages and caution indicators.'),
      defaultValue: '#fffbeb',
    },
  ];
}

interface FontFieldDef {
  key: string;
  label: string;
  info: string;
  placeholder: string;
  type: string;
}

function getFontFields(): FontFieldDef[] {
  return [
    {
      key: 'font_heading',
      label: msg('Heading Font'),
      info: msg('Font family for all headings (h1-h6), navigation labels, and section titles.'),
      placeholder: "'Courier New', monospace",
      type: 'text',
    },
    {
      key: 'font_body',
      label: msg('Body Font'),
      info: msg('Font family for body text, paragraphs, and form inputs.'),
      placeholder: 'system-ui, sans-serif',
      type: 'text',
    },
    {
      key: 'font_mono',
      label: msg('Monospace Font'),
      info: msg('Font family for code blocks, data tables, and technical content.'),
      placeholder: 'SF Mono, Monaco, monospace',
      type: 'text',
    },
    {
      key: 'font_base_size',
      label: msg('Base Font Size'),
      info: msg('Base font size in px. All other sizes scale relative to this.'),
      placeholder: '16px',
      type: 'text',
    },
    {
      key: 'heading_weight',
      label: msg('Heading Weight'),
      info: msg('Font weight for headings. 400=normal, 700=bold, 900=black.'),
      placeholder: '900',
      type: 'text',
    },
    {
      key: 'heading_transform',
      label: msg('Heading Transform'),
      info: msg(
        'Text transform for headings. "uppercase" for ALL CAPS, "capitalize" for Title Case, "none" for normal.',
      ),
      placeholder: 'uppercase',
      type: 'text',
    },
    {
      key: 'heading_tracking',
      label: msg('Heading Letter Spacing'),
      info: msg('Letter spacing for headings. Use CSS values like 1px, 0.05em, or -0.01em.'),
      placeholder: '1px',
      type: 'text',
    },
  ];
}

interface CharacterFieldDef {
  key: string;
  label: string;
  info: string;
  inputType: 'text' | 'color' | 'select' | 'range';
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string;
}

function getCharacterFields(): CharacterFieldDef[] {
  return [
    {
      key: 'border_radius',
      label: msg('Border Radius'),
      info: msg(
        'Corner rounding for all cards, buttons, and inputs. 0=sharp brutalist corners, 12px=soft organic feel.',
      ),
      inputType: 'text',
      placeholder: '0',
    },
    {
      key: 'border_width',
      label: msg('Border Width (Primary)'),
      info: msg('Thickness of primary borders on cards and prominent elements.'),
      inputType: 'text',
      placeholder: '3px',
    },
    {
      key: 'border_width_default',
      label: msg('Border Width (Default)'),
      info: msg('Thickness of standard borders on inputs, dividers, and secondary elements.'),
      inputType: 'text',
      placeholder: '2px',
    },
    {
      key: 'shadow_style',
      label: msg('Shadow Style'),
      info: msg(
        'Overall shadow character. "offset"=hard brutalist shadows, "blur"=soft organic, "glow"=luminous cyberpunk/fantasy, "none"=flat minimalist.',
      ),
      inputType: 'select',
      options: [
        { value: 'offset', label: msg('Offset (Brutalist)') },
        { value: 'blur', label: msg('Blur (Organic)') },
        { value: 'glow', label: msg('Glow (Fantasy)') },
        { value: 'none', label: msg('None (Minimalist)') },
      ],
    },
    {
      key: 'shadow_color',
      label: msg('Shadow Color'),
      info: msg(
        'Tint color for shadows and glows. Black for brutalist, cyan for bioluminescent, etc.',
      ),
      inputType: 'color',
      defaultValue: '#000000',
    },
    {
      key: 'hover_effect',
      label: msg('Hover Effect'),
      info: msg(
        'How interactive elements respond to hover. "translate"=lift up-left, "scale"=grow slightly, "glow"=luminous highlight.',
      ),
      inputType: 'select',
      options: [
        { value: 'translate', label: msg('Translate (Lift)') },
        { value: 'scale', label: msg('Scale (Grow)') },
        { value: 'glow', label: msg('Glow (Luminous)') },
      ],
    },
    {
      key: 'text_inverse',
      label: msg('Text on Primary'),
      info: msg(
        'Text color used on primary-color backgrounds (e.g. buttons). Usually white or dark.',
      ),
      inputType: 'color',
      defaultValue: '#ffffff',
    },
  ];
}

function getAnimationFields(): CharacterFieldDef[] {
  return [
    {
      key: 'animation_speed',
      label: msg('Animation Speed'),
      info: msg(
        'Speed multiplier for all transitions. 0.7=fast/snappy, 1.0=normal, 1.5=slow/flowing.',
      ),
      inputType: 'range',
      min: '0.5',
      max: '2.0',
      step: '0.1',
      defaultValue: '1',
    },
    {
      key: 'animation_easing',
      label: msg('Easing Function'),
      info: msg(
        'CSS timing function for transitions. Controls the acceleration curve of animations.',
      ),
      inputType: 'select',
      options: [
        { value: 'ease', label: msg('Ease (Default)') },
        { value: 'ease-in-out', label: msg('Ease In-Out (Smooth)') },
        { value: 'ease-in', label: msg('Ease In') },
        { value: 'ease-out', label: msg('Ease Out') },
        { value: 'linear', label: msg('Linear') },
        { value: 'cubic-bezier(0.22, 1, 0.36, 1)', label: msg('Sharp (Cyberpunk)') },
        { value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', label: msg('Bouncy (Playful)') },
      ],
    },
  ];
}

function getPresetLabels(): Record<ThemePresetName, string> {
  return {
    brutalist: msg('Brutalist'),
    'sunless-sea': msg('Sunless Sea'),
    solarpunk: msg('Solarpunk'),
    cyberpunk: msg('Cyberpunk'),
    'nordic-noir': msg('Nordic Noir'),
    'deep-space-horror': msg('Deep Space Horror'),
    'arc-raiders': msg('Arc Raiders'),
  };
}

const MAX_CUSTOM_CSS_LENGTH = 10240;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@localized()
@customElement('velg-design-settings-panel')
export class VelgDesignSettingsPanel extends BaseSettingsPanel {
  static styles = [
    settingsStyles,
    infoBubbleStyles,
    css`
    /* --- Preset Selector --- */

    .preset-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .preset-bar__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      min-width: 180px;
    }

    .preset-bar__btn {
      display: inline-flex;
      align-items: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-default);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .preset-bar__btn:hover {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    /* --- Section --- */

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    /* --- Color Grid --- */

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-4);
    }

    .color-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .color-field__label-row {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .color-field__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .color-field__input-row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }

    .color-field__picker {
      width: 40px;
      height: 36px;
      padding: 2px;
      border: var(--border-medium);
      background: var(--color-surface);
      cursor: pointer;
      flex-shrink: 0;
    }

    .color-field__picker::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    .color-field__picker::-webkit-color-swatch {
      border: none;
    }

    .color-field__hex {
      font-family: monospace;
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-2);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      box-sizing: border-box;
      text-transform: uppercase;
    }

    .color-field__hex:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    /* --- Font / Form Fields --- */

    .font-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-4);
    }

    .form__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .form__label-row {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .form__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .form__input,
    .form__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      box-sizing: border-box;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form__input:focus,
    .form__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__input::placeholder {
      color: var(--color-text-muted);
    }

    .form__textarea {
      font-family: monospace;
      font-size: var(--text-sm);
      padding: var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      box-sizing: border-box;
      min-height: 160px;
      resize: vertical;
      tab-size: 2;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form__textarea:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-sans);
    }

    /* --- Range input --- */

    .range-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .range-row__input {
      flex: 1;
      accent-color: var(--color-primary);
    }

    .range-row__value {
      font-family: monospace;
      font-size: var(--text-sm);
      min-width: 36px;
      text-align: center;
    }

    /* --- Character Grid --- */

    .character-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-4);
    }

    /* --- Preview --- */

    .preview {
      padding: var(--space-4);
      border: var(--border-default);
    }

    .preview__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-3) 0;
    }

    .preview__content {
      padding: var(--space-5);
      border: 2px solid;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      transition: all 0.3s ease;
    }

    .preview__heading {
      font-size: 1.25em;
      margin: 0;
    }

    .preview__text {
      font-size: 0.9em;
      line-height: 1.6;
      margin: 0;
    }

    .preview__text--muted {
      opacity: 0.6;
    }

    .preview__swatch-row {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .preview__swatch {
      width: 32px;
      height: 32px;
      border: 1px solid rgba(128, 128, 128, 0.3);
      transition: border-radius 0.3s ease;
    }

    .preview__btn-row {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .preview__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 14px;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: default;
      width: fit-content;
      transition: all 0.3s ease;
    }

    .preview__card {
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      transition: all 0.3s ease;
    }

    .preview__card-title {
      font-size: 0.85em;
      margin: 0;
    }

    .preview__card-text {
      font-size: 0.8em;
      margin: 0;
      line-height: 1.5;
    }

    .preview__input {
      padding: 6px 10px;
      font-size: 0.85em;
      width: 200px;
      max-width: 100%;
      box-sizing: border-box;
    }

  `,
  ];

  protected get category() {
    return 'design' as const;
  }

  protected get successMessage(): string {
    return msg('Design settings saved successfully.');
  }

  @state() private _selectedPreset: ThemePresetName | 'custom' = 'custom';

  // ---------------------------------------------------------------------------
  // Data loading (override to also detect preset)
  // ---------------------------------------------------------------------------

  protected override async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, 'design');

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const vals: Record<string, string> = {};

        for (const setting of settings) {
          vals[setting.setting_key] = String(setting.setting_value ?? '');
        }

        this._values = { ...vals };
        this._originalValues = { ...vals };
        this._detectPreset();
      } else {
        this._error = response.error?.message ?? msg('Failed to load design settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Preset handling
  // ---------------------------------------------------------------------------

  /** Detect if current values match a known preset. */
  private _detectPreset(): void {
    for (const name of PRESET_NAMES) {
      const preset = THEME_PRESETS[name];
      const allMatch = Object.entries(preset).every(
        ([key, value]) => (this._values[key] ?? '') === value,
      );
      if (allMatch) {
        this._selectedPreset = name;
        return;
      }
    }
    this._selectedPreset = 'custom';
  }

  private _handlePresetChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this._selectedPreset = value as ThemePresetName | 'custom';
  }

  private _applyPreset(): void {
    if (this._selectedPreset === 'custom') return;
    const preset = THEME_PRESETS[this._selectedPreset];
    if (!preset) return;

    // Keep custom_css if it exists
    const customCss = this._values.custom_css;
    this._values = { ...preset };
    if (customCss) {
      this._values.custom_css = customCss;
    }
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  protected override _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this._values = { ...this._values, [key]: target.value };
    this._selectedPreset = 'custom';
  }

  private _getColorValue(key: string, defaultValue: string): string {
    return this._values[key] || defaultValue;
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  private async _handleSave(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

    const customCss = this._values.custom_css ?? '';
    if (customCss.length > MAX_CUSTOM_CSS_LENGTH) {
      VelgToast.warning(msg(str`Custom CSS exceeds maximum of ${MAX_CUSTOM_CSS_LENGTH / 1024}KB.`));
      return;
    }

    // Use the base class save which handles the upsert loop
    await this._saveSettings();

    // Re-apply theme to the shell so changes take effect immediately
    if (!this._error) {
      const shell = this.closest('velg-simulation-shell');
      if (shell) {
        await themeService.applySimulationTheme(this.simulationId, shell as HTMLElement);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state
        message=${msg('Loading design settings...')}
      ></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel settings-panel--wide">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        ${this._renderPresetSelector()}
        ${this._renderColorSection()}
        ${this._renderTypographySection()}
        ${this._renderCharacterSection()}
        ${this._renderAnimationSection()}
        ${this._renderCustomCSSSection()}
        ${this._renderPreviewSection()}

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            data-testid="design-save-btn"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Design Settings')}
          </button>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Section renderers
  // ---------------------------------------------------------------------------

  private _renderPresetSelector() {
    const labels = getPresetLabels();
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Theme Preset')}</velg-section-header>
        <div class="preset-bar">
          <select
            class="preset-bar__select"
            data-testid="preset-dropdown"
            .value=${this._selectedPreset}
            @change=${this._handlePresetChange}
          >
            <option value="custom">${msg('Custom')}</option>
            ${PRESET_NAMES.map(
              (name) =>
                html`<option value=${name} ?selected=${this._selectedPreset === name}>
                  ${labels[name]}
                </option>`,
            )}
          </select>
          <button
            class="preset-bar__btn"
            data-testid="apply-preset-btn"
            @click=${this._applyPreset}
            ?disabled=${this._selectedPreset === 'custom'}
          >
            ${msg('Apply Preset')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderColorSection() {
    const fields = getColorFields();
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Colors')}</velg-section-header>
        <div class="color-grid">
          ${fields.map(
            (cf) => html`
              <div class="color-field">
                <div class="color-field__label-row">
                  <label class="color-field__label" for="design-${cf.key}">${cf.label}</label>
                  ${renderInfoBubble(cf.info)}
                </div>
                <div class="color-field__input-row">
                  <input
                    class="color-field__picker"
                    type="color"
                    data-testid="${cf.key.replace(/_/g, '-')}-picker"
                    .value=${this._getColorValue(cf.key, cf.defaultValue)}
                    @input=${(e: Event) => this._handleInput(cf.key, e)}
                  />
                  <input
                    class="color-field__hex"
                    id="design-${cf.key}"
                    type="text"
                    data-testid="${cf.key.replace(/_/g, '-')}-hex"
                    maxlength="7"
                    placeholder=${cf.defaultValue}
                    .value=${this._values[cf.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(cf.key, e)}
                  />
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderTypographySection() {
    const fields = getFontFields();
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Typography')}</velg-section-header>
        <div class="font-grid">
          ${fields.map(
            (ff) => html`
              <div class="form__group">
                <div class="form__label-row">
                  <label class="form__label" for="design-${ff.key}">${ff.label}</label>
                  ${renderInfoBubble(ff.info)}
                </div>
                <input
                  class="form__input"
                  id="design-${ff.key}"
                  type=${ff.type}
                  data-testid="${ff.key.replace(/_/g, '-')}-input"
                  placeholder=${ff.placeholder}
                  .value=${this._values[ff.key] ?? ''}
                  @input=${(e: Event) => this._handleInput(ff.key, e)}
                />
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderCharacterSection() {
    const fields = getCharacterFields();
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Character')}</velg-section-header>
        <div class="character-grid">
          ${fields.map((f) => this._renderCharacterField(f))}
        </div>
      </div>
    `;
  }

  private _renderAnimationSection() {
    const fields = getAnimationFields();
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Animation')}</velg-section-header>
        <div class="character-grid">
          ${fields.map((f) => this._renderCharacterField(f))}
        </div>
      </div>
    `;
  }

  private _renderCharacterField(f: CharacterFieldDef) {
    return html`
      <div class="form__group">
        <div class="form__label-row">
          <label class="form__label" for="design-${f.key}">${f.label}</label>
          ${renderInfoBubble(f.info)}
        </div>
        ${
          f.inputType === 'select'
            ? html`
              <select
                class="form__select"
                id="design-${f.key}"
                data-testid="${f.key.replace(/_/g, '-')}-select"
                @change=${(e: Event) => this._handleInput(f.key, e)}
              >
                ${f.options?.map(
                  (opt) => html`
                    <option
                      value=${opt.value}
                      ?selected=${(this._values[f.key] ?? '') === opt.value}
                    >
                      ${opt.label}
                    </option>
                  `,
                )}
              </select>
            `
            : f.inputType === 'color'
              ? html`
                <div class="color-field__input-row">
                  <input
                    class="color-field__picker"
                    type="color"
                    .value=${this._values[f.key] || f.defaultValue || '#000000'}
                    @input=${(e: Event) => this._handleInput(f.key, e)}
                  />
                  <input
                    class="color-field__hex"
                    id="design-${f.key}"
                    type="text"
                    maxlength="7"
                    placeholder=${f.defaultValue ?? '#000000'}
                    .value=${this._values[f.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(f.key, e)}
                  />
                </div>
              `
              : f.inputType === 'range'
                ? html`
                  <div class="range-row">
                    <input
                      class="range-row__input"
                      id="design-${f.key}"
                      data-testid="${f.key.replace(/_/g, '-')}-input"
                      type="range"
                      min=${f.min ?? '0'}
                      max=${f.max ?? '1'}
                      step=${f.step ?? '0.1'}
                      .value=${this._values[f.key] || f.defaultValue || '1'}
                      @input=${(e: Event) => this._handleInput(f.key, e)}
                    />
                    <span class="range-row__value">
                      ${this._values[f.key] || f.defaultValue || '1'}x
                    </span>
                  </div>
                `
                : html`
                  <input
                    class="form__input"
                    id="design-${f.key}"
                    data-testid="${f.key.replace(/_/g, '-')}-input"
                    type="text"
                    placeholder=${f.placeholder ?? ''}
                    .value=${this._values[f.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(f.key, e)}
                  />
                `
        }
      </div>
    `;
  }

  private _renderCustomCSSSection() {
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Custom CSS')}</velg-section-header>
        <div class="form__group">
          <div class="form__label-row">
            <label class="form__label" for="design-custom-css">${msg('Additional Styles')}</label>
            ${renderInfoBubble(
              msg(
                'Raw CSS injected into the page. Use for advanced overrides beyond the token system.',
              ),
            )}
          </div>
          <textarea
            class="form__textarea"
            id="design-custom-css"
            placeholder="/* Custom CSS overrides */&#10;velg-simulation-shell {&#10;  /* ... */&#10;}"
            .value=${this._values.custom_css ?? ''}
            @input=${(e: Event) => this._handleInput('custom_css', e)}
          ></textarea>
          <span class="form__hint">
            ${msg(str`Max ${MAX_CUSTOM_CSS_LENGTH / 1024}KB.`)}
            ${msg(str`Current: ${((this._values.custom_css ?? '').length / 1024).toFixed(1)}KB`)}
          </span>
        </div>
      </div>
    `;
  }

  private _renderPreviewSection() {
    return html`
      <div class="section">
        <velg-section-header variant="large">${msg('Live Preview')}</velg-section-header>
        ${this._renderPreview()}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  private _renderPreview() {
    const bg = this._getColorValue('color_background', '#ffffff');
    const surface = this._getColorValue('color_surface', '#f5f5f5');
    const surfaceSunken = this._getColorValue('color_surface_sunken', '#e5e5e5');
    const text = this._getColorValue('color_text', '#0a0a0a');
    const textSecondary = this._getColorValue('color_text_secondary', '#525252');
    const textMuted = this._getColorValue('color_text_muted', '#a3a3a3');
    const primary = this._getColorValue('color_primary', '#000000');
    const secondary = this._getColorValue('color_secondary', '#3b82f6');
    const accent = this._getColorValue('color_accent', '#f59e0b');
    const border = this._getColorValue('color_border', '#000000');
    const borderLight = this._getColorValue('color_border_light', '#d4d4d4');
    const danger = this._getColorValue('color_danger', '#dc2626');
    const success = this._getColorValue('color_success', '#16a34a');
    const textInverse = this._getColorValue('text_inverse', '#ffffff');
    const fontHeading = this._values.font_heading || "'Courier New', monospace";
    const fontBody = this._values.font_body || 'system-ui, sans-serif';
    const baseFontSize = this._values.font_base_size || '16px';
    const headingWeight = this._values.heading_weight || '900';
    const headingTransform = this._values.heading_transform || 'uppercase';
    const headingTracking = this._values.heading_tracking || '1px';
    const borderRadius = this._values.border_radius || '0';
    const borderWidth = this._values.border_width || '3px';
    const shadowStyle = this._values.shadow_style || 'offset';
    const shadowColor = this._values.shadow_color || '#000000';

    const shadow = this._computePreviewShadow(shadowStyle, shadowColor, 'md');

    return html`
      <div class="preview">
        <h3 class="preview__title">${msg('Theme Preview')}</h3>
        <div
          class="preview__content"
          style="
            background: ${bg};
            color: ${text};
            border-color: ${border};
            border-width: ${borderWidth};
            border-radius: ${borderRadius};
            font-family: ${fontBody};
            font-size: ${baseFontSize};
          "
        >
          <h4
            class="preview__heading"
            style="
              font-family: ${fontHeading};
              color: ${text};
              font-weight: ${headingWeight};
              text-transform: ${headingTransform};
              letter-spacing: ${headingTracking};
            "
          >
            ${msg('Simulation Title')}
          </h4>
          <p class="preview__text">
            ${msg('This is how body text will appear with the selected colors and fonts.')}
          </p>
          <p class="preview__text" style="color: ${textSecondary};">
            ${msg('This is secondary text.')}
          </p>
          <p class="preview__text" style="color: ${textMuted};">
            ${msg('This is muted/disabled text.')}
          </p>

          <div class="preview__swatch-row">
            ${[
              { c: primary, t: msg('Primary') },
              { c: secondary, t: msg('Secondary') },
              { c: accent, t: msg('Accent') },
              { c: surface, t: msg('Surface') },
              { c: surfaceSunken, t: msg('Sunken') },
              { c: danger, t: msg('Danger') },
              { c: success, t: msg('Success') },
            ].map(
              ({ c, t }) => html`
                <div
                  class="preview__swatch"
                  style="background: ${c}; border-radius: ${borderRadius};"
                  title=${t}
                ></div>
              `,
            )}
          </div>

          <div class="preview__btn-row">
            <div
              class="preview__btn"
              style="
                background: ${primary};
                color: ${textInverse};
                border: ${borderWidth} solid ${primary};
                border-radius: ${borderRadius};
                box-shadow: ${shadow};
              "
            >
              ${msg('Primary Button')}
            </div>
            <div
              class="preview__btn"
              style="
                background: transparent;
                color: ${text};
                border: ${borderWidth} solid ${border};
                border-radius: ${borderRadius};
                box-shadow: ${shadow};
              "
            >
              ${msg('Secondary')}
            </div>
          </div>

          <div
            class="preview__card"
            style="
              background: ${surface};
              border: ${borderWidth} solid ${border};
              border-radius: ${borderRadius};
              box-shadow: ${shadow};
            "
          >
            <h5
              class="preview__card-title"
              style="
                font-family: ${fontHeading};
                font-weight: ${headingWeight};
                text-transform: ${headingTransform};
                letter-spacing: ${headingTracking};
              "
            >
              ${msg('Card Title')}
            </h5>
            <p class="preview__card-text" style="color: ${textSecondary};">
              ${msg('A sample card showing how surfaces, borders, and shadows combine.')}
            </p>
          </div>

          <input
            class="preview__input"
            style="
              background: ${surfaceSunken};
              color: ${text};
              border: 1px solid ${borderLight};
              border-radius: ${borderRadius};
              font-family: ${fontBody};
            "
            type="text"
            placeholder=${msg('Input field')}
            readonly
          />
        </div>
      </div>
    `;
  }

  private _computePreviewShadow(style: string, color: string, size: 'sm' | 'md' | 'lg'): string {
    const scales = {
      sm: { offset: 3, blur: 8, glow: 6 },
      md: { offset: 4, blur: 12, glow: 12 },
      lg: { offset: 6, blur: 16, glow: 16 },
    };
    const s = scales[size];

    switch (style) {
      case 'offset':
        return `${s.offset}px ${s.offset}px 0 ${color}`;
      case 'blur':
        return `0 ${Math.round(s.blur * 0.3)}px ${s.blur}px ${color}40`;
      case 'glow':
        return `0 0 ${s.glow}px ${color}60, 0 0 ${Math.round(s.glow * 0.3)}px ${color}30`;
      case 'none':
        return 'none';
      default:
        return `${s.offset}px ${s.offset}px 0 ${color}`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-design-settings-panel': VelgDesignSettingsPanel;
  }
}
