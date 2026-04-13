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
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.epoch import EpochConfig
from backend.services.battle_log_service import BattleLogService
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()

_SWEEP_INTERVAL = 30  # seconds


class EpochCycleScheduler:
    """Periodic background task that auto-resolves epoch cycles at deadline."""

    _task: asyncio.Task | None = None
    _eager_timers: dict[str, asyncio.Task] = {}

    # ── Lifecycle ────────────────────────────────────────────

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the scheduler. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_sweep_loop())
        await cls._seed_eager_timers()
        logger.info("Epoch cycle scheduler started")
        return cls._task

    # ── Sweep Loop (Safety Net) ──────────────────────────────

    @classmethod
    async def _run_sweep_loop(cls) -> None:
        """Infinite loop: sleep 30s → check for expired deadlines."""
        while True:
            try:
                admin = await get_admin_supabase()
                await cls._sweep_expired_cycles(admin)
            except asyncio.CancelledError:
                logger.info("Epoch cycle scheduler shutting down")
                raise
            except (httpx.ConnectError, httpx.ConnectTimeout):
                logger.warning("Epoch cycle scheduler: database unavailable, retrying in %ds", _SWEEP_INTERVAL)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.exception("Epoch cycle scheduler sweep error")
                sentry_sdk.capture_exception(exc)
            await asyncio.sleep(_SWEEP_INTERVAL)

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
            resp = await (
                admin.table("game_epochs")
                .select("id, current_cycle, config, cycle_deadline_at")
                .eq("id", epoch_id)
                .in_("status", ["foundation", "competition", "reckoning"])
                .not_.is_("cycle_deadline_at", "null")
                .maybe_single()
                .execute()
            )
            if resp.data:
                await cls._auto_resolve_cycle(admin, resp.data)
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

        Escalation (configurable via afk_escalation_threshold):
          1 miss:  Log only (battle log event)
          2 misses: -afk_rp_penalty RP
          3 misses: -afk_rp_penalty * 2 RP
          4+ misses (>= threshold+1): AI takeover (is_bot=True, afk_replaced_by_ai=True)

        Mercy reset: consecutive_afk_cycles → 0 when player acts.
        """
        participants_resp = await (
            admin.table("epoch_participants")
            .select(
                "id, simulation_id, user_id, has_acted_this_cycle, cycle_ready, "
                "is_bot, consecutive_afk_cycles, total_afk_cycles, "
                "current_rp, afk_replaced_by_ai"
            )
            .eq("epoch_id", epoch_id)
            .execute()
        )

        epoch_resp = await admin.table("game_epochs").select("current_cycle").eq("id", epoch_id).single().execute()
        cycle = (epoch_resp.data or {}).get("current_cycle", 0)

        penalty_rp = config.get("afk_rp_penalty", 2)
        escalation_threshold = config.get("afk_escalation_threshold", 3)

        for p in extract_list(participants_resp):
            # Skip bots and already-replaced players
            if p["is_bot"] or p["afk_replaced_by_ai"]:
                continue

            if not p["has_acted_this_cycle"] and not p.get("cycle_ready", False):
                # ── AFK this cycle ───────────────────────────
                new_consecutive = p["consecutive_afk_cycles"] + 1
                updates: dict = {
                    "consecutive_afk_cycles": new_consecutive,
                    "total_afk_cycles": p.get("total_afk_cycles", 0) + 1,
                }

                # Escalation level 2+: RP penalty (graduated)
                # Level 2: -penalty_rp (default 2), Level 3+: -penalty_rp*2.5 (default 5)
                if new_consecutive >= 2:
                    rp_loss = penalty_rp if new_consecutive == 2 else int(penalty_rp * 2.5)
                    updates["current_rp"] = max(0, p["current_rp"] - rp_loss)

                    await BattleLogService.log_event(
                        admin,
                        UUID(epoch_id),
                        cycle,
                        "player_afk_penalty",
                        f"AFK penalty: -{rp_loss} RP (consecutive absence #{new_consecutive}).",
                        source_simulation_id=UUID(p["simulation_id"]),
                        is_public=False,
                        metadata={"rp_loss": rp_loss, "consecutive": new_consecutive},
                    )

                # Escalation level 4+ (threshold+1): AI takeover
                if new_consecutive >= escalation_threshold + 1:
                    # Create a bot_players row so chk_bot_consistency is satisfied
                    personality = config.get("afk_ai_personality", "sentinel")
                    bot_resp = await (
                        admin.table("bot_players")
                        .insert({
                            "name": f"AFK Bot ({p['simulation_id'][:8]})",
                            "personality": personality,
                            "difficulty": "easy",
                            "created_by_id": p.get("user_id"),
                        })
                        .execute()
                    )
                    bot_id = bot_resp.data[0]["id"] if bot_resp.data else None

                    updates["afk_replaced_by_ai"] = True
                    if bot_id:
                        updates["is_bot"] = True
                        updates["bot_player_id"] = bot_id

                    await BattleLogService.log_event(
                        admin,
                        UUID(epoch_id),
                        cycle,
                        "player_afk_ai_takeover",
                        "AI has assumed control due to prolonged absence.",
                        source_simulation_id=UUID(p["simulation_id"]),
                        is_public=True,
                        metadata={
                            "consecutive": new_consecutive,
                            "personality": personality,
                            "bot_player_id": bot_id,
                        },
                    )
                else:
                    # Level 1+: log AFK event
                    await BattleLogService.log_event(
                        admin,
                        UUID(epoch_id),
                        cycle,
                        "player_afk",
                        f"Player absent for cycle {cycle}.",
                        source_simulation_id=UUID(p["simulation_id"]),
                        is_public=False,
                        metadata={"consecutive": new_consecutive},
                    )

                await admin.table("epoch_participants").update(updates).eq("id", p["id"]).execute()

            else:
                # ── Active: mercy reset ──────────────────────
                if p["consecutive_afk_cycles"] > 0:
                    await (
                        admin.table("epoch_participants")
                        .update({"consecutive_afk_cycles": 0})
                        .eq("id", p["id"])
                        .execute()
                    )
