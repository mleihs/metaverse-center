/**
 * VelgSweepOrphansModal — admin UI for the A1.7 Phase 7 orphan-branch sweeper.
 *
 * Flow:
 *   idle (initial) → auto-runs dry-run on open; spinner while in flight.
 *   preview       → shows classification table; primary CTA enabled only
 *                   when at least one branch is classified 'delete'.
 *   deleting      → real-run DELETE in flight; buttons disabled.
 *   done          → summary banner + refreshed classifications (each row's
 *                   `deleted` / `error` is now meaningful). One-way state:
 *                   the admin closes the modal to start over.
 *   error         → banner + retry-from-preview button.
 *
 * Why always dry-run first:
 *   The sweeper deletes GitHub branches — irreversible from this UI (you'd
 *   restore from the repo's reflog manually). Forcing a preview makes the
 *   action auditable before it happens and surfaces unexpected branches
 *   (e.g. a merged PR whose auto-deletion GitHub skipped).
 *
 * Safety details mirror the backend docstring:
 *   - Only `content/drafts-batch-*` branches are ever listed/deleted.
 *   - `min_age_days` (default 7) protects PR-less branches from an in-flight
 *     publish race.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  OrphanBranchClassification,
  SweepOrphansResult,
} from '../../../services/api/ContentDraftsApiService.js';
import { contentDraftsApi } from '../../../services/api/index.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import '../../shared/BaseModal.js';

type ModalState = 'loading' | 'preview' | 'deleting' | 'done' | 'error';

@localized()
@customElement('velg-sweep-orphans-modal')
export class VelgSweepOrphansModal extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_danger-bg: color-mix(in srgb, var(--color-danger) 10%, transparent);
      --_danger-border: color-mix(in srgb, var(--color-danger) 40%, transparent);
      --_warn-bg: color-mix(in srgb, var(--color-warning) 8%, transparent);
      --_success-bg: color-mix(in srgb, var(--color-success) 10%, transparent);
      --_keep-bg: color-mix(in srgb, var(--color-success) 14%, transparent);
      --_keep-fg: var(--color-success);
      --_delete-bg: color-mix(in srgb, var(--color-danger) 14%, transparent);
      --_delete-fg: var(--color-danger);
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .lead {
      font-size: var(--text-xs);
      line-height: 1.55;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-3);
    }

    .banner {
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.55;
      border-left: 3px solid;
    }
    .banner--warn {
      background: var(--_warn-bg);
      border-left-color: var(--color-warning);
    }
    .banner--error {
      background: var(--_danger-bg);
      border-left-color: var(--color-danger);
    }
    .banner--success {
      background: var(--_success-bg);
      border-left-color: var(--color-success);
    }
    .banner__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      margin: 0 0 var(--space-1);
    }

    .totals {
      display: flex;
      gap: var(--space-4);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border-light);
      margin-bottom: var(--space-3);
    }
    .totals__item strong {
      color: var(--color-text-primary);
      font-weight: var(--font-bold);
    }

    .table {
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid var(--color-border-light);
      background: var(--color-surface-sunken);
      margin-bottom: var(--space-3);
    }
    /* Two-row grid per branch:
         row 1: status | name ........... | age | pr | result
         row 2: (empty) | reason spans 2..-1
       Explicit grid-template-rows keeps the intent visible; implicit
       auto-flow works but hides the 2-row shape from a reader. */
    .row {
      display: grid;
      grid-template-columns: 76px 1fr 60px 90px 24px;
      grid-template-rows: auto auto;
      gap: 2px var(--space-2);
      align-items: center;
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      border-bottom: 1px solid var(--color-border-light);
    }
    .row:last-child {
      border-bottom: none;
    }
    .row__status {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      padding: 2px 6px;
      text-align: center;
      white-space: nowrap;
    }
    .row__status--keep {
      background: var(--_keep-bg);
      color: var(--_keep-fg);
    }
    .row__status--delete {
      background: var(--_delete-bg);
      color: var(--_delete-fg);
    }
    .row__name {
      font-family: var(--font-mono);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-text-primary);
    }
    .row__age {
      color: var(--color-text-muted);
      text-align: right;
      white-space: nowrap;
    }
    .row__pr {
      color: var(--color-text-muted);
      text-align: right;
      white-space: nowrap;
    }
    .row__pr a {
      color: var(--color-text-link);
      text-decoration: none;
    }
    .row__pr a:hover {
      text-decoration: underline;
    }
    .row__result {
      text-align: center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 14px;
    }
    .row__result--deleted {
      color: var(--color-success);
    }
    .row__result--error {
      color: var(--color-danger);
    }
    .row__reason {
      grid-column: 2 / -1;
      padding-top: 2px;
      font-size: 10px;
      color: var(--color-text-muted);
      font-style: italic;
      line-height: 1.4;
    }

    .empty {
      padding: var(--space-5);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    .loading {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: background var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    .btn:hover:not(:disabled) {
      background: var(--color-surface-header);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn--danger {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: var(--_danger-bg);
    }
    .btn--danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger) 20%, transparent);
    }

    .actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .btn {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _state: ModalState = 'loading';
  @state() private _result: SweepOrphansResult | null = null;
  @state() private _error: string | null = null;

  // Tracks the most-recent open-cycle so a stale request cannot overwrite
  // a fresh state (admin closes + reopens mid-sweep).
  private _openToken = 0;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('open') && this.open && !changed.get('open')) {
      this._openToken += 1;
      this._state = 'loading';
      this._result = null;
      this._error = null;
      void this._runSweep(true, this._openToken);
    }
  }

  private async _runSweep(dryRun: boolean, token: number): Promise<void> {
    if (!dryRun) this._state = 'deleting';
    try {
      // min_age_days intentionally omitted — backend owns the single
      // source of truth (DEFAULT_MIN_AGE_DAYS). Customization would
      // go here if the UI grows a slider.
      const res = await contentDraftsApi.sweepOrphans({ dry_run: dryRun });
      if (token !== this._openToken) return;
      if (!res.success) {
        this._error = res.error.message;
        this._state = 'error';
        return;
      }
      this._result = res.data;
      this._state = dryRun ? 'preview' : 'done';
    } catch (err) {
      if (token !== this._openToken) return;
      captureError(err, { source: 'VelgSweepOrphansModal._runSweep' });
      this._error = err instanceof Error ? err.message : String(err);
      this._state = 'error';
    }
  }

  private _handleRerunPreview(): void {
    this._state = 'loading';
    void this._runSweep(true, this._openToken);
  }

  private _handleDelete(): void {
    void this._runSweep(false, this._openToken);
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  protected render(): TemplateResult {
    const deleteCount = this._result?.branches.filter((b) => b.status === 'delete').length ?? 0;

    return html`
      <velg-base-modal
        ?open=${this.open}
        modal-name="sweep-orphans"
        @modal-close=${this._handleClose}
      >
        <span slot="header">${msg('Orphan branch sweep')}</span>

        <div>
          <p class="lead">
            ${msg(
              'Review branches created by the publish flow. Classification considers PR state first; branches with no PR fall back to a commit-age threshold applied server-side.',
            )}
          </p>

          ${this._renderBody()}
        </div>

        <div slot="footer" class="actions">${this._renderActions(deleteCount)}</div>
      </velg-base-modal>
    `;
  }

  private _renderBody(): TemplateResult {
    if (this._state === 'loading') {
      return html`<div class="loading">${msg('Scanning repo branches…')}</div>`;
    }
    if (this._state === 'error') {
      return html`
        <div class="banner banner--error">
          <p class="banner__title">${msg('Sweep failed')}</p>
          ${this._error ?? msg('Unknown error.')}
        </div>
      `;
    }
    const result = this._result;
    if (!result) return html``;

    return html`
      ${this._state === 'done' ? this._renderDoneBanner(result) : nothing}
      ${
        result.total_found === 0
          ? html`<div class="empty">${msg('No draft-batch branches found on the repo.')}</div>`
          : html`
            <div class="totals">
              <span class="totals__item">
                ${msg('Found')} <strong>${result.total_found}</strong>
              </span>
              <span class="totals__item">
                ${msg('Keep')} <strong>${result.kept_count}</strong>
              </span>
              <span class="totals__item">
                ${msg('Delete')} <strong>${result.total_found - result.kept_count}</strong>
              </span>
              ${
                this._state === 'done'
                  ? html`
                    <span class="totals__item">
                      ${msg('Deleted')} <strong>${result.deleted_count}</strong>
                    </span>
                    <span class="totals__item">
                      ${msg('Errors')} <strong>${result.error_count}</strong>
                    </span>
                  `
                  : nothing
              }
            </div>

            <div class="table" role="table" aria-label=${msg('Orphan branch classification')}>
              ${result.branches.map((b) => this._renderRow(b))}
            </div>
          `
      }
    `;
  }

  private _renderRow(b: OrphanBranchClassification): TemplateResult {
    const statusLabel = b.status === 'keep' ? msg('Keep') : msg('Delete');
    const prCell =
      b.pr_number !== null
        ? html`#${b.pr_number} <span>${b.pr_state ?? ''}</span>`
        : html`<span>${msg('no PR')}</span>`;
    const age =
      b.age_days >= 1
        ? msg(str`${b.age_days.toFixed(1)}d`)
        : msg(str`${Math.round(b.age_days * 24)}h`);

    return html`
      <div class="row" role="row">
        <span class="row__status row__status--${b.status}" role="cell">${statusLabel}</span>
        <span class="row__name" title=${b.name} role="cell">${b.name}</span>
        <span class="row__age" role="cell">${age}</span>
        <span class="row__pr" role="cell">${prCell}</span>
        <span class="row__result ${this._resultClass(b)}" role="cell" aria-label=${this._resultAriaLabel(b)}>
          ${this._resultSymbol(b)}
        </span>
        <span class="row__reason" role="cell">
          ${b.reason}${b.error ? html` · ${b.error}` : nothing}
        </span>
      </div>
    `;
  }

  private _resultAriaLabel(b: OrphanBranchClassification): string {
    if (b.deleted) return msg('Deleted');
    if (b.error) return msg('Delete failed');
    return msg('Pending');
  }

  private _resultClass(b: OrphanBranchClassification): string {
    if (b.deleted) return 'row__result--deleted';
    if (b.error) return 'row__result--error';
    return '';
  }

  private _resultSymbol(b: OrphanBranchClassification): string {
    if (b.deleted) return '✓';
    if (b.error) return '✗';
    return '';
  }

  private _renderDoneBanner(result: SweepOrphansResult): TemplateResult {
    if (result.error_count > 0) {
      return html`
        <div class="banner banner--warn">
          <p class="banner__title">${msg('Sweep complete with errors')}</p>
          ${msg(
            str`Deleted ${result.deleted_count} branch(es). ${result.error_count} failed – see row details below.`,
          )}
        </div>
      `;
    }
    return html`
      <div class="banner banner--success">
        <p class="banner__title">${msg('Sweep complete')}</p>
        ${
          result.deleted_count === 0
            ? msg('Nothing needed deletion.')
            : msg(str`Deleted ${result.deleted_count} branch(es) cleanly.`)
        }
      </div>
    `;
  }

  private _renderActions(deleteCount: number): TemplateResult {
    if (this._state === 'loading' || this._state === 'deleting') {
      return html`
        <button class="btn" disabled>
          ${this._state === 'loading' ? msg('Scanning…') : msg('Deleting…')}
        </button>
      `;
    }
    if (this._state === 'done') {
      return html`<button class="btn" @click=${this._handleClose}>${msg('Close')}</button>`;
    }
    // preview or error
    const canDelete = this._state === 'preview' && deleteCount > 0;
    return html`
      <button class="btn" @click=${this._handleClose}>${msg('Close')}</button>
      <button class="btn" @click=${this._handleRerunPreview}>
        ${icons.refresh(12)} ${msg('Re-run preview')}
      </button>
      ${
        canDelete
          ? html`
            <button class="btn btn--danger" @click=${this._handleDelete}>
              ${icons.trash(12)}
              ${
                deleteCount === 1
                  ? msg('Delete 1 branch')
                  : msg(str`Delete ${deleteCount} branches`)
              }
            </button>
          `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-sweep-orphans-modal': VelgSweepOrphansModal;
  }
}
