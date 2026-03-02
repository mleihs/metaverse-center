/**
 * Force-directed layout for multiverse map.
 * Supports template nodes (inner ring) and game instance satellites (outer orbit).
 * No external dependencies — Coulomb repulsion + Hooke attraction + centering.
 */

import type { ForceConfig, MapEdgeData, MapNodeData } from './map-types.js';

const DEFAULT_CONFIG: ForceConfig = {
  repulsion: 350000,
  attraction: 0.0003,
  centerForce: 0.001,
  damping: 0.82,
  minDistance: 300,
  nodeRadius: 60,
};

/**
 * Initialize node positions: templates in inner ring, instances orbiting their parent.
 * If `preserveExisting` is provided, only initialize nodes not in that map (new nodes).
 */
export function initializePositions(
  nodes: MapNodeData[],
  width: number,
  height: number,
  preserveExisting?: Map<string, { x: number; y: number }>,
): void {
  const cx = width / 2;
  const cy = height / 2;

  const templates = nodes.filter((n) => n.simulationType !== 'game_instance');
  const instances = nodes.filter((n) => n.simulationType === 'game_instance');

  // Templates in inner ring — large radius so clusters are well-separated
  const templateRadius = Math.min(width, height) * 0.38;
  const templatePositions = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < templates.length; i++) {
    const existing = preserveExisting?.get(templates[i].id);
    if (existing) {
      // Preserve converged position
      templates[i].x = existing.x;
      templates[i].y = existing.y;
      templates[i].vx = 0;
      templates[i].vy = 0;
    } else {
      const angle = (2 * Math.PI * i) / templates.length - Math.PI / 2;
      templates[i].x = cx + templateRadius * Math.cos(angle);
      templates[i].y = cy + templateRadius * Math.sin(angle);
      templates[i].vx = 0;
      templates[i].vy = 0;
    }
    templatePositions.set(templates[i].id, { x: templates[i].x, y: templates[i].y });
  }

  // Group instances by source template
  const instancesByTemplate = new Map<string, MapNodeData[]>();
  for (const inst of instances) {
    const tmplId = inst.sourceTemplateId ?? '';
    if (!instancesByTemplate.has(tmplId)) instancesByTemplate.set(tmplId, []);
    instancesByTemplate.get(tmplId)?.push(inst);
  }

  // Place instances orbiting their parent template.
  // Large orbit radius so instances don't overlap between clusters.
  const baseOrbit = 250;
  const orbitPerInstance = 50; // extra radius per instance in the group
  for (const [tmplId, group] of instancesByTemplate) {
    const parent = templatePositions.get(tmplId);
    const px = parent?.x ?? cx;
    const py = parent?.y ?? cy;
    // Spread outward from center (away from cx, cy)
    const baseAngle = Math.atan2(py - cy, px - cx);
    const orbitRadius = baseOrbit + orbitPerInstance * Math.max(0, group.length - 1);
    for (let i = 0; i < group.length; i++) {
      const existing = preserveExisting?.get(group[i].id);
      if (existing) {
        group[i].x = existing.x;
        group[i].y = existing.y;
        group[i].vx = 0;
        group[i].vy = 0;
      } else {
        // Full circle spread when many instances, otherwise a fan
        const spreadAngle = group.length > 6 ? Math.PI * 2 : Math.PI * 1.2;
        const spread = ((i - (group.length - 1) / 2) / Math.max(group.length, 1)) * spreadAngle;
        const angle = baseAngle + spread;
        group[i].x = px + orbitRadius * Math.cos(angle);
        group[i].y = py + orbitRadius * Math.sin(angle);
        group[i].vx = 0;
        group[i].vy = 0;
      }
    }
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
  // Instances repel each other less (they cluster near templates)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x;
      let dy = nodes[j].y - nodes[i].y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        dx += (Math.random() - 0.5) * 2;
        dy += (Math.random() - 0.5) * 2;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) dist = 0.01;
      }

      // Scale repulsion by node types
      const iIsInstance = nodes[i].simulationType === 'game_instance';
      const jIsInstance = nodes[j].simulationType === 'game_instance';
      let repulsionScale = 1.0;
      if (iIsInstance && jIsInstance) {
        // Same-template siblings: spread in orbit ring
        // Different-template instances: very strong repulsion to keep clusters apart
        repulsionScale = nodes[i].sourceTemplateId === nodes[j].sourceTemplateId ? 0.6 : 1.2;
      } else if (iIsInstance || jIsInstance) {
        // Template↔instance: moderate
        repulsionScale = 0.5;
      }

      const force = (config.repulsion * repulsionScale) / (dist * dist);
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

  // Hooke attraction along edges (skip template_link — orbit spring handles those)
  for (const edge of edges) {
    if (edge.connectionType === 'template_link') continue;
    const si = nodeIndex.get(edge.sourceId);
    const ti = nodeIndex.get(edge.targetId);
    if (si === undefined || ti === undefined) continue;

    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;

    // Weaken attraction between game instances (orbit spring positions them)
    const siIsInstance = nodes[si].simulationType === 'game_instance';
    const tiIsInstance = nodes[ti].simulationType === 'game_instance';
    const attractionScale =
      siIsInstance && tiIsInstance ? 0.15 : siIsInstance || tiIsInstance ? 0.3 : 1.0;

    const force = config.attraction * dist * edge.strength * attractionScale;
    const fdx = (force * dx) / dist;
    const fdy = (force * dy) / dist;

    fx[si] += fdx;
    fy[si] += fdy;
    fx[ti] -= fdx;
    fy[ti] -= fdy;
  }

  // Instance→template orbit: keep game instances at a dynamic orbit distance.
  // Count instances per template to compute group-specific orbit radius.
  const instanceCountByTemplate = new Map<string, number>();
  for (const node of nodes) {
    if (node.simulationType === 'game_instance' && node.sourceTemplateId) {
      instanceCountByTemplate.set(
        node.sourceTemplateId,
        (instanceCountByTemplate.get(node.sourceTemplateId) ?? 0) + 1,
      );
    }
  }
  const baseOrbitDist = 250;
  const orbitPerInst = 45;
  for (let i = 0; i < nodes.length; i++) {
    const tmplId = nodes[i].sourceTemplateId;
    if (nodes[i].simulationType === 'game_instance' && tmplId) {
      const ti = nodeIndex.get(tmplId);
      if (ti !== undefined) {
        const groupSize = instanceCountByTemplate.get(tmplId) ?? 1;
        const orbitDistance = baseOrbitDist + orbitPerInst * Math.max(0, groupSize - 1);
        const adx = nodes[ti].x - nodes[i].x;
        const ady = nodes[ti].y - nodes[i].y;
        const dist = Math.sqrt(adx * adx + ady * ady);
        if (dist > 0.1) {
          // Spring force toward orbit distance (not toward template center)
          const displacement = dist - orbitDistance;
          const springForce = displacement * 0.02;
          fx[i] += (adx / dist) * springForce;
          fy[i] += (ady / dist) * springForce;
        }
      }
    }
  }

  // Center gravity — templates only (very gentle, just prevents drift to edges).
  // Instances rely on orbit spring for positioning, no center gravity needed.
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].simulationType === 'game_instance') continue;
    fx[i] += (cx - nodes[i].x) * config.centerForce;
    fy[i] += (cy - nodes[i].y) * config.centerForce;
  }

  // Apply forces with damping
  let energy = 0;
  const padding = config.nodeRadius + 30;

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
