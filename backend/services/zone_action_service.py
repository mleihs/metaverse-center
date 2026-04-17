"""Service layer for zone actions (fortification system)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from backend.services.game_mechanics_service import GameMechanicsService
from backend.utils.errors import bad_request, conflict, not_found, server_error, too_many_requests
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Action configuration — game rules, not user preferences
ACTION_CONFIG: dict[str, dict] = {
    "fortify": {
        "effect_value": 0.3,
        "duration_days": 7,
        "cooldown_days": 14,
        "description": "Deploy resources to stabilize zone",
    },
    "quarantine": {
        "effect_value": -0.1,  # Negative = adds internal pressure
        "duration_days": 14,
        "cooldown_days": 21,
        "description": "Isolate zone to prevent cascade spreading",
    },
    "deploy_resources": {
        "effect_value": 0.5,
        "duration_days": 3,
        "cooldown_days": 30,
        "description": "Emergency intervention, strong but short",
    },
}


class ZoneActionService:
    """CRUD for zone fortification actions."""

    @staticmethod
    async def create_action(
        supabase: Client,
        simulation_id: UUID,
        zone_id: UUID,
        action_type: str,
        user_id: UUID,
    ) -> dict:
        """Create a zone action after validating cooldown and active constraints."""
        if action_type not in ACTION_CONFIG:
            raise bad_request(f"Invalid action_type '{action_type}'.")

        config = ACTION_CONFIG[action_type]
        now = datetime.now(UTC)

        # Check for active action on this zone
        active_check = await (
            supabase.table("zone_actions")
            .select("id, action_type, expires_at")
            .eq("zone_id", str(zone_id))
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .gt("expires_at", now.isoformat())
            .limit(1)
            .execute()
        )
        if active_check.data:
            raise conflict("Zone already has an active action. Cancel it first.")

        # Check cooldown — find most recent expired action of this type
        cooldown_check = await (
            supabase.table("zone_actions")
            .select("cooldown_until")
            .eq("zone_id", str(zone_id))
            .eq("simulation_id", str(simulation_id))
            .eq("action_type", action_type)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if cooldown_check.data:
            cooldown_until = datetime.fromisoformat(cooldown_check.data[0]["cooldown_until"].replace("Z", "+00:00"))
            if cooldown_until > now:
                remaining = cooldown_until - now
                raise too_many_requests(f"Action on cooldown. {remaining.days} days remaining.")

        expires_at = now + timedelta(days=config["duration_days"])
        cooldown_until = expires_at + timedelta(days=config["cooldown_days"])

        response = await (
            supabase.table("zone_actions")
            .insert(
                {
                    "zone_id": str(zone_id),
                    "simulation_id": str(simulation_id),
                    "action_type": action_type,
                    "effect_value": config["effect_value"],
                    "created_by_id": str(user_id),
                    "expires_at": expires_at.isoformat(),
                    "cooldown_until": cooldown_until.isoformat(),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create zone action.")

        logger.info(
            "Zone action created",
            extra={
                "simulation_id": str(simulation_id),
                "zone_id": str(zone_id),
                "action_type": action_type,
                "user_id": str(user_id),
            },
        )

        await GameMechanicsService.refresh_metrics(supabase)
        return response.data[0]

    @staticmethod
    async def cancel_action(
        supabase: Client,
        simulation_id: UUID,
        zone_id: UUID,
        action_id: UUID,
    ) -> dict:
        """Cancel an active zone action by setting deleted_at."""
        response = await (
            supabase.table("zone_actions")
            .update({"deleted_at": datetime.now(UTC).isoformat()})
            .eq("id", str(action_id))
            .eq("zone_id", str(zone_id))
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )

        if not response.data:
            raise not_found(detail="Zone action not found or already cancelled.")

        logger.info(
            "Zone action cancelled",
            extra={
                "simulation_id": str(simulation_id),
                "zone_id": str(zone_id),
                "action_id": str(action_id),
            },
        )

        await GameMechanicsService.refresh_metrics(supabase)
        return response.data[0]

    @staticmethod
    async def list_actions(
        supabase: Client,
        simulation_id: UUID,
        zone_id: UUID,
    ) -> list[dict]:
        """List active + recently expired actions for a zone."""
        response = await (
            supabase.table("zone_actions")
            .select("*")
            .eq("zone_id", str(zone_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        return extract_list(response)
