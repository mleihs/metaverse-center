import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { promptTemplatesApi } from '../../services/api/index.js';
import type { PromptCategory, PromptTemplate, PromptTemplateType } from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';
import '../shared/LoadingState.js';
import '../shared/EmptyState.js';
import '../shared/ErrorState.js';

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  agent_generation: msg('Agent Generation'),
  agent_description: msg('Agent Description'),
  agent_reactions: msg('Agent Reactions'),
  agent_portrait_description: msg('Agent Portrait Desc.'),
  user_agent_description: msg('User Agent Desc.'),
  user_agent_portrait_description: msg('User Agent Portrait'),
  building_generation: msg('Building Generation'),
  building_description: msg('Building Description'),
  building_image_prompt: msg('Building Image Prompt'),
  building_image_generation: msg('Building Image Gen.'),
  social_trends_title: msg('Social Trends Title'),
  social_trends_description: msg('Social Trends Desc.'),
  event_reaction: msg('Event Reaction'),
  news_integration: msg('News Integration'),
  portrait_generation: msg('Portrait Generation'),
  chat_system_prompt: msg('Chat System Prompt'),
  chat_with_memory: msg('Chat with Memory'),
  news_transformation: msg('News Transformation'),
  social_media_transformation: msg('Social Media Transform'),
  social_media_sentiment: msg('Social Media Sentiment'),
  social_media_agent_reaction: msg('Social Media Reaction'),
};

const CATEGORY_LABELS: Record<string, string> = {
  text_generation: msg('Text Generation'),
  image_generation: msg('Image Generation'),
  description_generation: msg('Description'),
  reaction_generation: msg('Reaction'),
  transformation: msg('Transformation'),
  analysis: msg('Analysis'),
};

