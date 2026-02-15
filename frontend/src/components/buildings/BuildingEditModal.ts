import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi } from '../../services/api/index.js';
import type { ApiResponse, Building } from '../../types/index.js';
import '../shared/BaseModal.js';
import { VelgToast } from '../shared/Toast.js';

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

    .form__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: var(--border-light);
    }

    .form__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2-5) var(--space-5);
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

    .form__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .form__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .form__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .form__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .form__btn--submit {
      background: var(--color-primary);
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
    } else {
      this._name = '';
      this._buildingType = '';
      this._description = '';
      this._buildingCondition = 'good';
      this._populationCapacity = 0;
      this._constructionYear = null;
      this._style = '';
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
      errors.name = 'Name is required';
    }

    if (!this._buildingType) {
      errors.building_type = 'Building type is required';
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async _handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

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
          this._isEdit ? 'Building updated successfully' : 'Building created successfully',
        );
        this.dispatchEvent(
          new CustomEvent('building-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to save building');
      }
    } catch {
      VelgToast.error('An unexpected error occurred');
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

  private _conditionOptions = [
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'ruined', label: 'Ruined' },
  ];

  protected render() {
    const typeOptions = this._getBuildingTypeOptions();
    const styleOptions = this._getBuildingStyleOptions();

    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${this._isEdit ? 'Edit Building' : 'Create Building'}</span>

        <form class="form" @submit=${this._handleSubmit} novalidate>
          <div class="form__group">
            <label class="form__label" for="name">
              Name <span class="form__required">*</span>
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="name"
              type="text"
              placeholder="Enter building name"
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
                Building Type <span class="form__required">*</span>
              </label>
              <select
                class="form__select ${this._errors.building_type ? 'form__select--error' : ''}"
                id="building_type"
                .value=${this._buildingType}
                @change=${(e: Event) => {
                  this._buildingType = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="">Select type...</option>
                ${typeOptions.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
              </select>
              ${
                this._errors.building_type
                  ? html`<span class="form__error">${this._errors.building_type}</span>`
                  : nothing
              }
            </div>

            <div class="form__group">
              <label class="form__label" for="building_condition">
                Condition
              </label>
              <select
                class="form__select"
                id="building_condition"
                .value=${this._buildingCondition}
                @change=${(e: Event) => {
                  this._buildingCondition = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="">Select condition...</option>
                ${this._conditionOptions.map(
                  (opt) => html`<option value=${opt.value}>${opt.label}</option>`,
                )}
              </select>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label" for="description">
              Description
            </label>
            <textarea
              class="form__textarea"
              id="description"
              placeholder="Describe the building..."
              .value=${this._description}
              @input=${(e: Event) => {
                this._description = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </div>

          <div class="form__row">
            <div class="form__group">
              <label class="form__label" for="population_capacity">
                Population Capacity
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
                Construction Year
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
              Style
            </label>
            <select
              class="form__select"
              id="style"
              .value=${this._style}
              @change=${(e: Event) => {
                this._style = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="">Select style...</option>
              ${styleOptions.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
            </select>
          </div>

          <div slot="footer" class="form__actions">
            <button
              type="button"
              class="form__btn form__btn--cancel"
              @click=${this._handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="form__btn form__btn--submit"
              ?disabled=${this._saving}
            >
              ${this._saving ? 'Saving...' : this._isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-building-edit-modal': VelgBuildingEditModal;
  }
}
