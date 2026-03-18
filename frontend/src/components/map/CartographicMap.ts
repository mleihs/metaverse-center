import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MapLayer } from './MapLayerToggle.js';

export interface ZoneTopology {
  zone_id: string;
  zone_name: string;
  zone_type: string;
  stability: number;
  stability_label: string;
  building_count: number;
  security_level: string;
  x: number;
  y: number;
}

interface BuildingMarker {
  x: number;
  y: number;
  shape: 'rect' | 'tri' | 'circle';
  size: number;
  delay: number;
}

interface GeneratedZone {
  zone: ZoneTopology;
  path: string;
  fillColor: string;
  hoverColor: string;
  borderColor: string;
  unstable: boolean;
  buildings: BuildingMarker[];
  labelAngle: number;
  drawDelay: number;
}

/**
 * SVG cartographic map core — Bureau of Impossible Geography field survey.
 *
 * Procedurally generated organic zone territories with Catmull-Rom smoothed
 * irregular polygons, multi-layer SVG rendering, terrain hatch patterns,
 * stability color washes, self-drawing animation, building symbol scattering,
 * coordinate grid, edge vignette, and classification stamps.
 */
@localized()
@customElement('velg-cartographic-map')
export class CartographicMap extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .map-svg {
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    .map-svg:active {
      cursor: grabbing;
    }

    /* ── Zone fills ──────────────────────────── */

    .zone-fill {
      transition: fill 0.25s ease, opacity 0.25s ease;
      cursor: pointer;
      opacity: 0;
      animation: zone-reveal 0.6s ease forwards;
    }

    .zone-fill:hover {
      fill: var(--zone-hover) !important;
    }

    @keyframes zone-reveal {
      to {
        opacity: 1;
      }
    }

    /* ── Zone terrain pattern overlay ────────── */

    .zone-terrain {
      pointer-events: none;
      opacity: 0;
      animation: zone-reveal 0.8s ease forwards;
    }

    /* ── Zone borders ────────────────────────── */

    .zone-border {
      fill: none;
      stroke-width: 1.2;
      stroke-dasharray: 3000;
      stroke-dashoffset: 3000;
      animation: draw-border var(--draw-dur, 3s) cubic-bezier(0.22, 1, 0.36, 1) var(--draw-del, 0s) forwards;
      pointer-events: none;
    }

    @keyframes draw-border {
      to {
        stroke-dashoffset: 0;
      }
    }

    /* ── Zone border glow (subtle, under border) */

    .zone-border-glow {
      fill: none;
      stroke-width: 4;
      opacity: 0;
      animation: zone-reveal 1s ease 0.5s forwards;
      pointer-events: none;
    }

    /* ── Instability shimmer ─────────────────── */

    .zone-unstable {
      pointer-events: none;
      animation: instability-pulse 2.5s ease-in-out infinite;
    }

    @keyframes instability-pulse {
      0%,
      100% {
        opacity: 0.06;
      }
      50% {
        opacity: 0.18;
      }
    }

    /* ── Building symbols ────────────────────── */

    .building-marker {
      opacity: 0;
      animation: stamp-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      pointer-events: none;
    }

    @keyframes stamp-in {
      0% {
        opacity: 0;
        transform: scale(3);
      }
      70% {
        transform: scale(0.85);
      }
      100% {
        opacity: 0.6;
        transform: scale(1);
      }
    }

    /* ── Zone labels ─────────────────────────── */

    .zone-name {
      font-family: var(--font-prose, 'Spectral', serif);
      font-style: italic;
      fill: var(--color-text-primary);
      opacity: 0;
      animation: label-float 0.5s ease forwards;
      pointer-events: none;
    }

    .zone-stat {
      font-family: var(--font-mono, monospace);
      font-size: 7px;
      fill: var(--color-text-muted);
      opacity: 0;
      animation: label-float 0.5s ease forwards;
      pointer-events: none;
    }

