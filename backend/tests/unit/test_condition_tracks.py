"""Tests for backend.services.combat.condition_tracks — pure condition state machine.

Covers:
  - apply_condition_damage: all transitions, Review #10 cap at 2 steps
  - get_condition_severity: 0-4 scale
  - can_act: only captured is incapacitated
  - condition_display: human-readable mapping
"""

import pytest

from backend.services.combat.condition_tracks import (
    CONDITION_SEVERITY,
    CONDITION_TRANSITIONS,
    TRANSITION_SIDE_EFFECTS,
    apply_condition_damage,
    can_act,
    condition_display,
    get_condition_severity,
)


# ── apply_condition_damage ────────────────────────────────────────────────


class TestApplyConditionDamage:
    """Test the condition transition system with damage steps."""

    # --- Standard transitions (1 step) ---

    @pytest.mark.parametrize(
        ("start", "steps", "expected"),
        [
            ("operational", 1, "stressed"),
            ("stressed", 1, "wounded"),
            ("wounded", 1, "afflicted"),
            ("afflicted", 1, "captured"),
        ],
    )
    def test_single_step_transitions(self, start, steps, expected):
        new_condition, _ = apply_condition_damage(start, steps)
        assert new_condition == expected

    # --- Standard transitions (2 steps) ---

    @pytest.mark.parametrize(
        ("start", "steps", "expected"),
        [
            ("operational", 2, "wounded"),
            ("stressed", 2, "afflicted"),
            ("wounded", 2, "captured"),
            ("afflicted", 2, "captured"),
        ],
    )
    def test_double_step_transitions(self, start, steps, expected):
        new_condition, _ = apply_condition_damage(start, steps)
        assert new_condition == expected

    # --- Review #10: Cap at 2 steps per hit ---

    def test_three_steps_capped_at_two(self):
        """3 raw steps should be capped at 2 (Review #10)."""
        new_condition, _ = apply_condition_damage("operational", 3)
        assert new_condition == "wounded"  # operational + 2 = wounded, NOT afflicted

    def test_ten_steps_capped_at_two(self):
        """Even extreme values are capped at 2."""
        new_condition, _ = apply_condition_damage("stressed", 10)
        assert new_condition == "afflicted"  # stressed + 2 = afflicted, NOT captured

    def test_hundred_steps_capped_at_two(self):
        """Even absurd values are capped at 2."""
        new_condition, _ = apply_condition_damage("wounded", 100)
        assert new_condition == "captured"  # wounded + 2 = captured

    # --- Zero/negative steps ---

    def test_zero_steps_no_change(self):
        new_condition, side_effects = apply_condition_damage("operational", 0)
        assert new_condition == "operational"
        assert side_effects == {}

    def test_negative_steps_no_change(self):
        new_condition, side_effects = apply_condition_damage("wounded", -5)
        assert new_condition == "wounded"
        assert side_effects == {}

    # --- Already captured ---

    def test_captured_stays_captured(self):
        new_condition, side_effects = apply_condition_damage("captured", 1)
        assert new_condition == "captured"
        assert side_effects == {"removed_from_combat": True}

    def test_captured_with_zero_steps(self):
        new_condition, side_effects = apply_condition_damage("captured", 0)
        assert new_condition == "captured"
        assert side_effects == {"removed_from_combat": True}

    # --- Side effects per transition target ---

    def test_stressed_side_effects(self):
        _, side_effects = apply_condition_damage("operational", 1)
        assert side_effects["stress_delta"] == 100
        assert side_effects.get("check_penalty") is None

    def test_wounded_side_effects(self):
        _, side_effects = apply_condition_damage("stressed", 1)
        assert side_effects["stress_delta"] == 200
        assert side_effects["check_penalty"] == -30

    def test_afflicted_side_effects(self):
        _, side_effects = apply_condition_damage("wounded", 1)
        assert side_effects["stress_floor"] == 800
        assert side_effects["trigger_resolve_check"] is True

    def test_captured_side_effects(self):
        _, side_effects = apply_condition_damage("afflicted", 1)
        assert side_effects["removed_from_combat"] is True

    def test_side_effects_are_independent_copies(self):
        """Side effects dicts must be independent — modifying one shouldn't affect others."""
        _, effects_a = apply_condition_damage("operational", 1)
        _, effects_b = apply_condition_damage("operational", 1)
        effects_a["extra_key"] = "modified"
        assert "extra_key" not in effects_b


# ── get_condition_severity ─────────────────────────────────────────────────


class TestGetConditionSeverity:
    @pytest.mark.parametrize(
        ("condition", "expected"),
        [
            ("operational", 0),
            ("stressed", 1),
            ("wounded", 2),
            ("afflicted", 3),
            ("captured", 4),
        ],
    )
    def test_all_conditions(self, condition, expected):
        assert get_condition_severity(condition) == expected

    def test_unknown_condition_returns_zero(self):
        assert get_condition_severity("nonexistent") == 0


# ── can_act ────────────────────────────────────────────────────────────────


class TestCanAct:
    @pytest.mark.parametrize(
        "condition",
        ["operational", "stressed", "wounded", "afflicted"],
    )
    def test_can_act_conditions(self, condition):
        assert can_act(condition) is True

    def test_captured_cannot_act(self):
        assert can_act("captured") is False


# ── condition_display ──────────────────────────────────────────────────────


class TestConditionDisplay:
    @pytest.mark.parametrize(
        ("condition", "expected"),
        [
            ("operational", "healthy"),
            ("stressed", "damaged"),
            ("wounded", "critical"),
            ("afflicted", "near-defeat"),
            ("captured", "defeated"),
        ],
    )
    def test_display_mapping(self, condition, expected):
        assert condition_display(condition) == expected

    def test_unknown_condition_display(self):
        assert condition_display("nonexistent") == "unknown"


# ── Data integrity ─────────────────────────────────────────────────────────


class TestDataIntegrity:
    """Verify the constant tables are complete and consistent."""

    def test_all_conditions_have_severity(self):
        expected = {"operational", "stressed", "wounded", "afflicted", "captured"}
        assert set(CONDITION_SEVERITY.keys()) == expected

    def test_transition_table_covers_all_pairs(self):
        """Every non-captured condition × {1, 2} must have a transition."""
        non_captured = ["operational", "stressed", "wounded", "afflicted"]
        for condition in non_captured:
            for steps in (1, 2):
                assert (condition, steps) in CONDITION_TRANSITIONS, (
                    f"Missing transition for ({condition}, {steps})"
                )

    def test_transition_targets_are_valid_conditions(self):
        valid = set(CONDITION_SEVERITY.keys())
        for target in CONDITION_TRANSITIONS.values():
            assert target in valid, f"Invalid transition target: {target}"

    def test_side_effects_keys_are_valid(self):
        valid_keys = {"stress_delta", "check_penalty", "stress_floor", "trigger_resolve_check", "removed_from_combat"}
        for condition, effects in TRANSITION_SIDE_EFFECTS.items():
            for key in effects:
                assert key in valid_keys, f"Unexpected side effect key '{key}' for {condition}"
