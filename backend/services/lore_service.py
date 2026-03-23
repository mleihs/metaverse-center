"""Service layer for simulation lore CRUD operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.translation_service import null_de_fields_for_update, schedule_auto_translation
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

TABLE = "simulation_lore"


class LoreService:
    """Lore section CRUD for a simulation."""

    @staticmethod
    async def create_section(
        supabase: Client,
        simulation_id: UUID,
        data: dict,
    ) -> dict:
        """Create a new lore section at the end of the sort order."""
        sim_id = str(simulation_id)

        # Get next sort_order
        existing = await (
            supabase.table(TABLE)
            .select("sort_order")
            .eq("simulation_id", sim_id)
            .order("sort_order", desc=True)
            .limit(1)
            .execute()
        )
        next_order = (existing.data[0]["sort_order"] + 1) if existing.data else 0

        insert_data = {
            **data,
            "simulation_id": sim_id,
            "sort_order": next_order,
        }

        response = await supabase.table(TABLE).insert(insert_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create lore section.",
            )

        section = response.data[0]

        # Auto-translate in background
        sim = await (
            supabase.table("simulations")
            .select("name, theme")
            .eq("id", sim_id)
            .maybe_single()
            .execute()
        )
        if sim.data:
            schedule_auto_translation(
                supabase,
                TABLE,
                section["id"],
                section,
                simulation_name=sim.data["name"],
                simulation_theme=sim.data.get("theme", ""),
                entity_type="lore",
            )

        return section

    @staticmethod
    async def update_section(
        supabase: Client,
        simulation_id: UUID,
        section_id: UUID,
        data: dict,
    ) -> dict:
        """Update a lore section. Nulls _de fields when EN content changes."""
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        sim_id = str(simulation_id)
        update_data = {**data, "updated_at": datetime.now(UTC).isoformat()}

        # Null stale translations
        de_nulls = null_de_fields_for_update(TABLE, data)
        if de_nulls:
            update_data.update(de_nulls)

        response = await (
            supabase.table(TABLE)
            .update(update_data)
            .eq("simulation_id", sim_id)
            .eq("id", str(section_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lore section '{section_id}' not found.",
            )

        section = response.data[0]

        # Re-translate in background if EN fields changed
        if de_nulls:
            sim = await (
                supabase.table("simulations")
                .select("name, theme")
                .eq("id", sim_id)
                .maybe_single()
                .execute()
            )
            if sim.data:
                schedule_auto_translation(
                    supabase,
                    TABLE,
                    section["id"],
                    section,
                    simulation_name=sim.data["name"],
                    simulation_theme=sim.data.get("theme", ""),
                    entity_type="lore",
                )

        return section

    @staticmethod
    async def delete_section(
        supabase: Client,
        simulation_id: UUID,
        section_id: UUID,
    ) -> dict:
        """Delete a lore section and re-sort remaining sections."""
        sim_id = str(simulation_id)

        response = await (
            supabase.table(TABLE)
            .delete()
            .eq("simulation_id", sim_id)
            .eq("id", str(section_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lore section '{section_id}' not found.",
            )

        # Re-sort remaining sections
        remaining = await (
            supabase.table(TABLE)
            .select("id")
            .eq("simulation_id", sim_id)
            .order("sort_order")
            .execute()
        )
        for i, row in enumerate(remaining.data or []):
            await supabase.table(TABLE).update({"sort_order": i}).eq("id", row["id"]).execute()

        return response.data[0]

    @staticmethod
    async def reorder_sections(
        supabase: Client,
        simulation_id: UUID,
        section_ids: list[UUID],
    ) -> list[dict]:
        """Bulk reorder sections by updating sort_order based on list position."""
        sim_id = str(simulation_id)

        for i, sid in enumerate(section_ids):
            await supabase.table(TABLE).update({"sort_order": i}).eq(
                "simulation_id", sim_id
            ).eq("id", str(sid)).execute()

        # Return updated list
        response = await (
            supabase.table(TABLE)
            .select("*")
            .eq("simulation_id", sim_id)
            .order("sort_order")
            .execute()
        )
        return response.data or []
