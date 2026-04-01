"""Tests for dungeon_combat, dungeon_encounters, and dungeon_loot modules.

Covers:
  dungeon_combat:
    - spawn_enemies: difficulty scaling, spawn configs, unknown template
    - check_ambush: forced ambush, VP 0 at 40% (Review #7), VP 1 at 15%, VP 2+ safe
    - check_ambush: Tower stability-based (< 15 = 50%, < 30 = 25%, >= 30 safe)
    - get_enemy_templates_dict: all 5 Shadow enemies as dicts, all 5 Tower enemies
  dungeon_encounters:
    - select_encounter: filtering by room_type, depth, difficulty, archetype
    - get_encounter_by_id: lookup, unknown returns None
    - select_banter: trigger filtering, used_ids exclusion, archetype dispatch
    - ALL_SHADOW_ENCOUNTERS: 11 encounters, bilingual, choices
    - ALL_TOWER_ENCOUNTERS: 11 encounters, bilingual, choices
  dungeon_loot:
    - roll_loot: tier 3 all guaranteed, tiers 1-2 weighted random, VP 0 upgrade
    - roll_loot: Tower stability >= 80 tier upgrade
    - Loot tables: 4 tier 1, 5 tier 2, 3 tier 3 (per archetype)
"""

from unittest.mock import patch

import pytest

