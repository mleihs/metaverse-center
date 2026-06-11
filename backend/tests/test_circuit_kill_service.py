"""Unit tests for CircuitKillService (B1a router→service extraction).

The kill path is the Bureau-Ops emergency brake — these tests pin the
three-step contract (DB row → in-process mirror → ledger entry) and both
failure modes (upsert returns nothing, revert on a non-existent kill).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models.bureau_ops import RevertKillRequest, TripKillRequest
from backend.services.circuit_kill_service import CircuitKillService

_ACTOR = uuid4()


def _admin_with_chain(rows: list[dict]) -> tuple[MagicMock, MagicMock]:
    """Admin client whose table() chain resolves every call to ``rows``."""
    admin = MagicMock()
    chain = MagicMock()
    for method in ("upsert", "delete", "eq"):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin, chain


def _trip_body(minutes: int = 30) -> TripKillRequest:
    return TripKillRequest(
        scope="provider",
        scope_key="openrouter",
        reason="unit-test kill",
        revert_after_minutes=minutes,
    )


@pytest.mark.asyncio
async def test_trip_persists_row_mirrors_breaker_and_logs() -> None:
    admin, chain = _admin_with_chain([{"scope": "provider", "scope_key": "openrouter"}])
    with (
        patch("backend.services.circuit_kill_service.circuit_breaker.force_open") as force_open,
        patch(
            "backend.services.circuit_kill_service.OpsLedgerService.log_action",
            new_callable=AsyncMock,
        ) as log_action,
    ):
        result = await CircuitKillService.trip(admin, actor_id=_ACTOR, body=_trip_body(minutes=30))

    admin.table.assert_called_once_with("ai_circuit_state")
    upsert_payload = chain.upsert.call_args.args[0]
    assert upsert_payload["scope"] == "provider"
    assert upsert_payload["scope_key"] == "openrouter"
    assert upsert_payload["state"] == "killed"
    assert upsert_payload["triggered_by_id"] == str(_ACTOR)
    assert chain.upsert.call_args.kwargs["on_conflict"] == "scope,scope_key"

    force_open.assert_called_once_with("provider", "openrouter", open_for_s=1800.0)

    assert log_action.await_count == 1
    assert log_action.call_args.kwargs["action"] == "kill.trip"
    assert log_action.call_args.kwargs["actor_id"] == _ACTOR

    assert result.state == "killed"
    assert result.revert_at is not None


@pytest.mark.asyncio
async def test_trip_raises_when_upsert_returns_no_rows() -> None:
    admin, _chain = _admin_with_chain([])
    with (
        patch("backend.services.circuit_kill_service.circuit_breaker.force_open") as force_open,
        pytest.raises(RuntimeError, match="no rows"),
    ):
        await CircuitKillService.trip(admin, actor_id=_ACTOR, body=_trip_body())
    # DB persistence failed → the in-process mirror must NOT open.
    force_open.assert_not_called()


@pytest.mark.asyncio
async def test_revert_deletes_row_resets_breaker_and_logs() -> None:
    admin, chain = _admin_with_chain([{"scope": "provider", "scope_key": "openrouter"}])
    body = RevertKillRequest(scope="provider", scope_key="openrouter", reason="unit-test revert")
    with (
        patch("backend.services.circuit_kill_service.circuit_breaker.reset") as reset,
        patch(
            "backend.services.circuit_kill_service.OpsLedgerService.log_action",
            new_callable=AsyncMock,
        ) as log_action,
    ):
        result = await CircuitKillService.revert(admin, actor_id=_ACTOR, body=body)

    admin.table.assert_called_once_with("ai_circuit_state")
    chain.delete.assert_called_once()
    eq_calls = [c.args for c in chain.eq.call_args_list]
    assert ("scope", "provider") in eq_calls
    assert ("scope_key", "openrouter") in eq_calls

    reset.assert_called_once_with("provider", "openrouter")
    assert log_action.call_args.kwargs["action"] == "kill.revert"

    assert result.state == "closed"
    assert result.revert_at is None


@pytest.mark.asyncio
async def test_revert_404s_when_no_kill_row_exists() -> None:
    admin, _chain = _admin_with_chain([])
    body = RevertKillRequest(scope="provider", scope_key="openrouter", reason="unit-test revert")
    with (
        patch("backend.services.circuit_kill_service.circuit_breaker.reset") as reset,
        pytest.raises(HTTPException) as exc_info,
    ):
        await CircuitKillService.revert(admin, actor_id=_ACTOR, body=body)
    assert exc_info.value.status_code == 404
    # No durable row deleted → in-process state stays untouched.
    reset.assert_not_called()
