"""Achievement/badge endpoints — read-only access to badge catalog and user progress.

All badge awards happen via PostgreSQL triggers (migration 190). These endpoints
provide query access for the frontend badge grid, dashboard summary, and progress
tracking. No write endpoints exist — badges are system-awarded, never user-claimed.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user, get_effective_supabase
from backend.models.achievement import (
    AchievementDefinitionResponse,
    AchievementProgressResponse,
    AchievementSummaryResponse,
    UserAchievementResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.achievement_service import AchievementService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["achievements"])


@router.get("/achievements/definitions")
async def list_definitions(
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[AchievementDefinitionResponse]]:
    """List all active achievement definitions (public catalog).

    Secret achievements are included with ``is_secret=True`` — the frontend
    redacts name/description for locked secret badges.
    """
    definitions = await AchievementService.list_definitions(supabase)
    return SuccessResponse(data=definitions)


@router.get("/users/me/achievements")
async def list_user_achievements(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[UserAchievementResponse]]:
    """List all earned achievements for the authenticated user.

    Includes joined achievement definitions for display. Ordered by
    ``earned_at`` descending (most recent first).
    """
    achievements = await AchievementService.list_for_user(supabase, str(user.id))
    return SuccessResponse(data=achievements)


@router.get("/users/me/achievements/progress")
async def get_progress(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[AchievementProgressResponse]]:
    """Get progress toward all in-flight threshold achievements.

    Only returns entries where ``current_count < target_count``.
    """
    progress = await AchievementService.get_progress(supabase, str(user.id))
    return SuccessResponse(data=progress)


@router.get("/users/me/achievements/summary")
async def get_summary(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AchievementSummaryResponse]:
    """Aggregated achievement stats for dashboard display.

    Returns total available, total earned, breakdown by rarity tier,
    and the 3 most recent unlocks.
    """
    summary = await AchievementService.get_summary(supabase, str(user.id))
    return SuccessResponse(data=summary)
