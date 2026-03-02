// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Group, Mesh, Points, Sprite } from 'three';
import {
  PHASE_COLORS_3D,
  createInstanceNodeObject,
  createNodeObject,
  createStarfield,
  createTemplateNodeObject,
  getLinkColor,
  getLinkWidth,
} from '../src/components/multiverse/map-three-render.js';
import type { MapNodeData } from '../src/components/multiverse/map-types.js';

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// PHASE_COLORS_3D
// ---------------------------------------------------------------------------

describe('PHASE_COLORS_3D', () => {
  it('should have entries for all 5 epoch phases', () => {
    const phases = ['lobby', 'foundation', 'competition', 'reckoning', 'completed'];
    for (const phase of phases) {
      expect(PHASE_COLORS_3D[phase]).toBeDefined();
      expect(PHASE_COLORS_3D[phase]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should have exactly 5 entries', () => {
    expect(Object.keys(PHASE_COLORS_3D)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// createTemplateNodeObject
// ---------------------------------------------------------------------------

describe('createTemplateNodeObject', () => {
  it('should return a Three.js Group', () => {
    const node = createNode('t', { simulationType: 'template' });
    const group = createTemplateNodeObject(node);
    expect(group).toBeInstanceOf(Group);
  });

  it('should contain at least a core mesh, glow mesh, ring mesh, and label sprite', () => {
    const node = createNode('t', { simulationType: 'template' });
    const group = createTemplateNodeObject(node);
    expect(group.children.length).toBeGreaterThanOrEqual(4);

    const meshes = group.children.filter((c) => c instanceof Mesh);
    const sprites = group.children.filter((c) => c instanceof Sprite);
    expect(meshes.length).toBeGreaterThanOrEqual(3); // core + glow + ring
    expect(sprites.length).toBeGreaterThanOrEqual(1); // label
  });

  it('should store nodeType "template" in userData', () => {
    const node = createNode('t', { simulationType: 'template' });
    const group = createTemplateNodeObject(node);
    expect(group.userData.nodeType).toBe('template');
  });

  it('should store the node color in userData', () => {
    const node = createNode('t', { color: '#3b82f6' });
    const group = createTemplateNodeObject(node);
    expect(group.userData.color).toBe('#3b82f6');
  });

  it('should use the node name for the label sprite', () => {
    const node = createNode('t', { name: 'Velgarien' });
    const group = createTemplateNodeObject(node);
    // The label sprite is the last child
    const sprites = group.children.filter((c) => c instanceof Sprite);
    expect(sprites.length).toBeGreaterThan(0);
    // Position should be below the node (negative y)
    expect(sprites[0].position.y).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// createInstanceNodeObject
// ---------------------------------------------------------------------------

describe('createInstanceNodeObject', () => {
  it('should return a Three.js Group', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'competition' });
    const group = createInstanceNodeObject(node);
    expect(group).toBeInstanceOf(Group);
  });

  it('should include a torus ring for non-completed instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'foundation' });
    const group = createInstanceNodeObject(node);
    // Should have core mesh + torus mesh + label sprite = 3 children
    expect(group.children.length).toBeGreaterThanOrEqual(3);
  });

  it('should NOT include a torus ring for completed instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'completed' });
    const group = createInstanceNodeObject(node);
    // Should have core mesh + label sprite = 2 children (no torus)
    expect(group.children.length).toBe(2);
  });

  it('should store isCompleted=true in userData for completed instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'completed' });
    const group = createInstanceNodeObject(node);
    expect(group.userData.isCompleted).toBe(true);
  });

  it('should store isCompleted=false in userData for active instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'competition' });
    const group = createInstanceNodeObject(node);
    expect(group.userData.isCompleted).toBe(false);
  });

  it('should set reduced opacity for completed instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'completed' });
    const group = createInstanceNodeObject(node);
    const coreMesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const material = coreMesh.material as { opacity: number };
    expect(material.opacity).toBeLessThan(0.5); // completed = 0.35
  });

  it('should set higher opacity for active instances', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'competition' });
    const group = createInstanceNodeObject(node);
    const coreMesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const material = coreMesh.material as { opacity: number };
    expect(material.opacity).toBeGreaterThan(0.5); // active = 0.85
  });
});

// ---------------------------------------------------------------------------
// createNodeObject (dispatch)
// ---------------------------------------------------------------------------

