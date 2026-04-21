/**
 * QuarantinePanel — circuit state + manual kill switches (panel ④).
 *
 * Three zones:
 *   1. Header with CUT ALL AI master switch (trips provider:openrouter).
 *   2. Active kill list — one VelgKillSwitch per row in state='killed'.
 *   3. Known auto-circuits — shows open/half-open breakers (admin can
 *      force-reset them to closed without waiting for backoff).
 *
 * Delegates all mutation API calls to BureauOpsApiService; emits
 * ``ops-circuit-changed`` after any successful mutation so AdminOpsTab
 * re-fetches the matrix immediately.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  bureauOpsApi,
  type CircuitEntry,
  type CircuitMatrix,
  type CircuitScope,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { VelgToast } from '../../shared/Toast.js';
import '../../shared/VelgKillSwitch.js';

@localized()
@customElement('velg-ops-quarantine-panel')
export class VelgOpsQuarantinePanel extends LitElement {
  static styles = css`
    :host {
      --_danger: var(--color-danger);
      --_accent: var(--color-accent-amber);
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
      background: var(--_danger);
    }

    .heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
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

    .cut-all {
      padding: var(--space-2) var(--space-3);
      border: 2px solid var(--_danger);
      background: color-mix(in srgb, var(--_danger) 8%, transparent);
      color: var(--_danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .cut-all:hover,
    .cut-all:focus-visible {
      background: var(--_danger);
      color: var(--color-text-inverse);
      outline: none;
    }

    .cut-all[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .section {
      margin-bottom: var(--space-5);
    }

    .section__title {
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

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .empty {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      padding: var(--space-3);
      text-align: center;
      font-style: italic;
    }

    .auto-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
    }

    .auto-row__label {
      color: var(--color-text-primary);
    }

    .auto-row__state {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 2px 6px;
      border: 1px solid currentColor;
    }

    .auto-row__state--open {
      color: var(--_danger);
    }

    .auto-row__state--half_open {
      color: var(--_accent);
    }

    .auto-row__state--closed {
      color: var(--color-success);
    }

    .auto-row__reset {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .auto-row__reset:hover,
    .auto-row__reset:focus-visible {
      background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
      outline: none;
    }

    .cut-all-confirm {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: 2px dashed var(--_danger);
      margin-bottom: var(--space-4);
    }

    .cut-all-confirm__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--_danger);
      display: block;
      margin-bottom: var(--space-1);
    }

    .cut-all-confirm__input {
      width: 100%;
      padding: var(--space-2);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      box-sizing: border-box;
    }

    .cut-all-confirm__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .cut-all-confirm__btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .cut-all-confirm__btn--danger {
      border-color: var(--_danger);
      background: var(--_danger);
      color: var(--color-text-inverse);
    }

    .cut-all-confirm__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @property({ type: Object }) matrix: CircuitMatrix | null = null;
  @property({ type: Boolean }) loading = false;

  @state() private _cutAllOpen = false;
  @state() private _cutAllReason = '';
  @state() private _busyKey: string | null = null;
  @state() private _resetPrompt: { entry: CircuitEntry; reason: string } | null = null;

  private _keyOf(entry: CircuitEntry): string {
    return `${entry.scope}:${entry.scope_key}`;
  }

  private async _handleTrip(e: CustomEvent, entry: CircuitEntry): Promise<void> {
    const key = this._keyOf(entry);
    this._busyKey = key;
    const detail = e.detail as { reason: string; revertAfterMinutes: number };
    const resp = await bureauOpsApi.tripKill({
      scope: entry.scope,
      scope_key: entry.scope_key,
      reason: detail.reason,
      revert_after_minutes: detail.revertAfterMinutes,
    });
    this._busyKey = null;
    if (resp.success) {
      VelgToast.success(msg(str`Killed ${entry.scope}:${entry.scope_key}`));
      this.dispatchEvent(new CustomEvent('ops-circuit-changed', { bubbles: true, composed: true }));
    } else {
      VelgToast.error(msg(str`Kill failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'QuarantinePanel._handleTrip',
        code: resp.error.code,
      });
    }
  }

  private async _handleRevert(e: CustomEvent, entry: CircuitEntry): Promise<void> {
    const key = this._keyOf(entry);
    this._busyKey = key;
    const detail = e.detail as { reason: string };
    const resp = await bureauOpsApi.revertKill({
      scope: entry.scope,
      scope_key: entry.scope_key,
      reason: detail.reason,
    });
    this._busyKey = null;
    if (resp.success) {
      VelgToast.success(msg(str`Reverted ${entry.scope}:${entry.scope_key}`));
      this.dispatchEvent(new CustomEvent('ops-circuit-changed', { bubbles: true, composed: true }));
    } else {
      VelgToast.error(msg(str`Revert failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'QuarantinePanel._handleRevert',
        code: resp.error.code,
      });
    }
  }

  private _onRequestReset(entry: CircuitEntry): void {
    this._resetPrompt = { entry, reason: '' };
  }

  private _onCancelReset(): void {
    this._resetPrompt = null;
  }

  private async _onConfirmReset(): Promise<void> {
    if (!this._resetPrompt) return;
    const { entry, reason } = this._resetPrompt;
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    const key = this._keyOf(entry);
    this._busyKey = key;
    const resp = await bureauOpsApi.resetCircuit({
      scope: entry.scope,
      scope_key: entry.scope_key,
      reason: trimmed,
    });
    this._busyKey = null;
    this._resetPrompt = null;
    if (resp.success) {
      VelgToast.success(msg(str`Reset ${entry.scope}:${entry.scope_key}`));
      this.dispatchEvent(new CustomEvent('ops-circuit-changed', { bubbles: true, composed: true }));
    } else {
      VelgToast.error(msg(str`Reset failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'QuarantinePanel._onConfirmReset',
        code: resp.error.code,
      });
    }
  }

  private _onOpenCutAll(): void {
    this._cutAllOpen = true;
    this._cutAllReason = '';
  }

  private _onCancelCutAll(): void {
    this._cutAllOpen = false;
    this._cutAllReason = '';
  }

  private async _onConfirmCutAll(): Promise<void> {
    const trimmed = this._cutAllReason.trim();
    if (trimmed.length < 3) return;
    this._busyKey = 'cut-all';
    const resp = await bureauOpsApi.cutAllAI({
      reason: trimmed,
      revert_after_minutes: 60,
    });
    this._busyKey = null;
    if (resp.success) {
      VelgToast.warning(msg('CUT ALL AI engaged. OpenRouter calls are blocked for 60 minutes.'));
      this._cutAllOpen = false;
      this._cutAllReason = '';
      this.dispatchEvent(new CustomEvent('ops-circuit-changed', { bubbles: true, composed: true }));
    } else {
      VelgToast.error(msg(str`CUT ALL failed: ${resp.error.message}`));
      captureError(new Error(resp.error.message), {
        source: 'QuarantinePanel._onConfirmCutAll',
        code: resp.error.code,
      });
    }
  }

  private _scopeSubtitle(scope: CircuitScope): string {
    switch (scope) {
      case 'provider':
        return msg('Upstream API provider');
      case 'model':
        return msg('Specific LLM model');
      case 'purpose':
        return msg('Feature area (e.g. forge, heartbeat)');
      case 'global':
        return msg('Platform-wide scope');
      default:
        return '';
    }
  }

  protected render() {
    const entries = this.matrix?.entries ?? [];
    const killed = entries.filter((e) => e.state === 'killed');
    const auto = entries.filter((e) => e.state !== 'killed');
    const anyBusy = this._busyKey !== null;

    return html`
      <div class="heading">
        <span class="heading__label">${msg('Quarantine // Kill Switches')}</span>
        <button
          class="cut-all"
          type="button"
          @click=${this._onOpenCutAll}
          ?disabled=${anyBusy || this._cutAllOpen}
          aria-label=${msg('Cut all AI – master kill switch')}
        >
          ${msg('Cut all AI')}
        </button>
      </div>

      ${
        this._cutAllOpen
          ? html`
            <div class="cut-all-confirm" role="region" aria-label=${msg('Cut all AI confirmation')}>
              <label class="cut-all-confirm__label" for="cut-all-reason">
                ${msg('This kills all OpenRouter calls for 60 minutes. Reason (audit log):')}
              </label>
              <input
                id="cut-all-reason"
                class="cut-all-confirm__input"
                type="text"
                minlength="3"
                maxlength="500"
                autocomplete="off"
                .value=${this._cutAllReason}
                @input=${(e: Event) => {
                  this._cutAllReason = (e.target as HTMLInputElement).value;
                }}
              />
              <div class="cut-all-confirm__actions">
                <button class="cut-all-confirm__btn" type="button" @click=${this._onCancelCutAll}>
                  ${msg('Cancel')}
                </button>
                <button
                  class="cut-all-confirm__btn cut-all-confirm__btn--danger"
                  type="button"
                  @click=${this._onConfirmCutAll}
                  ?disabled=${this._cutAllReason.trim().length < 3}
                >
                  ${msg('Engage')}
                </button>
              </div>
            </div>
          `
          : nothing
      }

      <div class="section">
        <h3 class="section__title">${msg('Active kills')}</h3>
        ${
          killed.length > 0
            ? html`
              <div class="list">
                ${killed.map(
                  (entry) => html`
                    <velg-kill-switch
                      state="killed"
                      scope-label=${`${entry.scope} // ${entry.scope_key}`}
                      scope-subtitle=${this._scopeSubtitle(entry.scope)}
                      killed-reason=${entry.killed_reason ?? ''}
                      revert-at=${entry.killed_revert_at ?? ''}
                      ?disabled=${this._busyKey === this._keyOf(entry)}
                      @ops-kill-revert=${(e: CustomEvent) => void this._handleRevert(e, entry)}
                    ></velg-kill-switch>
                  `,
                )}
              </div>
            `
            : html`<div class="empty">${msg('No manual kills active.')}</div>`
        }
      </div>

      <div class="section">
        <h3 class="section__title">${msg('Auto-circuit state')}</h3>
        ${
          auto.length > 0
            ? html`
              <div class="list">
                ${auto.map(
                  (entry) => html`
                    <div class="auto-row">
                      <span class="auto-row__label">${entry.scope}:${entry.scope_key}</span>
                      <span class="auto-row__state auto-row__state--${entry.state}">
                        ${entry.state.replace('_', '-')}
                      </span>
                      ${
                        entry.state !== 'closed'
                          ? html`<button
                            class="auto-row__reset"
                            type="button"
                            @click=${() => this._onRequestReset(entry)}
                            ?disabled=${this._busyKey === this._keyOf(entry)}
                          >
                            ${msg('Reset')}
                          </button>`
                          : html`<span></span>`
                      }
                    </div>
                    ${
                      entry.state === 'open'
                        ? html`
                          <div
                            style="font-size: var(--text-xs); color: var(--color-text-muted); padding-left: var(--space-3);"
                          >
                            ${msg(
                              str`${Math.round(entry.opens_until_s)}s until half-open probe • ${entry.consecutive_opens} consecutive opens`,
                            )}
                          </div>
                        `
                        : nothing
                    }
                    ${
                      this._resetPrompt &&
                      this._keyOf(this._resetPrompt.entry) === this._keyOf(entry)
                        ? html`
                          <div
                            class="cut-all-confirm"
                            role="region"
                            aria-label=${msg('Circuit reset confirmation')}
                          >
                            <label class="cut-all-confirm__label" for="reset-reason-${this._keyOf(entry)}">
                              ${msg('Reason for reset (audit log):')}
                            </label>
                            <input
                              id="reset-reason-${this._keyOf(entry)}"
                              class="cut-all-confirm__input"
                              type="text"
                              minlength="3"
                              maxlength="500"
                              autocomplete="off"
                              .value=${this._resetPrompt.reason}
                              @input=${(e: Event) => {
                                if (!this._resetPrompt) return;
                                this._resetPrompt = {
                                  ...this._resetPrompt,
                                  reason: (e.target as HTMLInputElement).value,
                                };
                              }}
                            />
                            <div class="cut-all-confirm__actions">
                              <button
                                class="cut-all-confirm__btn"
                                type="button"
                                @click=${this._onCancelReset}
                              >
                                ${msg('Cancel')}
                              </button>
                              <button
                                class="cut-all-confirm__btn cut-all-confirm__btn--danger"
                                type="button"
                                @click=${() => void this._onConfirmReset()}
                                ?disabled=${this._resetPrompt.reason.trim().length < 3}
                              >
                                ${msg('Reset')}
                              </button>
                            </div>
                          </div>
                        `
                        : nothing
                    }
                  `,
                )}
              </div>
            `
            : this.loading
              ? html`<div class="empty">${msg('loading…')}</div>`
              : html`<div class="empty">${msg('No circuit activity recorded.')}</div>`
        }
      </div>

      <div class="section">
        <h3 class="section__title">${msg('Trip a manual kill')}</h3>
        <velg-kill-switch
          state="closed"
          scope-label=${msg('provider // openrouter')}
          scope-subtitle=${msg('All OpenRouter calls – same scope as CUT ALL AI')}
          ?disabled=${this._busyKey === 'provider:openrouter'}
          @ops-kill-trip=${(e: CustomEvent) =>
            void this._handleTrip(e, {
              scope: 'provider',
              scope_key: 'openrouter',
              state: 'closed',
              failures_in_window: 0,
              opens_until_s: 0,
              consecutive_opens: 0,
            })}
        ></velg-kill-switch>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-quarantine-panel': VelgOpsQuarantinePanel;
  }
}
