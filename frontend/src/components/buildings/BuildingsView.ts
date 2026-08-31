import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { buildingsApi } from '../../services/api/index.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { seoService } from '../../services/SeoService.js';
import { applyBuildingDetailSeo, applySimulationViewSeo } from '../../services/seo-patterns.js';
import type { ApiResponse, Building } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { updateUrl } from '../../utils/navigation.js';
import { gridLayoutStyles } from '../shared/grid-layout-styles.js';
import { PaginatedLoaderMixin } from '../shared/PaginatedLoaderMixin.js';
import { titleGroupStyles } from '../shared/title-group-styles.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/VelgHelpTip.js';
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
    titleGroupStyles,
    gridLayoutStyles,
    css`
    :host {
      display: block;
    }

    /* Three across, as the handoff draws it. A building card carries a full
       prose description, not a label, and at --grid-min-width: 200px the
       auto-fill packed five or six into a wide viewport and squeezed that
       prose into a column two words wide. The minimum is what governs an
       auto-fill grid, so raising it is what produces three - stating "3"
       directly would break the narrow case the auto-fill handles for free. */
    .entity-grid {
      --grid-min-width: 320px;
      gap: var(--space-5);
    }

    @media (max-width: 480px) {
      .entity-grid {
        gap: var(--space-3);
      }
    }

    /* ── Occupancy legend ──────────────────────────────
       The marks on the cards read as a scale only if the scale is written
       down once. The handoff draws them as the glyphs "●◐○"; they are drawn
       here instead, because they denote a state rather than decorate one and
       a glyph is not an icon - and because a drawn disc scales with the text
       while a glyph is at the mercy of whichever font resolves it. */
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-5);
      margin-top: var(--space-5);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border-light);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .legend__item {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .legend__mark {
      width: 10px;
      height: 10px;
      border-radius: var(--border-radius-full);
      border: 1px solid currentColor;
      flex-shrink: 0;
    }

    .legend__mark--full {
      background: currentColor;
      color: var(--color-success);
    }

    /* Half taken: the disc is filled on one side only. A linear-gradient with
       a hard stop, not a rotated half-element - nothing on this platform is
       allowed to be rotated. */
    .legend__mark--partial {
      background: linear-gradient(90deg, currentColor 50%, transparent 50%);
      color: var(--color-warning);
    }

    .legend__mark--sparse {
      color: var(--color-danger);
    }

    .legend__mark--ruined {
      color: var(--color-text-muted);
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
    return buildingsApi.list(
      this.simulationId,
      appState.currentSimulationMode.value,
      this._buildParams(),
    );
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
        name: `${t(sim, 'name')} \u2013 Buildings`,
        description: `All buildings in the ${t(sim, 'name')} simulation.`,
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
    // On the document, not the host: the dossier is a lightbox and focus may
    // sit inside it, on the page behind it, or nowhere at all after a click on
    // the backdrop. A listener on this element only fires for two of the three.
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._onKeyDown);
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
        this._openBuildingDetail(building);
        return;
      }
      // Building not in current page — fetch by slug from API
      try {
        const resp = await buildingsApi.getBySlug(this.simulationId, this.entitySlug);
        if (resp.success && resp.data) {
          this._openBuildingDetail(resp.data as Building);
          return;
        }
      } catch (err) {
        // Fall through — fallback to legacy ID-based deep link below.
        captureError(err, { source: 'VelgBuildingsView._checkDeepLink.slugFetch' });
      }
    }
    // Legacy ID-based deep link (backward compat)
    const buildingId = appState.pendingOpenBuildingId.value;
    if (!buildingId) return;
    appState.pendingOpenBuildingId.value = null;

    const building = this._buildings.find((b) => b.id === buildingId);
    if (building) {
      this._openBuildingDetail(building);
    }
  }

  /** Open the building detail panel and apply entity-specific SEO. */
  private _openBuildingDetail(building: Building): void {
    this._selectedBuilding = building;
    this._showDetails = true;
    const sim = appState.currentSimulation.value;
    if (sim) {
      applyBuildingDetailSeo(sim, building);
    }
  }

  private _handleBuildingClick(e: CustomEvent<Building>): void {
    this._pushEntityUrl(e.detail);
    this._openBuildingDetail(e.detail);
  }

  private _pushEntityUrl(building: Building): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug || !building.slug) return;
    updateUrl(`/simulations/${sim.slug}/buildings/${building.slug}`);
  }

  private _pushListUrl(): void {
    const sim = appState.currentSimulation.value;
    if (!sim?.slug) return;
    updateUrl(`/simulations/${sim.slug}/buildings`);
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
    } catch (err) {
      captureError(err, { source: 'VelgBuildingsView._handleBuildingDelete' });
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
    // Revert to list-view meta + CollectionPage JSON-LD
    const sim = appState.currentSimulation.value;
    if (sim) {
      applySimulationViewSeo(sim, 'buildings');
      seoService.setCollectionPage({
        name: `${t(sim, 'name')} \u2013 Buildings`,
        description: `All buildings in the ${t(sim, 'name')} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/buildings`,
        numberOfItems: this._total,
      });
    }
  }

  /**
   * Step through the dossier, wrapping at both ends.
   *
   * ONE source for the grid, the buttons and the keyboard: `_buildings` is the
   * filtered list (the filter runs server-side, so what the grid shows is what
   * this steps through). That is the acceptance test the handoff names — pick
   * a filter, press the arrows, and you must not be handed a building the grid
   * is not showing.
   *
   * Wrapping rather than stopping: the previous version stopped at index 0 and
   * at the end, so the arrow simply did nothing and looked broken. There is no
   * "first" building in a register you browse.
   */
  private _stepBuilding(delta: number): void {
    const list = this._buildings;
    if (list.length === 0 || !this._selectedBuilding) return;
    const idx = list.indexOf(this._selectedBuilding);
    if (idx < 0) return;
    const next = list[(idx + delta + list.length) % list.length];
    if (!next || next === this._selectedBuilding) return;
    this._pushEntityUrl(next);
    this._openBuildingDetail(next);
  }

  private _handleLightboxPrev(): void {
    this._stepBuilding(-1);
  }

  private _handleLightboxNext(): void {
    this._stepBuilding(1);
  }

  /**
   * Arrow keys step, Escape closes — but only while a dossier is open, and
   * never while the caret is in a field. Without the field check, typing a
   * building name into the search box would page the dossier away under the
   * user mid-word.
   */
  private readonly _onKeyDown = (e: KeyboardEvent): void => {
    if (!this._selectedBuilding) return;
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this._stepBuilding(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this._stepBuilding(1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._selectedBuilding = null;
    }
  };

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
          <div class="title-group">
            <h1 class="view__title">${msg('Buildings')}</h1>
            <velg-help-tip
              topic="world"
              label=${msg('How do buildings work?')}
            ></velg-help-tip>
          </div>
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

  /**
   * The scale behind the marks on the cards.
   *
   * Rendered once under the grid rather than as a tooltip on each card: a
   * legend that only appears on hover is unreachable on touch, and this is
   * the key to a mark that appears on every card in the view.
   *
   * The thresholds are NOT restated here - they come from `occupancyLevel()`
   * in utils/building-condition.ts, and the percentages in these strings are
   * the same numbers by hand. If they ever disagree, the util is right.
   */
  private _renderLegend() {
    const items: Array<[string, string]> = [
      ['full', msg('Well used \u2013 two thirds of its places or more')],
      ['partial', msg('Half taken \u2013 a third of its places or more')],
      ['sparse', msg('Nearly empty \u2013 below a third')],
      ['ruined', msg('A ruin \u2013 its places are not counted')],
    ];
    return html`
      <div class="legend" role="note" aria-label=${msg('How to read the occupancy marks')}>
        ${items.map(
          ([key, label]) => html`
            <span class="legend__item">
              <span class="legend__mark legend__mark--${key}" aria-hidden="true"></span>
              <span>${label}</span>
            </span>
          `,
        )}
      </div>
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

      ${this._renderLegend()}

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
