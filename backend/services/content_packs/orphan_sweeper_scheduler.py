"""Scheduled companion to the manual orphan-branch sweep (A1.7 Phase 7b).

A weekly tick that runs :func:`sweep_orphan_branches` without the admin
having to click the Sweep-Orphans button. The sweep itself (classification
+ deletion) lives in :mod:`backend.services.content_packs.orphan_sweeper` —
this module only adds:

  * **Throttling** via a ``last_run_at`` timestamp stored in
    ``platform_settings``. Survives app restarts — when the loop wakes
    mid-interval (e.g. after a Railway redeploy) it skips until the full
    ``interval_days`` has elapsed.
  * **Runtime config** for ``enabled``, ``interval_days``, and
    ``min_age_days`` from ``platform_settings``, read fresh every tick so
    operators can adjust cadence without a redeploy.
  * **Sentry reporting** when per-branch delete failures occur — the
    manual endpoint surfaces those in its response body; the scheduler
    has no UI surface, so it pushes a ``capture_message`` so admins get
    paged instead of the failures disappearing into Railway logs.

Not in scope (deferred to Phase 7c):
  * Admin control panel. Until then the settings are flipped via SQL
    against ``platform_settings`` and observed via ``last_run_at``.

Design notes:
  * Default ``orphan_sweeper_enabled`` is ``false`` (gated launch). The
    first operator to flip it kicks off the first real sweep on the next
    tick — up to one ``_CHECK_INTERVAL_SECONDS`` of latency.
  * Scheduled runs are ``dry_run=False`` — the whole point of automation
    is actual deletion. Admins who want a preview still use the manual
    endpoint.
  * No audit-log entry. ``platform_settings.last_run_at`` + the
    structured logs below already carry the "when + what" signal; an
    audit row would need a synthetic system-user FK that ``audit_log``
    doesn't currently model. Adding one is bigger than this phase.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta

import httpx
import sentry_sdk
from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.content_drafts import SweepOrphansResult
from backend.services.content_packs.orphan_sweeper import (
    DEFAULT_MIN_AGE_DAYS,
    sweep_orphan_branches,
)
from backend.services.content_packs.publish import get_github_repo_config
from backend.services.github_app import get_github_app_client
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.settings import (
    load_platform_settings,
    parse_setting_bool,
    upsert_platform_setting,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# How often the loop wakes to check the throttle. The *sweep* cadence is
# ``interval_days`` (default 7); this constant only bounds how long after
# an operator flips ``enabled=true`` the first run takes to fire. 1h is
# a reasonable upper bound on that latency without hammering the DB.
_CHECK_INTERVAL_SECONDS = 3600

_DEFAULT_ENABLED = False
_DEFAULT_INTERVAL_DAYS = 7.0

_SETTING_ENABLED = "orphan_sweeper_enabled"
_SETTING_INTERVAL_DAYS = "orphan_sweeper_interval_days"
_SETTING_MIN_AGE_DAYS = "orphan_sweeper_min_age_days"
_SETTING_LAST_RUN_AT = "orphan_sweeper_last_run_at"


class OrphanSweeperScheduler(BaseSchedulerMixin):
    """Background task that periodically GCs orphan content-draft branches."""

    _scheduler_name = "orphan_sweeper"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read scheduler settings and build the loop config.

        Returns a dict with keys the base mixin expects (``enabled``,
        ``interval``) plus the throttle/sweep parameters this scheduler
        uses (``interval_days``, ``min_age_days``, ``last_run_at``).
        """
        config: dict = {
            "enabled": _DEFAULT_ENABLED,
            "interval": _CHECK_INTERVAL_SECONDS,
            "interval_days": _DEFAULT_INTERVAL_DAYS,
            "min_age_days": DEFAULT_MIN_AGE_DAYS,
            "last_run_at": None,
        }
        try:
            raw = await load_platform_settings(
                admin,
                [
                    _SETTING_ENABLED,
                    _SETTING_INTERVAL_DAYS,
                    _SETTING_MIN_AGE_DAYS,
                    _SETTING_LAST_RUN_AT,
                ],
            )
            if _SETTING_ENABLED in raw:
                config["enabled"] = parse_setting_bool(raw[_SETTING_ENABLED])
            if _SETTING_INTERVAL_DAYS in raw:
                config["interval_days"] = _parse_positive_float(
                    raw[_SETTING_INTERVAL_DAYS], _DEFAULT_INTERVAL_DAYS,
                )
            if _SETTING_MIN_AGE_DAYS in raw:
                config["min_age_days"] = _parse_positive_float(
                    raw[_SETTING_MIN_AGE_DAYS], DEFAULT_MIN_AGE_DAYS,
                )
            config["last_run_at"] = _parse_last_run_at(
                raw.get(_SETTING_LAST_RUN_AT),
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning(
                "Orphan-sweeper config load failed, using defaults",
                extra={"iteration": cls._iteration_count},
                exc_info=True,
            )
        return config

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """Throttle-check, then delegate to :meth:`run_sweep_and_persist`.

        Keeps the tick loop responsible for the *when* decision
        (``_is_due``) and hands the *how* (sweep + persist + report)
        to the shared execution method, so the admin "Run now"
        endpoint reaches the same sweep path minus the throttle.
        """
        now = datetime.now(UTC)
        if not _is_due(
            now=now,
            last_run_at=config["last_run_at"],
            interval_days=config["interval_days"],
        ):
            return

        logger.info(
            "Orphan-sweeper scheduled run starting",
            extra={
                "iteration": cls._iteration_count,
                "trigger": "scheduled",
                "interval_days": config["interval_days"],
                "min_age_days": config["min_age_days"],
            },
        )

        try:
            await cls.run_sweep_and_persist(admin, now=now, config=config)
        except HTTPException:
            # get_github_repo_config() signals missing env vars via
            # HTTPException. Treat as "skip this tick" — next tick
            # retries after the operator fixes the env.
            logger.warning(
                "Orphan-sweeper tick: GitHub repo env not configured; skipping",
                extra={"iteration": cls._iteration_count},
            )

    @classmethod
    async def run_sweep_and_persist(
        cls,
        admin: Client,
        *,
        now: datetime | None = None,
        config: dict | None = None,
    ) -> SweepOrphansResult:
        """Execute a sweep and persist ``last_run_at``.

        Shared by :meth:`_process_tick` (after the ``_is_due`` guard
        passes) and the admin ``POST /orphan-sweeper/run-now`` endpoint.
        Deliberately does **not** gate on the throttle — callers own that
        decision. Always ``dry_run=False``: the manual preview stays on
        the existing ``/sweep-orphans`` endpoint.

        Raises :class:`fastapi.HTTPException` from
        :func:`get_github_repo_config` when the ``GITHUB_REPO_OWNER`` /
        ``GITHUB_REPO_NAME`` env vars are unset — the scheduler tick
        catches it; the endpoint surfaces it as the underlying HTTP
        error so the admin sees a clear "env missing" message rather
        than a silent no-op.
        """
        if now is None:
            now = datetime.now(UTC)
        if config is None:
            config = await cls._load_config(admin)

        owner, repo = get_github_repo_config()
        client = get_github_app_client()
        result: SweepOrphansResult = await sweep_orphan_branches(
            client,
            owner,
            repo,
            min_age_days=config["min_age_days"],
            dry_run=False,
            now=now,
        )

        # Report BEFORE persisting so a platform_settings failure does not
        # swallow the sweep summary. Sweep is idempotent (already-deleted
        # refs drop out of ``_list_draft_batch_refs``), so re-running on the
        # next tick after a persist failure is safe.
        cls._report_result(result)
        await _persist_last_run_at(admin, now)
        return result

    @classmethod
    def _report_result(cls, result: SweepOrphansResult) -> None:
        """Surface the outcome — info log always, Sentry on delete failures."""
        if result.error_count > 0:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("orphan_sweeper_phase", "delete_errors")
                scope.set_context(
                    "orphan_sweeper",
                    {
                        "total_found": result.total_found,
                        "deleted_count": result.deleted_count,
                        "error_count": result.error_count,
                        # Cap to keep the Sentry payload small when a mass
                        # incident (e.g. token revoked) fails every delete.
                        "error_branches": [
                            {"name": b.name, "error": b.error}
                            for b in result.branches
                            if b.error is not None
                        ][:10],
                    },
                )
                sentry_sdk.capture_message(
                    f"Orphan-sweeper: {result.error_count} delete failure(s)",
                    level="warning",
                )
        logger.info(
            "Orphan-sweeper scheduled run complete",
            extra={
                "iteration": cls._iteration_count,
                "total_found": result.total_found,
                "deleted_count": result.deleted_count,
                "kept_count": result.kept_count,
                "error_count": result.error_count,
            },
        )


# ── Module-level helpers ──────────────────────────────────────────────────


def _parse_positive_float(raw: object, default: float) -> float:
    """Coerce a jsonb-loaded value into a strictly-positive float."""
    try:
        v = float(str(raw).strip('"'))
    except (TypeError, ValueError):
        return default
    return v if v > 0 else default


def _parse_last_run_at(raw: object) -> datetime | None:
    """Parse the jsonb-encoded last-run timestamp. None on missing/malformed."""
    if raw is None:
        return None
    stripped = str(raw).strip().strip('"')
    if not stripped or stripped.lower() == "null":
        return None
    try:
        dt = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _is_due(
    *,
    now: datetime,
    last_run_at: datetime | None,
    interval_days: float,
) -> bool:
    """True iff a scheduled sweep should fire this tick.

    First run (``last_run_at is None``) always fires. A ``now`` earlier
    than ``last_run_at`` (clock skew after a VM restart) is treated as
    "just ran" to avoid firing on every future tick until wall-time
    catches up — defer to the next tick instead.
    """
    if last_run_at is None:
        return True
    if now <= last_run_at:
        return False
    return (now - last_run_at) >= timedelta(days=interval_days)


async def _persist_last_run_at(admin: Client, now: datetime) -> None:
    """Write ``now`` to ``orphan_sweeper_last_run_at`` as a jsonb string.

    ``setting_value`` is jsonb; ``json.dumps`` produces the outer quotes
    so postgrest stores a JSON string that ``_parse_last_run_at`` then
    round-trips on the next tick.
    """
    await upsert_platform_setting(
        admin, _SETTING_LAST_RUN_AT, json.dumps(now.isoformat()),
    )
