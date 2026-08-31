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
#: Seit Migration 326 steht die Regel in der Sicht `active_ambassadors`; 304
#: bleibt die Datei, die die Kennung VOR den Namen gestellt hat.
#:
#: ⚠ Über den INHALT gesucht, nicht über Nummer oder Dateinamen. Diese Zeile
#: stand als wörtlicher Pfad auf `..._322_...` und brach, als die Datei am
#: 31.08.2026 nach 326 umnummeriert werden musste: ihr Zeitstempel kollidierte
#: mit einer zweiten Migration derselben Nummer aus einer anderen Sitzung, und
#: `version` ist der Primärschlüssel. Ein Test, der an einer Nummer hängt,
#: meldet nach so einer Umbenennung „nicht gefunden" statt „stimmt nicht" —
#: und eine Nummer ist genau die Sache, die sich ändern kann, ohne dass sich
#: der Inhalt ändert. Seit `scripts/lint-migration-order.sh` kollidiert nichts
#: mehr, aber umnummeriert wird trotzdem wieder werden.
_VIEW_DEFINITION = "CREATE OR REPLACE VIEW public.active_ambassadors"
SINGLE_SOURCE = next(
    (
        path
        for path in sorted((REPO / "supabase/migrations").glob("*.sql"), reverse=True)
        if _VIEW_DEFINITION in path.read_text(encoding="utf-8")
    ),
    REPO / "supabase/migrations/__active_ambassadors_nicht_gefunden__.sql",
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def view_sql() -> str:
    assert SINGLE_SOURCE.is_file(), f"Migration nicht gefunden: {SINGLE_SOURCE}"
    return SINGLE_SOURCE.read_text(encoding="utf-8")


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
        assert "->>'name'" in body, "der Namens-Rückfall fehlt — 28 von 37 Botschaften tragen keine Kennung"

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


class TestThePythonDoesNotResolveAtAll:
    """Seit Migration 322 gibt es die zweite Fassung nicht mehr.

    Diese Klasse hiess ``TestThePythonResolvesTheSameWay`` und prüfte, dass die
    Python-Kopie der Regel dieselben Felder in derselben Reihenfolge liest wie
    die SQL-Kopie. Das war die bestmögliche Prüfung, solange es ZWEI Kopien gab
    — und sie hat den Unterschied trotzdem nicht gefunden, den es gab: SQL prüft
    ``id ODER (id fehlt UND name)``, Python prüfte ``id ODER name`` und sammelte
    den Namen also auch aus Botschaften, die bereits eine Kennung tragen.

    Die Prüfung konnte ihn nicht finden, weil sie fragte, ob beide Seiten
    DIESELBEN FELDER nennen, nicht ob sie dieselbe ANTWORT geben. Zwei Regeln
    aus denselben Zutaten können verschiedene Gerichte sein.

    Auf Prod gemessen (31.08.2026): beide Fassungen fanden dieselben 14 Paare,
    Differenz 0/0 — die Abweichung war latent und wäre beim ersten doppelten
    Agentennamen aufgewacht, lautlos.

    Was jetzt geprüft wird, ist deshalb das Gegenteil: dass Python die Regel
    NICHT mehr kennt.
    """

    def test_python_reads_the_view_instead_of_deriving(self) -> None:
        from backend.services.agent_service import AgentService

        source = inspect.getsource(AgentService._enrich_ambassador_flag)
        assert "active_ambassadors" in source, (
            "die Anreicherung liest die Sicht nicht — dann gibt es wieder zwei Stellen"
        )

    def test_python_no_longer_knows_the_rule(self) -> None:
        """Kein Feldname der Botschafts-Struktur darf hier noch vorkommen."""
        from backend.services.agent_service import AgentService

        source = inspect.getsource(AgentService._enrich_ambassador_flag)
        # Nur den Code, ohne den Docstring — der DARF die Geschichte erzählen.
        code = source.split('"""')[-1]
        # Die Schlüsselform, nicht der blosse Teilstring: `ambassador_b` ist ein
        # Präfix von `ambassador_blocked_until`, und die erste Fassung dieses
        # Tests fand deshalb ihren eigenen Docstring. Ein Vergleich, der zu viel
        # findet, ist so unbrauchbar wie einer, der zu wenig findet.
        for leaked in ('"ambassador_a"', '"ambassador_b"', '"embassy_metadata"'):
            assert leaked not in code, f"{leaked} steht wieder im Python-Code — die Regel ist zurückgekehrt"

    def test_the_blocked_rule_moved_and_did_not_vanish(self, sql: str) -> None:
        """Die Sperre gilt weiter — sie steht jetzt in der Sicht, nicht in Python.

        Der Unterschied ist wichtig genug für einen eigenen Test: eine Regel,
        die aus einer Datei verschwindet, ist entweder umgezogen oder verloren,
        und die beiden sehen im Diff gleich aus.
        """
        from backend.services.agent_service import AgentService

        python = inspect.getsource(AgentService._enrich_ambassador_flag)
        assert "ambassador_blocked_until" not in python.split('"""')[-1], "die Sperrprüfung steht wieder in Python"
        assert "ambassador_blocked_until" in sql, "die Sperrprüfung fehlt in der Sicht"


class TestTheSingleSourceIsTheView:
    def test_the_view_carries_the_rule(self, view_sql: str) -> None:
        for field in ("agent_id", "name", "ambassador_a", "ambassador_b"):
            assert f"'{field}'" in view_sql, f"{field} fehlt in der Sicht"

    def test_the_influence_function_reads_the_view(self, view_sql: str) -> None:
        """Die Einflusszahl darf die Regel nicht ein zweites Mal ausschreiben."""
        assert "active_ambassadors" in view_sql
        # Der Funktionsrumpf beginnt nach dem CREATE FUNCTION und endet am
        # abschliessenden Dollar-Tag; nur dort darf die Regel nicht stehen.
        fn = view_sql.split("CREATE OR REPLACE FUNCTION")[-1]
        body = fn.split("AS $function$")[-1].split("$function$")[0]
        assert "embassy_metadata" not in body, "der Funktionsrumpf schreibt die Regel wieder aus"
