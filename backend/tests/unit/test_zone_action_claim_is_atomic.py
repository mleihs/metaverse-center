"""Eine Zonenmaßnahme wird beansprucht, nicht geprüft (D10-1 / S18).

`ZoneActionService.create_action` prüfte in drei getrennten Anfragen und fügte
dann ein: SELECT „läuft schon eine Maßnahme?", SELECT „ist die Abklingzeit
vorbei?", INSERT. Zwischen dem ersten SELECT und dem INSERT liegt ein
Netzwerk-Umlauf, in dem eine zweite Anfrage denselben Zustand liest.

Die Tabelle hat dagegen keine Sperre — und das war bekannt. Migration 072
schreibt es in den Quelltext:

    -- Note: max 1 active action per zone enforced in application layer
    -- (partial unique index with now() not possible — not IMMUTABLE)

Der Grund stimmt (ein partieller UNIQUE-Index kann `now()` nicht benutzen), die
Folgerung nicht: die Alternative zum Index ist keine Anwendungsschicht, sondern
eine Transaktion mit Sperre.

GEMESSEN im Wegwerf-Postgres, 31.08.2026, zwei gleichzeitige Anfragen auf
dieselbe Zone:

    altes Muster  → 2 laufende Maßnahmen auf einer Zone
    Migration 301 → 'created' + 'active_exists', 1 laufende Maßnahme

Diese Datei prüft die Python-Seite: dass der Dienst die Funktion überhaupt ruft,
dass er die drei Rückgabezustände auf die richtigen HTTP-Fehler abbildet — und
dass das alte Muster nicht zurückkommt.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from backend.services.zone_action_service import ACTION_CONFIG, ZoneActionService

_ROOT = Path(__file__).resolve().parents[3]
_MIGRATION = _ROOT / "supabase/migrations/20260831110000_301_zone_action_claim_is_atomic.sql"

_SIM = UUID("11111111-1111-1111-1111-111111111111")
_ZONE = UUID("22222222-2222-2222-2222-222222222222")
_USER = UUID("44444444-4444-4444-4444-444444444444")


def _client(rpc_result: object) -> MagicMock:
    """A Supabase double whose .rpc(...).execute() yields ``rpc_result``."""
    client = MagicMock()
    execute = AsyncMock(return_value=MagicMock(data=rpc_result))
    client.rpc = MagicMock(return_value=MagicMock(execute=execute))
    return client


@pytest.fixture
def no_metric_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    """refresh_metrics talks to the DB and is not what this file is about."""
    monkeypatch.setattr(
        "backend.services.zone_action_service.GameMechanicsService.refresh_metrics",
        AsyncMock(return_value=None),
    )


class TestTheServiceClaimsInsteadOfChecking:
    @pytest.mark.asyncio
    async def test_it_calls_the_atomic_function_with_the_game_numbers(self, no_metric_refresh) -> None:
        client = _client({"status": "created", "action": {"id": "abc", "action_type": "fortify"}})

        result = await ZoneActionService.create_action(client, _SIM, _ZONE, "fortify", _USER)

        assert result == {"id": "abc", "action_type": "fortify"}
        name, payload = client.rpc.call_args[0]
        assert name == "fn_create_zone_action"
        # The balance numbers travel as parameters — SQL owns the integrity,
        # Python owns the rule. If they ever migrate into the function body they
        # exist twice and will drift.
        config = ACTION_CONFIG["fortify"]
        assert payload["p_effect_value"] == config["effect_value"]
        assert payload["p_duration_days"] == config["duration_days"]
        assert payload["p_cooldown_days"] == config["cooldown_days"]
        assert payload["p_zone_id"] == str(_ZONE)
        assert payload["p_simulation_id"] == str(_SIM)
        assert payload["p_user_id"] == str(_USER)

    @pytest.mark.asyncio
    async def test_active_action_becomes_409(self, no_metric_refresh) -> None:
        client = _client({"status": "active_exists"})
        with pytest.raises(HTTPException) as excinfo:
            await ZoneActionService.create_action(client, _SIM, _ZONE, "fortify", _USER)
        assert excinfo.value.status_code == 409

    @pytest.mark.asyncio
    async def test_cooldown_becomes_429_with_the_remaining_days(self, no_metric_refresh) -> None:
        client = _client({"status": "cooldown", "cooldown_until": "2099-01-01T00:00:00+00:00"})
        with pytest.raises(HTTPException) as excinfo:
            await ZoneActionService.create_action(client, _SIM, _ZONE, "fortify", _USER)
        assert excinfo.value.status_code == 429
        assert "cooldown" in str(excinfo.value.detail).lower()

    @pytest.mark.asyncio
    async def test_a_cooldown_without_a_date_still_refuses(self, no_metric_refresh) -> None:
        """A malformed timestamp must not turn a refusal into a success."""
        client = _client({"status": "cooldown"})
        with pytest.raises(HTTPException) as excinfo:
            await ZoneActionService.create_action(client, _SIM, _ZONE, "fortify", _USER)
        assert excinfo.value.status_code == 429

    @pytest.mark.asyncio
    @pytest.mark.parametrize("payload", [None, [], {"status": "created"}, {"status": "wat"}])
    async def test_an_unusable_answer_is_a_500_not_a_silent_success(self, no_metric_refresh, payload) -> None:
        client = _client(payload)
        with pytest.raises(HTTPException) as excinfo:
            await ZoneActionService.create_action(client, _SIM, _ZONE, "fortify", _USER)
        assert excinfo.value.status_code == 500

    @pytest.mark.asyncio
    async def test_an_unknown_action_type_is_refused_before_any_call(self) -> None:
        client = _client({"status": "created", "action": {}})
        with pytest.raises(HTTPException) as excinfo:
            await ZoneActionService.create_action(client, _SIM, _ZONE, "sabotage", _USER)
        assert excinfo.value.status_code == 400
        client.rpc.assert_not_called()


class TestTheOldPatternIsGone:
    """The assertion reads the FUNCTION, not the file (J3).

    A file-wide text search would also match ``cancel_action`` and
    ``list_actions``, which legitimately query ``zone_actions`` — and it would
    match the comment above ``create_action``, which names the old pattern on
    purpose in order to explain it (J3b). Parsing the one function's AST avoids
    both: comments do not survive ``ast.parse``.
    """

    @pytest.fixture(scope="class")
    def tree(self) -> ast.AST:
        source = inspect.getsource(ZoneActionService.create_action)
        return ast.parse(inspect.cleandoc(source))

    def test_create_action_no_longer_queries_the_table_directly(self, tree) -> None:
        tables = [
            node.args[0].value
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "table"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ]
        assert tables == [], (
            f"create_action still reads/writes tables directly: {tables}. "
            "The claim must happen inside fn_create_zone_action, or the race is back."
        )

    def test_create_action_calls_exactly_one_rpc(self, tree) -> None:
        rpcs = [
            node.args[0].value
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "rpc"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ]
        assert rpcs == ["fn_create_zone_action"], rpcs


class TestTheMigrationCarriesTheLock:
    @pytest.fixture(scope="class")
    def sql(self) -> str:
        assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
        return _MIGRATION.read_text(encoding="utf-8")

    def _body(self, sql: str) -> str:
        """Only the function body — not the header comment that explains the bug."""
        start = sql.index("CREATE OR REPLACE FUNCTION fn_create_zone_action")
        return sql[start : sql.index("END;\n$$;", start)]

    def test_it_locks_the_zone_before_it_reads(self, sql) -> None:
        body = self._body(sql)
        lock = body.index("pg_advisory_xact_lock")
        first_read = body.index("FROM zone_actions")
        assert lock < first_read, "die Sperre muss VOR der ersten Prüfung genommen werden"

    def test_the_lock_is_keyed_on_the_zone_not_the_table(self, sql) -> None:
        """A table-wide lock would serialise every world against every other."""
        body = self._body(sql)
        assert "'zone_action:' || p_zone_id::text" in body

    def test_every_parameter_the_service_sends_exists(self, sql) -> None:
        header = sql[sql.index("CREATE OR REPLACE FUNCTION") : sql.index("RETURNS jsonb")]
        for parameter in (
            "p_simulation_id",
            "p_zone_id",
            "p_action_type",
            "p_user_id",
            "p_effect_value",
            "p_duration_days",
            "p_cooldown_days",
        ):
            assert parameter in header, f"Signaturkopplung gebrochen: {parameter} fehlt"

    def test_it_is_not_security_definer(self, sql) -> None:
        """ADR-006: the function needs no elevated rights, so it must not take any."""
        body = self._body(sql)
        assert "SECURITY INVOKER" in body
        assert "SECURITY DEFINER" not in body

    def test_the_return_keys_avoid_the_supabase_py_trap(self, sql) -> None:
        """supabase-py reads a top-level 'error' or 'message' key as an APIError."""
        body = self._body(sql)
        for forbidden in ("'error'", "'message'"):
            assert f"jsonb_build_object({forbidden}" not in body

    def test_the_service_and_the_migration_agree_on_the_status_words(self, sql) -> None:
        body = self._body(sql)
        source = inspect.getsource(ZoneActionService.create_action)
        for status in ("created", "active_exists", "cooldown"):
            assert f"'{status}'" in body, f"{status} fehlt in der Migration"
            assert f'"{status}"' in source, f"{status} fehlt im Dienst"
