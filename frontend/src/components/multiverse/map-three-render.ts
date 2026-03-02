/**
 * Three.js rendering factories for MapGraph3D.
 *
 * Creates Object3D groups for nodes and materials for edges.
 * All imports are from `three` (bundled with 3d-force-graph).
 */

import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type Texture,
  TextureLoader,
  TorusGeometry,
} from 'three';
import type { MapNodeData } from './map-types.js';

// ── Constants ──────────────────────────────────────────────────────────────

const TEMPLATE_SIZE = 12;
const INSTANCE_SIZE = 6;

export const PHASE_COLORS_3D: Record<string, string> = {
  lobby: '#6b7280',
  foundation: '#3b82f6',
  competition: '#ef4444',
  reckoning: '#f59e0b',
  completed: '#22c55e',
};

// ── Banner Texture Cache ──────────────────────────────────────────────────

const textureCache = new Map<string, InstanceType<typeof Texture>>();
const textureLoader = new TextureLoader();
// Enable CORS for cross-origin images (Supabase storage)
textureLoader.crossOrigin = 'anonymous';

/** Load a banner texture (cached). Applies to sphere material on success.
 *  Reduces emissive intensity so the texture is visible through the glow. */
function loadBannerTexture(url: string, material: MeshLambertMaterial): void {
  const apply = (texture: InstanceType<typeof Texture>) => {
    material.map = texture;
    material.emissiveIntensity = 0.1; // dim emissive so texture shows through
    material.needsUpdate = true;
  };

  const cached = textureCache.get(url);
  if (cached) {
    apply(cached);
    return;
  }
  textureLoader.load(
    url,
    (texture) => {
      textureCache.set(url, texture);
      apply(texture);
    },
    undefined,
    () => {
      // Load failed — keep solid color (current behavior)
    },
  );
}

// ── Node Object Factories ──────────────────────────────────────────────────

/** Create a Three.js Group for a template simulation node. */
export function createTemplateNodeObject(node: MapNodeData): Group {
  const group = new Group();
  const color = new Color(node.color);

  // Core sphere — slightly emissive, gets banner texture if available
  const coreMat = new MeshLambertMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.9,
  });
  const coreGeo = new SphereGeometry(TEMPLATE_SIZE, 32, 32);
  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  // Load banner texture onto sphere
  if (node.bannerUrl) {
    loadBannerTexture(node.bannerUrl, coreMat);
  }

  // Outer glow shell — transparent, larger
  const glowMat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
  });
  const glowGeo = new SphereGeometry(TEMPLATE_SIZE * 1.6, 16, 16);
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  // Wireframe ring — orbital feel
  const ringGeo = new RingGeometry(TEMPLATE_SIZE * 1.3, TEMPLATE_SIZE * 1.35, 48);
  const ringMat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: 2, // DoubleSide
  });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Label sprite (scale set internally based on text width)
  const labelSprite = createLabelSprite(node.name.toUpperCase(), node.color);
  labelSprite.position.set(0, -TEMPLATE_SIZE - 6, 0);
  group.add(labelSprite);

  // Active epoch count badge
  if (node.activeInstanceCount && node.activeInstanceCount > 0) {
    const badgeGeo = new SphereGeometry(2.5, 16, 16);
    const badgeMat = new MeshBasicMaterial({ color: 0xef4444 });
    const badge = new Mesh(badgeGeo, badgeMat);
    badge.position.set(TEMPLATE_SIZE - 2, TEMPLATE_SIZE - 2, 0);
    group.add(badge);

    const countSprite = createLabelSprite(String(node.activeInstanceCount), '#ffffff', 10);
    countSprite.position.set(TEMPLATE_SIZE - 2, TEMPLATE_SIZE - 2, 3);
    group.add(countSprite);
  }

  // Store node reference for animation updates
  group.userData = { nodeType: 'template', color: node.color, glow, ring, core };

  return group;
}

