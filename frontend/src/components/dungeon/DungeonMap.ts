/**
 * Dungeon Map — interactive SVG DAG with fog-of-war.
 *
 * Renders the dungeon room graph as an FTL-style horizontal node map.
 * Nodes grouped by depth (columns, left-to-right). Supports:
 *   - Click-to-move for adjacent revealed rooms
 *   - Fog-of-war (unrevealed rooms at reduced opacity)
 *   - Visual status: current (pulsing glow), cleared (dimmed)
 *   - Collapsible via header toggle
 *
 * Pure signal consumer — reads rooms, currentRoom, adjacentRooms from state.
 * Click dispatches `terminal-command` CustomEvent (same as QuickActions).
 *
 * Pattern: DungeonHeader.ts (signal-reactive, terminal tokens).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type { RoomNodeClient } from '../../types/dungeon.js';
import { getRoomTypeLabel } from '../../utils/dungeon-formatters.js';
import { icons } from '../../utils/icons.js';
import {
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

// ── Layout Engine ────────────────────────────────────────────────────────────

interface NodePosition {
  room: RoomNodeClient;
  x: number;
  y: number;
}

const NODE_R = 12;
const H_GAP = 80;
const V_GAP = 48;
const PAD = 24;

/** Room type → color CSS value (all reference design tokens). */
const ROOM_COLOR: Record<string, string> = {
  combat: 'var(--_phosphor-dim)',
  elite: 'var(--color-warning)',
  encounter: 'var(--color-info)',
  treasure: 'var(--color-ascendant-gold)',
  rest: 'var(--color-success)',
  boss: 'var(--color-danger)',
  entrance: 'var(--_phosphor)',
  exit: 'var(--_phosphor)',
};

/** Room type → single-character label for SVG nodes. */
const ROOM_LABEL: Record<string, string> = {
  combat: 'C',
  elite: '!',
  encounter: '?',
  treasure: 'T',
  rest: 'R',
  boss: 'B',
  entrance: 'E',
  exit: 'X',
};

