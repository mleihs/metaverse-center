"""Heartbeat router — simulation tick data, chronicle feed, narrative arcs,
bureau responses, attunements, anchors, and admin controls.

Follows the standard router pattern: HTTP only, business logic in services.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_anon_supabase,
    get_current_user,
    get_supabase,
    require_platform_admin,
    require_role,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.heartbeat import (
    AnchorCreate,
    AttunementCreate,
    BureauResponseCreate,
)
from backend.services.anchor_service import AnchorService
from backend.services.attunement_service import AttunementService
from backend.services.audit_service import AuditService
from backend.services.bureau_response_service import BureauResponseService
from backend.services.heartbeat_service import HeartbeatService
from backend.services.narrative_arc_service import NarrativeArcService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Heartbeat"])


# ═══════════════════════════════════════════════════════════════
# HEARTBEAT DATA (simulation-scoped)
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/simulations/{simulation_id}/heartbeat", response_model=SuccessResponse)
async def get_heartbeat_overview(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get latest heartbeat tick + countdown for a simulation."""
    data = await HeartbeatService.get_heartbeat_overview(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/briefing", response_model=SuccessResponse)
async def get_daily_briefing(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Daily briefing summary — health delta, event counts, active arcs."""
    data = await HeartbeatService.get_daily_briefing(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/entries", response_model=PaginatedResponse)
async def list_heartbeat_entries(
    simulation_id: UUID,
    entry_type: str | None = Query(default=None),
    tick_number: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Paginated chronicle feed (heartbeat entries)."""
    data, total = await HeartbeatService.list_heartbeat_entries(
        supabase, simulation_id,
        entry_type=entry_type, tick_number=tick_number,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/arcs", response_model=PaginatedResponse)
async def list_narrative_arcs(
    simulation_id: UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List narrative arcs for a simulation."""
    data, total = await NarrativeArcService.list_arcs(
        supabase, simulation_id, status_filter=status_filter,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ═══════════════════════════════════════════════════════════════
# PUBLIC HEARTBEAT ENDPOINTS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/public/simulations/{simulation_id}/heartbeat/entries", response_model=PaginatedResponse)
async def public_list_heartbeat_entries(
    simulation_id: UUID,
    entry_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Public chronicle feed — no authentication required."""
    data, total = await HeartbeatService.list_heartbeat_entries(
        supabase, simulation_id,
        entry_type=entry_type,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ═══════════════════════════════════════════════════════════════
# BUREAU RESPONSES
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/simulations/{simulation_id}/events/{event_id}/responses", response_model=PaginatedResponse)
async def list_bureau_responses(
    simulation_id: UUID,
    event_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List bureau responses for an event."""
    data, total = await BureauResponseService.list_responses(
        supabase, simulation_id, event_id=event_id, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/api/v1/simulations/{simulation_id}/events/{event_id}/responses", response_model=SuccessResponse)
async def create_bureau_response(
    simulation_id: UUID,
    event_id: UUID,
    body: BureauResponseCreate,
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a bureau response to an event."""
    data = await BureauResponseService.create_response(
        supabase, simulation_id, event_id,
        body.response_type, body.assigned_agent_ids, user.id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "bureau_responses", data["id"], "create",
        details={"response_type": body.response_type, "agent_count": len(body.assigned_agent_ids)},
    )
    return {"success": True, "data": data}


@router.delete(
    "/api/v1/simulations/{simulation_id}/events/{event_id}/responses/{response_id}",
    response_model=SuccessResponse,
)
async def cancel_bureau_response(
    simulation_id: UUID,
    event_id: UUID,
    response_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Cancel a pending bureau response."""
    data = await BureauResponseService.cancel_response(supabase, simulation_id, response_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "bureau_responses", response_id, "cancel",
    )
    return {"success": True, "data": data}


# ═══════════════════════════════════════════════════════════════
# ATTUNEMENTS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/simulations/{simulation_id}/attunements", response_model=SuccessResponse)
async def list_attunements(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List attunements for a simulation."""
    data = await AttunementService.list_attunements(supabase, simulation_id)
    return {"success": True, "data": data}


@router.post("/api/v1/simulations/{simulation_id}/attunements", response_model=SuccessResponse)
async def set_attunement(
    simulation_id: UUID,
    body: AttunementCreate,
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Set a resonance signature attunement."""
    data = await AttunementService.set_attunement(
        supabase, simulation_id, body.resonance_signature, user.id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "substrate_attunements", data["id"], "create",
        details={"signature": body.resonance_signature},
    )
    return {"success": True, "data": data}


@router.delete("/api/v1/simulations/{simulation_id}/attunements/{signature}", response_model=SuccessResponse)
async def remove_attunement(
    simulation_id: UUID,
    signature: str,
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Remove an attunement."""
    data = await AttunementService.remove_attunement(supabase, simulation_id, signature)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "substrate_attunements", None, "delete",
        details={"signature": signature},
    )
    return {"success": True, "data": data}


# ═══════════════════════════════════════════════════════════════
# ANCHORS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/anchors", response_model=PaginatedResponse)
async def list_anchors(
    status_filter: str | None = Query(default=None, alias="status"),
    simulation_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all collaborative anchors."""
    data, total = await AnchorService.list_anchors(
        supabase, status_filter=status_filter, sim_id=simulation_id,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/api/v1/anchors", response_model=SuccessResponse)
async def create_anchor(
    body: AnchorCreate,
    simulation_id: UUID = Query(..., description="Simulation creating the anchor"),
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a collaborative anchor."""
    data = await AnchorService.create_anchor(
        supabase, body.resonance_id, body.resonance_signature,
        simulation_id, user.id, body.name,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "collaborative_anchors", data["id"], "create",
        details={"name": body.name, "resonance_signature": body.resonance_signature},
    )
    return {"success": True, "data": data}


@router.post("/api/v1/anchors/{anchor_id}/join", response_model=SuccessResponse)
async def join_anchor(
    anchor_id: UUID,
    simulation_id: UUID = Query(..., description="Simulation joining the anchor"),
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Join an existing anchor."""
    data = await AnchorService.join_anchor(supabase, anchor_id, simulation_id, user.id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "collaborative_anchors", anchor_id, "join",
    )
    return {"success": True, "data": data}


@router.post("/api/v1/anchors/{anchor_id}/leave", response_model=SuccessResponse)
async def leave_anchor(
    anchor_id: UUID,
    simulation_id: UUID = Query(..., description="Simulation leaving the anchor"),
    user: CurrentUser = Depends(get_current_user),
    _role: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Leave an anchor."""
    data = await AnchorService.leave_anchor(supabase, anchor_id, simulation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "collaborative_anchors", anchor_id, "leave",
    )
    return {"success": True, "data": data}


# ═══════════════════════════════════════════════════════════════
# ADMIN HEARTBEAT CONTROLS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/admin/heartbeat/dashboard", response_model=SuccessResponse)
async def get_heartbeat_dashboard(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Admin heartbeat dashboard — all simulation statuses + global config."""
    data = await HeartbeatService.get_admin_dashboard(admin_supabase)
    return {"success": True, "data": data}


@router.get("/api/v1/admin/heartbeat/cascade-rules", response_model=SuccessResponse)
async def list_cascade_rules(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all cascade rules from the resonance_cascade_rules table."""
    data = await HeartbeatService.list_cascade_rules(admin_supabase)
    return {"success": True, "data": data}


@router.post("/api/v1/admin/heartbeat/force-tick/{simulation_id}", response_model=SuccessResponse)
async def force_tick(
    simulation_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Force a heartbeat tick for a specific simulation (admin only)."""
    data = await HeartbeatService.force_tick(admin_supabase, simulation_id)
    await AuditService.safe_log(
        admin_supabase, simulation_id, user.id,
        "simulation_heartbeats", None, "force_tick",
    )
    logger.info(
        "Admin forced tick for sim %s", simulation_id,
        extra={"simulation_id": str(simulation_id), "admin_id": str(user.id)},
    )
    return {"success": True, "data": data}
