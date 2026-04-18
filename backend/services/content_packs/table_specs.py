"""Single source of truth for the 10 dungeon content DB tables.

Each `TableSpec` captures exactly what the generator and validator need:
  - `name`         — SQL table name
  - `columns`      — ordered tuple of INSERT column names
  - `conflict_on`  — ON CONFLICT target (PK or UNIQUE-constraint columns)

`conflict_on` is separate from the DB primary key because four of our
tables (entrance_texts, barometer_texts, anchor_objects, encounter_choices)
have either a SERIAL surrogate PK plus a business UNIQUE or a composite
natural PK. The generator's UPSERT should target the *business* key.

Legacy comparison: the old `scripts/extract_dungeon_content_to_sql.py`
hard-coded each column list three times (INSERT, VALUES, UPDATE SET) per
table — ~30 repetitions total. This single declaration replaces all of
them.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TableSpec:
    """Declarative description of one DB table for INSERT generation."""

    name: str
    columns: tuple[str, ...]
    conflict_on: tuple[str, ...]

    @property
    def insert_column_list(self) -> str:
        return ", ".join(self.columns)

    @property
    def conflict_target(self) -> str:
        return f"({', '.join(self.conflict_on)})"

    @property
    def update_set_clause(self) -> str:
        """`col = EXCLUDED.col` for every non-conflict column.

        Columns used as the ON CONFLICT target are immutable under UPSERT —
        changing them would break the conflict lookup — so they are excluded.
        """
        updatable = [c for c in self.columns if c not in self.conflict_on]
        return ", ".join(f"{c} = EXCLUDED.{c}" for c in updatable)


# ── The 10 specs (matches migration 170 schema) ───────────────────────────
#
# Column order matches the `INSERT INTO ... (...) VALUES (...)` clause in
# the legacy generator so diffs between old and new SQL output stay minimal
# during the cutover.


BANTER = TableSpec(
    name="dungeon_banter",
    columns=(
        "id",
        "archetype",
        "trigger",
        "personality_filter",
        "text_en",
        "text_de",
        "decay_tier",
        "attachment_tier",
        "archetype_tier",
        "sort_order",
    ),
    conflict_on=("id",),
)


ENEMY_TEMPLATES = TableSpec(
    name="dungeon_enemy_templates",
    columns=(
        "id",
        "archetype",
        "name_en",
        "name_de",
        "condition_threshold",
        "stress_resistance",
        "threat_level",
        "attack_aptitude",
        "attack_power",
        "stress_attack_power",
        "telegraphed_intent",
        "evasion",
        "resistances",
        "vulnerabilities",
        "action_weights",
        "special_abilities",
        "description_en",
        "description_de",
        "ambient_text_en",
        "ambient_text_de",
        "sort_order",
    ),
    conflict_on=("id",),
)


SPAWN_CONFIGS = TableSpec(
    name="dungeon_spawn_configs",
    columns=("id", "archetype", "entries"),
    conflict_on=("id",),
)


ENCOUNTER_TEMPLATES = TableSpec(
    name="dungeon_encounter_templates",
    columns=(
        "id",
        "archetype",
        "room_type",
        "min_depth",
        "max_depth",
        "min_difficulty",
        "requires_aptitude",
        "description_en",
        "description_de",
        "combat_encounter_id",
        "is_ambush",
        "ambush_stress",
        "sort_order",
    ),
    conflict_on=("id",),
)


ENCOUNTER_CHOICES = TableSpec(
    name="dungeon_encounter_choices",
    columns=(
        "id",
        "encounter_id",
        "label_en",
        "label_de",
        "requires_aptitude",
        "requires_profession",
        "check_aptitude",
        "check_difficulty",
        "success_effects",
        "partial_effects",
        "fail_effects",
        "success_narrative_en",
        "success_narrative_de",
        "partial_narrative_en",
        "partial_narrative_de",
        "fail_narrative_en",
        "fail_narrative_de",
        "sort_order",
    ),
    conflict_on=("encounter_id", "id"),
)


LOOT_ITEMS = TableSpec(
    name="dungeon_loot_items",
    columns=(
        "id",
        "archetype",
        "tier",
        "name_en",
        "name_de",
        "effect_type",
        "effect_params",
        "description_en",
        "description_de",
        "drop_weight",
        "sort_order",
    ),
    conflict_on=("id",),
)


ANCHOR_OBJECTS = TableSpec(
    name="dungeon_anchor_objects",
    columns=("id", "archetype", "phases", "sort_order"),
    conflict_on=("archetype", "id"),
)


ENTRANCE_TEXTS = TableSpec(
    name="dungeon_entrance_texts",
    # id is SERIAL — omitted from INSERT list; conflict on (archetype, sort_order) UNIQUE.
    columns=("archetype", "text_en", "text_de", "sort_order"),
    conflict_on=("archetype", "sort_order"),
)


BAROMETER_TEXTS = TableSpec(
    name="dungeon_barometer_texts",
    # id is SERIAL — omitted; conflict on (archetype, tier) UNIQUE.
    columns=("archetype", "tier", "text_en", "text_de"),
    conflict_on=("archetype", "tier"),
)


ABILITIES = TableSpec(
    name="combat_abilities",
    columns=(
        "id",
        "school",
        "name_en",
        "name_de",
        "description_en",
        "description_de",
        "min_aptitude",
        "cooldown",
        "effect_type",
        "effect_params",
        "is_ultimate",
        "targets",
        "sort_order",
    ),
    conflict_on=("id",),
)


# ── Emission order (FK-safe) ──────────────────────────────────────────────
#
# Referential dependencies (migration 170):
#   encounter_choices.encounter_id → encounter_templates.id
#   encounter_templates.combat_encounter_id → spawn_configs.id
# Everything else is independent. Emit dependencies first so seed runs
# cleanly from an empty DB as well as with existing rows (ON CONFLICT
# handles the latter).

EMISSION_ORDER: tuple[TableSpec, ...] = (
    BANTER,
    ENEMY_TEMPLATES,
    SPAWN_CONFIGS,
    ENCOUNTER_TEMPLATES,
    ENCOUNTER_CHOICES,
    LOOT_ITEMS,
    ANCHOR_OBJECTS,
    ENTRANCE_TEXTS,
    BAROMETER_TEXTS,
    ABILITIES,
)


__all__ = [
    "ABILITIES",
    "ANCHOR_OBJECTS",
    "BANTER",
    "BAROMETER_TEXTS",
    "EMISSION_ORDER",
    "ENCOUNTER_CHOICES",
    "ENCOUNTER_TEMPLATES",
    "ENEMY_TEMPLATES",
    "ENTRANCE_TEXTS",
    "LOOT_ITEMS",
    "SPAWN_CONFIGS",
    "TableSpec",
]
