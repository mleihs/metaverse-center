---
title: "Resonance Dungeons — Audio System Concept"
version: "1.0"
date: "2026-04-02"
type: concept
status: phase-1-implemented
lang: en
tags: [audio, web-audio-api, dungeon, sound-design, game-audio, accessibility]
research-basis: "20 parallel research agents, 300+ web sources, peer-reviewed papers from Nature/PNAS/Royal Society/Frontiers, GDC talks, 14 open-source audio projects analyzed"
---

# Resonance Dungeons — Audio System Concept

> Perspectives: Senior Web Application Architect, Senior Game Designer, UX Accessibility Specialist, Psychoacoustics Researcher
>
> Research: 20 deep-dive agents covering Web Audio API 1.1, procedural synthesis, psychoacoustics (25 academic papers), Darkest Dungeon analysis (Stuart Chatwood/Wayne June), dark ambient production (Lustmord/Cryo Chamber), jsfxr/ZzFX recipes, impulse response libraries (OpenAIR/EchoThief), adaptive music systems (Hades/Dead Cells), sound in text games (Umineko/Hacknet/Stories Untold), free/premium audio sources, cutting-edge 2026 tech (WASM AudioWorklet, WebGPU, Eclipsa Audio), and a systematic challenge of all assumptions.

---

## Executive Summary

This document proposes a **progressive-enhancement audio layer** for Resonance Dungeons — opt-in, default-off, zero gameplay dependency. The system uses a hybrid architecture: **Howler.js** (7KB) for sample playback + **raw Web Audio API** for generative ambient per archetype. Budget: ~350KB audio assets + ~400 lines TypeScript. Each of the 8 archetypes gets a distinct sonic identity driven by its core mechanic parameter.

### Why Not Silence?

The research is clear on both sides:

**For audio:** Darkest Dungeon's light-meter-reactive OST is its most praised design element. Umineko ("sound novel") proved that audio transforms text into psychological landscape. Psychoacoustics research shows sub-bass frequencies (30-60Hz) trigger physiological dread that text alone cannot. The brain processes audio 3-5× faster than visual information — a well-timed sound confirms an action before the player consciously reads the result.

**Against audio:** 91% of mobile gamers play with sound off. iOS Safari breaks Web Audio with every major release. Partial audio coverage reads as "unfinished." Screen readers compete for the audio channel. A 500KB budget produces ~60s of mono content. Synthesized ambient occupies an uncanny valley. Raw Web Audio API has 1,800 lines of cross-browser edge cases (Howler.js exists for a reason).

**Decision:** Proceed, but as a **luxury layer** — never a requirement. Default OFF. Visual feedback remains the sole information channel. Audio adds atmosphere for the ~30-40% of PC players who will hear it.

---

## Architecture

### Dependencies

| Component | Size | Role | Justification |
|-----------|------|------|---------------|
| **Howler.js** | 7KB gzip | Sample playback, sprites, autoplay unlock, iOS workarounds | 1,800 lines of cross-browser fixes we don't want to maintain. 31K GitHub stars. Zero deps. |
| **Raw Web Audio API** | 0KB | Generative ambient per archetype | Howler.js doesn't do synthesis. Oscillators + filters for drones/noise. |
| **No Tone.js** | — | — | 130KB for features we don't need (Transport, Synths, DAW abstractions). Overkill. |
| **No ZzFX/jsfxr** | — | — | Procedural SFX sounds "game jam" for literary themes like "The Devouring Mother." Tonal whiplash with the dark ambient aesthetic. |

### Service Architecture

```
DungeonAudioService (singleton, ~400 lines)
├── SampleEngine (Howler.js wrapper)
│   ├── SFX sprite (1 file, ~120KB OGG, 14 sounds)
│   └── Per-archetype ambient loop (6-8 files, ~40KB each)
├── SynthEngine (raw Web Audio API)
│   ├── DroneGenerator (oscillators + filters + LFO per archetype)
│   ├── NoiseGenerator (pre-rendered white/pink/brown buffers, looped)
│   └── ReverbEngine (procedural IR via OfflineAudioContext)
├── MixerBus
│   ├── SFX Bus (GainNode)
│   ├── Ambient Bus (GainNode)
│   ├── UI Bus (GainNode)
│   └── Master Bus (GainNode → DynamicsCompressorNode → destination)
└── StateController
    ├── AudioFSM (lobby → exploration → combat → boss → victory → defeat)
    ├── ArchetypeParamBinding (mechanic value 0-1 → audio params)
    └── VisibilityHandler (tab suspend/resume)
```

