/**
 * Dungeon Audio Service — progressive-enhancement audio layer for Resonance Dungeons.
 *
 * Architecture:
 *   Howler.js (7KB) for SFX sprite playback.
 *   Raw Web Audio API for mixer bus + future generative ambient (Phase 3).
 *
 * Design principles:
 *   - Opt-in, default OFF. Audio never affects gameplay.
 *   - WCAG 1.4.2: no autoplay beyond 3 seconds without explicit user action.
 *   - prefers-reduced-motion: disables generative synthesis, reduces SFX volume.
 *   - visibilitychange: suspend AudioContext when tab hidden, resume on return.
 *   - All settings persisted to localStorage.
 *
 * SFX sprite: 14 sounds in one OGG file. Pitch randomization (±8%) on combat
 * sounds prevents repetition detection (habituation after 3-4 identical plays).
 *
 * Pattern: DungeonStateManager.ts (singleton export, Preact Signals, no DOM).
 *
 * @see docs/concepts/dungeon-audio-system.md
 */

import { computed, signal } from '@preact/signals-core';
import { Howl } from 'howler';

// ── Types ───────────────────────────────────────────────────────────────────

/** SFX identifiers matching the sprite map. */
export type SfxName =
  | 'keypress'
  | 'command-confirm'
  | 'command-error'
  | 'room-enter'
  | 'combat-start'
  | 'attack-hit'
  | 'critical-hit'
  | 'healing'
  | 'damage-taken'
  | 'loot-found'
  | 'victory'
  | 'defeat'
  | 'boss-reveal'
  | 'map-node-reveal';

/** Persisted audio settings. */
interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  sfxMuted: boolean;
  ambientMuted: boolean;
}

/** Sprite map: [start_ms, duration_ms] per sound. */
type SpriteMap = Record<string, [number, number]>;

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dungeon_audio_settings';

const DEFAULT_SETTINGS: AudioSettings = {
  enabled: false, // Default OFF per concept doc
  masterVolume: 0.7,
  sfxVolume: 0.8,
  ambientVolume: 0.5,
  sfxMuted: false,
  ambientMuted: false,
};

/**
 * SFX sprite map — start offset and duration (ms) for each sound.
 * Built from Kenney.nl CC0 sample packs (UI Audio, Impact Sounds, RPG Audio).
 * 14 sounds, mono 44100Hz, 50ms silence gaps between sprites.
 * Total sprite: ~10.1s. OGG: 67KB, MP3: 80KB.
 *
 * Format: [start_ms, duration_ms]
 */
const SFX_SPRITE: SpriteMap = {
  'keypress': [0, 83],
  'command-confirm': [133, 213],
  'command-error': [396, 512],
  'room-enter': [958, 919],
  'combat-start': [1927, 400],
  'attack-hit': [2377, 536],
  'critical-hit': [2963, 356],
  'healing': [3369, 1741],
  'damage-taken': [5160, 569],
  'loot-found': [5779, 846],
  'victory': [6675, 1480],
  'defeat': [8205, 559],
  'boss-reveal': [8814, 992],
  'map-node-reveal': [9856, 224],
};

/** SFX names that get pitch randomization (±8%) to prevent repetition detection. */
const PITCH_RANDOMIZED: ReadonlySet<string> = new Set([
  'attack-hit',
  'critical-hit',
  'damage-taken',
  'keypress',
]);

/** Pitch variation range: ±8% → [0.92, 1.08]. */
const PITCH_MIN = 0.92;
const PITCH_MAX = 1.08;

/**
 * Build SFX sprite URLs from Supabase Storage.
 * Bucket: `dungeon.audio`, path: `sfx/sfx-sprite.*`
 * Howler.js tries formats in order: OGG Opus (62KB) first, MP3 (66KB) fallback.
 */
function buildSfxSpritePaths(): string[] {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return []; // No Supabase URL — sprite load will silently fail
  const prefix = `${base}/storage/v1/object/public/dungeon.audio/sfx`;
  return [
    `${prefix}/sfx-sprite.ogg`,
    `${prefix}/sfx-sprite.mp3`,
  ];
}

