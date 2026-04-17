import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { eventsApi } from '../../services/api/index.js';
import { seoService } from '../../services/SeoService.js';
import type { ApiResponse, Event as SimEvent } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { PaginatedLoaderMixin } from '../shared/PaginatedLoaderMixin.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import { gridLayoutStyles } from '../shared/grid-layout-styles.js';
import { titleGroupStyles } from '../shared/title-group-styles.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/VelgHelpTip.js';
import './EventCard.js';
import './EventEditModal.js';
import './EventDetailsPanel.js';
import './EventSeismograph.js';

@localized()
@customElement('velg-events-view')
export class VelgEventsView extends PaginatedLoaderMixin(LitElement) {
  static styles = [
    viewHeaderStyles,
    titleGroupStyles,
    gridLayoutStyles,
    css`
    :host {
      display: block;
    }

    .entity-grid {
      --grid-min-width: 320px;
    }

    .events__bleed-filter {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .events__bleed-filter label {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      cursor: pointer;
      user-select: none;
    }

    .events__bleed-filter input[type="checkbox"] {
      cursor: pointer;
      accent-color: var(--color-warning);
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _selectedEvent: SimEvent | null = null;
  @state() private _editEvent: SimEvent | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;
  @state() private _bleedOnly = false;
  @state() private _seismographEvents: SimEvent[] = [];
  @state() private _dateFrom: string | null = null;
  @state() private _dateTo: string | null = null;

  /* ── DataLoaderMixin contract ────────── */

  protected get _events(): SimEvent[] {
    return (this._data as SimEvent[]) ?? [];
  }

  protected async _fetchData(): Promise<ApiResponse<SimEvent[]>> {
    const params = this._buildParams();
    if (this._bleedOnly) params.data_source = 'bleed';
    if (this._dateFrom) params.date_from = this._dateFrom;
    if (this._dateTo) params.date_to = this._dateTo;
    return eventsApi.list(this.simulationId, appState.currentSimulationMode.value, params);
  }

  protected _getLoadingMessage(): string {
    return msg('Loading events...');
  }

  protected _getEmptyMessage(): string {
    return msg('No events found.');
  }

  protected _getErrorFallback(): string {
    return msg('An unexpected error occurred');
  }

  protected _onDataLoaded(): void {
    const sim = appState.currentSimulation.value;
    if (sim) {
      seoService.setCollectionPage({
        name: `${t(sim, 'name')} \u2013 Events`,
        description: `Recent events in the ${t(sim, 'name')} simulation.`,
        url: `https://metaverse.center/simulations/${sim.slug}/events`,
        numberOfItems: this._total,
      });
    }
  }

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  private _getEventTypeFilters() {
    const taxonomies = appState.getTaxonomiesByType('event_type');
    return taxonomies.map((t) => ({
      value: t.value,
      label: t.label?.en ?? t.value,
    }));
  }

  connectedCallback(): void {
    super.connectedCallback(); // mixin auto-loads
    this._loadSeismographEvents();
  }

  disconnectedCallback(): void {
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      this._loadSeismographEvents();
    }
    super.willUpdate(changed); // mixin handles pagination reset + _load()
  }

  private _handleEventClick(e: CustomEvent<SimEvent>): void {
    this._selectedEvent = e.detail;
    this._showDetails = true;
  }

  private _handleEventEdit(e: CustomEvent<SimEvent>): void {
    this._editEvent = e.detail;
    this._showEditModal = true;
    this._showDetails = false;
  }

  private async _handleEventDelete(e: CustomEvent<SimEvent>): Promise<void> {
    const evt = e.detail;
    this._showDetails = false;

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Event'),
      message: msg(
        str`Are you sure you want to delete "${t(evt, 'title')}"? This action cannot be undone.`,
      ),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await eventsApi.remove(this.simulationId, evt.id);
      if (response.success) {
        VelgToast.success(msg('Event deleted successfully'));
        this._load();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to delete event'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred'));
    }
  }

  private _handleCreateClick(): void {
    this._editEvent = null;
    this._showEditModal = true;
  }

  private _handleEditModalClose(): void {
    this._showEditModal = false;
    this._editEvent = null;
  }

  private _handleEventSaved(): void {
    this._showEditModal = false;
    this._editEvent = null;
    this._load();
  }

  private _handleDetailsClose(): void {
    this._showDetails = false;
    this._selectedEvent = null;
  }

  private _handleBleedToggle(e: InputEvent): void {
    this._bleedOnly = (e.target as HTMLInputElement).checked;
    this._offset = 0;
    this._load();
  }

  private async _loadSeismographEvents(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const response = await eventsApi.list(
        this.simulationId,
        appState.currentSimulationMode.value,
        { limit: '100', offset: '0' },
      );
      if (response.success && response.data) {
        this._seismographEvents = Array.isArray(response.data) ? response.data : [];
      }
    } catch {
      // Seismograph is supplemental — silent fail
    }
  }

  private _handleBrush(e: CustomEvent<{ dateFrom: string; dateTo: string }>): void {
    this._dateFrom = e.detail.dateFrom;
    this._dateTo = e.detail.dateTo;
    this._offset = 0;
    this._load();
  }

  private _handleBrushClear(): void {
    this._dateFrom = null;
    this._dateTo = null;
    this._offset = 0;
    this._load();
  }

  protected _renderEmptyState() {
    return html`
      <velg-empty-state
        message=${this._getEmptyMessage()}
        cta-label=${this._canEdit ? msg('Create Event') : ''}
        @cta-click=${this._handleCreateClick}
      ></velg-empty-state>
    `;
  }

  protected render() {
    const filterConfigs = [
      {
        key: 'event_type',
        label: msg('Event Type'),
        options: this._getEventTypeFilters(),
      },
    ];

    return html`
      <section class="view" aria-label=${msg('Events')}>
        <header class="view__header">
          <div class="title-group">
            <h1 class="view__title">${msg('Events')}</h1>
            <velg-help-tip
              topic="events"
              label=${msg('How do events work?')}
            ></velg-help-tip>
          </div>
          ${
            this._canEdit
              ? html`
              <button
                class="view__create-btn"
                @click=${this._handleCreateClick}
              >
                ${msg('+ Create Event')}
              </button>
            `
              : nothing
          }
        </header>

        <velg-event-seismograph
          .simulationId=${this.simulationId}
          .events=${this._seismographEvents}
          @seismograph-brush=${this._handleBrush}
          @seismograph-clear=${this._handleBrushClear}
        ></velg-event-seismograph>

        <velg-filter-bar
          .filters=${filterConfigs}
          search-placeholder=${msg('Search events...')}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        <div class="events__bleed-filter">
          <label>
            <input
              type="checkbox"
              .checked=${this._bleedOnly}
              @change=${this._handleBleedToggle}
            />
            ${msg('Show Bleed events only')}
          </label>
        </div>

        ${this._renderDataGuard(
          () => html`
          <div class="entity-grid">
            ${this._events.map(
              (evt, i) => html`
                <velg-event-card
                  style="--i: ${i}"
                  .event=${evt}
                  @event-click=${this._handleEventClick}
                  @event-edit=${this._handleEventEdit}
                  @event-delete=${this._handleEventDelete}
                ></velg-event-card>
              `,
            )}
          </div>
        `,
        )}

        <velg-pagination
          .total=${this._total}
          .limit=${this._limit}
          .offset=${this._offset}
          @page-change=${this._handlePageChange}
        ></velg-pagination>
      </section>

      <velg-event-edit-modal
        .event=${this._editEvent}
        .simulationId=${this.simulationId}
        ?open=${this._showEditModal}
        @modal-close=${this._handleEditModalClose}
        @event-saved=${this._handleEventSaved}
      ></velg-event-edit-modal>

      <velg-event-details-panel
        .event=${this._selectedEvent}
        .simulationId=${this.simulationId}
        ?open=${this._showDetails}
        @panel-close=${this._handleDetailsClose}
        @event-edit=${this._handleEventEdit}
        @event-delete=${this._handleEventDelete}
      ></velg-event-details-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-events-view': VelgEventsView;
  }
}