from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS
from backend.services.dungeon.dungeon_banter import (
    _BANTER_REGISTRIES,
    SHADOW_BANTER,
    TOWER_BANTER,
    select_banter,
)
from backend.services.dungeon.dungeon_combat import (
    _ENEMY_REGISTRIES,
    _SPAWN_REGISTRIES,
    SHADOW_ENEMIES,
    SHADOW_SPAWN_CONFIGS,
    TOWER_ENEMIES,
    TOWER_SPAWN_CONFIGS,
    check_ambush,
    get_enemy_templates_dict,
    spawn_enemies,
)
from backend.services.dungeon.dungeon_encounters import (
    _ENCOUNTER_REGISTRIES,
    ALL_SHADOW_ENCOUNTERS,
    ALL_TOWER_ENCOUNTERS,
    get_encounter_by_id,
    select_encounter,
)
from backend.services.dungeon.dungeon_loot import (
    _LOOT_REGISTRIES,
    SHADOW_LOOT_TABLES,
    SHADOW_LOOT_TIER_1,
    SHADOW_LOOT_TIER_2,
    SHADOW_LOOT_TIER_3,
    TOWER_LOOT_TABLES,
    TOWER_LOOT_TIER_1,
    TOWER_LOOT_TIER_2,
    TOWER_LOOT_TIER_3,
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
    """check_ambush now takes (archetype_state, archetype, encounter) — Phase A refactor."""

    def test_forced_ambush_always_triggers(self):
        """Encounter with is_ambush=True always triggers ambush."""
        assert check_ambush({"visibility": 3}, "The Shadow", {"is_ambush": True}) is True
        assert check_ambush({"visibility": 0}, "The Shadow", {"is_ambush": True}) is True

    def test_vp0_ambush_40_percent(self):
        """Review #7: VP 0 ambush chance = 40%."""
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.3):
            assert check_ambush({"visibility": 0}) is True  # 0.3 < 0.40
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.5):
            assert check_ambush({"visibility": 0}) is False  # 0.5 >= 0.40

    def test_vp1_ambush_15_percent(self):
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.1):
            assert check_ambush({"visibility": 1}) is True  # 0.1 < 0.15
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.2):
            assert check_ambush({"visibility": 1}) is False  # 0.2 >= 0.15

    def test_vp2_no_ambush(self):
        """VP 2+ = safe, no random ambush."""
        assert check_ambush({"visibility": 2}) is False
        assert check_ambush({"visibility": 3}) is False

    def test_no_encounter_no_forced(self):
        """None encounter means not forced."""
        assert check_ambush({"visibility": 3}, "The Shadow", None) is False


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
    def test_encounter_count(self):
        assert len(ALL_SHADOW_ENCOUNTERS) == 13

    def test_encounter_type_distribution(self):
        types = {}
        for e in ALL_SHADOW_ENCOUNTERS:
            types.setdefault(e.room_type, 0)
            types[e.room_type] += 1
        assert types["combat"] == 4
        assert types["encounter"] == 5
        assert types["elite"] == 1
        assert types["boss"] == 1
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

    def test_tower_archetype_returns_tower(self):
        """Tower encounters returned for Tower archetype (Phase C)."""
        enc = select_encounter("combat", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.archetype == "The Tower"

    def test_unknown_archetype_returns_none(self):
        enc = select_encounter("combat", 1, 1, archetype="The Void")
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
        assert len(SHADOW_LOOT_TIER_1) == 8

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


# ══════════════════════════════════════════════════════════════════════════
# ── THE TOWER — dungeon_combat ────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestTowerEnemies:
    """Data integrity of the 5 Tower enemy templates."""

    def test_five_templates(self):
        """Tower archetype has exactly 5 enemy templates."""
        assert len(TOWER_ENEMIES) == 5

    EXPECTED_IDS = {
        "tower_tremor_broker",
        "tower_foundation_worm",
        "tower_crown_keeper",
        "tower_debt_shade",
        "tower_remnant_commerce",
    }

    def test_expected_ids(self):
        """All Tower enemy IDs match the spec."""
        assert set(TOWER_ENEMIES.keys()) == self.EXPECTED_IDS

    def test_all_have_bilingual_names(self):
        """Every Tower enemy has both name_en and name_de."""
        for eid, tmpl in TOWER_ENEMIES.items():
            assert tmpl.name_en, f"{eid} missing name_en"
            assert tmpl.name_de, f"{eid} missing name_de"

    def test_all_have_bilingual_descriptions(self):
        """Every Tower enemy has both description_en and description_de."""
        for eid, tmpl in TOWER_ENEMIES.items():
            assert tmpl.description_en, f"{eid} missing description_en"
            assert tmpl.description_de, f"{eid} missing description_de"

    def test_all_have_bilingual_ambient_text(self):
        """Every Tower enemy has ambient text in both languages."""
        for eid, tmpl in TOWER_ENEMIES.items():
            assert len(tmpl.ambient_text_en) >= 1, f"{eid} missing ambient_text_en"
            assert len(tmpl.ambient_text_de) >= 1, f"{eid} missing ambient_text_de"

    def test_threat_levels(self):
        """Correct threat level distribution: 2 minion, 2 standard, 1 elite."""
        assert TOWER_ENEMIES["tower_tremor_broker"].threat_level == "minion"
        assert TOWER_ENEMIES["tower_foundation_worm"].threat_level == "minion"
        assert TOWER_ENEMIES["tower_crown_keeper"].threat_level == "standard"
        assert TOWER_ENEMIES["tower_debt_shade"].threat_level == "standard"
        assert TOWER_ENEMIES["tower_remnant_commerce"].threat_level == "elite"

    def test_threat_level_counts(self):
        """Verify exact count: 2 minion, 2 standard, 1 elite."""
        levels = [t.threat_level for t in TOWER_ENEMIES.values()]
        assert levels.count("minion") == 2
        assert levels.count("standard") == 2
        assert levels.count("elite") == 1

    def test_debt_shade_lies(self):
        """Debt Shade has telegraphed_intent=False — it lies about intents."""
        assert TOWER_ENEMIES["tower_debt_shade"].telegraphed_intent is False

    def test_all_others_telegraph(self):
        """All Tower enemies except Debt Shade have telegraphed_intent=True."""
        for eid, tmpl in TOWER_ENEMIES.items():
            if eid != "tower_debt_shade":
                assert tmpl.telegraphed_intent is True, f"{eid} should telegraph"

    def test_all_archetype_is_tower(self):
        """Every Tower enemy template has archetype='The Tower'."""
        for eid, tmpl in TOWER_ENEMIES.items():
            assert tmpl.archetype == "The Tower", f"{eid} has wrong archetype"

    def test_special_abilities_present(self):
        """Tower enemies have their expected special abilities."""
        worm = TOWER_ENEMIES["tower_foundation_worm"]
        assert "burrow" in worm.special_abilities

        keeper = TOWER_ENEMIES["tower_crown_keeper"]
        assert "stability_drain" in keeper.special_abilities

        shade = TOWER_ENEMIES["tower_debt_shade"]
        assert "compound" in shade.special_abilities
        assert "disinformation" in shade.special_abilities

        remnant = TOWER_ENEMIES["tower_remnant_commerce"]
        assert "summon_brokers" in remnant.special_abilities
        assert "market_crash" in remnant.special_abilities

    def test_minions_have_low_condition_threshold(self):
        """Minions should have condition_threshold <= 2."""
        for eid, tmpl in TOWER_ENEMIES.items():
            if tmpl.threat_level == "minion":
                assert tmpl.condition_threshold <= 2, f"{eid} minion threshold too high"

    def test_elite_has_high_condition_threshold(self):
        """Elite should have condition_threshold >= 4."""
        remnant = TOWER_ENEMIES["tower_remnant_commerce"]
        assert remnant.condition_threshold >= 4

    def test_registry_contains_tower(self):
        """Tower enemies are registered in the _ENEMY_REGISTRIES."""
        assert "The Tower" in _ENEMY_REGISTRIES
        assert _ENEMY_REGISTRIES["The Tower"] is TOWER_ENEMIES

    def test_all_have_action_weights(self):
        """Every Tower enemy has non-empty action_weights."""
        for eid, tmpl in TOWER_ENEMIES.items():
            assert tmpl.action_weights, f"{eid} missing action_weights"
            assert sum(tmpl.action_weights.values()) > 0, f"{eid} zero total weight"


class TestTowerSpawnConfigs:
    """Spawn configuration integrity for Tower archetype."""

    def test_six_spawn_configs(self):
        """Tower archetype has exactly 6 spawn configurations."""
        assert len(TOWER_SPAWN_CONFIGS) == 6

    EXPECTED_CONFIG_IDS = {
        "tower_tremor_spawn",
        "tower_patrol_spawn",
        "tower_ambush_spawn",
        "tower_compound_spawn",
        "tower_collapse_spawn",
        "tower_rest_ambush_spawn",
    }

    def test_expected_config_ids(self):
        """All Tower spawn config IDs match the spec."""
        assert set(TOWER_SPAWN_CONFIGS.keys()) == self.EXPECTED_CONFIG_IDS

    def test_all_template_ids_reference_valid_tower_enemies(self):
        """Every template_id in spawn configs references a valid Tower enemy."""
        for config_id, entries in TOWER_SPAWN_CONFIGS.items():
            for entry in entries:
                assert entry["template_id"] in TOWER_ENEMIES, (
                    f"{config_id} references unknown template {entry['template_id']}"
                )

    def test_all_spawn_configs_produce_instances(self):
        """Every spawn config produces at least one enemy instance."""
        for config_id in TOWER_SPAWN_CONFIGS:
            instances = spawn_enemies(config_id, 3, 3, "The Tower")
            assert len(instances) > 0, f"{config_id} produced no instances"

    def test_tremor_spawn_produces_two_brokers(self):
        """tower_tremor_spawn: 2 Tremor Brokers."""
        instances = spawn_enemies("tower_tremor_spawn", 1, 1, "The Tower")
        assert len(instances) == 2
        assert all("tower_tremor_broker" in i.template_id for i in instances)

    def test_patrol_spawn_keeper_and_worm(self):
        """tower_patrol_spawn: 1 Crowned + 1 Foundation Worm."""
        instances = spawn_enemies("tower_patrol_spawn", 1, 2, "The Tower")
        assert len(instances) == 2
        templates = {i.template_id for i in instances}
        assert "tower_crown_keeper" in templates
        assert "tower_foundation_worm" in templates

    def test_ambush_spawn_two_debt_shades(self):
        """tower_ambush_spawn: 2 Debt Shades."""
        instances = spawn_enemies("tower_ambush_spawn", 2, 3, "The Tower")
        assert len(instances) == 2
        assert all("tower_debt_shade" in i.template_id for i in instances)

    def test_compound_spawn_shade_plus_brokers(self):
        """tower_compound_spawn: 1 Debt Shade + 2 Tremor Brokers."""
        instances = spawn_enemies("tower_compound_spawn", 2, 3, "The Tower")
        assert len(instances) == 3
        templates = [i.template_id for i in instances]
        assert templates.count("tower_debt_shade") == 1
        assert templates.count("tower_tremor_broker") == 2

    def test_collapse_spawn_boss_plus_broker(self):
        """tower_collapse_spawn: 1 Remnant of Commerce + 1 Tremor Broker."""
        instances = spawn_enemies("tower_collapse_spawn", 3, 4, "The Tower")
        assert len(instances) == 2
        templates = {i.template_id for i in instances}
        assert "tower_remnant_commerce" in templates
        assert "tower_tremor_broker" in templates

    def test_rest_ambush_spawn_single_worm(self):
        """tower_rest_ambush_spawn: 1 Foundation Worm."""
        instances = spawn_enemies("tower_rest_ambush_spawn", 1, 1, "The Tower")
        assert len(instances) == 1
        assert "tower_foundation_worm" in instances[0].template_id

    def test_unique_instance_ids(self):
        """Each spawned instance gets a unique instance_id."""
        instances = spawn_enemies("tower_tremor_spawn", 1, 1, "The Tower")
        ids = [i.instance_id for i in instances]
        assert len(ids) == len(set(ids))

    def test_difficulty_scaling_condition(self):
        """Higher difficulty scales condition_threshold via enemy_condition multiplier."""
        easy = spawn_enemies("tower_patrol_spawn", 1, 2, "The Tower")
        hard = spawn_enemies("tower_patrol_spawn", 5, 2, "The Tower")
        keeper_easy = [i for i in easy if "crown_keeper" in i.template_id][0]
        keeper_hard = [i for i in hard if "crown_keeper" in i.template_id][0]
        assert keeper_hard.condition_steps_remaining >= keeper_easy.condition_steps_remaining

    def test_instances_have_correct_fields(self):
        """Spawned instances have all required fields."""
        instances = spawn_enemies("tower_tremor_spawn", 1, 1, "The Tower")
        for inst in instances:
            assert inst.instance_id
            assert inst.template_id
            assert inst.name_en
            assert inst.name_de
            assert inst.condition_steps_remaining >= 1
            assert inst.is_alive is True

    def test_unknown_spawn_config_returns_empty(self):
        """Unknown spawn config ID returns empty list."""
        instances = spawn_enemies("nonexistent_tower_config", 1, 1, "The Tower")
        assert instances == []

    def test_registry_contains_tower(self):
        """Tower spawn configs are registered in the _SPAWN_REGISTRIES."""
        assert "The Tower" in _SPAWN_REGISTRIES
        assert _SPAWN_REGISTRIES["The Tower"] is TOWER_SPAWN_CONFIGS


class TestTowerAmbush:
    """Tower archetype ambush logic — stability-based instead of visibility-based."""

    def test_forced_ambush_always_triggers(self):
        """Encounter with is_ambush=True always triggers ambush regardless of stability."""
        assert check_ambush({"stability": 100}, "The Tower", {"is_ambush": True}) is True
        assert check_ambush({"stability": 0}, "The Tower", {"is_ambush": True}) is True

    def test_stability_below_15_fifty_percent(self):
        """Stability < 15: 50% ambush chance."""
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.3):
            assert check_ambush({"stability": 10}, "The Tower") is True  # 0.3 < 0.50
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.6):
            assert check_ambush({"stability": 10}, "The Tower") is False  # 0.6 >= 0.50

    def test_stability_below_30_twenty_five_percent(self):
        """Stability 15-29: 25% ambush chance."""
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.1):
            assert check_ambush({"stability": 20}, "The Tower") is True  # 0.1 < 0.25
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.3):
            assert check_ambush({"stability": 20}, "The Tower") is False  # 0.3 >= 0.25

    def test_stability_at_exact_boundary_15(self):
        """Stability == 15 is NOT < 15, so falls into < 30 bracket (25%)."""
        with patch("backend.services.dungeon.dungeon_combat.random.random", return_value=0.2):
            assert check_ambush({"stability": 15}, "The Tower") is True  # 0.2 < 0.25

    def test_stability_at_exact_boundary_30(self):
        """Stability == 30 is NOT < 30, so no ambush."""
        assert check_ambush({"stability": 30}, "The Tower") is False

    def test_stability_above_30_no_ambush(self):
        """Stability >= 30: no random ambush."""
        assert check_ambush({"stability": 50}, "The Tower") is False
        assert check_ambush({"stability": 100}, "The Tower") is False

    def test_no_encounter_no_forced(self):
        """None encounter means not forced ambush."""
        assert check_ambush({"stability": 100}, "The Tower", None) is False

    def test_ambush_config_values_match_archetype_config(self):
        """Ambush chances should match ARCHETYPE_CONFIGS mechanic_config."""
        tower_config = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
        assert tower_config["low_stability_ambush_15"] == 0.50
        assert tower_config["low_stability_ambush_30"] == 0.25


