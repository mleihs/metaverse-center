"""Unit tests for OpsLedgerService.rehydrate_circuit_kills (Deferral B).

Exercises the three branches:
  - Active future kill → circuit_breaker.force_open called with the
    remaining-seconds budget.
  - Already-expired kill (revert_at <= now) → skipped; the revert
    sweep will reap the row.
  - DB error → zero return, no exception propagation.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.ops_ledger_service import OpsLedgerService


def _admin_with_rows(rows: list[dict]) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin


def _admin_that_raises() -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.execute = AsyncMock(side_effect=RuntimeError("pg down"))
    admin.table.return_value = chain
    return admin


@pytest.mark.asyncio
async def test_rehydrate_loads_active_kills_into_breaker() -> None:
    now = datetime.now(UTC)
    revert = (now + timedelta(minutes=15)).isoformat()
    rows = [
        {"scope": "provider", "scope_key": "openrouter", "revert_at": revert},
        {"scope": "model", "scope_key": "claude-haiku-4", "revert_at": revert},
    ]
    admin = _admin_with_rows(rows)
    with patch(
        "backend.services.circuit_breaker_service.circuit_breaker.force_open",
    ) as force_open_mock:
        loaded = await OpsLedgerService.rehydrate_circuit_kills(admin)

    assert loaded == 2
    assert force_open_mock.call_count == 2
    # Second positional path: scope, scope_key, open_for_s kwarg.
    calls = force_open_mock.call_args_list
    assert calls[0].args[0:2] == ("provider", "openrouter")
    assert calls[0].kwargs["open_for_s"] > 0
    assert calls[1].args[0:2] == ("model", "claude-haiku-4")


@pytest.mark.asyncio
async def test_rehydrate_skips_expired_rows() -> None:
    now = datetime.now(UTC)
    rows = [
        {
            "scope": "provider",
            "scope_key": "openrouter",
            "revert_at": (now - timedelta(minutes=5)).isoformat(),
        },
        {
            "scope": "model",
            "scope_key": "keep-me",
            "revert_at": (now + timedelta(minutes=10)).isoformat(),
        },
    ]
    admin = _admin_with_rows(rows)
    with patch(
        "backend.services.circuit_breaker_service.circuit_breaker.force_open",
    ) as force_open_mock:
        loaded = await OpsLedgerService.rehydrate_circuit_kills(admin)
    assert loaded == 1
    force_open_mock.assert_called_once()
    assert force_open_mock.call_args.args[0:2] == ("model", "keep-me")


@pytest.mark.asyncio
async def test_rehydrate_tolerates_db_failure() -> None:
    admin = _admin_that_raises()
    with patch(
        "backend.services.circuit_breaker_service.circuit_breaker.force_open",
    ) as force_open_mock:
        loaded = await OpsLedgerService.rehydrate_circuit_kills(admin)
    assert loaded == 0
    force_open_mock.assert_not_called()


@pytest.mark.asyncio
async def test_rehydrate_skips_malformed_rows() -> None:
    now = datetime.now(UTC)
    revert = (now + timedelta(minutes=30)).isoformat()
    rows = [
        {"scope": "", "scope_key": "x", "revert_at": revert},
        {"scope": "provider", "scope_key": "", "revert_at": revert},
        {"scope": "provider", "scope_key": "openrouter", "revert_at": "not-a-date"},
        {"scope": "provider", "scope_key": "anthropic", "revert_at": revert},
    ]
    admin = _admin_with_rows(rows)
    with patch(
        "backend.services.circuit_breaker_service.circuit_breaker.force_open",
    ) as force_open_mock:
        loaded = await OpsLedgerService.rehydrate_circuit_kills(admin)
    assert loaded == 1
    assert force_open_mock.call_args.args[0:2] == ("provider", "anthropic")
