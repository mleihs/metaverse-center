"""Bureau Response Service — player tactical responses to events.

Players assign agents to contain/remediate/adapt to events.
Responses resolve at the next heartbeat tick (Phase 5).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from backend.utils.errors import bad_request, conflict, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

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
        cls,
        supabase: Client,
        sim_id: UUID,
        event_id: UUID,
        response_type: str,
        agent_ids: list[UUID],
        user_id: UUID,
    ) -> dict:
        """Create a bureau response to an event."""
        if response_type not in RESPONSE_CONFIG:
            raise bad_request(f"Invalid response_type '{response_type}'.")

        config = RESPONSE_CONFIG[response_type]

        # Validate agent count
        if response_type == "adapt":
            # Adapt requires 5+ reactions on the event, not agents
            reaction_count = len(
                (await supabase.table("event_reactions").select("id").eq("event_id", str(event_id)).execute()).data
                or []
            )
            if reaction_count < 5:
                raise bad_request(f"Adapt requires 5+ event reactions. Current: {reaction_count}.")
            agent_ids = []  # Adapt uses no agents
        else:
            if len(agent_ids) < config["min_agents"]:
                raise bad_request(f"{response_type} requires at least {config['min_agents']} agent(s).")
            if len(agent_ids) > config["max_agents"]:
                raise bad_request(f"{response_type} allows at most {config['max_agents']} agent(s).")

        # Check event exists and is not archived
        _resp = await (
            supabase.table("events")
            .select("id, event_status, simulation_id")
            .eq("id", str(event_id))
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        event = _resp.data
        if not event:
            raise not_found(detail="Event not found.")
        if event[0]["event_status"] in ("resolved", "archived"):
            raise bad_request("Cannot respond to a resolved/archived event.")

        # Check no pending response exists for this event
        _resp = await (
            supabase.table("bureau_responses")
            .select("id")
            .eq("simulation_id", str(sim_id))
            .eq("event_id", str(event_id))
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        existing = _resp.data
        if existing:
            raise conflict("A pending bureau response already exists for this event.")

        # Get current tick
        _resp = await (
            supabase.table("simulations").select("last_heartbeat_tick").eq("id", str(sim_id)).limit(1).execute()
        )
        sim = _resp.data
        current_tick = (sim[0].get("last_heartbeat_tick") or 0) if sim else 0

        response = await (
            supabase.table("bureau_responses")
            .insert(
                {
                    "simulation_id": str(sim_id),
                    "event_id": str(event_id),
                    "response_type": response_type,
                    "assigned_agent_ids": [str(a) for a in agent_ids],
                    "agent_count": len(agent_ids),
                    "status": "pending",
                    "submitted_before_tick": current_tick + 1,
                    "staffing_penalty_active": len(agent_ids) > 0,
                    "created_by_id": str(user_id),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create bureau response.")

        logger.info(
            "Bureau response created: %s for event %s (sim %s, %d agents)",
            response_type,
            event_id,
            sim_id,
            len(agent_ids),
            extra={
                "simulation_id": str(sim_id),
                "event_id": str(event_id),
                "response_type": response_type,
            },
        )

        return response.data[0]

    @classmethod
    async def cancel_response(
        cls,
        supabase: Client,
        sim_id: UUID,
        response_id: UUID,
    ) -> dict:
        """Cancel a pending bureau response."""
        response = await (
            supabase.table("bureau_responses")
            .update(
                {
                    "status": "expired",
                    "staffing_penalty_active": False,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", str(response_id))
            .eq("simulation_id", str(sim_id))
            .eq("status", "pending")
            .execute()
        )
        if not response.data:
            raise not_found(detail="Pending bureau response not found.")
        logger.info(
            "Bureau response cancelled: %s (sim %s)",
            response_id,
            sim_id,
            extra={"simulation_id": str(sim_id), "response_id": str(response_id)},
        )
        return response.data[0]

    @classmethod
    async def list_responses(
        cls,
        supabase: Client,
        sim_id: UUID,
        event_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
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
        response = await query.execute()
        return extract_list(response), response.count or 0

    # ── Tick Resolution (Phase 5) ───────────────────────────────

    @classmethod
    async def resolve_at_tick(
        cls,
        admin: Client,
        sim_id: UUID,
        tick_number: int,
        heartbeat_id: UUID,
        config: dict | None = None,
    ) -> tuple[int, list[dict]]:
        """Resolve pending bureau responses. Called from HeartbeatService Phase 5."""
        entries: list[dict] = []
        resolved_count = 0

        # Get pending responses due at this tick
        # INNER JOIN: a bureau response without its parent event is unresolvable
        # (title, impact_level needed) — LEFT JOIN would include orphans that crash resolution
        _resp = await (
            admin.table("bureau_responses")
            .select("*, events!inner(title, title_de, impact_level, event_status)")
            .eq("simulation_id", str(sim_id))
            .eq("status", "pending")
            .lte("submitted_before_tick", tick_number)
            .execute()
        )
        pending = extract_list(_resp)

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

            # Pressure reduction equals effectiveness (no double-multiply)
            pressure_reduction = effectiveness

            # Apply pressure reduction to event (contain + remediate)
            if resp_type in ("contain", "remediate"):
                # Read event's current pressure
                _resp = await (
                    admin.table("events")
                    .select("heartbeat_pressure, event_status")
                    .eq("id", resp["event_id"])
                    .limit(1)
                    .execute()
                )
                ev = _resp.data
                if ev:
                    current_pressure = float(ev[0].get("heartbeat_pressure", 0))
                    new_pressure = round(max(0, current_pressure - pressure_reduction), 4)
                    update_data: dict = {"heartbeat_pressure": new_pressure}

                    # Remediate can transition event to resolving
                    if resp_type == "remediate" and effectiveness > 0.5:
                        if ev[0].get("event_status") in ("active", "escalating"):
                            update_data["event_status"] = "resolving"
                            update_data["ticks_in_status"] = 0

                    await admin.table("events").update(update_data).eq("id", resp["event_id"]).execute()

            elif resp_type == "adapt":
                # Adapt reduces scar tissue on the parent narrative arc
                pressure_reduction = await cls._apply_adapt_scar_reduction(
                    admin,
                    sim_id,
                    resp["event_id"],
                    config,
                )

            # Update response record
            await (
                admin.table("bureau_responses")
                .update(
                    {
                        "status": "resolved",
                        "resolved_at_tick": tick_number,
                        "effectiveness": effectiveness,
                        "pressure_reduction": pressure_reduction,
                        "staffing_penalty_active": False,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                )
                .eq("id", resp_id)
                .execute()
            )

            resolved_count += 1

            entries.append(
                make_heartbeat_entry(
                    heartbeat_id,
                    sim_id,
                    tick_number,
                    "bureau_response",
                    (
                        f"Bureau Response resolved: {resp_type.title()} of '{event_title}' "
                        f"effectiveness {effectiveness:.2f}. Pressure reduced by {pressure_reduction:.2f}."
                    ),
                    (
                        f"Buero-Reaktion aufgeloest: {resp_type.title()} von '{event_title}' "
                        f"Effektivitaet {effectiveness:.2f}. Druck reduziert um {pressure_reduction:.2f}."
                    ),
                    severity="positive" if effectiveness > 0.5 else "info",
                    metadata={
                        "response_id": resp_id,
                        "response_type": resp_type,
                        "event_id": resp["event_id"],
                        "effectiveness": effectiveness,
                        "pressure_reduction": pressure_reduction,
                    },
                )
            )

            logger.info(
                "Bureau response resolved: %s for event %s (effectiveness %.2f)",
                resp_type,
                resp["event_id"],
                effectiveness,
                extra={
                    "simulation_id": str(sim_id),
                    "response_id": resp_id,
                    "effectiveness": effectiveness,
                },
            )

        return resolved_count, entries

    # ── Adapt Scar Reduction ─────────────────────────────────────

    @classmethod
    async def _apply_adapt_scar_reduction(
        cls,
        admin: Client,
        sim_id: UUID,
        event_id: str,
        config: dict | None,
    ) -> float:
        """Reduce scar tissue on the narrative arc containing this event.

        Returns the amount of scar tissue reduced (for pressure_reduction tracking).
        """
        adapt_scar_reduction = float(
            (config or {}).get("bureau_adapt_scar_reduction", 0.20),
        )
        arcs = (
            await admin.table("narrative_arcs")
            .select("id, scar_tissue_deposited, source_event_ids")
            .eq("simulation_id", str(sim_id))
            .in_("status", ["active", "climax", "resolving"])
            .execute()
        ).data or []

        for arc in arcs:
            source_ids = arc.get("source_event_ids") or []
            if event_id in source_ids:
                current_scar = float(arc.get("scar_tissue_deposited", 0))
                new_scar = round(max(0, current_scar * (1 - adapt_scar_reduction)), 4)
                await (
                    admin.table("narrative_arcs")
                    .update(
                        {
                            "scar_tissue_deposited": new_scar,
                        }
                    )
                    .eq("id", arc["id"])
                    .execute()
                )
                reduction = round(current_scar - new_scar, 4)
                logger.info(
                    "Adapt response reduced scar tissue on arc %s: %.4f -> %.4f",
                    arc["id"],
                    current_scar,
                    new_scar,
                    extra={
                        "simulation_id": str(sim_id),
                        "arc_id": arc["id"],
                        "scar_reduction": reduction,
                    },
                )
                return reduction

        return 0.0