### Integration with Existing Codebase

```typescript
// DungeonTerminalView.ts — existing CustomEvent system
this.dispatchEvent(new CustomEvent('dungeon-audio', {
  detail: { event: 'room-enter', archetype: 'shadow', params: { visibility: 2 } },
  bubbles: true, composed: true
}));

// DungeonAudioService subscribes at shell level
// Pattern C from research: Service Singleton with method calls
DungeonAudioService.getInstance().play('room-enter', { archetype: 'shadow' });
```

No new components. No DOM. The service subscribes to existing dungeon state signals (`dungeonState.currentRoom`, `dungeonState.party`, etc.) via Preact Signals `effect()`.

---

## Sound Palette (14 SFX + 8 Ambient)

### SFX Sprite (~120KB OGG, mono, 22050Hz)

All sampled from CC0 sources (Kenney RPG Audio, Freesound.org). Packed into one OGG sprite file.

| # | Sound | Duration | Source | Trigger |
|---|-------|----------|--------|---------|
| 1 | Terminal keypress | 50ms | Kenney UI | Each typed character |
| 2 | Command confirm | 150ms | Kenney UI | Valid command entered |
| 3 | Command error | 200ms | Kenney UI | Invalid command |
| 4 | Room enter | 800ms | Freesound stone footstep + creak | `move` command |
| 5 | Combat start | 500ms | Kenney RPG metal ring | Encounter begins |
| 6 | Attack hit | 300ms | Kenney Impact | Combat action resolves |
| 7 | Critical hit | 400ms | Kenney Impact + layer | Critical damage |
| 8 | Healing | 600ms | Freesound crystal chime | Heal/rest action |
| 9 | Damage taken | 300ms | Kenney Impact | Party member hit |
| 10 | Loot found | 400ms | Kenney RPG coin | Loot drop |
| 11 | Victory | 1200ms | OpenGameArt 8-bit jingle | Combat victory |
| 12 | Defeat | 1000ms | Freesound descending tone | Party wipe |
| 13 | Boss reveal | 1500ms | Freesound deep rumble | Boss room entered |
| 14 | Map node reveal | 200ms | Kenney Interface ping | Room revealed on map |

**Pitch randomization:** ±8% on attack/hit/damage SFX via `playbackRate` variation to prevent repetition detection (research: listener detects loops after 3-4 repetitions; pitch variation resets this).

### Per-Archetype Ambient (~40KB each, mono, 22050Hz, looped)

Short ambient loops (8-12 seconds) sourced from Freesound CC0 or generated. Each archetype gets ONE loop that establishes its sonic identity. The generative synth layer evolves on top.

| Archetype | Loop Content | Emotional Target |
|-----------|-------------|-----------------|
| Shadow | Near-silence with distant drips, faint wind | Paranoia, void |
| Tower | Stone corridor ambience, distant mechanical hum | Precarious structure |
| Entropy | Degraded recording artifacts, static crackle | Dissolution |
| Mother | Heartbeat-like pulse, muffled organic rumble | Suffocation, womb |
| Prometheus | Distant fire crackle, warm low rumble | Dangerous illumination |
| Deluge | Water drips, flowing stream, pressure hum | Rising flood |
| Overthrow | Distant murmur (crowd-like noise), wind | Political tension |
| Awakening | Tape hiss, fluorescent hum, diffuse pad | Liminal unreality |

---

## Generative Synth Layer (Per-Archetype)

Each archetype's core mechanic parameter (0.0–1.0 normalized) drives real-time synthesis changes. This is where the audio becomes truly reactive to gameplay.

### Shadow — Visibility → Lowpass Cutoff

