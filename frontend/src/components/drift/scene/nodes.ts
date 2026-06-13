import * as THREE from 'three';
import type { ChartData, FrameCtx, NodeSpec } from '../chart/types';

/**
 * The chart nodes: one InstancedBufferGeometry quad, all per-node state in
 * instanced attributes, frequency crossfade computed in the vertex shader
 * (bit extraction via mod/floor — float-exact for 7-bit masks, no WebGL2
 * integer ops needed). Node types express themselves in the fragment shader:
 * Relais ping rings, Geisterinsel existence gates, guttering Wracks,
 * shivering Splitterfänger, breathing storms.
 */
const VERT = /* glsl */ `
attribute vec2 aOffset;
attribute float aSize;
attribute float aSeed;
attribute float aType;
attribute float aMask;
attribute float aIndex;
uniform float uTime;
uniform float uTune;
uniform float uUnitsPerPixel;
uniform float uHoverIndex;
uniform vec3 uFreqColors[7];
varying vec2 vUv;
varying float vVis;
varying float vType;
varying float vSeed;
varying float vHover;
varying vec3 vColor;

float bitf(float mask, float i) {
  return mod(floor(mask / pow(2.0, i)), 2.0);
}

void main() {
  vUv = uv;
  vType = aType;
  vSeed = aSeed;

  float f0 = floor(uTune);
  float f1 = min(f0 + 1.0, 6.0);
  float ft = fract(uTune);
  ft = ft * ft * (3.0 - 2.0 * ft);
  float v0 = bitf(aMask, f0);
  float v1 = bitf(aMask, f1);
  float vis = mix(v0, v1, ft);

  // Geisterinsel: may not be there when you come back
  if (abs(aType - 3.0) < 0.5) {
    vis *= 0.30 + 0.70 * smoothstep(0.25, 0.75, 0.5 + 0.5 * sin(uTime * 0.13 + aSeed * 37.0));
  }
  vVis = vis;

  vec3 c0 = uFreqColors[int(f0)];
  vec3 c1 = uFreqColors[int(f1)];
  float w0 = v0 * (1.0 - ft);
  float w1 = v1 * ft;
  vColor = (c0 * w0 + c1 * w1) / max(w0 + w1, 1e-3);

  vHover = step(abs(aIndex - uHoverIndex), 0.5);

  float pulse = 1.0 + 0.10 * sin(uTime * (0.5 + fract(aSeed * 7.31) * 0.9) + aSeed * 43.0);
  if (abs(aType - 6.0) < 0.5) pulse = 1.0 + 0.22 * sin(uTime * 2.2 + aSeed * 43.0);

  // Chart readability: nodes never shrink below ~2.6 px on screen
  float size = max(aSize, 2.6 * uUnitsPerPixel) * pulse * (1.0 + 0.5 * vHover);
  vec3 world = vec3(aOffset + position.xy * size, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vVis;
varying float vType;
varying float vSeed;
varying float vHover;
varying vec3 vColor;
uniform float uTime;

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

void main() {
  if (vVis < 0.004) discard;
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float core = smoothstep(0.40, 0.10, r);
  float halo = exp(-r * 3.4) * 0.55;

  float extra = 0.0;
  if (abs(vType - 1.0) < 0.5) {
    // Relais: expanding survey ring
    float ringR = fract(uTime * 0.22 + vSeed);
    extra += smoothstep(0.035, 0.0, abs(r - ringR)) * (1.0 - ringR) * 0.7;
  }

  float flicker = 1.0;
  if (abs(vType - 4.0) < 0.5) {
    // Träger-Wrack: guttering, almost out
    float g = 0.55 + 0.45 * hash11(floor(uTime * 6.0) + vSeed * 91.0);
    flicker = mix(g, 1.0, 0.35);
  }
  if (abs(vType - 5.0) < 0.5) {
    // Splitterfänger: restless shiver
    flicker = 0.85 + 0.15 * sin(uTime * 9.0 + vSeed * 53.0);
  }
  if (abs(vType - 2.0) < 0.5) {
    // Echo-Untiefe: pooled echoes shimmer
    flicker = 0.88 + 0.12 * sin(uTime * 1.7 + vSeed * 29.0 + r * 6.0);
  }

  float ringSel = smoothstep(0.05, 0.012, abs(r - 0.66)) * vHover;

  vec3 col = vColor * (core * 2.0 + halo) * flicker
           + vColor * extra
           + vec3(0.85, 0.92, 1.0) * ringSel * 0.9;
  float a = clamp(core + halo + extra + ringSel, 0.0, 1.0) * vVis;
  gl_FragColor = vec4(col * vVis, a);
}
`;

function buildGeometry(nodes: NodeSpec[]): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));

  const n = nodes.length;
  const offset = new Float32Array(n * 2);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  const type = new Float32Array(n);
  const mask = new Float32Array(n);
  const index = new Float32Array(n);

  nodes.forEach((node, i) => {
    offset[i * 2] = node.x;
    offset[i * 2 + 1] = node.y;
    size[i] = node.size;
    seed[i] = node.seed;
    type[i] = node.type;
    mask[i] = node.mask;
    index[i] = i;
  });

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 2));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.setAttribute('aType', new THREE.InstancedBufferAttribute(type, 1));
  geo.setAttribute('aMask', new THREE.InstancedBufferAttribute(mask, 1));
  geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(index, 1));
  geo.instanceCount = n;
  return geo;
}

export function createNodes(chart: ChartData, freqColors: THREE.Color[]) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTune: { value: 2 },
      uUnitsPerPixel: { value: 1 },
      uHoverIndex: { value: -1 },
      uFreqColors: { value: freqColors },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(buildGeometry(chart.nodes), material);
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(ctx: FrameCtx) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uTune.value = ctx.tune;
      material.uniforms.uUnitsPerPixel.value = ctx.unitsPerPixel;
      material.uniforms.uHoverIndex.value = ctx.hoverIndex;
    },
    rebuild(nodes: NodeSpec[]) {
      mesh.geometry.dispose();
      mesh.geometry = buildGeometry(nodes);
    },
  };
}
