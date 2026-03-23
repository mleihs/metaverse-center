"""Epoch chat endpoints — send messages, list messages (epoch-wide + team)."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_current_user, get_supabase
from backend.middleware.rate_limit import limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.epoch_chat import EpochChatMessageCreate, EpochChatMessageResponse
from backend.services.audit_service import AuditService
from backend.services.epoch_chat_service import EpochChatService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/chat", tags=["Epoch Chat"])


async def _audit(
    supabase: Client, user_id: UUID, entity_id: str | None, action: str, details: dict | None = None,
) -> None:
    """Best-effort audit logging for epoch chat (platform-level, no simulation_id)."""
    try:
        await AuditService.log_action(
            supabase, None, user_id, "epoch_chat_messages", entity_id, action, details=details,
        )
    except Exception:
        logger.warning("Audit log failed for epoch_chat %s (non-critical)", action, exc_info=True)


@router.post("", response_model=SuccessResponse[EpochChatMessageResponse], status_code=201)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    epoch_id: UUID,
    body: EpochChatMessageCreate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Send a chat message to epoch-wide or team channel."""
    message = await EpochChatService.send_message(
        supabase,
        epoch_id,
        user.id,
        body.simulation_id,
        body.content,
        channel_type=body.channel_type,
        team_id=body.team_id,
    )
    await _audit(supabase, user.id, message["id"], "create", {
        "epoch_id": str(epoch_id),
        "channel_type": body.channel_type,
    })
    return {"success": True, "data": message}


@router.get("", response_model=PaginatedResponse[EpochChatMessageResponse])
@limiter.limit("100/minute")
async def list_messages(
    request: Request,
    epoch_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=50, ge=1, le=100),
    before: str | None = Query(default=None, description="ISO timestamp cursor for pagination"),
) -> dict:
    """List epoch-wide chat messages with cursor-based pagination."""
    messages, total = await EpochChatService.list_messages(
        supabase, epoch_id, channel_type="epoch", limit=limit, before=before,
    )
    return {
        "success": True,
        "data": messages,
        "meta": PaginationMeta(count=len(messages), total=total, limit=limit, offset=0),
    }


@router.get("/team/{team_id}", response_model=PaginatedResponse[EpochChatMessageResponse])
@limiter.limit("100/minute")
async def list_team_messages(
    request: Request,
    epoch_id: UUID,
    team_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=50, ge=1, le=100),
    before: str | None = Query(default=None, description="ISO timestamp cursor for pagination"),
) -> dict:
    """List team-only chat messages with cursor-based pagination."""
    messages, total = await EpochChatService.list_messages(
        supabase, epoch_id, channel_type="team", team_id=team_id, limit=limit, before=before,
    )
    return {
        "success": True,
        "data": messages,
        "meta": PaginationMeta(count=len(messages), total=total, limit=limit, offset=0),
    }
