import * as THREE from 'three';
import type { ChartData, FrameCtx } from '../chart/types';

/**
 * Fullscreen clip-space quad reconstructing world coordinates in the fragment
 * shader: the Bleed medium. Drifting fbm noise (stronger in the deep Drift),
 * a broadcast light field (Station Null contributes NEGATIVE light — the
 * world is literally darker around it), survey graticule fading into the dark.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uMotion;
uniform vec2 uCamCenter;
uniform float uViewHeight;
uniform float uAspect;
uniform vec3 uTint;
uniform vec4 uAnchors[5]; // x, y, intensity, falloff

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.55;
  }
  return v;
}

float gridLine(float x, float spacing, float halfWidth) {
  float d = abs(fract(x / spacing) - 0.5) * spacing;
  return 1.0 - smoothstep(0.0, halfWidth, d);
}

void main() {
  vec2 world = uCamCenter + (vUv - 0.5) * vec2(uViewHeight * uAspect, uViewHeight);
  float upp = uViewHeight / 1080.0;

  float light = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 a = uAnchors[i];
    float d = length(world - a.xy);
    light += a.z * exp(-d / a.w);
  }
  light = clamp(light, 0.0, 1.0) * 0.8;

  // The Bleed medium. A slow, barely-there current advects the field — uMotion damps it
  // to a standstill under prefers-reduced-motion. Domain-warping the fbm sample by a
  // second fbm (iq's technique) turns flat noise into organic, drifting filaments; the
  // structure is spatial, so the medium stays rich even frozen. Parallax (< 1) fakes depth.
  float drift = uTime * uMotion;
  vec2 base = world * 0.0016 - uCamCenter * 0.0005;
  vec2 current = vec2(drift * 0.010, -drift * 0.0065);
  vec2 warp = vec2(fbm(base + current), fbm(base + vec2(5.2, 1.3) - current * 0.7));
  float n1 = fbm(base + 1.15 * warp);
  float n2 = fbm(base * 3.1 + 1.6 * warp - vec2(drift * 0.016, 0.0));
  float filament = warp.x * warp.y; // the warp cross-term reads as wispy strands
  // sRGB lifts darks hard: keep deep-Drift sums below ~0.01 linear
  float noiseAmp = mix(0.045, 0.018, light); // the deep Drift is staticky

  vec3 deep = vec3(0.004, 0.006, 0.016);
  vec3 lit = vec3(0.020, 0.034, 0.070);
  vec3 col = mix(deep, lit, light);
  col += uTint * (0.006 + 0.016 * light);
  col += (n1 * n1) * noiseAmp * vec3(0.30, 0.42, 0.85);
  col += n2 * noiseAmp * 0.30 * vec3(0.5, 0.45, 0.9);
  // very subtle freq-tinted filaments, breathing with the current tuning colour
  col += smoothstep(0.40, 0.95, filament) * (0.008 + 0.012 * light) * uTint;

  // Survey graticule
  float wMinor = 1.1 * upp;
  float wMajor = 1.5 * upp;
  float minor = max(gridLine(world.x, 120.0, wMinor), gridLine(world.y, 120.0, wMinor));
  float major = max(gridLine(world.x, 600.0, wMajor), gridLine(world.y, 600.0, wMajor));
  float minorFade = smoothstep(2600.0, 1100.0, uViewHeight);
  float gridA = (minor * 0.04 * minorFade + major * 0.07) * (0.20 + 0.80 * light);
  col += gridA * vec3(0.45, 0.65, 0.9);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createBackground(chart: ChartData, aspect: number, seedTint?: THREE.Color) {
  const anchors = chart.sims.map((s) => new THREE.Vector4(s.x, s.y, s.light, s.radius * 1.6));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uCamCenter: { value: new THREE.Vector2() },
      uViewHeight: { value: 1500 },
      uAspect: { value: aspect },
      // Seed from the freq-2 palette token; overwritten on the first frame by the live tint.
      uTint: { value: seedTint ? seedTint.clone() : new THREE.Color('#9a7fe8') },
      uAnchors: { value: anchors },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  return {
    mesh,
    setAspect(a: number) {
      material.uniforms.uAspect.value = a;
    },
    update(ctx: FrameCtx, tint: THREE.Color, motion = 1) {
      material.uniforms.uTime.value = ctx.time;
      material.uniforms.uMotion.value = motion;
      material.uniforms.uCamCenter.value.set(ctx.camCenter.x, ctx.camCenter.y);
      material.uniforms.uViewHeight.value = ctx.viewHeight;
      (material.uniforms.uTint.value as THREE.Color).copy(tint);
    },
  };
}
