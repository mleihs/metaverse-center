"""Dungeon Achievement Service — centralized badge evaluation for all dungeon runs.

All dungeon-related badge logic lives here. Orchestrator services
(DungeonCombatService, DungeonMovementService) call hook methods at
specific game events. This service never reaches into other services.

Hook methods:
  on_boss_victory()        → 5 badges (2 secret + 3 challenge)
  on_drain_trigger()       → 1 badge  (political_vertigo)
  on_banter_witnessed()    → 1 counter (banter_connoisseur, target=50)
  on_anchor_encountered()  → 1 counter (objektanker_finder, target=16)
  track_peak_stress()      → bookkeeping for flawless_run (no DB call)

All award methods are best-effort and non-blocking — badge failures
never interrupt dungeon gameplay. The RPCs (fn_award_achievement,
fn_increment_progress) are idempotent.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID

from backend.services.journal.hooks import enqueue_achievement_mark
from supabase import AsyncClient as Client

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance

logger = logging.getLogger(__name__)


class DungeonAchievementService:
    """Centralized badge evaluation for dungeon runs."""

    # ── Hook: Boss Victory ────────────────────────────────────────────────

    @classmethod
    async def on_boss_victory(cls, admin_supabase: Client, instance: DungeonInstance) -> None:
        """Evaluate all boss-victory badges: secret + challenge.

        Called from DungeonCombatService._handle_combat_victory() when
        current_room.room_type == "boss".
        """
        # Secret: The Remnant — Shadow boss defeated at visibility 0
        if instance.archetype == "The Shadow":
            if instance.archetype_state.get("visibility", 1) == 0:
                await cls._award(admin_supabase, instance, "the_remnant", {"visibility": 0})

        # Secret: Mother's Embrace — Devouring Mother boss at attachment ≥ 100
        elif instance.archetype == "The Devouring Mother":
            attachment = instance.archetype_state.get("attachment", 0)
            if attachment >= 100:
                await cls._award(admin_supabase, instance, "mothers_embrace", {"attachment": attachment})

        # Challenge: Flawless Run — peak stress never exceeded 200 during entire run
        peak = instance.archetype_state.get("_peak_stress", 0)
        if peak <= 200:
            await cls._award(admin_supabase, instance, "flawless_run", {"peak_stress": peak})

        # Challenge: Speed Runner — completed in 8 rooms or fewer
        if instance.rooms_cleared <= 8:
            await cls._award(
                admin_supabase, instance, "speed_runner",
                {"rooms_cleared": instance.rooms_cleared},
            )

        # Challenge: Pacifist — no non-boss combat/elite rooms cleared
        combat_rooms_cleared = sum(
            1 for r in instance.rooms
            if r.cleared and r.room_type in ("combat", "elite")
        )
        if combat_rooms_cleared == 0:
            await cls._award(admin_supabase, instance, "pacifist")

    # ── Hook: Drain Trigger ───────────────────────────────────────────────

    @classmethod
    async def on_drain_trigger(
        cls, admin_supabase: Client, instance: DungeonInstance, trigger: str,
    ) -> None:
        """Evaluate drain-trigger badges.

        Called from DungeonMovementService after strategy.apply_drain().
        """
        if trigger == "total_fracture":
            await cls._award(
                admin_supabase, instance, "political_vertigo",
                {"fracture": instance.archetype_state.get("fracture", 0)},
            )

    # ── Hook: Banter Witnessed ────────────────────────────────────────────

    @classmethod
    async def on_banter_witnessed(
        cls, admin_supabase: Client, instance: DungeonInstance, banter_id: str,
    ) -> None:
        """Increment deduplicated banter counter for banter_connoisseur (target=50).

        Called from DungeonMovementService after banter is selected. Uses
        fn_increment_progress_unique to ensure each banter_id is counted
        only once across all runs (true "50 unique banter" tracking).
        """
        await cls._increment_unique(admin_supabase, instance, "banter_connoisseur", 50, banter_id)

    # ── Hook: Anchor Encountered ──────────────────────────────────────────

    @classmethod
    async def on_anchor_encountered(
        cls, admin_supabase: Client, instance: DungeonInstance, anchor_id: str,
    ) -> None:
        """Increment deduplicated objektanker counter for objektanker_finder (target=16).

        Called from DungeonMovementService after anchor text is selected. Uses
        fn_increment_progress_unique to ensure each anchor object is counted
        only once across all runs (true "16 different objects" tracking).
        """
        await cls._increment_unique(admin_supabase, instance, "objektanker_finder", 16, anchor_id)

    # ── Bookkeeping: Peak Stress ──────────────────────────────────────────

    @classmethod
    def track_peak_stress(cls, instance: DungeonInstance) -> None:
        """Snapshot the highest stress across all party agents into archetype_state.

        Synchronous — no DB call. Called at 7 choke points for full coverage:
        Combat: after _resolve_combat(), after _handle_combat_stalemate()
        Movement: before main room-entry checkpoint, after encounter choice effects,
                  after seal/ground/rally archetype actions

        The _peak_stress value auto-persists via archetype_state checkpoint.
        """
        current_max = max((a.stress for a in instance.party), default=0)
        previous_peak = instance.archetype_state.get("_peak_stress", 0)
        if current_max > previous_peak:
            instance.archetype_state["_peak_stress"] = current_max

    # ── Private: Award Helper ─────────────────────────────────────────────

    @classmethod
    async def _award(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        achievement_id: str,
        extra_context: dict[str, Any] | None = None,
    ) -> None:
        """Best-effort award via fn_award_achievement RPC. Non-blocking.

        On a first-time award (RPC returns true), also fans out a
        Mark fragment into the player's Resonance Journal. Duplicate
        awards (RPC returns false) do not emit a fragment — the Mark
        is a one-time carving, not a repeatable stamp.
        """
        context = {
            "archetype": instance.archetype,
            "run_id": str(instance.run_id),
            "simulation_id": str(instance.simulation_id),
            **(extra_context or {}),
        }
        condition_notes = (
            f"{instance.archetype} at depth {instance.depth} "
            f"(rooms cleared: {instance.rooms_cleared})"
        )
        for player_id in instance.player_ids:
            was_newly_awarded = False
            try:
                resp = await admin_supabase.rpc(
                    "fn_award_achievement",
                    {"p_user_id": str(player_id), "p_achievement_id": achievement_id, "p_context": context},
                ).execute()
                # postgrest returns a scalar RPC as resp.data (bool here).
                was_newly_awarded = resp.data is True
            except Exception:
                logger.warning(
                    "Badge award failed (non-critical)",
                    extra={"run_id": str(instance.run_id), "achievement_id": achievement_id,
                           "player_id": str(player_id)},
                    exc_info=True,
                )
                continue

            if was_newly_awarded:
                try:
                    await enqueue_achievement_mark(
                        admin_supabase,
                        user_id=UUID(str(player_id)),
                        simulation_id=UUID(str(instance.simulation_id)),
                        source_id=UUID(str(instance.run_id)),
                        achievement_slug=achievement_id,
                        condition_notes=condition_notes,
                    )
                except (ValueError, TypeError):
                    logger.warning(
                        "Journal mark skipped: UUID parse failed",
                        extra={
                            "run_id": str(instance.run_id),
                            "player_id": str(player_id),
                            "achievement_id": achievement_id,
                        },
                    )

    # ── Private: Progress Increment Helper ────────────────────────────────

    @classmethod
    async def _increment(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        achievement_id: str,
        target: int,
        extra_context: dict[str, Any] | None = None,
    ) -> None:
        """Best-effort progress increment via fn_increment_progress RPC. Non-blocking."""
        context = {
            "run_id": str(instance.run_id),
            **(extra_context or {}),
        }
        for player_id in instance.player_ids:
            try:
                await admin_supabase.rpc(
                    "fn_increment_progress",
                    {
                        "p_user_id": str(player_id),
                        "p_achievement_id": achievement_id,
                        "p_target": target,
                        "p_context": context,
                    },
                ).execute()
            except Exception:
                logger.warning(
                    "Badge progress increment failed (non-critical)",
                    extra={"run_id": str(instance.run_id), "achievement_id": achievement_id,
                           "player_id": str(player_id)},
                    exc_info=True,
                )

    # ── Private: Deduplicated Progress Increment ─────────────────────────

    @classmethod
    async def _increment_unique(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        achievement_id: str,
        target: int,
        item_id: str,
    ) -> None:
        """Best-effort deduplicated progress via fn_increment_progress_unique RPC.

        Only counts each item_id once across all runs. Uses a JSONB 'seen' array
        stored in achievement_progress.context to track encountered items.
        """
        for player_id in instance.player_ids:
            try:
                await admin_supabase.rpc(
                    "fn_increment_progress_unique",
                    {
                        "p_user_id": str(player_id),
                        "p_achievement_id": achievement_id,
                        "p_target": target,
                        "p_item_id": item_id,
                        "p_context": {"run_id": str(instance.run_id)},
                    },
                ).execute()
            except Exception:
                logger.warning(
                    "Badge unique progress failed (non-critical)",
                    extra={"run_id": str(instance.run_id), "achievement_id": achievement_id,
                           "player_id": str(player_id)},
                    exc_info=True,
                )
