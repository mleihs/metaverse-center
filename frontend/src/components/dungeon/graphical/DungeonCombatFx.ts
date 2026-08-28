/**
 * Dungeon Combat FX — the PixiJS v8 combat-juice layer (Phase 2 of the rollout).
 *
 * A light-DOM WebGL overlay that sits ON TOP of the graphical scene plane and
 * plays per-event juice when a combat round resolves: hit flashes, floating
 * damage numbers, particle bursts, screen-shake on heavy/critical hits, miss
 * fades, and a victory / defeat / stalemate flourish at the end of the round.
 *
 * Architecture (binding rollout decisions):
 *   - SECOND CONSUMER, zero game logic. It subscribes to the client-only
 *     `dungeonState.lastRoundResult` signal (published at the two submit sites)
 *     and renders whatever the server already resolved. It never decides
 *     outcomes — damage/hit/stress all come straight off CombatEvent.
 *   - Light DOM (createRenderRoot → this), mirroring DriftChartHost: lets the
 *     parent DungeonGraphicalView style this host + its canvas directly (they
 *     share its shadow scope), and lets getComputedStyle resolve the scene's
 *     forced-dark tokens + status colors for the Pixi palette. The canvas is
 *     pointer-events:none, so the Shadow-DOM canvas-coordinate quirk that drove
 *     DriftChartHost into light DOM does not apply here — but we follow the same
 *     pattern for token access + parent-owned layout.
 *   - effect()-subscription (NOT SignalWatcher): a round resolution is a delta
 *     pushed imperatively into Pixi, not declarative state (see DriftView).
 *   - Lazy WebGL: PixiJS is dynamically imported and the renderer initialized
 *     only on the FIRST resolved round, so browsing rooms graphically without
 *     fighting never pays the WebGL/bundle cost.
 *   - Degrades cleanly: WebGL unavailable → host stays dormant, the HUD remains
 *     fully playable. prefers-reduced-motion → instant static damage numbers,
 *     no shake / drift / particles.
 *
 * Enemies expose only `condition_display` (no HP numbers), so FX are driven by
 * CombatEvent (actor / target / hit / damage / stress) and the round flags, not
 * by health bars. Positioning is zonal: damage to the party reads in the lower
 * (party) band, damage to enemies in the upper (enemy) band.
 *
 * Pattern: DriftChartHost.ts (light-DOM WebGL host, mount/teardown lifecycle).
 */

import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Application, Container } from 'pixi.js';

import { dungeonState } from '../../../services/DungeonStateManager.js';
import { captureError } from '../../../services/SentryService.js';
import type { CombatEvent, CombatRoundResult } from '../../../types/dungeon.js';

// ── Tunables ─────────────────────────────────────────────────────────────────
/** Gap between successive events in a round — the round reads as a sequence. */
const EVENT_STAGGER_MS = 280;
/** Floating-number lifetime. */
const NUMBER_LIFE_MS = 1150;
/** Particle burst lifetime. */
const BURST_LIFE_MS = 720;
/** Expanding impact-ring lifetime. */
const RING_LIFE_MS = 520;
/** Flourish (VICTORY / DEFEAT) lifetime. */
const FLOURISH_LIFE_MS = 1800;
/** Damage >= this reads as a critical hit (matches the SFX heuristic). */
const CRIT_DAMAGE = 3;
/** Clamp per-frame delta so a backgrounded tab doesn't fast-forward FX. */
const MAX_FRAME_MS = 50;

// ── Phase 2.1 juice: hit-stop, trauma-shake, overshoot ───────────────────────
// Hit-stop ("freeze frame"): on impact the FX clock nearly stops for a beat, so
// the flash + shake + particles register before the next event spawns. This is
// the single biggest "weight" lever — a heavy blow that pauses time reads as
// heavier than the same blow at full speed. Durations scale with severity.
const HITSTOP_STRESS_MS = 30;
const HITSTOP_LIGHT_MS = 60;
const HITSTOP_MED_MS = 150;
const HITSTOP_CRIT_MS = 260;
/** During hit-stop the clock advances at this fraction of real time (a hair of
 *  motion, not a dead hang). The schedule + sprites + shake all run off the
 *  scaled clock, so everything freezes together. */
const FREEZE_TIME_SCALE = 0.06;

