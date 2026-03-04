/**
 * Shared epoch utility functions.
 */

export const DEFAULT_FOUNDATION_CYCLES = 4;
export const DEFAULT_RECKONING_CYCLES = 8;

interface EpochConfig {
  duration_days: number;
  cycle_hours: number;
  foundation_cycles?: number;
  reckoning_cycles?: number;
  /** @deprecated Legacy percentage-based config */
  foundation_pct?: number;
  /** @deprecated Legacy percentage-based config */
  reckoning_pct?: number;
}

/** Compute the total number of cycles for an epoch config. */
export function computeTotalCycles(config: EpochConfig): number {
  return Math.floor((config.duration_days * 24) / config.cycle_hours);
}

/** Compute the cycle count for each phase.
 *
 * Supports both new absolute `_cycles` fields and legacy `_pct` fields
 * for backward compatibility with existing epoch configs.
 */
export function computePhaseCycles(config: EpochConfig): {
  foundation: number;
  competition: number;
  reckoning: number;
} {
  const total = computeTotalCycles(config);
  if (total === 0) return { foundation: 0, competition: 0, reckoning: 0 };

  // Prefer absolute cycles; fall back to legacy percentage-based calc
  let foundation: number;
  if (config.foundation_cycles != null) {
    foundation = config.foundation_cycles;
  } else if (config.foundation_pct != null) {
    foundation = Math.round(total * (config.foundation_pct / 100));
  } else {
    foundation = DEFAULT_FOUNDATION_CYCLES;
  }

  let reckoning: number;
  if (config.reckoning_cycles != null) {
    reckoning = config.reckoning_cycles;
  } else if (config.reckoning_pct != null) {
    reckoning = Math.round(total * (config.reckoning_pct / 100));
  } else {
    reckoning = DEFAULT_RECKONING_CYCLES;
  }

  const competition = Math.max(0, total - foundation - reckoning);
  return { foundation, competition, reckoning };
}
