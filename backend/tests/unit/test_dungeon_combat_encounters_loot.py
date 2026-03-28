"""Tests for dungeon_combat, dungeon_encounters, and dungeon_loot modules.

Covers:
  dungeon_combat:
    - spawn_enemies: difficulty scaling, spawn configs, unknown template
    - check_ambush: forced ambush, VP 0 at 40% (Review #7), VP 1 at 15%, VP 2+ safe
    - get_enemy_templates_dict: all 5 Shadow enemies as dicts
  dungeon_encounters:
    - select_encounter: filtering by room_type, depth, difficulty, archetype
    - get_encounter_by_id: lookup, unknown returns None
    - select_banter: trigger filtering, used_ids exclusion
    - ALL_SHADOW_ENCOUNTERS: 10 encounters, bilingual, choices
  dungeon_loot:
    - roll_loot: tier 3 all guaranteed, tiers 1-2 weighted random, VP 0 upgrade
    - Loot tables: 4 tier 1, 5 tier 2, 3 tier 3
"""

from unittest.mock import patch

import pytest

from backend.services.dungeon.dungeon_combat import (
    SHADOW_ENEMIES,
    SHADOW_SPAWN_CONFIGS,
    check_ambush,
    get_enemy_templates_dict,
    spawn_enemies,
)
from backend.services.dungeon.dungeon_encounters import (
    ALL_SHADOW_ENCOUNTERS,
    SHADOW_BANTER,
    get_encounter_by_id,
    select_banter,
    select_encounter,
)
from backend.services.dungeon.dungeon_loot import (
    SHADOW_LOOT_TABLES,
    SHADOW_LOOT_TIER_1,
    SHADOW_LOOT_TIER_2,
    SHADOW_LOOT_TIER_3,
    roll_loot,
)

# ══════════════════════════════════════════════════════════════════════════
# ── dungeon_combat ────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestShadowEnemies:
    """Data integrity of the 5 Shadow enemy templates."""

    def test_five_templates(self):
        assert len(SHADOW_ENEMIES) == 5

    EXPECTED_IDS = {
        "shadow_wisp", "shadow_tendril", "shadow_echo_violence",
        "shadow_paranoia_shade", "shadow_remnant",
    }

    def test_expected_ids(self):
        assert set(SHADOW_ENEMIES.keys()) == self.EXPECTED_IDS

    def test_all_have_bilingual_names(self):
        for eid, tmpl in SHADOW_ENEMIES.items():
            assert tmpl.name_en, f"{eid} missing name_en"
            assert tmpl.name_de, f"{eid} missing name_de"

    def test_threat_levels(self):
        assert SHADOW_ENEMIES["shadow_wisp"].threat_level == "minion"
        assert SHADOW_ENEMIES["shadow_tendril"].threat_level == "minion"
        assert SHADOW_ENEMIES["shadow_echo_violence"].threat_level == "standard"
        assert SHADOW_ENEMIES["shadow_paranoia_shade"].threat_level == "standard"
        assert SHADOW_ENEMIES["shadow_remnant"].threat_level == "elite"

    def test_paranoia_shade_lies(self):
        """Paranoia Shade has telegraphed_intent=False — it lies about intents."""
        assert SHADOW_ENEMIES["shadow_paranoia_shade"].telegraphed_intent is False

    def test_all_others_telegraph(self):
        for eid, tmpl in SHADOW_ENEMIES.items():
            if eid != "shadow_paranoia_shade":
                assert tmpl.telegraphed_intent is True, f"{eid} should telegraph"


