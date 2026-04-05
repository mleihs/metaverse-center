/**
 * Agent accent colors and typing phrases — deterministic from agent UUID.
 *
 * Uses FNV-1a hash → index into curated palettes. Produces stable,
 * perceptually distinct values across sessions and clients.
 */

// ---------------------------------------------------------------------------
// Color palette — 8 oklch hues at L=0.72, C=0.14
// Spread across the wheel: teal, blue, violet, magenta, rose, orange, amber, green
// ---------------------------------------------------------------------------

const AGENT_HUES = [180, 235, 275, 320, 350, 25, 55, 140];

/**
 * Deterministic accent color for an agent, derived from UUID.
 * Returns an oklch() CSS value with consistent lightness and chroma
 * so all agent borders/labels meet WCAG AA contrast on dark surfaces.
 */
export function agentAccentColor(agentId: string): string {
  const hue = AGENT_HUES[fnv1aIndex(agentId, AGENT_HUES.length)];
  return `oklch(0.72 0.14 ${hue})`;
}

// ---------------------------------------------------------------------------
// Typing phrases — personality-flavored alternatives to "is typing..."
// ---------------------------------------------------------------------------

const TYPING_PHRASES = [
  'considers the implications\u2026',
  'consults the archives\u2026',
  'weighs the options\u2026',
  'reads the situation\u2026',
  'formulates a response\u2026',
  'reflects on the matter\u2026',
  'gathers their thoughts\u2026',
  'assesses the terrain\u2026',
  'searches for the right words\u2026',
  'processes the intelligence\u2026',
];

/**
 * Deterministic typing phrase for an agent, derived from UUID.
 * Each agent always gets the same phrase across sessions.
 */
export function agentTypingPhrase(agentId: string): string {
  return TYPING_PHRASES[fnv1aIndex(agentId, TYPING_PHRASES.length)];
}

// ---------------------------------------------------------------------------
// Mood ring color — mood_score → oklch hue
// ---------------------------------------------------------------------------

/**
 * Map a mood_score (-100..+100) to an oklch color for the avatar mood ring.
 *
 *   > 30  → green (positive)
 *    -30..30 → amber (neutral)
 *   < -30 → red (distressed)
 *
 * Interpolates within each band for smooth gradients.
 */
export function moodRingColor(moodScore: number): string {
  if (moodScore > 30) {
    // Green range: hue 145 (olive green) → 155 (emerald) as score rises
    const t = Math.min((moodScore - 30) / 70, 1);
    const hue = 145 + t * 10;
    return `oklch(0.70 0.16 ${hue})`;
  }
  if (moodScore < -30) {
    // Red range: hue 25 (orange-red) → 15 (deep red) as score drops
    const t = Math.min((-30 - moodScore) / 70, 1);
    const hue = 25 - t * 10;
    return `oklch(0.65 0.18 ${hue})`;
  }
  // Amber range: hue 75 (warm amber)
  return 'oklch(0.75 0.14 75)';
}

// ---------------------------------------------------------------------------
// Hash utility — FNV-1a (32-bit, non-cryptographic)
// ---------------------------------------------------------------------------

function fnv1aIndex(input: string, modulo: number): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % modulo);
}
