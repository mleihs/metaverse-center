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

      // NO REDACTION BLOCKS.
      //
      // There used to be one here: above uDissonance 0.5 a 14x30 grid was rolled twice a
      // second and a handful of cells were darkened (col *= 1.0 - gate * 0.85), the most
      // literal reading of the "interface lies" band in concept 6.3 — the Bureau censoring
      // its own chart.
      //
      // It was removed because it covered the board. A cell is roughly 95x27 px on a
      // desktop chart, which is large enough to swallow a node, its reachable ring and the
      // corridors around it — and those are the things a move is aimed at. Two attempts to
      // keep it failed on the same point: raising dz_p0_cap from 20 to 40 (migration 277)
      // only moved the threshold, since normal play climbs past Dissonanz 20 anyway, and
      // softening the darkening to 0.62 still left a censor bar over live geometry. Both
      // were measured on the running board, and both still hid content.
      //
      // The dissonance has four other voices in this pass — the tear bands, the chromatic
      // aberration, the scanlines and the grain — and every one of them distorts the image
      // without deleting part of it. That is the line: the chart may lie about how steady
      // it is, never about what is on it. If the redaction is wanted back, it belongs on a
      // surface that carries no geometry (the HUD frame, the logbook), not on the board.

      // Scanlines (CRT-lite always on, ramping with dissonance)
      float scan = sin(gl_FragCoord.y * 3.14159) * 0.5 + 0.5;
      col *= 1.0 - (0.025 + 0.09 * diss) * scan;

      // Grain.
      //
      // The hash input must stay SMALL. hash21 opens with fract(p * vec2(123.34, 456.21)),
      // so feeding it uv * uResolution — up to ~2704 on a retina board — lands the
      // multiply around 3.3e5, where a float32's ulp is ~0.03. fract() of that has almost
      // no fractional detail left, neighbouring pixels collapse onto the same value, and
      // the "noise" degenerates into a regular pattern: the thin vertical stripes that
      // stood over the whole board. Scaling the fragment coordinate down and wrapping it
      // into [0,1) first keeps the hash inside the range it is accurate in, while 0.013
      // per pixel still decorrelates neighbours completely.
      vec2 grainUv = fract(gl_FragCoord.xy * 0.013 + vec2(uTime * 0.61, uTime * 0.83));
      col += (hash21(grainUv) - 0.5) * (0.016 + 0.07 * diss);

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
    dispose() {
      // EffectComposer.dispose() only disposes its internal ping-pong targets;
      // it does NOT loop over passes. Dispose each pass explicitly first.
      for (const pass of composer.passes) {
        (pass as { dispose?: () => void }).dispose?.();
      }
      composer.dispose();
    },
  };
}
