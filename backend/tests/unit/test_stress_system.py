"""Tests for backend.services.combat.stress_system — pure stress economy.

Covers:
  - calculate_stress_damage: formula, guardian shield 50%, min 10, cap at 150
  - calculate_ambient_stress: Review #11 halved formula
  - apply_stress: delta application, resolve threshold crossing detection, cap/floor
  - resolve_stress_check: virtue/affliction distribution (Review #11: 40% virtue)
  - stress_threshold: UI display categories
"""

from unittest.mock import patch

import pytest

from backend.services.combat.stress_system import (
    INSPIRE_STRESS_HEAL,
    REST_STRESS_HEAL,
    STRESS_CAP_PER_ROUND,
    STRESS_MAX,
    STRESS_RESOLVE_THRESHOLD,
    STRESS_THRESHOLD_CRITICAL,
    STRESS_THRESHOLD_TENSE,
    VIRTUE_RATE,
    apply_stress,
    calculate_ambient_stress,
    calculate_stress_damage,
    resolve_stress_check,
    stress_threshold,
)


# ── Constants verification ────────────────────────────────────────────────


class TestConstants:
    """Verify constants match spec / Review #11 decisions."""

    def test_stress_max(self):
        assert STRESS_MAX == 1000

    def test_resolve_threshold(self):
        assert STRESS_RESOLVE_THRESHOLD == 800

    def test_cap_per_round(self):
        assert STRESS_CAP_PER_ROUND == 150

    def test_virtue_rate(self):
        assert VIRTUE_RATE == 0.40

    def test_rest_heal(self):
        assert REST_STRESS_HEAL == 200

    def test_inspire_heal(self):
        assert INSPIRE_STRESS_HEAL == 120

    def test_threshold_tense(self):
        assert STRESS_THRESHOLD_TENSE == 200

    def test_threshold_critical(self):
        assert STRESS_THRESHOLD_CRITICAL == 500


# ── calculate_stress_damage ───────────────────────────────────────────────


class TestCalculateStressDamage:
    """Stress damage formula: base*20 - resilience*0.4 + neuroticism*0.3, guardian halves."""

    def test_baseline_mid_personality(self):
        """Power 5, mid resilience/neuroticism."""
        result = calculate_stress_damage(5, 0.5, 0.5)
        # base = 5*20 = 100
        # resilience_reduction = 100 * 0.5 * 0.4 = 20
        # neuroticism_amplify = 100 * 0.5 * 0.3 = 15
        # result = 100 - 20 + 15 = 95
        assert result == 95

    def test_max_power_max_neuroticism_zero_resilience(self):
        """Worst case scenario: high power, zero resilience, max neuroticism."""
        result = calculate_stress_damage(10, 0.0, 1.0)
        # base = 200, resilience_reduction = 0, neuroticism_amplify = 200*1.0*0.3 = 60
        # result = 200 + 60 = 260 → capped at 150
        assert result == STRESS_CAP_PER_ROUND

    def test_minimum_floor_at_10(self):
        """Even with max resilience and zero neuroticism, minimum is 10."""
        result = calculate_stress_damage(1, 1.0, 0.0)
        # base = 20, resilience = 20*1.0*0.4 = 8, neuroticism = 0
        # result = 20 - 8 = 12 → above 10
        assert result >= 10

    def test_very_low_still_floors_at_10(self):
        """Low power with high resilience should still floor at 10."""
        result = calculate_stress_damage(1, 1.0, 0.0, has_guardian_shield=True)
        # base=20, resilience=8, neuro=0, result=12, guardian halves=6 → floor at 10
        assert result == 10

    def test_guardian_shield_halves_stress(self):
        """Guardian shield absorbs 50% of stress damage."""
        without_shield = calculate_stress_damage(5, 0.5, 0.5)
        with_shield = calculate_stress_damage(5, 0.5, 0.5, has_guardian_shield=True)
        assert with_shield < without_shield
        # 95 * 0.5 = 47.5 → int(47.5) = 47
        assert with_shield == 47

    def test_cap_applies_after_guardian(self):
        """Cap at 150 is after all reductions including guardian."""
        result = calculate_stress_damage(10, 0.0, 1.0, has_guardian_shield=True)
        # 260 * 0.5 = 130 → 130 < 150, so not capped
        assert result == 130

    def test_zero_personality_traits(self):
        """Both traits at 0 — only base damage."""
        result = calculate_stress_damage(5, 0.0, 0.0)
        # base = 100, no reductions/amplifications
        assert result == 100

    @pytest.mark.parametrize("power", range(1, 11))
    def test_always_within_bounds(self, power):
        """Result is always between 10 and 150 regardless of inputs."""
        for res in (0.0, 0.5, 1.0):
            for neuro in (0.0, 0.5, 1.0):
                for shield in (True, False):
                    result = calculate_stress_damage(power, res, neuro, has_guardian_shield=shield)
                    assert 10 <= result <= STRESS_CAP_PER_ROUND


# ── calculate_ambient_stress ──────────────────────────────────────────────


