import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import type { SimulationSetting } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';

/** The 8 AI model purpose keys used in the settings. */
const MODEL_PURPOSES = [
  { key: 'model_agent_description', label: msg('Agent Description') },
  { key: 'model_agent_reactions', label: msg('Agent Reactions') },
  { key: 'model_building_description', label: msg('Building Description') },
  { key: 'model_event_generation', label: msg('Event Generation') },
  { key: 'model_chat_response', label: msg('Chat Response') },
  { key: 'model_news_transformation', label: msg('News Transformation') },
  { key: 'model_social_trends', label: msg('Social Trends') },
  { key: 'model_fallback', label: msg('Fallback Model') },
] as const;

/** Common text model options. */
const TEXT_MODEL_OPTIONS = [
  'deepseek/deepseek-v3.2',
  'deepseek/deepseek-chat-v3-0324',
  'deepseek/deepseek-r1-0528',
  'deepseek/deepseek-r1-0528:free',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-pro-1.5',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.1-70b-instruct',
  'mistralai/mistral-large',
];

/** Image parameter keys. */
const IMAGE_PARAMS = [
  { key: 'image_width', label: msg('Image Width (px)'), type: 'number', placeholder: '1024' },
  { key: 'image_height', label: msg('Image Height (px)'), type: 'number', placeholder: '1024' },
  { key: 'image_guidance_scale', label: msg('Guidance Scale'), type: 'number', placeholder: '7.5' },
  {
    key: 'image_num_inference_steps',
    label: msg('Inference Steps'),
    type: 'number',
    placeholder: '50',
  },
  {
    key: 'image_scheduler',
    label: msg('Scheduler'),
    type: 'text',
    placeholder: 'DPMSolverMultistep',
  },
] as const;

/** Default generation params. */
const GENERATION_PARAMS = [
  { key: 'default_temperature', label: msg('Default Temperature'), placeholder: '0.7' },
  { key: 'default_max_tokens', label: msg('Default Max Tokens'), placeholder: '2048' },
] as const;

@localized()
@customElement('velg-ai-settings-panel')
export class VelgAISettingsPanel extends LitElement {
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

    .section__subtitle {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .form-grid--narrow {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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

    .form__select {
      cursor: pointer;
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
      const response = await settingsApi.list(this.simulationId, 'ai');

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const vals: Record<string, string> = {};

        for (const setting of settings) {
          vals[setting.setting_key] = String(setting.setting_value ?? '');
        }

        this._values = { ...vals };
        this._originalValues = { ...vals };
      } else {
        this._error = response.error?.message ?? msg('Failed to load AI settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    this._values = { ...this._values, [key]: target.value };
  }

  private async _handleSave(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

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
          category: 'ai',
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
      VelgToast.success(msg('AI settings saved successfully.'));
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
      return html`<velg-loading-state message=${msg('Loading AI settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        <div class="section">
          <velg-section-header variant="large">${msg('Text Models')}</velg-section-header>
          <p class="section__subtitle">${msg('Select a model for each generation purpose')}</p>
          <div class="form-grid">
            ${MODEL_PURPOSES.map(
              (mp) => html`
                <div class="form__group">
                  <label class="form__label" for="ai-${mp.key}">${mp.label}</label>
                  <select
                    class="form__select"
                    id="ai-${mp.key}"
                    .value=${this._values[mp.key] ?? ''}
                    @change=${(e: Event) => this._handleInput(mp.key, e)}
                  >
                    <option value="">${msg('-- Default --')}</option>
                    ${TEXT_MODEL_OPTIONS.map(
                      (model) => html`
                        <option value=${model} ?selected=${this._values[mp.key] === model}>
                          ${model}
                        </option>
                      `,
                    )}
                  </select>
                </div>
              `,
            )}
          </div>
        </div>

        <div class="section">
          <velg-section-header variant="large">${msg('Image Generation')}</velg-section-header>
          <div class="form-grid form-grid--narrow">
            ${IMAGE_PARAMS.map(
              (param) => html`
                <div class="form__group">
                  <label class="form__label" for="ai-${param.key}">${param.label}</label>
                  <input
                    class="form__input"
                    id="ai-${param.key}"
                    type=${param.type}
                    placeholder=${param.placeholder}
                    .value=${this._values[param.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(param.key, e)}
                  />
                </div>
              `,
            )}
          </div>
        </div>

        <div class="section">
          <velg-section-header variant="large">${msg('Generation Defaults')}</velg-section-header>
          <div class="form-grid form-grid--narrow">
            ${GENERATION_PARAMS.map(
              (param) => html`
                <div class="form__group">
                  <label class="form__label" for="ai-${param.key}">${param.label}</label>
                  <input
                    class="form__input"
                    id="ai-${param.key}"
                    type="number"
                    step=${param.key === 'default_temperature' ? '0.1' : '1'}
                    min=${param.key === 'default_temperature' ? '0' : '1'}
                    max=${param.key === 'default_temperature' ? '2' : '32768'}
                    placeholder=${param.placeholder}
                    .value=${this._values[param.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(param.key, e)}
                  />
                </div>
              `,
            )}
          </div>
        </div>

        <div class="panel__footer">
          <button
            class="btn btn--primary"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save AI Settings')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ai-settings-panel': VelgAISettingsPanel;
  }
}
