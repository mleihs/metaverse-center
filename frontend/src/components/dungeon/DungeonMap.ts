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
import { customElement, property } from 'lit/decorators.js';

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

const NODE_R = 18;
const H_GAP = 100;
const V_GAP = 60;
const PAD = 28;

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
  /** When true, map is always expanded (toggle hidden, no max-height). */
  @property({ type: Boolean, reflect: true }) persistent = false;

  // ── Animation state-diffing (non-reactive) ────────────────────────────
  private _diffInitialized = false;
  private _previouslyRevealed = new Set<number>();
  private _previousDepth: number | undefined;
  private _newlyRevealed = new Set<number>();
  private _newlyTracedEdges = new Set<string>();
  private _depthHighlight = new Set<number>();

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
        padding: 4px 8px;
        border-top: 1px solid
          color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 95%, transparent);
        scrollbar-width: thin;
        scrollbar-color: var(--_phosphor-dim) transparent;
      }

      /* ── Persistent mode heading (no toggle visible) ── */
      .map-heading {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor-dim);
        padding: 4px 8px 0;
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

      .edge--just-traced {
        opacity: 0;
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
        font-size: 12px;
        font-weight: 700;
        pointer-events: none;
      }

      /* Current room: pulsing amber glow */
      .node--current {
        opacity: 1;
      }

      .node--current .node__circle {
        stroke-width: 2.5;
        filter: drop-shadow(0 0 6px var(--_phosphor-glow))
          drop-shadow(0 0 3px var(--_phosphor));
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

      /* ── Persistent mode (sidebar/column — no toggle, fills container) ── */
      :host([persistent]) .map-toggle {
        display: none;
      }

      :host([persistent]) .map-content {
        max-height: none;
        height: 100%;
        border-top: none;
      }

      /* ── Boss room: red pulse ── */
      .node--boss .node__circle {
        stroke: var(--color-danger);
      }

      @keyframes boss-pulse {
        0%, 100% {
          filter: drop-shadow(0 0 3px var(--color-danger));
        }
        50% {
          filter: drop-shadow(0 0 8px var(--color-danger))
            drop-shadow(0 0 4px var(--color-danger));
        }
      }

      /* ── Room reveal: radar-blip effect (circle scales in, label fades) ── */
      @keyframes reveal-blip {
        0% { transform: scale(0); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); }
      }

      @keyframes reveal-fade {
        0%, 40% { opacity: 0; }
        100% { opacity: 1; }
      }

      /* ── Room reveal: circle stroke trace (draws circumference) ── */
      @keyframes reveal-stroke {
        0% { stroke-dashoffset: 113.1; }
        100% { stroke-dashoffset: 0; }
      }

      /* ── Edge trace: line draws from source to target ── */
      @keyframes edge-trace {
        0% { stroke-dashoffset: var(--_edge-len); opacity: 0.15; }
        100% { stroke-dashoffset: 0; opacity: 0.4; }
      }

      /* ── Boss approach: intensified danger flare when adjacent ── */
      @keyframes boss-approach-flare {
        0%, 100% {
          filter: drop-shadow(0 0 5px var(--color-danger));
          stroke-width: 2;
        }
        50% {
          filter: drop-shadow(0 0 12px var(--color-danger))
            drop-shadow(0 0 5px var(--color-danger));
          stroke-width: 2.5;
        }
      }

      /* ── Depth transition: sonar-ping glow ── */
      @keyframes depth-ping {
        0% { filter: none; }
        35% {
          filter: drop-shadow(0 0 10px var(--_phosphor-glow))
            drop-shadow(0 0 4px var(--_phosphor));
        }
        100% { filter: none; }
      }

      /* ── Cleared rooms: SVG strike line through node ── */
      .node__strike {
        stroke: var(--_node-color, var(--_phosphor-dim));
        stroke-width: 1.5;
        opacity: 0.6;
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
        .node--boss .node__circle {
          animation: boss-pulse 3s ease-in-out infinite;
        }
        .node--boss.node--adjacent .node__circle {
          animation: boss-approach-flare 1.8s ease-in-out infinite;
        }
        .node--just-revealed .node__circle {
          stroke-dasharray: 113.1;
          animation:
            reveal-blip 300ms ease-out,
            reveal-stroke 400ms 200ms ease-out forwards;
        }
        .node--just-revealed .node__label {
          animation: reveal-fade 300ms ease-out;
        }
        .edge--just-traced {
          stroke-dasharray: var(--_edge-len);
          animation: edge-trace 500ms ease-out forwards;
        }
        .node--depth-highlight .node__circle {
          animation: depth-ping 500ms ease-out;
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

  /**
   * Pre-render: compute animation diffs by comparing current signal
   * values against the snapshot taken in updated(). First render
   * skipped to prevent all rooms animating on mount/recovery.
   */
  override willUpdate(): void {
    const rooms = dungeonState.rooms.value;
    const currentRoom = dungeonState.currentRoom.value;

    this._newlyRevealed.clear();
    this._newlyTracedEdges.clear();
    this._depthHighlight.clear();

    if (!this._diffInitialized) {
      this._diffInitialized = true;
      return;
    }

    // Detect rooms that transitioned from fog to revealed
    for (const room of rooms) {
      if (room.revealed && !this._previouslyRevealed.has(room.index)) {
        this._newlyRevealed.add(room.index);
      }
    }

    // Detect edges where both endpoints are now revealed but weren't before
    for (const room of rooms) {
      if (!room.revealed) continue;
      for (const ci of room.connections) {
        const peer = rooms.find((r) => r.index === ci);
        if (!peer?.revealed) continue;
        // Edge is visible now — was it visible last render?
        const wasBothRevealed =
          this._previouslyRevealed.has(room.index) &&
          this._previouslyRevealed.has(ci);
        if (!wasBothRevealed) {
          const key =
            room.index < ci
              ? `${room.index}-${ci}`
              : `${ci}-${room.index}`;
          this._newlyTracedEdges.add(key);
        }
      }
    }

    // Detect depth change — highlight all revealed rooms at new depth
    const currentDepth = currentRoom?.depth;
    if (
      currentDepth !== undefined &&
      this._previousDepth !== undefined &&
      currentDepth !== this._previousDepth
    ) {
      for (const room of rooms) {
        if (room.depth === currentDepth && room.revealed) {
          this._depthHighlight.add(room.index);
        }
      }
    }
  }

  /** Post-render: snapshot current state for next diff cycle. */
  override updated(): void {
    const rooms = dungeonState.rooms.value;
    const currentRoom = dungeonState.currentRoom.value;

    this._previouslyRevealed.clear();
    for (const room of rooms) {
      if (room.revealed) this._previouslyRevealed.add(room.index);
    }
    this._previousDepth = currentRoom?.depth;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  protected render() {
    const rooms = dungeonState.rooms.value;
    if (rooms.length === 0) return nothing;

    const expanded = this.persistent || dungeonState.mapExpanded.value;

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
    const heading = this.persistent
      ? html`<div class="map-heading" aria-hidden="true">${msg('Map')}</div>`
      : nothing;

    const adjacentSet = new Set(
      dungeonState.adjacentRooms.value.map((r) => r.index),
    );

    const posMap = new Map<number, NodePosition>();
    for (const n of nodes) posMap.set(n.room.index, n);

    return html`
      ${heading}
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
        const justTraced = this._newlyTracedEdges.has(key);
        // Shorten lines so they stop at the circle edge, not the center
        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = dist > 0 ? NODE_R / dist : 0;
        // Edge length for stroke animation
        const edgeLen = Math.max(dist - NODE_R * 2, 1);
        lines.push(
          svg`<line
            x1=${x + dx * offset} y1=${y + dy * offset}
            x2=${target.x - dx * offset} y2=${target.y - dy * offset}
            class="edge ${foggy ? 'edge--fog' : ''} ${justTraced ? 'edge--just-traced' : ''}"
            style=${justTraced ? `--_edge-len: ${edgeLen}` : nothing}
          />`,
        );
      }
    }

    return svg`<g class="edges" aria-hidden="true">${lines}</g>`;
  }

  private _renderNodes(nodes: NodePosition[], adjacentSet: Set<number>) {
    return svg`<g class="nodes">
      ${nodes.map(({ room, x, y }) => {
        const isAdj = adjacentSet.has(room.index);
        // Revealed rooms: type color. Unrevealed adjacent: depth-risk tint. Fog: dim.
        let color: string;
        let label: string;
        if (room.revealed) {
          color = ROOM_COLOR[room.room_type] ?? 'var(--_phosphor-dim)';
          label = ROOM_LABEL[room.room_type] ?? '?';
        } else if (isAdj) {
          // Depth-based risk gradient for reachable unrevealed rooms
          color = room.depth >= 4
            ? 'var(--color-danger)'
            : room.depth >= 3
              ? 'var(--color-warning)'
              : 'var(--_phosphor-dim)';
          label = '?';
        } else {
          color = 'var(--_phosphor-dim)';
          label = '?';
        }
        const cls = [
          'node',
          room.current ? 'node--current' : '',
          room.cleared ? 'node--cleared' : '',
          !room.revealed ? 'node--fog' : '',
          isAdj ? 'node--adjacent' : '',
          room.room_type === 'boss' ? 'node--boss' : '',
          this._newlyRevealed.has(room.index) ? 'node--just-revealed' : '',
          this._depthHighlight.has(room.index) ? 'node--depth-highlight' : '',
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
            ${room.cleared && !room.current ? svg`<line x1=${-NODE_R + 4} y1="0" x2=${NODE_R - 4} y2="0" class="node__strike" aria-hidden="true" />` : nothing}
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
