/**
 * VelgConstellationList — the Constellations tab of the Resonance Journal.
 *
 * Lists the user's constellations in three status-scoped sub-tabs
 * (drafting / crystallized / archived). Opening a constellation routes
 * to /journal/constellations/{id} for the canvas view. Creating a new
 * draft POSTs an empty constellation and navigates straight into it.
 *
 * Design-direction principles load-bearing on this view:
 *  - Principle 9 (no progress, no completion): the draft tab does not
 *    show a "progress toward crystallization" meter, nor a countdown.
 *    A draft is a place to think; it never expires.
 *  - Principle 8 (provenance marks quotation): crystallized rows render
 *    the first clause of the Insight in the Palimpsest register
 *    (Spectral italic) with an amber left rule — the same register used
 *    by the agent-voice fragment type, because the Insight is the
 *    journal addressing the user back (Philemon, per §4).
 *  - Principle 12 (sparse and dense are equal aesthetic states): the
 *    empty state of each tab is a quiet line of prose, not a broken
 *    screen.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { journalApi } from '../../services/api/index.js';
import type { Constellation, ConstellationStatus } from '../../services/api/JournalApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import { navigate } from '../../utils/navigation.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/EmptyState.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';

@localized()
@customElement('velg-constellation-list')
export class VelgConstellationList extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_ink: color-mix(in srgb, var(--color-text-primary) 92%, transparent);
      --_rule: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-border));
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding: var(--space-2) 0 var(--space-5);
      border-bottom: 1px dashed var(--color-border-light);
      margin-bottom: var(--space-6);
    }

    .filter-tabs {
      display: flex;
      gap: var(--space-1);
    }

    .filter-tab {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-muted);
      border: 1px dashed var(--color-border);
      padding: var(--space-2) var(--space-4);
      min-height: 36px;
      cursor: pointer;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .filter-tab:hover {
      color: var(--_accent);
      border-color: var(--_accent-dim);
    }

    .filter-tab:focus-visible {
      outline: var(--ring-focus);
    }

    .filter-tab[aria-pressed='true'] {
      color: var(--_accent);
      border-color: var(--_accent);
      border-style: solid;
    }

    .create-btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      background: transparent;
      border: 2px solid var(--_accent);
      padding: var(--space-2) var(--space-5);
      min-height: 40px;
      cursor: pointer;
      transition:
        background var(--transition-fast),
        color var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .create-btn:hover:not([disabled]) {
      background: var(--_accent);
      color: var(--color-text-inverse);
      box-shadow: var(--shadow-sm);
    }

    .create-btn:focus-visible {
      outline: var(--ring-focus);
    }

    .create-btn[disabled] {
      opacity: 0.5;
      cursor: wait;
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: var(--space-5);
    }

    .row {
      position: relative;
      background: color-mix(in srgb, var(--color-surface-raised) 92%, var(--color-accent-amber) 2%);
      border: 1px solid var(--color-border);
      padding: var(--space-5) var(--space-6);
      cursor: pointer;
      opacity: 0;
      animation: row-in var(--duration-entrance) var(--ease-dramatic)
        calc(var(--i, 0) * var(--duration-stagger)) forwards;
      transition:
        border-color var(--transition-normal),
        box-shadow var(--transition-normal);
    }

    .row:hover,
    .row:focus-visible {
      border-color: var(--_accent-dim);
      box-shadow: var(--shadow-xs);
    }

    .row:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    .row--crystallized {
      border-color: color-mix(in srgb, var(--color-accent-amber) 45%, var(--color-border));
    }

    .row--archived {
      opacity: 0.7;
      animation-duration: var(--duration-fast);
    }

    .row__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .row__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-md);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      line-height: var(--leading-tight);
    }

    .row__name--unset {
      font-family: var(--font-prose);
      font-style: italic;
      font-weight: var(--font-normal);
      text-transform: none;
      letter-spacing: 0.005em;
      color: var(--color-text-muted);
    }

    .row__status {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .row__status--crystallized {
      color: var(--_accent);
    }

    .row__insight {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--_ink);
      border-left: 3px solid var(--_rule);
      padding-left: var(--space-3);
      margin: var(--space-3) 0 var(--space-4);
      /* Two-line clamp keeps rows dense when many crystallized. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .row__meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px dashed var(--color-border-light);
    }

    .row__count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .row__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .empty-note {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      max-width: 52ch;
      margin: 0 auto;
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    @keyframes row-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .row {
        animation: none;
        opacity: 1;
      }
    }

    @media (max-width: 640px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-tabs {
        flex-wrap: wrap;
      }

      .list {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }

      .row {
        padding: var(--space-4);
      }
    }
  `;

  @state() private _loading = true;
  @state() private _creating = false;
  @state() private _error: string | null = null;
  @state() private _items: Constellation[] = [];
  @state() private _status: ConstellationStatus = 'drafting';

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await journalApi.listConstellations(this._status);
      if (!resp.success) {
        this._error = resp.error.message || msg('The constellations could not be loaded.');
        return;
      }
      this._items = resp.data ?? [];
    } catch (err) {
      captureError(err, { source: 'VelgConstellationList._load' });
      this._error = msg('The constellations could not be loaded.');
    } finally {
      this._loading = false;
    }
  }

  private _selectStatus(next: ConstellationStatus): void {
    if (next === this._status) return;
    this._status = next;
    void this._load();
  }

  private async _createDraft(): Promise<void> {
    if (this._creating) return;
    this._creating = true;
    try {
      const resp = await journalApi.createConstellation({});
      if (!resp.success) {
        VelgToast.error(resp.error.message || msg('Could not open a new draft.'));
        return;
      }
      navigate(`/journal/constellations/${resp.data.id}`);
    } catch (err) {
      captureError(err, { source: 'VelgConstellationList._createDraft' });
      VelgToast.error(msg('Could not open a new draft.'));
    } finally {
      this._creating = false;
    }
  }

  private _openRow(id: string, ev: KeyboardEvent | MouseEvent): void {
    if (ev instanceof KeyboardEvent && ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    navigate(`/journal/constellations/${id}`);
  }

  private _name(row: Constellation): string | null {
    const locale = localeService.currentLocale;
    const preferred = locale === 'de' ? row.name_de : row.name_en;
    return preferred || row.name_en || row.name_de || null;
  }

  private _insight(row: Constellation): string | null {
    const locale = localeService.currentLocale;
    const preferred = locale === 'de' ? row.insight_de : row.insight_en;
    return preferred || row.insight_en || row.insight_de || null;
  }

  private _statusLabel(status: ConstellationStatus): string {
    switch (status) {
      case 'drafting':
        return msg('Drafting');
      case 'crystallized':
        return msg('Crystallized');
      case 'archived':
        return msg('Archived');
    }
  }

  private _timestamp(row: Constellation): string {
    if (row.status === 'crystallized' && row.crystallized_at) return row.crystallized_at;
    if (row.status === 'archived' && row.archived_at) return row.archived_at;
    return row.created_at;
  }

  private _emptyMessage(status: ConstellationStatus): string {
    switch (status) {
      case 'drafting':
        return msg(
          'No drafts in progress. A constellation begins as an empty canvas – pick fragments, let them settle next to each other, see what the arrangement starts to say.',
        );
      case 'crystallized':
        return msg(
          'No constellations have yet been sealed. When a draft reaches its shape, crystallizing it stamps the moment and records the Insight the arrangement produced.',
        );
      case 'archived':
        return msg('Nothing has been set aside.');
    }
  }

  private _renderToolbar() {
    const tabs: ConstellationStatus[] = ['drafting', 'crystallized', 'archived'];
    return html`
      <div class="toolbar">
        <div class="filter-tabs" role="tablist" aria-label=${msg('Filter by status')}>
          ${tabs.map(
            (key) => html`
              <button
                type="button"
                class="filter-tab"
                role="tab"
                aria-pressed=${this._status === key ? 'true' : 'false'}
                aria-selected=${this._status === key ? 'true' : 'false'}
                @click=${() => this._selectStatus(key)}
              >
                ${this._statusLabel(key)}
              </button>
            `,
          )}
        </div>
        <button
          type="button"
          class="create-btn"
          ?disabled=${this._creating}
          @click=${this._createDraft}
          aria-busy=${String(this._creating)}
        >
          ${this._creating ? msg('Opening…') : msg('Begin a draft')}
        </button>
      </div>
    `;
  }

  private _renderRow(row: Constellation, i: number) {
    const name = this._name(row);
    const insight = this._insight(row);
    const fragmentCount = row.fragments.length;
    const statusClass =
      row.status === 'crystallized'
        ? 'row row--crystallized'
        : row.status === 'archived'
          ? 'row row--archived'
          : 'row';
    const statusLabelClass =
      row.status === 'crystallized' ? 'row__status row__status--crystallized' : 'row__status';

    return html`
      <article
        class=${statusClass}
        style=${`--i: ${i}`}
        role="button"
        tabindex="0"
        aria-label=${name ?? msg('Untitled constellation')}
        @click=${(e: MouseEvent) => this._openRow(row.id, e)}
        @keydown=${(e: KeyboardEvent) => this._openRow(row.id, e)}
      >
        <header class="row__header">
          <h3 class=${name ? 'row__name' : 'row__name row__name--unset'}>
            ${name ?? msg('Untitled')}
          </h3>
          <span class=${statusLabelClass}>${this._statusLabel(row.status)}</span>
        </header>
        ${insight ? html`<p class="row__insight">${insight}</p>` : ''}
        <div class="row__meta">
          <span class="row__count">
            ${
              fragmentCount === 1
                ? msg('1 fragment')
                : msg(`${fragmentCount} fragments`, { id: 'journal-constellation-count' })
            }
          </span>
          <time class="row__time" datetime=${this._timestamp(row)}>
            ${formatRelativeTime(this._timestamp(row))}
          </time>
        </div>
      </article>
    `;
  }

  protected render() {
    if (this._loading && this._items.length === 0) {
      return html`
        ${this._renderToolbar()}
        <velg-loading-state></velg-loading-state>
      `;
    }
    if (this._error) {
      return html`
        ${this._renderToolbar()}
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._load}
        ></velg-error-state>
      `;
    }
    if (this._items.length === 0) {
      return html`
        ${this._renderToolbar()}
        <p class="empty-note">${this._emptyMessage(this._status)}</p>
      `;
    }
    return html`
      ${this._renderToolbar()}
      <div class="list" role="feed" aria-busy=${String(this._loading)}>
        ${this._items.map((row, i) => this._renderRow(row, i))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-constellation-list': VelgConstellationList;
  }
}
