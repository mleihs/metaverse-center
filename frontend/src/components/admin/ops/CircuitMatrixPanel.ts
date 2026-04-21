/**
 * CircuitMatrixPanel — dot-matrix view of every known circuit (panel ③).
 *
 * Complements QuarantinePanel (panel ④):
 *   - Quarantine: controls (kill / revert / reset) + textual state.
 *   - CircuitMatrix: at-a-glance visual — one `<velg-dot-matrix-cell>`
 *     per (scope, scope_key) grouped by scope so an operator scanning
 *     the cockpit spots a red glyph in the provider group before
 *     reading any text.
 *
 * Data arrives from AdminOpsTab (same 10s poll that feeds Quarantine);
 * the panel is stateless beyond the matrix prop. No mutations here —
 * the kill/revert/reset controls live in QuarantinePanel directly
 * below this panel, keeping the matrix purely observational so an
 * operator can scan the grid without accidentally pressing a button.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  CircuitEntry,
  CircuitMatrix,
  CircuitScope,
} from '../../../services/api/BureauOpsApiService.js';
import '../../shared/VelgDotMatrixCell.js';

const SCOPE_ORDER: readonly CircuitScope[] = ['provider', 'model', 'purpose', 'global'];

@localized()
@customElement('velg-ops-circuit-matrix-panel')
export class VelgOpsCircuitMatrixPanel extends LitElement {
  static styles = css`
    :host {
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
      background: var(--_accent);
    }

    .heading {
      display: flex;
      align-items: baseline;
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

    .heading__legend {
      display: flex;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
    }

    .legend__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .legend__swatch {
      width: 8px;
      height: 8px;
      border: 1px solid currentColor;
    }

    .legend__chip--closed {
      color: var(--color-success);
    }

    .legend__chip--half-open {
      color: var(--color-warning);
    }

    .legend__chip--open,
    .legend__chip--killed {
      color: var(--color-danger);
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

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-3);
    }

    .cell {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .cell__meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .cell__key {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10px;
    }

    .cell__detail {
      color: var(--color-text-muted);
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cell__detail--danger {
      color: var(--color-danger);
    }

    .cell__detail--warn {
      color: var(--color-warning);
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

    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .heading {
        flex-direction: column;
        gap: var(--space-2);
        align-items: flex-start;
      }
    }
  `;

  @property({ type: Object }) matrix: CircuitMatrix | null = null;
  @property({ type: Boolean }) loading = false;

  private _groupedEntries(): Map<CircuitScope, CircuitEntry[]> {
    const groups = new Map<CircuitScope, CircuitEntry[]>();
    for (const scope of SCOPE_ORDER) {
      groups.set(scope, []);
    }
    for (const entry of this.matrix?.entries ?? []) {
      const bucket = groups.get(entry.scope);
      if (bucket) bucket.push(entry);
    }
    for (const bucket of groups.values()) {
      bucket.sort((a, b) => a.scope_key.localeCompare(b.scope_key));
    }
    return groups;
  }

  private _scopeHeading(scope: CircuitScope): string {
    switch (scope) {
      case 'provider':
        return msg('Provider');
      case 'model':
        return msg('Model');
      case 'purpose':
        return msg('Purpose');
      case 'global':
        return msg('Global');
      default:
        return scope;
    }
  }

  private _renderDetail(entry: CircuitEntry) {
    if (entry.state === 'killed') {
      const reason = entry.killed_reason?.trim();
      const revertAt = entry.killed_revert_at ? new Date(entry.killed_revert_at) : null;
      const minutesLeft = revertAt
        ? Math.max(0, Math.round((revertAt.getTime() - Date.now()) / 60000))
        : null;
      return html`
        <span class="cell__detail cell__detail--danger">
          ${reason ? msg(str`Kill: ${reason}`) : msg('Admin kill')}
        </span>
        ${
          minutesLeft !== null
            ? html`<span class="cell__detail">
              ${msg(str`Auto-revert in ${minutesLeft} min`)}
            </span>`
            : nothing
        }
      `;
    }
    if (entry.state === 'open') {
      return html`
        <span class="cell__detail cell__detail--danger">
          ${msg(
            str`${Math.round(entry.opens_until_s)}s to probe – ${entry.consecutive_opens} opens`,
          )}
        </span>
        ${
          entry.failures_in_window
            ? html`<span class="cell__detail">
              ${msg(str`${entry.failures_in_window} failures in window`)}
            </span>`
            : nothing
        }
      `;
    }
    if (entry.state === 'half_open') {
      return html`
        <span class="cell__detail cell__detail--warn">
          ${msg('Probing – next call decides')}
        </span>
      `;
    }
    return html`
      <span class="cell__detail">
        ${
          entry.failures_in_window
            ? msg(str`${entry.failures_in_window} failures tracked`)
            : msg('Healthy – no recent failures')
        }
      </span>
    `;
  }

  private _renderGroup(scope: CircuitScope, entries: CircuitEntry[]) {
    return html`
      <section class="group">
        <h3 class="group__title">
          ${this._scopeHeading(scope)} (${entries.length})
        </h3>
        ${
          entries.length === 0
            ? html`<div class="empty">${msg('No activity recorded in this scope.')}</div>`
            : html`
              <div class="grid">
                ${entries.map(
                  (entry) => html`
                    <div class="cell">
                      <velg-dot-matrix-cell
                        state=${entry.state}
                        label=${
                          entry.scope_key.length > 8
                            ? entry.scope_key.slice(0, 7) + '…'
                            : entry.scope_key
                        }
                      ></velg-dot-matrix-cell>
                      <div class="cell__meta">
                        <span class="cell__key" title="${entry.scope}:${entry.scope_key}">
                          ${entry.scope_key}
                        </span>
                        ${this._renderDetail(entry)}
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
        }
      </section>
    `;
  }

  protected render() {
    const groups = this._groupedEntries();
    const totalEntries = this.matrix?.entries.length ?? 0;

    return html`
      <div class="heading">
        <span class="heading__label">
          ${msg(str`Circuit Matrix // ${totalEntries} scopes tracked`)}
        </span>
        <div class="heading__legend" aria-hidden="true">
          <span class="legend__chip legend__chip--closed">
            <span class="legend__swatch"></span>${msg('Closed')}
          </span>
          <span class="legend__chip legend__chip--half-open">
            <span class="legend__swatch"></span>${msg('Half-open')}
          </span>
          <span class="legend__chip legend__chip--open">
            <span class="legend__swatch"></span>${msg('Open')}
          </span>
          <span class="legend__chip legend__chip--killed">
            <span class="legend__swatch"></span>${msg('Killed')}
          </span>
        </div>
      </div>

      ${
        totalEntries === 0 && this.loading
          ? html`<div class="empty">${msg('Loading circuit state')}</div>`
          : totalEntries === 0
            ? html`<div class="empty">${msg('No circuit activity recorded.')}</div>`
            : SCOPE_ORDER.map((scope) => this._renderGroup(scope, groups.get(scope) ?? []))
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-circuit-matrix-panel': VelgOpsCircuitMatrixPanel;
  }
}