```
Mechanic: visibility (3 pips → 0 pips, normalized 1.0 → 0.0)
Audio mapping:
  - Brown noise → BiquadFilter(lowpass)
  - Filter cutoff: visibility * 3700 + 300 Hz
    (vis 3 = 4000Hz full spectrum, vis 0 = 300Hz "buried")
  - LFO on gain: rate increases as visibility drops (0.05Hz → 0.3Hz)
  - At visibility 0: add binaural detuning (L: 55Hz, R: 58Hz → 3Hz theta beat)
Reference: Amnesia, Darkest Dungeon torch meter
```

### Tower — Stability → Rhythmic Regularity

```
Mechanic: stability (100% → 0%, normalized 1.0 → 0.0)
Audio mapping:
  - Metronomic tick (sine 4000Hz, 1ms burst) at interval:
    stable = 2.0s fixed, damaged = 1.5-2.5s random jitter
  - FM synthesis stress tone: carrier 80Hz, modulator 3Hz
    modulation index: (1.0 - stability) * 4
  - Collapse event: white noise burst, bandpass sweep 4000→80Hz over 1.5s
Reference: Returnal metal stress, SOMA contact mic recordings
```

### Entropy — Decay Bloom → Bitcrushing

```
Mechanic: decay_bloom (0% → 100%, normalized 0.0 → 1.0)
Audio mapping:
  - Clean sine pad (A minor: 220/330/440Hz)
  - AudioWorklet bitcrusher: bitDepth = 16 - (bloom * 13)
    (bloom 0 = 16-bit clean, bloom 1.0 = 3-bit destroyed)
  - Grain density decreases: 100 grains/s → 5 grains/s
  - The sound ITSELF decays — the audio metaphor IS entropy
Reference: NieR: Automata ending E, William Basinski "Disintegration Loops"
```

### Devouring Mother — Symbiosis → Heartbeat BPM

```
Mechanic: symbiosis (0% → 100%, normalized 0.0 → 1.0)
Audio mapping:
  - Heartbeat synth (sine "lub" 80→40Hz + "dub" 60→30Hz)
    interval: 833ms (72BPM) → 500ms (120BPM) as symbiosis rises
  - Breathing LFO on brown noise: rate 0.15Hz → 0.3Hz
  - At high symbiosis: distorted lullaby motif (C5-A4-F4-C4, detuned sine, vibrato)
  - Master lowpass drops from 2000→200Hz at maximum ("being swallowed")
Reference: PNAS prenatal heartbeat study, Silent Hill distorted nursery
```

### Prometheus — Insight → Fire Intensity

```
Mechanic: insight (0 items → N items, normalized 0.0 → 1.0)
Audio mapping:
  - Fire crackle: bandpass noise bursts (1000-5000Hz, 5-20ms, random intervals)
    burst density: insight * 15 per second
  - Tonal center: 528Hz sine, harmonics appear with insight (+1056, +1584Hz)
  - "Eureka" sting on craft: glissando 400→2400Hz over 0.3s
  - High insight: FM distortion creeps in (knowledge becomes dangerous)
Reference: Darkest Dungeon torch, Journey ascending arcs
```

### Deluge — Water Level → The Matt Elliott Crescendo

The Deluge's audio design is modeled on **Matt Elliott's** (Third Eye Foundation) signature crescendo technique: tracks that begin with a single fragile acoustic guitar and build imperceptibly over minutes to a crushing orchestral wall. His album "Drinking Songs" — specifically the track "The Kursk" (named after the Russian submarine disaster) — IS the Deluge mechanic rendered as music. The water rises so gradually that you cannot identify the moment the soundscape changed.

**Critical design principle borrowed from Elliott: the transitions must be imperceptible.** The player should only notice the pressure when it's already too late.

