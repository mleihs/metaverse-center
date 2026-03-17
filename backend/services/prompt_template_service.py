"""Service layer for prompt template operations."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)


class PromptTemplateService:
    """Prompt template CRUD with platform-default merging.

    Uses ``is_active`` for soft-delete (not ``deleted_at``), so BaseService
    is not a good fit here.
    """

    table_name = "prompt_templates"

    @classmethod
    async def list_templates(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        locale: str | None = None,
        prompt_category: str | None = None,
        include_platform: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List templates for a simulation, optionally merged with platform defaults."""
        query = (
            supabase.table(cls.table_name)
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .eq("is_active", True)
            .order("template_type")
        )
        if locale:
            query = query.eq("locale", locale)
        if prompt_category:
            query = query.eq("prompt_category", prompt_category)

        query = query.range(offset, offset + limit - 1)
        sim_response = query.execute()

        templates = sim_response.data or []
        total = sim_response.count or len(templates)

        if include_platform:
            platform_query = (
                supabase.table(cls.table_name)
                .select("*")
                .is_("simulation_id", "null")
                .eq("is_active", True)
                .order("template_type")
            )
            if locale:
                platform_query = platform_query.eq("locale", locale)
            if prompt_category:
                platform_query = platform_query.eq("prompt_category", prompt_category)

            platform_response = platform_query.execute()
            platform_templates = platform_response.data or []

            # Only include platform templates not overridden by simulation
            sim_types = {(t["template_type"], t["locale"]) for t in templates}
            for pt in platform_templates:
                if (pt["template_type"], pt["locale"]) not in sim_types:
                    templates.append(pt)
                    total += 1

        return templates, total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        template_id: UUID,
    ) -> dict:
        """Get a single prompt template by ID."""
        response = (
            supabase.table(cls.table_name)
            .select("*")
            .eq("id", str(template_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template '{template_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def create(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Create a new prompt template for a simulation."""
        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
            "created_by_id": str(user_id),
        }

        response = (
            supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create prompt template.",
            )
        return response.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        simulation_id: UUID,
        template_id: UUID,
        data: dict,
    ) -> dict:
        """Update a prompt template."""
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        response = (
            supabase.table(cls.table_name)
            .update(data)
            .eq("id", str(template_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template '{template_id}' not found in simulation.",
            )
        return response.data[0]

    @classmethod
    async def deactivate(
        cls,
        supabase: Client,
        simulation_id: UUID,
        template_id: UUID,
    ) -> dict:
        """Soft-delete a prompt template by setting is_active=False."""
        response = (
            supabase.table(cls.table_name)
            .update({"is_active": False})
            .eq("id", str(template_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template '{template_id}' not found.",
            )
        return response.data[0]
