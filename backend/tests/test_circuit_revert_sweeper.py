"""Unit tests for CircuitRevertSweeper (Deferral C)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.circuit_revert_sweeper import CircuitRevertSweeper


def _admin_with_delete_result(rows: list[dict]) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    chain.delete.return_value = chain
    chain.lte.return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin


@pytest.mark.asyncio
async def test_scheduler_config_is_fixed() -> None:
    config = await CircuitRevertSweeper._load_config(MagicMock())
    assert config == {"enabled": True, "interval": 60}


@pytest.mark.asyncio
async def test_scheduler_name_pins_contract() -> None:
    assert CircuitRevertSweeper._scheduler_name == "circuit_revert_sweep"


@pytest.mark.asyncio
async def test_tick_deletes_expired_rows_and_resets_each_breaker() -> None:
    rows = [
        {"scope": "provider", "scope_key": "openrouter"},
        {"scope": "model", "scope_key": "claude-haiku-4"},
    ]
    admin = _admin_with_delete_result(rows)
    with patch(
        "backend.services.circuit_revert_sweeper.circuit_breaker.reset",
    ) as reset_mock:
        await CircuitRevertSweeper._process_tick(admin, {"enabled": True, "interval": 60})

    admin.table.assert_called_once_with("ai_circuit_state")
    admin.table.return_value.delete.assert_called_once()
    admin.table.return_value.lte.assert_called_once()
    assert admin.table.return_value.lte.call_args.args[0] == "revert_at"
    # Two reset calls — one per deleted row.
    assert reset_mock.call_count == 2
    assert reset_mock.call_args_list[0].args == ("provider", "openrouter")
    assert reset_mock.call_args_list[1].args == ("model", "claude-haiku-4")


@pytest.mark.asyncio
async def test_tick_is_noop_when_nothing_expired() -> None:
    admin = _admin_with_delete_result([])
    with patch(
        "backend.services.circuit_revert_sweeper.circuit_breaker.reset",
    ) as reset_mock:
        await CircuitRevertSweeper._process_tick(admin, {"enabled": True, "interval": 60})
    reset_mock.assert_not_called()


@pytest.mark.asyncio
async def test_tick_skips_rows_missing_scope_or_key() -> None:
    rows = [
        {"scope": "", "scope_key": "openrouter"},
        {"scope": "provider", "scope_key": ""},
        {"scope": "model", "scope_key": "ok"},
    ]
    admin = _admin_with_delete_result(rows)
    with patch(
        "backend.services.circuit_revert_sweeper.circuit_breaker.reset",
    ) as reset_mock:
        await CircuitRevertSweeper._process_tick(admin, {"enabled": True, "interval": 60})
    reset_mock.assert_called_once_with("model", "ok")
