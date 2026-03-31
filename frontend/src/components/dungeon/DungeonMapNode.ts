/**
 * Dungeon Map Node — SVG render module for a single room node.
 *
 * NOT a custom element (custom elements can't live inside SVG namespace).
 * Instead exports:
 *   - `mapNodeStyles` — CSS to compose into the parent DungeonMap component
 *   - `renderMapNode()` — pure function returning SVGTemplateResult
 *
 * Renders an SVG <g> group containing:
 *   1. Inner fill circle (dark background)
 *   2. Outer status ring (stroke color/width encodes state)
 *   3. Room-type icon (filled SVG from game-icons.net)
 *   4. Cleared checkmark badge
 *   5. Treasure sparkle particles
 *
 * Pattern: Render helper module (pure function, no DOM state).
 */

import { msg } from '@lit/localize';
import { css, nothing, svg, type SVGTemplateResult } from 'lit';

import type { RoomNodeClient } from '../../types/dungeon.js';
import { getRoomTypeLabel } from '../../utils/dungeon-formatters.js';
import {
  resolveRoomColor,
  ROOM_ICON,
  ROOM_ICON_UNKNOWN,
} from './dungeon-map-icons.js';

// ── Constants ───────────────────────────────────────────────────────────────

const RING_R = 30;
const FILL_R = 24;
const ICON_SIZE = 20;
const ICON_OFFSET = -ICON_SIZE / 2;

// ── Sparkle positions (treasure shimmer) ────────────────────────────────────

const SPARKLES = [
  { cx: 0, cy: -14, r: 1.2, delay: 0 },
  { cx: 12, cy: -8, r: 0.8, delay: 0.3 },
  { cx: -10, cy: -11, r: 1.0, delay: 0.6 },
  { cx: 7, cy: 12, r: 0.9, delay: 0.9 },
  { cx: -12, cy: 6, r: 1.1, delay: 1.2 },
  { cx: 4, cy: -18, r: 0.7, delay: 1.5 },
];

// ── Props (input to render function) ────────────────────────────────────────

export interface MapNodeProps {
  room: RoomNodeClient;
  x: number;
  y: number;
  current: boolean;
  adjacent: boolean;
  justRevealed: boolean;
  depthHighlight: boolean;
  selected: boolean;
  /** Callback when node is clicked. */
  onClick: (room: RoomNodeClient) => void;
  /** Callback when Escape is pressed on a focused node. */
  onDeselect: () => void;
}

// ── Styles (compose into parent) ────────────────────────────────────────────

export const mapNodeStyles = css`
  /* ── Node base ── */
  .node {
    cursor: default;
  }

  /* Ring (outer) */
  .node__ring {
    fill: none;
    stroke: var(--_node-color, var(--_phosphor-dim));
    stroke-width: 1.5;
    transition: stroke-width 150ms, opacity 150ms;
  }

  /* Fill (inner background) */
  .node__fill {
    fill: var(--_screen-bg);
    stroke: none;
  }

  /* Icon container */
  .node__icon {
    color: var(--_node-color, var(--_phosphor-dim));
    pointer-events: none;
  }

  /* ── State: Current room ── */
  .node--current .node__ring {
    stroke-width: 3;
  }

  /* ── State: Adjacent (clickable) ── */
  .node--adjacent {
    cursor: pointer;
  }
  .node--adjacent .node__ring {
    stroke-width: 2;
  }

  /* ── State: Cleared ── */
  .node--cleared {
    opacity: 0.4;
  }
  .node--cleared .node__ring {
    stroke-width: 1;
  }

  /* ── State: Fog of war ── */
  .node--fog {
    opacity: 0.2;
  }
  .node--fog .node__ring {
    stroke-dasharray: 6 4;
  }

  /* ── State: Selected ── */
  .node--selected .node__ring {
    stroke-width: 3;
    stroke-dasharray: none;
  }

  /* ── Cleared checkmark badge ── */
  .node__badge-check {
    stroke: var(--color-success);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }

  /* ── Treasure sparkle particles ── */
  .node__sparkle {
    fill: var(--color-ascendant-gold);
    pointer-events: none;
  }

  /* ── Animations (motion-safe) ── */
  @media (prefers-reduced-motion: no-preference) {
    .node__ring {
      transition: stroke-width 150ms, opacity 150ms, filter 150ms;
    }

    /* Current room: breathing glow */
    .node--current .node__ring {
      animation: map-node-pulse 2s ease-in-out infinite;
    }

    /* Boss room: red danger pulse */
    .node--boss .node__ring {
      animation: map-node-boss-pulse 3s ease-in-out infinite;
    }

    /* Boss room when adjacent: intensified flare */
    .node--boss.node--adjacent .node__ring {
      animation: map-node-boss-flare 1.8s ease-in-out infinite;
    }

    /* Hover/focus: glow */
    .node--adjacent:hover .node__ring,
    .node--adjacent:focus-visible .node__ring {
      stroke-width: 2.5;
      filter: drop-shadow(0 0 4px var(--_node-color, var(--_phosphor-glow)));
    }

    /* Node reveal: scale-in with ring trace */
    .node--just-revealed {
      animation: map-node-reveal 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }
    .node--just-revealed .node__ring {
      stroke-dasharray: 188.5;
      animation: map-node-ring-trace 400ms 200ms ease-out forwards;
    }
    .node--just-revealed .node__icon {
      animation: map-node-icon-fade 300ms ease-out;
    }

    /* Depth transition: sonar ping */
    .node--depth-highlight .node__ring {
      animation: map-node-depth-ping 500ms ease-out;
    }

    /* Fog: subtle pulse */
    .node--fog {
      animation: map-node-fog-breathe 6s ease-in-out infinite;
    }

    /* Treasure shimmer */
    .node__sparkle {
      animation: map-sparkle-twinkle 1.8s ease-in-out var(--_sparkle-delay, 0s) infinite;
      transform-origin: center;
    }

    /* Selected: steady glow */
    .node--selected .node__ring {
      filter: drop-shadow(0 0 6px var(--_node-color, var(--_phosphor-glow)));
    }
  }

  /* ── Keyframes ── */
  @keyframes map-node-pulse {
    0%, 100% {
      filter: drop-shadow(0 0 4px var(--_phosphor-glow))
              drop-shadow(0 0 2px var(--_phosphor));
    }
    50% {
      filter: drop-shadow(0 0 10px var(--_phosphor-glow))
              drop-shadow(0 0 5px var(--_phosphor));
    }
  }

  @keyframes map-node-boss-pulse {
    0%, 100% { filter: drop-shadow(0 0 3px var(--color-danger)); }
    50% {
      filter: drop-shadow(0 0 10px var(--color-danger))
              drop-shadow(0 0 5px var(--color-danger));
    }
  }

  @keyframes map-node-boss-flare {
    0%, 100% {
      filter: drop-shadow(0 0 5px var(--color-danger));
      stroke-width: 2;
    }
    50% {
      filter: drop-shadow(0 0 14px var(--color-danger))
              drop-shadow(0 0 6px var(--color-danger));
      stroke-width: 3;
    }
  }

  @keyframes map-node-reveal {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); }
  }

  @keyframes map-node-ring-trace {
    0% { stroke-dashoffset: 188.5; }
    100% { stroke-dashoffset: 0; }
  }

  @keyframes map-node-icon-fade {
    0%, 40% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes map-node-depth-ping {
    0% { filter: none; }
    35% {
      filter: drop-shadow(0 0 12px var(--_phosphor-glow))
              drop-shadow(0 0 5px var(--_phosphor));
    }
    100% { filter: none; }
  }

  @keyframes map-node-fog-breathe {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.25; }
  }

  @keyframes map-sparkle-twinkle {
    0%, 100% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
  }

  /* ── Focus visible ── */
  .node--adjacent:focus-visible {
    outline: none;
  }
  .node--adjacent:focus-visible .node__ring {
    stroke-width: 3;
    stroke-dasharray: 4 3;
  }
`;

