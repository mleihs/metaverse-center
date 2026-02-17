import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-pagination')
export class VelgPagination extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-3) 0;
      flex-wrap: wrap;
    }

    .pagination__info {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    .pagination__controls {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .pagination__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      padding: 0 var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .pagination__btn:hover:not(:disabled) {
      background: var(--color-surface-sunken);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-xs);
    }

    .pagination__btn:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    .pagination__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .pagination__btn--active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
    }

    .pagination__btn--active:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .pagination__ellipsis {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .pagination__limit {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .pagination__limit-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .pagination__limit-select {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-2);
      border: var(--border-medium);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .pagination__limit-select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }
  `;

  @property({ type: Number }) total = 0;
  @property({ type: Number }) limit = 25;
  @property({ type: Number }) offset = 0;

  private get _currentPage(): number {
    return Math.floor(this.offset / this.limit) + 1;
  }

  private get _totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  private get _showingStart(): number {
    if (this.total === 0) return 0;
    return this.offset + 1;
  }

  private get _showingEnd(): number {
    return Math.min(this.offset + this.limit, this.total);
  }

  private _emitPageChange(newOffset: number): void {
    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: { limit: this.limit, offset: newOffset },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _goToPage(page: number): void {
    const newOffset = (page - 1) * this.limit;
    this._emitPageChange(newOffset);
  }

  private _handlePrevious(): void {
    if (this._currentPage > 1) {
      this._goToPage(this._currentPage - 1);
    }
  }

  private _handleNext(): void {
    if (this._currentPage < this._totalPages) {
      this._goToPage(this._currentPage + 1);
    }
  }

  private _handleLimitChange(e: Event): void {
    const newLimit = Number((e.target as HTMLSelectElement).value);
    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: { limit: newLimit, offset: 0 },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _getVisiblePages(): (number | 'ellipsis')[] {
    const total = this._totalPages;
    const current = this._currentPage;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (current > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('ellipsis');
    }

    if (total > 1) {
      pages.push(total);
    }

    return pages;
  }

  protected render() {
    if (this.total === 0) return html``;

    const pages = this._getVisiblePages();

    return html`
      <div class="pagination">
        <div class="pagination__info">
          ${msg(str`Showing ${this._showingStart}-${this._showingEnd} of ${this.total}`)}
        </div>

        <div class="pagination__controls">
          <button
            class="pagination__btn"
            ?disabled=${this._currentPage <= 1}
            @click=${this._handlePrevious}
          >
            ${msg('Prev')}
          </button>

          ${pages.map((page) =>
            page === 'ellipsis'
              ? html`<span class="pagination__ellipsis">...</span>`
              : html`
                <button
                  class="pagination__btn ${page === this._currentPage ? 'pagination__btn--active' : ''}"
                  @click=${() => this._goToPage(page)}
                >
                  ${page}
                </button>
              `,
          )}

          <button
            class="pagination__btn"
            ?disabled=${this._currentPage >= this._totalPages}
            @click=${this._handleNext}
          >
            ${msg('Next')}
          </button>
        </div>

        <div class="pagination__limit">
          <span class="pagination__limit-label">${msg('Per page')}</span>
          <select
            class="pagination__limit-select"
            .value=${String(this.limit)}
            @change=${this._handleLimitChange}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-pagination': VelgPagination;
  }
}
