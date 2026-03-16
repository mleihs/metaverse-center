import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Resonance, SourceCategory } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

import '../shared/BaseModal.js';

const SOURCE_CATEGORIES: { value: SourceCategory; label: string }[] = [
  { value: 'economic_crisis', label: 'Economic Crisis' },
  { value: 'military_conflict', label: 'Military Conflict' },
  { value: 'pandemic', label: 'Pandemic' },
  { value: 'natural_disaster', label: 'Natural Disaster' },
  { value: 'political_upheaval', label: 'Political Upheaval' },
  { value: 'tech_breakthrough', label: 'Tech Breakthrough' },
  { value: 'cultural_shift', label: 'Cultural Shift' },
  { value: 'environmental_disaster', label: 'Environmental Disaster' },
];

const CATEGORY_DERIVATION: Record<
  string,
  { signatureKey: string; signatureLabel: string; archetype: string }
> = {
  economic_crisis: {
    signatureKey: 'economic_tremor',
    signatureLabel: 'Economic Tremor',
    archetype: 'The Tower',
  },
  military_conflict: {
    signatureKey: 'conflict_wave',
    signatureLabel: 'Conflict Wave',
    archetype: 'The Shadow',
  },
  pandemic: {
    signatureKey: 'biological_tide',
    signatureLabel: 'Biological Tide',
    archetype: 'The Devouring Mother',
  },
  natural_disaster: {
    signatureKey: 'elemental_surge',
    signatureLabel: 'Elemental Surge',
    archetype: 'The Deluge',
  },
  political_upheaval: {
    signatureKey: 'authority_fracture',
    signatureLabel: 'Authority Fracture',
    archetype: 'The Overthrow',
  },
  tech_breakthrough: {
    signatureKey: 'innovation_spark',
    signatureLabel: 'Innovation Spark',
    archetype: 'The Prometheus',
  },
  cultural_shift: {
    signatureKey: 'consciousness_drift',
    signatureLabel: 'Consciousness Drift',
    archetype: 'The Awakening',
  },
  environmental_disaster: {
    signatureKey: 'decay_bloom',
    signatureLabel: 'Decay Bloom',
    archetype: 'The Entropy',
  },
};

@localized()
@customElement('velg-admin-resonance-form-modal')
export class VelgAdminResonanceFormModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    velg-base-modal {
      --modal-max-width: 600px;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .field__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .field__input,
    .field__select,
    .field__textarea {
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      transition: border-color 0.2s ease;
    }

    .field__input:focus,
    .field__select:focus,
    .field__textarea:focus {
      outline: none;
      border-color: var(--color-info);
      box-shadow: 0 0 0 1px var(--color-info);
    }

    .field__textarea {
      min-height: 80px;
      resize: vertical;
    }

    .field__textarea--mono {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      line-height: 1.5;
      min-height: 100px;
    }

    /* ── Derivation Preview ─────────────────────────────── */

