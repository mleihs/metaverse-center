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
import time
from datetime import UTC, datetime
from typing import Any
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
from backend.services.dungeon.archetype_strategies import get_archetype_strategy
from backend.services.dungeon.dungeon_archetypes import (
    ARCHETYPE_CONFIGS,
    get_depth_for_difficulty,
)
from backend.services.dungeon.dungeon_banter import select_banter
from backend.services.dungeon.dungeon_combat import (
    check_ambush,
    get_enemy_templates_dict,
    spawn_enemies,
)
from backend.services.dungeon.dungeon_encounters import (
    get_encounter_by_id,
    select_encounter,
)
from backend.services.dungeon.dungeon_generator import generate_dungeon_graph
from backend.services.dungeon.dungeon_loot import roll_loot
from backend.services.dungeon.dungeon_objektanker import (
    ANCHOR_OBJECTS,
    get_barometer_text,
    select_anchor_text,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


def _log_extra(instance: DungeonInstance, **kwargs: Any) -> dict[str, Any]:
    """Build structured log extra dict from a dungeon instance.

    Standard fields (always included): run_id, sim_id, archetype, difficulty.
    Additional fields passed via kwargs (e.g. phase, rooms_cleared, outcome).
    Consumed by structlog ExtraAdder → JSON output in production.
    """
    return {
        "run_id": str(instance.run_id),
        "sim_id": str(instance.simulation_id),
        "archetype": instance.archetype,
        "difficulty": instance.difficulty,
        **kwargs,
    }


# ── Module-Level Instance Store ─────────────────────────────────────────────
# In-memory dict. NOT shared across workers. Sufficient for <100 concurrent dungeons.

_active_instances: dict[str, DungeonInstance] = {}
_instance_last_activity: dict[str, float] = {}  # run_id → time.monotonic()
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
_RPC_MAX_ATTEMPTS = 2
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
    "The Devouring Mother": {
        "boss": "mother_living_altar_spawn",
        "default": "mother_weaver_drift_spawn",
        "rest_ambush": "mother_rest_ambush_spawn",
    },
}


async def _rpc_with_retry(
    admin_supabase: Client,
    rpc_name: str,
    params: dict,
    *,
    run_id: UUID,
    context: str,
) -> Any:
    """Execute a Postgres RPC with one immediate retry on transient failure.

    All dungeon finalization RPCs are idempotent (status updates, CAS loot),
    so retrying is safe. Logs + Sentry on final failure, then re-raises.
    """
    last_exc: Exception | None = None
    for attempt in range(_RPC_MAX_ATTEMPTS):
        try:
            return await admin_supabase.rpc(rpc_name, params).execute()
        except PostgrestAPIError as exc:
            last_exc = exc
            if attempt < _RPC_MAX_ATTEMPTS - 1:
                logger.warning(
                    "RPC failed, retrying",
                    extra={
                        "run_id": str(run_id), "rpc": rpc_name,
                        "attempt": attempt + 1, "max_attempts": _RPC_MAX_ATTEMPTS,
                    },
                )
                continue
            logger.exception(
                "RPC failed after all attempts",
                extra={"run_id": str(run_id), "rpc": rpc_name, "context": context, "attempts": _RPC_MAX_ATTEMPTS},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(run_id))
                scope.set_tag("rpc", rpc_name)
                scope.set_tag("context", context)
                sentry_sdk.capture_exception(exc)
            raise
    raise last_exc  # type: ignore[misc]  # unreachable, satisfies type checker


# ── Instance TTL Cleanup ───────────────────────────────────────────────────
# Periodic background task that evicts stale in-memory instances and marks
# orphaned DB rows as abandoned. Started from FastAPI lifespan.

_CLEANUP_INTERVAL_SECONDS = 60


def _evict_stale_instances() -> int:
    """Remove in-memory instances inactive longer than INSTANCE_TTL_SECONDS.

    Also cancels any associated combat/distribution timers. Returns the
    number of evicted instances.
    """
    now = time.monotonic()
    stale = [
        rid for rid, ts in _instance_last_activity.items()
        if now - ts > INSTANCE_TTL_SECONDS
    ]
    for run_id in stale:
        _active_instances.pop(run_id, None)
        _instance_last_activity.pop(run_id, None)
        timer = _combat_timers.pop(run_id, None)
        if timer:
            timer.cancel()
        dist_timer = _distribution_timers.pop(run_id, None)
        if dist_timer:
            dist_timer.cancel()
        logger.info("Evicted stale dungeon instance", extra={"run_id": run_id, "reason": "ttl_expired"})
    return len(stale)


