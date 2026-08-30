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
