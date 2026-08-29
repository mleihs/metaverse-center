"""Unit tests for ScoringService — 5-dimension scoring, normalization, compositing."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.scoring_service import ScoringService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
SIM_ID_A = str(uuid4())
SIM_ID_B = str(uuid4())
SIM_ID_C = str(uuid4())


def _make_chain(**kwargs):
    """Create a mock Supabase query chain."""
    c = MagicMock()
    c.select.return_value = c
    c.eq.return_value = c
    c.in_.return_value = c
    c.or_.return_value = c
    c.single.return_value = c
    c.maybe_single.return_value = c
    c.limit.return_value = c
    c.order.return_value = c
    c.insert.return_value = c
    c.update.return_value = c
    c.upsert.return_value = c
    c.range.return_value = c
    c.is_.return_value = c
    for k, v in kwargs.items():
        setattr(c, k, v)
    return c


# ── Stability Scoring ──────────────────────────────────────────


class TestFinalStandings:
    @pytest.mark.asyncio
    async def test_rejects_non_completed_epoch(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition", "config": {}}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_allows_completed_epoch(self):
        """Completed epoch should not raise."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed", "config": {}, "current_cycle": 5}
        ))

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            return scores_chain

        sb.table.side_effect = table_router

        result = await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_allows_cancelled_epoch(self):
        """Cancelled epoch should also be allowed for final standings."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "cancelled", "config": {}, "current_cycle": 3}
        ))

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            return scores_chain

        sb.table.side_effect = table_router

        result = await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert isinstance(result, list)


# ── Logging Tests ────────────────────────────────────────────


class TestScoringServiceLogging:
    """Verify logging output for scoring operations."""

    @pytest.mark.asyncio
    async def test_compute_logs_start(self, caplog, route_secdef_admin):
        """compute_cycle_scores should log INFO at start with epoch_id and cycle_number."""
        sb = MagicMock()

        # rpc chain for refresh_all_game_metrics
        rpc_chain = MagicMock()
        rpc_chain.execute = AsyncMock(return_value=MagicMock())
        sb.rpc.return_value = rpc_chain

        route_secdef_admin(sb)
        # Mock EpochService.get and list_participants
        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value={"id": str(EPOCH_ID), "status": "competition", "config": {}},
            ),
            patch(
                "backend.services.scoring_service.EpochService.list_participants",
                new_callable=AsyncMock,
                return_value=[],
            ),
            caplog.at_level(logging.INFO, logger="backend.services.scoring_service"),
        ):
            await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 3)

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "Computing" in r.message]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.epoch_id == str(EPOCH_ID)
        assert record.cycle_number == 3

    @pytest.mark.asyncio
    async def test_empty_rpc_logs_warning(self, caplog, route_secdef_admin):
        """Scoring RPC returning no data should log WARNING."""
        sb = MagicMock()

        # RPC returns empty (no participants). Since migration 187, MV refresh
        # happens inside the SQL function — Python no longer calls
        # refresh_all_game_metrics separately.
        def rpc_side_effect(name, *args, **kwargs):
            chain = MagicMock()
            if name == "fn_compute_cycle_scores":
                chain.execute = AsyncMock(return_value=MagicMock(data=[]))
            else:
                chain.execute = AsyncMock(return_value=MagicMock())
            return chain

        sb.rpc.side_effect = rpc_side_effect

        route_secdef_admin(sb)
        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value={"id": str(EPOCH_ID), "status": "competition", "config": {}},
            ),
            caplog.at_level(logging.ERROR, logger="backend.services.scoring_service"),
        ):
            result = await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 1)

        assert result == []
        error_records = [r for r in caplog.records if r.levelno == logging.ERROR and "no data" in r.message.lower()]
        assert len(error_records) >= 1