describe('createNodeObject', () => {
  it('should create instance node for game_instance type', () => {
    const node = createNode('i', { simulationType: 'game_instance', epochStatus: 'lobby' });
    const group = createNodeObject(node);
    expect(group.userData.nodeType).toBe('instance');
  });

  it('should create template node for template type', () => {
    const node = createNode('t', { simulationType: 'template' });
    const group = createNodeObject(node);
    expect(group.userData.nodeType).toBe('template');
  });

  it('should default to template node when simulationType is undefined', () => {
    const node = createNode('n');
    const group = createNodeObject(node);
    expect(group.userData.nodeType).toBe('template');
  });
});

// ---------------------------------------------------------------------------
// createStarfield
// ---------------------------------------------------------------------------

describe('createStarfield', () => {
  it('should return a Three.js Points object', () => {
    const starfield = createStarfield(100, 500);
    expect(starfield).toBeInstanceOf(Points);
  });

  it('should have position attribute with 3 components per star', () => {
    const count = 200;
    const starfield = createStarfield(count, 1000);
    const positions = starfield.geometry.getAttribute('position');
    expect(positions.count).toBe(count);
    expect(positions.itemSize).toBe(3);
  });

  it('should have size attribute with 1 component per star', () => {
    const count = 150;
    const starfield = createStarfield(count, 1000);
    const sizes = starfield.geometry.getAttribute('size');
    expect(sizes.count).toBe(count);
    expect(sizes.itemSize).toBe(1);
  });

  it('should use default values when called without arguments', () => {
    const starfield = createStarfield();
    const positions = starfield.geometry.getAttribute('position');
    expect(positions.count).toBe(2000); // default count
  });

  it('should spread stars within the specified range', () => {
    const spread = 500;
    const starfield = createStarfield(1000, spread);
    const positions = starfield.geometry.getAttribute('position');
    const halfSpread = spread / 2;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      expect(Math.abs(x)).toBeLessThanOrEqual(halfSpread);
      expect(Math.abs(y)).toBeLessThanOrEqual(halfSpread);
      expect(Math.abs(z)).toBeLessThanOrEqual(halfSpread);
    }
  });
});

// ---------------------------------------------------------------------------
// getLinkColor
// ---------------------------------------------------------------------------

describe('getLinkColor', () => {
  it('should return orange for embassy links', () => {
    expect(getLinkColor({ connectionType: 'embassy', isEmbassy: true })).toBe('#f97316');
  });

  it('should return dark gray for template_link', () => {
    expect(getLinkColor({ connectionType: 'template_link' })).toBe('#333333');
  });

  it('should return medium gray for regular connections', () => {
    expect(getLinkColor({ connectionType: 'echo' })).toBe('#555555');
  });

  it('should prioritize isEmbassy over connectionType', () => {
    expect(getLinkColor({ connectionType: 'template_link', isEmbassy: true })).toBe('#f97316');
  });
});

// ---------------------------------------------------------------------------
// getLinkWidth
// ---------------------------------------------------------------------------

describe('getLinkWidth', () => {
  it('should return 2 for embassy links', () => {
    expect(getLinkWidth({ connectionType: 'embassy', isEmbassy: true })).toBe(2);
  });

  it('should return 0.5 for template_link', () => {
    expect(getLinkWidth({ connectionType: 'template_link' })).toBe(0.5);
  });

  it('should increase width with operative heat', () => {
    const widthLow = getLinkWidth({ connectionType: 'echo', operativeHeat: 1 });
    const widthHigh = getLinkWidth({ connectionType: 'echo', operativeHeat: 6 });
    expect(widthHigh).toBeGreaterThan(widthLow);
  });

  it('should cap heat contribution at 8', () => {
    const widthAt8 = getLinkWidth({ connectionType: 'echo', operativeHeat: 8 });
    const widthAt20 = getLinkWidth({ connectionType: 'echo', operativeHeat: 20 });
    expect(widthAt20).toBe(widthAt8); // capped at min(heat, 8)
  });

  it('should return base width when no heat', () => {
    const width = getLinkWidth({ connectionType: 'echo', operativeHeat: 0 });
    expect(width).toBe(0.8); // 0.8 + 0 * 0.2
  });

  it('should default to 0 heat when undefined', () => {
    const width = getLinkWidth({ connectionType: 'echo' });
    expect(width).toBe(0.8);
  });
});
