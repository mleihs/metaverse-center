"""Unit tests for backend/services/ai_usage_rollup_scheduler.py.

The scheduler itself is intentionally minimal — it calls one RPC on a
fixed 60-second tick. Tests pin that contract so a future change to the
cadence or the RPC name fails loudly.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.ai_usage_rollup_scheduler import AiUsageRollupScheduler


def _admin_mock_with_rpc() -> tuple[MagicMock, AsyncMock]:
    """Return (admin, execute_mock). admin.rpc(name, params?).execute()."""
    admin = MagicMock()
    chain = MagicMock()
    execute = AsyncMock(return_value=MagicMock(data=None))
    chain.execute = execute
    admin.rpc.return_value = chain
    return admin, execute


@pytest.mark.asyncio
async def test_load_config_returns_fixed_enabled_interval() -> None:
    admin = MagicMock()
    config = await AiUsageRollupScheduler._load_config(admin)
    assert config == {"enabled": True, "interval": 60}


@pytest.mark.asyncio
async def test_process_tick_invokes_refresh_rpc() -> None:
    admin, execute = _admin_mock_with_rpc()
    await AiUsageRollupScheduler._process_tick(admin, {"enabled": True, "interval": 60})
    admin.rpc.assert_called_once_with("refresh_ai_usage_rollup_hour")
    execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_scheduler_name_is_ai_usage_rollup() -> None:
    # Guards the tag used by structlog/Sentry context binding in
    # BaseSchedulerMixin._run_loop — rename must be deliberate.
    assert AiUsageRollupScheduler._scheduler_name == "ai_usage_rollup"
