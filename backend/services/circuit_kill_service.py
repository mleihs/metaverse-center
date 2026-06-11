"""Durable circuit-kill orchestration (Bureau Ops quarantine panel).

Owns the ``ai_circuit_state`` WRITE path: persisting manual kills and
lifting them again. Each operation pairs three steps that must stay in
lockstep:

  1. ``ai_circuit_state`` row (DB is the source of truth for durability).
  2. In-process ``circuit_breaker`` mirror so ``check()`` fails fast
     without a DB hit.
  3. ``ops_audit_log`` entry. The audit write is fire-and-forget
     (see ``OpsLedgerService.log_action``) so a logging outage cannot
     mask the kill.

Related ``ai_circuit_state`` owners: reads live in ``OpsLedgerService``
(circuit matrix, startup rehydrate); expiry cleanup lives in
``circuit_revert_sweeper``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from backend.models.bureau_ops import KillActionResponse, RevertKillRequest, TripKillRequest
from backend.services.circuit_breaker_service import circuit_breaker
from backend.services.ops_ledger_service import OpsLedgerService
from backend.utils.errors import not_found
from backend.utils.responses import extract_list, extract_one
from supabase import AsyncClient as Client


class CircuitKillService:
    """Trip and revert durable manual kills on (scope, scope_key)."""

    @staticmethod
    async def trip(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        body: TripKillRequest,
    ) -> KillActionResponse:
        """Trip a manual kill. Auto-reverts after ``revert_after_minutes``
        (AD-5); until then new calls to the scope fail fast with
        ``CircuitOpenError``."""
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

    @staticmethod
    async def revert(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        body: RevertKillRequest,
    ) -> KillActionResponse:
        """Lift a manual kill before the auto-revert timer elapses.

        Raises ``not_found`` when no durable kill row exists for the
        (scope, scope_key) pair.
        """
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
            actor_id=actor_id,
            action="kill.revert",
            target_scope=body.scope,
            target_key=body.scope_key,
            reason=body.reason,
        )

        return KillActionResponse(
            scope=body.scope,
            scope_key=body.scope_key,
            state="closed",
            revert_at=None,
            reason=body.reason,
        )
