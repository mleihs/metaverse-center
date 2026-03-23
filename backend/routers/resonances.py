"""Substrate Resonance endpoints — platform-level tremor management.

Resonances are platform-wide (not scoped to a single simulation).
Only platform admins can create/process/update resonances.
All authenticated users can read them.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    CurrentUser,
    get_current_user,
    get_supabase,
    require_platform_admin,
)
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.resonance import (
    ProcessImpactRequest,
    ResonanceCreate,
    ResonanceImpactResponse,
    ResonanceResponse,
    ResonanceUpdate,
)
from backend.services.audit_service import AuditService
from backend.services.resonance_service import ResonanceService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/resonances",
    tags=["resonances"],
)


# ── List ─────────────────────────────────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[ResonanceResponse])
async def list_resonances(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    status_filter: str | None = Query(default=None, alias="status"),
    signature: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_deleted: bool = Query(default=False),
) -> dict:
    """List substrate resonances."""
    data, total = await ResonanceService.list(
        supabase,
        status_filter=status_filter,
        signature=signature,
        search=search,
        limit=limit,
        offset=offset,
        include_deleted=include_deleted,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Get ──────────────────────────────────────────────────────────────────────


@router.get("/{resonance_id}", response_model=SuccessResponse[ResonanceResponse])
async def get_resonance(
    resonance_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single resonance."""
    data = await ResonanceService.get(supabase, resonance_id)
    return {"success": True, "data": data}


# ── Create (platform admin only) ────────────────────────────────────────────


@router.post("", response_model=SuccessResponse[ResonanceResponse], status_code=201)
async def create_resonance(
    body: ResonanceCreate,
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new substrate resonance (platform admin only)."""
    resonance = await ResonanceService.create(
        supabase, user.id, body.model_dump(exclude_none=True),
    )
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance["id"], "create",
        {"title": resonance.get("title"), "source_category": resonance.get("source_category")},
    )
    return {"success": True, "data": resonance}


# ── Update (platform admin only) ────────────────────────────────────────────


@router.put("/{resonance_id}", response_model=SuccessResponse[ResonanceResponse])
async def update_resonance(
    resonance_id: UUID,
    body: ResonanceUpdate,
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a resonance (platform admin only)."""
    resonance = await ResonanceService.update(
        supabase, resonance_id, body.model_dump(exclude_none=True),
    )
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance_id, "update",
        {"fields": list(body.model_dump(exclude_none=True).keys())},
    )
    return {"success": True, "data": resonance}


# ── Process Impact (platform admin only) ─────────────────────────────────────


@router.post(
    "/{resonance_id}/process-impact",
    response_model=SuccessResponse[list[ResonanceImpactResponse]],
    status_code=201,
)
async def process_impact(
    resonance_id: UUID,
    body: ProcessImpactRequest = ProcessImpactRequest(),
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Process resonance impact across simulations (platform admin only).

    Spawns 2-3 events per simulation based on archetype + susceptibility.
    """
    impacts = await ResonanceService.process_impact(
        supabase,
        resonance_id,
        user.id,
        simulation_ids=body.simulation_ids,
        generate_narratives=body.generate_narratives,
        generate_reactions=body.generate_reactions,
        locale=body.locale,
    )
    completed = sum(1 for i in impacts if i.get("status") == "completed")
    failed = sum(1 for i in impacts if i.get("status") == "failed")
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance_id, "process_impact",
        {"total": len(impacts), "completed": completed, "failed": failed},
    )
    return {"success": True, "data": impacts}


# ── List Impacts ─────────────────────────────────────────────────────────────


@router.get(
    "/{resonance_id}/impacts",
    response_model=SuccessResponse[list[ResonanceImpactResponse]],
)
async def list_impacts(
    resonance_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """List impact records for a resonance."""
    data = await ResonanceService.list_impacts(supabase, resonance_id)
    return {"success": True, "data": data}


# ── Update Status (platform admin only) ──────────────────────────────────────


@router.put("/{resonance_id}/status", response_model=SuccessResponse[ResonanceResponse])
async def update_status(
    resonance_id: UUID,
    new_status: str = Query(...),
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update resonance status (platform admin only)."""
    resonance = await ResonanceService.update_status(supabase, resonance_id, new_status)
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance_id, "update",
        {"action": "status_transition", "new_status": new_status},
    )
    return {"success": True, "data": resonance}


# ── Restore (platform admin only) ──────────────────────────────────────────


@router.post("/{resonance_id}/restore", response_model=SuccessResponse[ResonanceResponse])
async def restore_resonance(
    resonance_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Restore a soft-deleted resonance (platform admin only)."""
    resonance = await ResonanceService.restore(supabase, resonance_id)
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance_id, "update",
        {"action": "restore"},
    )
    return {"success": True, "data": resonance}


# ── Delete (platform admin only) ────────────────────────────────────────────


@router.delete("/{resonance_id}", response_model=SuccessResponse[ResonanceResponse])
async def delete_resonance(
    resonance_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete a resonance (platform admin only)."""
    resonance = await ResonanceService.soft_delete(supabase, resonance_id)
    await AuditService.safe_log(
        supabase, None, user.id,
        "substrate_resonances", resonance_id, "delete",
        {"action": "soft_delete"},
    )
    return {"success": True, "data": resonance}
