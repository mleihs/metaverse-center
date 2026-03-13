"""AI generation endpoints — rate-limited."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.agent_service import AgentService
from backend.services.external.openrouter import OpenRouterError
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.generation_service import GenerationService
from backend.services.image_service import ImageService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/generate",
    tags=["generation"],
)

# --- Request models ---


class GenerateAgentRequest(BaseModel):
    """Request to generate an agent description."""

    name: str = Field(..., min_length=1, max_length=255, description="Display name of the agent to generate.")
    system: str = Field("", description="Agent's system/faction affiliation within the simulation.")
    gender: str = Field("", description="Agent's gender (used for pronoun selection in generated text).")
    locale: str = Field("de", description="Target language for the generated description (ISO 639-1).")


class GenerateBuildingRequest(BaseModel):
    """Request to generate a building description."""

    building_type: str = Field(
        ..., min_length=1, description="Taxonomy building type (e.g. 'residential', 'military')."
    )
    name: str | None = Field(None, description="Optional building name; unnamed buildings get a generic description.")
    style: str | None = Field(None, description="Architectural style (e.g. 'brutalist', 'gothic', 'industrial').")
    condition: str | None = Field(None, description="Current building condition (e.g. 'good', 'damaged', 'ruins').")
    locale: str = Field("de", description="Target language for the generated description (ISO 639-1).")


class GeneratePortraitRequest(BaseModel):
    """Request to generate a portrait description."""

    agent_id: UUID = Field(..., description="UUID of the agent whose portrait to describe.")
    agent_name: str = Field(..., min_length=1, description="Display name of the agent (used in the prompt).")
    agent_data: dict | None = Field(
        None, description="Optional agent metadata (appearance, background) for the prompt."
    )


class GenerateEventRequest(BaseModel):
    """Request to generate an event."""

    event_type: str = Field(
        ..., min_length=1, description="Taxonomy event type (e.g. 'political', 'social', 'military')."
    )
    locale: str = Field("de", description="Target language for the generated event (ISO 639-1).")


class GenerateRelationshipsRequest(BaseModel):
    """Request to generate agent relationships."""

    agent_id: UUID = Field(..., description="UUID of the focal agent to generate relationships for.")
    locale: str = Field("de", description="Target language for relationship descriptions (ISO 639-1).")


class GenerateImageRequest(BaseModel):
    """Request to generate an image for an entity."""

    entity_type: str = Field(
        ..., pattern="^(agent|building|banner)$", description="Entity kind: 'agent', 'building', or 'banner'."
    )
    entity_id: UUID = Field(..., description="UUID of the entity to generate an image for.")
    entity_name: str = Field(..., min_length=1, description="Display name of the entity (used in the image prompt).")
    extra: dict | None = Field(None, description="Additional entity metadata passed to the image generation pipeline.")


class GenerateLoreImageRequest(BaseModel):
    """Request to generate a lore section image."""

    section_title: str = Field(..., min_length=1, description="Title of the lore section.")
    section_body: str = Field(..., description="Body text of the lore section (truncated for prompt).")
    image_slug: str = Field(..., min_length=1, description="Slug for the output file path.")
    sim_slug: str = Field(..., min_length=1, description="Simulation slug for the storage path.")
    image_caption: str | None = Field(None, description="Visual scene description for direct use as image prompt.")


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
        logger.warning("AI service unavailable", extra={"endpoint": "generate_agent", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Agent generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Agent generation failed. Please try again.",
        ) from e


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
        logger.warning("AI service unavailable", extra={"endpoint": "generate_building", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Building generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Building generation failed. Please try again.",
        ) from e


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
        logger.warning("AI service unavailable", extra={"endpoint": "generate_portrait_description", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI service temporarily unavailable: {e}",
        ) from None
    except Exception as e:
        logger.exception("Portrait description generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Portrait description generation failed. Please try again.",
        ) from e


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
        game_context = await GameMechanicsService.build_generation_context(
            supabase, simulation_id,
        )
        result = await service.generate_event(
            event_type=body.event_type,
            locale=body.locale,
            game_context=game_context,
        )
        return {"success": True, "data": result}
    except OpenRouterError as e:
        logger.warning("AI service unavailable", extra={"endpoint": "generate_event", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Event generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Event generation failed. Please try again.",
        ) from e


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
        agent_data = await AgentService.get(supabase, simulation_id, body.agent_id)

        # Get other agents in the simulation
        other_agents = await AgentService.list_for_relationships(
            supabase, simulation_id, body.agent_id,
        )

        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_agent_relationships(
            agent_data=agent_data,
            other_agents=other_agents,
            locale=body.locale,
        )
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except OpenRouterError as e:
        logger.warning("AI service unavailable", extra={"endpoint": "generate_relationships", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Relationship generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Relationship generation failed. Please try again.",
        ) from e


@router.post("/lore-image", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_lore_image(
    request: Request,
    simulation_id: UUID,
    body: GenerateLoreImageRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Generate a lore section image (3:2 aspect ratio, simulation style)."""
    try:
        service = await _get_image_service(simulation_id, supabase)
        url = await service.generate_lore_image(
            section_title=body.section_title,
            section_body=body.section_body,
            image_slug=body.image_slug,
            sim_slug=body.sim_slug,
            image_caption=body.image_caption,
        )
        return {"success": True, "data": {"image_url": url}}
    except OpenRouterError as e:
        logger.warning("AI service unavailable", extra={"endpoint": "generate_lore_image", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Lore image generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lore image generation failed.",
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
    """Generate an image for an agent portrait, building, or simulation banner."""
    try:
        service = await _get_image_service(simulation_id, supabase)

        extra = body.extra or {}
        description_override = extra.pop("description_override", None)

        if body.entity_type == "agent":
            url = await service.generate_agent_portrait(
                agent_id=body.entity_id,
                agent_name=body.entity_name,
                agent_data=extra or None,
                description_override=description_override,
            )
        elif body.entity_type == "banner":
            url = await service.generate_banner_image(
                sim_name=body.entity_name,
                sim_description=extra.get("description", ""),
                anchor_data=extra.get("anchor_data"),
            )
        else:
            building_type = extra.get("building_type", "residential")
            building_data = {
                "building_condition": extra.get("building_condition", ""),
                "building_style": extra.get("building_style", ""),
                "description": extra.get("description", ""),
                "special_type": extra.get("special_type", ""),
                "construction_year": extra.get("construction_year", ""),
                "population_capacity": extra.get("population_capacity", ""),
                "zone_name": extra.get("zone_name", ""),
                "embassy_id": extra.get("embassy_id", ""),
                "partner_simulation_id": extra.get("partner_simulation_id", ""),
                "special_attributes": extra.get("special_attributes"),
            }
            url = await service.generate_building_image(
                building_id=body.entity_id,
                building_name=body.entity_name,
                building_type=building_type,
                building_data=building_data,
                description_override=description_override,
            )

        return {"success": True, "data": {"image_url": url}}
    except OpenRouterError as e:
        logger.warning("AI service unavailable", extra={"endpoint": "generate_image", "error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("Image generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Image generation failed. Please try again.",
        ) from e
