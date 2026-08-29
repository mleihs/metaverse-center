/**
 * Ability pictograms — wycinanki silhouettes used as CSS mask images.
 *
 * The assets are single-colour alpha masks (128 px PNG, ~3 KB each) under
 * `public/ui-pictograms/`. They carry SHAPE only; the colour comes from the
 * design tokens at the call site via `background-color`. That is the whole
 * point of the format: one file per ability serves all ten theme presets and
 * all five effect colours without a single duplicate asset.
 *
 * The file name is the ability `id` from the content pack
 * (`content/dungeon/abilities/*.yaml`) — that name is the contract. A missing
 * entry is not an error: `abilityPictogramUrl` returns null and the caller
 * falls back to the plain text button, so a newly authored ability never
 * renders as an empty tile.
 *
 * The masks are DERIVED, never hand-edited: the AVIF masters live in
 * `assets/ui-pictograms/` and `scripts/build_pictogram_masks.py` regenerates
 * every PNG from them (`--check` reports stale ones). Editing a PNG directly is
 * lost work — the next run overwrites it.
 *
 * Authoring and acceptance criteria: `docs/plans/ui-pictogram-prompts.md`.
 */

/**
 * Abilities that have a pictogram on disk. Kept as an explicit list rather than
 * a glob so a missing file fails loudly in review instead of silently at runtime.
 */
const ABILITY_PICTOGRAMS: ReadonlySet<string> = new Set([
  'assassin_ambush_strike',
  'assassin_exploit',
  'assassin_precision_strike',
  'basic_attack',
  'guardian_fortify',
  'guardian_reinforce',
  'guardian_shield',
  'guardian_taunt',
  'infiltrator_backstab',
  'infiltrator_evade',
  'propagandist_demoralize',
  'propagandist_inspire',
  'propagandist_rally',
  'saboteur_detonate',
  'saboteur_disrupt',
  'saboteur_trap',
  'spy_analyze_weakness',
  'spy_counter_intel',
  'spy_observe',
]);

/** URL of the mask asset for an ability, or null when none exists. */
export function abilityPictogramUrl(abilityId: string): string | null {
  return ABILITY_PICTOGRAMS.has(abilityId) ? `/ui-pictograms/${abilityId}.png` : null;
}

/** Intent cluster an ability belongs to, derived from its target type. */
export type AbilityIntent = 'strike' | 'aid' | 'guard';

/**
 * Map a target type onto its intent cluster. Single source of truth for both
 * the Strike / Aid / Guard grouping and the per-group colour, so a button can
 * never sit in one cluster and be tinted as another.
 */
export function abilityIntent(targets: string): AbilityIntent {
  if (targets === 'single_enemy' || targets === 'all_enemies') return 'strike';
  if (targets === 'single_ally' || targets === 'all_allies') return 'aid';
  return 'guard';
}
