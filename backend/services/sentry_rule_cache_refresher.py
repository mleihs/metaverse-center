"""Periodic reload of the Sentry rule cache (F14 follow-up).

Keeps :mod:`backend.services.sentry_rule_cache` in sync with the
``sentry_rules`` table without depending solely on admin-mutation
invalidation. Runs every 60 seconds; if a mutation reload fails (bug,
transient DB error, multi-worker drift once we outgrow AD-1), this
scheduler re-pulls the table so the ``_ops_before_send`` hook
eventually observes the change.

Complements the existing invalidation paths — does not replace them:

  * Admin mutations in :mod:`backend.services.sentry_rule_service`
    still trigger ``sentry_rule_cache.reload`` directly for
    sub-second visibility of rule edits.
  * Lifespan startup still primes the cache before traffic arrives.
  * This scheduler catches drift between those two events.

Same pattern as the P2.2 rollup scheduler and the Deferral-C revert
sweeper so lifecycle management is symmetric.
"""

from __future__ import annotations

import logging

from backend.services import sentry_rule_cache
from backend.services.social.scheduler_base import BaseSchedulerMixin
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_REFRESH_INTERVAL_SECONDS = 60


class SentryRuleCacheRefresher(BaseSchedulerMixin):
    """Background task that reloads the Sentry rule cache every minute."""

    _scheduler_name = "sentry_rule_cache_refresh"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        return {"enabled": True, "interval": _REFRESH_INTERVAL_SECONDS}

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        await sentry_rule_cache.reload(admin)