```
Mechanic: water_level (0 → max, normalized 0.0 → 1.0)

Audio mapping (the Matt Elliott arc):
  Water Level 0 (dry):
    - Full spectrum (LPF cutoff 18kHz)
    - Short reverb (0.8s), minimal distortion
    - Ambient loop: drips, flowing water — lots of silence between sounds
    - Like Elliott's opening: solo guitar, room tone prominent

  Water Level 1-2 (ankle/knee):
    - LPF drops to 12kHz→6kHz
    - Reverb grows: 1.5s→3.0s
    - Drone layer enters: 2 detuned oscillators (±3 cents), gain creeping in
    - Subtle WaveShaperNode distortion on ambient (like Elliott's guitar breakup)
    - Tidal pulse: 0.1Hz LFO on master gain, depth 0.2

  Water Level 3-4 (waist/chest):
    - LPF at 2kHz — muffled, mid frequencies dominate
    - Reverb at 5.0s — every sound bleeds into every other sound
    - 4-7 drone oscillators layered, detuning spread widens (±5 cents)
    - Distortion: WaveShaperNode drive increases (tanh curve, input gain 3→6)
    - Compression: DynamicsCompressor ratio 10:1→15:1, threshold drops
    - Bubble synthesis: sine sweeps 800→400Hz, 50ms, random intervals
    - Tidal pulse depth 0.4 — slow, heavy breathing

  Water Level 5 (overhead — total submersion):
    - LPF at 400Hz — only pressure and rumble
    - Reverb at 8.0s+ (cavernous, infinite)
    - 10+ drone oscillators — individual notes indistinguishable, just mass
    - Compression: 20:1 ratio — all dynamics crushed (the Matt Elliott wall)
    - Pressure tone: 40Hz sine at gain 0.15 (physical chest pressure)
    - Chorus: 0.5Hz rate, ±3Hz detune (water refraction)
    - Loss of definition: the audio information degrades, mirroring disorientation

  All transitions: linearRampToValueAtTime with 15-30 second ramp durations.
  The player should NOT be able to identify the moment it changed.

Reference artists:
  - Matt Elliott "Drinking Songs" / "The Kursk" (the drowning crescendo)
  - Third Eye Foundation "Semtex" / "Sleep" (rhythmic pressure for combat)
  - Burial "Untrue" (submerged, rain-soaked production)
  - Subnautica (depth-based atmosphere system)
  - SOMA (underwater binaural recording)
  - Swans "The Seer" (boss encounter: repetitive, physically crushing)
```

### Overthrow — Authority Fracture → Rhythmic Chaos

```
Mechanic: authority_fracture (0% → 100%, normalized 0.0 → 1.0)
Audio mapping:
  - Crowd murmur: parallel bandpass noise at vocal formants (500/1500/2500Hz)
    gain = fracture * 0.3
  - Martial drum: sine 80Hz burst, interval 1.5s (stable) → random 0.5-3.0s (chaos)
  - Whisper layer: highpass noise >4000Hz with amplitude modulation
  - Tonal stability: perfect fifth (220+330Hz) → tritone (220+311Hz) as fracture rises
Reference: Disco Elysium political tension, Papers Please bureaucratic audio
```

### Awakening — Consciousness Drift → Reality Dissolving

```
Mechanic: consciousness_drift (0% → 100%, normalized 0.0 → 1.0)
Audio mapping:
  - Warm pad (F major: 174/261/348Hz) with chorus LFO ±3Hz
  - Reverb tail: 0.5s (grounded) → 4.0s (dissolved) via ConvolverNode crossfade
  - Spatial dislocation: StereoPannerNode LFO, depth = drift * 0.8
  - At high drift: binaural beats (L: 174Hz, R: 178Hz → 4Hz theta)
  - Glitch cuts: GainNode snaps to 0 for 50-100ms at random intervals
  - Delay feedback increases: 0.2 → 0.7 (cascading echoes)
Reference: The Backrooms aesthetic, Control (Remedy), Weinel ASC simulation
```

---

## Impulse Responses for Reverb

Convolution reverb via `ConvolverNode` with real-space IRs from free academic libraries. Trimmed to 1-2 seconds mono for mobile performance.

| Space Type | Source | File |
|-----------|--------|------|
| Stone dungeon | OpenAIR Falkland Palace Bottle Dungeon | CC BY 4.0 |
| Mine tunnel | OpenAIR Gill Heads Mine | CC BY 4.0 |
| Natural cave | Voxengo "Small Prehistoric Cave" | Royalty-free |
| Large chamber | OpenAIR Hamilton Mausoleum | CC BY 4.0 |
| Procedural (fallback) | `@aldel/reverbgen` via OfflineAudioContext | Apache-2.0 |

