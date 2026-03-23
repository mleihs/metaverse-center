"""Event echo (bleed) endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_role,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.echo import EchoCreate, EchoResponse
from backend.services.audit_service import AuditService
from backend.services.echo_service import EchoService
from backend.services.event_service import EventService
from backend.services.external.openrouter import OpenRouterError
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.generation_service import GenerationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["echoes"],
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
        supabase, simulation_id,
        openrouter_api_key=ai_config.openrouter_api_key,
    )


# --- Endpoints ---


@router.get("/echoes", response_model=PaginatedResponse[EchoResponse])
async def list_echoes(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    direction: str = Query(default="incoming", pattern="^(incoming|outgoing)$"),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List echoes for a simulation."""
    data, total = await EchoService.list_for_simulation(
        supabase, simulation_id,
        direction=direction, status_filter=status,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get(
    "/events/{event_id}/echoes",
    response_model=SuccessResponse[list[EchoResponse]],
)
async def list_event_echoes(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all echoes originating from a specific event."""
    data = await EchoService.list_for_event(supabase, event_id)
    return {"success": True, "data": data}


@router.post("/echoes", response_model=SuccessResponse[EchoResponse], status_code=201)
async def trigger_echo(
    simulation_id: UUID,
    body: EchoCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Manually trigger an echo from an event to a target simulation.

    Computes echo strength from game metrics (connection strength,
    embassy effectiveness, tag resonance, source instability) rather
    than using the raw user-provided strength directly.
    """
    # Fetch the source event (raises 404 if not found)
    event_data = await EventService.get(supabase, simulation_id, body.source_event_id)

    # Compute echo strength from game metrics
    event_tags = event_data.get("tags") or []
    computed_strength = await EchoService.compute_strength_for_manual_trigger(
        supabase,
        source_simulation_id=simulation_id,
        target_simulation_id=body.target_simulation_id,
        echo_vector=body.echo_vector,
        event_tags=event_tags,
        user_strength=body.echo_strength,
    )

    result = await EchoService.create_echo(
        admin_supabase,
        source_event=event_data,
        source_simulation_id=simulation_id,
        target_simulation_id=body.target_simulation_id,
        echo_vector=body.echo_vector,
        echo_strength=computed_strength,
        echo_depth=1,
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_echoes", result["id"], "create"
    )
    return {"success": True, "data": result}


@router.patch(
    "/echoes/{echo_id}/approve",
    response_model=SuccessResponse[EchoResponse],
)
async def approve_echo(
    simulation_id: UUID,
    echo_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Approve a pending echo — triggers AI transformation.

    1. Validates the echo is pending
    2. Creates a GenerationService for the source simulation
    3. Builds game context (simulation health, zone stability)
    4. Transforms the source event through the bleed vector lens
    5. Creates a target event in the target simulation
    6. Marks the echo as completed with the target_event_id
    """
    echo = await EchoService.get(supabase, echo_id)
    if echo["status"] != "pending":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve echo with status '{echo['status']}'.",
        )

    try:
        # Source simulation provides the AI API key
        source_sim_id = UUID(echo["source_simulation_id"])
        gen_service = await _get_generation_service(source_sim_id, supabase)

        # Build game context for narrative shaping
        game_context = await GameMechanicsService.build_generation_context(
            supabase, source_sim_id,
        )

        result = await EchoService.transform_and_complete_echo(
            admin_supabase, supabase, echo, gen_service,
            game_context=game_context,
        )

        await AuditService.log_action(
            supabase, simulation_id, user.id, "event_echoes", echo_id, "update"
        )
        return {"success": True, "data": result}

    except OpenRouterError as e:
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable. Please try again.",
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Echo approval/transformation failed for %s", echo_id)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Echo transformation failed. Please try again.",
        ) from e


@router.patch(
    "/echoes/{echo_id}/reject",
    response_model=SuccessResponse[EchoResponse],
)
async def reject_echo(
    simulation_id: UUID,
    echo_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Reject a pending echo."""
    result = await EchoService.reject_echo(admin_supabase, echo_id)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_echoes", echo_id, "update"
    )
    return {"success": True, "data": result}
