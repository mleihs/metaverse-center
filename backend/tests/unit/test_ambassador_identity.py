"""Ein Botschafter wird an seiner Kennung erkannt, nicht an seinem Namen (D12/S16).

`fn_compute_agent_influence` verglich den NAMEN des Agenten mit einem Namen im
Botschafts-Wörterbuch. Gemessen auf Prod am 31.08.2026:

    40 Botschaften, alle aktiv
    37 tragen einen `ambassador_a`-Block
      davon mit `name`:     37
      davon mit `agent_id`:  9
      davon mit `id`:        0
    mehrdeutige Agentennamen je Welt: 0

Der Vergleich hält also HEUTE, und nur deshalb: es gibt zufällig keinen
doppelten Namen. Er hört geräuschlos auf zu halten, sobald zwei Agenten
denselben Namen tragen oder einer umbenannt wird — ein Name, der nicht mehr
passt, sieht genau aus wie ein Agent, der kein Botschafter ist. Der
Botschafteranteil ist 0,3 von 1,0 der Einflusszahl.

Im Wegwerf-Postgres gegenübergestellt, zwei Agenten desselben Namens, einer
davon per `agent_id` als Botschafter benannt:

    Name          alte Fassung   neue Fassung
    Alma Vetter        0,450          0,450     ← die benannte
    Alma Vetter        0,450          0,150     ← die andere
    Nur Namen          0,450          0,450     ← Rückfall auf den Namen

Die alte Fassung machte aus einer Namensgleichheit einen zweiten Botschafter.

Diese Datei bindet die SQL-Seite an die Python-Seite. Beide müssen in derselben
Reihenfolge auflösen: die eine speist die Einflusszahl, die andere das
Abzeichen auf der Agentenkarte, und ein Agent, der auf der Karte Botschafter
ist und in der Zahl nicht, ist schlimmer als beides falsch.
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260831127000_304_ambassador_is_identified_by_id.sql"


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _body(sql: str) -> str:
    """Nur der Funktionskörper — der Kopfkommentar erklärt den Befund (J3b)."""
    start = sql.index("AS $function$")
    return re.sub(r"--[^\n]*", "", sql[start : sql.index("$function$;", start)])


class TestTheGateItself:
    def test_the_body_is_isolated_from_the_explanation(self, sql: str) -> None:
        body = _body(sql)
        assert "ambassador_a" in body, "der Körper wurde nicht gefunden"
        assert "BEFUND" not in body, "der Kopfkommentar ist mitgelesen worden"
        assert len(body) < len(sql)


class TestTheSqlResolvesIdFirst:
    def test_both_paths_exist(self, sql: str) -> None:
        body = _body(sql)
        assert "->>'agent_id'" in body, "die Kennung wird nicht gelesen"
        assert "->>'name'" in body, (
            "der Namens-Rückfall fehlt — 28 von 37 Botschaften tragen keine Kennung"
        )

    def test_the_name_only_applies_when_there_is_no_id(self, sql: str) -> None:
        """Sonst wäre der Rückfall kein Rückfall, sondern ein zweiter Weg hinein."""
        body = _body(sql)
        for side in ("ambassador_a", "ambassador_b"):
            guard = f"e.embassy_metadata->'{side}'->>'agent_id' IS NULL"
            assert guard in body, f"der Namensvergleich für {side} ist nicht an die fehlende Kennung gebunden"

    def test_both_sides_of_the_embassy_are_handled(self, sql: str) -> None:
        body = _body(sql)
        assert body.count("->>'agent_id'") >= 4, "eine der beiden Seiten fehlt"

    def test_the_weights_are_untouched(self, sql: str) -> None:
        """Diese Migration ändert die Identität, nicht die Gewichtung."""
        body = _body(sql)
        assert "* 0.4" in body and "* 0.3" in body
        assert body.count("* 0.3") == 2, "Professions- und Botschafteranteil müssen beide 0,3 sein"


class TestThePythonResolvesTheSameWay:
    def test_it_collects_ids_and_names(self) -> None:
        from backend.services.agent_service import AgentService

        source = inspect.getsource(AgentService._enrich_ambassador_flag)
        assert 'block.get("agent_id")' in source, "die Kennung wird nicht gelesen"
        assert 'block.get("name")' in source, "der Namens-Rückfall fehlt"

    def test_the_id_is_checked_before_the_name(self) -> None:
        from backend.services.agent_service import AgentService

        source = inspect.getsource(AgentService._enrich_ambassador_flag)
        line = next(row for row in source.splitlines() if "is_ambassador = " in row and "or" in row)
        assert line.index("ambassador_ids") < line.index("ambassador_names"), (
            "die Kennung muss zuerst geprüft werden, sonst entscheidet wieder der Name"
        )

    def test_the_blocked_until_rule_survived(self) -> None:
        """Ein gesperrter Botschafter zählt nicht — in beiden Fassungen."""
        from backend.services.agent_service import AgentService

        source = inspect.getsource(AgentService._enrich_ambassador_flag)
        assert "ambassador_blocked_until" in source
        assert "is_ambassador = False" in source


class TestTheTwoSidesAgree:
    def test_both_name_the_same_two_fields(self, sql: str) -> None:
        from backend.services.agent_service import AgentService

        body = _body(sql)
        python = inspect.getsource(AgentService._enrich_ambassador_flag)
        for field in ("agent_id", "name"):
            assert f"'{field}'" in body, f"{field} fehlt in SQL"
            assert f'"{field}"' in python, f"{field} fehlt in Python"
        for side in ("ambassador_a", "ambassador_b"):
            assert f"'{side}'" in body, f"{side} fehlt in SQL"
            assert f'"{side}"' in python, f"{side} fehlt in Python"
