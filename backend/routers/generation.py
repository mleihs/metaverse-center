"""AI generation endpoints — rate-limited."""

import logging
from typing import Annotated
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.generation import (
    GenerateAgentRequest,
    GenerateBuildingRequest,
    GenerateEventRequest,
    GenerateImageRequest,
    GenerateLoreImageRequest,
    GeneratePortraitRequest,
    GenerateRelationshipsRequest,
    ImageGenerationResponse,
    PortraitDescriptionResponse,
)
from backend.services.agent_service import AgentService
from backend.services.audit_service import AuditService
from backend.services.external.openrouter import OpenRouterError
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.forge_image_service import ForgeImageService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.generation_service import GenerationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/generate",
    tags=["generation"],
)


# --- Helpers ---


async def _get_generation_service(
    simulation_id: UUID,
    supabase: Client,
) -> GenerationService:
    """Create a GenerationService with per-simulation API keys."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    return GenerationService(
        supabase,
        simulation_id,
        openrouter_api_key=ai_config.openrouter_api_key,
    )


async def _get_image_service(
    simulation_id: UUID,
    supabase: Client,
) -> ForgeImageService:
    """Create a ForgeImageService with per-simulation API keys."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()
    return ForgeImageService(
        supabase,
        simulation_id,
        replicate_api_key=ai_config.replicate_api_key,
        openrouter_api_key=ai_config.openrouter_api_key,
    )


# --- Endpoints ---


@router.post("/agent")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_agent(
    request: Request,
    simulation_id: UUID,
    body: GenerateAgentRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Generate an agent description using AI."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_agent_full(
            agent_name=body.name,
            agent_system=body.system,
            agent_gender=body.gender,
            locale=body.locale,
        )
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            None,
            "generate_agent",
            details={"agent_name": body.name, "locale": body.locale},
        )
        return SuccessResponse(data=result)
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_agent",
                "error": str(e),
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_agent")
            scope.set_context("generation", {"simulation_id": str(simulation_id), "agent_name": body.name})
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Agent generation failed",
            extra={
                "endpoint": "generate_agent",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_agent")
            scope.set_context("generation", {"simulation_id": str(simulation_id), "agent_name": body.name})
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent generation failed. Please try again.",
        ) from e


@router.post("/building")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_building(
    request: Request,
    simulation_id: UUID,
    body: GenerateBuildingRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
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
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            None,
            "generate_building",
            details={"building_type": body.building_type, "building_name": body.name, "locale": body.locale},
        )
        return SuccessResponse(data=result)
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_building",
                "error": str(e),
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_building")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "building_type": body.building_type,
                    "building_name": body.name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Building generation failed",
            extra={
                "endpoint": "generate_building",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_building")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "building_type": body.building_type,
                    "building_name": body.name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Building generation failed. Please try again.",
        ) from e


@router.post("/portrait-description")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_portrait_description(
    request: Request,
    simulation_id: UUID,
    body: GeneratePortraitRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[PortraitDescriptionResponse]:
    """Generate a portrait description for image generation."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        description = await service.generate_portrait_description(
            agent_name=body.agent_name,
            agent_data=body.agent_data,
        )
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            body.agent_id,
            "generate_portrait_description",
            details={"agent_name": body.agent_name},
        )
        return SuccessResponse(data=PortraitDescriptionResponse(description=description))
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_portrait_description",
                "error": str(e),
                "simulation_id": str(simulation_id),
                "agent_name": body.agent_name,
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_portrait_description")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "agent_name": body.agent_name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Portrait description generation failed",
            extra={
                "endpoint": "generate_portrait_description",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_portrait_description")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "agent_name": body.agent_name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Portrait description generation failed. Please try again.",
        ) from e


@router.post("/event")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_event(
    request: Request,
    simulation_id: UUID,
    body: GenerateEventRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Generate an event description using AI."""
    try:
        service = await _get_generation_service(simulation_id, supabase)
        game_context = await GameMechanicsService.build_generation_context(
            supabase,
            simulation_id,
        )
        result = await service.generate_event(
            event_type=body.event_type,
            locale=body.locale,
            game_context=game_context,
        )
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            None,
            "generate_event",
            details={"event_type": body.event_type, "locale": body.locale},
        )
        return SuccessResponse(data=result)
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_event",
                "error": str(e),
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_event")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "event_type": body.event_type,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Event generation failed",
            extra={
                "endpoint": "generate_event",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_event")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "event_type": body.event_type,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Event generation failed. Please try again.",
        ) from e


@router.post("/relationships")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_relationships(
    request: Request,
    simulation_id: UUID,
    body: GenerateRelationshipsRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[dict]]:
    """Generate relationship suggestions for an agent using AI."""
    try:
        # Get agent data
        agent_data = await AgentService.get(supabase, simulation_id, body.agent_id)

        # Get other agents in the simulation
        other_agents = await AgentService.list_for_relationships(
            supabase,
            simulation_id,
            body.agent_id,
        )

        service = await _get_generation_service(simulation_id, supabase)
        result = await service.generate_agent_relationships(
            agent_data=agent_data,
            other_agents=other_agents,
            locale=body.locale,
        )
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            body.agent_id,
            "generate_relationships",
            details={"agent_id": str(body.agent_id), "locale": body.locale},
        )
        return SuccessResponse(data=result)
    except HTTPException:
        raise
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_relationships",
                "error": str(e),
                "simulation_id": str(simulation_id),
                "agent_id": str(body.agent_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_relationships")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "agent_id": str(body.agent_id),
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Relationship generation failed",
            extra={
                "endpoint": "generate_relationships",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_relationships")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "agent_id": str(body.agent_id),
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Relationship generation failed. Please try again.",
        ) from e


@router.post("/lore-image")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_lore_image(
    request: Request,
    simulation_id: UUID,
    body: GenerateLoreImageRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ImageGenerationResponse]:
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
        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            None,
            "generate_lore_image",
            details={"section_title": body.section_title, "image_slug": body.image_slug},
        )
        return SuccessResponse(data=ImageGenerationResponse(image_url=url))
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_lore_image",
                "error": str(e),
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_lore_image")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "section_title": body.section_title,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Lore image generation failed",
            extra={
                "endpoint": "generate_lore_image",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_lore_image")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "section_title": body.section_title,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lore image generation failed.",
        ) from e


@router.post("/image")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_image(
    request: Request,
    simulation_id: UUID,
    body: GenerateImageRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ImageGenerationResponse]:
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

        await AuditService.safe_log(
            supabase,
            simulation_id,
            user.id,
            "generation",
            body.entity_id,
            "generate_image",
            details={"entity_type": body.entity_type, "entity_name": body.entity_name},
        )
        return SuccessResponse(data=ImageGenerationResponse(image_url=url))
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={
                "endpoint": "generate_image",
                "error": str(e),
                "simulation_id": str(simulation_id),
                "entity_type": body.entity_type,
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_image")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "entity_type": body.entity_type,
                    "entity_name": body.entity_name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception(
            "Image generation failed",
            extra={
                "endpoint": "generate_image",
                "simulation_id": str(simulation_id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", "generate_image")
            scope.set_context(
                "generation",
                {
                    "simulation_id": str(simulation_id),
                    "entity_type": body.entity_type,
                    "entity_name": body.entity_name,
                },
            )
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image generation failed. Please try again.",
        ) from e
