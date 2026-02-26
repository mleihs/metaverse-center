"""Public read-only endpoints — no authentication required.

Serves anonymous users via anon RLS policies.
Only GET endpoints for active simulation data.
Delegates to existing service layer where possible (keeps query logic in sync).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_anon_supabase
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.agent_service import AgentService
from backend.services.building_service import BuildingService
from backend.services.campaign_service import CampaignService
from backend.services.echo_service import ConnectionService, EchoService
from backend.services.event_service import EventService
from backend.services.location_service import LocationService
from backend.services.relationship_service import RelationshipService
from backend.services.settings_service import SettingsService
from backend.services.social_media_service import SocialMediaService
from backend.services.social_trends_service import SocialTrendsService
from supabase import Client

router = APIRouter(prefix="/api/v1/public", tags=["Public"])

RATE_LIMIT_PUBLIC = RATE_LIMIT_STANDARD  # 100/minute


# ── Helpers ─────────────────────────────────────────────────────────────


def _paginated(data: list[dict], total: int, limit: int, offset: int) -> dict:
    """Build a standard paginated response dict."""
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Simulations ──────────────────────────────────────────────────────────


def _enrich_with_counts(supabase: Client, simulations: list[dict]) -> None:
    """Enrich simulation dicts with counts from the simulation_dashboard view."""
    if not simulations:
        return
    ids = [s["id"] for s in simulations]
    count_response = (
        supabase.table("simulation_dashboard")
        .select("simulation_id, agent_count, building_count, event_count, member_count")
        .in_("simulation_id", ids)
        .execute()
    )
    counts_map = {row["simulation_id"]: row for row in (count_response.data or [])}
    for sim in simulations:
        counts = counts_map.get(sim["id"], {})
        sim["agent_count"] = counts.get("agent_count", 0)
        sim["building_count"] = counts.get("building_count", 0)
        sim["event_count"] = counts.get("event_count", 0)
        sim["member_count"] = counts.get("member_count", 0)


@router.get("/simulations", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulations(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all active simulations (public)."""
    response = (
        supabase.table("simulations")
        .select("*", count="exact")
        .eq("status", "active")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    _enrich_with_counts(supabase, data)
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single active simulation (public)."""
    response = (
        supabase.table("simulations")
        .select("*")
        .eq("id", str(simulation_id))
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    data = response.data
    _enrich_with_counts(supabase, data)
    return {"success": True, "data": data[0]}


# ── Agents ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agents(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List agents in a simulation (public)."""
    data, total = await AgentService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/agents/{agent_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single agent (public)."""
    data = await AgentService.get(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


# ── Buildings ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/buildings", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_buildings(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List buildings in a simulation (public)."""
    data, total = await BuildingService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/buildings/{building_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building(
    request: Request,
    simulation_id: UUID,
    building_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single building (public)."""
    data = await BuildingService.get(supabase, simulation_id, building_id)
    return {"success": True, "data": data}


# ── Events ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/events", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_events(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List events in a simulation (public)."""
    data, total = await EventService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_event(
    request: Request,
    simulation_id: UUID,
    event_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single event (public)."""
    data = await EventService.get(supabase, simulation_id, event_id)
    return {"success": True, "data": data}


# ── Locations ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/locations/cities", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_cities(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List cities (public)."""
    data, _ = await LocationService.list_cities(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


@router.get(
    "/simulations/{simulation_id}/locations/cities/{city_id}",
    response_model=SuccessResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_city(
    request: Request,
    simulation_id: UUID,
    city_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single city (public)."""
    data = await LocationService.get_city(supabase, simulation_id, city_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/locations/zones", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zones(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List zones (public)."""
    data, _ = await LocationService.list_zones(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


@router.get(
    "/simulations/{simulation_id}/locations/zones/{zone_id}",
    response_model=SuccessResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_zone(
    request: Request,
    simulation_id: UUID,
    zone_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single zone (public)."""
    data = await LocationService.get_zone(supabase, simulation_id, zone_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/locations/streets", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_streets(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List streets (public)."""
    data, _ = await LocationService.list_streets(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


# ── Chat (read-only) ────────────────────────────────────────────────────
# Note: ChatService.list_conversations requires user_id (filters by owner).
# Public endpoint lists ALL conversations — kept as inline query.


@router.get("/simulations/{simulation_id}/chat/conversations", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_conversations(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List chat conversations (public, read-only)."""
    response = (
        supabase.table("chat_conversations")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .order("last_message_at", desc=True)
        .execute()
    )
    return {"success": True, "data": response.data or []}


@router.get(
    "/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages",
    response_model=PaginatedResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_messages(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List messages in a conversation (public, read-only)."""
    response = (
        supabase.table("chat_messages")
        .select("*", count="exact")
        .eq("conversation_id", str(conversation_id))
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return _paginated(data, total, limit, offset)


# ── Taxonomies ───────────────────────────────────────────────────────────
# No dedicated service — kept as inline query.


@router.get("/simulations/{simulation_id}/taxonomies", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_taxonomies(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    taxonomy_type: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List taxonomies (public)."""
    query = (
        supabase.table("simulation_taxonomies")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .order("taxonomy_type")
        .range(offset, offset + limit - 1)
    )
    if taxonomy_type:
        query = query.eq("taxonomy_type", taxonomy_type)
    response = query.execute()
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return _paginated(data, total, limit, offset)


# ── Settings (design category only) ─────────────────────────────────────


@router.get("/simulations/{simulation_id}/settings", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_settings(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List design settings only (public — for theming)."""
    data = await SettingsService.list_settings(supabase, simulation_id, category="design")
    return {"success": True, "data": data}


# ── Social ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/social-trends", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_trends(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social trends (public)."""
    data, total = await SocialTrendsService.list_trends(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/social-media", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_posts(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social media posts (public)."""
    data, total = await SocialMediaService.list_posts(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Campaigns ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/campaigns", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_campaigns(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List campaigns (public)."""
    data, total = await CampaignService.list_campaigns(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Agent Relationships ─────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents/{agent_id}/relationships", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agent_relationships(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List relationships for a specific agent (public)."""
    data = await RelationshipService.list_for_agent(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/relationships", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulation_relationships(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all relationships in a simulation (public)."""
    data, total = await RelationshipService.list_for_simulation(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Event Echoes ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/echoes", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_echoes(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List incoming echoes for a simulation (public)."""
    data, total = await EchoService.list_for_simulation(
        supabase, simulation_id, direction="incoming", limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}/echoes", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_event_echoes(
    request: Request,
    simulation_id: UUID,
    event_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List echoes for a specific event (public)."""
    data = await EchoService.list_for_event(supabase, event_id)
    return {"success": True, "data": data}


# ── Simulation Connections & Map Data ───────────────────────────────────


@router.get("/connections", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_connections(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List all active simulation connections (public, for map)."""
    data = await ConnectionService.list_all(supabase, active_only=True)
    return {"success": True, "data": data}


@router.get("/map-data", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_map_data(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Aggregated endpoint for Cartographer's Map — simulations + connections + echo counts."""
    data = await ConnectionService.get_map_data(supabase)
    return {"success": True, "data": data}
