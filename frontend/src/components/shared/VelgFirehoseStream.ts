/**
 * VelgFirehoseStream — auto-scrolling table of live ai_usage_log rows.
 *
 * Visual: fixed-height scroll container with terminal styling, newest
 * row fades in at the top, oldest row fades out at the bottom beyond
 * ``maxRows``. Hover pauses auto-scroll so operators can inspect.
 *
 * D-4: never renders prompt bodies. Only purpose / model / tokens /
 * cost / user-id (redacted) / simulation-id (redacted) are shown.
 *
 * Props:
 *   ``entries``     — array of FirehoseEntry, oldest-first is OK; this
 *                     component owns sort for display (newest-first).
 *   ``maxRows``     — truncation cap; defaults to 50.
 *   ``loading``     — optional boolean for initial load state.
 *
 * The parent (FirehosePanel) owns data fetching and Realtime
 * subscription; this primitive is purely presentational.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FirehoseEntry } from '../../services/api/BureauOpsApiService.js';
import { captureError } from '../../services/SentryService.js';
import './VelgRedacted.js';

const DEFAULT_MAX_ROWS = 50;

@localized()
@customElement('velg-firehose-stream')
export class VelgFirehoseStream extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_ok: var(--color-success);
      --_err: var(--color-danger);
      display: block;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      max-height: 440px;
      overflow-y: auto;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    :host(:hover) {
      --_paused: 1;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }

    thead {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--color-surface-header);
    }

    th {
      text-align: left;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      border-bottom: 1px solid var(--color-border);
      white-space: nowrap;
    }

    td {
      padding: var(--space-1-5) var(--space-3);
      color: var(--color-text-primary);
      border-bottom: 1px solid var(--color-border-light);
      white-space: nowrap;
    }

    td.num {
      text-align: right;
    }

    tr.row--entered {
      animation: firehose-row-in var(--duration-slow, 300ms) var(--ease-dramatic) both;
    }

    tr.row--error td {
      color: var(--_err);
    }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid currentColor;
      color: var(--color-text-muted);
    }

    .badge--ok { color: var(--_ok); }
    .badge--error { color: var(--_err); }

    .empty {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-style: italic;
    }

    @keyframes firehose-row-in {
      from { opacity: 0; transform: translateX(-8px); background-color: var(--_accent); }
      to   { opacity: 1; transform: translateX(0); background-color: transparent; }
    }

    @media (prefers-reduced-motion: reduce) {
      tr.row--entered { animation: none; }
    }
  `;

  @property({ type: Array }) entries: FirehoseEntry[] = [];
  @property({ type: Number }) maxRows = DEFAULT_MAX_ROWS;
  @property({ type: Boolean }) loading = false;

  /** Rows most recently added — used to trigger entrance animation. */
  @state() private _recentIds = new Set<string>();

  private _lastSeen = new Set<string>();

  updated(changed: Map<string, unknown>): void {
    if (!changed.has('entries')) return;
    const current = new Set(this.entries.map((e) => e.id));
    const freshlyAdded = new Set<string>();
    for (const id of current) {
      if (!this._lastSeen.has(id)) freshlyAdded.add(id);
    }
    if (freshlyAdded.size > 0) {
      this._recentIds = freshlyAdded;
      // Clear the animation flag after animation completes so repeated
      // renders don't re-trigger it.
      window.setTimeout(() => {
        this._recentIds = new Set();
      }, 500);
    }
    this._lastSeen = current;
  }

  private _formatTime(iso: string): string {
    try {
      const dt = new Date(iso);
      return dt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch (err) {
      captureError(err, { source: 'VelgFirehoseStream._formatTime' });
      return iso;
    }
  }

  private _formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  }

  private _shortId(id: string | null): string {
    if (!id) return '—';
    return id.slice(0, 8);
  }

  protected render() {
    const visible = [...this.entries]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, this.maxRows);

    if (visible.length === 0) {
      return html`
        <div class="empty">
          ${this.loading ? msg('loading firehose…') : msg('No AI calls recorded yet.')}
        </div>
      `;
    }

    return html`
      <table role="log" aria-live="polite" aria-label=${msg('AI call firehose')}>
        <thead>
          <tr>
            <th scope="col">${msg('Time')}</th>
            <th scope="col">${msg('Purpose')}</th>
            <th scope="col">${msg('Model')}</th>
            <th scope="col" class="num">${msg('Tokens')}</th>
            <th scope="col" class="num">${msg('Cost')}</th>
            <th scope="col">${msg('Sim')}</th>
            <th scope="col">${msg('User')}</th>
            <th scope="col">${msg('Status')}</th>
          </tr>
        </thead>
        <tbody>
          ${visible.map(
            (e) => html`
              <tr
                class=${`row ${this._recentIds.has(e.id) ? 'row--entered' : ''} ${e.status === 'error' ? 'row--error' : ''}`}
              >
                <td>${this._formatTime(e.created_at)}</td>
                <td>${e.purpose}</td>
                <td>${e.model}</td>
                <td class="num">${this._formatTokens(e.total_tokens)}</td>
                <td class="num">$${e.estimated_cost_usd.toFixed(4)}</td>
                <td>
                  ${
                    e.simulation_id
                      ? html`<velg-redacted label=${msg('simulation id')}
                        >${this._shortId(e.simulation_id)}</velg-redacted
                      >`
                      : html`<span aria-label=${msg('platform call')}>·</span>`
                  }
                </td>
                <td>
                  ${
                    e.user_id
                      ? html`<velg-redacted label=${msg('user id')}
                        >${this._shortId(e.user_id)}</velg-redacted
                      >`
                      : html`<span aria-label=${msg('background task')}>·</span>`
                  }
                </td>
                <td>
                  <span class=${`badge badge--${e.status === 'error' ? 'error' : 'ok'}`}>
                    ${e.status}
                  </span>
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-firehose-stream': VelgFirehoseStream;
  }
}
