"""Service layer for event echo (bleed) operations.

Cross-simulation, uses admin client for writes — does NOT extend BaseService.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.base_service import serialize_for_json
from supabase import Client

logger = logging.getLogger(__name__)


class EchoService:
    """Event echo operations — cross-simulation bleed mechanics."""

    table_name = "event_echoes"

    @classmethod
    async def list_for_simulation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        direction: str = "incoming",
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List echoes for a simulation (incoming or outgoing)."""
        sim_str = str(simulation_id)
        col = "target_simulation_id" if direction == "incoming" else "source_simulation_id"

        query = (
            supabase.table(cls.table_name)
            .select("*", count="exact")
            .eq(col, sim_str)
            .order("created_at", desc=True)
        )

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def list_for_event(
        cls,
        supabase: Client,
        event_id: UUID,
    ) -> list[dict]:
        """List all echoes originating from a specific event."""
        response = (
            supabase.table(cls.table_name)
            .select("*")
            .eq("source_event_id", str(event_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def get(
        cls,
        supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Get a single echo by ID."""
        response = (
            supabase.table(cls.table_name)
            .select("*")
            .eq("id", str(echo_id))
            .single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Echo '{echo_id}' not found.",
            )
        return response.data

    @classmethod
    async def evaluate_echo_candidates(
        cls,
        supabase: Client,
        event: dict,
        simulation_id: UUID,
    ) -> list[dict]:
        """Determine which simulations this event should echo to.

        Checks:
        1. Event impact >= bleed_min_impact setting
        2. Source sim has bleed_enabled
        3. Active connections exist to target sims
        4. Target sims have bleed_enabled
        5. No existing echo for this event+target pair
        6. Cascade depth check: if event is already a bleed, check depth
        """
        sim_str = str(simulation_id)

        # Check if event qualifies (impact threshold)
        impact = event.get("impact_level") or 0
        if impact < 1:
            return []

        # Get source sim bleed settings
        settings_resp = (
            supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", sim_str)
            .eq("category", "world")
            .in_("setting_key", [
                "bleed_enabled", "bleed_min_impact", "bleed_max_depth",
                "bleed_strength_decay",
            ])
            .execute()
        )
        settings = {s["setting_key"]: s["setting_value"] for s in (settings_resp.data or [])}

        if not settings.get("bleed_enabled", True):
            return []

        min_impact = int(settings.get("bleed_min_impact", 8))

        # Campaign events have a slightly higher bar
        if event.get("campaign_id"):
            min_impact += 1

        if impact < min_impact:
            return []

        # Check cascade depth for bleed events
        current_depth = 0
        if event.get("data_source") == "bleed":
            refs = event.get("external_refs") or {}
            current_depth = refs.get("echo_depth", 1)
            max_depth = int(settings.get("bleed_max_depth", 2))
            if current_depth >= max_depth:
                return []

        # Get active connections from this simulation
        conn_resp = (
            supabase.table("simulation_connections")
            .select("*")
            .eq("is_active", True)
            .or_(
                f"simulation_a_id.eq.{sim_str},simulation_b_id.eq.{sim_str}"
            )
            .execute()
        )

        if not conn_resp.data:
            return []

        # Build candidate list
        candidates = []
        for conn in conn_resp.data:
            target_sim = (
                conn["simulation_b_id"]
                if conn["simulation_a_id"] == sim_str
                else conn["simulation_a_id"]
            )
            candidates.append({
                "target_simulation_id": target_sim,
                "connection": conn,
                "depth": current_depth + 1,
            })

        return candidates

    @classmethod
    async def create_echo(
        cls,
        admin_supabase: Client,
        source_event: dict,
        source_simulation_id: UUID,
        target_simulation_id: UUID,
        echo_vector: str,
        echo_strength: float,
        echo_depth: int,
        root_event_id: UUID | None = None,
    ) -> dict:
        """Create an echo record (uses admin client — bypasses RLS)."""
        source_event_id = source_event["id"]
        root_id = str(root_event_id) if root_event_id else source_event_id

        insert_data = serialize_for_json({
            "source_event_id": source_event_id,
            "source_simulation_id": str(source_simulation_id),
            "target_simulation_id": str(target_simulation_id),
            "echo_vector": echo_vector,
            "echo_strength": echo_strength,
            "echo_depth": echo_depth,
            "root_event_id": root_id,
            "status": "pending",
            "bleed_metadata": {
                "source_title": source_event.get("title"),
                "source_impact": source_event.get("impact_level"),
            },
        })

        response = (
            admin_supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create echo record.",
            )
        return response.data[0]

    @classmethod
    async def update_echo_status(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
        new_status: str,
        *,
        target_event_id: UUID | None = None,
        metadata_update: dict | None = None,
    ) -> dict:
        """Update echo status (uses admin client)."""
        update_data: dict = {
            "status": new_status,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if target_event_id:
            update_data["target_event_id"] = str(target_event_id)
        if metadata_update:
            update_data["bleed_metadata"] = metadata_update

        response = (
            admin_supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(echo_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Echo '{echo_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def approve_echo(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Approve a pending echo — marks as 'generating'."""
        echo = await cls.get(admin_supabase, echo_id)
        if echo["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve echo with status '{echo['status']}'.",
            )
        return await cls.update_echo_status(admin_supabase, echo_id, "generating")

    @classmethod
    async def reject_echo(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Reject a pending echo."""
        echo = await cls.get(admin_supabase, echo_id)
        if echo["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject echo with status '{echo['status']}'.",
            )
        return await cls.update_echo_status(admin_supabase, echo_id, "rejected")


class ConnectionService:
    """Simulation connection operations."""

    table_name = "simulation_connections"

    @classmethod
    async def list_all(
        cls,
        supabase: Client,
        *,
        active_only: bool = True,
    ) -> list[dict]:
        """List all simulation connections."""
        query = (
            supabase.table(cls.table_name)
            .select(
                "*, simulation_a:simulations!simulation_a_id(id, name, slug, theme, banner_url, description),"
                " simulation_b:simulations!simulation_b_id(id, name, slug, theme, banner_url, description)"
            )
            .order("created_at", desc=False)
        )
        if active_only:
            query = query.eq("is_active", True)

        response = query.execute()
        return response.data or []

    @classmethod
    async def get_map_data(
        cls,
        supabase: Client,
    ) -> dict:
        """Get aggregated data for the Cartographer's Map."""
        # Simulations with counts
        sims_resp = (
            supabase.table("simulations")
            .select("id, name, slug, theme, description, banner_url, status")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=False)
            .execute()
        )
        simulations = sims_resp.data or []

        # Enrich with counts from dashboard view
        dash_resp = (
            supabase.table("simulation_dashboard")
            .select("simulation_id, agent_count, building_count, event_count")
            .execute()
        )
        counts_map = {d["simulation_id"]: d for d in (dash_resp.data or [])}
        for sim in simulations:
            counts = counts_map.get(sim["id"], {})
            sim["agent_count"] = counts.get("agent_count", 0)
            sim["building_count"] = counts.get("building_count", 0)
            sim["event_count"] = counts.get("event_count", 0)

        # Connections
        connections = await cls.list_all(supabase, active_only=True)

        # Echo counts per simulation (incoming completed echoes)
        echo_resp = (
            supabase.table("event_echoes")
            .select("target_simulation_id", count="exact")
            .eq("status", "completed")
            .execute()
        )
        echo_counts: dict[str, int] = {}
        for row in echo_resp.data or []:
            sid = row["target_simulation_id"]
            echo_counts[sid] = echo_counts.get(sid, 0) + 1

        return {
            "simulations": simulations,
            "connections": connections,
            "echo_counts": echo_counts,
        }

    @classmethod
    async def create_connection(
        cls,
        admin_supabase: Client,
        data: dict,
    ) -> dict:
        """Create a simulation connection (admin only)."""
        response = (
            admin_supabase.table(cls.table_name)
            .insert(serialize_for_json(data))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create connection.",
            )
        return response.data[0]

    @classmethod
    async def update_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
        data: dict,
    ) -> dict:
        """Update a simulation connection (admin only)."""
        update_data = {**serialize_for_json(data), "updated_at": datetime.now(UTC).isoformat()}
        response = (
            admin_supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def delete_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
    ) -> dict:
        """Delete a simulation connection (admin only)."""
        response = (
            admin_supabase.table(cls.table_name)
            .delete()
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
        return response.data[0]
