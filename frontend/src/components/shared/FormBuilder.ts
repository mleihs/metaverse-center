import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  name: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  label: string;
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
}

@customElement('velg-form-builder')
export class VelgFormBuilder extends LitElement {
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

    .form__group--checkbox {
      flex-direction: row;
      align-items: center;
      gap: var(--space-2);
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
      border-radius: var(--border-radius);
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

    .form__checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--color-primary);
      flex-shrink: 0;
    }

    .form__checkbox-label {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      color: var(--color-text-primary);
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

    .form__input--error:focus,
    .form__textarea--error:focus,
    .form__select--error:focus {
      box-shadow: var(--ring-danger);
    }

    .form__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: var(--border-light);
    }

    .form__submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2-5) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .form__submit:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .form__submit:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .form__submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  `;

  @property({ type: Array }) fields: FieldConfig[] = [];
  @property({ attribute: false }) onValidate:
    | ((data: Record<string, unknown>) => Record<string, string>)
    | null = null;

  @state() private _formData: Record<string, unknown> = {};
  @state() private _errors: Record<string, string> = {};

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('fields')) {
      this._initFormData();
    }
  }

  private _initFormData(): void {
    const data: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (!(field.name in this._formData)) {
        data[field.name] = field.type === 'checkbox' ? false : '';
      } else {
        data[field.name] = this._formData[field.name];
      }
    }
    this._formData = data;
  }

  private _handleInput(name: string, e: Event): void {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    this._formData = { ...this._formData, [name]: value };

    // Clear field error on input
    if (this._errors[name]) {
      const updated = { ...this._errors };
      delete updated[name];
      this._errors = updated;
    }

    this.dispatchEvent(
      new CustomEvent('form-change', {
        detail: { ...this._formData },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSubmit(e: Event): void {
    e.preventDefault();

    // Built-in required validation
    const errors: Record<string, string> = {};
    for (const field of this.fields) {
      if (field.required) {
        const val = this._formData[field.name];
        if (val === '' || val === undefined || val === null) {
          errors[field.name] = `${field.label} is required`;
        }
      }
    }

    // Custom validation
    if (this.onValidate) {
      const customErrors = this.onValidate(this._formData);
      Object.assign(errors, customErrors);
    }

    if (Object.keys(errors).length > 0) {
      this._errors = errors;
      return;
    }

    this._errors = {};
    this.dispatchEvent(
      new CustomEvent('form-submit', {
        detail: { ...this._formData },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderField(field: FieldConfig) {
    const errorClass = this._errors[field.name] ? '--error' : '';

    switch (field.type) {
      case 'text':
      case 'number':
        return html`
          <div class="form__group">
            <label class="form__label" for=${field.name}>
              ${field.label}
              ${field.required ? html`<span class="form__required">*</span>` : nothing}
            </label>
            <input
              class="form__input ${errorClass ? `form__input${errorClass}` : ''}"
              id=${field.name}
              type=${field.type}
              placeholder=${field.placeholder ?? ''}
              .value=${String(this._formData[field.name] ?? '')}
              @input=${(e: Event) => this._handleInput(field.name, e)}
            />
            ${
              this._errors[field.name]
                ? html`<span class="form__error">${this._errors[field.name]}</span>`
                : nothing
            }
          </div>
        `;

      case 'textarea':
        return html`
          <div class="form__group">
            <label class="form__label" for=${field.name}>
              ${field.label}
              ${field.required ? html`<span class="form__required">*</span>` : nothing}
            </label>
            <textarea
              class="form__textarea ${errorClass ? `form__textarea${errorClass}` : ''}"
              id=${field.name}
              placeholder=${field.placeholder ?? ''}
              .value=${String(this._formData[field.name] ?? '')}
              @input=${(e: Event) => this._handleInput(field.name, e)}
            ></textarea>
            ${
              this._errors[field.name]
                ? html`<span class="form__error">${this._errors[field.name]}</span>`
                : nothing
            }
          </div>
        `;

      case 'select':
        return html`
          <div class="form__group">
            <label class="form__label" for=${field.name}>
              ${field.label}
              ${field.required ? html`<span class="form__required">*</span>` : nothing}
            </label>
            <select
              class="form__select ${errorClass ? `form__select${errorClass}` : ''}"
              id=${field.name}
              .value=${String(this._formData[field.name] ?? '')}
              @change=${(e: Event) => this._handleInput(field.name, e)}
            >
              <option value="">Select ${field.label}...</option>
              ${(field.options ?? []).map(
                (opt) => html`
                  <option value=${opt.value}>${opt.label}</option>
                `,
              )}
            </select>
            ${
              this._errors[field.name]
                ? html`<span class="form__error">${this._errors[field.name]}</span>`
                : nothing
            }
          </div>
        `;

      case 'checkbox':
        return html`
          <div class="form__group form__group--checkbox">
            <input
              class="form__checkbox"
              id=${field.name}
              type="checkbox"
              .checked=${Boolean(this._formData[field.name])}
              @change=${(e: Event) => this._handleInput(field.name, e)}
            />
            <label class="form__checkbox-label" for=${field.name}>
              ${field.label}
            </label>
            ${
              this._errors[field.name]
                ? html`<span class="form__error">${this._errors[field.name]}</span>`
                : nothing
            }
          </div>
        `;

      default:
        return nothing;
    }
  }

  protected render() {
    return html`
      <form class="form" @submit=${this._handleSubmit} novalidate>
        ${this.fields.map((field) => this._renderField(field))}

        <div class="form__actions">
          <button class="form__submit" type="submit">
            Submit
          </button>
        </div>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-form-builder': VelgFormBuilder;
  }
}
