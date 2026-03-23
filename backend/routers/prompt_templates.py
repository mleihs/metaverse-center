"""Prompt template management endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.prompt_service import PromptResolver
from backend.services.prompt_template_service import PromptTemplateService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

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
    data, total = await PromptTemplateService.list_templates(
        supabase,
        simulation_id,
        locale=locale,
        prompt_category=prompt_category,
        include_platform=include_platform,
        limit=limit,
        offset=offset,
    )

    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
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
    data = await PromptTemplateService.get(supabase, template_id)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[PromptTemplateResponse], status_code=201)
async def create_prompt_template(
    simulation_id: UUID,
    body: PromptTemplateCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new prompt template for this simulation."""
    data = await PromptTemplateService.create(
        supabase, simulation_id, user.id, body.model_dump()
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", data["id"], "create")
    return {"success": True, "data": data}


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
    data = await PromptTemplateService.update(
        supabase, simulation_id, template_id, body.model_dump(exclude_none=True)
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", template_id, "update")
    return {"success": True, "data": data}


@router.delete("/{template_id}", response_model=SuccessResponse[dict])
async def delete_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete a prompt template (set is_active=False)."""
    await PromptTemplateService.deactivate(supabase, simulation_id, template_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", template_id, "delete")
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
    """Test prompt resolution -- shows which template would be used."""
    resolver = PromptResolver(supabase, simulation_id)
    resolved = await resolver.resolve(template_type, locale)

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