// Trauma-shake (Nilson, GDC 2013): shake magnitude is trauma², trauma decays
// linearly, and the offset is sampled from coherent value-noise — NOT
// Math.random, which reads as jittery static. Axes (and rotation) use different
// noise seeds so the shake never collapses onto a diagonal.
/** Trauma lost per second (full trauma settles in ~1/this seconds). */
const TRAUMA_DECAY_PER_S = 2.2;
/** Max layer translation in px at trauma=1 (shake=1). */
const SHAKE_MAX_PX = 22;
/** Max layer rotation in radians at trauma=1. */
const SHAKE_MAX_ROT = 0.045;
/** Value-noise sampling frequency (Hz) — higher = busier shake. */
const SHAKE_FREQ = 19;
// Per-event trauma contributions (clamped to 1).
const TRAUMA_ENEMY_HIT = 0.28;
const TRAUMA_PARTY_HIT = 0.42;
const TRAUMA_CRIT = 0.7;
const TRAUMA_VICTORY = 0.4;
const TRAUMA_DEFEAT = 1;
/** Crit-only squash/stretch punch on the FX layer (decays fast). */
const PUNCH_DECAY_PER_S = 7;

/** Back-out easing: overshoots past 1 then settles. `s` controls overshoot
 *  amount (1.70158 ≈ +10%, ~3.4 ≈ +30%). p in [0,1] → eased value. */
function easeOutBack(p: number, s = 1.70158): number {
  const c3 = s + 1;
  return 1 + c3 * (p - 1) ** 3 + s * (p - 1) ** 2;
}

/** A live FX element: a Pixi display object plus its own per-frame updater. */
interface FxSprite {
  node: Container;
  age: number;
  life: number;
  /** Advance the sprite by `dt` ms at normalized progress `t` (age/life, 0–1). */
  tick: (sprite: FxSprite, dt: number, t: number) => void;
}

/** Token-resolved palette (CSS color strings; Pixi accepts hex + named colors).
 *  Only the colors the FX actually paint: enemy-on-party damage (danger),
 *  party-on-enemy damage (warning), heal/victory (success), miss/stalemate
 *  (muted), and the near-black text outline (surface). */
interface Palette {
  danger: string;
  success: string;
  warning: string;
  muted: string;
  surface: string;
}

/** Subset of CSS font-weights the FX use (assignable to Pixi's TextStyleFontWeight). */
type FxWeight = '400' | '700' | '900';

@localized()
@customElement('velg-dungeon-combat-fx')
export class VelgDungeonCombatFx extends LitElement {
  // Light DOM so the parent scene styles this host + canvas and tokens resolve.
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  // ── Pixi runtime (created lazily on the first resolved round) ─────────────
  private _PIXI: typeof import('pixi.js') | null = null;
  private _app: Application | null = null;
  private _layer: Container | null = null;
  private _sprites: FxSprite[] = [];
  /** Pending spawns scheduled into the future (event stagger + flourish). */
  private _schedule: { at: number; run: () => void }[] = [];
  /** Monotonic FX clock in ms (advanced by the ticker, drives the schedule). */
  private _clock = 0;
  /** Decaying screen-shake energy in [0,1]; applied magnitude is trauma². */
  private _trauma = 0;
  /** Real-time ms of hit-stop remaining (the clock crawls while this burns). */
  private _freeze = 0;
  /** Crit-only squash/stretch punch on the FX layer, in [0,~0.07]. */
  private _punch = 0;

  private _palette: Palette = {
    danger: 'red',
    success: 'lime',
    warning: 'orange',
    muted: 'gray',
    surface: 'black',
  };
  private _fontFamily = 'monospace';
  private _reducedMotion = false;

