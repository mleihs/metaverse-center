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
import { repeat } from 'lit/directives/repeat.js';
import * as THREE from 'three';

import { captureError } from '../../services/SentryService.js';
import type { DriftChart, DriftChartNode, TravelRun } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';
import { generateChart } from './chart/generate.js';
import type { ChartData, FrameCtx } from './chart/types.js';
import { PanZoomController } from './controls/panzoom.js';
// Component CSS as a string (Vite `?inline`) so it can be injected into the
// containing scope — a plain import would auto-inject into document.head and
// never reach an ancestor shadow root. See SimulationWorldMap for the rationale.
import COMPONENT_CSS from './drift-chart.css?inline';
import { FREQUENCIES, freqColorByName, readFreqPalette } from './palette.js';
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

/** One Erstvermessung claim to stamp on the board: a charted node + whether it's mine. */
type SealDatum = { key: string; x: number; y: number; mine: boolean };

/** German display label for a node type (the dossier eyebrow / interstitial title). */
function nodeTypeLabel(type: string): string {
  switch (type) {
    case 'broadcast_rand':
      return msg('Broadcast-Welt');
    case 'interstitial':
      return msg('Zwischenraum');
    case 'tiefdrift-core':
      return msg('Tiefdrift-Kern');
    default:
      return type;
  }
}

/** German display label for a distance band (near→deep is the push-your-luck risk read). */
function distanceBandLabel(band: string): string {
  switch (band) {
    case 'near':
      return msg('Nah');
    case 'mid':
      return msg('Mittel');
    case 'deep':
      return msg('Tief');
    default:
      return band;
  }
}

/** German display label for a bleed vector (palette FREQUENCIES order, index 0–6).
 *  Exported because the HUD names the same vectors on the signal option chips (W2) — one
 *  vocabulary, one place, or the board and the panel start calling the same thing two
 *  different names. */
