"""Scheduled revert sweep for ``ai_circuit_state`` (Deferral C).

Once a minute, delete every row whose ``revert_at`` has elapsed and
reset the corresponding in-process circuit breaker. Without this
sweep, admin kills that auto-revert in the in-process state stay
visible in the DB + dashboard (and in ``get_circuit_matrix``) as
``killed`` until an admin manually reverts them — cosmetic leak, but
confusing enough to matter during an incident review.

Design notes:
    * Reuses the same ``BaseSchedulerMixin`` as the rollup refresher
      so lifespan management is symmetric.
    * 60-second interval gives a maximum of one minute of cosmetic
      lag between the auto-revert timer elapsing and the dashboard
      reflecting the revert.
    * Delete + reset are sequenced to keep DB as source of truth:
      if ``circuit_breaker.reset`` raised for some reason (it
      currently cannot), the DB row would already be gone and the
      next startup rehydration would be clean.
    * No audit-log entry. ``kill.revert`` audits come from admin
      actions; auto-reverts are expected timer behaviour, not
      incidents.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from backend.services.circuit_breaker_service import circuit_breaker
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_SWEEP_INTERVAL_SECONDS = 60


class CircuitRevertSweeper(BaseSchedulerMixin):
    """Background task that deletes expired ai_circuit_state rows."""

    _scheduler_name = "circuit_revert_sweep"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        return {"enabled": True, "interval": _SWEEP_INTERVAL_SECONDS}

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        now_iso = datetime.now(UTC).isoformat()
        # ``.delete()`` with ``returning='representation'`` is supabase-py's
        # default — the response.data carries the rows that were removed,
        # so we can fan out reset() calls without a separate read.
        resp = await (
            admin.table("ai_circuit_state")
            .delete()
            .lte("revert_at", now_iso)
            .execute()
        )
        rows = extract_list(resp)
        for row in rows:
            scope = str(row.get("scope") or "")
            scope_key = str(row.get("scope_key") or "")
            if not scope or not scope_key:
                continue
            circuit_breaker.reset(scope, scope_key)
        if rows:
            logger.info(
                "CircuitRevertSweeper reverted %d expired kill(s)",
                len(rows),
            )
