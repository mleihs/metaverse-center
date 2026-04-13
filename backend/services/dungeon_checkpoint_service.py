"""Dungeon Checkpoint Service -- state persistence, recovery, and client state.

Cross-cutting infrastructure consumed by all dungeon sub-services:
  - get_instance()        → retrieve/recover active instance
  - checkpoint()          → persist state to DB after every mutation
  - log_event()           → bilingual event log
  - build_client_state()  → fog-of-war filtered state for frontend
  - recover_from_checkpoint() → restore instance after server restart

Extracted from DungeonEngineService (H7: god-class decomposition).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance_dungeon import (
    AbilityOption,
    AgentCombatStateClient,
    CombatStateClient,
    DungeonClientState,
    DungeonInstance,
    EnemyCombatStateClient,
    RoomNode,
    RoomNodeClient,
)
from backend.services.combat.ability_schools import get_agent_all_abilities
from backend.services.combat.condition_tracks import can_act
from backend.services.combat.stress_system import stress_threshold
from backend.services.dungeon.dungeon_encounters import get_encounter_by_id
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_shared import AUTO_APPLY_EFFECT_TYPES, CLIENT_TIMER_BUFFER_MS, log_extra
from backend.utils.errors import forbidden, not_found
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class DungeonCheckpointService:
    """State persistence, recovery, and client state building."""

    # ── Instance Retrieval ─────────────────────────────────────────────────

    @classmethod
    async def get_instance(
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
        instance = _store.get(run_id)
        if not instance:
            # Try checkpoint recovery (survives server restarts)
            if admin_supabase:
                instance = await cls.recover_from_checkpoint(admin_supabase, run_id)
            if not instance:
                raise not_found(detail="Dungeon run not found or not active")

        if require_player and require_player not in instance.player_ids:
            raise forbidden("Not a participant in this dungeon run")

        # C4: If a prior checkpoint failed, re-attempt before allowing mutation
        if _store.is_dirty(run_id):
            try:
                await cls.checkpoint(admin_supabase or await get_admin_supabase(), instance)
            except Exception as exc:
                logger.exception(
                    "Re-checkpoint of dirty instance failed — evicting",
                    extra={"run_id": str(run_id)},
                )
                _store.remove(run_id)
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "Dungeon state recovery failed. Please retry.",
                ) from exc

        _store.touch(run_id)
        return instance

    # ── Checkpoint ─────────────────────────────────────────────────────────

    @classmethod
    async def checkpoint(cls, admin_supabase: Client, instance: DungeonInstance) -> None:
        """Persist mutable state to DB. Called after EVERY state transition.

        C4: On failure, marks instance as dirty so get_instance re-attempts
        the checkpoint before allowing the next mutation.
        """
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

        try:
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
            _store.clear_dirty(instance.run_id)
        except PostgrestAPIError:
            _store.mark_dirty(instance.run_id)
            logger.exception(
                "Checkpoint failed — instance marked dirty",
                extra=log_extra(instance, phase=instance.phase),
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(instance.run_id))
                scope.set_tag("simulation_id", str(instance.simulation_id))
                sentry_sdk.capture_exception()

    # ── Event Logging ──────────────────────────────────────────────────────

    @classmethod
    async def log_event(
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

    # ── Checkpoint Recovery ────────────────────────────────────────────────

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
        _store.put(run_id, instance)

        logger.info(
            "Recovered dungeon instance from checkpoint",
            extra=log_extra(instance, phase=instance.phase),
        )
        return instance

    # ── Client State (Fog of War) ──────────────────────────────────────────

    @classmethod
    async def get_client_state(
        cls,
        run_id: UUID,
        admin_supabase: Client | None = None,
        *,
        user_id: UUID | None = None,
    ) -> DungeonClientState:
        """Get fog-of-war filtered state for client rendering."""
        instance = await cls.get_instance(run_id, admin_supabase, require_player=user_id)
        return cls.build_client_state(instance)

    @classmethod
    def build_client_state(cls, instance: DungeonInstance) -> DungeonClientState:
        """Build client-safe state with fog of war applied."""
        # Filter rooms: revealed = visible on map, scouted = room type known.
        client_rooms = [
            RoomNodeClient(
                index=room.index,
                depth=room.depth,
                room_type=room.room_type if room.scouted else "?",
                connections=room.connections if room.revealed else [],
                cleared=room.cleared,
                current=room.index == instance.current_room,
                revealed=room.revealed,
            )
            for room in instance.rooms
        ]

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
                            name_en=a.name_en,
                            name_de=a.name_de,
                            school=a.school,
                            description_en=a.description_en,
                            description_de=a.description_de,
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

        # Encounter fields (only during encounter/rest/threshold phase)
        encounter_choices = None
        encounter_desc_en = None
        encounter_desc_de = None
        if instance.phase == "threshold":
            # Threshold: structural toll choices from dedicated module.
            # Run through format_encounter_choices for consistent client shape.
            from backend.services.dungeon.dungeon_threshold import (
                THRESHOLD_CHOICES,
                THRESHOLD_ENTRY_TEXT,
            )

            encounter_choices = cls.format_encounter_choices(THRESHOLD_CHOICES)
            entry_text = THRESHOLD_ENTRY_TEXT.get(instance.archetype, THRESHOLD_ENTRY_TEXT["The Shadow"])
            encounter_desc_en = entry_text["en"]
            encounter_desc_de = entry_text["de"]
        elif instance.phase in ("encounter", "rest"):
            current_room = instance.rooms[instance.current_room]
            # Boss deployment: dynamic choices from archetype_state
            boss_deploy_choices = instance.archetype_state.get("_boss_deployment_choices")
            if boss_deploy_choices and current_room.room_type == "boss":
                encounter_choices = cls.format_encounter_choices(boss_deploy_choices)
                encounter = get_encounter_by_id(current_room.encounter_template_id or "")
                if encounter:
                    encounter_desc_en = encounter.description_en
                    encounter_desc_de = encounter.description_de
            elif current_room.encounter_template_id:
                encounter = get_encounter_by_id(current_room.encounter_template_id)
                if encounter:
                    encounter_choices = cls.format_encounter_choices(encounter.choices)
                    encounter_desc_en = encounter.description_en
                    encounter_desc_de = encounter.description_de

        # Recompute remaining_ms for the client (avoids stale values from checkpoint)
        client_timer = instance.phase_timer
        if client_timer:
            try:
                started = datetime.fromisoformat(client_timer.started_at)
                elapsed_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
                fresh_remaining = max(0, client_timer.duration_ms - CLIENT_TIMER_BUFFER_MS - elapsed_ms)
                client_timer = client_timer.model_copy(update={"remaining_ms": fresh_remaining})
            except (ValueError, TypeError):
                pass  # Malformed started_at — fall through with original timer

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
            phase_timer=client_timer,
            pending_loot=pending_loot,
            loot_assignments=loot_assignments,
            loot_suggestions=loot_suggestions,
            encounter_choices=encounter_choices,
            encounter_description_en=encounter_desc_en,
            encounter_description_de=encounter_desc_de,
        )

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def format_encounter_choices(choices: list) -> list[dict]:
        """Format encounter choices for client response with check info.

        Accepts both ``EncounterChoice`` model instances (attribute access) and
        plain dicts (boss deployment dynamic choices).
        """

        def _get(c, key: str, default=None):  # noqa: ANN001
            return c.get(key, default) if isinstance(c, dict) else getattr(c, key, default)

        return [
            {
                "id": _get(c, "id"),
                "label_en": _get(c, "label_en"),
                "label_de": _get(c, "label_de"),
                "description_en": _get(c, "description_en"),
                "description_de": _get(c, "description_de"),
                "requires_aptitude": _get(c, "requires_aptitude"),
                "check_aptitude": _get(c, "check_aptitude"),
                "check_difficulty": _get(c, "check_difficulty", 0),
            }
            for c in choices
        ]

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
            if effect_type in AUTO_APPLY_EFFECT_TYPES:
                continue

            if effect_type == "aptitude_boost":
                params = item.get("effect_params", {})
                choices = params.get("aptitude_choices", [])
                # Single-aptitude items use "aptitude" key (string) instead of array
                if not choices and params.get("aptitude"):
                    apt = params["aptitude"]
                    choices = [apt] if "|" not in apt else apt.split("|")
                if choices:
                    best_agent = min(
                        operational,
                        key=lambda a: min(a.aptitudes.get(c, 0) for c in choices),
                    )
                    suggestions[item["id"]] = str(best_agent.agent_id)
                else:
                    suggestions[item["id"]] = str(operational[0].agent_id)
            elif effect_type in ("memory", "moodlet"):
                suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
                robin_idx += 1
            elif effect_type == "personality_modifier":
                # Suggest the agent with the lowest value in the target trait
                trait = item.get("effect_params", {}).get("trait")
                if trait and operational:
                    best = min(operational, key=lambda a: a.personality.get(trait, 50.0))
                    suggestions[item["id"]] = str(best.agent_id)
                else:
                    suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
                    robin_idx += 1
            else:
                # simulation_modifier and unknown types: round-robin fair distribution
                suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
                robin_idx += 1

        return suggestions
