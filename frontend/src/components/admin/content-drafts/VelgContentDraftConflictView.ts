/**
 * VelgContentDraftConflictView — 3-way merge conflict resolution (A1.7 Phase 5).
 *
 * Renders a divergent-timeline report when a draft is in 'conflict' status.
 * The admin sees:
 *   - Summary: auto-merged count + conflict count + main@sha-short
 *   - Per-conflict card: path, kind, 3-column BASE/OURS/THEIRS, flip actions
 *   - Footer: Abandon | Accept & save
 *
 * Consumes a server-computed `ConflictPreview` (fetched from GET
 * /admin/content-drafts/{id}/conflict-preview) and lets the admin override
 * the server's default-to-ours/theirs policy per conflict before submitting
 * the final merged content via POST /admin/content-drafts/{id}/resolve.
 *
 * Decision model:
 *   Each conflict starts at 'auto' (uses whatever the server's `preview.merged`
 *   already contains for its path — which embeds the default-to-ours policy
 *   for MODIFY_MODIFY / MODIFY_DELETE / ADD_ADD_DIFFERENT and default-to-theirs
 *   for DELETE_MODIFY). Admin can flip to 'ours' or 'theirs' per card. The
 *   emitted `merged_working_content` is a deep copy of preview.merged with
 *   per-path overrides applied.
 *
 * Events:
 *   resolve-submit { merged_working_content, acknowledged_conflict_paths,
 *                    version }
 *   resolve-cancel — admin escapes (parent decides: close panel, abandon, etc.)
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ConflictKind,
  ConflictPreview,
  EntryConflict,
} from '../../../services/api/ContentDraftsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';

/** Per-conflict admin choice. `auto` = use the server's merged-default. */
type ConflictChoice = 'auto' | 'ours' | 'theirs';

