"""API router for the Simulation Forge."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_architect,
    require_platform_admin,
)
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.forge import ForgeDraft, ForgeDraftCreate, ForgeDraftUpdate, UpdateBYOKRequest
from backend.services.audit_service import AuditService
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_orchestrator_service import ForgeOrchestratorService
from backend.services.simulation_service import SimulationService

logger = logging.getLogger(__name__)

# Valid phase transitions: current_phase -> allowed next phases
_VALID_PHASE_TRANSITIONS: dict[str, set[str]] = {
    "astrolabe": {"drafting"},
    "drafting": {"darkroom", "astrolabe"},
    "darkroom": {"ignition", "drafting"},
    "ignition": {"completed", "failed", "darkroom"},
    "completed": set(),
    "failed": {"astrolabe"},
}

router = APIRouter(prefix="/api/v1/forge", tags=["forge"])

_draft_service = ForgeDraftService()
_orchestrator_service = ForgeOrchestratorService()


@router.get("/drafts", response_model=PaginatedResponse[ForgeDraft])
async def list_drafts(
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """List simulation forge drafts for the current user."""
    data, total = await _draft_service.list_drafts(supabase, user.id, limit, offset)
    return {
        "success": True,
        "data": data,
        "meta": {"count": len(data), "total": total, "limit": limit, "offset": offset},
    }


@router.post("/drafts", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_STANDARD)
async def create_draft(
    request: Request,
    body: ForgeDraftCreate,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Initialize a new worldbuilding draft."""
    draft = await _draft_service.create_draft(supabase, user.id, body)
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", draft.get("id"), "create",
        {"seed_prompt": body.seed_prompt[:100]},
    )
    return {"success": True, "data": draft}


@router.get("/drafts/{draft_id}", response_model=SuccessResponse[dict])
async def get_draft(
    draft_id: UUID,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Get draft details."""
    draft = await _draft_service.get_draft(supabase, user.id, draft_id)
    return {"success": True, "data": draft}


@router.patch("/drafts/{draft_id}", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_draft(
    request: Request,
    draft_id: UUID,
    body: ForgeDraftUpdate,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Update draft state."""
    # Validate phase transitions
    if body.current_phase is not None:
        current = await _draft_service.get_draft(supabase, user.id, draft_id)
        current_phase = current.get("current_phase", "astrolabe")
        allowed = _VALID_PHASE_TRANSITIONS.get(current_phase, set())
        if body.current_phase not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transition from '{current_phase}' to '{body.current_phase}'.",
            )

    # Prevent clients from setting status to "completed" directly
    if body.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status 'completed' can only be set by the ignition process.",
        )

    draft = await _draft_service.update_draft(supabase, user.id, draft_id, body)
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", str(draft_id), "update",
        {"fields": [k for k, v in body.model_dump(exclude_none=True).items()]},
    )
    return {"success": True, "data": draft}


@router.delete("/drafts/{draft_id}", response_model=SuccessResponse[dict])
async def delete_draft(
    draft_id: UUID,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Delete a draft."""
    await _draft_service.delete_draft(supabase, user.id, draft_id)
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", str(draft_id), "delete",
    )
    return {"success": True, "data": {"message": "Draft deleted."}}


@router.post("/drafts/{draft_id}/research", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def run_research(
    request: Request,
    draft_id: UUID,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Trigger the Astrolabe AI research phase."""
    result = await _orchestrator_service.run_astrolabe_research(
        supabase, user.id, draft_id
    )
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", str(draft_id), "research",
    )
    return {"success": True, "data": result}


