"""Admin API for Substrate Scanner.

All endpoints require platform admin. Uses admin (service_role) client.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_EXTERNAL_API, RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
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
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Scanner dashboard: adapter status, metrics, config."""
    data = await ScannerService.get_dashboard(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/adapters")
async def list_adapters(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """List all registered adapters with status."""
    dashboard = await ScannerService.get_dashboard(admin_supabase)
    return SuccessResponse(data=dashboard["adapters"])


@router.patch("/adapters/{name}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def toggle_adapter(
    request: Request,
    name: str,
    enabled: Annotated[bool, Query()],
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Enable or disable an adapter in platform settings."""
    data = await ScannerService.toggle_adapter(admin_supabase, name, enabled)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scanner_adapters", name, "toggle",
        details={"adapter": name, "enabled": enabled},
    )
    return SuccessResponse(data=data)


@router.post("/trigger-scan")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def trigger_scan(
    request: Request,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    body: TriggerScanRequest | None = None,
) -> SuccessResponse:
    """Manually trigger one scan cycle."""
    adapter_names = body.adapter_names if body else None
    metrics = await ScannerService.run_scan_cycle(admin_supabase, adapter_names=adapter_names)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scanner", None, "scan",
        details={"adapter_names": adapter_names},
    )
    return SuccessResponse(data=metrics)


@router.get("/candidates")
async def list_candidates(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    status: Annotated[str | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
    source: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    """List scan candidates with filters.

    Returns dict (not PaginatedResponse) because meta includes extra
    ``recommended_threshold`` field that doesn't fit PaginationMeta.
    """
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
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    body: ApproveCandidateRequest | None = None,
) -> SuccessResponse:
    """Approve a candidate → create resonance."""
    delay_hours = body.delay_hours if body else 4
    resonance = await ScannerService.approve_candidate(
        admin_supabase, candidate_id, user.id, delay_hours=delay_hours,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id, "scan_candidates", candidate_id, "approve",
        details={"delay_hours": delay_hours},
    )
    return SuccessResponse(data=resonance)


@router.post("/candidates/{candidate_id}/reject")
@limiter.limit(RATE_LIMIT_STANDARD)
async def reject_candidate(
    request: Request,
    candidate_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Reject a candidate."""
    await ScannerService.reject_candidate(admin_supabase, candidate_id, user.id)
    await AuditService.safe_log(
        admin_supabase, None, user.id, "scan_candidates", candidate_id, "reject",
    )
    return SuccessResponse(data={"rejected": True})


@router.patch("/candidates/{candidate_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_candidate(
    request: Request,
    candidate_id: UUID,
    body: UpdateCandidateRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Edit a candidate's fields before approving."""
    update_data = body.model_dump(exclude_none=True)
    result = await ScannerService.update_candidate(admin_supabase, candidate_id, update_data)
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "scan_candidates", candidate_id, "update",
    )
    return SuccessResponse(data=result)


@router.get("/scan-log")
async def get_scan_log(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    source: Annotated[str | None, Query()] = None,
) -> PaginatedResponse:
    """Recent scan history."""
    data, total = await ScannerService.list_scan_log(
        admin_supabase, limit=limit, offset=offset, source=source,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )
