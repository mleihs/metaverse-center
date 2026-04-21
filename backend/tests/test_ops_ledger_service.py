"""Tests for OpsLedgerService — the read-facade for Bureau Ops panels.

Covers:
  1. get_ledger_snapshot parses RPC response shape
  2. get_ledger_snapshot honors the 30s cache
  3. invalidate_ledger_cache clears the cache
  4. get_firehose projects ai_usage_log rows to FirehoseEntry
  5. get_firehose strips metadata / never surfaces prompt bodies (D-4)
  6. get_circuit_matrix combines in-process + persisted state
  7. get_audit_log projects rows
  8. log_action writes a correct ops_audit_log entry
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from backend.services import ops_ledger_service
from backend.services.circuit_breaker_service import CircuitBreakerService
from backend.services.ops_ledger_service import (
    OpsLedgerService,
    invalidate_ledger_cache,
)

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ENTRY_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


def _mock_supabase(execute_data=None):
    """Build a chainable Supabase mock where every method returns the same chain."""
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = execute_data
    chain.execute = AsyncMock(return_value=result)
    for method in (
        "select",
        "eq",
        "neq",
        "gte",
        "lte",
        "insert",
        "update",
        "delete",
        "upsert",
        "limit",
        "single",
        "maybe_single",
        "order",
        "in_",
    ):
        getattr(chain, method).return_value = chain
    mock.table.return_value = chain
    mock.rpc.return_value = chain
    return mock, chain


# ── Ledger snapshot + cache ──────────────────────────────────────────────


LEDGER_RPC_PAYLOAD = {
    "today": {"calls": 12, "tokens": 3456, "cost_usd": 1.2345},
    "month": {"calls": 200, "tokens": 98765, "cost_usd": 12.5},
    "last_hour": {"calls": 3, "tokens": 500, "cost_usd": 0.2},
    "hourly_trend": [
        {"calls": 1, "tokens": 100, "cost_usd": 0.05},
        {"calls": 2, "tokens": 200, "cost_usd": 0.1},
    ],
    "by_purpose": [{"key": "forge", "calls": 5, "tokens": 1000, "cost_usd": 0.5}],
    "by_model": [{"key": "anthropic/claude-sonnet-4", "calls": 12, "tokens": 3456, "cost_usd": 1.2}],
    "by_provider": [{"key": "openrouter", "calls": 12, "tokens": 3456, "cost_usd": 1.2345}],
    "generated_at": "2026-04-21T12:00:00+00:00",
}


class TestLedgerSnapshot:
    @pytest.mark.asyncio
    async def test_parses_rpc_payload(self):
        invalidate_ledger_cache()
        mock, chain = _mock_supabase(execute_data=LEDGER_RPC_PAYLOAD)

        snap = await OpsLedgerService.get_ledger_snapshot(mock)

        assert snap.today.calls == 12
        assert snap.today.cost_usd == 1.2345
        assert snap.month.tokens == 98765
        assert snap.last_hour.cost_usd == 0.2
        assert len(snap.hourly_trend) == 2
        assert snap.by_purpose[0].key == "forge"
        assert snap.by_model[0].key == "anthropic/claude-sonnet-4"
        mock.rpc.assert_called_once_with("get_ops_ledger", {})

    @pytest.mark.asyncio
    async def test_cache_prevents_second_call(self):
        invalidate_ledger_cache()
        mock, chain = _mock_supabase(execute_data=LEDGER_RPC_PAYLOAD)

        await OpsLedgerService.get_ledger_snapshot(mock)
        await OpsLedgerService.get_ledger_snapshot(mock)

        assert mock.rpc.call_count == 1, "Second call should hit cache"

    @pytest.mark.asyncio
    async def test_invalidate_forces_refetch(self):
        invalidate_ledger_cache()
        mock, chain = _mock_supabase(execute_data=LEDGER_RPC_PAYLOAD)

        await OpsLedgerService.get_ledger_snapshot(mock)
        invalidate_ledger_cache()
        await OpsLedgerService.get_ledger_snapshot(mock)

        assert mock.rpc.call_count == 2


# ── Firehose ────────────────────────────────────────────────────────────


FIREHOSE_ROW = {
    "id": str(ENTRY_ID),
    "created_at": "2026-04-21T12:00:00+00:00",
    "provider": "openrouter",
    "model": "anthropic/claude-haiku-4",
    "purpose": "chat",
    "total_tokens": 500,
    "estimated_cost_usd": 0.0042,
    "duration_ms": 1234,
    "simulation_id": str(SIM_ID),
    "user_id": str(USER_ID),
    "key_source": "platform",
    "metadata": {"prompt_body": "THIS MUST NEVER LEAK", "status": "ok"},
}


class TestFirehose:
    @pytest.mark.asyncio
    async def test_projects_rows_to_entries(self):
        mock, chain = _mock_supabase(execute_data=[FIREHOSE_ROW])

        entries = await OpsLedgerService.get_firehose(mock, limit=10)

        assert len(entries) == 1
        e = entries[0]
        assert e.id == ENTRY_ID
        assert e.provider == "openrouter"
        assert e.model == "anthropic/claude-haiku-4"
        assert e.purpose == "chat"
        assert e.total_tokens == 500
        assert e.estimated_cost_usd == 0.0042
        assert e.simulation_id == SIM_ID
        assert e.user_id == USER_ID
        assert e.status == "ok"

    @pytest.mark.asyncio
    async def test_never_surfaces_prompt_body_d4(self):
        """D-4: prompt_body in metadata must not appear on the DTO."""
        mock, chain = _mock_supabase(execute_data=[FIREHOSE_ROW])

        entries = await OpsLedgerService.get_firehose(mock, limit=10)

        entry_dict = entries[0].model_dump()
        assert "prompt_body" not in str(entry_dict)
        assert "THIS MUST NEVER LEAK" not in str(entry_dict)

    @pytest.mark.asyncio
    async def test_error_status_propagates(self):
        row = {**FIREHOSE_ROW, "metadata": {"status": "error"}}
        mock, chain = _mock_supabase(execute_data=[row])

        entries = await OpsLedgerService.get_firehose(mock)

        assert entries[0].status == "error"

    @pytest.mark.asyncio
    async def test_empty_result_returns_empty_list(self):
        mock, chain = _mock_supabase(execute_data=[])

        entries = await OpsLedgerService.get_firehose(mock)

        assert entries == []


# ── Circuit matrix ──────────────────────────────────────────────────────


class TestCircuitMatrix:
    @pytest.mark.asyncio
    async def test_combines_in_process_and_killed(self, monkeypatch):
        # Stub the singleton circuit breaker with a known snapshot
        cb = CircuitBreakerService()
        cb.record_failure("provider", "openrouter")  # in-process entry

        monkeypatch.setattr(ops_ledger_service, "circuit_breaker", cb)

        killed_row = {
            "scope": "model",
            "scope_key": "anthropic/claude-haiku-4",
            "state": "killed",
            "reason": "budget exceeded",
            "revert_at": "2026-04-21T13:00:00+00:00",
            "triggered_by_id": str(USER_ID),
        }
        mock, chain = _mock_supabase(execute_data=[killed_row])

        matrix = await OpsLedgerService.get_circuit_matrix(mock)

        scopes = {(e.scope, e.scope_key): e for e in matrix.entries}
        assert ("provider", "openrouter") in scopes
        assert ("model", "anthropic/claude-haiku-4") in scopes
        killed = scopes[("model", "anthropic/claude-haiku-4")]
        assert killed.state == "killed"
        assert killed.killed_reason == "budget exceeded"
        assert killed.killed_by_id == USER_ID

    @pytest.mark.asyncio
    async def test_handles_empty_db_and_empty_inprocess(self, monkeypatch):
        cb = CircuitBreakerService()
        monkeypatch.setattr(ops_ledger_service, "circuit_breaker", cb)
        mock, chain = _mock_supabase(execute_data=[])

        matrix = await OpsLedgerService.get_circuit_matrix(mock)

        assert matrix.entries == []
        assert isinstance(matrix.generated_at, datetime)


# ── Audit log ───────────────────────────────────────────────────────────


AUDIT_ROW = {
    "id": str(ENTRY_ID),
    "actor_id": str(USER_ID),
    "action": "kill.trip",
    "target_scope": "provider",
    "target_key": "openrouter",
    "reason": "test",
    "payload": {"revert_after_minutes": 60},
    "created_at": "2026-04-21T12:00:00+00:00",
}


class TestAuditLog:
    @pytest.mark.asyncio
    async def test_read_projects_rows(self):
        mock, chain = _mock_supabase(execute_data=[AUDIT_ROW])

        entries = await OpsLedgerService.get_audit_log(mock, days=7, limit=50)

        assert len(entries) == 1
        assert entries[0].action == "kill.trip"
        assert entries[0].reason == "test"
        assert entries[0].actor_id == USER_ID

    @pytest.mark.asyncio
    async def test_log_action_writes_row(self):
        mock, chain = _mock_supabase(execute_data=[])

        await OpsLedgerService.log_action(
            mock,
            actor_id=USER_ID,
            action="kill.trip",
            target_scope="provider",
            target_key="openrouter",
            reason="test reason",
            payload={"foo": "bar"},
        )

        chain.insert.assert_called_once()
        insert_payload = chain.insert.call_args.args[0]
        assert insert_payload["action"] == "kill.trip"
        assert insert_payload["target_scope"] == "provider"
        assert insert_payload["target_key"] == "openrouter"
        assert insert_payload["reason"] == "test reason"
        assert insert_payload["actor_id"] == str(USER_ID)
        assert insert_payload["payload"] == {"foo": "bar"}

    @pytest.mark.asyncio
    async def test_log_action_never_raises(self):
        """Audit-log failure must never abort the mutation that triggered it."""
        mock = MagicMock()
        chain = MagicMock()
        chain.execute = AsyncMock(side_effect=RuntimeError("DB down"))
        chain.insert.return_value = chain
        mock.table.return_value = chain

        # Should not raise
        await OpsLedgerService.log_action(
            mock,
            actor_id=USER_ID,
            action="kill.trip",
            target_scope=None,
            target_key=None,
            reason="x" * 10,
        )
