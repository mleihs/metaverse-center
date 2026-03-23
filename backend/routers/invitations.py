"""Simulation invitation endpoints."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.invitation import (
    InvitationCreate,
    InvitationPublicResponse,
    InvitationResponse,
)
from backend.models.member import MemberResponse
from backend.services.invitation_service import InvitationService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invitations"])


@router.post(
    "/api/v1/simulations/{simulation_id}/invitations",
    response_model=SuccessResponse[InvitationResponse],
    status_code=201,
)
async def create_invitation(
    simulation_id: UUID,
    body: InvitationCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create an invitation to join a simulation. Requires admin role."""
    result = await InvitationService.create_invitation(
        supabase,
        simulation_id,
        user.id,
        invited_email=body.invited_email,
        invited_role=body.invited_role,
        expires_in_hours=body.expires_in_hours,
    )
    return {"success": True, "data": result}


@router.get(
    "/api/v1/simulations/{simulation_id}/invitations",
    response_model=SuccessResponse[list[InvitationResponse]],
)
async def list_invitations(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all invitations for a simulation. Requires admin role."""
    result = await InvitationService.list_invitations(supabase, simulation_id)
    return {"success": True, "data": result}


@router.get(
    "/api/v1/invitations/{token}",
    response_model=SuccessResponse[InvitationPublicResponse],
)
async def validate_invitation(
    token: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Validate an invitation token (platform-level, no simulation context)."""
    invitation = await InvitationService.get_by_token(supabase, token)

    expires_at = invitation["expires_at"]
    if isinstance(expires_at, str):
        expires_at_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    else:
        expires_at_dt = expires_at

    simulation = invitation.get("simulations", {})
    return {
        "success": True,
        "data": {
            "simulation_name": simulation.get("name", "Unknown"),
            "invited_role": invitation["invited_role"],
            "invited_email": invitation.get("invited_email"),
            "expires_at": invitation["expires_at"],
            "is_expired": expires_at_dt < datetime.now(UTC),
            "is_accepted": invitation.get("accepted_at") is not None,
        },
    }


@router.post(
    "/api/v1/invitations/{token}/accept",
    response_model=SuccessResponse[MemberResponse],
    status_code=201,
)
async def accept_invitation(
    token: str,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Accept an invitation — creates membership."""
    result = await InvitationService.accept_invitation(supabase, token, user.id)
    return {"success": True, "data": result}
