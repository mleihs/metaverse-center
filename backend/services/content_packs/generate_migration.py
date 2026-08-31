"""Content-pack → SQL seed generator (clean rewrite).

Replaces `scripts/extract_dungeon_content_to_sql.py`. The rewrite addresses
six architectural problems in the legacy generator:

  1. Legacy: each table's column list was hand-written three times (INSERT,
     VALUES, UPDATE SET). Here: one `TableSpec` per table, templated once.
  2. Legacy: silent duplicate-ID rename (`banter_id = f"{banter_id}_dup{idx}"`)
     papered over a data bug. Here: duplicates cause the *validator* to
     fail loudly before the generator runs.
  3. Legacy: `_TIER_FIELD_FOR_ARCHETYPE` hard-coded inside the generator.
     Here: lives in `schemas.py` next to the data it describes.
  4. Legacy: no CLI surface, no dry-run, writes to a fixed path that does
     not match the migration naming scheme. Here: `--output`, `--stdout`,
     `--dry-run` — caller decides, generator is pure.
  5. Legacy: Python dicts were the generator's only input. Here: packs are
     the input, Python dicts are scheduled for deletion in A1.5.
  6. Legacy: no determinism guarantee. Here: sorted archetype iteration +
     `json.dumps(sort_keys=True)` yield byte-identical output across runs.

Usage:
    python -m backend.services.content_packs.generate_migration --stdout
    python -m backend.services.content_packs.generate_migration --output path/to/seed.sql
    python -m backend.services.content_packs.generate_migration --dry-run  # counts only
"""

from __future__ import annotations

from collections.abc import Callable

from backend.services.content_packs.loader import (
    DEFAULT_PACK_ROOT,
    PackLoadResult,
    load_packs,
)
from backend.services.content_packs.row_builders import (
    build_ability_rows,
    build_anchor_rows,
    build_banter_rows,
    build_barometer_rows,
    build_choice_rows,
    build_encounter_rows,
    build_enemy_rows,
    build_entrance_rows,
    build_loot_rows,
    build_spawn_rows,
)
from backend.services.content_packs.seed_cli import run_seed_cli
from backend.services.content_packs.seed_emit import render_seed_document
from backend.services.content_packs.sql_primitives import SqlValue
from backend.services.content_packs.table_specs import (
    ABILITIES,
    ANCHOR_OBJECTS,
    BANTER,
    BAROMETER_TEXTS,
    EMISSION_ORDER,
    ENCOUNTER_CHOICES,
    ENCOUNTER_TEMPLATES,
    ENEMY_TEMPLATES,
    ENTRANCE_TEXTS,
    LOOT_ITEMS,
    SPAWN_CONFIGS,
    TableSpec,
)

# ── Dispatch: TableSpec → row builder ────────────────────────────────────

RowBuilder = Callable[[PackLoadResult], list[dict[str, SqlValue]]]

_BUILDER_FOR_SPEC: dict[TableSpec, RowBuilder] = {
    BANTER: build_banter_rows,
    ENEMY_TEMPLATES: build_enemy_rows,
    SPAWN_CONFIGS: build_spawn_rows,
    ENCOUNTER_TEMPLATES: build_encounter_rows,
    ENCOUNTER_CHOICES: build_choice_rows,
    LOOT_ITEMS: build_loot_rows,
    ANCHOR_OBJECTS: build_anchor_rows,
    ENTRANCE_TEXTS: build_entrance_rows,
    BAROMETER_TEXTS: build_barometer_rows,
    ABILITIES: build_ability_rows,
}


def generate_sql(result: PackLoadResult, *, truncate: bool = True) -> tuple[str, dict[str, int]]:
    """Produce the full dungeon seed SQL string plus a per-table row count map.

    `truncate=True` (default): emit a TRUNCATE ... RESTART IDENTITY CASCADE
    prefix so the migration fully replaces any existing seed content. This
    is the correct default for A1.5 because the legacy seed carries drift
    (e.g. `sb_30_dup0` banter IDs renamed to `sb_30b` in the pack) that
    plain UPSERT cannot resolve — stale rows would survive.

    `truncate=False`: pure additive mode for hypothetical future
    incremental migrations where ID-stability is guaranteed. Not used by
    A1.5 but preserved so the primitive exists.

    Document scaffolding + escape-safe INSERT rendering live in
    `seed_emit.render_seed_document`, shared with the drift generator.
    """
    sections = [(spec, _BUILDER_FOR_SPEC[spec](result)) for spec in EMISSION_ORDER]
    return render_seed_document(
        sections,
        banner_title="Dungeon content seed (generated from content/dungeon/**/*.yaml)",
        truncate_note=[
            "-- Clean slate: pack is the single source of truth, so drop any",
            "-- existing rows (including legacy `_dup{idx}` renames from the",
            "-- old extract script) before re-inserting from packs.",
        ],
        truncate=truncate,
    )


# ── CLI ───────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    """Die Befehlszeile steht seit dem Zusammenlegen in ``seed_cli``.

    Hier bleibt nur, was diesen Generator ausmacht: welche Packungen er lädt
    und welches SQL er daraus erzeugt.
    """
    return run_seed_cli(
        argv,
        description="Generate dungeon content seed SQL from YAML packs.",
        root_help=f"Pack root (defaults to {DEFAULT_PACK_ROOT}).",
        build=lambda root, truncate: generate_sql(load_packs(root), truncate=truncate),
    )



if __name__ == "__main__":
    raise SystemExit(main())
