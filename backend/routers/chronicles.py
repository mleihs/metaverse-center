"""Chronicle router — per-simulation AI-generated newspaper."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.chronicle import ChronicleGenerateRequest
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.chronicle_service import ChronicleService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/chronicles",
    tags=["Chronicles"],
)


@router.post("", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def generate_chronicle(
    request: Request,
    simulation_id: UUID,
    body: ChronicleGenerateRequest,
    _user=Depends(get_current_user),
    _role_check=Depends(require_role("editor")),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Generate a new chronicle edition (requires editor+)."""
    data = await ChronicleService.generate(
        admin_supabase,
        simulation_id,
        body.period_start,
        body.period_end,
        epoch_id=body.epoch_id,
        locale=body.locale,
    )
    return {"success": True, "data": data}


@router.get("", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_chronicles(
    request: Request,
    simulation_id: UUID,
    _user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List chronicle editions (paginated)."""
    data, total = await ChronicleService.list(supabase, simulation_id, limit=limit, offset=offset)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/{chronicle_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_chronicle(
    request: Request,
    simulation_id: UUID,
    chronicle_id: UUID,
    _user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single chronicle edition."""
    data = await ChronicleService.get(supabase, simulation_id, chronicle_id)
    return {"success": True, "data": data}
