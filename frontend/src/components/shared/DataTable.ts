import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  renderer?: (value: unknown, row: Record<string, unknown>) => TemplateResult | string;
}

type SortDirection = 'asc' | 'desc';

@localized()
@customElement('velg-data-table')
export class VelgDataTable extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .table-wrapper {
      overflow-x: auto;
      border: var(--border-default);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    }

    thead {
      background: var(--color-surface-header);
    }

    th {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      text-align: left;
      border-bottom: var(--border-medium);
      white-space: nowrap;
      user-select: none;
    }

    th.sortable {
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    th.sortable:hover {
      background: var(--color-surface-sunken);
    }

    .th-content {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .sort-indicator {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .sort-indicator--active {
      color: var(--color-text-primary);
    }

    td {
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-light);
      color: var(--color-text-primary);
      line-height: var(--leading-normal);
    }

    tr {
      transition: background var(--transition-fast);
    }

    tbody tr:hover {
      background: var(--color-surface-sunken);
    }

    tbody tr.selected {
      background: var(--color-info-bg);
    }

    .checkbox-cell {
      width: 40px;
      text-align: center;
    }

    .checkbox-cell input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--color-primary);
    }

    .empty-row td {
      text-align: center;
      padding: var(--space-8);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: Array }) columns: ColumnConfig[] = [];
  @property({ type: Array }) data: Record<string, unknown>[] = [];
  @property({ type: Boolean }) selectable = false;

  @state() private _sortKey: string | null = null;
  @state() private _sortDirection: SortDirection = 'asc';
  @state() private _selectedRows: Set<number> = new Set();

  private get _sortedData(): Record<string, unknown>[] {
    if (!this._sortKey) return this.data;

    const key = this._sortKey;
    const dir = this._sortDirection === 'asc' ? 1 : -1;

    return [...this.data].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * dir;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }

      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }

  private _handleSort(column: ColumnConfig): void {
    if (!column.sortable) return;

    if (this._sortKey === column.key) {
      this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortKey = column.key;
      this._sortDirection = 'asc';
    }
  }

  private _handleRowClick(row: Record<string, unknown>, index: number): void {
    this.dispatchEvent(
      new CustomEvent('row-click', {
        detail: { row, index },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSelectAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;

    if (checked) {
      this._selectedRows = new Set(this.data.map((_, i) => i));
    } else {
      this._selectedRows = new Set();
    }

    this._emitSelectionChange();
  }

  private _handleSelectRow(index: number, e: Event): void {
    e.stopPropagation();
    const updated = new Set(this._selectedRows);

    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }

    this._selectedRows = updated;
    this._emitSelectionChange();
  }

  private _emitSelectionChange(): void {
    const selectedData = [...this._selectedRows].map((i) => this.data[i]);
    this.dispatchEvent(
      new CustomEvent('selection-change', {
        detail: { selectedRows: selectedData, selectedIndices: [...this._selectedRows] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getSortIndicator(column: ColumnConfig): typeof nothing | TemplateResult {
    if (!column.sortable) return nothing;

    if (this._sortKey !== column.key) {
      return html`<span class="sort-indicator">&udarr;</span>`;
    }

    const arrow = this._sortDirection === 'asc' ? '\u2191' : '\u2193';
    return html`<span class="sort-indicator sort-indicator--active">${arrow}</span>`;
  }

  private _isAllSelected(): boolean {
    return this.data.length > 0 && this._selectedRows.size === this.data.length;
  }

  protected render() {
    const sortedData = this._sortedData;

    return html`
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              ${
                this.selectable
                  ? html`
                  <th class="checkbox-cell">
                    <input
                      type="checkbox"
                      .checked=${this._isAllSelected()}
                      @change=${this._handleSelectAll}
                    />
                  </th>
                `
                  : nothing
              }
              ${this.columns.map(
                (col) => html`
                  <th
                    class=${col.sortable ? 'sortable' : ''}
                    @click=${() => this._handleSort(col)}
                  >
                    <span class="th-content">
                      ${col.label}
                      ${this._getSortIndicator(col)}
                    </span>
                  </th>
                `,
              )}
            </tr>
          </thead>
          <tbody>
            ${
              sortedData.length === 0
                ? html`
                <tr class="empty-row">
                  <td colspan=${this.columns.length + (this.selectable ? 1 : 0)}>
                    ${msg('No data available')}
                  </td>
                </tr>
              `
                : sortedData.map(
                    (row, index) => html`
                <tr
                  class=${this._selectedRows.has(index) ? 'selected' : ''}
                  @click=${() => this._handleRowClick(row, index)}
                >
                  ${
                    this.selectable
                      ? html`
                      <td class="checkbox-cell">
                        <input
                          type="checkbox"
                          .checked=${this._selectedRows.has(index)}
                          @change=${(e: Event) => this._handleSelectRow(index, e)}
                        />
                      </td>
                    `
                      : nothing
                  }
                  ${this.columns.map(
                    (col) => html`
                    <td>
                      ${col.renderer ? col.renderer(row[col.key], row) : (row[col.key] ?? '')}
                    </td>
                  `,
                  )}
                </tr>
              `,
                  )
            }
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-data-table': VelgDataTable;
  }
}
