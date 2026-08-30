"""Epoch invitation endpoints — create, list, revoke, regenerate lore."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from backend.config import settings
from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    require_epoch_creator,
)
from backend.middleware.rate_limit import limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.epoch_invitation import EpochInvitationCreate, EpochInvitationResponse
from backend.services.audit_service import AuditService
from backend.services.epoch_invitation_service import EpochInvitationService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/invitations", tags=["Epoch Invitations"])

# Accepting is the one operation the invitee performs, and they do not know the
# epoch id — the token does. It therefore cannot live under the epoch-scoped
# prefix above, which is why it is a second router rather than a second path.
token_router = APIRouter(prefix="/api/v1/epoch-invitations", tags=["Epoch Invitations"])


async def _audit(
    supabase: Client,
    user_id: UUID,
    entity_id: str | None,
    action: str,
    details: dict | None = None,
) -> None:
    """Best-effort audit logging for epoch invitations (platform-level, no simulation_id)."""
    try:
        await AuditService.safe_log(
            supabase,
            None,
            user_id,
            "epoch_invitations",
            entity_id,
            action,
            details=details,
        )
    except Exception:
        logger.warning("Audit log failed for epoch_invitations %s (non-critical)", action, exc_info=True)


@router.post("", status_code=201)
@limiter.limit("10/minute")
async def create_invitation(
    request: Request,
    epoch_id: UUID,
    body: EpochInvitationCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochInvitationResponse]:
    """Create an epoch invitation and send email."""
    # `settings.site_url`, not `request.base_url` (E16). The latter is derived
    # from the incoming request, and `FORWARDED_ALLOW_IPS` is NOT set on
    # production — so behind the proxy the scheme can come back as `http` and
    # the invitation link in the mail would be plain HTTP. A link a user is
    # asked to trust must not be assembled from a header.
    base_url = settings.site_url.rstrip("/")

    invitation = await EpochInvitationService.create_and_send(
        supabase,
        epoch_id,
        user.id,
        body.email,
        body.expires_in_hours,
        base_url,
        locale=body.locale,
    )

    await _audit(supabase, user.id, invitation["id"], "create", {"email": body.email, "epoch_id": str(epoch_id)})

    return SuccessResponse(data=invitation)


@router.get("")
async def list_invitations(
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[EpochInvitationResponse]]:
    """List all invitations for an epoch."""
    data = await EpochInvitationService.list_invitations(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.delete("/{invitation_id}")
async def revoke_invitation(
    epoch_id: UUID,
    invitation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochInvitationResponse]:
    """Revoke an epoch invitation."""
    data = await EpochInvitationService.revoke_invitation(supabase, invitation_id)

    await _audit(supabase, user.id, str(invitation_id), "update", {"status": "revoked"})

    return SuccessResponse(data=data)


@router.post("/regenerate-lore")
@limiter.limit("5/minute")
async def regenerate_lore(
    request: Request,
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _creator_check: Annotated[None, Depends(require_epoch_creator())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Regenerate the AI-generated lore for epoch invitations."""
    lore_text = await EpochInvitationService.regenerate_lore(supabase, epoch_id)
    await _audit(supabase, user.id, str(epoch_id), "regenerate_lore")
    return SuccessResponse(data={"lore_text": lore_text})


@token_router.post("/{token}/accept")
@limiter.limit("10/minute")
async def accept_invitation(
    request: Request,
    token: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[dict]:
    """Accept an epoch invitation and return the epoch it opens.

    ``EpochInvitationService.mark_accepted`` has existed since the invitation
    system was built and had **no caller** (finding E2): there was no endpoint,
    the accept view navigated to ``/epoch`` without an epoch id, the token was
    never consumed, every invitation stayed ``pending`` for ever, and whoever
    sent it never learned who came.

    Accepting does not join the epoch — joining picks a simulation and belongs
    to the lobby. This marks the token used and hands back the epoch to open.

    The admin client is required rather than convenient: migration 213 removed
    the anon SELECT policy on ``epoch_invitations``, and the invitee is not a
    member of anything yet. The token is the authorization, and the caller is
    authenticated so the acceptance can be attributed.
    """
    invitation = await EpochInvitationService.mark_accepted(admin_supabase, token, user.id)

    await _audit(
        admin_supabase,
        user.id,
        invitation["id"],
        "accept",
        {"epoch_id": str(invitation["epoch_id"])},
    )

    return SuccessResponse(data={"epoch_id": str(invitation["epoch_id"])})
