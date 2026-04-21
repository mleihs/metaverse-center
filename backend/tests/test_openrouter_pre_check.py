"""Unit tests for the Bureau Ops pre_check integration in OpenRouterService.

Parallel to test_run_ai_pre_check — both chokepoints must behave
symmetrically so a caller reasoning about "will budgets block me?" gets
the same answer at both entry points.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import (
    BudgetContext,
    OpenRouterService,
    _pre_check_budget,
)

_SIM = UUID("10000000-0000-0000-0000-000000000001")
_USER = UUID("20000000-0000-0000-0000-000000000001")


@pytest.mark.asyncio
async def test_pre_check_budget_noop_without_context() -> None:
    with patch(
        "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
        new_callable=AsyncMock,
    ) as pre_check_mock:
        await _pre_check_budget(None)
    pre_check_mock.assert_not_called()


@pytest.mark.asyncio
async def test_pre_check_budget_forwards_context_fields() -> None:
    admin = MagicMock()
    ctx = BudgetContext(
        admin_supabase=admin,
        purpose="chat_memory",
        simulation_id=_SIM,
        user_id=_USER,
    )
    with patch(
        "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
        new_callable=AsyncMock,
    ) as pre_check_mock:
        await _pre_check_budget(ctx)
    pre_check_mock.assert_awaited_once_with(
        admin, purpose="chat_memory", simulation_id=_SIM, user_id=_USER,
    )


@pytest.mark.asyncio
async def test_generate_aborts_on_budget_exceeded() -> None:
    # Pre-check must fire BEFORE the HTTP call so a hard-block never
    # leaks credits to the upstream API. We detect this by having
    # pre_check raise and asserting that httpx.AsyncClient was never
    # instantiated (would indicate the upstream call started).
    service = OpenRouterService(api_key="sk-test")
    admin = MagicMock()
    ctx = BudgetContext(admin_supabase=admin, purpose="forge")
    with (
        patch(
            "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
            new_callable=AsyncMock,
            side_effect=BudgetExceededError(
                scope="global",
                scope_key="global",
                period="day",
                current_usd=51.0,
                max_usd=50.0,
            ),
        ),
        patch("backend.services.external.openrouter.httpx.AsyncClient") as client_mock,
    ):
        with pytest.raises(BudgetExceededError):
            await service.generate(
                model="deepseek/deepseek-chat",
                messages=[{"role": "user", "content": "x"}],
                budget=ctx,
            )
    client_mock.assert_not_called()


@pytest.mark.asyncio
async def test_generate_without_budget_skips_pre_check() -> None:
    service = OpenRouterService(api_key="sk-test")
    with (
        patch(
            "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
            new_callable=AsyncMock,
        ) as pre_check_mock,
        # Stub the HTTP layer so the method returns without real network.
        patch("backend.services.external.openrouter.httpx.AsyncClient") as client_mock,
    ):
        # Make the stub raise after pre_check would have happened, so we
        # get a failure path that still lets us inspect pre_check_mock.
        client_mock.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=RuntimeError("http stub"),
        )
        with pytest.raises(RuntimeError, match="http stub"):
            await service.generate(
                model="m",
                messages=[{"role": "user", "content": "x"}],
            )
    pre_check_mock.assert_not_called()
