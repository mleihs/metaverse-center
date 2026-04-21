"""Bureau Ops admin router (P1) — AI spend + signal control.

Every endpoint requires ``require_platform_admin`` and uses
``get_admin_supabase`` (service_role). Pydantic response models live in
``backend/models/bureau_ops.py``; service layer in
``backend/services/ops_ledger_service.py`` + ``budget_enforcement_service.py``.

Endpoint surface (P1 subset of the plan §5.5 list):
    GET    /admin/ops/ledger         LedgerPanel + BurnRatePanel
    GET    /admin/ops/firehose       FirehosePanel initial REST page
    GET    /admin/ops/circuit        QuarantinePanel + future CircuitMatrix
    GET    /admin/ops/audit          Incident dossier drawer (P2)
    GET    /admin/ops/budgets        Budget list for the CRUD UI
    POST   /admin/ops/budget         Create a budget
    PUT    /admin/ops/budget/{id}    Update a budget
    DELETE /admin/ops/budget/{id}    Delete a budget
    POST   /admin/ops/kill           Trip a manual kill on (scope, scope_key)
    POST   /admin/ops/revert         Lift a manual kill
    POST   /admin/ops/kill/cut-all-ai Master switch (kills provider:openrouter)
    POST   /admin/ops/circuit/reset  Clear auto-state (e.g. after a flap)

Panels ⑤ (Sentry rules) and ⑦ (Heatmap) + the forecast endpoint land in
P2/P3; their backing services are not yet implemented.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.models.bureau_ops import (
    BudgetCap,
    BudgetUpsertRequest,
    CircuitMatrix,
    CutAllAIRequest,
    FirehoseEntry,
    KillActionResponse,
    LedgerSnapshot,
    OpsAuditEntry,
    ResetCircuitRequest,
    RevertKillRequest,
    TripKillRequest,
)
from backend.models.common import CurrentUser, DeleteResponse, SuccessResponse
from backend.services.budget_enforcement_service import BudgetEnforcementService
from backend.services.circuit_breaker_service import circuit_breaker
from backend.services.ops_ledger_service import OpsLedgerService
from backend.utils.errors import not_found
from backend.utils.responses import extract_list, extract_one
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/ops",
    tags=["Bureau Ops"],
)


# ── Read endpoints ───────────────────────────────────────────────────────


@router.get("/ledger")
async def get_ledger(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[LedgerSnapshot]:
    """Today / month / last-hour totals plus 24-hour hourly trend."""
    data = await OpsLedgerService.get_ledger_snapshot(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/firehose")
async def get_firehose(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> SuccessResponse[list[FirehoseEntry]]:
    """Last N ai_usage_log rows. Subsequent updates come via Supabase Realtime."""
    data = await OpsLedgerService.get_firehose(admin_supabase, limit=limit)
    return SuccessResponse(data=data)


@router.get("/circuit")
async def get_circuit(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CircuitMatrix]:
    """Combined in-process + persisted circuit state for the Quarantine panel."""
    data = await OpsLedgerService.get_circuit_matrix(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/audit")
async def get_audit(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    days: Annotated[int, Query(ge=1, le=90)] = 7,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
) -> SuccessResponse[list[OpsAuditEntry]]:
    """Recent ops_audit_log entries (newest first)."""
    data = await OpsLedgerService.get_audit_log(admin_supabase, days=days, limit=limit)
    return SuccessResponse(data=data)


# ── Budget CRUD ──────────────────────────────────────────────────────────


@router.get("/budgets")
async def list_budgets(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[list[BudgetCap]]:
    """All ai_budget rows with current-period spend rolled up."""
    data = await BudgetEnforcementService.list_budgets(admin_supabase)
    return SuccessResponse(data=data)


@router.post("/budget")
async def create_budget(
    body: BudgetUpsertRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BudgetCap]:
    """Create a new budget row. Requires a reason (audit log)."""
    data = await BudgetEnforcementService.upsert_budget(
        admin_supabase, actor_id=user.id, body=body,
    )
    return SuccessResponse(data=data)


@router.put("/budget/{budget_id}")
async def update_budget(
    budget_id: UUID,
    body: BudgetUpsertRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BudgetCap]:
    """Update a budget by id."""
    data = await BudgetEnforcementService.upsert_budget(
        admin_supabase, actor_id=user.id, body=body, budget_id=budget_id,
    )
    return SuccessResponse(data=data)


@router.delete("/budget/{budget_id}")
async def delete_budget(
    budget_id: UUID,
    reason: Annotated[str, Query(min_length=3, max_length=500)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DeleteResponse]:
    """Delete a budget. ``reason`` is required for the audit log."""
    await BudgetEnforcementService.delete_budget(
        admin_supabase, actor_id=user.id, budget_id=budget_id, reason=reason,
    )
    return SuccessResponse(data=DeleteResponse(id=str(budget_id)))


# ── Kill / revert (Quarantine panel) ─────────────────────────────────────


async def _do_trip_kill(
    admin_supabase: Client,
    *,
    actor_id: UUID,
    body: TripKillRequest,
) -> KillActionResponse:
    """Shared kill-implementation used by /kill and /kill/cut-all-ai.

    Three steps, same order every time:
      1. Persist the kill row (DB is the source of truth for durability).
      2. Mirror into in-process circuit_breaker so check() fails fast
         without a DB hit.
      3. Append an ops_audit_log entry. The audit write is fire-and-forget
         (see OpsLedgerService.log_action) so a logging outage cannot mask
         the kill.
    """
    revert_at = datetime.now(UTC) + timedelta(minutes=body.revert_after_minutes)
    open_for_s = float(body.revert_after_minutes * 60)

    resp = await (
        admin_supabase.table("ai_circuit_state")
        .upsert(
            {
                "scope": body.scope,
                "scope_key": body.scope_key,
                "state": "killed",
                "triggered_by_id": str(actor_id),
                "reason": body.reason,
                "revert_at": revert_at.isoformat(),
            },
            on_conflict="scope,scope_key",
        )
        .execute()
    )
    row = extract_one(resp)
    if row is None:
        raise RuntimeError("Circuit kill upsert returned no rows")

    circuit_breaker.force_open(body.scope, body.scope_key, open_for_s=open_for_s)

    await OpsLedgerService.log_action(
        admin_supabase,
        actor_id=actor_id,
        action="kill.trip",
        target_scope=body.scope,
        target_key=body.scope_key,
        reason=body.reason,
        payload={
            "revert_after_minutes": body.revert_after_minutes,
            "revert_at": revert_at.isoformat(),
        },
    )

    return KillActionResponse(
        scope=body.scope,
        scope_key=body.scope_key,
        state="killed",
        revert_at=revert_at,
        reason=body.reason,
    )


@router.post("/kill")
async def trip_kill(
    body: TripKillRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[KillActionResponse]:
    """Trip a manual kill on (scope, scope_key). Auto-reverts after
    ``revert_after_minutes`` (AD-5). New calls to the scope fail fast with
    ``CircuitOpenError`` until the revert timer elapses or an admin lifts
    the kill explicitly."""
    data = await _do_trip_kill(admin_supabase, actor_id=user.id, body=body)
    return SuccessResponse(data=data)


@router.post("/revert")
async def revert_kill(
    body: RevertKillRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[KillActionResponse]:
    """Lift a manual kill before the auto-revert timer elapses."""
    resp = await (
        admin_supabase.table("ai_circuit_state")
        .delete()
        .eq("scope", body.scope)
        .eq("scope_key", body.scope_key)
        .execute()
    )
    rows = extract_list(resp)
    if not rows:
        raise not_found("Circuit kill", f"{body.scope}:{body.scope_key}")

    circuit_breaker.reset(body.scope, body.scope_key)

    await OpsLedgerService.log_action(
        admin_supabase,
        actor_id=user.id,
        action="kill.revert",
        target_scope=body.scope,
        target_key=body.scope_key,
        reason=body.reason,
    )

    return SuccessResponse(
        data=KillActionResponse(
            scope=body.scope,
            scope_key=body.scope_key,
            state="closed",
            revert_at=None,
            reason=body.reason,
        ),
    )


@router.post("/kill/cut-all-ai")
async def cut_all_ai(
    body: CutAllAIRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[KillActionResponse]:
    """Master kill switch: trip ('provider', 'openrouter').

    D-5 semantics: only blocks NEW calls. In-flight requests run to
    completion with whatever attempt is currently underway (no retries).
    Uses the same path as the standard /kill endpoint; exposed separately
    so the UI can bind it to its own dramatic control without hardcoding
    the provider key.
    """
    trip_body = TripKillRequest(
        scope="provider",
        scope_key="openrouter",
        reason=body.reason,
        revert_after_minutes=body.revert_after_minutes,
    )
    data = await _do_trip_kill(admin_supabase, actor_id=user.id, body=trip_body)
    return SuccessResponse(data=data)


@router.post("/circuit/reset")
async def reset_circuit(
    body: ResetCircuitRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[KillActionResponse]:
    """Clear the in-process auto-state for (scope, scope_key). Useful when
    a breaker flapped due to a known-transient issue and the operator
    wants to skip the exponential backoff delay.

    No cache invalidation: ``reset`` only touches in-process breaker
    state, which ``OpsLedgerService.get_circuit_matrix`` reads live (no
    cache). The ledger / budget caches are derived from ``ai_usage_log``,
    not circuit state.
    """
    circuit_breaker.reset(body.scope, body.scope_key)

    await OpsLedgerService.log_action(
        admin_supabase,
        actor_id=user.id,
        action="circuit.reset",
        target_scope=body.scope,
        target_key=body.scope_key,
        reason=body.reason,
    )

    return SuccessResponse(
        data=KillActionResponse(
            scope=body.scope,
            scope_key=body.scope_key,
            state="closed",
            revert_at=None,
            reason=body.reason,
        ),
    )
