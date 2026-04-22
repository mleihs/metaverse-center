/**
 * IncidentDossierDrawer — ops_audit_log read surface (P2.7 / panel ⑦ drawer).
 *
 * Side-panel drawer that lists every audit entry a Bureau-Ops mutation
 * has produced — kill.trip, kill.revert, budget.*, sentry.rule.* —
 * with filters so an operator investigating an incident can narrow by
 * action type and timeframe.
 *
 * Design:
 *   - Uses the shared <velg-side-panel> for the overlay + focus trap +
 *     keyboard close. The drawer stays mounted but hidden; opening
 *     triggers a fresh fetch so late-arriving audit rows from other
 *     workers are visible.
 *   - Filter controls: action-type chip group + days window. The
 *     action-type chips derive from the rows in the current result
 *     set so operators see only actions that actually occurred.
 *   - Row rendering: timestamp + action badge + target + reason +
 *     collapsible payload. Payload is JSON-rendered under a
 *     summary/details so the dossier list stays scannable even with
 *     long payload blobs.
 *
 * Parent contract:
 *   - Property ``open`` controls visibility (reflected to attribute).
 *   - Emits ``dossier-close`` when the operator dismisses the drawer.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { bureauOpsApi, type OpsAuditEntry } from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import '../../shared/VelgSidePanel.js';

const DAYS_OPTIONS: readonly { value: number; label: () => string }[] = [
  { value: 1, label: () => msg('24h') },
  { value: 7, label: () => msg('7d') },
  { value: 30, label: () => msg('30d') },
  { value: 90, label: () => msg('90d') },
];

const ACTION_ALL = '__all__';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function formatPayload(payload: Record<string, unknown>): string {
  if (Object.keys(payload).length === 0) return '';
  try {
    return JSON.stringify(payload, null, 2);
  } catch (err) {
    captureError(err, { source: 'IncidentDossierDrawer.formatPayload' });
    return String(payload);
  }
}

@localized()
@customElement('velg-ops-incident-dossier-drawer')
export class VelgOpsIncidentDossierDrawer extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-bottom: 1px dashed var(--color-border);
      background: var(--color-surface);
    }

    .toolbar__group {
      display: flex;
      gap: 0;
      border: 1px solid var(--color-border);
    }

    .toolbar__btn {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      border: 0;
      border-left: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .toolbar__btn:first-child {
      border-left: 0;
    }

    .toolbar__btn[aria-pressed='true'] {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .toolbar__btn:hover:not([aria-pressed='true']),
    .toolbar__btn:focus-visible:not([aria-pressed='true']) {
      background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
      color: var(--color-text-primary);
      outline: none;
    }

    .list {
      padding: var(--space-3) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .entry {
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
    }

    .entry__header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }

    .entry__time {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      font-size: 10px;
      text-transform: uppercase;
    }

    .entry__action {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-primary);
      font-size: 10px;
      padding: 1px var(--space-1-5);
      border: 1px solid var(--color-primary);
    }

    .entry__action--kill {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .entry__action--revert {
      color: var(--color-success);
      border-color: var(--color-success);
    }

    .entry__target {
      color: var(--color-text-primary);
      margin-bottom: var(--space-1);
    }

    .entry__reason {
      color: var(--color-text-secondary);
      font-style: italic;
      margin-bottom: var(--space-1);
    }

    .entry__actor {
      color: var(--color-text-muted);
      font-size: 10px;
    }

    .entry__payload {
      margin-top: var(--space-1);
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-sunken);
      border: 1px dashed var(--color-border);
      color: var(--color-text-secondary);
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .entry__payload summary {
      cursor: pointer;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      font-size: 9px;
      color: var(--color-text-muted);
    }

    .empty,
    .error {
      padding: var(--space-4);
      text-align: center;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }

    .error {
      color: var(--color-text-primary);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      font-style: normal;
      margin: var(--space-3) var(--space-5);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _entries: OpsAuditEntry[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _days = 7;
  @state() private _actionFilter: string = ACTION_ALL;

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open') && this.open) {
      void this._fetch();
    }
  }

  private async _fetch(): Promise<void> {
    this._loading = true;
    const resp = await bureauOpsApi.getAuditLog(this._days, 200);
    if (resp.success) {
      this._entries = resp.data;
      this._error = null;
    } else {
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'IncidentDossierDrawer._fetch',
        code: resp.error.code,
      });
    }
    this._loading = false;
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('dossier-close', { bubbles: true, composed: true }));
  }

  private _selectDays(days: number): void {
    if (days === this._days) return;
    this._days = days;
    void this._fetch();
  }

  private _selectAction(action: string): void {
    this._actionFilter = action;
  }

  private _actionClass(action: string): string {
    if (action.startsWith('kill.trip') || action.startsWith('circuit.trip')) {
      return 'entry__action entry__action--kill';
    }
    if (action.startsWith('kill.revert') || action.startsWith('circuit.reset')) {
      return 'entry__action entry__action--revert';
    }
    return 'entry__action';
  }

  private _uniqueActions(): string[] {
    const set = new Set<string>();
    for (const entry of this._entries) set.add(entry.action);
    return [...set].sort();
  }

  private _filteredEntries(): OpsAuditEntry[] {
    if (this._actionFilter === ACTION_ALL) return this._entries;
    return this._entries.filter((e) => e.action === this._actionFilter);
  }

  protected render() {
    const actions = this._uniqueActions();
    const filtered = this._filteredEntries();
    const title = msg(
      str`Incident dossier // ${this._entries.length} events in last ${this._days}d`,
    );

    return html`
      <velg-side-panel
        ?open=${this.open}
        .panelTitle=${title}
        @panel-close=${this._handleClose}
      >
        <div class="toolbar">
          <div class="toolbar__group" role="group" aria-label=${msg('Window')}>
            ${DAYS_OPTIONS.map(
              (opt) => html`
                <button
                  type="button"
                  class="toolbar__btn"
                  aria-pressed=${this._days === opt.value}
                  @click=${() => this._selectDays(opt.value)}
                >
                  ${opt.label()}
                </button>
              `,
            )}
          </div>
          ${
            actions.length > 1
              ? html`
                <div class="toolbar__group" role="group" aria-label=${msg('Action type')}>
                  <button
                    type="button"
                    class="toolbar__btn"
                    aria-pressed=${this._actionFilter === ACTION_ALL}
                    @click=${() => this._selectAction(ACTION_ALL)}
                  >
                    ${msg('All')}
                  </button>
                  ${actions.map(
                    (a) => html`
                      <button
                        type="button"
                        class="toolbar__btn"
                        aria-pressed=${this._actionFilter === a}
                        @click=${() => this._selectAction(a)}
                      >
                        ${a}
                      </button>
                    `,
                  )}
                </div>
              `
              : nothing
          }
        </div>

        ${this._error ? html`<div class="error">${this._error}</div>` : null}

        ${
          this._loading && this._entries.length === 0
            ? html`<div class="empty">${msg('Loading dossier')}</div>`
            : filtered.length === 0
              ? html`<div class="empty">${msg('No events in the selected window.')}</div>`
              : html`
                <div class="list">
                  ${filtered.map(
                    (entry) => html`
                      <div class="entry">
                        <div class="entry__header">
                          <span class="entry__time">${formatTimestamp(entry.created_at)}</span>
                          <span class=${this._actionClass(entry.action)}>${entry.action}</span>
                        </div>
                        ${
                          entry.target_scope || entry.target_key
                            ? html`<div class="entry__target">
                              ${entry.target_scope ?? ''}${
                                entry.target_key ? `:${entry.target_key}` : ''
                              }
                            </div>`
                            : nothing
                        }
                        <div class="entry__reason">${entry.reason}</div>
                        <div class="entry__actor">
                          ${
                            entry.actor_id
                              ? msg(str`Actor ${entry.actor_id.slice(0, 8)}`)
                              : msg('System')
                          }
                        </div>
                        ${
                          Object.keys(entry.payload).length > 0
                            ? html`<details class="entry__payload">
                              <summary>${msg('Payload')}</summary>
                              ${formatPayload(entry.payload)}
                            </details>`
                            : nothing
                        }
                      </div>
                    `,
                  )}
                </div>
              `
        }
      </velg-side-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-incident-dossier-drawer': VelgOpsIncidentDossierDrawer;
  }
}
