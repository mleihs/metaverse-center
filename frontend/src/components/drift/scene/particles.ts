import * as THREE from 'three';
import type { FrameCtx } from '../chart/types';

/** Slow-drifting motes in the medium — cheap life, tinted by current tuning. */
const VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
varying float vA;
void main() {
  vec3 p = position;
  float s = aSeed * 6.2831;
  p.x += sin(uTime * 0.05 + s) * 40.0 + sin(uTime * 0.013 + s * 3.0) * 70.0;
  p.y += cos(uTime * 0.041 + s * 1.7) * 40.0;
  vA = 0.10 + 0.16 * fract(aSeed * 7.7);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.5 + 2.5 * fract(aSeed * 13.3)) * uPixelRatio;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying float vA;
uniform vec3 uTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float fall = exp(-r * 3.0);
  vec3 col = mix(vec3(0.35, 0.5, 0.95), uTint, 0.45);
  gl_FragColor = vec4(col * fall * vA, fall * vA);
}
`;

export function createParticles(count: number, pixelRatio: number, seedTint?: THREE.Color) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 5200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 3400;
    positions[i * 3 + 2] = 0;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      // Seed from the freq-2 palette token; overwritten on the first frame by the live tint.
      uTint: { value: seedTint ? seedTint.clone() : new THREE.Color('#9a7fe8') },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  points.frustumCulled = false;

  return {
    points,
    update(ctx: FrameCtx, tint: THREE.Color) {
      material.uniforms.uTime.value = ctx.time;
      (material.uniforms.uTint.value as THREE.Color).copy(tint);
    },
  };
}
