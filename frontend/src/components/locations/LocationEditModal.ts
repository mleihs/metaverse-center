import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { locationsApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type { ApiResponse, City, CityStreet, Zone } from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { VelgToast } from '../shared/Toast.js';

type LocationType = 'city' | 'zone' | 'street';

@localized()
@customElement('velg-location-edit-modal')
export class VelgLocationEditModal extends LitElement {
  static styles = [
    formStyles,
    css`
    :host {
      display: block;
    }
  `,
  ];

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
    } catch (err) {
      captureError(err, { source: 'VelgLocationEditModal._handleSubmit', locationType: this.type });
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
