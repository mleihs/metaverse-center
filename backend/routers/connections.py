"""Simulation connection endpoints (platform-level, not simulation-scoped)."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, require_platform_admin
from backend.models.common import CurrentUser, MessageResponse, SuccessResponse
from backend.models.echo import ConnectionCreate, ConnectionResponse, ConnectionUpdate
from backend.services.audit_service import AuditService
from backend.services.connection_service import ConnectionService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/connections",
    tags=["connections"],
)


@router.get("")
async def list_connections(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ConnectionResponse]]:
    """List all simulation connections."""
    data = await ConnectionService.list_all(supabase, active_only=False)
    return SuccessResponse(data=data)


@router.post("", status_code=201)
async def create_connection(
    body: ConnectionCreate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _admin_check: Annotated[None, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ConnectionResponse]:
    """Create a simulation connection (platform admin only)."""
    result = await ConnectionService.create_connection(admin_supabase, body.model_dump(exclude_none=True))
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "simulation_connections",
        result.id,
        "create",
        details={"source_id": str(body.source_id) if hasattr(body, "source_id") else None},
    )
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.patch("/{connection_id}")
async def update_connection(
    connection_id: UUID,
    body: ConnectionUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _admin_check: Annotated[None, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ConnectionResponse]:
    """Update a simulation connection (platform admin only)."""
    result = await ConnectionService.update_connection(
        admin_supabase, connection_id, body.model_dump(exclude_none=True)
    )
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "simulation_connections",
        connection_id,
        "update",
    )
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=result)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _admin_check: Annotated[None, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[MessageResponse]:
    """Delete a simulation connection (platform admin only)."""
    await ConnectionService.delete_connection(admin_supabase, connection_id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "simulation_connections",
        connection_id,
        "delete",
    )
    ConnectionService._map_data_cache.clear()
    return SuccessResponse(data=MessageResponse(message="Connection deleted."))
