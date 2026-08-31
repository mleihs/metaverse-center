"""Die drei öffentlichen Sichten müssen die Welt ihres Kindes mitprüfen.

Migration 294 hat elf Sichten geprüft und acht mit der Begründung stehen
lassen, „ihre Basistabellen gewähren `anon` dasselbe per Richtlinie". Für das
`deleted_at` des Kindes stimmt der Satz. Für die Elternwelt nicht:

    agents_anon_select:  deleted_at IS NULL
                         AND EXISTS (SELECT 1 FROM simulations
                                     WHERE id = agents.simulation_id
                                       AND status = 'active'
                                       AND deleted_at IS NULL)

    active_agents (bis 313):  WHERE deleted_at IS NULL

Die Sicht läuft ohne `security_invoker` als ihr Eigentümer, die RLS greift also
gar nicht — gemessen am 31.08.2026 auf Prod waren dadurch **30 Agenten und
34 Bauten aus fünf gelöschten Welten anonym lesbar**.

Dieser Test bindet Migration 313 an drei Aussagen, die eine spätere Sitzung
nicht versehentlich zurücknehmen soll:

1. Jede der drei Sichten prüft die Elternwelt.
2. Keine der drei filtert `status` — das ist die bewusst NICHT getroffene
   Entscheidung (`active_agents` ist auch der Mitglieder-Lesepfad; eine
   archivierte Welt gehört weiterhin ihren Verwaltern).
3. Der Abnahmeblock hat eine Gegenprobe. Ein Filter, der ALLES wegnimmt,
   bestünde die Waisen-Prüfung ebenfalls — vgl. die drei Fehlmessungen vom
   31.08., alle in derselben Form: das Messgerät prüfte die Schreibweise
   statt der Sache.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase/migrations/20260831215000_313_a_view_must_remember_whose_world_it_is.sql"
)

_VIEWS = ("active_agents", "active_buildings", "active_events")


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert len(text) > 1000, "Migration verdächtig kurz — liest der Test die richtige Datei?"
    return text


@pytest.fixture(scope="module")
def statements(sql: str) -> str:
    """Nur der ausführbare Teil.

    Der Kopf ERKLÄRT den Befund und zitiert dabei die alte, falsche Fassung der
    Sicht samt Richtlinie — er steht damit im Textscan vor dem Gegenstand.
    Derselbe Fallstrick wie beim Docstring von `_parse_or_repair_json`: nicht
    der Gegenstand, sondern seine Begründung sieht für die Prüfung aus wie der
    Gegenstand.
    """
    return sql[sql.index("BEGIN;") :]


def _view_body(statements: str, view: str) -> str:
    """Der SELECT einer Sicht, vom CREATE bis zum abschliessenden Semikolon."""
    start = statements.index(f"CREATE OR REPLACE VIEW {view} AS")
    end = statements.index(";", start)
    return statements[start:end]


class TestDerKopfNenntDenBefundWeiterhin:
    """Gegenprobe zum Abstreifen: der Kopf DARF und SOLL den Befund nennen."""

    def test_header_explains_the_finding(self, sql: str) -> None:
        header = sql[: sql.index("BEGIN;")]
        assert "security_invoker" in header, "Der Kopf muss die Ursache nennen"
        assert "294" in header, "Der Kopf muss die Migration nennen, deren Prämisse nicht trug"
        for zahl in ("30", "34"):
            assert zahl in header, f"Der Kopf muss die gemessene Zahl {zahl} nennen"


class TestJedeSichtPruefDieElternwelt:
    @pytest.mark.parametrize("view", _VIEWS)
    def test_view_is_replaced(self, statements: str, view: str) -> None:
        assert f"CREATE OR REPLACE VIEW {view} AS" in statements, f"{view} wird nicht ersetzt"

    @pytest.mark.parametrize("view", _VIEWS)
    def test_view_checks_the_parent_world(self, statements: str, view: str) -> None:
        body = _view_body(statements, view)
        normalised = re.sub(r"\s+", " ", body)
        assert "EXISTS" in normalised, f"{view}: keine Prüfung der Elternwelt"
        assert "FROM simulations s" in normalised, f"{view}: joint nicht auf simulations"
        assert "s.deleted_at IS NULL" in normalised, f"{view}: prüft die Elternwelt, aber nicht auf deleted_at"

    @pytest.mark.parametrize("view", _VIEWS)
    def test_view_still_checks_its_own_row(self, statements: str, view: str) -> None:
        """Die alte Bedingung darf nicht durch die neue ERSETZT werden."""
        normalised = re.sub(r"\s+", " ", _view_body(statements, view))
        own = re.findall(r"\b([abe])\.deleted_at IS NULL", normalised)
        assert own, f"{view}: das deleted_at der eigenen Zeile fehlt"


class TestKeinStatusfilter:
    """Die bewusst nicht getroffene Entscheidung.

    `status` in die Sicht zu nehmen wäre naheliegend — die anon-Richtlinie tut
    es — und würde einem Admin die Agenten seiner eigenen archivierten Welt
    verbergen. Heute fiele das nicht auf: es gibt keine archivierte Welt ohne
    `deleted_at`. Genau deshalb steht die Aussage hier.
    """

    @pytest.mark.parametrize("view", _VIEWS)
    def test_no_status_filter(self, statements: str, view: str) -> None:
        normalised = re.sub(r"\s+", " ", _view_body(statements, view))
        assert "status" not in normalised.lower(), (
            f"{view} filtert status — das verbirgt archivierte Welten vor ihren Verwaltern"
        )


class TestDieAbnahmeMisstBeideRichtungen:
    def test_orphans_are_asserted_gone(self, statements: str) -> None:
        assert "RAISE EXCEPTION" in statements
        assert "Kinder gelöschter Welten" in statements

    def test_counter_probe_exists(self, statements: str) -> None:
        """Ein Filter, der alles wegnimmt, bestünde die Waisen-Prüfung auch."""
        assert "Gegenprobe" in statements, "Der Abnahmeblock hat keine Gegenprobe"
        assert re.search(r"v_agenten_rest\s*=\s*0", statements), (
            "Die Gegenprobe prüft nicht, dass die Sicht nicht leer geworden ist"
        )

    def test_grants_are_asserted_intact(self, statements: str) -> None:
        """`CREATE OR REPLACE VIEW` behält die Rechte — behauptet die Doku.

        Ein verlorener Grant bricht den öffentlichen Lesepfad still (403, nicht
        500). Die Migration misst es, statt es zu glauben.
        """
        assert "has_table_privilege('anon'" in statements
        assert "anon-Grant" in statements


class TestDieMigrationLoeschtNichts:
    """Keine Kaskade: `restore_simulation` existiert und soll weiter tragen."""

    @pytest.mark.parametrize("verb", ("DELETE FROM", "TRUNCATE", "DROP TABLE"))
    def test_no_destructive_statement(self, statements: str, verb: str) -> None:
        assert verb not in statements.upper(), f"Die Migration enthält {verb}"

    def test_no_revoke(self, statements: str) -> None:
        assert "REVOKE" not in statements.upper(), (
            "Die Migration entzieht ein Recht — die drei Sichten sind der öffentliche Lesepfad"
        )
