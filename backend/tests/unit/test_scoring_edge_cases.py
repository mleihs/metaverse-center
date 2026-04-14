"""Unit tests for ScoringService edge cases — empty data, zeros, ties, and bots.

Covers scenarios the main test_scoring_service.py does not exercise:
dense ranking ties, zero-participant epochs, all-bot epochs, and
zero-value stability inputs.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.scoring_service import ScoringService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
SIM_ID_A = str(uuid4())
SIM_ID_B = str(uuid4())
SIM_ID_C = str(uuid4())
SIM_ID_D = str(uuid4())


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


def _score_row(sim_id: str, composite: float, **dim_scores) -> dict:
    """Build a mock epoch_scores row with defaults for all dimensions."""
    return {
        "id": str(uuid4()),
        "epoch_id": str(EPOCH_ID),
        "simulation_id": sim_id,
        "cycle_number": 1,
        "stability_score": dim_scores.get("stability", 50.0),
        "influence_score": dim_scores.get("influence", 10.0),
        "sovereignty_score": dim_scores.get("sovereignty", 50.0),
        "diplomatic_score": dim_scores.get("diplomatic", 10.0),
        "military_score": dim_scores.get("military", 10.0),
        "composite_score": composite,
    }


# ── Leaderboard Dense Ranking ────────────────────────────────


class TestLeaderboardDenseRanking:
    """Verify dense ranking: tied composite scores share the same rank."""

    @pytest.mark.asyncio
    async def test_tied_scores_share_rank(self):
        """Four participants with two pairs of ties: A=B=85, C=D=70."""
        sb = MagicMock()

        # Scores sorted by composite_score desc (as the query's .order() does)
        scores_data = [
            _score_row(SIM_ID_A, 85.0),
            _score_row(SIM_ID_B, 85.0),
            _score_row(SIM_ID_C, 70.0),
            _score_row(SIM_ID_D, 70.0),
        ]

        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {},
            "current_cycle": 2,
        }

        # epoch_scores query (cycle_number lookup + main scores query)
        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=scores_data))

        # epoch_participants query (team assignments)
        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_ID_A, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
            {"simulation_id": SIM_ID_B, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
            {"simulation_id": SIM_ID_C, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
            {"simulation_id": SIM_ID_D, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
        ]))

        def table_router(name):
            if name == "epoch_scores":
                return scores_chain
            if name == "epoch_participants":
                return participants_chain
            return _make_chain()

        sb.table.side_effect = table_router

        sim_map = {
            SIM_ID_A: {"name": "Alpha", "slug": "alpha"},
            SIM_ID_B: {"name": "Beta", "slug": "beta"},
            SIM_ID_C: {"name": "Gamma", "slug": "gamma"},
            SIM_ID_D: {"name": "Delta", "slug": "delta"},
        }

        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value=epoch_data,
            ),
            patch(
                "backend.services.scoring_service.resolve_epoch_sim_names",
                new_callable=AsyncMock,
                return_value=sim_map,
            ),
        ):
            result = await ScoringService.get_leaderboard(sb, EPOCH_ID, 1)

        assert len(result) == 4
        # A and B tied at 85 — both rank 1
        assert result[0]["rank"] == 1
        assert result[1]["rank"] == 1
        # C and D tied at 70 — rank 3 (dense: skips rank 2)
        assert result[2]["rank"] == 3
        assert result[3]["rank"] == 3

    @pytest.mark.asyncio
    async def test_single_participant_rank_1(self):
        """A single participant always gets rank 1."""
        sb = MagicMock()

        scores_data = [_score_row(SIM_ID_A, 42.5)]

        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {},
            "current_cycle": 2,
        }

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=scores_data))

        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_ID_A, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
        ]))

        def table_router(name):
            if name == "epoch_scores":
                return scores_chain
            if name == "epoch_participants":
                return participants_chain
            return _make_chain()

        sb.table.side_effect = table_router

        sim_map = {SIM_ID_A: {"name": "Solo", "slug": "solo"}}

        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value=epoch_data,
            ),
            patch(
                "backend.services.scoring_service.resolve_epoch_sim_names",
                new_callable=AsyncMock,
                return_value=sim_map,
            ),
        ):
            result = await ScoringService.get_leaderboard(sb, EPOCH_ID, 1)

        assert len(result) == 1
        assert result[0]["rank"] == 1
        assert result[0]["composite"] == 42.5

    @pytest.mark.asyncio
    async def test_all_zero_scores(self):
        """Three participants all at composite 0 — all share rank 1."""
        sb = MagicMock()

        scores_data = [
            _score_row(SIM_ID_A, 0.0, stability=0, influence=0, sovereignty=0, diplomatic=0, military=0),
            _score_row(SIM_ID_B, 0.0, stability=0, influence=0, sovereignty=0, diplomatic=0, military=0),
            _score_row(SIM_ID_C, 0.0, stability=0, influence=0, sovereignty=0, diplomatic=0, military=0),
        ]

        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {},
            "current_cycle": 2,
        }

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=scores_data))

        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_ID_A, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
            {"simulation_id": SIM_ID_B, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
            {"simulation_id": SIM_ID_C, "team_id": None, "betrayal_penalty": 0, "epoch_teams": None},
        ]))

        def table_router(name):
            if name == "epoch_scores":
                return scores_chain
            if name == "epoch_participants":
                return participants_chain
            return _make_chain()

        sb.table.side_effect = table_router

        sim_map = {
            SIM_ID_A: {"name": "Empty-A", "slug": "empty-a"},
            SIM_ID_B: {"name": "Empty-B", "slug": "empty-b"},
            SIM_ID_C: {"name": "Empty-C", "slug": "empty-c"},
        }

        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value=epoch_data,
            ),
            patch(
                "backend.services.scoring_service.resolve_epoch_sim_names",
                new_callable=AsyncMock,
                return_value=sim_map,
            ),
        ):
            result = await ScoringService.get_leaderboard(sb, EPOCH_ID, 1)

        assert len(result) == 3
        # All tied at 0 — all rank 1
        assert all(entry["rank"] == 1 for entry in result)
        assert all(entry["composite"] == 0.0 for entry in result)


# ── Stability Edge Cases ─────────────────────────────────────


class TestStabilityEdgeCases:
    """Edge cases for _compute_stability when zone data is absent or zero."""

    @pytest.mark.asyncio
    async def test_no_zones_returns_default_50(self):
        """No zone stability data defaults to 50.0 base (not crash, not zero)."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        events_chain = _make_chain()
        events_chain.execute = AsyncMock(return_value=MagicMock(data=[], count=0))

        missions_chain = _make_chain()
        missions_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        # Empty zone data → 50.0 default base, no penalties → 50.0
        assert result == 50.0

    @pytest.mark.asyncio
    async def test_all_zero_stability(self):
        """All zones at stability 0.0 produces base score of 0.0."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"stability": 0.0}, {"stability": 0.0}, {"stability": 0.0}]
        ))

        events_chain = _make_chain()
        events_chain.execute = AsyncMock(return_value=MagicMock(data=[], count=0))

        missions_chain = _make_chain()
        missions_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        # avg(0.0, 0.0, 0.0) * 100 = 0.0, no penalties → 0.0
        assert result == 0.0


# ── Score Computation Edge Cases ─────────────────────────────


class TestScoreComputationEdgeCases:
    """Edge cases for compute_cycle_scores: empty participants, all-bot epochs."""

    @pytest.mark.asyncio
    async def test_zero_participants_empty_result(self):
        """Epoch with zero participants returns empty list from RPC, not a crash."""
        sb = MagicMock()

        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {},
        }

        # fn_compute_cycle_scores RPC returns empty when no participants
        rpc_chain = MagicMock()
        rpc_chain.execute = AsyncMock(return_value=MagicMock(data=[]))
        sb.rpc.return_value = rpc_chain

        with patch(
            "backend.services.scoring_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=epoch_data,
        ):
            result = await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 1)

        assert result == []

    @pytest.mark.asyncio
    async def test_all_bot_epoch_scores(self):
        """All-bot epoch still returns valid scores from the RPC."""
        sb = MagicMock()

        bot_sim_a = str(uuid4())
        bot_sim_b = str(uuid4())

        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {},
        }

        # RPC returns scored rows for bots — bots participate in scoring
        rpc_scores = [
            {
                "simulation_id": bot_sim_a,
                "composite_score": 65.0,
                "stability_score": 70.0,
                "influence_score": 5.0,
                "sovereignty_score": 80.0,
                "diplomatic_score": 0.0,
                "military_score": 10.0,
            },
            {
                "simulation_id": bot_sim_b,
                "composite_score": 55.0,
                "stability_score": 60.0,
                "influence_score": 3.0,
                "sovereignty_score": 70.0,
                "diplomatic_score": 0.0,
                "military_score": 8.0,
            },
        ]

        rpc_chain = MagicMock()
        rpc_chain.execute = AsyncMock(return_value=MagicMock(data=rpc_scores))
        sb.rpc.return_value = rpc_chain

        with patch(
            "backend.services.scoring_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=epoch_data,
        ):
            result = await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 1)

        assert len(result) == 2
        assert result[0]["simulation_id"] == bot_sim_a
        assert result[1]["simulation_id"] == bot_sim_b
        assert result[0]["composite_score"] == 65.0
