"""Integration tests for bot fog-of-war enforcement.

Verifies that BotGameState correctly hides spy operations from bots that
should not see them. The fog-of-war contract requires that active (undetected)
enemy missions are invisible to the target, while detected missions and own
missions remain visible to their respective viewers.

Requires a live Supabase instance.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from backend.services.bot_game_state import BotGameState
from backend.tests.integration.conftest import EpochFixture, requires_supabase
from backend.tests.integration.game_constants import (
    SIM_GASLIT_REACH,
    SIM_VELGARIEN,
)

pytestmark = [requires_supabase, pytest.mark.gamedb]


def _fetch_real_agent_id(admin_client, simulation_id) -> str:
    """Look up a real agent ID from the given simulation (FK constraint).

    Requires seed data to include at least one agent for the simulation.
    """
    resp = (
        admin_client.table("agents")
        .select("id")
        .eq("simulation_id", str(simulation_id))
        .limit(1)
        .execute()
    )
    assert resp.data, (
        f"No agents found for simulation {simulation_id}. "
        "Seed data must include agents for template simulations."
    )
    return resp.data[0]["id"]


def _insert_spy_mission(admin_client, *, epoch_id, source_sim_id, target_sim_id, agent_id, status="active"):
    """Insert an operative spy mission and return its ID."""
    mission_id = uuid4()
    admin_client.table("operative_missions").insert({
        "id": str(mission_id),
        "epoch_id": str(epoch_id),
        "source_simulation_id": str(source_sim_id),
        "target_simulation_id": str(target_sim_id),
        "agent_id": agent_id,
        "operative_type": "spy",
        "status": status,
        "cost_rp": 5,
        "deployed_at": datetime.now(UTC).isoformat(),
        "resolves_at": (datetime.now(UTC) + timedelta(hours=24)).isoformat(),
    }).execute()
    return mission_id


def _get_participant_row(admin_client, epoch_id, simulation_id) -> dict:
    """Fetch a participant row from the DB with all fields BotGameState needs."""
    return (
        admin_client.table("epoch_participants")
        .select("*")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    ).data


class TestBotFogOfWar:
    """Fog-of-war enforcement: BotGameState must only reveal legitimately visible data."""

    @pytest.mark.asyncio
    async def test_spy_invisible_to_target_bot(self, admin_client, async_admin_client, epoch_factory):
        """An active (undetected) spy mission must NOT appear in the target bot's state."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)
        agent_id = _fetch_real_agent_id(admin_client, SIM_VELGARIEN)

        # Player A (Velgarien) deploys a spy against Player B (Gaslit Reach)
        _insert_spy_mission(
            admin_client,
            epoch_id=epoch.epoch_id,
            source_sim_id=SIM_VELGARIEN,
            target_sim_id=SIM_GASLIT_REACH,
            agent_id=agent_id,
            status="active",
        )

        # Build game state for the TARGET (Gaslit Reach) — should NOT see the spy
        target_row = _get_participant_row(admin_client, epoch.epoch_id, SIM_GASLIT_REACH)
        bot_state = await BotGameState.build(
            async_admin_client,
            str(epoch.epoch_id),
            target_row,
            epoch.current_cycle,
            epoch.config,
        )

        # Active spy must be invisible: not in detected_enemy_ops, not in own_missions
        assert bot_state.detected_enemy_ops == [], (
            "Active (undetected) spy should not appear in target's detected_enemy_ops"
        )
        target_own_source_ids = {m["source_simulation_id"] for m in bot_state.own_missions}
        assert str(SIM_VELGARIEN) not in target_own_source_ids, (
            "Enemy spy should never appear in target's own_missions"
        )

    @pytest.mark.asyncio
    async def test_detected_spy_visible_to_target_bot(self, admin_client, async_admin_client, epoch_factory):
        """A detected spy mission MUST appear in the target bot's detected_enemy_ops."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)
        agent_id = _fetch_real_agent_id(admin_client, SIM_VELGARIEN)

        # Deploy a spy that has been detected
        mission_id = _insert_spy_mission(
            admin_client,
            epoch_id=epoch.epoch_id,
            source_sim_id=SIM_VELGARIEN,
            target_sim_id=SIM_GASLIT_REACH,
            agent_id=agent_id,
            status="detected",
        )

        # Build game state for the TARGET (Gaslit Reach) — SHOULD see the detected spy
        target_row = _get_participant_row(admin_client, epoch.epoch_id, SIM_GASLIT_REACH)
        bot_state = await BotGameState.build(
            async_admin_client,
            str(epoch.epoch_id),
            target_row,
            epoch.current_cycle,
            epoch.config,
        )

        detected_ids = {m["id"] for m in bot_state.detected_enemy_ops}
        assert str(mission_id) in detected_ids, (
            "Detected spy must appear in target's detected_enemy_ops"
        )

    @pytest.mark.asyncio
    async def test_own_spy_visible_to_deployer(self, admin_client, async_admin_client, epoch_factory):
        """The deployer's own spy mission MUST appear in their own_missions."""
        epoch: EpochFixture = epoch_factory(status="competition", cycle=3, rp=20)
        agent_id = _fetch_real_agent_id(admin_client, SIM_VELGARIEN)

        # Player A (Velgarien) deploys a spy against Player B (Gaslit Reach)
        mission_id = _insert_spy_mission(
            admin_client,
            epoch_id=epoch.epoch_id,
            source_sim_id=SIM_VELGARIEN,
            target_sim_id=SIM_GASLIT_REACH,
            agent_id=agent_id,
            status="active",
        )

        # Build game state for the DEPLOYER (Velgarien) — SHOULD see own mission
        deployer_row = _get_participant_row(admin_client, epoch.epoch_id, SIM_VELGARIEN)
        bot_state = await BotGameState.build(
            async_admin_client,
            str(epoch.epoch_id),
            deployer_row,
            epoch.current_cycle,
            epoch.config,
        )

        own_mission_ids = {m["id"] for m in bot_state.own_missions}
        assert str(mission_id) in own_mission_ids, (
            "Deployer must see their own spy mission in own_missions"
        )
