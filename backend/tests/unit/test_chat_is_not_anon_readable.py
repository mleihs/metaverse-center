"""Vier anonyme Leserichtlinien der Chat-Familie müssen fallen.

Gemessen am 31.08.2026 auf Prod mit `SET LOCAL ROLE anon`:

    chat_conversations   anon sah  3 von  3
    chat_messages        anon sah 22 von 22

Es waren nicht die Titel, es waren die Texte. Und auf jeder der vier Tabellen
stand DANEBEN eine an `auth.uid()` gebundene SELECT-Richtlinie — ein
angemeldeter Nutzer sah also 0, ein anonymer 3.

🔑 Zwei Richtlinien auf derselben Tabelle, die einander widersprechen; die
anonyme gewinnt, weil Richtlinien mit ODER verknüpft werden. Beides kann nicht
stimmen: entweder ist die Tabelle absichtlich öffentlich (dann ist die
eigentümergebundene Richtlinie irreführend) oder versehentlich offen. Der Nutzer
hat am 31.08.2026 entschieden: nicht öffentlich.

Dieser Test bindet Migration 317 an drei Aussagen:

1. Alle VIER anonymen Richtlinien fallen — nicht nur die zwei, die aufgefallen
   sind. Eine halbe Reparatur wäre hier schlimmer als keine: sie liesse die
   Nachrichten offen und behauptete, das Thema sei erledigt.
2. Die eigentümergebundenen Richtlinien bleiben. Ein `DROP` zu viel bestünde
   die erste Prüfung ebenfalls — und der Chat wäre für seinen eigenen Nutzer
   leer.
3. `epoch_chat_messages` wird NICHT angefasst. Spieler-Kommunikation im Spiel
   ist eine eigene Frage, keine Nebenwirkung dieser.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase/migrations/20260901000000_317_a_conversation_is_not_a_fact_of_the_world.sql"
)

#: Tabelle → Name der anonymen Leserichtlinie, die fallen muss.
_ANON_POLICIES = {
    "chat_conversations": "conversations_anon_select",
    "chat_messages": "messages_anon_select",
    "chat_conversation_agents": "chat_conv_agents_anon_select",
    "chat_event_references": "chat_event_refs_anon_select",
}


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert len(text) > 1000, "Migration verdächtig kurz — liest der Test die richtige Datei?"
    return text


@pytest.fixture(scope="module")
def statements(sql: str) -> str:
    """Nur der ausführbare Teil, OHNE den Rücknahme-Block am Ende.

    Zwei Gründe, beide schon einmal teuer gewesen:

    * Der Kopf zitiert die Richtlinien, die er entfernt — er stünde im
      Textscan vor dem Gegenstand.
    * Der Fuss enthält die vier `CREATE POLICY` der Rücknahme, auskommentiert.
      Ein Scan nach `CREATE POLICY ... anon` fände sie und meldete, die
      Migration lege die Richtlinien wieder an.
    """
    body = sql[sql.index("BEGIN;") :]
    marker = "-- Rücknahme, falls die Entscheidung gedreht wird"
    return body[: body.index(marker)] if marker in body else body


class TestDerKopfUndDerFussDuerfenDenBefundNennen:
    """Gegenproben zum Abstreifen — beide Enden MÜSSEN etwas enthalten."""

    def test_header_carries_the_measurement(self, sql: str) -> None:
        header = sql[: sql.index("BEGIN;")]
        assert "22 von 22" in header, "Der Kopf muss die gemessene Reichweite nennen"
        assert "auth.uid()" in header, "Der Kopf muss die Gegenrichtlinie nennen"

    def test_footer_carries_the_rollback(self, sql: str) -> None:
        """Eine Entscheidung, die gedreht werden kann, braucht ihren Weg zurück."""
        footer = sql[sql.index("-- Rücknahme, falls die Entscheidung gedreht wird") :]
        for policy in _ANON_POLICIES.values():
            assert policy in footer, f"Die Rücknahme nennt {policy} nicht"


class TestAlleVierFallen:
    @pytest.mark.parametrize(("table", "policy"), sorted(_ANON_POLICIES.items()))
    def test_policy_is_dropped(self, statements: str, table: str, policy: str) -> None:
        pattern = rf"DROP POLICY IF EXISTS\s+{policy}\s+ON public\.{table}"
        assert re.search(pattern, statements), f"{table}.{policy} wird nicht entfernt"

    def test_exactly_four_and_no_more(self, statements: str) -> None:
        """Kein DROP auf einer Tabelle, die hier nichts zu suchen hat."""
        dropped = re.findall(r"DROP POLICY IF EXISTS\s+(\S+)\s+ON public\.(\S+);", statements)
        assert len(dropped) == 4, f"Erwartet 4 DROP POLICY, gefunden {len(dropped)}: {dropped}"
        assert {t for _, t in dropped} == {f"{t}" for t in _ANON_POLICIES}


class TestDieGegenrichtlinienBleiben:
    def test_acceptance_counts_the_owner_policies(self, statements: str) -> None:
        assert "v_eigentuemer <> 4" in statements, (
            "Der Abnahmeblock prüft nicht, dass die vier eigentümergebundenen "
            "Richtlinien stehen bleiben — ein DROP zu viel fiele nicht auf"
        )
        assert "auth.uid()" in statements, "Die Prüfung erkennt die Gegenrichtlinie nicht"

    def test_acceptance_refuses_an_empty_measurement(self, statements: str) -> None:
        """Auf leeren Tabellen bestünde jede Sperre."""
        assert "Nichts zu verbergen" in statements
        assert re.search(r"v_gespraeche = 0 OR v_nachrichten = 0", statements)

    def test_no_policy_is_created(self, statements: str) -> None:
        assert "CREATE POLICY" not in statements, "Die Migration legt eine Richtlinie an — sie soll nur entfernen"


class TestEpochChatBleibtUnberuehrt:
    """Spieler-Kommunikation im Spiel ist eine eigene Frage."""

    def test_epoch_chat_is_not_touched(self, statements: str) -> None:
        assert "epoch_chat_messages" not in statements
        assert "epoch_chat_select_anon" not in statements

    def test_the_header_says_so(self, sql: str) -> None:
        """Und zwar ausdrücklich — sonst hält die nächste Sitzung es für vergessen."""
        header = sql[: sql.index("BEGIN;")]
        assert "epoch_chat_messages" in header, "Der Kopf muss nennen, was bewusst NICHT mitgeht"


class TestDieWeltBleibtOeffentlich:
    """Public-First gilt für die Welt, nicht für die Handlungen des Menschen."""

    @pytest.mark.parametrize("table", ("agents", "buildings", "events", "zones", "simulations"))
    def test_no_world_table_is_touched(self, statements: str, table: str) -> None:
        assert f"ON public.{table};" not in statements
