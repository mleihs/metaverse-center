import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface FilterChangeDetail {
  filters: Record<string, string>;
  search: string;
}

@localized()
@customElement('velg-filter-bar')
export class VelgFilterBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface-raised);
      border: var(--border-default);
    }

    .filter-bar__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .filter-bar__search {
      flex: 1;
      min-width: 200px;
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .filter-bar__search:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .filter-bar__search::placeholder {
      color: var(--color-text-muted);
    }

    .filter-bar__select {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .filter-bar__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .filter-bar__chips {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .filter-bar__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
    }

    .filter-bar__chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      line-height: 1;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: color var(--transition-fast);
    }

    .filter-bar__chip-remove:hover {
      color: var(--color-danger);
    }

    .filter-bar__clear {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-2);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .filter-bar__clear:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }
  `;

  @property({ type: Array }) filters: FilterConfig[] = [];
  @property({ type: String, attribute: 'search-placeholder' }) searchPlaceholder = msg('Search...');

  @state() private _search = '';
  @state() private _activeFilters: Record<string, string> = {};

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private _emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<FilterChangeDetail>('filter-change', {
        detail: {
          filters: { ...this._activeFilters },
          search: this._search,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSearchInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._search = value;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._emitChange();
    }, 300);
  }

  private _handleFilterChange(key: string, e: Event): void {
    const value = (e.target as HTMLSelectElement).value;

    if (value) {
      this._activeFilters = { ...this._activeFilters, [key]: value };
    } else {
      const updated = { ...this._activeFilters };
      delete updated[key];
      this._activeFilters = updated;
    }

    this._emitChange();
  }

  private _removeFilter(key: string): void {
    const updated = { ...this._activeFilters };
    delete updated[key];
    this._activeFilters = updated;
    this._emitChange();
  }

  private _clearAll(): void {
    this._search = '';
    this._activeFilters = {};
    this._emitChange();
  }

  private _getFilterLabel(key: string, value: string): string {
    const config = this.filters.find((f) => f.key === key);
    if (!config) return `${key}: ${value}`;
    const option = config.options.find((o) => o.value === value);
    return `${config.label}: ${option?.label ?? value}`;
  }

  private get _hasActiveFilters(): boolean {
    return this._search.length > 0 || Object.keys(this._activeFilters).length > 0;
  }

  protected render() {
    const activeFilterEntries = Object.entries(this._activeFilters);

    return html`
      <div class="filter-bar">
        <div class="filter-bar__row">
          <input
            class="filter-bar__search"
            type="text"
            placeholder=${this.searchPlaceholder}
            .value=${this._search}
            @input=${this._handleSearchInput}
          />

          ${this.filters.map(
            (filter) => html`
              <select
                class="filter-bar__select"
                .value=${this._activeFilters[filter.key] ?? ''}
                @change=${(e: Event) => this._handleFilterChange(filter.key, e)}
              >
                <option value="">${filter.label}</option>
                ${filter.options.map(
                  (opt) => html`
                    <option value=${opt.value}>${opt.label}</option>
                  `,
                )}
              </select>
            `,
          )}
        </div>

        ${
          activeFilterEntries.length > 0
            ? html`
            <div class="filter-bar__chips">
              ${activeFilterEntries.map(
                ([key, value]) => html`
                  <span class="filter-bar__chip">
                    ${this._getFilterLabel(key, value)}
                    <button
                      class="filter-bar__chip-remove"
                      @click=${() => this._removeFilter(key)}
                      aria-label=${msg('Remove filter')}
                    >
                      X
                    </button>
                  </span>
                `,
              )}

              ${
                this._hasActiveFilters
                  ? html`
                  <button class="filter-bar__clear" @click=${this._clearAll}>
                    ${msg('Clear All')}
                  </button>
                `
                  : null
              }
            </div>
          `
            : null
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-filter-bar': VelgFilterBar;
  }
}
