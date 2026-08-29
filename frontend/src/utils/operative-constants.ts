/**
 * Shared operative type constants — colors and RP costs.
 *
 * Canonical source: backend/services/constants.py
 * These are duplicated client-side for immediate rendering.
 * The API endpoint GET /api/v1/public/operative-types returns the
 * same data dynamically if needed.
 */
import { msg } from '@lit/localize';

import type { OperativeType } from '../types/index.js';

/** Canonical operative-type order. Mirrors OPERATIVE_TYPES in backend/models/aptitude.py. */
export const OPERATIVE_TYPES = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
] as const satisfies readonly OperativeType[];

/** Display colors per operative type (hex). */
export const OPERATIVE_COLORS: Record<OperativeType, string> = {
  spy: '#64748b',
  guardian: '#10b981',
  saboteur: '#ef4444',
  propagandist: '#f59e0b',
  infiltrator: '#a78bfa',
  assassin: '#dc2626',
};

/**
 * Single-letter abbreviations for ultra-compact displays.
 *
 * CAUTION — this table is not decipherable on its own, and that is inherent,
 * not a wording bug: six names share four initials, so `S` went to Spy and
 * Saboteur was pushed onto `B`, Assassin onto `A` against Guardian's `G`. A row
 * of six reads `A9 G9 P6 B5 S4 I3`, which no player can decode without a
 * legend. Prefer `aptitudeCode()` (three letters) wherever a few extra pixels
 * exist; reach for this table only when the budget is genuinely one glyph, and
 * then pair it with a visible legend or a per-item label.
 */
export const OPERATIVE_SHORT: Record<OperativeType, string> = {
  spy: 'S',
  guardian: 'G',
  saboteur: 'B',
  propagandist: 'P',
  infiltrator: 'I',
  assassin: 'A',
};

/** Three-letter abbreviations for terminal/monospace displays. */
export const OPERATIVE_LABEL: Record<OperativeType, string> = {
  spy: 'SPY',
  guardian: 'GRD',
  saboteur: 'SAB',
  propagandist: 'PRP',
  infiltrator: 'INF',
  assassin: 'ASN',
};

/**
 * Full, localized operative name — for tooltips, labels and accessibility.
 *
 * A FUNCTION, not a constant map: `msg()` at module scope resolves before the
 * locale is loaded and freezes the English string (the repo's standing i18n
 * gotcha). That is exactly what the previous `OPERATIVE_FULL` constant did — it
 * held English literals, and the German party panel showed "Saboteur",
 * "Propagandist", "Guardian" in its tooltips while a second, correctly
 * localized copy of the same six names lived in VelgAptitudeBars. One name per
 * operative type, resolved at render time; the two abbreviation tables above
 * stay, because they serve two different width budgets, not two vocabularies.
 */
export function operativeName(type: OperativeType): string {
  const names: Record<OperativeType, () => string> = {
    spy: () => msg('Spy'),
    guardian: () => msg('Guardian'),
    saboteur: () => msg('Saboteur'),
    propagandist: () => msg('Propagandist'),
    infiltrator: () => msg('Infiltrator'),
    assassin: () => msg('Assassin'),
  };
  return names[type]();
}

// ── Server-sent aptitude keys ───────────────────────────────────────────────
//
// Aptitude maps arrive from the API keyed by school name (`{"spy": 8, ...}`),
// and the wire format does not promise those six keys: a content pack can name
// a school the client has never heard of, and an older client meets a newer
// server on every deploy. Call sites answered this with a scattering of
// `?? key.toUpperCase()` fallbacks — four of them, each slightly different —
// while the one call that mattered most had none: `operativeName()` indexes a
// record of THUNKS, so an unknown key evaluates `undefined()` and throws inside
// a render, taking the whole panel down rather than one chip.
//
// The three helpers below are the single answer. They are deliberately typed
// `string` in, `string` out: the widening is the point, and a caller that
// already holds a proven `OperativeType` should keep using the tables directly.

/** Narrow a server-sent aptitude key to a known operative type. */
export function isOperativeType(key: string): key is OperativeType {
  return (OPERATIVE_TYPES as readonly string[]).includes(key);
}

/** Three-letter code for a server-sent aptitude key (`spy` → `SPY`). */
export function aptitudeCode(key: string): string {
  return OPERATIVE_LABEL[key as OperativeType] ?? key.slice(0, 3).toUpperCase();
}

/** Full localized name for a server-sent aptitude key, unknown keys included. */
export function aptitudeDisplayName(key: string): string {
  return isOperativeType(key) ? operativeName(key) : key.toUpperCase();
}

/** RP cost per operative type. */
export const OPERATIVE_RP_COSTS: Record<OperativeType, number> = {
  spy: 3,
  saboteur: 5,
  propagandist: 4,
  assassin: 7,
  guardian: 4,
  infiltrator: 5,
};

/** Security level → numeric value for success probability calculation.
 *  Mirrors backend/services/constants.py SECURITY_LEVEL_MAP. */
export const SECURITY_LEVEL_MAP: Record<string, number> = {
  fortress: 10.0,
  maximum: 10.0,
  high: 8.5,
  guarded: 7.0,
  moderate: 5.5,
  medium: 5.5,
  low: 4.0,
  contested: 3.0,
  lawless: 2.0,
};
