"""Epoch lifecycle transitions — start, advance, cancel, delete."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import EpochConfig
from backend.services.battle_log_service import BattleLogService
from backend.services.game_instance_service import GameInstanceService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()


class EpochLifecycleService:
    """Epoch lifecycle transitions: start, advance, cancel, delete."""

    @classmethod
    async def start_epoch(
        cls, supabase: Client, epoch_id: UUID, user_id: UUID,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Transition epoch from lobby -> foundation.

        This triggers the game instance cloning process:
        1. Clone all participating simulations into game instances
        2. epoch_participants are repointed to instance simulation_ids
        3. Transition epoch to foundation phase
        4. Grant initial RP
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot start epoch with status '{epoch['status']}'.",
            )

        # Need at least 2 participants
        from backend.services.epoch_participation_service import EpochParticipationService

        participants = await EpochParticipationService.list_participants(supabase, epoch_id)
        if len(participants) < 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Need at least 2 participants to start an epoch.",
            )

        # Verify creator has joined the epoch with a simulation
        # (Skip for academy epochs — human is joined via admin client)
        if epoch.get("epoch_type") != "academy":
            creator_id = str(epoch["created_by_id"])
            member_resp = await (
                supabase.table("simulation_members")
                .select("simulation_id")
                .eq("user_id", creator_id)
                .execute()
            )
            creator_sim_ids = {m["simulation_id"] for m in (member_resp.data or [])}
            human_participant_sims = {
                str(p["simulation_id"]) for p in participants if not p.get("is_bot")
            }
            if not creator_sim_ids & human_participant_sims:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Epoch creator must join with a simulation before starting.",
                )

        # Auto-complete drafts for participants who haven't drafted.
        # Uses fn_auto_draft_participants RPC (migration 128) — single SQL call
        # replaces N per-participant queries.
        # Use admin client to bypass RLS — creator may not be a member of
        # all participating simulations (e.g. bot-assigned sims).
        admin = admin_supabase or supabase
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)
        await admin.rpc("fn_auto_draft_participants", {
            "p_epoch_id": str(epoch_id),
            "p_max_agents": max_agents,
        }).execute()

        # Clone simulations into game instances (atomic batch operation)
        epoch_number = await GameInstanceService.get_epoch_number(supabase)
        instance_mapping = await GameInstanceService.clone_for_epoch(
            admin, epoch_id, user_id, epoch_number
        )

        # Expire any pending alliance proposals — they reference template simulation IDs
        # which are now invalid after cloning into game instances.
        await admin.table("epoch_alliance_proposals").update(
            {"status": "expired", "resolved_at": datetime.now(UTC).isoformat()}
        ).eq("epoch_id", str(epoch_id)).eq("status", "pending").execute()

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}

        # Validate phase cycles don't overlap
        total_cycles = (config["duration_days"] * 24) // config["cycle_hours"]
        f_cycles = config.get("foundation_cycles", 4)
        r_cycles = config.get("reckoning_cycles", 8)
        if f_cycles + r_cycles >= total_cycles:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Phase overlap: foundation ({f_cycles}) + reckoning ({r_cycles}) "
                f"must be less than total cycles ({total_cycles}).",
            )

        duration = timedelta(days=config["duration_days"])
        now = datetime.now(UTC)

        resp = await (
            supabase.table("game_epochs")
            .update({
                "status": "foundation",
                "starts_at": now.isoformat(),
                "ends_at": (now + duration).isoformat(),
                "current_cycle": 1,
                "config": {
                    **config,
                    "instance_mapping": instance_mapping,
                },
            })
            .eq("id", str(epoch_id))
            .execute()
        )

        # Grant initial RP to all participants (foundation bonus)
        from backend.services.cycle_resolution_service import CycleResolutionService

        foundation_rp = int(config["rp_per_cycle"] * 1.5)
        await CycleResolutionService._grant_rp_batch(supabase, epoch_id, foundation_rp, config["rp_cap"])

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to start epoch.")

        # Log phase transition + notify participants
        await BattleLogService.log_phase_change(
            supabase, epoch_id, 1, "lobby", "foundation",
        )
        if epoch.get("epoch_type") != "academy":
            try:
                from backend.services.cycle_notification_service import CycleNotificationService
                await CycleNotificationService.send_phase_change_notifications(
                    admin or supabase, str(epoch_id), "lobby", "foundation",
                )
            except Exception:
                logger.warning("Epoch start notification failed for epoch %s", epoch_id, exc_info=True)

        return resp.data[0]

    @classmethod
    async def advance_phase(cls, supabase: Client, epoch_id: UUID, admin_supabase: Client | None = None) -> dict:
        """Advance to the next phase (foundation->competition->reckoning->completed).

        When advancing to 'completed', game instances are archived.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        old_status = epoch["status"]
        next_status_map = {
            "foundation": "competition",
            "competition": "reckoning",
            "reckoning": "completed",
        }
        next_status = next_status_map.get(old_status)
        if not next_status:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot advance from '{epoch['status']}'.",
            )

        resp = await (
            supabase.table("game_epochs")
            .update({"status": next_status})
            .eq("id", str(epoch_id))
            .execute()
        )

        # Archive game instances when epoch completes
        if next_status == "completed":
            admin = admin_supabase or supabase
            await GameInstanceService.archive_instances(admin, epoch_id)

            # Increment academy_epochs_played for academy epochs
            if epoch.get("epoch_type") == "academy":
                profile = await (
                    admin.table("user_profiles")
                    .select("academy_epochs_played")
                    .eq("id", str(epoch["created_by_id"]))
                    .maybe_single()
                    .execute()
                )
                if profile.data:
                    count = (profile.data.get("academy_epochs_played") or 0) + 1
                    await admin.table("user_profiles").update(
                        {"academy_epochs_played": count}
                    ).eq("id", str(epoch["created_by_id"])).execute()

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to advance phase.")

        # Log phase transition + notify participants
        await BattleLogService.log_phase_change(
            supabase, epoch_id, epoch.get("current_cycle", 1), old_status, next_status,
        )
        try:
            from backend.services.cycle_notification_service import CycleNotificationService
            if next_status == "completed":
                await CycleNotificationService.send_epoch_completed_notifications(
                    admin_supabase or supabase, str(epoch_id),
                )
            else:
                await CycleNotificationService.send_phase_change_notifications(
                    admin_supabase or supabase, str(epoch_id), old_status, next_status,
                )
        except Exception:
            logger.warning("Phase notification failed for epoch %s", epoch_id, exc_info=True)

        return resp.data[0]

    @classmethod
    async def cancel_epoch(cls, supabase: Client, epoch_id: UUID, admin_supabase: Client | None = None) -> dict:
        """Cancel an epoch (any non-terminal state).

        Deletes all game instances created for this epoch.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] in ("completed", "cancelled"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot cancel epoch with status '{epoch['status']}'.",
            )

        resp = await (
            supabase.table("game_epochs")
            .update({"status": "cancelled"})
            .eq("id", str(epoch_id))
            .execute()
        )

        # Delete game instances (only exist if epoch was started)
        if epoch["status"] != "lobby":
            admin = admin_supabase or supabase
            await GameInstanceService.delete_instances(admin, epoch_id)

        # Log cancellation
        await BattleLogService.log_phase_change(
            supabase, epoch_id, epoch.get("current_cycle", 0), epoch["status"], "cancelled",
        )

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to cancel epoch.")
        return resp.data[0]

    @classmethod
    async def delete_epoch(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Permanently delete an epoch. Only lobby or cancelled epochs can be deleted.

        Deletes child records in reverse FK order, then the epoch row itself.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] not in ("lobby", "cancelled"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot delete epoch with status '{epoch['status']}'. Cancel it first.",
            )

        eid = str(epoch_id)

        # Delete child tables in reverse FK order
        for table in [
            "bot_decision_log",
            "operative_missions",
            "epoch_scores",
            "battle_log",
            "epoch_chat_messages",
            "epoch_participants",
            "epoch_teams",
            "epoch_invitations",
        ]:
            await supabase.table(table).delete().eq("epoch_id", eid).execute()

        # Delete the epoch row itself
        resp = await supabase.table("game_epochs").delete().eq("id", eid).execute()
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to delete epoch.")
        return resp.data[0]
