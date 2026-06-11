"""Unit tests for ResonanceScheduler (T1 coverage gap, audit 2026-06-11).

Pins the config-gate semantics (incl. the F32 fail-closed bool fix — a
jsonb null must never arm the scheduler) and the per-row error isolation
of the processing loop.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.resonance_scheduler import ResonanceScheduler

_SYSTEM_ACTOR = UUID("00000000-0000-0000-0000-000000000000")


def _admin_with_rows(rows: list[dict]) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    for method in ("select", "eq", "lte", "is_", "in_"):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin


def _admin_raising(exc: Exception) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    for method in ("select", "eq", "lte", "is_", "in_"):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(side_effect=exc)
    admin.table.return_value = chain
    return admin


# ── _load_config ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_load_config_defaults_when_no_rows() -> None:
    enabled, interval = await ResonanceScheduler._load_config(_admin_with_rows([]))
    assert (enabled, interval) == (True, 60)


@pytest.mark.asyncio
async def test_load_config_defaults_when_query_fails() -> None:
    admin = _admin_raising(PostgrestAPIError({"code": "42P01", "message": "missing"}))
    enabled, interval = await ResonanceScheduler._load_config(admin)
    assert (enabled, interval) == (True, 60)


@pytest.mark.asyncio
async def test_load_config_parses_enabled_and_interval_floor() -> None:
    rows = [
        {"setting_key": "resonance_auto_process_enabled", "setting_value": "true"},
        {"setting_key": "resonance_auto_process_interval_seconds", "setting_value": "3"},
    ]
    enabled, interval = await ResonanceScheduler._load_config(_admin_with_rows(rows))
    assert enabled is True
    assert interval == 10  # floored at 10s


@pytest.mark.asyncio
@pytest.mark.parametrize("raw", [None, "null", "none", "enabled", "FALSE", "0", False])
async def test_load_config_enabled_fails_closed_on_non_canonical_values(raw: object) -> None:
    """F32 semantics: only canonical true-ish values arm the scheduler.

    Regression guard for the pre-fix liberal parsing where a jsonb null
    (``str(None) == 'none'``) silently armed the gate.
    """
    rows = [{"setting_key": "resonance_auto_process_enabled", "setting_value": raw}]
    enabled, _interval = await ResonanceScheduler._load_config(_admin_with_rows(rows))
    assert enabled is False


@pytest.mark.asyncio
async def test_load_config_ignores_bad_interval() -> None:
    rows = [{"setting_key": "resonance_auto_process_interval_seconds", "setting_value": "soon"}]
    _enabled, interval = await ResonanceScheduler._load_config(_admin_with_rows(rows))
    assert interval == 60


# ── _check_and_process ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_check_and_process_noop_when_nothing_due() -> None:
    admin = _admin_with_rows([])
    with patch(
        "backend.services.resonance_scheduler.ResonanceService.process_impact",
        new_callable=AsyncMock,
    ) as process:
        await ResonanceScheduler._check_and_process(admin)
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_check_and_process_processes_each_due_row_as_system_actor() -> None:
    ids = [uuid4(), uuid4()]
    admin = _admin_with_rows([{"id": str(i)} for i in ids])
    with patch(
        "backend.services.resonance_scheduler.ResonanceService.process_impact",
        new_callable=AsyncMock,
        return_value=[],
    ) as process:
        await ResonanceScheduler._check_and_process(admin)
    assert process.await_count == 2
    for call, expected_id in zip(process.call_args_list, ids, strict=True):
        assert call.args[1] == expected_id
        assert call.kwargs["user_id"] == _SYSTEM_ACTOR


@pytest.mark.asyncio
async def test_check_and_process_isolates_per_row_failures() -> None:
    """A failing resonance must not stop the remaining due rows."""
    ids = [uuid4(), uuid4()]
    admin = _admin_with_rows([{"id": str(i)} for i in ids])
    with patch(
        "backend.services.resonance_scheduler.ResonanceService.process_impact",
        new_callable=AsyncMock,
        side_effect=[PostgrestAPIError({"code": "XX000", "message": "boom"}), []],
    ) as process:
        await ResonanceScheduler._check_and_process(admin)
    assert process.await_count == 2
    assert process.call_args_list[1].args[1] == ids[1]
