"""Bind migration 283's seeded values to ``ai_purposes.AI_PURPOSES``.

The declaration is the default; the ``platform_settings`` row is the override an
operator can reach. Both carry the same numbers, so both can drift — and a drift
here is silent in the worst way: the row wins, so a default lowered in code
keeps running at the old value on every database that has the row, which is
every database.

This reads the migration's SQL and compares it to the declaration value by
value. It does not need a database: the migration is a text file, and what it
would insert is decidable from the text.

The same class of defect as finding 31 — a migration whose effect nobody
compared against the other place that writes the same rows — but caught by a
cheap unit test rather than by a DB-state gate, because ``platform_settings``
has no competing seed file to reconcile with (only ``prompt_templates`` does,
which is what ``scripts/lint-seed-carries-migration-effects.sh`` is for).
"""

from __future__ import annotations

import re
from pathlib import Path

from backend.services.ai_purposes import AI_PURPOSES, purpose_names
from backend.services.platform_model_config import HARDCODED_DEFAULTS

_MIGRATION = (
    Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "20260830180000_283_per_purpose_budgets.sql"
)

# ('key', 'value'::jsonb, 'description')  — value is a jsonb literal, so a
# string setting arrives double-quoted and a number bare.
_ROW_RE = re.compile(r"^\s*\('([a-z0-9_]+)',\s*'(.*?)'::jsonb,", re.MULTILINE)


def _seeded() -> dict[str, str]:
    assert _MIGRATION.is_file(), f"migration 283 not found at {_MIGRATION}"
    rows = dict(_ROW_RE.findall(_MIGRATION.read_text(encoding="utf-8")))
    assert rows, "no INSERT rows parsed from migration 283 — the regex and the file disagree"
    return rows


SEEDED = _seeded()


def test_every_purpose_has_a_budget_row_matching_the_declaration() -> None:
    mismatches: list[str] = []
    for name in purpose_names():
        declared = AI_PURPOSES[name]
        for key, expected in (
            (f"max_tokens_{name}", str(declared.max_tokens)),
            (f"timeout_{name}", str(declared.timeout)),
            (f"reasoning_{name}", f'"{declared.reasoning}"'),
        ):
            actual = SEEDED.get(key)
            if actual is None:
                mismatches.append(f"{key}: missing from migration 283 (declaration says {expected})")
            elif actual != expected:
                mismatches.append(f"{key}: migration says {actual}, declaration says {expected}")

    assert not mismatches, (
        "migration 283 and ai_purposes.AI_PURPOSES disagree. The row wins at runtime, so a "
        "default changed in code alone would never take effect on any database that has the "
        "row — which is every database:\n" + "\n".join(f"  {m}" for m in mismatches)
    )


def test_no_orphan_budget_rows() -> None:
    """A row for a purpose that no longer exists is configuration for nothing."""
    prefixes = ("max_tokens_", "timeout_", "reasoning_")
    orphans = [
        key
        for key in SEEDED
        for prefix in prefixes
        if key.startswith(prefix) and key.removeprefix(prefix) not in AI_PURPOSES
    ]
    assert not orphans, (
        "migration 283 seeds rows for purposes ai_purposes.AI_PURPOSES does not declare: "
        f"{', '.join(sorted(orphans))}"
    )


def test_forecast_model_row_matches_the_code_default() -> None:
    """The id moved out of a ``Final`` constant; it must land on the same value.

    ``_FORECAST_MODEL`` held ``anthropic/claude-haiku-4.5``. Seeding anything
    else here would be a silent model swap dressed as a refactor.
    """
    for key in ("model_forecast", "model_forecast_dev"):
        assert SEEDED.get(key) == f'"{HARDCODED_DEFAULTS[key]}"', (
            f"{key}: migration 283 says {SEEDED.get(key)}, "
            f"HARDCODED_DEFAULTS says {HARDCODED_DEFAULTS[key]!r}"
        )
