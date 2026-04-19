/**
 * VelgContentDraftsList — admin-only paginated list of content drafts.
 *
 * Emits three custom events for the parent wrapper to orchestrate:
 *   - `new-draft`            — "Create draft" button clicked
 *   - `edit-draft`  {id}     — row Edit button clicked
 *   - `publish-batch` {ids}  — multi-select "Publish N Selected" clicked
 *
 * The parent wrapper calls `list.refresh()` directly after successful
 * mutations (create, update, publish) — no refresh event needed.
 *
 * Drafts sharing a pr_number are rendered under a grouped separator header so
 * admins see at a glance which drafts travel together in the same PR. Only
 * drafts in status 'draft' are selectable for batch publish (the state machine
 * rejects publishing conflict/published/merged rows with 409).
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../../services/AppStateManager.js';
import { contentDraftsApi } from '../../../services/api/index.js';
import type {
  ContentDraftStatus,
  ContentDraftSummary,
} from '../../../services/api/ContentDraftsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import '../../shared/EmptyState.js';
import '../../shared/ErrorState.js';
import '../../shared/LoadingState.js';
import '../../shared/Pagination.js';
import '../../shared/VelgBadge.js';
import { VelgConfirmDialog } from '../../shared/ConfirmDialog.js';
import { VelgToast } from '../../shared/Toast.js';

type StatusTab = 'all' | ContentDraftStatus;
type AuthorScope = 'all' | 'mine';

const STATUS_TABS: ReadonlyArray<{ key: StatusTab; label: () => string }> = [
  { key: 'all', label: () => msg('All') },
  { key: 'draft', label: () => msg('Draft') },
  { key: 'conflict', label: () => msg('Conflict') },
  { key: 'published', label: () => msg('Published') },
  { key: 'merged', label: () => msg('Merged') },
  { key: 'abandoned', label: () => msg('Abandoned') },
];

const PAGE_LIMIT = 25;
const MAX_BATCH = 25;

@localized()
@customElement('velg-content-drafts-list')
export class VelgContentDraftsList extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_accent-bg: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .frame {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-5);
    }

    .frame::before,
    .frame::after,
    .frame__corner-bl,
    .frame__corner-br {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      border-color: var(--_accent);
      border-style: solid;
      opacity: 0.55;
      pointer-events: none;
    }
    .frame::before { top: 4px; left: 4px; border-width: 1px 0 0 1px; }
    .frame::after { top: 4px; right: 4px; border-width: 1px 1px 0 0; }
    .frame__corner-bl { bottom: 4px; left: 4px; border-width: 0 0 1px 1px; }
    .frame__corner-br { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-primary);
      margin: 0;
    }

    .header__count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      letter-spacing: var(--tracking-wide);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-4);
      background: transparent;
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .btn:hover:not(:disabled) {
      border-color: var(--_accent);
      color: var(--_accent);
      background: var(--_accent-bg);
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn--primary {
      background: var(--_accent);
      color: var(--color-surface);
      border-color: var(--_accent);
    }
    .btn--primary:hover:not(:disabled) {
      background: var(--color-accent-amber-hover, var(--_accent));
      color: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }

    .tab-bar {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }

    .tab {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-3);
      background: transparent;
      color: var(--color-text-muted);
      border: none;
      cursor: pointer;
      position: relative;
      transition: color var(--transition-fast);
    }
    .tab:hover { color: var(--color-text-primary); }
    .tab--active { color: var(--_accent); }
    .tab--active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: var(--_accent);
    }

    .scope-switch {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
      padding-left: var(--space-3);
    }
    .scope-switch__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }
    .scope-switch__buttons {
      display: inline-flex;
      border: 1px solid var(--color-border);
    }
    .scope-btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 4px 10px;
      background: transparent;
      color: var(--color-text-muted);
      border: none;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .scope-btn--active {
      background: var(--_accent-bg);
      color: var(--_accent);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .pr-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      margin-top: var(--space-2);
      background: color-mix(in srgb, var(--_accent) 6%, transparent);
      border-left: 3px solid var(--_accent-dim);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }
    .pr-group__label {
      color: var(--color-text-muted);
    }
    .pr-group__link {
      color: var(--_accent);
      text-decoration: underline dotted var(--_accent-dim);
      text-underline-offset: 3px;
    }
    .pr-group__link:hover { color: var(--color-accent-amber-hover, var(--_accent)); }

    .row {
      display: grid;
      grid-template-columns: 24px 110px 1fr 180px 80px 120px auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2-5) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }
    .row:hover {
      border-color: var(--color-border);
      background: color-mix(in srgb, var(--color-surface-raised) 50%, transparent);
    }
    .row--selected {
      border-color: var(--_accent-dim);
      background: var(--_accent-bg);
    }

    .row__check {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .row__check input {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--_accent);
    }
    .row__check input:disabled { cursor: not-allowed; opacity: 0.3; }

    .row__path {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .row__pack {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }
    .row__resource {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row__author {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 0;
      text-align: left;
    }

    .row__version {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
    }

    .row__time {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .row__actions {
      display: flex;
      gap: 4px;
      justify-self: end;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      color: var(--color-text-muted);
      border: 1px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .icon-btn:hover:not(:disabled) {
      color: var(--_accent);
      border-color: var(--color-border);
    }
    .icon-btn--danger:hover:not(:disabled) {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }
    .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .status-col velg-badge {
      font-size: 9px;
    }

    .batch-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      margin-top: var(--space-3);
      background: var(--color-surface-raised);
      border: 1px solid var(--_accent-dim);
    }
    .batch-bar__count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--_accent);
    }

    .pagination-wrap { margin-top: var(--space-4); }

    @media (max-width: 900px) {
      .row {
        grid-template-columns: 24px 90px 1fr auto;
      }
      .row__author,
      .row__version,
      .row__time { display: none; }
    }

    @media (max-width: 768px) {
      .icon-btn {
        width: 44px;
        height: 44px;
      }
      .row__check input {
        width: 22px;
        height: 22px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn, .icon-btn, .row { transition: none; }
    }
  `;

  @state() private _drafts: ContentDraftSummary[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _total = 0;
  @state() private _offset = 0;
  @state() private _statusTab: StatusTab = 'all';
  @state() private _authorScope: AuthorScope = 'all';
  @state() private _selected = new Set<string>();

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  /** Public entry point — parent wrappers call this after mutations resolve. */
  async refresh(): Promise<void> {
    await this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const statuses =
        this._statusTab === 'all' ? undefined : [this._statusTab as ContentDraftStatus];
      const userId = appState.user.value?.id;
      const authorId =
        this._authorScope === 'mine' && userId ? userId : undefined;
      const response = await contentDraftsApi.listDrafts({
        status: statuses,
        author_id: authorId,
        limit: PAGE_LIMIT,
        offset: this._offset,
      });
      if (response.success) {
        this._drafts = response.data;
        this._total = response.meta?.total ?? response.data.length;
        this._pruneSelectionToVisible();
      } else {
        this._error = response.error?.message ?? msg('Failed to load drafts.');
      }
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftsList._load' });
      this._error = err instanceof Error ? err.message : msg('Failed to load drafts.');
    } finally {
      this._loading = false;
    }
  }

  private _pruneSelectionToVisible(): void {
    const visible = new Set(this._drafts.map((d) => d.id));
    const pruned = new Set<string>();
    for (const id of this._selected) {
      if (visible.has(id)) pruned.add(id);
    }
    this._selected = pruned;
  }

  private _setStatusTab(tab: StatusTab): void {
    if (this._statusTab === tab) return;
    this._statusTab = tab;
    this._offset = 0;
    void this._load();
  }

  private _setAuthorScope(scope: AuthorScope): void {
    if (this._authorScope === scope) return;
    this._authorScope = scope;
    this._offset = 0;
    void this._load();
  }

  private _handlePageChange(e: CustomEvent<{ limit: number; offset: number }>): void {
    this._offset = e.detail.offset;
    void this._load();
  }

  private _toggleSelect(draft: ContentDraftSummary): void {
    if (draft.status !== 'draft') return;
    const next = new Set(this._selected);
    if (next.has(draft.id)) next.delete(draft.id);
    else if (next.size < MAX_BATCH) next.add(draft.id);
    else {
      VelgToast.warning(
        msg(str`A publish batch holds at most ${MAX_BATCH} drafts. Submit this batch first.`),
      );
      return;
    }
    this._selected = next;
  }

  private _handleNewDraft(): void {
    this.dispatchEvent(
      new CustomEvent('new-draft', { bubbles: true, composed: true }),
    );
  }

  private _handleEditDraft(draft: ContentDraftSummary): void {
    this.dispatchEvent(
      new CustomEvent('edit-draft', {
        detail: { id: draft.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _handleAbandon(draft: ContentDraftSummary): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Abandon draft?'),
      message: msg(
        str`This marks the draft as abandoned. The row stays in the database for audit. Pack ${draft.pack_slug}, resource ${draft.resource_path}.`,
      ),
      confirmLabel: msg('Abandon'),
      variant: 'danger',
    });
    if (!confirmed) return;
    const response = await contentDraftsApi.abandonDraft(draft.id);
    if (response.success) {
      VelgToast.success(msg('Draft abandoned.'));
      const next = new Set(this._selected);
      next.delete(draft.id);
      this._selected = next;
      await this._load();
    } else {
      VelgToast.error(response.error?.message ?? msg('Abandon failed.'));
    }
  }

  private _handlePublishSelected(): void {
    if (this._selected.size === 0) return;
    const selectedIds = Array.from(this._selected);
    const selectedDrafts = this._drafts.filter((d) => this._selected.has(d.id));
    this.dispatchEvent(
      new CustomEvent('publish-batch', {
        detail: { ids: selectedIds, drafts: selectedDrafts },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Clear selection (called by parent after successful publish). */
  clearSelection(): void {
    this._selected = new Set();
  }

  private _badgeVariant(status: ContentDraftStatus) {
    switch (status) {
      case 'draft':
        return 'info';
      case 'conflict':
        return 'warning';
      case 'published':
        return 'primary';
      case 'merged':
        return 'success';
      case 'abandoned':
        return 'danger';
    }
  }

  private _statusLabel(status: ContentDraftStatus): string {
    switch (status) {
      case 'draft':
        return msg('Draft');
      case 'conflict':
        return msg('Conflict');
      case 'published':
        return msg('Published');
      case 'merged':
        return msg('Merged');
      case 'abandoned':
        return msg('Abandoned');
    }
  }

  private _formatUpdatedAt(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftsList._formatUpdatedAt' });
      return iso.slice(0, 16);
    }
  }

  private _abbreviateAuthor(authorId: string): string {
    return authorId.slice(0, 8);
  }

  /** Group consecutive drafts by pr_number for the PR-group header rows. */
  private _groupByPr(): Array<
    { type: 'header'; prNumber: number; prUrl: string | null }
    | { type: 'row'; draft: ContentDraftSummary }
  > {
    const out: Array<
      { type: 'header'; prNumber: number; prUrl: string | null }
      | { type: 'row'; draft: ContentDraftSummary }
    > = [];
    let lastPr: number | null = null;
    for (const d of this._drafts) {
      if (d.pr_number != null && d.pr_number !== lastPr) {
        out.push({ type: 'header', prNumber: d.pr_number, prUrl: d.pr_url });
        lastPr = d.pr_number;
      }
      if (d.pr_number == null) lastPr = null;
      out.push({ type: 'row', draft: d });
    }
    return out;
  }

  protected render() {
    return html`
      <div class="frame">
        <span class="frame__corner-bl"></span>
        <span class="frame__corner-br"></span>

        <div class="header">
          <div>
            <h2 class="header__title">${msg('Content Drafts')}</h2>
            <span class="header__count">
              ${msg(str`${this._total} total`)}
            </span>
          </div>
          <button
            class="btn btn--primary"
            @click=${this._handleNewDraft}
            aria-label=${msg('Create a new content draft')}
          >
            ${icons.plus(12)} ${msg('New Draft')}
          </button>
        </div>

        <div class="tab-bar">
          ${STATUS_TABS.map(
            (t) => html`
              <button
                class="tab ${this._statusTab === t.key ? 'tab--active' : ''}"
                role="tab"
                aria-selected=${this._statusTab === t.key ? 'true' : 'false'}
                @click=${() => this._setStatusTab(t.key)}
              >
                ${t.label()}
              </button>
            `,
          )}
          <span class="scope-switch">
            <span class="scope-switch__label">${msg('Author')}</span>
            <span class="scope-switch__buttons">
              <button
                class="scope-btn ${this._authorScope === 'all' ? 'scope-btn--active' : ''}"
                @click=${() => this._setAuthorScope('all')}
              >
                ${msg('All')}
              </button>
              <button
                class="scope-btn ${this._authorScope === 'mine' ? 'scope-btn--active' : ''}"
                @click=${() => this._setAuthorScope('mine')}
              >
                ${msg('Mine')}
              </button>
            </span>
          </span>
        </div>

        ${this._renderBody()}

        <div class="pagination-wrap">
          <velg-pagination
            .total=${this._total}
            .limit=${PAGE_LIMIT}
            .offset=${this._offset}
            @page-change=${this._handlePageChange}
          ></velg-pagination>
        </div>
      </div>
    `;
  }

  private _renderBody() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading drafts...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._load}
        ></velg-error-state>
      `;
    }
    if (this._drafts.length === 0) {
      return html`
        <velg-empty-state
          message=${msg('No drafts in this view. Create one to begin.')}
        ></velg-empty-state>
      `;
    }

    const items = this._groupByPr();
    return html`
      <div class="list" role="list">
        ${items.map((item) =>
          item.type === 'header' ? this._renderPrGroup(item) : this._renderRow(item.draft),
        )}
      </div>
      ${this._selected.size > 0 ? this._renderBatchBar() : nothing}
    `;
  }

  private _renderPrGroup(g: { prNumber: number; prUrl: string | null }) {
    return html`
      <div class="pr-group" role="listitem">
        <span class="pr-group__label">${msg('PR')}</span>
        ${g.prUrl
          ? html`<a
              class="pr-group__link"
              href=${g.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              >#${g.prNumber}</a
            >`
          : html`<span class="pr-group__link">#${g.prNumber}</span>`}
      </div>
    `;
  }

  private _renderRow(draft: ContentDraftSummary) {
    const isSelected = this._selected.has(draft.id);
    const selectable = draft.status === 'draft';
    const canAbandon = draft.status === 'draft' || draft.status === 'conflict';
    return html`
      <div class="row ${isSelected ? 'row--selected' : ''}" role="listitem">
        <div class="row__check">
          <input
            type="checkbox"
            .checked=${isSelected}
            ?disabled=${!selectable}
            aria-label=${msg('Select for batch publish')}
            @change=${() => this._toggleSelect(draft)}
          />
        </div>
        <div class="status-col">
          <velg-badge variant=${this._badgeVariant(draft.status)}>
            ${this._statusLabel(draft.status)}
          </velg-badge>
        </div>
        <div class="row__path">
          <span class="row__pack">${draft.pack_slug}</span>
          <span class="row__resource" title=${draft.resource_path}>${draft.resource_path}</span>
        </div>
        <div class="row__author" title=${draft.author_id}>
          ${this._abbreviateAuthor(draft.author_id)}
        </div>
        <div class="row__version">v${draft.version}</div>
        <div class="row__time">${this._formatUpdatedAt(draft.updated_at)}</div>
        <div class="row__actions">
          <button
            class="icon-btn"
            aria-label=${msg('Edit draft')}
            @click=${() => this._handleEditDraft(draft)}
          >
            ${icons.edit(14)}
          </button>
          <button
            class="icon-btn icon-btn--danger"
            ?disabled=${!canAbandon}
            aria-label=${msg('Abandon draft')}
            @click=${() => this._handleAbandon(draft)}
          >
            ${icons.trash(14)}
          </button>
        </div>
      </div>
    `;
  }

  private _renderBatchBar() {
    const count = this._selected.size;
    return html`
      <div class="batch-bar" role="region" aria-label=${msg('Batch publish controls')}>
        <span class="batch-bar__count">
          ${msg(str`${count} of ${MAX_BATCH} selected for publish`)}
        </span>
        <button class="btn btn--primary" @click=${this._handlePublishSelected}>
          ${icons.upload(12)} ${msg('Publish selected')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-content-drafts-list': VelgContentDraftsList;
  }
}
