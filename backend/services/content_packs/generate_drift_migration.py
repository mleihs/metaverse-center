"""Content-pack -> SQL seed generator for the DRIFT (travel) domain.

Sibling of `generate_migration.py` (the dungeon generator). Both reuse the
generic `seed_emit.render_seed_document` scaffolding; this module owns the
drift specifics — loading `content/drift/**/*.yaml` and building the
`travel_quest_templates` + `travel_signal_templates` rows. Kept separate so
the dungeon generator never imports travel code (no cross-domain coupling)
and vice versa.

Usage:
    python -m backend.services.content_packs.generate_drift_migration --stdout
    python -m backend.services.content_packs.generate_drift_migration \\
        --output supabase/migrations/<ts>_254_drift_content_seed.sql
    python -m backend.services.content_packs.generate_drift_migration --dry-run
"""

from __future__ import annotations

from backend.services.content_packs.seed_cli import run_seed_cli
from backend.services.content_packs.seed_emit import render_seed_document
from backend.services.content_packs.travel_loader import (
    DEFAULT_DRIFT_PACK_ROOT,
    DriftPackContent,
    load_drift_content,
)
from backend.services.content_packs.travel_row_builders import (
    build_quest_template_rows,
    build_signal_template_rows,
)
from backend.services.content_packs.travel_table_specs import (
    DRIFT_EMISSION_ORDER,
    TRAVEL_QUEST_TEMPLATES,
    TRAVEL_SIGNAL_TEMPLATES,
)

# Dispatch: TableSpec -> row builder. Mirrors `generate_migration`'s
# _BUILDER_FOR_SPEC; one row builder per drift table.
_BUILDER_FOR_SPEC = {
    TRAVEL_QUEST_TEMPLATES: build_quest_template_rows,
    TRAVEL_SIGNAL_TEMPLATES: build_signal_template_rows,
}

_TRUNCATE_NOTE = [
    "-- Pack is the single source of truth for the drift content tables;",
    "-- drop existing rows before re-inserting from content/drift/**/*.yaml.",
]


def generate_drift_sql(content: DriftPackContent, *, truncate: bool = True) -> tuple[str, dict[str, int]]:
    """Produce the drift seed SQL string plus a per-table row-count map."""
    sections = [(spec, _BUILDER_FOR_SPEC[spec](content)) for spec in DRIFT_EMISSION_ORDER]
    return render_seed_document(
        sections,
        banner_title="Drift content seed (generated from content/drift/**/*.yaml)",
        generated_by="generate_drift_migration.py",
        truncate_note=_TRUNCATE_NOTE,
        truncate=truncate,
    )


# ── CLI ───────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    """Die Befehlszeile steht seit dem Zusammenlegen in ``seed_cli``.

    Hier bleibt nur, was diesen Generator ausmacht: welche Packungen er lädt
    und welches SQL er daraus erzeugt. `seed_cli` kennt keine Domäne — sonst
    hinge der Dungeon-Generator an Drift-Code, was der Modulkopf oben
    ausdrücklich ausschliesst.
    """
    return run_seed_cli(
        argv,
        description="Generate drift (travel) content seed SQL from YAML packs.",
        root_help=f"Drift pack root (defaults to {DEFAULT_DRIFT_PACK_ROOT}).",
        build=lambda root, truncate: generate_drift_sql(load_drift_content(root), truncate=truncate),
    )


if __name__ == "__main__":
    raise SystemExit(main())
