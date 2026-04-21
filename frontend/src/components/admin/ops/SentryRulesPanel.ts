/**
 * SentryRulesPanel — CRUD UI for ``sentry_rules`` (P2.4 / panel ⑤).
 *
 * Bound to the P2.3 admin endpoints. Rules are grouped by kind
 * (ignore / fingerprint / downgrade) because each kind has a distinct
 * match/output contract and operators tend to reason about them
 * separately ("what are we dropping?" vs "what are we grouping?").
 *
 * UX:
 *   - Row per rule: kind badge, match summary, enable toggle, note,
 *     edit + delete actions. Silenced count per rule surfaces how
 *     often the rule actually fires so dead rules are obvious.
 *   - Create flow: inline reveal with the form matching the kind's
 *     contract — no wasted fields.
 *   - Delete flow: reason-required inline confirm (same pattern as the
 *     Quarantine kill switches).
 *
 * Mutation side effects:
 *   The backend invalidates ``sentry_rule_cache`` after every write,
 *   so the next Sentry event sees the new rule within a single round-
 *   trip — no client-side staleness window beyond the list-refresh we
 *   trigger here.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  bureauOpsApi,
  type SentryDowngradeTo,
  type SentryRule,
  type SentryRuleKind,
  type SentryRuleUpsertBody,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { VelgToast } from '../../shared/Toast.js';

const KIND_ORDER: readonly SentryRuleKind[] = ['ignore', 'fingerprint', 'downgrade'];

interface RuleFormState {
  kind: SentryRuleKind;
  match_exception_type: string;
  match_message_regex: string;
  match_logger: string;
  fingerprint_template: string;
  downgrade_to: SentryDowngradeTo | '';
  enabled: boolean;
  note: string;
}

function emptyForm(kind: SentryRuleKind = 'ignore'): RuleFormState {
  return {
    kind,
    match_exception_type: '',
    match_message_regex: '',
    match_logger: '',
    fingerprint_template: '',
    downgrade_to: '',
    enabled: true,
    note: '',
  };
}

function ruleToForm(rule: SentryRule): RuleFormState {
  return {
    kind: rule.kind,
    match_exception_type: rule.match_exception_type ?? '',
    match_message_regex: rule.match_message_regex ?? '',
    match_logger: rule.match_logger ?? '',
    fingerprint_template: rule.fingerprint_template ?? '',
    downgrade_to: rule.downgrade_to ?? '',
    enabled: rule.enabled,
    note: rule.note,
  };
}

function formToBody(form: RuleFormState): SentryRuleUpsertBody {
  return {
    kind: form.kind,
    match_exception_type: form.match_exception_type.trim() || null,
    match_message_regex: form.match_message_regex.trim() || null,
    match_logger: form.match_logger.trim() || null,
    fingerprint_template:
      form.kind === 'fingerprint' ? form.fingerprint_template.trim() || null : null,
    downgrade_to:
      form.kind === 'downgrade'
        ? form.downgrade_to === 'info' || form.downgrade_to === 'warning'
          ? form.downgrade_to
          : null
        : null,
    enabled: form.enabled,
    note: form.note.trim(),
  };
}

@localized()
@customElement('velg-ops-sentry-rules-panel')
export class VelgOpsSentryRulesPanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-primary);
      --_danger: var(--color-danger);
      display: block;
      border: 2px solid var(--color-border);
      background: var(--color-surface-raised);
      padding: var(--space-5);
      position: relative;
    }

    :host::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--_accent);
    }

    .heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .heading__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    .create-btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 2px solid var(--_accent);
      background: var(--color-surface);
      color: var(--_accent);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .create-btn:hover,
    .create-btn:focus-visible {
      background: var(--_accent);
      color: var(--color-text-inverse);
      outline: none;
    }

    .create-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .group {
      margin-bottom: var(--space-5);
    }

    .group:last-child {
      margin-bottom: 0;
    }

    .group__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2) 0;
      padding-bottom: var(--space-1);
      border-bottom: 1px dashed var(--color-border);
    }

    .rule {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-2) var(--space-3);
      align-items: start;
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .rule__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }

    .rule__match {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      color: var(--color-text-primary);
    }

    .rule__match strong {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      font-size: 10px;
    }

    .rule__note {
      color: var(--color-text-secondary);
      font-style: italic;
      line-height: var(--leading-snug);
    }

    .rule__meta {
      color: var(--color-text-muted);
      font-size: 10px;
    }

    .rule__actions {
      display: flex;
      gap: var(--space-1);
    }

    .rule__btn {
      padding: 2px var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .rule__btn--danger {
      color: var(--_danger);
      border-color: var(--_danger);
    }

    .rule__btn--danger:hover,
    .rule__btn--danger:focus-visible {
      background: var(--_danger);
      color: var(--color-text-inverse);
      outline: none;
    }

    .rule__btn:hover:not(.rule__btn--danger),
    .rule__btn:focus-visible:not(.rule__btn--danger) {
      background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
      outline: none;
    }

    .rule--disabled {
      opacity: 0.5;
    }

    .form {
      padding: var(--space-3);
      background: var(--color-surface);
      border: 2px dashed var(--_accent);
      margin-bottom: var(--space-3);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2) var(--space-3);
    }

    .form__row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .form__row--full {
      grid-column: 1 / -1;
    }

    .form__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }

    .form__input,
    .form__select,
    .form__textarea {
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      box-sizing: border-box;
      width: 100%;
    }

    .form__textarea {
      resize: vertical;
      min-height: 52px;
    }

    .form__checkbox-row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .form__actions {
      grid-column: 1 / -1;
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
    }

    .form__btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .form__btn--primary {
      border-color: var(--_accent);
      background: var(--_accent);
      color: var(--color-text-inverse);
    }

    .form__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .delete-prompt {
      padding: var(--space-2) var(--space-3);
      background: var(--color-danger-bg);
      border: 1px dashed var(--_danger);
      margin-bottom: var(--space-2);
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: var(--space-2);
      align-items: center;
    }

    .empty {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      padding: var(--space-3);
      text-align: center;
      font-style: italic;
      border: 1px dashed var(--color-border);
    }

    .error {
      padding: var(--space-2) var(--space-3);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      margin-bottom: var(--space-3);
    }

    @media (max-width: 640px) {
      .form {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _rules: SentryRule[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _formOpen = false;
  @state() private _editingId: string | null = null;
  @state() private _form: RuleFormState = emptyForm();
  @state() private _submitting = false;
  @state() private _deletePrompt: { id: string; reason: string } | null = null;
  @state() private _togglePrompt:
    | { id: string; nextEnabled: boolean; reason: string }
    | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetch();
  }

  private async _fetch(): Promise<void> {
    this._loading = true;
    const resp = await bureauOpsApi.listSentryRules();
    if (resp.success) {
      this._rules = resp.data;
      this._error = null;
    } else {
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'SentryRulesPanel._fetch',
        code: resp.error.code,
      });
    }
    this._loading = false;
  }

  private _openCreate(): void {
    this._formOpen = true;
    this._editingId = null;
    this._form = emptyForm();
  }

  private _openEdit(rule: SentryRule): void {
    this._formOpen = true;
    this._editingId = rule.id;
    this._form = ruleToForm(rule);
  }

  private _closeForm(): void {
    this._formOpen = false;
    this._editingId = null;
    this._form = emptyForm();
  }

  private _updateForm<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]): void {
    this._form = { ...this._form, [key]: value };
  }

  private _isFormValid(): boolean {
    if (this._form.note.trim().length < 3) return false;
    if (
      this._form.kind === 'fingerprint' &&
      this._form.fingerprint_template.trim().length === 0
    ) {
      return false;
    }
    if (this._form.kind === 'downgrade' && this._form.downgrade_to === '') {
      return false;
    }
    return true;
  }

  private async _submitForm(): Promise<void> {
    if (!this._isFormValid()) return;
    this._submitting = true;
    const body = formToBody(this._form);
    const resp = this._editingId
      ? await bureauOpsApi.updateSentryRule(this._editingId, body)
      : await bureauOpsApi.createSentryRule(body);
    this._submitting = false;
    if (resp.success) {
      VelgToast.success(
        this._editingId ? msg('Sentry rule updated.') : msg('Sentry rule created.'),
      );
      this._closeForm();
      await this._fetch();
    } else {
      VelgToast.error(msg(str`Rule save failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'SentryRulesPanel._submitForm',
        code: resp.error.code,
      });
    }
  }

  private _requestToggle(rule: SentryRule): void {
    // Open an inline reason prompt — same UX as delete — so the audit
    // log captures why the operator flipped the switch. `note` is the
    // rule's permanent documentation, not the mutation reason.
    this._togglePrompt = {
      id: rule.id,
      nextEnabled: !rule.enabled,
      reason: '',
    };
  }

  private _cancelToggle(): void {
    this._togglePrompt = null;
  }

  private async _confirmToggle(rule: SentryRule): Promise<void> {
    if (!this._togglePrompt || this._togglePrompt.id !== rule.id) return;
    const reason = this._togglePrompt.reason.trim();
    if (reason.length < 3) return;
    this._submitting = true;
    const body: SentryRuleUpsertBody = {
      kind: rule.kind,
      match_exception_type: rule.match_exception_type,
      match_message_regex: rule.match_message_regex,
      match_logger: rule.match_logger,
      fingerprint_template: rule.fingerprint_template,
      downgrade_to: rule.downgrade_to,
      enabled: this._togglePrompt.nextEnabled,
      note: rule.note,
      audit_reason: reason,
    };
    const resp = await bureauOpsApi.updateSentryRule(rule.id, body);
    this._submitting = false;
    this._togglePrompt = null;
    if (resp.success) {
      VelgToast.success(
        body.enabled ? msg('Sentry rule enabled.') : msg('Sentry rule disabled.'),
      );
      await this._fetch();
    } else {
      VelgToast.error(msg(str`Toggle failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'SentryRulesPanel._confirmToggle',
        code: resp.error.code,
      });
    }
  }

  private _requestDelete(rule: SentryRule): void {
    this._deletePrompt = { id: rule.id, reason: '' };
  }

  private _cancelDelete(): void {
    this._deletePrompt = null;
  }

  private async _confirmDelete(): Promise<void> {
    if (!this._deletePrompt) return;
    const { id, reason } = this._deletePrompt;
    if (reason.trim().length < 3) return;
    this._submitting = true;
    const resp = await bureauOpsApi.deleteSentryRule(id, reason.trim());
    this._submitting = false;
    this._deletePrompt = null;
    if (resp.success) {
      VelgToast.success(msg('Sentry rule deleted.'));
      await this._fetch();
    } else {
      VelgToast.error(msg(str`Delete failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'SentryRulesPanel._confirmDelete',
        code: resp.error.code,
      });
    }
  }

  private _kindHeading(kind: SentryRuleKind): string {
    switch (kind) {
      case 'ignore':
        return msg('Ignore (drops events)');
      case 'fingerprint':
        return msg('Fingerprint (collapses groups)');
      case 'downgrade':
        return msg('Downgrade (lowers severity)');
      default:
        return kind;
    }
  }

  private _matchSummary(rule: SentryRule) {
    const chips: Array<{ label: string; value: string }> = [];
    if (rule.match_exception_type)
      chips.push({ label: msg('type'), value: rule.match_exception_type });
    if (rule.match_message_regex)
      chips.push({ label: msg('msg'), value: rule.match_message_regex });
    if (rule.match_logger) chips.push({ label: msg('logger'), value: rule.match_logger });
    if (rule.kind === 'fingerprint' && rule.fingerprint_template)
      chips.push({ label: msg('fp'), value: rule.fingerprint_template });
    if (rule.kind === 'downgrade' && rule.downgrade_to)
      chips.push({ label: msg('→'), value: rule.downgrade_to });
    if (chips.length === 0)
      return html`<span class="rule__match"><em>${msg('matches anything')}</em></span>`;
    return html`
      <span class="rule__match">
        ${chips.map(
          (c) => html`<span><strong>${c.label}</strong> ${c.value}</span>`,
        )}
      </span>
    `;
  }

  private _renderForm() {
    const isEditing = this._editingId !== null;
    const valid = this._isFormValid();
    return html`
      <div class="form" role="region" aria-label=${msg('Sentry rule form')}>
        <div class="form__row">
          <label class="form__label" for="rule-kind">${msg('Kind')}</label>
          <select
            id="rule-kind"
            class="form__select"
            .value=${this._form.kind}
            ?disabled=${isEditing}
            @change=${(e: Event) =>
              this._updateForm('kind', (e.target as HTMLSelectElement).value as SentryRuleKind)}
          >
            <option value="ignore">${msg('ignore')}</option>
            <option value="fingerprint">${msg('fingerprint')}</option>
            <option value="downgrade">${msg('downgrade')}</option>
          </select>
        </div>

        <div class="form__row">
          <label class="form__label">
            <span class="form__checkbox-row">
              <input
                type="checkbox"
                .checked=${this._form.enabled}
                @change=${(e: Event) =>
                  this._updateForm('enabled', (e.target as HTMLInputElement).checked)}
              />
              ${msg('Enabled')}
            </span>
          </label>
        </div>

        <div class="form__row">
          <label class="form__label" for="rule-exc">${msg('Exception type (exact)')}</label>
          <input
            id="rule-exc"
            class="form__input"
            type="text"
            maxlength="128"
            .value=${this._form.match_exception_type}
            @input=${(e: Event) =>
              this._updateForm('match_exception_type', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="form__row">
          <label class="form__label" for="rule-regex">${msg('Message regex')}</label>
          <input
            id="rule-regex"
            class="form__input"
            type="text"
            maxlength="512"
            .value=${this._form.match_message_regex}
            @input=${(e: Event) =>
              this._updateForm('match_message_regex', (e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="form__row form__row--full">
          <label class="form__label" for="rule-logger">${msg('Logger prefix')}</label>
          <input
            id="rule-logger"
            class="form__input"
            type="text"
            maxlength="128"
            .value=${this._form.match_logger}
            @input=${(e: Event) =>
              this._updateForm('match_logger', (e.target as HTMLInputElement).value)}
          />
        </div>

        ${this._form.kind === 'fingerprint'
          ? html`
              <div class="form__row form__row--full">
                <label class="form__label" for="rule-fp">
                  ${msg('Fingerprint template, e.g. openrouter.{exc_type}.{model}')}
                </label>
                <input
                  id="rule-fp"
                  class="form__input"
                  type="text"
                  maxlength="256"
                  .value=${this._form.fingerprint_template}
                  @input=${(e: Event) =>
                    this._updateForm(
                      'fingerprint_template',
                      (e.target as HTMLInputElement).value,
                    )}
                />
              </div>
            `
          : nothing}

        ${this._form.kind === 'downgrade'
          ? html`
              <div class="form__row">
                <label class="form__label" for="rule-downgrade">${msg('Downgrade to')}</label>
                <select
                  id="rule-downgrade"
                  class="form__select"
                  .value=${this._form.downgrade_to}
                  @change=${(e: Event) =>
                    this._updateForm(
                      'downgrade_to',
                      (e.target as HTMLSelectElement).value as SentryDowngradeTo | '',
                    )}
                >
                  <option value="">${msg('(select)')}</option>
                  <option value="warning">${msg('warning')}</option>
                  <option value="info">${msg('info')}</option>
                </select>
              </div>
            `
          : nothing}

        <div class="form__row form__row--full">
          <label class="form__label" for="rule-note">
            ${msg('Note / rationale (audit log + why it exists)')}
          </label>
          <textarea
            id="rule-note"
            class="form__textarea"
            maxlength="500"
            minlength="3"
            .value=${this._form.note}
            @input=${(e: Event) =>
              this._updateForm('note', (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>

        <div class="form__actions">
          <button class="form__btn" type="button" @click=${this._closeForm}>
            ${msg('Cancel')}
          </button>
          <button
            class="form__btn form__btn--primary"
            type="button"
            ?disabled=${!valid || this._submitting}
            @click=${() => void this._submitForm()}
          >
            ${isEditing ? msg('Save rule') : msg('Create rule')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderRule(rule: SentryRule) {
    const isDeleting = this._deletePrompt?.id === rule.id;
    const isToggling = this._togglePrompt?.id === rule.id;
    const togglePlaceholder = this._togglePrompt?.nextEnabled
      ? msg('Reason for re-enabling (audit log)')
      : msg('Reason for disabling (audit log)');
    return html`
      <div class="rule ${rule.enabled ? '' : 'rule--disabled'}">
        <div class="rule__body">
          ${this._matchSummary(rule)}
          <span class="rule__note">${rule.note}</span>
          <span class="rule__meta">
            ${msg(str`Silenced ${rule.silenced_count_24h} events (last 24h)`)}
          </span>
        </div>
        <div class="rule__actions">
          <button
            class="rule__btn"
            type="button"
            @click=${() => this._requestToggle(rule)}
            aria-pressed=${rule.enabled}
          >
            ${rule.enabled ? msg('On') : msg('Off')}
          </button>
          <button class="rule__btn" type="button" @click=${() => this._openEdit(rule)}>
            ${msg('Edit')}
          </button>
          <button
            class="rule__btn rule__btn--danger"
            type="button"
            @click=${() => this._requestDelete(rule)}
          >
            ${msg('Del')}
          </button>
        </div>
      </div>
      ${isToggling
        ? html`
            <div class="delete-prompt" role="region" aria-label=${msg('Toggle confirmation')}>
              <input
                class="form__input"
                type="text"
                placeholder=${togglePlaceholder}
                minlength="3"
                maxlength="500"
                .value=${this._togglePrompt?.reason ?? ''}
                @input=${(e: Event) => {
                  if (!this._togglePrompt) return;
                  this._togglePrompt = {
                    ...this._togglePrompt,
                    reason: (e.target as HTMLInputElement).value,
                  };
                }}
              />
              <button class="form__btn" type="button" @click=${this._cancelToggle}>
                ${msg('Cancel')}
              </button>
              <button
                class="form__btn form__btn--primary"
                type="button"
                ?disabled=${(this._togglePrompt?.reason.trim().length ?? 0) < 3 ||
                  this._submitting}
                @click=${() => void this._confirmToggle(rule)}
              >
                ${msg('Confirm')}
              </button>
            </div>
          `
        : nothing}
      ${isDeleting
        ? html`
            <div class="delete-prompt" role="region" aria-label=${msg('Delete confirmation')}>
              <input
                class="form__input"
                type="text"
                placeholder=${msg('Reason (audit log)')}
                minlength="3"
                maxlength="500"
                .value=${this._deletePrompt?.reason ?? ''}
                @input=${(e: Event) => {
                  if (!this._deletePrompt) return;
                  this._deletePrompt = {
                    ...this._deletePrompt,
                    reason: (e.target as HTMLInputElement).value,
                  };
                }}
              />
              <button class="form__btn" type="button" @click=${this._cancelDelete}>
                ${msg('Cancel')}
              </button>
              <button
                class="form__btn form__btn--primary"
                type="button"
                ?disabled=${(this._deletePrompt?.reason.trim().length ?? 0) < 3 ||
                  this._submitting}
                @click=${() => void this._confirmDelete()}
              >
                ${msg('Confirm')}
              </button>
            </div>
          `
        : nothing}
    `;
  }

  protected render() {
    const grouped = new Map<SentryRuleKind, SentryRule[]>();
    for (const kind of KIND_ORDER) grouped.set(kind, []);
    for (const rule of this._rules) {
      grouped.get(rule.kind)?.push(rule);
    }

    return html`
      <div class="heading">
        <span class="heading__label">
          ${msg(str`Sentry rules // ${this._rules.length} configured`)}
        </span>
        <button
          class="create-btn"
          type="button"
          @click=${this._openCreate}
          ?disabled=${this._formOpen}
        >
          ${msg('+ Create rule')}
        </button>
      </div>

      ${this._error
        ? html`<div class="error">${msg('Rules failed:')} ${this._error}</div>`
        : null}

      ${this._formOpen ? this._renderForm() : nothing}

      ${this._loading && this._rules.length === 0
        ? html`<div class="empty">${msg('Loading rules')}</div>`
        : KIND_ORDER.map(
            (kind) => html`
              <section class="group">
                <h3 class="group__title">
                  ${this._kindHeading(kind)} (${grouped.get(kind)?.length ?? 0})
                </h3>
                ${(grouped.get(kind) ?? []).length === 0
                  ? html`<div class="empty">${msg('No rules in this kind.')}</div>`
                  : (grouped.get(kind) ?? []).map((rule) => this._renderRule(rule))}
              </section>
            `,
          )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-sentry-rules-panel': VelgOpsSentryRulesPanel;
  }
}
