import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi, generationApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type { Agent } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

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
  static styles = [
    formStyles,
    infoBubbleStyles,
    css`
    :host {
      display: block;
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

    .form__textarea--sm {
      min-height: 60px;
    }
  `,
  ];

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
              ${renderInfoBubble(msg('Used in relationship descriptions, event reactions, and embassy assignments.'))}
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="agent-name"
              type="text"
              placeholder=${msg('Agent name...')}
              .value=${this._formData.name}
              @input=${(e: Event) => this._handleInput('name', e)}
            />
            ${this._errors.name ? html`<span class="form__error">${this._errors.name}</span>` : nothing}
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-system">
              ${msg('System')}
              ${renderInfoBubble(msg('The faction or organization. Events tagged with a matching system name attract this agent and increase reaction probability.'))}
            </label>
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
            <label class="form__label" for="agent-gender">
              ${msg('Gender')}
              ${renderInfoBubble(msg('Used in AI-generated text for pronouns and portrait generation.'))}
            </label>
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
              ${icons.sparkle()}
              ${msg('Generate Description')}
            </button>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-character">
              ${msg('Character')}
              ${renderInfoBubble(msg('Personality traits and behavioral patterns. Longer descriptions produce richer AI reactions. Mystical/spiritual traits resonate with Dream bleed.'))}
            </label>
            <textarea
              class="form__textarea"
              id="agent-character"
              placeholder=${msg("Describe the agent's character and personality...")}
              .value=${this._formData.character}
              @input=${(e: Event) => this._handleInput('character', e)}
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-background">
              ${msg('Background')}
              ${renderInfoBubble(msg('Origin story and life history. Feeds into AI reactions, relationships, and echo narratives. Detailed backgrounds increase narrative weight in cross-simulation bleed.'))}
            </label>
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
                  <label class="form__label" for="agent-portrait-desc">
                    ${msg('Portrait Description')}
                    ${renderInfoBubble(msg('Visual description used by the image AI. Does not affect game mechanics — purely aesthetic.'))}
                  </label>
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
                    ${icons.sparkle()}
                    ${msg('Generate Portrait Desc')}
                  </button>
                  <button
                    class="gen-btn gen-btn--primary"
                    type="button"
                    ?disabled=${this._generating}
                    @click=${this._handleGeneratePortrait}
                  >
                    ${icons.palette()}
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
