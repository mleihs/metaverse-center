/**
 * Minimal force-directed layout for 4 nodes.
 * No external dependencies — Coulomb repulsion + Hooke attraction + centering.
 */

import type { ForceConfig, MapEdgeData, MapNodeData } from './map-types.js';

const DEFAULT_CONFIG: ForceConfig = {
  repulsion: 50000,
  attraction: 0.001,
  centerForce: 0.005,
  damping: 0.85,
  minDistance: 140,
  nodeRadius: 60,
};

/**
 * Initialize node positions in a circle around the center.
 */
export function initializePositions(nodes: MapNodeData[], width: number, height: number): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.28;

  for (let i = 0; i < nodes.length; i++) {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    nodes[i].x = cx + radius * Math.cos(angle);
    nodes[i].y = cy + radius * Math.sin(angle);
    nodes[i].vx = 0;
    nodes[i].vy = 0;
  }
}

/**
 * Run one tick of the force simulation.
 * Returns total kinetic energy (use to detect convergence).
 */
export function simulateTick(
  nodes: MapNodeData[],
  edges: MapEdgeData[],
  width: number,
  height: number,
  config: ForceConfig = DEFAULT_CONFIG,
): number {
  const cx = width / 2;
  const cy = height / 2;

  // Reset forces
  const fx = new Float64Array(nodes.length);
  const fy = new Float64Array(nodes.length);

  // Coulomb repulsion between all pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x;
      let dy = nodes[j].y - nodes[i].y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        // Break symmetry when nodes overlap — add random jitter
        dx += (Math.random() - 0.5) * 2;
        dy += (Math.random() - 0.5) * 2;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) dist = 0.01;
      }

      const force = config.repulsion / (dist * dist);
      const nx = dx / dist;
      const ny = dy / dist;

      fx[i] -= force * nx;
      fy[i] -= force * ny;
      fx[j] += force * nx;
      fy[j] += force * ny;
    }
  }

  // Build node index map
  const nodeIndex = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    nodeIndex.set(nodes[i].id, i);
  }

  // Hooke attraction along edges
  for (const edge of edges) {
    const si = nodeIndex.get(edge.sourceId);
    const ti = nodeIndex.get(edge.targetId);
    if (si === undefined || ti === undefined) continue;

    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;

    const force = config.attraction * dist * edge.strength;
    const fdx = (force * dx) / dist;
    const fdy = (force * dy) / dist;

    fx[si] += fdx;
    fy[si] += fdy;
    fx[ti] -= fdx;
    fy[ti] -= fdy;
  }

  // Center gravity
  for (let i = 0; i < nodes.length; i++) {
    fx[i] += (cx - nodes[i].x) * config.centerForce;
    fy[i] += (cy - nodes[i].y) * config.centerForce;
  }

  // Apply forces with damping
  let energy = 0;
  const padding = config.nodeRadius + 10;

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].vx = (nodes[i].vx + fx[i]) * config.damping;
    nodes[i].vy = (nodes[i].vy + fy[i]) * config.damping;

    nodes[i].x += nodes[i].vx;
    nodes[i].y += nodes[i].vy;

    // Clamp to bounds
    nodes[i].x = Math.max(padding, Math.min(width - padding, nodes[i].x));
    nodes[i].y = Math.max(padding, Math.min(height - padding, nodes[i].y));

    energy += nodes[i].vx * nodes[i].vx + nodes[i].vy * nodes[i].vy;
  }

  return energy;
}

/**
 * Run the simulation until convergence or max iterations.
 */
export function runSimulation(
  nodes: MapNodeData[],
  edges: MapEdgeData[],
  width: number,
  height: number,
  maxIterations = 200,
  convergenceThreshold = 0.01,
): void {
  initializePositions(nodes, width, height);

  for (let i = 0; i < maxIterations; i++) {
    const energy = simulateTick(nodes, edges, width, height);
    if (energy < convergenceThreshold) break;
  }
}
