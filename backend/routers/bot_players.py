"""Bot player preset CRUD endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_supabase
from backend.models.bot import BotPlayerCreate, BotPlayerResponse, BotPlayerUpdate
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.bot_player_service import BotPlayerService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bot-players", tags=["bot-players"])


@router.get("", response_model=PaginatedResponse[BotPlayerResponse])
async def list_bot_players(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> dict:
    """List the current user's bot player presets."""
    data, total = await BotPlayerService.list_for_user(supabase, user.id)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=100, offset=0),
    }


@router.get("/{bot_id}", response_model=SuccessResponse[BotPlayerResponse])
async def get_bot_player(
    bot_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> dict:
    """Get a single bot player preset."""
    data = await BotPlayerService.get(supabase, bot_id)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[BotPlayerResponse], status_code=201)
async def create_bot_player(
    body: BotPlayerCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> dict:
    """Create a new bot player preset."""
    data = await BotPlayerService.create(supabase, user.id, {
        "name": body.name,
        "personality": body.personality,
        "difficulty": body.difficulty,
        "config": body.config,
    })
    await AuditService.safe_log(
        supabase, None, user.id, "bot_players", data.get("id"), "create",
        details={"name": body.name},
    )
    return {"success": True, "data": data}


@router.patch("/{bot_id}", response_model=SuccessResponse[BotPlayerResponse])
async def update_bot_player(
    bot_id: UUID,
    body: BotPlayerUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> dict:
    """Update a bot player preset (own bots only)."""
    data = await BotPlayerService.update(supabase, bot_id, user.id, body.model_dump(exclude_none=True))
    await AuditService.safe_log(
        supabase, None, user.id, "bot_players", bot_id, "update",
    )
    return {"success": True, "data": data}


@router.delete("/{bot_id}")
async def delete_bot_player(
    bot_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a bot player preset (own bots only)."""
    await BotPlayerService.delete(supabase, bot_id, user.id)
    await AuditService.safe_log(
        supabase, None, user.id, "bot_players", bot_id, "delete",
    )
    return SuccessResponse(data=MessageResponse(message="Bot player deleted."))