export function vectorLabel(vector: string): string {
  switch (vector) {
    case 'commerce':
      return msg('Handel');
    case 'language':
      return msg('Sprache');
    case 'memory':
      return msg('Gedächtnis');
    case 'resonance':
      return msg('Resonanz');
    case 'architecture':
      return msg('Architektur');
    case 'dream':
      return msg('Traum');
    case 'desire':
      return msg('Begehren');
    default:
      return vector;
  }
}

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

  /** Erstvermessung claims keyed by node_stable_key — a seal is planted on each. */
  @property({ attribute: false }) claimedKeys: Set<string> = new Set();
  /** The subset of claimedKeys the viewer owns — rendered as the amber --self seal. */
  @property({ attribute: false }) selfKeys: Set<string> = new Set();

  /** Pixels of the board's LEFT edge that the HUD overlays. The camera fit frames the graph
   *  into the band the player can actually see, not into the full canvas (see
   *  _frameCameraToGraph). The owner sets it because only the owner knows its HUD. */
  @property({ type: Number }) gutterLeft = 0;

  @state() private _offline = false;
  /** The node under the cursor — drives the hover dossier (inspect without moving). */
  @state() private _hoverNode: DriftChartNode | null = null;

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
  /** Viewport size the camera was last framed for (drives the re-fit on a real resize). */
  private _framedFor: { w: number; h: number } | null = null;
  private _rafId = 0;
  private _elapsed = 0;
  /** 0 when the user prefers reduced motion (freezes the background drift), else 1. */
  private _bgMotion = 1;
  private _lastTime = 0;
  private _pixelRatio = 1;
  private _tween: { from: number; to: number; start: number; dur: number } | null = null;
  private _tune = 2;
  // The framed-to-graph view height — the reference zoom at which seals render ~1×.
  private _refViewHeight = INITIAL_VIEW_HEIGHT;
  private readonly _tint = new THREE.Color();
  private _mounted = false;
  private _pointerDownAt: { x: number; y: number; t: number } | null = null;
  private _adjacentIds = new Set<string>();
  /** Held once instead of re-created per pointer event: the MediaQueryList keeps `matches`
   *  live, so a mouse→touch switch is still picked up without allocating on every move. */
  private _coarsePointer = matchMedia('(pointer: coarse)');

  // HTML world-name labels over the canvas (homes only); transforms updated per frame.
  private _labelLayer: HTMLElement | null = null;
  private _labels: { el: HTMLElement; id: string; x: number; y: number }[] = [];

  // Erstvermessung seals over the canvas — rendered declaratively (Lit, so the icon
  // glyph comes from icons.ts) and projected to screen each frame. _sealData is the
  // claimed-node list the template maps; _seals is the live projection list.
  private _sealData: SealDatum[] = [];
  private _seals: { el: HTMLElement; x: number; y: number }[] = [];

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

  protected willUpdate(changed: Map<string, unknown>): void {
    // Recompute the claimed-node list the seal layer renders from — only when its
    // inputs change, so unrelated re-renders (frequency, run, offline) stay cheap.
    if (changed.has('claimedKeys') || changed.has('selfKeys') || changed.has('chartData')) {
      this._sealData = this._computeSealData();
    }
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
    // Honor claims or topology changed → re-point the per-frame projection at the
    // freshly-rendered seal elements (declared in render(); no imperative rebuild).
    if (changed.has('claimedKeys') || changed.has('selfKeys') || changed.has('chartData')) {
      this._resyncSeals();
    }
    // Hover dossier: drop a stale hover if the topology changed, else anchor a fresh
    // hover beside its node before paint (the frame loop then keeps it glued on pan).
    if (changed.has('chartData') && this._hoverNode) {
      this._hoverNode = null;
    } else if (changed.has('_hoverNode') && this._hoverNode) {
      const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
      if (wrap) this._positionDossier(wrap);
    }
  }

  private _mount(): void {
    if (this._mounted) return;
    const canvas = this.querySelector<HTMLCanvasElement>('canvas.drift-chart__canvas');
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    if (!canvas || !wrap) return;
    this._labelLayer = this.querySelector<HTMLElement>('.drift-chart__labels');

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
    this._bgMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
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
    this._resyncSeals(); // point + place any seals the first render produced

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

    // Re-frame on a real size change. The fit is aspect-dependent, and this observer used to
    // resize the RENDERER only — so a window resize, a rotation or a split-screen left the
    // camera framed for the previous format (the graph half off-board, or lost in space).
    // Guarded on a meaningful delta so a scrollbar flicker cannot fight the user's own zoom.
    const last = this._framedFor;
    const changed = !last || Math.abs(last.w - w) > 24 || Math.abs(last.h - h) > 24;
    if (changed && this._gameGraph) {
      this._framedFor = { w, h };
      this._frameCameraToGraph();
    }
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
    // Keep the spike's ambient scatter + broadcast halos as the deep glowing Bleed
    // field BEHIND the board (they render at a lower order; the gameplay nodes are
    // bigger, ringed, labelled → still read clearly). Only the sample corridors are
    // hidden — fake Strömungsbänder would compete with the real edges. Background fbm
    // + Bleed particles + UnrealBloom stay on as before.
    if (this._nodes) this._nodes.mesh.visible = true;
    if (this._broadcasts) this._broadcasts.group.visible = true;
    if (this._corridors) this._corridors.group.visible = false;
    this._frameCameraToGraph();
    this._buildLabels();
    this._syncRunState();
  }

  /** (Re)build the HTML world-name labels for broadcast_rand homes (imperative DOM,
   *  preserved across Lit re-renders; positioned each frame in _positionLabels). */
  private _buildLabels(): void {
    const layer = this._labelLayer;
    if (!layer) return;
    layer.replaceChildren();
    this._labels = [];
    for (const node of this.chartData?.nodes ?? []) {
      if (node.node_type !== 'broadcast_rand' || !node.simulation_name) continue;
      const el = document.createElement('span');
      el.className = 'drift-chart__label';
      el.textContent = node.simulation_name;
      layer.appendChild(el);
      this._labels.push({ el, id: node.id, x: node.x, y: node.y });
    }
  }

  /** The claimed nodes the seal layer renders — derived from chartData + the honor Sets
   *  in willUpdate (any node_type, so interstitials count, not just homes). */
  private _computeSealData(): SealDatum[] {
    if (!this.claimedKeys.size) return [];
    const out: SealDatum[] = [];
    for (const node of this.chartData?.nodes ?? []) {
      if (!this.claimedKeys.has(node.stable_key)) continue;
      out.push({
        key: node.stable_key,
        x: node.x,
        y: node.y,
        mine: this.selfKeys.has(node.stable_key),
      });
    }
    return out;
  }

  /** Re-point the per-frame projection at the freshly-rendered seal elements and place
   *  them once now (in updated(), before paint). The seals are declared in render()
   *  (keyed by stable_key), so a newly-won claim mounts a fresh element and runs the
   *  stamp ceremony at its node — not for one frame at the layer's corner — while
   *  existing seals keep their DOM and never replay. */
  private _resyncSeals(): void {
    this._seals = [...this.querySelectorAll<HTMLElement>('.drift-chart__seal')].map((el) => ({
      el,
      x: Number(el.dataset.x),
      y: Number(el.dataset.y),
    }));
    const wrap = this.querySelector<HTMLElement>('.drift-chart__viewport');
    if (wrap) this._projectLayer(this._seals, wrap);
  }

  /** One Erstvermessung seal: an octagonal Bureau medallion with a compass-rose mark. */
  private _renderSeal(d: SealDatum) {
    return html`
      <span
        class="drift-chart__seal ${d.mine ? 'drift-chart__seal--self' : ''}"
        data-x=${d.x}
        data-y=${d.y}
      >
        <span class="drift-chart__seal-inner">
          <span class="drift-chart__seal-stamp"></span>
          <span class="drift-chart__seal-mark">${icons.compassRose(14)}</span>
        </span>
      </span>
    `;
  }

  /** Project an overlay layer (labels or seals) to screen space; cull off-viewport.
   *
   * The screen point is written as `--x`/`--y`, which the stylesheet composes into each
   * chip's `transform` — NOT as `left`/`top`. This runs on every animation frame, and
   * left/top would re-lay-out and re-RASTERISE the chip each time: the text is redrawn
   * 60-120x a second while the WebGL canvas composites underneath, and the two do not
   * always reach the screen together. That mismatch is exactly what the board showed —
   * chips appearing for a frame as bare dark rectangles, flashing over the canvas. A
   * transform translates a layer that was rasterised once, so the glyphs travel with
   * their chip and there is nothing left to tear. */
  private _projectLayer(
    items: { el: HTMLElement; x: number; y: number }[],
    wrap: HTMLElement,
  ): void {
    if (!this._controller || !items.length) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    for (const item of items) {
      const s = this._controller.worldToScreen(item.x, item.y);
      const onscreen = s.x >= -80 && s.x <= w + 80 && s.y >= -40 && s.y <= h + 120;
      item.el.style.display = onscreen ? 'block' : 'none';
      if (onscreen) {
        item.el.style.setProperty('--x', `${s.x}px`);
        item.el.style.setProperty('--y', `${s.y}px`);
      }
    }
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
    const w = wrap?.clientWidth ?? 0;
    const h = wrap?.clientHeight ?? 0;
    if (!w || !h) return;

    // The HUD is painted ON the board and permanently hides a left band of it. Framing the
    // graph into the FULL canvas therefore parks part of it under the HUD — worst on narrow
    // screens, where that band is a third of the width. Fit into the band the player can
    // actually see, and shift the camera so the graph is centred in THAT band.
    const gutter = Math.min(this.gutterLeft, Math.max(0, w - 240));
    const visibleW = Math.max(240, w - gutter);

    const dx = maxX - minX;
    const dy = maxY - minY;
    // Orthographic: viewHeight = world units across the canvas height. The graph must fit
    // vertically (dy) AND horizontally inside the visible band (dx scaled by h/visibleW).
    // Padding is a RATIO, not a constant: a fixed +200 world units was a wide margin on a
    // small board and invisible on a 4K one — the same graph framed differently per screen.
    const fitH = Math.max(dy, (dx * h) / visibleW) * 1.18;
    // frameTo sets BOTH live + target zoom; a bare viewHeight assignment is eased
    // back to the controller's initial target on the next frame (the ring overflowed).
    const fitView = Math.max(420, fitH);
    // Reference zoom for the seal scale: ~1× at the framed view, then the seals shrink
    // when you zoom out (so they don't dwarf the shrinking nodes) and grow when you zoom
    // in — both clamped in _frame so a claim marker never vanishes or turns gigantic.
    this._refViewHeight = fitView;

    // The camera centre lands at the canvas centre, so to put the graph's centre in the
    // middle of the VISIBLE band it must sit half a gutter to the left of it.
    const unitsPerPixel = fitView / h;
    const centerX = (minX + maxX) / 2 - (unitsPerPixel * gutter) / 2;
    this._controller.frameTo({ x: centerX, y: (minY + maxY) / 2 }, fitView);
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
    // Mark the label of the world the traveller is standing on (amber accent).
    for (const label of this._labels) {
      label.el.classList.toggle('drift-chart__label--position', label.id === positionId);
    }
  }

  private _onPointerDown = (e: PointerEvent): void => {
    this._pointerDownAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  /**
   * The gameplay node nearest a canvas point, within a forgiving tap radius (or null).
   *
   * `reachableOnly` is what makes the board actually clickable. The Drift is dense — 40+
   * interstitials packed into the middle band — so the node nearest the cursor is very often
   * one you cannot move to. The click path used to take that nearest node and then discard
   * the click because it was not adjacent: a reachable node well inside the tap radius was
   * silently ignored, and the board felt broken (reported in the W1 playtest). The move
   * intent now searches only among REACHABLE nodes; the hover dossier keeps searching all of
   * them (you may inspect anything, you may only travel to a neighbour).
   */
  private _nodeAt(
    offsetX: number,
    offsetY: number,
    opts: { reachableOnly?: boolean } = {},
  ): string | null {
    const hit = this._nodesAt(offsetX, offsetY);
    return opts.reachableOnly ? hit.reachable : hit.any;
  }

  /** Both answers in ONE scan: the nearest node (what the dossier inspects) and the nearest
   *  REACHABLE node (what a click may move to). The pointermove path needs both on every
   *  single mouse event, and used to walk the whole node list twice — each walk allocating a
   *  fresh MediaQueryList via `matchMedia(...)` — to get them. */
  private _nodesAt(
    offsetX: number,
    offsetY: number,
  ): { any: string | null; reachable: string | null } {
    if (!this._controller || !this._gameGraph) return { any: null, reachable: null };
    const world = this._controller.screenToWorld(offsetX, offsetY);
    // A coarse pointer (finger) needs the 44px WCAG touch target; a mouse is fine with 30.
    const tapPx = this._coarsePointer.matches ? 44 : 30;
    const radius = tapPx * this._controller.unitsPerPixel;

    let anyId: string | null = null;
    let anyDist = radius;
    let reachId: string | null = null;
    let reachDist = radius;

    for (const node of this._gameGraph.nodeWorldPositions) {
      const d = Math.hypot(node.x - world.x, node.y - world.y);
      if (d >= radius) continue;
      if (d < anyDist) {
        anyDist = d;
        anyId = node.id;
      }
      if (d < reachDist && this._adjacentIds.has(node.id)) {
        reachDist = d;
        reachId = node.id;
      }
    }
    return { any: anyId, reachable: reachId };
  }

  // A click (little movement, short dwell) on a reachable node emits a move intent;
  // a drag is a pan and is ignored. The server still authorises the move (the RPC
  // validates the edge) — adjacency here only gates the click + the highlight.
  private _onPointerUp = (e: PointerEvent): void => {
    const down = this._pointerDownAt;
    this._pointerDownAt = null;
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (performance.now() - down.t > 500) return;
    const bestId = this._nodeAt(e.offsetX, e.offsetY, { reachableOnly: true });
    if (bestId) {
      this.dispatchEvent(
        new CustomEvent('drift-node-pick', {
          detail: { nodeId: bestId },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  // Hover dossier: surface the node under the cursor for inspection (no move). Suppressed
  // mid-drag (the pan owns the gesture); the cursor turns into a pointer over a pickable
  // node so the inspect/click affordance reads.
  private _onPointerMove = (e: PointerEvent): void => {
    if (this._pointerDownAt) {
      if (this._hoverNode) this._hoverNode = null;
      return;
    }
    const { any: id, reachable } = this._nodesAt(e.offsetX, e.offsetY);
    // The pointer cursor promises a MOVE, so it may only appear where a move is possible.
    // (It used to appear over every node, including the unreachable ones — an affordance
    // that lied, and the reason the board read as "clicks do nothing".)
    (e.currentTarget as HTMLElement).style.cursor = reachable ? 'pointer' : '';
    if (id !== (this._hoverNode?.id ?? null)) {
      this._hoverNode = id ? (this.chartData?.nodes.find((n) => n.id === id) ?? null) : null;
    }
  };

  private _onPointerLeave = (): void => {
    if (this._hoverNode) this._hoverNode = null;
  };

  /** Bleed vectors active at a node, decoded from its 7-bit frequency_mask. */
  private _freqVectors(mask: number): string[] {
    return FREQUENCIES.filter((_, i) => (mask & (1 << i)) !== 0);
  }

  /** Vectors that bleed through the corridors touching a node (union of edge permeability). */
  private _permeableVectors(node: DriftChartNode): string[] {
    const open = new Set<string>();
    for (const e of this.chartData?.edges ?? []) {
      if (e.from_node !== node.id && e.to_node !== node.id) continue;
      for (const [vec, mult] of Object.entries(e.permeability)) {
        if (mult > 0) open.add(vec);
      }
    }
    return FREQUENCIES.filter((v) => open.has(v));
  }

  /** Anchor the hover dossier beside its node (upper-right by default; flips at edges). */
  private _positionDossier(wrap: HTMLElement): void {
    const node = this._hoverNode;
    const el = this.querySelector<HTMLElement>('.drift-chart__dossier');
    if (!node || !el || !this._controller) return;
    const s = this._controller.worldToScreen(node.x, node.y);
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    let left = s.x + 18;
    if (left + pw > wrap.clientWidth - 8) left = s.x - pw - 18;
    left = Math.max(8, left);
    let top = s.y - ph - 12;
    if (top < 8) top = s.y + 18;
    top = Math.min(top, wrap.clientHeight - ph - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

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
    // Seals scale with the zoom (clamped) so they read as planted-on-the-map markers,
    // not fixed-size pins that dwarf the nodes when you zoom out.
    const sealScale = Math.max(
      0.45,
      Math.min(1.15, this._refViewHeight / this._controller.viewHeight),
    );
    wrap.style.setProperty('--seal-scale', sealScale.toFixed(3));
    this._projectLayer(this._labels, wrap);
    this._projectLayer(this._seals, wrap);
    if (this._hoverNode) this._positionDossier(wrap); // keep the dossier glued during pan

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
    this._background.update(ctx, tint, this._bgMotion);
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
    this._labelLayer?.replaceChildren();
    this._labels = [];
    // The seal elements are Lit-owned (re-rendered from _sealData on reconnect, when
    // willUpdate may not re-fire), so _sealData is intentionally retained as the render
    // source; only the projection refs to the now-stale DOM are dropped here.
    this._seals = [];
    this._hoverNode = null;
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
          aria-label=${msg('DRIFT-Navigationskarte – der frequenzgeschichtete Bleed')}
        >
          <canvas
            class="drift-chart__canvas"
            @pointerdown=${this._onPointerDown}
            @pointerup=${this._onPointerUp}
            @pointermove=${this._onPointerMove}
            @pointerleave=${this._onPointerLeave}
          ></canvas>
          <!-- World-name labels (homes); imperative children, positioned each frame.
               aria-hidden: a non-visual ChartAccessibilityList is the a11y path (§11.3). -->
          <div class="drift-chart__labels" aria-hidden="true"></div>
          <!-- Erstvermessung seals (any claimed node): declared here (keyed by
               stable_key) so the glyph comes from icons.ts and a newly-won claim runs
               the stamp ceremony; projected to each node's screen point per frame. -->
          <div class="drift-chart__seals" aria-hidden="true">
            ${repeat(
              this._sealData,
              (d) => d.key,
              (d) => this._renderSeal(d),
            )}
          </div>
          <!-- Hover dossier (inspect a node without moving). aria-hidden: a mouse-only
               affordance; the non-visual ChartAccessibilityList is the a11y path (§11.3). -->
          ${this._hoverNode ? this._renderDossier(this._hoverNode) : null}
        </div>
      </div>
    `;
  }

  /** The hover dossier: world/type, the node's active bleed vectors, its distance band,
   *  and which vectors bleed through the corridors here — all without moving there. */
  private _renderDossier(node: DriftChartNode) {
    const open = this._permeableVectors(node);
    return html`
      <div class="drift-chart__dossier" aria-hidden="true">
        ${
          node.simulation_name
            ? html`<p class="drift-chart__dossier-eyebrow">${nodeTypeLabel(node.node_type)}</p>`
            : null
        }
        <p class="drift-chart__dossier-title">
          ${node.simulation_name ?? nodeTypeLabel(node.node_type)}
        </p>
        <dl class="drift-chart__dossier-rows">
          <div class="drift-chart__dossier-row">
            <dt>${msg('Frequenzen')}</dt>
            <dd>${this._renderVectorChips(this._freqVectors(node.frequency_mask))}</dd>
          </div>
          <div class="drift-chart__dossier-row">
            <dt>${msg('Distanz')}</dt>
            <dd>
              <span
                class="drift-chart__dossier-band drift-chart__dossier-band--${node.distance_band}"
              >
                ${distanceBandLabel(node.distance_band)}
              </span>
            </dd>
          </div>
          <div class="drift-chart__dossier-row">
            <dt>${msg('Durchlässig')}</dt>
            <dd>
              ${
                open.length
                  ? this._renderVectorChips(open)
                  : html`<span class="drift-chart__dossier-none">${msg('versiegelt')}</span>`
              }
            </dd>
          </div>
        </dl>
      </div>
    `;
  }

  private _renderVectorChips(vectors: string[]) {
    if (!vectors.length) return html`<span class="drift-chart__dossier-none">–</span>`;
    return html`
      <span class="drift-chart__chips">
        ${vectors.map(
          (v) => html`
            <span class="drift-chart__chip">
              <span class="drift-chart__chip-dot" style="background:${freqColorByName(v)}"></span>
              ${vectorLabel(v)}
            </span>
          `,
        )}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-chart': VelgDriftChartHost;
  }
}
