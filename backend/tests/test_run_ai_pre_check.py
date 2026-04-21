"""Unit tests for the Bureau Ops pre_check integration in run_ai (A.1).

Pins the contract that run_ai() fires BudgetEnforcementService.pre_check
when (and only when) ``admin_supabase`` is provided, and that a
BudgetExceededError short-circuits the upstream call entirely — the
existing retry/fallback loop must never run after a budget block.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from backend.services.ai_utils import run_ai
from backend.services.budget_enforcement_service import BudgetExceededError

_SIM = UUID("10000000-0000-0000-0000-000000000001")
_USER = UUID("20000000-0000-0000-0000-000000000001")


def _stub_agent() -> MagicMock:
    """Minimal pydantic-ai Agent stub — .run returns a MagicMock with output."""
    agent = MagicMock()
    agent.run = AsyncMock(return_value=MagicMock(output="ok"))
    return agent


@pytest.mark.asyncio
async def test_no_admin_supabase_skips_pre_check() -> None:
    # Backwards-compatible default: callers that predate Deferral A do
    # not pass admin_supabase and must not trigger any pre_check
    # plumbing.
    agent = _stub_agent()
    with patch(
        "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
        new_callable=AsyncMock,
    ) as pre_check_mock:
        result = await run_ai(agent, "prompt", "forge")
    assert result.output == "ok"
    pre_check_mock.assert_not_called()


@pytest.mark.asyncio
async def test_admin_supabase_triggers_pre_check_with_full_context() -> None:
    agent = _stub_agent()
    admin = MagicMock()
    with patch(
        "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
        new_callable=AsyncMock,
    ) as pre_check_mock:
        await run_ai(
            agent,
            "prompt",
            "forge",
            admin_supabase=admin,
            simulation_id=_SIM,
            user_id=_USER,
        )
    pre_check_mock.assert_awaited_once_with(
        admin, purpose="forge", simulation_id=_SIM, user_id=_USER,
    )


@pytest.mark.asyncio
async def test_budget_exceeded_aborts_before_agent_run() -> None:
    # Hard-block must never fall through to the retry loop — the
    # upstream call would burn credits the budget was meant to
    # protect.
    agent = _stub_agent()
    admin = MagicMock()
    with patch(
        "backend.services.budget_enforcement_service.BudgetEnforcementService.pre_check",
        new_callable=AsyncMock,
        side_effect=BudgetExceededError(
            scope="purpose",
            scope_key="forge",
            period="day",
            current_usd=20.05,
            max_usd=20.00,
        ),
    ):
        with pytest.raises(BudgetExceededError):
            await run_ai(
                agent,
                "prompt",
                "forge",
                admin_supabase=admin,
                simulation_id=uuid4(),
            )


# ── safe_background + BudgetExceededError (Deferral A.2 follow-up) ──


@pytest.mark.asyncio
async def test_safe_background_catches_budget_exceeded_at_info_level() -> None:
    """A.2 follow-up — admin-triggered budget blocks in Forge background
    tasks must NOT consume Sentry's error budget. `safe_background` catches
    ``BudgetExceededError`` BEFORE the generic exception handler so the
    event is logged at INFO and `sentry_sdk.capture_exception` is never
    called.

    Complements the user-facing path: the FastAPI
    ``budget_exceeded_handler`` already logs at WARNING + returns 503 for
    synchronous requests; this test pins the equivalent contract for the
    background/scheduler path.
    """
    from backend.services.ai_utils import safe_background

    @safe_background
    async def task_that_budget_blocks() -> None:
        raise BudgetExceededError(
            scope="global",
            scope_key="all",
            period="hour",
            current_usd=1.01,
            max_usd=1.00,
        )

    with patch("backend.services.ai_utils.sentry_sdk") as sentry_mock:
        # Must NOT raise — safe_background always swallows.
        await task_that_budget_blocks()

    sentry_mock.capture_exception.assert_not_called()


@pytest.mark.asyncio
async def test_safe_background_still_captures_non_budget_exceptions() -> None:
    """Regression guard: the BudgetExceededError branch is additive and
    must not break existing behaviour for ordinary failures. Any other
    exception (here a ValueError) still flows through
    ``sentry_sdk.capture_exception``.
    """
    from backend.services.ai_utils import safe_background

    @safe_background
    async def task_that_errors() -> None:
        raise ValueError("genuine failure")

    with patch("backend.services.ai_utils.sentry_sdk") as sentry_mock:
        await task_that_errors()

    sentry_mock.capture_exception.assert_called_once()
