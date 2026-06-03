"""Unit tests for the scheduler-loop last-resort resilience guard (SRE-2).

Every background scheduler runs in the single uvicorn worker. Before this guard
the loops caught only a narrow exception tuple
(PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError); any other
type — RuntimeError, IndexError, a non-httpx OSError, a custom exception — would
propagate out of the ``while True`` loop and kill the task permanently. The
scheduler then stopped ticking while /health still returned 200 and Docker stayed
green (silent tick-death).

These tests pin that an unexpected exception is reported to Sentry and the loop
continues (reaches the ``asyncio.sleep`` after the except chain). We break the
otherwise-infinite loop by making that sleep raise ``CancelledError`` — which is
re-raised, NOT swallowed, so it cleanly exits the loop for the test.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.heartbeat_service import HeartbeatService
from backend.services.social.scheduler_base import BaseSchedulerMixin


class _BoomScheduler(BaseSchedulerMixin):
    """A BaseSchedulerMixin subclass whose tick raises a NON-narrow exception."""

    _scheduler_name = "test_boom"

    @classmethod
    async def _load_config(cls, admin: object) -> dict:
        return {"enabled": True, "interval": 0}

    @classmethod
    async def _process_tick(cls, admin: object, config: dict) -> None:
        raise RuntimeError("unexpected boom")


@pytest.mark.asyncio
async def test_base_mixin_loop_survives_unexpected_exception() -> None:
    """BaseSchedulerMixin (Instagram/Bluesky/rollup/circuit-revert/orphan-sweeper/
    fragment-gen/sentry-cache): a RuntimeError must be captured and the loop continue."""
    with (
        patch(
            "backend.services.social.scheduler_base.get_admin_supabase",
            new=AsyncMock(return_value=MagicMock()),
        ),
        patch("backend.services.social.scheduler_base.sentry_sdk.capture_exception") as mock_cap,
        # Break the loop on the first sleep — AFTER the terminal except has run.
        patch(
            "backend.services.social.scheduler_base.asyncio.sleep",
            new=AsyncMock(side_effect=asyncio.CancelledError),
        ),
    ):
        with pytest.raises(asyncio.CancelledError):
            await _BoomScheduler._run_loop()

    # The RuntimeError was caught by the new terminal handler (we reached sleep) and reported.
    mock_cap.assert_called_once()
    assert isinstance(mock_cap.call_args.args[0], RuntimeError)


@pytest.mark.asyncio
async def test_heartbeat_loop_survives_unexpected_exception() -> None:
    """The heartbeat is the game tick — an unexpected tick error must not silently stop it."""
    with (
        patch(
            "backend.services.heartbeat_service.get_admin_supabase",
            new=AsyncMock(return_value=MagicMock()),
        ),
        patch.object(HeartbeatService, "_load_config", new=AsyncMock(return_value=(True, 0))),
        patch.object(
            HeartbeatService,
            "_tick_due_simulations",
            new=AsyncMock(side_effect=RuntimeError("unexpected boom")),
        ),
        patch("backend.services.heartbeat_service.sentry_sdk.capture_exception") as mock_cap,
        patch(
            "backend.services.heartbeat_service.asyncio.sleep",
            new=AsyncMock(side_effect=asyncio.CancelledError),
        ),
    ):
        with pytest.raises(asyncio.CancelledError):
            await HeartbeatService._run_loop()

    mock_cap.assert_called_once()
    assert isinstance(mock_cap.call_args.args[0], RuntimeError)
