/**
 * Dungeon Map Edge — SVG render module for a single connection line.
 *
 * NOT a custom element (custom elements can't live inside SVG namespace).
 * Instead exports:
 *   - `mapEdgeStyles` — CSS to compose into the parent DungeonMap component
 *   - `renderMapEdge()` — pure function returning SVGTemplateResult
 *
 * Renders an SVG <line> with:
 *   - Fog styling (dashed, low opacity) for unrevealed connections
 *   - Trace animation (stroke-dashoffset draw-in) for newly revealed edges
 *   - Edge spark particle at midpoint
 *
 * Pattern: Render helper module (pure function, no DOM state).
 */

import { css, nothing, svg, type SVGTemplateResult } from 'lit';

// ── Props ───────────────────────────────────────────────────────────────────

export interface MapEdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nodeRadius: number;
  foggy: boolean;
  justTraced: boolean;
}

// ── Styles (compose into parent) ────────────────────────────────────────────

export const mapEdgeStyles = css`
  .edge {
    stroke: var(--_phosphor-dim);
    stroke-width: 1.5;
    opacity: 0.4;
  }

  .edge--fog {
    stroke-dasharray: 4 3;
    opacity: 0.12;
  }

  .edge--just-traced {
    opacity: 0;
  }

  /* Spark particle */
  .edge__spark {
    fill: var(--_phosphor);
    pointer-events: none;
    opacity: 0;
  }

  /* ── Animations (motion-safe) ── */
  @media (prefers-reduced-motion: no-preference) {
    .edge {
      filter: drop-shadow(0 0 1px var(--_phosphor-glow));
    }

    /* Edge trace draw-in */
    .edge--just-traced {
      stroke-dasharray: var(--_edge-len);
      animation: map-edge-trace 500ms ease-out forwards;
    }

    /* Spark particle fade-in at midpoint */
    .edge__spark--active {
      animation: map-edge-spark-fade 600ms 200ms ease-out forwards;
    }
  }

  @keyframes map-edge-trace {
    0% { stroke-dashoffset: var(--_edge-len); opacity: 0.15; }
    100% { stroke-dashoffset: 0; opacity: 0.4; }
  }

  @keyframes map-edge-spark-fade {
    0% { opacity: 0.8; }
    100% { opacity: 0; }
  }
`;

// ── Render Function ─────────────────────────────────────────────────────────

/** Render a single map edge as SVG <line> (+ optional spark). */
export function renderMapEdge(props: MapEdgeProps): SVGTemplateResult | typeof nothing {
  const { x1, y1, x2, y2, nodeRadius, foggy, justTraced } = props;

  // Shorten line to stop at ring edge (not center)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return nothing;

  const offset = nodeRadius / dist;
  const sx = x1 + dx * offset;
  const sy = y1 + dy * offset;
  const ex = x2 - dx * offset;
  const ey = y2 - dy * offset;

  // Edge length for stroke animation
  const edgeLen = Math.max(dist - nodeRadius * 2, 1);

  const cls = [
    'edge',
    foggy ? 'edge--fog' : '',
    justTraced ? 'edge--just-traced' : '',
  ].filter(Boolean).join(' ');

  // Spark at midpoint
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;

  return svg`
    <line
      x1=${sx} y1=${sy}
      x2=${ex} y2=${ey}
      class=${cls}
      style=${justTraced ? `--_edge-len: ${edgeLen}` : nothing}
      aria-hidden="true"
    />
    ${justTraced ? svg`
      <circle
        cx=${midX} cy=${midY} r="2.5"
        class="edge__spark edge__spark--active"
        aria-hidden="true"
      />
    ` : nothing}
  `;
}
