"""Aptitudes derived from an agent's disposition — budget-valid, and distinct.

Befund D15: the Forge never wrote `agent_aptitudes`. On production 222 of 258
agents had no rows and therefore stood flat on `DEFAULT_APTITUDE_LEVEL` (6) in
every discipline — and because the highest `min_aptitude` in the ability content
is 5, an agent with no assignment at all unlocked every ability. Party
composition was not a decision in 30 of 36 worlds.
"""

from __future__ import annotations

import pytest

from backend.models.aptitude import (
    APTITUDE_BUDGET,
    APTITUDE_MAX,
    APTITUDE_MIN,
    OPERATIVE_SECONDARY_TRAIT,
    OPERATIVE_TYPES,
)
from backend.services.aptitude_derivation import derive_aptitude_set
from backend.services.combat.skill_checks import (
    APTITUDE_CHECK_TYPE_MAP,
    CHECK_TYPE_PERSONALITY_MODIFIERS,
)

_CONSCIENTIOUS = {
    "conscientiousness": 0.95, "neuroticism": 0.1, "openness": 0.3,
    "agreeableness": 0.5, "extraversion": 0.4,
}
_SOCIABLE = {
    "openness": 0.9, "extraversion": 0.95, "conscientiousness": 0.2,
    "neuroticism": 0.5, "agreeableness": 0.8,
}
_RUTHLESS = {
    "agreeableness": 0.05, "neuroticism": 0.8, "openness": 0.7,
    "conscientiousness": 0.5, "extraversion": 0.3,
}


def _levels(personality) -> dict:
    return derive_aptitude_set(personality).model_dump()


class TestTheSignalComesFromTheExistingTables:
    """Not a new mapping: the primary affinity is composed from what
    `skill_checks` already declares, so aptitude and skill check cannot drift."""

    @pytest.mark.parametrize("operative", OPERATIVE_TYPES)
    def test_every_operative_has_a_check_type(self, operative):
        assert operative in APTITUDE_CHECK_TYPE_MAP

    @pytest.mark.parametrize("operative", OPERATIVE_TYPES)
    def test_every_check_type_has_a_trait(self, operative):
        check_type = APTITUDE_CHECK_TYPE_MAP[operative]
        assert CHECK_TYPE_PERSONALITY_MODIFIERS.get(check_type), (
            f"'{check_type}' hat keine Merkmalszuordnung — die Herleitung "
            f"fiele für {operative} auf neutral zurück"
        )

    def test_the_tiebreaker_covers_everyone(self):
        """spy, infiltrator and assassin all resolve to precision — without a
        secondary trait they would be indistinguishable."""
        assert set(OPERATIVE_SECONDARY_TRAIT) == set(OPERATIVE_TYPES)


class TestTheBudgetInvariant:
    @pytest.mark.parametrize(
        "personality", [None, {}, _CONSCIENTIOUS, _SOCIABLE, _RUTHLESS,
                        {"openness": 1.0}, {"openness": 0.0}, {"openness": "kaputt"}]
    )
    def test_always_sums_to_the_budget(self, personality):
        levels = _levels(personality)
        assert sum(levels.values()) == APTITUDE_BUDGET

    @pytest.mark.parametrize("personality", [None, {}, _CONSCIENTIOUS, _SOCIABLE, _RUTHLESS])
    def test_always_within_range(self, personality):
        for operative, level in _levels(personality).items():
            assert APTITUDE_MIN <= level <= APTITUDE_MAX, f"{operative}={level}"

    def test_all_six_operatives_are_present(self):
        assert set(_levels(_CONSCIENTIOUS)) == set(OPERATIVE_TYPES)


class TestItActuallyDifferentiates:
    def test_an_empty_disposition_is_an_even_generalist(self):
        """Matches the documented baseline — written down instead of implied.

        This is also the production case today: all 258 personality profiles are
        `{}` because nothing calls `PersonalityExtractionService`.
        """
        assert set(_levels({}).values()) == {APTITUDE_BUDGET // len(OPERATIVE_TYPES)}

    def test_different_dispositions_give_different_profiles(self):
        assert _levels(_CONSCIENTIOUS) != _levels(_SOCIABLE) != _levels(_RUTHLESS)

    def test_the_sociable_agent_leads_in_propaganda(self):
        levels = _levels(_SOCIABLE)
        assert levels["propagandist"] == max(levels.values())

    def test_the_conscientious_calm_agent_leads_in_guarding_or_infiltration(self):
        levels = _levels(_CONSCIENTIOUS)
        best = max(levels, key=lambda op: levels[op])
        assert best in ("guardian", "infiltrator", "spy", "assassin"), levels

    def test_the_three_precision_operatives_are_not_identical(self):
        """The whole reason the tiebreaker exists."""
        levels = _levels(_RUTHLESS)
        assert len({levels["spy"], levels["infiltrator"], levels["assassin"]}) > 1, levels

    def test_a_strong_disposition_produces_a_real_spread(self):
        for personality in (_CONSCIENTIOUS, _SOCIABLE, _RUTHLESS):
            levels = _levels(personality)
            assert max(levels.values()) - min(levels.values()) >= 2, (
                f"Zu flach, um eine Entscheidung zu sein: {levels}"
            )


class TestItIsDeterministic:
    def test_same_input_same_output(self):
        assert _levels(_SOCIABLE) == _levels(_SOCIABLE)

    def test_no_randomness_in_the_module(self):
        from pathlib import Path

        source = Path("backend/services/aptitude_derivation.py").read_text(encoding="utf-8")
        assert "random" not in source, (
            "Zufall macht die Herleitung unreproduzierbar — zwei Läufe derselben "
            "Welt bekämen verschiedene Agenten"
        )
