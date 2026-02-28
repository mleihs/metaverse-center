import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { eventsApi } from '../../services/api/index.js';
import type { Event as SimEvent } from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import type { FilterChangeDetail } from '../shared/SharedFilterBar.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import './EventCard.js';
import './EventEditModal.js';
import './EventDetailsPanel.js';

@localized()
@customElement('velg-events-view')
export class VelgEventsView extends LitElement {
  static styles = [
    viewHeaderStyles,
    css`
    :host {
      display: block;
    }

    .view__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-4);
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

  @state() private _events: SimEvent[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _limit = 25;
  @state() private _offset = 0;
  @state() private _filters: Record<string, string> = {};
  @state() private _search = '';
  @state() private _selectedEvent: SimEvent | null = null;
  @state() private _editEvent: SimEvent | null = null;
  @state() private _showEditModal = false;
  @state() private _showDetails = false;
  @state() private _bleedOnly = false;

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
    super.connectedCallback();
    this._loadEvents();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._offset = 0;
      this._loadEvents();
    }
  }

  private async _loadEvents(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    const params: Record<string, string> = {
      limit: String(this._limit),
      offset: String(this._offset),
    };

    if (this._search) {
      params.search = this._search;
    }

    if (this._bleedOnly) {
      params.data_source = 'bleed';
    }

    for (const [key, value] of Object.entries(this._filters)) {
      params[key] = value;
    }

    try {
      const response = await eventsApi.list(this.simulationId, params);

      if (response.success && response.data) {
        this._events = Array.isArray(response.data) ? response.data : [];
        this._total = response.meta?.total ?? this._events.length;
      } else {
        this._error = response.error?.message ?? msg('Failed to load events');
      }
    } catch {
      this._error = msg('An unexpected error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void {
    this._filters = e.detail.filters;
    this._search = e.detail.search;
    this._offset = 0;
    this._loadEvents();
  }

  private _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void {
    this._limit = e.detail.limit;
    this._offset = e.detail.offset;
    this._loadEvents();
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
        str`Are you sure you want to delete "${evt.title}"? This action cannot be undone.`,
      ),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await eventsApi.remove(this.simulationId, evt.id);
      if (response.success) {
        VelgToast.success(msg('Event deleted successfully'));
        this._loadEvents();
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
    this._loadEvents();
  }

  private _handleDetailsClose(): void {
    this._showDetails = false;
    this._selectedEvent = null;
  }

  private _handleBleedToggle(e: InputEvent): void {
    this._bleedOnly = (e.target as HTMLInputElement).checked;
    this._offset = 0;
    this._loadEvents();
  }

  private _handleRetry(): void {
    this._loadEvents();
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
      <div class="view">
        <div class="view__header">
          <h1 class="view__title">${msg('Events')}</h1>
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
        </div>

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

        ${
          this._loading
            ? html`<velg-loading-state message=${msg('Loading events...')}></velg-loading-state>`
            : this._error
              ? html`
              <velg-error-state
                message=${this._error}
                show-retry
                @retry=${this._handleRetry}
              ></velg-error-state>
            `
              : this._events.length === 0
                ? html`
                <velg-empty-state
                  message=${msg('No events found.')}
                  ${this._canEdit ? html`cta-label=${msg('Create Event')}` : ''}
                  @cta-click=${this._handleCreateClick}
                ></velg-empty-state>
              `
                : html`
                <div class="view__grid">
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
              `
        }

        <velg-pagination
          .total=${this._total}
          .limit=${this._limit}
          .offset=${this._offset}
          @page-change=${this._handlePageChange}
        ></velg-pagination>
      </div>

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
