"""Dungeon Engine Service — Core orchestrator for Resonance Dungeon lifecycle.

Manages in-memory dungeon instances, delegates to combat/ and dungeon/ modules,
and checkpoints state to PostgreSQL after every state transition (Review #1).

Pattern: Like heartbeat_service.py — module-level singleton, @classmethod methods.
NOT extending BaseService (this is not standard CRUD).

All DB mutations use admin_supabase (service_role) for multiplayer compatibility
(Review #16). User JWT is only used for validation reads.

State machine:
  CREATE → EXPLORING → ENCOUNTER | COMBAT_PLANNING → COMBAT_RESOLVING →
  COMBAT_OUTCOME → ROOM_CLEAR → (loop or) COMPLETED | RETREATED | WIPED
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import UTC, datetime
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance_dungeon import (
    AbilityOption,
    AgentCombatState,
    AgentCombatStateClient,
    AvailableDungeonResponse,
    CombatState,
    CombatStateClient,
    CombatSubmission,
    DungeonAction,
    DungeonClientState,
    DungeonInstance,
    DungeonRunCreate,
    DungeonRunResponse,
    EnemyCombatStateClient,
    PhaseTimer,
    RoomNode,
    RoomNodeClient,
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
from backend.services.combat.skill_checks import SkillCheckContext, resolve_skill_check
from backend.services.combat.stress_system import (
    REST_STRESS_HEAL,
    apply_stress,
    calculate_ambient_stress,
    stress_threshold,
)
from backend.services.dungeon.dungeon_archetypes import (
    ARCHETYPE_CONFIGS,
    get_depth_for_difficulty,
)
from backend.services.dungeon.dungeon_combat import (
    check_ambush,
    get_enemy_templates_dict,
    spawn_enemies,
)
from backend.services.dungeon.dungeon_encounters import (
    get_encounter_by_id,
    select_banter,
    select_encounter,
)
from backend.services.dungeon.dungeon_generator import generate_dungeon_graph
from backend.services.dungeon.dungeon_loot import roll_loot
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Module-Level Instance Store ─────────────────────────────────────────────
# In-memory dict. NOT shared across workers. Sufficient for <100 concurrent dungeons.

_active_instances: dict[str, DungeonInstance] = {}
_combat_timers: dict[str, asyncio.Task] = {}

def _narrate_effects(effects: dict) -> tuple[list[str], list[str]]:
    """Convert raw encounter/treasure effects dict to bilingual narrative descriptions.

    Backend owns all content generation (bilingual, consistent with encounter narratives).
    Returns (narrative_en_lines, narrative_de_lines).
    """
    en: list[str] = []
    de: list[str] = []
    for key, val in effects.items():
        match key:
            case "reveal_rooms":
                n = int(val)
                if n == 1:
                    en.append("One room ahead becomes clear.")
                    de.append("Ein Raum voraus wird sichtbar.")
                elif n > 1:
                    en.append(f"{n} rooms ahead become clear.")
                    de.append(f"{n} Räume voraus werden sichtbar.")
            case "stress":
                n = int(val)
                if n > 0:
                    en.append(f"The effort takes its toll. (+{n} stress)")
                    de.append(f"Die Anstrengung fordert ihren Tribut. (+{n} Stress)")
                elif n < 0:
                    en.append(f"The tension eases. ({n} stress)")
                    de.append(f"Die Anspannung lässt nach. ({n} Stress)")
            case "stress_heal":
                n = int(val)
                if n > 0:
                    en.append(f"A moment of calm. (-{n} stress)")
                    de.append(f"Ein Moment der Ruhe. (-{n} Stress)")
            case "loot":
                if val:
                    en.append("Something valuable emerges.")
                    de.append("Etwas Wertvolles taucht auf.")
            case "loot_tier_penalty":
                en.append("The hasty attempt damages the find.")
                de.append("Der übereilte Versuch beschädigt den Fund.")
            case "visibility":
                n = int(val)
                sign = "+" if n > 0 else ""
                en.append(f"{sign}{n} Visibility.")
                de.append(f"{sign}{n} Sichtbarkeit.")
            case "stability":
                n = int(val)
                sign = "+" if n > 0 else ""
                en.append(f"{sign}{n} Stability.")
                de.append(f"{sign}{n} Stabilität.")
            case "shadow_resonance":
                en.append("The shadows resonate with the encounter.")
                de.append("Die Schatten resonieren mit der Begegnung.")
            case "resilience_bonus":
                en.append("Something hardens within. Resilience improved.")
                de.append("Etwas härtet sich im Inneren. Widerstandskraft verbessert.")
            case "discovery":
                if val:
                    en.append("A discovery worth remembering.")
                    de.append("Eine Entdeckung, die es wert ist, erinnert zu werden.")
            case "insight":
                if val:
                    en.append("Understanding deepens.")
                    de.append("Das Verständnis vertieft sich.")
            case "memory_created":
                if val:
                    en.append("This moment imprints itself.")
                    de.append("Dieser Moment prägt sich ein.")
            case "ambush_trigger":
                pass  # Game mechanic flag — no player-facing narrative
            case _:
                pass  # Unknown effect keys are intentionally silent
    return en, de


MAX_CONCURRENT_PER_SIM = 1
INSTANCE_TTL_SECONDS = 1800  # 30 min inactive → auto-cleanup
COMBAT_PLANNING_TIMEOUT_MS = 45_000
DISTRIBUTION_TIMEOUT_MS = 300_000  # 5 min for loot distribution
# Client timer expires before server to win the submission race.
# Server auto-resolves at COMBAT_PLANNING_TIMEOUT_MS; client submits earlier.
CLIENT_TIMER_BUFFER_MS = 3_000

# Effect types that auto-apply without player choice:
# stress_heal → all operational agents, event/arc_modifier → simulation-wide, dungeon_buff → runtime
_AUTO_APPLY_EFFECT_TYPES = frozenset({"stress_heal", "event_modifier", "arc_modifier", "dungeon_buff"})
_distribution_timers: dict[str, asyncio.Task] = {}

# ── Archetype Fallback Spawns ──────────────────────────────────────────────
# Used when no encounter template matches (shouldn't happen, but safety net).

_FALLBACK_SPAWNS: dict[str, dict[str, str]] = {
    "The Shadow": {
        "boss": "shadow_remnant_spawn",
        "default": "shadow_whispers_spawn",
        "rest_ambush": "shadow_rest_ambush_spawn",
    },
    "The Tower": {
        "boss": "tower_collapse_spawn",
        "default": "tower_tremor_spawn",
        "rest_ambush": "tower_rest_ambush_spawn",
    },
}


class DungeonEngineService:
    """Orchestrator for dungeon instance lifecycle and state machine."""

    # ── Run Creation ────────────────────────────────────────────────────

    @classmethod
    async def create_run(
        cls,
        admin_supabase: Client,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        body: DungeonRunCreate,
    ) -> dict:
        """Create a new dungeon run.

        1. Validate: no active run for this sim (DB unique index enforces)
        2. Fetch party agents (aptitudes, personality, mood, stress)
        3. Generate dungeon graph
        4. Create DB record
        5. Create in-memory DungeonInstance
        6. Checkpoint initial state
        7. Return run + initial client state
        """
        archetype = body.archetype
        config = ARCHETYPE_CONFIGS.get(archetype)
        if not config:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown archetype: {archetype}")

        difficulty = body.difficulty
        depth = get_depth_for_difficulty(difficulty)

        # Fetch all party data in one RPC (3 queries → 1: agents + aptitudes + mood)
        agent_ids_str = [str(aid) for aid in body.party_agent_ids]
        party_resp = await admin_supabase.rpc(
            "fn_get_party_combat_state",
            {
                "p_agent_ids": agent_ids_str,
                "p_simulation_id": str(simulation_id),
            },
        ).execute()

        party_data = party_resp.data if party_resp.data else []
        if len(party_data) != len(body.party_agent_ids):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more agents not found in simulation")

        # Build party state from RPC result
        party: list[AgentCombatState] = []
        for agent_data in party_data:
            aptitudes_raw = agent_data.get("aptitudes", {})
            aptitudes = {k: int(v) for k, v in aptitudes_raw.items()} if aptitudes_raw else {}
            if not aptitudes:
                # Agents must have at least one aptitude school for combat abilities.
                # DB can return null/empty for aptitudes — assign viable defaults.
                aptitudes = {"spy": 3, "guardian": 2}
                logger.warning(
                    "Agent %s has no aptitudes, assigning defaults",
                    agent_data.get("name", agent_data["id"]),
                )

            # Extract Big Five traits from personality_profile for combat modifiers
            personality_raw = agent_data.get("personality", {})
            personality = (
                {k: float(v) for k, v in personality_raw.items() if isinstance(v, int | float)}
                if personality_raw
                else {}
            )

            party.append(
                AgentCombatState(
                    agent_id=UUID(agent_data["id"]),
                    agent_name=agent_data["name"],
                    portrait_url=agent_data.get("portrait_url"),
                    stress=0,  # Dungeon stress starts at 0 (independent of simulation stress)
                    mood=agent_data.get("mood_score", 0),
                    resilience=agent_data.get("resilience", 0.5),
                    aptitudes=aptitudes,
                    personality=personality,
                )
            )

        # Generate dungeon graph
        rooms = generate_dungeon_graph(archetype, difficulty, depth)

        # Build archetype initial state
        archetype_state = cls._init_archetype_state(archetype, config)

        # Create DB record (unique partial index prevents concurrent runs)
        signature = config.get("signature", "conflict_wave")
        try:
            run_data = {
                "simulation_id": str(simulation_id),
                "archetype": archetype,
                "resonance_signature": signature,
                "party_agent_ids": agent_ids_str,
                "party_player_ids": [str(user_id)],
                "difficulty": difficulty,
                "depth_target": depth,
                "config": {"rooms": [r.model_dump() for r in rooms]},
                "rooms_total": len(rooms),
                "status": "exploring",
                "started_by_id": str(user_id),
            }
            insert_resp = (
                await admin_supabase.table(
                    "resonance_dungeon_runs",
                )
                .insert(run_data)
                .execute()
            )
        except PostgrestAPIError as exc:
            if "idx_dungeon_runs_one_active_per_sim" in str(exc):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"An active {archetype} dungeon run already exists for this simulation",
                ) from exc
            logger.exception("Failed to create dungeon run")
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("simulation_id", str(simulation_id))
                sentry_sdk.capture_exception(exc)
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create dungeon run") from exc

        run = insert_resp.data[0]
        run_id = UUID(run["id"])

        # Create in-memory instance
        instance = DungeonInstance(
            run_id=run_id,
            simulation_id=simulation_id,
            archetype=archetype,
            signature=signature,
            difficulty=difficulty,
            rooms=rooms,
            party=party,
            player_ids=[user_id],
            archetype_state=archetype_state,
            phase="exploring",
        )
        # Entrance room starts revealed + scouted; adjacent rooms revealed (map) only
        rooms[0].revealed = True
        rooms[0].scouted = True
        for conn_idx in rooms[0].connections:
            if conn_idx < len(rooms):
                rooms[conn_idx].revealed = True
        _active_instances[str(run_id)] = instance

        # Initial checkpoint
        await cls._checkpoint(admin_supabase, instance)

        # Log creation event
        await cls._log_event(
            admin_supabase,
            run_id,
            simulation_id,
            0,
            0,
            "room_entered",
            {
                "room_type": "entrance",
            },
            narrative_en="The party enters the dungeon.",
            narrative_de="Die Gruppe betritt den Dungeon.",
        )

        logger.info(
            "Dungeon run created: run_id=%s sim=%s archetype=%s difficulty=%d depth=%d",
            run_id,
            simulation_id,
            archetype,
            difficulty,
            depth,
        )

        return {
            "run": DungeonRunResponse(**run).model_dump(),
            "state": cls._build_client_state(instance).model_dump(),
        }

    # ── Room Movement ───────────────────────────────────────────────────

    @classmethod
    async def move_to_room(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        room_index: int,
        *,
        user_id: UUID,
    ) -> dict:
        """Move party to an adjacent room.

        Validates adjacency, processes room entry, applies archetype effects,
        generates banter, checkpoints, and returns new state.
        """
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase not in ("exploring", "room_clear"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot move in phase: {instance.phase}")

        current_room = instance.rooms[instance.current_room]
        if room_index not in current_room.connections:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Room is not adjacent to current room")

        if room_index < 0 or room_index >= len(instance.rooms):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid room index")

        target_room = instance.rooms[room_index]

        # Move party
        instance.current_room = room_index
        instance.turn += 1
        target_room.revealed = True
        target_room.scouted = True  # Entering a room reveals its type

        # Reveal connected rooms on map (but don't scout — type stays hidden)
        for conn_idx in target_room.connections:
            if conn_idx < len(instance.rooms):
                instance.rooms[conn_idx].revealed = True

        # Track depth changes
        if target_room.depth > instance.depth:
            instance.depth = target_room.depth

        # Apply archetype effects (drain on room entry)
        banter_trigger = "room_entered"
        drain_trigger = cls._apply_archetype_drain(instance)
        if drain_trigger:
            banter_trigger = drain_trigger
        if target_room.depth > current_room.depth:
            banter_trigger = "depth_change"

        # Apply ambient stress (doubled during Tower structural failure)
        ambient = calculate_ambient_stress(instance.depth, instance.difficulty)
        if (
            instance.archetype == "The Tower"
            and instance.archetype_state.get("stability", 100) <= 0
        ):
            mc = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
            ambient = int(ambient * mc.get("collapse_stress_multiplier", 2.0))
        for agent in instance.party:
            if can_act(agent.condition):
                agent.stress = min(1000, agent.stress + ambient)

        # Override banter trigger for boss rooms
        if target_room.room_type == "boss":
            banter_trigger = "boss_approach"

        # Generate banter
        banter = select_banter(
            banter_trigger,
            [{"personality": a.personality} for a in instance.party],
            instance.used_banter_ids,
            instance.archetype,
        )
        banter_text = None
        if banter:
            instance.used_banter_ids.append(banter["id"])
            # Resolve {agent}, {agent_a}, {agent_b} placeholders with party members
            alive = [a for a in instance.party if can_act(a.condition)]
            if alive:
                agent = random.choice(alive)
                for key in ("text_en", "text_de"):
                    if key in banter:
                        banter[key] = banter[key].replace("{agent}", agent.agent_name)
                if len(alive) >= 2:
                    pair = random.sample(alive, 2)
                    for key in ("text_en", "text_de"):
                        if key in banter:
                            banter[key] = (
                                banter[key]
                                .replace("{agent_a}", pair[0].agent_name)
                                .replace("{agent_b}", pair[1].agent_name)
                            )
            banter_text = banter

        # Process room by type
        result: dict = {"banter": banter_text}

        if target_room.room_type in ("combat", "elite"):
            result.update(await cls._enter_combat_room(admin_supabase, instance, target_room))
        elif target_room.room_type in ("encounter", "rest", "treasure"):
            result.update(cls._enter_interactive_room(instance, target_room))
        elif target_room.room_type == "boss":
            result.update(await cls._enter_combat_room(admin_supabase, instance, target_room, is_boss=True))
        elif target_room.room_type == "exit":
            instance.phase = "exit"
            result["exit_available"] = True

        # Log event
        await cls._log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            room_index,
            "room_entered",
            {"room_type": target_room.room_type, "phase": instance.phase},
            narrative_en=banter.get("text_en", "") if banter else None,
            narrative_de=banter.get("text_de", "") if banter else None,
        )

        # Checkpoint after state transition (Review #1)
        await cls._checkpoint(admin_supabase, instance)

        result["state"] = cls._build_client_state(instance).model_dump()
        return result

    # ── Combat ──────────────────────────────────────────────────────────

    @classmethod
    async def submit_combat_actions(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        user_id: UUID,
        submission: CombatSubmission,
    ) -> dict:
        """Submit combat actions for planning phase."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase != "combat_planning" or not instance.combat:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not in combat planning phase")

        # Store actions for this player (mode="json" → UUID → str for checkpoint safety)
        instance.combat.submitted_actions[str(user_id)] = [a.model_dump(mode="json") for a in submission.actions]

        # Check if all players submitted
        all_submitted = len(instance.combat.submitted_actions) >= len(instance.player_ids)

        if all_submitted:
            # Cancel timer and resolve immediately
            timer = _combat_timers.pop(str(run_id), None)
            if timer and not timer.done():
                timer.cancel()
            result = await cls._resolve_combat(admin_supabase, instance)
            return result

        return {"accepted": True, "waiting_for_players": True}

    @classmethod
    async def _resolve_combat(cls, admin_supabase: Client, instance: DungeonInstance) -> dict:
        """Resolve one combat round using the shared combat engine."""
        if not instance.combat:
            return {"error": "No active combat"}

        instance.phase = "combat_resolving"
        instance.combat.phase = "resolving"
        instance.phase_timer = None  # Clear timer — planning phase is over

        # Build agent actions from submissions, validating ability IDs
        agent_actions: list[AgentAction] = []
        for _uid, actions in instance.combat.submitted_actions.items():
            for action_data in actions:
                ability_id = action_data["ability_id"]
                if not get_ability_by_id(ability_id):
                    logger.warning(
                        "Invalid ability_id '%s' submitted for agent %s in run %s — auto-defend will cover this agent",
                        ability_id,
                        action_data["agent_id"],
                        instance.run_id,
                    )
                    continue  # Skip invalid — auto-defend loop below will assign a valid action
                agent_actions.append(
                    AgentAction(
                        agent_id=action_data["agent_id"],
                        ability_id=ability_id,
                        target_id=action_data.get("target_id"),
                    )
                )

        # Auto-defend for agents without submitted actions.
        # Rotates through damage abilities per round for variety (not always
        # the same move). Falls back to self-buff for pure support/tank agents.
        submitted_agent_ids = {str(a.agent_id) for a in agent_actions}
        alive_enemies = [e for e in instance.combat.enemies if e.is_alive]
        for agent in instance.party:
            if can_act(agent.condition) and str(agent.agent_id) not in submitted_agent_ids:
                if not alive_enemies:
                    continue
                abilities = get_agent_all_abilities(agent.aptitudes, instance.archetype)
                damage_abilities = [
                    a for a in abilities
                    if a.effect_type == "damage" and a.targets == "single_enemy"
                ]
                if damage_abilities:
                    # Rotate: round_num + agent hash → different ability each round
                    idx = (instance.combat.round_num + hash(str(agent.agent_id))) % len(damage_abilities)
                    chosen = damage_abilities[idx]
                    # Also rotate target across alive enemies
                    target_idx = (instance.combat.round_num + hash(str(agent.agent_id))) % len(alive_enemies)
                    agent_actions.append(
                        AgentAction(
                            agent_id=agent.agent_id,
                            ability_id=chosen.id,
                            target_id=alive_enemies[target_idx].instance_id,
                        )
                    )
                else:
                    # No damage ability (pure support/tank): use first available
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
        enemy_templates = get_enemy_templates_dict()
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

        # Log combat event
        await cls._log_event(
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

        round_data = cls._build_round_result_dict(round_result)

        # Tower: drain stability per combat round
        if instance.archetype == "The Tower":
            cls._apply_tower_combat_drain(instance)

        if round_result.combat_over:
            if round_result.victory:
                result = await cls._handle_combat_victory(admin_supabase, instance)
                result["round_result"] = round_data
                return result
            if round_result.party_wipe:
                result = await cls._handle_party_wipe(admin_supabase, instance)
                result["round_result"] = round_data
                return result
            if round_result.stalemate:
                return await cls._handle_combat_stalemate(admin_supabase, instance, round_result)

        # Next round: back to planning
        instance.phase = "combat_planning"
        instance.combat.phase = "planning"
        await cls._start_combat_timer(admin_supabase, instance)
        await cls._checkpoint(admin_supabase, instance)

        return {
            "round_result": round_data,
            "state": cls._build_client_state(instance).model_dump(),
        }

    @staticmethod
    def _build_round_result_dict(round_result: CombatRoundResult) -> dict:
        """Serialize a CombatRoundResult into the API response dict.

        Shared by normal rounds, victory, wipe, and stalemate responses
        so the frontend always receives the final round's combat events.
        """
        return {
            "round": round_result.round_num,
            "events": [
                {
                    "actor": e.actor,
                    "action": e.action,
                    "target": e.target,
                    "hit": e.hit,
                    "damage": e.damage_steps,
                    "stress": e.stress_delta,
                    "narrative_en": e.narrative_en,
                    "narrative_de": e.narrative_de,
                }
                for e in round_result.events
            ],
            "narrative_en": round_result.narrative_summary_en,
            "narrative_de": round_result.narrative_summary_de,
            "victory": round_result.victory,
            "wipe": round_result.party_wipe,
            "stalemate": round_result.stalemate,
        }

    @classmethod
    async def _handle_combat_victory(cls, admin_supabase: Client, instance: DungeonInstance) -> dict:
        """Handle combat victory: clear room, generate loot, restore visibility."""
        current_room = instance.rooms[instance.current_room]
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.combat = None

        # Restore archetype resource on combat victory
        cls._apply_archetype_restore(instance, "combat_victory")

        # Roll loot
        loot = roll_loot(
            current_room.loot_tier, instance.difficulty, instance.depth,
            instance.archetype_state, instance.archetype,
        )

        if current_room.room_type == "boss":
            # Classify loot: auto-apply (simulation-wide + stress) vs distributable (agent-specific)
            distributable = [
                item for item in loot
                if item.effect_type not in _AUTO_APPLY_EFFECT_TYPES
            ]
            operational_count = sum(1 for a in instance.party if can_act(a.condition))

            if not distributable or operational_count <= 1:
                # No distributable items or only 1 agent → auto-assign + complete immediately
                instance.phase = "completed"
                await cls._complete_run(admin_supabase, instance, loot)
            else:
                # Enter distribution phase — player chooses who gets what
                await cls._begin_distribution(admin_supabase, instance, loot)
        else:
            instance.phase = "room_clear"
            await cls._checkpoint(admin_supabase, instance)

        return {
            "victory": True,
            "loot": [item.model_dump() for item in loot],
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    async def _handle_party_wipe(cls, admin_supabase: Client, instance: DungeonInstance) -> dict:
        """Handle party wipe: end run with no loot. Uses atomic RPC."""
        # Cancel any active combat timer
        timer = _combat_timers.pop(str(instance.run_id), None)
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
                    "activity_narrative_en": f"Lost in {instance.archetype} resonance dungeon. All agents captured.",
                    "activity_narrative_de": (
                        f"Verloren in {instance.archetype} Resonanz-Dungeon. Alle Agenten gefangen."
                    ),
                    "significance": 9,
                }
            )

        try:
            await admin_supabase.rpc(
                "fn_wipe_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
            ).execute()
        except PostgrestAPIError:
            logger.exception("Failed to wipe dungeon run via RPC for run %s", instance.run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                sentry_sdk.capture_exception()
            # Keep instance in memory — DB still has active status, retry possible
            return {"wipe": True, "rpc_failed": True, "state": cls._build_client_state(instance).model_dump()}

        _active_instances.pop(str(instance.run_id), None)
        logger.warning("Party wipe: run_id=%s sim=%s", instance.run_id, instance.simulation_id)

        return {
            "wipe": True,
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    async def _handle_combat_stalemate(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        round_result: CombatRoundResult,
    ) -> dict:
        """Handle combat stalemate: max rounds exceeded. Room cleared (no re-trigger) but no loot."""
        # Cancel any active combat timer
        timer = _combat_timers.pop(str(instance.run_id), None)
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

        await cls._checkpoint(admin_supabase, instance)

        await cls._log_event(
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
            "Combat stalemate after %d rounds: run_id=%s",
            round_result.round_num,
            instance.run_id,
        )

        return {
            "round_result": cls._build_round_result_dict(round_result),
            "stalemate": True,
            "state": cls._build_client_state(instance).model_dump(),
        }

    # ── Encounter Actions ───────────────────────────────────────────────

    @classmethod
    async def handle_encounter_choice(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        action: DungeonAction,
        *,
        user_id: UUID,
    ) -> dict:
        """Handle an encounter choice (skill check resolution)."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase != "encounter":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not in encounter phase")

        current_room = instance.rooms[instance.current_room]
        encounter = get_encounter_by_id(current_room.encounter_template_id or "")
        if not encounter:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No encounter in current room")

        choice = next((c for c in encounter.choices if c.id == action.choice_id), None)
        if not choice:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown choice: {action.choice_id}")

        # Resolve skill check via shared skill_checks module (Spec §4.2)
        result_tier = "success"
        check_result = None
        if choice.check_aptitude and action.agent_id:
            agent = next((a for a in instance.party if a.agent_id == action.agent_id), None)
            if agent:
                ctx = SkillCheckContext(
                    aptitude=choice.check_aptitude,
                    aptitude_level=agent.aptitudes.get(choice.check_aptitude, 3),
                    difficulty_modifier=choice.check_difficulty,
                    personality=agent.personality,
                    condition=agent.condition,
                    visibility=instance.archetype_state.get("visibility", 3),
                )
                outcome = resolve_skill_check(ctx)
                result_tier = outcome.result
                check_result = {
                    "aptitude": choice.check_aptitude,
                    "level": ctx.aptitude_level,
                    "chance": outcome.check_value,
                    "roll": outcome.roll,
                    "result": result_tier,
                    "breakdown": outcome.breakdown,
                }

        # Tower: drain stability on failed skill check
        if result_tier == "fail" and instance.archetype == "The Tower":
            cls._apply_tower_failed_check_drain(instance)

        # Apply effects
        effects = getattr(choice, f"{result_tier}_effects", {})
        narrative_en = getattr(choice, f"{result_tier}_narrative_en", "")
        narrative_de = getattr(choice, f"{result_tier}_narrative_de", "")

        # Apply stress effects
        stress_delta = effects.get("stress", 0)
        stress_heal = effects.get("stress_heal", 0)
        for agent in instance.party:
            if can_act(agent.condition):
                if stress_delta:
                    agent.stress = max(0, min(1000, agent.stress + stress_delta))
                if stress_heal:
                    agent.stress = max(0, agent.stress - stress_heal)

        # Apply archetype state changes from encounter effects
        cls._apply_encounter_archetype_effects(instance, effects)

        # Mark room cleared, return to exploring
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        # Log event
        await cls._log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            instance.current_room,
            "encounter_choice",
            {"choice_id": action.choice_id, "result": result_tier, "check": check_result},
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )

        await cls._checkpoint(admin_supabase, instance)

        narrative_effects_en, narrative_effects_de = _narrate_effects(effects)
        return {
            "result": result_tier,
            "check": check_result,
            "effects": effects,
            "narrative_effects_en": narrative_effects_en,
            "narrative_effects_de": narrative_effects_de,
            "narrative_en": narrative_en,
            "narrative_de": narrative_de,
            "state": cls._build_client_state(instance).model_dump(),
        }

    # ── Scout / Rest / Retreat ──────────────────────────────────────────

    @classmethod
    async def scout(cls, admin_supabase: Client, run_id: UUID, agent_id: UUID, *, user_id: UUID) -> dict:
        """Spy: reveal adjacent rooms and restore visibility."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent not in party")
        if not can_act(agent.condition):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent cannot act")

        spy_level = agent.aptitudes.get("spy", 0)
        if spy_level < 3:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent needs Spy 3+ to scout")

        # Reveal + scout rooms connected to current room's connections
        # Scout reveals room types (unlike movement which only reveals map position)
        current = instance.rooms[instance.current_room]
        revealed_count = 0
        for conn_idx in current.connections:
            room = instance.rooms[conn_idx]
            if not room.scouted:
                room.revealed = True
                room.scouted = True
                revealed_count += 1
            for sub_conn in room.connections:
                if sub_conn < len(instance.rooms) and not instance.rooms[sub_conn].scouted:
                    instance.rooms[sub_conn].revealed = True
                    instance.rooms[sub_conn].scouted = True
                    revealed_count += 1

        # Restore archetype resource on scout
        cls._apply_archetype_restore(instance, "scout")

        await cls._checkpoint(admin_supabase, instance)

        return {
            "revealed_rooms": revealed_count,
            "visibility": instance.archetype_state.get("visibility"),
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    async def rest(cls, admin_supabase: Client, run_id: UUID, agent_ids: list[UUID], *, user_id: UUID) -> dict:
        """Rest at a rest site."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase not in ("rest", "encounter"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not at a rest site")

        current_room = instance.rooms[instance.current_room]
        if current_room.room_type != "rest":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current room is not a rest site")

        # Check for ambush (archetype-specific)
        is_ambushed = check_ambush(instance.archetype_state, instance.archetype)

        if is_ambushed:
            # Spawn archetype-specific rest ambush
            fallbacks = _FALLBACK_SPAWNS.get(instance.archetype, _FALLBACK_SPAWNS["The Shadow"])
            rest_spawn = fallbacks.get("rest_ambush", fallbacks["default"])
            enemies = spawn_enemies(rest_spawn, instance.difficulty, instance.depth, instance.archetype)
            instance.combat = CombatState(enemies=enemies, is_ambush=True)
            instance.phase = "combat_planning"
            await cls._start_combat_timer(admin_supabase, instance)
            await cls._checkpoint(admin_supabase, instance)
            return {
                "ambushed": True,
                "state": cls._build_client_state(instance).model_dump(),
            }

        # Apply rest healing
        for agent in instance.party:
            if agent.agent_id in agent_ids and can_act(agent.condition):
                agent.stress = max(0, agent.stress - REST_STRESS_HEAL)
                if agent.condition == "wounded":
                    agent.condition = "stressed"

        # Restore archetype resource on rest
        cls._apply_archetype_restore(instance, "rest")

        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        await cls._log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            instance.current_room,
            "room_entered",
            {"room_type": "rest", "healed": True},
            narrative_en="The party rests. Wounds heal. Stress fades.",
            narrative_de="Die Gruppe rastet. Wunden heilen. Stress verblasst.",
        )
        await cls._checkpoint(admin_supabase, instance)

        return {
            "healed": True,
            "ambushed": False,
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    async def retreat(cls, admin_supabase: Client, run_id: UUID, *, user_id: UUID) -> dict:
        """Abandon dungeon run (keep partial loot). Uses atomic RPC."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)

        # Cancel any active combat timer
        timer = _combat_timers.pop(str(run_id), None)
        if timer and not timer.done():
            timer.cancel()
        instance.phase = "retreated"
        instance.phase_timer = None

        # Partial loot: Tier 1 for rooms cleared
        loot = []
        if instance.rooms_cleared > 0:
            loot = roll_loot(1, instance.difficulty, instance.depth, instance.archetype_state, instance.archetype)

        outcome = {
            "partial_loot": [item.model_dump() for item in loot],
            "rooms_cleared": instance.rooms_cleared,
        }

        try:
            await admin_supabase.rpc(
                "fn_abandon_dungeon_run",
                {
                    "p_run_id": str(run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
            ).execute()
        except PostgrestAPIError:
            logger.exception("Failed to abandon dungeon run via RPC for run %s", run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(run_id))
                sentry_sdk.capture_exception()
            # Keep instance in memory — DB still has active status
            return {"retreated": True, "rpc_failed": True, "loot": [item.model_dump() for item in loot]}

        _active_instances.pop(str(run_id), None)
        logger.info("Dungeon retreat: run_id=%s rooms_cleared=%d", run_id, instance.rooms_cleared)

        return {
            "retreated": True,
            "loot": [item.model_dump() for item in loot],
        }

    # ── Available Dungeons ──────────────────────────────────────────────

    @classmethod
    async def get_available_dungeons(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[AvailableDungeonResponse]:
        """Check which archetypes have active resonances above threshold.

        Uses the available_dungeons VIEW (migration 164) which encapsulates
        the join, filtering, and difficulty/depth calculation in Postgres.
        """
        resp = await supabase.table("available_dungeons").select("*").eq("simulation_id", str(simulation_id)).execute()

        return [
            AvailableDungeonResponse(
                archetype=row["archetype"],
                signature=row["signature"],
                resonance_id=UUID(row["resonance_id"]),
                magnitude=row.get("magnitude", 0.5),
                susceptibility=row.get("susceptibility", 0.5),
                effective_magnitude=row.get("effective_magnitude", 0.3),
                suggested_difficulty=row.get("suggested_difficulty", 1),
                suggested_depth=row.get("suggested_depth", 4),
                last_run_at=row.get("last_run_at"),
                available=row.get("available", True),
            )
            for row in (resp.data or [])
        ]

    # ── State Recovery ──────────────────────────────────────────────────

    @classmethod
    async def recover_from_checkpoint(cls, admin_supabase: Client, run_id: UUID) -> DungeonInstance | None:
        """Restore in-memory instance from DB checkpoint after server restart."""
        run_resp = (
            await admin_supabase.table("resonance_dungeon_runs")
            .select(
                "*",
            )
            .eq("id", str(run_id))
            .in_(
                "status",
                ["active", "combat", "exploring", "distributing"],
            )
            .maybe_single()
            .execute()
        )

        if not run_resp.data:
            return None

        run = run_resp.data
        config_data = run.get("config", {})
        rooms_data = config_data.get("rooms", [])

        if not rooms_data or not run.get("checkpoint_state"):
            return None

        rooms = [RoomNode(**r) for r in rooms_data]

        instance = DungeonInstance(
            run_id=UUID(run["id"]),
            simulation_id=UUID(run["simulation_id"]),
            archetype=run["archetype"],
            signature=run["resonance_signature"],
            difficulty=run["difficulty"],
            rooms=rooms,
            party=[],
            player_ids=[UUID(pid) for pid in run.get("party_player_ids", [])],
        )
        instance.restore_from_checkpoint(run["checkpoint_state"])
        _active_instances[str(run_id)] = instance

        logger.info("Recovered dungeon instance from checkpoint: run_id=%s", run_id)
        return instance

    # ── Client State (Fog of War) ───────────────────────────────────────

    @classmethod
    async def get_client_state(
        cls,
        run_id: UUID,
        admin_supabase: Client | None = None,
        *,
        user_id: UUID | None = None,
    ) -> DungeonClientState:
        """Get fog-of-war filtered state for client rendering."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)
        return cls._build_client_state(instance)

    @classmethod
    def _build_client_state(cls, instance: DungeonInstance) -> DungeonClientState:
        """Build client-safe state with fog of war applied."""
        # Filter rooms: revealed = visible on map, scouted = room type known.
        # Movement reveals adjacent rooms on the map but does NOT expose their type.
        # Only scouting (via scout command) or visiting reveals room types.
        client_rooms = []
        for room in instance.rooms:
            client_rooms.append(
                RoomNodeClient(
                    index=room.index,
                    depth=room.depth,
                    room_type=room.room_type if room.scouted else "?",
                    connections=room.connections if room.revealed else [],
                    cleared=room.cleared,
                    current=room.index == instance.current_room,
                    revealed=room.revealed,
                )
            )

        # Build party state with available abilities
        client_party = []
        for agent in instance.party:
            abilities = get_agent_all_abilities(agent.aptitudes, instance.archetype)
            client_party.append(
                AgentCombatStateClient(
                    agent_id=agent.agent_id,
                    agent_name=agent.agent_name,
                    portrait_url=agent.portrait_url,
                    condition=agent.condition,
                    stress=agent.stress,
                    stress_threshold=stress_threshold(agent.stress),
                    mood=agent.mood,
                    aptitudes=agent.aptitudes,
                    available_abilities=[
                        AbilityOption(
                            id=a.id,
                            name=a.name_en,
                            school=a.school,
                            description=a.description_en,
                            cooldown_remaining=agent.cooldowns.get(a.id, 0),
                            is_ultimate=a.is_ultimate,
                            targets=a.targets,
                        )
                        for a in abilities
                    ],
                )
            )

        # Build combat state if active
        combat_client = None
        if instance.combat:
            combat_client = CombatStateClient(
                round_num=instance.combat.round_num,
                max_rounds=instance.combat.max_rounds,
                enemies=[
                    EnemyCombatStateClient(
                        instance_id=e.instance_id,
                        name_en=e.name_en,
                        name_de=e.name_de,
                        condition_display=e.condition_display,
                        threat_level=e.threat_level,
                        is_alive=e.is_alive,
                    )
                    for e in instance.combat.enemies
                ],
                phase=instance.combat.phase,
            )

        # Distribution fields (only during distributing phase)
        pending_loot = None
        loot_assignments: dict[str, str] = {}
        loot_suggestions: dict[str, str] = {}
        if instance.phase == "distributing" and instance.pending_loot:
            pending_loot = instance.pending_loot
            loot_assignments = instance.loot_assignments
            loot_suggestions = cls._compute_loot_suggestions(instance)

        return DungeonClientState(
            run_id=instance.run_id,
            archetype=instance.archetype,
            signature=instance.signature,
            difficulty=instance.difficulty,
            depth=instance.depth,
            current_room=instance.current_room,
            rooms=client_rooms,
            party=client_party,
            archetype_state=instance.archetype_state,
            combat=combat_client,
            phase=instance.phase,
            phase_timer=instance.phase_timer,
            pending_loot=pending_loot,
            loot_assignments=loot_assignments,
            loot_suggestions=loot_suggestions,
        )

    @staticmethod
    def _format_encounter_choices(choices: list) -> list[dict]:
        """Format encounter choices for client response with check info."""
        return [
            {
                "id": c.id,
                "label_en": c.label_en,
                "label_de": c.label_de,
                "requires_aptitude": c.requires_aptitude,
                "check_aptitude": c.check_aptitude,
                "check_difficulty": c.check_difficulty,
            }
            for c in choices
        ]

    # ── Private Helpers ─────────────────────────────────────────────────

    @classmethod
    async def _get_instance(
        cls,
        run_id: UUID,
        admin_supabase: Client | None = None,
        *,
        require_player: UUID | None = None,
    ) -> DungeonInstance:
        """Get active instance, auto-recovering from checkpoint if needed.

        Args:
            require_player: If set, verifies this user_id is in the run's
                player_ids. Raises 403 if not. Pass for all user-facing
                mutations to prevent cross-run access.
        """
        instance = _active_instances.get(str(run_id))
        if not instance:
            # Try checkpoint recovery (survives server restarts)
            if admin_supabase:
                instance = await cls.recover_from_checkpoint(admin_supabase, run_id)
            if not instance:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Dungeon run not found or not active")

        if require_player and require_player not in instance.player_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant in this dungeon run")

        return instance

    @classmethod
    async def _checkpoint(cls, admin_supabase: Client, instance: DungeonInstance) -> None:
        """Persist mutable state to DB. Called after EVERY state transition (Review #1)."""
        try:
            status_map = {
                "exploring": "exploring",
                "room_clear": "exploring",
                "encounter": "active",
                "exit": "active",
                "combat_planning": "combat",
                "combat_resolving": "combat",
                "combat_outcome": "combat",
                "rest": "active",
                "treasure": "active",
                "completed": "completed",
                "retreated": "abandoned",
                "wiped": "wiped",
                "boss": "combat",
                "distributing": "distributing",
            }
            db_status = status_map.get(instance.phase, "active")

            await (
                admin_supabase.table("resonance_dungeon_runs")
                .update(
                    {
                        "current_depth": instance.depth,
                        "rooms_cleared": instance.rooms_cleared,
                        "status": db_status,
                        "checkpoint_state": instance.to_checkpoint(),
                        "checkpoint_at": datetime.now(UTC).isoformat(),
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                )
                .eq("id", str(instance.run_id))
                .execute()
            )
        except PostgrestAPIError:
            logger.exception("Checkpoint failed for run %s", instance.run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("simulation_id", str(instance.simulation_id))
                sentry_sdk.capture_exception()

    @classmethod
    async def _log_event(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        simulation_id: UUID,
        depth: int,
        room_index: int,
        event_type: str,
        outcome: dict,
        *,
        narrative_en: str | None = None,
        narrative_de: str | None = None,
    ) -> None:
        """Create a dungeon event record."""
        try:
            await (
                admin_supabase.table("resonance_dungeon_events")
                .insert(
                    {
                        "run_id": str(run_id),
                        "simulation_id": str(simulation_id),
                        "depth": depth,
                        "room_index": room_index,
                        "event_type": event_type,
                        "narrative_en": narrative_en,
                        "narrative_de": narrative_de,
                        "outcome": outcome,
                    }
                )
                .execute()
            )
        except PostgrestAPIError:
            logger.exception("Failed to log dungeon event: %s for run %s", event_type, run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(run_id))
                scope.set_tag("event_type", event_type)
                sentry_sdk.capture_exception()

    # ── Archetype Dispatch Methods ────────────────────────────────────────
    # ONE dispatch point per event category. Adding archetype N = N elif lines.

    @classmethod
    def _init_archetype_state(cls, archetype: str, config: dict) -> dict:
        """Initialize archetype-specific state. ONE dispatch point for all archetypes."""
        mechanic = config.get("mechanic")
        mc = config.get("mechanic_config", {})
        if mechanic == "visibility":
            return {
                "visibility": mc["start_visibility"],
                "max_visibility": mc["max_visibility"],
                "rooms_since_vp_loss": 0,
            }
        if mechanic == "stability_countdown":
            return {
                "stability": mc["start_stability"],
                "max_stability": mc["max_stability"],
            }
        return {}

    @classmethod
    def _apply_archetype_drain(cls, instance: DungeonInstance) -> str | None:
        """Apply archetype resource drain on room entry.

        Returns banter trigger override or None. ONE dispatch for all drain events.
        """
        if instance.archetype == "The Shadow":
            cls._apply_shadow_visibility(instance)
            if instance.archetype_state.get("visibility", 3) == 0:
                return "visibility_zero"
        elif instance.archetype == "The Tower":
            cls._apply_tower_stability_drain(instance)
            stability = instance.archetype_state.get("stability", 100)
            if stability <= 0:
                return "stability_collapse"
            if stability <= 20:
                return "stability_critical"
        return None

    @classmethod
    def _apply_archetype_restore(cls, instance: DungeonInstance, event: str) -> None:
        """Apply archetype resource restore on combat_victory/rest/treasure/scout.

        ONE dispatch for all restore events.
        """
        mc = ARCHETYPE_CONFIGS.get(instance.archetype, {}).get("mechanic_config", {})
        if instance.archetype == "The Shadow":
            restore_key = {
                "combat_victory": "restore_on_combat_win",
                "rest": "restore_on_rest",
                "treasure": "restore_on_treasure",
                "scout": "restore_on_spy_observe",
            }.get(event)
            if restore_key and mc.get(restore_key):
                instance.archetype_state["visibility"] = min(
                    mc["max_visibility"],
                    instance.archetype_state.get("visibility", 0) + mc[restore_key],
                )
        elif instance.archetype == "The Tower":
            restore_key = {
                "combat_victory": "restore_on_combat_win",
                "rest": "restore_on_guardian_rest",
                "treasure": "restore_on_treasure",
            }.get(event)
            if restore_key and mc.get(restore_key):
                instance.archetype_state["stability"] = min(
                    mc["max_stability"],
                    instance.archetype_state.get("stability", 0) + mc[restore_key],
                )

    @classmethod
    def _apply_encounter_archetype_effects(cls, instance: DungeonInstance, effects: dict) -> None:
        """Apply archetype state changes from encounter choice effects."""
        if instance.archetype == "The Shadow":
            vp_delta = effects.get("visibility", 0)
            if vp_delta:
                mc = ARCHETYPE_CONFIGS["The Shadow"]["mechanic_config"]
                instance.archetype_state["visibility"] = max(
                    0,
                    min(
                        mc["max_visibility"],
                        instance.archetype_state.get("visibility", 0) + vp_delta,
                    ),
                )
        elif instance.archetype == "The Tower":
            stab_delta = effects.get("stability", 0)
            if stab_delta:
                mc = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
                instance.archetype_state["stability"] = max(
                    0,
                    min(
                        mc["max_stability"],
                        instance.archetype_state.get("stability", 0) + stab_delta,
                    ),
                )

    # ── Shadow-Specific Mechanic Methods ──────────────────────────────────

    @classmethod
    def _apply_shadow_visibility(cls, instance: DungeonInstance) -> None:
        """Apply Shadow visibility drain: -1 VP per 2 rooms entered (Review #7)."""
        state = instance.archetype_state
        rooms_since = state.get("rooms_since_vp_loss", 0) + 1
        if rooms_since >= 2:
            state["visibility"] = max(0, state.get("visibility", 3) - 1)
            state["rooms_since_vp_loss"] = 0
        else:
            state["rooms_since_vp_loss"] = rooms_since

    # ── Tower-Specific Mechanic Methods ──────────────────────────────────

    @classmethod
    def _apply_tower_stability_drain(cls, instance: DungeonInstance) -> None:
        """Apply Tower stability drain on room entry: -5/-10/-15 by depth."""
        mc = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
        depth = instance.depth
        if depth <= 2:
            drain = mc["drain_depth_1_2"]
        elif depth <= 4:
            drain = mc["drain_depth_3_4"]
        else:
            drain = mc["drain_depth_5_plus"]
        instance.archetype_state["stability"] = max(
            0, instance.archetype_state.get("stability", 100) - drain,
        )

    @classmethod
    def _apply_tower_combat_drain(cls, instance: DungeonInstance) -> None:
        """Apply Tower stability drain per combat round: -3."""
        mc = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
        instance.archetype_state["stability"] = max(
            0, instance.archetype_state.get("stability", 100) - mc["drain_per_combat_round"],
        )

    @classmethod
    def _apply_tower_failed_check_drain(cls, instance: DungeonInstance) -> None:
        """Apply Tower stability drain on failed skill check: -5."""
        mc = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
        instance.archetype_state["stability"] = max(
            0, instance.archetype_state.get("stability", 100) - mc["drain_on_failed_check"],
        )

    @classmethod
    async def _enter_combat_room(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        room,
        *,
        is_boss: bool = False,
    ) -> dict:
        """Set up combat encounter for a combat/elite/boss room."""
        encounter = select_encounter(room.room_type, instance.depth, instance.difficulty, instance.archetype)
        spawn_id = encounter.combat_encounter_id if encounter else None

        if not spawn_id:
            fallbacks = _FALLBACK_SPAWNS.get(instance.archetype, _FALLBACK_SPAWNS["The Shadow"])
            spawn_id = fallbacks["boss"] if is_boss else fallbacks["default"]

        enemies = spawn_enemies(spawn_id, instance.difficulty, instance.depth, instance.archetype)
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

        await cls._log_event(
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

    @classmethod
    def _enter_interactive_room(cls, instance: DungeonInstance, room) -> dict:
        """Set up encounter / rest / treasure room.

        Shared encounter-selection path: if an encounter template matches, the player
        sees description + choices. Otherwise, a room-type-specific fallback runs.
        """
        room_type: str = room.room_type
        encounter = select_encounter(room_type, instance.depth, instance.difficulty, instance.archetype)

        # ── Common path: encounter template found ──
        if encounter:
            room.encounter_template_id = encounter.id
            instance.phase = "rest" if room_type == "rest" else "encounter"
            result: dict = {
                room_type: True,
                "description_en": encounter.description_en,
                "description_de": encounter.description_de,
                "choices": cls._format_encounter_choices(encounter.choices),
            }
            if room_type == "encounter":
                result["encounter_id"] = encounter.id
            return result

        # ── Fallbacks (no encounter template) ──
        if room_type == "encounter":
            logger.warning(
                "No encounter template for room_type=%s depth=%d difficulty=%d archetype=%s — auto-clearing room",
                room_type,
                instance.depth,
                instance.difficulty,
                instance.archetype,
            )
            instance.phase = "room_clear"
            room.cleared = True
            return {"encounter": False}

        if room_type == "rest":
            instance.phase = "rest"
            return {"rest": True}

        # Treasure: auto-loot
        loot = roll_loot(
            room.loot_tier, instance.difficulty, instance.depth,
            instance.archetype_state, instance.archetype,
        )
        room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        # Restore archetype resource at treasure
        cls._apply_archetype_restore(instance, "treasure")

        return {
            "treasure": True,
            "auto_loot": True,
            "loot": [item.model_dump() for item in loot],
        }

    @classmethod
    def _build_agent_outcomes(cls, instance: DungeonInstance) -> list[dict]:
        """Build agent outcomes for the completion RPC (mood, stress, moodlets, activities)."""
        outcomes = []
        for agent in instance.party:
            outcomes.append({
                "agent_id": str(agent.agent_id),
                "mood_delta": -10 if agent.stress > 500 else 10,
                "stress_delta": agent.stress,
                "moodlets": [{
                    "moodlet_type": "dungeon_survivor",
                    "emotion": "pride" if agent.condition != "afflicted" else "dread",
                    "strength": 10 if agent.condition != "afflicted" else -10,
                    "source_description": f"Survived {instance.archetype} dungeon",
                    "decay_type": "timed",
                }],
                "activity_narrative_en": f"Explored {instance.archetype} resonance dungeon and prevailed.",
                "activity_narrative_de": f"Erkundete {instance.archetype} Resonanz-Dungeon und bestand.",
                "significance": 8,
            })
        return outcomes

    @classmethod
    async def _complete_run(
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

        # Build loot items for RPC (assign agents to loot effects)
        loot_items = cls._build_loot_items_for_rpc(instance, loot)

        try:
            rpc_result = await admin_supabase.rpc(
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
            ).execute()
        except PostgrestAPIError:
            logger.exception("Failed to complete dungeon run via RPC for run %s", instance.run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("phase", "complete_run")
                sentry_sdk.capture_exception()
            # Keep instance in memory — DB still has active status, retry possible
            return

        # Log loot application results (aptitude cap skips, event modifier no-ops)
        loot_result = rpc_result.data if rpc_result and rpc_result.data else {}
        if isinstance(loot_result, dict) and loot_result.get("loot_result", {}).get("skipped"):
            logger.warning(
                "Loot items skipped for run %s: %s",
                instance.run_id,
                loot_result["loot_result"]["skipped"],
            )

        _active_instances.pop(str(instance.run_id), None)
        logger.info(
            "Dungeon completed: run_id=%s sim=%s archetype=%s rooms=%d/%d",
            instance.run_id,
            instance.simulation_id,
            instance.archetype,
            instance.rooms_cleared,
            len(instance.rooms),
        )

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

    # ── Loot Distribution (Debrief Terminal) ────────────────────────────

    @classmethod
    async def _begin_distribution(
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
                    auto_items.append({
                        "loot_id": item.id,
                        "agent_id": str(agent.agent_id),
                        "effect_type": item.effect_type,
                        "effect_params": item.effect_params,
                    })
            elif item.effect_type in ("event_modifier", "arc_modifier") and first_agent_id:
                auto_items.append({
                    "loot_id": item.id,
                    "agent_id": first_agent_id,
                    "effect_type": item.effect_type,
                    "effect_params": item.effect_params,
                })
        instance.auto_apply_loot = auto_items

        # Build agent outcomes (same as _complete_run)
        outcome = {
            "loot": [item.model_dump() for item in loot],
            "rooms_cleared": instance.rooms_cleared,
            "depth_reached": instance.depth,
            "party_state": [a.model_dump(mode="json") for a in instance.party],
        }
        agent_outcomes = cls._build_agent_outcomes(instance)

        try:
            await admin_supabase.rpc(
                "fn_begin_distribution",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
            ).execute()
        except PostgrestAPIError:
            logger.exception("Failed to begin distribution for run %s", instance.run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("phase", "begin_distribution")
                sentry_sdk.capture_exception()
            return

        await cls._checkpoint(admin_supabase, instance)
        logger.info(
            "Distribution started: run_id=%s, %d distributable items, %d auto-apply items",
            instance.run_id,
            len([i for i in instance.pending_loot if i.get("effect_type") not in _AUTO_APPLY_EFFECT_TYPES]),
            len(auto_items),
        )

    @classmethod
    async def assign_loot(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        loot_id: str,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> dict:
        """Assign one distributable loot item to an agent."""
        instance = await cls._get_instance(run_id, admin_supabase, require_player=user_id)
        if instance.phase != "distributing":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not in distribution phase")

        # Validate loot_id exists and is distributable
        loot_item = next((i for i in instance.pending_loot if i["id"] == loot_id), None)
        if not loot_item:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Loot item '{loot_id}' not found")
        if loot_item.get("effect_type") in _AUTO_APPLY_EFFECT_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This item is auto-applied")

        # Validate agent is in party and operational
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent not in party")
        if not can_act(agent.condition):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Agent is captured and cannot receive loot")

        instance.loot_assignments[loot_id] = str(agent_id)
        await cls._checkpoint(admin_supabase, instance)

        return {
            "assignments": instance.loot_assignments,
            "remaining": cls._count_unassigned(instance),
            "all_assigned": cls._count_unassigned(instance) == 0,
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    async def confirm_distribution(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
    ) -> dict:
        """Finalize loot distribution and complete the dungeon run.

        user_id is optional to allow future auto-confirm from distribution timer.
        """
        instance = await cls._get_instance(
            run_id, admin_supabase, require_player=user_id,
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
            if effect_type in _AUTO_APPLY_EFFECT_TYPES:
                continue  # Already in auto_apply_loot
            assigned_agent = instance.loot_assignments.get(loot_id)
            if assigned_agent:
                loot_items.append({
                    "loot_id": loot_id,
                    "agent_id": assigned_agent,
                    "effect_type": effect_type,
                    "effect_params": loot_data.get("effect_params", {}),
                })

        # Cancel distribution timer
        timer = _distribution_timers.pop(str(run_id), None)
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
            logger.exception("Failed to finalize distribution for run %s", instance.run_id)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("phase", "finalize_distribution")
                sentry_sdk.capture_exception()
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to finalize") from None

        loot_result = rpc_result.data if rpc_result and rpc_result.data else {}
        if isinstance(loot_result, dict) and loot_result.get("loot_result", {}).get("skipped"):
            logger.warning(
                "Loot items skipped for run %s: %s",
                instance.run_id,
                loot_result["loot_result"]["skipped"],
            )

        instance.phase = "completed"
        _active_instances.pop(str(instance.run_id), None)
        logger.info(
            "Distribution finalized: run_id=%s sim=%s archetype=%s loot_items=%d",
            instance.run_id,
            instance.simulation_id,
            instance.archetype,
            len(loot_items),
        )

        return {
            "loot_result": loot_result,
            "state": cls._build_client_state(instance).model_dump(),
        }

    @classmethod
    def _count_unassigned(cls, instance: DungeonInstance) -> int:
        """Count distributable loot items not yet assigned."""
        return sum(
            1
            for item in instance.pending_loot
            if item.get("effect_type") not in _AUTO_APPLY_EFFECT_TYPES
            and item["id"] not in instance.loot_assignments
        )

    @classmethod
    def _compute_loot_suggestions(cls, instance: DungeonInstance) -> dict[str, str]:
        """Suggest the best agent for each distributable loot item.

        aptitude_boost → agent with lowest level in the boost's aptitude
        memory/moodlet → round-robin across operational agents
        *_bonus → first operational agent
        """
        operational = [a for a in instance.party if can_act(a.condition)]
        if not operational:
            return {}

        suggestions: dict[str, str] = {}
        robin_idx = 0

        for item in instance.pending_loot:
            effect_type = item.get("effect_type", "")
            if effect_type in _AUTO_APPLY_EFFECT_TYPES:
                continue

            if effect_type == "aptitude_boost":
                # Find agent with lowest aptitude level in the boost's choices
                choices = item.get("effect_params", {}).get("aptitude_choices", [])
                if choices:
                    best_agent = min(
                        operational,
                        key=lambda a: min(a.aptitudes.get(c, 0) for c in choices),
                    )
                    suggestions[item["id"]] = str(best_agent.agent_id)
                else:
                    suggestions[item["id"]] = str(operational[0].agent_id)
            elif effect_type in ("memory", "moodlet"):
                # Round-robin
                suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
                robin_idx += 1
            else:
                # permanent_dungeon_bonus, next_dungeon_bonus → first
                suggestions[item["id"]] = str(operational[0].agent_id)

        return suggestions

    @classmethod
    async def _start_combat_timer(cls, _admin_supabase: Client, instance: DungeonInstance) -> None:
        """Start asyncio timer for combat planning timeout.

        Sets phase_timer metadata on the instance so _build_client_state
        can pass it to the frontend for countdown display.

        Note: The timer callback fetches a fresh admin_supabase client
        to avoid stale connections from the closure (30s delay).
        """
        run_id_str = str(instance.run_id)

        # Cancel existing timer
        existing = _combat_timers.pop(run_id_str, None)
        if existing and not existing.done():
            existing.cancel()

        # Client timer is shorter than server timer so the client submits
        # before the server auto-resolves, winning the race and receiving
        # the round_result for battle log display.
        instance.phase_timer = PhaseTimer(
            started_at=datetime.now(UTC).isoformat(),
            duration_ms=COMBAT_PLANNING_TIMEOUT_MS - CLIENT_TIMER_BUFFER_MS,
            phase="combat_planning",
        )

        async def _timer() -> None:
            await asyncio.sleep(COMBAT_PLANNING_TIMEOUT_MS / 1000)
            # Atomically pop timer to prevent double-resolve with user submission
            if not _combat_timers.pop(run_id_str, None):
                return  # Already resolved by user submission
            inst = _active_instances.get(run_id_str)
            if inst and inst.phase == "combat_planning":
                logger.info("Combat timer expired for run %s, auto-resolving", run_id_str)
                fresh_admin = await get_admin_supabase()
                await cls._resolve_combat(fresh_admin, inst)

        task = asyncio.create_task(_timer())
        _combat_timers[run_id_str] = task