  private _ready = false;
  /**
   * Renderer setup failed for good. Degrading to "no FX" is the right answer —
   * the HUD stays fully playable — but it must not be *silent*: a dead FX layer
   * is indistinguishable from a quiet round, which is exactly how the
   * unsafe-eval abort survived unnoticed on production (remediation plan §A-1).
   */
  @state() private _degraded = false;
  private _initPromise: Promise<void> | null = null;
  private _disposeEffect: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  /** Reference-dedupe so a re-render / reconnect never replays the same round. */
  private _lastPlayed: CombatRoundResult | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    // effect() lives across reconnects; the Pixi renderer is (re)built lazily on
    // the next round. The first synchronous run primes _lastPlayed without
    // replaying a stale result that was already on-screen before mount.
    this._lastPlayed = dungeonState.lastRoundResult.value;
    this._disposeEffect ??= effect(() => {
      const result = dungeonState.lastRoundResult.value;
      if (!result || result === this._lastPlayed) return;
      this._lastPlayed = result;
      void this._onRound(result);
    });
  }

  override disconnectedCallback(): void {
    this._disposeEffect?.();
    this._disposeEffect = null;
    this._teardownPixi();
    super.disconnectedCallback();
  }

  // ── Round handling ────────────────────────────────────────────────────────

  private async _onRound(result: CombatRoundResult): Promise<void> {
    await this._ensurePixi();
    if (!this._ready) return; // WebGL unavailable — HUD stays playable.
    this._playRound(result);
  }

  private async _ensurePixi(): Promise<void> {
    // Neither a CSP nor a missing WebGL2 context heals mid-session; retrying per
    // round would only repeat the same report every time a blow lands.
    if (this._ready || this._degraded) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initPixi();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  private async _initPixi(): Promise<void> {
    const canvas = this.querySelector<HTMLCanvasElement>('canvas.fx-canvas');
    if (!canvas) return;

    try {
      // `pixi.js/unsafe-eval` MUST be loaded before Application.init(). Pixi v8
      // compiles its shader/UBO/uniform sync routines with `new Function()`;
      // production serves a CSP without `unsafe-eval`, so init() aborts with
      // "Current environment does not allow unsafe-eval" and the entire FX
      // layer stays dead — invisible in dev, where Vite serves no such CSP.
      // The module patches Pixi's prototypes onto the same instances the barrel
      // exports (ESM dedupe) and installs eval-free polyfills instead.
      // Loaded unconditionally, not behind a capability probe: one code path
      // that dev and production both exercise is the point of the fix.
      const [PIXI] = await Promise.all([import('pixi.js'), import('pixi.js/unsafe-eval')]);
      // Disconnected during the async import — abort before touching WebGL.
      if (!this.isConnected) return;

      const app = new PIXI.Application();
      await app.init({
        canvas,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: Math.max(1, this.clientWidth),
        height: Math.max(1, this.clientHeight),
      });
      if (!this.isConnected) {
        app.destroy({ removeView: false }, { children: true });
        return;
      }

      this._PIXI = PIXI;
      this._app = app;
      this._layer = new PIXI.Container();
      app.stage.addChild(this._layer);

      this._readPalette();
      this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this);

      app.ticker.add((ticker) => this._frame(ticker.deltaMS));
      this._ready = true;
    } catch (err) {
      // WebGL2 unavailable / context creation failed — degrade to no FX.
      captureError(err, { source: 'VelgDungeonCombatFx._initPixi' });
      this._ready = false;
      this._degraded = true;
    }
  }

  private _teardownPixi(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._schedule = [];
    for (const sprite of this._sprites) sprite.node.destroy({ children: true });
    this._sprites = [];
    // removeView:false — the canvas is Lit-owned (declared in render()); Lit
    // removes it on unmount. Destroying it here would double-free.
    this._app?.destroy({ removeView: false }, { children: true });
    this._app = null;
    this._layer = null;
    this._PIXI = null;
    this._clock = 0;
    this._trauma = 0;
    this._freeze = 0;
    this._punch = 0;
    this._ready = false;
  }

  private _resize(): void {
    const app = this._app;
    if (!app) return;
    const w = Math.max(1, this.clientWidth);
    const h = Math.max(1, this.clientHeight);
    app.renderer.resize(w, h);
  }

  private _readPalette(): void {
    const cs = getComputedStyle(this);
    const read = (name: string, fallback: string): string =>
      cs.getPropertyValue(name).trim() || fallback;
    this._palette = {
      danger: read('--color-danger', 'red'),
      success: read('--color-success', 'lime'),
      warning: read('--color-warning', 'orange'),
      muted: read('--color-text-muted', 'gray'),
      surface: read('--color-surface', 'black'),
    };
    this._fontFamily = read('--font-brutalist', 'monospace');
  }

  // ── Per-frame loop ──────────────────────────────────────────────────────────

  private _frame(deltaMs: number): void {
    const app = this._app;
    const layer = this._layer;
    if (!app || !layer) return;
    const real = Math.min(MAX_FRAME_MS, deltaMs);

    // Hit-stop: while frozen the FX clock crawls (FREEZE_TIME_SCALE of real
    // time), so the schedule, sprites AND shake all hang on the impact frame
    // together. The freeze timer itself burns down in real time.
    let dt = real;
    if (this._freeze > 0) {
      this._freeze -= real;
      dt = real * FREEZE_TIME_SCALE;
    }
    this._clock += dt;

    // Fire any scheduled spawns whose time has come.
    while (this._schedule.length && this._schedule[0].at <= this._clock) {
      const next = this._schedule.shift();
      next?.run();
    }

    // Advance live sprites; retire finished ones.
    for (let i = this._sprites.length - 1; i >= 0; i--) {
      const sprite = this._sprites[i];
      sprite.age += dt;
      const t = Math.min(1, sprite.age / sprite.life);
      sprite.tick(sprite, dt, t);
      if (sprite.age >= sprite.life) {
        sprite.node.destroy({ children: true });
        this._sprites.splice(i, 1);
      }
    }

    // Trauma-shake: magnitude is trauma², the offset comes from coherent
    // value-noise (decoupled per-axis seeds) rather than per-frame random, and
    // trauma decays linearly. A crit also adds a fast-decaying squash punch.
    this._trauma = Math.max(0, this._trauma - TRAUMA_DECAY_PER_S * (dt / 1000));
    this._punch = Math.max(0, this._punch - PUNCH_DECAY_PER_S * (dt / 1000));
    const shake = this._reducedMotion ? 0 : this._trauma * this._trauma;
    if (shake > 0.0004) {
      const nt = (this._clock / 1000) * SHAKE_FREQ;
      layer.x = this._noise(nt, 11) * shake * SHAKE_MAX_PX;
      layer.y = this._noise(nt, 29) * shake * SHAKE_MAX_PX;
      layer.rotation = this._noise(nt, 53) * shake * SHAKE_MAX_ROT;
    } else {
      layer.x = 0;
      layer.y = 0;
      layer.rotation = 0;
    }
    // Squash/stretch punch about the layer centre (x stretches, y squashes).
    if (this._punch > 0.0005 && !this._reducedMotion) {
      layer.pivot.set(app.screen.width / 2, app.screen.height / 2);
      layer.position.set(layer.x + app.screen.width / 2, layer.y + app.screen.height / 2);
      layer.scale.set(1 + this._punch, 1 - this._punch * 0.6);
    } else if (layer.scale.x !== 1 || layer.scale.y !== 1) {
      layer.pivot.set(0, 0);
      layer.scale.set(1);
    }

    // Idle: no scheduled spawns, no live sprites, shake + freeze settled → stop
    // the render loop so a dormant combat layer doesn't burn the GPU between
    // rounds. _playRound restarts it. Render the now-empty stage once before
    // stopping so the cleared frame is what remains on screen.
    if (
      !this._schedule.length &&
      !this._sprites.length &&
      this._trauma === 0 &&
      this._freeze <= 0
    ) {
      app.render();
      app.ticker.stop();
    }
  }

  /** Cheap coherent 1-D value-noise in [-1,1] (smootherstep-interpolated hashed
   *  lattice). Used for shake offsets — coherent, so the jitter reads as a
   *  physical wobble instead of random static. */
  private _noise(x: number, seed: number): number {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * f * (f * (f * 6 - 15) + 10); // smootherstep
    const a = this._hash(i, seed);
    const b = this._hash(i + 1, seed);
    return (a + (b - a) * u) * 2 - 1;
  }

  private _hash(n: number, seed: number): number {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // ── Round playback ──────────────────────────────────────────────────────────

  private _playRound(result: CombatRoundResult): void {
    if (!this._app) return;
    this._app.ticker.start(); // revive the loop if it idled out after the last round
    // Re-anchor the schedule to "now" so a new round doesn't queue behind the
    // tail of a previous one.
    const base = this._clock;
    const partyNames = new Set(dungeonState.party.value.map((a) => a.agent_name));

    result.events.forEach((event, i) => {
      const at = base + i * EVENT_STAGGER_MS;
      this._schedule.push({ at, run: () => this._playEvent(event, partyNames) });
    });

    // Outcome flourish after the last event has had a beat to land.
    const flourishAt = base + result.events.length * EVENT_STAGGER_MS + 220;
    if (result.victory) {
      this._schedule.push({
        at: flourishAt,
        run: () => this._playFlourish(msg('VICTORY'), this._palette.success, 0.26, TRAUMA_VICTORY),
      });
    } else if (result.wipe) {
      this._schedule.push({
        at: flourishAt,
        run: () => this._playFlourish(msg('DEFEAT'), this._palette.danger, 0.38, TRAUMA_DEFEAT),
      });
    } else if (result.stalemate) {
      this._schedule.push({
        at: flourishAt,
        run: () => this._playFlourish(msg('STALEMATE'), this._palette.muted, 0, 0),
      });
    }
    // Keep the schedule ordered: a new round arriving mid-playback would
    // interleave its spawns with the tail of the previous one. Sort defensively
    // (the list is tiny — a handful of entries per round).
    this._schedule.sort((a, b) => a.at - b.at);
  }

  /** Resolve one CombatEvent into juice: number + burst + (maybe) shake. */
  private _playEvent(event: CombatEvent, partyNames: Set<string>): void {
    const app = this._app;
    if (!app) return;
    const w = app.screen.width;
    const h = app.screen.height;
    const targetIsParty = partyNames.has(event.target);
    // Zonal positioning: party band low, enemy band high; jittered horizontally.
    const y = (targetIsParty ? 0.7 : 0.32) * h;
    const x = w * 0.5 + (Math.random() - 0.5) * w * 0.46;

    const heal = event.stress < 0;
    const crit = event.hit && event.damage >= CRIT_DAMAGE;

    if (!event.hit) {
      this._spawnNumber(msg('MISS'), this._palette.muted, x, y, { size: 16, alpha: 0.7 });
      this._spawnBurst(this._palette.muted, x, y, 4, 0.5);
      return;
    }

    if (heal) {
      // stress<0 is relief/healing applied to an ally.
      this._spawnNumber(`+${Math.abs(event.stress)}`, this._palette.success, x, y, { size: 22 });
      this._spawnBurst(this._palette.success, x, y, 8, 0.7);
      return;
    }

    // Damage / stress landed. Party-on-enemy reads in the accent color, an
    // enemy hitting the party reads as danger.
    const color = targetIsParty ? this._palette.danger : this._palette.warning;
    const label =
      event.damage > 0
        ? `-${event.damage}`
        : event.stress > 0
          ? `${event.stress} ${msg('STR')}`
          : '';
    if (label) {
      this._spawnNumber(label, color, x, y, { size: crit ? 34 : 23, weight: crit ? '900' : '700' });
    }
    this._spawnBurst(color, x, y, crit ? 18 : 10, crit ? 1.2 : 0.8);
    this._spawnRing(color, x, y, crit ? 1.4 : 1);

    // Layered impact (same frame): flash → trauma → hit-stop → squash, scaled by
    // severity. Hit-stop is the weight lever; trauma is the felt recoil.
    this._addTrauma(targetIsParty ? TRAUMA_PARTY_HIT : TRAUMA_ENEMY_HIT);
    this._freeze = Math.max(this._freeze, this._hitStopMs(event.damage, event.stress, crit));
    if (crit) {
      this._spawnFlash(color, 0.16);
      this._addTrauma(TRAUMA_CRIT);
      this._punch = Math.max(this._punch, 0.06);
    }
  }

  /** Trauma is additive but capped — a flurry of hits can't run the shake away. */
  private _addTrauma(amount: number): void {
    this._trauma = Math.min(1, this._trauma + amount);
  }

  /** Hit-stop duration scales with how hard the blow reads. */
  private _hitStopMs(damage: number, stress: number, crit: boolean): number {
    if (crit) return HITSTOP_CRIT_MS;
    if (damage >= 2) return HITSTOP_MED_MS;
    if (damage >= 1) return HITSTOP_LIGHT_MS;
    return stress > 0 ? HITSTOP_STRESS_MS : 0;
  }

  // ── Spawn primitives ────────────────────────────────────────────────────────

  private _spawnNumber(
    text: string,
    color: string,
    x: number,
    y: number,
    opts: { size?: number; weight?: FxWeight; alpha?: number } = {},
  ): void {
    const PIXI = this._PIXI;
    const layer = this._layer;
    if (!PIXI || !layer) return;
    const node = new PIXI.Text({
      text,
      style: {
        fontFamily: this._fontFamily,
        fontSize: opts.size ?? 22,
        fontWeight: opts.weight ?? '700',
        fill: color,
        letterSpacing: 1,
        align: 'center',
        stroke: { color: this._palette.surface, width: 3 },
      },
    });
    node.anchor.set(0.5);
    node.x = x;
    node.y = y;
    const baseAlpha = opts.alpha ?? 1;
    layer.addChild(node);
    const rise = this._reducedMotion ? 0 : 46;
    this._sprites.push({
      node,
      age: 0,
      life: NUMBER_LIFE_MS,
      tick: (s, _dt, t) => {
        s.node.y = y - rise * t;
        // Hold, then fade over the last 45%.
        s.node.alpha = baseAlpha * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
        // Overshoot: scale 0 → ~1.3× → 1× via back-out ease over the first 22%
        // of life. Linear scale-in was the #1 "un-juiced" tell; the snap-and-
        // settle gives each number a physical pop.
        if (this._reducedMotion) {
          s.node.scale.set(1);
        } else {
          const POP_IN = 0.22;
          s.node.scale.set(t < POP_IN ? easeOutBack(t / POP_IN, 3.4) : 1);
        }
      },
    });
  }

  private _spawnBurst(color: string, x: number, y: number, count: number, power: number): void {
    const PIXI = this._PIXI;
    const layer = this._layer;
    if (!PIXI || !layer) return;
    const n = this._reducedMotion ? Math.min(3, count) : count;
    const container = new PIXI.Container();
    container.x = x;
    container.y = y;
    container.blendMode = 'add';
    layer.addChild(container);

    const parts: { dx: number; dy: number; r: number }[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const speed = (40 + Math.random() * 90) * power;
      const dot = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 2.5).fill({ color });
      container.addChild(dot);
      parts.push({ dx: Math.cos(ang) * speed, dy: Math.sin(ang) * speed, r: 0 });
    }
    this._sprites.push({
      node: container,
      age: 0,
      life: BURST_LIFE_MS,
      tick: (s, dt, t) => {
        const sec = dt / 1000;
        s.node.alpha = 1 - t;
        const drift = this._reducedMotion ? 0 : 1;
        container.children.forEach((child, idx) => {
          const p = parts[idx];
          p.r += 1;
          child.x += p.dx * sec * drift;
          child.y += (p.dy + p.r * 6) * sec * drift; // slight downward gravity
        });
      },
    });
  }

  private _spawnRing(color: string, x: number, y: number, scale: number): void {
    const PIXI = this._PIXI;
    const layer = this._layer;
    if (!PIXI || !layer || this._reducedMotion) return;
    const node = new PIXI.Graphics().circle(0, 0, 10).stroke({ color, width: 2, alpha: 0.9 });
    node.x = x;
    node.y = y;
    node.blendMode = 'add';
    layer.addChild(node);
    this._sprites.push({
      node,
      age: 0,
      life: RING_LIFE_MS,
      tick: (s, _dt, t) => {
        const k = 1 + t * 4 * scale;
        s.node.scale.set(k);
        s.node.alpha = 0.9 * (1 - t);
      },
    });
  }

  private _spawnFlash(color: string, alpha: number): void {
    const PIXI = this._PIXI;
    const app = this._app;
    const layer = this._layer;
    if (!PIXI || !app || !layer || alpha <= 0) return;
    const node = new PIXI.Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color, alpha });
    node.blendMode = 'add';
    layer.addChild(node);
    this._sprites.push({
      node,
      age: 0,
      life: 360,
      tick: (s, _dt, t) => {
        s.node.alpha = alpha * (1 - t);
      },
    });
  }

  private _playFlourish(text: string, color: string, flashAlpha: number, trauma: number): void {
    const PIXI = this._PIXI;
    const app = this._app;
    const layer = this._layer;
    if (!PIXI || !app || !layer) return;
    this._spawnFlash(color, flashAlpha);
    if (trauma > 0) this._addTrauma(trauma);

    const node = new PIXI.Text({
      text,
      style: {
        fontFamily: this._fontFamily,
        fontSize: 46,
        fontWeight: '900',
        fill: color,
        letterSpacing: 6,
        align: 'center',
        stroke: { color: this._palette.surface, width: 5 },
      },
    });
    node.anchor.set(0.5);
    node.x = app.screen.width / 2;
    node.y = app.screen.height * 0.42;
    layer.addChild(node);
    this._sprites.push({
      node,
      age: 0,
      life: FLOURISH_LIFE_MS,
      tick: (s, _dt, t) => {
        if (this._reducedMotion) {
          s.node.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          return;
        }
        // Slam in with a back-out overshoot, hold, fade out.
        const SLAM_IN = 0.18;
        s.node.scale.set(t < SLAM_IN ? easeOutBack(t / SLAM_IN, 2.2) : 1);
        s.node.alpha = t < 0.7 ? Math.min(1, t / 0.12) : 1 - (t - 0.7) / 0.3;
      },
    });
  }

  protected render() {
    return html`<canvas class="fx-canvas" aria-hidden="true"></canvas>
      ${
        this._degraded
          ? html`<p class="fx-degraded" role="status">
            ${msg('Combat effects unavailable – the round resolved without them.')}
          </p>`
          : nothing
      }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-combat-fx': VelgDungeonCombatFx;
  }
}
