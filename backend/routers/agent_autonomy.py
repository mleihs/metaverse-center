"""Agent autonomy read endpoints — mood, needs, opinions, activities.

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
from backend.services.morning_briefing_service import MorningBriefingService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["agent-autonomy"],
)


# ── Mood ─────────────────────────────────────────────────────────────────────


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
    result = await (
        supabase.table("agent_mood")
        .select("*")
        .eq("agent_id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
        .maybe_single()
        .execute()
    )
    return {"success": True, "data": result.data}


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
    result = await (
        supabase.table("agent_moodlets")
        .select("*")
        .eq("agent_id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
        .order("created_at", desc=True)
        .execute()
    )
    return {"success": True, "data": result.data}


# ── Needs ────────────────────────────────────────────────────────────────────


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
    result = await (
        supabase.table("agent_needs")
        .select("*")
        .eq("agent_id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
        .maybe_single()
        .execute()
    )
    return {"success": True, "data": result.data}


# ── Opinions ─────────────────────────────────────────────────────────────────


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
    result = await (
        supabase.table("agent_opinions")
        .select("*, agents!agent_opinions_target_agent_id_fkey(name, portrait_image_url)")
        .eq("agent_id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
        .order("opinion_score", desc=True)
        .execute()
    )
    # Flatten joined agent data
    data = []
    for row in result.data or []:
        agent_data = row.pop("agents", {}) or {}
        row["target_agent_name"] = agent_data.get("name")
        row["target_agent_portrait"] = agent_data.get("portrait_image_url")
        data.append(row)
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
    query = (
        supabase.table("agent_opinion_modifiers")
        .select("*")
        .eq("agent_id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
    )
    if target_agent_id:
        query = query.eq("target_agent_id", str(target_agent_id))
    result = await query.order("created_at", desc=True).execute()
    return {"success": True, "data": result.data}


# ── Activities ───────────────────────────────────────────────────────────────


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

    query = (
        supabase.table("agent_activities")
        .select(
            "*, agents!agent_activities_agent_id_fkey(name, portrait_image_url)",
            count="exact",
        )
        .eq("simulation_id", str(simulation_id))
        .gte("significance", min_significance)
        .gte("created_at", since.isoformat())
    )
    if agent_id:
        query = query.eq("agent_id", str(agent_id))
    if activity_type:
        query = query.eq("activity_type", activity_type)

    result = await (
        query.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Flatten joined agent data
    data = []
    for row in result.data or []:
        agent_data = row.pop("agents", {}) or {}
        row["agent_name"] = agent_data.get("name")
        row["agent_portrait"] = agent_data.get("portrait_image_url")
        data.append(row)

    total = result.count or 0
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Simulation-Level Summaries ───────────────────────────────────────────────


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


# ── Morning Briefing ─────────────────────────────────────────────────────


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
