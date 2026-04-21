/**
 * VelgFragmentGrid — paginated fragment list with filters.
 *
 * The primary P0 surface of the Resonance Journal. Loads the user's
 * fragments from the backend, renders them via <velg-fragment-card>,
 * and lets the user filter by source system, fragment type, or rarity.
 *
 * Design principles (docs/plans/resonance-journal-design-direction.md):
 *  - Sparse and dense are equal aesthetic states (principle 12). The
 *    empty state is a moment of quiet, not a broken screen.
 *  - Stagger cascade on card entrances (principle 2: gap space is
 *    content; motion lets the eye find clusters before it reads).
 *  - No progress bars, no completion indicators (principle 9). The
 *    pagination footer shows counts, not percentages.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { journalApi } from '../../services/api/index.js';
import type {
  Fragment,
  FragmentFilters,
  FragmentRarity,
  FragmentSourceType,
  FragmentType,
} from '../../services/api/JournalApiService.js';
import { captureError } from '../../services/SentryService.js';
import { VelgToast } from '../shared/Toast.js';
import './VelgFragmentCard.js';

const PAGE_SIZE = 25;

@localized()
@customElement('velg-fragment-grid')
export class VelgFragmentGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-4) 0;
      border-bottom: 1px dashed var(--color-border-light);
      margin-bottom: var(--space-6);
    }

    .filters__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      padding-right: var(--space-2);
    }

    .filter-select {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      min-height: 36px;
      transition:
        border-color var(--transition-fast),
        color var(--transition-fast);
    }

    .filter-select:hover {
      border-color: var(--_accent-dim);
    }

    .filter-select:focus-visible {
      outline: var(--ring-focus);
      border-color: var(--_accent);
    }

    .filter-clear {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      border: 1px dashed var(--color-border);
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      min-height: 36px;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .filter-clear:hover {
      color: var(--_accent);
      border-color: var(--_accent);
    }

    .filter-clear:focus-visible {
      outline: var(--ring-focus);
    }

    .filter-clear[hidden] {
      display: none;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-5);
      align-items: start;
    }

    .meta-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-8);
      padding-top: var(--space-4);
      border-top: 1px dashed var(--color-border-light);
    }

    .count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .pager {
      display: flex;
      gap: var(--space-2);
    }

    .pager__btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      border: 1px dashed var(--color-border);
      color: var(--color-text-secondary);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      min-height: 36px;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .pager__btn:hover:not([disabled]) {
      color: var(--_accent);
      border-color: var(--_accent);
    }

    .pager__btn:focus-visible {
      outline: var(--ring-focus);
    }

    .pager__btn[disabled] {
      opacity: 0.4;
      cursor: default;
    }

    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }

      .filters {
        gap: var(--space-2);
      }

      .meta-row {
        flex-wrap: wrap;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _fragments: Fragment[] = [];
  @state() private _total = 0;
  @state() private _offset = 0;
  @state() private _sourceType: FragmentSourceType | '' = '';
  @state() private _fragmentType: FragmentType | '' = '';
  @state() private _rarity: FragmentRarity | '' = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private get _hasActiveFilters(): boolean {
    return Boolean(this._sourceType || this._fragmentType || this._rarity);
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const filters: FragmentFilters = {
        limit: PAGE_SIZE,
        offset: this._offset,
      };
      if (this.simulationId) filters.simulation_id = this.simulationId;
      if (this._sourceType) filters.source_type = this._sourceType;
      if (this._fragmentType) filters.fragment_type = this._fragmentType;
      if (this._rarity) filters.rarity = this._rarity;

      const resp = await journalApi.listFragments(filters);
      this._fragments = resp.data ?? [];
      this._total = resp.meta?.total ?? this._fragments.length;
    } catch (err) {
      captureError(err, { source: 'VelgFragmentGrid._load' });
      this._error = msg('The journal could not be loaded.');
      VelgToast.error(this._error);
    } finally {
      this._loading = false;
    }
  }

  private _resetPaginationAndLoad(): void {
    this._offset = 0;
    void this._load();
  }

  private _onSourceTypeChange(e: Event): void {
    this._sourceType = (e.target as HTMLSelectElement).value as FragmentSourceType | '';
    this._resetPaginationAndLoad();
  }

  private _onFragmentTypeChange(e: Event): void {
    this._fragmentType = (e.target as HTMLSelectElement).value as FragmentType | '';
    this._resetPaginationAndLoad();
  }

  private _onRarityChange(e: Event): void {
    this._rarity = (e.target as HTMLSelectElement).value as FragmentRarity | '';
    this._resetPaginationAndLoad();
  }

  private _clearFilters(): void {
    this._sourceType = '';
    this._fragmentType = '';
    this._rarity = '';
    this._resetPaginationAndLoad();
  }

  private _onPrev(): void {
    if (this._offset <= 0) return;
    this._offset = Math.max(0, this._offset - PAGE_SIZE);
    void this._load();
  }

  private _onNext(): void {
    if (this._offset + PAGE_SIZE >= this._total) return;
    this._offset += PAGE_SIZE;
    void this._load();
  }

  private _renderFilters() {
    return html`
      <div class="filters" role="group" aria-label=${msg('Filter fragments')}>
        <span class="filters__label">${msg('Filter')}</span>

        <select
          class="filter-select"
          aria-label=${msg('Source system')}
          .value=${this._sourceType}
          @change=${this._onSourceTypeChange}
        >
          <option value="">${msg('All sources')}</option>
          <option value="dungeon">${msg('Dungeon')}</option>
          <option value="epoch">${msg('Epoch')}</option>
          <option value="simulation">${msg('Simulation')}</option>
          <option value="bond">${msg('Bond')}</option>
          <option value="achievement">${msg('Achievement')}</option>
          <option value="bleed">${msg('Bleed')}</option>
        </select>

        <select
          class="filter-select"
          aria-label=${msg('Fragment type')}
          .value=${this._fragmentType}
          @change=${this._onFragmentTypeChange}
        >
          <option value="">${msg('All types')}</option>
          <option value="imprint">${msg('Imprint')}</option>
          <option value="signature">${msg('Signature')}</option>
          <option value="echo">${msg('Echo')}</option>
          <option value="impression">${msg('Impression')}</option>
          <option value="mark">${msg('Mark')}</option>
          <option value="tremor">${msg('Tremor')}</option>
        </select>

        <select
          class="filter-select"
          aria-label=${msg('Rarity')}
          .value=${this._rarity}
          @change=${this._onRarityChange}
        >
          <option value="">${msg('All rarities')}</option>
          <option value="common">${msg('Common')}</option>
          <option value="uncommon">${msg('Uncommon')}</option>
          <option value="rare">${msg('Rare')}</option>
          <option value="singular">${msg('Singular')}</option>
        </select>

        <button
          type="button"
          class="filter-clear"
          ?hidden=${!this._hasActiveFilters}
          @click=${this._clearFilters}
        >
          ${msg('Clear filters')}
        </button>
      </div>
    `;
  }

  private _renderGrid() {
    if (this._fragments.length === 0) {
      if (this._hasActiveFilters) {
        return html`
          <velg-empty-state
            message=${msg('No fragments match these filters.')}
            cta-label=${msg('Clear filters')}
            @cta-click=${this._clearFilters}
          ></velg-empty-state>
        `;
      }
      return html`
        <velg-empty-state
          message=${msg(
            'The journal is quiet. Fragments gather as you play – dungeon runs, epoch cycles, simulation events, and the voices of agents you have come to know.',
          )}
        ></velg-empty-state>
      `;
    }

    const hasPrev = this._offset > 0;
    const hasNext = this._offset + PAGE_SIZE < this._total;

    return html`
      <div class="grid" role="feed" aria-busy=${String(this._loading)}>
        ${this._fragments.map(
          (fragment, i) => html`
            <div style=${`--i: ${i}`}>
              <velg-fragment-card .fragment=${fragment}></velg-fragment-card>
            </div>
          `,
        )}
      </div>
      <div class="meta-row">
        <span class="count">
          ${msg(`${this._fragments.length} of ${this._total}`, { id: 'journal-fragment-count' })}
        </span>
        <div class="pager">
          <button
            type="button"
            class="pager__btn"
            ?disabled=${!hasPrev}
            @click=${this._onPrev}
            aria-label=${msg('Previous page')}
          >
            ${msg('Previous')}
          </button>
          <button
            type="button"
            class="pager__btn"
            ?disabled=${!hasNext}
            @click=${this._onNext}
            aria-label=${msg('Next page')}
          >
            ${msg('Next')}
          </button>
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading && this._fragments.length === 0) {
      return html`
        ${this._renderFilters()}
        <velg-loading-state></velg-loading-state>
      `;
    }
    if (this._error) {
      return html`
        ${this._renderFilters()}
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._load}
        ></velg-error-state>
      `;
    }
    return html`
      ${this._renderFilters()}
      ${this._renderGrid()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-fragment-grid': VelgFragmentGrid;
  }
}
