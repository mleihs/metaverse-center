/**
 * MapMinimap — small overview of the entire graph in bottom-right corner.
 *
 * Shows all nodes as colored dots with a semi-transparent viewport rectangle
 * tracking the current viewBox. Hidden at ≤768px.
 */

import { css, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MapNodeData } from './map-types.js';

const MINIMAP_W = 150;
const MINIMAP_H = 100;

@customElement('velg-map-minimap')
export class VelgMapMinimap extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      bottom: 56px;
      right: var(--space-3, 12px);
      z-index: var(--z-raised);
      pointer-events: none;
    }

    .minimap {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .minimap__viewport {
      fill: rgba(255, 255, 255, 0.08);
      stroke: rgba(255, 255, 255, 0.3);
      stroke-width: 1;
    }

    @media (max-width: 768px) {
      :host { display: none; }
    }
  `;

  @property({ type: Array }) nodes: MapNodeData[] = [];
  @property({ type: Number }) graphWidth = 800;
  @property({ type: Number }) graphHeight = 600;
  @property({ type: Number }) vbx = 0;
  @property({ type: Number }) vby = 0;
  @property({ type: Number }) vbw = 800;
  @property({ type: Number }) vbh = 600;

  protected render() {
    if (this.nodes.length === 0) return html``;

    // Compute bounds of all nodes
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }

    const pad = 60;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;

    const scaleX = MINIMAP_W / worldW;
    const scaleY = MINIMAP_H / worldH;
    const scale = Math.min(scaleX, scaleY);

    // Viewport rectangle (maps the SVG viewBox to minimap coords)
    const vpX = (this.vbx - minX) * scale;
    const vpY = (this.vby - minY) * scale;
    const vpW = this.vbw * scale;
    const vpH = this.vbh * scale;

    return html`
      <svg class="minimap" width="${MINIMAP_W}" height="${MINIMAP_H}">
        ${this.nodes.map((n) => {
          const x = (n.x - minX) * scale;
          const y = (n.y - minY) * scale;
          const r = n.simulationType === 'game_instance' ? 2 : 3;
          return svg`<circle cx="${x}" cy="${y}" r="${r}" fill="${n.color}" opacity="0.8" />`;
        })}
        <rect
          class="minimap__viewport"
          x="${vpX}" y="${vpY}"
          width="${vpW}" height="${vpH}"
        />
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-minimap': VelgMapMinimap;
  }
}
