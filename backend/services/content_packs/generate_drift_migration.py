"""Content-pack -> SQL seed generator for the DRIFT (travel) domain.

Sibling of `generate_migration.py` (the dungeon generator). Both reuse the
generic `seed_emit.render_seed_document` scaffolding; this module owns the
drift specifics — loading `content/drift/quests/*.yaml` and building
`travel_quest_templates` rows. Kept separate so the dungeon generator never
imports travel code (no cross-domain coupling) and vice versa.

Usage:
    python -m backend.services.content_packs.generate_drift_migration --stdout
    python -m backend.services.content_packs.generate_drift_migration \\
        --output supabase/migrations/<ts>_254_drift_content_seed.sql
    python -m backend.services.content_packs.generate_drift_migration --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from backend.services.content_packs.seed_emit import render_seed_document
from backend.services.content_packs.travel_loader import (
    DEFAULT_DRIFT_PACK_ROOT,
    QuestTemplateRecord,
    load_quest_templates,
)
from backend.services.content_packs.travel_row_builders import build_quest_template_rows
from backend.services.content_packs.travel_table_specs import (
    DRIFT_EMISSION_ORDER,
    TRAVEL_QUEST_TEMPLATES,
)

# Dispatch: TableSpec -> row builder. Mirrors `generate_migration`'s
# _BUILDER_FOR_SPEC; one row builder per drift table.
_BUILDER_FOR_SPEC = {
    TRAVEL_QUEST_TEMPLATES: build_quest_template_rows,
}

_TRUNCATE_NOTE = [
    "-- Pack is the single source of truth for the drift content tables;",
    "-- drop existing rows before re-inserting from content/drift/**/*.yaml.",
]


def generate_drift_sql(
    records: list[QuestTemplateRecord], *, truncate: bool = True
) -> tuple[str, dict[str, int]]:
    """Produce the drift seed SQL string plus a per-table row-count map."""
    sections = [
        (spec, _BUILDER_FOR_SPEC[spec](records)) for spec in DRIFT_EMISSION_ORDER
    ]
    return render_seed_document(
        sections,
        banner_title="Drift content seed (generated from content/drift/**/*.yaml)",
        generated_by="generate_drift_migration.py",
        truncate_note=_TRUNCATE_NOTE,
        truncate=truncate,
    )


# ── CLI ───────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate drift (travel) content seed SQL from YAML packs.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help=f"Drift pack root (defaults to {DEFAULT_DRIFT_PACK_ROOT}).",
    )
    output_mode = parser.add_mutually_exclusive_group()
    output_mode.add_argument(
        "--output", type=Path, default=None, help="Write generated SQL to this file."
    )
    output_mode.add_argument(
        "--stdout", action="store_true", help="Write generated SQL to stdout."
    )
    output_mode.add_argument(
        "--dry-run", action="store_true", help="Load packs and count rows, emit no SQL."
    )
    parser.add_argument(
        "--no-truncate",
        action="store_true",
        help="Skip the TRUNCATE prefix (additive migration, ID-stability required).",
    )
    args = parser.parse_args(argv)

    records = load_quest_templates(args.root)
    sql, counts = generate_drift_sql(records, truncate=not args.no_truncate)

    if args.dry_run or (not args.output and not args.stdout):
        _print_counts(counts)
        return 0

    if args.stdout:
        sys.stdout.write(sql)
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding="utf-8")
    _print_counts(counts)
    print(f"Wrote {sum(counts.values())} rows to {args.output}")
    return 0


def _print_counts(counts: dict[str, int]) -> None:
    for table, n in counts.items():
        print(f"  {table:<30} {n:>5}")
    print(f"  {'TOTAL':<30} {sum(counts.values()):>5}")


if __name__ == "__main__":
    raise SystemExit(main())
