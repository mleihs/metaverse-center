"""Simulation member management endpoints."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.member import MemberCreate, MemberResponse, MemberUpdate
from backend.services.audit_service import AuditService
from backend.services.member_service import LastOwnerError, MemberService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/members",
    tags=["members"],
)


@router.get("", response_model=SuccessResponse[list[MemberResponse]])
async def list_members(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all members of a simulation."""
    data = await MemberService.list_members(supabase, simulation_id)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[MemberResponse], status_code=201)
async def add_member(
    simulation_id: UUID,
    body: MemberCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add a member to a simulation. Requires admin role."""
    data = await MemberService.add(
        supabase,
        simulation_id,
        user_id=body.user_id,
        member_role=body.member_role,
        invited_by_id=user.id,
    )
    await AuditService.log_action(supabase, simulation_id, user.id, "simulation_members", data["id"], "create")
    return {"success": True, "data": data}


@router.put("/{member_id}", response_model=SuccessResponse[MemberResponse])
async def change_role(
    simulation_id: UUID,
    member_id: UUID,
    body: MemberUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Change a member's role. Last-owner protection enforced by DB trigger."""
    try:
        data = await MemberService.change_role(
            supabase, simulation_id, member_id, body.member_role
        )
    except LastOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot change role: this is the last owner of the simulation.",
        ) from e

    await AuditService.log_action(supabase, simulation_id, user.id, "simulation_members", member_id, "update")
    return {"success": True, "data": data}


@router.delete("/{member_id}", response_model=SuccessResponse[dict])
async def remove_member(
    simulation_id: UUID,
    member_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove a member from a simulation. Last-owner protection via DB trigger."""
    try:
        await MemberService.remove(supabase, simulation_id, member_id)
    except LastOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove the last owner of a simulation.",
        ) from e

    await AuditService.log_action(supabase, simulation_id, user.id, "simulation_members", member_id, "delete")
    return {"success": True, "data": {"message": "Member removed."}}
