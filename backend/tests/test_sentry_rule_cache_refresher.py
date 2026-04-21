"""Unit tests for SentryRuleCacheRefresher (F14)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.sentry_rule_cache_refresher import SentryRuleCacheRefresher


@pytest.mark.asyncio
async def test_config_is_fixed_60s_enabled() -> None:
    config = await SentryRuleCacheRefresher._load_config(MagicMock())
    assert config == {"enabled": True, "interval": 60}


@pytest.mark.asyncio
async def test_tick_delegates_to_sentry_rule_cache_reload() -> None:
    admin = MagicMock()
    with patch(
        "backend.services.sentry_rule_cache_refresher.sentry_rule_cache.reload",
        new_callable=AsyncMock,
    ) as reload_mock:
        await SentryRuleCacheRefresher._process_tick(
            admin, {"enabled": True, "interval": 60},
        )
    reload_mock.assert_awaited_once_with(admin)


@pytest.mark.asyncio
async def test_scheduler_name_pins_contract() -> None:
    assert SentryRuleCacheRefresher._scheduler_name == "sentry_rule_cache_refresh"
