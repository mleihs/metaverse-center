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
from uuid import UUID

import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance_dungeon import (
    AgentCombatState,
    ArchetypeActionResponse,
    AvailableDungeonResponse,
    CombatSubmission,
    CombatSubmitResponse,
    CreateRunResponse,
    DistributeConfirmResponse,
    DungeonAction,
    DungeonClientState,
    DungeonInstance,
    DungeonRunCreate,
    DungeonRunResponse,
    EncounterChoiceResponse,
    LootAssignResponse,
    MoveResponse,
    RestResponse,
    RetreatResponse,
    SalvageResponse,
    ScoutResponse,
)
from backend.services.dungeon.archetype_strategies import get_archetype_strategy
from backend.services.dungeon.dungeon_archetypes import (
    ARCHETYPE_CONFIGS,
    get_depth_for_difficulty,
)
from backend.services.dungeon.dungeon_banter import select_banter
from backend.services.dungeon.dungeon_generator import generate_dungeon_graph
from backend.services.dungeon.dungeon_loot import roll_loot
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_combat_service import DungeonCombatService
from backend.services.dungeon_content_service import (
    get_anchor_objects as _get_anchor_objects_cache,
)
from backend.services.dungeon_distribution_service import DungeonDistributionService
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_movement_service import DungeonMovementService
from backend.services.dungeon_shared import (
    AUTO_APPLY_EFFECT_TYPES,
    FALLBACK_SPAWNS,
    INSTANCE_TTL_SECONDS,
    log_extra,
    rpc_with_retry,
)
from backend.services.platform_settings_service import PlatformSettingsService
from backend.utils.errors import bad_request, conflict, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


# Re-export for backward compatibility (tests import from here)
_log_extra = log_extra


# Re-exports for backward compat (tests import these names from here)
_AUTO_APPLY_EFFECT_TYPES = AUTO_APPLY_EFFECT_TYPES
_FALLBACK_SPAWNS = FALLBACK_SPAWNS


_rpc_with_retry = rpc_with_retry


# ── Instance TTL Cleanup ───────────────────────────────────────────────────
# Periodic background task that evicts stale in-memory instances and marks
# orphaned DB rows as abandoned. Started from FastAPI lifespan.

_CLEANUP_INTERVAL_SECONDS = 60


