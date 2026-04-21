"""Read-facade for the Bureau Ops admin panel (P1).

Aggregates data from ``ai_usage_log`` (migration 150) + ``ai_circuit_state``,
``ai_budget``, ``ops_audit_log``, ``sentry_rules`` (migration 228) into the
typed DTOs defined in ``backend/models/bureau_ops.py``.

Responsibilities:
- Serve the LedgerPanel hero tiles (today / month / last-hour totals +
  hourly sparkline trend) via the ``get_ops_ledger`` RPC.
- Serve the FirehosePanel initial page (most-recent ``ai_usage_log`` rows)
  — subsequent updates arrive via Supabase Realtime, not through this
  service.
- Serve the QuarantinePanel circuit matrix — combines the in-process
  ``CircuitBreakerService.snapshot()`` with the persisted
  ``ai_circuit_state`` kill overrides.
- Serve the ops audit log (read). Mutations are written by
  ``log_action`` from this service; every ``/admin/ops/*`` mutation
  endpoint is expected to call it with a non-empty reason.

The caller is always the ``/admin/ops/*`` router, which uses
``get_admin_supabase`` (service_role) — this module never sees user JWTs.

30-second server cache is applied to ``get_ledger_snapshot`` because the
hot path is dashboard polling: multiple admins hitting the same payload
every 30s would otherwise burn aggregate queries. Firehose + circuit
matrix skip the cache — they are cheap (small LIMIT or in-process).
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from backend.models.bureau_ops import (
    CircuitEntry,
    CircuitMatrix,
    CircuitScope,
    CircuitState,
    FirehoseEntry,
    LedgerBreakdownRow,
    LedgerMetric,
    LedgerSnapshot,
    OpsAuditEntry,
)
from backend.services.circuit_breaker_service import circuit_breaker
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Cache ────────────────────────────────────────────────────────────────

_LEDGER_TTL_SECONDS = 30.0

# Module-level cache keyed by a sentinel string — the underlying admin
# client is always the same service_role instance across requests, so the
# cache hit-rate is high. Swap to a per-scope key if multi-tenant projection
# is added later.
_ledger_cache: tuple[LedgerSnapshot, float] | None = None


def _cache_hit() -> LedgerSnapshot | None:
    if _ledger_cache is None:
        return None
    snap, expires_at = _ledger_cache
    if time.monotonic() >= expires_at:
        return None
    return snap


def _cache_store(snap: LedgerSnapshot) -> None:
    global _ledger_cache  # noqa: PLW0603 — deliberate module-level cache
    _ledger_cache = (snap, time.monotonic() + _LEDGER_TTL_SECONDS)


def invalidate_ledger_cache() -> None:
    """Drop the ledger cache. Called by mutation endpoints that would
    otherwise show stale numbers (e.g. after a kill + revert cycle where
    the operator wants to verify new cost attribution immediately)."""
    global _ledger_cache  # noqa: PLW0603
    _ledger_cache = None


# ── Ledger snapshot ──────────────────────────────────────────────────────


def _parse_metric(row: dict[str, Any] | None) -> LedgerMetric:
    if not row:
        return LedgerMetric()
    return LedgerMetric(
        calls=int(row.get("calls") or 0),
        tokens=int(row.get("tokens") or 0),
        cost_usd=float(row.get("cost_usd") or 0.0),
    )


def _parse_breakdown(rows: list[dict[str, Any]] | None) -> list[LedgerBreakdownRow]:
    if not rows:
        return []
    return [
        LedgerBreakdownRow(
            key=str(r.get("key") or ""),
            calls=int(r.get("calls") or 0),
            tokens=int(r.get("tokens") or 0),
            cost_usd=float(r.get("cost_usd") or 0.0),
        )
        for r in rows
    ]


def _parse_trend(rows: list[dict[str, Any]] | None) -> list[LedgerMetric]:
    if not rows:
        return []
    return [
        LedgerMetric(
            calls=int(r.get("calls") or 0),
            tokens=int(r.get("tokens") or 0),
            cost_usd=float(r.get("cost_usd") or 0.0),
        )
        for r in rows
    ]


class OpsLedgerService:
    """Read-facade over ops tables + in-process circuit state."""

    @staticmethod
    async def get_ledger_snapshot(admin_supabase: Client) -> LedgerSnapshot:
        """Return the full ledger snapshot. 30s server cache."""
        cached = _cache_hit()
        if cached is not None:
            return cached

        resp = await admin_supabase.rpc("get_ops_ledger", {}).execute()
        data = resp.data or {}
        generated_at_raw = data.get("generated_at")
        generated_at = (
            _parse_timestamp(generated_at_raw) if generated_at_raw else datetime.now(UTC)
        )
        snap = LedgerSnapshot(
            today=_parse_metric(data.get("today")),
            month=_parse_metric(data.get("month")),
            last_hour=_parse_metric(data.get("last_hour")),
            hourly_trend=_parse_trend(data.get("hourly_trend")),
            by_purpose=_parse_breakdown(data.get("by_purpose")),
            by_model=_parse_breakdown(data.get("by_model")),
            by_provider=_parse_breakdown(data.get("by_provider")),
            generated_at=generated_at,
        )
        _cache_store(snap)
        return snap

    # ── Firehose ────────────────────────────────────────────────────────

    @staticmethod
    async def get_firehose(
        admin_supabase: Client,
        *,
        limit: int = 50,
    ) -> list[FirehoseEntry]:
        """Fetch the last ``limit`` ai_usage_log rows for the firehose REST
        initial page. Subsequent rows arrive via Realtime subscription.

        ``metadata`` is deliberately omitted from the projection — D-4
        mandates that prompt bodies never leak into the firehose view.
        """
        resp = await (
            admin_supabase.table("ai_usage_log")
            .select(
                "id, created_at, provider, model, purpose, "
                "total_tokens, estimated_cost_usd, duration_ms, "
                "simulation_id, user_id, key_source, metadata"
            )
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = extract_list(resp)
        return [_row_to_firehose(r) for r in rows]

    # ── Circuit matrix ──────────────────────────────────────────────────

    @staticmethod
    async def get_circuit_matrix(admin_supabase: Client) -> CircuitMatrix:
        """Combined in-process + persisted circuit state.

        ``circuit_breaker.snapshot()`` reports auto-state per known
        (scope, scope_key) — closed / half_open / open. ``ai_circuit_state``
        holds admin-kill overrides that supersede the auto-state (and
        persist across worker restarts). A row appears in either source
        (or both).
        """
        # In-process auto-state
        auto_entries: dict[tuple[str, str], CircuitEntry] = {}
        for snap in circuit_breaker.snapshot():
            scope = _coerce_scope(snap["scope"])
            if scope is None:
                continue
            key = snap["scope_key"]
            auto_entries[(scope, key)] = CircuitEntry(
                scope=scope,
                scope_key=key,
                state=_coerce_runtime_state(snap["state"]),
                failures_in_window=int(snap.get("failures_in_window") or 0),
                opens_until_s=float(snap.get("opens_until_s") or 0.0),
                consecutive_opens=int(snap.get("consecutive_opens") or 0),
            )

        # Persisted admin overrides
        resp = await (
            admin_supabase.table("ai_circuit_state")
            .select("scope, scope_key, state, reason, revert_at, triggered_by_id")
            .execute()
        )
        for row in extract_list(resp):
            scope = _coerce_scope(row.get("scope"))
            if scope is None or str(row.get("state") or "") != "killed":
                continue
            key = str(row.get("scope_key") or "")
            # Preserve failures_in_window from the in-process entry if present —
            # the admin panel shows it as context ("5 failures seen before kill").
            existing = auto_entries.get((scope, key))
            failures = existing.failures_in_window if existing else 0
            auto_entries[(scope, key)] = CircuitEntry(
                scope=scope,
                scope_key=key,
                state="killed",
                failures_in_window=failures,
                opens_until_s=0.0,
                consecutive_opens=0,
                killed_reason=str(row.get("reason") or ""),
                killed_revert_at=_parse_timestamp(row.get("revert_at")),
                killed_by_id=_parse_uuid(row.get("triggered_by_id")),
            )

        entries = sorted(
            auto_entries.values(),
            key=lambda e: (e.scope, e.scope_key),
        )
        return CircuitMatrix(entries=entries, generated_at=datetime.now(UTC))

    # ── Audit log (read) ────────────────────────────────────────────────

    @staticmethod
    async def get_audit_log(
        admin_supabase: Client,
        *,
        days: int = 7,
        limit: int = 50,
    ) -> list[OpsAuditEntry]:
        """Recent ops_audit_log entries, newest first."""
        since = _iso_days_ago(days)
        resp = await (
            admin_supabase.table("ops_audit_log")
            .select("*")
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = extract_list(resp)
        return [_row_to_audit(r) for r in rows]

    # ── Audit log (write) ───────────────────────────────────────────────

    @staticmethod
    async def log_action(
        admin_supabase: Client,
        *,
        actor_id: UUID | None,
        action: str,
        target_scope: str | None,
        target_key: str | None,
        reason: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """Append a row to ops_audit_log. Reason must satisfy the CHECK
        (length(trim(reason)) >= 3) from migration 228 — callers that do
        not collect a reason should reject the request before getting here.
        """
        try:
            await (
                admin_supabase.table("ops_audit_log")
                .insert(
                    {
                        "actor_id": str(actor_id) if actor_id else None,
                        "action": action,
                        "target_scope": target_scope,
                        "target_key": target_key,
                        "reason": reason,
                        "payload": payload or {},
                    }
                )
                .execute()
            )
        except Exception:  # noqa: BLE001 — audit-log failure must never abort the mutation
            logger.warning(
                "Failed to write ops audit entry (non-blocking)",
                extra={
                    "action": action,
                    "target_scope": target_scope,
                    "target_key": target_key,
                },
                exc_info=True,
            )


# ── Row → DTO helpers ────────────────────────────────────────────────────


_RUNTIME_STATES: set[str] = {"closed", "half_open", "open"}


def _coerce_scope(raw: object) -> CircuitScope | None:
    """Coerce a raw scope string to a typed CircuitScope or None."""
    if raw in ("provider", "model", "purpose", "global"):
        return raw  # type: ignore[return-value]
    return None


def _coerce_runtime_state(raw: str) -> CircuitState:
    """Coerce raw in-process state to CircuitState (never 'killed' here)."""
    return raw if raw in _RUNTIME_STATES else "closed"  # type: ignore[return-value]


def _row_to_firehose(row: dict[str, Any]) -> FirehoseEntry:
    metadata = row.get("metadata") or {}
    status = "error" if isinstance(metadata, dict) and metadata.get("status") == "error" else "ok"
    return FirehoseEntry(
        id=_require_uuid(row["id"]),
        created_at=_parse_timestamp(row["created_at"]) or datetime.now(UTC),
        provider=str(row.get("provider") or ""),
        model=str(row.get("model") or ""),
        purpose=str(row.get("purpose") or ""),
        total_tokens=int(row.get("total_tokens") or 0),
        estimated_cost_usd=float(row.get("estimated_cost_usd") or 0.0),
        duration_ms=int(row.get("duration_ms") or 0),
        simulation_id=_parse_uuid(row.get("simulation_id")),
        user_id=_parse_uuid(row.get("user_id")),
        key_source=str(row.get("key_source") or "platform"),
        status=status,
    )


def _row_to_audit(row: dict[str, Any]) -> OpsAuditEntry:
    return OpsAuditEntry(
        id=_require_uuid(row["id"]),
        actor_id=_parse_uuid(row.get("actor_id")),
        action=str(row.get("action") or ""),
        target_scope=row.get("target_scope"),
        target_key=row.get("target_key"),
        reason=str(row.get("reason") or ""),
        payload=row.get("payload") or {},
        created_at=_parse_timestamp(row["created_at"]) or datetime.now(UTC),
    )


def _parse_uuid(value: object) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _require_uuid(value: object) -> UUID:
    parsed = _parse_uuid(value)
    if parsed is None:
        raise ValueError(f"Expected UUID, got {value!r}")
    return parsed


def _parse_timestamp(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            # Supabase emits RFC 3339 with 'Z' or offset.
            normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
            parsed = datetime.fromisoformat(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        except ValueError:
            return None
    return None


def _iso_days_ago(days: int) -> str:
    from datetime import timedelta

    return (datetime.now(UTC) - timedelta(days=days)).isoformat()
