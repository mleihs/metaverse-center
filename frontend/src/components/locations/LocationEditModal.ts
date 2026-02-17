import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { locationsApi } from '../../services/api/index.js';
import type { ApiResponse, City, CityStreet, Zone } from '../../types/index.js';
import '../shared/BaseModal.js';
import { VelgToast } from '../shared/Toast.js';

type LocationType = 'city' | 'zone' | 'street';

@localized()
@customElement('velg-location-edit-modal')
export class VelgLocationEditModal extends LitElement {
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
    .form__textarea {
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
    .form__textarea:focus {
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

    .form__input--error,
    .form__textarea--error {
      border-color: var(--color-border-danger);
    }

    .form__error {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      color: var(--color-text-danger);
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
  `;

  @property({ type: String }) type: LocationType = 'city';
  @property({ attribute: false }) item: City | Zone | CityStreet | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: String }) cityId = '';
  @property({ type: String }) zoneId = '';
  @property({ type: Boolean }) open = false;

  @state() private _name = '';
  @state() private _description = '';
  @state() private _saving = false;
  @state() private _errors: Record<string, string> = {};

  private get _isEdit(): boolean {
    return this.item !== null;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('item') || changedProperties.has('open')) {
      if (this.open) {
        this._populateForm();
      }
    }
  }

  private _populateForm(): void {
    if (this.item) {
      this._name = this.item.name ?? '';
      this._description =
        ('description' in this.item ? (this.item as City | Zone).description : '') ?? '';
    } else {
      this._name = '';
      this._description = '';
    }
    this._errors = {};
  }

  private _validate(): boolean {
    const errors: Record<string, string> = {};

    if (!this._name.trim()) {
      errors.name = msg('Name is required');
    }

    this._errors = errors;
    return Object.keys(errors).length === 0;
  }

  private async _handleSubmit(e?: Event): Promise<void> {
    e?.preventDefault();

    if (!this._validate()) return;

    this._saving = true;

    try {
      let response: ApiResponse<City | Zone | CityStreet>;

      if (this.type === 'city') {
        const data: Partial<City> = {
          name: this._name.trim(),
          description: this._description.trim() || undefined,
        };

        if (this._isEdit && this.item) {
          response = await locationsApi.updateCity(this.simulationId, this.item.id, data);
        } else {
          response = await locationsApi.createCity(this.simulationId, data);
        }
      } else if (this.type === 'zone') {
        const data: Partial<Zone> = {
          name: this._name.trim(),
          description: this._description.trim() || undefined,
          city_id: this.cityId,
        };

        if (this._isEdit && this.item) {
          response = await locationsApi.updateZone(this.simulationId, this.item.id, data);
        } else {
          response = await locationsApi.createZone(this.simulationId, data);
        }
      } else {
        const data: Partial<CityStreet> = {
          name: this._name.trim(),
          zone_id: this.zoneId,
          city_id: this.cityId,
        };

        if (this._isEdit && this.item) {
          response = await locationsApi.updateStreet(this.simulationId, this.item.id, data);
        } else {
          response = await locationsApi.createStreet(this.simulationId, data);
        }
      }

      if (response.success && response.data) {
        VelgToast.success(
          this._isEdit
            ? msg(str`${this._typeLabel} updated successfully`)
            : msg(str`${this._typeLabel} created successfully`),
        );
        this.dispatchEvent(
          new CustomEvent('location-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        VelgToast.error(response.error?.message ?? msg(str`Failed to save ${this.type}`));
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

  private get _typeLabel(): string {
    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }

  protected render() {
    const title = this._isEdit
      ? msg(str`Edit ${this._typeLabel}`)
      : msg(str`Create ${this._typeLabel}`);

    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${title}</span>

        <form class="form" @submit=${this._handleSubmit} novalidate>
          <div class="form__group">
            <label class="form__label" for="location-name">
              ${msg('Name')} <span class="form__required">*</span>
            </label>
            <input
              class="form__input ${this._errors.name ? 'form__input--error' : ''}"
              id="location-name"
              type="text"
              placeholder=${msg(str`Enter ${this.type} name`)}
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

          ${
            this.type !== 'street'
              ? html`
                <div class="form__group">
                  <label class="form__label" for="location-description">
                    ${msg('Description')}
                  </label>
                  <textarea
                    class="form__textarea"
                    id="location-description"
                    placeholder=${msg(str`Describe the ${this.type}...`)}
                    .value=${this._description}
                    @input=${(e: Event) => {
                      this._description = (e.target as HTMLTextAreaElement).value;
                    }}
                  ></textarea>
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
            ${this._saving ? msg('Saving...') : this._isEdit ? msg('Save Changes') : msg(str`Create ${this._typeLabel}`)}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-location-edit-modal': VelgLocationEditModal;
  }
}
