"""Heartbeat router — simulation tick data, chronicle feed, narrative arcs,
bureau responses, attunements, anchors, and admin controls.

Follows the standard router pattern: HTTP only, business logic in services.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_admin_supabase,
    get_anon_supabase,
    get_current_user,
    get_effective_supabase,
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


@router.get("/api/v1/simulations/{simulation_id}/heartbeat")
async def get_heartbeat_overview(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Get latest heartbeat tick + countdown for a simulation."""
    data = await HeartbeatService.get_heartbeat_overview(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/briefing")
async def get_daily_briefing(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Daily briefing summary — health delta, event counts, active arcs."""
    data = await HeartbeatService.get_daily_briefing(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/entries")
async def list_heartbeat_entries(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    entry_type: Annotated[str | None, Query()] = None,
    tick_number: Annotated[int | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """Paginated chronicle feed (heartbeat entries)."""
    data, total = await HeartbeatService.list_heartbeat_entries(
        supabase, simulation_id,
        entry_type=entry_type, tick_number=tick_number,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.get("/api/v1/simulations/{simulation_id}/heartbeat/arcs")
async def list_narrative_arcs(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List narrative arcs for a simulation."""
    data, total = await NarrativeArcService.list_arcs(
        supabase, simulation_id, status_filter=status_filter,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


# ═══════════════════════════════════════════════════════════════
# PUBLIC HEARTBEAT ENDPOINTS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/public/simulations/{simulation_id}/heartbeat/entries")
async def public_list_heartbeat_entries(
    simulation_id: UUID,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    entry_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """Public chronicle feed — no authentication required."""
    data, total = await HeartbeatService.list_heartbeat_entries(
        supabase, simulation_id,
        entry_type=entry_type,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


# ═══════════════════════════════════════════════════════════════
# BUREAU RESPONSES
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/simulations/{simulation_id}/events/{event_id}/responses")
async def list_bureau_responses(
    simulation_id: UUID,
    event_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List bureau responses for an event."""
    data, total = await BureauResponseService.list_responses(
        supabase, simulation_id, event_id=event_id, limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.post("/api/v1/simulations/{simulation_id}/events/{event_id}/responses")
async def create_bureau_response(
    simulation_id: UUID,
    event_id: UUID,
    body: BureauResponseCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
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
    return SuccessResponse(data=data)


@router.delete(
    "/api/v1/simulations/{simulation_id}/events/{event_id}/responses/{response_id}",
)
async def cancel_bureau_response(
    simulation_id: UUID,
    event_id: UUID,
    response_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Cancel a pending bureau response."""
    data = await BureauResponseService.cancel_response(supabase, simulation_id, response_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "bureau_responses", response_id, "cancel",
    )
    return SuccessResponse(data=data)


# ═══════════════════════════════════════════════════════════════
# ATTUNEMENTS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/simulations/{simulation_id}/attunements")
async def list_attunements(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """List attunements for a simulation."""
    data = await AttunementService.list_attunements(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.post("/api/v1/simulations/{simulation_id}/attunements")
async def set_attunement(
    simulation_id: UUID,
    body: AttunementCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Set a resonance signature attunement."""
    data = await AttunementService.set_attunement(
        supabase, simulation_id, body.resonance_signature, user.id,
    )
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "substrate_attunements", data["id"], "create",
        details={"signature": body.resonance_signature},
    )
    return SuccessResponse(data=data)


@router.delete("/api/v1/simulations/{simulation_id}/attunements/{signature}")
async def remove_attunement(
    simulation_id: UUID,
    signature: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Remove an attunement."""
    data = await AttunementService.remove_attunement(supabase, simulation_id, signature)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "substrate_attunements", None, "delete",
        details={"signature": signature},
    )
    return SuccessResponse(data=data)


# ═══════════════════════════════════════════════════════════════
# ANCHORS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/anchors")
async def list_anchors(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    simulation_id: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List all collaborative anchors."""
    data, total = await AnchorService.list_anchors(
        supabase, status_filter=status_filter, sim_id=simulation_id,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.post("/api/v1/anchors")
async def create_anchor(
    body: AnchorCreate,
    simulation_id: Annotated[UUID, Query(description="Simulation creating the anchor")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
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
    return SuccessResponse(data=data)


@router.post("/api/v1/anchors/{anchor_id}/join")
async def join_anchor(
    anchor_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Simulation joining the anchor")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Join an existing anchor."""
    data = await AnchorService.join_anchor(supabase, anchor_id, simulation_id, user.id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "collaborative_anchors", anchor_id, "join",
    )
    return SuccessResponse(data=data)


@router.post("/api/v1/anchors/{anchor_id}/leave")
async def leave_anchor(
    anchor_id: UUID,
    simulation_id: Annotated[UUID, Query(description="Simulation leaving the anchor")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Leave an anchor."""
    data = await AnchorService.leave_anchor(supabase, anchor_id, simulation_id)
    await AuditService.safe_log(
        supabase, simulation_id, user.id,
        "collaborative_anchors", anchor_id, "leave",
    )
    return SuccessResponse(data=data)


# ═══════════════════════════════════════════════════════════════
# ADMIN HEARTBEAT CONTROLS
# ═══════════════════════════════════════════════════════════════


@router.get("/api/v1/admin/heartbeat/dashboard")
async def get_heartbeat_dashboard(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Admin heartbeat dashboard — all simulation statuses + global config."""
    data = await HeartbeatService.get_admin_dashboard(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/api/v1/admin/heartbeat/cascade-rules")
async def list_cascade_rules(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """List all cascade rules from the resonance_cascade_rules table."""
    data = await HeartbeatService.list_cascade_rules(admin_supabase)
    return SuccessResponse(data=data)


@router.post("/api/v1/admin/heartbeat/force-tick/{simulation_id}")
async def force_tick(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
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
    return SuccessResponse(data=data)