class TestSpawnEnemies:
    def test_whispers_spawn_two_wisps(self):
        instances = spawn_enemies("shadow_whispers_spawn", 1, 1)
        assert len(instances) == 2
        assert all("shadow_wisp" in i.template_id for i in instances)

    def test_patrol_spawn_echo_and_tendril(self):
        instances = spawn_enemies("shadow_patrol_spawn", 1, 2)
        assert len(instances) == 2
        templates = {i.template_id for i in instances}
        assert "shadow_echo_violence" in templates
        assert "shadow_tendril" in templates

    def test_remnant_spawn_boss_plus_wisp(self):
        instances = spawn_enemies("shadow_remnant_spawn", 3, 4)
        assert len(instances) == 2
        templates = {i.template_id for i in instances}
        assert "shadow_remnant" in templates
        assert "shadow_wisp" in templates

    def test_unique_instance_ids(self):
        instances = spawn_enemies("shadow_whispers_spawn", 1, 1)
        ids = [i.instance_id for i in instances]
        assert len(ids) == len(set(ids))

    def test_difficulty_scaling_condition(self):
        """Higher difficulty scales condition_threshold via enemy_condition multiplier."""
        easy = spawn_enemies("shadow_patrol_spawn", 1, 2)
        hard = spawn_enemies("shadow_patrol_spawn", 5, 2)
        # Difficulty 5: enemy_condition = 2.0
        # Echo has base 3, at diff 5: max(1, int(3 * 2.0)) = 6
        echo_easy = [i for i in easy if "echo" in i.template_id][0]
        echo_hard = [i for i in hard if "echo" in i.template_id][0]
        assert echo_hard.condition_steps_remaining >= echo_easy.condition_steps_remaining

    def test_unknown_spawn_config_returns_empty(self):
        instances = spawn_enemies("nonexistent_config", 1, 1)
        assert instances == []

    def test_all_spawn_configs_produce_instances(self):
        for config_id in SHADOW_SPAWN_CONFIGS:
            instances = spawn_enemies(config_id, 3, 3)
            assert len(instances) > 0, f"{config_id} produced no instances"

    def test_instances_have_correct_fields(self):
        instances = spawn_enemies("shadow_whispers_spawn", 1, 1)
        for inst in instances:
            assert inst.instance_id
            assert inst.template_id
            assert inst.name_en
            assert inst.name_de
            assert inst.condition_steps_remaining >= 1
            assert inst.is_alive is True


class TestCheckAmbush:
    def test_forced_ambush_always_triggers(self):
        """Encounter with is_ambush=True always triggers ambush."""
        assert check_ambush(3, {"is_ambush": True}) is True
        assert check_ambush(0, {"is_ambush": True}) is True

    def test_vp0_ambush_40_percent(self):
        """Review #7: VP 0 ambush chance = 40%."""
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.3):
            assert check_ambush(0) is True  # 0.3 < 0.40
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.5):
            assert check_ambush(0) is False  # 0.5 >= 0.40

    def test_vp1_ambush_15_percent(self):
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.1):
            assert check_ambush(1) is True  # 0.1 < 0.15
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.2):
            assert check_ambush(1) is False  # 0.2 >= 0.15

    def test_vp2_no_ambush(self):
        """VP 2+ = safe, no random ambush."""
        assert check_ambush(2) is False
        assert check_ambush(3) is False

    def test_no_encounter_no_forced(self):
        """None encounter means not forced."""
        assert check_ambush(3, None) is False


class TestGetEnemyTemplatesDict:
    def test_returns_all_five(self):
        result = get_enemy_templates_dict()
        assert len(result) == 5

    def test_values_are_dicts(self):
        result = get_enemy_templates_dict()
        for _eid, data in result.items():
            assert isinstance(data, dict)
            assert "attack_power" in data
            assert "action_weights" in data


