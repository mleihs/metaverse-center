"""Prompt template management endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.common import CurrentUser, DeleteResponse, PaginatedResponse, SuccessResponse
from backend.models.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateResponse,
    PromptTemplateUpdate,
    PromptTestResponse,
)
from backend.services.audit_service import AuditService
from backend.services.prompt_service import PromptResolver
from backend.services.prompt_template_service import PromptTemplateService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/prompt-templates",
    tags=["prompt-templates"],
)


@router.get("")
async def list_prompt_templates(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    locale: Annotated[str | None, Query()] = None,
    prompt_category: Annotated[str | None, Query()] = None,
    include_platform: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[PromptTemplateResponse]:
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

    return paginated(data, total, limit, offset)


@router.get("/{template_id}")
async def get_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[PromptTemplateResponse]:
    """Get a single prompt template."""
    data = await PromptTemplateService.get(supabase, template_id)
    return SuccessResponse(data=data)


@router.post("", status_code=201)
async def create_prompt_template(
    simulation_id: UUID,
    body: PromptTemplateCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[PromptTemplateResponse]:
    """Create a new prompt template for this simulation."""
    data = await PromptTemplateService.create(supabase, simulation_id, user.id, body.model_dump())
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", data["id"], "create")
    return SuccessResponse(data=data)


@router.put("/{template_id}")
async def update_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    body: PromptTemplateUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[PromptTemplateResponse]:
    """Update a prompt template."""
    data = await PromptTemplateService.update(supabase, simulation_id, template_id, body.model_dump(exclude_none=True))
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", template_id, "update")
    return SuccessResponse(data=data)


@router.delete("/{template_id}")
async def delete_prompt_template(
    simulation_id: UUID,
    template_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[DeleteResponse]:
    """Soft-delete a prompt template (set is_active=False)."""
    await PromptTemplateService.deactivate(supabase, simulation_id, template_id)
    await AuditService.log_action(supabase, simulation_id, user.id, "prompt_templates", template_id, "delete")
    return SuccessResponse(data=DeleteResponse(id=str(template_id)))


@router.post("/test")
async def test_prompt_template(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("admin"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    template_type: Annotated[str, Query(description="Template type to test")],
    locale: Annotated[str, Query()] = "en",
) -> SuccessResponse[PromptTestResponse]:
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

    return SuccessResponse(
        data=PromptTestResponse(
            template_type=resolved.template_type,
            locale=resolved.locale,
            source=resolved.source,
            system_prompt=resolved.system_prompt,
            prompt_preview=filled[:500],
            model_hint=resolved.default_model,
        )
    )
