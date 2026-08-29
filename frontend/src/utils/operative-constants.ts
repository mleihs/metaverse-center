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

/** Single-letter abbreviations for ultra-compact displays (party panel cards). */
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