class TestCalculateAmbientStress:
    """Review #11: halved formula — 8 + 3*depth + 5*difficulty."""

    def test_depth_1_difficulty_1(self):
        assert calculate_ambient_stress(1, 1) == 8 + 3 + 5  # 16

    def test_depth_3_difficulty_3(self):
        assert calculate_ambient_stress(3, 3) == 8 + 9 + 15  # 32

    def test_depth_5_difficulty_5(self):
        assert calculate_ambient_stress(5, 5) == 8 + 15 + 25  # 48

    def test_depth_0_difficulty_0(self):
        assert calculate_ambient_stress(0, 0) == 8  # base only

    def test_increases_with_depth(self):
        """Deeper = more stress."""
        assert calculate_ambient_stress(5, 3) > calculate_ambient_stress(1, 3)

    def test_increases_with_difficulty(self):
        """Harder = more stress."""
        assert calculate_ambient_stress(3, 5) > calculate_ambient_stress(3, 1)


# ── apply_stress ──────────────────────────────────────────────────────────


class TestApplyStress:
    """Stress application with resolve threshold detection."""

    def test_basic_gain(self):
        new, triggers = apply_stress(100, 50)
        assert new == 150
        assert triggers is False

    def test_basic_heal(self):
        new, triggers = apply_stress(300, -100)
        assert new == 200
        assert triggers is False

    def test_floor_at_zero(self):
        new, _ = apply_stress(50, -200)
        assert new == 0

    def test_cap_at_1000(self):
        new, _ = apply_stress(950, 200)
        assert new == STRESS_MAX

    def test_resolve_threshold_crossing_triggers(self):
        """Crossing 800 from below triggers resolve check."""
        new, triggers = apply_stress(750, 100)
        assert new == 850
        assert triggers is True

    def test_already_above_threshold_no_trigger(self):
        """Already at/above 800 — no second trigger."""
        new, triggers = apply_stress(800, 50)
        assert new == 850
        assert triggers is False

    def test_exactly_at_threshold_triggers(self):
        """Landing exactly at 800 from below triggers."""
        new, triggers = apply_stress(700, 100)
        assert new == 800
        assert triggers is True

    def test_per_round_cap_positive_only(self):
        """Cap only applies to positive deltas."""
        new, _ = apply_stress(0, 200, cap_per_round=True)
        assert new == STRESS_CAP_PER_ROUND  # 150, not 200

    def test_per_round_cap_does_not_affect_healing(self):
        """Healing (negative delta) is never capped."""
        new, _ = apply_stress(500, -300, cap_per_round=True)
        assert new == 200  # full 300 heal applied

    def test_cap_disabled(self):
        """With cap_per_round=False, no cap on gain."""
        new, _ = apply_stress(0, 500, cap_per_round=False)
        assert new == 500

    def test_zero_delta(self):
        new, triggers = apply_stress(400, 0)
        assert new == 400
        assert triggers is False


# ── resolve_stress_check ──────────────────────────────────────────────────


class TestResolveStressCheck:
    """Review #11: 40% virtue, 60% affliction."""

    def test_returns_valid_outcome(self):
        result = resolve_stress_check()
        assert result in ("virtue", "affliction")

    def test_virtue_with_low_random(self):
        """random.random() < 0.40 → virtue."""
        with patch("backend.services.combat.stress_system.random.random", return_value=0.1):
            assert resolve_stress_check() == "virtue"

    def test_affliction_with_high_random(self):
        """random.random() >= 0.40 → affliction."""
        with patch("backend.services.combat.stress_system.random.random", return_value=0.5):
            assert resolve_stress_check() == "affliction"

    def test_boundary_at_virtue_rate(self):
        """Exactly at 0.40 boundary → affliction (not <, so >=)."""
        with patch("backend.services.combat.stress_system.random.random", return_value=0.40):
            assert resolve_stress_check() == "affliction"

    def test_just_below_virtue_rate(self):
        """Just below 0.40 → virtue."""
        with patch("backend.services.combat.stress_system.random.random", return_value=0.399):
            assert resolve_stress_check() == "virtue"

    def test_statistical_distribution(self):
        """Over many runs, approximately 40% virtue (±5%)."""
        n = 5000
        virtues = sum(1 for _ in range(n) if resolve_stress_check() == "virtue")
        ratio = virtues / n
        assert 0.35 <= ratio <= 0.45, f"Virtue ratio {ratio:.3f} out of expected range"


# ── stress_threshold ──────────────────────────────────────────────────────


class TestStressThreshold:
    """UI display categories for stress levels."""

    @pytest.mark.parametrize(
        ("stress", "expected"),
        [
            (0, "normal"),
            (100, "normal"),
            (199, "normal"),
            (200, "tense"),
            (300, "tense"),
            (499, "tense"),
            (500, "critical"),
            (800, "critical"),
            (1000, "critical"),
        ],
    )
    def test_thresholds(self, stress, expected):
        assert stress_threshold(stress) == expected
