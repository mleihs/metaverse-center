"""Localised text columns, read the same way the frontend reads them.

The database keeps a translated column beside the canonical one --
``simulations.name`` / ``simulations.name_de``, ``buildings.description`` /
``description_de``, and so on (migration 312 filled the world titles). The
frontend already has one accessor for that pair, ``t(entity, field)`` in
``frontend/src/utils/locale-fields.ts``.

The backend had none. Every place that needed a translated name either wrote
the fallback chain by hand or -- far more often -- simply read the canonical
column, which is why a German mail could carry an English world title while the
German name sat one column away.

WHY A FALLBACK CHAIN AND NOT A LOOKUP

``name_de`` is nullable and, for most rows, empty. A reader that returns it
unconditionally shows a blank where a title belongs. The chain is therefore the
same as the frontend's: preferred column first, canonical column second, empty
string last -- so the worst case is the old behaviour, never a gap.

WHERE THIS BELONGS AND WHERE IT DOES NOT

Use it wherever the *recipient* is known: a mail with ``email_locale``, a
response for a surface that is written in one language. Do NOT use it for text
handed to a language model. A prompt wants the canonical name: the model has
been given the world in English everywhere else, and a title that changes
language between calls makes its output inconsistent for no gain.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

#: Locales that read a ``_de`` column. Kept explicit rather than
#: "anything but English": a locale we have never heard of must fall back to
#: the canonical column, not to a column that does not exist.
_DE_LOCALES = frozenset({"de", "de-DE", "de-AT", "de-CH"})


def localized_field(
    row: Mapping[str, Any] | None,
    field: str,
    locale: str | None,
    *,
    default: str = "",
) -> str:
    """Return ``field`` from ``row`` in ``locale``, falling back to canonical.

    Mirrors ``t(entity, field)`` in the frontend. ``locale`` may be ``None`` or
    unknown; both mean "canonical".
    """
    if not row:
        return default
    if locale and locale in _DE_LOCALES:
        preferred = row.get(f"{field}_de")
        if isinstance(preferred, str) and preferred.strip():
            return preferred
    canonical = row.get(field)
    if isinstance(canonical, str) and canonical.strip():
        return canonical
    return default