@localized()
@customElement('velg-prompts-settings-panel')
export class VelgPromptsSettingsPanel extends LitElement {
  static styles = css`
    :host { display: block; }

    .panel { display: flex; flex-direction: column; gap: var(--space-4); }

    .panel__header {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
    }

    .panel__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-lg); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
    }

    .panel__btn {
      display: inline-flex; align-items: center; gap: var(--space-1-5);
      padding: var(--space-2) var(--space-4); font-family: var(--font-brutalist);
      font-weight: var(--font-black); font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); background: var(--color-primary);
      color: var(--color-text-inverse); border: var(--border-default);
      box-shadow: var(--shadow-md); cursor: pointer; transition: all var(--transition-fast);
    }

    .panel__btn:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
    .panel__btn:active { transform: translate(0); box-shadow: var(--shadow-pressed); }

    /* Template list */
    .templates { display: flex; flex-direction: column; gap: var(--space-2); }

    .template {
      display: grid; grid-template-columns: 1fr auto auto;
      align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4);
      background: var(--color-surface-raised); border: var(--border-default);
      transition: all var(--transition-fast); cursor: pointer;
    }

    .template:hover {
      transform: translate(-1px, -1px); box-shadow: var(--shadow-md);
    }

    .template__info { display: flex; flex-direction: column; gap: var(--space-0-5); min-width: 0; }

    .template__name {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-wide); overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }

    .template__meta {
      display: flex; gap: var(--space-2); font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .template__badge {
      display: inline-flex; padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-wide);
      background: var(--color-surface-header); border: var(--border-width-default) solid var(--color-border);
    }

    .template__badge--type { background: var(--color-primary-bg); border-color: var(--color-primary); color: var(--color-primary); }
    .template__badge--category { background: var(--color-info-bg); border-color: var(--color-info); color: var(--color-info); }
    .template__badge--default { background: var(--color-warning-bg); border-color: var(--color-warning); color: var(--color-warning); }
    .template__badge--inactive { background: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger); }

    .template__actions { display: flex; gap: var(--space-1-5); }

    .template__action-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; padding: 0; background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer; color: var(--color-text-secondary); transition: all var(--transition-fast);
    }

    .template__action-btn:hover { background: var(--color-surface-sunken); color: var(--color-text-primary); }
    .template__action-btn--danger:hover { background: var(--color-danger-bg); color: var(--color-danger); border-color: var(--color-danger); }

    /* Edit Modal Form */
    .form { display: flex; flex-direction: column; gap: var(--space-4); }

    .form__group { display: flex; flex-direction: column; gap: var(--space-1-5); }

    .form__label {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-text-secondary);
    }

    .form__label--required::after { content: ' *'; color: var(--color-danger); }

    .form__input,
    .form__select,
    .form__textarea {
      font-family: var(--font-sans); font-size: var(--text-base);
      padding: var(--space-2) var(--space-3); border: var(--border-medium);
      background: var(--color-surface); color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form__input:focus,
    .form__select:focus,
    .form__textarea:focus {
      outline: none; border-color: var(--color-border-focus); box-shadow: var(--ring-focus);
    }

    .form__textarea { resize: vertical; min-height: 120px; font-family: var(--font-mono, monospace); font-size: var(--text-sm); }

    .form__row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .form__row--3 { grid-template-columns: 1fr 1fr 1fr; }

    .form__hint { font-size: var(--text-xs); color: var(--color-text-muted); }

    .form__error {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-wide); color: var(--color-danger);
    }

    .footer { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); }

    .footer__btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: var(--space-2) var(--space-4); font-family: var(--font-brutalist);
      font-weight: var(--font-black); font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); border: var(--border-default);
      box-shadow: var(--shadow-md); cursor: pointer; transition: all var(--transition-fast);
    }

    .footer__btn:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
    .footer__btn:active { transform: translate(0); box-shadow: var(--shadow-pressed); }
    .footer__btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .footer__btn--cancel { background: var(--color-surface-raised); color: var(--color-text-primary); }
    .footer__btn--save { background: var(--color-primary); color: var(--color-text-inverse); }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _templates: PromptTemplate[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _showEditModal = false;
  @state() private _editingTemplate: PromptTemplate | null = null;
  @state() private _saving = false;
  @state() private _formError: string | null = null;

  // Form fields
  @state() private _templateName = '';
  @state() private _templateType: PromptTemplateType = 'agent_generation';
  @state() private _promptCategory: PromptCategory = 'text_generation';
  @state() private _locale = 'de';
  @state() private _promptContent = '';
  @state() private _systemPrompt = '';
  @state() private _description = '';
  @state() private _defaultModel = '';
  @state() private _temperature = 0.7;
  @state() private _maxTokens = 1024;
  @state() private _negativePrompt = '';

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadTemplates();
    }
  }

  private async _loadTemplates(): Promise<void> {
    if (!this.simulationId) return;
    this._loading = true;
    this._error = null;
    try {
      const response = await promptTemplatesApi.list(this.simulationId, { limit: '100' });
      if (response.success && response.data) {
        this._templates = Array.isArray(response.data) ? response.data : [];
      } else {
        this._error = response.error?.message || msg('Failed to load templates');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load templates');
    } finally {
      this._loading = false;
    }
  }

  private _openCreate(): void {
    this._editingTemplate = null;
    this._resetForm();
    this._showEditModal = true;
  }

  private _openEdit(template: PromptTemplate): void {
    this._editingTemplate = template;
    this._templateName = template.template_name;
    this._templateType = template.template_type;
    this._promptCategory = template.prompt_category;
    this._locale = template.locale;
    this._promptContent = template.prompt_content;
    this._systemPrompt = template.system_prompt ?? '';
    this._description = template.description ?? '';
    this._defaultModel = template.default_model ?? '';
    this._temperature = template.temperature;
    this._maxTokens = template.max_tokens;
    this._negativePrompt = template.negative_prompt ?? '';
    this._formError = null;
    this._showEditModal = true;
  }

  private _resetForm(): void {
    this._templateName = '';
    this._templateType = 'agent_generation';
    this._promptCategory = 'text_generation';
    this._locale = 'de';
    this._promptContent = '';
    this._systemPrompt = '';
    this._description = '';
    this._defaultModel = '';
    this._temperature = 0.7;
    this._maxTokens = 1024;
    this._negativePrompt = '';
    this._formError = null;
  }

  private async _handleSave(): Promise<void> {
    if (!this._templateName.trim()) {
      this._formError = msg('Template name is required');
      return;
    }
    if (!this._promptContent.trim()) {
      this._formError = msg('Prompt content is required');
      return;
    }

    this._saving = true;
    this._formError = null;

    const data = {
      template_name: this._templateName.trim(),
      template_type: this._templateType,
      prompt_category: this._promptCategory,
      locale: this._locale,
      prompt_content: this._promptContent,
      system_prompt: this._systemPrompt.trim() || undefined,
      description: this._description.trim() || undefined,
      default_model: this._defaultModel.trim() || undefined,
      temperature: this._temperature,
      max_tokens: this._maxTokens,
      negative_prompt: this._negativePrompt.trim() || undefined,
    };

    try {
      const response = this._editingTemplate
        ? await promptTemplatesApi.update(this.simulationId, this._editingTemplate.id, data)
        : await promptTemplatesApi.create(this.simulationId, data);

      if (response.success) {
        VelgToast.success(
          this._editingTemplate ? msg('Template updated') : msg('Template created'),
        );
        this._showEditModal = false;
        await this._loadTemplates();
      } else {
        this._formError = response.error?.message || msg('Failed to save template');
        VelgToast.error(this._formError);
      }
    } catch (err) {
      this._formError = err instanceof Error ? err.message : msg('Failed to save template');
      VelgToast.error(this._formError);
    } finally {
      this._saving = false;
    }
  }

  private async _handleDelete(template: PromptTemplate): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Deactivate Template'),
      message: msg(str`Are you sure you want to deactivate "${template.template_name}"?`),
      confirmLabel: msg('Deactivate'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await promptTemplatesApi.remove(this.simulationId, template.id);
      if (response.success) {
        VelgToast.success(msg('Template deactivated'));
        await this._loadTemplates();
      } else {
        VelgToast.error(response.error?.message || msg('Failed to deactivate template'));
      }
    } catch (err) {
      VelgToast.error(err instanceof Error ? err.message : msg('Failed to deactivate template'));
    }
  }

  private _renderTemplateList() {
    if (this._templates.length === 0) {
      return html`<velg-empty-state
        message=${msg('No prompt templates configured')}
        actionLabel=${msg('Create Template')}
        @action=${this._openCreate}
      ></velg-empty-state>`;
    }

    return html`
      <div class="templates">
        ${this._templates.map(
          (t) => html`
            <div class="template" @click=${() => this._openEdit(t)}>
              <div class="template__info">
                <div class="template__name">${t.template_name}</div>
                <div class="template__meta">
                  <span class="template__badge template__badge--type">
                    ${TEMPLATE_TYPE_LABELS[t.template_type] ?? t.template_type}
                  </span>
                  <span class="template__badge template__badge--category">
                    ${CATEGORY_LABELS[t.prompt_category] ?? t.prompt_category}
                  </span>
                  ${t.is_system_default ? html`<span class="template__badge template__badge--default">${msg('Default')}</span>` : nothing}
                  ${!t.is_active ? html`<span class="template__badge template__badge--inactive">${msg('Inactive')}</span>` : nothing}
                </div>
              </div>
              <span class="template__badge">${t.locale}</span>
              <div class="template__actions">
                <button
                  class="template__action-btn template__action-btn--danger"
                  title=${msg('Deactivate')}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this._handleDelete(t);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>
                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/>
                    <path d="M9 7v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
                  </svg>
                </button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderEditModal() {
    const isEdit = this._editingTemplate !== null;
    const templateTypes = Object.keys(TEMPLATE_TYPE_LABELS) as PromptTemplateType[];
    const categories = Object.keys(CATEGORY_LABELS) as PromptCategory[];

    return html`
      <velg-base-modal
        ?open=${this._showEditModal}
        @modal-close=${() => {
          this._showEditModal = false;
        }}
      >
        <span slot="header">${isEdit ? msg('Edit Template') : msg('Create Template')}</span>

        <div class="form">
          <div class="form__row">
            <div class="form__group">
              <label class="form__label form__label--required">${msg('Template Name')}</label>
              <input class="form__input" type="text" .value=${this._templateName}
                @input=${(e: InputEvent) => {
                  this._templateName = (e.target as HTMLInputElement).value;
                }}
                placeholder=${msg('e.g. Dystopian News Transform')}
              />
            </div>
            <div class="form__group">
              <label class="form__label">${msg('Locale')}</label>
              <select class="form__select" .value=${this._locale}
                @change=${(e: Event) => {
                  this._locale = (e.target as HTMLSelectElement).value;
                }}>
                <option value="de">${msg('Deutsch')}</option>
                <option value="en">${msg('English')}</option>
              </select>
            </div>
          </div>

          <div class="form__row">
            <div class="form__group">
              <label class="form__label form__label--required">${msg('Template Type')}</label>
              <select class="form__select" .value=${this._templateType}
                @change=${(e: Event) => {
                  this._templateType = (e.target as HTMLSelectElement).value as PromptTemplateType;
                }}>
                ${templateTypes.map((t) => html`<option value=${t}>${TEMPLATE_TYPE_LABELS[t]}</option>`)}
              </select>
            </div>
            <div class="form__group">
              <label class="form__label">${msg('Category')}</label>
              <select class="form__select" .value=${this._promptCategory}
                @change=${(e: Event) => {
                  this._promptCategory = (e.target as HTMLSelectElement).value as PromptCategory;
                }}>
                ${categories.map((c) => html`<option value=${c}>${CATEGORY_LABELS[c]}</option>`)}
              </select>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label">${msg('Description')}</label>
            <input class="form__input" type="text" .value=${this._description}
              @input=${(e: InputEvent) => {
                this._description = (e.target as HTMLInputElement).value;
              }}
              placeholder=${msg('What this template does')}
            />
          </div>

          <div class="form__group">
            <label class="form__label form__label--required">${msg('Prompt Content')}</label>
            <textarea class="form__textarea" .value=${this._promptContent}
              @input=${(e: InputEvent) => {
                this._promptContent = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('Use {{variable_name}} for template variables')}
              rows="8"
            ></textarea>
            <span class="form__hint">${msg('Variables: {{news_title}}, {{news_content}}, {{simulation_name}}, {{locale_name}}, etc.')}</span>
          </div>

          <div class="form__group">
            <label class="form__label">${msg('System Prompt')}</label>
            <textarea class="form__textarea" .value=${this._systemPrompt}
              @input=${(e: InputEvent) => {
                this._systemPrompt = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('Optional system prompt prepended to the LLM call')}
              rows="4"
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label">${msg('Negative Prompt')}</label>
            <textarea class="form__textarea" .value=${this._negativePrompt}
              @input=${(e: InputEvent) => {
                this._negativePrompt = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('Optional negative prompt (for image generation)')}
              rows="3"
            ></textarea>
          </div>

          <div class="form__row--3 form__row">
            <div class="form__group">
              <label class="form__label">${msg('Default Model')}</label>
              <input class="form__input" type="text" .value=${this._defaultModel}
                @input=${(e: InputEvent) => {
                  this._defaultModel = (e.target as HTMLInputElement).value;
                }}
                placeholder=${msg('e.g. meta-llama/llama-3.1-8b-instruct')}
              />
            </div>
            <div class="form__group">
              <label class="form__label">${msg(str`Temperature (${this._temperature})`)}</label>
              <input class="form__input" type="range" min="0" max="2" step="0.1"
                .value=${String(this._temperature)}
                @input=${(e: InputEvent) => {
                  this._temperature = Number((e.target as HTMLInputElement).value);
                }}
              />
            </div>
            <div class="form__group">
              <label class="form__label">${msg('Max Tokens')}</label>
              <input class="form__input" type="number" min="1" max="32000"
                .value=${String(this._maxTokens)}
                @input=${(e: InputEvent) => {
                  this._maxTokens = Number((e.target as HTMLInputElement).value);
                }}
              />
            </div>
          </div>

          ${this._formError ? html`<div class="form__error">${this._formError}</div>` : nothing}
        </div>

        <div slot="footer" class="footer">
          <button class="footer__btn footer__btn--cancel"
            @click=${() => {
              this._showEditModal = false;
            }}
            ?disabled=${this._saving}
          >${msg('Cancel')}</button>
          <button class="footer__btn footer__btn--save"
            @click=${this._handleSave}
            ?disabled=${this._saving}
          >${this._saving ? msg('Saving...') : isEdit ? msg('Save Changes') : msg('Create Template')}</button>
        </div>
      </velg-base-modal>
    `;
  }

  protected render() {
    return html`
      <div class="panel">
        <div class="panel__header">
          <h2 class="panel__title">${msg('Prompt Templates')}</h2>
          <button class="panel__btn" @click=${this._openCreate}>${msg('+ New Template')}</button>
        </div>

        ${this._loading ? html`<velg-loading-state message=${msg('Loading templates...')}></velg-loading-state>` : nothing}
        ${this._error ? html`<velg-error-state message=${this._error} @retry=${this._loadTemplates}></velg-error-state>` : nothing}
        ${!this._loading && !this._error ? this._renderTemplateList() : nothing}

        ${this._renderEditModal()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-prompts-settings-panel': VelgPromptsSettingsPanel;
  }
}