    .derivation {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-info) 6%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-info) 20%, var(--color-border));
    }

    .derivation__icon {
      color: var(--color-info);
      flex-shrink: 0;
    }

    .derivation__text {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .derivation__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-info);
    }

    /* ── Magnitude Slider ───────────────────────────────── */

    .magnitude-field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .magnitude-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .magnitude-slider {
      flex: 1;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--color-border);
      outline: none;
      cursor: pointer;
    }

    .magnitude-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-text-primary);
      background: var(--color-surface);
      cursor: pointer;
    }

    .magnitude-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-text-primary);
      background: var(--color-surface);
      cursor: pointer;
      border-radius: 0;
    }

    .magnitude-value {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      min-width: 40px;
      text-align: right;
    }

    .magnitude-value--low { color: var(--color-info); }
    .magnitude-value--mid { color: var(--color-warning); }
    .magnitude-value--high { color: var(--color-danger); }

    /* ── Footer Buttons ─────────────────────────────────── */

    .footer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .btn {
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

    .btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .btn--save {
      background: var(--color-info);
      color: var(--color-text-inverse);
      border-color: var(--color-info);
    }
  `;

  @property({ type: Object }) resonance: Resonance | null = null;

  @state() private _category: SourceCategory | '' = '';
  @state() private _title = '';
  @state() private _description = '';
  @state() private _bureauDispatch = '';
  @state() private _magnitude = 0.5;
  @state() private _impactsAt = '';
  @state() private _saving = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.resonance) {
      this._category = this.resonance.source_category;
      this._title = this.resonance.title;
      this._description = this.resonance.description ?? '';
      this._bureauDispatch = this.resonance.bureau_dispatch ?? '';
      this._magnitude = this.resonance.magnitude;
      this._impactsAt = this.resonance.impacts_at
        ? new Date(this.resonance.impacts_at).toISOString().slice(0, 16)
        : '';
    } else {
      // Default impacts_at to 24h from now
      const d = new Date(Date.now() + 86400000);
      this._impactsAt = d.toISOString().slice(0, 16);
    }
  }

  private get _isEdit(): boolean {
    return !!this.resonance;
  }

  private get _derivation(): {
    signatureKey: string;
    signatureLabel: string;
    archetype: string;
  } | null {
    if (!this._category) return null;
    return CATEGORY_DERIVATION[this._category] ?? null;
  }

  private get _magClass(): string {
    if (this._magnitude >= 0.7) return 'high';
    if (this._magnitude >= 0.4) return 'mid';
    return 'low';
  }

  private get _isValid(): boolean {
    return !!this._category && !!this._title.trim() && !!this._impactsAt;
  }

  private _handleSave(): void {
    if (!this._isValid || this._saving) return;
    this._saving = true;

    const data: Record<string, unknown> = {
      title: this._title.trim(),
      description: this._description.trim() || null,
      bureau_dispatch: this._bureauDispatch.trim() || null,
      magnitude: this._magnitude,
      impacts_at: new Date(this._impactsAt).toISOString(),
    };

    if (!this._isEdit) {
      data.source_category = this._category;
    }

    this.dispatchEvent(
      new CustomEvent('resonance-save', {
        bubbles: true,
        composed: true,
        detail: {
          data,
          resonanceId: this.resonance?.id,
        },
      }),
    );
    this._saving = false;
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <velg-base-modal
        ?open=${true}
        @modal-close=${this._handleClose}
      >
        <span slot="header">
          ${this._isEdit ? msg('Edit Resonance') : msg('Create Resonance')}
        </span>

        <div class="form">
          ${
            this._isEdit
              ? nothing
              : html`
            <div class="field">
              <label class="field__label">${msg('Source Category')}</label>
              <select
                class="field__select"
                .value=${this._category}
                @change=${(e: Event) => {
                  this._category = (e.target as HTMLSelectElement).value as SourceCategory;
                }}
              >
                <option value="" disabled>${msg('Select category...')}</option>
                ${SOURCE_CATEGORIES.map((c) => html`<option value=${c.value}>${c.label}</option>`)}
              </select>
            </div>

            ${
              this._derivation
                ? html`
              <div class="derivation">
                <div class="derivation__icon">
                  ${icons.resonanceArchetype(this._derivation.signatureKey, 20)}
                </div>
                <div class="derivation__text">
                  <span class="derivation__label">${this._derivation.signatureLabel}</span>
                  — ${this._derivation.archetype}
                </div>
              </div>
            `
                : nothing
            }
          `
          }

          <div class="field">
            <label class="field__label">${msg('Title')}</label>
            <input
              class="field__input"
              type="text"
              .value=${this._title}
              @input=${(e: Event) => {
                this._title = (e.target as HTMLInputElement).value;
              }}
              placeholder=${msg('Resonance title...')}
            />
          </div>

          <div class="field">
            <label class="field__label">${msg('Description')}</label>
            <textarea
              class="field__textarea"
              .value=${this._description}
              @input=${(e: Event) => {
                this._description = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('What happened in the real world...')}
            ></textarea>
          </div>

          <div class="field">
            <label class="field__label">${msg('Bureau Dispatch')}</label>
            <textarea
              class="field__textarea field__textarea--mono"
              .value=${this._bureauDispatch}
              @input=${(e: Event) => {
                this._bureauDispatch = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('In-world narrative for the Bureau of Resonance...')}
            ></textarea>
          </div>

          <div class="field magnitude-field">
            <label class="field__label">${msg('Magnitude')}</label>
            <div class="magnitude-row">
              <input
                class="magnitude-slider"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                .value=${String(this._magnitude)}
                @input=${(e: Event) => {
                  this._magnitude = parseFloat((e.target as HTMLInputElement).value);
                }}
              />
              <span class="magnitude-value magnitude-value--${this._magClass}">
                ${this._magnitude.toFixed(2)}
              </span>
            </div>
          </div>

          <div class="field">
            <label class="field__label">${msg('Impacts At')}</label>
            <input
              class="field__input"
              type="datetime-local"
              .value=${this._impactsAt}
              @input=${(e: Event) => {
                this._impactsAt = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        </div>

        <div slot="footer" class="footer-actions">
          <button class="btn btn--cancel" @click=${this._handleClose}>
            ${msg('Cancel')}
          </button>
          <button
            class="btn btn--save"
            ?disabled=${!this._isValid || this._saving}
            @click=${this._handleSave}
          >
            ${this._isEdit ? msg('Save Changes') : msg('Create')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-resonance-form-modal': VelgAdminResonanceFormModal;
  }
}
