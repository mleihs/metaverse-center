import * as THREE from 'three';

import type { DriftChart, DriftChartNode } from '../../../types/drift.js';
import type { FrameCtx } from '../chart/types.js';

/**
 * The playable graph layer — the real drift_chart_nodes/edges rendered as an
 * interactive board (concept §6/§7.7, plan §11). Distinct from the spike's ambient
 * `nodes`/`corridors` (random scatter): these are THE gameplay nodes at their
 * server-assigned world coordinates, picked by click to move.
 *
 * Built on the verified spike node shader (frequency-crossfade glow, additive
 * blend) with one added per-instance attribute, `aState`, driving the gameplay
 * highlight: 0 = reachable-elsewhere (calm), 1 = the traveler's position (a steady
 * pulsing beacon), 2 = adjacent + clickable (an inviting ring). Edges are additive
 * line segments; corridor edges (Strömungsbänder) read brighter than open Drift.
 *
 * Node-type → glyph weight: broadcast_rand homes render larger and steadier (a
 * dockable edge), interstitials smaller. Mapping mirrors the chart node_type CHECK.
 */

// drift_chart_nodes.node_type → a shader `aType` flavor index + a base size.
const NODE_TYPE_INDEX: Record<string, number> = {
  broadcast_rand: 0, // home / dockable edge — steadiest
  relais: 1,
  echo_untiefe: 2,
  geisterinsel: 3,
  traeger_wrack: 4,
  splitterfaenger_revier: 5,
  resonanzsturm: 6,
  interstitial: 0,
};
const NODE_BASE_SIZE: Record<string, number> = {
  broadcast_rand: 26,
  relais: 18,
  interstitial: 14,
};
const DEFAULT_NODE_SIZE = 16;

// Per-instance gameplay state (matches the shader `aState` switch).
export const NODE_STATE = { CALM: 0, POSITION: 1, ADJACENT: 2 } as const;

const VERT = /* glsl */ `
attribute vec2 aOffset;
attribute float aSize;
attribute float aSeed;
attribute float aType;
attribute float aMask;
attribute float aState;
uniform float uTime;
uniform float uTune;
uniform float uUnitsPerPixel;
uniform vec3 uFreqColors[7];
varying vec2 vUv;
varying float vVis;
varying float vType;
varying float vState;
varying vec3 vColor;

float bitf(float mask, float i) {
  return mod(floor(mask / pow(2.0, i)), 2.0);
}

void main() {
  vUv = uv;
  vType = aType;
  vState = aState;

  float f0 = floor(uTune);
  float f1 = min(f0 + 1.0, 6.0);
  float ft = fract(uTune);
  ft = ft * ft * (3.0 - 2.0 * ft);
  float v0 = bitf(aMask, f0);
  float v1 = bitf(aMask, f1);
  // Gameplay nodes always stay legible even when off the current frequency —
  // floor visibility at 0.45 (ambient scatter could vanish; the board cannot).
  vVis = max(0.45, mix(v0, v1, ft));

  vec3 c0 = uFreqColors[int(f0)];
  vec3 c1 = uFreqColors[int(f1)];
  float w0 = max(v0 * (1.0 - ft), 0.001);
  float w1 = max(v1 * ft, 0.001);
  vColor = (c0 * w0 + c1 * w1) / (w0 + w1);

  // Position beacon breathes; adjacent nodes swell invitingly; calm nodes still.
  float pulse = 1.0 + 0.08 * sin(uTime * 1.2 + aSeed * 43.0);
  if (aState > 0.5 && aState < 1.5) pulse = 1.0 + 0.18 * sin(uTime * 2.6);
  if (aState > 1.5) pulse = 1.0 + 0.12 * sin(uTime * 3.4 + aSeed * 7.0);
  float stateScale = 1.0 + 0.35 * step(0.5, aState);

  float size = max(aSize, 4.0 * uUnitsPerPixel) * pulse * stateScale;
  vec3 world = vec3(aOffset + position.xy * size, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vVis;
varying float vType;
varying float vState;
varying vec3 vColor;
uniform float uTime;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float core = smoothstep(0.42, 0.10, r);
  float halo = exp(-r * 3.2) * 0.55;

  // broadcast_rand homes get a steady outer ring (a docking marker).
  float homeRing = 0.0;
  if (vType < 0.5) homeRing = smoothstep(0.045, 0.0, abs(r - 0.78)) * 0.6;

  // Position: a bright steady selection ring. Adjacent: an expanding invite ring.
  float stateRing = 0.0;
  if (vState > 0.5 && vState < 1.5) {
    stateRing = smoothstep(0.05, 0.012, abs(r - 0.70)) * 1.0;
  } else if (vState > 1.5) {
    float ringR = 0.55 + 0.22 * fract(uTime * 0.5);
    stateRing = smoothstep(0.05, 0.0, abs(r - ringR)) * (1.0 - fract(uTime * 0.5)) * 0.9;
  }

  vec3 accent = mix(vColor, vec3(0.9, 0.95, 1.0), 0.5);
  vec3 col = vColor * (core * 2.0 + halo)
           + accent * homeRing
           + accent * stateRing;
  float a = clamp(core + halo + homeRing + stateRing, 0.0, 1.0) * vVis;
  gl_FragColor = vec4(col, a);
}
`;