async def _instance_cleanup_loop() -> None:
    """Infinite loop: evict stale in-memory instances + expire DB orphans."""
    while True:
        try:
            evicted = _evict_stale_instances()
            if evicted:
                logger.info("Instance cleanup: evicted stale instances", extra={"evicted": evicted})
            # Also expire abandoned DB rows (handles server-restart orphans)
            admin = await get_admin_supabase()
            result = await admin.rpc(
                "fn_expire_abandoned_dungeon_runs",
                {"p_ttl_seconds": INSTANCE_TTL_SECONDS},
            ).execute()
            db_expired = result.data if result.data else 0
            if db_expired:
                logger.info("Instance cleanup: expired abandoned DB runs", extra={"db_expired": db_expired})
        except asyncio.CancelledError:
            logger.info("Instance cleanup loop shutting down")
            raise
        except Exception as exc:
            logger.exception("Instance cleanup loop error")
            sentry_sdk.capture_exception(exc)
        await asyncio.sleep(_CLEANUP_INTERVAL_SECONDS)


async def start_instance_cleanup() -> asyncio.Task:
    """Launch the instance cleanup loop. Called from app lifespan."""
    task = asyncio.create_task(_instance_cleanup_loop())
    logger.info("Dungeon instance cleanup loop started (TTL=%ds)", INSTANCE_TTL_SECONDS)
    return task


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
                    extra={"agent_id": agent_data["id"], "archetype": archetype},
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

        # Build archetype initial state via strategy
        strategy = get_archetype_strategy(archetype)
        archetype_state = strategy.init_state()

        # Select 2 anchor objects for this run (Objektanker Variation C)
        anchor_pool = ANCHOR_OBJECTS.get(archetype, [])
        selected_anchors = random.sample(anchor_pool, min(2, len(anchor_pool)))
        anchor_object_ids = [a["id"] for a in selected_anchors]

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
            logger.exception(
                "Failed to create dungeon run",
                extra={"sim_id": str(simulation_id), "archetype": archetype, "difficulty": difficulty},
            )
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
            anchor_objects=anchor_object_ids,
            anchor_phases_shown={obj_id: [] for obj_id in anchor_object_ids},
            last_barometer_tier=-1,
        )
        # Entrance room starts revealed + scouted; adjacent rooms revealed (map) only
        rooms[0].revealed = True
        rooms[0].scouted = True
        for conn_idx in rooms[0].connections:
            if 0 <= conn_idx < len(rooms):
                rooms[conn_idx].revealed = True
        _active_instances[str(run_id)] = instance
        _instance_last_activity[str(run_id)] = time.monotonic()

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
            "Dungeon run created",
            extra=_log_extra(instance, depth=depth, party_size=len(party)),
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

        if instance.phase not in ("exploring", "room_clear", "exit"):
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
            if 0 <= conn_idx < len(instance.rooms):
                instance.rooms[conn_idx].revealed = True

        # Track depth changes
        if target_room.depth > instance.depth:
            instance.depth = target_room.depth

        # Apply archetype effects (drain on room entry)
        banter_trigger = "room_entered"
        strategy = get_archetype_strategy(instance.archetype)
        drain_trigger = strategy.apply_drain(instance)
        if drain_trigger:
            banter_trigger = drain_trigger
        if target_room.depth > current_room.depth:
            banter_trigger = "depth_change"

        # Apply ambient stress (archetype may multiply, e.g. Tower structural failure)
        ambient = calculate_ambient_stress(instance.depth, instance.difficulty)
        ambient = int(ambient * strategy.get_ambient_stress_multiplier(instance))
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
            archetype_state=instance.archetype_state,
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

        # ── Anchor Object Text (Variation C) ──
        anchor_texts = select_anchor_text(instance, target_room)
        for at in anchor_texts:
            obj_id = at["anchor_id"]
            phase = at["phase"]
            instance.anchor_phases_shown.setdefault(obj_id, []).append(phase)
            # Resolve {agent} placeholder in echo-phase texts
            if "{agent}" in at.get("text_en", ""):
                alive = [a for a in instance.party if can_act(a.condition)]
                if alive:
                    agent_for_anchor = random.choice(alive)
                    at["text_en"] = at["text_en"].replace("{agent}", agent_for_anchor.agent_name)
                    at["text_de"] = at["text_de"].replace("{agent}", agent_for_anchor.agent_name)

        # ── Barometer Text (Variation B) ──
        baro_text, new_baro_tier = get_barometer_text(
            instance.archetype, instance.archetype_state, instance.last_barometer_tier,
        )
        if baro_text:
            instance.last_barometer_tier = new_baro_tier

        # Process room by type
        result: dict = {
            "banter": banter_text,
            "anchor_texts": anchor_texts if anchor_texts else None,
            "barometer_text": baro_text,
        }

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
                        "Invalid ability_id submitted — auto-defend will cover this agent",
                        extra=_log_extra(instance, ability_id=ability_id, agent_id=action_data["agent_id"]),
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
        get_archetype_strategy(instance.archetype).apply_restore(instance, "combat_victory")

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
            await _rpc_with_retry(
                admin_supabase, "fn_wipe_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id, context="party_wipe",
            )
        except PostgrestAPIError:
            return {
                "wipe": True,
                "rpc_failed": True,
                "rpc_error_message": "Failed to save wipe result. Your progress will be recovered on next visit.",
                "state": cls._build_client_state(instance).model_dump(),
            }

        _active_instances.pop(str(instance.run_id), None)
        _instance_last_activity.pop(str(instance.run_id), None)
        logger.warning(
            "Party wipe",
            extra=_log_extra(instance, outcome="wipe", depth=instance.depth, rooms_cleared=instance.rooms_cleared),
        )

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
            "Combat stalemate",
            extra=_log_extra(instance, outcome="stalemate", rounds=round_result.round_num),
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

        if instance.phase not in ("encounter", "rest"):
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

        # Archetype penalty on failed check (e.g. Tower stability drain)
        if result_tier == "fail":
            get_archetype_strategy(instance.archetype).on_failed_check(instance)

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
        get_archetype_strategy(instance.archetype).apply_encounter_effects(instance, effects)

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
        get_archetype_strategy(instance.archetype).apply_restore(instance, "scout")

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
        get_archetype_strategy(instance.archetype).apply_restore(instance, "rest")

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

        # Select retreat banter (archetype-specific farewell)
        retreat_banter = select_banter(
            "retreat",
            [{"personality": a.personality} for a in instance.party],
            instance.used_banter_ids,
            instance.archetype,
            instance.archetype_state,
        )

        # Partial loot: Tier 1 for rooms cleared
        loot = []
        if instance.rooms_cleared > 0:
            loot = roll_loot(1, instance.difficulty, instance.depth, instance.archetype_state, instance.archetype)

        outcome = {
            "partial_loot": [item.model_dump() for item in loot],
            "rooms_cleared": instance.rooms_cleared,
        }

        try:
            await _rpc_with_retry(
                admin_supabase, "fn_abandon_dungeon_run",
                {
                    "p_run_id": str(run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=run_id, context="retreat",
            )
        except PostgrestAPIError:
            return {
                "retreated": True,
                "rpc_failed": True,
                "rpc_error_message": "Failed to save retreat. Your progress will be recovered on next visit.",
                "loot": [item.model_dump() for item in loot],
            }

        _active_instances.pop(str(run_id), None)
        _instance_last_activity.pop(str(run_id), None)
        logger.info(
            "Dungeon retreat",
            extra=_log_extra(instance, outcome="retreat", rooms_cleared=instance.rooms_cleared),
        )

        result: dict = {
            "retreated": True,
            "loot": [item.model_dump() for item in loot],
        }
        if retreat_banter:
            result["banter"] = {
                "text_en": retreat_banter.get("text_en", ""),
                "text_de": retreat_banter.get("text_de", ""),
            }
        return result

    # ── Available Dungeons ──────────────────────────────────────────────

    @classmethod
    async def get_available_dungeons(
        cls,
        admin_supabase: Client,
        simulation_id: UUID,
    ) -> list[AvailableDungeonResponse]:
        """Check which archetypes have active resonances above threshold.

        Uses the available_dungeons VIEW (migration 164) which encapsulates
        the join, filtering, and difficulty/depth calculation in Postgres.

        When the admin override is enabled for this simulation, admin-selected
        archetypes are merged with (supplement) or replace (override) the
        resonance results.  Resonance-based entries carry real difficulty data;
        admin-filled gaps use sensible defaults (difficulty 3, depth 5).

        Uses admin_supabase (service_role) to bypass RLS — this reads admin
        config (simulation_settings) and checks active runs across all users.
        Auth is enforced at the router level via require_simulation_member.
        """
        sim_id_str = str(simulation_id)

        resp = (
            await admin_supabase.table("available_dungeons")
            .select("*")
            .eq("simulation_id", sim_id_str)
            .execute()
        )

        results: list[AvailableDungeonResponse] = [
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

        # ── Admin override: per-archetype unlock via simulation_settings ──
        override_resp = (
            await admin_supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", sim_id_str)
            .eq("category", "game")
            .eq("setting_key", "dungeon_override")
            .maybe_single()
            .execute()
        )
        override_config = (override_resp.data or {}).get("setting_value", {})
        override_mode = override_config.get("mode", "off") if isinstance(override_config, dict) else "off"
        override_archetypes = set(override_config.get("archetypes", [])) if isinstance(override_config, dict) else set()

        if override_mode == "override":
            results = []

        if override_mode in ("supplement", "override") and override_archetypes:
            existing_archetypes = {r.archetype for r in results}

            for r in results:
                if r.archetype in override_archetypes:
                    r.admin_override = True

            for archetype in override_archetypes:
                if archetype not in existing_archetypes and archetype in ARCHETYPE_CONFIGS:
                    config = ARCHETYPE_CONFIGS[archetype]
                    active_run_resp = (
                        await admin_supabase.table("resonance_dungeon_runs")
                        .select("id")
                        .eq("simulation_id", sim_id_str)
                        .eq("archetype", archetype)
                        .in_("status", ["active", "combat", "exploring", "distributing"])
                        .execute()
                    )
                    results.append(
                        AvailableDungeonResponse(
                            archetype=archetype,
                            signature=config.get("signature", "unknown"),
                            suggested_difficulty=3,
                            suggested_depth=5,
                            available=not bool(active_run_resp.data),
                            admin_override=True,
                        )
                    )

        return results

    # ── State Recovery ──────────────────────────────────────────────────

    @classmethod
    async def recover_from_checkpoint(cls, admin_supabase: Client, run_id: UUID) -> DungeonInstance | None:
        """Restore in-memory instance from DB checkpoint after server restart."""
        run_resp = (
            await admin_supabase.table("resonance_dungeon_runs")
            .select("*")
            .eq("id", str(run_id))
            .in_(
                "status",
                ["active", "combat", "exploring", "distributing"],
            )
            .limit(1)
            .execute()
        )

        if not run_resp.data:
            return None

        run = run_resp.data[0]
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
        _instance_last_activity[str(run_id)] = time.monotonic()

        logger.info(
            "Recovered dungeon instance from checkpoint",
            extra=_log_extra(instance, phase=instance.phase),
        )
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

        # Encounter fields (only during encounter/rest phase)
        encounter_choices = None
        encounter_desc_en = None
        encounter_desc_de = None
        if instance.phase in ("encounter", "rest"):
            current_room = instance.rooms[instance.current_room]
            if current_room.encounter_template_id:
                encounter = get_encounter_by_id(current_room.encounter_template_id)
                if encounter:
                    encounter_choices = cls._format_encounter_choices(encounter.choices)
                    encounter_desc_en = encounter.description_en
                    encounter_desc_de = encounter.description_de

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
            encounter_choices=encounter_choices,
            encounter_description_en=encounter_desc_en,
            encounter_description_de=encounter_desc_de,
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

        _instance_last_activity[str(run_id)] = time.monotonic()
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
            logger.exception("Checkpoint failed", extra=_log_extra(instance, phase=instance.phase))
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
            logger.exception(
                "Failed to log dungeon event",
                extra={"run_id": str(run_id), "sim_id": str(simulation_id), "event_type": event_type},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(run_id))
                scope.set_tag("event_type", event_type)
                sentry_sdk.capture_exception()

    # ── Archetype Dispatch ────────────────────────────────────────────────
    # All archetype-specific logic delegated to ArchetypeStrategy subclasses
    # in backend/services/dungeon/archetype_strategies.py.
    # Adding a new archetype = new Strategy subclass + registry entry.
    # Zero engine changes required.

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
                "No encounter template — auto-clearing room",
                extra=_log_extra(instance, room_type=room_type, depth=instance.depth),
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
        get_archetype_strategy(instance.archetype).apply_restore(instance, "treasure")

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
            rpc_result = await _rpc_with_retry(
                admin_supabase, "fn_complete_dungeon_run",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_agent_outcomes": agent_outcomes,
                    "p_loot_items": loot_items,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id, context="complete_run",
            )
        except PostgrestAPIError:
            # Instance stays in memory — will be retried on next user action or server cleanup
            return

        # Log loot application results (aptitude cap skips, event modifier no-ops)
        loot_result = rpc_result.data if rpc_result and rpc_result.data else {}
        if isinstance(loot_result, dict) and loot_result.get("loot_result", {}).get("skipped"):
            logger.warning(
                "Loot items skipped",
                extra=_log_extra(instance, skipped=loot_result["loot_result"]["skipped"]),
            )

        _active_instances.pop(str(instance.run_id), None)
        _instance_last_activity.pop(str(instance.run_id), None)
        logger.info(
            "Dungeon completed",
            extra=_log_extra(
                instance, outcome="completed",
                rooms_cleared=instance.rooms_cleared, total_rooms=len(instance.rooms),
            ),
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
            await _rpc_with_retry(
                admin_supabase, "fn_begin_distribution",
                {
                    "p_run_id": str(instance.run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_agent_outcomes": agent_outcomes,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=instance.run_id, context="begin_distribution",
            )
        except PostgrestAPIError:
            # Instance stays in memory — will be retried on next user action
            return

        await cls._checkpoint(admin_supabase, instance)

        # Start distribution timeout — auto-assigns remaining loot after DISTRIBUTION_TIMEOUT_MS
        cls._start_distribution_timer(instance)

        distributable_count = len([
            i for i in instance.pending_loot if i.get("effect_type") not in _AUTO_APPLY_EFFECT_TYPES
        ])
        logger.info(
            "Distribution started",
            extra=_log_extra(instance, distributable=distributable_count, auto_apply=len(auto_items)),
        )

    @classmethod
    def _start_distribution_timer(cls, instance: DungeonInstance) -> None:
        """Start a timer that auto-assigns unassigned loot after DISTRIBUTION_TIMEOUT_MS."""
        run_id_str = str(instance.run_id)
        existing = _distribution_timers.pop(run_id_str, None)
        if existing and not existing.done():
            existing.cancel()

        async def _auto_finalize() -> None:
            await asyncio.sleep(DISTRIBUTION_TIMEOUT_MS / 1000)
            if not _distribution_timers.pop(run_id_str, None):
                return  # Already confirmed by player
            inst = _active_instances.get(run_id_str)
            if not inst or inst.phase != "distributing":
                return

            # Auto-assign unassigned distributable items to the first party agent
            first_agent_id = str(inst.party[0].agent_id) if inst.party else None
            if first_agent_id:
                for item in inst.pending_loot:
                    if item.get("effect_type") in _AUTO_APPLY_EFFECT_TYPES:
                        continue
                    if item["id"] not in inst.loot_assignments:
                        inst.loot_assignments[item["id"]] = first_agent_id

            logger.info(
                "Distribution timer expired — auto-assigned loot",
                extra=_log_extra(inst, assigned=len(inst.loot_assignments), first_agent=first_agent_id),
            )

            # Finalize (no user_id — internal call)
            try:
                fresh_admin = await get_admin_supabase()
                await cls.confirm_distribution(fresh_admin, inst.run_id)
            except Exception:
                logger.exception(
                    "Auto-finalize distribution failed",
                    extra={"run_id": run_id_str},
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("service", "dungeon_engine")
                    scope.set_tag("run_id", run_id_str)
                    scope.set_tag("context", "distribution_timer")
                    sentry_sdk.capture_exception()

        task = asyncio.create_task(_auto_finalize())
        _distribution_timers[run_id_str] = task

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
        # Cancel distribution timer (player confirmed before timeout)
        timer = _distribution_timers.pop(str(run_id), None)
        if timer and not timer.done():
            timer.cancel()

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
            logger.exception("Failed to finalize distribution", extra=_log_extra(instance))
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
                extra=_log_extra(instance, skipped=loot_result["loot_result"]["skipped"]),
            )

        instance.phase = "completed"
        _active_instances.pop(str(instance.run_id), None)
        _instance_last_activity.pop(str(instance.run_id), None)
        logger.info(
            "Distribution finalized",
            extra=_log_extra(instance, outcome="distributed", loot_items=len(loot_items)),
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
                logger.info("Combat timer expired, auto-resolving", extra=_log_extra(inst))
                fresh_admin = await get_admin_supabase()
                await cls._resolve_combat(fresh_admin, inst)

        task = asyncio.create_task(_timer())
        _combat_timers[run_id_str] = task
