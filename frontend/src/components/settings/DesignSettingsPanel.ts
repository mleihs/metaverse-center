import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import type { SimulationSetting } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';

const COLOR_FIELDS = [
  { key: 'color_primary', label: msg('Primary'), defaultValue: '#e63946' },
  { key: 'color_secondary', label: msg('Secondary'), defaultValue: '#457b9d' },
  { key: 'color_accent', label: msg('Accent'), defaultValue: '#f4a261' },
  { key: 'color_background', label: msg('Background'), defaultValue: '#0a0a0a' },
  { key: 'color_surface', label: msg('Surface'), defaultValue: '#141414' },
  { key: 'color_text', label: msg('Text'), defaultValue: '#f5f5f5' },
  { key: 'color_text_muted', label: msg('Text Muted'), defaultValue: '#737373' },
  { key: 'color_border', label: msg('Border'), defaultValue: '#262626' },
  { key: 'color_error', label: msg('Error'), defaultValue: '#ef4444' },
  { key: 'color_success', label: msg('Success'), defaultValue: '#22c55e' },
  { key: 'color_warning', label: msg('Warning'), defaultValue: '#eab308' },
  { key: 'color_primary_hover', label: msg('Primary Hover'), defaultValue: '#c62c39' },
] as const;

const FONT_FIELDS = [
  { key: 'font_family', label: msg('Font Family'), placeholder: 'Inter, sans-serif' },
  { key: 'font_heading', label: msg('Heading Font'), placeholder: 'Space Grotesk, sans-serif' },
  { key: 'font_base_size', label: msg('Base Font Size (px)'), placeholder: '16' },
] as const;

const MAX_CUSTOM_CSS_LENGTH = 10240; // 10KB

