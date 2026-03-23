"""Cycle resolution — RP management and full cycle pipeline."""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status

from backend.models.epoch import EpochConfig
from backend.services.battle_log_service import BattleLogService
from backend.services.constants import SECURITY_TIER_ORDER
from backend.services.game_instance_service import GameInstanceService
from backend.services.platform_config_service import PlatformConfigService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()


class CycleResolutionService:
    """Cycle resolution: RP management, cycle advancement, and full pipeline."""

    # ── RP Management ────────────────────────────────────────

    @classmethod
    async def _grant_rp_batch(
        cls,
        supabase: Client,
        epoch_id: UUID,
        amount: int,
        rp_cap: int,
    ) -> None:
        """Grant RP to all participants in an epoch, respecting the cap.

        Uses ``fn_batch_grant_rp`` RPC (migration 126) — a single UPDATE
        with LEAST() for cap enforcement.
        """
        await supabase.rpc(
            "fn_batch_grant_rp",
            {"p_epoch_id": str(epoch_id), "p_amount": amount, "p_rp_cap": rp_cap},
        ).execute()

    @classmethod
    async def spend_rp(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        amount: int,
    ) -> int:
        """Spend RP with optimistic locking. Returns remaining RP.

        Prevents race conditions: the UPDATE includes an eq() check on the
        current balance. If two concurrent requests read the same balance,
        the first to write succeeds, the second fails because current_rp
        no longer matches.
        """
        resp = await (
            supabase.table("epoch_participants")
            .select("id, current_rp")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a participant.")

        current = resp.data["current_rp"]
        if current < amount:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Insufficient RP: have {current}, need {amount}.",
            )

        new_rp = current - amount
        update_resp = await (
            supabase.table("epoch_participants")
            .update({"current_rp": new_rp})
            .eq("id", resp.data["id"])
            .eq("current_rp", current)  # optimistic lock
            .execute()
        )

        if not update_resp.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "RP balance changed concurrently. Please retry.",
            )

        return new_rp

    @classmethod
    async def grant_rp(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        amount: int,
    ) -> int:
        """Grant RP to a single participant, respecting the cap. Returns new balance.

        Uses ``fn_grant_rp_single`` RPC (migration 148) when ``use_atomic_game_rpcs``
        platform setting is enabled. Falls back to Python fetch-compute-update otherwise.
        """
        # Read epoch config for rp_cap (needed by both paths)
        epoch_resp = await (
            supabase.table("game_epochs")
            .select("config")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        config = {**DEFAULT_CONFIG, **(epoch_resp.data or {}).get("config", {})}
        rp_cap = config["rp_cap"]

        use_rpc = await PlatformConfigService.get(supabase, "use_atomic_game_rpcs", False)
        if use_rpc:
            # Atomic RP grant with cap enforcement (migration 148)
            rpc_resp = await supabase.rpc("fn_grant_rp_single", {
                "p_epoch_id": str(epoch_id),
                "p_simulation_id": str(simulation_id),
                "p_amount": amount,
                "p_rp_cap": rp_cap,
            }).execute()
            return rpc_resp.data

        # Legacy: fetch-compute-update with no locking
        resp = await (
            supabase.table("epoch_participants")
            .select("id, current_rp")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a participant.")

        current = resp.data["current_rp"]
        new_rp = min(current + amount, rp_cap)

        await supabase.table("epoch_participants").update(
            {"current_rp": new_rp}
        ).eq("id", resp.data["id"]).execute()

        return new_rp

    # ── Cycle Resolution ─────────────────────────────────────

    @classmethod
    async def resolve_cycle_full(
        cls,
        supabase: Client,
        epoch_id: UUID,
        admin_supabase: Client,
    ) -> dict:
        """Full cycle resolution pipeline (migration 090 alliance steps marked ★).

        Pipeline order:
        1. RP grant
        2. ★ Alliance upkeep — ``fn_deduct_alliance_upkeep`` (migration 090)
        3. ★ Expire stale proposals — ``fn_expire_alliance_proposals`` (migration 090)
        4. Reset cycle_ready flags
        5. Advance mission timers
        6. Expire fortifications
        7. Resolve missions
        8. Bot execution (includes proposal voting)
        9. Scoring
        10. ★ Tension computation — ``fn_compute_alliance_tension`` (migration 090)
        11. Notifications
        12. ★ Clear dissolved team_ids

        Returns updated epoch data.
        """
        # Late imports to avoid circular dependency:
        # These services import EpochService (directly or transitively)
        # which imports this module.
        from backend.services.alliance_service import AllianceService
        from backend.services.bot_service import BotService
        from backend.services.cycle_notification_service import CycleNotificationService
        from backend.services.operative_service import OperativeService
        from backend.services.scoring_service import ScoringService

        data = await cls.resolve_cycle(supabase, epoch_id, admin_supabase=admin_supabase)
        config = data.get("config", {})
        cycle_number = data.get("current_cycle", 1)

        db = admin_supabase or supabase

        # Alliance upkeep deduction (after RP grant, before missions)
        try:
            upkeep_teams = await AllianceService.deduct_upkeep(db, epoch_id, cycle_number)
            if upkeep_teams:
                logger.info(
                    "Alliance upkeep step complete",
                    extra={"epoch_id": str(epoch_id), "teams": len(upkeep_teams)},
                )
        except Exception:
            logger.warning("Alliance upkeep deduction failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Expire stale alliance proposals
        try:
            expired = await AllianceService.expire_proposals(db, epoch_id, cycle_number)
            if expired:
                logger.info("Alliance proposals expired", extra={"epoch_id": str(epoch_id), "count": expired})
        except Exception:
            logger.warning("Alliance proposal expiry failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Resolve missions that have passed their resolves_at time
        # (after timer advancement in resolve_cycle, before bots act)
        try:
            resolved = await OperativeService.resolve_pending_missions(db, epoch_id)
            # Log mission results to battle log
            for mission in resolved:
                try:
                    await BattleLogService.log_mission_result(
                        db, epoch_id, cycle_number, mission
                    )
                except Exception:
                    logger.debug("Battle log write failed for mission result", exc_info=True)
        except Exception:
            logger.warning("Mission resolution failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Expire zone fortifications that have passed their expiry cycle
        try:
            use_rpc = await PlatformConfigService.get(db, "use_atomic_game_rpcs", False)
            if use_rpc:
                # Atomic fortification expiry (migration 148): downgrades zones
                # and deletes forts in a single transaction.
                await db.rpc("fn_expire_fortifications", {
                    "p_epoch_id": str(epoch_id),
                    "p_cycle_number": cycle_number,
                }).execute()
            else:
                expired_forts = await (
                    db.table("zone_fortifications")
                    .select("id, zone_id, security_bonus")
                    .eq("epoch_id", str(epoch_id))
                    .lte("expires_at_cycle", cycle_number)
                    .execute()
                )
                for fort in expired_forts.data or []:
                    zone_resp = await (
                        db.table("zones")
                        .select("id, security_level")
                        .eq("id", fort["zone_id"])
                        .single()
                        .execute()
                    )
                    if zone_resp.data:
                        current_level = zone_resp.data["security_level"]
                        try:
                            idx = SECURITY_TIER_ORDER.index(current_level)
                            new_idx = max(0, idx - fort["security_bonus"])
                            new_level = SECURITY_TIER_ORDER[new_idx]
                        except ValueError:
                            new_level = current_level
                        if new_level != current_level:
                            await db.table("zones").update(
                                {"security_level": new_level}
                            ).eq("id", fort["zone_id"]).execute()
                    await db.table("zone_fortifications").delete().eq("id", fort["id"]).execute()
        except Exception:
            logger.warning("Fortification expiry failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Execute bot decisions (after RP grant + mission resolution, before next cycle)
        try:
            await BotService.execute_bot_cycle(
                supabase=supabase,
                admin_supabase=admin_supabase,
                epoch_id=str(epoch_id),
                cycle_number=cycle_number,
                config=config,
            )
        except Exception:
            logger.warning("Bot cycle execution failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Compute scores after missions resolve (best-effort)
        try:
            await ScoringService.compute_cycle_scores(supabase, epoch_id, cycle_number)
        except Exception:
            logger.warning(
                "Scoring failed", extra={"epoch_id": str(epoch_id), "cycle_number": cycle_number}, exc_info=True
            )
            sentry_sdk.capture_exception()

        # Compute alliance tension (after missions — counts same-target attacks)
        try:
            tension_results = await AllianceService.compute_tension(db, epoch_id, cycle_number)
            dissolved = [r for r in tension_results if r.get("dissolved")]
            if dissolved:
                logger.info("Alliance tension dissolved teams", extra={
                    "epoch_id": str(epoch_id), "dissolved_count": len(dissolved),
                    "teams": [r.get("team_name") for r in dissolved],
                })
        except Exception:
            logger.warning("Alliance tension computation failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Send cycle notification emails (best-effort, non-blocking)
        try:
            await CycleNotificationService.send_cycle_notifications(
                admin_supabase,
                str(epoch_id),
                cycle_number,
            )
        except Exception:
            logger.warning("Cycle notification failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        # Clear team_ids for dissolved alliances (AFTER notifications have read them)
        try:
            await AllianceService.clear_dissolved_team_ids(db, epoch_id)
        except Exception:
            logger.warning("Dissolved team cleanup failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
            sentry_sdk.capture_exception()

        return data

    @classmethod
    async def resolve_cycle(
        cls,
        supabase: Client,
        epoch_id: UUID,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Resolve a cycle: allocate RP, increment cycle counter.

        Mission resolution and scoring are handled by OperativeService
        and ScoringService respectively.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] not in ("foundation", "competition", "reckoning"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot resolve cycle for epoch with status '{epoch['status']}'.",
            )

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        new_cycle = epoch["current_cycle"] + 1

        # Use admin client for all writes to bypass RLS restrictions
        # (e.g. non-creator triggering auto-resolve via toggle_ready)
        db = admin_supabase or supabase

        # Grant RP to all participants
        rp_amount = config["rp_per_cycle"]
        if epoch["status"] == "foundation":
            rp_amount = int(rp_amount * 1.5)  # Foundation bonus

        await cls._grant_rp_batch(db, epoch_id, rp_amount, config["rp_cap"])

        # Reset all cycle_ready flags before advancing
        await db.table("epoch_participants").update(
            {"cycle_ready": False}
        ).eq("epoch_id", str(epoch_id)).execute()

        # Advance mission timers by one cycle interval so operatives resolve
        # in sync with admin-triggered cycle resolution (not wall-clock time).
        # Subtract cycle_hours from resolves_at for all non-guardian missions.
        cycle_hours = config.get("cycle_hours", 8)
        active_missions = await (
            db.table("operative_missions")
            .select("id, resolves_at, operative_type")
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active"])
            .neq("operative_type", "guardian")
            .execute()
        )
        # Batch: group by resolves_at, compute new value, update per-group
        by_new_resolve: defaultdict[str, list[str]] = defaultdict(list)
        for m in active_missions.data or []:
            old_resolves = datetime.fromisoformat(m["resolves_at"])
            new_resolves = old_resolves - timedelta(hours=cycle_hours)
            by_new_resolve[new_resolves.isoformat()].append(m["id"])
        for new_ts, ids in by_new_resolve.items():
            await db.table("operative_missions").update(
                {"resolves_at": new_ts}
            ).in_("id", ids).execute()

        # Increment cycle (optimistic lock: only if current_cycle hasn't changed)
        resp = await (
            db.table("game_epochs")
            .update({"current_cycle": new_cycle})
            .eq("id", str(epoch_id))
            .eq("current_cycle", epoch["current_cycle"])
            .execute()
        )

        if not resp.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Cycle was resolved concurrently. Please retry.",
            )

        # Auto-advance phase if cycle crosses a boundary
        current_status = epoch["status"]
        total_cycles = (config["duration_days"] * 24) // config["cycle_hours"]

        # Support both new absolute cycles and legacy percentage-based configs
        if "foundation_cycles" in config:
            foundation_end = config["foundation_cycles"]
        else:
            foundation_end = round(total_cycles * config.get("foundation_pct", 10) / 100)

        if "reckoning_cycles" in config:
            reckoning_start = total_cycles - config["reckoning_cycles"]
        else:
            reckoning_cycles = round(total_cycles * config.get("reckoning_pct", 15) / 100)
            reckoning_start = total_cycles - reckoning_cycles

        # Validate phases don't overlap
        if reckoning_start <= foundation_end:
            logger.warning(
                "Phase overlap detected",
                extra={"epoch_id": str(epoch_id), "foundation_end": foundation_end, "reckoning_start": reckoning_start},
            )

        new_status = current_status
        if current_status == "foundation" and new_cycle > foundation_end:
            new_status = "competition"
        elif current_status == "competition" and new_cycle > reckoning_start:
            new_status = "reckoning"
        elif current_status == "reckoning" and new_cycle >= total_cycles:
            new_status = "completed"

        if new_status != current_status:
            logger.info(
                "Epoch auto-advancing phase",
                extra={
                    "epoch_id": str(epoch_id), "old_status": current_status,
                    "new_status": new_status, "cycle_number": new_cycle,
                },
            )
            phase_resp = await (
                db.table("game_epochs")
                .update({"status": new_status})
                .eq("id", str(epoch_id))
                .execute()
            )
            if phase_resp.data:
                resp = phase_resp
                # Archive game instances when epoch completes
                if new_status == "completed":
                    admin = admin_supabase or supabase
                    await GameInstanceService.archive_instances(admin, epoch_id)

                # Log auto-phase transition
                await BattleLogService.log_phase_change(
                    db, epoch_id, new_cycle, current_status, new_status,
                )
                try:
                    from backend.services.cycle_notification_service import CycleNotificationService
                    if new_status == "completed":
                        await CycleNotificationService.send_epoch_completed_notifications(
                            admin_supabase or supabase, str(epoch_id),
                        )
                    else:
                        await CycleNotificationService.send_phase_change_notifications(
                            admin_supabase or supabase, str(epoch_id), current_status, new_status,
                        )
                except Exception:
                    logger.warning("Auto-phase notification failed", extra={"epoch_id": str(epoch_id)}, exc_info=True)
                    sentry_sdk.capture_exception()

        return resp.data[0]
