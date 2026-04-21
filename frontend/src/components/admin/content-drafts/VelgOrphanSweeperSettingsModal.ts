/**
 * VelgOrphanSweeperSettingsModal — A1.7 Phase 7c admin control surface for
 * the scheduled orphan-branch sweeper (supervisor to the manual
 * VelgSweepOrphansModal).
 *
 * Three controls plus one action:
 *   enabled        Toggle        `orphan_sweeper_enabled`
 *   interval_days  Number input  `orphan_sweeper_interval_days` (debounced save)
 *   min_age_days   Number input  `orphan_sweeper_min_age_days`  (debounced save)
 *   run-now        Button        POST /orphan-sweeper/run-now
 *
 * Why separate from VelgSweepOrphansModal:
 *   The sweep modal is a task dialog ("classify + delete NOW"). This modal
 *   configures the weekly schedule that runs the same sweep automatically.
 *   Mixing them would muddle two mental models — "act now" vs "adjust
 *   cadence". Shared spatial proximity via the parent's gear button.
 *
 * Save semantics:
 *   - Toggle auto-saves on change (matches AdminAnnouncementsTab pattern).
 *   - Number inputs auto-save on blur + after a 600ms debounce on typing,
 *     so rapid keystrokes don't stamp the DB per keypress.
 *   - Run-now goes through ConfirmDialog (destructive — real branch deletion)
 *     and stamps `last_run_at` optimistically on success (see
 *     `_handleRunNow` — avoids a full reload that would race a user's
 *     in-flight number edits).
 *
 * Data flow:
 *   open → adminApi.listSettings() → filter to 4 keys → parsed into state
 *   write → adminApi.updateSetting(key, stringified)
 *   run-now → contentDraftsApi.runOrphanSweeperNow() → toast + optimistic
 *             client-side `_lastRunAt = new Date().toISOString()`
 *
 * The modal does not share the `_sweepOpen` state with the parent — each
 * instance owns its own `_openToken` guard so stale responses from a
 * close+reopen race cannot overwrite fresh state.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SweepOrphansResult } from '../../../services/api/ContentDraftsApiService.js';
import { adminApi, contentDraftsApi } from '../../../services/api/index.js';
import { captureError } from '../../../services/SentryService.js';
import type { PlatformSetting } from '../../../types/index.js';
import { icons } from '../../../utils/icons.js';
import { VelgConfirmDialog } from '../../shared/ConfirmDialog.js';
import { VelgToast } from '../../shared/Toast.js';
import '../../shared/BaseModal.js';

const KEY_ENABLED = 'orphan_sweeper_enabled';
const KEY_INTERVAL_DAYS = 'orphan_sweeper_interval_days';
const KEY_MIN_AGE_DAYS = 'orphan_sweeper_min_age_days';
const KEY_LAST_RUN_AT = 'orphan_sweeper_last_run_at';

/** Debounce window for number-input saves — large enough to avoid per-keystroke
 *  writes, small enough that a user blur-away doesn't lose the pending edit. */
const NUMBER_SAVE_DEBOUNCE_MS = 600;

type ModalState = 'loading' | 'loaded' | 'error';

