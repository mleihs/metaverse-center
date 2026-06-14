import * as THREE from 'three';
import { corridorPoint } from '../chart/generate';
import { type ChartData, type FrameCtx, maskVisibility } from '../chart/types';

/**
 * Strömungsbänder: ribbon strips along quadratic beziers between sim pairs.
 * Color is a gradient between the two endpoint worlds; energy pulses flow
 * along the band. Visibility crossfades with tuning (CPU-computed per band,
 * mirroring the node shader) — retuning makes corridors appear and vanish.
 */
const SAMPLES = 48;

const VERT = /* glsl */ `
attribute float aAlong;
attribute float aAcross;
varying float vAlong;
varying float vAcross;
void main() {
  vAlong = aAlong;
  vAcross = aAcross;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying float vAlong;
varying float vAcross;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uVis;
uniform float uStrength;
uniform float uSeed;

void main() {
  if (uVis < 0.004) discard;
  float lateral = exp(-vAcross * vAcross * 3.0);
  float ends = smoothstep(0.0, 0.10, vAlong) * smoothstep(1.0, 0.90, vAlong);
  float flow1 = 0.5 + 0.5 * sin((vAlong * 9.0 - uTime * 0.055 + uSeed) * 6.2831);
  float flow2 = 0.5 + 0.5 * sin((vAlong * 23.0 - uTime * 0.14 + uSeed * 2.0) * 6.2831);
  float energy = 0.38 + 0.34 * pow(flow1, 3.0) + 0.18 * pow(flow2, 5.0);
  vec3 col = mix(uColorA, uColorB, vAlong);
  float i = lateral * ends * energy * (0.28 + 0.52 * uStrength) * uVis;
  gl_FragColor = vec4(col * i, i);
}
`;

export function createCorridors(chart: ChartData) {
  const group = new THREE.Group();
  const entries: Array<{ material: THREE.ShaderMaterial; mask: number }> = [];

  for (const corr of chart.corridors) {
    const simA = chart.sims[corr.a];
    const simB = chart.sims[corr.b];
    const width = 26 * corr.strength + 10;

    const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
    const along = new Float32Array((SAMPLES + 1) * 2);
    const across = new Float32Array((SAMPLES + 1) * 2);
    const indices: number[] = [];

    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const p = corridorPoint(corr, chart.sims, t);
      const ahead = corridorPoint(corr, chart.sims, Math.min(1, t + 0.01));
      const behind = corridorPoint(corr, chart.sims, Math.max(0, t - 0.01));
      const tx = ahead.x - behind.x;
      const ty = ahead.y - behind.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;

      const v0 = i * 2;
      positions.set([p.x + nx * width, p.y + ny * width, 0], v0 * 3);
      positions.set([p.x - nx * width, p.y - ny * width, 0], (v0 + 1) * 3);
      along[v0] = t;
      along[v0 + 1] = t;
      across[v0] = 1;
      across[v0 + 1] = -1;

      if (i < SAMPLES) {
        indices.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    geometry.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
    geometry.setIndex(indices);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColorA: { value: new THREE.Color(simA.colorA) },
        uColorB: { value: new THREE.Color(simB.colorA) },
        uTime: { value: 0 },
        uVis: { value: 1 },
        uStrength: { value: corr.strength },
        uSeed: { value: corr.a * 3.7 + corr.b * 1.3 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    entries.push({ material, mask: corr.mask });
  }

  return {
    group,
    update(ctx: FrameCtx) {
      for (const e of entries) {
        e.material.uniforms.uTime.value = ctx.time;
        e.material.uniforms.uVis.value = maskVisibility(e.mask, ctx.tune);
      }
    },
  };
}
