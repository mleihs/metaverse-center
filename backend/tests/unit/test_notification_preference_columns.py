"""A preference must be visible everywhere it is consulted.

`_resolve_recipients` gates every recipient with

    if not prefs.get(notification_type, True): continue

which LOOKS generic — any preference name works. It is bounded by the
`.select(...)` above it, and that list was typed out by hand. A column missing
from it reads as the default `True`, so the switch is silently ignored exactly
where it decides whether a mail goes out, and nothing says so.

`deadline_reminder` was in that state the hour it was created: added to the
table, the model, the API and the settings screen — and invisible to the one
place that asks whether to send.

Both call sites now derive their list from the model. These tests hold them to
it, by reading the source rather than trusting the prose.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from backend.models.notification import (
    NOTIFICATION_PREFERENCE_COLUMNS,
    NOTIFICATION_TOGGLE_COLUMNS,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
)

_ROOT = Path(__file__).resolve().parents[3]

#: Every module that reads `notification_preferences` out of the database.
_READERS = (
    "backend/services/cycle_notification_service.py",
    "backend/services/user_profile_service.py",
)


def _selects_on_the_table(path: str) -> list[str]:
    """String literals passed to `.select(...)` in a `notification_preferences`
    chain — the shape a hand-typed column list would take."""
    source = (_ROOT / path).read_text(encoding="utf-8")
    tree = ast.parse(source)
    found: list[str] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "select"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            found.append(node.args[0].value)
    return found


class TestTheConstantFollowsTheModel:
    def test_it_lists_every_field(self):
        assert set(NOTIFICATION_PREFERENCE_COLUMNS) == set(NotificationPreferencesUpdate.model_fields)

    def test_the_response_model_carries_the_same_fields(self):
        """A preference that can be set but not read back is half a preference."""
        assert set(NotificationPreferencesResponse.model_fields) == set(
            NotificationPreferencesUpdate.model_fields
        )

    def test_the_toggles_are_the_booleans(self):
        assert "email_locale" not in NOTIFICATION_TOGGLE_COLUMNS
        assert "deadline_reminder" in NOTIFICATION_TOGGLE_COLUMNS

    def test_it_is_not_empty(self):
        """A constant derived from an empty model would satisfy every test below."""
        assert len(NOTIFICATION_PREFERENCE_COLUMNS) >= 4


class TestNoReaderSpellsTheListByHand:
    @pytest.mark.parametrize("path", _READERS)
    def test_the_file_exists(self, path):
        assert (_ROOT / path).is_file(), f"{path} verschoben — der Scan zeigt ins Leere"

    @pytest.mark.parametrize("path", _READERS)
    def test_no_select_literal_names_a_preference_column(self, path):
        """The whole point: a hand-typed list can drift, a derived one cannot."""
        for literal in _selects_on_the_table(path):
            named = [column for column in NOTIFICATION_TOGGLE_COLUMNS if column in literal]
            assert not named, (
                f"{path}: `.select(\"{literal}\")` schreibt Präferenzspalten aus "
                f"({', '.join(named)}). Genau so ist `deadline_reminder` "
                f"verlorengegangen — NOTIFICATION_PREFERENCE_COLUMNS benutzen."
            )

    @pytest.mark.parametrize("path", _READERS)
    def test_the_reader_uses_the_constant(self, path):
        source = (_ROOT / path).read_text(encoding="utf-8")
        assert "NOTIFICATION_PREFERENCE_COLUMNS" in source, (
            f"{path} liest die Präferenzen, ohne die abgeleitete Liste zu benutzen"
        )


class TestTheGateCanSeeEveryToggle:
    def test_the_recipient_gate_reads_the_notification_type(self):
        """`prefs.get(notification_type, True)` is only generic while the select
        is. Pinned so nobody re-hardcodes one half of the pair."""
        source = (_ROOT / "backend/services/cycle_notification_service.py").read_text(encoding="utf-8")
        assert "prefs.get(notification_type, True)" in source
