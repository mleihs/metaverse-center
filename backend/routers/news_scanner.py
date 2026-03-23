"""Admin API for Substrate Scanner.

All endpoints require platform admin. Uses admin (service_role) client.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_EXTERNAL_API, RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, PaginationMeta
from backend.models.news_scanner import (
    ApproveCandidateRequest,
    TriggerScanRequest,
    UpdateCandidateRequest,
)
from backend.services.audit_service import AuditService
from backend.services.scanning.scanner_service import ScannerService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/news-scanner",
    tags=["News Scanner"],
)


@router.get("/dashboard")
async def get_dashboard(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Scanner dashboard: adapter status, metrics, config."""
    data = await ScannerService.get_dashboard(admin_supabase)
    return {"success": True, "data": data}


@router.get("/adapters")
async def list_adapters(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all registered adapters with status."""
    dashboard = await ScannerService.get_dashboard(admin_supabase)
    return {"success": True, "data": dashboard["adapters"]}


@router.patch("/adapters/{name}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def toggle_adapter(
    request: Request,
    name: str,
    enabled: bool = Query(...),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Enable or disable an adapter in platform settings."""
    data = await ScannerService.toggle_adapter(admin_supabase, name, enabled)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scanner_adapters", name, "toggle",
        details={"adapter": name, "enabled": enabled},
    )
    return {"success": True, "data": data}


@router.post("/trigger-scan")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def trigger_scan(
    request: Request,
    body: TriggerScanRequest | None = None,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Manually trigger one scan cycle."""
    adapter_names = body.adapter_names if body else None
    metrics = await ScannerService.run_scan_cycle(admin_supabase, adapter_names=adapter_names)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scanner", None, "scan",
        details={"adapter_names": adapter_names},
    )
    return {"success": True, "data": metrics}


@router.get("/candidates")
async def list_candidates(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List scan candidates with filters."""
    data, total = await ScannerService.list_candidates(
        admin_supabase, status=status, category=category, source=source,
        limit=limit, offset=offset,
    )
    # Compute recommended magnitude threshold (top 20%, minimum 0.4)
    recommended_threshold = ScannerService.compute_recommended_threshold(data)
    return {
        "success": True,
        "data": data,
        "meta": {
            **PaginationMeta(count=len(data), total=total, limit=limit, offset=offset).model_dump(),
            "recommended_threshold": recommended_threshold,
        },
    }


@router.post("/candidates/{candidate_id}/approve")
@limiter.limit(RATE_LIMIT_STANDARD)
async def approve_candidate(
    request: Request,
    candidate_id: UUID,
    body: ApproveCandidateRequest | None = None,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Approve a candidate → create resonance."""
    delay_hours = body.delay_hours if body else 4
    resonance = await ScannerService.approve_candidate(
        admin_supabase, candidate_id, user.id, delay_hours=delay_hours,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id, "scan_candidates", candidate_id, "approve",
        details={"delay_hours": delay_hours},
    )
    return {"success": True, "data": resonance}


@router.post("/candidates/{candidate_id}/reject")
@limiter.limit(RATE_LIMIT_STANDARD)
async def reject_candidate(
    request: Request,
    candidate_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Reject a candidate."""
    await ScannerService.reject_candidate(admin_supabase, candidate_id, user.id)
    await AuditService.safe_log(
        admin_supabase, None, user.id, "scan_candidates", candidate_id, "reject",
    )
    return {"success": True, "data": {"rejected": True}}


@router.patch("/candidates/{candidate_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_candidate(
    request: Request,
    candidate_id: UUID,
    body: UpdateCandidateRequest,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Edit a candidate's fields before approving."""
    update_data = body.model_dump(exclude_none=True)
    result = await ScannerService.update_candidate(admin_supabase, candidate_id, update_data)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scan_candidates", candidate_id, "update",
    )
    return {"success": True, "data": result}


@router.get("/scan-log")
async def get_scan_log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    source: str | None = Query(default=None),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Recent scan history."""
    data, total = await ScannerService.list_scan_log(
        admin_supabase, limit=limit, offset=offset, source=source,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }
