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

/** RP cost per operative type. */
export const OPERATIVE_RP_COSTS: Record<OperativeType, number> = {
  spy: 3,
  saboteur: 5,
  propagandist: 4,
  assassin: 7,
  guardian: 4,
  infiltrator: 5,
};
