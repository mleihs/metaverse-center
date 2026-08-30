"""A won dungeon has to reach the resonance that opened it.

Befund D9: the dungeon gives a great deal back to the world — mood, stress, a
moodlet, an activity row, aptitude points, a memory, a journal fragment, up to
twelve achievements — and nothing at all to the resonance.
`resonance_dungeon_runs.resonance_id` was NULL on all 15 production runs, and no
dungeon service touched `resonance_impacts`. So a defeated archetype stood ready
again immediately and the victory changed nothing about the world's state.

`available_dungeons` has carried `resonance_id` since migration 164 and the
lobby already shows its figures — the run row simply never stored it.
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.models.combat import CombatState
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_combat_service import DungeonCombatService
from backend.services.dungeon_instance_store import store as _store
from backend.tests.unit.test_dungeon_engine_service import _make_enemy, _make_instance

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase/migrations/20260831030000_293_dungeon_victory_relieves_the_resonance.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert "fn_relieve_resonance_after_dungeon" in text
    return text


def _fn_body(sql: str) -> str:
    """The function body alone — the header comment quotes the finding."""
    start = sql.index("CREATE OR REPLACE FUNCTION fn_relieve_resonance_after_dungeon")
    return sql[start : sql.index("$fn$;", start)]


class TestTheFormulaIsTheSpec:
    def test_relief_is_fifteen_percent_per_difficulty_step(self, sql):
        """Spec §5.4. A number in a migration is easy to nudge by accident."""
        assert "0.15 * GREATEST(1, LEAST(5, p_difficulty))" in _fn_body(sql)

    def test_difficulty_is_clamped_to_the_real_range(self, sql):
        body = _fn_body(sql)
        assert "GREATEST(1, LEAST(5, p_difficulty))" in body, (
            "Ohne Klammer könnte eine Schwierigkeit > 6 den Faktor negativ machen"
        )

    def test_there_is_a_floor(self, sql):
        assert "GREATEST(0.05," in _fn_body(sql), (
            "Ohne Untergrenze fällt eine Resonanz auf null und die Welt verliert sie ganz"
        )

    def test_only_the_per_world_value_moves(self, sql):
        """`substrate_resonances` is platform-wide; one world's victory must not
        disarm a resonance for everyone else."""
        body = _fn_body(sql)
        assert "UPDATE resonance_impacts" in body
        assert "UPDATE substrate_resonances" not in body

    def test_the_row_is_locked_before_it_is_read(self, sql):
        """ADR-007: two runs finishing at once must not lose-update."""
        assert "FOR UPDATE" in _fn_body(sql)

    def test_a_missing_impact_row_returns_instead_of_raising(self, sql):
        assert "'no_impact_row'" in _fn_body(sql)


class TestTheGrantIsNarrow:
    def test_service_role_only(self, sql):
        assert re.search(r"REVOKE EXECUTE ON FUNCTION fn_relieve_resonance_after_dungeon[^;]*"
                         r"FROM PUBLIC, anon, authenticated", sql, re.S)
        assert "TO service_role" in sql


class TestTheVictoryCallsIt:
    @pytest.mark.asyncio
    async def test_boss_victory_relieves_the_resonance(self):
        resonance_id = uuid4()
        instance = _make_instance(phase="combat_resolving", current_room=7)
        instance.resonance_id = resonance_id
        instance.difficulty = 4
        instance.combat = CombatState(enemies=[_make_enemy()])
        instance.rooms[7].room_type = "boss"
        _store.put(instance.run_id, instance)

        supabase = AsyncMock()
        rpc_result = AsyncMock()
        rpc_result.execute = AsyncMock(return_value=type("R", (), {"data": {"relieved": True}})())
        supabase.rpc = lambda *a, **k: rpc_result

        calls: list[tuple] = []

        def _record(name, params):
            calls.append((name, params))
            return rpc_result

        supabase.rpc = _record
        try:
            with patch.object(DungeonCheckpointService, "checkpoint", new_callable=AsyncMock):
                await DungeonCombatService._relieve_resonance(supabase, instance)
        finally:
            _store.remove(instance.run_id)

        assert calls, "Der Sieg meldet sich bei keiner Resonanz"
        name, params = calls[0]
        assert name == "fn_relieve_resonance_after_dungeon"
        assert params["p_resonance_id"] == str(resonance_id)
        assert params["p_simulation_id"] == str(instance.simulation_id)
        assert params["p_difficulty"] == 4

    @pytest.mark.asyncio
    async def test_an_admin_unlocked_run_relieves_nothing(self):
        """No resonance behind it — inventing one would be worse than the gap."""
        instance = _make_instance(phase="combat_resolving")
        instance.resonance_id = None
        _store.put(instance.run_id, instance)

        calls: list = []
        supabase = AsyncMock()
        supabase.rpc = lambda *a, **k: calls.append(a) or AsyncMock()
        try:
            await DungeonCombatService._relieve_resonance(supabase, instance)
        finally:
            _store.remove(instance.run_id)

        assert not calls

    @pytest.mark.asyncio
    async def test_a_failed_relief_does_not_lose_the_victory(self):
        """The run is already won; the relief is best-effort."""
        from postgrest.exceptions import APIError as PostgrestAPIError

        instance = _make_instance(phase="combat_resolving")
        instance.resonance_id = uuid4()
        _store.put(instance.run_id, instance)

        def _boom(*_a, **_k):
            raise PostgrestAPIError({"message": "down"})

        supabase = AsyncMock()
        supabase.rpc = _boom
        try:
            # Must not raise.
            await DungeonCombatService._relieve_resonance(supabase, instance)
        finally:
            _store.remove(instance.run_id)


class TestTheCallSiteExists:
    """Calling `_relieve_resonance` directly proves the method, not the wiring.

    Without this, deleting the call from the boss branch would leave every test
    above green — the defect was a missing call site, not a missing method.
    """

    def test_boss_victory_calls_it(self):
        import ast
        import inspect
        import textwrap

        # `textwrap.dedent`, not `lstrip()`: lstrip strips only the FIRST line's
        # indentation and leaves the rest, which parses as an IndentationError —
        # a test that fails for a reason unrelated to the claim it makes. The
        # first version of this test did exactly that and looked like a real
        # regression.
        source = textwrap.dedent(
            inspect.getsource(DungeonCombatService._handle_combat_victory.__func__)
        )
        tree = ast.parse(source)
        called = {
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        }
        assert "_relieve_resonance" in called, (
            "Der Bosssieg ruft die Linderung nicht — die Resonanz erfährt vom Sieg nichts"
        )

    def test_create_run_writes_the_resonance_id(self):
        import inspect

        from backend.services.dungeon_engine_service import DungeonEngineService

        source = inspect.getsource(DungeonEngineService.create_run.__func__)
        assert '"resonance_id": str(resonance_id) if resonance_id else None' in source, (
            "Der Lauf speichert seine Resonanz nicht — dann ist beim Sieg nichts zu lindern"
        )
        assert '"available_dungeons"' in source, (
            "Die Resonanz wird nirgends nachgeschlagen"
        )


class TestTheRunRemembersItsResonance:
    def test_the_instance_carries_it_through_a_checkpoint(self):
        resonance_id = uuid4()
        instance = _make_instance()
        instance.resonance_id = resonance_id

        checkpoint = instance.to_checkpoint()
        assert checkpoint["resonance_id"] == str(resonance_id)

        restored = _make_instance()
        restored.restore_from_checkpoint(checkpoint)
        assert restored.resonance_id == resonance_id, (
            "Nach einem Verbindungsabbruch wüsste der Lauf nicht mehr, "
            "welche Resonanz er lindern soll"
        )

    def test_no_resonance_survives_as_none(self):
        instance = _make_instance()
        instance.resonance_id = None
        restored = _make_instance()
        restored.restore_from_checkpoint(instance.to_checkpoint())
        assert restored.resonance_id is None
