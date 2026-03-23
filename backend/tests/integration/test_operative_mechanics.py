"""Integration tests for operative mechanics against real Supabase.

Tests deploy, counter-intel sweep, fortification, and mission resolution.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.operative_mission_service import OperativeMissionService
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from backend.tests.integration.game_constants import (
    SIM_GASLIT_REACH,
    SIM_VELGARIEN,
    ZONE_ALTSTADT,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _get_participant_rp(client, epoch_id, simulation_id):
    """Read a single participant's current_rp."""
    return (
        client.table("epoch_participants")
        .select("current_rp")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    ).data["current_rp"]


# ── Counter-Intel Sweep ───────────────────────────────────────────────


class TestCounterIntelSweep:
    @pytest.mark.asyncio
    async def test_detects_active_enemy_missions(self, admin_client, epoch_factory):
        """Sweep reveals active enemy missions targeting your simulation."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)

        # Look up a real agent from Gaslit Reach
        agent_resp = admin_client.table("agents").select("id").eq(
            "simulation_id", str(SIM_GASLIT_REACH),
        ).limit(1).execute()
        agent_id = agent_resp.data[0]["id"]

        # Insert an enemy mission targeting Velgarien
        mission_id = uuid4()
        admin_client.table("operative_missions").insert({
            "id": str(mission_id),
            "epoch_id": str(epoch.epoch_id),
            "agent_id": agent_id,
            "operative_type": "spy",
            "source_simulation_id": str(SIM_GASLIT_REACH),
            "target_simulation_id": str(SIM_VELGARIEN),
            "status": "active",
            "cost_rp": 3,
            "deployed_at": datetime.now(UTC).isoformat(),
            "resolves_at": (datetime.now(UTC) + timedelta(hours=24)).isoformat(),
        }).execute()

        detected = await OperativeMissionService.counter_intel_sweep(
            admin_client, epoch.epoch_id, SIM_VELGARIEN,
        )

        assert len(detected) == 1
        assert detected[0]["id"] == str(mission_id)

        # Mission status should now be 'detected'
        mission = (
            admin_client.table("operative_missions")
            .select("status")
            .eq("id", str(mission_id))
            .single()
            .execute()
        ).data
        assert mission["status"] == "detected"

        # RP should be spent (20 - 4 = 16)
        rp = _get_participant_rp(admin_client, epoch.epoch_id, SIM_VELGARIEN)
        assert rp == 16

    @pytest.mark.asyncio
    async def test_sweep_insufficient_rp_rejected(self, admin_client, epoch_factory):
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=2)

        with pytest.raises(HTTPException) as exc:
            await OperativeMissionService.counter_intel_sweep(
                admin_client, epoch.epoch_id, SIM_VELGARIEN,
            )
        assert exc.value.status_code == 400
        # RP unchanged
        rp = _get_participant_rp(admin_client, epoch.epoch_id, SIM_VELGARIEN)
        assert rp == 2


# ── Zone Fortification ────────────────────────────────────────────────


class TestFortifyZone:
    @pytest.mark.asyncio
    async def test_fortify_upgrades_security(self, admin_client, epoch_factory):
        """Fortifying a zone upgrades its security tier and creates a record."""
        epoch: EpochFixture = epoch_factory(status="foundation", cycle=1, rp=20)

        # Snapshot zone security before fortification (for cleanup)
        zone_before = (
            admin_client.table("zones")
            .select("security_level")
            .eq("id", str(ZONE_ALTSTADT))
            .single()
            .execute()
        ).data

        try:
            result = await OperativeMissionService.fortify_zone(
                admin_client, epoch.epoch_id, SIM_VELGARIEN, ZONE_ALTSTADT,
            )

            assert result is not None

            # RP should be spent (cost is 2)
            rp = _get_participant_rp(admin_client, epoch.epoch_id, SIM_VELGARIEN)
            assert rp == 18

            # Fortification record should exist
            fort = (
                admin_client.table("zone_fortifications")
                .select("*")
                .eq("epoch_id", str(epoch.epoch_id))
                .eq("zone_id", str(ZONE_ALTSTADT))
                .execute()
            ).data
            assert len(fort) == 1
        finally:
            # Restore zone security to pre-test state (fortify mutates seed data)
            admin_client.table("zones").update(
                {"security_level": zone_before["security_level"]}
            ).eq("id", str(ZONE_ALTSTADT)).execute()

    @pytest.mark.asyncio
    async def test_fortify_wrong_phase_rejected(self, admin_client, epoch_factory):
        """Fortification only works during foundation phase."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)

        with pytest.raises(HTTPException) as exc:
            await OperativeMissionService.fortify_zone(
                admin_client, epoch.epoch_id, SIM_VELGARIEN, ZONE_ALTSTADT,
            )
        assert exc.value.status_code == 400


# ── Mission Resolution ────────────────────────────────────────────────


class TestMissionResolution:
    @pytest.mark.asyncio
    async def test_resolve_pending_processes_expired_missions(self, admin_client, epoch_factory):
        """Missions past their resolves_at time get resolved."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)

        agent_resp = admin_client.table("agents").select("id").eq(
            "simulation_id", str(SIM_VELGARIEN),
        ).limit(1).execute()
        agent_id = agent_resp.data[0]["id"]

        # Insert a mission that should have resolved already
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
            "success_probability": 0.75,
            "deployed_at": (datetime.now(UTC) - timedelta(hours=48)).isoformat(),
            "resolves_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat(),
        }).execute()

        resolved = await OperativeMissionService.resolve_pending_missions(
            admin_client, epoch.epoch_id,
        )

        assert len(resolved) >= 1

        # Mission should no longer be 'active'
        mission = (
            admin_client.table("operative_missions")
            .select("status")
            .eq("id", str(mission_id))
            .single()
            .execute()
        ).data
        assert mission["status"] in ("success", "failed")
