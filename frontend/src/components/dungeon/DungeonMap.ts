/**
 * Dungeon Map — interactive vertical SVG DAG with fog-of-war.
 *
 * Orchestrates the dungeon map display:
 *   - Vertical depth-first layout (top-to-bottom depth, left-to-right branches)
 *   - SVG filter definitions (fog noise, beacon glow)
 *   - Edges via renderMapEdge() (render module, not custom element)
 *   - Nodes via renderMapNode() (render module, not custom element)
 *   - DungeonRoomPanel for room inspection (HTML custom element, outside SVG)
 *   - Auto-scroll to current room on depth change
 *   - Animation diff state (reveal, trace, depth ping)
 *
 * Architecture note: SVG sub-elements (nodes, edges) are render functions, not
 * custom elements, because custom elements only exist in the HTML namespace —
 * they cannot be nested inside <svg>. DungeonRoomPanel IS a custom element
 * because it renders in HTML context below the SVG.
 *
 * Pure signal consumer — reads rooms, currentRoom, adjacentRooms from state.
 * Click dispatches `terminal-command` CustomEvent (same as QuickActions).
 *
 * External API unchanged: <velg-dungeon-map persistent></velg-dungeon-map>
 *
 * Pattern: DungeonHeader.ts (signal-reactive, terminal tokens).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type { RoomNodeClient } from '../../types/dungeon.js';
import { icons } from '../../utils/icons.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';
import { mapEdgeStyles, renderMapEdge } from './DungeonMapEdge.js';
import { mapNodeStyles, renderMapNode } from './DungeonMapNode.js';
import { DEFAULT_MAP_CONFIG, layoutDungeonMap, type NodePosition } from './dungeon-map-layout.js';
import './DungeonRoomPanel.js';

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-map')
export class VelgDungeonMap extends SignalWatcher(LitElement) {
  /** When true, map is always expanded (toggle hidden, no max-height). */
  @property({ type: Boolean, reflect: true }) persistent = false;

  /** Currently selected room for the detail panel. */
  @state() private _selectedRoom: RoomNodeClient | null = null;

  // ── Animation state-diffing (non-reactive) ────────────────────────────
  private _diffInitialized = false;
  private _previouslyRevealed = new Set<number>();
  private _previousDepth: number | undefined;
  private _newlyRevealed = new Set<number>();
  private _newlyTracedEdges = new Set<string>();
  private _depthHighlight = new Set<number>();
  /** Track whether we need to scroll after render. */
  private _shouldScrollToCurrentAfterUpdate = false;

  static styles = [
    terminalTokens,
    terminalComponentTokens,
    // Compose sub-module styles into this component's shadow root
    mapNodeStyles,
    mapEdgeStyles,
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

      /* ── SVG Container ──
       * No explicit scrollbar-width/scrollbar-color: the native OS scrollbar
       * is theme-aware (adapts to light/dark) and uses overlay mode on macOS
       * (only appears on scroll, hides when idle). Explicit scrollbar-color
       * forces a permanent visible scrollbar even when content doesn't overflow. */
      .map-content {
        overflow-y: auto;
        overflow-x: hidden;
        padding: 4px 8px;
        border-top: 1px solid
          color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 95%, transparent);
        position: relative;
      }

      /* Non-persistent mode: capped height */
      :host(:not([persistent])) .map-content {
        max-height: 320px;
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
        min-height: 80px;
      }

      /* ── Persistent mode (sidebar — no toggle, fills container) ── */
      :host([persistent]) .map-toggle {
        display: none;
      }

      :host([persistent]) .map-content {
        max-height: none;
        height: 100%;
        border-top: none;
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

      /* ── Depth indicator line (topographic) ── */
      .depth-line {
        stroke: color-mix(in srgb, var(--_phosphor-dim) 12%, transparent);
        stroke-width: 1;
        stroke-dasharray: 2 6;
      }

      /* ── Reveal ripple ring ── */
      .reveal-ripple {
        fill: none;
        stroke: var(--_phosphor);
        stroke-width: 1;
        pointer-events: none;
      }

      /* ── Motion ── */
      @media (prefers-reduced-motion: no-preference) {
        .map-toggle {
          transition: color var(--duration-fast, 150ms);
        }
        .map-toggle__icon {
          transition: transform var(--duration-fast, 150ms);
        }

        .reveal-ripple {
          animation: map-reveal-ripple 600ms ease-out forwards;
        }
      }

      @keyframes map-reveal-ripple {
        0% { r: 30; opacity: 0.6; stroke-width: 2; }
        100% { r: 52; opacity: 0; stroke-width: 0.5; }
      }

      /* ── Mobile ── */
      @media (max-width: 767px) {
        :host(:not([persistent])) .map-content {
          max-height: 240px;
        }
      }

      /* ── Large screens (1440px+) ── */
      @media (min-width: 1440px) {
        .map-toggle {
          font-size: 10px;
          padding: 5px 10px;
        }
      }

      /* ── 4K / Ultra-wide (2560px+) ── */
      @media (min-width: 2560px) {
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
    if (window.matchMedia('(max-width: 767px)').matches && dungeonState.isInDungeon.value) {
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
        const wasBothRevealed =
          this._previouslyRevealed.has(room.index) && this._previouslyRevealed.has(ci);
        if (!wasBothRevealed) {
          const key = room.index < ci ? `${room.index}-${ci}` : `${ci}-${room.index}`;
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
      this._shouldScrollToCurrentAfterUpdate = true;
    }

    // Deselect room if it's no longer in the room list (moved to willUpdate
    // to avoid state mutation during render — which causes re-render loops)
    if (this._selectedRoom) {
      const freshRoom = rooms.find((r) => r.index === this._selectedRoom!.index);
      if (!freshRoom) {
        this._selectedRoom = null;
      }
    }
  }

  /** Post-render: snapshot current state for next diff cycle + auto-scroll. */
  override updated(): void {
    const rooms = dungeonState.rooms.value;
    const currentRoom = dungeonState.currentRoom.value;

    this._previouslyRevealed.clear();
    for (const room of rooms) {
      if (room.revealed) this._previouslyRevealed.add(room.index);
    }
    this._previousDepth = currentRoom?.depth;

    // Auto-scroll to current room on depth transition
    if (this._shouldScrollToCurrentAfterUpdate) {
      this._shouldScrollToCurrentAfterUpdate = false;
      requestAnimationFrame(() => {
        const currentNodeEl = this.renderRoot?.querySelector(
          '.node--current',
        ) as HTMLElement | null;
        currentNodeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

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
        >${icons.chevronDown(10)}</span>
      </button>
      ${expanded ? this._renderMapContent(rooms) : nothing}
    `;
  }

  private _renderMapContent(rooms: RoomNodeClient[]) {
    const layout = layoutDungeonMap(rooms, DEFAULT_MAP_CONFIG);
    if (layout.nodes.length === 0) {
      return html`<div class="map-empty" id="dungeon-map-content">
        ${msg('No rooms mapped')}
      </div>`;
    }
    const heading = this.persistent
      ? html`<div class="map-heading" aria-hidden="true">${msg('Map')}</div>`
      : nothing;

    const adjacentSet = new Set(dungeonState.adjacentRooms.value.map((r) => r.index));

    // Build position lookup
    const posMap = new Map<number, NodePosition>();
    for (const n of layout.nodes) posMap.set(n.room.index, n);

    // Unique depth values for topographic lines
    const depths = [...new Set(rooms.map((r) => r.depth))].sort((a, b) => a - b);
    const minDepth = depths[0] ?? 0;

    // ── Pre-compute SVG content as svg tagged templates ──────────────
    // Event bindings (@click, @keydown) on SVG elements only work inside
    // svg tagged templates. Lit's html parser creates SVG child elements
    // in the wrong namespace, silently dropping event bindings. All SVG
    // children with expressions must therefore be built as svg`` results
    // and injected as expressions into the html template's <svg>.

    const depthLines = depths.map((d) => {
      const y = DEFAULT_MAP_CONFIG.padding + (d - minDepth) * DEFAULT_MAP_CONFIG.vGap;
      return svg`<line
        x1="0" y1=${y} x2=${layout.width} y2=${y}
        class="depth-line" aria-hidden="true"
      />`;
    });

    const edgesGroup = svg`<g aria-hidden="true">
      ${layout.edges.map((edge) => {
        const src = posMap.get(edge.sourceIndex);
        const tgt = posMap.get(edge.targetIndex);
        if (!src || !tgt) return nothing;
        return renderMapEdge({
          x1: src.x,
          y1: src.y,
          x2: tgt.x,
          y2: tgt.y,
          nodeRadius: DEFAULT_MAP_CONFIG.nodeRadius,
          foggy: edge.foggy,
          justTraced: this._newlyTracedEdges.has(edge.key),
        });
      })}
    </g>`;

    const ripples = [...this._newlyRevealed].map((idx) => {
      const pos = posMap.get(idx);
      if (!pos) return nothing;
      return svg`<circle
        cx=${pos.x} cy=${pos.y} r="30"
        class="reveal-ripple" aria-hidden="true"
      />`;
    });

    const nodesGroup = svg`<g>
      ${layout.nodes.map(({ room, x, y }) => {
        const isAdj = adjacentSet.has(room.index);
        return renderMapNode({
          room,
          x,
          y,
          current: room.current,
          adjacent: isAdj,
          justRevealed: this._newlyRevealed.has(room.index),
          depthHighlight: this._depthHighlight.has(room.index),
          selected: this._selectedRoom?.index === room.index,
          onClick: (r: RoomNodeClient) => this._handleNodeClick(r),
          onDeselect: () => this._handleNodeDeselect(),
        });
      })}
    </g>`;

    return html`
      ${heading}
      <div class="map-content" id="dungeon-map-content">
        <svg
          viewBox="0 0 ${layout.width} ${layout.height}"
          class="map-svg"
          role="img"
          aria-label=${msg('Dungeon map')}
          preserveAspectRatio="xMidYMin meet"
        >
          ${this._renderDefs()}
          ${depthLines}
          ${edgesGroup}
          ${ripples}
          ${nodesGroup}
        </svg>

        ${this._renderRoomPanel(adjacentSet)}
      </div>
    `;
  }

  // ── SVG Filters ───────────────────────────────────────────────────────

  private _renderDefs() {
    // Note: SVG filter attributes like flood-color cannot use CSS custom
    // properties. The amber value matches --color-accent-amber (#f59e0b)
    // from _colors.css. This is a documented exception per design-tokens.md.
    return svg`
      <defs>
        <!-- Fog noise overlay for unrevealed nodes -->
        <filter id="dungeon-fog" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3"
            seed="42" result="noise">
            <animate attributeName="baseFrequency" values="0.015;0.025;0.015"
              dur="8s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="8"
            xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <!-- Breathing glow for current room beacon -->
        <filter id="beacon-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur">
            <animate attributeName="stdDeviation" values="2;5;2" dur="2.5s"
              repeatCount="indefinite" />
          </feGaussianBlur>
          <feFlood flood-color="#f59e0b" flood-opacity="0.3" result="color" /> <!-- lint-color-ok: SVG filter attr -->
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;
  }

  // ── Room Panel ────────────────────────────────────────────────────────

  private _renderRoomPanel(adjacentSet: Set<number>) {
    if (!this._selectedRoom) return nothing;

    // Get fresh room data from state (selected room may have changed state)
    const freshRoom = dungeonState.rooms.value.find((r) => r.index === this._selectedRoom!.index);
    if (!freshRoom || !freshRoom.revealed) {
      // Don't mutate state during render — willUpdate handles cleanup.
      // Return nothing for this render cycle; next willUpdate will clear.
      return nothing;
    }

    const isAdjacent = adjacentSet.has(freshRoom.index);
    const isCurrent = freshRoom.current;

    return html`
      <velg-dungeon-room-panel
        .room=${freshRoom}
        .adjacent=${isAdjacent}
        .current=${isCurrent}
        style="margin: 8px auto; max-width: 220px;"
        @room-deselect=${this._handleNodeDeselect}
      ></velg-dungeon-room-panel>
    `;
  }

  // ── Handlers ──────────────────────────────────────────────────────────

  private _toggleMap(): void {
    dungeonState.mapExpanded.value = !dungeonState.mapExpanded.value;
  }

  private _handleNodeClick(room: RoomNodeClient): void {
    // Toggle: clicking the same room deselects
    if (this._selectedRoom?.index === room.index) {
      this._selectedRoom = null;
      return;
    }

    // Revealed rooms: show detail panel
    if (room.revealed) {
      this._selectedRoom = room;
      return;
    }

    // Unrevealed adjacent rooms: still show panel (limited info)
    const adjacentSet = new Set(dungeonState.adjacentRooms.value.map((r) => r.index));
    if (adjacentSet.has(room.index)) {
      this._selectedRoom = room;
    }
  }

  private _handleNodeDeselect(): void {
    this._selectedRoom = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-map': VelgDungeonMap;
  }
}
