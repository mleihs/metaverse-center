import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { taxonomiesApi } from '../../services/api/index.js';
import type { SimulationTaxonomy, TaxonomyType } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

const TAXONOMY_TYPES: Array<{ value: TaxonomyType; label: string }> = [
  { value: 'gender', label: 'Gender' },
  { value: 'profession', label: 'Profession' },
  { value: 'system', label: 'System' },
  { value: 'building_type', label: 'Building Type' },
  { value: 'building_style', label: 'Building Style' },
  { value: 'building_special_type', label: 'Building Special Type' },
  { value: 'campaign_type', label: 'Campaign Type' },
  { value: 'target_demographic', label: 'Target Demographic' },
  { value: 'urgency_level', label: 'Urgency Level' },
  { value: 'zone_type', label: 'Zone Type' },
  { value: 'security_level', label: 'Security Level' },
  { value: 'event_type', label: 'Event Type' },
  { value: 'sentiment', label: 'Sentiment' },
  { value: 'interaction_type', label: 'Interaction Type' },
  { value: 'campaign_tone', label: 'Campaign Tone' },
  { value: 'complexity_level', label: 'Complexity Level' },
];

interface NewTaxonomyForm {
  value: string;
  label: string;
  sort_order: number;
}

@customElement('velg-world-settings-panel')
export class VelgWorldSettingsPanel extends LitElement {
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

    .panel__controls {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .form__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      flex-shrink: 0;
    }

    .form__select {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      min-width: 200px;
    }

