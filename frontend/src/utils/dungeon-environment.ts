/**
 * Dungeon environment resolver — pure, DOM-free, i18n-free.
 *
 * Translates the server-authoritative per-archetype resource meter into a single
 * normalized "pressure" signal that drives the graphical scene ("meter = the
 * environment"). This mirrors the per-archetype extraction in DungeonHeader.ts
 * but collapses all 8 meters onto one axis where **pressure01 is always
 * "1 = worst"** after direction normalization.
 *
 * Two archetypes invert (a HIGHER raw meter is SAFER, so pressure = 1 - frac):
 *   - Shadow:  visibility points — at 0 the party is consumed
 *     (archetype_strategies.py:176). High visibility = safe.
 *   - Tower:   structural stability — at 0 the tower collapses
 *     (archetype_strategies.py:227). High stability = safe.
 *
 * The other six are higher-is-worse (the default), including The Devouring
 * Mother: attachment 100 = incorporation = wipe (archetype_strategies.py:408,465),
 * so attachment is NOT inverted. (An earlier plan note mislabeled Mother as an
 * inversion; ground-truthed against the backend strategies, it is the default
 * direction.)
 *
 * Pure function → unit-tested in tests/dungeon-environment.test.ts. No Lit, no
 * msg(): the consuming component maps fxProfile → a localized meter label.
 */

import {
  ARCHETYPE_AWAKENING,
  ARCHETYPE_DELUGE,
  ARCHETYPE_ENTROPY,
  ARCHETYPE_MOTHER,
  ARCHETYPE_OVERTHROW,
  ARCHETYPE_PROMETHEUS,
  ARCHETYPE_SHADOW,
  ARCHETYPE_TOWER,
  type ArchetypeState,
  isAwakeningState,
  isDelugeState,
  isEntropyState,
  isMotherState,
  isOverthrowState,
  isPrometheusState,
  isShadowState,
  isTowerState,
} from '../types/dungeon.js';

/** Visual treatment family for the scene backdrop + environment FX. */
export type FxProfile =
  | 'water' // Deluge: rising water, bubbles, blur
  | 'darkness' // Shadow: closing vignette/dark
  | 'decay' // Entropy: desaturation, grain, dissolve
  | 'tilt' // Tower: structural lean/crack, debris
  | 'pulse' // Mother: breathing pulse, UI constriction
  | 'forge' // Prometheus: forge-ember heat, sparks
  | 'shards' // Overthrow: mirror-shard fragmentation
  | 'flicker' // Awakening: deja-vu flicker, double exposure
  | 'neutral'; // unknown archetype fallback

/** Raw meter semantic, BEFORE pressure normalization. */
export type MeterDirection = 'higher-worse' | 'higher-better';

/** Coarse pressure band for discrete visual states (not a gameplay threshold). */
export type EnvironmentTier = 'calm' | 'rising' | 'critical';

export interface DungeonEnvironment {
  /** Canonical archetype name (backend key), or '' if none. */
  archetype: string;
  /** Visual treatment family. */
  fxProfile: FxProfile;
  /** Raw meter value (e.g. water_level, visibility). 0 when unavailable. */
  meterValue: number;
  /** Raw meter maximum. 0 when unavailable. */
  meterMax: number;
  /** Normalized danger in [0,1] where 1 = worst, AFTER direction inversion. */
  pressure01: number;
  /** Coarse band derived from pressure01. */
  tier: EnvironmentTier;
  /** Raw meter direction (pre-normalization). */
  direction: MeterDirection;
}

interface MeterReading {
  fxProfile: FxProfile;
  value: number;
  max: number;
  direction: MeterDirection;
}

/** Clamp n into [lo, hi]. */
function clamp(n: number, lo = 0, hi = 1): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Pressure band thresholds (visual only). */
function tierFor(pressure01: number): EnvironmentTier {
  if (pressure01 >= 0.75) return 'critical';
  if (pressure01 >= 0.4) return 'rising';
  return 'calm';
}

/** Extract the single resource meter for an archetype state, or null. */
function readMeter(archetype: string, state: ArchetypeState): MeterReading | null {
  switch (archetype) {
    case ARCHETYPE_DELUGE:
      return isDelugeState(state)
        ? {
            fxProfile: 'water',
            value: state.water_level,
            max: state.max_water_level,
            direction: 'higher-worse',
          }
        : null;
    case ARCHETYPE_SHADOW:
      return isShadowState(state)
        ? {
            fxProfile: 'darkness',
            value: state.visibility,
            max: state.max_visibility,
            direction: 'higher-better',
          }
        : null;
    case ARCHETYPE_ENTROPY:
      return isEntropyState(state)
        ? {
            fxProfile: 'decay',
            value: state.decay,
            max: state.max_decay,
            direction: 'higher-worse',
          }
        : null;
    case ARCHETYPE_TOWER:
      return isTowerState(state)
        ? {
            fxProfile: 'tilt',
            value: state.stability,
            max: state.max_stability,
            direction: 'higher-better',
          }
        : null;
    case ARCHETYPE_MOTHER:
      return isMotherState(state)
        ? {
            fxProfile: 'pulse',
            value: state.attachment,
            max: state.max_attachment,
            direction: 'higher-worse',
          }
        : null;
    case ARCHETYPE_PROMETHEUS:
      return isPrometheusState(state)
        ? {
            fxProfile: 'forge',
            value: state.insight,
            max: state.max_insight,
            direction: 'higher-worse',
          }
        : null;
    case ARCHETYPE_OVERTHROW:
      return isOverthrowState(state)
        ? {
            fxProfile: 'shards',
            value: state.fracture,
            max: state.max_fracture,
            direction: 'higher-worse',
          }
        : null;
    case ARCHETYPE_AWAKENING:
      return isAwakeningState(state)
        ? {
            fxProfile: 'flicker',
            value: state.awareness,
            max: state.max_awareness,
            direction: 'higher-worse',
          }
        : null;
    default:
      return null;
  }
}

/**
 * Resolve the normalized environment pressure for a dungeon archetype.
 *
 * Returns a calm, neutral environment when the archetype is unknown or its
 * state shape does not match (defensive: the scene must still render).
 */
export function resolveDungeonEnvironment(
  archetype: string,
  state: ArchetypeState,
): DungeonEnvironment {
  const reading = readMeter(archetype, state);
  if (!reading) {
    return {
      archetype: archetype ?? '',
      fxProfile: 'neutral',
      meterValue: 0,
      meterMax: 0,
      pressure01: 0,
      tier: 'calm',
      direction: 'higher-worse',
    };
  }

  const { fxProfile, value, max, direction } = reading;
  // Guard division by zero — an unseeded/zero max means no usable signal.
  const frac = max > 0 ? clamp(value / max) : 0;
  const pressure01 = direction === 'higher-better' ? 1 - frac : frac;

  return {
    archetype,
    fxProfile,
    meterValue: value,
    meterMax: max,
    pressure01,
    tier: tierFor(pressure01),
    direction,
  };
}
