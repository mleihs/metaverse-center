"""Prompt template management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
)
from backend.services.prompt_service import PromptResolver
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/prompt-templates",
    tags=["prompt-templates"],
)


@router.get("", response_model=PaginatedResponse[PromptTemplateResponse])
async def list_prompt_templates(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    locale: str | None = Query(default=None),
    prompt_category: str | None = Query(default=None),
    include_platform: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List prompt templates (simulation-specific + optionally platform defaults)."""
    # Simulation-specific templates
    query = (
        supabase.table("prompt_templates")
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

    # Optionally include platform defaults
    if include_platform:
        platform_query = (
            supabase.table("prompt_templates")
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
        sim_types = {
            (t["template_type"], t["locale"]) for t in templates
        }
        for pt in platform_templates:
            if (pt["template_type"], pt["locale"]) not in sim_types:
                templates.append(pt)
                total += 1

    return {
        "success": True,
        "data": templates,
        "meta": {
            "count": len(templates),
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.get("/{template_id}", response_model=SuccessResponse[PromptTemplateResponse])
async def get_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single prompt template."""
    response = (
        supabase.table("prompt_templates")
        .select("*")
        .eq("id", str(template_id))
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found.",
        )
    return {"success": True, "data": response.data}


@router.post("", response_model=SuccessResponse[PromptTemplateResponse], status_code=201)
async def create_prompt_template(
    simulation_id: UUID,
    body: PromptTemplateCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new prompt template for this simulation."""
    insert_data = {
        **body.model_dump(),
        "simulation_id": str(simulation_id),
        "created_by_id": str(user.id),
    }

    response = (
        supabase.table("prompt_templates")
        .insert(insert_data)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create prompt template.",
        )

    return {"success": True, "data": response.data[0]}


@router.put("/{template_id}", response_model=SuccessResponse[PromptTemplateResponse])
async def update_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    body: PromptTemplateUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a prompt template."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    response = (
        supabase.table("prompt_templates")
        .update(update_data)
        .eq("id", str(template_id))
        .eq("simulation_id", str(simulation_id))
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template '{template_id}' not found in simulation.",
        )

    return {"success": True, "data": response.data[0]}


@router.delete("/{template_id}", response_model=SuccessResponse[dict])
async def delete_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete a prompt template (set is_active=False)."""
    response = (
        supabase.table("prompt_templates")
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

    return {"success": True, "data": {"id": str(template_id), "deleted": True}}


@router.post("/test", response_model=SuccessResponse[dict])
async def test_prompt_template(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    template_type: str = Query(..., description="Template type to test"),
    locale: str = Query(default="en"),
) -> dict:
    """Test prompt resolution — shows which template would be used."""
    resolver = PromptResolver(supabase, simulation_id)
    resolved = await resolver.resolve(template_type, locale)

    # Fill with example variables
    example_vars = {
        "agent_name": "Test Agent",
        "agent_system": "politics",
        "agent_gender": "male",
        "agent_character": "A brave leader...",
        "agent_background": "Born in the capital...",
        "building_type": "government",
        "building_name": "City Hall",
        "event_type": "political",
        "simulation_name": "Test Simulation",
        "locale_name": "English",
    }
    filled = resolver.fill_template(resolved, example_vars)

    return {
        "success": True,
        "data": {
            "template_type": resolved.template_type,
            "locale": resolved.locale,
            "source": resolved.source,
            "system_prompt": resolved.system_prompt,
            "prompt_preview": filled[:500],
            "model_hint": resolved.default_model,
        },
    }