@localized()
@customElement('velg-content-draft-conflict-view')
export class VelgContentDraftConflictView extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-warning);
      --_accent-bg: color-mix(in srgb, var(--color-warning) 10%, transparent);
      --_success: var(--color-success);
      --_success-bg: color-mix(in srgb, var(--color-success) 10%, transparent);
      --_info-bg: color-mix(in srgb, var(--color-info) 10%, transparent);

      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
    }

    /* ── Head ─────────────────────────────────── */

    .head {
      border-bottom: 1px dashed var(--color-border);
      padding-bottom: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .head__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      margin: 0 0 var(--space-1);
      color: var(--_accent);
    }

    .head__sub {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      font-family: var(--font-mono);
    }

    .head__meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .head__meta-row strong {
      color: var(--color-text-primary);
      font-weight: var(--font-bold);
    }

    /* ── Summary strip ────────────────────────── */

    .summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }

    .summary__card {
      position: relative;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: var(--space-3) var(--space-4);
      text-align: center;
    }

    .summary__card--auto {
      border-left: 3px solid var(--_success);
      background: var(--_success-bg);
    }

    .summary__card--pending {
      border-left: 3px solid var(--_accent);
      background: var(--_accent-bg);
    }

    .summary__card--zero {
      opacity: 0.5;
      background: var(--color-surface-raised);
      border-left-color: var(--color-border);
    }

    .summary__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      line-height: var(--leading-none);
      letter-spacing: var(--tracking-wider);
    }

    .summary__card--auto .summary__value {
      color: var(--_success);
    }

    .summary__card--pending .summary__value {
      color: var(--_accent);
    }

    .summary__card--zero .summary__value {
      color: var(--color-text-muted);
    }

    .summary__label {
      margin-top: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }

    /* ── Empty / auto-only state ────────────── */

    .all-auto {
      border: 1px dashed var(--color-border);
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-5);
    }

    .all-auto__icon {
      color: var(--_success);
      display: inline-flex;
      margin-bottom: var(--space-2);
    }

    .all-auto__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-md);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .all-auto__hint {
      font-size: var(--text-sm);
    }

    /* ── Conflict card ────────────────────────── */

    .conflicts__heading {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-3);
    }

    .conflict {
      position: relative;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-3);
      opacity: 0;
      animation: conflict-in var(--duration-entrance, 350ms)
        var(--ease-dramatic, ease-out) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
    }

    @keyframes conflict-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .conflict--ours {
      border-left: 3px solid var(--_success);
    }

    .conflict--theirs {
      border-left: 3px solid var(--color-info);
    }

    .conflict--auto {
      border-left: 3px solid var(--_accent);
    }

    .conflict__head {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border-bottom: 1px dashed var(--color-border);
    }

    .conflict__path {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      font-weight: var(--font-semibold);
      word-break: break-all;
    }

    .conflict__badges {
      display: inline-flex;
      gap: var(--space-2);
      align-items: center;
    }

    .conflict__kind {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      padding: var(--space-0-5) var(--space-2);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }

    .conflict__status {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      padding: var(--space-0-5) var(--space-2);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 1px solid transparent;
    }

    .conflict__status--ours {
      color: var(--_success);
      border-color: var(--_success);
      background: var(--_success-bg);
    }

    .conflict__status--theirs {
      color: var(--color-info);
      border-color: var(--color-info);
      background: var(--_info-bg);
    }

    .conflict__status--auto {
      color: var(--_accent);
      border-color: var(--_accent);
      background: var(--_accent-bg);
    }

    /* ── 3-column diff ────────────────────────── */

    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0;
      /* min-width:0 on the grid container too — belt-and-suspenders so the
       * card itself can shrink below its grid's intrinsic min-content.
       * Without this, long JSON payload strings can push .column widths
       * past the container and spill past the side-panel right edge. */
      min-width: 0;
    }

    .column {
      padding: var(--space-3);
      border-right: 1px dashed var(--color-border);
      display: flex;
      flex-direction: column;
      /* Grid tracks default to min-width: auto (= min-content), which for
       * a <pre> with long text can be very wide. Overriding to 0 lets the
       * 1fr columns shrink evenly and forces the pre to wrap instead of
       * overflowing horizontally. */
      min-width: 0;
    }

    .column:last-child {
      border-right: 0;
    }

    .column__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
      padding-bottom: var(--space-1);
      border-bottom: 1px solid var(--color-border-light);
    }

    .column--ours .column__head {
      color: var(--_success);
    }

    .column--theirs .column__head {
      color: var(--color-info);
    }

    .column__payload {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border-light);
      padding: var(--space-2);
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      flex: 1;
      overflow: auto;
      max-height: 320px;
    }

    .column__payload--deleted {
      color: var(--color-text-muted);
      font-style: italic;
      background: var(--color-surface);
      text-align: center;
      align-self: center;
      width: 100%;
    }

    .column__select-btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      padding: var(--space-1) var(--space-2);
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .column__select-btn:hover:not(:disabled),
    .column__select-btn:focus-visible {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border-color: var(--color-border-focus);
      outline: none;
    }

    .column__select-btn:focus-visible {
      box-shadow: var(--ring-focus);
    }

    .column__select-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .column--ours .column__select-btn {
      color: var(--_success);
      border-color: var(--_success);
    }

    .column--ours .column__select-btn:hover:not(:disabled) {
      background: var(--_success-bg);
    }

    .column--theirs .column__select-btn {
      color: var(--color-info);
      border-color: var(--color-info);
    }

    .column--theirs .column__select-btn:hover:not(:disabled) {
      background: var(--_info-bg);
    }

    .column__select-btn[aria-pressed='true'] {
      background: var(--color-surface);
      color: var(--color-text-primary);
      border-width: 2px;
    }

    /* ── Footer ──────────────────────────────── */

    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      justify-content: flex-end;
      align-items: center;
      padding-top: var(--space-4);
      margin-top: var(--space-5);
      border-top: 1px dashed var(--color-border);
    }

    .footer__spacer {
      flex: 1;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .footer__btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      padding: var(--space-2) var(--space-4);
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      cursor: pointer;
      min-height: 44px;
      transition: var(--transition-fast);
    }

    .footer__btn:hover:not(:disabled),
    .footer__btn:focus-visible {
      background: var(--color-surface-raised);
      border-color: var(--color-border-focus);
      outline: none;
    }

    .footer__btn:focus-visible {
      box-shadow: var(--ring-focus);
    }

    .footer__btn--primary {
      background: var(--_accent);
      color: var(--color-text-inverse);
      border-color: var(--_accent);
      box-shadow: var(--shadow-sm);
    }

    .footer__btn--primary:hover:not(:disabled) {
      background: var(--color-warning-hover);
      border-color: var(--color-warning-hover);
      box-shadow: var(--shadow-md);
    }

    .footer__btn--primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .footer__btn--ghost {
      color: var(--color-text-secondary);
    }

    /* ── Responsive ──────────────────────────── */

    @media (max-width: 900px) {
      .columns {
        grid-template-columns: 1fr;
      }

      .column {
        border-right: 0;
        border-bottom: 1px dashed var(--color-border);
      }

      .column:last-child {
        border-bottom: 0;
      }

      .summary {
        grid-template-columns: 1fr;
      }
    }

    /* ── Reduced motion ──────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .conflict {
        opacity: 1;
        animation: none;
      }

      * {
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @property({ attribute: false }) preview: ConflictPreview | null = null;

  /** Per-conflict-path choice. Default 'auto' for every path. */
  @state() private _choices: Map<string, ConflictChoice> = new Map();

  /** True while the parent is executing the resolve POST — disables buttons. */
  @property({ type: Boolean }) submitting = false;

  /* ── Lifecycle ─────────────────────────────── */

  protected updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('preview')) {
      // Reset choices when a new preview arrives (admin reopened or refreshed).
      this._choices = new Map();
    }
  }

  /* ── Interaction ───────────────────────────── */

  private _setChoice(path: string, choice: ConflictChoice): void {
    const next = new Map(this._choices);
    next.set(path, choice);
    this._choices = next;
  }

  private _choiceFor(path: string): ConflictChoice {
    return this._choices.get(path) ?? 'auto';
  }

  private _handleCancel = (): void => {
    this.dispatchEvent(new CustomEvent('resolve-cancel', { bubbles: true, composed: true }));
  };

  private _handleSubmit = (): void => {
    if (!this.preview) return;
    const merged = this._computeMergedContent();
    const acknowledged = this.preview.conflicts.map((c) => c.path);
    this.dispatchEvent(
      new CustomEvent('resolve-submit', {
        bubbles: true,
        composed: true,
        detail: {
          merged_working_content: merged,
          acknowledged_conflict_paths: acknowledged,
          version: this.preview.version,
        },
      }),
    );
  };

  /* ── Merge computation ─────────────────────── */

  /** Apply per-path overrides to the server's merged tree.
   *
   *  `preview.merged` already contains the default-to-ours/theirs choices.
   *  Admin's per-conflict flips are layered on top: each non-'auto' choice
   *  swaps the entry at that path to the admin's preferred side.
   */
  private _computeMergedContent(): Record<string, unknown> {
    if (!this.preview) return {};
    const working = structuredClone(this.preview.merged);
    for (const conflict of this.preview.conflicts) {
      const choice = this._choiceFor(conflict.path);
      if (choice === 'auto') continue;
      const value = choice === 'ours' ? conflict.ours : conflict.theirs;
      applyAtPath(working, conflict.path, value);
    }
    return working;
  }

  /* ── Render ────────────────────────────────── */

  protected render(): TemplateResult {
    const preview = this.preview;
    if (!preview) {
      return html`<div class="all-auto">${msg('Loading merge preview...')}</div>`;
    }
    const hasConflicts = preview.conflicts.length > 0;
    return html`
      ${this._renderHead(preview)} ${this._renderSummary(preview)}
      ${hasConflicts ? this._renderConflictList(preview) : this._renderAllAuto()}
      ${this._renderFooter(preview)}
    `;
  }

  private _renderHead(preview: ConflictPreview): TemplateResult {
    const shaShort = preview.main_base_sha ? preview.main_base_sha.slice(0, 8) : msg('unknown');
    return html`
      <div class="head">
        <h2 class="head__title">
          ${icons.alertTriangle(16)} ${msg('Timeline divergence')}
        </h2>
        <div class="head__sub">
          ${msg(str`Draft v${preview.version} forked from main; upstream now at ${shaShort}.`)}
        </div>
        <div class="head__meta-row">
          <span>
            ${msg('Conflicts:')}
            <strong>${preview.conflicts.length}</strong>
          </span>
          <span>
            ${msg('Auto-merged:')}
            <strong>${preview.auto_resolved_count}</strong>
          </span>
        </div>
      </div>
    `;
  }

  private _renderSummary(preview: ConflictPreview): TemplateResult {
    const autoClass =
      preview.auto_resolved_count > 0 ? 'summary__card--auto' : 'summary__card--zero';
    const conflictClass =
      preview.conflicts.length > 0 ? 'summary__card--pending' : 'summary__card--zero';
    return html`
      <div class="summary" role="group" aria-label=${msg('Merge summary')}>
        <div class="summary__card ${autoClass}">
          <div class="summary__value">${preview.auto_resolved_count}</div>
          <div class="summary__label">${msg('Auto-resolved')}</div>
        </div>
        <div class="summary__card ${conflictClass}">
          <div class="summary__value">${preview.conflicts.length}</div>
          <div class="summary__label">${msg('Need your decision')}</div>
        </div>
      </div>
    `;
  }

  private _renderAllAuto(): TemplateResult {
    return html`
      <div class="all-auto" role="status">
        <span class="all-auto__icon">${icons.checkCircle(24)}</span>
        <h3 class="all-auto__title">${msg('All changes reconciled')}</h3>
        <p class="all-auto__hint">
          ${msg(
            'No admin decisions required. Submit to accept the auto-merge and return the draft to edit mode.',
          )}
        </p>
      </div>
    `;
  }

  private _renderConflictList(preview: ConflictPreview): TemplateResult {
    return html`
      <h3 class="conflicts__heading">
        ${msg(str`${preview.conflicts.length} conflict(s) require a decision`)}
      </h3>
      ${preview.conflicts.map(
        (c, i) => html`
          <div
            class="conflict conflict--${this._choiceFor(c.path)}"
            style="--i: ${i}"
          >
            ${this._renderConflictCard(c)}
          </div>
        `,
      )}
    `;
  }

  private _renderConflictCard(conflict: EntryConflict): TemplateResult {
    const choice = this._choiceFor(conflict.path);
    return html`
      <div class="conflict__head">
        <span class="conflict__path" role="heading" aria-level="4">
          ${conflict.path}
        </span>
        <div class="conflict__badges">
          <span class="conflict__kind">${this._kindLabel(conflict.kind)}</span>
          <span class="conflict__status conflict__status--${choice}">
            ${this._choiceLabel(choice)}
          </span>
        </div>
      </div>
      <div class="columns">
        <div class="column column--base">
          <div class="column__head">
            <span>${msg('Base')}</span>
          </div>
          ${this._renderPayload(conflict.base, 'base')}
        </div>
        <div class="column column--ours">
          <div class="column__head">
            <span>${msg('Ours')}</span>
            <button
              class="column__select-btn"
              type="button"
              aria-pressed=${choice === 'ours'}
              ?disabled=${this.submitting}
              @click=${() => this._setChoice(conflict.path, 'ours')}
            >
              ${this._ourButtonLabel(choice, conflict)}
            </button>
          </div>
          ${this._renderPayload(conflict.ours, 'ours')}
        </div>
        <div class="column column--theirs">
          <div class="column__head">
            <span>${msg('Theirs')}</span>
            <button
              class="column__select-btn"
              type="button"
              aria-pressed=${choice === 'theirs'}
              ?disabled=${this.submitting}
              @click=${() => this._setChoice(conflict.path, 'theirs')}
            >
              ${this._theirsButtonLabel(choice, conflict)}
            </button>
          </div>
          ${this._renderPayload(conflict.theirs, 'theirs')}
        </div>
      </div>
    `;
  }

  private _renderPayload(value: unknown, side: 'base' | 'ours' | 'theirs'): TemplateResult {
    if (value === null) {
      const label =
        side === 'base'
          ? msg('(not in base)')
          : side === 'ours'
            ? msg('(deleted by you)')
            : msg('(deleted on main)');
      return html`<pre class="column__payload column__payload--deleted">${label}</pre>`;
    }
    return html`<pre class="column__payload">${this._prettyJson(value)}</pre>`;
  }

  private _renderFooter(preview: ConflictPreview): TemplateResult {
    const allPathsDecided = preview.conflicts.every((c) => {
      const choice = this._choiceFor(c.path);
      return choice !== 'auto';
    });
    const submitLabel =
      preview.conflicts.length === 0
        ? msg('Accept auto-merge')
        : allPathsDecided
          ? msg('Accept decisions & save')
          : msg('Accept defaults & save');
    return html`
      <div class="footer">
        <span class="footer__spacer">
          ${
            preview.conflicts.length > 0 && !allPathsDecided
              ? msg(
                  'Submitting now accepts the default (highlighted) choice for any conflict you skipped.',
                )
              : nothing
          }
        </span>
        <button
          class="footer__btn footer__btn--ghost"
          type="button"
          ?disabled=${this.submitting}
          @click=${this._handleCancel}
        >
          ${msg('Cancel')}
        </button>
        <button
          class="footer__btn footer__btn--primary"
          type="button"
          ?disabled=${this.submitting}
          @click=${this._handleSubmit}
        >
          ${this.submitting ? msg('Saving...') : submitLabel}
        </button>
      </div>
    `;
  }

  /* ── Label helpers ─────────────────────────── */

  private _kindLabel(kind: ConflictKind): string {
    switch (kind) {
      case 'modify_modify':
        return msg('Both edited');
      case 'modify_delete':
        return msg('Edited vs. deleted');
      case 'delete_modify':
        return msg('Deleted vs. edited');
      case 'add_add_different':
        return msg('Both added');
    }
  }

  private _choiceLabel(choice: ConflictChoice): string {
    switch (choice) {
      case 'auto':
        return msg('Auto');
      case 'ours':
        return msg('Using ours');
      case 'theirs':
        return msg('Using theirs');
    }
  }

  /** Button label for the "ours" side — communicates that clicking a null
   *  side accepts the deletion as the resolution (relevant to MODIFY_DELETE
   *  where theirs deleted, and DELETE_MODIFY where ours deleted). */
  private _ourButtonLabel(choice: ConflictChoice, conflict: EntryConflict): string {
    if (choice === 'ours') return msg('Selected');
    if (conflict.ours === null) return msg('Accept delete');
    return msg('Use ours');
  }

  private _theirsButtonLabel(choice: ConflictChoice, conflict: EntryConflict): string {
    if (choice === 'theirs') return msg('Selected');
    if (conflict.theirs === null) return msg('Accept delete');
    return msg('Use theirs');
  }

  private _prettyJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      captureError(err, {
        source: 'VelgContentDraftConflictView._prettyJson',
      });
      return String(value);
    }
  }
}

