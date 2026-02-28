"""Epoch invitation endpoints — create, list, revoke, regenerate lore."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from backend.dependencies import get_current_user, get_supabase, require_epoch_creator
from backend.middleware.rate_limit import limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.epoch_invitation import EpochInvitationCreate, EpochInvitationResponse
from backend.services.audit_service import AuditService
from backend.services.epoch_invitation_service import EpochInvitationService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/invitations", tags=["Epoch Invitations"])


async def _audit(
    supabase: Client, user_id: UUID, entity_id: str | None, action: str, details: dict | None = None,
) -> None:
    """Best-effort audit logging for epoch invitations (platform-level, no simulation_id)."""
    try:
        await AuditService.log_action(
            supabase, None, user_id, "epoch_invitations", entity_id, action, details=details,
        )
    except Exception:
        logger.warning("Audit log failed for epoch_invitations %s (non-critical)", action, exc_info=True)


@router.post("", response_model=SuccessResponse[EpochInvitationResponse], status_code=201)
@limiter.limit("10/minute")
async def create_invitation(
    request: Request,
    epoch_id: UUID,
    body: EpochInvitationCreate,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create an epoch invitation and send email."""
    base_url = str(request.base_url).rstrip("/")

    invitation = await EpochInvitationService.create_and_send(
        supabase, epoch_id, user.id, body.email, body.expires_in_hours, base_url,
    )

    await _audit(supabase, user.id, invitation["id"], "create", {"email": body.email, "epoch_id": str(epoch_id)})

    return {"success": True, "data": invitation}


@router.get("", response_model=SuccessResponse[list[EpochInvitationResponse]])
async def list_invitations(
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all invitations for an epoch."""
    data = await EpochInvitationService.list_invitations(supabase, epoch_id)
    return {"success": True, "data": data}


@router.delete("/{invitation_id}", response_model=SuccessResponse)
async def revoke_invitation(
    epoch_id: UUID,
    invitation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Revoke an epoch invitation."""
    data = await EpochInvitationService.revoke_invitation(supabase, invitation_id)

    await _audit(supabase, user.id, str(invitation_id), "update", {"status": "revoked"})

    return {"success": True, "data": data}


@router.post("/regenerate-lore", response_model=SuccessResponse)
@limiter.limit("5/minute")
async def regenerate_lore(
    request: Request,
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _creator_check: None = Depends(require_epoch_creator()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Regenerate the AI-generated lore for epoch invitations."""
    lore_text = await EpochInvitationService.regenerate_lore(supabase, epoch_id)
    return {"success": True, "data": {"lore_text": lore_text}}
