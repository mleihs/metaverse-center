"""Service layer for epoch chat message operations."""

import logging
from uuid import UUID

import sentry_sdk

from backend.services.epoch_service import EpochService
from backend.utils.errors import bad_request, forbidden, not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class EpochChatService:
    """Service for epoch chat CRUD and ready signal toggling."""

    @staticmethod
    async def send_message(
        supabase: Client,
        epoch_id: UUID,
        sender_id: UUID,
        sender_simulation_id: UUID,
        content: str,
        channel_type: str = "epoch",
        team_id: UUID | None = None,
    ) -> dict:
        """Validate and insert a chat message.

        Validates:
        - Epoch exists and is active (not completed/cancelled)
        - For team messages, the sender's participant has matching team_id
        """
        # Validate epoch is active
        epoch_resp = await supabase.table("game_epochs").select("id, status").eq("id", str(epoch_id)).limit(1).execute()
        if not epoch_resp.data:
            raise not_found(detail="Epoch not found.")
        epoch = epoch_resp.data[0]
        if epoch["status"] in ("completed", "cancelled"):
            raise bad_request("Cannot send messages in a completed or cancelled epoch.")

        # For team messages, validate sender is on that team
        if channel_type == "team":
            if not team_id:
                raise bad_request("team_id is required for team messages.")
            participant_resp = await (
                supabase.table("epoch_participants")
                .select("id, team_id")
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(sender_simulation_id))
                .limit(1)
                .execute()
            )
            if not participant_resp.data:
                raise forbidden("You are not a participant in this epoch.")
            if str(participant_resp.data[0].get("team_id")) != str(team_id):
                raise forbidden("You are not a member of this team.")

        # Insert message
        insert_data = {
            "epoch_id": str(epoch_id),
            "sender_id": str(sender_id),
            "sender_simulation_id": str(sender_simulation_id),
            "channel_type": channel_type,
            "content": content,
        }
        if team_id and channel_type == "team":
            insert_data["team_id"] = str(team_id)

        response = await supabase.table("epoch_chat_messages").insert(insert_data).execute()
        if not response.data:
            raise server_error("Failed to send message.")

        # Enrich with sender simulation name
        msg = response.data[0]
        return await EpochChatService._enrich_sender_name(supabase, msg)

    @staticmethod
    async def list_messages(
        supabase: Client,
        epoch_id: UUID,
        channel_type: str = "epoch",
        team_id: UUID | None = None,
        limit: int = 50,
        before: str | None = None,
    ) -> tuple[list[dict], int]:
        """Fetch paginated messages with cursor-based pagination.

        Returns (messages, total_count). Messages ordered by created_at DESC.
        `before` is an ISO timestamp cursor for older messages.
        """
        query = (
            supabase.table("epoch_chat_messages")
            .select("*", count="exact")
            .eq("epoch_id", str(epoch_id))
            .eq("channel_type", channel_type)
        )

        if channel_type == "team" and team_id:
            query = query.eq("team_id", str(team_id))

        if before:
            query = query.lt("created_at", before)

        query = query.order("created_at", desc=True).limit(limit)
        response = await query.execute()

        messages = response.data or []
        total = response.count or 0

        # Enrich with sender names (batch)
        if messages:
            sim_ids = list({m["sender_simulation_id"] for m in messages})
            sim_resp = await supabase.table("simulations").select("id, name").in_("id", sim_ids).execute()
            name_map = {s["id"]: s["name"] for s in (sim_resp.data or [])}
            for m in messages:
                m["sender_name"] = name_map.get(m["sender_simulation_id"])

        # Return in chronological order (oldest first) for display
        messages.reverse()
        return messages, total

    @staticmethod
    async def toggle_ready(
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        ready: bool,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Toggle cycle_ready for a participant.

        When a human sets ready=True and all non-bot participants are ready,
        automatically resolves the cycle (bots, scoring, notifications).
        Returns the participant row with optional `auto_resolved` and `new_cycle` fields.
        """
        # Validate epoch is in an active phase
        epoch_resp = await supabase.table("game_epochs").select("id, status").eq("id", str(epoch_id)).limit(1).execute()
        if not epoch_resp.data:
            raise not_found(detail="Epoch not found.")
        if epoch_resp.data[0]["status"] not in ("foundation", "competition", "reckoning"):
            raise bad_request("Ready signals are only available during active epoch phases.")

        response = await (
            supabase.table("epoch_participants")
            .update({"cycle_ready": ready})
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail="Participant not found in this epoch.")

        result = response.data[0]

        # Auto-resolve: if signalling ready, check if all humans are now ready
        if ready and admin_supabase:
            # Use admin client for consistent participant data regardless of RLS
            all_participants = await (
                admin_supabase.table("epoch_participants")
                .select("id, cycle_ready, is_bot")
                .eq("epoch_id", str(epoch_id))
                .execute()
            )
            humans = [p for p in (all_participants.data or []) if not p.get("is_bot")]
            all_humans_ready = len(humans) > 0 and all(p["cycle_ready"] for p in humans)

            logger.info(
                "Ready check",
                extra={
                    "epoch_id": str(epoch_id),
                    "total_participants": len(all_participants.data or []),
                    "human_count": len(humans),
                    "all_ready": all_humans_ready,
                },
            )

            if all_humans_ready:
                try:
                    epoch_data = await EpochService.resolve_cycle_full(supabase, epoch_id, admin_supabase)
                    result["auto_resolved"] = True
                    result["new_cycle"] = epoch_data.get("current_cycle", 1)
                except Exception:  # noqa: BLE001 — auto-resolve is best-effort, must not crash toggle_ready
                    logger.exception("Auto-resolve failed", extra={"epoch_id": str(epoch_id)})
                    sentry_sdk.capture_exception()
                    result["auto_resolve_error"] = True

        return result

    @staticmethod
    async def _enrich_sender_name(supabase: Client, message: dict) -> dict:
        """Add sender_name from simulations table."""
        sim_resp = await (
            supabase.table("simulations").select("name").eq("id", message["sender_simulation_id"]).limit(1).execute()
        )
        message["sender_name"] = sim_resp.data[0]["name"] if sim_resp.data else None
        return message
