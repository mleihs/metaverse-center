"""Integration tests for scoring engine against real Supabase."""

import pytest

from backend.services.scoring_service import ScoringService
from backend.tests.integration.conftest import EpochFixture, requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


class TestScoringRPC:
    @pytest.mark.asyncio
    async def test_compute_cycle_scores_creates_rows(self, admin_client, epoch_factory):
        """fn_compute_cycle_scores RPC inserts score rows for all participants."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)

        scores = await ScoringService.compute_cycle_scores(
            admin_client, epoch.epoch_id, cycle_number=3,
        )

        # Should have 1 score row per participant
        assert len(scores) == len(epoch.participants)

        # Verify rows persisted in DB
        db_scores = (
            admin_client.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch.epoch_id))
            .eq("cycle_number", 3)
            .execute()
        ).data or []
        assert len(db_scores) == len(epoch.participants)

    @pytest.mark.asyncio
    async def test_leaderboard_returns_all_participants(self, admin_client, epoch_factory):
        """Leaderboard includes all participants with scores."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)

        # Generate scores first
        await ScoringService.compute_cycle_scores(
            admin_client, epoch.epoch_id, cycle_number=3,
        )

        leaderboard = await ScoringService.get_leaderboard(
            admin_client, epoch.epoch_id,
        )

        assert len(leaderboard) == len(epoch.participants)
        # Should be ordered by rank
        for i, entry in enumerate(leaderboard):
            assert entry["rank"] == i + 1
