"""Migration 292 says what the game does — pinned against the file.

Two claims from the Systemprüfung, both about SQL that outlived its truth:

  D5  `fn_abandon_dungeon_run` never called `fn_apply_dungeon_outcome`.
      Completion and wipe called it from the start; only retreat did not.
  D12 `fn_wipe_dungeon_run` logged "All agents are lost." It applies -20 mood,
      +200 stress and one moodlet. Nobody is lost.

These read the migration file rather than a running database so they hold in CI
before the migration is applied anywhere. The behaviour itself was verified in a
throwaway Postgres (BEGIN … ROLLBACK) during the change: stress 100 → 340, a
`dungeon_retreat` moodlet, an activity row, and the old five-argument call still
resolving through the new DEFAULTs.
"""

from __future__ import annotations

from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase/migrations/20260831020000_292_retreat_costs_and_wipe_tells_the_truth.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert len(text) > 500, "Migration ist verdächtig kurz — liest der Test die richtige Datei?"
    return text


class TestRetreatCosts:
    def test_abandon_applies_outcomes(self, sql):
        assert "PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes)" in sql, (
            "Der Rückzug wendet keine Agenten-Ergebnisse an — er kostet wieder nichts"
        )

    def test_abandon_applies_loot(self, sql):
        assert "fn_apply_dungeon_loot(p_run_id, p_simulation_id, p_loot_items)" in sql

    def test_old_signature_is_dropped_not_overloaded(self, sql):
        """The lesson from Migration 289, applied one migration later.

        A `CREATE OR REPLACE` with two extra arguments creates an OVERLOAD in
        PostgreSQL rather than replacing — which is how `fn_apply_dungeon_loot`
        ended up with a maintained version nobody called.
        """
        assert "DROP FUNCTION IF EXISTS fn_abandon_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER)" in sql
        assert "CREATE OR REPLACE FUNCTION fn_abandon_dungeon_run" not in sql

    def test_new_parameters_have_defaults(self, sql):
        """So a five-argument call still resolves during the deploy window."""
        assert "p_agent_outcomes  JSONB DEFAULT '[]'::JSONB" in sql
        assert "p_loot_items      JSONB DEFAULT '[]'::JSONB" in sql

    def test_grants_are_restored_after_the_drop(self, sql):
        """A DROP takes the grants with it; they have to come back explicitly."""
        assert "GRANT EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER, JSONB, JSONB)" in sql
        assert "TO service_role" in sql

    def test_not_granted_to_anon_or_authenticated(self, sql):
        """CLAUDE.md: privileged RPCs are service-role only."""
        assert "FROM PUBLIC, anon, authenticated" in sql


def _wipe_body(sql: str) -> str:
    """Just the function body — the header comment quotes the old text on purpose.

    The first version of this test asserted against the whole file and went red
    on the migration's own explanation of the defect. An assertion has to aim at
    the thing it means, not at the file that contains it.
    """
    start = sql.index("CREATE OR REPLACE FUNCTION fn_wipe_dungeon_run")
    end = sql.index("$fn$;", start)
    return sql[start:end]


class TestWipeTellsTheTruth:
    def test_the_body_is_found(self, sql):
        body = _wipe_body(sql)
        assert "resonance_dungeon_events" in body, "Rumpf-Ausschnitt trifft nicht die Funktion"

    def test_the_old_claim_is_gone(self, sql):
        body = _wipe_body(sql)
        assert "All agents are lost" not in body
        assert "Alle Agenten sind verloren" not in body

    def test_the_new_wording_is_there(self, sql):
        body = _wipe_body(sql)
        assert "The party returns marked" in body
        assert "kehrt gezeichnet zurück" in body

    def test_wipe_still_applies_its_outcomes(self, sql):
        """The text changed; the mechanic must not."""
        assert "PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes)" in sql
