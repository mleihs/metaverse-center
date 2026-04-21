"""Budget enforcement for LLM / image-generation calls (P1).

Implements AD-3 of the Bureau Ops plan: pre-call blocking budget checks
keyed on ``ai_budget`` (migration 228). Over-budget scopes raise
``BudgetExceededError``; soft-warn thresholds emit a Sentry breadcrumb.
Missing budget rows = fail-open (allow). See
docs/plans/bureau-ops-implementation-plan.md §3 AD-3.

Architecture:
- State-of-the-world is queried from ``get_budget_states`` (one RPC call
  returns all ai_budget rows with their current-period spend attached).
  The RPC aggregates ai_usage_log directly; the P2 materialized view
  (migration 229) will replace the per-call subquery at sub-millisecond
  latency.
- A 15-second in-process cache absorbs polling bursts without missing
  the threshold crossings that matter: the window is short enough that
  a budget crossing takes effect within one typical pre_check interval,
  and long enough that 10 requests/second don't burn 10 RPCs.
- The service is **not wired into OpenRouterService** in P1 because the
  hot path lacks the purpose+simulation+user context (see handover doc).
  Integration happens incrementally in P2 by having each caller
  (heartbeat, forge, chat-memory, …) invoke pre_check() with its own
  context. The admin CRUD endpoints are already live so budget rows
  can be managed today.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import sentry_sdk

from backend.models.bureau_ops import BudgetCap, BudgetUpsertRequest
from backend.services.ops_ledger_service import OpsLedgerService
from backend.utils.errors import not_found
from backend.utils.responses import extract_list, extract_one
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_BUDGET_CACHE_TTL = 15.0  # seconds — see module docstring

# ── Cache ────────────────────────────────────────────────────────────────

_budget_cache: tuple[list[dict[str, Any]], float] | None = None


def invalidate_budget_cache() -> None:
    """Called after every mutation so the next pre_check / list reflects
    the change without waiting for the TTL."""
    global _budget_cache  # noqa: PLW0603 — intentional module-level cache
    _budget_cache = None


async def _fetch_budget_states(admin_supabase: Client) -> list[dict[str, Any]]:
    global _budget_cache  # noqa: PLW0603
    if _budget_cache is not None:
        rows, expires_at = _budget_cache
        if time.monotonic() < expires_at:
            return rows
    resp = await admin_supabase.rpc("get_budget_states", {}).execute()
    rows = resp.data if isinstance(resp.data, list) else []
    _budget_cache = (rows, time.monotonic() + _BUDGET_CACHE_TTL)
    return rows


# ── Errors ───────────────────────────────────────────────────────────────


class BudgetExceededError(Exception):
    """Raised by ``pre_check`` when a hard block is in effect."""

    def __init__(
        self,
        *,
        scope: str,
        scope_key: str,
        period: str,
        current_usd: float,
        max_usd: float,
    ) -> None:
        self.scope = scope
        self.scope_key = scope_key
        self.period = period
        self.current_usd = current_usd
        self.max_usd = max_usd
        super().__init__(
            f"Budget exceeded for {scope}:{scope_key} "
            f"({period}): ${current_usd:.4f} >= ${max_usd:.4f}",
        )


# ── Service ──────────────────────────────────────────────────────────────


class BudgetEnforcementService:
    """Budget CRUD + pre-call enforcement."""

    # ── Pre-call enforcement ────────────────────────────────────────────

    @staticmethod
    async def pre_check(
        admin_supabase: Client,
        *,
        purpose: str,
        simulation_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> None:
        """Raise ``BudgetExceededError`` if any applicable budget is blocked.

        Emits a Sentry breadcrumb when any applicable budget is above its
        soft-warn threshold but still below its hard-block threshold.

        Applicable budgets for the caller:
            - all ``enabled`` ``global:global`` rows
            - all ``enabled`` ``purpose:{purpose}`` rows
            - all ``enabled`` ``simulation:{simulation_id}`` rows (if provided)
            - all ``enabled`` ``user:{user_id}`` rows (if provided)

        Rows without matching scope_key are ignored. Fail-open: if no row
        applies, the call is allowed.
        """
        rows = await _fetch_budget_states(admin_supabase)
        if not rows:
            return

        keys: list[tuple[str, str]] = [("global", "global"), ("purpose", purpose)]
        if simulation_id is not None:
            keys.append(("simulation", str(simulation_id)))
        if user_id is not None:
            keys.append(("user", str(user_id)))

        for row in rows:
            if not row.get("enabled"):
                continue
            scope = row.get("scope")
            scope_key = row.get("scope_key")
            if (scope, scope_key) not in keys:
                continue
            decision = _evaluate_budget(row)
            if decision == "block":
                raise BudgetExceededError(
                    scope=str(scope),
                    scope_key=str(scope_key),
                    period=str(row.get("period")),
                    current_usd=float(row.get("current_usd") or 0.0),
                    max_usd=float(row.get("max_usd") or 0.0),
                )
            if decision == "warn":
                sentry_sdk.add_breadcrumb(
                    category="ops",
                    message=(
                        f"Budget soft-warn: {scope}:{scope_key} "
                        f"{row.get('period')} at "
                        f"${float(row.get('current_usd') or 0):.4f} / "
                        f"${float(row.get('max_usd') or 0):.4f}"
                    ),
                    level="warning",
                    data={
                        "scope": scope,
                        "scope_key": scope_key,
                        "period": row.get("period"),
                        "current_usd": row.get("current_usd"),
                        "max_usd": row.get("max_usd"),
                    },
                )

    # ── CRUD for the Budget panel ───────────────────────────────────────

    @staticmethod
    async def list_budgets(admin_supabase: Client) -> list[BudgetCap]:
        """Return all budget rows with current-period spend rolled up."""
        rows = await _fetch_budget_states(admin_supabase)
        return [_row_to_budget(r) for r in rows]

    @staticmethod
    async def upsert_budget(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        body: BudgetUpsertRequest,
        budget_id: UUID | None = None,
    ) -> BudgetCap:
        """Create or update a budget row. ``budget_id`` disambiguates
        updates from creates — plain upsert on (scope, scope_key, period)
        would coalesce distinct-but-same-key rows silently."""
        _validate_budget_invariants(body)

        payload = {
            "scope": body.scope,
            "scope_key": body.scope_key,
            "period": body.period,
            "max_usd": body.max_usd,
            "max_calls": body.max_calls,
            "soft_warn_pct": body.soft_warn_pct,
            "hard_block_pct": body.hard_block_pct,
            "enabled": body.enabled,
            "updated_by_id": str(actor_id),
        }

        if budget_id is not None:
            resp = await (
                admin_supabase.table("ai_budget")
                .update(payload)
                .eq("id", str(budget_id))
                .execute()
            )
            row = extract_one(resp)
            if row is None:
                raise not_found("Budget", budget_id)
        else:
            resp = await (
                admin_supabase.table("ai_budget")
                .upsert(payload, on_conflict="scope,scope_key,period")
                .execute()
            )
            row = extract_one(resp)
            if row is None:
                raise RuntimeError("Budget upsert returned no rows")

        invalidate_budget_cache()

        await OpsLedgerService.log_action(
            admin_supabase,
            actor_id=actor_id,
            action="budget.upsert",
            target_scope=body.scope,
            target_key=body.scope_key,
            reason=body.reason,
            payload={
                "period": body.period,
                "max_usd": float(body.max_usd),
                "soft_warn_pct": body.soft_warn_pct,
                "hard_block_pct": body.hard_block_pct,
                "enabled": body.enabled,
            },
        )
        return _row_to_budget({**row, "current_usd": 0, "current_calls": 0})

    @staticmethod
    async def delete_budget(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        budget_id: UUID,
        reason: str,
    ) -> None:
        """Delete a budget row. Audit-log entry captured with the reason."""
        resp = await (
            admin_supabase.table("ai_budget")
            .select("scope, scope_key, period")
            .eq("id", str(budget_id))
            .limit(1)
            .execute()
        )
        rows = extract_list(resp)
        if not rows:
            raise not_found("Budget", budget_id)
        row = rows[0]

        await (
            admin_supabase.table("ai_budget")
            .delete()
            .eq("id", str(budget_id))
            .execute()
        )
        invalidate_budget_cache()

        await OpsLedgerService.log_action(
            admin_supabase,
            actor_id=actor_id,
            action="budget.delete",
            target_scope=row.get("scope"),
            target_key=row.get("scope_key"),
            reason=reason,
            payload={"period": row.get("period")},
        )


# ── Internals ────────────────────────────────────────────────────────────


def _evaluate_budget(row: dict[str, Any]) -> str:
    """Map a budget row to one of 'ok' / 'warn' / 'block'."""
    max_usd = float(row.get("max_usd") or 0.0)
    current = float(row.get("current_usd") or 0.0)
    if max_usd <= 0:
        return "ok"
    pct = (current / max_usd) * 100.0
    hard = float(row.get("hard_block_pct") or 100)
    soft = float(row.get("soft_warn_pct") or 75)
    if pct >= hard:
        return "block"
    if pct >= soft:
        return "warn"
    return "ok"


def _validate_budget_invariants(body: BudgetUpsertRequest) -> None:
    """DB CHECKs cover most cases; this enforces soft <= hard at the
    service layer (migration 228 leaves this as a service invariant for
    experimentation flexibility — see plan §4.3 invariant #3)."""
    if body.soft_warn_pct > body.hard_block_pct:
        raise ValueError(
            f"soft_warn_pct ({body.soft_warn_pct}) must be "
            f"<= hard_block_pct ({body.hard_block_pct})"
        )


def _row_to_budget(row: dict[str, Any]) -> BudgetCap:
    return BudgetCap(
        id=UUID(str(row["id"])),
        scope=row["scope"],
        scope_key=row["scope_key"],
        period=row["period"],
        max_usd=float(row["max_usd"]),
        max_calls=row.get("max_calls"),
        soft_warn_pct=int(row.get("soft_warn_pct") or 75),
        hard_block_pct=int(row.get("hard_block_pct") or 100),
        enabled=bool(row.get("enabled", True)),
        updated_by_id=UUID(str(row["updated_by_id"])) if row.get("updated_by_id") else None,
        updated_at=_parse_ts(row["updated_at"]),
        created_at=_parse_ts(row["created_at"]),
        current_usd=float(row.get("current_usd") or 0.0),
        current_calls=int(row.get("current_calls") or 0),
    )


def _parse_ts(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return datetime.now(UTC)