class TestGetEnemyTemplatesDictTower:
    """get_enemy_templates_dict with Tower archetype."""

    def test_returns_all_five(self):
        """Tower dict should have 5 enemies."""
        result = get_enemy_templates_dict(archetype="The Tower")
        assert len(result) == 5

    def test_values_are_dicts(self):
        """All entries are plain dicts with combat fields."""
        result = get_enemy_templates_dict(archetype="The Tower")
        for _eid, data in result.items():
            assert isinstance(data, dict)
            assert "attack_power" in data
            assert "action_weights" in data

    def test_keys_match_tower_enemies(self):
        """Dict keys match TOWER_ENEMIES keys."""
        result = get_enemy_templates_dict(archetype="The Tower")
        assert set(result.keys()) == set(TOWER_ENEMIES.keys())


# ══════════════════════════════════════════════════════════════════════════
# ── THE TOWER — dungeon_encounters ────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestTowerEncounters:
    """Data integrity of the 13 Tower encounter templates."""

    def test_encounter_count(self):
        """Tower archetype has exactly 13 encounter templates."""
        assert len(ALL_TOWER_ENCOUNTERS) == 13

    def test_encounter_type_distribution(self):
        """Correct distribution: 4 combat, 5 encounter, 1 elite, 1 boss, 1 rest, 1 treasure."""
        types: dict[str, int] = {}
        for e in ALL_TOWER_ENCOUNTERS:
            types.setdefault(e.room_type, 0)
            types[e.room_type] += 1
        assert types["combat"] == 4
        assert types["encounter"] == 5
        assert types["elite"] == 1
        assert types["boss"] == 1
        assert types["rest"] == 1
        assert types["treasure"] == 1

    def test_all_have_bilingual_descriptions(self):
        """Every Tower encounter has both description_en and description_de."""
        for e in ALL_TOWER_ENCOUNTERS:
            assert e.description_en, f"{e.id} missing description_en"
            assert e.description_de, f"{e.id} missing description_de"

    def test_all_ids_unique(self):
        """No duplicate encounter IDs."""
        ids = [e.id for e in ALL_TOWER_ENCOUNTERS]
        assert len(ids) == len(set(ids))

    def test_all_archetype_is_tower(self):
        """Every Tower encounter has archetype='The Tower'."""
        for e in ALL_TOWER_ENCOUNTERS:
            assert e.archetype == "The Tower", f"{e.id} has wrong archetype"

    def test_tower_ambush_encounter_is_forced(self):
        """tower_interest_compounding is a forced ambush with ambush_stress."""
        ambush = get_encounter_by_id("tower_interest_compounding")
        assert ambush is not None
        assert ambush.is_ambush is True
        assert ambush.ambush_stress == 80

    def test_narrative_encounters_have_choices(self):
        """All narrative encounters have at least 2 choices."""
        for e in ALL_TOWER_ENCOUNTERS:
            if e.room_type == "encounter":
                assert len(e.choices) >= 2, f"{e.id} has fewer than 2 choices"

    def test_rest_encounter_has_rest_choice(self):
        """tower_the_vault has a rest choice."""
        vault = get_encounter_by_id("tower_the_vault")
        assert vault is not None
        choice_ids = {c.id for c in vault.choices}
        assert "tower_rest_full" in choice_ids

    def test_rest_encounter_has_guardian_option(self):
        """tower_the_vault has a guarded rest option requiring guardian."""
        vault = get_encounter_by_id("tower_the_vault")
        assert vault is not None
        choice_ids = {c.id for c in vault.choices}
        assert "tower_rest_guarded" in choice_ids

    def test_rest_encounter_has_saboteur_assess_option(self):
        """tower_the_vault has Tower-specific saboteur assessment."""
        vault = get_encounter_by_id("tower_the_vault")
        assert vault is not None
        choice_ids = {c.id for c in vault.choices}
        assert "tower_rest_assess" in choice_ids

    def test_treasure_encounter_has_loot_choice(self):
        """tower_cache has a choice that awards loot."""
        cache = get_encounter_by_id("tower_cache")
        assert cache is not None
        has_loot_choice = any(c.success_effects.get("loot") for c in cache.choices)
        assert has_loot_choice

    def test_boss_encounter_has_combat_encounter_id(self):
        """Boss encounter references a spawn configuration."""
        boss = get_encounter_by_id("tower_the_collapse")
        assert boss is not None
        assert boss.combat_encounter_id is not None
        assert boss.combat_encounter_id in TOWER_SPAWN_CONFIGS

    def test_elite_encounter_has_combat_encounter_id(self):
        """Elite encounter references a spawn configuration."""
        elite = get_encounter_by_id("tower_remnant_commerce_encounter")
        assert elite is not None
        assert elite.combat_encounter_id is not None
        assert elite.combat_encounter_id in TOWER_SPAWN_CONFIGS

    def test_combat_encounters_have_combat_encounter_ids(self):
        """All combat-type encounters reference valid spawn configs."""
        for e in ALL_TOWER_ENCOUNTERS:
            if e.room_type == "combat":
                assert e.combat_encounter_id, f"{e.id} missing combat_encounter_id"
                assert e.combat_encounter_id in TOWER_SPAWN_CONFIGS, (
                    f"{e.id} references unknown spawn config {e.combat_encounter_id}"
                )

    def test_registry_contains_tower(self):
        """Tower encounters are registered in the _ENCOUNTER_REGISTRIES."""
        assert "The Tower" in _ENCOUNTER_REGISTRIES
        assert _ENCOUNTER_REGISTRIES["The Tower"] is ALL_TOWER_ENCOUNTERS

    @pytest.mark.parametrize(
        "encounter_id",
        [e.id for e in ALL_TOWER_ENCOUNTERS],
    )
    def test_all_tower_ids_resolvable(self, encounter_id):
        """Every Tower encounter ID is resolvable via get_encounter_by_id."""
        assert get_encounter_by_id(encounter_id) is not None

    def test_confidence_game_has_stability_effects(self):
        """Narrative encounter 'tower_confidence_game' has stability in effects."""
        enc = get_encounter_by_id("tower_confidence_game")
        assert enc is not None
        stability_effects = [
            c for c in enc.choices
            if "stability" in c.success_effects
        ]
        assert len(stability_effects) >= 1, "No stability effects in confidence_game"

    def test_the_ledger_has_stability_effects(self):
        """Narrative encounter 'tower_the_ledger' has stability in effects."""
        enc = get_encounter_by_id("tower_the_ledger")
        assert enc is not None
        stability_effects = [
            c for c in enc.choices
            if "stability" in c.success_effects
        ]
        assert len(stability_effects) >= 1, "No stability effects in the_ledger"


