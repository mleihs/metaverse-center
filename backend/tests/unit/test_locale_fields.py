"""Ein Feld mitzuladen ist nicht dasselbe, wie es zu lesen.

WAS GEFUNDEN WURDE (01.09.2026)

Die deutsche Oberflaeche zeigte den englischen Weltnamen, obwohl `name_de`
danebenstand. Der Grund war an jeder Stelle derselbe und trotzdem
verschieden verkleidet:

  * das Frontend las `sim.name` statt `t(sim, 'name')` -- an 12 Stellen,
    zwei Zeilen neben einer, die es richtig machte;
  * der Server lud `simulations(name)` und nicht `name_de` -- an 15 Stellen;
  * und wo er es lud, las es niemand.

Die dritte Form ist die teuerste: ein Select, das eine uebersetzte Spalte
mitbringt, die kein Leser anfasst, SIEHT AUS wie erledigte Lokalisierung.

WARUM DIESER HELFER

Das Frontend hatte seit jeher `t(entity, field)`. Der Server hatte nichts, also
schrieb jede Stelle die Rueckfallkette von Hand oder liess sie weg. Ein
Verhalten, das an drei Orten von Hand wiederholt wird, ist an drei Orten
verschieden falsch.

WAS DIESER TEST HAELT

Die Kette selbst -- und vor allem ihre Raender: eine leere Uebersetzung, eine
unbekannte Sprache, eine fehlende Zeile. Jeder dieser Faelle muss auf den
kanonischen Wert zurueckfallen; keiner darf eine Luecke zeigen. Ein Titel, der
verschwindet, ist schlimmer als einer in der falschen Sprache.
"""

from __future__ import annotations

import pytest

from backend.utils.locale_fields import localized_field

ROW = {"name": "The Gaslit Reach", "name_de": "Der Gaslicht-Sund"}


@pytest.mark.parametrize(
    ("locale", "expected"),
    [
        ("de", "Der Gaslicht-Sund"),
        ("de-AT", "Der Gaslicht-Sund"),
        ("de-CH", "Der Gaslicht-Sund"),
        ("en", "The Gaslit Reach"),
        (None, "The Gaslit Reach"),
        ("", "The Gaslit Reach"),
        # Eine Sprache, die wir nie gesehen haben, faellt auf den kanonischen
        # Wert -- nicht auf eine Spalte, die es nicht gibt.
        ("fr", "The Gaslit Reach"),
    ],
    ids=["de", "de-AT", "de-CH", "en", "None", "leer", "unbekannt"],
)
def test_locale_picks_the_right_column(locale: str | None, expected: str) -> None:
    assert localized_field(ROW, "name", locale) == expected


@pytest.mark.parametrize(
    ("row", "beschreibung"),
    [
        ({"name": "X", "name_de": None}, "Uebersetzung ist NULL"),
        ({"name": "X", "name_de": ""}, "Uebersetzung ist leer"),
        ({"name": "X", "name_de": "   "}, "Uebersetzung ist nur Leerraum"),
        ({"name": "X"}, "Spalte fehlt ganz"),
    ],
    ids=["null", "leer", "leerraum", "fehlt"],
)
def test_an_empty_translation_never_produces_a_gap(row: dict, beschreibung: str) -> None:
    """`name_de` ist nullable und fuer die meisten Zeilen leer.

    Ein Leser, der sie bedingungslos zurueckgibt, zeigt eine Luecke, wo ein
    Titel stehen soll. Der schlimmste Fall muss das ALTE Verhalten sein.
    """
    assert localized_field(row, "name", "de") == "X", beschreibung


def test_a_missing_row_returns_the_default() -> None:
    """Der eingebettete Verbund kann `None` sein (LEFT JOIN ohne Treffer)."""
    assert localized_field(None, "name", "de") == ""
    assert localized_field(None, "name", "de", default="Unbenannt") == "Unbenannt"
    assert localized_field({}, "name", "de", default="Unbenannt") == "Unbenannt"


def test_a_non_string_column_does_not_leak_a_repr() -> None:
    """Eine Spalte mit einem anderen Typ darf nicht als Text durchrutschen."""
    assert localized_field({"name": 42}, "name", "en", default="?") == "?"
    assert localized_field({"name": "X", "name_de": 7}, "name", "de") == "X"
