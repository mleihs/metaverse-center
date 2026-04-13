"""Extract dungeon content from Python files → SQL seed file.

Reads all dungeon content registries, converts to INSERT statements,
and writes to scripts/021_dungeon_content.sql.

Usage:
    cd /path/to/velgarien-rebuild
    python -m scripts.extract_dungeon_content_to_sql

All text is dollar-quoted to avoid Unicode escaping issues.
Uses ON CONFLICT DO UPDATE for idempotent re-runs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ── Imports from dungeon content modules ──────────────────────────────────

from backend.services.dungeon.dungeon_banter import _BANTER_REGISTRIES
from backend.services.dungeon.dungeon_combat import (
    _ENEMY_REGISTRIES,
    _SPAWN_REGISTRIES,
)
from backend.services.dungeon.dungeon_encounters import _ENCOUNTER_REGISTRIES
from backend.services.dungeon.dungeon_loot import _LOOT_REGISTRIES
from backend.services.dungeon.dungeon_objektanker import (
    ANCHOR_OBJECTS,
    BAROMETER_TEXTS,
    ENTRANCE_TEXTS,
)
from backend.services.combat.ability_schools import ALL_ABILITIES


def _dq(text: str) -> str:
    """Dollar-quote a string for PostgreSQL (avoids all escaping issues)."""
    # Use a unique tag to avoid collision with content
    tag = "DQ"
    if f"${tag}$" in text:
        tag = "DQSEED"
    return f"${tag}${text}${tag}$"


def _json(obj: object) -> str:
    """Convert Python object to JSON string, handling tuples → arrays."""
    def convert(o):
        if isinstance(o, tuple):
            return list(o)
        if isinstance(o, set):
            return sorted(o)
        raise TypeError(f"Unserializable: {type(o)}")

    return json.dumps(obj, ensure_ascii=False, default=convert)


def _jsonb(obj: object) -> str:
    """Dollar-quoted JSON cast for PostgreSQL JSONB columns.

    Single-quote wrapping breaks when JSON values contain apostrophes
    (e.g. "body's needs"). Dollar-quoting avoids all escaping issues.
    """
    raw = _json(obj)
    tag = "JB"
    if f"${tag}$" in raw:
        tag = "JBSEED"
    return f"${tag}${raw}${tag}$::jsonb"


def _bool(val: bool) -> str:
    return "true" if val else "false"


# ══════════════════════════════════════════════════════════════════════════════


_TIER_FIELD_FOR_ARCHETYPE: dict[str, str] = {
    "The Entropy": "decay_tier",
    "The Devouring Mother": "attachment_tier",
    "The Prometheus": "insight_tier",
    "The Deluge": "water_tier",
    "The Awakening": "awareness_tier",
    "The Overthrow": "fracture_tier",
}


def generate_banter(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_banter."""
    count = 0
    seen_ids: set[str] = set()
    for archetype, banter_list in _BANTER_REGISTRIES.items():
        for idx, b in enumerate(banter_list):
            # Deduplicate IDs (sb_30/31/32 exist twice in Shadow Python data)
            banter_id = b["id"]
            if banter_id in seen_ids:
                banter_id = f"{banter_id}_dup{idx}"
            seen_ids.add(banter_id)

            # Convert personality_filter tuples to arrays
            pf = {}
            for k, v in b.get("personality_filter", {}).items():
                pf[k] = list(v) if isinstance(v, tuple) else v

            # Resolve archetype_tier from the archetype-specific field name
            tier_field = _TIER_FIELD_FOR_ARCHETYPE.get(archetype)
            archetype_tier = b.get(tier_field, 0) if tier_field else 0

            lines.append(
                f"INSERT INTO dungeon_banter "
                f"(id, archetype, trigger, personality_filter, text_en, text_de, "
                f"decay_tier, attachment_tier, archetype_tier, sort_order) VALUES ("
                f"{_dq(banter_id)}, {_dq(archetype)}, {_dq(b['trigger'])}, "
                f"{_jsonb(pf)}, "
                f"{_dq(b['text_en'])}, {_dq(b['text_de'])}, "
                f"{'NULL' if b.get('decay_tier') is None else b['decay_tier']}, "
                f"{'NULL' if b.get('attachment_tier') is None else b['attachment_tier']}, "
                f"{archetype_tier}, "
                f"{idx}"
                f") ON CONFLICT (id) DO UPDATE SET "
                f"archetype = EXCLUDED.archetype, trigger = EXCLUDED.trigger, "
                f"personality_filter = EXCLUDED.personality_filter, "
                f"text_en = EXCLUDED.text_en, text_de = EXCLUDED.text_de, "
                f"decay_tier = EXCLUDED.decay_tier, attachment_tier = EXCLUDED.attachment_tier, "
                f"archetype_tier = EXCLUDED.archetype_tier, "
                f"sort_order = EXCLUDED.sort_order;"
            )
            count += 1
    return count