@router.post("/drafts/{draft_id}/generate/{chunk_type}", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_chunk(
    request: Request,
    draft_id: UUID,
    chunk_type: Literal["geography", "agents", "buildings"],
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Trigger generation of a specific lore chunk (agents, buildings, etc)."""
    result = await _orchestrator_service.generate_blueprint_chunk(
        supabase, user.id, draft_id, chunk_type
    )
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", str(draft_id), "generate",
        {"chunk_type": chunk_type},
    )
    return {"success": True, "data": result}


@router.post("/drafts/{draft_id}/generate-theme", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_theme(
    request: Request,
    draft_id: UUID,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Generate an AI theme for a draft (Darkroom phase)."""
    theme_data = await _orchestrator_service.generate_theme_for_draft(
        supabase, user.id, draft_id
    )
    await AuditService.safe_log(
        supabase, None, user.id, "forge_draft", str(draft_id), "generate_theme",
    )
    return {"success": True, "data": theme_data}


@router.post("/drafts/{draft_id}/ignite", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def ignite_shard(
    request: Request,
    draft_id: UUID,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
    admin_supabase=Depends(get_admin_supabase),
):
    """Finalize the draft and materialize the simulation."""
    result = await _orchestrator_service.materialize_shard(supabase, user.id, draft_id, admin_supabase)

    sim_id = result.get("simulation_id")
    await AuditService.safe_log(
        supabase, sim_id, user.id, "forge_draft", str(draft_id), "ignite",
        {"simulation_id": str(sim_id)} if sim_id else None,
    )

    # Background: lore generation + translations + image generation
    # Uses admin client (user JWT may expire during long-running tasks)
    if sim_id:
        background_tasks.add_task(
            _orchestrator_service.run_batch_generation,
            admin_supabase,
            sim_id,
            user.id,
            anchor_data=result.get("anchor"),
            draft_data=result.get("draft_data"),
        )

    # Strip internal fields from the client response
    response_data = {k: v for k, v in result.items() if k != "draft_data"}
    return {"success": True, "data": response_data}


@router.get("/wallet", response_model=SuccessResponse[dict])
async def get_wallet(
    user: CurrentUser = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Get the current user's forge wallet."""
    data = await _draft_service.get_wallet(supabase, user.id)
    return {"success": True, "data": data}


@router.put("/wallet/keys", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_byok(
    request: Request,
    body: UpdateBYOKRequest,
    user: CurrentUser = Depends(require_architect()),
    supabase=Depends(get_supabase),
):
    """Update personal API keys (BYOK) for the Simulation Forge."""
    result = await _draft_service.update_user_keys(
        supabase, user.id, body.openrouter_key, body.replicate_key
    )
    await AuditService.safe_log(
        supabase, None, user.id, "forge_wallet", str(user.id), "update_keys",
        {"openrouter": body.openrouter_key is not None, "replicate": body.replicate_key is not None},
    )
    return {"success": True, "data": result}


# --- Admin Endpoints ---


@router.get("/admin/stats", response_model=SuccessResponse[dict])
async def get_forge_stats(
    _admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase=Depends(get_admin_supabase),
):
    """Get global forge statistics (admin only)."""
    data = await _draft_service.get_admin_stats(admin_supabase)
    return {"success": True, "data": data}


@router.delete("/admin/purge", response_model=SuccessResponse[dict])
async def purge_stale_drafts(
    days: int = Query(30, ge=1, le=365),
    _admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase=Depends(get_admin_supabase),
):
    """Purge stale drafts older than N days (admin only)."""
    cutoff = (datetime.now(tz=UTC) - timedelta(days=days)).isoformat()
    deleted_count = await _draft_service.purge_stale_drafts(admin_supabase, cutoff)
    logger.info("Purged stale forge drafts", extra={"deleted_count": deleted_count, "min_age_days": days})
    await AuditService.safe_log(
        admin_supabase, None, _admin.id, "forge_draft", None, "purge",
        {"days": days, "deleted_count": deleted_count},
    )
    return {"success": True, "data": {"deleted_count": deleted_count}}


@router.post("/admin/regenerate-images/{simulation_id}", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def regenerate_images(
    request: Request,
    simulation_id: UUID,
    background_tasks: BackgroundTasks,
    admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase=Depends(get_admin_supabase),
):
    """Trigger batch image generation for an existing simulation (admin only)."""
    # Verify simulation exists (raises 404 if not found)
    sim = await SimulationService.check_exists(admin_supabase, simulation_id)

    background_tasks.add_task(
        _orchestrator_service.run_batch_generation,
        admin_supabase,
        simulation_id,
        admin.id,
    )

    await AuditService.safe_log(
        admin_supabase, str(simulation_id), admin.id, "simulation", str(simulation_id),
        "regenerate_images", {"simulation_name": sim["name"]},
    )

    return {"success": True, "data": {"message": f"Image generation started for '{sim['name']}'."}}
