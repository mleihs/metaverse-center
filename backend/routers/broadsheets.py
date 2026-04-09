"""Broadsheet router — per-simulation aggregated newspaper editions."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.broadsheet import BroadsheetGenerateRequest
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.broadsheet_service import BroadsheetService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/broadsheets",
    tags=["Broadsheets"],
)


@router.post("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def generate_broadsheet(
    request: Request,
    simulation_id: UUID,
    body: BroadsheetGenerateRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Compile a new broadsheet edition (requires editor+)."""
    data = await BroadsheetService.compile_edition(
        admin_supabase,
        simulation_id,
        body.period_start,
        body.period_end,
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "broadsheets",
        None,
        "generate",
        details={
            "period_start": str(body.period_start),
            "period_end": str(body.period_end),
            "edition_number": data.get("edition_number"),
        },
    )
    return SuccessResponse(data=data)


@router.get("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_broadsheets(
    request: Request,
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List broadsheet editions (paginated)."""
    data, total = await BroadsheetService.list(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/latest")
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_latest_broadsheet(
    request: Request,
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get the latest broadsheet edition."""
    data = await BroadsheetService.get_latest(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/{broadsheet_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_broadsheet(
    request: Request,
    simulation_id: UUID,
    broadsheet_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get a single broadsheet edition."""
    data = await BroadsheetService.get(supabase, simulation_id, broadsheet_id)
    return SuccessResponse(data=data)