One IR per dungeon run. Selected based on archetype:
- Shadow/Entropy/Mother → Cave or Bottle Dungeon (intimate, dark)
- Tower/Overthrow → Mine Tunnel (structural, echoing)
- Prometheus → Large Chamber (cavernous, warm)
- Deluge → Procedural with heavy LP damping (submerged)
- Awakening → Procedural with long tail, evolving (dreamlike)

---

## Psychoacoustic Foundations

Key findings from 25 peer-reviewed papers that inform the design:

| Finding | Source | Application |
|---------|--------|-------------|
| Nonlinear sounds (noise, jitter, chaos) trigger innate alarm responses (p < 0.0001) | Blumstein, *Biology Letters* 2012 | Boss reveal uses white noise burst, not tonal stinger |
| Noise below 10kHz produces stronger startle than high-frequency sounds | *Learning & Behavior* | Sub-bass rumbles for danger, not shrill screams |
| 18.98Hz standing waves induce anxiety and visual disturbances | Tandy, *JSPR* 1998 | Sub-bass pressure tones for Shadow/Mother/Deluge |
| Silence forces prefrontal cortex into continuous threat-scanning | Usher, heart rate +20 BPM | Shadow archetype uses silence as primary tool |
| 1-2 minute loops detected after 3-4 repetitions | Habituation research | 8-12s loops + generative variation layer |
| Music with lyrics impairs reading comprehension (d = -0.30) | *Nature Scientific Reports* | No vocals, no melody — only ambient texture |
| Instrumental ambient at moderate volume does NOT impair reading | *Frontiers in Psychology* | Safe for text-heavy dungeon gameplay |
| Music bypasses hippocampus via direct MPFC pathway | Memory formation research | Distinct archetype themes create lasting emotional associations |
| Equal-power crossfade prevents volume dip at midpoint | Psychoacoustic standard | `cos(x * π/2)` curve for all transitions |

---

## Browser Compatibility & Edge Cases

### Autoplay Policy

```typescript
// Lazy singleton + user gesture unlock
class DungeonAudioService {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }
}

// Called on first dungeon interaction (typing a command = user gesture)
```

### iOS Safari Workarounds

- `interrupted` state: listen for `statechange`, attempt `resume()` on next user gesture
- Screen lock kills audio: re-unlock on `visibilitychange` when tab becomes visible
- Ringer mute silences Web Audio (WebKit bug 237322): document for users, cannot fix
- Howler.js handles most of these internally

### Performance Budget

| Node Type | Cost | Budget |
|-----------|------|--------|
| GainNode | Free | Unlimited |
| BiquadFilterNode | Cheap | ~20 |
| OscillatorNode | Moderate | ~15 |
| ConvolverNode | Expensive | 1-2 |
| DynamicsCompressorNode | Moderate | 1 (master only) |

Target: <5% CPU on mid-range device. `audioCtx.suspend()` when tab hidden.

---

## Accessibility

### Non-Negotiable Rules

1. **Audio is NEVER the sole information channel.** Every audio cue has a visual equivalent that already exists (terminal text output, map node colors, party panel bars).
2. **Default OFF.** Audio opt-in via Dungeon Settings panel. Persisted to `localStorage`.
3. **Per-category volume controls:** Master, SFX, Ambient. Mute toggles per category.
4. **`prefers-reduced-motion` respected:** When active, disable all generative synthesis (LFOs, evolving textures). Play only sampled SFX at reduced volume.
5. **Screen reader coexistence:** Dungeon audio pauses during screen reader announcements (detect via ARIA live region activity).
6. **No background audio.** Audio only plays during active dungeon runs, never in lobby, never on other simulation tabs.
7. **WCAG 1.4.2 compliance:** Audio never autoplays for more than 3 seconds. User must explicitly enable.

### Visual Equivalents Already in Place