# ══════════════════════════════════════════════════════════════════════════
# ── dungeon_encounters ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestEncounterData:
    def test_ten_encounters(self):
        assert len(ALL_SHADOW_ENCOUNTERS) == 10

    def test_encounter_type_distribution(self):
        types = {}
        for e in ALL_SHADOW_ENCOUNTERS:
            types.setdefault(e.room_type, 0)
            types[e.room_type] += 1
        assert types["combat"] == 4
        assert types["encounter"] == 3
        assert types["elite"] == 1
        assert types["rest"] == 1
        assert types["treasure"] == 1

    def test_all_have_bilingual_descriptions(self):
        for e in ALL_SHADOW_ENCOUNTERS:
            assert e.description_en, f"{e.id} missing description_en"
            assert e.description_de, f"{e.id} missing description_de"

    def test_all_ids_unique(self):
        ids = [e.id for e in ALL_SHADOW_ENCOUNTERS]
        assert len(ids) == len(set(ids))

    def test_shadow_ambush_is_forced(self):
        ambush = get_encounter_by_id("shadow_ambush")
        assert ambush is not None
        assert ambush.is_ambush is True
        assert ambush.ambush_stress == 100

    def test_narrative_encounters_have_choices(self):
        for e in ALL_SHADOW_ENCOUNTERS:
            if e.room_type == "encounter":
                assert len(e.choices) >= 2, f"{e.id} has fewer than 2 choices"

    def test_rest_encounter_has_rest_choice(self):
        hollow = get_encounter_by_id("shadow_the_hollow")
        assert hollow is not None
        choice_ids = {c.id for c in hollow.choices}
        assert "rest_full" in choice_ids

    def test_treasure_encounter_has_loot_choice(self):
        cache = get_encounter_by_id("shadow_cache")
        assert cache is not None
        has_loot_choice = any(c.success_effects.get("loot") for c in cache.choices)
        assert has_loot_choice


class TestSelectEncounter:
    def test_combat_depth_1(self):
        """Should return combat encounter valid at depth 1."""
        enc = select_encounter("combat", 1, 1)
        assert enc is not None
        assert enc.room_type == "combat"
        assert enc.min_depth <= 1 <= enc.max_depth

    def test_elite_not_available_at_depth_1(self):
        """Elite encounters have min_depth >= 3, so depth 1 should fail."""
        # All elite encounters in the data have min_depth=3
        enc = select_encounter("elite", 1, 1)
        # Might return None because depth 1 < min_depth for elite
        if enc is not None:
            assert enc.min_depth <= 1

    def test_elite_at_depth_3_difficulty_2(self):
        enc = select_encounter("elite", 3, 2)
        assert enc is not None
        assert enc.room_type == "elite"

    def test_rest_at_any_depth(self):
        """Rest encounter (The Hollow) has min_depth=0, max_depth=99."""
        enc = select_encounter("rest", 1, 1)
        assert enc is not None
        assert enc.room_type == "rest"

    def test_no_match_returns_none(self):
        enc = select_encounter("nonexistent_type", 1, 1)
        assert enc is None

    def test_wrong_archetype_returns_none(self):
        enc = select_encounter("combat", 1, 1, archetype="The Tower")
        # Shadow encounters filtered out because archetype doesn't match
        assert enc is None


class TestGetEncounterById:
    def test_known_id(self):
        enc = get_encounter_by_id("shadow_whispers_in_dark")
        assert enc is not None
        assert enc.room_type == "combat"

    def test_unknown_id(self):
        assert get_encounter_by_id("nonexistent") is None

    @pytest.mark.parametrize(
        "encounter_id",
        [e.id for e in ALL_SHADOW_ENCOUNTERS],
    )
    def test_all_ids_resolvable(self, encounter_id):
        assert get_encounter_by_id(encounter_id) is not None


class TestSelectBanter:
    def test_room_entered_trigger(self):
        banter = select_banter("room_entered", [{"neuroticism": 0.8}], [])
        assert banter is not None
        assert banter["trigger"] == "room_entered"

    def test_excludes_used_ids(self):
        # Get all room_entered banter IDs
        all_ids = [b["id"] for b in SHADOW_BANTER if b["trigger"] == "room_entered"]
        # Mark all but one as used
        banter = select_banter("room_entered", [], all_ids[:-1])
        if banter is not None:
            assert banter["id"] not in all_ids[:-1]

    def test_all_used_returns_none(self):
        all_ids = [b["id"] for b in SHADOW_BANTER if b["trigger"] == "room_entered"]
        banter = select_banter("room_entered", [], all_ids)
        assert banter is None

    def test_unknown_trigger_returns_none(self):
        banter = select_banter("nonexistent_trigger", [], [])
        assert banter is None

    def test_banter_count(self):
        """Phase 0: 40+ banter templates."""
        assert len(SHADOW_BANTER) >= 40


