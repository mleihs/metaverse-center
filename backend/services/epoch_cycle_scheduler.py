"""Periodic background task that auto-resolves epoch cycles at deadline.

Architecture: Hybrid (eager asyncio timer + polling sweep)
- Eager: asyncio timers for known deadlines (sub-second precision)
- Sweep: 30s polling for missed/unknown deadlines (durability guarantee)

Both paths converge on fn_check_and_resolve_deadline CAS RPC — only one
caller wins, the other gets resolved=false. Safe under concurrent workers.

Follows the ResonanceScheduler pattern (lifespan registration).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.models.epoch import DEFAULT_EPOCH_CONFIG
from backend.services.battle_log_service import BattleLogService
from backend.services.cycle_notification_service import CycleNotificationService
from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import _nt, render_deadline_reminder
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = DEFAULT_EPOCH_CONFIG

_SWEEP_INTERVAL = 30  # seconds

#: How far ahead of a cycle deadline the reminder goes out (Handoff P2.17).
#: Two hours is the handoff's figure; it is a lead time, not a window — the
#: sweep runs every 30 s and `email_log` is what keeps it to one mail per
#: player and cycle. A window would have needed to be wider than the tick and
#: would still have relied on the same guard.
_REMINDER_LEAD_HOURS = 2


class EpochCycleScheduler(BaseSchedulerMixin):
    """Periodic background task that auto-resolves epoch cycles at deadline.

    The 30s polling sweep is the durability safety net; it inherits the resilient
    run-loop from BaseSchedulerMixin (the silent-tick-death guard + tagged Sentry
    capture). The eager-timer subsystem (sub-second precision for known deadlines)
    is epoch-cycle-specific and layered on top via the start() override.
    Previously this class hand-rolled the same loop with an untagged
    capture_exception in the middle clause.
    """

    _scheduler_name = "epoch_cycle"
    _eager_timers: dict[str, asyncio.Task] = {}

    # ── Lifecycle ────────────────────────────────────────────

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the sweep loop (via the mixin) + seed eager timers."""
        task = await super().start()
        await cls._seed_eager_timers()
        return task

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Sweep runs unconditionally on a fixed interval (no platform_settings gate)."""
        return {"enabled": True, "interval": _SWEEP_INTERVAL}

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """One sweep tick: warn before a deadline, resolve after it."""
        await cls._sweep_deadline_reminders(admin)
        await cls._sweep_expired_cycles(admin)

    # ── Deadline Reminder (Handoff P2.17) ────────────────────

    @classmethod
    async def _sweep_deadline_reminders(cls, admin: Client) -> None:
        """Warn players whose orders are still open shortly before resolution.

        The system used to deduct RP and hand a seat to an AI with no notice at
        all; the player learned of it from the next briefing, after the fact.

        Failures are swallowed per epoch on purpose: a reminder that cannot be
        sent must never stop `_sweep_expired_cycles` from running in the same
        tick. Missing a warning is bad; missing the resolution is worse.
        """
        now = datetime.now(UTC)
        horizon = now + timedelta(hours=_REMINDER_LEAD_HOURS)
        resp = await (
            admin.table("game_epochs")
            .select("id, name, current_cycle, config, cycle_deadline_at")
            .in_("status", ["foundation", "competition", "reckoning"])
            .not_.is_("cycle_deadline_at", "null")
            .gt("cycle_deadline_at", now.isoformat())
            .lte("cycle_deadline_at", horizon.isoformat())
            .execute()
        )
        for epoch in extract_list(resp):
            try:
                await cls._remind_open_orders(admin, epoch, now=now)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.exception(
                    "Deadline reminder failed for epoch %s",
                    epoch.get("id"),
                    extra={"epoch_id": epoch.get("id")},
                )
                sentry_sdk.capture_exception(exc)

    @classmethod
    async def _remind_open_orders(cls, admin: Client, epoch: dict, *, now: datetime) -> int:
        """Send the reminder to every player of one epoch who has not filed."""
        epoch_id = str(epoch["id"])
        cycle = int(epoch.get("current_cycle") or 0)
        config = {**DEFAULT_EPOCH_CONFIG, **(epoch.get("config") or {})}

        # Who still owes orders. Bots are skipped: they do not read mail, and a
        # participant replaced by an AI has already lost the seat this warns about.
        pending_resp = await (
            admin.table("epoch_participants")
            .select("user_id, consecutive_afk_cycles")
            .eq("epoch_id", epoch_id)
            .eq("has_acted_this_cycle", False)
            .eq("is_bot", False)
            .not_.is_("user_id", "null")
            .execute()
        )
        pending = {row["user_id"]: row for row in extract_list(pending_resp)}
        if not pending:
            return 0

        # `notification_type` gates each recipient on the preference of the same
        # name, so `deadline_reminder` is honoured without a second lookup.
        recipients = await CycleNotificationService.recipients_for(
            admin, epoch_id, notification_type="deadline_reminder"
        )

        # Idempotency, not a counter: one successful send per player and cycle.
        # A failed attempt stays eligible — `email_log` records failures too, and
        # a warning nobody received is not a warning that was given.
        sent_resp = await (
            admin.table("email_log")
            .select("recipient_user_id")
            .eq("template", "deadline_reminder")
            .eq("epoch_id", epoch_id)
            .eq("cycle_number", cycle)
            .eq("ok", True)
            .execute()
        )
        already = {row["recipient_user_id"] for row in extract_list(sent_resp)}

        # Only what actually happens in THIS epoch. Measured on production:
        # not one of the seven epochs has `afk_penalty_enabled` set, so a mail
        # threatening an RP loss would threaten something that does not occur.
        penalty_enabled = bool(config.get("afk_penalty_enabled", False))
        penalty_rp = int(config.get("afk_rp_penalty", 2)) if penalty_enabled else None
        escalation = int(config.get("afk_escalation_threshold", 3))

        deadline = datetime.fromisoformat(str(epoch["cycle_deadline_at"]))
        hours_left = max(1, round((deadline - now).total_seconds() / 3600))
        site = settings.site_url.rstrip("/")

        sent = 0
        for recipient in recipients:
            user_id = recipient["user_id"]
            if user_id not in pending or user_id in already:
                continue
            lang = recipient.get("email_locale") or "en"
            consecutive = int(pending[user_id].get("consecutive_afk_cycles") or 0)

            html = render_deadline_reminder(
                email_locale=lang,
                epoch_name=str(epoch.get("name") or "Epoch"),
                cycle_number=cycle,
                hours_remaining=hours_left,
                open_items=[_nt("deadline_item_orders", lang, cycle=cycle)],
                penalty_rp=penalty_rp,
                # Only when the NEXT miss actually crosses the threshold.
                ai_takeover_next=penalty_enabled and (consecutive + 1) >= escalation,
                cta_url=f"{site}/epoch/{epoch_id}",
            )
            ok = await EmailService.send(
                recipient["email"],
                _nt(
                    "deadline_subject", lang,
                    hours=hours_left, epoch=str(epoch.get("name") or "Epoch"), cycle=cycle,
                ),
                html,
                unsubscribe_url=f"{site}/unsubscribe?category=deadline_reminder",
                record=MailRecord(
                    template="deadline_reminder",
                    user_id=user_id,
                    epoch_id=epoch_id,
                    simulation_id=recipient.get("simulation_id"),
                    cycle_number=cycle,
                ),
            )
            sent += int(bool(ok))

        if sent:
            logger.info(
                "Deadline reminders sent",
                extra={"epoch_id": epoch_id, "cycle": cycle, "sent": sent, "pending": len(pending)},
            )
        return sent

    # ── Sweep (Safety Net) ───────────────────────────────────

    @classmethod
    async def _sweep_expired_cycles(cls, admin: Client) -> None:
        """Query active epochs with expired deadlines."""
        now = datetime.now(UTC).isoformat()
        resp = await (
            admin.table("game_epochs")
            .select("id, current_cycle, config, cycle_deadline_at")
            .in_("status", ["foundation", "competition", "reckoning"])
            .not_.is_("cycle_deadline_at", "null")
            .lte("cycle_deadline_at", now)
            .execute()
        )
        for epoch in extract_list(resp):
            try:
                await cls._auto_resolve_cycle(admin, epoch)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.exception(
                    "Auto-resolve failed for epoch %s",
                    epoch.get("id"),
                    extra={"epoch_id": epoch.get("id")},
                )
                sentry_sdk.capture_exception(exc)

    # ── Auto-Resolve Pipeline ────────────────────────────────

    @classmethod
    async def _auto_resolve_cycle(cls, admin: Client, epoch: dict) -> None:
        """Atomic auto-resolve via CAS RPC, then AFK + full pipeline."""
        epoch_id = epoch["id"]
        current_cycle = epoch["current_cycle"]

        # CAS gate: only one caller wins
        check = await admin.rpc(
            "fn_check_and_resolve_deadline",
            {"p_epoch_id": str(epoch_id), "p_expected_cycle": current_cycle},
        ).execute()

        result = check.data
        if not result or not result.get("resolved"):
            return  # Already resolved or not yet due

        config = {**DEFAULT_CONFIG, **(epoch.get("config") or {})}

        logger.info(
            "Auto-resolving epoch cycle at deadline",
            extra={
                "epoch_id": str(epoch_id),
                "cycle_number": current_cycle,
                "auto_resolve_mode": config.get("auto_resolve_mode", "manual"),
            },
        )

        # AFK processing BEFORE resolve (identifies who didn't act)
        if config.get("afk_penalty_enabled", False):
            await cls._process_afk_players(admin, str(epoch_id), config)

        # Log auto-resolve event
        await BattleLogService.log_event(
            admin,
            UUID(str(epoch_id)),
            current_cycle,
            "cycle_auto_resolved",
            "Cycle resolved automatically at deadline.",
            is_public=True,
        )

        # Full resolve pipeline (identical to toggle_ready auto-resolve)
        from backend.services.epoch_service import EpochService

        await EpochService.resolve_cycle_full(admin, UUID(str(epoch_id)), admin)

    # ── Eager Timer ──────────────────────────────────────────

    @classmethod
    async def schedule_eager_timer(cls, epoch_id: str, deadline_at: datetime) -> None:
        """Schedule an asyncio timer for a known deadline (sub-second precision).

        If an existing timer for this epoch exists, it is cancelled first.
        If the deadline has already passed, the sweep will handle it.
        """
        # Cancel existing timer for this epoch
        existing = cls._eager_timers.pop(epoch_id, None)
        if existing and not existing.done():
            existing.cancel()

        delay = (deadline_at - datetime.now(UTC)).total_seconds()
        if delay <= 0:
            return  # Already past — sweep will pick it up

        cls._eager_timers[epoch_id] = asyncio.create_task(cls._eager_wait(epoch_id, delay))

    @classmethod
    async def _eager_wait(cls, epoch_id: str, delay: float) -> None:
        """Sleep until deadline, then trigger auto-resolve."""
        try:
            await asyncio.sleep(delay)

            admin = await get_admin_supabase()
            # Re-fetch epoch state (may have been resolved by sweep or ready,
            # or cancelled/deleted). Use maybe_single to avoid exceptions when
            # the epoch no longer matches (e.g. cancelled while timer was pending).
            epoch_data = await maybe_single_data(
                admin.table("game_epochs")
                .select("id, current_cycle, config, cycle_deadline_at")
                .eq("id", epoch_id)
                .in_("status", ["foundation", "competition", "reckoning"])
                .not_.is_("cycle_deadline_at", "null")
                .maybe_single()
            )
            if epoch_data:
                await cls._auto_resolve_cycle(admin, epoch_data)
        except asyncio.CancelledError:
            pass
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception(
                "Eager timer auto-resolve failed for epoch %s",
                epoch_id,
            )
            sentry_sdk.capture_exception(exc)
        finally:
            # Only remove ourselves from the dict, not a replacement timer.
            # When schedule_eager_timer() replaces this timer, it pops the old
            # entry and inserts a new task. If we blindly pop, we'd remove the
            # replacement. Check task identity before removing.
            my_task = asyncio.current_task()
            if cls._eager_timers.get(epoch_id) is my_task:
                cls._eager_timers.pop(epoch_id, None)

    @classmethod
    async def _seed_eager_timers(cls) -> None:
        """On startup, register eager timers for all active epochs with deadlines."""
        try:
            admin = await get_admin_supabase()
            resp = await (
                admin.table("game_epochs")
                .select("id, cycle_deadline_at")
                .in_("status", ["foundation", "competition", "reckoning"])
                .not_.is_("cycle_deadline_at", "null")
                .execute()
            )
            for epoch in extract_list(resp):
                deadline_str = epoch.get("cycle_deadline_at")
                if deadline_str:
                    deadline = datetime.fromisoformat(deadline_str)
                    await cls.schedule_eager_timer(str(epoch["id"]), deadline)

            count = len(cls._eager_timers)
            if count:
                logger.info("Seeded %d eager timer(s) for active epochs", count)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to seed eager timers, sweep will handle deadlines", exc_info=True)

    # ── AFK Processing ───────────────────────────────────────

    @classmethod
    async def _process_afk_players(cls, admin: Client, epoch_id: str, config: dict) -> None:
        """Pre-resolve: identify AFK players and apply escalating penalties.

        Called BEFORE resolve_cycle_full() so that AFK flags are set before
        the bot pipeline runs (AI-takeover participants become bots).

        Architecture:
          - Postgres RPC ``fn_process_afk_batch`` (migration 214) handles atomic
            penalty updates with graduated escalation (data integrity).
          - Python logs battle_log events for each affected player (game narrative).
          - Python calls ``fn_replace_afk_with_bot`` for AI takeover (transactional).
          - Mercy reset (consecutive_afk_cycles → 0) done via batch UPDATE.
        """
        epoch_resp = await admin.table("game_epochs").select("current_cycle").eq("id", epoch_id).single().execute()
        cycle = (epoch_resp.data or {}).get("current_cycle", 0)

        penalty_rp = config.get("afk_rp_penalty", 2)
        escalation_threshold = config.get("afk_escalation_threshold", 3)
        rp_multiplier = config.get("afk_rp_multiplier", 2.5)

        # ── Step 1: Atomic batch penalty processing ──────────────
        afk_resp = await admin.rpc(
            "fn_process_afk_batch",
            {
                "p_epoch_id": epoch_id,
                "p_penalty_rp": penalty_rp,
                "p_escalation_threshold": escalation_threshold,
                "p_rp_multiplier": rp_multiplier,
            },
        ).execute()

        afk_players = afk_resp.data or []

        # ── Step 2: Log events + handle AI takeover per player ───
        personality = config.get("afk_ai_personality", "sentinel")
        difficulty = config.get("afk_ai_difficulty", "easy")

        for p in afk_players:
            sim_id = UUID(p["simulation_id"])
            new_consecutive = p["new_consecutive"]
            rp_loss = p["rp_loss"]

            if p["needs_ai_takeover"]:
                # Atomic bot creation + participant link (migration 214)
                bot_id = await admin.rpc(
                    "fn_replace_afk_with_bot",
                    {
                        "p_participant_id": str(p["participant_id"]),
                        "p_bot_name": f"AFK Bot ({p['simulation_id'][:8]})",
                        "p_personality": personality,
                        "p_difficulty": difficulty,
                        "p_created_by_id": str(p["user_id"]) if p.get("user_id") else None,
                    },
                ).execute()

                await BattleLogService.log_event(
                    admin, UUID(epoch_id), cycle,
                    "player_afk_ai_takeover",
                    "AI has assumed control due to prolonged absence.",
                    source_simulation_id=sim_id, is_public=True,
                    metadata={
                        "consecutive": new_consecutive,
                        "personality": personality,
                        "bot_player_id": str(bot_id.data) if bot_id.data else None,
                    },
                )
            elif rp_loss > 0:
                await BattleLogService.log_event(
                    admin, UUID(epoch_id), cycle,
                    "player_afk_penalty",
                    f"AFK penalty: -{rp_loss} RP (consecutive absence #{new_consecutive}).",
                    source_simulation_id=sim_id, is_public=False,
                    metadata={"rp_loss": rp_loss, "consecutive": new_consecutive},
                )
            else:
                await BattleLogService.log_event(
                    admin, UUID(epoch_id), cycle,
                    "player_afk",
                    f"Player absent for cycle {cycle}.",
                    source_simulation_id=sim_id, is_public=False,
                    metadata={"consecutive": new_consecutive},
                )

        # ── Step 3: Mercy reset for active players ───────────────
        await (
            admin.table("epoch_participants")
            .update({"consecutive_afk_cycles": 0})
            .eq("epoch_id", epoch_id)
            .gt("consecutive_afk_cycles", 0)
            .eq("has_acted_this_cycle", True)
            .execute()
        )
