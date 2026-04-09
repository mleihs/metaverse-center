/**
 * Dungeon content master table — filterable, keyboard-navigable grid.
 *
 * Displays content rows with archetype badges, bilingual text snippets,
 * and metadata columns that adapt per content type.
 *
 * Emits:
 *   - `row-select`: { detail: { item, contentType } } when a row is activated
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DungeonContentType } from '../../services/api/DungeonContentAdminApi.js';
import { adminAnimationStyles, adminBadgeStyles } from '../shared/admin-shared-styles.js';

/** Archetype → visual config */
const ARCHETYPE_COLORS: Record<string, { token: string; label: string; icon: string }> = {
  'The Shadow': { token: '--color-text-muted', label: 'Shadow', icon: '\u25C8' },
  'The Tower': { token: '--color-warning', label: 'Tower', icon: '\u25B2' },
  'The Entropy': { token: '--color-info', label: 'Entropy', icon: '\u25CC' },
  'The Devouring Mother': { token: '--color-danger', label: 'Mother', icon: '\u25C9' },
};

@localized()
@customElement('velg-dungeon-content-table')
export class DungeonContentTable extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminBadgeStyles,
    css`
      :host {
        display: block;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
      }

      /* ── Filter Bar ── */

      .filters {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-4);
        flex-wrap: wrap;
      }

      .filters__search {
        flex: 1;
        min-width: 200px;
        max-width: 360px;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        transition: border-color 0.2s ease;
      }

      .filters__search:focus {
        outline: none;
        border-color: var(--color-accent-gold, var(--color-accent-amber));
        box-shadow: 0 0 0 1px var(--color-accent-gold, var(--color-accent-amber));
      }

      .filters__search::placeholder {
        color: var(--color-text-muted);
      }

      .filters__chips {
        display: flex;
        gap: var(--space-1);
      }

      .chip {
        padding: var(--space-1) var(--space-2-5);
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .chip:hover:not(.chip--active) {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      .chip--active {
        color: var(--color-accent-gold, var(--color-accent-amber));
        border-color: var(--color-accent-gold, var(--color-accent-amber));
        background: color-mix(in srgb, var(--color-accent-gold, var(--color-accent-amber)) 10%, transparent);
      }

      .filters__count {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin-left: auto;
      }

      /* ── Table ── */

      .table-wrap {
        border: 1px solid var(--color-border);
        overflow: hidden;
      }

      .table {
        width: 100%;
        border-collapse: collapse;
      }

      .table__head {
        background: color-mix(in srgb, var(--color-surface) 80%, var(--color-surface-sunken, #000) 20%);
      }

      .table__th {
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        text-align: left;
        border-bottom: 1px solid var(--color-border);
        white-space: nowrap;
        user-select: none;
      }

      .table__row {
        cursor: pointer;
        transition: background 0.12s ease;
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
        animation: card-enter 250ms ease both;
      }

      .table__row:nth-child(1) { animation-delay: 0ms; }
      .table__row:nth-child(2) { animation-delay: 20ms; }
      .table__row:nth-child(3) { animation-delay: 40ms; }
      .table__row:nth-child(4) { animation-delay: 60ms; }
      .table__row:nth-child(5) { animation-delay: 80ms; }
      .table__row:nth-child(n+6) { animation-delay: 100ms; }

      .table__row:hover {
        background: color-mix(in srgb, var(--color-accent-gold, var(--color-accent-amber)) 5%, transparent);
      }

      .table__row:focus-visible {
        outline: 2px solid var(--color-accent-gold, var(--color-accent-amber));
        outline-offset: -2px;
      }

      .table__row--selected {
        background: color-mix(in srgb, var(--color-accent-gold, var(--color-accent-amber)) 10%, transparent);
        border-left: 3px solid var(--color-accent-gold, var(--color-accent-amber));
      }

      .table__td {
        padding: var(--space-2) var(--space-3);
        vertical-align: top;
      }

      .cell-id {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cell-arch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px var(--space-2);
        white-space: nowrap;
      }

      .cell-preview {
        font-size: var(--text-xs, 11px);
        color: var(--color-text-secondary);
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.4;
      }

      .cell-meta {
        font-size: 10px;
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      /* ── Empty State ── */

      .empty {
        text-align: center;
        padding: var(--space-8);
        color: var(--color-text-muted);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      /* ── Pagination ── */

      .pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        border-top: 1px solid var(--color-border);
        font-size: 10px;
        color: var(--color-text-muted);
      }

      .pagination__btns {
        display: flex;
        gap: var(--space-1);
      }

      .pagination__btn {
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        background: transparent;
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .pagination__btn:hover:not(:disabled) {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      .pagination__btn:disabled {
        opacity: 0.3;
        cursor: default;
      }

      @media (max-width: 768px) {
        .filters {
          flex-direction: column;
          align-items: stretch;
        }
        .filters__search {
          max-width: 100%;
        }
        .cell-preview {
          max-width: 200px;
        }
      }
    `,
  ];

  @property({ type: Array }) items: Record<string, unknown>[] = [];
  @property() contentType: DungeonContentType = 'banter';
  @property() selectedId = '';
  @property({ type: Number }) total = 0;
  @property({ type: Number }) page = 1;
  @property({ type: Number }) perPage = 100;

  @state() private _search = '';
  @state() private _archetype = '';
  @state() private _focusedIndex = -1;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Column definitions per content type ──────────────────────────

  private _getColumns(): { key: string; label: string }[] {
    switch (this.contentType) {
      case 'banter':
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
          { key: 'trigger', label: msg('Trigger') },
          { key: 'text_en', label: msg('Text (EN)') },
        ];
      case 'encounters':
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
          { key: 'room_type', label: msg('Room') },
          { key: 'description_en', label: msg('Description') },
        ];
      case 'enemies':
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
          { key: 'name_en', label: msg('Name') },
          { key: 'threat_level', label: msg('Threat') },
        ];
      case 'loot':
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
          { key: 'name_en', label: msg('Name') },
          { key: 'tier', label: msg('Tier') },
        ];
      case 'abilities':
        return [
          { key: 'id', label: 'ID' },
          { key: 'school', label: msg('School') },
          { key: 'name_en', label: msg('Name') },
          { key: 'targets', label: msg('Targets') },
        ];
      case 'anchors':
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
        ];
      case 'entrance_texts':
      case 'barometer_texts':
        return [
          { key: 'archetype', label: msg('Archetype') },
          { key: 'text_en', label: msg('Text (EN)') },
        ];
      default:
        return [
          { key: 'id', label: 'ID' },
          { key: 'archetype', label: msg('Archetype') },
        ];
    }
  }

  // ── Event dispatch ───────────────────────────────────────────────

  private _selectRow(item: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent('row-select', {
        detail: { item, contentType: this.contentType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _emitFilterChange(): void {
    this.dispatchEvent(
      new CustomEvent('filter-change', {
        detail: { search: this._search, archetype: this._archetype },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _emitPageChange(newPage: number): void {
    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: { page: newPage },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Keyboard navigation ─────────────────────────────────────────

  private _handleTableKeydown(e: KeyboardEvent): void {
    const rows = this.items;
    if (!rows.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._focusedIndex = Math.min(this._focusedIndex + 1, rows.length - 1);
        this._focusRow(this._focusedIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
        this._focusRow(this._focusedIndex);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._focusedIndex >= 0 && this._focusedIndex < rows.length) {
          this._selectRow(rows[this._focusedIndex]);
        }
        break;
    }
  }

  private _focusRow(index: number): void {
    const row = this.shadowRoot?.querySelectorAll<HTMLElement>('.table__row')[index];
    row?.focus();
  }

  // ── Search debounce ─────────────────────────────────────────────

  private _handleSearchInput(e: InputEvent): void {
    this._search = (e.target as HTMLInputElement).value;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._emitFilterChange(), 300);
  }

  private _toggleArchetype(arch: string): void {
    this._archetype = this._archetype === arch ? '' : arch;
    this._emitFilterChange();
  }

  // ── Render ──────────────────────────────────────────────────────

  protected render() {
    const columns = this._getColumns();
    const totalPages = Math.ceil(this.total / this.perPage) || 1;

    return html`
      <!-- Filter bar -->
      <div class="filters">
        <input
          class="filters__search"
          type="search"
          placeholder=${msg('Search content...')}
          .value=${this._search}
          @input=${this._handleSearchInput}
          aria-label=${msg('Search content')}
        />
        <div class="filters__chips" role="group" aria-label=${msg('Filter by archetype')}>
          ${Object.entries(ARCHETYPE_COLORS).map(
            ([arch, cfg]) => html`
              <button
                class="chip ${this._archetype === arch ? 'chip--active' : ''}"
                style="--_chip-color: var(${cfg.token})"
                @click=${() => this._toggleArchetype(arch)}
                aria-pressed=${this._archetype === arch ? 'true' : 'false'}
              >${cfg.icon} ${cfg.label}</button>
            `,
          )}
        </div>
        <span class="filters__count">${this.items.length} / ${this.total}</span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        ${
          this.items.length === 0
            ? html`<div class="empty">${msg('No content found')}</div>`
            : html`
            <table class="table" role="grid" @keydown=${this._handleTableKeydown}>
              <thead class="table__head">
                <tr role="row">
                  ${columns.map(
                    (col) => html`
                    <th class="table__th" role="columnheader">${col.label}</th>
                  `,
                  )}
                </tr>
              </thead>
              <tbody>
                ${this.items.map((item, idx) => this._renderRow(item, idx, columns))}
              </tbody>
            </table>

            <!-- Pagination -->
            ${
              this.total > this.perPage
                ? html`
              <div class="pagination">
                <span>${msg('Page')} ${this.page} / ${totalPages}</span>
                <div class="pagination__btns">
                  <button
                    class="pagination__btn"
                    ?disabled=${this.page <= 1}
                    @click=${() => this._emitPageChange(this.page - 1)}
                  >&laquo; ${msg('Prev')}</button>
                  <button
                    class="pagination__btn"
                    ?disabled=${this.page >= totalPages}
                    @click=${() => this._emitPageChange(this.page + 1)}
                  >${msg('Next')} &raquo;</button>
                </div>
              </div>
            `
                : nothing
            }
          `
        }
      </div>
    `;
  }

  private _renderRow(
    item: Record<string, unknown>,
    index: number,
    columns: { key: string; label: string }[],
  ): TemplateResult {
    const itemId = String(item.id ?? item.archetype ?? index);
    const isSelected = itemId === this.selectedId;

    return html`
      <tr
        class="table__row ${isSelected ? 'table__row--selected' : ''}"
        role="row"
        tabindex="0"
        @click=${() => this._selectRow(item)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._selectRow(item);
          }
        }}
      >
        ${columns.map(
          (col) => html`
          <td class="table__td" role="gridcell">${this._renderCell(item, col.key)}</td>
        `,
        )}
      </tr>
    `;
  }

  private _renderCell(item: Record<string, unknown>, key: string): TemplateResult | string {
    const value = item[key];

    if (key === 'archetype') {
      const arch = String(value ?? '');
      const cfg = ARCHETYPE_COLORS[arch];
      if (cfg) {
        return html`
          <span class="cell-arch" style="color: var(${cfg.token}); background: color-mix(in srgb, var(${cfg.token}) 12%, transparent);">
            ${cfg.icon} ${cfg.label}
          </span>
        `;
      }
      return html`<span class="cell-arch">${arch}</span>`;
    }

    if (key === 'id') {
      return html`<span class="cell-id" title=${String(value ?? '')}>${String(value ?? '')}</span>`;
    }

    if (key === 'text_en' || key === 'description_en' || key === 'name_en') {
      const text = String(value ?? '');
      const snippet = text.length > 80 ? `${text.substring(0, 80)}\u2026` : text;
      return html`<span class="cell-preview" title=${text}>${snippet}</span>`;
    }

    if (key === 'tier') {
      const tier = Number(value);
      const labels = ['', 'Minor', 'Major', 'Legendary'];
      return html`<span class="cell-meta">${labels[tier] ?? tier}</span>`;
    }

    if (key === 'threat_level') {
      return html`<span class="cell-meta" style="text-transform: uppercase">${String(value ?? '')}</span>`;
    }

    return html`<span class="cell-meta">${String(value ?? '')}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-content-table': DungeonContentTable;
  }
}