// ── Render Function ─────────────────────────────────────────────────────────

/** Render a single map node as SVG <g> group. */
export function renderMapNode(props: MapNodeProps): SVGTemplateResult {
  const { room, x, y, current, adjacent, justRevealed, depthHighlight, selected, onClick, onDeselect } = props;

  const isBoss = room.room_type === 'boss';
  const isTreasure = room.room_type === 'treasure' && !room.cleared && room.revealed;

  const color = resolveRoomColor(room.room_type, room.revealed, adjacent, room.depth);

  // Build CSS class list
  const cls = [
    'node',
    current ? 'node--current' : '',
    room.cleared ? 'node--cleared' : '',
    !room.revealed ? 'node--fog' : '',
    adjacent ? 'node--adjacent' : '',
    isBoss ? 'node--boss' : '',
    justRevealed ? 'node--just-revealed' : '',
    depthHighlight ? 'node--depth-highlight' : '',
    selected ? 'node--selected' : '',
  ].filter(Boolean).join(' ');

  // Aria label
  const ariaLabel = room.revealed
    ? `${getRoomTypeLabel(room.room_type)} ${msg('room')} ${room.index}${room.cleared ? ` (${msg('cleared')})` : ''}${current ? ` (${msg('current')})` : ''}`
    : msg('Unknown room');

  // Icon
  const iconFn = room.revealed
    ? ROOM_ICON[room.room_type] ?? ROOM_ICON_UNKNOWN
    : ROOM_ICON_UNKNOWN;

  // Event handlers
  const handleClick = () => onClick(room);
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(room);
    }
    if (e.key === 'Escape') {
      onDeselect();
    }
  };

  return svg`
    <g
      class=${cls}
      transform="translate(${x}, ${y})"
      style="--_node-color: ${color}"
      tabindex=${adjacent || room.revealed ? '0' : nothing}
      role=${adjacent ? 'button' : 'img'}
      aria-label=${ariaLabel}
      @click=${handleClick}
      @keydown=${handleKeydown}
    >
      <title>${room.revealed ? getRoomTypeLabel(room.room_type) : msg('Unknown')}</title>

      <!-- Inner fill -->
      <circle r=${FILL_R} class="node__fill" />

      <!-- Outer ring -->
      <circle r=${RING_R} class="node__ring" />

      <!-- Room icon -->
      <g class="node__icon" transform="translate(${ICON_OFFSET}, ${ICON_OFFSET})">
        ${iconFn(ICON_SIZE)}
      </g>

      <!-- Cleared badge: checkmark at top-right -->
      ${room.cleared && !current ? svg`
        <g transform="translate(18, -18)">
          <circle r="7" fill="var(--_screen-bg)" stroke="var(--color-success)" stroke-width="1" />
          <path d="M-3 0 L-1 2 L3 -2" class="node__badge-check" />
        </g>
      ` : nothing}

      <!-- Treasure sparkle particles -->
      ${isTreasure ? svg`
        <g aria-hidden="true">
          ${SPARKLES.map(s => svg`
            <circle cx=${s.cx} cy=${s.cy} r=${s.r} class="node__sparkle"
              style="--_sparkle-delay: ${s.delay}s" />
          `)}
        </g>
      ` : nothing}
    </g>
  `;
}
