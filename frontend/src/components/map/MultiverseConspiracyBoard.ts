import { localized, msg } from '@lit/localize';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MapData } from '../../types/index.js';
import { getThemeColor } from '../multiverse/map-data.js';

interface BoardNode {
  id: string;
  name: string;
  slug: string;
  bannerUrl?: string;
  color: string;
  x: number;
  y: number;
}

interface BoardString {
  sourceId: string;
  targetId: string;
  color: string;
  type: string;
}

/**
 * Multiverse overview in conspiracy board aesthetic:
 * - Simulation shards as pinned Polaroid photographs
 * - Connected by colored string (SVG catenary curves)
 * - Pushpin icons at connection points
 * - Cork board texture background
 */
@localized()
@customElement('velg-multiverse-conspiracy-board')
export class MultiverseConspiracyBoard extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      min-height: 600px;
      background:
        /* Cork board grain */
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          rgba(139, 90, 43, 0.02) 2px,
          rgba(139, 90, 43, 0.02) 4px
        ),
        var(--color-surface, #0a0a0a);
      overflow: hidden;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .board-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    /* String connections */
    .string-line {
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
    }

    /* Pushpin at connection midpoints */
    .pushpin {
      fill: var(--color-text-muted, #888);
    }

    /* Polaroid photo cards */
    .polaroid {
      position: absolute;
      width: 140px;
      background: #1a1a1a;
      padding: 6px;
      box-shadow: 2px 3px 12px rgba(0, 0, 0, 0.5);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .polaroid:hover {
      transform: scale(1.05) rotate(0deg) !important;
      box-shadow: 4px 6px 20px rgba(0, 0, 0, 0.7);
      z-index: 10;
    }

    .polaroid__image {
      width: 100%;
      height: 90px;
      background-size: cover;
      background-position: center;
      background-color: var(--node-color, #333);
    }

    .polaroid__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary, #a0a0a0);
      padding: 4px 0 2px;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Pushpin on polaroid top */
    .polaroid::before {
      content: '';
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #666;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }

    .board__header {
      position: relative;
      z-index: 5;
      padding: var(--space-4, 16px);
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: var(--text-xl, 20px);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary, #e5e5e5);
    }

    @media (max-width: 768px) {
      .polaroid {
        width: 100px;
      }
      .polaroid__image {
        height: 60px;
      }
    }
  `;

  @property({ type: Object }) mapData: MapData | null = null;

  @state() private _nodes: BoardNode[] = [];
  @state() private _strings: BoardString[] = [];

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('mapData') && this.mapData) {
      this._buildBoard();
    }
  }

  private _buildBoard(): void {
    if (!this.mapData) return;

    const sims = this.mapData.simulations.filter(s => s.simulation_type !== 'archived');
    const cols = Math.ceil(Math.sqrt(sims.length));

    this._nodes = sims.map((sim, i) => ({
      id: sim.id,
      name: sim.name,
      slug: sim.slug,
      bannerUrl: sim.banner_url,
      color: getThemeColor(sim.theme),
      x: 80 + (i % cols) * 200 + (Math.random() * 30 - 15),
      y: 80 + Math.floor(i / cols) * 180 + (Math.random() * 20 - 10),
    }));

    this._strings = (this.mapData.connections ?? []).map(conn => ({
      sourceId: conn.simulation_a_id,
      targetId: conn.simulation_b_id,
      color: conn.connection_type === 'hostile' ? '#ef4444' :
             conn.connection_type === 'allied' ? '#f59e0b' : '#e5e5e5',
      type: conn.connection_type,
    }));
  }

  private _getNodePos(id: string): { x: number; y: number } | null {
    const node = this._nodes.find(n => n.id === id);
    return node ? { x: node.x + 70, y: node.y + 50 } : null;
  }

  private _handleNodeClick(node: BoardNode) {
    const path = `/simulations/${node.slug}/lore`;
    window.history.pushState({}, '', path);
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
  }

  protected render() {
    if (!this.mapData || this._nodes.length === 0) {
      return html`<div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted)">
        ${msg('No simulation data available.')}
      </div>`;
    }

    return html`
      <div class="board__header">${msg('Multiverse Overview')}</div>

      <!-- String connections (SVG layer) -->
      <svg class="board-svg" aria-hidden="true">
        ${this._strings.map(s => this._renderString(s))}
      </svg>

      <!-- Polaroid nodes -->
      ${this._nodes.map(node => this._renderPolaroid(node))}
    `;
  }

  private _renderString(s: BoardString) {
    const src = this._getNodePos(s.sourceId);
    const tgt = this._getNodePos(s.targetId);
    if (!src || !tgt) return svg``;

    // Catenary curve: quadratic bezier with sag
    const midX = (src.x + tgt.x) / 2;
    const midY = (src.y + tgt.y) / 2 + 30; // sag amount
    const path = `M ${src.x},${src.y} Q ${midX},${midY} ${tgt.x},${tgt.y}`;

    return svg`
      <path class="string-line" d=${path} stroke=${s.color} />
      <circle class="pushpin" cx=${midX} cy=${midY - 30} r="3" />
    `;
  }

  private _renderPolaroid(node: BoardNode) {
    const rotation = (node.id.charCodeAt(0) % 13) - 6;

    return html`
      <div
        class="polaroid"
        style="left: ${node.x}px; top: ${node.y}px; transform: rotate(${rotation}deg); --node-color: ${node.color}"
        @click=${() => this._handleNodeClick(node)}
        tabindex="0"
        role="button"
        aria-label=${node.name}
      >
        <div
          class="polaroid__image"
          style="${node.bannerUrl ? `background-image: url(${node.bannerUrl})` : ''}"
        ></div>
        <div class="polaroid__label">${node.name}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-multiverse-conspiracy-board': MultiverseConspiracyBoard;
  }
}
