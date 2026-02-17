import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi, generationApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type { ApiResponse, Building } from '../../types/index.js';
import '../shared/BaseModal.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-building-edit-modal')
export class VelgBuildingEditModal extends LitElement {
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

    .form__row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
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

    .form__error {
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

    .image-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface-sunken);
      border: var(--border-default);
    }

    .image-section__header {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .image-section__preview {
      width: 200px;
      height: 120px;
      object-fit: cover;
      border: var(--border-medium);
    }

    .image-section__placeholder {
      width: 200px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface);
      border: var(--border-medium);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .image-section__buttons {
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

  `;

  @property({ attribute: false }) building: Building | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _name = '';
  @state() private _buildingType = '';
  @state() private _description = '';
  @state() private _buildingCondition = '';
  @state() private _populationCapacity = 0;
  @state() private _constructionYear: number | null = null;
  @state() private _style = '';
  @state() private _saving = false;
  @state() private _errors: Record<string, string> = {};
  @state() private _generating = false;
  @state() private _imageUrl = '';

  private get _isEdit(): boolean {
    return this.building !== null;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('building') || changedProperties.has('open')) {
      if (this.open) {
        this._populateForm();
      }
    }
  }

  private _populateForm(): void {
    if (this.building) {
      this._name = this.building.name;
      this._buildingType = this.building.building_type ?? '';
      this._description = this.building.description ?? '';
      this._buildingCondition = this.building.building_condition ?? '';
      this._populationCapacity = this.building.population_capacity ?? 0;
      this._constructionYear = this.building.construction_year ?? null;
      this._style = this.building.style ?? '';
      this._imageUrl = this.building.image_url ?? '';
    } else {
      this._name = '';
      this._buildingType = '';
      this._description = '';
      this._buildingCondition = 'good';
      this._populationCapacity = 0;
      this._constructionYear = null;
      this._style = '';
      this._imageUrl = '';
    }
    this._errors = {};
  }

  private _getBuildingTypeOptions(): { value: string; label: string }[] {
    return appState
      .getTaxonomiesByType('building_type')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  private _getBuildingStyleOptions(): { value: string; label: string }[] {
    return appState
      .getTaxonomiesByType('building_style')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  private _validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this._name.trim()) {
      errors.name = msg('Name is required');
    }

    if (!this._buildingType) {
      errors.building_type = msg('Building type is required');
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async _handleGenerateDescription(): Promise<void> {
    if (!this._buildingType) {
      VelgToast.error(msg('Select a building type first.'));
      return;
    }

    this._generating = true;
    try {
      await generationProgress.run('building', async (progress) => {
        progress.setStep('prepare', msg('Preparing request...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate_text',
          msg('AI is generating description...'),
          msg('This may take a moment'),
        );
        const response = await generationApi.generateBuilding(this.simulationId, {
          building_type: this._buildingType,
          name: this._name.trim() || undefined,
          style: this._style || undefined,
          condition: this._buildingCondition || undefined,
          locale: appState.currentSimulation.value?.content_locale ?? 'de',
        });

        progress.setStep('process', msg('Processing response...'));
        if (response.success && response.data) {
          const data = response.data as Record<string, string>;
          this._description = data.content ?? data.description ?? '';
          if (data.name && !this._name.trim()) {
            this._name = data.name;
          }
          if (data.building_condition) {
            this._buildingCondition = data.building_condition;
          }
          progress.complete(msg('Description generated successfully.'));
          VelgToast.success(msg('Building description generated.'));
        } else {
          progress.setError(response.error?.message ?? msg('Generation failed.'));
          VelgToast.error(response.error?.message ?? msg('Failed to generate description.'));
        }
      });
    } catch {
      VelgToast.error(msg('An error occurred during generation.'));
    } finally {
      this._generating = false;
    }
  }

  private async _handleGenerateImage(): Promise<void> {
    const buildingId = this.building?.id;
    if (!buildingId || !this._name.trim()) {
      VelgToast.error(msg('Save the building first before generating an image.'));
      return;
    }

    this._generating = true;
    try {
      await generationProgress.run('image', async (progress) => {
        progress.setStep('prepare', msg('Preparing image request...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate_image',
          msg('AI is generating building image...'),
          msg('This may take 1-2 minutes'),
        );
        const response = await generationApi.generateImage(this.simulationId, {
          entity_type: 'building',
          entity_id: buildingId,
          entity_name: this._name,
          extra: { building_type: this._buildingType },
        });

        progress.setStep('process_image', msg('Processing image...'));
        if (response.success && response.data) {
          this._imageUrl = (response.data as Record<string, string>).image_url ?? '';
          progress.complete(msg('Image generated successfully.'));
          VelgToast.success(msg('Building image generated and uploaded.'));
        } else {
          progress.setError(response.error?.message ?? msg('Image generation failed.'));
          VelgToast.error(response.error?.message ?? msg('Failed to generate image.'));
        }
      });
    } catch {
      VelgToast.error(msg('An error occurred during image generation.'));
    } finally {
      this._generating = false;
    }
  }

  private _sparkleIcon() {
    return svg`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 6a6 6 0 0 1 6 6a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6z" /></svg>`;
  }

  private _imageIcon() {
    return svg`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>`;
  }

  private async _handleSubmit(e?: Event): Promise<void> {
    e?.preventDefault();

    if (!this._validate()) return;

    this._saving = true;

    const data: Partial<Building> = {
      name: this._name.trim(),
      building_type: this._buildingType,
      description: this._description.trim() || undefined,
      building_condition: this._buildingCondition || undefined,
      population_capacity: this._populationCapacity,
      construction_year: this._constructionYear ?? undefined,
      style: this._style || undefined,
      image_url: this._imageUrl.trim() || undefined,
    };

    try {
      let response: ApiResponse<Building>;
      if (this._isEdit && this.building) {
        response = await buildingsApi.update(this.simulationId, this.building.id, data);
      } else {
        response = await buildingsApi.create(this.simulationId, data);
      }

      if (response.success && response.data) {
        VelgToast.success(
          this._isEdit
            ? msg('Building updated successfully')
            : msg('Building created successfully'),
        );
        this.dispatchEvent(
          new CustomEvent('building-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
        this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to save building'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred'));
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

  private _getBuildingConditionOptions(): { value: string; label: string }[] {
    return appState
      .getTaxonomiesByType('building_condition')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  protected render() {
    const typeOptions = this._getBuildingTypeOptions();
    const styleOptions = this._getBuildingStyleOptions();

    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${this._isEdit ? msg('Edit Building') : msg('Create Building')}</span>

        <form class="form" @submit=${this._handleSubmit} novalidate>
          <div class="form__group">
            <label class="form__label" for="name">
              ${msg('Name')} <span class="form__required">*</span>
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="name"
              type="text"
              placeholder=${msg('Enter building name')}
              .value=${this._name}
              @input=${(e: Event) => {
                this._name = (e.target as HTMLInputElement).value;
              }}
            />
            ${
              this._errors.name
                ? html`<span class="form__error">${this._errors.name}</span>`
                : nothing
            }
          </div>

          <div class="form__row">
            <div class="form__group">
              <label class="form__label" for="building_type">
                ${msg('Building Type')} <span class="form__required">*</span>
              </label>
              <select
                class="form__select ${this._errors.building_type ? 'form__select--error' : ''}"
                id="building_type"
                @change=${(e: Event) => {
                  this._buildingType = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="" ?selected=${!this._buildingType}>${msg('Select type...')}</option>
                ${typeOptions.map((opt) => html`<option value=${opt.value} ?selected=${opt.value === this._buildingType}>${opt.label}</option>`)}
              </select>
              ${
                this._errors.building_type
                  ? html`<span class="form__error">${this._errors.building_type}</span>`
                  : nothing
              }
            </div>

            <div class="form__group">
              <label class="form__label" for="building_condition">
                ${msg('Condition')}
              </label>
              <select
                class="form__select"
                id="building_condition"
                @change=${(e: Event) => {
                  this._buildingCondition = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="" ?selected=${!this._buildingCondition}>${msg('Select condition...')}</option>
                ${this._getBuildingConditionOptions().map(
                  (opt) =>
                    html`<option value=${opt.value} ?selected=${opt.value === this._buildingCondition}>${opt.label}</option>`,
                )}
              </select>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label" for="description">
              ${msg('Description')}
            </label>
            <div class="image-section__buttons">
              <button
                class="gen-btn"
                type="button"
                ?disabled=${this._generating}
                @click=${this._handleGenerateDescription}
              >
                ${this._sparkleIcon()}
                ${msg('Generate Description')}
              </button>
            </div>
            <textarea
              class="form__textarea"
              id="description"
              placeholder=${msg('Describe the building...')}
              .value=${this._description}
              @input=${(e: Event) => {
                this._description = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </div>

          <div class="form__row">
            <div class="form__group">
              <label class="form__label" for="population_capacity">
                ${msg('Population Capacity')}
              </label>
              <input
                class="form__input"
                id="population_capacity"
                type="number"
                min="0"
                .value=${String(this._populationCapacity)}
                @input=${(e: Event) => {
                  this._populationCapacity = Number((e.target as HTMLInputElement).value) || 0;
                }}
              />
            </div>

            <div class="form__group">
              <label class="form__label" for="construction_year">
                ${msg('Construction Year')}
              </label>
              <input
                class="form__input"
                id="construction_year"
                type="number"
                placeholder="e.g. 1847"
                .value=${this._constructionYear != null ? String(this._constructionYear) : ''}
                @input=${(e: Event) => {
                  const val = (e.target as HTMLInputElement).value;
                  this._constructionYear = val ? Number(val) : null;
                }}
              />
            </div>
          </div>

          <div class="form__group">
            <label class="form__label" for="style">
              ${msg('Style')}
            </label>
            <select
              class="form__select"
              id="style"
              @change=${(e: Event) => {
                this._style = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="" ?selected=${!this._style}>${msg('Select style...')}</option>
              ${styleOptions.map((opt) => html`<option value=${opt.value} ?selected=${opt.value === this._style}>${opt.label}</option>`)}
            </select>
          </div>

          ${
            this._isEdit
              ? html`
              <div class="image-section">
                <div class="image-section__header">${msg('Building Image')}</div>

                ${
                  this._imageUrl
                    ? html`<img class="image-section__preview" src=${this._imageUrl} alt=${this._name} />`
                    : html`<div class="image-section__placeholder">${msg('No image')}</div>`
                }

                <div class="image-section__buttons">
                  <button
                    class="gen-btn gen-btn--primary"
                    type="button"
                    ?disabled=${this._generating}
                    @click=${this._handleGenerateImage}
                  >
                    ${this._imageIcon()}
                    ${msg('Generate Image')}
                  </button>
                </div>
              </div>
            `
              : nothing
          }
        </form>

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
            @click=${this._handleSubmit}
            ?disabled=${this._saving}
          >
            ${this._saving ? msg('Saving...') : this._isEdit ? msg('Save Changes') : msg('Create Building')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-edit-modal': VelgBuildingEditModal;
  }
}