// ── Service ─────────────────────────────────────────────────────────────────

class DungeonAudioService {
  // ── Reactive state (Preact Signals) ─────────────────────────────────────

  /** Whether audio is enabled by the user. Default OFF. */
  readonly enabled = signal(DEFAULT_SETTINGS.enabled);

  /** Master volume (0.0–1.0). */
  readonly masterVolume = signal(DEFAULT_SETTINGS.masterVolume);

  /** SFX bus volume (0.0–1.0). */
  readonly sfxVolume = signal(DEFAULT_SETTINGS.sfxVolume);

  /** Ambient bus volume (0.0–1.0). */
  readonly ambientVolume = signal(DEFAULT_SETTINGS.ambientVolume);

  /** SFX bus muted. */
  readonly sfxMuted = signal(DEFAULT_SETTINGS.sfxMuted);

  /** Ambient bus muted. */
  readonly ambientMuted = signal(DEFAULT_SETTINGS.ambientMuted);

  /** Whether the SFX sprite has been loaded and is ready to play. */
  readonly ready = signal(false);

  /** Effective SFX volume: sfxVolume * masterVolume, 0 if muted or disabled. */
  readonly effectiveSfxVolume = computed(() => {
    if (!this.enabled.value || this.sfxMuted.value) return 0;
    return this.sfxVolume.value * this.masterVolume.value;
  });

  /** Effective ambient volume: ambientVolume * masterVolume, 0 if muted or disabled. */
  readonly effectiveAmbientVolume = computed(() => {
    if (!this.enabled.value || this.ambientMuted.value) return 0;
    return this.ambientVolume.value * this.masterVolume.value;
  });

  // ── Private state ──────────────────────────────────────────────────────

  /** Howler.js instance for SFX sprite. Lazy-initialized on first enable. */
  private _sfxSprite: Howl | null = null;

  /** Web Audio API context for mixer bus + future synth engine. */
  private _ctx: AudioContext | null = null;

  /** Mixer bus gain nodes. */
  private _masterGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;
  private _ambientGain: GainNode | null = null;

  /** Master compressor (limiter). */
  private _compressor: DynamicsCompressorNode | null = null;

  /** Whether prefers-reduced-motion is active. */
  private _reducedMotion = false;

  /** MediaQueryList listener cleanup. */
  private _motionQuery: MediaQueryList | null = null;

  /** Visibility change handler reference for cleanup. */
  private _visibilityHandler: (() => void) | null = null;

  /** Debounce timer for settings persistence. */
  private _persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._loadSettings();
    this._initReducedMotion();
    this._initVisibilityHandler();

