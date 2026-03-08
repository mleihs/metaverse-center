import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Event as SimEvent } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

const RANGE_OPTIONS = [30, 90, 180, 365] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

const SVG_HEIGHT = 120;
const SVG_PADDING_TOP = 10;
const SVG_PADDING_BOTTOM = 24;
const SPIKE_AREA = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM;
const AXIS_Y = SVG_HEIGHT - SVG_PADDING_BOTTOM;

@localized()
@customElement('velg-event-seismograph')
export class VelgEventSeismograph extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .seismo {
      background: var(--color-surface-sunken);
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .seismo__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .seismo__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .seismo__ranges {
      display: flex;
      gap: 2px;
    }

    .seismo__range-btn {
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background var(--duration-fast, 100ms),
        color var(--duration-fast, 100ms),
        border-color var(--duration-fast, 100ms);
    }

    .seismo__range-btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border-focus);
    }

    .seismo__range-btn:focus-visible {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .seismo__range-btn--active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .seismo__range-btn--active:hover {
      color: var(--color-text-inverse);
    }

    /* SVG container */
    .seismo__chart {
      width: 100%;
      height: ${SVG_HEIGHT}px;
      cursor: crosshair;
      user-select: none;
      -webkit-user-select: none;
    }

    .seismo__chart:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    /* Spike pulse for escalating events */
    @keyframes spike-escalate {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .seismo__spike--escalating {
      animation: spike-escalate 1.2s ease-in-out infinite;
    }

    .seismo__spike--resonance {
      animation: spike-resonance 2s ease-in-out infinite;
    }

    @keyframes spike-resonance {
      0%, 100% { opacity: 1; filter: none; }
      50% { opacity: 0.7; filter: drop-shadow(0 0 3px var(--color-danger)); }
    }

    @media (prefers-reduced-motion: reduce) {
      .seismo__spike--escalating,
      .seismo__spike--resonance {
        animation: none;
      }
    }

    /* Text fallback */
    .seismo__summary {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .seismo__summary-highlight {
      color: var(--color-text-secondary);
    }

    .seismo__brush-hint {
      font-style: normal;
      color: var(--color-text-muted);
      opacity: 0.7;
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Array }) events: SimEvent[] = [];

  @state() private _rangeDays: RangeDays = 90;
  @state() private _brushing = false;
  @state() private _brushStartX: number | null = null;
  @state() private _brushEndX: number | null = null;
  @state() private _svgWidth = 600;
  @state() private _brushActive = false;

  private _resizeObserver: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this._svgWidth = entry.contentRect.width;
      }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  protected firstUpdated(): void {
    const chart = this.renderRoot.querySelector('.seismo__chart');
    if (chart) {
      this._resizeObserver?.observe(chart);
      // Defer width measurement to avoid triggering update during update
      requestAnimationFrame(() => {
        this._svgWidth = chart.getBoundingClientRect().width;
      });
    }
  }

  // -- Computed --

  private get _rangeStart(): Date {
    const d = new Date();
    d.setDate(d.getDate() - this._rangeDays);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private get _rangeEnd(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private get _filteredEvents(): SimEvent[] {
    const start = this._rangeStart.getTime();
    const end = this._rangeEnd.getTime();
    return this.events.filter((e) => {
      if (!e.occurred_at) return false;
      const t = new Date(e.occurred_at).getTime();
      return t >= start && t <= end;
    });
  }

  private get _brushedEvents(): SimEvent[] {
    if (!this._brushActive || this._brushStartX === null || this._brushEndX === null) {
      return this._filteredEvents;
    }
    const dateFrom = this._xToDate(Math.min(this._brushStartX, this._brushEndX));
    const dateTo = this._xToDate(Math.max(this._brushStartX, this._brushEndX));
    return this._filteredEvents.filter((e) => {
      const t = new Date(e.occurred_at).getTime();
      return t >= dateFrom.getTime() && t <= dateTo.getTime();
    });
  }

  private get _highestImpact(): number {
    const evts = this._brushActive ? this._brushedEvents : this._filteredEvents;
    return evts.reduce((max, e) => Math.max(max, e.impact_level ?? 1), 0);
  }

  // -- Coordinate helpers --

  private _padding = 40; // left padding for y-axis labels

  private _dateToX(date: Date): number {
    const start = this._rangeStart.getTime();
    const end = this._rangeEnd.getTime();
    const ratio = (date.getTime() - start) / (end - start);
    return this._padding + ratio * (this._svgWidth - this._padding - 8);
  }

  private _xToDate(x: number): Date {
    const start = this._rangeStart.getTime();
    const end = this._rangeEnd.getTime();
    const ratio = (x - this._padding) / (this._svgWidth - this._padding - 8);
    return new Date(start + ratio * (end - start));
  }

  private _impactToY(impact: number): number {
    return AXIS_Y - (impact / 10) * SPIKE_AREA;
  }

  private _getSpikeColor(event: SimEvent): string {
    const level = event.impact_level ?? 1;
    if (level >= 8) return 'var(--color-danger)';
    if (level >= 5) return 'var(--color-warning)';
    return 'var(--color-primary)';
  }

  // -- Brush interaction --

  private _handleMouseDown(e: MouseEvent): void {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    this._brushing = true;
    this._brushStartX = x;
    this._brushEndX = x;
    this._brushActive = false;
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._brushing) return;
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    this._brushEndX = e.clientX - rect.left;
  }

  private _handleMouseUp(): void {
    if (!this._brushing) return;
    this._brushing = false;

    if (
      this._brushStartX !== null &&
      this._brushEndX !== null &&
      Math.abs(this._brushEndX - this._brushStartX) > 5
    ) {
      this._brushActive = true;
      const dateFrom = this._xToDate(Math.min(this._brushStartX, this._brushEndX));
      const dateTo = this._xToDate(Math.max(this._brushStartX, this._brushEndX));
      this.dispatchEvent(
        new CustomEvent('seismograph-brush', {
          detail: {
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _handleDblClick(): void {
    this._brushStartX = null;
    this._brushEndX = null;
    this._brushActive = false;
    this.dispatchEvent(
      new CustomEvent('seismograph-clear', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleRangeChange(days: RangeDays): void {
    this._rangeDays = days;
    // Clear brush on range change
    this._brushStartX = null;
    this._brushEndX = null;
    this._brushActive = false;
    this.dispatchEvent(
      new CustomEvent('seismograph-clear', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // -- SVG rendering --

  private _renderGridLines() {
    const lines = [];

    // Choose interval based on range
    let intervalDays: number;
    if (this._rangeDays <= 30) intervalDays = 7;
    else if (this._rangeDays <= 90) intervalDays = 14;
    else if (this._rangeDays <= 180) intervalDays = 30;
    else intervalDays = 60;

    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    const start = this._rangeStart.getTime();
    const end = this._rangeEnd.getTime();

    // Vertical grid lines with date labels
    for (let t = start; t <= end; t += intervalMs) {
      const date = new Date(t);
      const x = this._dateToX(date);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      lines.push(svg`
        <line
          x1=${x} y1=${SVG_PADDING_TOP}
          x2=${x} y2=${AXIS_Y}
          stroke="var(--color-border-light)" stroke-width="1"
          stroke-dasharray="2,4"
        />
        <text
          x=${x} y=${SVG_HEIGHT - 4}
          fill="var(--color-text-muted)"
          font-family="var(--font-brutalist)"
          font-size="9"
          font-weight="bold"
          text-anchor="middle"
          letter-spacing="0.5"
        >${label}</text>
      `);
    }

    // Horizontal grid lines (impact levels 5 and 8)
    for (const level of [5, 8]) {
      const y = this._impactToY(level);
      lines.push(svg`
        <line
          x1=${this._padding} y1=${y}
          x2=${this._svgWidth - 8} y2=${y}
          stroke="var(--color-border-light)" stroke-width="1"
          stroke-dasharray="4,4"
        />
        <text
          x=${this._padding - 6} y=${y + 3}
          fill="var(--color-text-muted)"
          font-family="var(--font-brutalist)"
          font-size="9"
          font-weight="bold"
          text-anchor="end"
        >${level}</text>
      `);
    }

    // Base axis
    lines.push(svg`
      <line
        x1=${this._padding} y1=${AXIS_Y}
        x2=${this._svgWidth - 8} y2=${AXIS_Y}
        stroke="var(--color-border)" stroke-width="2"
      />
    `);

    return lines;
  }

  private _renderPressureOverlay() {
    const events = this._filteredEvents;
    if (events.length === 0) return null;

    // Sort by occurred_at
    const sorted = [...events].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );

    // Build pressure path — cumulative impact over a rolling 7-day window
    const points: string[] = [];
    const windowMs = 7 * 24 * 60 * 60 * 1000;

    // Sample at regular intervals
    const numSamples = Math.min(100, this._svgWidth / 4);
    const start = this._rangeStart.getTime();
    const end = this._rangeEnd.getTime();
    const step = (end - start) / numSamples;

    points.push(`${this._padding},${AXIS_Y}`);

    for (let i = 0; i <= numSamples; i++) {
      const sampleTime = start + i * step;
      const windowStart = sampleTime - windowMs;

      let pressure = 0;
      for (const evt of sorted) {
        const t = new Date(evt.occurred_at).getTime();
        if (t > windowStart && t <= sampleTime) {
          pressure += Math.pow((evt.impact_level ?? 1) / 10.0, 1.5);
        }
      }

      // Normalize: cap at 15 (matches the MV denominator)
      const normalizedPressure = Math.min(pressure / 15.0, 1.0);
      const x = this._padding + (i / numSamples) * (this._svgWidth - this._padding - 8);
      const y = AXIS_Y - normalizedPressure * SPIKE_AREA;
      points.push(`${x},${y}`);
    }

    points.push(`${this._svgWidth - 8},${AXIS_Y}`);

    return svg`
      <polygon
        points=${points.join(' ')}
        fill="var(--color-danger)"
        opacity="0.08"
      />
    `;
  }

  private _renderSpikes() {
    const events = this._filteredEvents;

    return events.map((evt) => {
      const date = new Date(evt.occurred_at);
      const x = this._dateToX(date);
      const impact = evt.impact_level ?? 1;
      const y = this._impactToY(impact);
      const color = this._getSpikeColor(evt);
      const isBleed = evt.data_source === 'bleed';
      const isCascade = evt.data_source === 'cascade';
      const isResonance = evt.data_source === 'resonance';
      const isEscalating = evt.event_status === 'escalating';

      const spikeClass = isEscalating ? 'seismo__spike--escalating' : isResonance ? 'seismo__spike--resonance' : '';
      const spikeColor = isCascade
        ? 'var(--color-epoch-influence, var(--color-warning))'
        : isResonance
          ? 'var(--color-danger)'
          : color;
      const dashArray = isBleed ? '4,3' : isCascade ? '6,4' : '';
      const sourceLabel = isCascade ? ` [${msg('Cascade')}]` : isResonance ? ` [${msg('Resonance')}]` : '';

      return svg`
        <g
          class=${spikeClass}
          tabindex="0"
          role="img"
          aria-label=${`${t(evt, 'title')}: ${msg('impact')} ${impact}, ${evt.event_type ?? ''}${sourceLabel}`}
        >
          ${isResonance ? svg`
            <circle cx=${x} cy=${y} r="8" fill="none"
              stroke="var(--color-danger)" stroke-width="1" opacity="0.3">
              <animate attributeName="r" from="4" to="12" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
          ` : nothing}
          <line
            x1=${x} y1=${AXIS_Y}
            x2=${x} y2=${y}
            stroke=${spikeColor}
            stroke-width=${isResonance ? '3' : isCascade ? '2' : '3'}
            ${dashArray ? svg`stroke-dasharray=${dashArray}` : nothing}
          />
          ${isResonance ? svg`
            <polygon
              points="${x - 4},${y + 4} ${x},${y - 2} ${x + 4},${y + 4}"
              fill=${spikeColor}
              stroke=${spikeColor}
              stroke-width="1"
            />
          ` : svg`
            <circle
              cx=${x} cy=${y}
              r=${isCascade ? '4' : '3'}
              fill=${isCascade ? 'none' : spikeColor}
              stroke=${spikeColor}
              stroke-width=${isCascade ? '2' : '1.5'}
            />
          `}
          <title>${t(evt, 'title')} — ${msg('impact')} ${impact}${sourceLabel}</title>
        </g>
      `;
    });
  }

  private _renderBrush() {
    if (this._brushStartX === null || this._brushEndX === null) return null;
    if (!this._brushing && !this._brushActive) return null;

    const x1 = Math.min(this._brushStartX, this._brushEndX);
    const x2 = Math.max(this._brushStartX, this._brushEndX);
    const width = x2 - x1;

    if (width < 2) return null;

    return svg`
      <rect
        x=${x1} y=${SVG_PADDING_TOP}
        width=${width} height=${AXIS_Y - SVG_PADDING_TOP}
        fill="var(--color-primary)"
        opacity="0.15"
        stroke="var(--color-primary)"
        stroke-width="1"
        stroke-dasharray="4,2"
      />
    `;
  }

  protected render() {
    const visibleEvents = this._brushActive ? this._brushedEvents : this._filteredEvents;
    const totalVisible = visibleEvents.length;
    const highest = this._highestImpact;

    return html`
      <div class="seismo">
        <div class="seismo__toolbar">
          <span class="seismo__label">${msg('Event Seismograph')}</span>
          <div class="seismo__ranges">
            ${RANGE_OPTIONS.map(
              (days) => html`
                <button
                  class="seismo__range-btn ${this._rangeDays === days ? 'seismo__range-btn--active' : ''}"
                  @click=${() => this._handleRangeChange(days)}
                >
                  ${msg(str`${days}d`)}
                </button>
              `,
            )}
          </div>
        </div>

        <svg
          class="seismo__chart"
          viewBox="0 0 ${this._svgWidth} ${SVG_HEIGHT}"
          preserveAspectRatio="none"
          role="img"
          aria-label=${msg(str`Event timeline: ${totalVisible} events over ${this._rangeDays} days, highest impact ${highest}`)}
          @mousedown=${this._handleMouseDown}
          @mousemove=${this._handleMouseMove}
          @mouseup=${this._handleMouseUp}
          @mouseleave=${() => { if (this._brushing) this._handleMouseUp(); }}
          @dblclick=${this._handleDblClick}
        >
          <desc>${msg(str`Timeline visualization showing ${totalVisible} events. Highest impact level: ${highest}.`)}</desc>
          ${this._renderGridLines()}
          ${this._renderPressureOverlay()}
          ${this._renderSpikes()}
          ${this._renderBrush()}
        </svg>

        <div class="seismo__summary">
          <span>
            <span class="seismo__summary-highlight">${totalVisible}</span>
            ${msg('events')}${highest > 0 ? html`, ${msg('peak impact')}: <span class="seismo__summary-highlight">${highest}</span>` : nothing}
          </span>
          <span class="seismo__brush-hint">
            ${this._brushActive ? msg('Double-click to clear selection') : msg('Click and drag to select range')}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-seismograph': VelgEventSeismograph;
  }
}
