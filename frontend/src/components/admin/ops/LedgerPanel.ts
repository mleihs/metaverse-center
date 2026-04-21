/**
 * LedgerPanel — AI spend ledger hero (panel ①).
 *
 * Four hero tiles: today cost, month cost, today tokens, today calls.
 * Animated via VelgKineticCounter. Today breakdowns by purpose follow
 * the tiles as a compact table.
 *
 * Data source: LedgerSnapshot (shared with BurnRatePanel, passed down
 * from AdminOpsTab so both panels share one 30s fetch).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LedgerSnapshot } from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import '../../shared/VelgKineticCounter.js';

@localized()
@customElement('velg-ops-ledger-panel')
export class VelgOpsLedgerPanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_ring: color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
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
      justify-content: space-between;
      align-items: baseline;
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

    .heading__timestamp {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }

    .tile-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }

    @media (max-width: 700px) {
      .tile-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .tile {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      position: relative;
      overflow: hidden;
    }

    .tile::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background: var(--_accent);
      opacity: 0.5;
    }

    .tile__label {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .tile__value {
      font-size: var(--text-xl);
      line-height: 1;
    }

    .tile__sub {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: var(--space-1);
    }

    .breakdown {
      border-top: 1px dashed var(--color-border);
      padding-top: var(--space-3);
    }

    .breakdown__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2) 0;
    }

    .breakdown__table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
    }

    .breakdown__table th,
    .breakdown__table td {
      padding: var(--space-1) var(--space-2);
      text-align: left;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .breakdown__table th {
      color: var(--color-text-muted);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--color-border);
    }

    .breakdown__table td.num {
      text-align: right;
    }

    .empty {
      padding: var(--space-4);
      color: var(--color-text-muted);
      text-align: center;
      font-size: var(--text-sm);
    }

    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
    }
  `;

  @property({ type: Object }) snapshot: LedgerSnapshot | null = null;
  @property({ type: Boolean }) loading = false;

  private _formatTimestamp(iso: string | undefined): string {
    if (!iso) return '';
    try {
      const dt = new Date(iso);
      return dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) {
      captureError(err, { source: 'LedgerPanel._formatTimestamp' });
      return '';
    }
  }

  private _formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  }

  protected render() {
    const s = this.snapshot;
    const today = s?.today ?? { calls: 0, tokens: 0, cost_usd: 0 };
    const month = s?.month ?? { calls: 0, tokens: 0, cost_usd: 0 };
    const lastHour = s?.last_hour ?? { calls: 0, tokens: 0, cost_usd: 0 };
    const generatedAt = s?.generated_at ?? '';

    return html`
      <div class="heading">
        <span class="heading__label">${msg('Ledger // Live Burn')}</span>
        <span class="heading__timestamp">
          ${this.loading ? msg('loading…') : this._formatTimestamp(generatedAt)}
        </span>
      </div>

      <div class="tile-grid">
        <div class="tile">
          <div class="tile__label">${msg('Today')}</div>
          <div class="tile__value">
            <velg-kinetic-counter
              .value=${today.cost_usd}
              prefix="$"
              .precision=${2}
            ></velg-kinetic-counter>
          </div>
          <div class="tile__sub">${msg('USD')}</div>
        </div>

        <div class="tile">
          <div class="tile__label">${msg('Month')}</div>
          <div class="tile__value">
            <velg-kinetic-counter
              .value=${month.cost_usd}
              prefix="$"
              .precision=${2}
            ></velg-kinetic-counter>
          </div>
          <div class="tile__sub">${msg('USD')}</div>
        </div>

        <div class="tile">
          <div class="tile__label">${msg('Tokens today')}</div>
          <div class="tile__value">${this._formatTokens(today.tokens)}</div>
          <div class="tile__sub">${msg('total')}</div>
        </div>

        <div class="tile">
          <div class="tile__label">${msg('Calls last hour')}</div>
          <div class="tile__value">
            <velg-kinetic-counter .value=${lastHour.calls}></velg-kinetic-counter>
          </div>
          <div class="tile__sub">${msg('reqs')}</div>
        </div>
      </div>

      ${s && s.by_purpose.length > 0
        ? html`
            <div class="breakdown">
              <h3 class="breakdown__title">${msg('Today by purpose')}</h3>
              <table class="breakdown__table">
                <thead>
                  <tr>
                    <th scope="col">${msg('Purpose')}</th>
                    <th scope="col" class="num">${msg('Calls')}</th>
                    <th scope="col" class="num">${msg('Tokens')}</th>
                    <th scope="col" class="num">${msg('Cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.by_purpose.map(
                    (row) => html`
                      <tr>
                        <td>${row.key}</td>
                        <td class="num">${row.calls.toLocaleString()}</td>
                        <td class="num">${this._formatTokens(row.tokens)}</td>
                        <td class="num">$${row.cost_usd.toFixed(4)}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
        : s && !this.loading && today.calls === 0
          ? html`<div class="empty">${msg('No usage recorded today yet.')}</div>`
          : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-ledger-panel': VelgOpsLedgerPanel;
  }
}
