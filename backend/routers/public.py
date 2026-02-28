"""Public read-only endpoints — no authentication required.

Serves anonymous users via anon RLS policies.
Only GET endpoints for active simulation data.
Delegates to existing service layer where possible (keeps query logic in sync).
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_anon_supabase
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.agent_service import AgentService
from backend.services.battle_log_service import BattleLogService
from backend.services.building_service import BuildingService
from backend.services.campaign_service import CampaignService
from backend.services.echo_service import ConnectionService, EchoService
from backend.services.embassy_service import EmbassyService
from backend.services.epoch_invitation_service import EpochInvitationService
from backend.services.epoch_service import EpochService
from backend.services.event_service import EventService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.location_service import LocationService
from backend.services.relationship_service import RelationshipService
from backend.services.scoring_service import ScoringService
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
    """List all active template simulations (public). Excludes game instances."""
    response = (
        supabase.table("simulations")
        .select("*", count="exact")
        .eq("status", "active")
        .eq("simulation_type", "template")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    _enrich_with_counts(supabase, data)
    return _paginated(data, total, limit, offset)


@router.get("/simulations/by-slug/{slug}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_by_slug(
    request: Request,
    slug: str,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single active simulation by its slug (public)."""
    response = (
        supabase.table("simulations")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    data = response.data
    _enrich_with_counts(supabase, data)
    return {"success": True, "data": data[0]}


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


# ── Embassies ──────────────────────────────────────────────────────────

@router.get("/simulations/{simulation_id}/embassies", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassies(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List active embassies for a simulation (public)."""
    data, total = await EmbassyService.list_for_simulation(
        supabase, simulation_id, status_filter="active",
        limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/embassies/{embassy_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_embassy(
    request: Request,
    simulation_id: UUID,
    embassy_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single embassy (public)."""
    data = await EmbassyService.get(supabase, embassy_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/buildings/{building_id}/embassy", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building_embassy(
    request: Request,
    simulation_id: UUID,
    building_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get the embassy linked to a building (public)."""
    data = await EmbassyService.get_for_building(supabase, building_id)
    return {"success": True, "data": data}


@router.get("/embassies", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_embassies(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List all active embassies across all simulations (public, for map)."""
    data = await EmbassyService.list_all_active(supabase)
    return {"success": True, "data": data}


# ── Game Mechanics (Health Dashboard) ─────────────────────────────────


@router.get("/simulations/{simulation_id}/health", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_health_dashboard(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Full health dashboard for a simulation (public)."""
    data = await GameMechanicsService.get_health_dashboard(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/health/buildings", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_building_readiness(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    zone_id: UUID | None = Query(default=None),
    order_by: str = Query(default="readiness"),
    order_asc: bool = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List building readiness for a simulation (public)."""
    data, total = await GameMechanicsService.list_building_readiness(
        supabase, simulation_id,
        zone_id=zone_id, order_by=order_by, order_asc=order_asc,
        limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/health/zones", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zone_stability(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List zone stability for a simulation (public)."""
    data = await GameMechanicsService.list_zone_stability(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/health/embassies", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassy_effectiveness(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List embassy effectiveness for a simulation (public)."""
    data = await GameMechanicsService.list_embassy_effectiveness(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/health/all", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_simulations_health(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Health metrics for all simulations (public, for map/dashboard)."""
    data = await GameMechanicsService.list_simulation_health(supabase)
    return {"success": True, "data": data}


# ── Epochs (Public) ─────────────────────────────────────────────────────


@router.get("/epochs", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epochs_public(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all epochs (public)."""
    data, total = await EpochService.list_epochs(
        supabase, status_filter=status_filter, limit=limit, offset=offset
    )
    return _paginated(data, total, limit, offset)


@router.get("/epochs/active", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_active_epochs_public(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get all active epochs — lobby + running (public)."""
    data = await EpochService.get_active_epochs(supabase)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_epoch_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single epoch (public)."""
    data = await EpochService.get(supabase, epoch_id)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/participants", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_participants_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List epoch participants (public)."""
    data = await EpochService.list_participants(supabase, epoch_id)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/teams", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_teams_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List epoch teams (public)."""
    data = await EpochService.list_teams(supabase, epoch_id)
    return {"success": True, "data": data}


# ── Leaderboard (Public) ───────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/leaderboard", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_leaderboard_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    cycle: int | None = Query(default=None),
) -> dict:
    """Get epoch leaderboard (public spectator view)."""
    data = await ScoringService.get_leaderboard(supabase, epoch_id, cycle_number=cycle)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/standings", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_standings_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get final standings for a completed epoch (public)."""
    data = await ScoringService.get_final_standings(supabase, epoch_id)
    return {"success": True, "data": data}


# ── Battle Log (Public) ────────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/battle-log", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_battle_log_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Get public battle log entries (spectator view)."""
    data, total = await BattleLogService.get_public_feed(
        supabase, epoch_id, limit=limit, offset=offset
    )
    return _paginated(data, total, limit, offset)


# ── Epoch Invitations (Public) ──────────────────────────────────────


@router.get("/epoch-invitations/{token}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def validate_epoch_invitation(
    request: Request,
    token: str,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Validate an epoch invitation token and return epoch info + lore."""
    invitation = await EpochInvitationService.get_by_token(supabase, token)
    epoch_data = invitation.get("game_epochs") or {}

    expires_at_str = invitation.get("expires_at", "")
    is_expired = False
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            is_expired = expires_at < datetime.now(UTC)
        except (ValueError, TypeError):
            pass

    config = epoch_data.get("config") or {}

    return {
        "success": True,
        "data": {
            "epoch_name": epoch_data.get("name", "Unknown"),
            "epoch_description": epoch_data.get("description"),
            "epoch_status": epoch_data.get("status", "unknown"),
            "lore_text": config.get("invitation_lore"),
            "expires_at": invitation.get("expires_at"),
            "is_expired": is_expired or invitation.get("status") == "expired",
            "is_accepted": invitation.get("status") == "accepted",
        },
    }
