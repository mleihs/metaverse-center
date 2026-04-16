import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi } from '../../services/api/index.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { seoService } from '../../services/SeoService.js';
import type { ApiResponse, Building } from '../../types/index.js';
import { gridLayoutStyles } from '../shared/grid-layout-styles.js';
import { PaginatedLoaderMixin } from '../shared/PaginatedLoaderMixin.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import './BuildingCard.js';
import './BuildingEditModal.js';
import './BuildingDetailsPanel.js';
import './EmbassyCreateModal.js';

@localized()
@customElement('velg-buildings-view')
export class VelgBuildingsView extends SignalWatcher(PaginatedLoaderMixin(LitElement)) {
  static styles = [
    viewHeaderStyles,
    gridLayoutStyles,
    css`
    :host {
      display: block;
    }

    .entity-grid {
      --grid-min-width: 200px;
      gap: var(--space-5);
    }

    @media (max-width: 480px) {
      .entity-grid {
        gap: var(--space-3);
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @property({ type: String }) entitySlug = '';

  @state() private _selectedBuilding: Building | null = null;
  @state() private _editBuilding: Building | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;
  @state() private _embassySourceBuilding: Building | null = null;
  @state() private _showEmbassyModal = false;

  private _disposeImageTracking?: () => void;

  /* ── DataLoaderMixin contract ────────── */

  protected get _buildings(): Building[] {
    return (this._data as Building[]) ?? [];
  }

  protected async _fetchData(): Promise<ApiResponse<Building[]>> {
    return buildingsApi.list(this.simulationId, this._buildParams());
  }

  protected _getLoadingMessage(): string {
    return msg('Loading buildings...');
  }

  protected _getEmptyMessage(): string {
    return msg('No buildings found. Create one to get started.');
  }

  protected _getErrorFallback(): string {
    return msg('An unexpected error occurred while loading buildings');
  }

  protected _onDataLoaded(): void {
    this._checkDeepLink();
    const sim = appState.currentSimulation.value;
    if (sim) {
      seoService.setCollectionPage({
        name: `${sim.name} \u2013 Buildings`,
        description: `All buildings in the ${sim.name} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/buildings`,
        numberOfItems: this._total,
      });
    }
  }

  connectedCallback(): void {
    super.connectedCallback(); // mixin auto-loads
    this._disposeImageTracking = effect(() => {
      const version = forgeStateManager.imageUpdateVersion.value;
      if (version > 0 && this._buildings.length > 0) {
        this._load();
      }
    });
  }

  disconnectedCallback(): void {
    this._disposeImageTracking?.();
    seoService.removeStructuredData();
    super.disconnectedCallback();
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

  private async _checkDeepLink(): Promise<void> {
    // Slug-based deep link from URL route (primary)
    if (this.entitySlug) {
      const building = this._buildings.find((b) => b.slug === this.entitySlug);
      if (building) {
        this._selectedBuilding = building;
        this._showDetails = true;
        this._setBuildingStructuredData(building);
        return;
      }
      // Building not in current page — fetch by slug from API
      try {
        const resp = await buildingsApi.getBySlug(this.simulationId, this.entitySlug);
        if (resp.success && resp.data) {
          this._selectedBuilding = resp.data as Building;
          this._showDetails = true;
          this._setBuildingStructuredData(resp.data as Building);
          return;
        }
      } catch {
        // Fall through
      }
    }
    // Legacy ID-based deep link (backward compat)
    const buildingId = appState.pendingOpenBuildingId.value;
    if (!buildingId) return;
    appState.pendingOpenBuildingId.value = null;

    const building = this._buildings.find((b) => b.id === buildingId);
    if (building) {
      this._selectedBuilding = building;
      this._showDetails = true;
    }
  }

  private _handleBuildingClick(e: CustomEvent<Building>): void {
    this._selectedBuilding = e.detail;
    this._showDetails = true;
    this._pushEntityUrl(e.detail);
    this._setBuildingStructuredData(e.detail);
  }

  private _pushEntityUrl(building: Building): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug || !building.slug) return;
    const entityPath = `/simulations/${sim.slug}/buildings/${building.slug}`;
    if (window.location.pathname !== entityPath) {
      window.history.pushState({}, '', entityPath);
    }
  }

  private _pushListUrl(): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug) return;
    const listPath = `/simulations/${sim.slug}/buildings`;
    if (window.location.pathname !== listPath) {
      window.history.pushState({}, '', listPath);
    }
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
        this._load();
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
    this._load();
  }

  private _handleDetailsClose(): void {
    this._showDetails = false;
    this._selectedBuilding = null;
    this._pushListUrl();
    // Revert to CollectionPage schema when detail panel closes
    const sim = appState.currentSimulation.value;
    if (sim) {
      seoService.setCollectionPage({
        name: `${sim.name} \u2013 Buildings`,
        description: `All buildings in the ${sim.name} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/buildings`,
        numberOfItems: this._total,
      });
    }
  }

  /** Set Place schema.org structured data for the currently viewed building. */
  private _setBuildingStructuredData(building: Building): void {
    const sim = appState.currentSimulation.value;
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: building.name,
      ...(building.description ? { description: building.description.substring(0, 200) } : {}),
      ...(building.image_url ? { image: building.image_url } : {}),
      ...(building.building_type ? { additionalType: building.building_type } : {}),
      ...(sim ? { containedInPlace: { '@type': 'VirtualLocation', name: sim.name } } : {}),
      url: `https://metaverse.center/simulations/${sim?.slug ?? ''}/buildings/${building.slug ?? ''}`,
    });
  }

  private _handleLightboxPrev(): void {
    const idx = this._selectedBuilding ? this._buildings.indexOf(this._selectedBuilding) : -1;
    if (idx > 0) {
      this._selectedBuilding = this._buildings[idx - 1];
      this._pushEntityUrl(this._selectedBuilding);
    }
  }

  private _handleLightboxNext(): void {
    const idx = this._selectedBuilding ? this._buildings.indexOf(this._selectedBuilding) : -1;
    if (idx >= 0 && idx < this._buildings.length - 1) {
      this._selectedBuilding = this._buildings[idx + 1];
      this._pushEntityUrl(this._selectedBuilding);
    }
  }

  private _handleEmbassyEstablish(e: CustomEvent<Building>): void {
    this._embassySourceBuilding = e.detail;
    this._showEmbassyModal = true;
    this._showDetails = false;
  }

  private _handleEmbassyCreated(): void {
    this._showEmbassyModal = false;
    this._embassySourceBuilding = null;
    this._load();
  }

  private _handleEmbassyModalClose(): void {
    this._showEmbassyModal = false;
    this._embassySourceBuilding = null;
  }

  protected render() {
    return html`
      <section class="view" aria-label=${msg('Buildings')}>
        <header class="view__header">
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
        </header>

        <velg-filter-bar
          .filters=${this._getFilterConfigs()}
          search-placeholder=${msg('Search buildings...')}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        ${this._renderDataGuard(() => this._renderGrid())}

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
          container="lightbox"
          .totalEntities=${this._buildings.length}
          .currentIndex=${this._selectedBuilding ? this._buildings.indexOf(this._selectedBuilding) : 0}
          @panel-close=${this._handleDetailsClose}
          @lightbox-prev=${this._handleLightboxPrev}
          @lightbox-next=${this._handleLightboxNext}
          @building-edit=${this._handleBuildingEdit}
          @building-delete=${this._handleBuildingDelete}
          @embassy-establish=${this._handleEmbassyEstablish}
        ></velg-building-details-panel>

        <velg-embassy-create-modal
          ?open=${this._showEmbassyModal}
          .sourceBuilding=${this._embassySourceBuilding}
          @embassy-created=${this._handleEmbassyCreated}
          @modal-close=${this._handleEmbassyModalClose}
        ></velg-embassy-create-modal>
      </section>
    `;
  }

  protected _renderEmptyState() {
    return html`
      <velg-empty-state
        message=${this._getEmptyMessage()}
        cta-label=${this._canEdit ? msg('Create Building') : ''}
        @cta-click=${this._handleCreateClick}
      ></velg-empty-state>
    `;
  }

  private _renderGrid() {
    return html`
      <span class="view__count">${this._total !== 1 ? msg(str`${this._total} buildings total`) : msg(str`${this._total} building total`)}</span>

      <div class="entity-grid">
        ${this._buildings.map(
          (building, i) => html`
            <velg-building-card
              style="--i: ${i}"
              .building=${building}
              ?generating=${forgeStateManager.imageTrackingSlug.value === (appState.currentSimulation.value?.slug ?? '') && !building.image_url}
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
