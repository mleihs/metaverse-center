import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * RenderPass → UnrealBloom → Grade (Bureau-CRT + dissonance) → OutputPass.
 * The grade pass carries the band-2 "interface lies" look: tear bands,
 * chromatic aberration, redaction blocks, scanlines, grain — all scaled by
 * uDissonance and strictly cosmetic, per concept 6.3.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uDissonance: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDissonance;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      float diss = uDissonance;

      // Horizontal tear bands — the chart refusing to hold still
      float rowKey = floor(uv.y * 36.0) + floor(uTime * 6.0) * 91.0;
      float tear = step(0.985 - diss * 0.12, hash21(vec2(rowKey, 3.7)));
      uv.x += tear * (hash21(vec2(rowKey, 9.1)) - 0.5) * 0.05 * smoothstep(0.30, 1.0, diss);

      // Radial chromatic aberration
      vec2 dir = uv - 0.5;
      float ca = 0.0008 + diss * 0.0045;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;

      // Redaction blocks (Doppelt band and up)
      if (diss > 0.5) {
        vec2 cell = floor(uv * vec2(14.0, 30.0));
        float k = hash21(cell + floor(uTime * 2.0) * 17.0);
        float gate = step(0.994 - (diss - 0.5) * 0.02, k);
        col *= 1.0 - gate * 0.85;
      }

      // Scanlines (CRT-lite always on, ramping with dissonance)
      float scan = sin(gl_FragCoord.y * 3.14159) * 0.5 + 0.5;
      col *= 1.0 - (0.025 + 0.09 * diss) * scan;

      // Grain
      col += (hash21(uv * uResolution + vec2(uTime * 61.0, uTime * 83.0)) - 0.5)
           * (0.016 + 0.07 * diss);

      // Vignette
      float v = length(vUv - 0.5);
      col *= 1.0 - 0.32 * smoothstep(0.35, 0.78, v);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.95, 0.7, 0.5);
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    setSize(w: number, h: number, pixelRatio: number) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
      grade.uniforms.uResolution.value.set(w * pixelRatio, h * pixelRatio);
    },
    update(time: number, dissonance: number) {
      grade.uniforms.uTime.value = time;
      grade.uniforms.uDissonance.value = dissonance;
    },
  };
}
