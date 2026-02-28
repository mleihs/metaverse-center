import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { relationshipsApi } from '../../services/api/index.js';
import type { Agent, AgentRelationship } from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';

interface RelationshipFormData {
  target_agent_id: string;
  relationship_type: string;
  intensity: number;
  is_bidirectional: boolean;
  description: string;
}

@localized()
@customElement('velg-relationship-edit-modal')
export class VelgRelationshipEditModal extends LitElement {
  static styles = [
    formStyles,
    infoBubbleStyles,
    css`
    :host {
      display: block;
    }

    .form__slider-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .form__slider-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .form__slider-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      color: var(--color-primary);
    }

    .form__slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      background: var(--color-border-light);
      outline: none;
      border: none;
    }

    .form__slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      cursor: pointer;
    }

    .form__slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      cursor: pointer;
      border-radius: 0;
    }

    .form__checkbox-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .form__checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .form__checkbox-label {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .form__textarea--sm {
      min-height: 80px;
    }
  `,
  ];

  @property({ type: Object }) relationship: AgentRelationship | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: String }) sourceAgentId = '';
  @property({ type: Array }) agents: Agent[] = [];
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _formData: RelationshipFormData = this._defaultFormData();
  @state() private _errors: Record<string, string> = {};
  @state() private _saving = false;
  @state() private _apiError: string | null = null;

  private _defaultFormData(): RelationshipFormData {
    return {
      target_agent_id: '',
      relationship_type: '',
      intensity: 5,
      is_bidirectional: false,
      description: '',
    };
  }

  private get _isEditMode(): boolean {
    return this.relationship !== null;
  }

  private get _filteredAgents(): Agent[] {
    return this.agents.filter((a) => a.id !== this.sourceAgentId);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('relationship') || changedProperties.has('open')) {
      if (this.open) {
        this._populateForm();
        this._errors = {};
        this._apiError = null;
      }
    }
  }

  private _populateForm(): void {
    if (this.relationship) {
      this._formData = {
        target_agent_id: this.relationship.target_agent_id,
        relationship_type: this.relationship.relationship_type ?? '',
        intensity: this.relationship.intensity ?? 5,
        is_bidirectional: this.relationship.is_bidirectional ?? false,
        description: this.relationship.description ?? '',
      };
    } else {
      this._formData = this._defaultFormData();
    }
  }

  private _getRelationshipTypeOptions(): Array<{ value: string; label: string }> {
    return appState
      .getTaxonomiesByType('relationship_type')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));
  }

  private _handleInput(field: keyof RelationshipFormData, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this._formData = { ...this._formData, [field]: target.value };

    if (this._errors[field]) {
      const updated = { ...this._errors };
      delete updated[field];
      this._errors = updated;
    }
  }

  private _handleIntensityChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this._formData = { ...this._formData, intensity: Number.parseInt(target.value, 10) };
  }

  private _handleBidirectionalChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this._formData = { ...this._formData, is_bidirectional: target.checked };
  }

  private _validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this._isEditMode && !this._formData.target_agent_id) {
      errors.target_agent_id = msg('Target agent is required');
    }

    if (!this._formData.relationship_type.trim()) {
      errors.relationship_type = msg('Relationship type is required');
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async _handleSave(): Promise<void> {
    if (!this._validate()) return;

    this._saving = true;
    this._apiError = null;

    try {
      const response = this._isEditMode
        ? await relationshipsApi.update(
            this.simulationId,
            (this.relationship as AgentRelationship).id,
            {
              relationship_type: this._formData.relationship_type.trim(),
              intensity: this._formData.intensity,
              is_bidirectional: this._formData.is_bidirectional,
              description: this._formData.description.trim() || undefined,
            },
          )
        : await relationshipsApi.create(this.simulationId, this.sourceAgentId, {
            target_agent_id: this._formData.target_agent_id,
            relationship_type: this._formData.relationship_type.trim(),
            intensity: this._formData.intensity,
            is_bidirectional: this._formData.is_bidirectional,
            description: this._formData.description.trim() || undefined,
          });

      if (response.success && response.data) {
        this.dispatchEvent(
          new CustomEvent('relationship-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
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
    const typeOptions = this._getRelationshipTypeOptions();
    const filteredAgents = this._filteredAgents;

    return html`
      <velg-base-modal
        ?open=${this.open}
        @modal-close=${this._handleClose}
      >
        <span slot="header">${this._isEditMode ? msg('Edit Relationship') : msg('Create Relationship')}</span>

        <div class="form">
          ${this._apiError ? html`<div class="form__api-error">${this._apiError}</div>` : nothing}

          ${
            !this._isEditMode
              ? html`
              <div class="form__group">
                <label class="form__label" for="rel-target">
                  ${msg('Target Agent')} <span class="form__required">*</span>
                </label>
                <select
                  class="form__select ${this._errors.target_agent_id ? 'form__select--error' : ''}"
                  id="rel-target"
                  @change=${(e: Event) => this._handleInput('target_agent_id', e)}
                >
                  <option value="" ?selected=${!this._formData.target_agent_id}>${msg('Select Agent...')}</option>
                  ${filteredAgents.map(
                    (agent) => html`
                      <option value=${agent.id} ?selected=${agent.id === this._formData.target_agent_id}>
                        ${agent.name}
                      </option>
                    `,
                  )}
                </select>
                ${this._errors.target_agent_id ? html`<span class="form__error">${this._errors.target_agent_id}</span>` : nothing}
              </div>
            `
              : nothing
          }

          <div class="form__group">
            <label class="form__label" for="rel-type">
              ${msg('Relationship Type')} <span class="form__required">*</span>
              ${renderInfoBubble(msg('The nature of this bond. Affects how both agents react to events involving the other. Type-specific narrative templates shape AI generation.'))}
            </label>
            <select
              class="form__select ${this._errors.relationship_type ? 'form__select--error' : ''}"
              id="rel-type"
              @change=${(e: Event) => this._handleInput('relationship_type', e)}
            >
              <option value="" ?selected=${!this._formData.relationship_type}>${msg('Select Type...')}</option>
              ${typeOptions.map(
                (opt) => html`
                  <option value=${opt.value} ?selected=${opt.value === this._formData.relationship_type}>
                    ${opt.label}
                  </option>
                `,
              )}
            </select>
            ${this._errors.relationship_type ? html`<span class="form__error">${this._errors.relationship_type}</span>` : nothing}
          </div>

          <div class="form__slider-group">
            <div class="form__slider-header">
              <label class="form__label" for="rel-intensity">
                ${msg('Intensity')}
                ${renderInfoBubble(msg("How strong this relationship is (1-10). High intensity (7+): agents react to each other's events regardless of impact level. Medium (4-6): reactions require impact 5+. Low (1-3): reactions only for major events. Intensity 8+ resonates with the Resonance bleed vector."))}
              </label>
              <span class="form__slider-value">${this._formData.intensity}</span>
            </div>
            <input
              class="form__slider"
              id="rel-intensity"
              type="range"
              min="1"
              max="10"
              .value=${String(this._formData.intensity)}
              @input=${this._handleIntensityChange}
            />
          </div>

          <div class="form__group">
            <div class="form__checkbox-group">
              <input
                class="form__checkbox"
                id="rel-bidirectional"
                type="checkbox"
                .checked=${this._formData.is_bidirectional}
                @change=${this._handleBidirectionalChange}
              />
              <label class="form__checkbox-label" for="rel-bidirectional">
                ${msg('Bidirectional relationship')}
                ${renderInfoBubble(msg('When enabled, both agents feel the relationship equally. When disabled, only the source agent is affected — useful for unrequited bonds, secret alliances, or hierarchical roles.'))}
              </label>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label" for="rel-description">${msg('Description')}</label>
            <textarea
              class="form__textarea form__textarea--sm"
              id="rel-description"
              placeholder=${msg('Describe the nature of this relationship...')}
              .value=${this._formData.description}
              @input=${(e: Event) => this._handleInput('description', e)}
            ></textarea>
          </div>
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
            ${this._saving ? msg('Saving...') : this._isEditMode ? msg('Save Changes') : msg('Create Relationship')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-relationship-edit-modal': VelgRelationshipEditModal;
  }
}
