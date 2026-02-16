import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import type { SimulationSetting, SimulationTheme } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

const THEME_OPTIONS: Array<{ value: SimulationTheme; label: string }> = [
  { value: 'dystopian', label: 'Dystopian' },
  { value: 'utopian', label: 'Utopian' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'scifi', label: 'Sci-Fi' },
  { value: 'historical', label: 'Historical' },
  { value: 'custom', label: 'Custom' },
];

interface GeneralFormData {
  name: string;
  slug: string;
  description: string;
  theme: SimulationTheme;
}

@customElement('velg-general-settings-panel')
export class VelgGeneralSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__section-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      padding-bottom: var(--space-2);
      border-bottom: var(--border-default);
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

    .form__hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-sans);
      text-transform: none;
      letter-spacing: normal;
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

    .form__input--readonly {
      background: var(--color-surface-sunken);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }

    .form__textarea {
      min-height: 120px;
      resize: vertical;
    }

    .form__select {
      cursor: pointer;
    }

    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: var(--border-default);
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

    .btn--primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .panel__error {
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

  @property({ type: String }) simulationId = '';

  @state() private _formData: GeneralFormData = {
    name: '',
    slug: '',
    description: '',
    theme: 'dystopian',
  };

  @state() private _originalData: GeneralFormData = {
    name: '',
    slug: '',
    description: '',
    theme: 'dystopian',
  };

  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error: string | null = null;

  private get _hasChanges(): boolean {
    return (
      this._formData.name !== this._originalData.name ||
      this._formData.description !== this._originalData.description ||
      this._formData.theme !== this._originalData.theme
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadSettings();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadSettings();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    // Notify parent about unsaved state changes
    const prevForm = changedProperties.get('_formData') as GeneralFormData | undefined;
    const prevOriginal = changedProperties.get('_originalData') as GeneralFormData | undefined;
    if (prevForm !== undefined || prevOriginal !== undefined) {
      this.dispatchEvent(
        new CustomEvent('unsaved-change', {
          detail: this._hasChanges,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, 'general');

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const formData: GeneralFormData = {
          name: '',
          slug: '',
          description: '',
          theme: 'dystopian',
        };

        for (const setting of settings) {
          const val = setting.setting_value as string;
          switch (setting.setting_key) {
            case 'name':
              formData.name = val ?? '';
              break;
            case 'slug':
              formData.slug = val ?? '';
              break;
            case 'description':
              formData.description = val ?? '';
              break;
            case 'theme':
              formData.theme = (val as SimulationTheme) ?? 'dystopian';
              break;
          }
        }

        this._formData = { ...formData };
        this._originalData = { ...formData };
      } else {
        this._error = response.error?.message ?? 'Failed to load settings';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      this._loading = false;
    }
  }

  private _handleInput(field: keyof GeneralFormData, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this._formData = { ...this._formData, [field]: target.value };
  }

  private async _handleSave(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

    this._saving = true;
    this._error = null;

    try {
      const fieldsToSave: Array<{ key: string; value: string }> = [];

      if (this._formData.name !== this._originalData.name) {
        fieldsToSave.push({ key: 'name', value: this._formData.name });
      }
      if (this._formData.description !== this._originalData.description) {
        fieldsToSave.push({ key: 'description', value: this._formData.description });
      }
      if (this._formData.theme !== this._originalData.theme) {
        fieldsToSave.push({ key: 'theme', value: this._formData.theme });
      }

      for (const field of fieldsToSave) {
        const response = await settingsApi.upsert(this.simulationId, {
          category: 'general',
          setting_key: field.key,
          setting_value: field.value,
        });

        if (!response.success) {
          this._error = response.error?.message ?? `Failed to save ${field.key}`;
          VelgToast.error(`Failed to save ${field.key}`);
          return;
        }
      }

      this._originalData = { ...this._formData };
      VelgToast.success('General settings saved successfully.');
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'An unknown error occurred';
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message="Loading general settings..."></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        <h2 class="panel__section-title">General Settings</h2>

        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        <div class="form">
          <div class="form__group">
            <label class="form__label" for="general-name">Simulation Name</label>
            <input
              class="form__input"
              id="general-name"
              type="text"
              placeholder="Enter simulation name..."
              .value=${this._formData.name}
              @input=${(e: Event) => this._handleInput('name', e)}
            />
          </div>

          <div class="form__group">
            <label class="form__label" for="general-slug">
              Slug
              <span class="form__hint">(read-only, set at creation)</span>
            </label>
            <input
              class="form__input form__input--readonly"
              id="general-slug"
              type="text"
              .value=${this._formData.slug}
              readonly
            />
          </div>

          <div class="form__group">
            <label class="form__label" for="general-description">Description</label>
            <textarea
              class="form__textarea"
              id="general-description"
              placeholder="Describe your simulation world..."
              .value=${this._formData.description}
              @input=${(e: Event) => this._handleInput('description', e)}
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="general-theme">Theme</label>
            <select
              class="form__select"
              id="general-theme"
              .value=${this._formData.theme}
              @change=${(e: Event) => this._handleInput('theme', e)}
            >
              ${THEME_OPTIONS.map(
                (opt) => html`
                  <option value=${opt.value} ?selected=${this._formData.theme === opt.value}>
                    ${opt.label}
                  </option>
                `,
              )}
            </select>
          </div>
        </div>

        <div class="panel__footer">
          <button
            class="btn btn--primary"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-general-settings-panel': VelgGeneralSettingsPanel;
  }
}
