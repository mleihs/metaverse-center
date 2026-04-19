"""Per-content-type row builders: PackLoadResult → list[dict[column, SqlValue]].

Each builder knows exactly which Pydantic fields map to which DB columns and
how to serialize optional / JSONB / array values. The dispatch table in
`generate_migration.emit_rows_for` picks the builder by TableSpec identity.

Ordering matters for deterministic output: every builder iterates
`sorted(dict.keys())` for archetype loops (Python dict order is insertion-
preserving in ≥3.7, but pack load order is directory-walk-dependent; sorting
makes the generated SQL stable across filesystems and CI runners).

`sort_order` semantics:
  - Archetype-scoped tables (encounters, banter, loot, ...) reset per
    archetype. The legacy generator did this implicitly via `enumerate`.
  - `combat_abilities` uses a global running index across all schools
    (matches the legacy `overall_idx` behaviour).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from backend.models.resonance_dungeon import (
    EncounterChoice,
    EncounterTemplate,
    EnemyTemplate,
    LootItem,
)
from backend.services.content_packs.schemas import TIER_FIELD_FOR_ARCHETYPE
from backend.services.content_packs.sql_primitives import (
    BoolLiteral,
    DollarQuoted,
    JsonbLiteral,
    Numeric,
    SqlValue,
    TextArray,
    optional_jsonb,
    optional_numeric,
    optional_text,
)

if TYPE_CHECKING:
    from backend.services.content_packs.loader import PackLoadResult


# ── Banter ───────────────────────────────────────────────────────────────


def build_banter_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.banter):
        tier_field = TIER_FIELD_FOR_ARCHETYPE.get(archetype)
        for idx, raw in enumerate(result.banter[archetype]):
            # banter is stored as dict (matches runtime cache shape); the
            # Pydantic BanterItem validation gate ran during load. YAML has
            # no tuple concept, so personality_filter values are already
            # list/bool — no further normalization needed.
            # dict.get(key, default) only returns `default` when the key is
            # missing; an explicit `None` passes through. Coerce to 0 to
            # match the DB column (INTEGER NOT NULL DEFAULT 0).
            archetype_tier = (raw.get(tier_field) or 0) if tier_field else 0
            rows.append({
                "id": DollarQuoted(raw["id"]),
                "archetype": DollarQuoted(archetype),
                "trigger": DollarQuoted(raw["trigger"]),
                "personality_filter": JsonbLiteral(raw.get("personality_filter") or {}),
                "text_en": DollarQuoted(raw["text_en"]),
                "text_de": DollarQuoted(raw["text_de"]),
                "decay_tier": optional_numeric(raw.get("decay_tier")),
                "attachment_tier": optional_numeric(raw.get("attachment_tier")),
                "archetype_tier": Numeric(archetype_tier),
                "sort_order": Numeric(idx),
            })
    return rows


# ── Enemy Templates ──────────────────────────────────────────────────────


def build_enemy_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.enemies):
        for idx, (_enemy_id, tmpl) in enumerate(result.enemies[archetype].items()):
            rows.append(_enemy_row(archetype, tmpl, idx))
    return rows


def _enemy_row(archetype: str, tmpl: EnemyTemplate, idx: int) -> dict[str, SqlValue]:
    return {
        "id": DollarQuoted(tmpl.id),
        "archetype": DollarQuoted(archetype),
        "name_en": DollarQuoted(tmpl.name_en),
        "name_de": DollarQuoted(tmpl.name_de),
        "condition_threshold": Numeric(tmpl.condition_threshold),
        "stress_resistance": Numeric(tmpl.stress_resistance),
        "threat_level": DollarQuoted(tmpl.threat_level),
        "attack_aptitude": DollarQuoted(tmpl.attack_aptitude),
        "attack_power": Numeric(tmpl.attack_power),
        "stress_attack_power": Numeric(tmpl.stress_attack_power),
        "telegraphed_intent": BoolLiteral(tmpl.telegraphed_intent),
        "evasion": Numeric(tmpl.evasion),
        "resistances": TextArray(list(tmpl.resistances)),
        "vulnerabilities": TextArray(list(tmpl.vulnerabilities)),
        "action_weights": JsonbLiteral(dict(tmpl.action_weights)),
        "special_abilities": TextArray(list(tmpl.special_abilities)),
        "description_en": DollarQuoted(tmpl.description_en),
        "description_de": DollarQuoted(tmpl.description_de),
        "ambient_text_en": TextArray(list(tmpl.ambient_text_en)),
        "ambient_text_de": TextArray(list(tmpl.ambient_text_de)),
        "sort_order": Numeric(idx),
    }


# ── Spawn Configs ────────────────────────────────────────────────────────


def build_spawn_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    # Spawn entries land from the loader already-dict-normalized
    # (loader._ingest_spawns calls `e.model_dump()`). No sort_order column in
    # dungeon_spawn_configs, so the outer enumerate is dropped.
    for archetype in sorted(result.spawns):
        for spawn_id, entries in result.spawns[archetype].items():
            rows.append({
                "id": DollarQuoted(spawn_id),
                "archetype": DollarQuoted(archetype),
                "entries": JsonbLiteral(list(entries)),
            })
    return rows


# ── Encounter Templates ──────────────────────────────────────────────────


def build_encounter_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.encounters):
        for idx, enc in enumerate(result.encounters[archetype]):
            rows.append(_encounter_row(archetype, enc, idx))
    return rows


def _encounter_row(archetype: str, enc: EncounterTemplate, idx: int) -> dict[str, SqlValue]:
    return {
        "id": DollarQuoted(enc.id),
        "archetype": DollarQuoted(archetype),
        "room_type": DollarQuoted(enc.room_type),
        "min_depth": Numeric(enc.min_depth),
        "max_depth": Numeric(enc.max_depth),
        "min_difficulty": Numeric(enc.min_difficulty),
        "requires_aptitude": optional_jsonb(enc.requires_aptitude),
        "description_en": DollarQuoted(enc.description_en),
        "description_de": DollarQuoted(enc.description_de),
        "combat_encounter_id": optional_text(enc.combat_encounter_id),
        "is_ambush": BoolLiteral(enc.is_ambush),
        "ambush_stress": Numeric(enc.ambush_stress),
        "sort_order": Numeric(idx),
    }


# ── Encounter Choices ────────────────────────────────────────────────────


def build_choice_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.encounters):
        for enc in result.encounters[archetype]:
            for cidx, choice in enumerate(enc.choices):
                rows.append(_choice_row(enc.id, choice, cidx))
    return rows


def _choice_row(encounter_id: str, choice: EncounterChoice, idx: int) -> dict[str, SqlValue]:
    return {
        "id": DollarQuoted(choice.id),
        "encounter_id": DollarQuoted(encounter_id),
        "label_en": DollarQuoted(choice.label_en),
        "label_de": DollarQuoted(choice.label_de),
        "requires_aptitude": optional_jsonb(choice.requires_aptitude),
        "requires_profession": optional_text(choice.requires_profession),
        "check_aptitude": optional_text(choice.check_aptitude),
        "check_difficulty": Numeric(choice.check_difficulty),
        "success_effects": JsonbLiteral(dict(choice.success_effects)),
        "partial_effects": JsonbLiteral(dict(choice.partial_effects)),
        "fail_effects": JsonbLiteral(dict(choice.fail_effects)),
        "success_narrative_en": DollarQuoted(choice.success_narrative_en),
        "success_narrative_de": DollarQuoted(choice.success_narrative_de),
        "partial_narrative_en": DollarQuoted(choice.partial_narrative_en),
        "partial_narrative_de": DollarQuoted(choice.partial_narrative_de),
        "fail_narrative_en": DollarQuoted(choice.fail_narrative_en),
        "fail_narrative_de": DollarQuoted(choice.fail_narrative_de),
        "sort_order": Numeric(idx),
    }


# ── Loot Items ───────────────────────────────────────────────────────────


def build_loot_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.loot):
        # emit by tier, then by in-tier index — matches legacy generator ordering
        for tier in sorted(result.loot[archetype]):
            for idx, item in enumerate(result.loot[archetype][tier]):
                rows.append(_loot_row(archetype, tier, item, idx))
    return rows


def _loot_row(archetype: str, tier: int, item: LootItem, idx: int) -> dict[str, SqlValue]:
    return {
        "id": DollarQuoted(item.id),
        "archetype": DollarQuoted(archetype),
        "tier": Numeric(tier),
        "name_en": DollarQuoted(item.name_en),
        "name_de": DollarQuoted(item.name_de),
        "effect_type": DollarQuoted(item.effect_type),
        "effect_params": JsonbLiteral(dict(item.effect_params)),
        "description_en": DollarQuoted(item.description_en),
        "description_de": DollarQuoted(item.description_de),
        "drop_weight": Numeric(item.drop_weight),
        "sort_order": Numeric(idx),
    }


# ── Anchor Objects ───────────────────────────────────────────────────────


def build_anchor_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.anchors):
        for idx, obj in enumerate(result.anchors[archetype]):
            rows.append(_anchor_row(archetype, obj, idx))
    return rows


def _anchor_row(archetype: str, obj: dict, idx: int) -> dict[str, SqlValue]:
    # Loader stores anchors as plain dicts after model_dump; phases dict
    # already carries dict-form entries too, so no nested conversion needed.
    return {
        "id": DollarQuoted(obj["id"]),
        "archetype": DollarQuoted(archetype),
        "phases": JsonbLiteral(obj["phases"]),
        "sort_order": Numeric(idx),
    }


# ── Entrance Texts ───────────────────────────────────────────────────────


def build_entrance_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.entrance_texts):
        for idx, entry in enumerate(result.entrance_texts[archetype]):
            rows.append({
                "archetype": DollarQuoted(archetype),
                "text_en": DollarQuoted(entry["text_en"]),
                "text_de": DollarQuoted(entry["text_de"]),
                "sort_order": Numeric(idx),
            })
    return rows


# ── Barometer Texts ──────────────────────────────────────────────────────


def build_barometer_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    for archetype in sorted(result.barometer_texts):
        for entry in result.barometer_texts[archetype]:
            rows.append({
                "archetype": DollarQuoted(archetype),
                "tier": Numeric(entry["tier"]),
                "text_en": DollarQuoted(entry["text_en"]),
                "text_de": DollarQuoted(entry["text_de"]),
            })
    return rows


# ── Combat Abilities ─────────────────────────────────────────────────────


def build_ability_rows(result: PackLoadResult) -> list[dict[str, SqlValue]]:
    rows: list[dict[str, SqlValue]] = []
    global_idx = 0
    for school in sorted(result.abilities):
        for ability in result.abilities[school]:
            rows.append(_ability_row(ability, global_idx))
            global_idx += 1
    return rows


def _ability_row(ability, idx: int) -> dict[str, SqlValue]:  # noqa: ANN001
    """Accepts either the Pydantic `AbilityItem` or the runtime `Ability`
    dataclass — both share the attribute surface we need. Duck-typed to
    avoid a runtime import cycle and because the row fields are identical.
    """
    params = dict(ability.effect_params) if ability.effect_params else {}
    return {
        "id": DollarQuoted(ability.id),
        "school": DollarQuoted(ability.school),
        "name_en": DollarQuoted(ability.name_en),
        "name_de": DollarQuoted(ability.name_de),
        "description_en": DollarQuoted(ability.description_en),
        "description_de": DollarQuoted(ability.description_de),
        "min_aptitude": Numeric(ability.min_aptitude),
        "cooldown": Numeric(ability.cooldown),
        "effect_type": DollarQuoted(ability.effect_type),
        "effect_params": JsonbLiteral(params),
        "is_ultimate": BoolLiteral(ability.is_ultimate),
        "targets": DollarQuoted(ability.targets),
        "sort_order": Numeric(idx),
    }


__all__ = [
    "build_ability_rows",
    "build_anchor_rows",
    "build_banter_rows",
    "build_barometer_rows",
    "build_choice_rows",
    "build_encounter_rows",
    "build_enemy_rows",
    "build_entrance_rows",
    "build_loot_rows",
    "build_spawn_rows",
]