/* ── Path helper ─────────────────────────────── */

/**
 * Apply a value at a conflict path in the working content tree.
 *
 * Supported path shapes (match the backend merge service):
 *   `.banter[id=sb_01]` — id-keyed list entry; null removes the entry.
 *   `.name`             — top-level scalar; null removes the key.
 *
 * The function mutates `working` in place. Paths that don't match either
 * shape are left unchanged (defensive — unreachable in practice).
 */
function applyAtPath(working: Record<string, unknown>, path: string, value: unknown): void {
  const entryMatch = path.match(/^\.([a-zA-Z0-9_]+)\[id=([^\]]+)\]$/);
  if (entryMatch) {
    const [, key, entryId] = entryMatch;
    const list = working[key];
    // Server guarantees `working[key]` is an id-list whenever the server
    // emitted a `.key[id=...]` conflict path — nothing else produces that
    // shape in merge_service._merge_id_list. If the invariant ever breaks,
    // skipping the write is the safest recovery (defaulted-value stays in
    // the merged tree).
    if (!Array.isArray(list)) return;
    const idx = list.findIndex(
      (x) => typeof x === 'object' && x !== null && (x as Record<string, unknown>).id === entryId,
    );
    if (value === null) {
      if (idx !== -1) list.splice(idx, 1);
      return;
    }
    if (idx === -1) {
      list.push(value);
    } else {
      list[idx] = value;
    }
    return;
  }
  const scalarMatch = path.match(/^\.([a-zA-Z0-9_]+)$/);
  if (scalarMatch) {
    const [, key] = scalarMatch;
    if (value === null) {
      delete working[key];
    } else {
      working[key] = value;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-content-draft-conflict-view': VelgContentDraftConflictView;
  }
}