@localized()
@customElement('velg-orphan-sweeper-settings-modal')
export class VelgOrphanSweeperSettingsModal extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_accent-bg: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
      --_divider: color-mix(in srgb, var(--color-border) 70%, transparent);
      --_danger-bg: color-mix(in srgb, var(--color-danger) 10%, transparent);
      --_danger-border: color-mix(in srgb, var(--color-danger) 40%, transparent);
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .lead {
      font-size: var(--text-xs);
      line-height: 1.55;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4);
    }

    .loading,
    .error {
      padding: var(--space-5);
      text-align: center;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
    }

    .error {
      color: var(--color-danger);
      background: var(--_danger-bg);
      border-left: 3px solid var(--color-danger);
      text-align: left;
      font-family: var(--font-mono);
      letter-spacing: normal;
      text-transform: none;
    }

    .field {
      display: grid;
      grid-template-columns: minmax(140px, 180px) 1fr;
      gap: var(--space-4);
      align-items: start;
      padding: var(--space-4) 0;
      border-bottom: 1px dashed var(--_divider);
    }

    .field:last-of-type {
      border-bottom: none;
    }

    .field__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-primary);
      line-height: 1.4;
    }

    .field__hint {
      display: block;
      margin-top: var(--space-1);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      text-transform: none;
      letter-spacing: normal;
      font-weight: var(--font-normal);
      line-height: 1.5;
    }

    .field__control {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    /* ── Toggle ───────────────────────────────────────────────────── */

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
      user-select: none;
    }

    .toggle__input {
      appearance: none;
      width: 40px;
      height: 22px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      position: relative;
      cursor: pointer;
      transition: background var(--transition-fast), border-color var(--transition-fast);
      flex-shrink: 0;
    }

    .toggle__input::before {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--color-text-muted);
      transition: transform var(--transition-fast), background var(--transition-fast);
    }

    .toggle__input:checked {
      background: color-mix(in srgb, var(--_accent) 20%, var(--color-surface-sunken));
      border-color: var(--_accent);
    }

    .toggle__input:checked::before {
      transform: translateX(18px);
      background: var(--_accent);
    }

    .toggle__input:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    .toggle__input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chip {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      padding: 2px 8px;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .chip--active {
      color: var(--_accent);
      border-color: var(--_accent-dim);
      background: var(--_accent-bg);
    }

    /* ── Number input ──────────────────────────────────────────────── */

    .number-input {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .number-input__field {
      width: 96px;
      padding: var(--space-1-5) var(--space-2);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      text-align: right;
      transition: border-color var(--transition-fast);
    }

    .number-input__field:hover:not(:disabled):not(.number-input__field--saving) {
      border-color: var(--color-text-muted);
    }

    .number-input__field:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 1px;
      border-color: var(--_accent);
    }

    .number-input__field:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .number-input__field--saving {
      border-color: var(--_accent);
    }

    .number-input__unit {
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .saved-tick {
      color: var(--color-success);
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: var(--tracking-wide);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .saved-tick--visible {
      opacity: 1;
    }

    /* ── Last-run readout ──────────────────────────────────────────── */

    .readout {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .readout__time {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .readout__time--unset {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .readout__chip {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      padding: 2px 6px;
      background: color-mix(in srgb, var(--color-text-muted) 12%, transparent);
      color: var(--color-text-secondary);
    }

    /* ── Buttons ───────────────────────────────────────────────────── */

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
      transition: background var(--transition-fast), border-color var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
    }

    .btn:hover:not(:disabled) {
      background: var(--color-surface-header);
    }

    .btn:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 1px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn--danger {
      border-color: var(--_danger-border);
      color: var(--color-danger);
      background: var(--_danger-bg);
    }

    .btn--danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger) 18%, transparent);
      border-color: var(--color-danger);
    }

    .actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .field {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toggle__input,
      .toggle__input::before,
      .btn,
      .saved-tick,
      .number-input__field {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _state: ModalState = 'loading';
  @state() private _enabled = false;
  @state() private _intervalDays = '';
  @state() private _minAgeDays = '';
  @state() private _lastRunAt: string | null = null;
  @state() private _savingKey: string | null = null;
  @state() private _savedKey: string | null = null;
  @state() private _running = false;
  @state() private _error: string | null = null;

  /** Per-open-cycle token — a stale fetch from the previous open can't
   *  overwrite state after a close+reopen. Bump on every open transition. */
  private _openToken = 0;

  /** Per-key debounce for number-input typing. Cleared on component
   *  teardown so no stray save fires after disconnect. */
  private readonly _debounceTimers = new Map<string, number>();

  /** Timer that hides the "saved" tick a moment after the save lands. */
  private _tickTimer: number | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const t of this._debounceTimers.values()) {
      window.clearTimeout(t);
    }
    this._debounceTimers.clear();
    if (this._tickTimer !== null) {
      window.clearTimeout(this._tickTimer);
      this._tickTimer = null;
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('open') && this.open && !changed.get('open')) {
      this._openToken += 1;
      this._state = 'loading';
      this._error = null;
      void this._loadSettings(this._openToken);
    }
  }

  private async _loadSettings(token: number): Promise<void> {
    const res = await adminApi.listSettings();
    if (token !== this._openToken) return;
    if (!res.success) {
      this._error = res.error.message;
      this._state = 'error';
      return;
    }
    const rows = res.data;
    const byKey = new Map(rows.map((r) => [r.setting_key, r] as const));
    this._enabled = this._parseBool(byKey.get(KEY_ENABLED));
    this._intervalDays = this._parseNumericString(byKey.get(KEY_INTERVAL_DAYS));
    this._minAgeDays = this._parseNumericString(byKey.get(KEY_MIN_AGE_DAYS));
    this._lastRunAt = this._parseLastRunAt(byKey.get(KEY_LAST_RUN_AT));
    this._state = 'loaded';
  }

  private _parseBool(row: PlatformSetting | undefined): boolean {
    if (!row) return false;
    const s = String(row.setting_value ?? '')
      .replace(/"/g, '')
      .trim()
      .toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }

  private _parseNumericString(row: PlatformSetting | undefined): string {
    if (!row) return '';
    return String(row.setting_value ?? '')
      .replace(/"/g, '')
      .trim();
  }

  private _parseLastRunAt(row: PlatformSetting | undefined): string | null {
    if (!row) return null;
    const s = String(row.setting_value ?? '')
      .replace(/"/g, '')
      .trim();
    if (!s || s.toLowerCase() === 'null') return null;
    return s;
  }

  /** Humanise an ISO timestamp as "X time ago" / "in X time", bracketed so
   *  a missing date and a very old one look visually distinct. Never throws
   *  — parse failure falls through to the raw string. */
  private _relativeTime(iso: string): string {
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return iso;
    const diffMs = Date.now() - then;
    const absMin = Math.abs(diffMs) / 60000;
    if (absMin < 1) return msg('just now');
    if (absMin < 60) {
      const n = Math.round(absMin);
      return diffMs >= 0 ? msg(str`${n} min ago`) : msg(str`in ${n} min`);
    }
    const absHr = absMin / 60;
    if (absHr < 24) {
      const n = Math.round(absHr);
      return diffMs >= 0 ? msg(str`${n} h ago`) : msg(str`in ${n} h`);
    }
    const n = Math.round(absHr / 24);
    return diffMs >= 0 ? msg(str`${n} d ago`) : msg(str`in ${n} d`);
  }

  private async _saveSetting(key: string, value: string): Promise<void> {
    this._savingKey = key;
    this._savedKey = null;
    const res = await adminApi.updateSetting(key, value);
    if (this._savingKey !== key) return; // superseded
    this._savingKey = null;
    if (!res.success) {
      captureError(new Error(res.error.message), {
        source: 'VelgOrphanSweeperSettingsModal._saveSetting',
      });
      VelgToast.error(res.error.message ?? msg('Save failed.'));
      return;
    }
    this._savedKey = key;
    if (this._tickTimer !== null) window.clearTimeout(this._tickTimer);
    this._tickTimer = window.setTimeout(() => {
      this._savedKey = null;
      this._tickTimer = null;
    }, 1500);
  }

  private _handleToggleEnabled(e: Event): void {
    const next = (e.target as HTMLInputElement).checked;
    this._enabled = next;
    void this._saveSetting(KEY_ENABLED, next ? 'true' : 'false');
  }

  private _queueNumberSave(key: string, raw: string): void {
    const existing = this._debounceTimers.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      this._debounceTimers.delete(key);
      void this._commitNumberEdit(key, raw);
    }, NUMBER_SAVE_DEBOUNCE_MS);
    this._debounceTimers.set(key, timer);
  }

  private async _commitNumberEdit(key: string, raw: string): Promise<void> {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) {
      // Reject invalid values with a gentle toast — don't write garbage
      // over the server-side guard.
      VelgToast.warning(msg('Value must be a positive number.'));
      return;
    }
    await this._saveSetting(key, trimmed);
  }

  private _handleIntervalInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this._intervalDays = raw;
    this._queueNumberSave(KEY_INTERVAL_DAYS, raw);
  }

  private _handleMinAgeInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this._minAgeDays = raw;
    this._queueNumberSave(KEY_MIN_AGE_DAYS, raw);
  }

  /** Flush any pending debounced save for ``key`` — called from the blur
   *  handler so a user who types "7.5" and immediately tabs away never
   *  drops the pending edit. No-op when no timer is queued (already saved). */
  private _flushNumberDebounce(key: string, raw: string): void {
    const pending = this._debounceTimers.get(key);
    if (pending === undefined) return;
    window.clearTimeout(pending);
    this._debounceTimers.delete(key);
    void this._commitNumberEdit(key, raw);
  }

  private _handleIntervalBlur(e: Event): void {
    this._flushNumberDebounce(KEY_INTERVAL_DAYS, (e.target as HTMLInputElement).value);
  }

  private _handleMinAgeBlur(e: Event): void {
    this._flushNumberDebounce(KEY_MIN_AGE_DAYS, (e.target as HTMLInputElement).value);
  }

  private async _handleRunNow(): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Run scheduled sweep now?'),
      message: msg(
        'This runs a full sweep immediately and resets the weekly clock. Branches classified for deletion will be removed from the repository — not reversible from this UI.',
      ),
      confirmLabel: msg('Run now'),
      cancelLabel: msg('Cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    this._running = true;
    try {
      const res = await contentDraftsApi.runOrphanSweeperNow();
      if (!res.success) {
        captureError(new Error(res.error.message), {
          source: 'VelgOrphanSweeperSettingsModal._handleRunNow',
        });
        VelgToast.error(res.error.message ?? msg('Run failed.'));
        return;
      }
      const result: SweepOrphansResult = res.data;
      this._announceRunResult(result);
      // Optimistic last_run_at refresh — the server just stamped "now"
      // via _persist_last_run_at, so a client-side now() lands within
      // a few hundred ms of the real timestamp (and the relative-time
      // chip rounds to minutes anyway). A full _loadSettings reload
      // would race the user's in-flight number edits once _running
      // flips back to false.
      this._lastRunAt = new Date().toISOString();
    } catch (err) {
      captureError(err, { source: 'VelgOrphanSweeperSettingsModal._handleRunNow' });
      VelgToast.error(err instanceof Error ? err.message : String(err));
    } finally {
      this._running = false;
    }
  }

  private _announceRunResult(result: SweepOrphansResult): void {
    if (result.error_count > 0) {
      VelgToast.warning(
        msg(str`Sweep complete: deleted ${result.deleted_count}, ${result.error_count} failed.`),
      );
      return;
    }
    if (result.deleted_count === 0) {
      VelgToast.success(msg('Sweep complete. Nothing needed deletion.'));
      return;
    }
    VelgToast.success(msg(str`Sweep complete: deleted ${result.deleted_count} branch(es).`));
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  protected render(): TemplateResult {
    return html`
      <velg-base-modal
        ?open=${this.open}
        modal-name="orphan-sweeper-settings"
        @modal-close=${this._handleClose}
      >
        <span slot="header">${msg('Orphan sweeper schedule')}</span>

        <div>
          <p class="lead">
            ${msg(
              'Configures the weekly scheduled companion to the manual sweep. Changes take effect on the next tick – no redeploy.',
            )}
          </p>

          ${this._renderBody()}
        </div>

        <div slot="footer" class="actions">${this._renderActions()}</div>
      </velg-base-modal>
    `;
  }

  private _renderBody(): TemplateResult {
    if (this._state === 'loading') {
      return html`<div class="loading">${msg('Loading schedule…')}</div>`;
    }
    if (this._state === 'error') {
      return html`
        <div class="error">${this._error ?? msg('Failed to load settings.')}</div>
      `;
    }

    return html`
      <div role="group" aria-label=${msg('Orphan sweeper schedule controls')}>
        ${this._renderEnabledField()}
        ${this._renderIntervalField()}
        ${this._renderMinAgeField()}
        ${this._renderLastRunField()}
      </div>
    `;
  }

  /**
   * Shared field shell: label column on the left, control column on the
   * right, optional "Saved" tick when ``savedKey`` matches the last
   * successful write. Keeps the three settings fields structurally
   * identical so drift (spacing, label-id wiring, saved-tick placement)
   * can only live in one place.
   */
  private _renderField(
    labelId: string,
    label: string,
    hint: string,
    control: TemplateResult,
    savedKey: string | null,
  ): TemplateResult {
    return html`
      <div class="field">
        <div>
          <span class="field__label" id=${labelId}>${label}</span>
          <span class="field__hint">${hint}</span>
        </div>
        <div class="field__control">
          ${control}
          ${
            savedKey !== null && this._savedKey === savedKey
              ? html`<span class="saved-tick saved-tick--visible">${msg('Saved')}</span>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderEnabledField(): TemplateResult {
    const busy = this._savingKey === KEY_ENABLED || this._running;
    const control = html`
      <label class="toggle">
        <input
          type="checkbox"
          class="toggle__input"
          .checked=${this._enabled}
          ?disabled=${busy}
          @change=${this._handleToggleEnabled}
          aria-labelledby="field-enabled"
        />
      </label>
      <span class="chip ${this._enabled ? 'chip--active' : ''}">
        ${this._enabled ? msg('Enabled') : msg('Disabled')}
      </span>
    `;
    return this._renderField(
      'field-enabled',
      msg('Schedule'),
      msg('When off, sweeps only run via the manual button or Run-now.'),
      control,
      KEY_ENABLED,
    );
  }

  private _renderIntervalField(): TemplateResult {
    const saving = this._savingKey === KEY_INTERVAL_DAYS;
    const control = html`
      <div class="number-input">
        <input
          type="number"
          class="number-input__field ${saving ? 'number-input__field--saving' : ''}"
          step="0.5"
          min="0.5"
          .value=${this._intervalDays}
          ?disabled=${this._running}
          @input=${this._handleIntervalInput}
          @blur=${this._handleIntervalBlur}
          aria-labelledby="field-interval"
        />
        <span class="number-input__unit">${msg('days')}</span>
      </div>
    `;
    return this._renderField(
      'field-interval',
      msg('Interval'),
      msg('Minimum days between scheduled sweeps. Throttle survives restarts.'),
      control,
      KEY_INTERVAL_DAYS,
    );
  }

  private _renderMinAgeField(): TemplateResult {
    const saving = this._savingKey === KEY_MIN_AGE_DAYS;
    const control = html`
      <div class="number-input">
        <input
          type="number"
          class="number-input__field ${saving ? 'number-input__field--saving' : ''}"
          step="1"
          min="1"
          .value=${this._minAgeDays}
          ?disabled=${this._running}
          @input=${this._handleMinAgeInput}
          @blur=${this._handleMinAgeBlur}
          aria-labelledby="field-min-age"
        />
        <span class="number-input__unit">${msg('days')}</span>
      </div>
    `;
    return this._renderField(
      'field-min-age',
      msg('Min branch age'),
      msg('Commit-age floor before a PR-less draft branch qualifies for deletion.'),
      control,
      KEY_MIN_AGE_DAYS,
    );
  }

  private _renderLastRunField(): TemplateResult {
    const hasRun = this._lastRunAt !== null;
    const control = html`
      <div class="readout">
        <span class="readout__time ${hasRun ? '' : 'readout__time--unset'}">
          ${hasRun ? (this._lastRunAt as string) : msg('(never)')}
        </span>
        ${
          hasRun
            ? html`<span class="readout__chip">
              ${this._relativeTime(this._lastRunAt as string)}
            </span>`
            : nothing
        }
      </div>
    `;
    return this._renderField(
      'field-last-run',
      msg('Last run'),
      msg('Timestamp the scheduler persists after every completed sweep.'),
      control,
      null, // read-only — no saved-tick slot needed
    );
  }

  private _renderActions(): TemplateResult {
    const busy = this._state !== 'loaded' || this._running;
    return html`
      <button class="btn" @click=${this._handleClose} ?disabled=${this._running}>
        ${msg('Close')}
      </button>
      <button
        class="btn btn--danger"
        @click=${this._handleRunNow}
        ?disabled=${busy}
        aria-label=${msg('Run scheduled sweep now')}
      >
        ${icons.terminal(12)}
        ${this._running ? msg('Running…') : msg('Run now')}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-orphan-sweeper-settings-modal': VelgOrphanSweeperSettingsModal;
  }
}
