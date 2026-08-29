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
import { css, nothing, type SVGTemplateResult, svg } from 'lit';

import type { RoomNodeClient } from '../../types/dungeon.js';
import {
  ROOM_ICON,
  ROOM_ICON_UNKNOWN,
  resolveRoomColor,
  roomNodeLabel,
} from './dungeon-map-icons.js';

// ── Constants ───────────────────────────────────────────────────────────────

const RING_R = 30;
const FILL_R = 24;
const ICON_SIZE = 20;
const ICON_OFFSET = -ICON_SIZE / 2;

/**
 * Selection reticle geometry.
 *
 * Half-width of the bracket square and the arm length of each corner. 34 sits
 * outside the ring (30) and inside the "you are here" beacon (37), so a room
 * that is both current and selected still shows two separate marks. The layout
 * engine guarantees 55px of edge padding around every node centre
 * (`edgePad = max(padding, nodeRadius + 25)`), so nothing here can clip.
 */
const SELECT_HALF = RING_R + 4;
const SELECT_ARM = 9;

/** The four corner brackets, as SVG path data around the node centre. */
const SELECT_BRACKETS: readonly string[] = [
  `M${-SELECT_HALF} ${-SELECT_HALF + SELECT_ARM} L${-SELECT_HALF} ${-SELECT_HALF} L${-SELECT_HALF + SELECT_ARM} ${-SELECT_HALF}`,
  `M${SELECT_HALF - SELECT_ARM} ${-SELECT_HALF} L${SELECT_HALF} ${-SELECT_HALF} L${SELECT_HALF} ${-SELECT_HALF + SELECT_ARM}`,
  `M${SELECT_HALF} ${SELECT_HALF - SELECT_ARM} L${SELECT_HALF} ${SELECT_HALF} L${SELECT_HALF - SELECT_ARM} ${SELECT_HALF}`,
  `M${-SELECT_HALF + SELECT_ARM} ${SELECT_HALF} L${-SELECT_HALF} ${SELECT_HALF} L${-SELECT_HALF} ${SELECT_HALF - SELECT_ARM}`,
];

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
  /** Deluge: room affected by rising water (water_level >= 50). */
  submerged?: boolean;
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

  /* Fill (inner background) — lifted a touch off pure screen-bg so the disc
     separates from the backdrop (it used to vanish against dark scenes). */
  .node__fill {
    fill: color-mix(in srgb, var(--_phosphor) 7%, var(--_screen-bg));
    stroke: none;
  }

  /* "You are here" beacon — a static halo ring behind the current node. Reads
     clearly even under reduced motion (the breathing glow is motion-only). */
  .node__beacon {
    fill: none;
    stroke: var(--_phosphor);
    stroke-width: 1.5;
    opacity: 0.55;
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
  /* Tinted disc so the current room glows from within — a reduced-motion-safe
     "you are here" cue independent of the breathing animation. */
  .node--current .node__fill {
    fill: color-mix(in srgb, var(--_phosphor) 16%, var(--_screen-bg));
  }

  /* ── State: Adjacent (clickable) ── */
  .node--adjacent {
    cursor: pointer;
  }
  .node--adjacent .node__ring {
    stroke-width: 2;
  }

  /* ── State: Cleared ── */
  /* Visited rooms stay legible (was 0.65 → faded into the backdrop). */
  .node--cleared {
    opacity: 0.8;
  }
  .node--cleared .node__ring {
    stroke-width: 1.5;
  }

  /* ── State: Fog of war ── */
  .node--fog {
    opacity: 0.2;
  }
  .node--fog .node__ring {
    stroke-dasharray: 6 4;
  }

  /* ── State: Selected ── */
  /* Selection gets its own channel instead of borrowing one.
     The ring's STROKE already carries the room TYPE — gold treasure, red boss,
     blue encounter, amber elite, and for unrevealed rooms a depth-risk tint —
     so recolouring it to mark selection would overwrite information the player
     is selecting the room in order to read. The old rule set stroke-width 3
     and nothing else, which is exactly what .node--current sets: the selected
     node was not distinguishable from the one you are standing in, and under
     reduced motion not distinguishable from anything at all, because the only
     colour it ever had was a drop-shadow inside a motion query.
     Four corner brackets in the neutral text colour — a colour that appears
     nowhere in ROOM_COLOR — mark the picked node without touching the type
     reading. They are drawn geometry, not a filter, so reduced motion keeps
     them. */
  .node--selected .node__ring {
    stroke-width: 3;
    stroke-dasharray: none;
  }

  .node__reticle path {
    fill: none;
    stroke: var(--color-text-primary);
    stroke-width: 1.5;
    stroke-linecap: square;
    stroke-linejoin: miter;
  }

  /* ── State: Submerged (Deluge water overlay) ── */
  .node--submerged .node__fill {
    fill: color-mix(in srgb, var(--color-info, #60a5fa) 25%, var(--_screen-bg, #0a0e14));
  }
  .node--submerged .node__ring {
    stroke: color-mix(in srgb, var(--color-info, #60a5fa) 40%, var(--_phosphor, #e0c97a));
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

    /* Current room beacon: gentle breathing opacity (static fallback handled
       by the base .node__beacon rule for reduced motion). */
    .node--current .node__beacon {
      animation: map-node-beacon 2.4s ease-in-out infinite;
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

    /* Node reveal: scale-in with ring trace.
       The animation runs on .node__body, NOT on .node. The outer group carries
       transform="translate(x, y)" as a presentation attribute, and a CSS
       transform in a keyframe does not compose with that attribute — it
       REPLACES it, because a presentation attribute is the lowest-priority
       style for the very same property. Measured, not assumed: a scaled group
       authored at x=250 drew at x=1, and its CTM read e=0 f=0 against the
       control's e=100 f=100. Every freshly revealed room was therefore drawn in
       the corner of the map, while its reveal ripple (rendered by DungeonMap at
       the room's own coordinates) stayed correctly in place — and the node
       stayed in the corner until the next render, because the newly-revealed
       set is only cleared in the FOLLOWING willUpdate. It went unnoticed
       because this whole block is inside a prefers-reduced-motion query.
       The inner group has no transform attribute, so the keyframe owns the
       property outright. fill-box + center is exact here: every element of a
       node is a circle centred on the local origin (ring 30, beacon 37,
       reticle 34) or lies strictly inside the r=30 ring (cleared badge,
       sparkles, icon), so the bounding box is always origin-centred. */
    .node--just-revealed .node__body {
      transform-box: fill-box;
      transform-origin: center;
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

    /* Reticle lock-on: each bracket draws itself out of its corner, 30ms after
       the one before, so selection reads as an instrument acquiring rather than
       a box appearing. Dash length is the full path (2 * SELECT_ARM = 18).
       The "both" fill mode is safe on these paths: they carry no transform
       presentation attribute for a CSS transform to overwrite. */
    .node__reticle path {
      stroke-dasharray: 18;
      stroke-dashoffset: 18;
      animation: map-node-reticle-lock 180ms var(--ease-snap, cubic-bezier(0.22, 1, 0.36, 1)) both;
      animation-delay: calc(var(--_bracket, 0) * 30ms);
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

  @keyframes map-node-beacon {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.7; }
  }

  @keyframes map-node-reticle-lock {
    to { stroke-dashoffset: 0; }
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
  const {
    room,
    x,
    y,
    current,
    adjacent,
    justRevealed,
    depthHighlight,
    selected,
    submerged,
    onClick,
    onDeselect,
  } = props;

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
    submerged && room.revealed ? 'node--submerged' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Aria label. Selection is announced as well as drawn: the reticle is the
  // only cue that the detail panel below belongs to THIS node, and a cue that
  // exists solely as geometry reaches nobody using a screen reader.
  const selectedTag = selected ? ` (${msg('selected')})` : '';
  const typeLabel = roomNodeLabel(room);
  const ariaLabel = room.revealed
    ? `${typeLabel} ${msg('room')} ${room.index}${room.cleared ? ` (${msg('cleared')})` : ''}${current ? ` (${msg('current')})` : ''}${selectedTag}`
    : `${msg('Unknown room')}${selectedTag}`;

  // Icon
  const iconFn = room.revealed
    ? (ROOM_ICON[room.room_type] ?? ROOM_ICON_UNKNOWN)
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
      <title>${typeLabel}</title>

      <!-- Everything drawable sits one level in, on .node__body. The outer
           group owns the POSITION (transform="translate(…)" as a presentation
           attribute) and the semantics (role, aria-label, title, handlers); the
           inner group owns whatever CSS wants to transform. Keeping those apart
           is not tidiness: a keyframe that animates the transform property on
           the outer group silently replaces the translate and parks the node
           in the corner of the map. See .node--just-revealed above. -->
      <g class="node__body">

      <!-- "You are here" beacon halo (behind the disc) -->
      ${current ? svg`<circle r=${RING_R + 7} class="node__beacon" aria-hidden="true" />` : nothing}

      <!-- Inner fill -->
      <circle r=${FILL_R} class="node__fill" />

      <!-- Outer ring -->
      <circle r=${RING_R} class="node__ring" />

      <!-- Room icon -->
      <g class="node__icon" transform="translate(${ICON_OFFSET}, ${ICON_OFFSET})">
        ${iconFn(ICON_SIZE)}
      </g>

      <!-- Cleared badge: checkmark at top-right (shown even on current room) -->
      ${
        room.cleared
          ? svg`
        <g transform="translate(18, -18)">
          <circle r="7" fill="var(--_screen-bg)" stroke="var(--color-success)" stroke-width="1" />
          <path d="M-3 0 L-1 2 L3 -2" class="node__badge-check" />
        </g>
      `
          : nothing
      }

      <!-- Treasure sparkle particles -->
      ${
        isTreasure
          ? svg`
        <g aria-hidden="true">
          ${SPARKLES.map(
            (s) => svg`
            <circle cx=${s.cx} cy=${s.cy} r=${s.r} class="node__sparkle"
              style="--_sparkle-delay: ${s.delay}s" />
          `,
          )}
        </g>
      `
          : nothing
      }

      <!-- Selection reticle: last, so nothing paints over the mark -->
      ${
        selected
          ? svg`
        <g class="node__reticle" aria-hidden="true">
          ${SELECT_BRACKETS.map((d, i) => svg`<path d=${d} style="--_bracket: ${i}" />`)}
        </g>
      `
          : nothing
      }
      </g>
    </g>
  `;
}