/** Position nodes in FTL-style horizontal depth layers. */
function layoutNodes(rooms: RoomNodeClient[]): {
  nodes: NodePosition[];
  w: number;
  h: number;
} {
  if (rooms.length === 0) return { nodes: [], w: 0, h: 0 };

  const byDepth = new Map<number, RoomNodeClient[]>();
  for (const r of rooms) {
    const arr = byDepth.get(r.depth) ?? [];
    arr.push(r);
    byDepth.set(r.depth, arr);
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const maxPerLayer = Math.max(
    ...depths.map((d) => byDepth.get(d)!.length),
    1,
  );
  const totalH = PAD * 2 + (maxPerLayer - 1) * V_GAP;
  const nodes: NodePosition[] = [];

  for (const depth of depths) {
    const layer = byDepth.get(depth)!;
    layer.sort((a, b) => a.index - b.index);
    const layerH = (layer.length - 1) * V_GAP;
    const startY = (totalH - layerH) / 2;

    for (let i = 0; i < layer.length; i++) {
      nodes.push({
        room: layer[i],
        x: PAD + (depth - depths[0]) * H_GAP,
        y: startY + i * V_GAP,
      });
    }
  }

  return {
    nodes,
    w: Math.max(PAD * 2 + (depths.length - 1) * H_GAP, 100),
    h: Math.max(totalH, PAD * 2),
  };
}

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-map')
export class VelgDungeonMap extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
        flex-shrink: 0;
      }

      /* ── Toggle Header ── */
      .map-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 4px 8px;
        border: none;
        border-top: 1px dashed
          color-mix(in srgb, var(--_border) 40%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 85%, transparent);
        cursor: pointer;
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor-dim);
      }

      .map-toggle:hover {
        color: var(--_phosphor);
      }

      .map-toggle:focus-visible {
        outline: 1px solid var(--_phosphor);
        outline-offset: -1px;
      }

      .map-toggle__icon {
        display: flex;
        align-items: center;
      }

      .map-toggle__icon--expanded {
        transform: rotate(0deg);
      }

      .map-toggle__icon--collapsed {
        transform: rotate(-90deg);
      }

      /* ── SVG Container ── */
      .map-content {
        max-height: 180px;
        overflow: auto;
        border-top: 1px solid
          color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 95%, transparent);
        scrollbar-width: thin;
        scrollbar-color: var(--_phosphor-dim) transparent;
      }

      .map-svg {
        display: block;
        width: 100%;
        height: auto;
        min-height: 60px;
      }

      /* ── Edges ── */
      .edge {
        stroke: var(--_phosphor-dim);
        stroke-width: 1.5;
        opacity: 0.4;
      }

      .edge--fog {
        stroke-dasharray: 4 3;
        opacity: 0.12;
        filter: none;
      }

      /* ── Nodes ── */
      .node {
        cursor: default;
      }

      .node__circle {
        fill: var(--_screen-bg);
        stroke: var(--_node-color, var(--_phosphor-dim));
        stroke-width: 1.5;
      }

      .node__label {
        fill: var(--_node-color, var(--_phosphor-dim));
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 700;
        pointer-events: none;
      }

      /* Current room: pulsing amber glow */
      .node--current {
        opacity: 1;
      }

      .node--current .node__circle {
        stroke-width: 2.5;
        filter: drop-shadow(0 0 4px var(--_phosphor-glow))
          drop-shadow(0 0 2px var(--_phosphor));
      }

      @keyframes current-pulse {
        0%,
        100% {
          filter: drop-shadow(0 0 4px var(--_phosphor-glow))
            drop-shadow(0 0 2px var(--_phosphor));
        }
        50% {
          filter: drop-shadow(0 0 8px var(--_phosphor-glow))
            drop-shadow(0 0 4px var(--_phosphor));
        }
      }

      /* Cleared rooms: dimmed */
      .node--cleared {
        opacity: 0.35;
      }

      /* Fog of war */
      .node--fog {
        opacity: 0.25;
      }

      /* Adjacent (clickable) rooms */
      .node--adjacent {
        cursor: pointer;
      }

      .node--adjacent .node__circle {
        stroke-width: 2;
      }

      .node--adjacent:hover .node__circle {
        stroke-width: 2.5;
        filter: drop-shadow(
          0 0 4px var(--_node-color, var(--_phosphor-glow))
        );
      }

      .node--adjacent:focus-visible {
        outline: none;
      }

      .node--adjacent:focus-visible .node__circle {
        stroke-width: 3;
        stroke: var(--_phosphor);
        stroke-dasharray: 3 2;
      }

      /* ── Empty ── */
      .map-empty {
        padding: 8px;
        font-family: var(--_mono);
        font-size: 9px;
        color: var(--_phosphor-dim);
        opacity: 0.5;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* ── Motion (opt-in per DungeonHeader pattern) ── */
      @media (prefers-reduced-motion: no-preference) {
        .map-toggle {
          transition: color var(--duration-fast, 150ms);
        }
        .map-toggle__icon {
          transition: transform var(--duration-fast, 150ms);
        }
        .node__circle {
          transition: stroke-width var(--duration-fast, 150ms);
        }
        .edge {
          filter: drop-shadow(0 0 1px var(--_phosphor-glow));
        }
        .node--current .node__circle {
          animation: current-pulse 2s ease-in-out infinite;
        }
      }

      /* ── Mobile ── */
      @media (max-width: 767px) {
        .map-content {
          max-height: 140px;
        }
      }

      /* ── Large screens (1440px+) ── */
      @media (min-width: 1440px) {
        .map-content {
          max-height: 220px;
        }
        .map-toggle {
          font-size: 10px;
          padding: 5px 10px;
        }
      }

      /* ── 4K / Ultra-wide (2560px+) ── */
      @media (min-width: 2560px) {
        .map-content {
          max-height: 280px;
        }
        .map-toggle {
          font-size: 11px;
          padding: 6px 12px;
        }
        .map-empty {
          font-size: 10px;
          padding: 12px;
        }
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    // Collapse map by default on mobile (only when actively in a dungeon)
    if (
      window.matchMedia('(max-width: 767px)').matches &&
      dungeonState.isInDungeon.value
    ) {
      dungeonState.mapExpanded.value = false;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  protected render() {
    const rooms = dungeonState.rooms.value;
    if (rooms.length === 0) return nothing;

    const expanded = dungeonState.mapExpanded.value;

    return html`
      <button
        class="map-toggle"
        @click=${this._toggleMap}
        aria-expanded=${expanded ? 'true' : 'false'}
        aria-controls="dungeon-map-content"
      >
        <span>${msg('Map')}</span>
        <span
          class="map-toggle__icon ${expanded ? 'map-toggle__icon--expanded' : 'map-toggle__icon--collapsed'}"
          >${icons.chevronDown(10)}</span
        >
      </button>
      ${expanded ? this._renderMapContent(rooms) : nothing}
    `;
  }

  private _renderMapContent(rooms: RoomNodeClient[]) {
    const { nodes, w, h } = layoutNodes(rooms);
    if (nodes.length === 0) {
      return html`<div class="map-empty" id="dungeon-map-content">
        ${msg('No rooms mapped')}
      </div>`;
    }

    const adjacentSet = new Set(
      dungeonState.adjacentRooms.value.map((r) => r.index),
    );

    const posMap = new Map<number, NodePosition>();
    for (const n of nodes) posMap.set(n.room.index, n);

    return html`
      <div class="map-content" id="dungeon-map-content">
        <svg
          viewBox="0 0 ${w} ${h}"
          class="map-svg"
          role="img"
          aria-label=${msg('Dungeon map')}
          preserveAspectRatio="xMidYMid meet"
        >
          ${this._renderEdges(nodes, posMap)}
          ${this._renderNodes(nodes, adjacentSet)}
        </svg>
      </div>
    `;
  }

  // ── SVG Rendering ─────────────────────────────────────────────────────

  private _renderEdges(
    nodes: NodePosition[],
    posMap: Map<number, NodePosition>,
  ) {
    const drawn = new Set<string>();
    const lines: unknown[] = [];

    for (const { room, x, y } of nodes) {
      for (const ci of room.connections) {
        const key =
          room.index < ci ? `${room.index}-${ci}` : `${ci}-${room.index}`;
        if (drawn.has(key)) continue;
        drawn.add(key);

        const target = posMap.get(ci);
        if (!target) continue;

        const foggy = !room.revealed || !target.room.revealed;
        lines.push(
          svg`<line
            x1=${x} y1=${y}
            x2=${target.x} y2=${target.y}
            class="edge ${foggy ? 'edge--fog' : ''}"
          />`,
        );
      }
    }

    return svg`<g class="edges">${lines}</g>`;
  }

  private _renderNodes(nodes: NodePosition[], adjacentSet: Set<number>) {
    return svg`<g class="nodes">
      ${nodes.map(({ room, x, y }) => {
        const isAdj = adjacentSet.has(room.index);
        const color = room.revealed
          ? (ROOM_COLOR[room.room_type] ?? 'var(--_phosphor-dim)')
          : 'var(--_phosphor-dim)';
        const label = room.revealed
          ? (ROOM_LABEL[room.room_type] ?? '?')
          : '?';
        const cls = [
          'node',
          room.current ? 'node--current' : '',
          room.cleared ? 'node--cleared' : '',
          !room.revealed ? 'node--fog' : '',
          isAdj ? 'node--adjacent' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const ariaLabel = room.revealed
          ? `${getRoomTypeLabel(room.room_type)} ${msg('room')} ${room.index}${room.cleared ? ` (${msg('cleared')})` : ''}${room.current ? ` (${msg('current')})` : ''}`
          : msg('Unknown room');

        return svg`
          <g
            class=${cls}
            transform="translate(${x}, ${y})"
            style="--_node-color: ${color}"
            tabindex=${isAdj ? '0' : nothing}
            role=${isAdj ? 'button' : 'img'}
            aria-label=${ariaLabel}
            @click=${isAdj ? () => this._handleNodeClick(room) : nothing}
            @keydown=${isAdj ? (e: KeyboardEvent) => this._handleNodeKeydown(e, room) : nothing}
          >
            <title>${room.revealed ? getRoomTypeLabel(room.room_type) : msg('Unknown')}</title>
            <circle r=${NODE_R} class="node__circle" />
            <text class="node__label" text-anchor="middle" dominant-baseline="central">${label}</text>
          </g>
        `;
      })}
    </g>`;
  }

  // ── Handlers ──────────────────────────────────────────────────────────

  private _toggleMap(): void {
    dungeonState.mapExpanded.value = !dungeonState.mapExpanded.value;
  }

  private _handleNodeClick(room: RoomNodeClient): void {
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: `move ${room.index}`,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleNodeKeydown(e: KeyboardEvent, room: RoomNodeClient): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleNodeClick(room);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-map': VelgDungeonMap;
  }
}
