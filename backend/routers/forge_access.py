"""Router for forge access (clearance) request system."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

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
)
from backend.services.audit_service import AuditService
from backend.services.forge_access_service import ForgeAccessService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/forge/access-requests",
    tags=["forge-access"],
)


@router.post("", response_model=SuccessResponse[ForgeAccessRequestResponse])
async def create_access_request(
    body: ForgeAccessRequestCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Submit a clearance upgrade request."""
    data = await ForgeAccessService.create_request(
        supabase, user.id, body.message, user_email=user.email,
    )
    await AuditService.safe_log(
        supabase, None, user.id,
        "forge_access_request", data.get("id"), "create",
    )
    return {"success": True, "data": data}


@router.get("/me", response_model=SuccessResponse[ForgeAccessRequestResponse | None])
async def get_my_access_request(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Get the current user's latest clearance request."""
    data = await ForgeAccessService.get_user_status(supabase, user.id)
    return {"success": True, "data": data}


@router.get("/pending", response_model=SuccessResponse[list[ForgeAccessRequestWithEmail]])
async def list_pending_requests(
    _admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
):
    """List all pending clearance requests (admin only)."""
    data = await ForgeAccessService.list_pending(admin_supabase)
    return {"success": True, "data": data}


@router.get("/pending/count", response_model=SuccessResponse[int])
async def get_pending_count(
    _admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
):
    """Get count of pending clearance requests (admin only)."""
    count = await ForgeAccessService.get_pending_count(admin_supabase)
    return {"success": True, "data": count}


@router.post("/{request_id}/review", response_model=SuccessResponse[dict])
async def review_access_request(
    request_id: UUID,
    body: ForgeAccessReviewRequest,
    admin: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
):
    """Approve or reject a clearance request (admin only)."""
    result = await ForgeAccessService.review(
        admin_supabase, request_id, body.action, body.admin_notes, admin.id,
    )
    await AuditService.safe_log(
        admin_supabase, None, admin.id,
        "forge_access_request", str(request_id), body.action,
        details={"admin_notes": body.admin_notes},
    )
    return {"success": True, "data": result}
