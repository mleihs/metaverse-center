/**
 * VelgDriftChartHost — the DRIFT Driftkarte renderer (concept §6/§7.7).
 *
 * A light-DOM Lit host for the Three.js chart: instanced frequency-layered
 * nodes, Strömungsband corridors, broadcast glows, particle Bleed and the
 * dissonance grade pass — all ported verbatim from the verified spike
 * (`spikes/drift-chart-three/`, decision: classic WebGLRenderer + EffectComposer
 * + GLSL, NOT WebGPU/TSL; re-evaluate at the P3/Helm boundary).
 *
 * WHY light DOM (createRenderRoot → this): canvas pointer-event coordinates
 * resolve to the wrong element inside Shadow DOM (the same MapLibre quirk that
 * drove `SimulationWorldMap`). Component CSS + the bespoke pan/zoom listeners
 * therefore live in the light DOM; styles are injected into the containing scope
 * via `getRootNode()` with `?inline` CSS (idempotent via a WeakSet), exactly the
 * `SimulationWorldMap` reference pattern.
 *
 * The frequency palette is read from the design tokens (`--drift-freq-0..6`) via
 * getComputedStyle — the token bridge: the canvas palette comes from the design
 * system, never duplicated constants.
 *
 * P0c scope: renders the chart with sample topology + `frequency`/`dissonance`
 * as properties. DEFERRED (later components): real `drift_chart_nodes/edges`
 * data wiring, the interactive HUD (→ `TravelConsole`), hover dossiers
 * (→ tooltip), and the non-visual `ChartAccessibilityList` (§11.3).
 */

import { localized, msg } from '@lit/localize';
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as THREE from 'three';

import { captureError } from '../../services/SentryService.js';
import type { DriftChart, TravelRun } from '../../types/drift.js';
import { generateChart } from './chart/generate.js';
import type { ChartData, FrameCtx } from './chart/types.js';
import { PanZoomController } from './controls/panzoom.js';
// Component CSS as a string (Vite `?inline`) so it can be injected into the
// containing scope — a plain import would auto-inject into document.head and
// never reach an ancestor shadow root. See SimulationWorldMap for the rationale.
import COMPONENT_CSS from './drift-chart.css?inline';
import { readFreqPalette } from './palette.js';
import { createComposer } from './post/composer.js';
import { createBackground } from './scene/background.js';
import { createBroadcasts } from './scene/broadcasts.js';
import { createCorridors } from './scene/corridors.js';
import { createGameGraph } from './scene/gameGraph.js';
import { createNodes } from './scene/nodes.js';
import { createParticles } from './scene/particles.js';

// ── Carried-over spike constants (binding, from the spike README) ────────────
const SAMPLE_SEED = 7;
const SAMPLE_NODE_COUNT = 500;
const PARTICLE_COUNT = 900;
// Start framed over the P0 pair (Velgarien ↔ Gaslit Reach), matching the spike.
const INITIAL_CENTER = { x: -235, y: -150 };
const INITIAL_VIEW_HEIGHT = 1500;

// ── Light-DOM style injection (SimulationWorldMap pattern) ───────────────────
const _styledRoots = new WeakSet<Document | ShadowRoot>();

