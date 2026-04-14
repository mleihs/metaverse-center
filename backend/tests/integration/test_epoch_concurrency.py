"""Integration tests for epoch atomic RPCs (migration 214) under concurrency.

Verifies that the Postgres-level atomic operations (fn_spend_rp_atomic,
fn_join_epoch_atomic, fn_join_team_checked) properly prevent race conditions
when multiple coroutines hit the same rows concurrently.

Requires a live Supabase instance. Skipped automatically when unavailable.
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.cycle_resolution_service import CycleResolutionService
from backend.services.epoch_participation_service import EpochParticipationService
from backend.tests.integration.conftest import EpochFixture, requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


# ── Helpers ──────────────────────────────────────────────────────────


def _get_participant_rp(client, epoch_id, simulation_id) -> int:
    """Read a single participant's current_rp via sync admin client."""
    resp = (
        client.table("epoch_participants")
        .select("current_rp")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    )
    return resp.data["current_rp"]


def _count_participants(client, epoch_id) -> int:
    """Count participants in an epoch."""
    resp = (
        client.table("epoch_participants")
        .select("id", count="exact")
        .eq("epoch_id", str(epoch_id))
        .execute()
    )
    return resp.count or 0


def _count_team_members(client, epoch_id, team_id) -> int:
    """Count participants assigned to a specific team."""
    resp = (
        client.table("epoch_participants")
        .select("id", count="exact")
        .eq("epoch_id", str(epoch_id))
        .eq("team_id", str(team_id))
        .execute()
    )
    return resp.count or 0


# ── Concurrent RP Spending ───────────────────────────────────────────


class TestConcurrentSpendRp:
    """Tests that fn_spend_rp_atomic prevents overdraft under concurrency."""

    @pytest.mark.asyncio
    async def test_concurrent_spend_double_drain(self, admin_client, async_admin_client, epoch_factory):
        """Two concurrent spend_rp calls for more than half the balance.

        With 7 RP and two concurrent requests for 5 each, exactly one must
        succeed (atomic WHERE current_rp >= amount prevents overdraft).
        """
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=7, rp_cap=40)
        sim_id = epoch.participants[0].simulation_id

        results = await asyncio.gather(
            CycleResolutionService.spend_rp(async_admin_client, epoch.epoch_id, sim_id, 5),
            CycleResolutionService.spend_rp(async_admin_client, epoch.epoch_id, sim_id, 5),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        failures = [r for r in results if isinstance(r, HTTPException)]

        assert len(successes) == 1, (
            f"Expected exactly 1 success but got {len(successes)}. Results: {results}"
        )
        assert len(failures) == 1, (
            f"Expected exactly 1 HTTPException but got {len(failures)}. Results: {results}"
        )

        # Verify DB state: remaining RP should be 7 - 5 = 2
        final_rp = _get_participant_rp(admin_client, epoch.epoch_id, sim_id)
        assert final_rp == 2, f"Expected 2 RP remaining after single 5-spend, got {final_rp}"

    @pytest.mark.asyncio
    async def test_concurrent_spend_within_budget(self, admin_client, async_admin_client, epoch_factory):
        """Two concurrent spend_rp calls that both fit within the budget.

        With 20 RP and two concurrent requests for 5 each, both must succeed
        because 5 + 5 = 10 <= 20.
        """
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20, rp_cap=40)
        sim_id = epoch.participants[0].simulation_id

        results = await asyncio.gather(
            CycleResolutionService.spend_rp(async_admin_client, epoch.epoch_id, sim_id, 5),
            CycleResolutionService.spend_rp(async_admin_client, epoch.epoch_id, sim_id, 5),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]

        assert len(successes) == 2, (
            f"Expected both spends to succeed (5+5<=20) but got {len(successes)} successes. "
            f"Results: {results}"
        )

        # Both returned ints (remaining RP)
        assert all(isinstance(r, int) for r in successes)

        # Verify DB state: remaining RP should be 20 - 5 - 5 = 10
        final_rp = _get_participant_rp(admin_client, epoch.epoch_id, sim_id)
        assert final_rp == 10, f"Expected 10 RP remaining after two 5-spends, got {final_rp}"


# ── Concurrent Epoch Join ────────────────────────────────────────────


