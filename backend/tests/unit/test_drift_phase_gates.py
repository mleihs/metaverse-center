"""Fünf Schalter standen auf Prod und schalteten nichts.

``drift_ai_enabled`` und ``drift_p1..p4_enabled`` hatten am 31.08.2026 eine Zeile
in ``platform_settings`` und keine Lesestelle — gemessen über
``pg_get_functiondef`` auf der laufenden Datenbank: null Funktionen nannten sie
(``drift_fun_core_enabled`` zum Vergleich: zehn), und im Python nannte sie nichts
außer der Vertragsdatei selbst. Ein Schalter, dessen Umlegen nichts ändert, ist
schlimmer als kein Schalter: er verspricht eine Wirkung, die es nicht gibt.

Die Entscheidung war, sie anzuschließen statt zu entfernen — den Weg zu wählen,
der die Ursache beseitigt. Diese Tests halten fest, WAS angeschlossen wurde:

* die **kumulative Regel**. Eine Phase ist offen, wenn ihre eigene Zeile wahr ist
  UND alle vorherigen offen sind. Ohne sie meldete ``drift_p3_enabled=true`` bei
  geschlossenem P0 eine Phase, die niemand erreichen kann;
* **fail-closed nach beiden Seiten**: fehlende Zeile, jsonb-null, Tippfehler oder
  ein Fehlschlag der Abfrage selbst schließen das Tor, sie öffnen es nie;
* der Querschalter ``ai`` hängt an P0, nicht an der Leiter;
* und die Regel steht an EINER Stelle. ``assert_p0_enabled`` leitet sie nicht neu
  her, sondern fragt denselben Schnappschuss — sonst wäre die Zusage „öffentlicher
  Schnappschuss und Tor können nie auseinanderlaufen" eine Absicht statt einer
  Bauart.

WAS HIER NICHT GEPRÜFT WIRD, WEIL ES NICHT WAHR IST: dass hinter P1 bis P4 ein
Merkmal steht. Es steht keines. Die Tore melden ihren Zustand, sie erschließen
nichts — und ``drift_ai_enabled`` riegelt nichts ab, weil DRIFT überhaupt keine KI
ruft. Das ist der Unterschied zwischen „angeschlossen" und „wirksam", und die
Torbeschreibungen in ``platform_gate_contracts`` sagen ihn.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from backend.services.drift_service import (
    _AI_GATE_KEY,
    _DRIFT_GATE_KEYS,
    _PHASE_GATE_KEYS,
    DriftService,
)
from backend.services.platform_gate_contracts import PLATFORM_GATES

_ON = "true"
_OFF = "false"


def _rows(**flags: str) -> dict[str, str]:
    """Nur die genannten Schlüssel — alles andere fehlt, wie auf einer frischen DB."""
    return dict(flags)


async def _state(settings: dict[str, str]):
    with patch(
        "backend.services.drift_service.load_platform_settings",
        AsyncMock(return_value=settings),
    ):
        return await DriftService.get_public_state(AsyncMock())


# ── Abwesenheit ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_rows_at_all_closes_everything():
    """Eine frische Datenbank hat keine Zeile. Dann ist alles zu, nicht alles auf."""
    state = await _state({})
    assert state.enabled is False
    assert (state.p1, state.p2, state.p3, state.p4) == (False, False, False, False)
    assert state.ai is False
    assert state.highest_open_phase is None


@pytest.mark.asyncio
async def test_failed_query_closes_everything():
    """``load_platform_settings`` gibt bei einem Fehlschlag ein leeres Verzeichnis
    zurück (es fängt PostgrestAPIError/HTTPError selbst ab). Für ein Tor, das ein
    ganzes Merkmal verbirgt, ist die richtige Richtung: zu."""
    state = await _state({})
    assert state.enabled is False
    assert state.highest_open_phase is None


@pytest.mark.parametrize("value", ["", "false", "0", "no", "off", "ture", "TRUE-ish", "null"])
@pytest.mark.asyncio
async def test_non_affirmative_values_close_the_gate(value: str):
    """Positiv-Abgleich: nur ``true``/``1``/``yes``/``on`` öffnen. Ein Tippfehler
    darf ein Tor nicht scharf schalten."""
    state = await _state(_rows(drift_p0_enabled=value))
    assert state.enabled is False


# ── Die kumulative Regel ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_p0_alone_opens_only_p0():
    state = await _state(_rows(drift_p0_enabled=_ON))
    assert state.enabled is True
    assert (state.p1, state.p2, state.p3, state.p4) == (False, False, False, False)
    assert state.highest_open_phase == 0


@pytest.mark.asyncio
async def test_later_phases_cannot_open_over_a_closed_p0():
    """Der Fall, für den die Regel da ist: P1 bis P4 stehen auf wahr, P0 ist zu.

    Ohne die Regel meldete der Schnappschuss vier offene Phasen hinter einer
    verschlossenen Tür.
    """
    state = await _state(
        _rows(
            drift_p0_enabled=_OFF,
            drift_p1_enabled=_ON,
            drift_p2_enabled=_ON,
            drift_p3_enabled=_ON,
            drift_p4_enabled=_ON,
        )
    )
    assert state.enabled is False
    assert (state.p1, state.p2, state.p3, state.p4) == (False, False, False, False)
    assert state.highest_open_phase is None


@pytest.mark.asyncio
async def test_a_gap_in_the_ladder_closes_everything_above_it():
    """P0 und P1 offen, P2 zu, P3 und P4 wieder auf wahr → die Leiter endet bei P1."""
    state = await _state(
        _rows(
            drift_p0_enabled=_ON,
            drift_p1_enabled=_ON,
            drift_p2_enabled=_OFF,
            drift_p3_enabled=_ON,
            drift_p4_enabled=_ON,
        )
    )
    assert (state.enabled, state.p1) == (True, True)
    assert (state.p2, state.p3, state.p4) == (False, False, False)
    assert state.highest_open_phase == 1


@pytest.mark.asyncio
async def test_a_missing_row_in_the_middle_is_a_gap():
    """Fehlende Zeile und ``false`` müssen dasselbe bedeuten — sonst wäre eine
    ungeschriebene Zeile durchlässiger als eine geschriebene."""
    state = await _state(_rows(drift_p0_enabled=_ON, drift_p1_enabled=_ON, drift_p3_enabled=_ON, drift_p4_enabled=_ON))
    assert state.highest_open_phase == 1
    assert state.p2 is False


@pytest.mark.asyncio
async def test_all_five_open():
    state = await _state(dict.fromkeys(_PHASE_GATE_KEYS, _ON))
    assert (state.enabled, state.p1, state.p2, state.p3, state.p4) == (True, True, True, True, True)
    assert state.highest_open_phase == 4


# ── Der Querschalter ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ai_hangs_on_p0_not_on_the_ladder():
    """``ai`` ist offen, sobald P0 offen ist — es wartet nicht auf P4."""
    state = await _state(_rows(drift_p0_enabled=_ON, drift_ai_enabled=_ON))
    assert state.ai is True
    assert state.p4 is False


@pytest.mark.asyncio
async def test_ai_is_closed_while_drift_itself_is_closed():
    """Eine Texterzeugung für ein abgeschaltetes Merkmal wäre eine Zusage ohne Welt."""
    state = await _state(_rows(drift_p0_enabled=_OFF, drift_ai_enabled=_ON))
    assert state.ai is False


@pytest.mark.asyncio
async def test_ai_off_while_drift_runs():
    state = await _state(_rows(drift_p0_enabled=_ON, drift_ai_enabled=_OFF))
    assert (state.enabled, state.ai) == (True, False)


# ── Eine Regel, eine Stelle ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_assert_p0_raises_when_the_gate_is_closed():
    with patch(
        "backend.services.drift_service.load_platform_settings",
        AsyncMock(return_value={}),
    ):
        with pytest.raises(HTTPException) as excinfo:
            await DriftService.assert_p0_enabled(AsyncMock())
    assert excinfo.value.status_code == 404


@pytest.mark.asyncio
async def test_assert_p0_passes_when_the_gate_is_open():
    with patch(
        "backend.services.drift_service.load_platform_settings",
        AsyncMock(return_value=_rows(drift_p0_enabled=_ON)),
    ):
        await DriftService.assert_p0_enabled(AsyncMock())


@pytest.mark.asyncio
async def test_assert_p0_and_the_snapshot_read_the_same_thing():
    """Die Zusage aus dem Docstring, als Test: beide dürfen nie auseinanderlaufen.

    Geprüft am Grenzfall — die Zeile steht auf einem Wert, den der Positiv-Abgleich
    NICHT als wahr liest. Ein zweiter, großzügigerer Parser an der zweiten Stelle
    fiele genau hier auf.
    """
    rows = _rows(drift_p0_enabled="ture")
    with patch(
        "backend.services.drift_service.load_platform_settings",
        AsyncMock(return_value=rows),
    ):
        snapshot = await DriftService.get_public_state(AsyncMock())
        with pytest.raises(HTTPException):
            await DriftService.assert_p0_enabled(AsyncMock())
    assert snapshot.enabled is False


# ── Die Leiter ist an den Vertrag gebunden ─────────────────────────────────


def test_every_ladder_key_is_a_declared_platform_gate():
    """Sonst läse der Dienst einen Schlüssel, den die Oberfläche nicht kennt."""
    declared = {gate.key for gate in PLATFORM_GATES}
    unknown = sorted(set(_DRIFT_GATE_KEYS) - declared)
    assert not unknown, f"Der Dienst liest Tore, die kein Vertrag erklärt: {unknown}"


def test_every_declared_drift_gate_is_read_or_read_in_sql():
    """Und umgekehrt: ein erklärtes DRIFT-Tor, das die Leiter nicht kennt, wäre
    entweder vergessen oder wird woanders gelesen.

    ``drift_fun_core_enabled`` ist der eine erlaubte Fall — es wird ausschließlich
    in SQL geprüft (jede Fun-Kern-RPC liest es in der Transaktion, Migration 264),
    absichtlich nicht über einen HTTP-Vorabtest: der überführe die Unterscheidung
    zwischen „nichts Neues anlegen" und „Vorhandenes zu Ende bringen" in ein
    pauschales 404.
    """
    sql_only = {"drift_fun_core_enabled"}
    declared = {gate.key for gate in PLATFORM_GATES if gate.group == "drift"}
    missing = sorted(declared - set(_DRIFT_GATE_KEYS) - sql_only)
    assert not missing, f"Erklärte DRIFT-Tore, die niemand liest: {missing}"


def test_the_ladder_is_ordered_p0_to_p4():
    """Der Index IST die Phasennummer — ``highest_open_phase`` verlässt sich darauf."""
    assert _PHASE_GATE_KEYS[0] == "drift_p0_enabled"
    assert list(_PHASE_GATE_KEYS[1:]) == [f"drift_p{n}_enabled" for n in range(1, 5)]
    assert _AI_GATE_KEY not in _PHASE_GATE_KEYS
