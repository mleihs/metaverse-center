import { msg } from '@lit/localize';

/**
 * Building condition — the single mapping from the backend's condition
 * vocabulary to the three-dot gem and the badge variant on `<velg-game-card>`.
 *
 * ⚠ THERE IS NO CORE LADDER. `fn_building_condition_ladder` takes a
 * simulation_id: the ladder is PER WORLD, and the top rung differs. Measured
 * on prod across 290 buildings in 36 living worlds:
 *
 *     excellent → good → fair → poor → ruined   26 worlds, 216 buildings
 *     pristine  → good → fair → poor → ruined    4 worlds,  29
 *     fair → poor → ruined                       4 worlds,  27
 *     good → fair → poor → ruined                1 world,   11
 *     pristine → fair → poor → ruined            1 world,    7
 *
 * This table therefore lists the union of the top rungs, not one canon. An
 * earlier version of this comment claimed the generator emits five values
 * "pristine, good, fair, poor, ruined" — against the data that was wrong in
 * the majority case: `excellent` is the top rung in 26 worlds and `pristine`
 * in 5. The list missed the word that 216 of 290 buildings can carry, so ten
 * buildings standing at the HIGHEST rank of their world rendered with no gem
 * at all.
 *
 * Two independent copies of this mapping used to live in `BuildingCard.ts`,
 * and both dropped `pristine` into the `ruined` branch. One table here removes
 * the second copy and the class of drift that produced that bug — it does not
 * remove the need to check the table against the data now and then.
 *
 * The gem has three dots and the ladders have up to five rungs, so the top two
 * necessarily share a value. The exact word is on the badge beside it; the gem
 * is a glance, not a reading.
 */

/** The condition vocabulary the generator is allowed to produce. Internal:
 * both public functions take the backend's raw string and normalise it here, so
 * no caller ever holds this type. */
type BuildingCondition = 'pristine' | 'excellent' | 'good' | 'fair' | 'poor' | 'ruined';

/** Badge colour role, matching `CardBadge.variant` on `<velg-game-card>`. */
export type ConditionVariant = 'success' | 'warning' | 'danger' | 'default';

const CONDITION_DOTS: Readonly<Record<BuildingCondition, number>> = {
  pristine: 3,
  excellent: 3,
  good: 3,
  fair: 2,
  poor: 1,
  ruined: 0,
};

const CONDITION_VARIANT: Readonly<Record<BuildingCondition, ConditionVariant>> = {
  pristine: 'success',
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  poor: 'danger',
  ruined: 'danger',
};

/** Normalise free-text condition into the known vocabulary, or `null`. */
function normalizeCondition(value: string | null | undefined): BuildingCondition | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  return key in CONDITION_DOTS ? (key as BuildingCondition) : null;
}

/**
 * Filled dots (0-3) for the right-hand condition gem.
 *
 * Returns `null` for an absent or unrecognised condition so the caller can omit
 * the gem entirely rather than paint a confident "0 of 3" onto a card whose
 * condition simply was not measured.
 */
export function conditionDots(value: string | null | undefined): number | null {
  const key = normalizeCondition(value);
  return key === null ? null : CONDITION_DOTS[key];
}

/** Badge colour role for the condition chip. */
export function conditionVariant(value: string | null | undefined): ConditionVariant {
  const key = normalizeCondition(value);
  return key === null ? 'default' : CONDITION_VARIANT[key];
}

// ---------------------------------------------------------------------------
// Occupancy — a SECOND signal the handoff also calls "Zustand"
// ---------------------------------------------------------------------------

/**
 * How full a building is, as the three-step mark the handoff draws as ●◐○.
 *
 * This is NOT `building_condition`. The handoff uses the word "Zustand" for
 * both, and they are different measurements that happen to share a row on the
 * card: condition is how INTACT the building is (a vocabulary the generator
 * emits), occupancy is how MANY of its places are taken (a ratio the world
 * produces by living in it). A pristine hall can stand empty and a ruin can be
 * crowded.
 *
 * `ruined` overrides the ratio, because a ruin's occupancy is not a reading
 * anyone should act on — the handoff greys and desaturates that card.
 *
 * Thresholds are the handoff's, and they live HERE rather than in a component
 * so the buildings grid and the overview's footprint strip cannot drift apart:
 * two copies of a threshold is how `pristine` once fell through to `ruined` in
 * the table above.
 */