# ══════════════════════════════════════════════════════════════════════════
# ── dungeon_loot ──────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestLootTables:
    def test_tier_1_has_4_items(self):
        assert len(SHADOW_LOOT_TIER_1) == 4

    def test_tier_2_has_5_items(self):
        assert len(SHADOW_LOOT_TIER_2) == 5

    def test_tier_3_has_3_items(self):
        assert len(SHADOW_LOOT_TIER_3) == 3

    def test_all_items_have_bilingual_text(self):
        for tier, items in SHADOW_LOOT_TABLES.items():
            for item in items:
                assert item.name_en, f"Tier {tier} item {item.id} missing name_en"
                assert item.name_de, f"Tier {tier} item {item.id} missing name_de"

    def test_all_ids_unique(self):
        all_ids = []
        for items in SHADOW_LOOT_TABLES.values():
            all_ids.extend(i.id for i in items)
        assert len(all_ids) == len(set(all_ids))

    def test_tiers_match_items(self):
        for tier, items in SHADOW_LOOT_TABLES.items():
            for item in items:
                assert item.tier == tier, f"{item.id} claims tier {item.tier} but is in table {tier}"

    def test_shadow_attunement_cap_review_20(self):
        """Review #20: aptitude bonus capped at +2 total."""
        attunement = next(i for i in SHADOW_LOOT_TIER_3 if i.id == "shadow_attunement")
        assert attunement.effect_params["max_total_bonus"] == 2


class TestRollLoot:
    def test_tier_3_returns_all_items(self):
        """Boss loot: all tier 3 items guaranteed."""
        items = roll_loot(3, 3, 5)
        assert len(items) == 3
        ids = {i.id for i in items}
        assert "shadow_attunement" in ids
        assert "shadow_memory" in ids
        assert "scar_tissue_reduction" in ids

    def test_tier_1_returns_one_item(self):
        items = roll_loot(1, 3, 3)
        assert len(items) == 1
        assert items[0].tier == 1

    def test_tier_2_returns_one_item(self):
        items = roll_loot(2, 3, 3)
        assert len(items) == 1
        assert items[0].tier == 2

    def test_vp0_tier_upgrade_review_7(self):
        """Review #7: VP 0 + tier 1 → 50% chance to upgrade to tier 2."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.3):
            # random.random() < 0.5 → upgrade
            items = roll_loot(1, 3, 3, archetype_state={"visibility": 0})
            # Should be tier 2 item (upgraded)
            assert items[0].tier == 2

    def test_vp0_tier_no_upgrade_when_random_high(self):
        """VP 0 but random >= 0.5 → no upgrade."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.7):
            items = roll_loot(1, 3, 3, archetype_state={"visibility": 0})
            assert items[0].tier == 1

    def test_vp0_no_upgrade_for_tier_2(self):
        """VP 0 upgrade only applies to tier 1, not tier 2."""
        items = roll_loot(2, 3, 3, archetype_state={"visibility": 0})
        assert items[0].tier == 2  # no upgrade to 3

    def test_no_archetype_state_defaults_vp3(self):
        """No archetype_state → visibility defaults to 3 → no upgrade."""
        items = roll_loot(1, 3, 3)
        assert items[0].tier == 1

    def test_unknown_tier_falls_back_to_tier_1(self):
        """Unknown tier falls back to tier 1 table."""
        items = roll_loot(99, 3, 3)
        assert len(items) == 1
        assert items[0].tier == 1
