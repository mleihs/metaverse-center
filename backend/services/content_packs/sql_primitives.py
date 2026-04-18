"""Typed SQL value emitters for deterministic, escape-safe INSERT generation.

The legacy `scripts/extract_dungeon_content_to_sql.py` built SQL via nested
f-strings. That worked but carried three architectural flaws:
  1. Column lists duplicated three times per table (INSERT, VALUES, UPDATE SET).
  2. No type discipline — a bare string, a tuple, and a dict were all glued
     in with ad-hoc helpers (`_dq`, `_jsonb`, `_bool`).
  3. Escape handling (dollar-quoting) was an afterthought on top of raw
     string concatenation; any forgotten call introduced an injection risk.

The new pipeline models each SQL value as a typed instance. `render()`
produces the final literal. A single `emit_insert()` in `generate_migration`
iterates a `TableSpec.columns` tuple, so there is exactly one place where
column order is declared.

All renderers emit `ensure_ascii=False` / unescaped UTF-8; PostgreSQL accepts
this natively within dollar-quoted bodies. Determinism: `json.dumps` uses
`sort_keys=True` so repeated runs with identical input produce byte-identical
SQL (critical for `git diff` review).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

# ── Escape-safe dollar-quote tags ─────────────────────────────────────────

_TAG_CANDIDATES = ("DQ", "DQA", "DQB", "DQC", "DQD", "DQE", "DQF", "DQG")


def _safe_tag(body: str, preferred: str = "DQ") -> str:
    """Pick a dollar-quote tag that does not collide with the body.

    PostgreSQL allows any `$tag$...$tag$` delimiter. If the body contains
    `$DQ$`, we fall through to `$DQA$`, `$DQB$`, ... — deterministic order,
    never random, so the generator output stays diff-stable.
    """
    for tag in (preferred, *_TAG_CANDIDATES):
        if f"${tag}$" not in body:
            return tag
    # Exhausting 8 tags requires pathological content. Raise loudly so a
    # regeneration exposes the problem rather than silently corrupting SQL.
    raise ValueError(f"cannot dollar-quote body — all candidate tags collide: {body[:80]!r}")


# ── SqlValue hierarchy ────────────────────────────────────────────────────


class SqlValue:
    """Base class for typed SQL literals. Subclasses implement `render`."""

    def render(self) -> str:  # pragma: no cover - abstract
        raise NotImplementedError


@dataclass(frozen=True)
class DollarQuoted(SqlValue):
    """A text literal wrapped in PostgreSQL dollar-quoting.

    Dollar-quoting sidesteps every single-quote escape rule: the body is
    emitted verbatim. Collisions with the delimiter are resolved by
    `_safe_tag`.
    """

    text: str
    tag: str = "DQ"

    def render(self) -> str:
        tag = _safe_tag(self.text, self.tag)
        return f"${tag}${self.text}${tag}$"


@dataclass(frozen=True)
class JsonbLiteral(SqlValue):
    """A JSONB literal. Emits `$JB$...$JB$::jsonb` for escape safety.

    Uses `sort_keys=True` for deterministic diffs. `ensure_ascii=False` keeps
    Unicode readable in the generated SQL (PostgreSQL accepts UTF-8 in
    dollar-quoted bodies). Tuples are coerced to lists, sets to sorted lists.
    """

    obj: Any

    def render(self) -> str:
        raw = json.dumps(self.obj, ensure_ascii=False, sort_keys=True, default=_json_default)
        tag = _safe_tag(raw, "JB")
        return f"${tag}${raw}${tag}$::jsonb"


def _json_default(o: Any) -> Any:
    if isinstance(o, tuple):
        return list(o)
    if isinstance(o, set):
        return sorted(o)
    raise TypeError(f"unserializable type for JSONB: {type(o).__name__}")


@dataclass(frozen=True)
class TextArray(SqlValue):
    """A TEXT[] array literal with dollar-quoted elements."""

    items: list[str]

    def render(self) -> str:
        if not self.items:
            return "ARRAY[]::TEXT[]"
        parts = [DollarQuoted(s).render() for s in self.items]
        return f"ARRAY[{', '.join(parts)}]::TEXT[]"


@dataclass(frozen=True)
class Numeric(SqlValue):
    """An integer or float literal."""

    value: int | float

    def render(self) -> str:
        return repr(self.value) if isinstance(self.value, float) else str(self.value)


@dataclass(frozen=True)
class BoolLiteral(SqlValue):
    """A boolean literal (`true` / `false`)."""

    value: bool

    def render(self) -> str:
        return "true" if self.value else "false"


class _Null(SqlValue):
    """The SQL NULL marker. Use the module-level `NULL` constant."""

    __slots__ = ()

    def render(self) -> str:
        return "NULL"


NULL: SqlValue = _Null()


# ── Convenience constructors ──────────────────────────────────────────────


def optional_text(value: str | None) -> SqlValue:
    """Dollar-quoted TEXT if value is not None, else NULL."""
    return NULL if value is None else DollarQuoted(value)


def optional_jsonb(value: Any | None) -> SqlValue:
    """JSONB literal if value is not None, else NULL."""
    return NULL if value is None else JsonbLiteral(value)


def optional_numeric(value: int | float | None) -> SqlValue:
    """Numeric literal if value is not None, else NULL."""
    return NULL if value is None else Numeric(value)
