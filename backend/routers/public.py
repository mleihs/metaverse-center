"""Public read-only endpoints — no authentication required.

Serves anonymous users via anon RLS policies.
Only GET endpoints for active simulation data.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_anon_supabase
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from supabase import Client

router = APIRouter(prefix="/api/v1/public", tags=["Public"])


# ── Simulations ──────────────────────────────────────────────────────────


@router.get("/simulations", response_model=PaginatedResponse)
async def list_simulations(
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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/simulations/{simulation_id}", response_model=SuccessResponse)
async def get_simulation(
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
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    return {"success": True, "data": response.data[0]}


# ── Agents ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents", response_model=PaginatedResponse)
async def list_agents(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List agents in a simulation (public)."""
    query = (
        supabase.table("agents")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.ilike("name", f"%{search}%")
    response = query.execute()
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/simulations/{simulation_id}/agents/{agent_id}", response_model=SuccessResponse)
async def get_agent(
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single agent (public)."""
    response = (
        supabase.table("agents")
        .select("*")
        .eq("id", str(agent_id))
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    return {"success": True, "data": response.data[0]}


# ── Buildings ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/buildings", response_model=PaginatedResponse)
async def list_buildings(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List buildings in a simulation (public)."""
    query = (
        supabase.table("buildings")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.ilike("name", f"%{search}%")
    response = query.execute()
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/simulations/{simulation_id}/buildings/{building_id}", response_model=SuccessResponse)
async def get_building(
    simulation_id: UUID,
    building_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single building (public)."""
    response = (
        supabase.table("buildings")
        .select("*")
        .eq("id", str(building_id))
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found.")
    return {"success": True, "data": response.data[0]}


# ── Events ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/events", response_model=PaginatedResponse)
async def list_events(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List events in a simulation (public)."""
    query = (
        supabase.table("events")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if search:
        query = query.ilike("title", f"%{search}%")
    response = query.execute()
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/simulations/{simulation_id}/events/{event_id}", response_model=SuccessResponse)
async def get_event(
    simulation_id: UUID,
    event_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single event (public)."""
    response = (
        supabase.table("events")
        .select("*")
        .eq("id", str(event_id))
        .eq("simulation_id", str(simulation_id))
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if not response.data:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return {"success": True, "data": response.data[0]}


# ── Locations ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/locations/cities", response_model=SuccessResponse)
async def list_cities(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List cities (public)."""
    response = (
        supabase.table("cities")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .order("name")
        .execute()
    )
    return {"success": True, "data": response.data or []}


@router.get("/simulations/{simulation_id}/locations/zones", response_model=SuccessResponse)
async def list_zones(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List zones (public)."""
    response = (
        supabase.table("zones")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .order("name")
        .execute()
    )
    return {"success": True, "data": response.data or []}


@router.get("/simulations/{simulation_id}/locations/streets", response_model=SuccessResponse)
async def list_streets(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List streets (public)."""
    response = (
        supabase.table("city_streets")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .order("name")
        .execute()
    )
    return {"success": True, "data": response.data or []}


# ── Chat (read-only) ────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/chat/conversations", response_model=SuccessResponse)
async def list_conversations(
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
async def list_messages(
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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Taxonomies ───────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/taxonomies", response_model=PaginatedResponse)
async def list_taxonomies(
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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Settings (design category only) ─────────────────────────────────────


@router.get("/simulations/{simulation_id}/settings", response_model=SuccessResponse)
async def list_settings(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List design settings only (public — for theming)."""
    response = (
        supabase.table("simulation_settings")
        .select("*")
        .eq("simulation_id", str(simulation_id))
        .eq("category", "design")
        .execute()
    )
    return {"success": True, "data": response.data or []}


# ── Social ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/social-trends", response_model=PaginatedResponse)
async def list_social_trends(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social trends (public)."""
    response = (
        supabase.table("social_trends")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/simulations/{simulation_id}/social-media", response_model=PaginatedResponse)
async def list_social_posts(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social media posts (public)."""
    response = (
        supabase.table("social_media_posts")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Campaigns ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/campaigns", response_model=PaginatedResponse)
async def list_campaigns(
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List campaigns (public)."""
    response = (
        supabase.table("campaigns")
        .select("*", count="exact")
        .eq("simulation_id", str(simulation_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }
