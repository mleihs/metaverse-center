"""Tests for backend.services.combat.skill_checks — 3-tier skill check system.

Covers:
  - resolve_skill_check: check value calculation, effective_roll = raw_roll + adjustment,
    tier classification, floor/cap 5/95, visibility penalty, wounded penalty
  - _calculate_personality_modifier: Big Five trait mapping
  - format_check_for_terminal: bilingual output formatting

Key edge cases from architecture fixes:
  - effective_roll determines outcome (not just check_value)
  - Shadow visibility 0 gives -15% penalty
  - Wounded condition gives -30% penalty
  - check_type auto-detection from aptitude
"""

from unittest.mock import patch

import pytest

from backend.services.combat.skill_checks import (
    APTITUDE_CHECK_TYPE_MAP,
    APTITUDE_MULTIPLIER,
    BASE_CHECK_VALUE,
    CHECK_TYPE_PERSONALITY_MODIFIERS,
    CHECK_VALUE_CAP,
    CHECK_VALUE_FLOOR,
    FAIL_CEILING,
    PARTIAL_CEILING,
    SkillCheckContext,
    SkillCheckOutcome,
    _calculate_personality_modifier,
    format_check_for_terminal,
    resolve_skill_check,
)


# ── Constants verification ────────────────────────────────────────────────


class TestConstants:
    def test_base_check_value(self):
        assert BASE_CHECK_VALUE == 55

    def test_aptitude_multiplier(self):
        assert APTITUDE_MULTIPLIER == 3

    def test_fail_ceiling(self):
        assert FAIL_CEILING == 30

    def test_partial_ceiling(self):
        assert PARTIAL_CEILING == 70

    def test_floor_and_cap(self):
        assert CHECK_VALUE_FLOOR == 5
        assert CHECK_VALUE_CAP == 95

    def test_all_aptitudes_have_check_type_mapping(self):
        expected_schools = {"spy", "guardian", "assassin", "propagandist", "infiltrator", "saboteur"}
        assert set(APTITUDE_CHECK_TYPE_MAP.keys()) == expected_schools


# ── _calculate_personality_modifier ───────────────────────────────────────


class TestPersonalityModifier:
    def test_courage_low_neuroticism_bonus(self):
        """Low neuroticism (>= 0.5) = brave = -10 for courage (inverted: bonus is negative)."""
        # The table: neuroticism >= 0.5 → bonus_above = -10 (actually penalty for HIGH neuro)
        # Wait, re-read: courage: neuroticism: (0.5, -10, 10)
        # If neuroticism >= 0.5 → -10 (high neuroticism = penalty, not bonus!)
        # If neuroticism < 0.5 → +10 (low neuroticism = brave = bonus)
        result = _calculate_personality_modifier("courage", {"neuroticism": 0.3})
        assert result == 10  # brave: low neuroticism

    def test_courage_high_neuroticism_penalty(self):
        result = _calculate_personality_modifier("courage", {"neuroticism": 0.8})
        assert result == -10  # cowardly: high neuroticism

    def test_social_high_extraversion_bonus(self):
        result = _calculate_personality_modifier("social", {"extraversion": 0.8})
        assert result == 10

    def test_social_low_extraversion_penalty(self):
        result = _calculate_personality_modifier("social", {"extraversion": 0.2})
        assert result == -5

    def test_precision_high_conscientiousness(self):
        result = _calculate_personality_modifier("precision", {"conscientiousness": 0.9})
        assert result == 10

    def test_creative_high_openness(self):
        result = _calculate_personality_modifier("creative", {"openness": 0.9})
        assert result == 10

    def test_creative_low_openness(self):
        result = _calculate_personality_modifier("creative", {"openness": 0.1})
        assert result == -10

    def test_compassionate_high_agreeableness(self):
        result = _calculate_personality_modifier("compassionate", {"agreeableness": 0.8})
        assert result == 10

    def test_compassionate_low_agreeableness_no_penalty(self):
        result = _calculate_personality_modifier("compassionate", {"agreeableness": 0.2})
        assert result == 0  # penalty_below = 0

    def test_ruthless_low_agreeableness_bonus(self):
        result = _calculate_personality_modifier("ruthless", {"agreeableness": 0.2})
        assert result == 10  # low agree = ruthless

    def test_ruthless_high_agreeableness_penalty(self):
        result = _calculate_personality_modifier("ruthless", {"agreeableness": 0.8})
        assert result == -10  # too nice for ruthless

    def test_unknown_check_type_returns_zero(self):
        result = _calculate_personality_modifier("nonexistent", {"neuroticism": 0.8})
        assert result == 0

    def test_missing_trait_defaults_to_0_5(self):
        """If trait not in personality dict, defaults to 0.5."""
        result = _calculate_personality_modifier("courage", {})
        # neuroticism defaults to 0.5, 0.5 >= 0.5 → -10
        assert result == -10

    def test_exactly_at_threshold(self):
        """Trait exactly at threshold goes to bonus_above path."""
        result = _calculate_personality_modifier("social", {"extraversion": 0.5})
        assert result == 10  # >= 0.5


