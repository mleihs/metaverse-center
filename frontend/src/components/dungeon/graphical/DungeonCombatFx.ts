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
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
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
  /** Decaying screen-shake magnitude in px. */
  private _shake = 0;

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
    if (this._ready) return;
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
      const PIXI = await import('pixi.js');
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
    this._shake = 0;
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
    const dt = Math.min(MAX_FRAME_MS, deltaMs);
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

    // Screen-shake: jitter the whole FX layer, decaying toward rest.
    if (this._shake > 0.2 && !this._reducedMotion) {
      layer.x = (Math.random() - 0.5) * this._shake;
      layer.y = (Math.random() - 0.5) * this._shake;
      this._shake *= 0.86;
    } else {
      layer.x = 0;
      layer.y = 0;
      this._shake = 0;
    }

    // Idle: no scheduled spawns, no live sprites, shake settled → stop the render
    // loop so a dormant combat layer doesn't burn the GPU between rounds.
    // _playRound restarts it. Render the now-empty stage once before stopping so
    // the cleared frame is what remains on screen.
    if (!this._schedule.length && !this._sprites.length && this._shake === 0) {
      app.render();
      app.ticker.stop();
    }
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
        run: () => this._playFlourish(msg('VICTORY'), this._palette.success, 0.26),
      });
    } else if (result.wipe) {
      this._schedule.push({
        at: flourishAt,
        run: () => this._playFlourish(msg('DEFEAT'), this._palette.danger, 0.38),
      });
    } else if (result.stalemate) {
      this._schedule.push({
        at: flourishAt,
        run: () => this._playFlourish(msg('STALEMATE'), this._palette.muted, 0),
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
    if (crit) {
      this._spawnFlash(color, 0.16);
      this._shake = Math.max(this._shake, 14);
    } else if (targetIsParty) {
      this._shake = Math.max(this._shake, 6);
    }
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
        const pop = t < 0.18 ? 0.7 + (t / 0.18) * 0.4 : 1;
        s.node.scale.set(this._reducedMotion ? 1 : pop);
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

  private _playFlourish(text: string, color: string, flashAlpha: number): void {
    const PIXI = this._PIXI;
    const app = this._app;
    const layer = this._layer;
    if (!PIXI || !app || !layer) return;
    this._spawnFlash(color, flashAlpha);
    if (flashAlpha > 0 && !this._reducedMotion) this._shake = Math.max(this._shake, 10);

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
        // Slam in (overshoot), hold, fade out.
        const inK = t < 0.16 ? 1.4 - (t / 0.16) * 0.4 : 1;
        s.node.scale.set(inK);
        s.node.alpha = t < 0.7 ? Math.min(1, t / 0.12) : 1 - (t - 0.7) / 0.3;
      },
    });
  }

  protected render() {
    return html`<canvas class="fx-canvas" aria-hidden="true"></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-combat-fx': VelgDungeonCombatFx;
  }
}
