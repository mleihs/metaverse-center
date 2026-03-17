import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/index.js';
import type { Simulation, SimulationTheme } from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';
import { settingsStyles } from '../shared/settings-styles.js';

function getThemeOptions(): Array<{ value: SimulationTheme; label: string }> {
  return [
    { value: 'dystopian', label: msg('Dystopian') },
    { value: 'utopian', label: msg('Utopian') },
    { value: 'fantasy', label: msg('Fantasy') },
    { value: 'scifi', label: msg('Sci-Fi') },
    { value: 'historical', label: msg('Historical') },
    { value: 'custom', label: msg('Custom') },
  ];
}

interface GeneralFormData {
  name: string;
  slug: string;
  description: string;
  theme: SimulationTheme;
}

@localized()
@customElement('velg-general-settings-panel')
export class VelgGeneralSettingsPanel extends LitElement {
  static styles = [
    settingsStyles,
    css`
      .danger-zone {
        margin-top: var(--space-8);
        padding-top: var(--space-6);
        border-top: 2px solid var(--color-danger);
      }

      .danger-zone__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .danger-zone__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-base);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-danger);
        margin: 0;
      }

      .danger-zone__description {
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: var(--leading-relaxed);
        margin: 0 0 var(--space-4) 0;
      }

      .danger-zone__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      @media (max-width: 640px) {
        :host {
          padding: var(--space-3);
        }

        .danger-zone {
          margin-top: var(--space-4);
          padding-top: var(--space-4);
        }

        .danger-zone__actions {
          flex-direction: column;
          align-items: stretch;
        }

        .danger-zone__actions button {
          min-height: 44px;
        }
      }
    `,
  ];

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
  @state() private _deleting = false;

  private get _hasChanges(): boolean {
    return (
      this._formData.name !== this._originalData.name ||
      this._formData.description !== this._originalData.description ||
      this._formData.theme !== this._originalData.theme
    );
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadSettings();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
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
      // Read from the simulations table (via appState or API)
      const sim = appState.currentSimulation.value;

      if (sim && sim.id === this.simulationId) {
        this._populateFromSimulation(sim);
      } else {
        // Fallback: fetch directly
        const response = await simulationsApi.getById(this.simulationId);
        if (response.success && response.data) {
          this._populateFromSimulation(response.data as Simulation);
        } else {
          this._error = response.error?.message ?? msg('Failed to load settings');
        }
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _populateFromSimulation(sim: Simulation): void {
    const formData: GeneralFormData = {
      name: sim.name ?? '',
      slug: sim.slug ?? '',
      description: sim.description ?? '',
      theme: sim.theme ?? 'dystopian',
    };
    this._formData = { ...formData };
    this._originalData = { ...formData };
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
      const updateData: Partial<Simulation> = {};

      if (this._formData.name !== this._originalData.name) {
        updateData.name = this._formData.name;
      }
      if (this._formData.description !== this._originalData.description) {
        updateData.description = this._formData.description;
      }
      if (this._formData.theme !== this._originalData.theme) {
        updateData.theme = this._formData.theme;
      }

      const response = await simulationsApi.update(this.simulationId, updateData);

      if (!response.success) {
        this._error = response.error?.message ?? msg('Failed to save settings');
        VelgToast.error(this._error);
        return;
      }

      // Update appState so header reflects changes immediately
      if (response.data) {
        appState.setCurrentSimulation(response.data as Simulation);
      }

      this._originalData = { ...this._formData };
      VelgToast.success(msg('General settings saved successfully.'));
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  private _renderDangerZone() {
    return html`
      <div class="danger-zone">
        <div class="danger-zone__header">
          <h3 class="danger-zone__title">${msg('Danger Zone')}</h3>
        </div>
        <p class="danger-zone__description">
          ${msg('Deleting this simulation will archive it and remove it from the dashboard for all members. Only a platform admin can restore it.')}
        </p>
        <div class="danger-zone__actions">
          <button
            class="settings-btn settings-btn--danger"
            @click=${this._handleDeleteSimulation}
            ?disabled=${this._deleting}
          >
            ${this._deleting ? msg('Deleting...') : msg('Delete Simulation')}
          </button>
        </div>
      </div>
    `;
  }

  private async _handleDeleteSimulation(): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Simulation'),
      message: msg(
        'This will archive the simulation and hide it from all users. This action can only be reversed by a platform admin. Are you sure?',
      ),
      confirmLabel: msg('Delete Simulation'),
      cancelLabel: msg('Cancel'),
      variant: 'danger',
    });

    if (!confirmed) return;

    this._deleting = true;
    try {
      const response = await simulationsApi.remove(this.simulationId);
      if (!response.success) {
        VelgToast.error(response.error?.message ?? msg('Failed to delete simulation'));
        return;
      }

      VelgToast.success(msg('Simulation deleted.'));
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      VelgToast.error(err instanceof Error ? err.message : msg('An unknown error occurred'));
    } finally {
      this._deleting = false;
    }
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading general settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        <velg-section-header variant="large">${msg('General Settings')}</velg-section-header>

        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <div class="settings-form">
          <div class="settings-form__group">
            <label class="settings-form__label" for="general-name">${msg('Simulation Name')}</label>
            <input
              class="settings-form__input"
              id="general-name"
              type="text"
              placeholder=${msg('Enter simulation name...')}
              .value=${this._formData.name}
              @input=${(e: Event) => this._handleInput('name', e)}
            />
          </div>

          <div class="settings-form__group">
            <label class="settings-form__label" for="general-slug">
              ${msg('Slug')}
              <span class="settings-form__hint">${msg('(read-only, set at creation)')}</span>
            </label>
            <input
              class="settings-form__input settings-form__input--readonly"
              id="general-slug"
              type="text"
              .value=${this._formData.slug}
              readonly
            />
          </div>

          <div class="settings-form__group">
            <label class="settings-form__label" for="general-description">${msg('Description')}</label>
            <textarea
              class="settings-form__textarea"
              id="general-description"
              placeholder=${msg('Describe your simulation world...')}
              .value=${this._formData.description}
              @input=${(e: Event) => this._handleInput('description', e)}
            ></textarea>
          </div>

          <div class="settings-form__group">
            <label class="settings-form__label" for="general-theme">${msg('Theme')}</label>
            <select
              class="settings-form__select"
              id="general-theme"
              .value=${this._formData.theme}
              @change=${(e: Event) => this._handleInput('theme', e)}
            >
              ${getThemeOptions().map(
                (opt) => html`
                  <option value=${opt.value} ?selected=${this._formData.theme === opt.value}>
                    ${opt.label}
                  </option>
                `,
              )}
            </select>
          </div>
        </div>

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Changes')}
          </button>
        </div>

        ${appState.isOwner.value || appState.isPlatformAdmin.value ? this._renderDangerZone() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-general-settings-panel': VelgGeneralSettingsPanel;
  }
}
