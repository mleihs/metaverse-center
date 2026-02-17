import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi } from '../../services/api/index.js';
import type { Building } from '../../types/index.js';
import type { FilterChangeDetail } from '../shared/SharedFilterBar.js';
import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import './BuildingCard.js';
import './BuildingEditModal.js';
import './BuildingDetailsPanel.js';

@localized()
@customElement('velg-buildings-view')
export class VelgBuildingsView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .view {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .view__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .view__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .view__create-btn {
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
      white-space: nowrap;
    }

    .view__create-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .view__create-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .view__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-5);
    }

    .view__count {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _buildings: Building[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _limit = 25;
  @state() private _offset = 0;
  @state() private _filters: Record<string, string> = {};
  @state() private _search = '';
  @state() private _selectedBuilding: Building | null = null;
  @state() private _editBuilding: Building | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadBuildings();
  }

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  private _getFilterConfigs() {
    const buildingTypes = appState
      .getTaxonomiesByType('building_type')
      .filter((t) => t.is_active)
      .map((t) => ({
        value: t.value,
        label: t.label[appState.currentSimulation.value?.content_locale ?? 'en'] ?? t.value,
      }));

    return [
      {
        key: 'building_type',
        label: msg('Type'),
        options: buildingTypes,
      },
      {
        key: 'building_condition',
        label: msg('Condition'),
        options: [
          { value: 'good', label: msg('Good') },
          { value: 'fair', label: msg('Fair') },
          { value: 'poor', label: msg('Poor') },
          { value: 'ruined', label: msg('Ruined') },
        ],
      },
    ];
  }

  private async _loadBuildings(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const params: Record<string, string> = {
        limit: String(this._limit),
        offset: String(this._offset),
      };

      if (this._search) {
        params.search = this._search;
      }

      for (const [key, value] of Object.entries(this._filters)) {
        params[key] = value;
      }

      const response = await buildingsApi.list(this.simulationId, params);

      if (response.success && response.data) {
        this._buildings = Array.isArray(response.data) ? response.data : [];
        this._total = response.meta?.total ?? this._buildings.length;
      } else {
        this._error = response.error?.message ?? msg('Failed to load buildings');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading buildings');
    } finally {
      this._loading = false;
    }
  }

  private _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void {
    this._filters = e.detail.filters;
    this._search = e.detail.search;
    this._offset = 0;
    this._loadBuildings();
  }

  private _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void {
    this._limit = e.detail.limit;
    this._offset = e.detail.offset;
    this._loadBuildings();
  }

  private _handleBuildingClick(e: CustomEvent<Building>): void {
    this._selectedBuilding = e.detail;
    this._showDetails = true;
  }

  private _handleBuildingEdit(e: CustomEvent<Building>): void {
    this._editBuilding = e.detail;
    this._showEditModal = true;
    this._showDetails = false;
  }

  private async _handleBuildingDelete(e: CustomEvent<Building>): Promise<void> {
    const building = e.detail;

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Building'),
      message: msg(
        str`Are you sure you want to delete "${building.name}"? This action cannot be undone.`,
      ),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await buildingsApi.remove(this.simulationId, building.id);

      if (response.success) {
        VelgToast.success(msg(str`"${building.name}" has been deleted`));
        this._showDetails = false;
        this._selectedBuilding = null;
        this._loadBuildings();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to delete building'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while deleting'));
    }
  }

  private _handleCreateClick(): void {
    this._editBuilding = null;
    this._showEditModal = true;
  }

  private _handleEditModalClose(): void {
    this._showEditModal = false;
    this._editBuilding = null;
  }

  private _handleBuildingSaved(_e: CustomEvent<Building>): void {
    this._showEditModal = false;
    this._editBuilding = null;
    this._loadBuildings();
  }

  private _handleDetailsClose(): void {
    this._showDetails = false;
    this._selectedBuilding = null;
  }

  private _handleRetry(): void {
    this._loadBuildings();
  }

  protected render() {
    return html`
      <div class="view">
        <div class="view__header">
          <h1 class="view__title">${msg('Buildings')}</h1>
          ${
            this._canEdit
              ? html`
                <button class="view__create-btn" @click=${this._handleCreateClick}>
                  ${msg('+ Create Building')}
                </button>
              `
              : nothing
          }
        </div>

        <velg-filter-bar
          .filters=${this._getFilterConfigs()}
          search-placeholder=${msg('Search buildings...')}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        ${this._renderContent()}

        <velg-building-edit-modal
          .building=${this._editBuilding}
          .simulationId=${this.simulationId}
          ?open=${this._showEditModal}
          @modal-close=${this._handleEditModalClose}
          @building-saved=${this._handleBuildingSaved}
        ></velg-building-edit-modal>

        <velg-building-details-panel
          .building=${this._selectedBuilding}
          .simulationId=${this.simulationId}
          ?open=${this._showDetails}
          @panel-close=${this._handleDetailsClose}
          @building-edit=${this._handleBuildingEdit}
          @building-delete=${this._handleBuildingDelete}
        ></velg-building-details-panel>
      </div>
    `;
  }

  private _renderContent() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading buildings...')}></velg-loading-state>`;
    }

    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._handleRetry}
        ></velg-error-state>
      `;
    }

    if (this._buildings.length === 0) {
      return html`
        <velg-empty-state
          message=${msg('No buildings found. Create one to get started.')}
          cta-label=${this._canEdit ? msg('Create Building') : ''}
          @cta-click=${this._handleCreateClick}
        ></velg-empty-state>
      `;
    }

    return html`
      <span class="view__count">${this._total !== 1 ? msg(str`${this._total} buildings total`) : msg(str`${this._total} building total`)}</span>

      <div class="view__grid">
        ${this._buildings.map(
          (building) => html`
            <velg-building-card
              .building=${building}
              @building-click=${this._handleBuildingClick}
              @building-edit=${this._handleBuildingEdit}
              @building-delete=${this._handleBuildingDelete}
            ></velg-building-card>
          `,
        )}
      </div>

      <velg-pagination
        .total=${this._total}
        .limit=${this._limit}
        .offset=${this._offset}
        @page-change=${this._handlePageChange}
      ></velg-pagination>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-buildings-view': VelgBuildingsView;
  }
}