    @keyframes label-float {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Grid overlay ────────────────────────── */

    .grid-line {
      stroke: var(--color-text-muted);
      stroke-width: 0.3;
      opacity: 0.06;
    }

    .grid-label {
      font-family: var(--font-mono, monospace);
      font-size: 6px;
      fill: var(--color-text-muted);
      opacity: 0.12;
    }

    /* ── Route connections ────────────────────── */

    .route-line {
      fill: none;
      stroke: var(--color-border);
      stroke-width: 0.6;
      stroke-dasharray: 3 6;
      opacity: 0.25;
      pointer-events: none;
    }

    /* ── Bureau classification stamps ────────── */

    .bureau-stamp {
      opacity: 0;
      animation: stamp-in 0.3s ease 4s forwards;
    }

    .stamp-border {
      fill: none;
      stroke: rgba(220, 38, 38, 0.6);
      stroke-width: 1.2;
    }

    .stamp-text {
      font-family: var(--font-mono, monospace);
      font-size: 5px;
      font-weight: 700;
      fill: rgba(220, 38, 38, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    /* ── Focus states ────────────────────────── */

    .zone-fill:focus-visible {
      outline: none;
    }

    .zone-fill:focus-visible + .zone-border {
      stroke-width: 2.5;
      filter: drop-shadow(0 0 4px currentColor);
    }

    /* ── SR only ─────────────────────────────── */

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ── Bleed layer ─────────────────────────── */

    .bleed-wash {
      mix-blend-mode: screen;
      opacity: 0.12;
      pointer-events: none;
    }

    /* ── Military hatch ──────────────────────── */

    .security-hatch {
      stroke: var(--color-text-muted);
      stroke-width: 0.3;
      opacity: 0.15;
      pointer-events: none;
    }

    /* ── Reduced motion ──────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .zone-fill,
      .zone-terrain,
      .zone-border-glow {
        opacity: 1;
        animation: none;
      }

      .zone-border {
        stroke-dashoffset: 0;
        animation: none;
      }

      .zone-unstable {
        animation: none;
        opacity: 0.1;
      }

      .building-marker {
        opacity: 0.6;
        animation: none;
      }

      .zone-name {
        opacity: 1;
        animation: none;
      }

      .zone-stat {
        opacity: 1;
        animation: none;
      }

      .bureau-stamp {
        opacity: 1;
        animation: none;
      }
    }
  `;

  @property({ type: Array }) zones: ZoneTopology[] = [];
  @property({ type: String, reflect: true }) layer: MapLayer = 'infrastructure';
  @property({ type: Number }) zoom = 1;
  @property({ type: Number }) panX = 0;
  @property({ type: Number }) panY = 0;

  @state() private _isDragging = false;
  @state() private _generated: GeneratedZone[] = [];

  private _dragStart = { x: 0, y: 0 };
  private _panStart = { x: 0, y: 0 };

  /* ── PRNG (Mulberry32) ──────────────────── */

  private _mulberry32(seed: number): () => number {
    let s = seed;
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private _hash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /* ── Zone shape generation ──────────────── */

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('zones') && this.zones.length > 0) {
      this._generated = this.zones.map((z, i) => this._generateZone(z, i));
    }
  }

  private _generateZone(zone: ZoneTopology, index: number): GeneratedZone {
    const rng = this._mulberry32(this._hash(zone.zone_id));
    const baseR = 52 + zone.building_count * 2.5;
    const vertexCount = 10 + Math.floor(rng() * 5); // 10–14
    const vertices: { x: number; y: number }[] = [];

    for (let i = 0; i < vertexCount; i++) {
      const angle = (Math.PI * 2 * i) / vertexCount + (rng() - 0.5) * 0.25;
      const rVariation = 0.72 + rng() * 0.56;
      const r = baseR * rVariation;
      const jx = (rng() - 0.5) * 5;
      const jy = (rng() - 0.5) * 5;
      vertices.push({
        x: zone.x + r * Math.cos(angle) + jx,
        y: zone.y + r * Math.sin(angle) + jy,
      });
    }

    const path = this._catmullRomPath(vertices);
    const fillColor = this._stabilityFill(zone.stability);
    const hoverColor = this._stabilityHover(zone.stability);
    const borderColor = this._stabilityBorder(zone.stability);
    const unstable = zone.stability < 0.35;

    // Scatter building symbols
    const buildingCount = Math.min(zone.building_count, 14);
    const buildings: BuildingMarker[] = [];
    const rngB = this._mulberry32(this._hash(`${zone.zone_id}bld`));
    const innerR = baseR * 0.55;

    for (let b = 0; b < buildingCount; b++) {
      const angle = rngB() * Math.PI * 2;
      const dist = rngB() * innerR;
      const shapes: BuildingMarker['shape'][] = ['rect', 'rect', 'rect', 'tri', 'circle'];
      buildings.push({
        x: zone.x + dist * Math.cos(angle),
        y: zone.y + dist * Math.sin(angle),
        shape: shapes[Math.floor(rngB() * shapes.length)],
        size: 2 + rngB() * 1.5,
        delay: 3.5 + b * 0.08,
      });
    }

    const labelAngle = ((zone.zone_id.charCodeAt(0) % 7) - 3) * 0.6;

    return {
      zone,
      path,
      fillColor,
      hoverColor,
      borderColor,
      unstable,
      buildings,
      labelAngle,
      drawDelay: index * 0.35,
    };
  }

  /** Catmull-Rom spline through points → smooth cubic bezier closed path. */
  private _catmullRomPath(pts: { x: number; y: number }[]): string {
    const n = pts.length;
    if (n < 3) return '';

    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      // Catmull-Rom → cubic bezier: cp1 = p1 + (p2-p0)/6, cp2 = p2 - (p3-p1)/6
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return `${d} Z`;
  }

  /* ── Stability color system ─────────────── */

  private _stabilityFill(s: number): string {
    if (s < 0.25) return 'rgba(239, 68, 68, 0.12)';
    if (s < 0.4) return 'rgba(245, 158, 11, 0.09)';
    if (s < 0.6) return 'rgba(229, 229, 229, 0.05)';
    if (s < 0.8) return 'rgba(34, 197, 94, 0.07)';
    return 'rgba(245, 158, 11, 0.08)';
  }

  private _stabilityHover(s: number): string {
    if (s < 0.25) return 'rgba(239, 68, 68, 0.22)';
    if (s < 0.4) return 'rgba(245, 158, 11, 0.16)';
    if (s < 0.6) return 'rgba(229, 229, 229, 0.10)';
    if (s < 0.8) return 'rgba(34, 197, 94, 0.14)';
    return 'rgba(245, 158, 11, 0.15)';
  }

  private _stabilityBorder(s: number): string {
    if (s < 0.25) return 'rgba(239, 68, 68, 0.6)';
    if (s < 0.4) return 'rgba(245, 158, 11, 0.5)';
    if (s < 0.6) return 'rgba(229, 229, 229, 0.35)';
    if (s < 0.8) return 'rgba(34, 197, 94, 0.4)';
    return 'rgba(245, 158, 11, 0.5)';
  }

  /** Terrain pattern ID based on zone type. */
  private _terrainPattern(type: string): string {
    switch (type) {
      case 'residential':
        return 'url(#terrain-crosshatch)';
      case 'commercial':
        return 'url(#terrain-dots)';
      case 'industrial':
        return 'url(#terrain-diagonal)';
      case 'military':
        return 'url(#terrain-chevron)';
      default:
        return 'url(#terrain-stipple)';
    }
  }

  /* ── Adjacency routes ───────────────────── */

  private _computeRoutes(): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    mx: number;
    my: number;
  }[] {
    if (this._generated.length < 2) return [];

    const routes: { x1: number; y1: number; x2: number; y2: number; mx: number; my: number }[] = [];
    const connected = new Set<string>();

    for (const gz of this._generated) {
      // Find nearest neighbor not yet connected
      let nearest: GeneratedZone | null = null;
      let minDist = Infinity;

      for (const other of this._generated) {
        if (other.zone.zone_id === gz.zone.zone_id) continue;
        const key = [gz.zone.zone_id, other.zone.zone_id].sort().join('-');
        if (connected.has(key)) continue;

        const dx = gz.zone.x - other.zone.x;
        const dy = gz.zone.y - other.zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDist && dist < 250) {
          minDist = dist;
          nearest = other;
        }
      }

      if (nearest) {
        const key = [gz.zone.zone_id, nearest.zone.zone_id].sort().join('-');
        connected.add(key);
        const mx = (gz.zone.x + nearest.zone.x) / 2;
        const my = (gz.zone.y + nearest.zone.y) / 2 + 15;
        routes.push({
          x1: gz.zone.x,
          y1: gz.zone.y,
          x2: nearest.zone.x,
          y2: nearest.zone.y,
          mx,
          my,
        });
      }
    }

    return routes;
  }

