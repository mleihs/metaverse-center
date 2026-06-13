import * as THREE from 'three';
import type { ChartData, FrameCtx } from '../chart/types';

/**
 * The five broadcast glows, each with the signature behavior from the concept
 * fiction (4.2): Velgarien an administrative lattice, the Reach a
 * bioluminescent smear, Station Null a tight pulse that eats light, Speranza
 * a heartbeat under static, the Cité a steady dawn.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uStyle;
uniform float uSeed;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  // Guarantee zero at the quad boundary — additive quads must never show edges
  float edge = smoothstep(1.0, 0.72, r);
  float core = exp(-r * 10.0);
  float glow = exp(-r * 3.8) * 0.55;
  float wide = exp(-r * 1.8) * 0.18;
  vec3 col;

  if (uStyle < 0.5) {
    // Velgarien — cold administrative lattice
    vec2 g = abs(fract(p * 7.0) - 0.5);
    float lattice = 1.0 - smoothstep(0.015, 0.09, min(g.x, g.y));
    col = uColorA * (glow * (0.22 + 0.78 * lattice) + wide) + uColorB * exp(-r * 14.0) * 1.4;
  } else if (uStyle < 1.5) {
    // Gaslit Reach — warm bioluminescent smear with a teal edge
    vec2 q = p + 0.18 * vec2(sin(uTime * 0.21), cos(uTime * 0.17));
    vec2 q2 = q + vec2(0.34, -0.22);
    float blob2 = exp(-dot(q2, q2) * 3.2);
    col = uColorA * (glow + wide) + uColorB * blob2 * 0.6 + uColorA * core * 1.2;
  } else if (uStyle < 2.5) {
    // Station Null — tight pulse orbiting something that eats light
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 0.85 + uSeed), 3.0);
    col = uColorA * core * 2.2 * pulse + uColorB * glow * 0.5 * pulse;
  } else if (uStyle < 3.5) {
    // Speranza — heartbeat under static
    float t = fract(uTime * 0.5);
    float beat = pow(max(0.0, sin(t * 6.2831)), 6.0)
               + 0.6 * pow(max(0.0, sin((t - 0.14) * 6.2831)), 6.0);
    float amp = (0.72 + 0.28 * beat) * (0.9 + 0.1 * hash21(vec2(floor(uTime * 24.0), uSeed)));
    col = (uColorA * (core * 1.5 + glow * 0.8) + uColorB * wide) * amp;
  } else {
    // Cité des Dames — a steady dawn that never quite arrives
    float dawn = 1.0 + 0.35 * p.y;
    col = uColorA * (glow + wide) * dawn + uColorB * core * 1.3;
  }

  col *= edge;
  float a = clamp(core + glow + wide, 0.0, 1.0) * edge;
  gl_FragColor = vec4(col, a);
}
`;

export function createBroadcasts(chart: ChartData) {
  const group = new THREE.Group();
  const materials: THREE.ShaderMaterial[] = [];

  chart.sims.forEach((sim, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColorA: { value: new THREE.Color(sim.colorA) },
        uColorB: { value: new THREE.Color(sim.colorB) },
        uTime: { value: 0 },
        uStyle: { value: sim.style },
        uSeed: { value: i * 7.31 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const size = sim.radius * 2.4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    mesh.position.set(sim.x, sim.y, 0);
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    group.add(mesh);
    materials.push(material);
  });

  return {
    group,
    update(ctx: FrameCtx) {
      for (const m of materials) m.uniforms.uTime.value = ctx.time;
    },
  };
}
