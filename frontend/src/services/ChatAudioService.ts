/**
 * ChatAudioService — Sound effects for the unified chat system.
 *
 * Follows the DungeonAudioService pattern (Preact Signals, Howler.js sprite,
 * localStorage persistence) but is intentionally simpler:
 *   - 4 SFX only (no ambient bus, pitch randomization, or compressor)
 *   - Single volume control (no per-bus mixing)
 *   - Independent settings key (chat_audio_settings)
 *
 * Audio files live in Supabase Storage bucket `chat.audio/sfx/`.
 * Graceful degradation: if the sprite file is missing, play() is a no-op
 * with a one-time console warning.
 *
 * WCAG 1.4.2: audio is off by default, opt-in only.
 */

import { computed, type Signal, signal } from '@preact/signals-core';

import { captureError } from './SentryService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatSfxName = 'message-sent' | 'message-received' | 'typing-start' | 'stream-complete';

type SpriteMap = Record<string, [number, number]>;

interface ChatAudioSettings {
  enabled: boolean;
  volume: number;
  muted: boolean;
}

// ---------------------------------------------------------------------------
// Sprite definition — offsets will be set once the sprite file is produced
// ---------------------------------------------------------------------------

const SFX_SPRITE: SpriteMap = {
  'message-sent': [0, 80],
  'message-received': [130, 370],
  'typing-start': [550, 200],
  'stream-complete': [800, 350],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'chat_audio_settings';

const DEFAULT_SETTINGS: ChatAudioSettings = {
  enabled: false,
  volume: 0.7,
  muted: false,
};

const SAVE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ChatAudioService {
  // ── Reactive state ──────────────────────────────────────

  readonly enabled: Signal<boolean>;
  readonly volume: Signal<number>;
  readonly muted: Signal<boolean>;
  readonly ready = signal(false);

  /** Effective volume: 0 when disabled or muted, otherwise volume value. */
  readonly effectiveVolume;

  // ── Internal ────────────────────────────────────────────

  private _sprite: import('howler').Howl | null = null;
  private _saveTimer = 0;
  private _loadWarned = false;

  constructor() {
    const saved = this._loadSettings();
    this.enabled = signal(saved.enabled);
    this.volume = signal(saved.volume);
    this.muted = signal(saved.muted);

    this.effectiveVolume = computed(() =>
      this.enabled.value && !this.muted.value ? this.volume.value : 0,
    );

    // Suspend Howler on tab hide, resume on show (prevent CPU drain)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this._sprite) return;
        if (document.hidden) {
          this._sprite.pause();
        }
      });
    }
  }

  // ── Public API ──────────────────────────────────────────

  /** Play a chat sound effect. No-op if disabled, muted, or sprite not loaded. */
  play(name: ChatSfxName): void {
    if (!this.enabled.value || this.muted.value) return;

    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    if (!this._sprite) {
      if (!this._loadWarned) {
        this._loadWarned = true;
        console.warn('[ChatAudio] Sprite not loaded — audio disabled or file missing.');
      }
      return;
    }

    this._sprite.volume(this.effectiveVolume.value);
    this._sprite.play(name);
  }

  /** Enable audio — lazily loads the Howler sprite on first enable. */
  async enable(): Promise<void> {
    this.enabled.value = true;
    this._saveDebounced();
    if (!this._sprite) {
      await this._loadSprite();
    }
  }

  /** Disable audio — stops all playback. */
  disable(): void {
    this.enabled.value = false;
    this._sprite?.stop();
    this._saveDebounced();
  }

  async toggle(): Promise<void> {
    if (this.enabled.value) {
      this.disable();
    } else {
      await this.enable();
    }
  }

  setVolume(vol: number): void {
    this.volume.value = Math.max(0, Math.min(1, vol));
    this._sprite?.volume(this.effectiveVolume.value);
    this._saveDebounced();
  }

  toggleMute(): void {
    this.muted.value = !this.muted.value;
    this._sprite?.volume(this.effectiveVolume.value);
    this._saveDebounced();
  }

  // ── Sprite loading ──────────────────────────────────────

  private async _loadSprite(): Promise<void> {
    const urls = this._buildSpritePaths();
    if (urls.length === 0) {
      console.warn('[ChatAudio] No Supabase URL configured — audio unavailable.');
      return;
    }

    try {
      const { Howl } = await import('howler');
      this._sprite = new Howl({
        src: urls,
        sprite: SFX_SPRITE,
        volume: this.effectiveVolume.value,
        preload: true,
        onload: () => {
          this.ready.value = true;
        },
        onloaderror: (_id: number, err: unknown) => {
          console.warn('[ChatAudio] Sprite load failed:', err);
          this._sprite = null;
        },
      });
    } catch (err) {
      console.warn('[ChatAudio] Howler import failed:', err);
    }
  }

  private _buildSpritePaths(): string[] {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!base) return [];
    const prefix = `${base}/storage/v1/object/public/chat.audio/sfx`;
    return [`${prefix}/chat-sfx-sprite.ogg`, `${prefix}/chat-sfx-sprite.mp3`];
  }

  // ── Settings persistence ────────────────────────────────

  private _loadSettings(): ChatAudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ChatAudioSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      captureError(err, { source: 'ChatAudioService._loadSettings' });
    }
    return { ...DEFAULT_SETTINGS };
  }

  private _saveDebounced(): void {
    clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            enabled: this.enabled.value,
            volume: this.volume.value,
            muted: this.muted.value,
          }),
        );
      } catch (err) {
        captureError(err, { source: 'ChatAudioService._saveDebounced' });
      }
    }, SAVE_DEBOUNCE_MS);
  }
}

/** Singleton — consumed by ChatWindow and future chat components. */
export const chatAudio = new ChatAudioService();