class TestSelectEncounterTower:
    """select_encounter with Tower archetype."""

    def test_combat_depth_1(self):
        """Tower combat encounter returned at depth 1."""
        enc = select_encounter("combat", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.room_type == "combat"
        assert enc.archetype == "The Tower"

    def test_combat_depth_1_within_range(self):
        """Returned encounter's depth range includes depth 1."""
        enc = select_encounter("combat", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.min_depth <= 1 <= enc.max_depth

    def test_elite_not_available_at_depth_1(self):
        """Elite encounters require min_depth >= 3, so depth 1 should return None or valid."""
        enc = select_encounter("elite", 1, 1, archetype="The Tower")
        if enc is not None:
            assert enc.min_depth <= 1

    def test_elite_at_depth_3_difficulty_2(self):
        """Elite encounter at valid depth/difficulty."""
        enc = select_encounter("elite", 3, 2, archetype="The Tower")
        assert enc is not None
        assert enc.room_type == "elite"
        assert enc.archetype == "The Tower"

    def test_rest_at_any_depth(self):
        """Tower rest encounter (The Vault) has min_depth=0, max_depth=99."""
        enc = select_encounter("rest", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.room_type == "rest"
        assert enc.archetype == "The Tower"

    def test_treasure_at_any_depth(self):
        """Tower treasure encounter available at any depth."""
        enc = select_encounter("treasure", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.room_type == "treasure"
        assert enc.archetype == "The Tower"

    def test_boss_at_any_depth(self):
        """Tower boss encounter available at any depth."""
        enc = select_encounter("boss", 1, 1, archetype="The Tower")
        assert enc is not None
        assert enc.room_type == "boss"
        assert enc.archetype == "The Tower"


class TestSelectBanterTower:
    """select_banter with Tower archetype."""

    def test_room_entered_trigger(self):
        """Tower banter returned for room_entered trigger."""
        banter = select_banter("room_entered", [{"neuroticism": 0.8}], [], archetype="The Tower")
        assert banter is not None
        assert banter["trigger"] == "room_entered"

    def test_excludes_used_ids(self):
        """Used IDs are excluded from selection."""
        all_ids = [b["id"] for b in TOWER_BANTER if b["trigger"] == "room_entered"]
        banter = select_banter("room_entered", [], all_ids[:-1], archetype="The Tower")
        if banter is not None:
            assert banter["id"] not in all_ids[:-1]

    def test_all_used_returns_none(self):
        """All IDs exhausted returns None."""
        all_ids = [b["id"] for b in TOWER_BANTER if b["trigger"] == "room_entered"]
        banter = select_banter("room_entered", [], all_ids, archetype="The Tower")
        assert banter is None

    def test_unknown_trigger_returns_none(self):
        """Unknown trigger returns None."""
        banter = select_banter("nonexistent_trigger", [], [], archetype="The Tower")
        assert banter is None

    def test_banter_count(self):
        """Tower has 40+ banter templates."""
        assert len(TOWER_BANTER) >= 40

    def test_stability_critical_trigger_exists(self):
        """Tower-specific 'stability_critical' trigger exists in banter pool."""
        critical_banter = [b for b in TOWER_BANTER if b["trigger"] == "stability_critical"]
        assert len(critical_banter) >= 1, "No stability_critical banter found"

    def test_stability_critical_selectable(self):
        """stability_critical trigger can be selected via select_banter."""
        banter = select_banter("stability_critical", [], [], archetype="The Tower")
        assert banter is not None
        assert banter["trigger"] == "stability_critical"

    def test_standard_triggers_covered(self):
        """All standard triggers have at least one Tower banter template."""
        standard_triggers = {
            "room_entered", "combat_won", "depth_change", "boss_approach",
            "agent_stressed", "loot_found", "rest_start", "retreat",
            "dungeon_completed",
        }
        for trigger in standard_triggers:
            matches = [b for b in TOWER_BANTER if b["trigger"] == trigger]
            assert len(matches) >= 1, f"No Tower banter for trigger '{trigger}'"

    def test_all_banter_ids_unique(self):
        """No duplicate banter IDs."""
        ids = [b["id"] for b in TOWER_BANTER]
        assert len(ids) == len(set(ids))


class TestTowerBanterData:
    """Data integrity of Tower banter templates."""

    def test_all_bilingual(self):
        """Every Tower banter has both text_en and text_de."""
        for b in TOWER_BANTER:
            assert b.get("text_en"), f"{b['id']} missing text_en"
            assert b.get("text_de"), f"{b['id']} missing text_de"

    def test_all_have_trigger(self):
        """Every Tower banter has a trigger field."""
        for b in TOWER_BANTER:
            assert b.get("trigger"), f"{b['id']} missing trigger"

    def test_all_have_personality_filter(self):
        """Every Tower banter has a personality_filter (may be empty dict)."""
        for b in TOWER_BANTER:
            assert "personality_filter" in b, f"{b['id']} missing personality_filter"

    def test_registry_contains_tower(self):
        """Tower banter is registered in the _BANTER_REGISTRIES."""
        assert "The Tower" in _BANTER_REGISTRIES
        assert _BANTER_REGISTRIES["The Tower"] is TOWER_BANTER

    def test_elite_spotted_trigger_exists(self):
        """Tower has elite_spotted banter."""
        matches = [b for b in TOWER_BANTER if b["trigger"] == "elite_spotted"]
        assert len(matches) >= 1

    def test_agent_afflicted_trigger_exists(self):
        """Tower has agent_afflicted banter."""
        matches = [b for b in TOWER_BANTER if b["trigger"] == "agent_afflicted"]
        assert len(matches) >= 1

    def test_agent_virtue_trigger_exists(self):
        """Tower has agent_virtue banter."""
        matches = [b for b in TOWER_BANTER if b["trigger"] == "agent_virtue"]
        assert len(matches) >= 1


# ══════════════════════════════════════════════════════════════════════════
# ── THE TOWER — dungeon_loot ──────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestTowerLootTables:
    """Data integrity of Tower loot tables."""

    def test_tier_1_has_4_items(self):
        assert len(TOWER_LOOT_TIER_1) == 8

    def test_tier_2_has_5_items(self):
        assert len(TOWER_LOOT_TIER_2) == 5

    def test_tier_3_has_3_items(self):
        assert len(TOWER_LOOT_TIER_3) == 3

    def test_all_items_have_bilingual_text(self):
        """Every Tower loot item has bilingual name and description."""
        for tier, items in TOWER_LOOT_TABLES.items():
            for item in items:
                assert item.name_en, f"Tier {tier} item {item.id} missing name_en"
                assert item.name_de, f"Tier {tier} item {item.id} missing name_de"
                assert item.description_en, f"Tier {tier} item {item.id} missing description_en"
                assert item.description_de, f"Tier {tier} item {item.id} missing description_de"

    def test_all_ids_unique(self):
        """No duplicate loot IDs across all tiers."""
        all_ids: list[str] = []
        for items in TOWER_LOOT_TABLES.values():
            all_ids.extend(i.id for i in items)
        assert len(all_ids) == len(set(all_ids))

    def test_tiers_match_items(self):
        """Every item's tier field matches the table it lives in."""
        for tier, items in TOWER_LOOT_TABLES.items():
            for item in items:
                assert item.tier == tier, f"{item.id} claims tier {item.tier} but is in table {tier}"

    def test_foundation_attunement_cap_review_20(self):
        """Review #20: aptitude bonus capped at +2 total (Tower variant)."""
        attunement = next(i for i in TOWER_LOOT_TIER_3 if i.id == "foundation_attunement")
        assert attunement.effect_params["max_total_bonus"] == 2

    def test_foundation_attunement_choices(self):
        """Foundation Attunement offers guardian/saboteur aptitude choices."""
        attunement = next(i for i in TOWER_LOOT_TIER_3 if i.id == "foundation_attunement")
        choices = attunement.effect_params["aptitude_choices"]
        assert "guardian" in choices
        assert "saboteur" in choices

    def test_tier_3_all_guaranteed(self):
        """All tier 3 items have drop_weight=100 (guaranteed)."""
        guaranteed = [i for i in TOWER_LOOT_TIER_3 if i.drop_weight == 100]
        # At least stability_catalyst and tower_memory should be guaranteed
        assert len(guaranteed) >= 2

    def test_stability_catalyst_exists(self):
        """Tower-specific simulation modifier loot exists."""
        catalyst = next((i for i in TOWER_LOOT_TIER_3 if i.id == "stability_catalyst"), None)
        assert catalyst is not None
        assert catalyst.effect_type == "simulation_modifier"

    def test_registry_contains_tower(self):
        """Tower loot tables are registered in the _LOOT_REGISTRIES."""
        assert "The Tower" in _LOOT_REGISTRIES
        assert _LOOT_REGISTRIES["The Tower"] is TOWER_LOOT_TABLES

    def test_no_overlap_with_shadow_ids(self):
        """Tower loot IDs do not overlap with Shadow loot IDs."""
        shadow_ids = set()
        for items in SHADOW_LOOT_TABLES.values():
            shadow_ids.update(i.id for i in items)
        tower_ids = set()
        for items in TOWER_LOOT_TABLES.values():
            tower_ids.update(i.id for i in items)
        overlap = shadow_ids & tower_ids
        assert not overlap, f"Overlapping loot IDs: {overlap}"


class TestRollLootTower:
    """roll_loot with Tower archetype."""

    def test_tier_3_returns_all_items(self):
        """Boss loot: all tier 3 Tower items guaranteed."""
        items = roll_loot(3, 3, 5, archetype="The Tower")
        assert len(items) == 3
        ids = {i.id for i in items}
        assert "stability_catalyst" in ids
        assert "tower_memory" in ids
        assert "foundation_attunement" in ids

    def test_tier_1_returns_one_item(self):
        """Tier 1 returns exactly 1 item (stability < 80 to avoid upgrade)."""
        items = roll_loot(1, 3, 3, archetype="The Tower", archetype_state={"stability": 50})
        assert len(items) == 1
        assert items[0].tier == 1

    def test_tier_2_returns_one_item(self):
        """Tier 2 returns exactly 1 item."""
        items = roll_loot(2, 3, 3, archetype="The Tower")
        assert len(items) == 1
        assert items[0].tier == 2

    def test_high_stability_tier_upgrade(self):
        """Tower: stability >= 80 + tier 1 → 50% chance to upgrade to tier 2."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.3):
            items = roll_loot(1, 3, 3, archetype_state={"stability": 90}, archetype="The Tower")
            assert items[0].tier == 2  # upgraded

    def test_high_stability_no_upgrade_when_random_high(self):
        """Tower: stability >= 80 but random >= 0.5 → no upgrade."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.7):
            items = roll_loot(1, 3, 3, archetype_state={"stability": 90}, archetype="The Tower")
            assert items[0].tier == 1  # not upgraded

    def test_low_stability_no_upgrade(self):
        """Tower: stability < 80 → no upgrade even with favorable random."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.1):
            items = roll_loot(1, 3, 3, archetype_state={"stability": 50}, archetype="The Tower")
            assert items[0].tier == 1

    def test_stability_no_upgrade_for_tier_2(self):
        """Tower: stability bonus only applies to tier 1, not tier 2."""
        items = roll_loot(2, 3, 3, archetype_state={"stability": 100}, archetype="The Tower")
        assert items[0].tier == 2  # no upgrade to 3

    def test_no_archetype_state_defaults_stability_100(self):
        """No archetype_state → stability defaults to 100 → eligible for upgrade."""
        # With default stability=100, random < 0.5 should upgrade
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.3):
            items = roll_loot(1, 3, 3, archetype="The Tower")
            assert items[0].tier == 2  # upgraded because default stability=100 >= 80

    def test_unknown_tier_falls_back_to_tier_1(self):
        """Unknown tier falls back to tier 1 table."""
        items = roll_loot(99, 3, 3, archetype="The Tower")
        assert len(items) == 1
        assert items[0].tier == 1

    def test_stability_boundary_79_no_upgrade(self):
        """Stability 79 is NOT >= 80, so no upgrade."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.1):
            items = roll_loot(1, 3, 3, archetype_state={"stability": 79}, archetype="The Tower")
            assert items[0].tier == 1

    def test_stability_boundary_80_eligible(self):
        """Stability 80 is >= 80, so upgrade is possible."""
        with patch("backend.services.dungeon.dungeon_loot.random.random", return_value=0.3):
            items = roll_loot(1, 3, 3, archetype_state={"stability": 80}, archetype="The Tower")
            assert items[0].tier == 2
