import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type { PlatformSetting } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

interface ModelSettingMeta {
  label: string;
  description: string;
}

const MODEL_KEYS = [
  'model_default',
  'model_fallback',
  'model_research',
  'model_forge',
] as const;

type ModelSettingKey = (typeof MODEL_KEYS)[number];

function getModelMeta(): Record<ModelSettingKey, ModelSettingMeta> {
  return {
    model_default: {
      label: msg('Default Model'),
      description: msg('Primary text model for simulation generation. Used when no purpose-specific or simulation-level override is set.'),
    },
    model_fallback: {
      label: msg('Fallback Model'),
      description: msg('Last-resort model when the default is unavailable. Choose a cheap or free model to ensure generation never fails.'),
    },
    model_research: {
      label: msg('Research Model'),
      description: msg('Cheaper model for research and analysis tasks (Astrolabe, anchor generation). Trades quality for cost savings.'),
    },
    model_forge: {
      label: msg('Forge Model'),
      description: msg('Text model for the Forge pipeline: lore generation, theme design, entity translation, and chunk drafting.'),
    },
  };
}

const MODEL_OPTIONS = [
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
  { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 (Free)' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
];

const DEFAULTS: Record<ModelSettingKey, string> = {
  model_default: 'anthropic/claude-sonnet-4-6',
  model_fallback: 'deepseek/deepseek-r1-0528:free',
  model_research: 'google/gemini-2.0-flash-001',
  model_forge: 'anthropic/claude-sonnet-4-6',
};

@localized()
@customElement('velg-admin-models-tab')
export class VelgAdminModelsTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .model-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .model-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .model-card:hover {
      border-color: var(--color-text-muted);
    }

    .model-card--dirty {
      border-color: var(--color-warning);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-warning) 50%, transparent);
    }

    .model-card__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2) 0;
    }

    .model-card__description {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0 0 var(--space-3) 0;
    }

    .model-card__select-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }

    .model-card__select {
      flex: 1;
      min-width: 0;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-background);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      border-radius: 0;
      cursor: pointer;
      transition: border-color 0.2s ease;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: var(--space-8);
    }

    .model-card__select:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .model-card__select option {
      background: var(--color-background);
      color: var(--color-text-primary);
    }

    .model-card__custom-toggle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      padding: var(--space-2);
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color 0.2s ease, border-color 0.2s ease;
      white-space: nowrap;
    }

    .model-card__custom-toggle:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    .model-card__custom-toggle--active {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
    }

    .model-card__custom-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .model-card__custom-input {
      flex: 1;
      min-width: 0;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-background);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      border-radius: 0;
      transition: border-color 0.2s ease;
    }

    .model-card__custom-input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .model-card__custom-input::placeholder {
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .model-card__default {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: var(--space-2) 0 0 0;
    }

    /* --- Actions --- */

    .actions {
      display: flex;
      gap: var(--space-3);
    }

    .btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-5);
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.15s ease,
        box-shadow 0.2s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .btn--save {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border: 1px solid var(--color-danger);
    }

    .btn--save:hover:not(:disabled) {
      background: var(--color-danger-hover);
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    .btn--reset {
      background: transparent;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .btn--reset:hover:not(:disabled) {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
    }

    .loading {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
    }

    @media (max-width: 768px) {
      .model-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _settings: PlatformSetting[] = [];
  @state() private _editValues: Record<string, string> = {};
  @state() private _customMode: Set<string> = new Set();
  @state() private _loading = true;
  @state() private _saving = false;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    const result = await adminApi.listSettings();
    if (result.success && result.data) {
      const allSettings = result.data as PlatformSetting[];
      this._settings = allSettings.filter((s) =>
        (MODEL_KEYS as readonly string[]).includes(s.setting_key),
      );
      this._editValues = {};
      this._customMode = new Set();
      for (const s of this._settings) {
        const val = String(s.setting_value).replace(/"/g, '');
        this._editValues[s.setting_key] = val;
        // If current value isn't in the preset list, enable custom mode
        if (!MODEL_OPTIONS.some((o) => o.id === val)) {
          this._customMode.add(s.setting_key);
        }
      }
    }
    this._loading = false;
  }

  private _isDirty(key: string): boolean {
    const original = this._settings.find((s) => s.setting_key === key);
    if (!original) return false;
    const origVal = String(original.setting_value).replace(/"/g, '');
    return this._editValues[key] !== origVal;
  }

  private get _hasDirty(): boolean {
    return Object.keys(this._editValues).some((key) => this._isDirty(key));
  }

  private _toggleCustom(key: string): void {
    const next = new Set(this._customMode);
    if (next.has(key)) {
      next.delete(key);
      // When switching back to preset, reset to the first matching option or default
      const currentVal = this._editValues[key];
      if (!MODEL_OPTIONS.some((o) => o.id === currentVal)) {
        this._editValues = {
          ...this._editValues,
          [key]: DEFAULTS[key as ModelSettingKey] ?? MODEL_OPTIONS[0].id,
        };
      }
    } else {
      next.add(key);
    }
    this._customMode = next;
  }

  private async _saveAll(): Promise<void> {
    this._saving = true;
    let successCount = 0;
    let errorCount = 0;

    for (const key of Object.keys(this._editValues)) {
      if (!this._isDirty(key)) continue;
      const newVal = this._editValues[key];
      if (!newVal) {
        VelgToast.error(msg(str`Empty value for ${key}.`));
        errorCount++;
        continue;
      }
      const result = await adminApi.updateSetting(key, newVal);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    }

    if (successCount > 0) {
      VelgToast.success(msg(str`${successCount} model settings saved.`));
    }
    if (errorCount > 0) {
      VelgToast.error(msg(str`${errorCount} settings failed to save.`));
    }

    await this._loadSettings();
    this._saving = false;
  }

  private _resetToDefaults(): void {
    this._editValues = { ...this._editValues };
    this._customMode = new Set();
    for (const key of MODEL_KEYS) {
      this._editValues[key] = DEFAULTS[key];
    }
    this.requestUpdate();
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading model settings...')}</div>`;
    }

    const meta = getModelMeta();

    return html`
      <div class="model-grid">
        ${MODEL_KEYS.map((key) => {
          const setting = this._settings.find((s) => s.setting_key === key);
          if (!setting) return nothing;
          const m = meta[key];
          const isDirty = this._isDirty(key);
          const isCustom = this._customMode.has(key);
          const currentVal = this._editValues[key] ?? '';
          const defaultVal = DEFAULTS[key];

          return html`
            <div class="model-card ${isDirty ? 'model-card--dirty' : ''}">
              <p class="model-card__label">${m.label}</p>
              <p class="model-card__description">${m.description}</p>
              <div class="model-card__select-row">
                ${isCustom
                  ? nothing
                  : html`
                      <select
                        class="model-card__select"
                        .value=${currentVal}
                        @change=${(e: Event) => {
                          this._editValues = {
                            ...this._editValues,
                            [key]: (e.target as HTMLSelectElement).value,
                          };
                        }}
                      >
                        ${MODEL_OPTIONS.map(
                          (opt) => html`
                            <option value=${opt.id} ?selected=${opt.id === currentVal}>
                              ${opt.label}
                            </option>
                          `,
                        )}
                      </select>
                    `}
                <button
                  class="model-card__custom-toggle ${isCustom ? 'model-card__custom-toggle--active' : ''}"
                  @click=${() => this._toggleCustom(key)}
                  title=${isCustom ? msg('Use preset') : msg('Custom model ID')}
                >${isCustom ? msg('Preset') : msg('Custom')}</button>
              </div>
              ${isCustom
                ? html`
                    <div class="model-card__custom-row">
                      <input
                        type="text"
                        class="model-card__custom-input"
                        placeholder=${msg('e.g. vendor/model-name')}
                        .value=${currentVal}
                        @input=${(e: Event) => {
                          this._editValues = {
                            ...this._editValues,
                            [key]: (e.target as HTMLInputElement).value,
                          };
                        }}
                      />
                    </div>
                  `
                : nothing}
              <p class="model-card__default">${msg(str`Default: ${defaultVal}`)}</p>
            </div>
          `;
        })}
      </div>

      <div class="actions">
        <button
          class="btn btn--save"
          ?disabled=${!this._hasDirty || this._saving}
          @click=${this._saveAll}
        >${this._saving ? msg('Saving...') : msg('Save Changes')}</button>
        <button
          class="btn btn--reset"
          ?disabled=${this._saving}
          @click=${this._resetToDefaults}
        >${msg('Reset to Defaults')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-models-tab': VelgAdminModelsTab;
  }
}
