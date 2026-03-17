"""Bureau Response Service — player tactical responses to events.

Players assign agents to contain/remediate/adapt to events.
Responses resolve at the next heartbeat tick (Phase 5).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)

# Response type configuration
RESPONSE_CONFIG = {
    "contain": {
        "min_agents": 1,
        "max_agents": 1,
        "duration_ticks": 1,
        "multiplier": 0.30,
        "description_en": "Bureau dispatches containment team",
        "description_de": "Buero entsendet Eindaemmungsteam",
    },
    "remediate": {
        "min_agents": 2,
        "max_agents": 3,
        "duration_ticks": 2,
        "multiplier": 0.60,
        "description_en": "Full remediation protocol activated",
        "description_de": "Vollstaendiges Sanierungsprotokoll aktiviert",
    },
    "adapt": {
        "min_agents": 0,
        "max_agents": 0,
        "duration_ticks": 1,
        "multiplier": 0.50,
        "description_en": "Bureau learns from crisis, adapts protocols",
        "description_de": "Buero lernt aus der Krise, passt Protokolle an",
    },
}


class BureauResponseService:
    """CRUD + tick-resolution for bureau responses."""

    # ── CRUD ────────────────────────────────────────────────────

    @classmethod
    async def create_response(
        cls, supabase: Client, sim_id: UUID, event_id: UUID,
        response_type: str, agent_ids: list[UUID], user_id: UUID,
    ) -> dict:
        """Create a bureau response to an event."""
        if response_type not in RESPONSE_CONFIG:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid response_type '{response_type}'.",
            )

        config = RESPONSE_CONFIG[response_type]

        # Validate agent count
        if response_type == "adapt":
            # Adapt requires 5+ reactions on the event, not agents
            reaction_count = len((
                supabase.table("event_reactions")
                .select("id")
                .eq("event_id", str(event_id))
                .execute()
            ).data or [])
            if reaction_count < 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Adapt requires 5+ event reactions. Current: {reaction_count}.",
                )
            agent_ids = []  # Adapt uses no agents
        else:
            if len(agent_ids) < config["min_agents"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{response_type} requires at least {config['min_agents']} agent(s).",
                )
            if len(agent_ids) > config["max_agents"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{response_type} allows at most {config['max_agents']} agent(s).",
                )

        # Check event exists and is not archived
        event = (
            supabase.table("events")
            .select("id, event_status, simulation_id")
            .eq("id", str(event_id))
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not event:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
        if event[0]["event_status"] in ("resolved", "archived"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot respond to a resolved/archived event.",
            )

        # Check no pending response exists for this event
        existing = (
            supabase.table("bureau_responses")
            .select("id")
            .eq("simulation_id", str(sim_id))
            .eq("event_id", str(event_id))
            .eq("status", "pending")
            .limit(1)
            .execute()
        ).data
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pending bureau response already exists for this event.",
            )

        # Get current tick
        sim = (
            supabase.table("simulations")
            .select("last_heartbeat_tick")
            .eq("id", str(sim_id))
            .limit(1)
            .execute()
        ).data
        current_tick = (sim[0].get("last_heartbeat_tick") or 0) if sim else 0

        response = (
            supabase.table("bureau_responses")
            .insert({
                "simulation_id": str(sim_id),
                "event_id": str(event_id),
                "response_type": response_type,
                "assigned_agent_ids": [str(a) for a in agent_ids],
                "agent_count": len(agent_ids),
                "status": "pending",
                "submitted_before_tick": current_tick + 1,
                "staffing_penalty_active": len(agent_ids) > 0,
                "created_by_id": str(user_id),
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create bureau response.",
            )

        logger.info(
            "Bureau response created: %s for event %s (sim %s, %d agents)",
            response_type, event_id, sim_id, len(agent_ids),
            extra={
                "simulation_id": str(sim_id),
                "event_id": str(event_id),
                "response_type": response_type,
            },
        )

        return response.data[0]

    @classmethod
    async def cancel_response(
        cls, supabase: Client, sim_id: UUID, response_id: UUID,
    ) -> dict:
        """Cancel a pending bureau response."""
        response = (
            supabase.table("bureau_responses")
            .update({
                "status": "expired",
                "staffing_penalty_active": False,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .eq("id", str(response_id))
            .eq("simulation_id", str(sim_id))
            .eq("status", "pending")
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending bureau response not found.",
            )
        return response.data[0]

    @classmethod
    async def list_responses(
        cls, supabase: Client, sim_id: UUID,
        event_id: UUID | None = None,
        limit: int = 50, offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List bureau responses for a simulation, optionally filtered by event."""
        query = (
            supabase.table("bureau_responses")
            .select("*", count="exact")
            .eq("simulation_id", str(sim_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if event_id:
            query = query.eq("event_id", str(event_id))
        response = query.execute()
        return response.data or [], response.count or 0

    # ── Tick Resolution (Phase 5) ───────────────────────────────

    @classmethod
    async def resolve_at_tick(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict | None = None,
    ) -> tuple[int, list[dict]]:
        """Resolve pending bureau responses. Called from HeartbeatService Phase 5."""
        entries: list[dict] = []
        resolved_count = 0

        # Get pending responses due at this tick
        pending = (
            admin.table("bureau_responses")
            .select("*, events!inner(title, title_de, impact_level, event_status)")
            .eq("simulation_id", str(sim_id))
            .eq("status", "pending")
            .lte("submitted_before_tick", tick_number)
            .execute()
        ).data or []

        if not pending:
            return resolved_count, entries

        for resp in pending:
            resp_id = resp["id"]
            resp_type = resp["response_type"]
            agent_ids = resp.get("assigned_agent_ids") or []
            event_data = resp.get("events", {})
            event_title = event_data.get("title", "Unknown")
            impact_level = float(event_data.get("impact_level", 5))
            resp_config = RESPONSE_CONFIG.get(resp_type, RESPONSE_CONFIG["contain"])

            # Override multipliers from platform config if available
            if config:
                multiplier_key = f"bureau_{resp_type}_multiplier"
                if multiplier_key in config:
                    resp_config = {**resp_config, "multiplier": config[multiplier_key]}

            # Compute effectiveness
            multiplier = resp_config["multiplier"]
            if resp_type == "adapt":
                effectiveness = multiplier
            else:
                agent_count = len(agent_ids)
                qualification_match = min(1.0, agent_count / max(1, impact_level / 3))
                effectiveness = round(qualification_match * multiplier, 4)

            # Compute pressure reduction
            pressure_reduction = round(effectiveness * multiplier, 4)

            # Apply pressure reduction to event
            if resp_type != "adapt":
                current_pressure = (
                    float(event_data.get("heartbeat_pressure", 0))
                    if "heartbeat_pressure" in event_data
                    else 0
                )
                # Read event's current pressure
                ev = (
                    admin.table("events")
                    .select("heartbeat_pressure, event_status")
                    .eq("id", resp["event_id"])
                    .limit(1)
                    .execute()
                ).data
                if ev:
                    current_pressure = float(ev[0].get("heartbeat_pressure", 0))
                    new_pressure = round(max(0, current_pressure - pressure_reduction), 4)
                    update_data: dict = {"heartbeat_pressure": new_pressure}

                    # Remediate can transition event to resolving
                    if resp_type == "remediate" and effectiveness > 0.5:
                        if ev[0].get("event_status") in ("active", "escalating"):
                            update_data["event_status"] = "resolving"
                            update_data["ticks_in_status"] = 0

                    admin.table("events").update(update_data).eq("id", resp["event_id"]).execute()

            # Update response record
            admin.table("bureau_responses").update({
                "status": "resolved",
                "resolved_at_tick": tick_number,
                "effectiveness": effectiveness,
                "pressure_reduction": pressure_reduction,
                "staffing_penalty_active": False,
                "updated_at": datetime.now(UTC).isoformat(),
            }).eq("id", resp_id).execute()

            resolved_count += 1

            entries.append({
                "id": str(uuid4()),
                "heartbeat_id": str(heartbeat_id),
                "simulation_id": str(sim_id),
                "tick_number": tick_number,
                "entry_type": "bureau_response",
                "narrative_en": (
                    f"Bureau Response resolved: {resp_type.title()} of '{event_title}' "
                    f"effectiveness {effectiveness:.2f}. Pressure reduced by {pressure_reduction:.2f}."
                ),
                "narrative_de": (
                    f"Buero-Reaktion aufgeloest: {resp_type.title()} von '{event_title}' "
                    f"Effektivitaet {effectiveness:.2f}. Druck reduziert um {pressure_reduction:.2f}."
                ),
                "metadata": {
                    "response_id": resp_id, "response_type": resp_type,
                    "event_id": resp["event_id"], "effectiveness": effectiveness,
                    "pressure_reduction": pressure_reduction,
                },
                "severity": "positive" if effectiveness > 0.5 else "info",
            })

            logger.info(
                "Bureau response resolved: %s for event %s (effectiveness %.2f)",
                resp_type, resp["event_id"], effectiveness,
                extra={
                    "simulation_id": str(sim_id),
                    "response_id": resp_id,
                    "effectiveness": effectiveness,
                },
            )

        return resolved_count, entries
