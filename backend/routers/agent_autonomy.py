"""Agent autonomy read endpoints -- mood, needs, opinions, activities.

All data is publicly readable (public-first architecture).
Write operations are handled by the heartbeat tick pipeline, not this router.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_effective_supabase, require_role
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
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.services.agent_activity_service import AgentActivityService
from backend.services.agent_mood_service import AgentMoodService
from backend.services.agent_needs_service import AgentNeedsService
from backend.services.agent_opinion_service import AgentOpinionService
from backend.services.morning_briefing_service import MorningBriefingService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["agent-autonomy"],
)


# -- Mood -----------------------------------------------------------------------


@router.get("/agents/{agent_id}/mood")
async def get_agent_mood(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AgentMoodResponse | None]:
    """Get the current emotional state of an agent."""
    data = await AgentMoodService.get_agent_mood(supabase, agent_id, simulation_id)
    return SuccessResponse(data=data)


@router.get("/agents/{agent_id}/moodlets")
async def list_agent_moodlets(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[MoodletResponse]]:
    """List all active moodlets for an agent."""
    data = await AgentMoodService.list_moodlets(supabase, agent_id, simulation_id)
    return SuccessResponse(data=data)


# -- Needs -----------------------------------------------------------------------


@router.get("/agents/{agent_id}/needs")
async def get_agent_needs(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[AgentNeedsResponse | None]:
    """Get the current need levels of an agent."""
    data = await AgentNeedsService.get_agent_needs(supabase, agent_id, simulation_id)
    return SuccessResponse(data=data)


# -- Opinions --------------------------------------------------------------------


@router.get("/agents/{agent_id}/opinions")
async def list_agent_opinions(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[AgentOpinionResponse]]:
    """List all opinions this agent holds about other agents."""
    data = await AgentOpinionService.list_opinions(supabase, agent_id, simulation_id)
    return SuccessResponse(data=data)


@router.get("/agents/{agent_id}/opinion-modifiers")
async def list_agent_opinion_modifiers(
    simulation_id: UUID,
    agent_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    target_agent_id: Annotated[UUID | None, Query()] = None,
) -> SuccessResponse[list[OpinionModifierResponse]]:
    """List active opinion modifiers for an agent, optionally filtered by target."""
    data = await AgentOpinionService.list_modifiers(
        supabase,
        agent_id,
        simulation_id,
        target_agent_id,
    )
    return SuccessResponse(data=data)


# -- Activities ------------------------------------------------------------------


@router.get("/activities")
async def list_activities(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    agent_id: Annotated[UUID | None, Query()] = None,
    activity_type: Annotated[str | None, Query()] = None,
    min_significance: Annotated[int, Query(ge=1, le=10)] = 1,
    since_hours: Annotated[int, Query(ge=1, le=168)] = 24,
) -> PaginatedResponse[AgentActivityResponse]:
    """List autonomous activities for a simulation with filters."""
    since = datetime.now(UTC) - timedelta(hours=since_hours)
    data, total = await AgentActivityService.list_activities(
        supabase,
        simulation_id,
        agent_id=agent_id,
        activity_type=activity_type,
        min_significance=min_significance,
        since=since,
        limit=limit,
        offset=offset,
    )
    return paginated(data, total, limit, offset)


# -- Simulation-Level Summaries --------------------------------------------------


@router.get("/mood-summary")
async def get_simulation_mood_summary(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[SimulationMoodSummary]:
    """Get aggregate mood/stress state for all agents in a simulation."""
    summary = await MorningBriefingService._compute_mood_summary(
        supabase,
        simulation_id,
    )
    return SuccessResponse(data=summary)


# -- Morning Briefing ------------------------------------------------------------


@router.get("/briefing")
async def get_morning_briefing(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    since_hours: Annotated[int, Query(ge=1, le=168)] = 24,
    mode: Annotated[str, Query(pattern=r"^(narrative|data)$")] = "narrative",
) -> SuccessResponse[MorningBriefingData]:
    """Generate a morning briefing with prioritized activity summary."""
    since = datetime.now(UTC) - timedelta(hours=since_hours)
    briefing = await MorningBriefingService.generate(
        supabase,
        simulation_id,
        since,
        mode=mode,
    )
    return SuccessResponse(data=briefing)
