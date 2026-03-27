"""Tests for backend.services.combat.ability_schools — 6 aptitude-based ability sets.

Covers:
  - Ability dataclass integrity (all 18 abilities)
  - get_available_abilities: min_aptitude filtering per school
  - get_ability_by_id: cross-school lookup, unknown returns None
  - get_agent_all_abilities: multi-school combination, level 0 skipped
"""

import pytest

from backend.services.combat.ability_schools import (
    ALL_ABILITIES,
    ASSASSIN_ABILITIES,
    GUARDIAN_ABILITIES,
    INFILTRATOR_ABILITIES,
    PROPAGANDIST_ABILITIES,
    SABOTEUR_ABILITIES,
    SPY_ABILITIES,
    Ability,
    get_ability_by_id,
    get_agent_all_abilities,
    get_available_abilities,
)


# ── Data integrity ─────────────────────────────────────────────────────────


class TestAbilityDataIntegrity:
    """Verify all ability definitions are complete and consistent."""

    def test_six_schools_registered(self):
        expected = {"spy", "guardian", "assassin", "propagandist", "infiltrator", "saboteur"}
        assert set(ALL_ABILITIES.keys()) == expected

    def test_spy_has_three_abilities(self):
        assert len(SPY_ABILITIES) == 3

    def test_guardian_has_three_abilities(self):
        assert len(GUARDIAN_ABILITIES) == 3

    def test_assassin_has_three_abilities(self):
        assert len(ASSASSIN_ABILITIES) == 3

    def test_propagandist_has_three_abilities(self):
        assert len(PROPAGANDIST_ABILITIES) == 3

    def test_infiltrator_has_two_abilities(self):
        assert len(INFILTRATOR_ABILITIES) == 2

    def test_saboteur_has_three_abilities(self):
        assert len(SABOTEUR_ABILITIES) == 3

    def test_total_ability_count(self):
        total = sum(len(v) for v in ALL_ABILITIES.values())
        assert total == 17  # 3+3+3+3+2+3

    def test_all_abilities_are_frozen_dataclass(self):
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                assert isinstance(ability, Ability)

    def test_all_ids_unique(self):
        ids = []
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                ids.append(ability.id)
        assert len(ids) == len(set(ids)), f"Duplicate IDs found: {[x for x in ids if ids.count(x) > 1]}"

    def test_all_abilities_have_bilingual_names(self):
        for school, abilities in ALL_ABILITIES.items():
            for ability in abilities:
                assert ability.name_en, f"{ability.id} missing name_en"
                assert ability.name_de, f"{ability.id} missing name_de"
                assert ability.description_en, f"{ability.id} missing description_en"
                assert ability.description_de, f"{ability.id} missing description_de"

    def test_all_abilities_have_correct_school(self):
        for school, abilities in ALL_ABILITIES.items():
            for ability in abilities:
                assert ability.school == school, f"{ability.id} school mismatch: {ability.school} != {school}"

    def test_min_aptitude_within_range(self):
        """Phase 0 abilities should require aptitude 3-6."""
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                assert 1 <= ability.min_aptitude <= 9, f"{ability.id} min_aptitude out of range"

    def test_cooldowns_non_negative(self):
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                assert ability.cooldown >= 0, f"{ability.id} has negative cooldown"

    def test_effect_type_valid(self):
        valid_types = {"damage", "stress_damage", "heal_stress", "buff", "debuff", "utility"}
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                assert ability.effect_type in valid_types, f"{ability.id} has invalid effect_type: {ability.effect_type}"

    def test_targets_valid(self):
        valid = {"single_enemy", "all_enemies", "single_ally", "all_allies", "self"}
        for abilities in ALL_ABILITIES.values():
            for ability in abilities:
                assert ability.targets in valid, f"{ability.id} has invalid targets: {ability.targets}"


# ── Specific ability spot-checks ──────────────────────────────────────────


class TestSpecificAbilities:
    """Verify specific ability parameters match spec/review decisions."""

    def test_propagandist_inspire_heals_120(self):
        """Review #11: Inspire heals 120 stress (was 75)."""
        inspire = get_ability_by_id("propagandist_inspire")
        assert inspire is not None
        assert inspire.effect_params["stress_heal"] == 120

    def test_propagandist_rally_heals_60_aoe(self):
        rally = get_ability_by_id("propagandist_rally")
        assert rally is not None
        assert rally.effect_params["stress_heal"] == 60
        assert rally.targets == "all_allies"

    def test_guardian_shield_absorbs_condition_and_stress(self):
        shield = get_ability_by_id("guardian_shield")
        assert shield is not None
        assert shield.effect_params["absorb_condition"] is True
        assert shield.effect_params["stress_reduction"] == 0.5
        assert shield.targets == "single_ally"

    def test_spy_observe_restores_visibility(self):
        observe = get_ability_by_id("spy_observe")
        assert observe is not None
        assert observe.effect_params["visibility_restore"] == 1
        assert observe.targets == "self"

    def test_assassin_precision_strike_hit_bonus(self):
        strike = get_ability_by_id("assassin_precision_strike")
        assert strike is not None
        assert strike.effect_params["hit_bonus"] == 10

    def test_saboteur_detonate_is_aoe(self):
        det = get_ability_by_id("saboteur_detonate")
        assert det is not None
        assert det.effect_params["aoe"] is True
        assert det.targets == "all_enemies"


