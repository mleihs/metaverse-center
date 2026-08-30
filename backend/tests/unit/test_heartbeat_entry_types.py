"""Bind the heartbeat entry-type vocabulary to its code and to its CHECK.

This gate exists because the same defect has now shipped twice.

* Migration 186: `resonance_mood` reached the code before it reached the CHECK.
  Sentry METAVERSE_CENTER-27, ten events, all on tick #52.
* Migration 285: `bond_whisper` did it again. Migration 219 created the
  `bond_whispers` table and never touched the constraint. Measured on production
  2026-08-30, the live CHECK held 20 values while the code emitted 21.

Neither was a subtle bug. Both were a value added in Python with nothing
checking the database agreed — and the cost is not one row. Every entry of a
tick goes in one batch insert, so a rejected value fails the tick,
`last_heartbeat_tick` does not advance, and the next attempt fails identically
on the same input. The world stops.

Three sides, checked against each other:

1. every literal `entry_type` passed to `make_heartbeat_entry` is declared;
2. every declared type is actually emitted somewhere (no decoration);
3. the CHECK list in migration 285 equals the declaration exactly.

None of this needs a database. The migration is a text file and the call sites
are an AST.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from backend.services.heartbeat_entry_builder import HEARTBEAT_ENTRY_TYPES

_BACKEND = Path(__file__).resolve().parents[2]
_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "20260830200000_285_heartbeat_bond_whisper_entry_type.sql"
)

# `entry_type` is the FOURTH POSITIONAL parameter of make_heartbeat_entry.
# The first version of this scan looked for a dict key and a keyword argument,
# found neither, and reported zero emitted types across the whole backend — a
# green result from an instrument pointed at the wrong thing. The position is
# asserted below so a signature change breaks the gate loudly.
_ENTRY_TYPE_ARG_INDEX = 3


def _emitted() -> tuple[dict[str, list[str]], list[str]]:
    """Literal entry types passed to the builder, and the non-literal sites."""
    literal: dict[str, list[str]] = {}
    dynamic: list[str] = []

    for path in sorted(_BACKEND.rglob("*.py")):
        if "tests" in path.parts:
            continue
        source = path.read_text(encoding="utf-8")
        if "make_heartbeat_entry" not in source:
            continue
        for node in ast.walk(ast.parse(source)):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name != "make_heartbeat_entry":
                continue
            raw = node.args[_ENTRY_TYPE_ARG_INDEX] if len(node.args) > _ENTRY_TYPE_ARG_INDEX else None
            for keyword in node.keywords:
                if keyword.arg == "entry_type":
                    raw = keyword.value
            where = f"{path.relative_to(_BACKEND).as_posix()}:{node.lineno}"
            if isinstance(raw, ast.Constant) and isinstance(raw.value, str):
                literal.setdefault(raw.value, []).append(where)
            else:
                dynamic.append(where)

    return literal, dynamic


EMITTED, DYNAMIC_SITES = _emitted()


def test_the_builders_signature_still_puts_entry_type_where_the_scan_looks() -> None:
    """The scan reads a positional index; the signature must still match it."""
    import inspect

    from backend.services.heartbeat_entry_builder import make_heartbeat_entry

    params = list(inspect.signature(make_heartbeat_entry).parameters)
    assert params[_ENTRY_TYPE_ARG_INDEX] == "entry_type", (
        f"make_heartbeat_entry's parameter {_ENTRY_TYPE_ARG_INDEX} is {params[_ENTRY_TYPE_ARG_INDEX]!r}, "
        "not 'entry_type' — this gate's AST scan reads that position and would "
        "silently measure the wrong argument."
    )


def test_the_scan_finds_the_call_sites_at_all() -> None:
    """A gate that matches nothing passes for the wrong reason."""
    assert EMITTED, (
        "no literal entry_type found at any make_heartbeat_entry call site. The scan is broken, not the code."
    )


def test_every_emitted_entry_type_is_declared() -> None:
    """A type the CHECK rejects does not fail a row, it fails the tick."""
    undeclared = {t: sites for t, sites in EMITTED.items() if t not in HEARTBEAT_ENTRY_TYPES}
    assert not undeclared, (
        "entry types are emitted that HEARTBEAT_ENTRY_TYPES does not declare. Add them to the "
        "declaration AND ship a migration extending the CHECK — a value the constraint refuses "
        "fails the whole batch, freezes the tick and stops the world:\n"
        + "\n".join(f"  {t}: {', '.join(sites)}" for t, sites in sorted(undeclared.items()))
    )


def test_every_declared_entry_type_is_emitted() -> None:
    """Otherwise the vocabulary drifts into decoration.

    ``event_resolution`` is emitted through a variable at
    ``heartbeat_service.py:901`` (``"event_resolution" if resolved else
    "event_aging"``), so it is exempted explicitly rather than by loosening the
    rule for everything.
    """
    emitted_dynamically = {"event_resolution"}
    unused = [t for t in HEARTBEAT_ENTRY_TYPES if t not in EMITTED and t not in emitted_dynamically]
    assert not unused, (
        f"HEARTBEAT_ENTRY_TYPES declares types nothing emits: {', '.join(unused)}. "
        "Remove them, or add the emitting call site to the dynamic exemption with a reason."
    )


def test_the_check_constraint_matches_the_declaration() -> None:
    """The database is the thing that actually refuses a row."""
    assert _MIGRATION.is_file(), f"migration 285 not found at {_MIGRATION}"
    sql = _MIGRATION.read_text(encoding="utf-8")
    body = sql[sql.index("ADD CONSTRAINT heartbeat_entries_entry_type_check") :]
    in_check = re.findall(r"'([a-z_]+)'", body)

    assert set(in_check) == set(HEARTBEAT_ENTRY_TYPES), (
        "migration 285's CHECK and HEARTBEAT_ENTRY_TYPES disagree.\n"
        f"  only in the CHECK:       {sorted(set(in_check) - set(HEARTBEAT_ENTRY_TYPES))}\n"
        f"  only in the declaration: {sorted(set(HEARTBEAT_ENTRY_TYPES) - set(in_check))}"
    )
    assert len(in_check) == len(set(in_check)), "the CHECK lists a value twice"


def test_bond_whisper_is_present() -> None:
    """The value this whole package exists for.

    Named rather than left implicit: a future edit that drops it would otherwise
    pass every test above, because they only check the three sides agree — and
    all three agreeing on the wrong answer is exactly how this shipped twice.
    """
    assert "bond_whisper" in HEARTBEAT_ENTRY_TYPES
    assert "bond_whisper" in EMITTED, "heartbeat_service phase 10 no longer emits bond_whisper"