class TestConcurrentJoinEpoch:
    """Tests that fn_join_epoch_atomic prevents duplicate participant rows."""

    @pytest.mark.asyncio
    async def test_concurrent_join_epoch_duplicate(self, admin_client, async_admin_client, epoch_factory):
        """Two concurrent join_epoch calls for the same simulation.

        One must succeed, the other must fail with a conflict error.
        The factory pre-inserts 4 participants, so we delete one first
        to create a joinable slot, then race two joins for that slot.
        """
        epoch: EpochFixture = epoch_factory(status="lobby", cycle=0, rp=10, rp_cap=40)
        target = epoch.participants[0]

        # Remove participant so we can re-join
        admin_client.table("epoch_participants").delete().eq(
            "epoch_id", str(epoch.epoch_id),
        ).eq(
            "simulation_id", str(target.simulation_id),
        ).execute()

        # Verify removal
        pre_count = _count_participants(admin_client, epoch.epoch_id)
        assert pre_count == 3, f"Expected 3 participants after removal, got {pre_count}"

        results = await asyncio.gather(
            EpochParticipationService.join_epoch(
                async_admin_client, epoch.epoch_id, target.simulation_id, target.user_id,
            ),
            EpochParticipationService.join_epoch(
                async_admin_client, epoch.epoch_id, target.simulation_id, target.user_id,
            ),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        failures = [r for r in results if isinstance(r, HTTPException)]

        assert len(successes) == 1, (
            f"Expected exactly 1 successful join but got {len(successes)}. Results: {results}"
        )
        assert len(failures) == 1, (
            f"Expected exactly 1 conflict error but got {len(failures)}. Results: {results}"
        )

        # Verify DB state: back to 4 participants
        post_count = _count_participants(admin_client, epoch.epoch_id)
        assert post_count == 4, f"Expected 4 participants after re-join, got {post_count}"


# ── Concurrent Team Join ─────────────────────────────────────────────


class TestConcurrentJoinTeam:
    """Tests that fn_join_team_checked enforces max_team_size under concurrency."""

    @pytest.mark.asyncio
    async def test_concurrent_team_join_exceeds_max(self, admin_client, async_admin_client, epoch_factory):
        """Three concurrent join_team calls to a team with max_size=2.

        At most 2 should succeed. The RPC locks the team's member rows
        (SELECT ... FOR UPDATE) so the third joiner sees count >= max.
        """
        epoch: EpochFixture = epoch_factory(
            status="foundation", cycle=1, rp=20, rp_cap=40,
        )
        team_id = uuid4()

        # Create a team row for this epoch
        admin_client.table("epoch_teams").insert({
            "id": str(team_id),
            "epoch_id": str(epoch.epoch_id),
            "name": f"Test Alliance {team_id.hex[:8]}",
            "created_by_simulation_id": str(epoch.participants[0].simulation_id),
        }).execute()

        # Clear any existing team assignments so all 4 participants are teamless
        for p in epoch.participants:
            admin_client.table("epoch_participants").update(
                {"team_id": None},
            ).eq(
                "epoch_id", str(epoch.epoch_id),
            ).eq(
                "simulation_id", str(p.simulation_id),
            ).execute()

        # Config max_team_size defaults to 3, but we override to 2 for this test.
        # The RPC takes p_max_size as a parameter, and join_team reads from epoch config.
        # We patch the epoch config to max_team_size=2.
        admin_client.table("game_epochs").update(
            {"config": {**epoch.config, "max_team_size": 2}},
        ).eq("id", str(epoch.epoch_id)).execute()

        # Three concurrent joins from participants [0], [1], [2]
        results = await asyncio.gather(
            EpochParticipationService.join_team(
                async_admin_client, epoch.epoch_id, team_id,
                epoch.participants[0].simulation_id,
            ),
            EpochParticipationService.join_team(
                async_admin_client, epoch.epoch_id, team_id,
                epoch.participants[1].simulation_id,
            ),
            EpochParticipationService.join_team(
                async_admin_client, epoch.epoch_id, team_id,
                epoch.participants[2].simulation_id,
            ),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        failures = [r for r in results if isinstance(r, HTTPException)]

        assert len(successes) <= 2, (
            f"Expected at most 2 successful joins (max_team_size=2) "
            f"but got {len(successes)}. Results: {results}"
        )
        assert len(successes) >= 1, (
            f"Expected at least 1 successful join but got 0. Results: {results}"
        )
        assert len(failures) >= 1, (
            f"Expected at least 1 failure (team full) but got 0. Results: {results}"
        )

        # Verify DB state: team has at most 2 members
        member_count = _count_team_members(admin_client, epoch.epoch_id, team_id)
        assert member_count <= 2, (
            f"Expected at most 2 team members but found {member_count}. "
            "fn_join_team_checked should enforce max_team_size atomically."
        )
        assert member_count == len(successes), (
            f"DB member count ({member_count}) doesn't match success count "
            f"({len(successes)})."
        )
