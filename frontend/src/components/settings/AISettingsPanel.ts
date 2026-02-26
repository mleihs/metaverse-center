import { localized, msg } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import '../shared/VelgSectionHeader.js';
import { settingsStyles } from '../shared/settings-styles.js';

/** The 8 AI model purpose keys used in the settings. */
function getModelPurposes() {
  return [
    { key: 'model_agent_description', label: msg('Agent Description') },
    { key: 'model_agent_reactions', label: msg('Agent Reactions') },
    { key: 'model_building_description', label: msg('Building Description') },
    { key: 'model_event_generation', label: msg('Event Generation') },
    { key: 'model_chat_response', label: msg('Chat Response') },
    { key: 'model_news_transformation', label: msg('News Transformation') },
    { key: 'model_social_trends', label: msg('Social Trends') },
    { key: 'model_fallback', label: msg('Fallback Model') },
  ];
}

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

/** Image model options. */
function getImageModelOptions() {
  return [
    { value: 'black-forest-labs/flux-dev', label: msg('Flux Dev (recommended)') },
    { value: 'black-forest-labs/flux-schnell', label: msg('Flux Schnell (fast)') },
    { value: 'black-forest-labs/flux-1.1-pro', label: msg('Flux 1.1 Pro (highest quality)') },
    {
      value: 'black-forest-labs/flux-dev-lora',
      label: msg('Flux Dev + LoRA (custom style)'),
    },
    {
      value:
        'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
      label: msg('Stable Diffusion 1.5 (legacy)'),
    },
  ];
}

/** Image model purpose keys. */
function getImageModelPurposes() {
  return [
    { key: 'image_model_agent_portrait', label: msg('Portrait Model') },
    { key: 'image_model_building_image', label: msg('Building Image Model') },
  ];
}

/** SD-specific params (hidden when Flux is selected). */
function getSdParams() {
  return [
    { key: 'image_width', label: msg('Image Width (px)'), placeholder: '512' },
    { key: 'image_height', label: msg('Image Height (px)'), placeholder: '768' },
    { key: 'image_scheduler', label: msg('Scheduler'), placeholder: 'K_EULER', type: 'text' },
  ];
}

/** Flux-specific params (hidden when SD is selected). */
function getFluxParams() {
  return [
    { key: 'image_aspect_ratio', label: msg('Aspect Ratio'), placeholder: '3:4', type: 'text' },
    {
      key: 'image_output_quality',
      label: msg('Output Quality'),
      placeholder: '90',
      min: '1',
      max: '100',
    },
  ];
}

/** Shared image params (shown for both model families). */
function getSharedImageParams() {
  return [
    { key: 'image_guidance_scale', label: msg('Guidance Scale'), placeholder: '7.5' },
    { key: 'image_num_inference_steps', label: msg('Inference Steps'), placeholder: '50' },
  ];
}

/** Default generation params. */
function getGenerationParams() {
  return [
    { key: 'default_temperature', label: msg('Default Temperature'), placeholder: '0.7' },
    { key: 'default_max_tokens', label: msg('Default Max Tokens'), placeholder: '2048' },
  ];
}

@localized()
@customElement('velg-ai-settings-panel')
export class VelgAISettingsPanel extends BaseSettingsPanel {
  static styles = [
    settingsStyles,
    css`
      .settings-form__textarea {
        min-height: 80px;
        resize: vertical;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        line-height: 1.5;
      }
    `,
  ];

  protected get category() {
    return 'ai' as const;
  }

  protected get successMessage(): string {
    return msg('AI settings saved successfully.');
  }

  /** Check if any configured image model is Flux-based. */
  private get _hasFluxModel(): boolean {
    for (const purpose of getImageModelPurposes()) {
      const val = this._values[purpose.key] ?? '';
      if (val.includes('flux')) return true;
    }
    return false;
  }

  /** Check if any configured image model is SD-based. */
  private get _hasSdModel(): boolean {
    for (const purpose of getImageModelPurposes()) {
      const val = this._values[purpose.key] ?? '';
      if (!val || val.includes('stability-ai')) return true;
    }
    return false;
  }

