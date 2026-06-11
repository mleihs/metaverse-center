"""Unit tests for EpochCycleScheduler (T1 coverage gap, audit 2026-06-11).

Pins the CAS-gate contract (_auto_resolve_cycle only runs the pipeline for
the winning caller), the per-epoch error isolation of the sweep, and the
eager-timer scheduling semantics (past deadlines deferred to the sweep,
replacement cancels the previous timer).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.epoch_cycle_scheduler import EpochCycleScheduler

_EPOCH_ID = str(uuid4())


def _admin_with_cas(resolved: bool | None) -> MagicMock:
    """Admin whose fn_check_and_resolve_deadline RPC returns the CAS verdict."""
    admin = MagicMock()
    cas_data = None if resolved is None else {"resolved": resolved}
    admin.rpc.return_value.execute = AsyncMock(return_value=MagicMock(data=cas_data))
    return admin


def _epoch(config: dict | None = None) -> dict:
    return {"id": _EPOCH_ID, "current_cycle": 3, "config": config or {}}


@pytest.fixture(autouse=True)
def _clean_eager_timers():
    """Each test starts with an empty timer registry and leaves none behind."""
    EpochCycleScheduler._eager_timers = {}
    yield
    for task in EpochCycleScheduler._eager_timers.values():
        task.cancel()
    EpochCycleScheduler._eager_timers = {}


# ── _auto_resolve_cycle (CAS gate) ───────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("cas_result", [False, None])
async def test_auto_resolve_is_noop_when_cas_lost(cas_result: bool | None) -> None:
    """Losing the CAS race (or empty RPC result) must not run the pipeline."""
    admin = _admin_with_cas(cas_result)
    with (
        patch(
            "backend.services.epoch_cycle_scheduler.BattleLogService.log_event",
            new_callable=AsyncMock,
        ) as log_event,
        patch(
            "backend.services.epoch_service.EpochService.resolve_cycle_full",
            new_callable=AsyncMock,
        ) as resolve,
    ):
        await EpochCycleScheduler._auto_resolve_cycle(admin, _epoch())
    log_event.assert_not_awaited()
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_auto_resolve_runs_pipeline_when_cas_won() -> None:
    admin = _admin_with_cas(True)
    with (
        patch(
            "backend.services.epoch_cycle_scheduler.BattleLogService.log_event",
            new_callable=AsyncMock,
        ) as log_event,
        patch(
            "backend.services.epoch_service.EpochService.resolve_cycle_full",
            new_callable=AsyncMock,
        ) as resolve,
        patch.object(EpochCycleScheduler, "_process_afk_players", new_callable=AsyncMock) as afk,
    ):
        await EpochCycleScheduler._auto_resolve_cycle(admin, _epoch())

    # CAS RPC called with the expected-cycle guard
    rpc_args = admin.rpc.call_args.args
    assert rpc_args[0] == "fn_check_and_resolve_deadline"
    assert rpc_args[1] == {"p_epoch_id": _EPOCH_ID, "p_expected_cycle": 3}

    log_event.assert_awaited_once()
    assert log_event.call_args.args[3] == "cycle_auto_resolved"
    resolve.assert_awaited_once()
    # AFK penalties are config-gated and default OFF
    afk.assert_not_awaited()


@pytest.mark.asyncio
async def test_auto_resolve_processes_afk_before_resolve_when_enabled() -> None:
    admin = _admin_with_cas(True)
    call_order: list[str] = []
    with (
        patch(
            "backend.services.epoch_cycle_scheduler.BattleLogService.log_event",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.services.epoch_service.EpochService.resolve_cycle_full",
            new_callable=AsyncMock,
            side_effect=lambda *a, **k: call_order.append("resolve"),
        ),
        patch.object(
            EpochCycleScheduler,
            "_process_afk_players",
            new_callable=AsyncMock,
            side_effect=lambda *a, **k: call_order.append("afk"),
        ),
    ):
        await EpochCycleScheduler._auto_resolve_cycle(
            admin, _epoch(config={"afk_penalty_enabled": True}),
        )
    # AFK flags must be set BEFORE resolve so the bot pipeline sees them.
    assert call_order == ["afk", "resolve"]


# ── _sweep_expired_cycles (error isolation) ──────────────────────────────


@pytest.mark.asyncio
async def test_sweep_isolates_per_epoch_failures() -> None:
    """One epoch failing to resolve must not starve the remaining epochs."""
    epochs = [
        {"id": str(uuid4()), "current_cycle": 1, "config": {}},
        {"id": str(uuid4()), "current_cycle": 2, "config": {}},
    ]
    admin = MagicMock()
    chain = MagicMock()
    for method in ("select", "in_", "lte"):
        getattr(chain, method).return_value = chain
    chain.not_.is_.return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=epochs))
    admin.table.return_value = chain

    with (
        patch.object(
            EpochCycleScheduler,
            "_auto_resolve_cycle",
            new_callable=AsyncMock,
            side_effect=[PostgrestAPIError({"code": "XX000", "message": "boom"}), None],
        ) as resolve,
        patch("backend.services.epoch_cycle_scheduler.sentry_sdk.capture_exception") as capture,
    ):
        await EpochCycleScheduler._sweep_expired_cycles(admin)

    assert resolve.await_count == 2
    assert resolve.call_args_list[1].args[1] == epochs[1]
    capture.assert_called_once()


# ── schedule_eager_timer ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_eager_timer_skips_past_deadlines() -> None:
    """Past deadlines are the sweep's job — no timer must be registered."""
    deadline = datetime.now(UTC) - timedelta(seconds=5)
    await EpochCycleScheduler.schedule_eager_timer(_EPOCH_ID, deadline)
    assert _EPOCH_ID not in EpochCycleScheduler._eager_timers


@pytest.mark.asyncio
async def test_eager_timer_registers_future_deadline() -> None:
    deadline = datetime.now(UTC) + timedelta(seconds=60)
    await EpochCycleScheduler.schedule_eager_timer(_EPOCH_ID, deadline)
    task = EpochCycleScheduler._eager_timers.get(_EPOCH_ID)
    assert task is not None
    assert not task.done()


@pytest.mark.asyncio
async def test_eager_timer_replacement_cancels_previous_timer() -> None:
    deadline = datetime.now(UTC) + timedelta(seconds=60)
    await EpochCycleScheduler.schedule_eager_timer(_EPOCH_ID, deadline)
    first = EpochCycleScheduler._eager_timers[_EPOCH_ID]

    await EpochCycleScheduler.schedule_eager_timer(_EPOCH_ID, deadline + timedelta(seconds=30))
    second = EpochCycleScheduler._eager_timers[_EPOCH_ID]

    assert second is not first
    # Let the cancellation propagate one loop iteration.
    await asyncio.sleep(0)
    assert first.cancelled()
    assert not second.done()
