/**
 * VelgHeatmapGrid — hour × key heatmap primitive (P2.6).
 *
 * Wraps ``<velg-echarts-chart>`` with a heatmap series preset configured
 * for Bureau-Ops cost attribution. Consumers pass a flat ``HeatmapCell[]``
 * plus a dimension label; the grid pivots into a (row = key) × (col =
 * hour) matrix and renders the cost_usd as color intensity.
 *
 * Interaction:
 *   - Hover shows a native ECharts tooltip with the full metric set.
 *   - BubbleUp cell-click drill-down is deferred until EchartsChart
 *     exposes a chart-click event; the shared wrapper does not emit
 *     interaction today and extending it is out of P2 scope.
 *
 * Aesthetic: ECharts is painted onto a black surface, amber-to-red
 * gradient for heat, dashed borders above/below the grid to match the
 * surrounding brutalist panel. No filters or transforms on :host so the
 * canvas stays addressable for ECharts' resize observer.
 */

import { localized, msg, str } from '@lit/localize';
import type { EChartsOption } from 'echarts';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HeatmapCell } from '../../services/api/BureauOpsApiService.js';
import { readCssToken } from '../../utils/css-tokens.js';
import './EchartsChart.js';

@localized()
@customElement('velg-heatmap-grid')
export class VelgHeatmapGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 280px;
    }

    .empty {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      padding: var(--space-6);
      text-align: center;
      font-style: italic;
      border: 1px dashed var(--color-border);
    }
  `;

  @property({ type: Array }) cells: HeatmapCell[] = [];

  /** Human label for the row axis (e.g. "Purpose", "Model", "Provider"). */
  @property({ type: String, attribute: 'dimension-label' }) dimensionLabel = 'Key';

  /**
   * Fixed chart height. Falls back to `clamp(280px, 40vh, 560px)` so the
   * grid can grow on large screens without breaking the admin layout.
   */
  @property({ type: String }) height = 'clamp(280px, 40vh, 560px)';

  // ECharts renders tooltip strings as HTML. Keys + hours come from DB
  // columns which are not operator-controlled today, but escaping here
  // keeps the primitive safe against any future source (user-owned
  // tags, purpose strings from admin UI, etc.).
  private _escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private _buildOption(): EChartsOption {
    const hours = [...new Set(this.cells.map((c) => c.hour))].sort();
    const keys = [...new Set(this.cells.map((c) => c.key))].sort();

    const hourIndex = new Map<string, number>(hours.map((h, i) => [h, i]));
    const keyIndex = new Map<string, number>(keys.map((k, i) => [k, i]));

    const heatmapData: number[][] = this.cells.map((c) => [
      hourIndex.get(c.hour) ?? 0,
      keyIndex.get(c.key) ?? 0,
      c.cost_usd,
    ]);

    const maxCost = Math.max(0, ...this.cells.map((c) => c.cost_usd));

    // Build a cheat-sheet keyed by "hour|key" so the tooltip can pull
    // tokens/calls without re-searching the cell array.
    const meta = new Map<string, HeatmapCell>(
      this.cells.map((c) => [`${c.hour}|${c.key}`, c]),
    );

    // Format hour label as "Mon 14:00" – wall-clock in the browser's
    // timezone keeps "yesterday at 3am" legible to European operators
    // without hard-coding a UTC offset.
    const hourLabel = (iso: string): string => {
      const d = new Date(iso);
      const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
      const time = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${weekday} ${time}`;
    };

    // Theme-adaptive cold→warm→hot gradient. Resolved from semantic
    // tokens so the heatmap follows the active theme preset (brutalist,
    // sunless-sea, cyberpunk, etc.) without edits.
    const gradient = [
      readCssToken(this,'--color-surface'),
      readCssToken(this,'--color-surface-raised'),
      readCssToken(this,'--color-success'),
      readCssToken(this,'--color-warning'),
      readCssToken(this,'--color-danger'),
    ].filter((c): c is string => Boolean(c));

    const emphasisGlow = readCssToken(this,'--color-primary');

    return {
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const raw = Array.isArray(params) ? params[0] : params;
          const dataPoint = (raw as { data?: [number, number, number] }).data;
          if (!dataPoint) return '';
          const [hi, ki] = dataPoint;
          const hour = hours[hi];
          const key = keys[ki];
          const cell = meta.get(`${hour}|${key}`);
          if (!cell) return '';
          return [
            `<strong>${this._escapeHtml(key)}</strong>`,
            this._escapeHtml(hourLabel(hour)),
            `$${cell.cost_usd.toFixed(4)}`,
            `${cell.calls.toLocaleString()} calls`,
            `${cell.tokens.toLocaleString()} tokens`,
          ].join('<br/>');
        },
      },
      grid: {
        left: 100,
        right: 30,
        top: 20,
        bottom: 80,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: {
          formatter: (v: string) => hourLabel(v),
          rotate: 45,
          fontSize: 10,
        },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: keys,
        axisLabel: { fontSize: 11 },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: Math.max(0.01, maxCost),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        textStyle: { fontSize: 10 },
        inRange: { color: gradient.length >= 2 ? gradient : undefined },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: { show: false },
          emphasis: emphasisGlow
            ? { itemStyle: { shadowBlur: 6, shadowColor: emphasisGlow } }
            : {},
        },
      ],
    };
  }

  protected render() {
    if (this.cells.length === 0) {
      return html`<div class="empty">${msg('No usage recorded in the selected window.')}</div>`;
    }
    const label = this.dimensionLabel
      ? msg(str`AI cost heatmap by ${this.dimensionLabel.toLowerCase()} and hour`)
      : msg('AI cost heatmap by hour and key');
    return html`
      <velg-echarts-chart
        .option=${this._buildOption()}
        aria-label=${label}
        height=${this.height}
      ></velg-echarts-chart>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-heatmap-grid': VelgHeatmapGrid;
  }
}
