"""Timestamp parsing for values that arrive from PostgREST.

PostgREST hands back `timestamptz` columns as ISO-8601 strings, sometimes with a
trailing ``Z`` that `datetime.fromisoformat` rejected before Python 3.11 and that
still reads better normalised. A value may also already be a ``datetime`` (test
fixtures, a client that deserialises), or it may be ``None`` or malformed.

Two contracts, deliberately separate:

- :func:`parse_timestamp` returns ``None`` when it cannot read the value. Callers
  that must *decide* something from the age of a row need to know the difference
  between "old" and "unknown".
- :func:`parse_timestamp_or_now` substitutes the current time. Callers that only
  need a comparable instant use it.

Every result is timezone-aware and in UTC; a naive input is assumed UTC, which is
what the database stores.
"""

from __future__ import annotations

from datetime import UTC, datetime

__all__ = ["parse_timestamp", "parse_timestamp_or_now"]


def parse_timestamp(value: object) -> datetime | None:
    """Read a PostgREST timestamp into an aware UTC ``datetime``, or ``None``."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str) and value:
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def parse_timestamp_or_now(value: object) -> datetime:
    """Same as :func:`parse_timestamp`, with the current time as the fallback."""
    return parse_timestamp(value) or datetime.now(UTC)
