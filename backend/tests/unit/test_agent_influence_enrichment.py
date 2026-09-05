"""Der Einfluss kommt vom Server, oder er kommt nicht.

D13 / H7. `fn_compute_agent_influence` existiert seit Migration 158 und speiste
ausschließlich `mv_building_readiness`. Es gab kein agentenbezogenes Feld, also
rechnete das Frontend die Formel im Browser nach — die vierte handkopierte
Fassung im Werk, von denen eine nachweislich abgewichen ist (S21).

Die Agentenkarte konnte sie überhaupt nicht rechnen: sie lädt keine
Beziehungen. Eine halbe Zahl auf die Karte zu schreiben wäre genau der Zustand
gewesen, den H7 gerade beseitigt hat.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import httpx
import pytest

from backend.services.agent_service import AgentService


class _Result:
    def __init__(self, data):
        self.data = data


def _admin_with(rows, *, raises: Exception | None = None) -> MagicMock:
    admin = MagicMock()
    rpc = MagicMock()
    if raises is not None:
        rpc.execute = AsyncMock(side_effect=raises)
    else:
        rpc.execute = AsyncMock(return_value=_Result(rows))
    admin.rpc = MagicMock(return_value=rpc)
    return admin


class TestTheValueComesFromTheServer:
    @pytest.mark.asyncio
    async def test_each_agent_receives_its_own_score(self):
        a, b = str(uuid4()), str(uuid4())
        agents = [{"id": a}, {"id": b}]
        admin = _admin_with([{"agent_id": a, "influence": 0.32}, {"agent_id": b, "influence": 0.07}])
        await AgentService._enrich_influence(admin, uuid4(), agents)
        assert agents[0]["influence"] == pytest.approx(0.32)
        assert agents[1]["influence"] == pytest.approx(0.07)

    @pytest.mark.asyncio
    async def test_one_call_for_the_whole_list(self):
        """Zwanzig Karten dürfen nicht zwanzig Umläufe kosten."""
        agents = [{"id": str(uuid4())} for _ in range(20)]
        admin = _admin_with([])
        await AgentService._enrich_influence(admin, uuid4(), agents)
        assert admin.rpc.call_count == 1
        _, params = admin.rpc.call_args.args
        assert len(params["p_agent_ids"]) == 20

    @pytest.mark.asyncio
    async def test_an_empty_list_asks_nothing(self):
        admin = _admin_with([])
        await AgentService._enrich_influence(admin, uuid4(), [])
        admin.rpc.assert_not_called()


class TestAMissingValueIsNotAZero:
    @pytest.mark.asyncio
    async def test_a_failed_call_leaves_the_field_unset(self):
        """`None` heißt „nicht gemessen". Eine 0 hieße „gemessen, und zwar null" —
        das ist eine andere Aussage, und die Oberfläche zeigt darauf ein
        Abzeichen, das niemand belegen kann."""
        agents = [{"id": str(uuid4())}]
        admin = _admin_with(None, raises=httpx.ConnectError("down"))
        await AgentService._enrich_influence(admin, uuid4(), agents)
        assert agents[0]["influence"] is None

    @pytest.mark.asyncio
    async def test_an_agent_missing_from_the_answer_stays_unset(self):
        a, b = str(uuid4()), str(uuid4())
        agents = [{"id": a}, {"id": b}]
        admin = _admin_with([{"agent_id": a, "influence": 0.4}])
        await AgentService._enrich_influence(admin, uuid4(), agents)
        assert agents[0]["influence"] == pytest.approx(0.4)
        assert agents[1]["influence"] is None

    @pytest.mark.asyncio
    async def test_a_null_score_in_the_answer_is_not_read_as_zero(self):
        a = str(uuid4())
        agents = [{"id": a}]
        admin = _admin_with([{"agent_id": a, "influence": None}])
        await AgentService._enrich_influence(admin, uuid4(), agents)
        assert agents[0]["influence"] is None


class TestEveryReadPathIsCovered:
    def test_all_three_read_paths_enrich(self):
        """Der öffentliche Leseweg nutzt dieselben drei Methoden. Fehlte die
        Anreicherung an einer, unterschiede sich die Karte danach, WER zusieht."""
        source = textwrap.dedent(inspect.getsource(AgentService))
        tree = ast.parse(source)

        enriched: set[str] = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            calls = {
                n.func.attr for n in ast.walk(node) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
            }
            if "_enrich_influence" in calls:
                enriched.add(node.name)

        # Die Kontrollfrage zuerst: findet der Scan überhaupt etwas? Ein Test,
        # der eine leere Menge mit einer leeren Menge vergleicht, besteht immer.
        assert enriched, "Der AST-Scan fand keine einzige Aufrufstelle"
        # `get_with_details`, nicht `get`: der Einzelabruf heißt so, und der
        # öffentliche Weg ruft ihn seit heute ebenfalls. Meine erste Fassung
        # erwartete `get` und wurde rot — die Annahme war meine, nicht die
        # des Codes, und der rote Test hat einen echten Befund freigelegt:
        # der öffentliche Weg rief das GEERBTE `BaseService.get` und lieferte
        # damit die nackte Zeile ohne Botschafterfeld.
        assert enriched == {"list", "get_by_slug", "get_with_details"}, enriched

    def test_the_ambassador_flag_covers_the_same_paths(self):
        """Beide Anreicherungen müssen dieselben Wege abdecken; eine, die einen
        Weg ausließe, wäre an genau dieser Stelle unsichtbar."""
        source = textwrap.dedent(inspect.getsource(AgentService))
        tree = ast.parse(source)
        by_helper: dict[str, set[str]] = {"_enrich_influence": set(), "_enrich_ambassador_flag": set()}
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            for n in ast.walk(node):
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
                    if n.func.attr in by_helper:
                        by_helper[n.func.attr].add(node.name)
        assert by_helper["_enrich_influence"], "kein Fund"
        assert by_helper["_enrich_influence"] == by_helper["_enrich_ambassador_flag"]
