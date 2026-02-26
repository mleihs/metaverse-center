import { describe, expect, it } from 'vitest';
import { initializePositions, runSimulation, simulateTick } from '../src/components/multiverse/map-force.js';
import type { MapEdgeData, MapNodeData } from '../src/components/multiverse/map-types.js';

// ---------------------------------------------------------------------------
// Helpers — create test nodes and edges
// ---------------------------------------------------------------------------

function createNode(id: string, overrides: Partial<MapNodeData> = {}): MapNodeData {
  return {
    id,
    name: `Sim ${id}`,
    slug: `sim-${id}`,
    theme: 'dystopian',
    agentCount: 5,
    buildingCount: 3,
    eventCount: 10,
    echoCount: 2,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    color: '#ef4444',
    ...overrides,
  };
}

function createEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<MapEdgeData> = {},
): MapEdgeData {
  return {
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    connectionType: 'echo',
    bleedVectors: ['memory'],
    strength: 0.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// initializePositions
// ---------------------------------------------------------------------------

describe('initializePositions', () => {
  it('should assign x and y coordinates to all nodes', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')];
    initializePositions(nodes, 800, 600);

    for (const node of nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it('should place all nodes within the canvas bounds', () => {
    const width = 800;
    const height = 600;
    const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')];
    initializePositions(nodes, width, height);

    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(height);
    }
  });

  it('should reset velocities to zero', () => {
    const nodes = [createNode('a', { vx: 10, vy: -5 }), createNode('b', { vx: 3, vy: 7 })];
    initializePositions(nodes, 800, 600);

    for (const node of nodes) {
      expect(node.vx).toBe(0);
      expect(node.vy).toBe(0);
    }
  });

  it('should distribute nodes in a circle (not stacked on same point)', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')];
    initializePositions(nodes, 800, 600);

    // Check that no two nodes share the same position
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(1);
      }
    }
  });

  it('should handle a single node (placed at top of circle)', () => {
    const nodes = [createNode('a')];
    initializePositions(nodes, 800, 600);

    // Single node should be at center-x, above center-y (angle = -PI/2)
    expect(nodes[0].x).toBeCloseTo(400, 0);
    expect(nodes[0].y).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------
// simulateTick
// ---------------------------------------------------------------------------

describe('simulateTick', () => {
  it('should return kinetic energy as a positive number', () => {
    const nodes = [createNode('a'), createNode('b')];
    const edges: MapEdgeData[] = [];
    initializePositions(nodes, 800, 600);

    const energy = simulateTick(nodes, edges, 800, 600);
    expect(energy).toBeGreaterThanOrEqual(0);
  });

  it('should move nodes from their initial positions (forces are applied)', () => {
    const nodes = [
      createNode('a', { x: 200, y: 300, vx: 0, vy: 0 }),
      createNode('b', { x: 600, y: 300, vx: 0, vy: 0 }),
    ];
    const edges: MapEdgeData[] = [];

    const ax0 = nodes[0].x;
    const bx0 = nodes[1].x;
    simulateTick(nodes, edges, 800, 600);

    // Both nodes should have moved (forces applied — repulsion + center gravity)
    expect(nodes[0].x).not.toBe(ax0);
    expect(nodes[1].x).not.toBe(bx0);
    // Node a is left of center, center force pulls it right; node b is right, pulled left
    expect(nodes[0].x).toBeGreaterThan(ax0);
    expect(nodes[1].x).toBeLessThan(bx0);
  });

  it('should keep nodes within canvas bounds after tick', () => {
    const width = 800;
    const height = 600;
    const nodes = [
      createNode('a', { x: 5, y: 5, vx: -100, vy: -100 }),
      createNode('b', { x: 795, y: 595, vx: 100, vy: 100 }),
    ];
    const edges: MapEdgeData[] = [];

    simulateTick(nodes, edges, width, height);

    for (const node of nodes) {
      // Clamped to padding = nodeRadius + 10 = 70
      expect(node.x).toBeGreaterThanOrEqual(70);
      expect(node.x).toBeLessThanOrEqual(width - 70);
      expect(node.y).toBeGreaterThanOrEqual(70);
      expect(node.y).toBeLessThanOrEqual(height - 70);
    }
  });

  it('should apply attraction along edges (connected nodes drift closer)', () => {
    // Place nodes far apart with an edge connecting them
    const nodes = [
      createNode('a', { x: 100, y: 300, vx: 0, vy: 0 }),
      createNode('b', { x: 700, y: 300, vx: 0, vy: 0 }),
    ];
    const edges = [createEdge('a', 'b', { strength: 2.0 })];

    const initialDist = Math.abs(nodes[1].x - nodes[0].x);
    // Run several ticks to overcome initial repulsion at large distance
    for (let i = 0; i < 20; i++) {
      simulateTick(nodes, edges, 800, 600);
    }
    const finalDist = Math.abs(nodes[1].x - nodes[0].x);

    expect(finalDist).toBeLessThan(initialDist);
  });

  it('should decrease energy over iterations (damping converges)', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges = [createEdge('a', 'b'), createEdge('b', 'c')];
    initializePositions(nodes, 800, 600);

    const energies: number[] = [];
    for (let i = 0; i < 50; i++) {
      energies.push(simulateTick(nodes, edges, 800, 600));
    }

    // Energy at end should be lower than at start (simulation converges)
    expect(energies[energies.length - 1]).toBeLessThan(energies[0]);
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

describe('runSimulation', () => {
  it('should produce valid finite positions for all nodes after full simulation', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')];
    const edges = [createEdge('a', 'b'), createEdge('c', 'd')];

    runSimulation(nodes, edges, 800, 600);

    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(800);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(600);
    }
  });

  it('should keep all nodes within canvas bounds', () => {
    const width = 800;
    const height = 600;
    const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')];
    const edges = [createEdge('a', 'b'), createEdge('b', 'c'), createEdge('c', 'd')];

    runSimulation(nodes, edges, width, height);

    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(height);
    }
  });

  it('should converge within max iterations', () => {
    const nodes = [createNode('a'), createNode('b')];
    const edges = [createEdge('a', 'b')];

    // Should not throw or hang
    runSimulation(nodes, edges, 800, 600, 100, 0.01);

    // After convergence, nodes should have valid positions
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('should handle empty node array without error', () => {
    const nodes: MapNodeData[] = [];
    const edges: MapEdgeData[] = [];

    // Should not throw
    expect(() => runSimulation(nodes, edges, 800, 600)).not.toThrow();
  });

  it('should handle nodes with no edges (repulsion only converges)', () => {
    const nodes = [createNode('a'), createNode('b'), createNode('c')];
    const edges: MapEdgeData[] = [];

    runSimulation(nodes, edges, 800, 600);

    // All nodes should converge to valid finite positions within bounds
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(800);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(600);
    }

    // Velocities should have converged to near-zero
    for (const node of nodes) {
      expect(Math.abs(node.vx)).toBeLessThan(1);
      expect(Math.abs(node.vy)).toBeLessThan(1);
    }
  });
});
