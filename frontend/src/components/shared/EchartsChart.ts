/**
 * Lightweight Lit wrapper for Apache ECharts.
 * Works inside Shadow DOM — uses a div container for `echarts.init()`.
 * Responds to resize via ResizeObserver and respects prefers-reduced-motion.
 */

import type { EChartsOption } from 'echarts';
import { BarChart, CustomChart, HeatmapChart, LineChart, RadarChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

/**
 * Die Serienfarben — eine Welt ist immer derselbe Farbton, aber nicht immer
 * dieselbe Helligkeit.
 *
 * DAS PROBLEM, GEMESSEN
 *   Die fuenf Toene waren fuer einen schwarzen Grund gewaehlt und stehen dort
 *   zwischen 5,2 und 13,7 : 1. Auf dem Papiergrund messen VIER von fuenf unter
 *   der 3-:-1-Schwelle fuer nicht-textliche Elemente:
 *
 *     Station Null   #67e8f9   13,66 auf dunkel   1,23 auf Papier
 *     Gaslit Reach   #6bcb77    9,84              1,70
 *     Speranza       #d4a24e    8,56              1,96
 *     Nova Meridian  #a78bfa    7,27              2,30
 *     Velgarien      #e74c3c    5,18              3,23  (haelt als einzige)
 *
 *   Ein Balken bei 1,23 ist auf Papier keine schwache Farbe, sondern keine.
 *
 * WAS SICH AENDERT UND WAS NICHT
 *   Der FARBTON bleibt bei allen fuenf exakt gleich (38° · 128° · 6° · 255° ·
 *   187°) — er ist die Identitaet der Welt und traegt die Wiedererkennung ueber
 *   Diagramme, Karten und Abzeichen hinweg. Nur die Helligkeit sinkt, und zwar
 *   auf den HELLSTEN Wert, der noch 3 : 1 haelt: ein Ton, keine neue Farbe.
 *
 *   Auf dunklem Grund bleibt alles unveraendert.
 */
const SERIES_DARK = [
  '#d4a24e', // Speranza amber
  '#6bcb77', // Gaslit Reach green
  '#e74c3c', // Velgarien red
  '#a78bfa', // Nova Meridian purple
  '#67e8f9', // Station Null cyan
];

/** Dieselben fuenf Farbtoene, abgedunkelt bis 3 : 1 gegen Papier. */
const SERIES_LIGHT = [
  '#b07d27', // Speranza    38°  3,06
  '#339b41', // Gaslit      128° 3,01
  '#ec5444', // Velgarien     6° 3,00
  '#7042fa', // Nova        255° 4,61
  '#0494a7', // Station     187° 3,06
];

/**
 * Das Diagramm-Chrome kommt aus den lebenden Tokens, nicht aus einer Konstante.
 *
 * WARUM DAS NOETIG WURDE
 *   Bis zum 03.09.2026 war das Theme eine Modulkonstante, einmal registriert
 *   und fest auf Dunkel: Text #a0aec0, Beschriftungen #94a3b8, Achsen #334155,
 *   Gitter #1e293b, Tooltip in Schiefer. Auf dem Papiergrund des Atlas-Skins
 *   misst #94a3b8 **2,17 : 1** — jede Achsenbeschriftung, jede Legende, jeder
 *   Achsenname unlesbar, und zwar in allen Diagrammen der Plattform auf einmal.
 *
 *   Dasselbe galt vorher schon fuer jede HELLE Simulationswelt. Der Skin hat
 *   den Fehler nicht verursacht, er hat ihn sichtbar gemacht.
 *
 * WARUM AUS DEM ELEMENT UND NICHT AUS :root
 *   Ein Diagramm steht in der Huelle einer Welt, und die Welt setzt ihre Tokens
 *   auf ihrem eigenen Wirt. `getComputedStyle(el)` liefert genau das, was an
 *   DIESER Stelle gilt — die Palette der Welt, wenn es in einer steht, sonst
 *   die der Plattform.
 *
 * DIE REIHENFOLGE DER SERIEN BLEIBT FEST
 *   Die fuenf Serienfarben sind Identitaeten (eine Welt ist immer derselbe
 *   Ton), keine Chrome-Farben. Sie stehen deshalb weiter als Hexwerte da. Auf
 *   hellem Grund sind einige davon schwach (das Gruen misst rund 1,8) — das ist
 *   eine eigene Frage nach einer Serienpalette fuer helle Gruende und in der
 *   Uebergabe als offener Punkt vermerkt, nicht hier still entschieden.
 */
function chartTheme(el: HTMLElement): Record<string, unknown> {
  const cs = getComputedStyle(el);
  const light = cs.getPropertyValue('--theme-polarity').trim() === '1';
  const t = (name: string, fallback: string): string =>
    cs.getPropertyValue(name).trim() || fallback;

  const text = t('--color-text-primary', '#e2e8f0');
  const muted = t('--color-text-muted', '#94a3b8');
  const line = t('--color-border', '#334155');
  const grid = t('--color-border-light', '#1e293b');
  const surface = t('--color-surface-raised', 'rgba(15, 23, 42, 0.95)');
  const mono = t('--font-mono', '"JetBrains Mono", "Fira Code", monospace');

  return {
    color: light ? SERIES_LIGHT : SERIES_DARK,
    backgroundColor: 'transparent',
    textStyle: { color: muted, fontFamily: mono },
    title: { textStyle: { color: text }, subtextStyle: { color: muted } },
    legend: { textStyle: { color: muted } },
    categoryAxis: {
      axisLine: { lineStyle: { color: line } },
      axisTick: { lineStyle: { color: line } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: grid } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: line } },
      axisTick: { lineStyle: { color: line } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: grid } },
    },
    radar: {
      axisName: { color: muted },
      splitLine: { lineStyle: { color: grid } },
      splitArea: { areaStyle: { color: ['transparent', grid] } },
      axisLine: { lineStyle: { color: line } },
    },
    tooltip: {
      backgroundColor: surface,
      borderColor: line,
      textStyle: { color: text },
    },
  };
}

