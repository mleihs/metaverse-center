"""Tests for backend.services.dungeon.dungeon_archetypes — archetype configs & scaling.

Covers:
  - ARCHETYPE_CONFIGS: all 8 archetypes, Shadow mechanic config (Review #7)
  - ARCHETYPE_ROOM_DISTRIBUTIONS: sum to 100%, all room types present
  - DIFFICULTY_MULTIPLIERS: 5 levels, scaling consistency
  - get_depth_for_difficulty: lookup + fallback
"""

import pytest

from backend.services.dungeon.dungeon_archetypes import (
    ARCHETYPE_CONFIGS,
    ARCHETYPE_ROOM_DISTRIBUTIONS,
    DIFFICULTY_MULTIPLIERS,
    get_depth_for_difficulty,
)

# ── ARCHETYPE_CONFIGS ─────────────────────────────────────────────────────


class TestArchetypeConfigs:
    EXPECTED_ARCHETYPES = {
        "The Shadow", "The Tower", "The Devouring Mother", "The Deluge",
        "The Overthrow", "The Prometheus", "The Awakening", "The Entropy",
    }

    def test_eight_archetypes(self):
        assert len(ARCHETYPE_CONFIGS) == 8

    def test_all_expected_archetypes_present(self):
        assert set(ARCHETYPE_CONFIGS.keys()) == self.EXPECTED_ARCHETYPES

    def test_all_have_signature(self):
        for name, config in ARCHETYPE_CONFIGS.items():
            assert "signature" in config, f"{name} missing signature"
            assert isinstance(config["signature"], str)

    def test_all_have_title_bilingual(self):
        for name, config in ARCHETYPE_CONFIGS.items():
            assert "title_en" in config, f"{name} missing title_en"
            assert "title_de" in config, f"{name} missing title_de"

    def test_all_have_mechanic(self):
        for name, config in ARCHETYPE_CONFIGS.items():
            assert "mechanic" in config, f"{name} missing mechanic"

    # --- Shadow-specific (fully defined in Phase 0) ---

    def test_shadow_mechanic_is_visibility(self):
        shadow = ARCHETYPE_CONFIGS["The Shadow"]
        assert shadow["mechanic"] == "visibility"

    def test_shadow_mechanic_config_review_7(self):
        """Review #7: VP rebalanced values."""
        mc = ARCHETYPE_CONFIGS["The Shadow"]["mechanic_config"]
        assert mc["max_visibility"] == 3
        assert mc["start_visibility"] == 3
        assert mc["cost_per_rooms"] == 2  # lose 1 VP per 2 rooms (not per room)
        assert mc["restore_on_treasure"] == 1
        assert mc["restore_on_combat_win"] == 1
        assert mc["restore_on_spy_observe"] == 1
        assert mc["restore_on_rest"] == 1

    def test_shadow_blind_penalties_review_7(self):
        """Review #7: VP 0 penalties reduced."""
        mc = ARCHETYPE_CONFIGS["The Shadow"]["mechanic_config"]
        assert mc["blind_ambush_chance"] == 0.40  # was 0.60
        assert mc["blind_stress_multiplier"] == 1.25  # was 1.50
        assert mc["blind_loot_bonus"] == 0.50

    def test_shadow_has_aptitude_weights(self):
        shadow = ARCHETYPE_CONFIGS["The Shadow"]
        assert "aptitude_weights" in shadow
        assert shadow["aptitude_weights"]["spy"] == "critical"

    def test_shadow_has_atmosphere_text(self):
        shadow = ARCHETYPE_CONFIGS["The Shadow"]
        assert "atmosphere_enter_en" in shadow
        assert "atmosphere_enter_de" in shadow
        assert len(shadow["atmosphere_enter_en"]) > 50

    def test_shadow_signature_is_conflict_wave(self):
        assert ARCHETYPE_CONFIGS["The Shadow"]["signature"] == "conflict_wave"

    def test_all_signatures_unique(self):
        sigs = [c["signature"] for c in ARCHETYPE_CONFIGS.values()]
        assert len(sigs) == len(set(sigs)), f"Duplicate signatures: {sigs}"


