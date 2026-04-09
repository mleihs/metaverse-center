"""Service layer for embassy operations.

Cross-simulation building links — uses admin client for cross-sim writes.
Does NOT extend BaseService (embassies span two simulations).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException

from backend.services.base_service import serialize_for_json
from backend.utils.errors import bad_request, not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_BUILDING_FIELDS = (
    "id, name, building_type, description, style, image_url, simulation_id, special_type, special_attributes"
)
_SIM_FIELDS = "id, name, slug, theme, description"
_EMBASSY_SELECT = (
    f"*, building_a:buildings!building_a_id({_BUILDING_FIELDS}),"
    f" building_b:buildings!building_b_id({_BUILDING_FIELDS}),"
    f" simulation_a:simulations!simulation_a_id({_SIM_FIELDS}),"
    f" simulation_b:simulations!simulation_b_id({_SIM_FIELDS})"
)


class EmbassyService:
    """Embassy operations — cross-simulation building links."""

    table_name = "embassies"

    @classmethod
    async def list_for_simulation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List embassies involving a simulation."""
        sim_str = str(simulation_id)
        query = (
            supabase.table(cls.table_name)
            .select(_EMBASSY_SELECT, count="exact")
            .or_(f"simulation_a_id.eq.{sim_str},simulation_b_id.eq.{sim_str}")
            .order("created_at", desc=True)
        )
        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()
        total = response.count if response.count is not None else len(extract_list(response))
        return extract_list(response), total

    @classmethod
    async def list_for_building(
        cls,
        supabase: Client,
        building_id: UUID,
    ) -> list[dict]:
        """List embassies for a specific building."""
        bid = str(building_id)
        response = await (
            supabase.table(cls.table_name)
            .select(_EMBASSY_SELECT)
            .or_(f"building_a_id.eq.{bid},building_b_id.eq.{bid}")
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def get(
        cls,
        supabase: Client,
        embassy_id: UUID,
    ) -> dict:
        """Get a single embassy by ID."""
        response = await (
            supabase.table(cls.table_name).select(_EMBASSY_SELECT).eq("id", str(embassy_id)).single().execute()
        )
        if not response.data:
            raise not_found("embassy", embassy_id)
        return response.data

    @classmethod
    async def get_for_building(
        cls,
        supabase: Client,
        building_id: UUID,
    ) -> dict | None:
        """Get the embassy for a specific building, or None."""
        bid = str(building_id)
        response = await (
            supabase.table(cls.table_name)
            .select(_EMBASSY_SELECT)
            .or_(f"building_a_id.eq.{bid},building_b_id.eq.{bid}")
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @classmethod
    async def create_embassy(
        cls,
        admin_supabase: Client,
        data: dict,
        *,
        created_by_id: UUID | None = None,
    ) -> dict:
        """Create an embassy link between two buildings.

        Uses admin client to bypass RLS (cross-simulation writes).
        Sorts building IDs to satisfy ordered_buildings constraint.
        """
        bid_a = str(data["building_a_id"])
        bid_b = str(data["building_b_id"])

        # Enforce ordered constraint: building_a_id < building_b_id
        if bid_a > bid_b:
            bid_a, bid_b = bid_b, bid_a
            data["building_a_id"], data["building_b_id"] = data["building_b_id"], data["building_a_id"]
            data["simulation_a_id"], data["simulation_b_id"] = data["simulation_b_id"], data["simulation_a_id"]

            # Also swap ambassador metadata keys to keep mapping correct
            meta = data.get("embassy_metadata")
            if meta and isinstance(meta, dict):
                amb_a = meta.pop("ambassador_a", None)
                amb_b = meta.pop("ambassador_b", None)
                if amb_a:
                    meta["ambassador_b"] = amb_a
                if amb_b:
                    meta["ambassador_a"] = amb_b

        # Validate different simulations
        if str(data["simulation_a_id"]) == str(data["simulation_b_id"]):
            raise bad_request("Embassy must link buildings in different simulations.")

        insert_data = serialize_for_json(
            {
                **data,
                "status": "proposed",
                "created_by_id": str(created_by_id) if created_by_id else None,
            }
        )

        response = await admin_supabase.table(cls.table_name).insert(insert_data).execute()
        if not response.data:
            raise bad_request("Failed to create embassy.")

        embassy = response.data[0]

        logger.info(
            "Embassy created",
            extra={
                "embassy_id": embassy["id"],
                "simulation_a_id": str(data["simulation_a_id"]),
                "simulation_b_id": str(data["simulation_b_id"]),
                "building_a_id": bid_a,
                "building_b_id": bid_b,
            },
        )

        # Update special_attributes on both buildings
        await cls._update_building_special_attrs(admin_supabase, embassy)

        # Auto-activate: proposed → active (no value in proposed state for UI-created embassies)
        try:
            embassy = await cls.transition_status(admin_supabase, embassy["id"], "active")
        except HTTPException:
            logger.warning("Auto-activation failed for embassy %s", embassy["id"])

        return embassy

    @classmethod
    async def update_embassy(
        cls,
        admin_supabase: Client,
        embassy_id: UUID,
        data: dict,
    ) -> dict:
        """Update embassy metadata."""
        if not data:
            raise bad_request("No fields to update.")

        update_data = {**serialize_for_json(data), "updated_at": datetime.now(UTC).isoformat()}

        response = await admin_supabase.table(cls.table_name).update(update_data).eq("id", str(embassy_id)).execute()
        if not response.data:
            raise not_found("embassy", embassy_id)

        logger.info(
            "Embassy updated",
            extra={"embassy_id": str(embassy_id), "fields": list(data.keys())},
        )
        return response.data[0]

    @classmethod
    async def transition_status(
        cls,
        admin_supabase: Client,
        embassy_id: UUID,
        new_status: str,
    ) -> dict:
        """Transition embassy status with validation."""
        embassy = await cls.get(admin_supabase, embassy_id)
        current = embassy["status"]

        valid_transitions = {
            "proposed": {"active", "dissolved"},
            "active": {"suspended", "dissolved"},
            "suspended": {"active", "dissolved"},
        }

        allowed = valid_transitions.get(current, set())
        if new_status not in allowed:
            raise bad_request(f"Cannot transition from '{current}' to '{new_status}'.")

        result = await cls.update_embassy(admin_supabase, embassy_id, {"status": new_status})

        logger.info(
            "Embassy status transitioned",
            extra={
                "embassy_id": str(embassy_id),
                "from_status": current,
                "to_status": new_status,
            },
        )

        # If dissolving, clear special_attributes on buildings
        if new_status == "dissolved":
            await cls._clear_building_special_attrs(admin_supabase, embassy)

        return result

    # ── Ward Mechanic (migration 191) ──────────────────

    @classmethod
    async def set_ward(
        cls,
        supabase: Client,
        embassy_id: UUID,
        ward_vector: str,
        ward_strength: float = 0.5,
    ) -> dict:
        """Set a bleed ward on an embassy. Reduces echo strength for the
        chosen vector by ``ward_strength`` (0.0-1.0) on incoming echoes.

        Requires the embassy to be active. Only one ward_vector per embassy.
        """
        logger.info(
            "Setting embassy ward",
            extra={"embassy_id": str(embassy_id), "ward_vector": ward_vector, "ward_strength": ward_strength},
        )
        resp = await (
            supabase.table(cls.table_name)
            .update({
                "ward_vector": ward_vector,
                "ward_strength": max(0.0, min(1.0, ward_strength)),
            })
            .eq("id", str(embassy_id))
            .eq("status", "active")
            .execute()
        )
        if not resp.data:
            raise not_found("embassy", embassy_id, detail="Embassy not found or not active.")
        return resp.data[0]

    @classmethod
    async def remove_ward(
        cls,
        supabase: Client,
        embassy_id: UUID,
    ) -> dict:
        """Remove the bleed ward from an embassy."""
        logger.info("Removing embassy ward", extra={"embassy_id": str(embassy_id)})
        resp = await (
            supabase.table(cls.table_name)
            .update({"ward_vector": None, "ward_strength": 0.0})
            .eq("id", str(embassy_id))
            .execute()
        )
        if not resp.data:
            raise not_found("embassy", embassy_id)
        return resp.data[0]

    @classmethod
    async def list_all_active(
        cls,
        supabase: Client,
    ) -> list[dict]:
        """List all active embassies (for map data)."""
        response = await (
            supabase.table(cls.table_name)
            .select(_EMBASSY_SELECT)
            .eq("status", "active")
            .order("created_at", desc=False)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def _update_building_special_attrs(
        cls,
        admin_supabase: Client,
        embassy: dict,
    ) -> None:
        """Set special_type and special_attributes on both embassy buildings."""
        eid = embassy["id"]

        # Get partner building names
        ba_resp = await (
            admin_supabase.table("buildings").select("name").eq("id", embassy["building_a_id"]).single().execute()
        )
        bb_resp = await (
            admin_supabase.table("buildings").select("name").eq("id", embassy["building_b_id"]).single().execute()
        )

        if ba_resp.data and bb_resp.data:
            # Update building A
            await (
                admin_supabase.table("buildings")
                .update(
                    {
                        "special_type": "embassy",
                        "special_attributes": serialize_for_json(
                            {
                                "embassy_id": eid,
                                "partner_building_id": embassy["building_b_id"],
                                "partner_simulation_id": embassy["simulation_b_id"],
                                "partner_building_name": bb_resp.data["name"],
                            }
                        ),
                    }
                )
                .eq("id", embassy["building_a_id"])
                .execute()
            )

            # Update building B
            await (
                admin_supabase.table("buildings")
                .update(
                    {
                        "special_type": "embassy",
                        "special_attributes": serialize_for_json(
                            {
                                "embassy_id": eid,
                                "partner_building_id": embassy["building_a_id"],
                                "partner_simulation_id": embassy["simulation_a_id"],
                                "partner_building_name": ba_resp.data["name"],
                            }
                        ),
                    }
                )
                .eq("id", embassy["building_b_id"])
                .execute()
            )

    @classmethod
    async def _clear_building_special_attrs(
        cls,
        admin_supabase: Client,
        embassy: dict,
    ) -> None:
        """Clear special_type and special_attributes on dissolved embassy buildings."""
        for bid in [embassy["building_a_id"], embassy["building_b_id"]]:
            await (
                admin_supabase.table("buildings")
                .update(
                    {
                        "special_type": None,
                        "special_attributes": {},
                    }
                )
                .eq("id", bid)
                .execute()
            )
