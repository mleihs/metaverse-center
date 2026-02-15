"""Simulation member management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.member import MemberCreate, MemberResponse, MemberUpdate
from supabase import Client

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
    response = (
        supabase.table("simulation_members")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .order("member_role", desc=True)
        .execute()
    )
    return {"success": True, "data": response.data or []}


@router.post("", response_model=SuccessResponse[MemberResponse], status_code=201)
async def add_member(
    simulation_id: UUID,
    body: MemberCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Add a member to a simulation. Requires admin role."""
    response = (
        supabase.table("simulation_members")
        .insert({
            "simulation_id": str(simulation_id),
            "user_id": str(body.user_id),
            "member_role": body.member_role,
            "invited_by_id": str(user.id),
        })
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add member.",
        )

    return {"success": True, "data": response.data[0]}


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
        response = (
            supabase.table("simulation_members")
            .update({
                "member_role": body.member_role,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(member_id))
            .execute()
        )
    except Exception as e:
        error_msg = str(e).lower()
        if "last owner" in error_msg or "cannot remove" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot change role: this is the last owner of the simulation.",
            ) from e
        raise

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member '{member_id}' not found.",
        )

    return {"success": True, "data": response.data[0]}


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
        response = (
            supabase.table("simulation_members")
            .delete()
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(member_id))
            .execute()
        )
    except Exception as e:
        error_msg = str(e).lower()
        if "last owner" in error_msg or "cannot remove" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot remove the last owner of a simulation.",
            ) from e
        raise

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member '{member_id}' not found.",
        )

    return {"success": True, "data": {"message": "Member removed."}}
