/**
 * Extension of DataLoaderMixin for paginated list views.
 *
 * Adds: _limit, _offset, _filters, _search state + standard handlers for
 * <velg-filter-bar @filter-change> and <velg-pagination @page-change>.
 *
 * Usage:
 *   class MyListView extends PaginatedLoaderMixin(LitElement) {
 *     protected get _items(): Item[] { return (this._data as Item[]) ?? []; }
 *     protected async _fetchData() {
 *       return itemsApi.list(this.simulationId, this._buildParams());
 *     }
 *     protected render() {
 *       return html`
 *         <velg-filter-bar @filter-change=${this._handleFilterChange}></velg-filter-bar>
 *         ${this._renderDataGuard(() => html`...grid...`)}
 *         <velg-pagination .total=${this._total} .limit=${this._limit}
 *           .offset=${this._offset} @page-change=${this._handlePageChange}>
 *         </velg-pagination>
 *       `;
 *     }
 *   }
 */

import type { ReactiveElement } from 'lit';
import { state } from 'lit/decorators.js';
import { DataLoaderMixin, type DataLoaderMixinInterface } from './DataLoaderMixin.js';
import type { FilterChangeDetail } from './SharedFilterBar.js';

type ReactiveElementCtor = abstract new (...args: any[]) => ReactiveElement;

/** Type-only declaration for PaginatedLoaderMixin's added members. */
export declare abstract class PaginatedLoaderMixinInterface extends DataLoaderMixinInterface {
  protected _limit: number;
  protected _offset: number;
  protected _filters: Record<string, string>;
  protected _search: string;
  protected _buildParams(): Record<string, string>;
  protected _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void;
  protected _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void;
}

export function PaginatedLoaderMixin<TBase extends ReactiveElementCtor>(
  Base: TBase,
): TBase & (abstract new (...args: any[]) => PaginatedLoaderMixinInterface) {
  abstract class PaginatedHost extends DataLoaderMixin(Base) {
    /* ── Pagination state ──────────────────── */

    @state() protected _limit = 25;
    @state() protected _offset = 0;
    @state() protected _filters: Record<string, string> = {};
    @state() protected _search = '';

    /* ── Lifecycle: reset pagination on simulationId change ── */

    protected willUpdate(changed: Map<PropertyKey, unknown>): void {
      if (changed.has('simulationId') && !!(this as Record<string, unknown>).simulationId) {
        this._offset = 0;
        this._search = '';
        this._filters = {};
      }
      super.willUpdate(changed);
    }

    /* ── Helpers ───────────────────────────── */

    /** Build query params from pagination + filter state. */
    protected _buildParams(): Record<string, string> {
      const params: Record<string, string> = {
        limit: String(this._limit),
        offset: String(this._offset),
      };
      if (this._search) {
        params.search = this._search;
      }
      for (const [key, value] of Object.entries(this._filters)) {
        if (value) params[key] = value;
      }
      return params;
    }

    /** Standard handler for <velg-filter-bar @filter-change>. */
    protected _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void {
      this._filters = e.detail.filters;
      this._search = e.detail.search;
      this._offset = 0;
      this._load();
    }

    /** Standard handler for <velg-pagination @page-change>. */
    protected _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void {
      this._limit = e.detail.limit;
      this._offset = e.detail.offset;
      this._load();
    }
  }

  return PaginatedHost as unknown as TBase &
    (abstract new (
      ...args: any[]
    ) => PaginatedLoaderMixinInterface);
}
