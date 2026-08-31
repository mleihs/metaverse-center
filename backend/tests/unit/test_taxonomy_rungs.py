"""Die Taxonomie-Antwort trägt die Sprosse — und `None`, wenn es keine gibt.

WOZU DAS FELD DA IST
Das Frontend verglich den Bauzustand gegen eine feste Fünferliste
(`pristine|good|fair|poor|ruined`). Die passt auf 5 von 36 Welten: 26 Welten
führen `excellent` als OBERSTE Sprosse, und die zehn Bauten, die es tragen,
zeigten deshalb einen leeren Edelstein — auf dem höchsten Rang ihrer Welt.
Mit `rung` kann die Oberfläche die Position auf der Leiter DIESER Welt lesen,
statt gegen eine Liste zu raten.

WARUM `None` UND NICHT 0
Eine fehlende Sprosse ist keine schlechte Sprosse. Wer sie zu einer Zahl macht,
behauptet eine Position; die Oberfläche zeichnet daraufhin einen leeren
Edelstein, der wie ein Messwert aussieht. Genau dieser Griff (`?? 0`) hat den
Fehler oben erzeugt.

WARUM DIE ZAHL AUS DER DATENBANK KOMMT
Die Vorrangregel — eigene `metadata.rung` einer Welt vor der Sprossenkarte der
Plattform — steht in `fn_building_condition_ladder(uuid)`. Eine zweite Fassung
in Python wäre die dritte Kopie derselben Regel; diese Form hat an einem Tag
dreimal etwas kaputt gemacht.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.taxonomy_service import TaxonomyService

SIM = uuid4()


def _client(ladder: list[dict] | Exception) -> MagicMock:
    """Ein Supabase-Doppel, dessen `.rpc(...).execute()` die Leiter liefert."""
    client = MagicMock()
    execute = AsyncMock(
        side_effect=ladder if isinstance(ladder, Exception) else None,
        return_value=None if isinstance(ladder, Exception) else SimpleNamespace(data=ladder),
    )
    client.rpc = MagicMock(return_value=SimpleNamespace(execute=execute))
    return client


LADDER = [
    {"value": "excellent", "rung": 10},
    {"value": "good", "rung": 20},
    {"value": "sealed", "rung": 36},
    {"value": "ruined", "rung": 50},
]


@pytest.mark.asyncio
async def test_every_condition_word_gets_the_rung_of_its_own_world() -> None:
    rows = [
        {"taxonomy_type": "building_condition", "value": "excellent"},
        {"taxonomy_type": "building_condition", "value": "sealed"},
    ]
    out = await TaxonomyService._attach_rungs(_client(LADDER), SIM, rows)
    assert [r["rung"] for r in out] == [10, 36]


@pytest.mark.asyncio
async def test_a_word_that_is_not_on_this_worlds_ladder_gets_none() -> None:
    """Nicht 0 und nicht 999 — die Oberfläche soll den Edelstein WEGLASSEN können."""
    rows = [{"taxonomy_type": "building_condition", "value": "waterlogged"}]
    out = await TaxonomyService._attach_rungs(_client(LADDER), SIM, rows)
    assert out[0]["rung"] is None


@pytest.mark.asyncio
async def test_other_taxonomies_are_untouched_and_cost_no_call() -> None:
    """`profession` hat keine Sprosse, und dafür darf keine Abfrage laufen."""
    client = _client(LADDER)
    rows = [{"taxonomy_type": "profession", "value": "archivist"}]
    out = await TaxonomyService._attach_rungs(client, SIM, rows)
    assert "rung" not in out[0]
    client.rpc.assert_not_called()


@pytest.mark.asyncio
async def test_a_missing_ladder_yields_none_rather_than_a_broken_response() -> None:
    """Bleibt die Leiter aus, ist „steht auf keiner Sprosse" die wahre Aussage.

    Die Taxonomie ist der Zweck der Antwort; die Sprosse ist eine Zugabe. Ein
    Fehlschlag beim Zusatz darf die Liste nicht mitreissen — er wird protokolliert
    und die Zeilen gehen ohne Sprosse hinaus.
    """
    rows = [{"taxonomy_type": "building_condition", "value": "excellent"}]
    out = await TaxonomyService._attach_rungs(_client(RuntimeError("kein Recht")), SIM, rows)
    assert out[0].get("rung") is None
    assert out[0]["value"] == "excellent"