| Audio Cue | Visual Equivalent |
|-----------|-------------------|
| Room enter sound | Terminal text: "You enter..." + map node highlight |
| Combat start | Terminal text + enemy panel appears |
| Damage/heal | Terminal text + party panel bar changes |
| Boss reveal | Terminal text + map node danger color |
| Victory/defeat | Terminal text + header update |
| Ambient intensity | No visual needed (atmospheric only) |

---

## Implementation Plan

### Phase 1: Foundation (1-2 days)

- [ ] `DungeonAudioService` singleton with Howler.js integration
- [ ] SFX sprite file creation (Kenney + Freesound, assembled via `audiosprite` CLI)
- [ ] Mixer bus architecture (Master → SFX/Ambient/UI buses)
- [ ] Autoplay unlock on first terminal input
- [ ] Settings panel: Enable Audio toggle, Master/SFX/Ambient volume sliders
- [ ] `localStorage` persistence for audio preferences
- [ ] `visibilitychange` suspend/resume

### Phase 2: SFX Integration (1 day)

- [ ] Wire 14 SFX triggers to existing dungeon events
- [ ] Pitch randomization on combat SFX (±8%)
- [ ] Equal-power crossfade utility
- [ ] `prefers-reduced-motion` detection

### Phase 3: Archetype Ambient (2-3 days)

- [ ] 8 ambient loop files sourced and trimmed
- [ ] Generative synth engine for mechanic-reactive parameters
- [ ] Shadow: visibility → lowpass cutoff
- [ ] Tower: stability → tick jitter + FM stress
- [ ] Entropy: bloom → bitcrusher (AudioWorklet)
- [ ] Mother: symbiosis → heartbeat BPM
- [ ] Prometheus: insight → fire crackle density
- [ ] Deluge: water_level → submersion filter
- [ ] Overthrow: fracture → crowd + drum chaos
- [ ] Awakening: drift → reverb + spatial dislocation

### Phase 4: Polish (1 day)

- [ ] ConvolverNode reverb with real-space IRs (OpenAIR)
- [ ] State machine transitions (exploration → combat → victory)
- [ ] Silence as design tool (post-combat pause, Shadow archetype)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Performance profiling (<5% CPU target)

---

## File Size Budget

| Asset | Size | Format |
|-------|------|--------|
| SFX sprite | ~120KB | OGG Vorbis, mono, 22050Hz |
| 8 ambient loops (40KB each) | ~320KB | OGG Vorbis, mono, 22050Hz |
| 4 impulse responses (trimmed) | ~80KB | WAV, mono, 44100Hz, 1-2s |
| Howler.js | 7KB | JS (gzipped) |
| DungeonAudioService | ~15KB | TS (gzipped) |
| **Total** | **~542KB** | Progressive load (SFX first, ambient on dungeon entry) |

