/**
 * Mixin that eliminates the 4-part data-loading boilerplate:
 *   1. State declarations (_loading, _error, _data, _total)
 *   2. Lifecycle wiring (connectedCallback, willUpdate on simulationId)
 *   3. Load method skeleton (try/catch/finally with ApiResponse handling)
 *   4. 3-state render guard (loading → error → empty → content)
 *
 * Usage:
 *   class MyView extends DataLoaderMixin(LitElement) {
 *     protected get _items(): Item[] { return (this._data as Item[]) ?? []; }
 *     protected async _fetchData() { return itemsApi.list(this.simulationId); }
 *     protected render() {
 *       return this._renderDataGuard(() => html`...${this._items.map(...)}...`);
 *     }
 *   }
 *
 * Composes with SignalWatcher:
 *   class MyView extends SignalWatcher(DataLoaderMixin(LitElement)) { ... }
 */
import { msg } from '@lit/localize';
import type { ReactiveElement } from 'lit';
import { html, type nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import type { ApiResponse } from '../../types/index.js';

/** Return type for render callbacks — TemplateResult or Lit's `nothing` symbol. */
type RenderResult = TemplateResult | typeof nothing;

import './LoadingState.js';
import './ErrorState.js';
import './EmptyState.js';

// Lit mixin constructor type. `any[]` is mandated by the Lit mixin pattern —
// the true variadic constructor signature cannot be expressed in TypeScript
// without it. See https://lit.dev/docs/composition/mixins/#typing-the-mixin
// biome-ignore lint/suspicious/noExplicitAny: Lit mixin constructor — see comment above.
export type MixinCtor<T> = abstract new (...args: any[]) => T;

// Same constraint SignalWatcher uses — ensures composability.
type ReactiveElementCtor = MixinCtor<ReactiveElement>;

/**
 * Type-only declaration so the mixin's added members are visible to subclasses
 * without TS4094 "private/protected property of anonymous class" errors.
 */
export declare abstract class DataLoaderMixinInterface {
  protected _loading: boolean;
  protected _error: string | null;
  protected _data: unknown;
  protected _total: number;
  protected abstract _fetchData(): Promise<ApiResponse<unknown>>;
  protected _shouldAutoLoad(): boolean;
  protected _shouldReloadOnChange(changed: Map<PropertyKey, unknown>): boolean;
  protected _onDataLoaded(): void | Promise<void>;
  protected _isDataEmpty(): boolean;
  protected _getLoadingMessage(): string;
  protected _getEmptyMessage(): string;
  protected _getErrorFallback(): string;
  protected _load(): Promise<void>;
  protected _renderLoadingState(): RenderResult;
  protected _renderErrorState(): RenderResult;
  protected _renderEmptyState(): RenderResult;
  protected _renderDataGuard(renderContent: () => RenderResult): RenderResult;
}

export function DataLoaderMixin<TBase extends ReactiveElementCtor>(
  Base: TBase,
): TBase & MixinCtor<DataLoaderMixinInterface> {
  abstract class DataLoaderHost extends Base {
    /* ── Reactive state ────────────────────── */

    @state() protected _loading = true;
    @state() protected _error: string | null = null;
    @state() protected _data: unknown = null;
    @state() protected _total = 0;

    /* ── Abstract: subclass provides the API call ── */

    protected abstract _fetchData(): Promise<ApiResponse<unknown>>;

    /* ── Overridable hooks ─────────────────── */

    /** Return false to skip auto-load in connectedCallback. */
    protected _shouldAutoLoad(): boolean {
      if ('simulationId' in this) {
        return !!(this as Record<string, unknown>).simulationId;
      }
      return true;
    }

    /** Return true to trigger _load() for the given property changes. */
    protected _shouldReloadOnChange(changed: Map<PropertyKey, unknown>): boolean {
      return changed.has('simulationId') && !!(this as Record<string, unknown>).simulationId;
    }

    /** Called after successful data load. Override for SEO, deep links, etc. */
    protected _onDataLoaded(): void | Promise<void> {
      /* no-op */
    }

    /** Override for custom empty-data detection. */
    protected _isDataEmpty(): boolean {
      if (this._data === null || this._data === undefined) return true;
      if (Array.isArray(this._data)) return this._data.length === 0;
      return false;
    }

    protected _getLoadingMessage(): string {
      return msg('Loading...');
    }

    protected _getEmptyMessage(): string {
      return msg('No items found.');
    }

    protected _getErrorFallback(): string {
      return msg('Failed to load data.');
    }

    /* ── Core load orchestrator ────────────── */

    protected async _load(): Promise<void> {
      this._loading = true;
      this._error = null;
      try {
        const response = await this._fetchData();
        if (response.success && response.data !== undefined) {
          this._data = response.data;
          this._total =
            response.meta?.total ?? (Array.isArray(response.data) ? response.data.length : 1);
          await this._onDataLoaded();
        } else if (!response.success) {
          this._error = response.error?.message ?? this._getErrorFallback();
        }
      } catch (err) {
        this._error = err instanceof Error ? err.message : this._getErrorFallback();
      } finally {
        this._loading = false;
      }
    }

    /* ── Lifecycle wiring ──────────────────── */

    /**
     * Tracks whether connectedCallback triggered a load, so the first
     * willUpdate doesn't fire a duplicate. Prevents the classic Lit
     * double-load: connectedCallback + first willUpdate both seeing
     * a truthy simulationId.
     */
    private __initialLoadFired = false;

    connectedCallback(): void {
      super.connectedCallback();
      if (this._shouldAutoLoad()) {
        this.__initialLoadFired = true;
        this._load();
      }
    }

    protected willUpdate(changed: Map<PropertyKey, unknown>): void {
      super.willUpdate(changed);
      if (this.__initialLoadFired) {
        this.__initialLoadFired = false;
        return;
      }
      if (this._shouldReloadOnChange(changed)) {
        this._load();
      }
    }

    /* ── Render helpers ────────────────────── */

    protected _renderLoadingState(): RenderResult {
      return html`<velg-loading-state message=${this._getLoadingMessage()}></velg-loading-state>`;
    }

    protected _renderErrorState(): RenderResult {
      return html`
        <velg-error-state
          message=${this._error ?? ''}
          show-retry
          @retry=${this._load}
        ></velg-error-state>
      `;
    }

    protected _renderEmptyState(): RenderResult {
      return html`<velg-empty-state message=${this._getEmptyMessage()}></velg-empty-state>`;
    }

    /** 3-state render guard. Renders loading/error/empty, or calls contentFn. */
    protected _renderDataGuard(renderContent: () => RenderResult): RenderResult {
      if (this._loading) return this._renderLoadingState();
      if (this._error) return this._renderErrorState();
      if (this._isDataEmpty()) return this._renderEmptyState();
      return renderContent();
    }
  }

  // Canonical Lit mixin idiom: TypeScript cannot infer the intersection of the
  // concrete `typeof DataLoaderHost` with the dynamic `TBase` constructor
  // signature. See the Lit mixin guide (https://lit.dev/docs/composition/mixins/
  // #creating-a-mixin). This `as unknown as` cast is the documented escape
  // hatch and is whitelisted in `scripts/lint-no-cast-unknown.sh`.
  return DataLoaderHost as unknown as TBase & MixinCtor<DataLoaderMixinInterface>;
}