export type OccupancyLevel = 'full' | 'partial' | 'sparse' | 'ruined';

/** Handoff: ≥ 66 % · ≥ 33 % · below that. */
const OCCUPANCY_FULL = 0.66;
const OCCUPANCY_PARTIAL = 0.33;

/**
 * @param current  places taken, or `null`/`undefined` when the caller does not
 *                 KNOW - which is not the same as zero. Measured against prod:
 *                 the buildings LIST endpoint returns no `agents` field at all,
 *                 so a call site that writes `b.agents?.length ?? 0` hands this
 *                 function a confident 0 and every building with a capacity
 *                 comes out "nearly empty". Pass `?? null`, not `?? 0`.
 * @param max      places the building has
 * @param condition the raw `building_condition`, which can override the ratio
 * @returns the level, or `null` when either end of the ratio is unknown.
 *
 * The two `null` cases are the same rule from both sides: an unmeasured
 * capacity is not an empty building, and an unloaded occupant list is not an
 * empty building either. Painting "nearly empty" onto either is a confident
 * lie, and the first version of this function only guarded the denominator.
 */
export function occupancyLevel(
  current: number | null | undefined,
  max: number | null | undefined,
  condition?: string | null,
): OccupancyLevel | null {
  if (normalizeCondition(condition) === 'ruined') return 'ruined';
  if (max == null || max <= 0) return null;
  if (current == null) return null;
  const ratio = current / max;
  if (ratio >= OCCUPANCY_FULL) return 'full';
  if (ratio >= OCCUPANCY_PARTIAL) return 'partial';
  return 'sparse';
}

/** The colour role for an occupancy level, reusing the badge vocabulary. */
export function occupancyVariant(level: OccupancyLevel): ConditionVariant {
  switch (level) {
    case 'full':
      return 'success';
    case 'partial':
      return 'warning';
    case 'sparse':
      return 'danger';
    case 'ruined':
      return 'default';
  }
}

/**
 * What each occupancy level is CALLED — the one vocabulary for the one scale.
 *
 * The thresholds moved here first and the words stayed behind, so the same
 * scale ended up with two names: the buildings tab said "Well used / Half
 * taken / Nearly empty", the overview strip said "Full / Partly held / Thin".
 * Two independent `OCCUPANCY_LABEL` maps, same identifier, different files.
 * A reader who sees both learns two scales for one measurement — and a
 * translator has to guess whether the difference means anything. (It did not:
 * the German binds all six through one word, "belegt".)
 *
 * Consolidating the numbers without the words is half a consolidation, which
 * is the same shape of mistake as a unification that leaves one end behind.
 *
 * Thunks, not strings: `msg()` resolves against the locale active when it
 * RUNS. A module-level constant of resolved strings freezes whichever language
 * happened to be loaded first, and no language switch ever reaches it.
 */
export const OCCUPANCY_LABEL: Readonly<Record<OccupancyLevel, () => string>> = {
  full: () => msg('Well used'),
  partial: () => msg('Half taken'),
  sparse: () => msg('Nearly empty'),
  ruined: () => msg('Ruined'),
};

/**
 * The legend line for each level — the scale written out once, for the note
 * under a grid where the marks appear.
 *
 * Separate from the badge label on purpose: a badge on a card has room for two
 * words, a legend has room for the reason. The percentages are the same
 * numbers as `occupancyLevel()` above, written by hand; if they ever disagree,
 * the function is right.
 */
export const OCCUPANCY_LEGEND: Readonly<Record<OccupancyLevel, () => string>> = {
  full: () => msg('Well used \u2013 two thirds of its places or more'),
  partial: () => msg('Half taken \u2013 a third of its places or more'),
  sparse: () => msg('Nearly empty \u2013 below a third'),
  ruined: () => msg('A ruin \u2013 its places are not counted'),
};
