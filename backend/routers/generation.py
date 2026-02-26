"""AI generation endpoints — rate-limited."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.external.openrouter import OpenRouterError
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.image_service import ImageService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/generate",
    tags=["generation"],
)

limiter = Limiter(key_func=get_remote_address)


# --- Request models ---


class GenerateAgentRequest(BaseModel):
    """Request to generate an agent description."""

    name: str = Field(..., min_length=1, max_length=255)
    system: str = ""
    gender: str = ""
    locale: str = "de"


class GenerateBuildingRequest(BaseModel):
    """Request to generate a building description."""

    building_type: str = Field(..., min_length=1)
    name: str | None = None
    style: str | None = None
    condition: str | None = None
    locale: str = "de"


class GeneratePortraitRequest(BaseModel):
    """Request to generate a portrait description."""

    agent_id: UUID
    agent_name: str = Field(..., min_length=1)
    agent_data: dict | None = None


class GenerateEventRequest(BaseModel):
    """Request to generate an event."""

    event_type: str = Field(..., min_length=1)
    locale: str = "de"


class GenerateRelationshipsRequest(BaseModel):
    """Request to generate agent relationships."""

    agent_id: UUID
    locale: str = "de"


class GenerateImageRequest(BaseModel):
    """Request to generate an image for an entity."""

    entity_type: str = Field(..., pattern="^(agent|building)$")
    entity_id: UUID
    entity_name: str = Field(..., min_length=1)
    extra: dict | None = None


# --- Helpers ---


async def _get_generation_service(
    simulation_id: UUID,
    supabase: Client,
) -> GenerationService:
    """Create a GenerationService with per-simulation API keys."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    return GenerationService(
        supabase, simulation_id,
        openrouter_api_key=ai_config.openrouter_api_key,
    )


async def _get_image_service(
    simulation_id: UUID,
    supabase: Client,
) -> ImageService:
    """Create an ImageService with per-simulation API keys."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    return ImageService(
        supabase, simulation_id,
        replicate_api_key=ai_config.replicate_api_key,
        openrouter_api_key=ai_config.openrouter_api_key,
    )


# --- Endpoints ---


@router.post("/agent", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_agent(
    request: Request,
    simulation_id: UUID,
    body: GenerateAgentRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate an agent description using AI."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_agent_full(
            agent_name=body.name,
            agent_system=body.system,
            agent_gender=body.gender,
            locale=body.locale,
        )
        return {"success": True, "data": result}
    except OpenRouterError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        logger.exception("Agent generation failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.post("/building", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_building(
    request: Request,
    simulation_id: UUID,
    body: GenerateBuildingRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate a building description using AI."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_building(
            building_type=body.building_type,
            building_name=body.name,
            building_style=body.style,
            building_condition=body.condition,
            locale=body.locale,
        )
        return {"success": True, "data": result}
    except OpenRouterError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        logger.exception("Building generation failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.post("/portrait-description", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_portrait_description(
    request: Request,
    simulation_id: UUID,
    body: GeneratePortraitRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate a portrait description for image generation."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        description = await service.generate_portrait_description(
            agent_name=body.agent_name,
            agent_data=body.agent_data,
        )
        return {"success": True, "data": {"description": description}}
    except OpenRouterError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        logger.exception("Portrait description generation failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.post("/event", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_event(
    request: Request,
    simulation_id: UUID,
    body: GenerateEventRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate an event description using AI."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_event(
            event_type=body.event_type,
            locale=body.locale,
        )
        return {"success": True, "data": result}
    except OpenRouterError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        logger.exception("Event generation failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.post("/relationships", response_model=SuccessResponse[list])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_relationships(
    request: Request,
    simulation_id: UUID,
    body: GenerateRelationshipsRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate relationship suggestions for an agent using AI."""
    try:
        # Get agent data
        agent_resp = (
            supabase.table("agents")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(body.agent_id))
            .single()
            .execute()
        )
        if not agent_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found.",
            )

        # Get other agents in the simulation
        others_resp = (
            supabase.table("agents")
            .select("id, name, system, character, background")
            .eq("simulation_id", str(simulation_id))
            .neq("id", str(body.agent_id))
            .is_("deleted_at", "null")
            .limit(20)
            .execute()
        )

        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_agent_relationships(
            agent_data=agent_resp.data,
            other_agents=others_resp.data or [],
            locale=body.locale,
        )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except OpenRouterError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.exception("Relationship generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@router.post("/image", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_image(
    request: Request,
    simulation_id: UUID,
    body: GenerateImageRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate an image for an agent portrait or building."""
    try:
        service = await _get_image_service(simulation_id, supabase)

        if body.entity_type == "agent":
            url = await service.generate_agent_portrait(
                agent_id=body.entity_id,
                agent_name=body.entity_name,
                agent_data=body.extra,
            )
        else:
            extra = body.extra or {}
            building_type = extra.get("building_type", "residential")
            building_data = {
                "building_condition": extra.get("building_condition", ""),
                "building_style": extra.get("building_style", ""),
                "description": extra.get("description", ""),
                "special_type": extra.get("special_type", ""),
                "construction_year": extra.get("construction_year", ""),
                "population_capacity": extra.get("population_capacity", ""),
                "zone_name": extra.get("zone_name", ""),
            }
            url = await service.generate_building_image(
                building_id=body.entity_id,
                building_name=body.entity_name,
                building_type=building_type,
                building_data=building_data,
            )

        return {"success": True, "data": {"image_url": url}}
    except OpenRouterError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)) from e
    except Exception as e:
        logger.exception("Image generation failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e
