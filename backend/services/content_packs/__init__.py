"""Content packs — versioned YAML authoring source for game content.

Dungeon content (encounters, banter, loot, enemies, spawns, anchors,
entrance/barometer texts, abilities) lives in `content/dungeon/**/*.yaml`
as bilingual authoring source. This module:

  - `schemas`      — Pydantic models for pack shapes (reuses runtime models
                     where possible; wraps combat Ability dataclass).
  - `table_specs`  — single source of truth for the 10 DB tables
                     (name, columns, ON CONFLICT target). Drives the
                     generator and validator.
  - `sql_primitives` — typed SQL value emitters (DollarQuoted, JsonbLiteral,
                     ArrayLiteral, ...). Replaces the f-string-concat
                     approach of the legacy extract script.
  - `row_builders` — per-content-type functions that convert a validated
                     pack item into a `dict[column → SqlValue]` row.
  - `loader`       — YAML directory → `_ContentCache`-compatible in-memory
                     structure. Used by runtime startup (A1.5+) and test
                     harness (A1.4+).
  - `generate_migration` — pack → idempotent SQL (`ON CONFLICT DO UPDATE`).
                     Replaces `scripts/extract_dungeon_content_to_sql.py`.

Runtime DB cache (`dungeon_content_service`) is unchanged — it still reads
from the seeded DB tables at startup.
"""

from backend.services.content_packs.loader import (
    PackLoadResult,
    load_packs,
    load_packs_for_tests,
)

__all__ = [
    "PackLoadResult",
    "load_packs",
    "load_packs_for_tests",
]
