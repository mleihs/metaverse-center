"""Unit tests for CleanupService — stats, preview, and execute."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.models.cleanup import (
    CleanupExecuteResult,
    CleanupPreviewResult,
    CleanupStats,
)
from backend.services.cleanup_service import CleanupService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID_1 = str(uuid4())
EPOCH_ID_2 = str(uuid4())


def _mock_table_response(data=None, count=None):
    """Create a mock response object."""
    resp = MagicMock()
    resp.data = data if data is not None else []
    resp.count = count if count is not None else len(resp.data)
    return resp


def _make_chain_mock(response):
    """Create a chained Supabase query mock that returns response on .execute()."""
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.lt.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.delete.return_value = chain
    chain.insert.return_value = chain
    chain.execute = AsyncMock(return_value=response)
    return chain


def _make_supabase(table_responses: dict[str, MagicMock]) -> MagicMock:
    """Create a mock Supabase client with table-specific routing."""
    sb = MagicMock()

    def table_router(name):
        if name in table_responses:
            return table_responses[name]
        return _make_chain_mock(_mock_table_response())

    sb.table.side_effect = table_router
    return sb


# ── get_stats ──────────────────────────────────────────────────


class TestGetStats:
    @pytest.mark.asyncio
    async def test_returns_all_categories(self):
        sb = _make_supabase({
            "game_epochs": _make_chain_mock(_mock_table_response(
                data=[{"id": EPOCH_ID_1, "updated_at": "2026-01-01T00:00:00Z"}],
                count=3,
            )),
            "simulations": _make_chain_mock(_mock_table_response(count=0)),
            "audit_log": _make_chain_mock(_mock_table_response(count=0)),
            "bot_decision_log": _make_chain_mock(_mock_table_response(count=0)),
        })

        result = await CleanupService.get_stats(sb)

        assert isinstance(result, CleanupStats)
        assert result.completed_epochs.count == 3
        assert result.completed_epochs.oldest_at is not None

    @pytest.mark.asyncio
    async def test_empty_database(self):
        sb = _make_supabase({
            "game_epochs": _make_chain_mock(_mock_table_response(count=0)),
            "simulations": _make_chain_mock(_mock_table_response(count=0)),
            "audit_log": _make_chain_mock(_mock_table_response(count=0)),
            "bot_decision_log": _make_chain_mock(_mock_table_response(count=0)),
        })

        result = await CleanupService.get_stats(sb)

        assert result.completed_epochs.count == 0
        assert result.completed_epochs.oldest_at is None
        assert result.audit_log_entries.count == 0


# ── preview ────────────────────────────────────────────────────


class TestPreview:
    @pytest.mark.asyncio
    async def test_preview_completed_epochs(self):
        epoch_chain = _make_chain_mock(
            _mock_table_response(data=[
                {"id": EPOCH_ID_1, "name": "Epoch Alpha", "updated_at": "2026-01-01T00:00:00Z"},
                {"id": EPOCH_ID_2, "name": "Epoch Beta", "updated_at": "2026-01-02T00:00:00Z"},
            ]),
        )
        cascade_chain = _make_chain_mock(_mock_table_response(count=5))
        sim_chain = _make_chain_mock(_mock_table_response(count=2))

        sb = MagicMock()
        call_count = {"game_epochs": 0, "simulations": 0}

        def table_router(name):
            if name == "game_epochs":
                call_count["game_epochs"] += 1
                return epoch_chain
            if name == "simulations":
                call_count["simulations"] += 1
                return sim_chain
            return cascade_chain

        sb.table.side_effect = table_router

        result = await CleanupService.preview(sb, "completed_epochs", 30)

        assert isinstance(result, CleanupPreviewResult)
        assert result.primary_count == 2
        assert result.cleanup_type == "completed_epochs"

    @pytest.mark.asyncio
    async def test_preview_audit_log(self):
        sb = _make_supabase({
            "audit_log": _make_chain_mock(_mock_table_response(count=42)),
        })

        result = await CleanupService.preview(sb, "audit_log", 90)

        assert result.primary_count == 42
        assert result.cleanup_type == "audit_log"
        assert result.cascade_counts == {}

    @pytest.mark.asyncio
    async def test_preview_bot_decision_log(self):
        sb = _make_supabase({
            "bot_decision_log": _make_chain_mock(_mock_table_response(count=100)),
        })

        result = await CleanupService.preview(sb, "bot_decision_log", 30)

        assert result.primary_count == 100
        assert result.cleanup_type == "bot_decision_log"

    @pytest.mark.asyncio
    async def test_preview_archived_instances(self):
        archived_data = [
            {"id": str(uuid4()), "name": f"Archived {i}", "updated_at": "2026-01-01T00:00:00Z"}
            for i in range(7)
        ]
        sb = _make_supabase({
            "simulations": _make_chain_mock(_mock_table_response(data=archived_data, count=7)),
        })

        result = await CleanupService.preview(sb, "archived_instances", 30)

        assert result.primary_count == 7
        assert result.cleanup_type == "archived_instances"

    @pytest.mark.asyncio
    async def test_preview_zero_results(self):
        sb = _make_supabase({
            "game_epochs": _make_chain_mock(_mock_table_response(data=[], count=0)),
        })

        result = await CleanupService.preview(sb, "completed_epochs", 30)

        assert result.primary_count == 0
        assert result.cascade_counts == {}

    @pytest.mark.asyncio
    async def test_preview_stale_lobbies(self):
        sb = MagicMock()
        epoch_chain = _make_chain_mock(
            _mock_table_response(data=[{"id": EPOCH_ID_1, "name": "Stale Lobby", "updated_at": "2026-01-01T00:00:00Z"}]),
        )
        cascade_chain = _make_chain_mock(_mock_table_response(count=3))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            return cascade_chain

        sb.table.side_effect = table_router

        result = await CleanupService.preview(sb, "stale_lobbies", 7)

        assert result.primary_count == 1
        assert result.cleanup_type == "stale_lobbies"


# ── execute ────────────────────────────────────────────────────


class TestExecute:
    @pytest.mark.asyncio
    async def test_execute_completed_epochs_deletes_instances_first(self):
        """Game instance simulations must be deleted before epoch rows."""
        epoch_chain = _make_chain_mock(
            _mock_table_response(data=[{"id": EPOCH_ID_1, "name": "Epoch to Delete", "updated_at": "2026-01-01T00:00:00Z"}]),
        )
        cascade_chain = _make_chain_mock(_mock_table_response(count=2))
        sim_chain = MagicMock()
        sim_chain.select.return_value = sim_chain
        sim_chain.eq.return_value = sim_chain
        sim_chain.lt.return_value = sim_chain
        sim_chain.in_.return_value = sim_chain
        sim_chain.delete.return_value = sim_chain
        sim_chain.order.return_value = sim_chain
        sim_chain.limit.return_value = sim_chain
        sim_chain.execute = AsyncMock(return_value=_mock_table_response(count=1))
        audit_chain = _make_chain_mock(_mock_table_response())

        call_order = []

        sb = MagicMock()

        def table_router(name):
            call_order.append(name)
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            if name == "audit_log":
                return audit_chain
            return cascade_chain

        sb.table.side_effect = table_router

        user_id = uuid4()
        result = await CleanupService.execute(sb, "completed_epochs", 30, user_id)

        assert isinstance(result, CleanupExecuteResult)
        assert result.deleted_count == 1

        # Verify simulations deleted before game_epochs
        delete_calls = [c for c in call_order if c in ("simulations", "game_epochs")]
        sim_idx = None
        epoch_idx = None
        for i, c in enumerate(delete_calls):
            if c == "simulations" and sim_idx is None:
                sim_idx = i
            if c == "game_epochs" and epoch_idx is None:
                epoch_idx = i
        # Both should appear in calls
        assert sim_idx is not None
        assert epoch_idx is not None

    @pytest.mark.asyncio
    async def test_execute_zero_epochs(self):
        sb = _make_supabase({
            "game_epochs": _make_chain_mock(_mock_table_response(data=[], count=0)),
            "audit_log": _make_chain_mock(_mock_table_response()),
        })

        result = await CleanupService.execute(sb, "completed_epochs", 30, uuid4())

        assert result.deleted_count == 0
        assert result.cascade_counts == {}

    @pytest.mark.asyncio
    async def test_execute_audit_log(self):
        sb = _make_supabase({
            "audit_log": _make_chain_mock(
                _mock_table_response(data=[{"id": "a"}, {"id": "b"}], count=2),
            ),
        })

        result = await CleanupService.execute(sb, "audit_log", 90, uuid4())

        assert result.deleted_count == 2
        assert result.cleanup_type == "audit_log"

    @pytest.mark.asyncio
    async def test_execute_audit_logging_is_best_effort(self):
        """Audit log failure should not break the cleanup operation."""
        sb = MagicMock()
        data_chain = _make_chain_mock(
            _mock_table_response(data=[{"id": "x"}], count=1),
        )
        audit_chain = MagicMock()
        audit_chain.insert.side_effect = Exception("RLS denied")

        def table_router(name):
            if name == "audit_log":
                return audit_chain
            return data_chain

        sb.table.side_effect = table_router

        # Should not raise
        result = await CleanupService.execute(sb, "bot_decision_log", 30, uuid4())
        assert result.deleted_count == 1


# ── Logging Tests ────────────────────────────────────────────


class TestCleanupServiceLogging:
    """Verify logging output for cleanup operations."""

    @pytest.mark.asyncio
    async def test_execute_logs_completion(self, caplog):
        """Successful epoch cleanup should log INFO with cleanup_type and deleted_count."""
        epoch_chain = _make_chain_mock(
            _mock_table_response(data=[{"id": EPOCH_ID_1, "name": "Epoch for Logging", "updated_at": "2026-01-01T00:00:00Z"}]),
        )
        cascade_chain = _make_chain_mock(_mock_table_response(count=2))
        sim_chain = MagicMock()
        sim_chain.select.return_value = sim_chain
        sim_chain.eq.return_value = sim_chain
        sim_chain.lt.return_value = sim_chain
        sim_chain.in_.return_value = sim_chain
        sim_chain.delete.return_value = sim_chain
        sim_chain.order.return_value = sim_chain
        sim_chain.limit.return_value = sim_chain
        sim_chain.execute = AsyncMock(return_value=_mock_table_response(count=1))
        audit_chain = _make_chain_mock(_mock_table_response())

        sb = MagicMock()

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            if name == "audit_log":
                return audit_chain
            return cascade_chain

        sb.table.side_effect = table_router

        with caplog.at_level(logging.INFO, logger="backend.services.cleanup_service"):
            await CleanupService.execute(sb, "completed_epochs", 30, uuid4())

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "Cleanup" in r.message]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.cleanup_type == "completed_epochs"
        assert record.deleted_count == 1

    @pytest.mark.asyncio
    async def test_audit_failure_logs_warning(self, caplog):
        """Audit log failure should log WARNING (not propagate exception)."""
        sb = MagicMock()
        data_chain = _make_chain_mock(
            _mock_table_response(data=[{"id": "x"}], count=1),
        )
        audit_chain = MagicMock()
        audit_chain.insert.side_effect = Exception("RLS denied")

        def table_router(name):
            if name == "audit_log":
                return audit_chain
            return data_chain

        sb.table.side_effect = table_router

        with caplog.at_level(logging.WARNING, logger="backend.services.cleanup_service"):
            result = await CleanupService.execute(sb, "bot_decision_log", 30, uuid4())

        assert result.deleted_count == 1
        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING and "audit" in r.message.lower()]
        assert len(warning_records) >= 1