    .form__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .table-wrapper {
      border: var(--border-default);
      overflow-x: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table__head {
      background: var(--color-surface-raised);
    }

    .table__th {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      text-align: left;
      padding: var(--space-2-5) var(--space-3);
      border-bottom: var(--border-default);
    }

    .table__td {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2-5) var(--space-3);
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-primary);
    }

    .table__tr:last-child .table__td {
      border-bottom: none;
    }

    .table__empty {
      text-align: center;
      padding: var(--space-6);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-thin) solid;
    }

    .badge--active {
      color: var(--color-success);
      border-color: var(--color-success);
      background: rgba(34, 197, 94, 0.1);
    }

    .badge--inactive {
      color: var(--color-text-muted);
      border-color: var(--color-border-light);
      background: var(--color-surface-sunken);
    }

    .toggle-btn {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .toggle-btn:hover {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
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

    .btn--secondary {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .add-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: var(--border-default);
      background: var(--color-surface-raised);
    }

    .add-form__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
    }

    .add-form__row {
      display: flex;
      gap: var(--space-3);
      align-items: end;
    }

    .add-form__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1;
    }

    .add-form__group--narrow {
      flex: 0 0 100px;
    }

    .form__input {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      box-sizing: border-box;
    }

    .form__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__input::placeholder {
      color: var(--color-text-muted);
    }

    .add-form__actions {
      display: flex;
      gap: var(--space-2);
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

  @state() private _selectedType: TaxonomyType = 'gender';
  @state() private _taxonomies: SimulationTaxonomy[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _showAddForm = false;
  @state() private _newForm: NewTaxonomyForm = { value: '', label: '', sort_order: 0 };
  @state() private _addingSaving = false;

  private get _filteredTaxonomies(): SimulationTaxonomy[] {
    return this._taxonomies
      .filter((t) => t.taxonomy_type === this._selectedType)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  private get _locale(): string {
    return appState.currentSimulation.value?.content_locale ?? 'en';
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadTaxonomies();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadTaxonomies();
    }
  }

  private async _loadTaxonomies(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await taxonomiesApi.list(this.simulationId);

      if (response.success && response.data) {
        // The response data may be paginated or a direct array
        const data = response.data;
        if (Array.isArray(data)) {
          this._taxonomies = data;
        } else if (data && typeof data === 'object' && 'data' in data) {
          this._taxonomies = (data as { data: SimulationTaxonomy[] }).data ?? [];
        } else {
          this._taxonomies = [];
        }
      } else {
        this._error = response.error?.message ?? 'Failed to load taxonomies';
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      this._loading = false;
    }
  }

  private _handleTypeChange(e: Event): void {
    const target = e.target as HTMLSelectElement;
    this._selectedType = target.value as TaxonomyType;
    this._showAddForm = false;
  }

  private _handleShowAddForm(): void {
    const maxSort = this._filteredTaxonomies.reduce((max, t) => Math.max(max, t.sort_order), 0);
    this._newForm = { value: '', label: '', sort_order: maxSort + 10 };
    this._showAddForm = true;
  }

  private _handleCancelAdd(): void {
    this._showAddForm = false;
    this._newForm = { value: '', label: '', sort_order: 0 };
  }

  private _handleNewFormInput(field: keyof NewTaxonomyForm, e: Event): void {
    const target = e.target as HTMLInputElement;
    if (field === 'sort_order') {
      this._newForm = { ...this._newForm, [field]: Number.parseInt(target.value, 10) || 0 };
    } else {
      this._newForm = { ...this._newForm, [field]: target.value };
    }
  }

  private async _handleAddTaxonomy(): Promise<void> {
    if (!this._newForm.value.trim() || !this._newForm.label.trim()) {
      VelgToast.warning('Value and label are required.');
      return;
    }

    this._addingSaving = true;

    try {
      const response = await taxonomiesApi.create(this.simulationId, {
        taxonomy_type: this._selectedType,
        value: this._newForm.value.trim(),
        label: { [this._locale]: this._newForm.label.trim() },
        sort_order: this._newForm.sort_order,
        is_active: true,
        is_default: false,
      });

      if (response.success) {
        VelgToast.success('Taxonomy value added.');
        this._showAddForm = false;
        this._newForm = { value: '', label: '', sort_order: 0 };
        this._loadTaxonomies();
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to add taxonomy value.');
      }
    } catch (err) {
      VelgToast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      this._addingSaving = false;
    }
  }

  private async _handleToggleActive(taxonomy: SimulationTaxonomy): Promise<void> {
    try {
      const newActive = !taxonomy.is_active;
      const response = await taxonomiesApi.update(this.simulationId, taxonomy.id, {
        is_active: newActive,
      });

      if (response.success) {
        VelgToast.success(`Taxonomy value ${newActive ? 'activated' : 'deactivated'}.`);
        this._loadTaxonomies();
      } else {
        VelgToast.error(response.error?.message ?? 'Failed to update taxonomy.');
      }
    } catch (err) {
      VelgToast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
    }
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message="Loading world taxonomies..."></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        <h2 class="panel__section-title">World Taxonomies</h2>

        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        <div class="panel__controls">
          <label class="form__label" for="taxonomy-type">Taxonomy Type</label>
          <select
            class="form__select"
            id="taxonomy-type"
            .value=${this._selectedType}
            @change=${this._handleTypeChange}
          >
            ${TAXONOMY_TYPES.map(
              (opt) => html`
                <option value=${opt.value} ?selected=${this._selectedType === opt.value}>
                  ${opt.label}
                </option>
              `,
            )}
          </select>

          <button
            class="btn btn--primary"
            @click=${this._handleShowAddForm}
            ?disabled=${this._showAddForm}
          >
            + Add Value
          </button>
        </div>

        ${this._showAddForm ? this._renderAddForm() : nothing}

        <div class="table-wrapper">
          <table class="table">
            <thead class="table__head">
              <tr>
                <th class="table__th">Value</th>
                <th class="table__th">Label</th>
                <th class="table__th">Sort Order</th>
                <th class="table__th">Status</th>
                <th class="table__th">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                this._filteredTaxonomies.length === 0
                  ? html`
                    <tr>
                      <td class="table__empty" colspan="5">
                        No values for this taxonomy type.
                      </td>
                    </tr>
                  `
                  : this._filteredTaxonomies.map(
                      (tax) => html`
                      <tr class="table__tr">
                        <td class="table__td"><code>${tax.value}</code></td>
                        <td class="table__td">${tax.label[this._locale] ?? tax.value}</td>
                        <td class="table__td">${tax.sort_order}</td>
                        <td class="table__td">
                          <span class="badge ${tax.is_active ? 'badge--active' : 'badge--inactive'}">
                            ${tax.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td class="table__td">
                          <button
                            class="toggle-btn"
                            @click=${() => this._handleToggleActive(tax)}
                          >
                            ${tax.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    `,
                    )
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderAddForm() {
    return html`
      <div class="add-form">
        <h3 class="add-form__title">Add New ${this._selectedType.replace(/_/g, ' ')} Value</h3>
        <div class="add-form__row">
          <div class="add-form__group">
            <label class="form__label">Value (code)</label>
            <input
              class="form__input"
              type="text"
              placeholder="e.g. male, warrior..."
              .value=${this._newForm.value}
              @input=${(e: Event) => this._handleNewFormInput('value', e)}
            />
          </div>
          <div class="add-form__group">
            <label class="form__label">Label (display)</label>
            <input
              class="form__input"
              type="text"
              placeholder="e.g. Male, Warrior..."
              .value=${this._newForm.label}
              @input=${(e: Event) => this._handleNewFormInput('label', e)}
            />
          </div>
          <div class="add-form__group add-form__group--narrow">
            <label class="form__label">Sort</label>
            <input
              class="form__input"
              type="number"
              .value=${String(this._newForm.sort_order)}
              @input=${(e: Event) => this._handleNewFormInput('sort_order', e)}
            />
          </div>
        </div>
        <div class="add-form__actions">
          <button
            class="btn btn--secondary"
            @click=${this._handleCancelAdd}
          >
            Cancel
          </button>
          <button
            class="btn btn--primary"
            @click=${this._handleAddTaxonomy}
            ?disabled=${this._addingSaving}
          >
            ${this._addingSaving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-world-settings-panel': VelgWorldSettingsPanel;
  }
}