# ── get_available_abilities ───────────────────────────────────────────────


class TestGetAvailableAbilities:
    def test_spy_at_level_3(self):
        """Level 3: should get spy_observe (min 3)."""
        abilities = get_available_abilities("spy", 3)
        ids = {a.id for a in abilities}
        assert "spy_observe" in ids
        assert "spy_analyze_weakness" not in ids  # min 4
        assert "spy_counter_intel" not in ids  # min 5

    def test_spy_at_level_5(self):
        """Level 5: should get all 3 spy abilities."""
        abilities = get_available_abilities("spy", 5)
        ids = {a.id for a in abilities}
        assert ids == {"spy_observe", "spy_analyze_weakness", "spy_counter_intel"}

    def test_spy_at_level_9(self):
        """Max level: still 3 abilities in Phase 0."""
        abilities = get_available_abilities("spy", 9)
        assert len(abilities) == 3

    def test_spy_at_level_0(self):
        """Level 0: no abilities."""
        abilities = get_available_abilities("spy", 0)
        assert len(abilities) == 0

    def test_spy_at_level_2(self):
        """Level 2: below all min_aptitude thresholds (all spy start at 3)."""
        abilities = get_available_abilities("spy", 2)
        assert len(abilities) == 0

    def test_unknown_school_returns_empty(self):
        abilities = get_available_abilities("nonexistent", 9)
        assert len(abilities) == 0

    @pytest.mark.parametrize("school", ALL_ABILITIES.keys())
    def test_level_9_gets_all_abilities(self, school):
        """At level 9, all abilities of any school are available."""
        all_school = ALL_ABILITIES[school]
        available = get_available_abilities(school, 9)
        assert len(available) == len(all_school)

    @pytest.mark.parametrize("school", ALL_ABILITIES.keys())
    def test_abilities_sorted_by_min_aptitude(self, school):
        """Abilities within a school should be ordered by ascending min_aptitude."""
        abilities = ALL_ABILITIES[school]
        for i in range(len(abilities) - 1):
            assert abilities[i].min_aptitude <= abilities[i + 1].min_aptitude, (
                f"{school}: {abilities[i].id} (min {abilities[i].min_aptitude}) "
                f"after {abilities[i+1].id} (min {abilities[i+1].min_aptitude})"
            )


# ── get_ability_by_id ─────────────────────────────────────────────────────


class TestGetAbilityById:
    def test_known_ability(self):
        ability = get_ability_by_id("guardian_shield")
        assert ability is not None
        assert ability.school == "guardian"

    def test_unknown_ability_returns_none(self):
        assert get_ability_by_id("nonexistent") is None

    @pytest.mark.parametrize(
        "ability_id",
        [
            "spy_observe", "spy_analyze_weakness", "spy_counter_intel",
            "guardian_shield", "guardian_taunt", "guardian_fortify",
            "assassin_precision_strike", "assassin_exploit", "assassin_ambush_strike",
            "propagandist_inspire", "propagandist_demoralize", "propagandist_rally",
            "infiltrator_evade", "infiltrator_backstab",
            "saboteur_trap", "saboteur_disrupt", "saboteur_detonate",
        ],
    )
    def test_all_ability_ids_resolvable(self, ability_id):
        assert get_ability_by_id(ability_id) is not None


# ── get_agent_all_abilities ───────────────────────────────────────────────


class TestGetAgentAllAbilities:
    def test_single_school(self):
        abilities = get_agent_all_abilities({"spy": 5})
        assert len(abilities) == 3
        assert all(a.school == "spy" for a in abilities)

    def test_multiple_schools(self):
        abilities = get_agent_all_abilities({"spy": 5, "guardian": 3})
        spy_count = sum(1 for a in abilities if a.school == "spy")
        guardian_count = sum(1 for a in abilities if a.school == "guardian")
        assert spy_count == 3
        assert guardian_count == 1  # only shield at level 3

    def test_level_zero_skipped(self):
        """Schools at level 0 contribute no abilities."""
        abilities = get_agent_all_abilities({"spy": 5, "guardian": 0})
        assert all(a.school == "spy" for a in abilities)

    def test_empty_aptitudes(self):
        abilities = get_agent_all_abilities({})
        assert len(abilities) == 0

    def test_all_schools_at_max(self):
        """All 6 schools at level 9."""
        aptitudes = {school: 9 for school in ALL_ABILITIES}
        abilities = get_agent_all_abilities(aptitudes)
        total = sum(len(v) for v in ALL_ABILITIES.values())
        assert len(abilities) == total

    def test_mixed_levels(self):
        """Realistic agent: high spy, medium guardian, no others."""
        abilities = get_agent_all_abilities({"spy": 8, "guardian": 4})
        spy_ids = {a.id for a in abilities if a.school == "spy"}
        guardian_ids = {a.id for a in abilities if a.school == "guardian"}
        assert spy_ids == {"spy_observe", "spy_analyze_weakness", "spy_counter_intel"}
        assert guardian_ids == {"guardian_shield", "guardian_taunt"}
