"""Event echo (bleed) endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_supabase,
    require_role,
)
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.echo import EchoCreate, EchoResponse
from backend.services.audit_service import AuditService
from backend.services.echo_service import EchoService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}",
    tags=["echoes"],
)


@router.get("/echoes", response_model=PaginatedResponse[EchoResponse])
async def list_echoes(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    direction: str = Query(default="incoming", pattern="^(incoming|outgoing)$"),
    status: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List echoes for a simulation."""
    data, total = await EchoService.list_for_simulation(
        supabase, simulation_id,
        direction=direction, status_filter=status,
        limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get(
    "/events/{event_id}/echoes",
    response_model=SuccessResponse[list[EchoResponse]],
)
async def list_event_echoes(
    simulation_id: UUID,
    event_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List all echoes originating from a specific event."""
    data = await EchoService.list_for_event(supabase, event_id)
    return {"success": True, "data": data}


@router.post("/echoes", response_model=SuccessResponse[EchoResponse], status_code=201)
async def trigger_echo(
    simulation_id: UUID,
    body: EchoCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Manually trigger an echo from an event to a target simulation."""
    # Fetch the source event
    event_resp = (
        supabase.table("events")
        .select("*")
        .eq("id", str(body.source_event_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    )
    if not event_resp.data:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Source event not found in this simulation.",
        )

    result = await EchoService.create_echo(
        admin_supabase,
        source_event=event_resp.data,
        source_simulation_id=simulation_id,
        target_simulation_id=body.target_simulation_id,
        echo_vector=body.echo_vector,
        echo_strength=body.echo_strength,
        echo_depth=1,
    )
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_echoes", result["id"], "create"
    )
    return {"success": True, "data": result}


@router.patch(
    "/echoes/{echo_id}/approve",
    response_model=SuccessResponse[EchoResponse],
)
async def approve_echo(
    simulation_id: UUID,
    echo_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Approve a pending echo."""
    result = await EchoService.approve_echo(admin_supabase, echo_id)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_echoes", echo_id, "update"
    )
    return {"success": True, "data": result}


@router.patch(
    "/echoes/{echo_id}/reject",
    response_model=SuccessResponse[EchoResponse],
)
async def reject_echo(
    simulation_id: UUID,
    echo_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Reject a pending echo."""
    result = await EchoService.reject_echo(admin_supabase, echo_id)
    await AuditService.log_action(
        supabase, simulation_id, user.id, "event_echoes", echo_id, "update"
    )
    return {"success": True, "data": result}