# ── ARCHETYPE_ROOM_DISTRIBUTIONS ──────────────────────────────────────────


class TestRoomDistributions:
    def test_all_archetypes_have_distribution(self):
        for name in ARCHETYPE_CONFIGS:
            assert name in ARCHETYPE_ROOM_DISTRIBUTIONS, f"{name} missing room distribution"

    @pytest.mark.parametrize("archetype", ARCHETYPE_ROOM_DISTRIBUTIONS.keys())
    def test_weights_sum_to_100(self, archetype):
        total = sum(ARCHETYPE_ROOM_DISTRIBUTIONS[archetype].values())
        assert total == 100, f"{archetype} room weights sum to {total}, not 100"

    @pytest.mark.parametrize("archetype", ARCHETYPE_ROOM_DISTRIBUTIONS.keys())
    def test_required_room_types(self, archetype):
        """Every archetype must have combat, encounter, rest, and treasure."""
        dist = ARCHETYPE_ROOM_DISTRIBUTIONS[archetype]
        for required in ("combat", "encounter", "rest", "treasure"):
            assert required in dist and dist[required] > 0, f"{archetype} missing or zero {required}"

    def test_shadow_distribution_values(self):
        dist = ARCHETYPE_ROOM_DISTRIBUTIONS["The Shadow"]
        assert dist["combat"] == 40
        assert dist["encounter"] == 30
        assert dist["elite"] == 5
        assert dist["rest"] == 5
        assert dist["treasure"] == 15
        assert dist["exit"] == 5


# ── DIFFICULTY_MULTIPLIERS ────────────────────────────────────────────────


class TestDifficultyMultipliers:
    def test_five_levels(self):
        assert set(DIFFICULTY_MULTIPLIERS.keys()) == {1, 2, 3, 4, 5}

    def test_all_have_required_keys(self):
        required = {"enemy_power", "enemy_condition", "stress_mult", "loot_quality", "depth"}
        for level, mult in DIFFICULTY_MULTIPLIERS.items():
            assert set(mult.keys()) == required, f"Difficulty {level} keys mismatch"

    def test_enemy_power_increases(self):
        for i in range(1, 5):
            assert DIFFICULTY_MULTIPLIERS[i + 1]["enemy_power"] >= DIFFICULTY_MULTIPLIERS[i]["enemy_power"]

    def test_stress_mult_increases(self):
        for i in range(1, 5):
            assert DIFFICULTY_MULTIPLIERS[i + 1]["stress_mult"] >= DIFFICULTY_MULTIPLIERS[i]["stress_mult"]

    def test_depth_increases(self):
        for i in range(1, 5):
            assert DIFFICULTY_MULTIPLIERS[i + 1]["depth"] >= DIFFICULTY_MULTIPLIERS[i]["depth"]

    def test_loot_quality_increases(self):
        for i in range(1, 5):
            assert DIFFICULTY_MULTIPLIERS[i + 1]["loot_quality"] >= DIFFICULTY_MULTIPLIERS[i]["loot_quality"]

    def test_difficulty_1_baseline(self):
        d1 = DIFFICULTY_MULTIPLIERS[1]
        assert d1["enemy_power"] == 1.0
        assert d1["enemy_condition"] == 1.0
        assert d1["depth"] == 4

    def test_difficulty_5_peak(self):
        d5 = DIFFICULTY_MULTIPLIERS[5]
        assert d5["enemy_power"] == 1.75
        assert d5["depth"] == 7


# ── get_depth_for_difficulty ──────────────────────────────────────────────


class TestGetDepthForDifficulty:
    @pytest.mark.parametrize(
        ("difficulty", "expected_depth"),
        [(1, 4), (2, 5), (3, 5), (4, 6), (5, 7)],
    )
    def test_known_difficulties(self, difficulty, expected_depth):
        assert get_depth_for_difficulty(difficulty) == expected_depth

    def test_unknown_difficulty_falls_back_to_1(self):
        """Unknown difficulty defaults to difficulty 1 (depth 4)."""
        assert get_depth_for_difficulty(99) == 4

    def test_zero_difficulty_falls_back(self):
        assert get_depth_for_difficulty(0) == 4
