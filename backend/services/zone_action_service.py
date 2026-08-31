"""Service layer for zone actions (fortification system)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
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

        # One atomic claim instead of check-check-insert (ADR-007, migration 301).
        # The two SELECTs and the INSERT used to be three round trips: two
        # concurrent requests for the same zone both read "no active action" and
        # both inserted. fn_create_zone_action takes a per-zone advisory lock,
        # re-reads both conditions and inserts inside one transaction, so the
        # second request now waits, sees the first row and is refused.
        #
        # The game numbers stay here in ACTION_CONFIG and travel as parameters:
        # SQL owns the integrity, Python owns the rule.
        rpc_resp = await supabase.rpc(
            "fn_create_zone_action",
            {
                "p_simulation_id": str(simulation_id),
                "p_zone_id": str(zone_id),
                "p_action_type": action_type,
                "p_user_id": str(user_id),
                "p_effect_value": config["effect_value"],
                "p_duration_days": config["duration_days"],
                "p_cooldown_days": config["cooldown_days"],
            },
        ).execute()

        result = rpc_resp.data
        if not isinstance(result, dict):
            raise server_error("Failed to create zone action.")

        status = result.get("status")
        if status == "active_exists":
            raise conflict("Zone already has an active action. Cancel it first.")
        if status == "cooldown":
            raw_until = result.get("cooldown_until")
            remaining_days = 0
            if isinstance(raw_until, str):
                cooldown_until = datetime.fromisoformat(raw_until.replace("Z", "+00:00"))
                remaining_days = max(0, (cooldown_until - datetime.now(UTC)).days)
            raise too_many_requests(f"Action on cooldown. {remaining_days} days remaining.")
        if status != "created" or not isinstance(result.get("action"), dict):
            raise server_error("Failed to create zone action.")

        created = result["action"]

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
        return created

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
