"""Periodic refresh of the ``ai_usage_rollup_hour`` materialized view (P2.2).

Calls ``refresh_ai_usage_rollup_hour()`` every 60 seconds so the Bureau Ops
HeatmapPanel (P2.6) and the budget pre-check path (AD-3) read from a
sub-second index instead of scanning the raw ``ai_usage_log`` table.

Why this scheduler exists instead of ``pg_cron``:
    pg_cron requires a superuser grant that Supabase-hosted instances do
    not provide by default. Migration 229 checked: ``pg_extension`` on
    2026-04-21 contained only ``pg_stat_statements``. The Bureau Ops plan
    §11 explicitly names this scheduler as the documented fallback.

Design notes:
    * The refresh uses ``REFRESH MATERIALIZED VIEW CONCURRENTLY`` so the
      HeatmapPanel never sees a locked MV. Concurrent refreshes cannot
      overlap on the same MV, but the sequential structure of
      ``BaseSchedulerMixin._run_loop`` already guarantees a single
      in-flight tick per worker, so we never fire a second RPC before the
      first completes.
    * ``enabled`` is hardcoded True. Unlike the orphan sweeper there is
      no operator case for pausing the refresh — Heatmap + budget
      pre-check depend on it. A future toggle can graft onto
      ``platform_settings`` without changing the scheduler signature.
    * No ``last_run_at`` throttle. If the 60-second tick coincides with
      app boot or a Railway restart, the worst case is one extra refresh
      immediately after startup — cheap (CONCURRENTLY is incremental).
"""

from __future__ import annotations

import logging

from backend.services.social.scheduler_base import BaseSchedulerMixin
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_REFRESH_INTERVAL_SECONDS = 60


class AiUsageRollupScheduler(BaseSchedulerMixin):
    """Background task that refreshes ``ai_usage_rollup_hour`` every minute."""

    _scheduler_name = "ai_usage_rollup"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        return {"enabled": True, "interval": _REFRESH_INTERVAL_SECONDS}

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        await admin.rpc("refresh_ai_usage_rollup_hour").execute()
