"""DRIFT row builders: QuestTemplateRecord -> dict[column, SqlValue].

Mirrors `row_builders.py` for the dungeon domain but consumes the flat
`QuestTemplateRecord` list (the drift pack has no archetype nesting). Rows are
sorted by `template_key` so the generated SQL is byte-stable across runs and
filesystems (the same determinism guarantee the dungeon builders give).
"""

from __future__ import annotations

from backend.services.content_packs.sql_primitives import (
    DollarQuoted,
    JsonbLiteral,
    Numeric,
    SqlValue,
)
from backend.services.content_packs.travel_loader import QuestTemplateRecord


def build_quest_template_rows(
    records: list[QuestTemplateRecord],
) -> list[dict[str, SqlValue]]:
    """One INSERT row per quest template, ordered by template_key."""
    return [
        {
            "template_key": DollarQuoted(record.template_key),
            "family": DollarQuoted(record.family),
            "tier": Numeric(record.tier),
            "pack_slug": DollarQuoted(record.pack_slug),
            "definition": JsonbLiteral(record.definition),
        }
        for record in sorted(records, key=lambda r: r.template_key)
    ]


__all__ = ["build_quest_template_rows"]
