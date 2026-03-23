"""Integration tests for cycle resolution against real Supabase.

Tests the critical game mechanics: RP grants, cycle advancement,
phase transitions, and spend/lock behavior against real DB + RPCs.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.cycle_resolution_service import CycleResolutionService
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from backend.tests.integration.game_constants import (
    SIM_GASLIT_REACH,
    SIM_VELGARIEN,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _get_epoch(client, epoch_id):
    """Read epoch row from DB."""
    return (
        client.table("game_epochs")
        .select("*")
        .eq("id", str(epoch_id))
        .single()
        .execute()
    ).data


def _get_participants(client, epoch_id):
    """Read all participants for an epoch."""
    return (
        client.table("epoch_participants")
        .select("*")
        .eq("epoch_id", str(epoch_id))
        .execute()
    ).data or []


def _get_participant_rp(client, epoch_id, simulation_id):
    """Read a single participant's current_rp."""
    resp = (
        client.table("epoch_participants")
        .select("current_rp")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    )
    return resp.data["current_rp"]


# ── Cycle Resolution ──────────────────────────────────────────────────


class TestResolveCycle:
    @pytest.mark.asyncio
    async def test_increments_cycle(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3)

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        row = _get_epoch(admin_client, epoch.epoch_id)
        assert row["current_cycle"] == 4

    @pytest.mark.asyncio
    async def test_grants_rp_to_all_participants(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(
            status="competition", cycle=1, rp=10, rp_per_cycle=8, rp_cap=40,
        )

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        for p in epoch.participants:
            rp = _get_participant_rp(admin_client, epoch.epoch_id, p.simulation_id)
            assert rp == 18, f"Player {p.user_id} should have 10+8=18 RP, got {rp}"

    @pytest.mark.asyncio
    async def test_respects_rp_cap(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(
            status="competition", cycle=1, rp=35, rp_per_cycle=10, rp_cap=40,
        )

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        for p in epoch.participants:
            rp = _get_participant_rp(admin_client, epoch.epoch_id, p.simulation_id)
            assert rp == 40, f"RP should be capped at 40, got {rp}"

    @pytest.mark.asyncio
    async def test_foundation_bonus(self, admin_client, epoch_factory):
        """Foundation phase grants int(rp_per_cycle * 1.5) RP."""
        epoch: EpochFixture = epoch_factory(
            status="foundation", cycle=1, rp=0, rp_per_cycle=12, rp_cap=40,
        )

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        for p in epoch.participants:
            rp = _get_participant_rp(admin_client, epoch.epoch_id, p.simulation_id)
            assert rp == 18, f"Foundation bonus: int(12*1.5)=18, got {rp}"

    @pytest.mark.asyncio
    async def test_resets_cycle_ready_flags(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(status="competition", cycle=2)

        # Set some participants to ready
        for p in epoch.participants[:2]:
            admin_client.table("epoch_participants").update(
                {"cycle_ready": True}
            ).eq("id", str(p.participant_id)).execute()

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        participants = _get_participants(admin_client, epoch.epoch_id)
        for p in participants:
            assert p["cycle_ready"] is False, f"Participant {p['id']} should have cycle_ready=False"

    @pytest.mark.asyncio
    async def test_advances_mission_timers(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(
            status="competition", cycle=2, cycle_hours=8,
        )

        # Look up a real agent from Velgarien for the FK constraint
        agent_resp = admin_client.table("agents").select("id").eq(
            "simulation_id", str(SIM_VELGARIEN),
        ).limit(1).execute()
        agent_id = agent_resp.data[0]["id"]

        # Insert a test mission with known resolves_at
        resolves_at = datetime.now(UTC) + timedelta(hours=24)
        mission_id = uuid4()
        admin_client.table("operative_missions").insert({
            "id": str(mission_id),
            "epoch_id": str(epoch.epoch_id),
            "agent_id": agent_id,
            "operative_type": "spy",
            "source_simulation_id": str(SIM_VELGARIEN),
            "target_simulation_id": str(SIM_GASLIT_REACH),
            "status": "active",
            "cost_rp": 3,
            "deployed_at": datetime.now(UTC).isoformat(),
            "resolves_at": resolves_at.isoformat(),
        }).execute()

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        mission = (
            admin_client.table("operative_missions")
            .select("resolves_at")
            .eq("id", str(mission_id))
            .single()
            .execute()
        ).data
        new_resolves = datetime.fromisoformat(mission["resolves_at"])
        expected = resolves_at - timedelta(hours=8)
        # Allow 1 second tolerance for timing
        assert abs((new_resolves - expected).total_seconds()) < 2

    @pytest.mark.asyncio
    async def test_auto_phase_foundation_to_competition(self, admin_client, epoch_factory):
        """Epoch transitions from foundation to competition when new_cycle > foundation_cycles."""
        epoch: EpochFixture = epoch_factory(
            status="foundation",
            cycle=3,  # new_cycle will be 4, which is > foundation_cycles=3
            rp_per_cycle=10,
            rp_cap=40,
            cycle_hours=8,
            duration_days=14,
        )
        admin_client.table("game_epochs").update({
            "config": {**epoch.config, "foundation_cycles": 3},
        }).eq("id", str(epoch.epoch_id)).execute()

        await CycleResolutionService.resolve_cycle(admin_client, epoch.epoch_id)

        row = _get_epoch(admin_client, epoch.epoch_id)
        assert row["status"] == "competition", f"Expected 'competition', got '{row['status']}'"


# ── RP Spending ───────────────────────────────────────────────────────


class TestSpendRP:
    @pytest.mark.asyncio
    async def test_spend_success(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(rp=20)

        remaining = await CycleResolutionService.spend_rp(
            admin_client, epoch.epoch_id, SIM_VELGARIEN, 5,
        )

        assert remaining == 15
        db_rp = _get_participant_rp(admin_client, epoch.epoch_id, SIM_VELGARIEN)
        assert db_rp == 15

    @pytest.mark.asyncio
    async def test_spend_insufficient_rejected(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(rp=3)

        with pytest.raises(HTTPException) as exc:
            await CycleResolutionService.spend_rp(
                admin_client, epoch.epoch_id, SIM_VELGARIEN, 10,
            )
        assert exc.value.status_code == 400
        # RP should be unchanged
        db_rp = _get_participant_rp(admin_client, epoch.epoch_id, SIM_VELGARIEN)
        assert db_rp == 3

    @pytest.mark.asyncio
    async def test_spend_optimistic_lock(self, admin_client, epoch_factory):
        """Concurrent spend attempt should fail if balance changed."""
        epoch: EpochFixture = epoch_factory(rp=10)

        # First spend succeeds
        await CycleResolutionService.spend_rp(
            admin_client, epoch.epoch_id, SIM_VELGARIEN, 8,
        )

        # Second spend should fail (only 2 RP left)
        with pytest.raises(HTTPException) as exc:
            await CycleResolutionService.spend_rp(
                admin_client, epoch.epoch_id, SIM_VELGARIEN, 5,
            )
        assert exc.value.status_code == 400
