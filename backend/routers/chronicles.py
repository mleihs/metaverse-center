"""Chronicle router — per-simulation AI-generated newspaper."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.chronicle import ChronicleGenerateRequest
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.chronicle_service import ChronicleService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/chronicles",
    tags=["Chronicles"],
)


@router.post("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def generate_chronicle(
    request: Request,
    simulation_id: UUID,
    body: ChronicleGenerateRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Generate a new chronicle edition (requires editor+)."""
    data = await ChronicleService.generate(
        admin_supabase,
        simulation_id,
        body.period_start,
        body.period_end,
        epoch_id=body.epoch_id,
        locale=body.locale,
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "chronicles",
        None,
        "generate",
        details={
            "period_start": str(body.period_start),
            "period_end": str(body.period_end),
            "epoch_id": str(body.epoch_id) if body.epoch_id else None,
            "locale": body.locale,
        },
    )
    return SuccessResponse(data=data)


@router.get("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_chronicles(
    request: Request,
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List chronicle editions (paginated)."""
    data, total = await ChronicleService.list(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/{chronicle_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_chronicle(
    request: Request,
    simulation_id: UUID,
    chronicle_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get a single chronicle edition."""
    data = await ChronicleService.get(supabase, simulation_id, chronicle_id)
    return SuccessResponse(data=data)
