"""Service layer for simulation lore CRUD operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.translation_service import null_de_fields_for_update, schedule_auto_translation
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, not_found, server_error
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
            raise server_error("Failed to create lore section.")

        section = response.data[0]

        # Auto-translate in background
        sim = await maybe_single_data(
            supabase.table("simulations").select("name, theme").eq("id", sim_id).maybe_single()
        )
        if sim:
            schedule_auto_translation(
                supabase,
                TABLE,
                section["id"],
                section,
                simulation_name=sim["name"],
                simulation_theme=sim.get("theme", ""),
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
            raise bad_request("No fields to update.")

        sim_id = str(simulation_id)
        update_data = {**data, "updated_at": datetime.now(UTC).isoformat()}

        # Null stale translations
        de_nulls = null_de_fields_for_update(TABLE, data)
        if de_nulls:
            update_data.update(de_nulls)

        response = await (
            supabase.table(TABLE).update(update_data).eq("simulation_id", sim_id).eq("id", str(section_id)).execute()
        )

        if not response.data:
            raise not_found(detail=f"Lore section '{section_id}' not found.")

        section = response.data[0]

        # Re-translate in background if EN fields changed
        if de_nulls:
            sim = await maybe_single_data(
                supabase.table("simulations").select("name, theme").eq("id", sim_id).maybe_single()
            )
            if sim:
                schedule_auto_translation(
                    supabase,
                    TABLE,
                    section["id"],
                    section,
                    simulation_name=sim["name"],
                    simulation_theme=sim.get("theme", ""),
                    entity_type="lore",
                )

        return section

    @staticmethod
    async def delete_section(
        supabase: Client,
        simulation_id: UUID,
        section_id: UUID,
    ) -> dict:
        """Delete a lore section and re-sort remaining sections.

        Atomic via Postgres ``fn_delete_lore_section_atomic`` (migration 221).
        The RPC locks the simulation's lore rows, deletes the target, and
        rewrites remaining sort_order via ROW_NUMBER — all in one
        transaction. Replaces the prior delete-then-loop pattern which
        could produce sort_order gaps under concurrent edits.
        """
        rpc_resp = await supabase.rpc(
            "fn_delete_lore_section_atomic",
            {
                "p_simulation_id": str(simulation_id),
                "p_section_id": str(section_id),
            },
        ).execute()

        result = rpc_resp.data or {}
        if result.get("error") == "section_not_found":
            raise not_found(detail=f"Lore section '{section_id}' not found.")

        deleted_section = result.get("deleted_section")
        if not isinstance(deleted_section, dict):
            raise server_error("Lore section delete failed: unexpected RPC response.")
        return deleted_section

    @staticmethod
    async def reorder_sections(
        supabase: Client,
        simulation_id: UUID,
        section_ids: list[UUID],
    ) -> list[dict]:
        """Bulk reorder sections by updating sort_order based on list position.

        Atomic via Postgres ``fn_reorder_lore_sections_atomic`` (migration 221).
        The RPC locks the provided rows via FOR UPDATE, validates each
        section belongs to the given simulation, then bulk-writes
        sort_order via UNNEST WITH ORDINALITY. Lenient semantics: updates
        only the provided IDs; non-mentioned rows are left untouched.
        Empty input is a no-op returning current state. Replaces the prior
        serial N-UPDATE loop which could interleave under concurrent
        reorders.
        """
        try:
            rpc_resp = await supabase.rpc(
                "fn_reorder_lore_sections_atomic",
                {
                    "p_simulation_id": str(simulation_id),
                    "p_section_ids": [str(sid) for sid in section_ids],
                },
            ).execute()
        except PostgrestAPIError as exc:
            # RPC raises 22023 (invalid_parameter_value) when any provided
            # section_id does not belong to the simulation or appears as a
            # duplicate — caller errors.
            if exc.code == "22023":
                raise bad_request(exc.message) from exc
            raise

        return rpc_resp.data or []