def _evict_stale_instances() -> int:
    """Remove in-memory instances inactive longer than INSTANCE_TTL_SECONDS.

    Delegates to InstanceStore.evict_stale which also cancels associated
    combat/distribution timers and cleans up locks.
    """
    return _store.evict_stale(INSTANCE_TTL_SECONDS)


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
        simulation_id: UUID,
        user_id: UUID,
        body: DungeonRunCreate,
    ) -> CreateRunResponse:
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
            raise bad_request(f"Unknown archetype: {archetype}")

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
            raise bad_request("One or more agents not found in simulation")

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
        anchor_pool = _get_anchor_objects_cache().get(archetype, [])
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
                raise conflict(f"An active {archetype} dungeon run already exists for this simulation") from exc
            logger.exception(
                "Failed to create dungeon run",
                extra={"sim_id": str(simulation_id), "archetype": archetype, "difficulty": difficulty},
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("simulation_id", str(simulation_id))
                sentry_sdk.capture_exception(exc)
            raise server_error("Failed to create dungeon run") from exc

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
        _store.put(run_id, instance)

        # Initial checkpoint
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        # Log creation event
        await DungeonCheckpointService.log_event(
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

        # Select random entrance atmosphere text from pool
        from backend.services.dungeon_content_service import get_entrance_texts

        entrance_pool = get_entrance_texts().get(archetype, [])
        entrance_text = random.choice(entrance_pool) if entrance_pool else None

        return CreateRunResponse(
            run=DungeonRunResponse(**run),
            state=DungeonCheckpointService.build_client_state(instance),
            entrance_text=entrance_text,
        )

    # ── Facade delegations to DungeonMovementService ─────────────────────

    @classmethod
    async def move_to_room(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        room_index: int,
        *,
        user_id: UUID,
    ) -> MoveResponse:
        """Move party to an adjacent room."""
        return await DungeonMovementService.move_to_room(admin_supabase, run_id, room_index, user_id=user_id)

    # ── Facade delegations to DungeonCombatService ───────────────────────

    @classmethod
    async def submit_combat_actions(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        user_id: UUID,
        submission: CombatSubmission,
    ) -> CombatSubmitResponse:
        """Submit combat actions for planning phase."""
        return await DungeonCombatService.submit_combat_actions(admin_supabase, run_id, user_id, submission)

    # (Combat resolution, victory, wipe, stalemate methods moved to DungeonCombatService)
    # _resolve_combat, _build_round_result, _handle_combat_victory,
    # _handle_party_wipe, _handle_combat_stalemate — all in dungeon_combat_service.py

    @classmethod
    async def handle_encounter_choice(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        action: DungeonAction,
        *,
        user_id: UUID,
    ) -> EncounterChoiceResponse:
        """Handle an encounter choice (skill check resolution)."""
        return await DungeonMovementService.handle_encounter_choice(admin_supabase, run_id, action, user_id=user_id)

    @classmethod
    async def scout(cls, admin_supabase: Client, run_id: UUID, agent_id: UUID, *, user_id: UUID) -> ScoutResponse:
        """Spy: reveal adjacent rooms and restore visibility."""
        return await DungeonMovementService.scout(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def seal_breach(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Guardian: Seal Breach — reduce water level (Deluge only)."""
        return await DungeonMovementService.seal_breach(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def ground(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Spy: Ground — reduce awareness (Awakening only)."""
        return await DungeonMovementService.ground(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def rally(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Propagandist: Rally — reduce authority fracture (Overthrow only)."""
        return await DungeonMovementService.rally(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def salvage(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        room_index: int,
        *,
        user_id: UUID,
    ) -> SalvageResponse:
        """Salvage submerged loot (Deluge only)."""
        return await DungeonMovementService.salvage(admin_supabase, run_id, agent_id, room_index, user_id=user_id)

    @classmethod
    async def rest(cls, admin_supabase: Client, run_id: UUID, agent_ids: list[UUID], *, user_id: UUID) -> RestResponse:
        """Rest at a rest site."""
        return await DungeonMovementService.rest(admin_supabase, run_id, agent_ids, user_id=user_id)

    @classmethod
    async def retreat(cls, admin_supabase: Client, run_id: UUID, *, user_id: UUID) -> RetreatResponse:
        """Abandon dungeon run (keep partial loot). Uses atomic RPC."""
        async with _store.lock(run_id):
            return await cls._retreat_locked(admin_supabase, run_id, user_id=user_id)

    @classmethod
    async def _retreat_locked(cls, admin_supabase: Client, run_id: UUID, *, user_id: UUID) -> RetreatResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        # Cancel any active combat timer
        timer = _store.pop_combat_timer(run_id)
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
                admin_supabase,
                "fn_abandon_dungeon_run",
                {
                    "p_run_id": str(run_id),
                    "p_simulation_id": str(instance.simulation_id),
                    "p_outcome": outcome,
                    "p_depth": instance.depth,
                    "p_room_index": instance.current_room,
                },
                run_id=run_id,
                context="retreat",
            )
        except PostgrestAPIError:
            return RetreatResponse(
                retreated=True,
                rpc_failed=True,
                rpc_error_message="Failed to save retreat. Your progress will be recovered on next visit.",
                loot=[item.model_dump() for item in loot],
            )

        _store.remove(run_id)
        logger.info(
            "Dungeon retreat",
            extra=_log_extra(instance, outcome="retreat", rooms_cleared=instance.rooms_cleared),
        )

        banter_data = None
        if retreat_banter:
            banter_data = {
                "text_en": retreat_banter.get("text_en", ""),
                "text_de": retreat_banter.get("text_de", ""),
            }
        return RetreatResponse(
            retreated=True,
            loot=[item.model_dump() for item in loot],
            banter=banter_data,
        )

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

        resp = await admin_supabase.table("available_dungeons").select("*").eq("simulation_id", sim_id_str).execute()

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

        # ── Admin override: per-sim config takes precedence, then global ──
        # maybe_single() returns None response when PostgREST gives 406 (no
        # matching row). Guard both the response object and .data safely.
        override_resp = (
            await admin_supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", sim_id_str)
            .eq("category", "game")
            .eq("setting_key", "dungeon_override")
            .maybe_single()
            .execute()
        )
        override_data = override_resp.data if override_resp else None
        override_config = override_data.get("setting_value", {}) if isinstance(override_data, dict) else {}
        override_mode = override_config.get("mode", "off") if isinstance(override_config, dict) else "off"
        override_archetypes = set(override_config.get("archetypes", [])) if isinstance(override_config, dict) else set()

        # Cascade: if per-sim is "off", fall through to global platform config.
        if override_mode == "off":
            override_mode, override_archetypes = await cls._get_global_dungeon_override(admin_supabase)

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

    @classmethod
    async def _get_global_dungeon_override(
        cls,
        admin_supabase: Client,
    ) -> tuple[str, set[str]]:
        """Read global dungeon override from platform_settings.

        Delegates to PlatformSettingsService (single source of truth for
        key names, parsing, and defaults). Returns (mode, archetypes).
        """
        try:
            return await PlatformSettingsService.get_dungeon_override_config(admin_supabase)
        except Exception:
            logger.warning("Failed to read global dungeon override, using defaults")
            return ("off", set())

    # ── Facade delegations to DungeonCheckpointService ───────────────────

    @classmethod
    async def get_client_state(
        cls,
        run_id: UUID,
        admin_supabase: Client | None = None,
        *,
        user_id: UUID | None = None,
    ) -> DungeonClientState:
        """Get fog-of-war filtered state for client rendering."""
        return await DungeonCheckpointService.get_client_state(run_id, admin_supabase, user_id=user_id)

    # ── Archetype Dispatch ────────────────────────────────────────────────
    # All archetype-specific logic delegated to ArchetypeStrategy subclasses
    # in backend/services/dungeon/archetype_strategies.py.
    # Adding a new archetype = new Strategy subclass + registry entry.
    # Zero engine changes required.

    # ── Facade delegations to DungeonDistributionService ─────────────────

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
    ) -> LootAssignResponse:
        """Assign one distributable loot item to an agent."""
        return await DungeonDistributionService.assign_loot(
            admin_supabase,
            run_id,
            loot_id,
            agent_id,
            dimension=dimension,
            user_id=user_id,
        )

    @classmethod
    async def confirm_distribution(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
    ) -> DistributeConfirmResponse:
        """Finalize loot distribution and complete the dungeon run."""
        return await DungeonDistributionService.confirm_distribution(admin_supabase, run_id, user_id=user_id)
