/**
 * BurnRatePanel — 24-hour cost sparkline + last-hour burn-rate indicator (panel ②).
 *
 * Consumes the same LedgerSnapshot passed to LedgerPanel; AdminOpsTab
 * fetches once every 30s and forwards to both panels.
 *
 * Three visual elements:
 *   1. Last-hour cost — hero number.
 *   2. 24h sparkline — ECharts area chart, one point per hour.
 *   3. Burn-rate band — projected-daily vs current-day (simple lens).
 */

import { localized, msg } from '@lit/localize';
import type { EChartsOption } from 'echarts';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LedgerSnapshot } from '../../../services/api/BureauOpsApiService.js';
import { readCssToken } from '../../../utils/css-tokens.js';
import '../../shared/EchartsChart.js';
import '../../shared/VelgKineticCounter.js';

@localized()
@customElement('velg-ops-burn-rate-panel')
export class VelgOpsBurnRatePanel extends LitElement {
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
      opacity: 0.6;
    }

    .heading {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin-bottom: var(--space-4);
    }

    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-4);
      margin-bottom: var(--space-3);
    }

    .row__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .row__value {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-black);
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }

    .row__value--projection {
      color: var(--_accent);
    }

    .sparkline {
      margin-top: var(--space-3);
      border: 1px solid var(--color-border-light);
      padding: var(--space-2);
      background: var(--color-surface);
    }

    .empty {
      padding: var(--space-4);
      color: var(--color-text-muted);
      text-align: center;
      font-size: var(--text-sm);
    }

    velg-echarts-chart {
      --chart-height: 90px;
    }
  `;

  @property({ type: Object }) snapshot: LedgerSnapshot | null = null;
  @property({ type: Boolean }) loading = false;

  private _buildSparkline(snap: LedgerSnapshot): EChartsOption {
    const points = snap.hourly_trend.map((h) => Math.round(h.cost_usd * 10000) / 10000);
    // Resolve the accent at build time so the sparkline follows the
    // active theme preset. ECharts needs a literal string (no var() in
    // its color field); empty means "let ECharts pick a default".
    const accent = readCssToken(this, '--color-accent-amber');
    return {
      grid: { left: 4, right: 4, top: 4, bottom: 4 },
      xAxis: {
        type: 'category',
        show: false,
        boundaryGap: false,
        data: points.map((_, i) => String(i)),
      },
      yAxis: { type: 'value', show: false, min: 0 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || !params.length) return '';
          const p = params[0] as { value?: number };
          return `$${(p.value ?? 0).toFixed(4)}`;
        },
      },
      series: [
        {
          type: 'line',
          data: points,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.25 },
          ...(accent ? { color: accent } : {}),
        },
      ],
    };
  }

  private _projectionUsd(snap: LedgerSnapshot): number {
    // Naive: scale last-hour × 24. Replaced by ForecastService in P3.
    return snap.last_hour.cost_usd * 24;
  }

  protected render() {
    const s = this.snapshot;
    return html`
      <div class="heading">${msg('Burn rate // 24h')}</div>

      ${
        s
          ? html`
            <div class="row">
              <span class="row__label">${msg('Last hour')}</span>
              <span class="row__value">
                <velg-kinetic-counter
                  .value=${s.last_hour.cost_usd}
                  prefix="$"
                  .precision=${4}
                ></velg-kinetic-counter>
              </span>
            </div>
            <div class="row">
              <span class="row__label">${msg('Projected 24h (linear)')}</span>
              <span class="row__value row__value--projection">
                <velg-kinetic-counter
                  .value=${this._projectionUsd(s)}
                  prefix="$"
                  .precision=${2}
                ></velg-kinetic-counter>
              </span>
            </div>

            <div class="sparkline">
              ${
                s.hourly_trend.length > 0
                  ? html`<velg-echarts-chart
                    .option=${this._buildSparkline(s)}
                    aria-label=${msg('24-hour hourly cost trend')}
                    height="90px"
                  ></velg-echarts-chart>`
                  : html`<div class="empty">${msg('No hourly data yet.')}</div>`
              }
            </div>
          `
          : this.loading
            ? html`<div class="empty">${msg('loading…')}</div>`
            : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-burn-rate-panel': VelgOpsBurnRatePanel;
  }
}
