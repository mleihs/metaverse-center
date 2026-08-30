"""Turn an agent's disposition into a budget-valid set of six aptitudes.

The Forge never wrote `agent_aptitudes`. On production 222 of 258 agents had no
rows and therefore stood flat on `DEFAULT_APTITUDE_LEVEL` (6) in every
discipline — and since the highest `min_aptitude` in the ability content is 5,
an agent with no assignment at all unlocked everything. Party composition was
not a decision in 30 of 36 worlds (Befund D15).

## Where the signal comes from

Not from a new table. `combat/skill_checks.py` already declares
`APTITUDE_CHECK_TYPE_MAP` (operative → check type) and
`CHECK_TYPE_PERSONALITY_MODIFIERS` (check type → Big Five trait + direction).
Composing the two gives the primary affinity for free, and — more importantly —
means aptitude and skill check cannot drift apart: an agent whose nature favours
a check type is also good at the discipline that rolls it.

That alone is not enough: spy, infiltrator and assassin all resolve to
"precision"/conscientiousness and would be indistinguishable. The tiebreaker is
`OPERATIVE_SECONDARY_TRAIT` in `models/aptitude.py`, weighted by
`PRIMARY_TRAIT_WEIGHT`.

## Why the budget is spent this way

Every operative starts at `APTITUDE_MIN` (3) — six of them, so 18 of the 36
points are floor. The remaining 18 are shared out in proportion to affinity,
capped at `APTITUDE_MAX` (9). An agent is therefore never useless at anything
and never perfect at everything, and the result always satisfies the budget
invariant that `AptitudeSet` enforces.

Python, not SQL: this is game logic, not integrity (see the SQL/Python boundary
in the project rules). `fn_materialize_shard` creates the agents; the aptitudes
are derived and written afterwards from the orchestrator.
"""

from __future__ import annotations

from backend.models.aptitude import (
    APTITUDE_BUDGET,
    APTITUDE_MAX,
    APTITUDE_MIN,
    OPERATIVE_SECONDARY_TRAIT,
    OPERATIVE_TYPES,
    PRIMARY_TRAIT_WEIGHT,
    AptitudeSet,
)
from backend.services.combat.skill_checks import (
    APTITUDE_CHECK_TYPE_MAP,
    CHECK_TYPE_PERSONALITY_MODIFIERS,
)

_NEUTRAL = 0.5


def _primary_score(operative: str, personality: dict) -> float:
    """Affinity from the tables `skill_checks` already declares (0.0 – 1.0)."""
    check_type = APTITUDE_CHECK_TYPE_MAP.get(operative)
    modifiers = CHECK_TYPE_PERSONALITY_MODIFIERS.get(check_type or "", {})
    if not modifiers:
        return _NEUTRAL

    scores = []
    for trait, (_threshold, bonus_if_above, _penalty) in modifiers.items():
        value = _trait(personality, trait)
        # A negative "bonus if above" means the LOW end of the trait is the
        # good end (courage rewards low neuroticism), so the score inverts.
        scores.append(value if bonus_if_above > 0 else 1.0 - value)
    return sum(scores) / len(scores)


def _secondary_score(operative: str, personality: dict) -> float:
    entry = OPERATIVE_SECONDARY_TRAIT.get(operative)
    if not entry:
        return _NEUTRAL
    trait, high_is_good = entry
    value = _trait(personality, trait)
    return value if high_is_good else 1.0 - value


def _trait(personality: dict, name: str) -> float:
    """One Big Five value, clamped. A missing trait reads as neutral."""
    try:
        value = float(personality.get(name, _NEUTRAL))
    except (TypeError, ValueError):
        return _NEUTRAL
    return max(0.0, min(1.0, value))


def derive_aptitude_set(personality: dict | None) -> AptitudeSet:
    """Six aptitudes for one agent, summing to exactly ``APTITUDE_BUDGET``.

    An agent with no personality at all comes out as an even generalist — the
    same shape the old baseline produced, but written down rather than implied.
    """
    traits = personality or {}
    scores = {
        operative: (
            PRIMARY_TRAIT_WEIGHT * _primary_score(operative, traits)
            + (1.0 - PRIMARY_TRAIT_WEIGHT) * _secondary_score(operative, traits)
        )
        for operative in OPERATIVE_TYPES
    }

    floor_total = APTITUDE_MIN * len(OPERATIVE_TYPES)
    spendable = APTITUDE_BUDGET - floor_total
    headroom = APTITUDE_MAX - APTITUDE_MIN

    total_score = sum(scores.values())
    if total_score <= 0:
        shares = dict.fromkeys(OPERATIVE_TYPES, spendable / len(OPERATIVE_TYPES))
    else:
        shares = {op: spendable * score / total_score for op, score in scores.items()}

    # Integer allocation: floor everything, then hand out the remainder to the
    # largest fractions. Deterministic, and the total lands exactly on budget
    # rather than "close enough".
    levels = {op: APTITUDE_MIN + min(headroom, int(share)) for op, share in shares.items()}
    remainder = APTITUDE_BUDGET - sum(levels.values())

    by_fraction = sorted(
        OPERATIVE_TYPES,
        key=lambda op: (-(shares[op] - int(shares[op])), -scores[op], op),
    )
    while remainder > 0:
        moved = False
        for operative in by_fraction:
            if remainder == 0:
                break
            if levels[operative] < APTITUDE_MAX:
                levels[operative] += 1
                remainder -= 1
                moved = True
        if not moved:  # pragma: no cover — impossible while 6*9 = 54 > 36
            break

    while remainder < 0:
        moved = False
        for operative in reversed(by_fraction):
            if remainder == 0:
                break
            if levels[operative] > APTITUDE_MIN:
                levels[operative] -= 1
                remainder += 1
                moved = True
        if not moved:  # pragma: no cover
            break

    return AptitudeSet(**levels)