  /** Check if any configured image model is a LoRA model. */
  private get _hasLoraModel(): boolean {
    for (const purpose of getImageModelPurposes()) {
      const val = this._values[purpose.key] ?? '';
      if (val.includes('lora')) return true;
    }
    return false;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading AI settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel settings-panel--wide">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <!-- Text Models -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Text Models')}</velg-section-header>
          <p class="settings-section__subtitle">${msg('Select a model for each generation purpose')}</p>
          <div class="settings-form-grid">
            ${getModelPurposes().map(
              (mp) => html`
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-${mp.key}">${mp.label}</label>
                  <select
                    class="settings-form__select settings-form__select--sm"
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

        <!-- Image Model -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Image Model')}</velg-section-header>
          <p class="settings-section__subtitle">${msg('Select an image generation model for each purpose')}</p>
          <div class="settings-form-grid">
            ${getImageModelPurposes().map(
              (purpose) => html`
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-${purpose.key}">${purpose.label}</label>
                  <select
                    class="settings-form__select settings-form__select--sm"
                    id="ai-${purpose.key}"
                    .value=${this._values[purpose.key] ?? ''}
                    @change=${(e: Event) => this._handleInput(purpose.key, e)}
                  >
                    <option value="">${msg('-- Default (SD 1.5) --')}</option>
                    ${getImageModelOptions().map(
                      (opt) => html`
                        <option value=${opt.value} ?selected=${this._values[purpose.key] === opt.value}>
                          ${opt.label}
                        </option>
                      `,
                    )}
                  </select>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- Image Generation Parameters -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Image Generation')}</velg-section-header>
          <div class="settings-form-grid settings-form-grid--narrow">
            <!-- Shared params (both model families) -->
            ${getSharedImageParams().map(
              (param) => html`
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-${param.key}">${param.label}</label>
                  <input
                    class="settings-form__input settings-form__input--sm"
                    id="ai-${param.key}"
                    type="number"
                    step="0.5"
                    placeholder=${param.placeholder}
                    .value=${this._values[param.key] ?? ''}
                    @input=${(e: Event) => this._handleInput(param.key, e)}
                  />
                </div>
              `,
            )}

            <!-- SD-specific params -->
            ${
              this._hasSdModel
                ? getSdParams().map(
                    (param) => html`
                    <div class="settings-form__group">
                      <label class="settings-form__label settings-form__label--xs" for="ai-${param.key}">${param.label}</label>
                      <input
                        class="settings-form__input settings-form__input--sm"
                        id="ai-${param.key}"
                        type=${param.type ?? 'number'}
                        placeholder=${param.placeholder}
                        .value=${this._values[param.key] ?? ''}
                        @input=${(e: Event) => this._handleInput(param.key, e)}
                      />
                    </div>
                  `,
                  )
                : nothing
            }

            <!-- Flux-specific params -->
            ${
              this._hasFluxModel
                ? getFluxParams().map(
                    (param) => html`
                    <div class="settings-form__group">
                      <label class="settings-form__label settings-form__label--xs" for="ai-${param.key}">${param.label}</label>
                      <input
                        class="settings-form__input settings-form__input--sm"
                        id="ai-${param.key}"
                        type=${param.type ?? 'number'}
                        placeholder=${param.placeholder}
                        min=${param.min ?? ''}
                        max=${param.max ?? ''}
                        .value=${this._values[param.key] ?? ''}
                        @input=${(e: Event) => this._handleInput(param.key, e)}
                      />
                    </div>
                  `,
                  )
                : nothing
            }
          </div>
        </div>

        <!-- Style Prompts -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Style Prompts')}</velg-section-header>
          <p class="settings-section__help">
            ${msg('Style keywords appended to every image generation prompt. Leave empty to use defaults.')}
          </p>
          <div class="settings-form-grid">
            <div class="settings-form__group settings-form__group--full">
              <label class="settings-form__label settings-form__label--xs" for="ai-style-portrait">
                ${msg('Portrait Style Prompt')}
              </label>
              <textarea
                class="settings-form__textarea"
                id="ai-style-portrait"
                placeholder=${msg('photorealistic portrait photograph, cinematic lighting, shallow depth of field, single subject, high detail')}
                .value=${this._values.image_style_prompt_portrait ?? ''}
                @input=${(e: Event) => this._handleInput('image_style_prompt_portrait', e)}
              ></textarea>
            </div>
            <div class="settings-form__group settings-form__group--full">
              <label class="settings-form__label settings-form__label--xs" for="ai-style-building">
                ${msg('Building Style Prompt')}
              </label>
              <textarea
                class="settings-form__textarea"
                id="ai-style-building"
                placeholder=${msg('architectural photograph, cinematic composition, photorealistic, high detail, dramatic lighting')}
                .value=${this._values.image_style_prompt_building ?? ''}
                @input=${(e: Event) => this._handleInput('image_style_prompt_building', e)}
              ></textarea>
            </div>
          </div>
        </div>

        <!-- LoRA (conditional) -->
        ${
          this._hasLoraModel
            ? html`
            <div class="settings-section">
              <velg-section-header variant="large">${msg('Custom Style LoRA')}</velg-section-header>
              <p class="settings-section__help">
                ${msg('LoRA URL for custom fine-tuned styles. Only used with Flux Dev + LoRA model.')}
              </p>
              <div class="settings-form-grid">
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-lora-url">${msg('LoRA URL')}</label>
                  <input
                    class="settings-form__input settings-form__input--sm"
                    id="ai-lora-url"
                    type="text"
                    placeholder="https://replicate.delivery/..."
                    .value=${this._values.image_lora_url ?? ''}
                    @input=${(e: Event) => this._handleInput('image_lora_url', e)}
                  />
                </div>
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-lora-scale">${msg('LoRA Scale')}</label>
                  <input
                    class="settings-form__input settings-form__input--sm"
                    id="ai-lora-scale"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="0.85"
                    .value=${this._values.image_lora_scale ?? ''}
                    @input=${(e: Event) => this._handleInput('image_lora_scale', e)}
                  />
                </div>
              </div>
            </div>
          `
            : nothing
        }

        <!-- Generation Defaults -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Generation Defaults')}</velg-section-header>
          <div class="settings-form-grid settings-form-grid--narrow">
            ${getGenerationParams().map(
              (param) => html`
                <div class="settings-form__group">
                  <label class="settings-form__label settings-form__label--xs" for="ai-${param.key}">${param.label}</label>
                  <input
                    class="settings-form__input settings-form__input--sm"
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

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
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
