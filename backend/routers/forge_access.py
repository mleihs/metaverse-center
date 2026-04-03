"""Router for forge access (clearance) request system."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_platform_admin,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.forge_access import (
    ForgeAccessRequestCreate,
    ForgeAccessRequestResponse,
    ForgeAccessRequestWithEmail,
    ForgeAccessReviewRequest,
    ForgeAccessReviewResponse,
)
from backend.services.audit_service import AuditService
from backend.services.forge_access_service import ForgeAccessService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/forge/access-requests",
    tags=["forge-access"],
)


@router.post("")
async def create_access_request(
    body: ForgeAccessRequestCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ForgeAccessRequestResponse]:
    """Submit a clearance upgrade request."""
    data = await ForgeAccessService.create_request(
        supabase, user.id, body.message, user_email=user.email,
    )
    await AuditService.safe_log(
        supabase, None, user.id,
        "forge_access_request", data.get("id"), "create",
    )
    return SuccessResponse(data=data)


@router.get("/me")
async def get_my_access_request(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[ForgeAccessRequestResponse | None]:
    """Get the current user's latest clearance request."""
    data = await ForgeAccessService.get_user_status(supabase, user.id)
    return SuccessResponse(data=data)


@router.get("/pending")
async def list_pending_requests(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[list[ForgeAccessRequestWithEmail]]:
    """List all pending clearance requests (admin only)."""
    data = await ForgeAccessService.list_pending(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/pending/count")
async def get_pending_count(
    _admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[int]:
    """Get count of pending clearance requests (admin only)."""
    count = await ForgeAccessService.get_pending_count(admin_supabase)
    return SuccessResponse(data=count)


@router.post("/{request_id}/review")
async def review_access_request(
    request_id: UUID,
    body: ForgeAccessReviewRequest,
    admin: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ForgeAccessReviewResponse]:
    """Approve or reject a clearance request (admin only)."""
    result = await ForgeAccessService.review(
        admin_supabase, request_id, body.action, body.admin_notes, admin.id,
    )
    await AuditService.safe_log(
        admin_supabase, None, admin.id,
        "forge_access_request", str(request_id), body.action,
        details={"admin_notes": body.admin_notes},
    )
    return SuccessResponse(data=result)