def generate_enemy_templates(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_enemy_templates."""
    count = 0
    for archetype, enemies in _ENEMY_REGISTRIES.items():
        for idx, (eid, tmpl) in enumerate(enemies.items()):
            lines.append(
                f"INSERT INTO dungeon_enemy_templates "
                f"(id, archetype, name_en, name_de, condition_threshold, stress_resistance, "
                f"threat_level, attack_aptitude, attack_power, stress_attack_power, "
                f"telegraphed_intent, evasion, resistances, vulnerabilities, "
                f"action_weights, special_abilities, description_en, description_de, "
                f"ambient_text_en, ambient_text_de, sort_order) VALUES ("
                f"{_dq(tmpl.id)}, {_dq(archetype)}, "
                f"{_dq(tmpl.name_en)}, {_dq(tmpl.name_de)}, "
                f"{tmpl.condition_threshold}, {tmpl.stress_resistance}, "
                f"{_dq(tmpl.threat_level)}, {_dq(tmpl.attack_aptitude)}, "
                f"{tmpl.attack_power}, {tmpl.stress_attack_power}, "
                f"{_bool(tmpl.telegraphed_intent)}, {tmpl.evasion}, "
                f"ARRAY[{', '.join(_dq(r) for r in tmpl.resistances)}]::TEXT[], "
                f"ARRAY[{', '.join(_dq(v) for v in tmpl.vulnerabilities)}]::TEXT[], "
                f"{_jsonb(tmpl.action_weights)}, "
                f"ARRAY[{', '.join(_dq(a) for a in tmpl.special_abilities)}]::TEXT[], "
                f"{_dq(tmpl.description_en)}, {_dq(tmpl.description_de)}, "
                f"ARRAY[{', '.join(_dq(t) for t in tmpl.ambient_text_en)}]::TEXT[], "
                f"ARRAY[{', '.join(_dq(t) for t in tmpl.ambient_text_de)}]::TEXT[], "
                f"{idx}"
                f") ON CONFLICT (id) DO UPDATE SET "
                f"archetype = EXCLUDED.archetype, name_en = EXCLUDED.name_en, "
                f"name_de = EXCLUDED.name_de, condition_threshold = EXCLUDED.condition_threshold, "
                f"stress_resistance = EXCLUDED.stress_resistance, threat_level = EXCLUDED.threat_level, "
                f"attack_aptitude = EXCLUDED.attack_aptitude, attack_power = EXCLUDED.attack_power, "
                f"stress_attack_power = EXCLUDED.stress_attack_power, "
                f"telegraphed_intent = EXCLUDED.telegraphed_intent, evasion = EXCLUDED.evasion, "
                f"resistances = EXCLUDED.resistances, vulnerabilities = EXCLUDED.vulnerabilities, "
                f"action_weights = EXCLUDED.action_weights, special_abilities = EXCLUDED.special_abilities, "
                f"description_en = EXCLUDED.description_en, description_de = EXCLUDED.description_de, "
                f"ambient_text_en = EXCLUDED.ambient_text_en, ambient_text_de = EXCLUDED.ambient_text_de, "
                f"sort_order = EXCLUDED.sort_order;"
            )
            count += 1
    return count


def generate_spawn_configs(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_spawn_configs."""
    count = 0
    for archetype, configs in _SPAWN_REGISTRIES.items():
        for idx, (config_id, entries) in enumerate(configs.items()):
            lines.append(
                f"INSERT INTO dungeon_spawn_configs "
                f"(id, archetype, entries) VALUES ("
                f"{_dq(config_id)}, {_dq(archetype)}, "
                f"{_jsonb(entries)}"
                f") ON CONFLICT (id) DO UPDATE SET "
                f"archetype = EXCLUDED.archetype, entries = EXCLUDED.entries;"
            )
            count += 1
    return count


def generate_encounter_templates(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_encounter_templates."""
    count = 0
    for archetype, encounters in _ENCOUNTER_REGISTRIES.items():
        for idx, enc in enumerate(encounters):
            req_apt = f"{_jsonb(enc.requires_aptitude)}" if enc.requires_aptitude else "NULL"
            combat_id = f"{_dq(enc.combat_encounter_id)}" if enc.combat_encounter_id else "NULL"

            lines.append(
                f"INSERT INTO dungeon_encounter_templates "
                f"(id, archetype, room_type, min_depth, max_depth, min_difficulty, "
                f"requires_aptitude, description_en, description_de, "
                f"combat_encounter_id, is_ambush, ambush_stress, sort_order) VALUES ("
                f"{_dq(enc.id)}, {_dq(archetype)}, {_dq(enc.room_type)}, "
                f"{enc.min_depth}, {enc.max_depth}, {enc.min_difficulty}, "
                f"{req_apt}, "
                f"{_dq(enc.description_en)}, {_dq(enc.description_de)}, "
                f"{combat_id}, {_bool(enc.is_ambush)}, {enc.ambush_stress}, "
                f"{idx}"
                f") ON CONFLICT (id) DO UPDATE SET "
                f"archetype = EXCLUDED.archetype, room_type = EXCLUDED.room_type, "
                f"min_depth = EXCLUDED.min_depth, max_depth = EXCLUDED.max_depth, "
                f"min_difficulty = EXCLUDED.min_difficulty, requires_aptitude = EXCLUDED.requires_aptitude, "
                f"description_en = EXCLUDED.description_en, description_de = EXCLUDED.description_de, "
                f"combat_encounter_id = EXCLUDED.combat_encounter_id, is_ambush = EXCLUDED.is_ambush, "
                f"ambush_stress = EXCLUDED.ambush_stress, sort_order = EXCLUDED.sort_order;"
            )
            count += 1
    return count


def generate_encounter_choices(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_encounter_choices."""
    count = 0
    for _archetype, encounters in _ENCOUNTER_REGISTRIES.items():
        for enc in encounters:
            for cidx, choice in enumerate(enc.choices):
                req_apt = f"{_jsonb(choice.requires_aptitude)}" if choice.requires_aptitude else "NULL"
                req_prof = f"{_dq(choice.requires_profession)}" if choice.requires_profession else "NULL"
                check_apt = f"{_dq(choice.check_aptitude)}" if choice.check_aptitude else "NULL"

                lines.append(
                    f"INSERT INTO dungeon_encounter_choices "
                    f"(id, encounter_id, label_en, label_de, requires_aptitude, "
                    f"requires_profession, check_aptitude, check_difficulty, "
                    f"success_effects, partial_effects, fail_effects, "
                    f"success_narrative_en, success_narrative_de, "
                    f"partial_narrative_en, partial_narrative_de, "
                    f"fail_narrative_en, fail_narrative_de, sort_order) VALUES ("
                    f"{_dq(choice.id)}, {_dq(enc.id)}, "
                    f"{_dq(choice.label_en)}, {_dq(choice.label_de)}, "
                    f"{req_apt}, {req_prof}, {check_apt}, {choice.check_difficulty}, "
                    f"{_jsonb(choice.success_effects)}, "
                    f"{_jsonb(choice.partial_effects)}, "
                    f"{_jsonb(choice.fail_effects)}, "
                    f"{_dq(choice.success_narrative_en)}, {_dq(choice.success_narrative_de)}, "
                    f"{_dq(choice.partial_narrative_en)}, {_dq(choice.partial_narrative_de)}, "
                    f"{_dq(choice.fail_narrative_en)}, {_dq(choice.fail_narrative_de)}, "
                    f"{cidx}"
                    f") ON CONFLICT (encounter_id, id) DO UPDATE SET "
                    f"label_en = EXCLUDED.label_en, label_de = EXCLUDED.label_de, "
                    f"requires_aptitude = EXCLUDED.requires_aptitude, "
                    f"requires_profession = EXCLUDED.requires_profession, "
                    f"check_aptitude = EXCLUDED.check_aptitude, "
                    f"check_difficulty = EXCLUDED.check_difficulty, "
                    f"success_effects = EXCLUDED.success_effects, "
                    f"partial_effects = EXCLUDED.partial_effects, "
                    f"fail_effects = EXCLUDED.fail_effects, "
                    f"success_narrative_en = EXCLUDED.success_narrative_en, "
                    f"success_narrative_de = EXCLUDED.success_narrative_de, "
                    f"partial_narrative_en = EXCLUDED.partial_narrative_en, "
                    f"partial_narrative_de = EXCLUDED.partial_narrative_de, "
                    f"fail_narrative_en = EXCLUDED.fail_narrative_en, "
                    f"fail_narrative_de = EXCLUDED.fail_narrative_de, "
                    f"sort_order = EXCLUDED.sort_order;"
                )
                count += 1
    return count


def generate_loot_items(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_loot_items."""
    count = 0
    for archetype, tier_tables in _LOOT_REGISTRIES.items():
        for tier, items in tier_tables.items():
            for idx, item in enumerate(items):
                lines.append(
                    f"INSERT INTO dungeon_loot_items "
                    f"(id, archetype, tier, name_en, name_de, effect_type, "
                    f"effect_params, description_en, description_de, drop_weight, sort_order) VALUES ("
                    f"{_dq(item.id)}, {_dq(archetype)}, {tier}, "
                    f"{_dq(item.name_en)}, {_dq(item.name_de)}, "
                    f"{_dq(item.effect_type)}, "
                    f"{_jsonb(item.effect_params)}, "
                    f"{_dq(item.description_en)}, {_dq(item.description_de)}, "
                    f"{item.drop_weight}, {idx}"
                    f") ON CONFLICT (id) DO UPDATE SET "
                    f"archetype = EXCLUDED.archetype, tier = EXCLUDED.tier, "
                    f"name_en = EXCLUDED.name_en, name_de = EXCLUDED.name_de, "
                    f"effect_type = EXCLUDED.effect_type, effect_params = EXCLUDED.effect_params, "
                    f"description_en = EXCLUDED.description_en, description_de = EXCLUDED.description_de, "
                    f"drop_weight = EXCLUDED.drop_weight, sort_order = EXCLUDED.sort_order;"
                )
                count += 1
    return count


def generate_anchor_objects(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_anchor_objects."""
    count = 0
    for archetype, objects in ANCHOR_OBJECTS.items():
        for idx, obj in enumerate(objects):
            phases = obj.get("phases", {})
            lines.append(
                f"INSERT INTO dungeon_anchor_objects "
                f"(id, archetype, phases, sort_order) VALUES ("
                f"{_dq(obj['id'])}, {_dq(archetype)}, "
                f"{_jsonb(phases)}, {idx}"
                f") ON CONFLICT (archetype, id) DO UPDATE SET "
                f"phases = EXCLUDED.phases, sort_order = EXCLUDED.sort_order;"
            )
            count += 1
    return count


def generate_entrance_texts(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_entrance_texts."""
    count = 0
    for archetype, texts in ENTRANCE_TEXTS.items():
        for idx, entry in enumerate(texts):
            lines.append(
                f"INSERT INTO dungeon_entrance_texts "
                f"(archetype, text_en, text_de, sort_order) VALUES ("
                f"{_dq(archetype)}, "
                f"{_dq(entry['text_en'])}, {_dq(entry['text_de'])}, "
                f"{idx}"
                f") ON CONFLICT (archetype, sort_order) DO UPDATE SET "
                f"text_en = EXCLUDED.text_en, text_de = EXCLUDED.text_de;"
            )
            count += 1
    return count


def generate_barometer_texts(lines: list[str]) -> int:
    """Generate INSERT statements for dungeon_barometer_texts."""
    count = 0
    for archetype, tiers in BAROMETER_TEXTS.items():
        for entry in tiers:
            lines.append(
                f"INSERT INTO dungeon_barometer_texts "
                f"(archetype, tier, text_en, text_de) VALUES ("
                f"{_dq(archetype)}, {entry['tier']}, "
                f"{_dq(entry['text_en'])}, {_dq(entry['text_de'])}"
                f") ON CONFLICT (archetype, tier) DO UPDATE SET "
                f"text_en = EXCLUDED.text_en, text_de = EXCLUDED.text_de;"
            )
            count += 1
    return count


def generate_abilities(lines: list[str]) -> int:
    """Generate INSERT statements for combat_abilities."""
    count = 0
    overall_idx = 0
    for school, abilities in ALL_ABILITIES.items():
        for ability in abilities:
            # Convert frozen dataclass fields to JSON-safe dict
            params = dict(ability.effect_params) if ability.effect_params else {}

            lines.append(
                f"INSERT INTO combat_abilities "
                f"(id, school, name_en, name_de, description_en, description_de, "
                f"min_aptitude, cooldown, effect_type, effect_params, is_ultimate, "
                f"targets, sort_order) VALUES ("
                f"{_dq(ability.id)}, {_dq(ability.school)}, "
                f"{_dq(ability.name_en)}, {_dq(ability.name_de)}, "
                f"{_dq(ability.description_en)}, {_dq(ability.description_de)}, "
                f"{ability.min_aptitude}, {ability.cooldown}, "
                f"{_dq(ability.effect_type)}, "
                f"{_jsonb(params)}, "
                f"{_bool(ability.is_ultimate)}, "
                f"{_dq(ability.targets)}, {overall_idx}"
                f") ON CONFLICT (id) DO UPDATE SET "
                f"school = EXCLUDED.school, name_en = EXCLUDED.name_en, "
                f"name_de = EXCLUDED.name_de, description_en = EXCLUDED.description_en, "
                f"description_de = EXCLUDED.description_de, min_aptitude = EXCLUDED.min_aptitude, "
                f"cooldown = EXCLUDED.cooldown, effect_type = EXCLUDED.effect_type, "
                f"effect_params = EXCLUDED.effect_params, is_ultimate = EXCLUDED.is_ultimate, "
                f"targets = EXCLUDED.targets, sort_order = EXCLUDED.sort_order;"
            )
            count += 1
            overall_idx += 1
    return count


def main() -> None:
    lines: list[str] = [
        "-- ============================================================================",
        "-- Dungeon Content Seed Data",
        "-- Generated by scripts/extract_dungeon_content_to_sql.py",
        "-- DO NOT EDIT MANUALLY — re-run the script to regenerate.",
        "-- ============================================================================",
        "",
        "BEGIN;",
        "",
    ]

    # Generate in FK-safe order
    lines.append("-- ── Banter ──────────────────────────────────────────────────────────────")
    banter_count = generate_banter(lines)
    lines.append("")

    lines.append("-- ── Enemy Templates ─────────────────────────────────────────────────────")
    enemy_count = generate_enemy_templates(lines)
    lines.append("")

    lines.append("-- ── Spawn Configs ───────────────────────────────────────────────────────")
    spawn_count = generate_spawn_configs(lines)
    lines.append("")

    lines.append("-- ── Encounter Templates ─────────────────────────────────────────────────")
    encounter_count = generate_encounter_templates(lines)
    lines.append("")

    lines.append("-- ── Encounter Choices ───────────────────────────────────────────────────")
    choice_count = generate_encounter_choices(lines)
    lines.append("")

    lines.append("-- ── Loot Items ─────────────────────────────────────────────────────────")
    loot_count = generate_loot_items(lines)
    lines.append("")

    lines.append("-- ── Anchor Objects ──────────────────────────────────────────────────────")
    anchor_count = generate_anchor_objects(lines)
    lines.append("")

    lines.append("-- ── Entrance Texts ─────────────────────────────────────────────────────")
    entrance_count = generate_entrance_texts(lines)
    lines.append("")

    lines.append("-- ── Barometer Texts ────────────────────────────────────────────────────")
    barometer_count = generate_barometer_texts(lines)
    lines.append("")

    lines.append("-- ── Combat Abilities ──────────────────────────────────────────────────")
    ability_count = generate_abilities(lines)
    lines.append("")

    lines.append("COMMIT;")

    # Write output
    output_path = PROJECT_ROOT / "scripts" / "021_dungeon_content.sql"
    output_path.write_text("\n".join(lines), encoding="utf-8")

    # Summary
    total = (
        banter_count + enemy_count + spawn_count + encounter_count
        + choice_count + loot_count + anchor_count + entrance_count
        + barometer_count + ability_count
    )
    print(f"Generated {output_path.name}:")
    print(f"  Banter:      {banter_count}")
    print(f"  Enemies:     {enemy_count}")
    print(f"  Spawns:      {spawn_count}")
    print(f"  Encounters:  {encounter_count}")
    print(f"  Choices:     {choice_count}")
    print(f"  Loot:        {loot_count}")
    print(f"  Anchors:     {anchor_count}")
    print(f"  Entrance:    {entrance_count}")
    print(f"  Barometer:   {barometer_count}")
    print(f"  Abilities:   {ability_count}")
    print(f"  TOTAL:       {total}")


if __name__ == "__main__":
    main()
