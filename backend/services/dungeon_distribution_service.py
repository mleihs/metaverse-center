"""Dungeon Distribution Service -- loot assignment and run finalization.

Handles the debrief terminal phase after boss victories:
  - _begin_distribution()    → enter distribution phase, start timer
  - assign_loot()            → player assigns loot to agents
  - confirm_distribution()   → finalize and apply loot via RPC
  - _complete_run()          → auto-complete when no distributable loot

Extracted from DungeonEngineService (H7: god-class decomposition).
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance_dungeon import DungeonInstance
from backend.services.combat.condition_tracks import can_act
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_shared import (
    AUTO_APPLY_EFFECT_TYPES,
    DISTRIBUTION_TIMEOUT_MS,
    log_extra,
    rpc_with_retry,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class DungeonDistributionService:
    """Loot distribution, assignment, and run finalization."""

    # ── Run Completion (no distribution) ───────────────────────────────────

    @classmethod
    async def complete_run(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        loot: list,
    ) -> None:
        """Complete a dungeon run atomically via fn_complete_dungeon_run RPC.

        Single transaction: status update + agent outcomes + loot effects + event.
        """
        outcome = {
            "loot": [item.model_dump() for item in loot],
            "rooms_cleared": instance.rooms_cleared,
            "depth_reached": instance.depth,
            "party_state": [a.model_dump(mode="json") for a in instance.party],
        }

        agent_outcomes = cls._build_agent_outcomes(instance)
        loot_items = cls._build_loot_items_for_rpc(instance, loot)

        try:
            rpc_result = await rpc_with_retry(
                admin_supabase,
                "fn_complete_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_agent_outcomes": agent_outcomes,
                    "p_loot_items": loot_items,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id,
                context="complete_run",
            )
        except PostgrestAPIError:
            # Instance stays in memory — will be retried on next user action or server cleanup
            return

        # Log loot application results (aptitude cap skips, event modifier no-ops)
        loot_result = rpc_result.data if rpc_result and rpc_result.data else {}
        if isinstance(loot_result, dict) and loot_result.get("loot_result", {}).get("skipped"):
            logger.warning(
                "Loot items skipped",
                extra=log_extra(instance, skipped=loot_result["loot_result"]["skipped"]),
            )

        _store.remove(instance.run_id)
        logger.info(
            "Dungeon completed",
            extra=log_extra(
                instance,
                outcome="completed",
                rooms_cleared=instance.rooms_cleared,
                total_rooms=len(instance.rooms),
            ),
        )

    # ── Distribution Phase ─────────────────────────────────────────────────

    @classmethod
    async def begin_distribution(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        loot: list,
    ) -> None:
        """Enter loot distribution phase after boss victory.

        Applies agent outcomes (mood, stress, moodlets) immediately,
        but holds loot for player assignment via the debrief terminal.
        """
        instance.phase = "distributing"
        instance.pending_loot = [item.model_dump() for item in loot]
        instance.loot_assignments = {}

        # Pre-build auto-apply items (stress_heal → all agents, sim-wide → first agent)
        operational_agents = [a for a in instance.party if can_act(a.condition)]
        if not operational_agents:
            operational_agents = instance.party[:1]
        first_agent_id = str(operational_agents[0].agent_id) if operational_agents else None

        auto_items: list[dict] = []
        for item in loot:
            if item.effect_type == "dungeon_buff":
                continue
            if item.effect_type == "stress_heal":
                for agent in operational_agents:
                    auto_items.append(
                        {
                            "loot_id": item.id,
                            "agent_id": str(agent.agent_id),
                            "effect_type": item.effect_type,
                            "effect_params": item.effect_params,
                        }
                    )
            elif item.effect_type in ("event_modifier", "arc_modifier") and first_agent_id:
                auto_items.append(
                    {
                        "loot_id": item.id,
                        "agent_id": first_agent_id,
                        "effect_type": item.effect_type,
                        "effect_params": item.effect_params,
                    }
                )
        instance.auto_apply_loot = auto_items

        # Build agent outcomes (same as complete_run)
        outcome = {
            "loot": [item.model_dump() for item in loot],
            "rooms_cleared": instance.rooms_cleared,
            "depth_reached": instance.depth,
            "party_state": [a.model_dump(mode="json") for a in instance.party],
        }
        agent_outcomes = cls._build_agent_outcomes(instance)

        try:
            await rpc_with_retry(
                admin_supabase,
                "fn_begin_distribution",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id,
                context="begin_distribution",
            )
        except PostgrestAPIError:
            # Instance stays in memory — will be retried on next user action
            return

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        # Start distribution timeout — auto-assigns remaining loot after DISTRIBUTION_TIMEOUT_MS
        cls._start_distribution_timer(instance)

        distributable_count = len(
            [i for i in instance.pending_loot if i.get("effect_type") not in AUTO_APPLY_EFFECT_TYPES]
        )
        logger.info(
            "Distribution started",
            extra=log_extra(instance, distributable=distributable_count, auto_apply=len(auto_items)),
        )

    # ── Loot Assignment ────────────────────────────────────────────────────

    @classmethod
    async def assign_loot(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        loot_id: str,
        agent_id: UUID,
        *,
        dimension: str | None = None,
        user_id: UUID,
    ) -> dict:
        """Assign one distributable loot item to an agent."""
        async with _store.lock(run_id):
            return await cls._assign_loot_locked(
                admin_supabase, run_id, loot_id, agent_id, dimension=dimension, user_id=user_id,
            )

    @classmethod
    async def _assign_loot_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        loot_id: str,
        agent_id: UUID,
        *,
        dimension: str | None = None,
        user_id: UUID,
    ) -> dict:
        from backend.models.resonance_dungeon import BIG_FIVE_DIMENSIONS

        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)
        if instance.phase != "distributing":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not in distribution phase")

        # Validate loot_id exists and is distributable
        loot_item = next((i for i in instance.pending_loot if i["id"] == loot_id), None)
        if not loot_item:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Loot item '{loot_id}' not found")
        if loot_item.get("effect_type") in AUTO_APPLY_EFFECT_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This item is auto-applied")

        # Personality modifier: require valid Big Five dimension
        if loot_item.get("effect_type") == "personality_modifier":
            if not dimension or dimension not in BIG_FIVE_DIMENSIONS:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"personality_modifier requires dimension: {', '.join(sorted(BIG_FIVE_DIMENSIONS))}",
                )

        # Validate agent is in party and operational
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent not in party")
        if not can_act(agent.condition):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent is captured and cannot receive loot")

        instance.loot_assignments[loot_id] = str(agent_id)
        # Store extra params for items that need player choices (personality dimension)
        if dimension:
            instance.loot_extra_params[loot_id] = {"dimension": dimension}
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return {
            "assignments": instance.loot_assignments,
            "remaining": cls._count_unassigned(instance),
            "all_assigned": cls._count_unassigned(instance) == 0,
            "state": DungeonCheckpointService.build_client_state(instance).model_dump(),
        }

    # ── Distribution Confirmation ──────────────────────────────────────────

    @classmethod
    async def confirm_distribution(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
    ) -> dict:
        """Finalize loot distribution and complete the dungeon run.

        user_id is optional to allow auto-confirm from distribution timer.
        Acquires lock when called externally (router). Timer callbacks must
        call _confirm_distribution_impl directly (they already hold the lock).
        """
        async with _store.lock(run_id):
            return await cls._confirm_distribution_impl(admin_supabase, run_id, user_id=user_id)

    @classmethod
    async def _confirm_distribution_impl(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
    ) -> dict:
        """Inner impl — caller must hold _store.lock(run_id)."""
        # Cancel distribution timer (player confirmed before timeout)
        timer = _store.pop_distribution_timer(run_id)
        if timer and not timer.done():
            timer.cancel()

        instance = await DungeonCheckpointService.get_instance(
            run_id,
            admin_supabase,
            require_player=user_id,
        )
        if instance.phase != "distributing":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not in distribution phase")
        if cls._count_unassigned(instance) > 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not all items assigned")

        # Build final loot items: auto-applied + player-assigned
        loot_items = list(instance.auto_apply_loot)
        for loot_data in instance.pending_loot:
            loot_id = loot_data["id"]
            effect_type = loot_data.get("effect_type", "")
            if effect_type in AUTO_APPLY_EFFECT_TYPES:
                continue  # Already in auto_apply_loot
            assigned_agent = instance.loot_assignments.get(loot_id)
            if assigned_agent:
                params = dict(loot_data.get("effect_params", {}))
                # Merge player-chosen extra params (e.g. personality dimension)
                extra = instance.loot_extra_params.get(loot_id)
                if extra:
                    params.update(extra)
                loot_items.append(
                    {
                        "loot_id": loot_id,
                        "agent_id": assigned_agent,
                        "effect_type": effect_type,
                        "effect_params": params,
                    }
                )

        # Cancel distribution timer
        timer = _store.pop_distribution_timer(run_id)
        if timer and not timer.done():
            timer.cancel()

        try:
            rpc_result = await admin_supabase.rpc(
                "fn_finalize_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_loot_items": loot_items,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
            ).execute()
        except PostgrestAPIError:
            logger.exception("Failed to finalize distribution", extra=log_extra(instance))
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("phase", "finalize_distribution")
                sentry_sdk.capture_exception()
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to finalize") from None

        loot_result = rpc_result.data if rpc_result and rpc_result.data else {}
        if isinstance(loot_result, dict) and loot_result.get("loot_result", {}).get("skipped"):
            logger.warning(
                "Loot items skipped",
                extra=log_extra(instance, skipped=loot_result["loot_result"]["skipped"]),
            )

        instance.phase = "completed"
        _store.remove(instance.run_id)
        logger.info(
            "Distribution finalized",
            extra=log_extra(instance, outcome="distributed", loot_items=len(loot_items)),
        )

        return {
            "loot_result": loot_result,
            "state": DungeonCheckpointService.build_client_state(instance).model_dump(),
        }

    # ── Distribution Timer ─────────────────────────────────────────────────

    @classmethod
    def _start_distribution_timer(cls, instance: DungeonInstance) -> None:
        """Start a timer that auto-assigns unassigned loot after DISTRIBUTION_TIMEOUT_MS."""

        async def _auto_finalize() -> None:
            await asyncio.sleep(DISTRIBUTION_TIMEOUT_MS / 1000)
            async with _store.lock(instance.run_id):
                if not _store.pop_distribution_timer(instance.run_id):
                    return  # Already confirmed by player
                inst = _store.get(instance.run_id)
                if not inst or inst.phase != "distributing":
                    return

                # Auto-assign unassigned distributable items to the first party agent
                first_agent_id = str(inst.party[0].agent_id) if inst.party else None
                if first_agent_id:
                    for item in inst.pending_loot:
                        if item.get("effect_type") in AUTO_APPLY_EFFECT_TYPES:
                            continue
                        if item["id"] not in inst.loot_assignments:
                            inst.loot_assignments[item["id"]] = first_agent_id

                logger.info(
                    "Distribution timer expired — auto-assigned loot",
                    extra=log_extra(inst, assigned=len(inst.loot_assignments), first_agent=first_agent_id),
                )

                # Finalize (no user_id — internal call)
                try:
                    fresh_admin = await get_admin_supabase()
                    await cls._confirm_distribution_impl(fresh_admin, inst.run_id)
                except Exception:
                    logger.exception(
                        "Auto-finalize distribution failed",
                        extra={"run_id": str(instance.run_id)},
                    )
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("service", "dungeon_engine")
                        scope.set_tag("run_id", str(instance.run_id))
                        scope.set_tag("context", "distribution_timer")
                        sentry_sdk.capture_exception()

        task = asyncio.create_task(_auto_finalize())
        _store.set_distribution_timer(instance.run_id, task)

    # ── Helpers ────────────────────────────────────────────────────────────

    @classmethod
    def _build_agent_outcomes(cls, instance: DungeonInstance) -> list[dict]:
        """Build agent outcomes for the completion RPC (mood, stress, moodlets, activities)."""
        outcomes = []
        for agent in instance.party:
            outcomes.append(
                {
                    "agent_id": str(agent.agent_id),
                    "mood_delta": -10 if agent.stress > 500 else 10,
                    "stress_delta": agent.stress,
                    "moodlets": [
                        {
                            "moodlet_type": "dungeon_survivor",
                            "emotion": "pride" if agent.condition != "afflicted" else "dread",
                            "strength": 10 if agent.condition != "afflicted" else -10,
                            "source_description": f"Survived {instance.archetype} dungeon",
                            "decay_type": "timed",
                        }
                    ],
                    "activity_narrative_en": f"Explored {instance.archetype} resonance dungeon and prevailed.",
                    "activity_narrative_de": f"Erkundete {instance.archetype} Resonanz-Dungeon und bestand.",
                    "significance": 8,
                }
            )
        return outcomes

    @classmethod
    def _build_loot_items_for_rpc(cls, instance: DungeonInstance, loot: list) -> list[dict]:
        """Assign loot effects to agents for the fn_apply_dungeon_loot RPC.

        Phase 0 assignment strategy:
        - stress_heal → all operational agents
        - memory/moodlet/aptitude_boost → first operational agent
        - event_modifier/arc_modifier → first agent (simulation-level effects)
        - dungeon_buff/next_dungeon_bonus → first agent (stored for lookup)
        """
        operational_agents = [a for a in instance.party if can_act(a.condition)]
        if not operational_agents:
            operational_agents = instance.party[:1]  # fallback: first agent

        first_agent_id = str(operational_agents[0].agent_id) if operational_agents else None
        if not first_agent_id:
            return []

        items: list[dict] = []
        for loot_item in loot:
            effect_type = loot_item.effect_type

            # Skip runtime-only effects (no DB persistence needed)
            if effect_type == "dungeon_buff":
                continue

            if effect_type == "stress_heal":
                # Apply to all operational agents
                for agent in operational_agents:
                    items.append(
                        {
                            "loot_id": loot_item.id,
                            "agent_id": str(agent.agent_id),
                            "effect_type": effect_type,
                            "effect_params": loot_item.effect_params,
                        }
                    )
            else:
                # Assign to first operational agent
                items.append(
                    {
                        "loot_id": loot_item.id,
                        "agent_id": first_agent_id,
                        "effect_type": effect_type,
                        "effect_params": loot_item.effect_params,
                    }
                )

        return items

    @classmethod
    def _count_unassigned(cls, instance: DungeonInstance) -> int:
        """Count distributable loot items not yet assigned."""
        return sum(
            1
            for item in instance.pending_loot
            if item.get("effect_type") not in AUTO_APPLY_EFFECT_TYPES and item["id"] not in instance.loot_assignments
        )
