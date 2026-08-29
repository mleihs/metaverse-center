"""A rejected battle-log write must be OBSERVED, not just logged.

`log_event` is best-effort on purpose: losing a narrative line must not abort
the cycle resolution that produced it. But best-effort was reading as
unobserved. On 2026-08-29 the `battle_log_event_type_check` constraint rejected
four event types of the auto-resolve path — `cycle_auto_resolved`, `player_afk`,
`player_afk_penalty`, `player_afk_ai_takeover` — and the only trace was a log
line nobody greps. Cycles resolved with holes in their record for months and
nothing ever went red.

The swallow stays. The silence does not.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.battle_log_service import BattleLogService


@pytest.mark.asyncio
async def test_a_rejected_write_reaches_sentry_and_does_not_raise():
    admin = MagicMock()
    admin.table.return_value.insert.return_value.execute = AsyncMock(
        side_effect=PostgrestAPIError({"message": 'violates check constraint "battle_log_event_type_check"'})
    )

    with (
        patch(
            "backend.services.battle_log_service.get_admin_supabase_client",
            new=AsyncMock(return_value=admin),
        ),
        patch("backend.services.battle_log_service.sentry_sdk.capture_exception") as capture,
    ):
        result = await BattleLogService.log_event(
            admin, uuid4(), 1, "cycle_auto_resolved", "Cycle resolved automatically at deadline."
        )

    assert capture.called, "a rejected battle-log write must be reported, not only logged"
    # Best-effort contract is unchanged: the caller gets the unsaved row back
    # instead of an exception, so cycle resolution carries on.
    assert result["event_type"] == "cycle_auto_resolved"


@pytest.mark.asyncio
async def test_a_successful_write_reports_nothing():
    admin = MagicMock()
    admin.table.return_value.insert.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[{"id": "row-1", "event_type": "phase_change"}])
    )

    with (
        patch(
            "backend.services.battle_log_service.get_admin_supabase_client",
            new=AsyncMock(return_value=admin),
        ),
        patch("backend.services.battle_log_service.sentry_sdk.capture_exception") as capture,
    ):
        result = await BattleLogService.log_event(admin, uuid4(), 1, "phase_change", "Foundation to competition.")

    assert not capture.called
    assert result["id"] == "row-1"
