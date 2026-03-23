"""Agent autonomy read endpoints -- mood, needs, opinions, activities.

All data is publicly readable (public-first architecture).
Write operations are handled by the heartbeat tick pipeline, not this router.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.agent_autonomy import (
    AgentActivityResponse,
    AgentMoodResponse,
    AgentNeedsResponse,
    AgentOpinionResponse,
    MoodletResponse,
    MorningBriefingData,
    OpinionModifierResponse,
    SimulationMoodSummary,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.agent_activity_service import AgentActivityService
from backend.services.agent_mood_service import AgentMoodService
from backend.services.agent_needs_service import AgentNeedsService
from backend.services.agent_opinion_service import AgentOpinionService
from backend.services.morning_briefing_service import MorningBriefingService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["agent-autonomy"],
)


# -- Mood -----------------------------------------------------------------------


@router.get(
    "/agents/{agent_id}/mood",
    response_model=SuccessResponse[AgentMoodResponse | None],
)
async def get_agent_mood(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get the current emotional state of an agent."""
    data = await AgentMoodService.get_agent_mood(supabase, agent_id, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/agents/{agent_id}/moodlets",
    response_model=SuccessResponse[list[MoodletResponse]],
)
async def list_agent_moodlets(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all active moodlets for an agent."""
    data = await AgentMoodService.list_moodlets(supabase, agent_id, simulation_id)
    return {"success": True, "data": data}


# -- Needs -----------------------------------------------------------------------


@router.get(
    "/agents/{agent_id}/needs",
    response_model=SuccessResponse[AgentNeedsResponse | None],
)
async def get_agent_needs(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get the current need levels of an agent."""
    data = await AgentNeedsService.get_agent_needs(supabase, agent_id, simulation_id)
    return {"success": True, "data": data}


# -- Opinions --------------------------------------------------------------------


@router.get(
    "/agents/{agent_id}/opinions",
    response_model=SuccessResponse[list[AgentOpinionResponse]],
)
async def list_agent_opinions(
    simulation_id: UUID,
    agent_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all opinions this agent holds about other agents."""
    data = await AgentOpinionService.list_opinions(supabase, agent_id, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/agents/{agent_id}/opinion-modifiers",
    response_model=SuccessResponse[list[OpinionModifierResponse]],
)
async def list_agent_opinion_modifiers(
    simulation_id: UUID,
    agent_id: UUID,
    target_agent_id: UUID | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List active opinion modifiers for an agent, optionally filtered by target."""
    data = await AgentOpinionService.list_modifiers(
        supabase, agent_id, simulation_id, target_agent_id,
    )
    return {"success": True, "data": data}


# -- Activities ------------------------------------------------------------------


@router.get(
    "/activities",
    response_model=PaginatedResponse[AgentActivityResponse],
)
async def list_activities(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    agent_id: UUID | None = Query(default=None),
    activity_type: str | None = Query(default=None),
    min_significance: int = Query(default=1, ge=1, le=10),
    since_hours: int = Query(default=24, ge=1, le=168),
) -> dict:
    """List autonomous activities for a simulation with filters."""
    since = datetime.now(UTC) - timedelta(hours=since_hours)
    data, total = await AgentActivityService.list_activities(
        supabase, simulation_id,
        agent_id=agent_id, activity_type=activity_type,
        min_significance=min_significance, since=since,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# -- Simulation-Level Summaries --------------------------------------------------


@router.get(
    "/mood-summary",
    response_model=SuccessResponse[SimulationMoodSummary],
)
async def get_simulation_mood_summary(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get aggregate mood/stress state for all agents in a simulation."""
    summary = await MorningBriefingService._compute_mood_summary(
        supabase, simulation_id,
    )
    return {"success": True, "data": summary}


# -- Morning Briefing ------------------------------------------------------------


@router.get(
    "/briefing",
    response_model=SuccessResponse[MorningBriefingData],
)
async def get_morning_briefing(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    since_hours: int = Query(default=24, ge=1, le=168),
    mode: str = Query(default="narrative", pattern=r"^(narrative|data)$"),
) -> dict:
    """Generate a morning briefing with prioritized activity summary."""
    since = datetime.now(UTC) - timedelta(hours=since_hours)
    briefing = await MorningBriefingService.generate(
        supabase, simulation_id, since, mode=mode,
    )
    return {"success": True, "data": briefing}