function ensureComponentStyles(host: HTMLElement): void {
  const root = host.getRootNode();
  const scope = root instanceof ShadowRoot ? root : document;
  if (_styledRoots.has(scope)) return;
  const style = document.createElement('style');
  style.setAttribute('data-velg-drift-chart', '');
  style.textContent = COMPONENT_CSS;
  (scope instanceof ShadowRoot ? scope : document.head).appendChild(style);
  _styledRoots.add(scope);
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

@localized()
@customElement('velg-drift-chart')
export class VelgDriftChartHost extends LitElement {
  /** Active bleed vector 0–6 (commerce…desire). Default: memory, the P0 vector. */
  @property({ type: Number }) frequency = 2;
  /** Dissonance 0–1 — drives the grade pass (tear bands, redaction, scanlines). */
  @property({ type: Number }) dissonance = 0.12;

  /** Real chart topology (from driftApi). When set, the playable graph board renders. */
  @property({ attribute: false }) chartData: DriftChart | null = null;
  /** The traveler's current run — drives the position + adjacency highlight. */
  @property({ attribute: false }) run: TravelRun | null = null;

  @state() private _offline = false;

  // Three.js graph — created on mount, disposed on teardown.
  private _renderer: THREE.WebGLRenderer | null = null;
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.OrthographicCamera | null = null;
  private _controller: PanZoomController | null = null;
  private _chart: ChartData | null = null;
  private _freqColors: THREE.Color[] = [];
  private _background: ReturnType<typeof createBackground> | null = null;
  private _corridors: ReturnType<typeof createCorridors> | null = null;
  private _broadcasts: ReturnType<typeof createBroadcasts> | null = null;
  private _nodes: ReturnType<typeof createNodes> | null = null;
  private _particles: ReturnType<typeof createParticles> | null = null;
  private _gameGraph: ReturnType<typeof createGameGraph> | null = null;
  private _post: ReturnType<typeof createComposer> | null = null;

  private _resizeObserver: ResizeObserver | null = null;
  private _rafId = 0;
  private _elapsed = 0;
  private _lastTime = 0;
  private _pixelRatio = 1;
  private _tween: { from: number; to: number; start: number; dur: number } | null = null;
  private _tune = 2;
  private readonly _tint = new THREE.Color();
  private _mounted = false;
  private _pointerDownAt: { x: number; y: number; t: number } | null = null;
  private _adjacentIds = new Set<string>();

  // Light DOM so canvas pointer coordinates resolve correctly (see header).
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    ensureComponentStyles(this);
    // On disconnect→reconnect Lit reuses the instance but does NOT re-fire
    // firstUpdated, so the scene would never re-initialize. Schedule a re-mount
    // once the render root has the canvas again (mirrors SimulationWorldMap pattern).
    if (!this._mounted && !this._offline) {
      void this.updateComplete.then(() => {
        if (!this._mounted && !this._offline) this._mount();
      });
    }
  }

  disconnectedCallback(): void {
    this._teardown();
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    // The canvas exists now (light DOM rendered). Mount the scene.
    this._mount();
  }

  protected updated(changed: Map<string, unknown>): void {
    // Reflect a frequency change as an eased Umstimmung (ceremonial retune),
    // matching the spike's onTuneSnap; dissonance is read live in the frame.
    if (changed.has('frequency') && this._scene) {
      this._tween = { from: this._tune, to: this.frequency, start: this._elapsed, dur: 1.1 };
    }
    // Real data arriving (or changing) rebuilds the board; a run change just
    // re-highlights the position + reachable neighbours.
    if (changed.has('chartData') && this._scene) {
      this._buildGameGraph();
    } else if (changed.has('run')) {
      this._syncRunState();
    }
  }

  private _mount(): void {
    if (this._mounted) return;
    const canvas = this.querySelector<HTMLCanvasElement>('canvas.drift-chart__canvas');
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    if (!canvas || !wrap) return;

    try {
      this._renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false, // edges are soft glows; the post chain owns the pixels
        powerPreference: 'high-performance',
      });
    } catch (err) {
      // WebGL2 unavailable / context creation failed — show the offline panel.
      captureError(err, { source: 'VelgDriftChartHost._mount' });
      this._offline = true;
      return;
    }

    const renderer = this._renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(this._pixelRatio);

    this._scene = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._camera.position.z = 10;

    this._freqColors = readFreqPalette();
    this._tune = this.frequency;
    this._chart = generateChart(SAMPLE_SEED, SAMPLE_NODE_COUNT);

    const aspect = this._aspect(wrap);
    // Pass the freq-2 (memory) color as the seed tint; overwritten on frame 1.
    const seedTint = this._freqColors[this.frequency] ?? this._freqColors[2];
    this._background = createBackground(this._chart, aspect, seedTint);
    this._corridors = createCorridors(this._chart);
    this._broadcasts = createBroadcasts(this._chart);
    this._nodes = createNodes(this._chart, this._freqColors);
    this._particles = createParticles(PARTICLE_COUNT, this._pixelRatio, seedTint);
    this._scene.add(
      this._background.mesh,
      this._corridors.group,
      this._broadcasts.group,
      this._nodes.mesh,
      this._particles.points,
    );

    this._controller = new PanZoomController(canvas, { ...INITIAL_CENTER }, INITIAL_VIEW_HEIGHT);
    this._post = createComposer(
      renderer,
      this._scene,
      this._camera,
      wrap.clientWidth,
      wrap.clientHeight,
    );

    this._resize();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(wrap);

    // Real graph board (if the data is already present; else updated() builds it).
    this._buildGameGraph();

    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._frame);
    this._mounted = true;
  }

  private _aspect(wrap: HTMLElement): number {
    const h = wrap.clientHeight || 1;
    return (wrap.clientWidth || 1) / h;
  }

  private _resize = (): void => {
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    if (!wrap || !this._renderer || !this._post || !this._background) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    this._renderer.setSize(w, h, false);
    this._post.setSize(w, h, this._pixelRatio);
    this._background.setAspect(w / h);
  };

  private _applyCamera(wrap: HTMLElement): void {
    const controller = this._controller;
    const camera = this._camera;
    if (!controller || !camera) return;
    const halfH = controller.viewHeight / 2;
    const halfW = halfH * this._aspect(wrap);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.set(controller.center.x, controller.center.y, 10);
    camera.updateProjectionMatrix();
  }

  private _currentTint(): THREE.Color {
    const f0 = Math.floor(this._tune);
    const f1 = Math.min(f0 + 1, 6);
    return this._tint.copy(this._freqColors[f0]).lerp(this._freqColors[f1], this._tune - f0);
  }

  /** (Re)build the playable graph board from chartData; frame the camera to it. */
  private _buildGameGraph(): void {
    if (!this._scene) return;
    if (this._gameGraph) {
      this._scene.remove(this._gameGraph.group);
      this._gameGraph.dispose();
      this._gameGraph = null;
    }
    if (!this.chartData?.nodes.length) return;
    this._gameGraph = createGameGraph(this.chartData, this._freqColors);
    this._scene.add(this._gameGraph.group);
    // Hide the spike's ambient sample layers (scatter nodes, sample corridors +
    // broadcast glows) so the real gameplay graph reads clearly; the deep-field
    // background + Bleed particles stay as atmosphere.
    if (this._nodes) this._nodes.mesh.visible = false;
    if (this._corridors) this._corridors.group.visible = false;
    if (this._broadcasts) this._broadcasts.group.visible = false;
    this._frameCameraToGraph();
    this._syncRunState();
  }

  /** Center + zoom the camera so the whole graph fits, with padding. */
  private _frameCameraToGraph(): void {
    const nodes = this.chartData?.nodes;
    if (!this._controller || !nodes?.length) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    const aspect = wrap ? this._aspect(wrap) : 1.6;
    const fitH = Math.max(maxY - minY, (maxX - minX) / aspect) * 1.5 + 240;
    this._controller.center.x = (minX + maxX) / 2;
    this._controller.center.y = (minY + maxY) / 2;
    this._controller.viewHeight = Math.max(420, fitH);
  }

  /** Push the traveler's position + reachable neighbours into the graph highlight. */
  private _syncRunState(): void {
    if (!this._gameGraph) return;
    const positionId = this.run?.position_node_id ?? null;
    const adjacent = new Set<string>();
    if (positionId && this.chartData) {
      for (const e of this.chartData.edges) {
        if (e.from_node === positionId) adjacent.add(e.to_node);
        else if (e.to_node === positionId) adjacent.add(e.from_node);
      }
    }
    this._adjacentIds = adjacent;
    this._gameGraph.setRunState(positionId, adjacent);
  }

  private _onPointerDown = (e: PointerEvent): void => {
    this._pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  // A click (little movement, short dwell) on a reachable node emits a move intent;
  // a drag is a pan and is ignored. The server still authorises the move (the RPC
  // validates the edge) — adjacency here only gates the click + the highlight.
  private _onPointerUp = (e: PointerEvent): void => {
    const down = this._pointerDownAt;
    this._pointerDownAt = null;
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (performance.now() - down.t > 500) return;
    if (!this._controller || !this._gameGraph) return;

    const world = this._controller.screenToWorld(e.offsetX, e.offsetY);
    const radius = 30 * this._controller.unitsPerPixel; // forgiving tap target
    let bestId: string | null = null;
    let bestDist = radius;
    for (const node of this._gameGraph.nodeWorldPositions) {
      const d = Math.hypot(node.x - world.x, node.y - world.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = node.id;
      }
    }
    if (bestId && this._adjacentIds.has(bestId)) {
      this.dispatchEvent(
        new CustomEvent('drift-node-pick', {
          detail: { nodeId: bestId },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private _frame = (now: number): void => {
    this._rafId = requestAnimationFrame(this._frame);
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    if (
      !wrap ||
      !this._controller ||
      !this._post ||
      !this._background ||
      !this._corridors ||
      !this._broadcasts ||
      !this._nodes ||
      !this._particles
    ) {
      return;
    }

    const dt = Math.min(0.05, (now - this._lastTime) / 1000); // clamp tab-refocus jumps
    this._lastTime = now;
    this._elapsed += dt;

    if (this._tween) {
      const t = Math.min(1, (this._elapsed - this._tween.start) / this._tween.dur);
      this._tune = this._tween.from + (this._tween.to - this._tween.from) * easeInOutCubic(t);
      if (t >= 1) this._tween = null;
    }

    this._controller.update(dt);
    this._applyCamera(wrap);

    const ctx: FrameCtx = {
      time: this._elapsed,
      dt,
      tune: this._tune,
      dissonance: this.dissonance,
      unitsPerPixel: this._controller.unitsPerPixel,
      camCenter: this._controller.center,
      viewHeight: this._controller.viewHeight,
      hoverIndex: -1, // hover dossiers are a later increment (tooltip component)
    };

    const tint = this._currentTint();
    this._background.update(ctx, tint);
    this._corridors.update(ctx);
    this._broadcasts.update(ctx);
    this._nodes.update(ctx);
    this._gameGraph?.update(ctx, tint);
    this._particles.update(ctx, tint);
    this._post.update(this._elapsed, this.dissonance);
    this._post.composer.render();
  };

  private _teardown(): void {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    // Dispose every geometry/material in the scene, then the renderer + composer.
    this._scene?.traverse((obj) => {
      // Not every Object3D is a Mesh (Groups/Points lack geometry/material), so
      // Partial<Mesh> keeps the optional chains honest.
      const geometry = (obj as Partial<THREE.Mesh>).geometry;
      geometry?.dispose();
      const material = (obj as Partial<THREE.Mesh>).material;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else {
        material?.dispose();
      }
    });
    this._post?.dispose();
    this._renderer?.dispose();

    this._controller?.dispose();
    this._gameGraph?.dispose();
    this._renderer = null;
    this._scene = null;
    this._post = null;
    this._controller = null;
    this._gameGraph = null;
    this._mounted = false;
  }

  protected render() {
    if (this._offline) {
      return html`
        <div class="drift-chart drift-chart--offline" role="alert">
          <p class="drift-chart__offline-title">${msg('Instrument offline')}</p>
          <p class="drift-chart__offline-body">
            ${msg('The Driftkarte needs WebGL2, which this display cannot provide.')}
          </p>
        </div>
      `;
    }
    return html`
      <div class="drift-chart">
        <div
          class="drift-chart__viewport"
          role="img"
          aria-label=${msg('DRIFT navigation chart – the frequency-layered Bleed')}
        >
          <canvas
            class="drift-chart__canvas"
            @pointerdown=${this._onPointerDown}
            @pointerup=${this._onPointerUp}
          ></canvas>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-chart': VelgDriftChartHost;
  }
}