    // If user had audio enabled in a previous session, preload the SFX sprite
    // so it's ready when AudioContext is unlocked by the first user gesture.
    // AudioContext itself is NOT created here (requires user gesture per autoplay policy).
    if (this.enabled.value) {
      this._loadSfxSprite();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Play an SFX by name. No-op if audio is disabled or sprite not loaded.
   * Pitch randomization applied to combat SFX (±8%).
   */
  play(name: SfxName): void {
    if (!this.enabled.value || this.sfxMuted.value) return;
    if (!this._sfxSprite) return;

    // Reduced motion: only play UI sounds (keypress, confirm, error), skip dramatic SFX
    if (this._reducedMotion && name !== 'keypress' && name !== 'command-confirm' && name !== 'command-error') {
      return;
    }

    const id = this._sfxSprite.play(name);

    // Apply pitch randomization for combat SFX
    if (PITCH_RANDOMIZED.has(name)) {
      const rate = PITCH_MIN + Math.random() * (PITCH_MAX - PITCH_MIN);
      this._sfxSprite.rate(rate, id);
    }

    // Apply effective volume
    this._sfxSprite.volume(this.effectiveSfxVolume.value, id);
  }

  /**
   * Enable audio. Initializes AudioContext (requires user gesture),
   * loads SFX sprite, builds mixer bus.
   */
  async enable(): Promise<void> {
    this.enabled.value = true;
    this._queuePersist();

    await this._ensureContext();
    this._loadSfxSprite();
  }

  /** Disable audio. Stops all sounds, suspends AudioContext. */
  disable(): void {
    this.enabled.value = false;
    this._queuePersist();

    if (this._sfxSprite) {
      this._sfxSprite.stop();
    }

    if (this._ctx && this._ctx.state === 'running') {
      this._ctx.suspend().catch(() => {});
    }
  }

  /** Toggle audio on/off. */
  async toggle(): Promise<void> {
    if (this.enabled.value) {
      this.disable();
    } else {
      await this.enable();
    }
  }

  /** Set master volume (0.0–1.0). Updates mixer bus gain. */
  setMasterVolume(vol: number): void {
    this.masterVolume.value = clamp01(vol);
    this._updateGains();
    this._queuePersist();
  }

  /** Set SFX volume (0.0–1.0). */
  setSfxVolume(vol: number): void {
    this.sfxVolume.value = clamp01(vol);
    this._updateGains();
    this._queuePersist();
  }

  /** Set ambient volume (0.0–1.0). */
  setAmbientVolume(vol: number): void {
    this.ambientVolume.value = clamp01(vol);
    this._updateGains();
    this._queuePersist();
  }

  /** Toggle SFX mute. */
  toggleSfxMute(): void {
    this.sfxMuted.value = !this.sfxMuted.value;
    this._updateGains();
    this._queuePersist();
  }

  /** Toggle ambient mute. */
  toggleAmbientMute(): void {
    this.ambientMuted.value = !this.ambientMuted.value;
    this._updateGains();
    this._queuePersist();
  }

  /** Unlock AudioContext — call on first user gesture in dungeon mode. */
  async unlock(): Promise<void> {
    if (!this.enabled.value) return;
    await this._ensureContext();
  }

  /**
   * Dispose the audio service. Release all resources.
   * Called when leaving dungeon context entirely.
   */
  dispose(): void {
    if (this._sfxSprite) {
      this._sfxSprite.unload();
      this._sfxSprite = null;
    }

    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
      this._masterGain = null;
      this._sfxGain = null;
      this._ambientGain = null;
      this._compressor = null;
    }

    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    if (this._motionQuery) {
      this._motionQuery = null;
    }

    this.ready.value = false;
  }

  // ── AudioContext + Mixer Bus ────────────────────────────────────────────

  /**
   * Ensure AudioContext exists and is running. Creates mixer bus on first call.
   *
   * Mixer bus architecture:
   *   SFX Bus (GainNode) ─────┐
   *   Ambient Bus (GainNode) ─┤→ Master Bus (GainNode) → Compressor → destination
   */
  private async _ensureContext(): Promise<AudioContext> {
    if (!this._ctx) {
      this._ctx = new AudioContext();
      this._buildMixerBus();
    }

    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    return this._ctx;
  }

  /** Build the mixer bus gain node graph. */
  private _buildMixerBus(): void {
    if (!this._ctx) return;

    // Master compressor (limiter — prevents clipping)
    this._compressor = this._ctx.createDynamicsCompressor();
    this._compressor.threshold.value = -6;
    this._compressor.knee.value = 10;
    this._compressor.ratio.value = 4;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.25;
    this._compressor.connect(this._ctx.destination);

    // Master gain
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this.masterVolume.value;
    this._masterGain.connect(this._compressor);

    // SFX bus
    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this.sfxMuted.value ? 0 : this.sfxVolume.value;
    this._sfxGain.connect(this._masterGain);

    // Ambient bus
    this._ambientGain = this._ctx.createGain();
    this._ambientGain.gain.value = this.ambientMuted.value ? 0 : this.ambientVolume.value;
    this._ambientGain.connect(this._masterGain);
  }

