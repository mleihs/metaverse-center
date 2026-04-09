"""Dungeon Combat Service -- combat resolution, timers, victory/wipe/stalemate.

Manages the combat lifecycle:
  - submit_combat_actions()  → accept player actions, resolve when all submitted
  - _resolve_combat()        → one round of simultaneous resolution
  - _handle_combat_victory() → clear room, roll loot, enter distribution or complete
  - _handle_party_wipe()     → end run with trauma
  - _handle_combat_stalemate() → max rounds exceeded, room cleared, no loot
  - _enter_combat_room()     → spawn enemies, start planning timer
  - _start_combat_timer()    → async timeout for planning phase

Extracted from DungeonEngineService (H7: god-class decomposition).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance_dungeon import (
    CombatEventResponse,
    CombatRoundResultResponse,
    CombatState,
    CombatSubmission,
    CombatSubmitResponse,
    DungeonInstance,
    PhaseTimer,
)
from backend.services.combat.ability_schools import get_ability_by_id, get_agent_all_abilities
from backend.services.combat.combat_engine import (
    AgentAction,
    CombatContext,
    CombatRoundResult,
    generate_enemy_actions,
    resolve_combat_round,
)
from backend.services.combat.condition_tracks import can_act
from backend.services.combat.stress_system import apply_stress
from backend.services.dungeon.archetype_strategies import get_archetype_strategy
from backend.services.dungeon.dungeon_achievements import DungeonAchievementService
from backend.services.dungeon.dungeon_combat import (
    check_ambush,
    get_enemy_templates_dict,
    spawn_enemies,
)
from backend.services.dungeon.dungeon_encounters import select_encounter
from backend.services.dungeon.dungeon_loot import roll_loot
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_distribution_service import DungeonDistributionService
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_shared import (
    AUTO_APPLY_EFFECT_TYPES,
    CLIENT_TIMER_BUFFER_MS,
    COMBAT_PLANNING_TIMEOUT_MS,
    FALLBACK_SPAWNS,
    log_extra,
    rpc_with_retry,
)
from backend.utils.errors import bad_request
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class DungeonCombatService:
    """Combat resolution, timers, and outcome handling."""

    # ── Public: Submit Actions ─────────────────────────────────────────────

    @classmethod
    async def submit_combat_actions(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        user_id: UUID,
        submission: CombatSubmission,
    ) -> CombatSubmitResponse:
        """Submit combat actions for planning phase.

        C1: Lock prevents concurrent submissions from racing on the same instance.
        C3: Phase check under lock = idempotency guard against timer double-resolve.
        """
        async with _store.lock(run_id):
            instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

            if instance.phase != "combat_planning" or not instance.combat:
                raise bad_request("Not in combat planning phase")

            # Store actions for this player (mode="json" → UUID → str for checkpoint safety)
            instance.combat.submitted_actions[str(user_id)] = [a.model_dump(mode="json") for a in submission.actions]

            # Check if all players submitted
            all_submitted = len(instance.combat.submitted_actions) >= len(instance.player_ids)

            if all_submitted:
                # Cancel timer and resolve immediately
                timer = _store.pop_combat_timer(run_id)
                if timer and not timer.done():
                    timer.cancel()
                result = await cls._resolve_combat(admin_supabase, instance)
                return result

            return CombatSubmitResponse(accepted=True, waiting_for_players=True)

    # ── Combat Resolution ──────────────────────────────────────────────────

    @classmethod
    async def _resolve_combat(cls, admin_supabase: Client, instance: DungeonInstance) -> CombatSubmitResponse:
        """Resolve one combat round using the shared combat engine."""
        if not instance.combat:
            return {"error": "No active combat"}

        instance.phase = "combat_resolving"
        instance.combat.phase = "resolving"
        instance.phase_timer = None  # Clear timer — planning phase is over

        # Build agent actions from submissions, validating ability IDs + party membership
        agent_actions: list[AgentAction] = []
        party_agent_ids = {str(a.agent_id) for a in instance.party}
        for _uid, actions in instance.combat.submitted_actions.items():
            for action_data in actions:
                agent_id = action_data["agent_id"]
                if str(agent_id) not in party_agent_ids:
                    logger.warning(
                        "Submitted agent_id not in party — skipping",
                        extra=log_extra(instance, agent_id=agent_id),
                    )
                    continue
                ability_id = action_data["ability_id"]
                if not get_ability_by_id(ability_id):
                    logger.warning(
                        "Invalid ability_id submitted — auto-defend will cover this agent",
                        extra=log_extra(instance, ability_id=ability_id, agent_id=agent_id),
                    )
                    continue
                agent_actions.append(
                    AgentAction(
                        agent_id=agent_id,
                        ability_id=ability_id,
                        target_id=action_data.get("target_id"),
                    )
                )

        # Auto-defend for agents without submitted actions
        submitted_agent_ids = {str(a.agent_id) for a in agent_actions}
        alive_enemies = [e for e in instance.combat.enemies if e.is_alive]
        for agent in instance.party:
            if can_act(agent.condition) and str(agent.agent_id) not in submitted_agent_ids:
                if not alive_enemies:
                    continue
                abilities = get_agent_all_abilities(agent.aptitudes, instance.archetype)
                damage_abilities = [a for a in abilities if a.effect_type == "damage" and a.targets == "single_enemy"]
                if damage_abilities:
                    idx = (instance.combat.round_num + hash(str(agent.agent_id))) % len(damage_abilities)
                    chosen = damage_abilities[idx]
                    target_idx = (instance.combat.round_num + hash(str(agent.agent_id))) % len(alive_enemies)
                    agent_actions.append(
                        AgentAction(
                            agent_id=agent.agent_id,
                            ability_id=chosen.id,
                            target_id=alive_enemies[target_idx].instance_id,
                        )
                    )
                else:
                    fallback = abilities[0] if abilities else None
                    if fallback:
                        if fallback.targets in ("self", "single_ally", "all_allies"):
                            target = str(agent.agent_id)
                        else:
                            target = alive_enemies[0].instance_id
                        agent_actions.append(
                            AgentAction(
                                agent_id=agent.agent_id,
                                ability_id=fallback.id,
                                target_id=target,
                            )
                        )

        # Generate enemy actions
        enemy_templates = get_enemy_templates_dict(instance.archetype)
        enemy_templates = get_archetype_strategy(instance.archetype).modify_enemy_templates(
            instance,
            enemy_templates,
        )
        enemy_actions = generate_enemy_actions(
            instance.combat.enemies,
            instance.party,
            CombatContext(
                agents=instance.party,
                enemies=instance.combat.enemies,
                round_num=instance.combat.round_num,
                archetype_state=instance.archetype_state,
                is_ambush=instance.combat.is_ambush and instance.combat.round_num == 1,
            ),
            enemy_templates,
        )

        # Resolve round
        context = CombatContext(
            agents=instance.party,
            enemies=instance.combat.enemies,
            round_num=instance.combat.round_num,
            max_rounds=instance.combat.max_rounds,
            archetype_state=instance.archetype_state,
            trap_deployed=instance.combat.trap_deployed,
        )
        round_result = resolve_combat_round(context, agent_actions, enemy_actions, enemy_templates)

        # Sync mutable context state back to CombatState
        instance.combat.trap_deployed = context.trap_deployed

        # Update instance state from result
        instance.combat.round_num += 1
        instance.combat.submitted_actions.clear()

        # Track peak stress after all combat mutations (for flawless_run badge)
        DungeonAchievementService.track_peak_stress(instance)

        # Log combat event
        await DungeonCheckpointService.log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            instance.current_room,
            "combat_resolved",
            {
                "round": round_result.round_num,
                "events_count": len(round_result.events),
                "victory": round_result.victory,
                "wipe": round_result.party_wipe,
            },
        )

        round_data = cls._build_round_result(round_result)

        # Archetype per-round effects (e.g. Tower stability drain)
        strategy = get_archetype_strategy(instance.archetype)
        strategy.on_combat_round(instance)

        # Contagious decay: call on_enemy_hit for each successful enemy attack
        enemy_names = {e.name_en for e in instance.combat.enemies}
        for event in round_result.events:
            if event.actor in enemy_names and event.hit and event.damage_steps > 0:
                strategy.on_enemy_hit(instance)

        if round_result.combat_over:
            if round_result.victory:
                result = await cls._handle_combat_victory(admin_supabase, instance)
                result["round_result"] = round_data
                return CombatSubmitResponse.model_validate(result)
            if round_result.party_wipe:
                result = await cls._handle_party_wipe(admin_supabase, instance)
                result["round_result"] = round_data
                return CombatSubmitResponse.model_validate(result)
            if round_result.stalemate:
                return await cls._handle_combat_stalemate(admin_supabase, instance, round_result)

        # Next round: back to planning
        instance.phase = "combat_planning"
        instance.combat.phase = "planning"
        await cls._start_combat_timer(admin_supabase, instance)
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return CombatSubmitResponse(
            round_result=round_data,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    @staticmethod
    def _build_round_result(round_result: CombatRoundResult) -> CombatRoundResultResponse:
        """Convert internal CombatRoundResult dataclass to API response model.

        Maps domain field names to client-friendly names:
        round_num→round, damage_steps→damage, stress_delta→stress,
        narrative_summary_*→narrative_*, party_wipe→wipe.
        """
        return CombatRoundResultResponse(
            round=round_result.round_num,
            events=[
                CombatEventResponse(
                    actor=e.actor,
                    action=e.action,
                    target=e.target,
                    hit=e.hit,
                    damage=e.damage_steps,
                    stress=e.stress_delta,
                    narrative_en=e.narrative_en,
                    narrative_de=e.narrative_de,
                )
                for e in round_result.events
            ],
            narrative_en=round_result.narrative_summary_en,
            narrative_de=round_result.narrative_summary_de,
            victory=round_result.victory,
            wipe=round_result.party_wipe,
            stalemate=round_result.stalemate,
        )

    # ── Outcome Handlers ───────────────────────────────────────────────────

    @classmethod
    async def _handle_combat_victory(cls, admin_supabase: Client, instance: DungeonInstance) -> dict:
        """Handle combat victory: clear room, generate loot, restore visibility."""
        current_room = instance.rooms[instance.current_room]
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.combat = None

        # Restore archetype resource on combat victory
        get_archetype_strategy(instance.archetype).apply_restore(instance, "combat_victory")

        # Roll loot
        loot = roll_loot(
            current_room.loot_tier,
            instance.difficulty,
            instance.depth,
            instance.archetype_state,
            instance.archetype,
        )

        if current_room.room_type == "boss":
            await DungeonAchievementService.on_boss_victory(admin_supabase, instance)

            distributable = [item for item in loot if item.effect_type not in AUTO_APPLY_EFFECT_TYPES]
            operational_count = sum(1 for a in instance.party if can_act(a.condition))

            if not distributable or operational_count <= 1:
                instance.phase = "completed"
                await DungeonDistributionService.complete_run(admin_supabase, instance, loot)
            else:
                await DungeonDistributionService.begin_distribution(admin_supabase, instance, loot)
        else:
            instance.phase = "room_clear"
            await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return {
            "victory": True,
            "loot": [item.model_dump() for item in loot],
            "state": DungeonCheckpointService.build_client_state(instance),
        }

    @classmethod
    async def _handle_party_wipe(cls, admin_supabase: Client, instance: DungeonInstance) -> dict:
        """Handle party wipe: end run with no loot. Uses atomic RPC."""
        timer = _store.pop_combat_timer(instance.run_id)
        if timer and not timer.done():
            timer.cancel()

        instance.phase = "wiped"
        instance.combat = None

        # Build trauma outcomes: high stress, dread moodlets
        agent_outcomes = []
        for agent in instance.party:
            agent_outcomes.append(
                {
                    "agent_id": str(agent.agent_id),
                    "mood_delta": -20,
                    "stress_delta": 200,
                    "moodlets": [
                        {
                            "moodlet_type": "dungeon_trauma",
                            "emotion": "dread",
                            "strength": -15,
                            "source_description": f"Lost in {instance.archetype} dungeon",
                            "decay_type": "timed",
                        }
                    ],
                    "activity_narrative_en": (f"Lost in {instance.archetype} resonance dungeon. All agents captured."),
                    "activity_narrative_de": (
                        f"Verloren in {instance.archetype} Resonanz-Dungeon. Alle Agenten gefangen."
                    ),
                    "significance": 9,
                }
            )

        try:
            await rpc_with_retry(
                admin_supabase,
                "fn_wipe_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id,
                context="party_wipe",
            )
        except PostgrestAPIError:
            return {
                "wipe": True,
                "rpc_failed": True,
                "rpc_error_message": "Failed to save wipe result. Your progress will be recovered on next visit.",
                "state": DungeonCheckpointService.build_client_state(instance),
            }

        _store.remove(instance.run_id)
        logger.warning(
            "Party wipe",
            extra=log_extra(instance, outcome="wipe", depth=instance.depth, rooms_cleared=instance.rooms_cleared),
        )

        return {
            "wipe": True,
            "state": DungeonCheckpointService.build_client_state(instance),
        }

    @classmethod
    async def _handle_combat_stalemate(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        round_result: CombatRoundResult,
    ) -> CombatSubmitResponse:
        """Handle combat stalemate: max rounds exceeded. Room cleared but no loot."""
        timer = _store.pop_combat_timer(instance.run_id)
        if timer and not timer.done():
            timer.cancel()

        current_room = instance.rooms[instance.current_room]
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.combat = None
        instance.phase = "room_clear"

        # Apply stalemate stress penalty to all agents (+80 stress each)
        for agent in instance.party:
            if can_act(agent.condition):
                agent.stress, _ = apply_stress(agent.stress, 80)

        DungeonAchievementService.track_peak_stress(instance)
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        await DungeonCheckpointService.log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            instance.current_room,
            "combat_stalemate",
            {
                "rounds_fought": round_result.round_num,
                "stress_penalty": 80,
            },
        )

        logger.info(
            "Combat stalemate",
            extra=log_extra(instance, outcome="stalemate", rounds=round_result.round_num),
        )

        return CombatSubmitResponse(
            round_result=cls._build_round_result(round_result),
            stalemate=True,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Combat Room Setup ──────────────────────────────────────────────────

    @classmethod
    async def enter_combat_room(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        room,  # noqa: ANN001
        *,
        is_boss: bool = False,
    ) -> dict:
        """Set up combat encounter for a combat/elite/boss room."""
        encounter = select_encounter(room.room_type, instance.depth, instance.difficulty, instance.archetype)
        spawn_id = encounter.combat_encounter_id if encounter else None

        if not spawn_id:
            fallbacks = FALLBACK_SPAWNS.get(instance.archetype, FALLBACK_SPAWNS["The Shadow"])
            spawn_id = fallbacks["boss"] if is_boss else fallbacks["default"]

        # Threshold Defiance: spawn boss at +1 effective difficulty
        effective_difficulty = instance.difficulty
        if is_boss and instance.archetype_state.get("_threshold_defiance"):
            effective_difficulty = min(5, effective_difficulty + 1)

        enemies = spawn_enemies(spawn_id, effective_difficulty, instance.depth, instance.archetype)
        is_ambush = check_ambush(
            instance.archetype_state,
            instance.archetype,
            encounter.model_dump() if encounter else None,
        )

        instance.combat = CombatState(
            enemies=enemies,
            is_ambush=is_ambush,
        )
        instance.phase = "combat_planning"
        room.encounter_template_id = encounter.id if encounter else None

        # Start combat timer
        await cls._start_combat_timer(admin_supabase, instance)

        await DungeonCheckpointService.log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            room.index,
            "combat_started",
            {"enemies": [e.instance_id for e in enemies], "is_ambush": is_ambush, "is_boss": is_boss},
        )

        return {
            "combat": True,
            "is_ambush": is_ambush,
            "encounter_description_en": encounter.description_en if encounter else "",
            "encounter_description_de": encounter.description_de if encounter else "",
        }

    # ── Combat Timer ───────────────────────────────────────────────────────

    @classmethod
    async def _start_combat_timer(cls, _admin_supabase: Client, instance: DungeonInstance) -> None:
        """Start asyncio timer for combat planning timeout.

        C1/C3: Timer callback acquires per-instance lock before resolving,
        preventing races with concurrent user submissions.
        """
        instance.phase_timer = PhaseTimer(
            started_at=datetime.now(UTC).isoformat(),
            duration_ms=COMBAT_PLANNING_TIMEOUT_MS - CLIENT_TIMER_BUFFER_MS,
            phase="combat_planning",
        )

        async def _timer() -> None:
            await asyncio.sleep(COMBAT_PLANNING_TIMEOUT_MS / 1000)
            async with _store.lock(instance.run_id):
                inst = _store.get(instance.run_id)
                if not inst or inst.phase != "combat_planning":
                    return
                _store.pop_combat_timer(instance.run_id)
                logger.info("Combat timer expired, auto-resolving", extra=log_extra(inst))
                fresh_admin = await get_admin_supabase()
                await cls._resolve_combat(fresh_admin, inst)

        task = asyncio.create_task(_timer())
        _store.set_combat_timer(instance.run_id, task)
