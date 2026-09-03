/**
 * Agent accent colors and typing phrases — deterministic from agent UUID.
 *
 * Uses FNV-1a hash → index into curated palettes. Produces stable,
 * perceptually distinct values across sessions and clients.
 */

import { msg } from '@lit/localize';

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
// Evaluated at call time via msg() for i18n support.
// ---------------------------------------------------------------------------

/** Build localized phrase list at call time so locale changes are respected. */
function _typingPhrases(): string[] {
  return [
    msg('considers the implications\u2026'),
    msg('consults the archives\u2026'),
    msg('weighs the options\u2026'),
    msg('reads the situation\u2026'),
    msg('formulates a response\u2026'),
    msg('reflects on the matter\u2026'),
    msg('gathers their thoughts\u2026'),
    msg('assesses the terrain\u2026'),
    msg('searches for the right words\u2026'),
    msg('processes the intelligence\u2026'),
  ];
}

/**
 * Deterministic typing phrase for an agent, derived from UUID.
 * Each agent always gets the same phrase across sessions.
 * Localized via msg() — phrase language matches the active locale.
 */
export function agentTypingPhrase(agentId: string): string {
  const phrases = _typingPhrases();
  return phrases[fnv1aIndex(agentId, phrases.length)];
}

// ---------------------------------------------------------------------------
// Mood ring color — mood_score → oklch hue
// ---------------------------------------------------------------------------

/** Die drei Bänder, an EINER Stelle — Farbe, Grenze und Wort gehören zusammen. */
export const MOOD_BANDS = {
  /** Über diesem Wert gilt eine Stimmung als gut. */
  positive: 30,
  /** Unter diesem Wert gilt sie als belastet. */
  distressed: -30,
} as const;

export type MoodBand = 'positive' | 'neutral' | 'distressed';

/** In welchem Band liegt dieser Wert? */
export function moodBand(moodScore: number): MoodBand {
  if (moodScore > MOOD_BANDS.positive) return 'positive';
  if (moodScore < MOOD_BANDS.distressed) return 'distressed';
  return 'neutral';
}

/**
 * Die Ringfarbe zu einem `mood_score` (-100..+100) — oder LEER für neutral.
 *
 *   >  30   grün (hue 145 → 155, je besser desto smaragdener)
 *   < -30   rot  (hue  25 →  15, je schlechter desto tiefer)
 *   sonst   KEIN RING
 *
 * ── Warum neutral keinen Ring mehr bekommt ──────────────────────────────
 *
 * Bis zum 03.09.2026 gab neutral `oklch(0.75 0.14 75)` zurück — Bernstein.
 * Auf Prod gemessen: 15 von 35 Portraits im Chatverlauf trugen ihn, alle in
 * derselben Farbe, mit 2 px Rand, 6 px Schein und Dauerpuls.
 *
 * Damit trug der HÄUFIGSTE und am wenigsten aussagekräftige Zustand die
 * lauteste Behandlung. Der Nutzer las ihn als Fehler (Wortlaut nicht wiedergegeben)), und das war die richtige Lesart: ein pulsierender Ring an fast jedem
 * zweiten Bild sagt (Wortlaut nicht wiedergegeben), nicht „hier ist alles normal".
 *
 * Ein Signal markiert die ABWEICHUNG, nicht den Normalfall. Neutral bekommt
 * deshalb keinen Ring; grün und rot behalten ihren, und sind dadurch zum
 * ersten Mal auffällig, weil sie nicht mehr in einem Meer von Bernstein
 * stehen.
 */
export function moodRingColor(moodScore: number): string {
  if (moodScore > MOOD_BANDS.positive) {
    // Green range: hue 145 (olive green) → 155 (emerald) as score rises
    const t = Math.min((moodScore - MOOD_BANDS.positive) / 70, 1);
    const hue = 145 + t * 10;
    return `oklch(0.70 0.16 ${hue})`;
  }
  if (moodScore < MOOD_BANDS.distressed) {
    // Red range: hue 25 (orange-red) → 15 (deep red) as score drops
    const t = Math.min((MOOD_BANDS.distressed - moodScore) / 70, 1);
    const hue = 25 - t * 10;
    return `oklch(0.65 0.18 ${hue})`;
  }
  return '';
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
  return (hash >>> 0) % modulo;
}
