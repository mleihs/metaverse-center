import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/index.js';
import type { Agent } from '../../types/index.js';

import '../shared/BaseModal.js';

interface AgentFormData {
  name: string;
  system: string;
  gender: string;
  character: string;
  background: string;
}

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
  `;

  @property({ type: Object }) agent: Agent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _formData: AgentFormData = this._defaultFormData();
  @state() private _errors: Record<string, string> = {};
  @state() private _saving = false;
  @state() private _apiError: string | null = null;

  private _defaultFormData(): AgentFormData {
    return {
      name: '',
      system: '',
      gender: '',
      character: '',
      background: '',
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
      errors.name = 'Name is required';
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
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
      } else {
        this._apiError = response.error?.message ?? 'An unknown error occurred';
      }
    } catch (err) {
      this._apiError = err instanceof Error ? err.message : 'An unknown error occurred';
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
        <span slot="header">${this._isEditMode ? 'Edit Agent' : 'Create Agent'}</span>

        <div class="form">
          ${this._apiError ? html`<div class="form__api-error">${this._apiError}</div>` : nothing}

          <div class="form__group">
            <label class="form__label" for="agent-name">
              Name <span class="form__required">*</span>
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="agent-name"
              type="text"
              placeholder="Agent name..."
              .value=${this._formData.name}
              @input=${(e: Event) => this._handleInput('name', e)}
            />
            ${this._errors.name ? html`<span class="form__error-message">${this._errors.name}</span>` : nothing}
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-system">System</label>
            <select
              class="form__select"
              id="agent-system"
              .value=${this._formData.system}
              @change=${(e: Event) => this._handleInput('system', e)}
            >
              <option value="">Select System...</option>
              ${systemOptions.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
            </select>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-gender">Gender</label>
            <select
              class="form__select"
              id="agent-gender"
              .value=${this._formData.gender}
              @change=${(e: Event) => this._handleInput('gender', e)}
            >
              <option value="">Select Gender...</option>
              ${genderOptions.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
            </select>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-character">Character</label>
            <textarea
              class="form__textarea"
              id="agent-character"
              placeholder="Describe the agent's character and personality..."
              .value=${this._formData.character}
              @input=${(e: Event) => this._handleInput('character', e)}
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="agent-background">Background</label>
            <textarea
              class="form__textarea"
              id="agent-background"
              placeholder="Describe the agent's background story..."
              .value=${this._formData.background}
              @input=${(e: Event) => this._handleInput('background', e)}
            ></textarea>
          </div>
        </div>

        <div slot="footer" class="footer">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._saving}
          >
            Cancel
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleSave}
            ?disabled=${this._saving}
          >
            ${this._saving ? 'Saving...' : this._isEditMode ? 'Save Changes' : 'Create Agent'}
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