/**
 * Der Fingerabdruck des Chrome — woran erkannt wird, dass neu gebaut werden muss.
 *
 * ECharts kann das Theme einer laufenden Instanz nicht wechseln; ein Wechsel
 * heisst dispose und neu aufsetzen. Das darf nicht bei jedem Update passieren,
 * aber es MUSS passieren, wenn die Palette sich geaendert hat — und das kann
 * ein Skin-Wechsel sein, ein Wechsel der Welt oder ein Theme, das der Architekt
 * gerade in der Dunkelkammer umstellt. Statt drei Ursachen zu beobachten,
 * vergleicht der Fingerabdruck die WIRKUNG.
 */
function themeKey(el: HTMLElement): string {
  const cs = getComputedStyle(el);
  return [
    '--color-text-primary',
    '--color-text-muted',
    '--color-border',
    '--color-border-light',
    '--color-surface-raised',
  ]
    .map((n) => cs.getPropertyValue(n).trim())
    .join('|');
}

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  RadarChart,
  CustomChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  RadarComponent,
  CanvasRenderer,
]);

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

  /** Der Fingerabdruck der Palette, mit der die laufende Instanz gebaut wurde. */
  private _themeKey = '';

  override firstUpdated(): void {
    if (!this._container) return;
    this._init();

    this._resizeObserver = new ResizeObserver(() => {
      this._chart?.resize();
    });
    this._resizeObserver.observe(this._container);
  }

  override updated(changed: Map<string, unknown>): void {
    if (!this._container) return;

    /*
     * Hat sich die Palette geaendert, wird neu aufgesetzt — ECharts kann das
     * Theme einer laufenden Instanz nicht wechseln. Der Vergleich steht VOR der
     * Option-Pruefung, weil _init die Option ohnehin neu anwendet und beides
     * sonst zweimal liefe.
     */
    if (themeKey(this) !== this._themeKey) {
      this._chart?.dispose();
      this._chart = null;
      this._init();
      return;
    }

    if (changed.has('option')) {
      this._applyOption();
    }
  }

  private _init(): void {
    if (!this._container) return;
    this._themeKey = themeKey(this);
    this._chart = echarts.init(this._container, chartTheme(this), { renderer: 'canvas' });
    this._applyOption();
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
