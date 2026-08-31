"""Wo ein Agent ist, wird an einer Stelle beantwortet — und der Botschafter geht vor.

WARUM DIE REIHENFOLGE EINEN TEST BEKOMMT
Auf Prod gemessen (31.08.2026, 258 Agenten): **alle 14 Botschafter haben auch
ein `current_building_id`.** Gewänne der Posten, wäre `on_assignment`
unerreichbar — eine Beschriftung, deren Zustand nie eintreten kann. Dieselbe
Überlegung, aus der die fünfte Beschriftung („Zählt") gar nicht erst gebaut
wurde: eine Tür, die sich nur für die öffnet, die schon drin sind.

Die Regel steht deshalb in der Sicht `agent_presence` und nirgends sonst. Ein
Refactor, der die beiden `WHEN`-Zweige tauscht, tötet `on_assignment` lautlos —
kein Fehler, keine Ausnahme, nur eine Zeile, die nie mehr erscheint. Dieser Test
liest die Sicht aus der Migration und besteht darauf, dass der Botschafter oben
steht.
"""

from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.chat_service import ChatService

REPO = Path(__file__).resolve().parents[3]

#: Über den INHALT gesucht, nicht über eine Nummer. Eine Migrationsnummer kann
#: sich ändern, ohne dass sich ihr Inhalt ändert — am 31.08. musste genau das
#: passieren (kollidierender Zeitstempel), und ein Test mit wörtlichem Pfad
#: meldete danach „nicht gefunden" statt „stimmt nicht".
_VIEW = "CREATE OR REPLACE VIEW public.agent_presence"


def _view_sql() -> str:
    for path in sorted((REPO / "supabase" / "migrations").glob("*.sql"), reverse=True):
        text = path.read_text(encoding="utf-8")
        if _VIEW in text:
            return text[text.index(_VIEW) :]
    raise AssertionError("agent_presence in keiner Migration gefunden")


def test_the_ambassador_branch_comes_before_the_building_branch() -> None:
    sql = _view_sql()
    amb = sql.find("active_ambassadors")
    building = sql.find("current_building_id")
    zone = sql.find("current_zone_id")
    assert amb > 0 and building > 0 and zone > 0, "ein Zweig fehlt in der Sicht"
    assert amb < building, (
        "Der Posten steht vor dem Botschafter. Alle 14 Botschafter haben auch "
        "einen Posten — `on_assignment` wäre damit unerreichbar."
    )
    assert building < zone, "Zone vor Posten: ein Agent im Gebäude gilt als unterwegs"


def test_the_view_runs_as_the_caller() -> None:
    """Ohne `security_invoker` liefe sie als Eigentümer und die RLS von `agents`
    griffe nicht — sie stünde dann von Hand in der WHERE-Klausel, wo sie beim
    nächsten Mal jemand vergisst."""
    assert re.search(r"WITH \(security_invoker\s*=\s*on\)", _view_sql())


def _client(rows: list[dict] | Exception) -> MagicMock:
    client = MagicMock()
    execute = AsyncMock(
        side_effect=rows if isinstance(rows, Exception) else None,
        return_value=None if isinstance(rows, Exception) else SimpleNamespace(data=rows),
    )
    chain = MagicMock()
    chain.select.return_value = chain
    chain.in_.return_value = SimpleNamespace(execute=execute)
    client.table.return_value = chain
    return client


@pytest.mark.asyncio
async def test_presence_is_attached_to_the_agents_that_have_one() -> None:
    agents = [{"id": "a1", "name": "Vasquez"}, {"id": "a2", "name": "Osei"}]
    client = _client([{"agent_id": "a1", "presence": "on_assignment"}])
    await ChatService._enrich_presence(client, agents)
    assert agents[0]["presence"] == "on_assignment"
    assert "presence" not in agents[1], "ein Agent ohne Zeile darf nichts behaupten"


@pytest.mark.asyncio
async def test_a_failing_read_leaves_the_answer_intact() -> None:
    """Die Nachrichten sind der Zweck der Antwort, der Zustand eine Zugabe.

    Fällt die Sicht aus, bleibt `presence` weg — und weg heisst „niemand hat es
    gesagt", worauf die Oberfläche keine Statuszeile zeigt statt einer erfundenen.
    """
    agents = [{"id": "a1", "name": "Vasquez"}]
    await ChatService._enrich_presence(_client(RuntimeError("kein Recht")), agents)
    assert "presence" not in agents[0]
    assert agents[0]["name"] == "Vasquez"


@pytest.mark.asyncio
async def test_an_empty_list_costs_no_query() -> None:
    client = _client([])
    await ChatService._enrich_presence(client, [])
    client.table.assert_not_called()
