/**
 * Shared i18n-wrapped label functions for resonance signatures and archetypes.
 *
 * Single source of truth — used by ResonanceMonitor, ResonanceCard,
 * ResonanceDetailsPanel, and AdminResonancesTab. Prevents the 3-way
 * duplication of label maps across components.
 */

import { msg } from '@lit/localize';

/** All known resonance signature keys (ordered by archetype number). */
export const SIGNATURE_KEYS = [
  'economic_tremor',
  'conflict_wave',
  'biological_tide',
  'elemental_surge',
  'authority_fracture',
  'innovation_spark',
  'consciousness_drift',
  'decay_bloom',
] as const;

/** Human-readable signature label (i18n-wrapped). */
export function signatureLabel(key: string): string {
  switch (key) {
    case 'economic_tremor': return msg('Economic Tremor');
    case 'conflict_wave': return msg('Conflict Wave');
    case 'biological_tide': return msg('Biological Tide');
    case 'elemental_surge': return msg('Elemental Surge');
    case 'authority_fracture': return msg('Authority Fracture');
    case 'innovation_spark': return msg('Innovation Spark');
    case 'consciousness_drift': return msg('Consciousness Drift');
    case 'decay_bloom': return msg('Decay Bloom');
    default: return key;
  }
}

/** Human-readable archetype label for a given signature (i18n-wrapped). */
export function archetypeLabel(signature: string): string {
  switch (signature) {
    case 'economic_tremor': return msg('The Tower');
    case 'conflict_wave': return msg('The Shadow');
    case 'biological_tide': return msg('The Devouring Mother');
    case 'elemental_surge': return msg('The Deluge');
    case 'authority_fracture': return msg('The Overthrow');
    case 'innovation_spark': return msg('The Prometheus');
    case 'consciousness_drift': return msg('The Awakening');
    case 'decay_bloom': return msg('The Entropy');
    default: return signature;
  }
}

/**
 * Deterministic category → signature mapping.
 * Mirrors the Postgres trigger fn_derive_resonance_fields() and
 * Python CATEGORY_ARCHETYPE_MAP in models/resonance.py.
 */
export const CATEGORY_SIGNATURE_MAP: Record<string, string> = {
  economic_crisis: 'economic_tremor',
  military_conflict: 'conflict_wave',
  pandemic: 'biological_tide',
  natural_disaster: 'elemental_surge',
  political_upheaval: 'authority_fracture',
  tech_breakthrough: 'innovation_spark',
  cultural_shift: 'consciousness_drift',
  environmental_disaster: 'decay_bloom',
};

/** Human-readable compound archetype label (i18n-wrapped). */
export function compoundLabel(name: string): string {
  switch (name) {
    case 'The Ruin': return msg('The Ruin');
    case 'The Crucible': return msg('The Crucible');
    case 'The Drowning': return msg('The Drowning');
    case 'The Erosion': return msg('The Erosion');
    case 'The Contagion': return msg('The Contagion');
    case 'The Disruption': return msg('The Disruption');
    case 'The Deluge Absolute': return msg('The Deluge Absolute');
    case 'The Awakened Throne': return msg('The Awakened Throne');
    default: return name;
  }
}

/** Human-readable source category label (i18n-wrapped). */
export function categoryLabel(category: string): string {
  switch (category) {
    case 'economic_crisis': return msg('Economic Crisis');
    case 'military_conflict': return msg('Military Conflict');
    case 'pandemic': return msg('Pandemic');
    case 'natural_disaster': return msg('Natural Disaster');
    case 'political_upheaval': return msg('Political Upheaval');
    case 'tech_breakthrough': return msg('Tech Breakthrough');
    case 'cultural_shift': return msg('Cultural Shift');
    case 'environmental_disaster': return msg('Environmental Disaster');
    default: return category;
  }
}
