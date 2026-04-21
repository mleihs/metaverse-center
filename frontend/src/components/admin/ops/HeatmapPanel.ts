/**
 * HeatmapPanel — Bureau Ops 24×N cost heatmap (panel ⑦, P2.6).
 *
 * Reads from ``/admin/ops/heatmap`` (backed by the migration-229
 * materialized view) and renders an interactive grid where every cell
 * is one (hour, key) bucket and color encodes cost_usd.
 *
 * Controls:
 *   - Dimension switcher: purpose / model / provider. Purpose is the
 *     default because it maps to the feature flag an operator most
 *     often wants to kill when a runaway hits.
 *   - Window switcher: 1d / 7d / 14d / 30d. Seven days is the default
 *     — long enough to see a weekly cycle, short enough to keep the
 *     grid readable.
 *
 * Refresh cadence: 5 minutes, per plan §6.3. The MV refreshes every
 * 60s so a 5-minute client poll is never more than 5 min stale. A
 * ``reload()`` method is exposed for future parent-driven refresh.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  bureauOpsApi,
  type HeatmapCell,
  type HeatmapDimension,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import '../../shared/VelgHeatmapGrid.js';

const REFRESH_MS = 5 * 60 * 1000;
const DAYS_OPTIONS: readonly { value: number; label: () => string }[] = [
  { value: 1, label: () => msg('1d') },
  { value: 7, label: () => msg('7d') },
  { value: 14, label: () => msg('14d') },
  { value: 30, label: () => msg('30d') },
];
const DIMENSION_OPTIONS: readonly { value: HeatmapDimension; label: () => string }[] = [
  { value: 'purpose', label: () => msg('Purpose') },
  { value: 'model', label: () => msg('Model') },
  { value: 'provider', label: () => msg('Provider') },
];

@localized()
@customElement('velg-ops-heatmap-panel')
export class VelgOpsHeatmapPanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-info);
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
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-2);
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

    .controls {
      display: flex;
      gap: var(--space-3);
    }

    .group {
      display: inline-flex;
      gap: 0;
      border: 1px solid var(--color-border);
    }

    .group__btn {
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

    .group__btn:first-child {
      border-left: 0;
    }

    .group__btn:hover:not([aria-pressed='true']),
    .group__btn:focus-visible:not([aria-pressed='true']) {
      background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
      color: var(--color-text-primary);
      outline: none;
    }

    .group__btn[aria-pressed='true'] {
      background: var(--_accent);
      color: var(--color-text-inverse);
    }

    .error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      margin-bottom: var(--space-3);
    }

    .loading {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      padding: var(--space-6);
      text-align: center;
      font-style: italic;
      border: 1px dashed var(--color-border);
    }

    @media (max-width: 600px) {
      .heading {
        flex-direction: column;
        align-items: flex-start;
      }
      .controls {
        flex-wrap: wrap;
      }
    }
  `;

  @state() private _cells: HeatmapCell[] = [];
  @state() private _dimension: HeatmapDimension = 'purpose';
  @state() private _days = 7;
  @state() private _loading = true;
  @state() private _error: string | null = null;

  private _timer: number | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetch();
    this._timer = window.setInterval(() => void this._fetch(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  private async _fetch(): Promise<void> {
    // Only show the "Loading heatmap" skeleton on the first fetch or
    // when the current result set is empty. Background polls keep the
    // previous grid visible so a 5-minute refresh never flickers the
    // whole panel to a spinner — same pattern as the existing ledger
    // + circuit polls in AdminOpsTab.
    if (this._cells.length === 0) {
      this._loading = true;
    }
    const resp = await bureauOpsApi.getHeatmap(this._days, this._dimension);
    if (resp.success) {
      this._cells = resp.data;
      this._error = null;
    } else {
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'HeatmapPanel._fetch',
        code: resp.error.code,
      });
    }
    this._loading = false;
  }

  private _selectDimension(dimension: HeatmapDimension): void {
    if (dimension === this._dimension) return;
    this._dimension = dimension;
    void this._fetch();
  }

  private _selectDays(days: number): void {
    if (days === this._days) return;
    this._days = days;
    void this._fetch();
  }

  private _dimensionLabel(): string {
    return DIMENSION_OPTIONS.find((d) => d.value === this._dimension)?.label() ?? '';
  }

  protected render() {
    return html`
      <div class="heading">
        <span class="heading__label">${msg('Cost heatmap // hour × key')}</span>
        <div class="controls">
          <div class="group" role="group" aria-label=${msg('Dimension')}>
            ${DIMENSION_OPTIONS.map(
              (opt) => html`
                <button
                  type="button"
                  class="group__btn"
                  aria-pressed=${this._dimension === opt.value}
                  @click=${() => this._selectDimension(opt.value)}
                >
                  ${opt.label()}
                </button>
              `,
            )}
          </div>
          <div class="group" role="group" aria-label=${msg('Window')}>
            ${DAYS_OPTIONS.map(
              (opt) => html`
                <button
                  type="button"
                  class="group__btn"
                  aria-pressed=${this._days === opt.value}
                  @click=${() => this._selectDays(opt.value)}
                >
                  ${opt.label()}
                </button>
              `,
            )}
          </div>
        </div>
      </div>

      ${
        this._error ? html`<div class="error">${msg('Heatmap failed:')} ${this._error}</div>` : null
      }

      ${
        this._loading && this._cells.length === 0
          ? html`<div class="loading">${msg('Loading heatmap')}</div>`
          : html`<velg-heatmap-grid
            .cells=${this._cells}
            dimension-label=${this._dimensionLabel()}
          ></velg-heatmap-grid>`
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-heatmap-panel': VelgOpsHeatmapPanel;
  }
}
