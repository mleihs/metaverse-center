/**
 * Building condition — the single mapping from the backend's condition
 * vocabulary to the three-dot gem and the badge variant on `<velg-game-card>`.
 *
 * The backend (`backend/models/forge.py` ForgeBuildingDraft.building_condition)
 * emits five values: pristine, good, fair, poor, ruined. Two independent copies
 * of this mapping existed in `BuildingCard.ts` and both dropped `pristine`
 * through to the `ruined` branch — a flawless building rendered with an empty
 * gem and a neutral badge. Keeping one table here removes the second copy and
 * the class of drift that produced that bug.
 */

/** The condition vocabulary the generator is allowed to produce. Internal:
 * both public functions take the backend's raw string and normalise it here, so
 * no caller ever holds this type. */
type BuildingCondition = 'pristine' | 'good' | 'fair' | 'poor' | 'ruined';

/** Badge colour role, matching `CardBadge.variant` on `<velg-game-card>`. */
export type ConditionVariant = 'success' | 'warning' | 'danger' | 'default';

const CONDITION_DOTS: Readonly<Record<BuildingCondition, number>> = {
  pristine: 3,
  good: 3,
  fair: 2,
  poor: 1,
  ruined: 0,
};

const CONDITION_VARIANT: Readonly<Record<BuildingCondition, ConditionVariant>> = {
  pristine: 'success',
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
 * @param current  places taken (agents living here)
 * @param max      places the building has
 * @param condition the raw `building_condition`, which can override the ratio
 * @returns the level, or `null` when the building declares no capacity — an
 *          absent capacity is not an empty one, and painting "○ critical" onto
 *          a building nobody measured is a confident lie.
 */
export function occupancyLevel(
  current: number | null | undefined,
  max: number | null | undefined,
  condition?: string | null,
): OccupancyLevel | null {
  if (normalizeCondition(condition) === 'ruined') return 'ruined';
  if (max == null || max <= 0) return null;
  const ratio = (current ?? 0) / max;
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
