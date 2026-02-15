"""Service layer for taxonomy operations."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client


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

        response = query.execute()
        return response.data or []

    @staticmethod
    async def create_taxonomy(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a new taxonomy value."""
        response = (
            supabase.table("simulation_taxonomies")
            .insert({**data, "simulation_id": str(simulation_id)})
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create taxonomy value.",
            )
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
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
        data["updated_at"] = datetime.now(UTC).isoformat()
        response = (
            supabase.table("simulation_taxonomies")
            .update(data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(taxonomy_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Taxonomy '{taxonomy_id}' not found.",
            )
        return response.data[0]

    @staticmethod
    async def deactivate_taxonomy(
        supabase: Client,
        simulation_id: UUID,
        taxonomy_id: UUID,
    ) -> dict:
        """Soft-delete a taxonomy by setting is_active=False."""
        response = (
            supabase.table("simulation_taxonomies")
            .update({"is_active": False, "updated_at": datetime.now(UTC).isoformat()})
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(taxonomy_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Taxonomy '{taxonomy_id}' not found.",
            )
        return response.data[0]