Loading strategy: SFX sprite loads on first audio enable. Archetype ambient loads on dungeon entry (only the active archetype's loop). IRs load lazily on first room with reverb.

---

## What We're NOT Doing

| Feature | Why Not |
|---------|---------|
| Music/soundtrack | No composer, not our core competency, risks sounding generic |
| Voice acting / narrator | Wayne June costs money. TTS sounds worse than silence. |
| Text-reveal beeps (Undertale-style) | Risks annoyance in text-heavy game. Research: "nuisance score" accumulates subconsciously |
| Procedural SFX (ZzFX/jsfxr) | Sounds "game jam" for literary-gothic themes. Tonal mismatch. |
| Spatial/3D audio | 2D text game, no spatial relevance. PannerNode(HRTF) is CPU-expensive. |
| Background music in lobby/sim | Partial coverage = "unfinished." Audio only in dungeon runs. |
| AI-generated audio (ElevenLabs, Suno) | Offline-only (5-60s generation), inconsistent quality, not real-time viable |
| FMOD Studio | Free under $200k but adds WASM runtime (1-2MB), build pipeline complexity, overkill for our scope |
| Tone.js | 130KB for Transport/Synth abstractions we don't need |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| iOS Safari audio breaks | Howler.js handles known workarounds. Default OFF means non-functional audio ≠ broken game. |
| Audio fatigue (15-30 min sessions) | Generative variation prevents loop detection. Silence as design tool. Volume auto-duck during combat text. |
| Screen reader competition | Audio pauses during ARIA live announcements. Default OFF. |
| Scope creep ("audio everywhere") | Strict scope: dungeon runs only. No lobby, no sim tabs, no epoch. |
| Mobile CPU drain | `audioCtx.suspend()` on tab hide. Max 15 oscillators. Pre-rendered noise buffers. |
| 500KB budget exceeded | OGG mono 22050Hz. Lazy loading per archetype. Procedural IR instead of files. |

---

## Phase 1 Implementation Notes (2026-04-02)

Phase 1 (Foundation + SFX Integration) is complete. Key implementation details:

- **Samples:** All 14 SFX sourced from Kenney.nl CC0 packs (UI Audio, Impact Sounds, RPG Audio). Replaced the originally planned synthesized sine-wave sounds with real samples for better tonal fit with the literary-gothic aesthetic.
- **Sprite format:** OGG Opus (67KB) + MP3 fallback (80KB), 44100Hz mono. Stored in Supabase `dungeon.audio` bucket (migration 175: bucket creation + public read policy).
- **Sprite map:** Hardcoded offset/duration pairs in `DungeonAudioService.ts` (520 lines). Howler.js sprite playback with Web Audio API mixer bus (3 channels: SFX, Ambient, UI) routed through `GainNode` + `DynamicsCompressorNode` master.
- **State management:** Preact Signals for all audio state (`audioEnabled`, `masterVolume`, `sfxVolume`, `ambientVolume`, `sfxMuted`, `ambientMuted`, `uiMuted`). Persisted to `localStorage`.
- **Settings UI:** `DungeonAudioSettings.ts` (420 lines) — VU meter control panel with enable toggle, 3 fader channels (master/SFX/ambient), per-channel mute buttons. Rendered as native `<dialog>` via `showModal()`.
- **Integration:** 14 SFX triggers wired in `dungeon-commands.ts`. Header audio toggle button dispatches `toggle-audio-settings` event. `DungeonTerminalView` hosts the settings dialog.
- **Icons:** `volume()` + `volumeOff()` added to `icons.ts`.
- **Upload tooling:** `scripts/upload-audio-assets.mjs` for Supabase Storage uploads.
- **Phases 2-4 pending:** Archetype ambient loops, generative synth engine, ConvolverNode reverb, state machine transitions.

---

## References

### Academic Papers
- Blumstein et al., "Do film soundtracks contain nonlinear analogues to influence emotion?" *Biology Letters* 2010
- Tandy, "The Ghost in the Machine" *JSPR* 1998 — 18.98Hz infrasound and anxiety
- Webb et al., "Mother's voice and heartbeat sounds elicit auditory plasticity" *PNAS* 2015
- Hasson et al., "Neurocinematics" — 65% neocortex synchronization during Hitchcock
- Background music and reading: *Nature Scientific Reports* 2020, *Frontiers in Psychology* 2024

### Game Audio References
- Darkest Dungeon: Stuart Chatwood (composer), Power Up Audio (sound design), FMOD Studio
- Hades: Darren Korb — 8-stem FMOD architecture
- FTL: Ben Prunty — dual exploration/combat crossfade
- Umineko: Ryukishi07 — "sound novel" concept, BGM change as narrative punctuation
- Hacknet: Terminal aesthetic + synthwave identity
- Stories Untold: CRT/typewriter diegetic sound
- Celeste: Kevin Ragamey — FMOD dialogue system (publicly released)

### Dark Ambient Production
- Lustmord: "The Place Where the Black Stars Hang" (Shadow reference)
- Atrium Carceri: "Cellblock" (Tower reference)
- William Basinski: "Disintegration Loops" (Entropy reference)
- ProtoU: "Lost Here" (Mother reference)
- Dronny Darko: "Outer Tehom" (Deluge reference)

### Technical
- MDN Web Audio API, Boris Smus "Web Audio API" (free book)
- Paul Adenot: Web Audio Performance Notes (Mozilla)
- Chris Wilson: "A Tale of Two Clocks" — lookahead scheduling
- W3C Web Audio API 1.1 (FPWD November 2024)
- OpenAIR impulse response library (University of York)