  /* ── ViewBox / pan / zoom ───────────────── */

  private get _viewBox(): string {
    const w = 800 / this.zoom;
    const h = 600 / this.zoom;
    const x = this.panX - w / 2;
    const y = this.panY - h / 2;
    return `${x} ${y} ${w} ${h}`;
  }

  private _onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    this.zoom = Math.max(0.3, Math.min(5, this.zoom * factor));
  }

  private _onPointerDown(e: PointerEvent) {
    this._isDragging = true;
    this._dragStart = { x: e.clientX, y: e.clientY };
    this._panStart = { x: this.panX, y: this.panY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onPointerMove(e: PointerEvent) {
    if (!this._isDragging) return;
    const dx = (e.clientX - this._dragStart.x) / this.zoom;
    const dy = (e.clientY - this._dragStart.y) / this.zoom;
    this.panX = this._panStart.x - dx;
    this.panY = this._panStart.y - dy;
  }

  private _onPointerUp() {
    this._isDragging = false;
  }

  /* ── Events ─────────────────────────────── */

  private _onZoneClick(zone: ZoneTopology) {
    this.dispatchEvent(
      new CustomEvent('zone-select', { detail: zone, bubbles: true, composed: true }),
    );
  }

  private _onZoneKeyDown(zone: ZoneTopology, e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onZoneClick(zone);
    }
  }

  /* ── Render ─────────────────────────────── */

  protected render() {
    return html`
      <svg
        class="map-svg"
        role="graphics-document"
        aria-roledescription=${msg('cartographic map of simulation zones')}
        viewBox=${this._viewBox}
        @wheel=${this._onWheel}
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
      >
        <defs>
          ${this._renderDefs()}
        </defs>

        <!-- Background -->
        <rect x="-2000" y="-2000" width="4000" height="4000"
          fill="var(--color-surface)" />

        <!-- Coordinate grid -->
        ${this._renderGrid()}

        <!-- Adjacency routes -->
        <g class="map-routes">
          ${this._computeRoutes().map(
            (r) => svg`
              <path class="route-line"
                d="M ${r.x1},${r.y1} Q ${r.mx},${r.my} ${r.x2},${r.y2}" />
            `,
          )}
        </g>

        <!-- Zone territories -->
        <g class="map-zones" role="list" aria-label=${msg('Simulation zones')}>
          ${this._generated.map((gz) => this._renderZone(gz))}
        </g>

        <!-- Building symbols -->
        <g class="map-buildings" aria-hidden="true">
          ${this._generated.map((gz) => this._renderBuildings(gz))}
        </g>

        <!-- Zone labels -->
        <g class="map-labels">
          ${this._generated.map((gz) => this._renderLabels(gz))}
        </g>

        <!-- Classification stamps (military layer) -->
        ${this.layer === 'military' ? this._renderStamps() : nothing}

        <!-- Edge vignette atmosphere -->
        <rect x="-2000" y="-2000" width="4000" height="4000"
          fill="url(#map-vignette)" pointer-events="none" />
      </svg>
    `;
  }

  /* ── SVG Defs ───────────────────────────── */

  private _renderDefs() {
    return svg`
      <!-- Ink roughness filter -->
      <filter id="ink-rough" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
      </filter>

      <!-- Subtle glow for borders -->
      <filter id="border-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <!-- Terrain patterns -->
      <pattern id="terrain-crosshatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"> <!-- lint-color-ok -->
        <line x1="0" y1="3" x2="6" y2="3" stroke="#e5e5e5" stroke-width="0.2" opacity="0.07" />
      </pattern>
      <pattern id="terrain-crosshatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="3" x2="6" y2="3" stroke="#e5e5e5" stroke-width="0.2" opacity="0.07" />
      </pattern>

      <pattern id="terrain-dots" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="0.6" fill="#e5e5e5" opacity="0.05" />
      </pattern>

      <pattern id="terrain-diagonal" width="5" height="5" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="5" y2="5" stroke="#e5e5e5" stroke-width="0.35" opacity="0.08" />
      </pattern>

      <pattern id="terrain-chevron" width="8" height="6" patternUnits="userSpaceOnUse">
        <polyline points="0,3 4,0 8,3" fill="none" stroke="#e5e5e5" stroke-width="0.3" opacity="0.07" />
      </pattern>

      <pattern id="terrain-stipple" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.3" fill="#e5e5e5" opacity="0.04" />
        <circle cx="7" cy="8" r="0.3" fill="#e5e5e5" opacity="0.04" />
      </pattern>

      <!-- Edge vignette -->
      <radialGradient id="map-vignette" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="transparent" />
        <stop offset="65%" stop-color="transparent" />
        <stop offset="100%" stop-color="rgba(0,0,0,0.5)" />
      </radialGradient>
    `;
  }

  /* ── Grid overlay ───────────────────────── */

  private _renderGrid() {
    const lines: ReturnType<typeof svg>[] = [];
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Vertical lines every 100 units
    for (let x = -200; x <= 800; x += 100) {
      const idx = Math.floor((x + 200) / 100);
      lines.push(svg`
        <line class="grid-line" x1=${x} y1="-200" x2=${x} y2="800" />
        <text class="grid-label" x=${x + 2} y="-188" text-anchor="start">${labels[idx % 26] ?? ''}</text>
      `);
    }

    // Horizontal lines every 100 units
    for (let y = -200; y <= 800; y += 100) {
      const num = Math.floor((y + 200) / 100) + 1;
      lines.push(svg`
        <line class="grid-line" x1="-200" y1=${y} x2="800" y2=${y} />
        <text class="grid-label" x="-194" y=${y + 5} text-anchor="start">${num}</text>
      `);
    }

    return svg`<g class="map-grid" aria-hidden="true">${lines}</g>`;
  }

  /* ── Zone rendering ─────────────────────── */

  private _renderZone(gz: GeneratedZone) {
    const { zone, path, fillColor, hoverColor, borderColor, unstable, drawDelay } = gz;

    return svg`
      <g role="graphics-object listitem">
        <!-- Terrain pattern underlay -->
        <path
          class="zone-terrain"
          d=${path}
          fill=${this._terrainPattern(zone.zone_type)}
          style="animation-delay: ${drawDelay + 0.3}s"
        />

        <!-- Stability color fill -->
        <path
          class="zone-fill"
          tabindex="0"
          role="button"
          aria-label="${zone.zone_name}, ${msg('stability')}: ${Math.round(zone.stability * 100)}%"
          d=${path}
          fill=${fillColor}
          style="--zone-hover: ${hoverColor}; animation-delay: ${drawDelay}s"
          @click=${() => this._onZoneClick(zone)}
          @keydown=${(e: KeyboardEvent) => this._onZoneKeyDown(zone, e)}
        />

        <!-- Instability shimmer -->
        ${
          unstable
            ? svg`<path class="zone-unstable" d=${path} fill="rgba(239, 68, 68, 0.08)" />`
            : nothing
        }

        <!-- Border glow (subtle) -->
        <path
          class="zone-border-glow"
          d=${path}
          stroke=${borderColor}
          style="animation-delay: ${drawDelay}s"
        />

        <!-- Hand-drawn border -->
        <path
          class="zone-border"
          d=${path}
          stroke=${borderColor}
          filter="url(#ink-rough)"
          style="--draw-dur: ${2.5 + Math.random() * 0.5}s; --draw-del: ${drawDelay}s"
        />
      </g>
    `;
  }

  /* ── Building markers ───────────────────── */

  private _renderBuildings(gz: GeneratedZone) {
    return svg`
      <g>
        ${gz.buildings.map((b) => {
          const style = `animation-delay: ${b.delay}s`;
          if (b.shape === 'rect') {
            const h = b.size * 0.8;
            return svg`
              <rect class="building-marker" x=${b.x - b.size / 2} y=${b.y - h / 2}
                width=${b.size} height=${h}
                fill="var(--color-text-muted)" style=${style} />
            `;
          }
          if (b.shape === 'tri') {
            const s = b.size;
            const pts = `${b.x},${b.y - s} ${b.x - s * 0.8},${b.y + s * 0.5} ${b.x + s * 0.8},${b.y + s * 0.5}`;
            return svg`
              <polygon class="building-marker" points=${pts}
                fill="var(--color-text-muted)" style=${style} />
            `;
          }
          return svg`
            <circle class="building-marker" cx=${b.x} cy=${b.y} r=${b.size * 0.6}
              fill="none" stroke="var(--color-text-muted)" stroke-width="0.5" style=${style} />
          `;
        })}
      </g>
    `;
  }

  /* ── Labels ─────────────────────────────── */

  private _renderLabels(gz: GeneratedZone) {
    const { zone, labelAngle, drawDelay } = gz;
    const labelDelay = drawDelay + 2.5;
    const fontSize = zone.building_count > 5 ? 13 : 10;

    return svg`
      <text
        class="zone-name"
        x=${zone.x} y=${zone.y - 8}
        text-anchor="middle"
        font-size=${fontSize}
        transform="rotate(${labelAngle}, ${zone.x}, ${zone.y - 8})"
        style="animation-delay: ${labelDelay}s"
      >${zone.zone_name}</text>
      <text
        class="zone-stat"
        x=${zone.x} y=${zone.y + 5}
        text-anchor="middle"
        style="animation-delay: ${labelDelay + 0.2}s"
      >${zone.stability_label} · ${Math.round(zone.stability * 100)}%</text>
    `;
  }

  /* ── Bureau stamps ──────────────────────── */

  private _renderStamps() {
    const classified = this._generated.filter(
      (gz) => gz.zone.security_level === 'high' || gz.zone.security_level === 'maximum',
    );
    if (classified.length === 0) return nothing;

    return svg`
      <g class="map-stamps">
        ${classified.map(
          (gz) => svg`
            <g class="bureau-stamp"
              transform="translate(${gz.zone.x + 25}, ${gz.zone.y - 22}) rotate(${6 + (gz.zone.zone_id.charCodeAt(1) % 5)})">
              <rect class="stamp-border" x="0" y="0" width="52" height="14" rx="1" />
              <text class="stamp-text" x="26" y="10" text-anchor="middle">[${msg('CLASSIFIED')}]</text>
            </g>
          `,
        )}
      </g>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-cartographic-map': CartographicMap;
  }
}
