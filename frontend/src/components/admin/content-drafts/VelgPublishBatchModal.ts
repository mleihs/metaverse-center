/**
 * VelgPublishBatchModal — confirm + execute a batch publish.
 *
 * Properties:
 *   - `open`       — BaseModal open state
 *   - `drafts`     — ContentDraftSummary[] already-selected (parent filters
 *                    its list by selected ids before passing in, to avoid
 *                    a needless DB round-trip)
 *
 * Flow:
 *   idle       → admin sees drafts + deploy-lag warning + optional commit msg
 *   submitting → publishBatch RPC in flight; buttons disabled
 *   success    → replaces body with "Opened PR #N" + link + Close button.
 *                Fires `publish-success` so parent can refresh the list.
 *   error      → shows error banner; stays open; buttons re-enabled so admin
 *                can retry or cancel.
 *
 * Deploy-lag warning (per publish.py docstring): publish reads the current
 * deployed YAML to build the auto-migration. If ANOTHER content PR merged in
 * the last ~5 minutes, waiting for the next Railway redeploy before publishing
 * avoids the new PR silently reverting the earlier changes.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { contentDraftsApi } from '../../../services/api/index.js';
import type {
  BatchPublishResult,
  ContentDraftSummary,
} from '../../../services/api/ContentDraftsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import '../../shared/BaseModal.js';
import { VelgToast } from '../../shared/Toast.js';

const COMMIT_MSG_MAX = 72;

@localized()
@customElement('velg-publish-batch-modal')
export class VelgPublishBatchModal extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_accent-bg: color-mix(in srgb, var(--color-accent-amber) 10%, transparent);
      --_danger-bg: color-mix(in srgb, var(--color-danger) 10%, transparent);
      --_success-bg: color-mix(in srgb, var(--color-success) 10%, transparent);
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .count {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
    }

    .banner {
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.55;
      border-left: 3px solid;
    }
    .banner--warn {
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
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

    .drafts {
      list-style: none;
      margin: 0 0 var(--space-4);
      padding: 0;
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid var(--color-border-light);
      background: var(--color-surface-sunken);
    }
    .drafts__row {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      border-bottom: 1px solid var(--color-border-light);
    }
    .drafts__row:last-child { border-bottom: none; }
    .drafts__pack {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      min-width: 100px;
      flex-shrink: 0;
    }
    .drafts__path {
      font-family: var(--font-mono);
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .field { display: grid; gap: var(--space-1-5); margin-bottom: var(--space-4); }
    .field__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }
    .field__input {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }
    .field__input:focus {
      outline: none;
      border-color: var(--_accent);
      box-shadow: 0 0 0 2px var(--_accent-dim);
    }
    .field__input[data-over='true'] {
      border-color: var(--color-danger);
    }
    .field__counter {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      text-align: right;
    }
    .field__counter[data-over='true'] { color: var(--color-danger); }

    .actions {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
    }

    .btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-5);
      background: transparent;
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .btn:hover:not(:disabled) { border-color: var(--_accent); color: var(--_accent); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn--primary {
      background: var(--_accent);
      color: var(--color-surface);
      border-color: var(--_accent);
    }
    .btn--primary:hover:not(:disabled) {
      background: var(--color-accent-amber-hover, var(--_accent));
      color: var(--color-surface);
    }

    .success-link {
      color: var(--_accent);
      text-decoration: underline dotted var(--_accent-dim);
      text-underline-offset: 3px;
    }
    .success-link:hover { color: var(--color-accent-amber-hover, var(--_accent)); }

    @media (prefers-reduced-motion: reduce) {
      .btn { transition: none; }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  /**
   * Drafts selected for this batch. Parent is expected to pass the summaries
   * already present in its list state — avoids a redundant GET round-trip.
   */
  @property({ type: Array }) drafts: ContentDraftSummary[] = [];

  @state() private _commitMessage = '';
  @state() private _submitting = false;
  @state() private _error: string | null = null;
  @state() private _result: BatchPublishResult | null = null;

  /** Reset transient state each time the modal re-opens. */
  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open) {
      this._commitMessage = '';
      this._error = null;
      this._result = null;
      this._submitting = false;
    }
  }

  private _handleCommitInput(e: Event): void {
    this._commitMessage = (e.target as HTMLInputElement).value;
  }

  private _handleClose(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('modal-close', { bubbles: true, composed: true }),
    );
  }

  private async _handleSubmit(): Promise<void> {
    if (this._submitting) return;
    const trimmed = this._commitMessage.trim();
    if (trimmed.length > COMMIT_MSG_MAX) return;
    this._submitting = true;
    this._error = null;
    try {
      const response = await contentDraftsApi.publishBatch({
        draft_ids: this.drafts.map((d) => d.id),
        commit_message: trimmed ? trimmed : undefined,
      });
      if (response.success) {
        this._result = response.data;
        VelgToast.success(msg(str`Opened PR #${response.data.pr_number}.`));
        this.dispatchEvent(
          new CustomEvent('publish-success', {
            detail: { result: response.data },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message ?? msg('Publish failed.');
      }
    } catch (err) {
      captureError(err, { source: 'VelgPublishBatchModal._handleSubmit' });
      this._error = err instanceof Error ? err.message : msg('Publish failed.');
    } finally {
      this._submitting = false;
    }
  }

  protected render(): TemplateResult {
    return html`
      <velg-base-modal
        ?open=${this.open}
        modal-name="publish-batch"
        @modal-close=${this._handleClose}
      >
        <span slot="header">${msg('Publish draft batch')}</span>

        <div>
          ${this._result ? this._renderSuccess() : this._renderForm()}
        </div>

        <div slot="footer" class="actions">
          ${this._result
            ? html`
                <button class="btn btn--primary" @click=${this._handleClose}>
                  ${msg('Close')}
                </button>
              `
            : html`
                <button
                  class="btn"
                  @click=${this._handleClose}
                  ?disabled=${this._submitting}
                >
                  ${msg('Cancel')}
                </button>
                <button
                  class="btn btn--primary"
                  ?disabled=${this._submitting
                    || this.drafts.length === 0
                    || this._commitMessage.trim().length > COMMIT_MSG_MAX}
                  @click=${this._handleSubmit}
                >
                  ${this._submitting
                    ? msg('Publishing...')
                    : msg(str`Publish ${this.drafts.length} drafts`)}
                </button>
              `}
        </div>
      </velg-base-modal>
    `;
  }

  private _renderForm(): TemplateResult {
    const count = this.drafts.length;
    const overCount = this._commitMessage.length > COMMIT_MSG_MAX;

    return html`
      <p class="count">
        ${msg(str`${count} drafts in this batch. One PR covers all of them.`)}
      </p>

      <div class="banner banner--warn">
        <p class="banner__title">${msg('Deploy-lag advisory')}</p>
        ${msg(
          'Publish reads the currently-deployed YAML to derive the seed migration. If another content PR merged in the last ~5 minutes, waiting for the next deploy before publishing avoids silently reverting those changes.',
        )}
      </div>

      ${this._error
        ? html`
            <div class="banner banner--error">
              <p class="banner__title">${msg('Publish failed')}</p>
              ${this._error}
            </div>
          `
        : nothing}

      <ul class="drafts">
        ${this.drafts.map(
          (d) => html`
            <li class="drafts__row">
              <span class="drafts__pack">${d.pack_slug}</span>
              <span class="drafts__path" title=${d.resource_path}>${d.resource_path}</span>
            </li>
          `,
        )}
      </ul>

      <div class="field">
        <label class="field__label" for="commit-message">
          ${msg('Commit message (optional)')}
        </label>
        <input
          id="commit-message"
          type="text"
          class="field__input"
          data-over=${overCount ? 'true' : 'false'}
          maxlength="120"
          placeholder=${msg('Short Git headline; auto-derived if blank.')}
          .value=${this._commitMessage}
          ?disabled=${this._submitting}
          @input=${this._handleCommitInput}
        />
        <div class="field__counter" data-over=${overCount ? 'true' : 'false'}>
          ${this._commitMessage.length} / ${COMMIT_MSG_MAX}
        </div>
      </div>
    `;
  }

  private _renderSuccess(): TemplateResult {
    const result = this._result;
    if (!result) return html``;
    return html`
      <div class="banner banner--success">
        <p class="banner__title">${msg('PR opened')}</p>
        ${msg(
          str`Pull request #${result.pr_number} is live on ${result.branch_name}. After merge, the next deploy applies the auto-generated seed migration.`,
        )}
        <div style="margin-top:var(--space-2);">
          <a
            class="success-link"
            href=${result.pr_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            ${icons.github(12)} ${msg(str`Open PR #${result.pr_number}`)}
          </a>
        </div>
      </div>

      <ul class="drafts">
        ${result.drafts.map(
          (d) => html`
            <li class="drafts__row">
              <span class="drafts__pack">${d.pack_slug}</span>
              <span class="drafts__path" title=${d.resource_path}>${d.resource_path}</span>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-publish-batch-modal': VelgPublishBatchModal;
  }
}
