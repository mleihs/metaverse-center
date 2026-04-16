"""Epoch chat endpoints — send messages, list messages (epoch-wide + team)."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_current_user, get_effective_supabase
from backend.middleware.rate_limit import limiter
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.epoch_chat import EpochChatMessageCreate, EpochChatMessageResponse
from backend.services.audit_service import AuditService
from backend.services.epoch_chat_service import EpochChatService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/epochs/{epoch_id}/chat", tags=["Epoch Chat"])


async def _audit(
    supabase: Client,
    user_id: UUID,
    entity_id: str | None,
    action: str,
    details: dict | None = None,
) -> None:
    """Best-effort audit logging for epoch chat (platform-level, no simulation_id)."""
    try:
        await AuditService.safe_log(
            supabase,
            None,
            user_id,
            "epoch_chat_messages",
            entity_id,
            action,
            details=details,
        )
    except Exception:
        logger.warning("Audit log failed for epoch_chat %s (non-critical)", action, exc_info=True)


@router.post("", status_code=201)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    epoch_id: UUID,
    body: EpochChatMessageCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[EpochChatMessageResponse]:
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
    await _audit(
        supabase,
        user.id,
        message["id"],
        "create",
        {
            "epoch_id": str(epoch_id),
            "channel_type": body.channel_type,
        },
    )
    return SuccessResponse(data=message)


@router.get("")
@limiter.limit("100/minute")
async def list_messages(
    request: Request,
    epoch_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before: Annotated[str | None, Query(description="ISO timestamp cursor for pagination")] = None,
) -> PaginatedResponse[EpochChatMessageResponse]:
    """List epoch-wide chat messages with cursor-based pagination."""
    messages, total = await EpochChatService.list_messages(
        supabase,
        epoch_id,
        channel_type="epoch",
        limit=limit,
        before=before,
    )
    return paginated(messages, total, limit, 0)


@router.get("/team/{team_id}")
@limiter.limit("100/minute")
async def list_team_messages(
    request: Request,
    epoch_id: UUID,
    team_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before: Annotated[str | None, Query(description="ISO timestamp cursor for pagination")] = None,
) -> PaginatedResponse[EpochChatMessageResponse]:
    """List team-only chat messages with cursor-based pagination."""
    messages, total = await EpochChatService.list_messages(
        supabase,
        epoch_id,
        channel_type="team",
        team_id=team_id,
        limit=limit,
        before=before,
    )
    return paginated(messages, total, limit, 0)
