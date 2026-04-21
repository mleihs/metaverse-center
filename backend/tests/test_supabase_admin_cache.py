"""Unit tests for the process-wide admin Supabase client cache.

Pins three contracts:

1. ``get_admin_supabase_client`` is a singleton within one event loop —
   repeated awaits return the same object.
2. ``get_admin_supabase_client`` is coroutine-safe — N concurrent
   awaits on a cold cache trigger exactly ONE ``create_async_client``
   call (not N).
3. ``reset_admin_supabase_cache`` drops the cached instance so the
   next await re-creates from scratch (the mechanism used by the
   autouse conftest fixture for test isolation).
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_returns_same_instance_across_calls() -> None:
    """Repeated awaits within one event loop return the same client."""
    from backend.utils import supabase_admin_cache

    supabase_admin_cache.reset_admin_supabase_cache()
    fake_client = MagicMock(name="fake_supabase_client")
    with patch(
        "backend.utils.supabase_admin_cache.create_async_client",
        new_callable=AsyncMock,
        return_value=fake_client,
    ) as create_mock:
        a = await supabase_admin_cache.get_admin_supabase_client()
        b = await supabase_admin_cache.get_admin_supabase_client()
        c = await supabase_admin_cache.get_admin_supabase_client()

    assert a is fake_client
    assert a is b is c
    # create_async_client fires once, not three times — this is the
    # whole point of the cache.
    create_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_concurrent_cold_awaits_share_one_construction() -> None:
    """Double-checked lock prevents a thundering-herd of N constructions
    when N coroutines hit a cold cache simultaneously.
    """
    from backend.utils import supabase_admin_cache

    supabase_admin_cache.reset_admin_supabase_cache()
    fake_client = MagicMock(name="fake_supabase_client")

    # Add a small await inside the mock so the cold window is observable.
    async def _slow_create(*_a, **_kw):
        await asyncio.sleep(0.01)
        return fake_client

    with patch(
        "backend.utils.supabase_admin_cache.create_async_client",
        side_effect=_slow_create,
    ) as create_mock:
        results = await asyncio.gather(
            supabase_admin_cache.get_admin_supabase_client(),
            supabase_admin_cache.get_admin_supabase_client(),
            supabase_admin_cache.get_admin_supabase_client(),
            supabase_admin_cache.get_admin_supabase_client(),
            supabase_admin_cache.get_admin_supabase_client(),
        )

    assert all(r is fake_client for r in results)
    assert create_mock.call_count == 1


@pytest.mark.asyncio
async def test_reset_forces_reconstruction_on_next_call() -> None:
    """Reset drops the cached instance so the next call re-creates.

    Matches the autouse-fixture contract: between tests the cache is
    cleared so the next test's first call constructs a client bound
    to its own event loop.
    """
    from backend.utils import supabase_admin_cache

    supabase_admin_cache.reset_admin_supabase_cache()
    first = MagicMock(name="first")
    second = MagicMock(name="second")

    with patch(
        "backend.utils.supabase_admin_cache.create_async_client",
        new_callable=AsyncMock,
        side_effect=[first, second],
    ):
        a = await supabase_admin_cache.get_admin_supabase_client()
        assert a is first

        # Between-test reset — simulated here explicitly.
        supabase_admin_cache.reset_admin_supabase_cache()

        b = await supabase_admin_cache.get_admin_supabase_client()
        assert b is second
        assert a is not b


@pytest.mark.asyncio
async def test_dependencies_get_admin_supabase_delegates_to_cache() -> None:
    """``backend.dependencies.get_admin_supabase`` must route through
    the cache, not create its own client. Pins the contract so a
    future refactor that forgets to delegate is caught immediately.
    """
    from backend.dependencies import get_admin_supabase
    from backend.utils import supabase_admin_cache

    supabase_admin_cache.reset_admin_supabase_cache()
    fake_client = MagicMock(name="fake_supabase_client")
    with patch(
        "backend.utils.supabase_admin_cache.create_async_client",
        new_callable=AsyncMock,
        return_value=fake_client,
    ) as create_mock:
        result = await get_admin_supabase()

    assert result is fake_client
    create_mock.assert_awaited_once()
