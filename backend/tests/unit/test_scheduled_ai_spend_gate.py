"""Ein Zeitgeber darf nicht ohne Erlaubnis Geld ausgeben.

Gemessen auf Prod am 31.08.2026, nachdem der Herzschlag nach fünf Monaten
Stillstand wieder lief (Tick 46 → 50): **null Modellaufrufe**. Der letzte
OpenRouter-Aufruf überhaupt stammte vom 30.08. um 00:29 und war ein
Schmiede-Porträt — also von einem Menschen ausgelöst. Gesamtausgabe seit
Bestehen: 10,53 USD.

Der Herzschlag kostete also nichts. Aber er kostete nichts aus dem falschen
Grund: `_resolve_autonomy_key` gab genau dann keinen Schlüssel heraus, wenn
ZUFÄLLIG kein Weltbesitzer einen hinterlegt hatte — gemessen: 0 von 4
Geldbörsen. Und daneben stand `autonomy_admin_override`, ein Schalter, der die
PLATTFORMKASSE öffnet und niemanden fragt (gemessen: in keiner der 41 Welten
gesetzt, aber eben nur deshalb).

Eine Zusage, die von einer Abwesenheit lebt, ist keine Zusage. Diese Tests
halten die ausgesprochene Fassung fest:

* ohne `scheduled_ai_spend_enabled` bekommt kein Zeitgeber-Pfad einen
  Schlüssel — auch nicht über den Admin-Übersteuerer;
* die Sperre ist fail-closed: fehlende Zeile, jsonb-null, Tippfehler → aus;
* und sie ist EINE Engstelle: beide Modellpfade der Phase 9 (autonome
  Ereignisse, Bindungsflüstern) holen ihren Schlüssel durch dieselbe Funktion,
  was der letzte Test per AST festnagelt.

Wichtig ist, was NICHT geprüft wird: die Ticks selbst. Der Riegel schaltet die
Welt nicht ab, er macht sie still — Zonendruck, Katharsis und Beziehungen
laufen über den Vorlagenpfad weiter. Das ist der Unterschied zwischen „aus"
und „kostenlos".
"""

from __future__ import annotations

import ast
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from backend.services.heartbeat_service import HeartbeatService
from backend.utils.settings import SCHEDULED_AI_SPEND_SETTING, parse_setting_bool

SIM_ID = UUID("11111111-1111-1111-1111-111111111111")
_HEARTBEAT = Path(__file__).resolve().parents[2] / "services" / "heartbeat_service.py"


@pytest.mark.asyncio
@pytest.mark.parametrize("admin_override", [True, False])
async def test_no_key_without_the_platform_switch(admin_override: bool) -> None:
    """Der Admin-Übersteuerer kommt an der Sperre NICHT vorbei.

    Er ist der teurere der beiden Wege — er zahlt aus der Plattformkasse, nicht
    aus der Geldbörse eines Weltbesitzers. Deshalb steht die Sperre VOR ihm.
    """
    with patch(
        "backend.services.heartbeat_service.scheduled_ai_spend_allowed",
        new=AsyncMock(return_value=False),
    ):
        key, has_key = await HeartbeatService._resolve_autonomy_key(
            admin=object(),  # darf nicht berührt werden
            sim_id=SIM_ID,
            admin_override=admin_override,
        )
    assert key is None
    assert has_key is False, "ohne die Plattformsperre darf kein Zeitgeber-Pfad einen Schlüssel bekommen"


@pytest.mark.asyncio
async def test_switch_on_restores_the_admin_override() -> None:
    """Die Sperre ist ein Riegel, kein Ersatz für die bestehende Logik."""
    with patch(
        "backend.services.heartbeat_service.scheduled_ai_spend_allowed",
        new=AsyncMock(return_value=True),
    ):
        key, has_key = await HeartbeatService._resolve_autonomy_key(
            admin=object(),
            sim_id=SIM_ID,
            admin_override=True,
        )
    assert key is None, "der Übersteuerer nutzt den Plattformschlüssel, nicht einen eigenen"
    assert has_key is True


@pytest.mark.parametrize(
    "raw",
    [None, "", "false", "False", "0", "no", "off", "ja", "yes please", "null", {}, []],
)
def test_the_switch_is_fail_closed(raw: object) -> None:
    """Alles, was nicht ausdrücklich Ja sagt, heißt Nein.

    ``"ja"`` und ``"yes please"`` stehen absichtlich mit in der Liste: eine
    deutsche Eingabe oder ein halber Satz im Admin-Feld darf keine Dauerkosten
    scharfschalten. Die alte, liberale Auswertung (alles außer
    ``false``/``0``/``no``/``""`` war wahr) hätte beide durchgelassen — und
    ``None`` dazu, was der eigentliche Anlass für F32 war.

    ``"TRUE "`` mit Leerzeichen steht dagegen in der ANDEREN Liste: der Helfer
    trimmt ausdrücklich (auch die JSON-Anführungszeichen, die die Admin-UI
    schreibt). Das ist dokumentiertes Verhalten, kein Loch — hier stand
    zunächst meine Annahme gegen den Code, und der Code hatte recht.
    """
    assert parse_setting_bool(raw) is False


@pytest.mark.parametrize("raw", ["true", "1", "yes", "on", "TRUE", True])
def test_the_switch_can_be_armed(raw: object) -> None:
    """Sonst wäre der Riegel ein Mauerwerk und der Test unten wertlos."""
    assert parse_setting_bool(raw) is True


def test_both_model_paths_go_through_the_one_chokepoint() -> None:
    """Die Sperre steht einmal, weil beide Pfade durch eine Funktion gehen.

    Nach J3: dieser Scan meldet, wie viele Aufrufstellen er gefunden hat, und
    wird rot, wenn er keine findet. Ein Tor, das ins Leere zeigt, ist grün.
    """
    tree = ast.parse(_HEARTBEAT.read_text(encoding="utf-8"))

    call_sites = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "_resolve_autonomy_key"
    ]
    assert len(call_sites) >= 2, (
        f"nur {len(call_sites)} Aufrufe von _resolve_autonomy_key gefunden — erwartet werden "
        "mindestens zwei (autonome Ereignisse und Bindungsflüstern). Findet der Scan sie "
        "nicht, prüft dieser Test nichts."
    )

    # Und die Sperre steht IN dieser Funktion, nicht daneben.
    gate_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "scheduled_ai_spend_allowed"
    ]
    assert len(gate_calls) == 1, (
        f"{len(gate_calls)} Aufrufe von scheduled_ai_spend_allowed — die Sperre gehört an genau "
        "eine Stelle. Zwei Stellen laufen auseinander, null ist die Lage von vor dem 31.08.2026."
    )


def test_the_setting_key_is_the_one_the_admin_ui_would_write() -> None:
    """Ein Riegel, dessen Schlüsselname nur im Code steht, lässt sich nicht öffnen."""
    assert SCHEDULED_AI_SPEND_SETTING == "scheduled_ai_spend_enabled"
