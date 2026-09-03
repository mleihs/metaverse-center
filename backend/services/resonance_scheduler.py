"""Periodic background task that auto-processes due resonances.

Runs as an asyncio task started from the FastAPI lifespan. Uses the same
service_role (admin) client pattern as bot architecture — this is a system actor.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.resonance_service import ResonanceService
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.responses import extract_list
from backend.utils.settings import parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_CHECK_INTERVAL = 60  # seconds
_DEFAULT_ENABLED = True


class ResonanceScheduler(BaseSchedulerMixin):
    """Periodic background task that auto-processes due resonances.

    Inherits the resilient run-loop from BaseSchedulerMixin (the silent-tick-death
    guard, tagged Sentry capture, and transient-connectivity handling); only the
    config gate and the per-tick work are resonance-specific. Previously this
    class hand-rolled the exact same 5-clause loop, with weaker observability (an
    untagged capture_exception in the middle clause).
    """

    _scheduler_name = "resonance"

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """One scheduler tick: process all due resonances."""
        await cls._check_and_process(admin)

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read scheduler config from platform_settings. Returns {enabled, interval}."""
        enabled = _DEFAULT_ENABLED
        interval = _DEFAULT_CHECK_INTERVAL
        try:
            _resp = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_(
                    "setting_key",
                    [
                        "resonance_auto_process_enabled",
                        "resonance_auto_process_interval_seconds",
                    ],
                )
                .execute()
            )
            rows = extract_list(_resp)
            for row in rows:
                key = row["setting_key"]
                val = row["setting_value"]
                if key == "resonance_auto_process_enabled":
                    # F32 semantics: fail-closed positive match. A jsonb null
                    # or unrecognised string must not arm the scheduler.
                    enabled = parse_setting_bool(val)
                elif key == "resonance_auto_process_interval_seconds":
                    try:
                        interval = max(10, int(val))  # floor at 10s
                    except (ValueError, TypeError):
                        pass
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.warning("Failed to load resonance scheduler config, using defaults")
        return {"enabled": enabled, "interval": interval}

    @classmethod
    async def _check_and_process(cls, admin: Client) -> None:
        """Query due resonances and process each one."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin.table("substrate_resonances")
            .select("id")
            .eq("status", "detected")
            .lte("impacts_at", now)
            .is_("deleted_at", "null")
            .execute()
        )
        due = extract_list(response)
        if not due:
            return

        logger.info("Found %d due resonance(s) to auto-process", len(due))

        for row in due:
            resonance_id = UUID(row["id"])
            try:
                impacts = await ResonanceService.process_impact(
                    admin,
                    resonance_id,
                    # System actor — use a zero UUID to indicate automated processing
                    user_id=UUID("00000000-0000-0000-0000-000000000000"),
                )
                logger.info(
                    "Auto-processed resonance %s – %d impact(s) created",
                    resonance_id,
                    len(impacts),
                    extra={"resonance_id": str(resonance_id), "impact_count": len(impacts)},
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception(
                    "Failed to auto-process resonance %s",
                    resonance_id,
                    extra={"resonance_id": str(resonance_id)},
                )
