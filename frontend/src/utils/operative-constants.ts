/**
 * Shared operative type constants — colors and RP costs.
 *
 * Canonical source: backend/services/constants.py
 * These are duplicated client-side for immediate rendering.
 * The API endpoint GET /api/v1/public/operative-types returns the
 * same data dynamically if needed.
 */
import type { OperativeType } from '../types/index.js';

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

/** Full names for tooltips and accessibility. */
export const OPERATIVE_FULL: Record<OperativeType, string> = {
  spy: 'Spy',
  guardian: 'Guardian',
  saboteur: 'Saboteur',
  propagandist: 'Propagandist',
  infiltrator: 'Infiltrator',
  assassin: 'Assassin',
};

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
