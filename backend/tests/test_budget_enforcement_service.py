"""Tests for BudgetEnforcementService — pre-call blocking budget checks.

Covers:
  1. pre_check fail-open when no budget rows match
  2. pre_check passes under soft-warn threshold
  3. pre_check emits Sentry breadcrumb on soft-warn crossing
  4. pre_check raises BudgetExceededError on hard-block crossing
  5. pre_check ignores disabled rows
  6. pre_check matches scope correctly (global + purpose + sim + user)
  7. upsert_budget validates soft <= hard
  8. upsert_budget invalidates cache
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from backend.models.bureau_ops import BudgetUpsertRequest
from backend.services import budget_enforcement_service
from backend.services.budget_enforcement_service import (
    BudgetEnforcementService,
    BudgetExceededError,
    invalidate_budget_cache,
)

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


def _mock_supabase_with_rpc(rpc_payload=None, table_exec_data=None):
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = table_exec_data if table_exec_data is not None else []
    chain.execute = AsyncMock(return_value=result)

    rpc_chain = MagicMock()
    rpc_result = MagicMock()
    rpc_result.data = rpc_payload if rpc_payload is not None else []
    rpc_chain.execute = AsyncMock(return_value=rpc_result)

    for method in (
        "select", "eq", "neq", "insert", "update", "delete", "upsert",
        "limit", "order", "in_", "gte",
    ):
        getattr(chain, method).return_value = chain
    mock.table.return_value = chain
    mock.rpc.return_value = rpc_chain
    return mock, chain, rpc_chain


# ── pre_check: budget scope resolution ──────────────────────────────────


def _budget_row(
    *,
    scope: str = "global",
    scope_key: str = "global",
    period: str = "day",
    max_usd: float = 10.0,
    current_usd: float = 0.0,
    enabled: bool = True,
    soft: int = 75,
    hard: int = 100,
) -> dict:
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "scope": scope,
        "scope_key": scope_key,
        "period": period,
        "max_usd": max_usd,
        "max_calls": None,
        "soft_warn_pct": soft,
        "hard_block_pct": hard,
        "enabled": enabled,
        "current_usd": current_usd,
        "current_calls": 0,
        "updated_by_id": None,
        "updated_at": "2026-04-21T12:00:00+00:00",
        "created_at": "2026-04-21T10:00:00+00:00",
    }


class TestPreCheck:
    @pytest.mark.asyncio
    async def test_no_rows_fail_open(self):
        invalidate_budget_cache()
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=[])

        # Should not raise
        await BudgetEnforcementService.pre_check(
            mock, purpose="forge", simulation_id=SIM_ID, user_id=USER_ID,
        )

    @pytest.mark.asyncio
    async def test_below_soft_warn_passes_silently(self, monkeypatch):
        invalidate_budget_cache()
        rows = [_budget_row(max_usd=10.0, current_usd=1.0, soft=75, hard=100)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        breadcrumbs = []
        monkeypatch.setattr(
            budget_enforcement_service.sentry_sdk,
            "add_breadcrumb",
            lambda **kw: breadcrumbs.append(kw),
        )

        await BudgetEnforcementService.pre_check(mock, purpose="forge")

        assert breadcrumbs == []

    @pytest.mark.asyncio
    async def test_soft_warn_emits_breadcrumb(self, monkeypatch):
        invalidate_budget_cache()
        rows = [_budget_row(max_usd=10.0, current_usd=8.0, soft=75, hard=100)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        breadcrumbs = []
        monkeypatch.setattr(
            budget_enforcement_service.sentry_sdk,
            "add_breadcrumb",
            lambda **kw: breadcrumbs.append(kw),
        )

        await BudgetEnforcementService.pre_check(mock, purpose="forge")

        assert len(breadcrumbs) == 1
        assert breadcrumbs[0]["category"] == "ops"
        assert "soft-warn" in breadcrumbs[0]["message"].lower()

    @pytest.mark.asyncio
    async def test_hard_block_raises(self):
        invalidate_budget_cache()
        rows = [_budget_row(max_usd=10.0, current_usd=11.0, soft=75, hard=100)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        with pytest.raises(BudgetExceededError) as exc_info:
            await BudgetEnforcementService.pre_check(mock, purpose="forge")

        assert exc_info.value.current_usd == 11.0
        assert exc_info.value.max_usd == 10.0
        assert exc_info.value.scope == "global"

    @pytest.mark.asyncio
    async def test_disabled_rows_ignored(self):
        invalidate_budget_cache()
        # Would otherwise block — but enabled=False
        rows = [_budget_row(max_usd=10.0, current_usd=100.0, enabled=False)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        await BudgetEnforcementService.pre_check(mock, purpose="forge")

    @pytest.mark.asyncio
    async def test_purpose_scope_matches_purpose(self):
        invalidate_budget_cache()
        rows = [_budget_row(scope="purpose", scope_key="forge", max_usd=1.0, current_usd=5.0)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        # Other purpose — should pass (row does not apply)
        await BudgetEnforcementService.pre_check(mock, purpose="chat")

        # Matching purpose — should block
        invalidate_budget_cache()
        mock2, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)
        with pytest.raises(BudgetExceededError):
            await BudgetEnforcementService.pre_check(mock2, purpose="forge")

    @pytest.mark.asyncio
    async def test_simulation_scope_requires_matching_id(self):
        invalidate_budget_cache()
        rows = [_budget_row(scope="simulation", scope_key=str(SIM_ID), max_usd=1.0, current_usd=5.0)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        # No sim id passed — should pass (row does not apply)
        await BudgetEnforcementService.pre_check(mock, purpose="forge")

        # Matching sim id — should block
        invalidate_budget_cache()
        mock2, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)
        with pytest.raises(BudgetExceededError):
            await BudgetEnforcementService.pre_check(
                mock2, purpose="forge", simulation_id=SIM_ID,
            )


# ── upsert_budget validation ────────────────────────────────────────────


class TestUpsertBudget:
    @pytest.mark.asyncio
    async def test_invalid_soft_gt_hard_raises(self):
        invalidate_budget_cache()
        mock, _, _ = _mock_supabase_with_rpc()
        body = BudgetUpsertRequest(
            scope="global",
            scope_key="global",
            period="day",
            max_usd=10.0,
            soft_warn_pct=100,
            hard_block_pct=90,
            reason="invalid test",
        )

        with pytest.raises(ValueError):
            await BudgetEnforcementService.upsert_budget(
                mock, actor_id=USER_ID, body=body,
            )

    @pytest.mark.asyncio
    async def test_create_invalidates_cache(self):
        invalidate_budget_cache()
        inserted_row = _budget_row(max_usd=20.0)
        mock, table_chain, _ = _mock_supabase_with_rpc(table_exec_data=[inserted_row])

        # Prime the cache
        (await BudgetEnforcementService.list_budgets(mock))  # noqa: F841 - just priming

        body = BudgetUpsertRequest(
            scope="purpose",
            scope_key="forge",
            period="day",
            max_usd=20.0,
            reason="seed test budget",
        )
        await BudgetEnforcementService.upsert_budget(mock, actor_id=USER_ID, body=body)

        # Cache should have been invalidated
        assert budget_enforcement_service._budget_cache is None


# ── list_budgets ────────────────────────────────────────────────────────


class TestListBudgets:
    @pytest.mark.asyncio
    async def test_projects_rows(self):
        invalidate_budget_cache()
        rows = [_budget_row(max_usd=50.0, current_usd=25.0)]
        mock, _, _ = _mock_supabase_with_rpc(rpc_payload=rows)

        budgets = await BudgetEnforcementService.list_budgets(mock)

        assert len(budgets) == 1
        assert budgets[0].max_usd == 50.0
        assert budgets[0].current_usd == 25.0
        assert budgets[0].enabled is True
