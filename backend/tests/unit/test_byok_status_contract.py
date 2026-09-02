"""Bind ``BYOKStatus`` to the SQL that fills it.

``fn_get_wallet_summary`` builds ``byok_status`` with ``jsonb_build_object``.
Whatever it puts in there travels through ``WalletSummary`` on its way to the
browser — and Pydantic v2 defaults to ``extra="ignore"``, so a key the model
does not declare is dropped WITHOUT AN ERROR.

That is not hypothetical. On 2026-09-02 migration 333 added
``openrouter_verified_at`` / ``replicate_verified_at``, the TypeScript type
declared them, the RPC returned them — and this model, which nobody thought
of, threw both away. The key card could therefore only ever report "never
confirmed at the provider", no matter how often a key was confirmed. Three
layers agreed and the fourth quietly disagreed.

The check reads the LAST migration that (re)defines the function, which is the
one whose shape production runs, and compares its key list against the model's
fields. Static: no database, no network.
"""

from __future__ import annotations

import re
from pathlib import Path

from backend.models.forge import BYOKStatus

_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_DEFINES = "CREATE OR REPLACE FUNCTION public.fn_get_wallet_summary"


def _latest_definition() -> tuple[str, str]:
    """(filename, body) of the newest migration defining the summary RPC."""
    files = sorted(p for p in _MIGRATIONS.glob("*.sql") if _DEFINES in p.read_text(encoding="utf-8"))
    assert files, f"no migration defines {_DEFINES} — the path constant is wrong"
    newest = files[-1]
    return newest.name, newest.read_text(encoding="utf-8")


def _byok_status_keys(sql: str) -> set[str]:
    """The keys the RPC nests under ``'byok_status'``."""
    start = sql.index("'byok_status', jsonb_build_object(")
    depth = 0
    for i in range(start, len(sql)):
        if sql[i] == "(":
            depth += 1
        elif sql[i] == ")":
            depth -= 1
            if depth == 0:
                block = sql[start:i]
                break
    else:  # pragma: no cover — unbalanced SQL would be a syntax error anyway
        raise AssertionError("could not find the end of the byok_status object")

    # jsonb_build_object('key', value, 'key', value, …) — keys sit at even
    # positions, so take every quoted literal that is followed by a comma and
    # drop the one naming the object itself.
    keys = set(re.findall(r"'([a-z_]+)',", block))
    return keys - {"byok_status"}


def test_every_key_the_rpc_returns_is_declared() -> None:
    name, sql = _latest_definition()
    sql_keys = _byok_status_keys(sql)
    model_keys = set(BYOKStatus.model_fields)

    undeclared = sql_keys - model_keys
    assert not undeclared, (
        f"{name} returns byok_status keys that BYOKStatus does not declare: "
        f"{', '.join(sorted(undeclared))}. Pydantic drops them silently, so the "
        "frontend never sees them no matter what the SQL or the TypeScript type says."
    )


def test_no_field_is_declared_that_the_rpc_never_sends() -> None:
    """A field the RPC never fills is a promise the API cannot keep."""
    name, sql = _latest_definition()
    orphans = set(BYOKStatus.model_fields) - _byok_status_keys(sql)
    assert not orphans, (
        f"BYOKStatus declares fields {', '.join(sorted(orphans))} that {name} never "
        "returns. They would serialise as their default and read like data."
    )