  /** Update mixer bus gain values from current signal state. */
  private _updateGains(): void {
    // Update Howler sprite global volume (SFX * Master)
    if (this._sfxSprite) {
      this._sfxSprite.volume(this.effectiveSfxVolume.value);
    }

    // Update Web Audio mixer bus (for Phase 3 ambient sources)
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const ramp = 0.05; // 50ms ramp to avoid clicks

    if (this._masterGain) {
      this._masterGain.gain.linearRampToValueAtTime(this.masterVolume.value, t + ramp);
    }
    if (this._sfxGain) {
      const sfx = this.sfxMuted.value ? 0 : this.sfxVolume.value;
      this._sfxGain.gain.linearRampToValueAtTime(sfx, t + ramp);
    }
    if (this._ambientGain) {
      const amb = this.ambientMuted.value ? 0 : this.ambientVolume.value;
      this._ambientGain.gain.linearRampToValueAtTime(amb, t + ramp);
    }
  }

  // ── SFX Sprite ─────────────────────────────────────────────────────────

  /** Load the SFX sprite via Howler.js. Lazy — only called when audio is enabled. */
  private _loadSfxSprite(): void {
    if (this._sfxSprite) return;

    this._sfxSprite = new Howl({
      src: buildSfxSpritePaths(),
      sprite: SFX_SPRITE,
      volume: this.effectiveSfxVolume.value,
      preload: true,
      onload: () => {
        this.ready.value = true;
      },
      onloaderror: (_id: number, err: unknown) => {
        console.warn('[DungeonAudio] SFX sprite load failed:', err);
        this.ready.value = false;
      },
    });
  }

  // ── Accessibility ──────────────────────────────────────────────────────

  /** Detect prefers-reduced-motion and subscribe to changes. */
  private _initReducedMotion(): void {
    if (typeof window === 'undefined') return;

    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotion = this._motionQuery.matches;

    const handler = (e: MediaQueryListEvent) => {
      this._reducedMotion = e.matches;
    };
    this._motionQuery.addEventListener('change', handler);
  }

  // ── Visibility ─────────────────────────────────────────────────────────

  /**
   * Suspend AudioContext when tab is hidden, resume when visible.
   * Prevents CPU drain and iOS Safari audio session conflicts.
   */
  private _initVisibilityHandler(): void {
    if (typeof document === 'undefined') return;

    this._visibilityHandler = () => {
      if (!this._ctx || !this.enabled.value) return;

      if (document.hidden) {
        // Suspend audio when tab hidden
        if (this._ctx.state === 'running') {
          this._ctx.suspend().catch(() => {});
        }
        if (this._sfxSprite) {
          this._sfxSprite.mute(true);
        }
      } else {
        // Resume audio when tab visible (if enabled)
        if (this._ctx.state === 'suspended') {
          this._ctx.resume().catch(() => {});
        }
        if (this._sfxSprite) {
          this._sfxSprite.mute(false);
        }
      }
    };

    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  // ── Settings Persistence ───────────────────────────────────────────────

  /** Load settings from localStorage. */
  private _loadSettings(): void {
    try {
      const json = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!json) return;

      const saved = JSON.parse(json) as Partial<AudioSettings>;
      if (saved.enabled !== undefined) this.enabled.value = saved.enabled;
      if (saved.masterVolume !== undefined) this.masterVolume.value = clamp01(saved.masterVolume);
      if (saved.sfxVolume !== undefined) this.sfxVolume.value = clamp01(saved.sfxVolume);
      if (saved.ambientVolume !== undefined) this.ambientVolume.value = clamp01(saved.ambientVolume);
      if (saved.sfxMuted !== undefined) this.sfxMuted.value = saved.sfxMuted;
      if (saved.ambientMuted !== undefined) this.ambientMuted.value = saved.ambientMuted;
    } catch {
      // Non-critical — use defaults
    }
  }

  /** Persist current settings to localStorage (debounced). */
  private _queuePersist(): void {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this._persist(), 300);
  }

  private _persist(): void {
    try {
      const settings: AudioSettings = {
        enabled: this.enabled.value,
        masterVolume: this.masterVolume.value,
        sfxVolume: this.sfxVolume.value,
        ambientVolume: this.ambientVolume.value,
        sfxMuted: this.sfxMuted.value,
        ambientMuted: this.ambientMuted.value,
      };
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Quota exceeded or private browsing — non-critical
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ── Singleton Export ─────────────────────────────────────────────────────────

export const dungeonAudio = new DungeonAudioService();