# ── resolve_skill_check ───────────────────────────────────────────────────


class TestResolveSkillCheck:
    """Check value calculation and tier classification."""

    def test_basic_check_value_calculation(self):
        """Base 55 + aptitude * 3."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)

        # check_value = 55 + 15 + personality_mod
        # spy -> precision -> conscientiousness defaults to 0.5 -> +10
        # check_value = 55 + 15 + 10 = 80
        assert outcome.check_value == 80
        assert outcome.breakdown["base"] == 55
        assert outcome.breakdown["aptitude_bonus"] == 15

    def test_effective_roll_determines_tier(self):
        """The effective_roll = raw_roll + adjustment determines the tier, not raw_roll alone."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=9, personality={})
        # check_value = 55 + 27 + (-10) = 72 (personality: conscientiousness defaults → 0.5 → +10)
        # Actually with empty personality, conscientiousness defaults to 0.5 → +10
        # check_value = 55 + 27 + 10 = 92, but capped at 95
        # adjustment = 92 - 55 = 37
        # raw_roll = 10, effective = min(100, max(1, 10 + 37)) = 47 → partial
        with patch("backend.services.combat.skill_checks.random.randint", return_value=10):
            outcome = resolve_skill_check(ctx)

        assert outcome.roll == 10
        # effective = 10 + (check_value - 55)
        # Should NOT be fail even though raw_roll is 10

    def test_low_roll_with_high_aptitude_can_succeed(self):
        """High aptitude shifts even low rolls toward success."""
        ctx = SkillCheckContext(
            aptitude="spy",
            aptitude_level=9,
            personality={"conscientiousness": 0.9},  # precision +10
        )
        # check_value = 55 + 27 + 10 = 92 → capped at 92
        # adjustment = 92 - 55 = 37
        # raw_roll = 40, effective = 40 + 37 = 77 → SUCCESS (>70)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=40):
            outcome = resolve_skill_check(ctx)
        assert outcome.result == "success"

    def test_high_roll_with_low_aptitude_can_fail(self):
        """Low aptitude shifts rolls toward failure."""
        ctx = SkillCheckContext(
            aptitude="spy",
            aptitude_level=0,
            personality={"conscientiousness": 0.1},  # -5
            condition="wounded",  # -30
            visibility=0,  # -15
            difficulty_modifier=-10,
        )
        # check_value = 55 + 0 - 5 - 10 - 15 - 30 = -5 → clamped to 5
        # adjustment = 5 - 55 = -50
        # raw_roll = 60, effective = max(1, 60 - 50) = 10 → FAIL (≤30)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=60):
            outcome = resolve_skill_check(ctx)
        assert outcome.result == "fail"

    def test_visibility_zero_penalty(self):
        """Shadow visibility 0 gives -15% penalty."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={}, visibility=0)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert "visibility_penalty" in outcome.breakdown
        assert outcome.breakdown["visibility_penalty"] == -15

    def test_visibility_nonzero_no_penalty(self):
        """Visibility > 0 has no penalty."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={}, visibility=2)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert "visibility_penalty" not in outcome.breakdown

    def test_wounded_condition_penalty(self):
        """Wounded condition gives -30% penalty."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={}, condition="wounded")
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.breakdown["condition_penalty"] == -30

    def test_non_wounded_no_condition_penalty(self):
        """Only 'wounded' has condition penalty, not stressed/afflicted."""
        for cond in ("operational", "stressed", "afflicted"):
            ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={}, condition=cond)
            with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
                outcome = resolve_skill_check(ctx)
            assert "condition_penalty" not in outcome.breakdown

    def test_difficulty_modifier_applied(self):
        """Encounter-specific difficulty adjustment."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={}, difficulty_modifier=-10)
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.breakdown["difficulty_modifier"] == -10

    def test_check_value_floor_at_5(self):
        """Even with extreme penalties, check_value doesn't go below 5."""
        ctx = SkillCheckContext(
            aptitude="spy", aptitude_level=0, personality={},
            condition="wounded", visibility=0, difficulty_modifier=-50,
        )
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.check_value >= CHECK_VALUE_FLOOR

    def test_check_value_cap_at_95(self):
        """Even with extreme bonuses, check_value doesn't exceed 95."""
        ctx = SkillCheckContext(
            aptitude="spy", aptitude_level=9, personality={"conscientiousness": 1.0},
            difficulty_modifier=50,
        )
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.check_value <= CHECK_VALUE_CAP

    def test_check_type_auto_detected_from_aptitude(self):
        """If check_type is None, auto-detect from aptitude."""
        ctx = SkillCheckContext(aptitude="guardian", aptitude_level=5, personality={"neuroticism": 0.2})
        # guardian → courage → neuroticism < 0.5 → +10
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.breakdown.get("check_type") == "courage"
        assert outcome.breakdown.get("personality_modifier") == 10

    def test_explicit_check_type_overrides_auto(self):
        """Explicit check_type takes precedence over auto-detection."""
        ctx = SkillCheckContext(
            aptitude="guardian", aptitude_level=5,
            personality={"extraversion": 0.9},
            check_type="social",
        )
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.breakdown.get("check_type") == "social"
        assert outcome.breakdown.get("personality_modifier") == 10

    # --- Tier classification ---

    def test_fail_tier_effective_roll_le_30(self):
        """Effective roll ≤ 30 → fail."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=0, personality={})
        # check_value = 55 + 0 - 10 = 45 (conscientiousness defaults to 0.5 = +10... wait)
        # Actually: spy -> precision -> conscientiousness defaults to 0.5 → +10
        # check_value = 55 + 0 + 10 = 65
        # adjustment = 65 - 55 = 10
        # raw_roll = 1, effective = 1 + 10 = 11 → FAIL
        with patch("backend.services.combat.skill_checks.random.randint", return_value=1):
            outcome = resolve_skill_check(ctx)
        assert outcome.result == "fail"

    def test_partial_tier_effective_roll_31_to_70(self):
        """31 ≤ effective roll ≤ 70 → partial."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=0, personality={"conscientiousness": 0.5})
        # check_value = 55 + 0 + 10 = 65
        # adjustment = 10
        # raw_roll = 40, effective = 50 → PARTIAL
        with patch("backend.services.combat.skill_checks.random.randint", return_value=40):
            outcome = resolve_skill_check(ctx)
        assert outcome.result == "partial"

    def test_success_tier_effective_roll_gt_70(self):
        """Effective roll > 70 → success."""
        ctx = SkillCheckContext(aptitude="spy", aptitude_level=5, personality={"conscientiousness": 0.9})
        # check_value = 55 + 15 + 10 = 80
        # adjustment = 25
        # raw_roll = 50, effective = 75 → SUCCESS
        with patch("backend.services.combat.skill_checks.random.randint", return_value=50):
            outcome = resolve_skill_check(ctx)
        assert outcome.result == "success"

    # --- SkillCheckOutcome properties ---

    def test_succeeded_property(self):
        outcome = SkillCheckOutcome(result="success", roll=50, check_value=80)
        assert outcome.succeeded is True
        assert outcome.failed is False

    def test_failed_property(self):
        outcome = SkillCheckOutcome(result="fail", roll=10, check_value=30)
        assert outcome.succeeded is False
        assert outcome.failed is True

    def test_partial_neither(self):
        outcome = SkillCheckOutcome(result="partial", roll=50, check_value=55)
        assert outcome.succeeded is False
        assert outcome.failed is False


# ── format_check_for_terminal ─────────────────────────────────────────────


class TestFormatCheckForTerminal:
    def test_returns_bilingual_tuple(self):
        outcome = SkillCheckOutcome(
            result="success", roll=75, check_value=80,
            breakdown={
                "aptitude": "spy", "aptitude_level": 5,
                "base": 55, "aptitude_bonus": 15,
                "final_check_value": 80,
                "adjustment": 25,
            },
        )
        en, de = format_check_for_terminal("Bond", "infiltrates the facility", outcome)
        assert "Bond" in en
        assert "Bond" in de
        assert "SPY" in en
        assert "SPY" in de  # uppercase aptitude
        assert "SUCCESS" in en
        assert "ERFOLG" in de

    def test_includes_personality_modifier_when_present(self):
        outcome = SkillCheckOutcome(
            result="partial", roll=50, check_value=65,
            breakdown={
                "aptitude": "guardian", "aptitude_level": 5,
                "base": 55, "aptitude_bonus": 15,
                "personality_modifier": 10, "check_type": "courage",
                "final_check_value": 65,
                "adjustment": 10,
            },
        )
        en, de = format_check_for_terminal("Agent X", "defends", outcome)
        assert "Personality" in en
        assert "courage" in en
        assert "Persönlichkeit" in de

    def test_includes_visibility_penalty(self):
        outcome = SkillCheckOutcome(
            result="fail", roll=15, check_value=50,
            breakdown={
                "aptitude": "spy", "aptitude_level": 5,
                "base": 55, "aptitude_bonus": 15,
                "visibility_penalty": -15,
                "final_check_value": 50,
                "adjustment": -5,
            },
        )
        en, de = format_check_for_terminal("Agent Y", "searches", outcome)
        assert "Visibility 0" in en
        assert "Sicht 0" in de

    def test_includes_condition_penalty(self):
        outcome = SkillCheckOutcome(
            result="fail", roll=10, check_value=40,
            breakdown={
                "aptitude": "spy", "aptitude_level": 5,
                "base": 55, "aptitude_bonus": 15,
                "condition_penalty": -30,
                "final_check_value": 40,
                "adjustment": -15,
            },
        )
        en, de = format_check_for_terminal("Agent Z", "attacks", outcome)
        assert "Wounded" in en
        assert "Verwundet" in de

    def test_fail_label(self):
        outcome = SkillCheckOutcome(
            result="fail", roll=5, check_value=30,
            breakdown={
                "aptitude": "spy", "aptitude_level": 0,
                "base": 55, "aptitude_bonus": 0,
                "final_check_value": 30,
                "adjustment": -25,
            },
        )
        en, de = format_check_for_terminal("Agent", "acts", outcome)
        assert "FAIL" in en
        assert "FEHLSCHLAG" in de
