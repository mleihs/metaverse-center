"""Service layer for taxonomy operations."""

import logging
from uuid import UUID

from backend.services.base_service import BaseService
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class TaxonomyService(BaseService):
    """Service for simulation taxonomy values."""

    table_name = "simulation_taxonomies"
    view_name = None
    supports_created_by = False

    @classmethod
    async def list_taxonomies(
        cls,
        supabase: Client,
        simulation_id: UUID,
        taxonomy_type: str | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        """List all taxonomy values, optionally filtered by type.

        Custom implementation: unique ordering (taxonomy_type, sort_order)
        and boolean is_active filter not expressible via BaseService.list().
        """
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

    @classmethod
    async def list_taxonomies_paginated(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        taxonomy_type: str | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List taxonomies with pagination (public)."""
        filters = {}
        if taxonomy_type:
            filters["taxonomy_type"] = taxonomy_type
        return await cls.list(
            supabase,
            simulation_id,
            filters=filters,
            order_by="taxonomy_type",
            limit=limit,
            offset=offset,
        )

    @classmethod
    async def deactivate_taxonomy(
        cls,
        supabase: Client,
        simulation_id: UUID,
        taxonomy_id: UUID,
    ) -> dict:
        """Soft-delete a taxonomy by setting is_active=False."""
        return await cls.update(supabase, simulation_id, taxonomy_id, {"is_active": False})