@localized()
@customElement('velg-design-settings-panel')
export class VelgDesignSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

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

    .form__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .form__input {
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

    .form__input:focus {
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
      padding: var(--space-4);
      border: 2px solid;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .preview__heading {
      font-size: var(--text-lg);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    .preview__text {
      font-size: var(--text-sm);
      line-height: 1.5;
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
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .preview__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      border: 2px solid;
      cursor: default;
      width: fit-content;
    }

    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: var(--border-default);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn--primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .panel__error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-danger);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _values: Record<string, string> = {};
  @state() private _originalValues: Record<string, string> = {};
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error: string | null = null;

  private get _hasChanges(): boolean {
    const keys = new Set([...Object.keys(this._values), ...Object.keys(this._originalValues)]);
    for (const key of keys) {
      if ((this._values[key] ?? '') !== (this._originalValues[key] ?? '')) {
        return true;
      }
    }
    return false;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadSettings();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const prevValues = changedProperties.get('_values') as Record<string, string> | undefined;
    const prevOriginal = changedProperties.get('_originalValues') as
      | Record<string, string>
      | undefined;
    if (prevValues !== undefined || prevOriginal !== undefined) {
      this.dispatchEvent(
        new CustomEvent('unsaved-change', {
          detail: this._hasChanges,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private async _loadSettings(): Promise<void> {
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
      } else {
        this._error = response.error?.message ?? msg('Failed to load design settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this._values = { ...this._values, [key]: target.value };
  }

  private _getColorValue(key: string, defaultValue: string): string {
    return this._values[key] || defaultValue;
  }

  private async _handleSave(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

    // Validate custom CSS length
    const customCss = this._values.custom_css ?? '';
    if (customCss.length > MAX_CUSTOM_CSS_LENGTH) {
      VelgToast.warning(msg(str`Custom CSS exceeds maximum of ${MAX_CUSTOM_CSS_LENGTH / 1024}KB.`));
      return;
    }

    this._saving = true;
    this._error = null;

    try {
      const changedKeys: string[] = [];
      const allKeys = new Set([...Object.keys(this._values), ...Object.keys(this._originalValues)]);

      for (const key of allKeys) {
        if ((this._values[key] ?? '') !== (this._originalValues[key] ?? '')) {
          changedKeys.push(key);
        }
      }

      for (const key of changedKeys) {
        const value = this._values[key] ?? '';

        const response = await settingsApi.upsert(this.simulationId, {
          category: 'design',
          setting_key: key,
          setting_value: value,
        });

        if (!response.success) {
          this._error = response.error?.message ?? msg(str`Failed to save ${key}`);
          VelgToast.error(msg(str`Failed to save ${key}`));
          return;
        }
      }

      this._originalValues = { ...this._values };
      VelgToast.success(msg('Design settings saved successfully.'));
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading design settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        <div class="section">
          <velg-section-header variant="large">${msg('Colors')}</velg-section-header>
          <div class="color-grid">
            ${COLOR_FIELDS.map(
              (cf) => html`
                <div class="color-field">
                  <label class="color-field__label" for="design-${cf.key}">${cf.label}</label>
                  <div class="color-field__input-row">
                    <input
                      class="color-field__picker"
                      type="color"
                      .value=${this._getColorValue(cf.key, cf.defaultValue)}
                      @input=${(e: Event) => this._handleInput(cf.key, e)}
                    />
                    <input
                      class="color-field__hex"
                      id="design-${cf.key}"
                      type="text"
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

        <div class="section">
          <velg-section-header variant="large">${msg('Typography')}</velg-section-header>
          <div class="font-grid">
            ${FONT_FIELDS.map(
              (ff) => html`
                <div class="form__group">
                  <label class="form__label" for="design-${ff.key}">${ff.label}</label>
                  <input
                    class="form__input"
                    id="design-${ff.key}"
                    type=${ff.key === 'font_base_size' ? 'number' : 'text'}
                    placeholder=${ff.placeholder}
                    .value=${this._values[ff.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(ff.key, e)}
                  />
                </div>
              `,
            )}
          </div>
        </div>

        <div class="section">
          <velg-section-header variant="large">${msg('Custom CSS')}</velg-section-header>
          <div class="form__group">
            <label class="form__label" for="design-custom-css">${msg('Additional Styles')}</label>
            <textarea
              class="form__textarea"
              id="design-custom-css"
              placeholder="/* Custom CSS overrides */&#10;:root {&#10;  --my-custom-var: #fff;&#10;}"
              .value=${this._values.custom_css ?? ''}
              @input=${(e: Event) => this._handleInput('custom_css', e)}
            ></textarea>
            <span class="form__hint">
              ${msg(str`Max ${MAX_CUSTOM_CSS_LENGTH / 1024}KB.`)}
              ${msg(str`Current: ${((this._values.custom_css ?? '').length / 1024).toFixed(1)}KB`)}
            </span>
          </div>
        </div>

        <div class="section">
          <velg-section-header variant="large">${msg('Live Preview')}</velg-section-header>
          ${this._renderPreview()}
        </div>

        <div class="panel__footer">
          <button
            class="btn btn--primary"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Design Settings')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderPreview() {
    const bg = this._getColorValue('color_background', '#0a0a0a');
    const surface = this._getColorValue('color_surface', '#141414');
    const text = this._getColorValue('color_text', '#f5f5f5');
    const textMuted = this._getColorValue('color_text_muted', '#737373');
    const primary = this._getColorValue('color_primary', '#e63946');
    const secondary = this._getColorValue('color_secondary', '#457b9d');
    const accent = this._getColorValue('color_accent', '#f4a261');
    const border = this._getColorValue('color_border', '#262626');
    const error = this._getColorValue('color_error', '#ef4444');
    const success = this._getColorValue('color_success', '#22c55e');
    const warning = this._getColorValue('color_warning', '#eab308');
    const primaryHover = this._getColorValue('color_primary_hover', '#c62c39');
    const fontFamily = this._values.font_family || 'Inter, sans-serif';
    const headingFont = this._values.font_heading || 'Space Grotesk, sans-serif';
    const baseFontSize = this._values.font_base_size || '16';

    return html`
      <div class="preview">
        <h3 class="preview__title">${msg('Theme Preview')}</h3>
        <div
          class="preview__content"
          style="
            background: ${bg};
            color: ${text};
            border-color: ${border};
            font-family: ${fontFamily};
            font-size: ${baseFontSize}px;
          "
        >
          <h4
            class="preview__heading"
            style="font-family: ${headingFont}; color: ${text};"
          >
            ${msg('Simulation Title')}
          </h4>
          <p class="preview__text">
            ${msg('This is how body text will appear with the selected colors and fonts.')}
          </p>
          <p class="preview__text preview__text--muted" style="color: ${textMuted};">
            ${msg('This is muted/secondary text.')}
          </p>
          <div class="preview__swatch-row">
            <div class="preview__swatch" style="background: ${primary};" title=${msg('Primary')}></div>
            <div class="preview__swatch" style="background: ${secondary};" title=${msg('Secondary')}></div>
            <div class="preview__swatch" style="background: ${accent};" title=${msg('Accent')}></div>
            <div class="preview__swatch" style="background: ${surface};" title=${msg('Surface')}></div>
            <div class="preview__swatch" style="background: ${error};" title=${msg('Error')}></div>
            <div class="preview__swatch" style="background: ${success};" title=${msg('Success')}></div>
            <div class="preview__swatch" style="background: ${warning};" title=${msg('Warning')}></div>
            <div class="preview__swatch" style="background: ${primaryHover};" title=${msg('Primary Hover')}></div>
          </div>
          <div class="preview__swatch-row">
            <div
              class="preview__btn"
              style="background: ${primary}; color: ${bg}; border-color: ${primary};"
            >
              ${msg('Primary Button')}
            </div>
            <div
              class="preview__btn"
              style="background: transparent; color: ${text}; border-color: ${border};"
            >
              ${msg('Secondary')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-design-settings-panel': VelgDesignSettingsPanel;
  }
}
