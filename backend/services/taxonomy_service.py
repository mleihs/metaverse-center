"""Service layer for taxonomy operations."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class TaxonomyService:
    """Service for simulation taxonomy values."""

    @staticmethod
    async def list_taxonomies(
        supabase: Client,
        simulation_id: UUID,
        taxonomy_type: str | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        """List all taxonomy values, optionally filtered by type."""
        query = (
            supabase.table("simulation_taxonomies")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("taxonomy_type")
            .order("sort_order")
        )

        if taxonomy_type:
            query = query.eq("taxonomy_type", taxonomy_type)
        if active_only:
            query = query.eq("is_active", True)

        response = await query.execute()
        return extract_list(response)

    @staticmethod
    async def list_taxonomies_paginated(
        supabase: Client,
        simulation_id: UUID,
        *,
        taxonomy_type: str | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List taxonomies with pagination (public)."""
        query = (
            supabase.table("simulation_taxonomies")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("taxonomy_type")
            .range(offset, offset + limit - 1)
        )
        if taxonomy_type:
            query = query.eq("taxonomy_type", taxonomy_type)
        response = await query.execute()
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    @staticmethod
    async def create_taxonomy(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new taxonomy value."""
        response = await (
            supabase.table("simulation_taxonomies").insert({**data, "simulation_id": str(simulation_id)}).execute()
        )
        if not response.data:
            raise server_error("Failed to create taxonomy value.")
        return response.data[0]

    @staticmethod
    async def update_taxonomy(
        supabase: Client,
        simulation_id: UUID,
        taxonomy_id: UUID,
        data: dict,
    ) -> dict:
        """Update a taxonomy value."""
        if not data:
            raise bad_request("No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = await (
            supabase.table("simulation_taxonomies")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(taxonomy_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail=f"Taxonomy '{taxonomy_id}' not found.")
        return response.data[0]

    @staticmethod
    async def deactivate_taxonomy(
        supabase: Client,
        simulation_id: UUID,
        taxonomy_id: UUID,
    ) -> dict:
        """Soft-delete a taxonomy by setting is_active=False."""
        response = await (
            supabase.table("simulation_taxonomies")
            .update({"is_active": False, "updated_at": datetime.now(UTC).isoformat()})
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(taxonomy_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail=f"Taxonomy '{taxonomy_id}' not found.")
        return response.data[0]
