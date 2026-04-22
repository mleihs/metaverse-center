/**
 * Dungeon Map Layout Engine — pure function, no DOM, no Lit.
 *
 * Computes node positions for a vertical depth-first DAG layout.
 * Depth axis runs top-to-bottom, branches spread left-to-right.
 * Fully unit-testable.
 *
 * Pattern: Pure data transformation (like dungeon-formatters.ts).
 */

import type { RoomNodeClient } from '../../types/dungeon.js';

// ── Public Types ────────────────────────────────────────────────────────────

export interface MapLayoutConfig {
  nodeRadius: number;
  /** Vertical gap between depth layers (top-to-bottom). */
  vGap: number;
  /** Horizontal gap between nodes in the same depth layer. */
  hGap: number;
  /** Canvas padding around all edges. */
  padding: number;
}

export interface NodePosition {
  room: RoomNodeClient;
  x: number;
  y: number;
}

export interface EdgeDefinition {
  /** Canonical key: `min-max` of room indices. */
  key: string;
  sourceIndex: number;
  targetIndex: number;
  /** Both endpoints revealed? */
  foggy: boolean;
}

export interface MapLayout {
  nodes: NodePosition[];
  edges: EdgeDefinition[];
  width: number;
  height: number;
  /** Effective vertical gap (may be reduced for tall maps). */
  vGap: number;
  /** Effective edge padding used for node positioning. */
  edgePad: number;
}

// ── Default Config ──────────────────────────────────────────────────────────

export const DEFAULT_MAP_CONFIG: MapLayoutConfig = {
  nodeRadius: 30,
  vGap: 100,
  hGap: 76,
  padding: 44,
};

// ── Layout Function ─────────────────────────────────────────────────────────

/**
 * Position nodes in a vertical depth-first DAG.
 *
 * - Y-axis = depth (top-to-bottom), spaced by `config.vGap`
 * - X-axis = branching within a layer, centered horizontally
 * - Each depth layer sorted by room index for stable ordering
 *
 * Also extracts the unique edge list for rendering.
 */
export function layoutDungeonMap(
  rooms: RoomNodeClient[],
  config: MapLayoutConfig = DEFAULT_MAP_CONFIG,
): MapLayout {
  if (rooms.length === 0) {
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      vGap: config.vGap,
      edgePad: config.padding,
    };
  }

  const { nodeRadius, hGap, padding } = config;

  // Effective padding: ensure node rings + cleared badges never clip at edges.
  // Cleared badge extends nodeRadius + 25px from center (translate(18,-18) + r=7).
  const edgePad = Math.max(padding, nodeRadius + 25);

  // ── Group by depth ──────────────────────────────────────────────────────
  const byDepth = new Map<number, RoomNodeClient[]>();
  for (const r of rooms) {
    const arr = byDepth.get(r.depth) ?? [];
    arr.push(r);
    byDepth.set(r.depth, arr);
  }

  // Use sequential layer indices (0, 1, 2, ...) instead of raw depth values
  // to eliminate empty gaps from sparse depths (e.g. rooms at depth 0, 1, 3).
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const maxPerLayer = Math.max(...depths.map((d) => byDepth.get(d)?.length ?? 0), 1);

  // Dynamic vGap: scale vertical spacing so the map never exceeds ~2.5:1
  // height:width ratio. This prevents the sidebar map from becoming a
  // tall narrow column that pushes nodes off-screen.
  // Floor: nodeRadius*2 + 10 so rings never touch.
  const canvasW = Math.max(edgePad * 2 + (maxPerLayer - 1) * hGap, edgePad * 2 + hGap);
  const numGaps = depths.length - 1;
  const maxHeight = canvasW * 3.0;
  const minVGap = nodeRadius * 2 + 10;
  const vGap =
    numGaps > 0
      ? Math.max(minVGap, Math.min(config.vGap, Math.floor((maxHeight - edgePad * 2) / numGaps)))
      : config.vGap;
  const canvasH = Math.max(edgePad * 2 + numGaps * vGap, edgePad * 2);

  // ── Position nodes ────────────────────────────────────────────────────
  const nodes: NodePosition[] = [];

  for (let layerIdx = 0; layerIdx < depths.length; layerIdx++) {
    const depth = depths[layerIdx];
    // biome-ignore lint/style/noNonNullAssertion: `depth` iterates over `depths` which is `Array.from(byDepth.keys())`, so `byDepth.get(depth)` is always defined.
    const layer = byDepth.get(depth)!;
    layer.sort((a, b) => a.index - b.index);

    const layerW = (layer.length - 1) * hGap;
    const startX = (canvasW - layerW) / 2;
    // Use sequential layer index, not raw depth — eliminates empty rows
    const y = edgePad + layerIdx * vGap;

    for (let i = 0; i < layer.length; i++) {
      nodes.push({
        room: layer[i],
        x: startX + i * hGap,
        y,
      });
    }
  }

  // ── Extract edges ─────────────────────────────────────────────────────
  // Pre-build index for O(1) peer lookup (avoids O(n) find per edge)
  const roomByIndex = new Map<number, RoomNodeClient>();
  for (const r of rooms) roomByIndex.set(r.index, r);

  const edgeSet = new Set<string>();
  const edges: EdgeDefinition[] = [];

  for (const room of rooms) {
    for (const ci of room.connections) {
      const key = room.index < ci ? `${room.index}-${ci}` : `${ci}-${room.index}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);

      const peer = roomByIndex.get(ci);
      edges.push({
        key,
        sourceIndex: Math.min(room.index, ci),
        targetIndex: Math.max(room.index, ci),
        foggy: !room.revealed || !peer?.revealed,
      });
    }
  }

  return { nodes, edges, width: canvasW, height: canvasH, vGap, edgePad };
}