function buildNodeGeometry(nodes: DriftChartNode[]): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  base.dispose();

  const n = nodes.length;
  const offset = new Float32Array(n * 2);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  const type = new Float32Array(n);
  const mask = new Float32Array(n);
  const state = new Float32Array(n); // all CALM until setRunState

  nodes.forEach((node, i) => {
    offset[i * 2] = node.x;
    offset[i * 2 + 1] = node.y;
    size[i] = NODE_BASE_SIZE[node.node_type] ?? DEFAULT_NODE_SIZE;
    seed[i] = (i * 1013) % 97;
    type[i] = NODE_TYPE_INDEX[node.node_type] ?? 0;
    mask[i] = node.frequency_mask;
  });

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 2));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute('aType', new THREE.InstancedBufferAttribute(type, 1));
  geo.setAttribute('aMask', new THREE.InstancedBufferAttribute(mask, 1));
  geo.setAttribute('aState', new THREE.InstancedBufferAttribute(state, 1));
  geo.instanceCount = n;
  return geo;
}

function buildEdgeGeometry(
  chart: DriftChart,
  nodeIndex: Map<string, DriftChartNode>,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const intensity: number[] = []; // corridor edges read brighter
  for (const edge of chart.edges) {
    const a = nodeIndex.get(edge.from_node);
    const b = nodeIndex.get(edge.to_node);
    if (!a || !b) continue;
    positions.push(a.x, a.y, 0, b.x, b.y, 0);
    const i = edge.corridor ? 1 : 0.5;
    intensity.push(i, i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensity, 1));
  return geo;
}

const EDGE_VERT = /* glsl */ `
attribute float aIntensity;
varying float vIntensity;
void main() {
  vIntensity = aIntensity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const EDGE_FRAG = /* glsl */ `
precision highp float;
varying float vIntensity;
uniform vec3 uTint;
void main() {
  gl_FragColor = vec4(uTint * vIntensity, vIntensity * 0.55);
}
`;

/**
 * Build the playable graph layer. Returns the scene group, the node world
 * positions (for click picking), and controls to drive the gameplay highlight.
 */
export function createGameGraph(chart: DriftChart, freqColors: THREE.Color[]) {
  const nodes = chart.nodes;
  const nodeIndex = new Map(nodes.map((n) => [n.id, n]));
  const idToInstance = new Map(nodes.map((n, i) => [n.id, i]));

  const nodeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTune: { value: 2 },
      uUnitsPerPixel: { value: 1 },
      uFreqColors: { value: freqColors },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const nodeGeo = buildNodeGeometry(nodes);
  const nodeMesh = new THREE.Mesh(nodeGeo, nodeMaterial);
  nodeMesh.renderOrder = 12;
  nodeMesh.frustumCulled = false;

  const edgeMaterial = new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color(0x6c7a99) } },
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const edgeGeo = buildEdgeGeometry(chart, nodeIndex);
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMaterial);
  edgeLines.renderOrder = 11;
  edgeLines.frustumCulled = false;

  const group = new THREE.Group();
  group.add(edgeLines, nodeMesh);

  const stateAttr = nodeGeo.getAttribute('aState') as THREE.InstancedBufferAttribute;

  /** World-space positions for click picking (id + coordinates). */
  const nodeWorldPositions = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));

  return {
    group,
    nodeWorldPositions,

    /** Highlight the traveler's position + its reachable neighbours. */
    setRunState(positionId: string | null, adjacentIds: Iterable<string>) {
      const adjacent = new Set(adjacentIds);
      for (const [id, i] of idToInstance) {
        const s =
          id === positionId
            ? NODE_STATE.POSITION
            : adjacent.has(id)
              ? NODE_STATE.ADJACENT
              : NODE_STATE.CALM;
        stateAttr.setX(i, s);
      }
      stateAttr.needsUpdate = true;
    },

    update(ctx: FrameCtx, tint: THREE.Color) {
      nodeMaterial.uniforms.uTime.value = ctx.time;
      nodeMaterial.uniforms.uTune.value = ctx.tune;
      nodeMaterial.uniforms.uUnitsPerPixel.value = ctx.unitsPerPixel;
      edgeMaterial.uniforms.uTint.value.copy(tint).lerp(new THREE.Color(0xaab4cc), 0.5);
    },

    dispose() {
      nodeGeo.dispose();
      nodeMaterial.dispose();
      edgeGeo.dispose();
      edgeMaterial.dispose();
    },
  };
}
