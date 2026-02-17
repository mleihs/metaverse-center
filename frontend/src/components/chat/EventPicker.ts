import { localized, msg } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { eventsApi } from '../../services/api/index.js';
import type { Event as SimEvent } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

@localized()
@customElement('velg-event-picker')
export class VelgEventPicker extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .picker__search {
      width: 100%;
      padding: var(--space-2-5) var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      margin-bottom: var(--space-4);
    }

    .picker__search:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .picker__search::placeholder {
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .picker__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-height: 450px;
      overflow-y: auto;
    }

    .picker__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3);
      border: var(--border-light);
      background: var(--color-surface-raised);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .picker__item:hover:not(.picker__item--referenced) {
      border-color: var(--color-border);
      background: var(--color-surface-sunken);
    }

    .picker__item--referenced {
      border-color: var(--color-success-border);
      background: var(--color-success-bg);
      cursor: default;
    }

    .picker__item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .picker__item-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .picker__item-check {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-success);
      flex-shrink: 0;
    }

    .picker__item-meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .picker__type-badge {
      display: inline-block;
      padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-sunken);
    }

    .picker__impact {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .picker__impact-bar {
      display: flex;
      width: 60px;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .picker__impact-fill {
      height: 100%;
      background: var(--color-primary);
    }

    .picker__item-date {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .picker__item-desc {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .picker__loading,
    .picker__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;
  /** IDs of events already referenced in the conversation */
  @property({ type: Array }) referencedEventIds: string[] = [];

  @state() private _events: SimEvent[] = [];
  @state() private _loading = false;
  @state() private _searchQuery = '';

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open && this._events.length === 0) {
      this._loadEvents();
    }
  }

  private async _loadEvents(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    try {
      const response = await eventsApi.list(this.simulationId, { page_size: '100' });
      if (response.success && response.data) {
        this._events = Array.isArray(response.data) ? response.data : [];
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load events.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred while loading events.'));
    } finally {
      this._loading = false;
    }
  }

  private get _filteredEvents(): SimEvent[] {
    if (!this._searchQuery) return this._events;
    const query = this._searchQuery.toLowerCase();
    return this._events.filter((event) => event.title.toLowerCase().includes(query));
  }

  private _handleSearch(e: Event): void {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _handleEventClick(event: SimEvent): void {
    if (this.referencedEventIds.includes(event.id)) return;

    this.dispatchEvent(
      new CustomEvent('event-selected', {
        detail: event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  private _renderImpactBar(level: number): TemplateResult {
    const pct = Math.max(0, Math.min(100, level * 10));
    return html`
      <div class="picker__impact">
        <div class="picker__impact-bar">
          <div class="picker__impact-fill" style="width: ${pct}%"></div>
        </div>
        <span>${level}/10</span>
      </div>
    `;
  }

  private _renderEventItem(event: SimEvent) {
    const isReferenced = this.referencedEventIds.includes(event.id);

    return html`
      <div
        class="picker__item ${isReferenced ? 'picker__item--referenced' : ''}"
        @click=${() => this._handleEventClick(event)}
      >
        <div class="picker__item-header">
          <div class="picker__item-title">${event.title}</div>
          ${isReferenced ? html`<span class="picker__item-check">\u2713</span>` : null}
        </div>
        <div class="picker__item-meta">
          ${event.event_type ? html`<span class="picker__type-badge">${event.event_type}</span>` : null}
          ${this._renderImpactBar(event.impact_level ?? 0)}
          <span class="picker__item-date">${this._formatDate(event.occurred_at)}</span>
        </div>
        ${event.description ? html`<div class="picker__item-desc">${event.description}</div>` : null}
      </div>
    `;
  }

  protected render() {
    return html`
      <velg-base-modal .open=${this.open}>
        <span slot="header">${msg('Reference Event')}</span>

        <input
          class="picker__search"
          type="text"
          placeholder=${msg('Search events...')}
          .value=${this._searchQuery}
          @input=${this._handleSearch}
        />

        ${
          this._loading
            ? html`<div class="picker__loading">${msg('Loading events...')}</div>`
            : this._filteredEvents.length === 0
              ? html`<div class="picker__empty">
                ${this._searchQuery ? msg('No events match your search.') : msg('No events available.')}
              </div>`
              : html`
                <div class="picker__list">
                  ${this._filteredEvents.map((event) => this._renderEventItem(event))}
                </div>
              `
        }
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-picker': VelgEventPicker;
  }
}