/** Create a Three.js Group for a game instance node. */
export function createInstanceNodeObject(node: MapNodeData): Group {
  const group = new Group();
  const color = new Color(node.color);
  const phaseColor = new Color(PHASE_COLORS_3D[node.epochStatus ?? 'lobby'] ?? '#6b7280');
  const isCompleted = node.epochStatus === 'completed';

  // Core sphere
  const coreMat = new MeshLambertMaterial({
    color,
    emissive: color,
    emissiveIntensity: isCompleted ? 0.1 : 0.5,
    transparent: true,
    opacity: isCompleted ? 0.35 : 0.85,
  });
  const coreGeo = new SphereGeometry(INSTANCE_SIZE, 24, 24);
  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  // Load banner texture onto instance sphere
  if (node.bannerUrl) {
    loadBannerTexture(node.bannerUrl, coreMat);
  }

  // Phase-colored torus ring
  let torus: Mesh | undefined;
  if (!isCompleted) {
    const torusGeo = new TorusGeometry(INSTANCE_SIZE * 1.5, 0.4, 8, 32);
    const torusMat = new MeshBasicMaterial({
      color: phaseColor,
      transparent: true,
      opacity: 0.6,
    });
    torus = new Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2;
    group.add(torus);
  }

  // Label sprite (smaller for instances, scale set internally)
  const labelSprite = createLabelSprite(node.name.toUpperCase(), node.color, 9);
  labelSprite.position.set(0, -INSTANCE_SIZE - 4, 0);
  group.add(labelSprite);

  group.userData = {
    nodeType: 'instance',
    color: node.color,
    isCompleted,
    phaseColor: PHASE_COLORS_3D[node.epochStatus ?? 'lobby'],
    torus,
    core,
  };

  return group;
}

/** Dispatch to correct factory based on node type. */
export function createNodeObject(node: MapNodeData): Group {
  return node.simulationType === 'game_instance'
    ? createInstanceNodeObject(node)
    : createTemplateNodeObject(node);
}

// ── Node Animations ─────────────────────────────────────────────────────

/**
 * Animate node objects each frame. Call from onEngineTick or rAF loop.
 * @param nodeObjects - Map of node ID → Three.js Group (from graph internals)
 * @param time - elapsed time in seconds (e.g. performance.now() / 1000)
 */
export function animateNodes(nodeObjects: Map<string, Group>, time: number): void {
  for (const [, obj] of nodeObjects) {
    const ud = obj.userData;

    if (ud.nodeType === 'template') {
      // Orbital ring: slow Y-axis rotation
      if (ud.ring) {
        (ud.ring as Mesh).rotation.z += 0.003;
      }
      // Glow shell: sinusoidal opacity pulsing
      if (ud.glow) {
        const mat = (ud.glow as Mesh).material as MeshBasicMaterial;
        mat.opacity = 0.05 + Math.sin(time * 1.2) * 0.04;
      }
    } else if (ud.nodeType === 'instance' && !ud.isCompleted) {
      // Instance torus: rotate around Y axis
      if (ud.torus) {
        (ud.torus as Mesh).rotation.z += 0.01;
      }
      // Instance core emissive: pulse intensity based on phase
      if (ud.core) {
        const mat = (ud.core as Mesh).material as MeshLambertMaterial;
        mat.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.2;
      }
    }
  }
}

// ── Starfield Particles ────────────────────────────────────────────────────

/** Create a particle starfield as a Points object. */
export function createStarfield(count = 2000, spread = 3000): Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    sizes[i] = Math.random() * 1.5 + 0.3;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));

  // Simple point material — white stars
  const material = new PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });

  return new Points(geometry, material);
}

// ── Label Sprite ───────────────────────────────────────────────────────────

function createLabelSprite(text: string, color: string, fontSize = 11): Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Sprite();

  const font = `900 ${fontSize * 3}px monospace`;
  ctx.font = font;
  // Measure text width dynamically to avoid truncation on long names
  const measured = ctx.measureText(text);
  const padding = 24;
  const w = Math.max(256, Math.ceil(measured.width) + padding);
  canvas.width = w;
  canvas.height = 64;

  // Re-set font after canvas resize (resets context state)
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Dark outline for readability
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, w / 2, 32);

  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, 32);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new Sprite(material);
  // Scale sprite width proportional to canvas width so text isn't stretched
  sprite.scale.set((w / 256) * 40, 10, 1);
  return sprite;
}

// ── Edge Colors ────────────────────────────────────────────────────────────

/** Get link color based on connection type. */
export function getLinkColor(link: { connectionType: string; isEmbassy?: boolean }): string {
  if (link.isEmbassy) return '#f97316';
  if (link.connectionType === 'template_link') return '#333333';
  return '#555555';
}

/** Get link width based on type and operative heat. */
export function getLinkWidth(link: {
  connectionType: string;
  isEmbassy?: boolean;
  operativeHeat?: number;
}): number {
  if (link.isEmbassy) return 2;
  if (link.connectionType === 'template_link') return 0.5;
  const heat = link.operativeHeat ?? 0;
  return 0.8 + Math.min(heat, 8) * 0.2;
}
