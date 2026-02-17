import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi, generationApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type { Agent } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

interface AgentFormData {
  name: string;
  system: string;
  gender: string;
  character: string;
  background: string;
  portrait_description: string;
  portrait_image_url: string;
}

@localized()
@customElement('velg-agent-edit-modal')
export class VelgAgentEditModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .form {
      display: flex;
      flex-direction: column;
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
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .form__required {
      color: var(--color-danger);
    }

    .form__input,
    .form__textarea,
    .form__select {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2-5) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      width: 100%;
      box-sizing: border-box;
    }

    .form__input:focus,
    .form__textarea:focus,
    .form__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__input::placeholder,
    .form__textarea::placeholder {
      color: var(--color-text-muted);
    }

    .form__textarea {
      min-height: 100px;
      resize: vertical;
    }

    .form__select {
      cursor: pointer;
    }

    .form__error-message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      color: var(--color-text-danger);
    }

    .form__input--error,
    .form__textarea--error,
    .form__select--error {
      border-color: var(--color-border-danger);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .footer__btn {
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

    .footer__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .footer__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .footer__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .footer__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .footer__btn--save {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .form__api-error {
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

    .portrait-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface-sunken);
      border: var(--border-default);
    }

    .portrait-section__header {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .portrait-section__preview {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border: var(--border-medium);
    }

    .portrait-section__placeholder {
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface);
      border: var(--border-medium);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .portrait-section__buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .gen-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .gen-btn:hover {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .gen-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .gen-btn--primary {
      background: var(--color-info-bg);
      border-color: var(--color-info);
      color: var(--color-info);
    }

    .gen-btn--primary:hover {
      background: var(--color-info);
      color: var(--color-text-inverse);
    }

    .form__textarea--sm {
      min-height: 60px;
    }
  `;

  @property({ type: Object }) agent: Agent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _formData: AgentFormData = this._defaultFormData();
  @state() private _errors: Record<string, string> = {};
  @state() private _saving = false;
  @state() private _apiError: string | null = null;
  @state() private _generating = false;

  private _defaultFormData(): AgentFormData {
    return {
      name: '',
      system: '',
      gender: '',
      character: '',
      background: '',
      portrait_description: '',
      portrait_image_url: '',
    };
  }

  private get _isEditMode(): boolean {
    return this.agent !== null;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('agent') || changedProperties.has('open')) {
      if (this.open) {
        this._populateForm();
        this._errors = {};
        this._apiError = null;
      }
    }
  }

  private _populateForm(): void {
    if (this.agent) {
      this._formData = {
        name: this.agent.name ?? '',
        system: this.agent.system ?? '',
        gender: this.agent.gender ?? '',
        character: this.agent.character ?? '',
        background: this.agent.background ?? '',
        portrait_description: this.agent.portrait_description ?? '',
        portrait_image_url: this.agent.portrait_image_url ?? '',
      };
    } else {
      this._formData = this._defaultFormData();
    }
  }

  private _getSystemOptions(): Array<{ value: string; label: string }> {
    return appState
      .getTaxonomiesByType('system')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  private _getGenderOptions(): Array<{ value: string; label: string }> {
    return appState
      .getTaxonomiesByType('gender')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  private _handleInput(field: keyof AgentFormData, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this._formData = { ...this._formData, [field]: target.value };

    if (this._errors[field]) {
      const updated = { ...this._errors };
      delete updated[field];
      this._errors = updated;
    }
  }

  private _validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this._formData.name.trim()) {
      errors.name = msg('Name is required');
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async _handleGenerateCharacter(): Promise<void> {
    if (!this._formData.name.trim()) {
      VelgToast.error(msg('Enter a name first.'));
      return;
    }
    if (!this._formData.system) {
      VelgToast.error(msg('Select a system/faction first.'));
      return;
    }

    this._generating = true;
    try {
      await generationProgress.run('agent', async (progress) => {
        progress.setStep('prepare', msg('Anfrage wird vorbereitet...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate_text',
          msg('KI generiert Beschreibung...'),
          msg('Dies kann einen Moment dauern'),
        );
        const response = await generationApi.generateAgent(this.simulationId, {
          name: this._formData.name,
          system: this._formData.system,
          gender: this._formData.gender || 'divers',
          locale: appState.currentSimulation.value?.content_locale ?? 'de',
        });

        progress.setStep('process', msg('Verarbeite Antwort...'));
        if (response.success && response.data) {
          const data = response.data as Record<string, string>;
          const character = data.character ?? data.content ?? '';
          const background = data.background ?? '';
          this._formData = {
            ...this._formData,
            character: character || this._formData.character,
            background: background || this._formData.background,
          };
          progress.complete(msg('Beschreibung erfolgreich generiert.'));
          VelgToast.success(msg('Character description generated.'));
        } else {
          progress.setError(response.error?.message ?? msg('Generation fehlgeschlagen.'));
          VelgToast.error(response.error?.message ?? msg('Failed to generate character.'));
        }
      });
    } catch {
      VelgToast.error(msg('An error occurred during generation.'));
    } finally {
      this._generating = false;
    }
  }

  private async _handleGenerateDescription(): Promise<void> {
    const agentId = this.agent?.id;
    if (!agentId || !this._formData.name.trim()) {
      VelgToast.error(msg('Save the agent first before generating a portrait description.'));
      return;
    }

    this._generating = true;
    try {
      await generationProgress.run('portrait', async (progress) => {
        progress.setStep('prepare', msg('Anfrage wird vorbereitet...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate_portrait_desc',
          msg('Portrait-Beschreibung wird generiert...'),
          msg('Dies kann einen Moment dauern'),
        );
        const response = await generationApi.generatePortraitDescription(this.simulationId, {
          agent_id: agentId,
          agent_name: this._formData.name,
          agent_data: {
            system: this._formData.system,
            gender: this._formData.gender,
            character: this._formData.character,
            background: this._formData.background,
          },
        });

        progress.setStep('process', msg('Verarbeite Antwort...'));
        if (response.success && response.data) {
          const desc = (response.data as Record<string, string>).description ?? '';
          this._formData = { ...this._formData, portrait_description: desc };
          progress.complete(msg('Portrait-Beschreibung generiert.'));
          VelgToast.success(msg('Portrait description generated.'));
        } else {
          progress.setError(response.error?.message ?? msg('Generation fehlgeschlagen.'));
          VelgToast.error(response.error?.message ?? msg('Failed to generate description.'));
        }
      });
    } catch {
      VelgToast.error(msg('An error occurred during generation.'));
    } finally {
      this._generating = false;
    }
  }

  private async _handleGeneratePortrait(): Promise<void> {
    const agentId = this.agent?.id;
    if (!agentId || !this._formData.name.trim()) {
      VelgToast.error(msg('Save the agent first before generating a portrait.'));
      return;
    }

    this._generating = true;
    try {
      await generationProgress.run('image', async (progress) => {
        progress.setStep('prepare', msg('Bild-Anfrage wird vorbereitet...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate_image',
          msg('KI generiert Portrait...'),
          msg('Dies kann 1-2 Minuten dauern'),
        );
        const response = await generationApi.generateImage(this.simulationId, {
          entity_type: 'agent',
          entity_id: agentId,
          entity_name: this._formData.name,
          extra: {
            portrait_description: this._formData.portrait_description,
            system: this._formData.system,
            gender: this._formData.gender,
            character: this._formData.character,
          },
        });

        progress.setStep('process_image', msg('Verarbeite Bild...'));
        if (response.success && response.data) {
          const url = (response.data as Record<string, string>).image_url ?? '';
          this._formData = { ...this._formData, portrait_image_url: url };
          progress.complete(msg('Portrait erfolgreich generiert.'));
          VelgToast.success(msg('Portrait generated and uploaded.'));
        } else {
          progress.setError(response.error?.message ?? msg('Bildgenerierung fehlgeschlagen.'));
          VelgToast.error(response.error?.message ?? msg('Failed to generate portrait.'));
        }
      });
    } catch {
      VelgToast.error(msg('An error occurred during portrait generation.'));
    } finally {
      this._generating = false;
    }
  }

  private _paletteIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
        <path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      </svg>
    `;
  }

  private _sparkleIcon() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 6a6 6 0 0 1 6 6a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6z" />
      </svg>
    `;
  }

  private async _handleSave(): Promise<void> {
    if (!this._validate()) return;

    this._saving = true;
    this._apiError = null;

    try {
      const payload: Partial<Agent> = {
        name: this._formData.name.trim(),
        system: this._formData.system || undefined,
        gender: this._formData.gender || undefined,
        character: this._formData.character.trim() || undefined,
        background: this._formData.background.trim() || undefined,
        portrait_description: this._formData.portrait_description.trim() || undefined,
        portrait_image_url: this._formData.portrait_image_url.trim() || undefined,
      };

      const response = this._isEditMode
        ? await agentsApi.update(this.simulationId, (this.agent as Agent).id, payload)
        : await agentsApi.create(this.simulationId, payload);

      if (response.success && response.data) {
        this.dispatchEvent(
          new CustomEvent('agent-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
        // Also explicitly request modal close in case the parent event
        // handler doesn't fire (e.g. if the element was re-rendered).
        this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
      } else {
        this._apiError = response.error?.message ?? msg('An unknown error occurred');
      }
    } catch (err) {
      this._apiError = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._saving = false;
    }
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const systemOptions = this._getSystemOptions();
    const genderOptions = this._getGenderOptions();

    return html`
      <velg-base-modal
        ?open=${this.open}
        @modal-close=${this._handleClose}
      >
        <span slot="header">${this._isEditMode ? msg('Edit Agent') : msg('Create Agent')}</span>

        <div class="form">
          ${this._apiError ? html`<div class="form__api-error">${this._apiError}</div>` : nothing}

          <div class="form__group">
            <label class="form__label" for="agent-name">
              ${msg('Name')} <span class="form__required">*</span>
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="agent-name"
              type="text"
              placeholder=${msg('Agent name...')}
              .value=${this._formData.name}
              @input=${(e: Event) => this._handleInput('name', e)}
            />
            ${this._errors.name ? html`<span class="form__error-message">${this._errors.name}</span>` : nothing}
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-system">${msg('System')}</label>
            <select
              class="form__select"
              id="agent-system"
              @change=${(e: Event) => this._handleInput('system', e)}
            >
              <option value="" ?selected=${!this._formData.system}>${msg('Select System...')}</option>
              ${systemOptions.map((opt) => html`<option value=${opt.value} ?selected=${opt.value === this._formData.system}>${opt.label}</option>`)}
            </select>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-gender">${msg('Gender')}</label>
            <select
              class="form__select"
              id="agent-gender"
              @change=${(e: Event) => this._handleInput('gender', e)}
            >
              <option value="" ?selected=${!this._formData.gender}>${msg('Select Gender...')}</option>
              ${genderOptions.map((opt) => html`<option value=${opt.value} ?selected=${opt.value === this._formData.gender}>${opt.label}</option>`)}
            </select>
          </div>

          <div class="portrait-section__buttons">
            <button
              class="gen-btn"
              type="button"
              ?disabled=${this._generating}
              @click=${this._handleGenerateCharacter}
            >
              ${this._sparkleIcon()}
              ${msg('Generate Description')}
            </button>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-character">${msg('Character')}</label>
            <textarea
              class="form__textarea"
              id="agent-character"
              placeholder=${msg("Describe the agent's character and personality...")}
              .value=${this._formData.character}
              @input=${(e: Event) => this._handleInput('character', e)}
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-background">${msg('Background')}</label>
            <textarea
              class="form__textarea"
              id="agent-background"
              placeholder=${msg("Describe the agent's background story...")}
              .value=${this._formData.background}
              @input=${(e: Event) => this._handleInput('background', e)}
            ></textarea>
          </div>

          ${
            this._isEditMode
              ? html`
              <div class="portrait-section">
                <div class="portrait-section__header">${msg('Portrait')}</div>

                ${
                  this._formData.portrait_image_url
                    ? html`<img
                        class="portrait-section__preview"
                        src=${this._formData.portrait_image_url}
                        alt=${this._formData.name}
                      />`
                    : html`<div class="portrait-section__placeholder">
                        ${this._formData.name ? this._formData.name.substring(0, 2).toUpperCase() : '??'}
                      </div>`
                }

                <div class="form__group">
                  <label class="form__label" for="agent-portrait-desc">${msg('Portrait Description')}</label>
                  <textarea
                    class="form__textarea form__textarea--sm"
                    id="agent-portrait-desc"
                    placeholder=${msg('AI-generated description for image generation...')}
                    .value=${this._formData.portrait_description}
                    @input=${(e: Event) => this._handleInput('portrait_description', e)}
                  ></textarea>
                </div>

                <div class="portrait-section__buttons">
                  <button
                    class="gen-btn"
                    type="button"
                    ?disabled=${this._generating}
                    @click=${this._handleGenerateDescription}
                  >
                    ${this._sparkleIcon()}
                    ${msg('Generate Portrait Desc')}
                  </button>
                  <button
                    class="gen-btn gen-btn--primary"
                    type="button"
                    ?disabled=${this._generating}
                    @click=${this._handleGeneratePortrait}
                  >
                    ${this._paletteIcon()}
                    ${msg('Generate Portrait')}
                  </button>
                </div>
              </div>
            `
              : nothing
          }
        </div>

        <div slot="footer" class="footer">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._saving}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleSave}
            ?disabled=${this._saving}
          >
            ${this._saving ? msg('Saving...') : this._isEditMode ? msg('Save Changes') : msg('Create Agent')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-edit-modal': VelgAgentEditModal;
  }
}
