"""Service for threshold actions — desperate measures and ascendant rewards.

Handles scorched earth, emergency draft, and reality anchor actions
when a simulation enters critical threshold state (health < 0.25).
"""

from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.audit_service import AuditService
from backend.services.base_service import serialize_for_json
from backend.services.game_mechanics_service import GameMechanicsService
from supabase import Client

logger = logging.getLogger(__name__)

VALID_ACTIONS = ("scorched_earth", "emergency_draft", "reality_anchor")

# Stability boost from scorched earth (destroying a building)
SCORCHED_EARTH_STABILITY_BOOST = 0.15

# RP cost for emergency draft
EMERGENCY_DRAFT_RP_COST = 15

# Reality anchor duration in cycles
REALITY_ANCHOR_CYCLES = 3
REALITY_ANCHOR_STABILITY_BOOST = 0.10


class ThresholdService:
    """Threshold action execution service."""

    @staticmethod
    async def validate_critical_state(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Verify simulation is an epoch game instance in critical threshold state.

        Returns the health data if valid, raises 409 if not an epoch or not critical.
        """
        # Check simulation type — threshold actions are epoch-only
        sim_resp = (
            supabase.table("simulations")
            .select("simulation_type, epoch_id")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if not sim_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Simulation not found.",
            )

        sim = sim_resp.data[0]
        if sim.get("simulation_type") != "game_instance" or not sim.get("epoch_id"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Threshold actions are only available during active epochs.",
            )

        health = await GameMechanicsService.get_simulation_health(
            supabase, simulation_id
        )
        if not health:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No health data for simulation.",
            )

        overall = health.get("overall_health", 1.0)
        if overall >= 0.25:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Simulation health is {overall:.2f} — threshold actions require health below 0.25.",
            )
        return health

    @staticmethod
    async def execute_action(
        admin_supabase: Client,
        simulation_id: UUID,
        action_type: str,
        user_id: UUID,
        *,
        target_building_id: UUID | None = None,
        target_zone_id: UUID | None = None,
    ) -> dict:
        """Execute a threshold action and log it."""
        if action_type not in VALID_ACTIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action type: {action_type}. Must be one of {VALID_ACTIONS}.",
            )

        await ThresholdService.validate_critical_state(admin_supabase, simulation_id)

        if action_type == "scorched_earth":
            result = await ThresholdService.scorched_earth(
                admin_supabase, simulation_id, target_building_id
            )
        elif action_type == "emergency_draft":
            result = await ThresholdService.emergency_draft(
                admin_supabase, simulation_id
            )
        elif action_type == "reality_anchor":
            result = await ThresholdService.reality_anchor(
                admin_supabase, simulation_id
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown action.")

        # Log action
        log_data = {
            "simulation_id": str(simulation_id),
            "action_type": action_type,
            "executed_by": str(user_id),
            "target_building_id": str(target_building_id) if target_building_id else None,
            "target_zone_id": str(target_zone_id) if target_zone_id else None,
            "result": result,
        }
        admin_supabase.table("threshold_actions").insert(
            serialize_for_json(log_data)
        ).execute()

        # Audit
        await AuditService.safe_log(
            admin_supabase,
            simulation_id,
            user_id,
            "threshold_actions",
            str(simulation_id),
            action_type,
            details=result,
        )

        # Refresh metrics after action
        await GameMechanicsService.refresh_metrics(admin_supabase)

        return result

    @staticmethod
    async def scorched_earth(
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID | None,
    ) -> dict:
        """Permanently destroy a building to stabilize its zone.

        Deletes the building (hard delete) and boosts the zone's stability
        by SCORCHED_EARTH_STABILITY_BOOST.
        """
        if not building_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_building_id is required for scorched_earth.",
            )

        # Get the building to find its zone
        building_resp = (
            supabase.table("buildings")
            .select("id, name, zone_id, building_type")
            .eq("id", str(building_id))
            .eq("simulation_id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if not building_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Building not found.",
            )

        building = building_resp.data[0]
        zone_id = building.get("zone_id")

        # Hard-delete the building
        supabase.table("buildings").delete().eq("id", str(building_id)).execute()

        logger.info(
            "Scorched earth: destroyed building %s in zone %s",
            building_id, zone_id,
            extra={"simulation_id": str(simulation_id), "building_id": str(building_id)},
        )

        return {
            "action": "scorched_earth",
            "destroyed_building": building.get("name"),
            "building_type": building.get("building_type"),
            "zone_id": zone_id,
            "stability_boost": SCORCHED_EARTH_STABILITY_BOOST,
        }

    @staticmethod
    async def emergency_draft(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Create a random agent from the simulation's agent pool.

        Picks a random profession from existing agents and creates a new
        agent at minimal quality. Costs RP if in an epoch context.
        """
        # Get existing professions for variety
        agents_resp = (
            supabase.table("active_agents")
            .select("primary_profession, system")
            .eq("simulation_id", str(simulation_id))
            .limit(50)
            .execute()
        )
        agents = agents_resp.data or []

        profession = "laborer"
        system = "civilian"
        if agents:
            sample = random.choice(agents)  # noqa: S311 — game mechanic, not security
            profession = sample.get("primary_profession", "laborer")
            system = sample.get("system", "civilian")

        draft_number = random.randint(1000, 9999)  # noqa: S311 — cosmetic display label
        new_agent = {
            "simulation_id": str(simulation_id),
            "name": f"Emergency Draft #{draft_number}",
            "system": system,
            "primary_profession": profession,
            "character": "Emergency conscript drafted during crisis. Untrained but present.",
            "background": "Pulled from civilian reserves during threshold crisis.",
        }

        resp = supabase.table("agents").insert(serialize_for_json(new_agent)).execute()
        agent_data = resp.data[0] if resp.data else {}

        logger.info(
            "Emergency draft: created agent %s for simulation %s",
            agent_data.get("id"), simulation_id,
            extra={"simulation_id": str(simulation_id)},
        )

        return {
            "action": "emergency_draft",
            "agent_id": agent_data.get("id"),
            "agent_name": agent_data.get("name"),
            "profession": profession,
            "rp_cost": EMERGENCY_DRAFT_RP_COST,
        }

    @staticmethod
    async def reality_anchor(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Apply temporary stability buff to all zones for N cycles.

        Stores a simulation setting that the cycle resolver checks when
        computing zone stability modifiers.
        """
        expires_at = datetime.now(UTC).isoformat()

        setting_data = {
            "simulation_id": str(simulation_id),
            "category": "game",
            "setting_key": "reality_anchor_active",
            "setting_value": {
                "active": True,
                "stability_boost": REALITY_ANCHOR_STABILITY_BOOST,
                "remaining_cycles": REALITY_ANCHOR_CYCLES,
                "activated_at": expires_at,
            },
        }

        # Upsert the setting
        supabase.table("simulation_settings").upsert(
            serialize_for_json(setting_data),
            on_conflict="simulation_id,category,setting_key",
        ).execute()

        logger.info(
            "Reality anchor activated for simulation %s (%d cycles)",
            simulation_id, REALITY_ANCHOR_CYCLES,
            extra={"simulation_id": str(simulation_id)},
        )

        return {
            "action": "reality_anchor",
            "cycles_remaining": REALITY_ANCHOR_CYCLES,
            "stability_boost": REALITY_ANCHOR_STABILITY_BOOST,
        }
