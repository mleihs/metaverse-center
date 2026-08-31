"""Eine fehlende Zeile heißt nicht überall dasselbe — und genau das muss die Anzeige sagen.

``journal_enabled`` stand monatelang ohne Zeile auf Prod und war damit AUS.
``resonance_auto_process_enabled`` steht ebenfalls ohne Zeile auf Prod und ist
damit AN — weil ``ResonanceScheduler._load_config`` bei ``_DEFAULT_ENABLED =
True`` beginnt und die Vorgabe nur überschreibt, wenn eine Zeile ankommt.

Zwei leere Felder, zwei entgegengesetzte Wirklichkeiten. Eine Oberfläche, die
beide als „aus" zeichnet, ist bei einem der beiden falsch, und man sähe es ihr
nicht an. Deshalb rechnet ``list_feature_gates`` den wirksamen Zustand aus Zeile
UND Vorgabe — und deshalb prüft dieser Test genau diese Verrechnung, nicht die
Abfrage.
"""

from __future__ import annotations

import pytest

from backend.services.platform_gate_contracts import PLATFORM_GATES
from backend.services.platform_settings_service import PlatformSettingsService


class _FakeQuery:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_args, **_kwargs) -> _FakeQuery:
        return self

    async def execute(self) -> _FakeQuery:
        return self

    @property
    def data(self) -> list[dict]:
        return self._rows


class _FakeClient:
    """Nur so viel Postgrest, wie ``list_feature_gates`` tatsächlich anfasst."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def table(self, name: str) -> _FakeQuery:
        assert name == "platform_settings", f"unerwartete Tabelle: {name}"
        return _FakeQuery(self._rows)


def _gate(result: dict, key: str) -> dict:
    return next(g for g in result["gates"] if g["key"] == key)


@pytest.mark.asyncio
async def test_missing_row_uses_the_reader_default_not_false():
    """Der Kern: ohne Zeile gilt die Vorgabe der Lesestelle, nicht ``False``."""
    result = await PlatformSettingsService.list_feature_gates(_FakeClient([]))

    journal = _gate(result, "journal_enabled")
    assert journal["has_row"] is False
    assert journal["enabled"] is False, "Anschalter ohne Zeile ist aus"

    resonance = _gate(result, "resonance_auto_process_enabled")
    assert resonance["has_row"] is False
    assert resonance["enabled"] is True, (
        "resonance_auto_process_enabled läuft OHNE Zeile weiter "
        "(_DEFAULT_ENABLED = True in resonance_scheduler.py). Wer das auf False "
        "setzt, zeichnet einen laufenden Zeitgeber als abgeschaltet."
    )

    heartbeat = _gate(result, "heartbeat_enabled")
    assert heartbeat["enabled"] is True, "Notaus ohne Zeile heißt: läuft"


@pytest.mark.asyncio
async def test_present_row_wins_over_the_default():
    """Eine Zeile schlägt die Vorgabe — in beide Richtungen."""
    rows = [
        {"setting_key": "heartbeat_enabled", "setting_value": '"false"'},
        {"setting_key": "journal_enabled", "setting_value": "true"},
    ]
    result = await PlatformSettingsService.list_feature_gates(_FakeClient(rows))

    heartbeat = _gate(result, "heartbeat_enabled")
    assert heartbeat["has_row"] is True
    assert heartbeat["enabled"] is False, "Notaus mit 'false' ist aus"

    journal = _gate(result, "journal_enabled")
    assert journal["has_row"] is True
    assert journal["enabled"] is True


@pytest.mark.asyncio
async def test_non_canonical_value_reads_as_off():
    """F32-Semantik durchgereicht: alles außerhalb {true,1,yes,on} ist AUS.

    Der rohe Wert bleibt in der Antwort, damit die Oberfläche ihn zeigen kann.
    Ein ``"enabled"`` in der Zeile ist kein Schönheitsfehler — es ist ein Tor,
    das der Betreiber für offen hält und das zu ist.
    """
    rows = [{"setting_key": "journal_enabled", "setting_value": '"enabled"'}]
    result = await PlatformSettingsService.list_feature_gates(_FakeClient(rows))

    journal = _gate(result, "journal_enabled")
    assert journal["has_row"] is True
    assert journal["enabled"] is False
    assert journal["raw_value"] == "enabled"


@pytest.mark.asyncio
async def test_undeclared_rows_are_surfaced_not_swallowed():
    """Ein Schlüssel darf sich nicht dadurch verstecken, dass ihn niemand erklärt."""
    rows = [
        {"setting_key": "brandneues_tor_enabled", "setting_value": "true"},
        {"setting_key": "cache_map_data_ttl", "setting_value": "15"},
    ]
    result = await PlatformSettingsService.list_feature_gates(_FakeClient(rows))

    keys = [row["key"] for row in result["undeclared"]]
    assert keys == ["brandneues_tor_enabled"], (
        "Nur '*_enabled'-Zeilen ohne Erklärung gehören in die Warnung — "
        f"cache_map_data_ttl ist keine. Gefunden: {keys}"
    )
    assert result["undeclared"][0]["enabled"] is True


@pytest.mark.asyncio
async def test_every_declared_gate_is_projected():
    """Kein erklärtes Tor darf auf dem Weg zur Oberfläche verloren gehen."""
    result = await PlatformSettingsService.list_feature_gates(_FakeClient([]))
    assert len(result["gates"]) == len(PLATFORM_GATES)
    assert {g["key"] for g in result["gates"]} == {g.key for g in PLATFORM_GATES}
    for gate in result["gates"]:
        assert gate["turns_on"], f"{gate['key']}: Erklärung ging verloren"
        assert gate["group"] in result["groups"]
