"""Periodic background task that auto-processes due resonances.

Runs as an asyncio task started from the FastAPI lifespan. Uses the same
service_role (admin) client pattern as bot architecture — this is a system actor.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.dependencies import get_admin_supabase
from backend.services.resonance_service import ResonanceService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_CHECK_INTERVAL = 60  # seconds
_DEFAULT_ENABLED = True


class ResonanceScheduler:
    """Periodic background task that auto-processes due resonances."""

    _task: asyncio.Task | None = None

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scheduler loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("Resonance auto-processor started")
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep → check for due resonances → process."""
        while True:
            interval = _DEFAULT_CHECK_INTERVAL
            try:
                admin = await get_admin_supabase()
                enabled, interval = await cls._load_config(admin)
                if enabled:
                    await cls._check_and_process(admin)
            except asyncio.CancelledError:
                logger.info("Resonance scheduler shutting down")
                raise
            except Exception as exc:
                # Transient connectivity errors are expected during DB restarts
                # — log at warning level to avoid Sentry noise.
                if type(exc).__name__ in ("ConnectError", "ConnectTimeout"):
                    logger.warning("Resonance scheduler: database unavailable, retrying in %ds", interval)
                else:
                    logger.exception("Resonance scheduler loop error")
            await asyncio.sleep(interval)

    @classmethod
    async def _load_config(cls, admin: Client) -> tuple[bool, int]:
        """Read scheduler config from platform_settings. Returns (enabled, interval)."""
        enabled = _DEFAULT_ENABLED
        interval = _DEFAULT_CHECK_INTERVAL
        try:
            _resp = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "resonance_auto_process_enabled",
                    "resonance_auto_process_interval_seconds",
                ])
                .execute()
            )
            rows = _resp.data or []
            for row in rows:
                key = row["setting_key"]
                val = row["setting_value"]
                if key == "resonance_auto_process_enabled":
                    enabled = str(val).lower() not in ("false", "0", "no")
                elif key == "resonance_auto_process_interval_seconds":
                    try:
                        interval = max(10, int(val))  # floor at 10s
                    except (ValueError, TypeError):
                        pass
        except Exception:
            logger.warning("Failed to load resonance scheduler config, using defaults")
        return enabled, interval

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
        due = response.data or []
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
                    "Auto-processed resonance %s — %d impact(s) created",
                    resonance_id,
                    len(impacts),
                    extra={"resonance_id": str(resonance_id), "impact_count": len(impacts)},
                )
            except Exception:
                logger.exception(
                    "Failed to auto-process resonance %s",
                    resonance_id,
                    extra={"resonance_id": str(resonance_id)},
                )
