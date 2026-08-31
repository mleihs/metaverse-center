"""`conversation_summaries` darf nicht mehr für anon/authenticated lesbar sein.

Die Sicht verbindet `chat_conversations` mit `agents` und läuft ohne
`security_invoker` als ihr Eigentümer — die RLS der Basistabelle greift also
nicht. Gemessen am 31.08.2026 auf Prod, für ein und dieselben drei Zeilen:

    Weg                                      anon   authenticated
    chat_conversations  (Basistabelle, RLS)     3         0
    conversation_summaries (Sicht)              3         3

Die Null ist der Befund. `chat_conversations_select` lautet
`user_id = (SELECT auth.uid())` — ein angemeldeter Nutzer sieht nur seine
eigenen Gespräche. Über die Sicht sah er alle, samt `user_id`, `title`,
`message_count` und `last_message_at`.

Die Drei bei `anon` ist KEIN Befund dieser Migration: `conversations_anon_select`
öffnet Gespräche aktiver Welten ausdrücklich für anonyme Leser (Public-First).
Ob Titel und `user_id` öffentlich gehören, ist eine Produktentscheidung und
steht als eigener Punkt im TODO.

🔑 Zum zweiten Mal an einem Tag derselbe halbe Satz: Migration 294 hat acht
Sichten mit „their base tables grant `anon` the same access by policy" stehen
lassen. Für `anon` trägt er. Für `authenticated` trägt er hier nicht — so wie
er in Migration 313 für die Elternwelt nicht trug.

Die Sicht hat null Verwender (weder `backend/`, noch `frontend/src/`, noch eine
RPC). Migration 316 entzieht deshalb nur und löscht nicht: Entzug ist
rücknehmbar.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[3] / "supabase/migrations/20260831235000_316_a_dead_view_is_still_a_window.sql"
)

_VIEW = "conversation_summaries"


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert len(text) > 1000, "Migration verdächtig kurz — liest der Test die richtige Datei?"
    return text


@pytest.fixture(scope="module")
def statements(sql: str) -> str:
    """Nur der ausführbare Teil.

    Der Kopf zitiert die Messung und den Satz aus 294, den er widerlegt — er
    stünde in einem Textscan vor dem Gegenstand. Dieselbe Falle wie beim
    Docstring von `_parse_or_repair_json`.
    """
    return sql[sql.index("BEGIN;") :]


class TestDerKopfNenntDenBefundWeiterhin:
    """Gegenprobe zum Abstreifen: der Kopf DARF und SOLL den Befund nennen."""

    def test_header_carries_the_measurement(self, sql: str) -> None:
        header = sql[: sql.index("BEGIN;")]
        assert "security_invoker" in header
        assert "auth.uid()" in header, "Der Kopf muss die Richtlinie nennen, die die Sicht umgeht"
        assert "294" in header, "Der Kopf muss die Migration nennen, deren Prämisse nicht trug"


class TestDasFensterIstZu:
    def test_grant_is_revoked_from_both_roles(self, statements: str) -> None:
        line = next(
            (ln for ln in statements.splitlines() if f"REVOKE SELECT ON public.{_VIEW}" in ln),
            None,
        )
        assert line is not None, f"{_VIEW} behält den Grant"
        assert "anon" in line and "authenticated" in line, "beide Rollen müssen entzogen werden, nicht nur eine"

    def test_security_invoker_is_set(self, statements: str) -> None:
        assert f"ALTER VIEW public.{_VIEW} SET (security_invoker = on)" in statements

    def test_service_role_is_not_revoked(self, statements: str) -> None:
        """Wie in 294: das Backend muss die Sicht weiter lesen können."""
        revokes = [ln for ln in statements.splitlines() if "REVOKE" in ln]
        assert revokes, "keine REVOKE-Zeile gefunden"
        for ln in revokes:
            assert "service_role" not in ln, "Die Migration entzieht service_role etwas — dann läge das Backend trocken"


class TestDieAbnahmeMisstBeideRichtungen:
    def test_privileges_are_asserted(self, statements: str) -> None:
        assert "has_table_privilege('anon'" in statements
        assert "has_table_privilege('authenticated'" in statements
        assert "has_table_privilege('service_role'" in statements

    def test_counter_probe_keeps_the_view_resolvable(self, statements: str) -> None:
        """Ein `ALTER VIEW`, das die Sicht zerschösse, bestünde die Rechteprüfung auch."""
        assert "Gegenprobe" in statements, "Der Abnahmeblock hat keine Gegenprobe"
        assert re.search(rf"PERFORM 1 FROM public\.{_VIEW}", statements), "Die Gegenprobe liest die Sicht nicht"

    def test_it_raises_instead_of_noticing(self, statements: str) -> None:
        assert statements.count("RAISE EXCEPTION") >= 3, (
            "Jede der drei Aussagen (Entzug, service_role, security_invoker) braucht ihr eigenes Tor"
        )


class TestDieMigrationLoeschtNicht:
    """Null Verwender ist ein Grund zu entziehen, nicht zu löschen."""

    @pytest.mark.parametrize("verb", ("DROP VIEW", "DELETE FROM", "TRUNCATE"))
    def test_no_destructive_statement(self, statements: str, verb: str) -> None:
        assert verb not in statements.upper(), f"Die Migration enthält {verb}"
