"""DRIFT row builders: DriftPackContent -> dict[column, SqlValue].

Mirrors `row_builders.py` for the dungeon domain but consumes the flat drift
records (the drift pack has no archetype nesting). Every builder takes the
WHOLE `DriftPackContent` and picks its own slice — one uniform signature the
generator can dispatch on, exactly as the dungeon generator dispatches on
`PackLoadResult`.

Rows are sorted by `template_key` so the generated SQL is byte-stable across
runs and filesystems (the same determinism guarantee the dungeon builders
give: a regenerated seed migration must diff to nothing when nothing changed).
"""

from __future__ import annotations

from backend.services.content_packs.sql_primitives import (
    DollarQuoted,
    JsonbLiteral,
    Numeric,
    SqlValue,
)
from backend.services.content_packs.travel_loader import DriftPackContent


def build_quest_template_rows(content: DriftPackContent) -> list[dict[str, SqlValue]]:
    """One INSERT row per quest template, ordered by template_key."""
    return [
        {
            "template_key": DollarQuoted(record.template_key),
            "family": DollarQuoted(record.family),
            "tier": Numeric(record.tier),
            "pack_slug": DollarQuoted(record.pack_slug),
            "definition": JsonbLiteral(record.definition),
        }
        for record in sorted(content.quests, key=lambda r: r.template_key)
    ]


def build_signal_template_rows(content: DriftPackContent) -> list[dict[str, SqlValue]]:
    """One INSERT row per signal template, ordered by template_key."""
    return [
        {
            "template_key": DollarQuoted(record.template_key),
            "signal_class": DollarQuoted(record.signal_class),
            "pack_slug": DollarQuoted(record.pack_slug),
            "band_weights": JsonbLiteral(record.band_weights),
            "requires": JsonbLiteral(record.requires),
            "definition": JsonbLiteral(record.definition),
        }
        for record in sorted(content.signals, key=lambda r: r.template_key)
    ]


__all__ = ["build_quest_template_rows", "build_signal_template_rows"]
