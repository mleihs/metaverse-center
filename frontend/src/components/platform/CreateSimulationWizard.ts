import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { simulationsApi } from '../../services/api/index.js';
import type { SimulationTheme } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

type WizardStep = 1 | 2 | 3;
type TaxonomyChoice = 'defaults' | 'empty' | 'custom';

interface SimulationFormData {
  name: string;
  slug: string;
  description: string;
  theme: SimulationTheme;
  content_locale: string;
  taxonomy_choice: TaxonomyChoice;
}

@localized()
@customElement('velg-create-simulation-wizard')
export class VelgCreateSimulationWizard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .wizard__steps {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
    }

    .wizard__step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      border: var(--border-medium);
      transition: all var(--transition-fast);
    }

    .wizard__step-indicator--active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
    }

    .wizard__step-indicator--completed {
      background: var(--color-success);
      color: var(--color-text-inverse);
      border-color: var(--color-success);
    }

    .wizard__step-indicator--pending {
      background: var(--color-surface);
      color: var(--color-text-muted);
    }

    .wizard__step-connector {
      flex: 1;
      height: 2px;
      background: var(--color-border-light);
    }

    .wizard__step-connector--completed {
      background: var(--color-success);
    }

    .wizard__step-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      text-align: center;
    }

    .wizard__step-label--active {
      color: var(--color-text-primary);
    }

    .wizard__step-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
    }

    .wizard__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .wizard__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .wizard__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .wizard__required {
      color: var(--color-danger);
    }

    .wizard__input,
    .wizard__textarea,
    .wizard__select {
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

    .wizard__input:focus,
    .wizard__textarea:focus,
    .wizard__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .wizard__input::placeholder,
    .wizard__textarea::placeholder {
      color: var(--color-text-muted);
    }

    .wizard__textarea {
      min-height: 80px;
      resize: vertical;
    }

    .wizard__select {
      cursor: pointer;
    }

    .wizard__input--error {
      border-color: var(--color-border-danger);
    }

    .wizard__error-message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      color: var(--color-text-danger);
    }

    .wizard__slug-preview {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .wizard__radio-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .wizard__radio-option {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .wizard__radio-option:hover {
      background: var(--color-surface-sunken);
    }

    .wizard__radio-option--selected {
      border-color: var(--color-primary);
      background: var(--color-info-bg);
    }

    .wizard__radio-input {
      margin-top: var(--space-0-5);
      flex-shrink: 0;
    }

    .wizard__radio-content {
      flex: 1;
    }

    .wizard__radio-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .wizard__radio-desc {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin-top: var(--space-0-5);
    }

    .wizard__summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .wizard__summary-row {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }

    .wizard__summary-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      min-width: 100px;
      flex-shrink: 0;
    }

    .wizard__summary-value {
      font-size: var(--text-base);
      color: var(--color-text-primary);
    }

    .wizard__api-error {
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

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .footer__left {
      display: flex;
    }

    .footer__right {
      display: flex;
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

    .footer__btn--back {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .footer__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .footer__btn--next {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .footer__btn--create {
      background: var(--color-success);
      color: var(--color-text-inverse);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _step: WizardStep = 1;
  @state() private _formData: SimulationFormData = this._defaultFormData();
  @state() private _errors: Record<string, string> = {};
  @state() private _creating = false;
  @state() private _apiError: string | null = null;

  private _defaultFormData(): SimulationFormData {
    return {
      name: '',
      slug: '',
      description: '',
      theme: 'dystopian',
      content_locale: 'de',
      taxonomy_choice: 'defaults',
    };
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 1;
      this._formData = this._defaultFormData();
      this._errors = {};
      this._apiError = null;
      this._creating = false;
    }
  }

  private _generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private _handleInput(field: keyof SimulationFormData, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const value = target.value;

    if (field === 'name') {
      this._formData = {
        ...this._formData,
        name: value,
        slug: this._generateSlug(value),
      };
    } else {
      this._formData = { ...this._formData, [field]: value };
    }

    if (this._errors[field]) {
      const updated = { ...this._errors };
      delete updated[field];
      this._errors = updated;
    }
  }

  private _handleTaxonomyChoice(choice: TaxonomyChoice): void {
    this._formData = { ...this._formData, taxonomy_choice: choice };
  }

  private _validateStep1(): boolean {
    const errors: Record<string, string> = {};

    if (!this._formData.name.trim()) {
      errors.name = msg('Name is required');
    }

    if (!this._formData.slug.trim()) {
      errors.slug = msg('Slug is required');
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private _handleNext(): void {
    if (this._step === 1) {
      if (!this._validateStep1()) return;
      this._step = 2;
    } else if (this._step === 2) {
      this._step = 3;
    }
  }

  private _handleBack(): void {
    if (this._step === 2) {
      this._step = 1;
    } else if (this._step === 3) {
      this._step = 2;
    }
  }

  private async _handleCreate(): Promise<void> {
    this._creating = true;
    this._apiError = null;

    try {
      const payload = {
        name: this._formData.name.trim(),
        slug: this._formData.slug.trim(),
        description: this._formData.description.trim() || undefined,
        theme: this._formData.theme,
        content_locale: this._formData.content_locale,
      };

      const response = await simulationsApi.create(payload);

      if (response.success && response.data) {
        VelgToast.success(msg(str`Simulation "${response.data.name}" created.`));
        this.dispatchEvent(
          new CustomEvent('navigate', {
            detail: `/simulations/${response.data.id}/agents`,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._apiError = response.error?.message ?? msg('Failed to create simulation.');
        VelgToast.error(this._apiError);
      }
    } catch {
      this._apiError = msg('An unexpected error occurred.');
      VelgToast.error(this._apiError);
    } finally {
      this._creating = false;
    }
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: '/dashboard',
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getStepState(step: WizardStep): string {
    if (step === this._step) return 'active';
    if (step < this._step) return 'completed';
    return 'pending';
  }

  private _renderStepIndicator() {
    const steps: Array<{ num: WizardStep; label: string }> = [
      { num: 1, label: msg('Basic Info') },
      { num: 2, label: msg('Taxonomies') },
      { num: 3, label: msg('Confirm') },
    ];

    return html`
      <div class="wizard__steps">
        ${steps.map((step, i) => {
          const stepState = this._getStepState(step.num);
          return html`
            ${
              i > 0
                ? html`
                <div class="wizard__step-connector ${
                  step.num <= this._step ? 'wizard__step-connector--completed' : ''
                }"></div>
              `
                : nothing
            }
            <div class="wizard__step-group">
              <div class="wizard__step-indicator wizard__step-indicator--${stepState}">
                ${stepState === 'completed' ? '\u2713' : step.num}
              </div>
              <div class="wizard__step-label ${
                stepState === 'active' ? 'wizard__step-label--active' : ''
              }">
                ${step.label}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderStep1() {
    return html`
      <div class="wizard__form">
        <div class="wizard__group">
          <label class="wizard__label" for="sim-name">
            ${msg('Name')} <span class="wizard__required">*</span>
          </label>
          <input
            class="wizard__input ${this._errors.name ? 'wizard__input--error' : ''}"
            id="sim-name"
            type="text"
            placeholder=${msg('My Simulation...')}
            .value=${this._formData.name}
            @input=${(e: Event) => this._handleInput('name', e)}
          />
          ${
            this._errors.name
              ? html`<span class="wizard__error-message">${this._errors.name}</span>`
              : nothing
          }
        </div>

        <div class="wizard__group">
          <label class="wizard__label">${msg('Slug')}</label>
          <div class="wizard__slug-preview">
            ${this._formData.slug || '---'}
          </div>
          ${
            this._errors.slug
              ? html`<span class="wizard__error-message">${this._errors.slug}</span>`
              : nothing
          }
        </div>

        <div class="wizard__group">
          <label class="wizard__label" for="sim-desc">${msg('Description')}</label>
          <textarea
            class="wizard__textarea"
            id="sim-desc"
            placeholder=${msg('Describe your simulation...')}
            .value=${this._formData.description}
            @input=${(e: Event) => this._handleInput('description', e)}
          ></textarea>
        </div>

        <div class="wizard__group">
          <label class="wizard__label" for="sim-theme">${msg('Theme')}</label>
          <select
            class="wizard__select"
            id="sim-theme"
            .value=${this._formData.theme}
            @change=${(e: Event) => this._handleInput('theme', e)}
          >
            <option value="dystopian">${msg('Dystopian')}</option>
            <option value="utopian">${msg('Utopian')}</option>
            <option value="fantasy">${msg('Fantasy')}</option>
            <option value="scifi">${msg('Sci-Fi')}</option>
            <option value="historical">${msg('Historical')}</option>
            <option value="custom">${msg('Custom')}</option>
          </select>
        </div>

        <div class="wizard__group">
          <label class="wizard__label" for="sim-locale">${msg('Content Locale')}</label>
          <select
            class="wizard__select"
            id="sim-locale"
            .value=${this._formData.content_locale}
            @change=${(e: Event) => this._handleInput('content_locale', e)}
          >
            <option value="de">Deutsch (DE)</option>
            <option value="en">English (EN)</option>
          </select>
        </div>
      </div>
    `;
  }

  private _renderStep2() {
    const options: Array<{ value: TaxonomyChoice; title: string; desc: string }> = [
      {
        value: 'defaults',
        title: msg('Import Velgarien defaults'),
        desc: msg(
          'Start with the standard set of taxonomies for professions, building types, and more.',
        ),
      },
      {
        value: 'empty',
        title: msg('Start empty'),
        desc: msg('Begin with a blank slate and define all taxonomies manually.'),
      },
      {
        value: 'custom',
        title: msg('Custom'),
        desc: msg('Select specific taxonomy sets to import. (Not yet available)'),
      },
    ];

    return html`
      <div class="wizard__form">
        <div class="wizard__group">
          <label class="wizard__label">${msg('Taxonomy Setup')}</label>
          <div class="wizard__radio-group">
            ${options.map(
              (opt) => html`
                <label
                  class="wizard__radio-option ${
                    this._formData.taxonomy_choice === opt.value
                      ? 'wizard__radio-option--selected'
                      : ''
                  }"
                >
                  <input
                    class="wizard__radio-input"
                    type="radio"
                    name="taxonomy_choice"
                    .value=${opt.value}
                    .checked=${this._formData.taxonomy_choice === opt.value}
                    @change=${() => this._handleTaxonomyChoice(opt.value)}
                  />
                  <div class="wizard__radio-content">
                    <div class="wizard__radio-title">${opt.title}</div>
                    <div class="wizard__radio-desc">${opt.desc}</div>
                  </div>
                </label>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private _renderStep3() {
    const themeLabels: Record<SimulationTheme, string> = {
      dystopian: msg('Dystopian'),
      utopian: msg('Utopian'),
      fantasy: msg('Fantasy'),
      scifi: msg('Sci-Fi'),
      historical: msg('Historical'),
      custom: msg('Custom'),
    };

    const taxonomyLabels: Record<TaxonomyChoice, string> = {
      defaults: msg('Import Velgarien defaults'),
      empty: msg('Start empty'),
      custom: msg('Custom'),
    };

    const localeLabels: Record<string, string> = {
      de: 'Deutsch (DE)',
      en: 'English (EN)',
    };

    return html`
      <div class="wizard__form">
        ${this._apiError ? html`<div class="wizard__api-error">${this._apiError}</div>` : nothing}

        <div class="wizard__summary">
          <div class="wizard__summary-row">
            <span class="wizard__summary-label">${msg('Name')}</span>
            <span class="wizard__summary-value">${this._formData.name}</span>
          </div>
          <div class="wizard__summary-row">
            <span class="wizard__summary-label">${msg('Slug')}</span>
            <span class="wizard__summary-value">${this._formData.slug}</span>
          </div>
          ${
            this._formData.description
              ? html`
              <div class="wizard__summary-row">
                <span class="wizard__summary-label">${msg('Description')}</span>
                <span class="wizard__summary-value">${this._formData.description}</span>
              </div>
            `
              : nothing
          }
          <div class="wizard__summary-row">
            <span class="wizard__summary-label">${msg('Theme')}</span>
            <span class="wizard__summary-value">
              ${themeLabels[this._formData.theme]}
            </span>
          </div>
          <div class="wizard__summary-row">
            <span class="wizard__summary-label">${msg('Locale')}</span>
            <span class="wizard__summary-value">
              ${localeLabels[this._formData.content_locale] ?? this._formData.content_locale}
            </span>
          </div>
          <div class="wizard__summary-row">
            <span class="wizard__summary-label">${msg('Taxonomies')}</span>
            <span class="wizard__summary-value">
              ${taxonomyLabels[this._formData.taxonomy_choice]}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderCurrentStep() {
    switch (this._step) {
      case 1:
        return this._renderStep1();
      case 2:
        return this._renderStep2();
      case 3:
        return this._renderStep3();
      default:
        return nothing;
    }
  }

  private _renderFooter() {
    return html`
      <div class="footer">
        <div class="footer__left">
          ${
            this._step > 1
              ? html`
              <button
                class="footer__btn footer__btn--back"
                @click=${this._handleBack}
                ?disabled=${this._creating}
              >
                ${msg('Back')}
              </button>
            `
              : nothing
          }
        </div>
        <div class="footer__right">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._creating}
          >
            ${msg('Cancel')}
          </button>
          ${
            this._step < 3
              ? html`
              <button
                class="footer__btn footer__btn--next"
                @click=${this._handleNext}
              >
                ${msg('Next')}
              </button>
            `
              : html`
              <button
                class="footer__btn footer__btn--create"
                @click=${this._handleCreate}
                ?disabled=${this._creating}
              >
                ${this._creating ? msg('Creating...') : msg('Create Simulation')}
              </button>
            `
          }
        </div>
      </div>
    `;
  }

  protected render() {
    const stepTitles: Record<WizardStep, string> = {
      1: msg('Create Simulation - Basic Info'),
      2: msg('Create Simulation - Taxonomies'),
      3: msg('Create Simulation - Confirm'),
    };

    return html`
      <velg-base-modal
        ?open=${this.open}
        @modal-close=${this._handleClose}
      >
        <span slot="header">${stepTitles[this._step]}</span>

        ${this._renderStepIndicator()}
        ${this._renderCurrentStep()}

        <div slot="footer">
          ${this._renderFooter()}
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-create-simulation-wizard': VelgCreateSimulationWizard;
  }
}
