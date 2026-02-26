import { localized } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getGlowColor, getThemeColor } from './map-data.js';
import { initializePositions, simulateTick } from './map-force.js';
import type { MapEdgeData, MapNodeData } from './map-types.js';

import './MapTooltip.js';

const NODE_RADIUS = 52;
const LABEL_OFFSET = NODE_RADIUS + 18;

@localized()
@customElement('velg-map-graph')
export class VelgMapGraph extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    svg {
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    svg:active {
      cursor: grabbing;
    }

    /* Edge flow animation */
    .edge-line {
      fill: none;
      stroke-dasharray: 8 6;
      animation: dash-flow 2s linear infinite;
    }

    @keyframes dash-flow {
      to {
        stroke-dashoffset: -28;
      }
    }

    /* Node breathing */
    .node-group {
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .node-group:hover .node-glow {
      opacity: 0.6;
    }

    .node-glow {
      opacity: 0.3;
      transition: opacity 0.3s ease;
    }

    .node-border {
      fill: none;
      stroke-width: 3;
    }

    .node-label {
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      fill: var(--color-text-primary, #f0f0f0);
      text-anchor: middle;
      pointer-events: none;
    }

    .node-stat {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      fill: var(--color-text-muted, #777);
      text-anchor: middle;
      pointer-events: none;
    }

    .edge-midpoint {
      font-size: 10px;
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
  `;

  @property({ type: Array }) nodes: MapNodeData[] = [];
  @property({ type: Array }) edges: MapEdgeData[] = [];

  @state() private _viewBox = '0 0 800 600';
  @state() private _tooltipNode: MapNodeData | null = null;
  @state() private _tooltipX = 0;
  @state() private _tooltipY = 0;

  private _width = 800;
  private _height = 600;
  private _panStart: { x: number; y: number; vbx: number; vby: number } | null = null;
  private _vbx = 0;
  private _vby = 0;
  private _zoom = 1;
  private _animFrame = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResize);
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  protected firstUpdated(): void {
    this._handleResize();
    this._startSimulation();
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('nodes') || changed.has('edges')) {
      this._startSimulation();
    }
  }

  private _handleResize(): void {
    const rect = this.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this._width = rect.width;
      this._height = rect.height;
      this._updateViewBox();
    }
  }

  private _updateViewBox(): void {
    const w = this._width / this._zoom;
    const h = this._height / this._zoom;
    this._viewBox = `${this._vbx} ${this._vby} ${w} ${h}`;
  }

  private _startSimulation(): void {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    if (this.nodes.length === 0) return;

    initializePositions(this.nodes, this._width, this._height);
    let iterations = 0;

    const tick = () => {
      const energy = simulateTick(this.nodes, this.edges, this._width, this._height);
      iterations++;

      this.requestUpdate();

      if (energy < 0.5 || iterations > 300) {
        return;
      }
      this._animFrame = requestAnimationFrame(tick);
    };

    this._animFrame = requestAnimationFrame(tick);
  }

  // Pan handlers
  private _handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this._panStart = { x: e.clientX, y: e.clientY, vbx: this._vbx, vby: this._vby };
  }

  private _handleMouseMove(e: MouseEvent): void {
    // Tooltip tracking
    if (!this._panStart) {
      this._tooltipX = e.offsetX;
      this._tooltipY = e.offsetY;
      return;
    }

    const dx = (e.clientX - this._panStart.x) / this._zoom;
    const dy = (e.clientY - this._panStart.y) / this._zoom;
    this._vbx = this._panStart.vbx - dx;
    this._vby = this._panStart.vby - dy;
    this._updateViewBox();
    this.requestUpdate();
  }

  private _handleMouseUp(): void {
    this._panStart = null;
  }

  // Zoom handler
  private _handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this._zoom = Math.max(0.5, Math.min(3, this._zoom * factor));
    this._updateViewBox();
    this.requestUpdate();
  }

  // Node interactions
  private _handleNodeClick(node: MapNodeData): void {
    this.dispatchEvent(
      new CustomEvent('node-click', { detail: node, bubbles: true, composed: true }),
    );
  }

  private _handleNodeHover(node: MapNodeData | null): void {
    this._tooltipNode = node;
  }

  // Edge interactions
  private _handleEdgeClick(edge: MapEdgeData): void {
    this.dispatchEvent(
      new CustomEvent('edge-click', { detail: edge, bubbles: true, composed: true }),
    );
  }

  private _getNodeById(id: string): MapNodeData | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  private _renderEdge(edge: MapEdgeData) {
    const source = this._getNodeById(edge.sourceId);
    const target = this._getNodeById(edge.targetId);
    if (!source || !target) return nothing;

    // Bezier curve with slight offset
    const mx = (source.x + target.x) / 2;
    const my = (source.y + target.y) / 2;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return nothing; // Nodes overlap, skip edge
    // Perpendicular offset for curve
    const offset = dist * 0.12;
    const cx = mx + (-dy / dist) * offset;
    const cy = my + (dx / dist) * offset;

    const strokeColor = getThemeColor(source.theme);
    const strokeWidth = 1.5 + edge.strength * 2;

    return svg`
      <g class="edge-group" @click=${() => this._handleEdgeClick(edge)} style="cursor: pointer">
        <path
          class="edge-line"
          d="M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}"
          stroke="${strokeColor}"
          stroke-width="${strokeWidth}"
          opacity="0.5"
        />
      </g>
    `;
  }

  private _renderNode(node: MapNodeData) {
    const color = getThemeColor(node.theme);
    const glowColor = getGlowColor(node.theme);

    return svg`
      <g
        class="node-group"
        transform="translate(${node.x}, ${node.y})"
        @click=${() => this._handleNodeClick(node)}
        @mouseenter=${() => this._handleNodeHover(node)}
        @mouseleave=${() => this._handleNodeHover(null)}
      >
        <!-- Defs for this node -->
        <defs>
          <clipPath id="clip-${node.id}">
            <circle r="${NODE_RADIUS - 3}" />
          </clipPath>
          <filter id="glow-${node.id}">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Glow -->
        <circle class="node-glow" r="${NODE_RADIUS + 12}" fill="${glowColor}" />

        <!-- Banner image or fallback -->
        ${
          node.bannerUrl
            ? svg`
              <image
                href="${node.bannerUrl}"
                x="${-NODE_RADIUS + 3}"
                y="${-NODE_RADIUS + 3}"
                width="${(NODE_RADIUS - 3) * 2}"
                height="${(NODE_RADIUS - 3) * 2}"
                clip-path="url(#clip-${node.id})"
                preserveAspectRatio="xMidYMid slice"
              />
            `
            : svg`
              <circle r="${NODE_RADIUS - 3}" fill="var(--color-surface, #0a0a0a)" />
            `
        }

        <!-- Border ring -->
        <circle class="node-border" r="${NODE_RADIUS}" stroke="${color}" />

        <!-- Label -->
        <text class="node-label" y="${LABEL_OFFSET}">${node.name}</text>

        <!-- Stats -->
        <text class="node-stat" y="${LABEL_OFFSET + 14}">
          ${node.agentCount}A / ${node.buildingCount}B / ${node.eventCount}E
        </text>
      </g>
    `;
  }

  protected render() {
    return html`
      <svg
        viewBox="${this._viewBox}"
        @mousedown=${this._handleMouseDown}
        @mousemove=${this._handleMouseMove}
        @mouseup=${this._handleMouseUp}
        @mouseleave=${this._handleMouseUp}
        @wheel=${this._handleWheel}
      >
        <!-- Edges first (behind nodes) -->
        ${this.edges.map((e) => this._renderEdge(e))}

        <!-- Nodes -->
        ${this.nodes.map((n) => this._renderNode(n))}
      </svg>

      <velg-map-tooltip
        .node=${this._tooltipNode}
        .x=${this._tooltipX}
        .y=${this._tooltipY}
      ></velg-map-tooltip>
    `;
  }
}
