/**
 * Lightweight Lit wrapper for Apache ECharts.
 * Works inside Shadow DOM — uses a div container for `echarts.init()`.
 * Responds to resize via ResizeObserver and respects prefers-reduced-motion.
 */

import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, HeatmapChart, LineChart, RadarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

/** Custom dark theme matching the military-console HTP aesthetic. */
const TACTICAL_THEME: Record<string, unknown> = {
  color: [
    '#d4a24e', // Speranza amber
    '#6bcb77', // Gaslit Reach green
    '#e74c3c', // Velgarien red
    '#a78bfa', // Nova Meridian purple
    '#67e8f9', // Station Null cyan
  ],
  backgroundColor: 'transparent',
  textStyle: { color: '#a0aec0', fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
  title: { textStyle: { color: '#cbd5e1' }, subtextStyle: { color: '#64748b' } },
  legend: { textStyle: { color: '#94a3b8' } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { lineStyle: { color: '#334155' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
  },
  radar: {
    axisName: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#1e293b' } },
    splitArea: { areaStyle: { color: ['transparent', 'rgba(30, 41, 59, 0.3)'] } },
    axisLine: { lineStyle: { color: '#334155' } },
  },
  tooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: '#334155',
    textStyle: { color: '#e2e8f0' },
  },
};

echarts.use([
  BarChart, LineChart, HeatmapChart, RadarChart, CustomChart,
  GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, RadarComponent,
  CanvasRenderer,
]);

echarts.registerTheme('tactical', TACTICAL_THEME);

@customElement('velg-echarts-chart')
export class EchartsChart extends LitElement {
  static styles = css`
		:host {
			display: block;
			width: 100%;
		}
		.chart-container {
			width: 100%;
			height: var(--chart-height, 300px);
		}
	`;

  @property({ type: Object }) option: EChartsOption = {};
  @property({ type: String }) height = '300px';
  @property({ type: String, attribute: 'aria-label' }) ariaLabel = 'Chart';

  @query('.chart-container') private _container!: HTMLDivElement;
  private _chart: echarts.ECharts | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  private get _reducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  override firstUpdated(): void {
    if (!this._container) return;
    this._chart = echarts.init(this._container, 'tactical', { renderer: 'canvas' });
    this._applyOption();

    this._resizeObserver = new ResizeObserver(() => {
      this._chart?.resize();
    });
    this._resizeObserver.observe(this._container);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('option')) {
      this._applyOption();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._chart?.dispose();
    this._chart = null;
  }

  private _applyOption(): void {
    if (!this._chart || !this.option) return;
    const opts = this._reducedMotion ? { ...this.option, animation: false } : this.option;
    this._chart.setOption(opts, true);
  }

  override render() {
    return html`<div class="chart-container" role="img" aria-label=${this.ariaLabel} style="--chart-height: ${this.height}"></div>`;
  }
}
