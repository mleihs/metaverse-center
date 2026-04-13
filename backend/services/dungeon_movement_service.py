"""Dungeon Movement Service -- room traversal, encounters, scouting, resting.

Manages the exploration lifecycle:
  - move_to_room()            → validate + move, process room type, banter, anchors
  - handle_encounter_choice()  → skill check resolution for encounter rooms
  - scout()                   → reveal adjacent rooms via Spy aptitude
  - rest()                    → heal at rest sites (with ambush risk)
  - _enter_interactive_room()  → encounter/rest/treasure room setup
  - _enter_threshold_room()    → liminal toll room setup (3 irrevocable choices)
  - _handle_threshold_choice() → resolve blood/memory/defiance tolls
  - _enter_boss_deployment()   → Prometheus-style pre-combat deployment
  - _handle_boss_deployment()  → deploy crafted items before boss fight

Extracted from DungeonEngineService (H7: god-class decomposition).
"""

from __future__ import annotations

import logging
import random
from uuid import UUID

from backend.models.resonance_dungeon import (
    ArchetypeActionResponse,
    CombatState,
    DungeonAction,
    DungeonInstance,
    EncounterChoiceResponse,
    MoveResponse,
    RestResponse,
    SalvageResponse,
    ScoutResponse,
)
from backend.services.combat.condition_tracks import can_act
from backend.services.combat.skill_checks import SkillCheckContext, resolve_skill_check
from backend.services.combat.stress_system import REST_STRESS_HEAL, calculate_ambient_stress
from backend.services.dungeon.archetype_strategies import get_archetype_strategy
from backend.services.dungeon.dungeon_achievements import DungeonAchievementService
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS
from backend.services.dungeon.dungeon_banter import select_banter
from backend.services.dungeon.dungeon_combat import check_ambush, spawn_enemies
from backend.services.dungeon.dungeon_encounters import get_encounter_by_id, select_encounter
from backend.services.dungeon.dungeon_loot import roll_loot
from backend.services.dungeon.dungeon_objektanker import get_barometer_text, select_anchor_text
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_combat_service import DungeonCombatService
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_shared import FALLBACK_SPAWNS, log_extra
from backend.utils.errors import bad_request
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


# ── Narrative Utility ──────────────────────────────────────────────────────


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
            case "add_component":
                if isinstance(val, dict):
                    name_en = val.get("name_en", "a component")
                    name_de = val.get("name_de", "eine Komponente")
                    en.append(f"Component acquired: {name_en}.")
                    de.append(f"Komponente erworben: {name_de}.")
            case "remove_components":
                if isinstance(val, list) and val:
                    n = len(val)
                    if n == 1:
                        en.append("One component consumed in the process.")
                        de.append("Eine Komponente im Prozess verbraucht.")
                    else:
                        en.append(f"{n} components consumed in the process.")
                        de.append(f"{n} Komponenten im Prozess verbraucht.")
            case "add_crafted_item":
                if isinstance(val, dict):
                    name_en = val.get("name_en", "something new")
                    name_de = val.get("name_de", "etwas Neues")
                    en.append(f"Crafted: {name_en}.")
                    de.append(f"Geschmiedet: {name_de}.")
            case "craft_failed":
                if val:
                    en.append("The combination fails. But the residue is interesting.")
                    de.append("Die Kombination scheitert. Aber der Rückstand ist interessant.")
            case "deploy_crafted_item":
                if isinstance(val, dict):
                    name_en = val.get("name_en", "an item")
                    name_de = val.get("name_de", "ein Gegenstand")
                    en.append(f"Deployed against The Prototype: {name_en}.")
                    de.append(f"Gegen den Prototypen eingesetzt: {name_de}.")
            case "ambush_trigger":
                pass  # Game mechanic flag — no player-facing narrative
            case _:
                pass  # Unknown effect keys are intentionally silent
    return en, de


class DungeonMovementService:
    """Room movement, encounter resolution, scouting, and resting."""

    # ── Room Movement ──────────────────────────────────────────────────────

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
        async with _store.lock(run_id):
            return await cls._move_to_room_locked(admin_supabase, run_id, room_index, user_id=user_id)

    @classmethod
    async def _move_to_room_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        room_index: int,
        *,
        user_id: UUID,
    ) -> MoveResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase not in ("exploring", "room_clear", "exit"):
            raise bad_request(f"Cannot move in phase: {instance.phase}")

        current_room = instance.rooms[instance.current_room]
        if room_index not in current_room.connections:
            raise bad_request("Room is not adjacent to current room")

        if room_index < 0 or room_index >= len(instance.rooms):
            raise bad_request("Invalid room index")

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
            await DungeonAchievementService.on_drain_trigger(admin_supabase, instance, drain_trigger)
        if target_room.depth > current_room.depth:
            banter_trigger = "depth_change"

        # Collect debris deposited by the current (Deluge: every 2nd room)
        debris_item = instance.archetype_state.pop("_last_debris", None)
        if debris_item:
            effect_type = debris_item.get("effect_type")
            params = debris_item.get("effect_params", {})
            # Auto-apply immediate stress heal to all alive agents
            if effect_type == "stress_heal" and params.get("when") == "immediate":
                heal = params.get("stress_heal", 0)
                for agent in instance.party:
                    if can_act(agent.condition):
                        agent.stress = max(0, agent.stress - heal)
            # Auto-apply dungeon buff — accumulate aptitude bonuses for skill checks
            elif effect_type == "dungeon_buff":
                aptitude = params.get("aptitude", "")
                bonus = params.get("check_bonus", 0)
                if aptitude and bonus:
                    debris_bonuses = instance.archetype_state.setdefault("_debris_check_bonuses", {})
                    debris_bonuses[aptitude] = debris_bonuses.get(aptitude, 0) + bonus

        # Apply ambient stress (archetype may multiply, e.g. Tower structural failure)
        ambient = calculate_ambient_stress(instance.depth, instance.difficulty)
        ambient = int(ambient * strategy.get_ambient_stress_multiplier(instance))
        for agent in instance.party:
            if can_act(agent.condition):
                agent.stress = min(1000, agent.stress + ambient)

        # ── Déjà-vu room morphing (Awakening: cleared rooms reconstruct) ──
        deja_vu = False
        if target_room.cleared and strategy.on_room_reentry(instance, room_index):
            target_room.cleared = False
            target_room.encounter_template_id = None
            target_room.loot_tier = 0
            deja_vu = True
            banter_trigger = "deja_vu"

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
            depth=target_room.depth,
        )
        banter_text = None
        if banter:
            instance.used_banter_ids.append(banter["id"])
            await DungeonAchievementService.on_banter_witnessed(admin_supabase, instance, banter["id"])
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

        # Anchor Object Text
        anchor_texts = select_anchor_text(instance, target_room)
        for at in anchor_texts:
            obj_id = at["anchor_id"]
            phase = at["phase"]
            instance.anchor_phases_shown.setdefault(obj_id, []).append(phase)
            await DungeonAchievementService.on_anchor_encountered(admin_supabase, instance, obj_id)
            if "{agent}" in at.get("text_en", ""):
                alive = [a for a in instance.party if can_act(a.condition)]
                if alive:
                    agent_for_anchor = random.choice(alive)
                    at["text_en"] = at["text_en"].replace("{agent}", agent_for_anchor.agent_name)
                    at["text_de"] = at["text_de"].replace("{agent}", agent_for_anchor.agent_name)

        # Barometer Text
        baro_text, new_baro_tier = get_barometer_text(
            instance.archetype,
            instance.archetype_state,
            instance.last_barometer_tier,
        )
        if baro_text:
            instance.last_barometer_tier = new_baro_tier

        # Process room by type
        result: dict = {
            "banter": banter_text,
            "anchor_texts": anchor_texts if anchor_texts else None,
            "barometer_text": baro_text,
            "debris": debris_item,
            "deja_vu": deja_vu,
        }

        if target_room.room_type in ("combat", "elite"):
            result.update(await DungeonCombatService.enter_combat_room(admin_supabase, instance, target_room))
        elif target_room.room_type == "threshold":
            result.update(cls._enter_threshold_room(instance))
        elif target_room.room_type in ("encounter", "rest", "treasure"):
            result.update(cls._enter_interactive_room(instance, target_room))
        elif target_room.room_type == "boss":
            strategy = get_archetype_strategy(instance.archetype)
            deployment_choices = strategy.get_boss_deployment_choices(instance)
            if deployment_choices:
                result.update(cls._enter_boss_deployment(instance, target_room, deployment_choices))
            else:
                result.update(
                    await DungeonCombatService.enter_combat_room(admin_supabase, instance, target_room, is_boss=True)
                )
        elif target_room.room_type == "exit":
            instance.phase = "exit"
            result["exit_available"] = True

        # Log event
        await DungeonCheckpointService.log_event(
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

        # Track peak stress after all room-entry mutations (for flawless_run badge)
        DungeonAchievementService.track_peak_stress(instance)

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        result["state"] = DungeonCheckpointService.build_client_state(instance)
        return MoveResponse.model_validate(result)

    # ── Encounter Choice ───────────────────────────────────────────────────

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
        async with _store.lock(run_id):
            return await cls._handle_encounter_choice_locked(admin_supabase, run_id, action, user_id=user_id)

    @classmethod
    async def _handle_encounter_choice_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        action: DungeonAction,
        *,
        user_id: UUID,
    ) -> EncounterChoiceResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase not in ("encounter", "rest", "threshold"):
            raise bad_request("Not in encounter phase")

        current_room = instance.rooms[instance.current_room]

        # Threshold intercept — dedicated handler, not encounter pipeline
        if current_room.room_type == "threshold":
            return await cls._handle_threshold_choice(admin_supabase, instance, action)

        # Boss deployment intercept
        if current_room.room_type == "boss" and "_boss_deployment_choices" in instance.archetype_state:
            return await cls._handle_boss_deployment(admin_supabase, instance, action)

        encounter = get_encounter_by_id(current_room.encounter_template_id or "")
        if not encounter:
            raise bad_request("No encounter in current room")

        choice = next((c for c in encounter.choices if c.id == action.choice_id), None)
        if not choice:
            raise bad_request(f"Unknown choice: {action.choice_id}")

        # Resolve skill check
        result_tier = "success"
        check_result = None
        acting_agent = (
            next((a for a in instance.party if a.agent_id == action.agent_id), None) if action.agent_id else None
        )
        if choice.check_aptitude and acting_agent:
            # Apply debris check bonuses from The Current Carries
            debris_bonus = instance.archetype_state.get("_debris_check_bonuses", {}).get(
                choice.check_aptitude,
                0,
            )
            ctx = SkillCheckContext(
                aptitude=choice.check_aptitude,
                aptitude_level=acting_agent.aptitudes.get(choice.check_aptitude, 3),
                difficulty_modifier=choice.check_difficulty - debris_bonus,
                personality=acting_agent.personality,
                condition=acting_agent.condition,
                visibility=instance.archetype_state.get("visibility", 3),
                archetype_state=instance.archetype_state,
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

        # Archetype penalty on failed check
        if result_tier == "fail":
            get_archetype_strategy(instance.archetype).on_failed_check(instance)

        # Apply effects
        effects = getattr(choice, f"{result_tier}_effects", {})
        narrative_en = getattr(choice, f"{result_tier}_narrative_en", "")
        narrative_de = getattr(choice, f"{result_tier}_narrative_de", "")
        # Fallback: partial success without dedicated narrative → use success narrative
        if not narrative_en and result_tier == "partial":
            narrative_en = getattr(choice, "success_narrative_en", "")
            narrative_de = getattr(choice, "success_narrative_de", "")

        # Substitute {agent} placeholder with acting agent name
        # (same pattern as banter substitution in _build_room_entry)
        if acting_agent:
            narrative_en = narrative_en.replace("{agent}", acting_agent.agent_name)
            narrative_de = narrative_de.replace("{agent}", acting_agent.agent_name)

        # Apply stress effects
        stress_delta = effects.get("stress", 0)
        stress_heal = effects.get("stress_heal", 0)
        for agent in instance.party:
            if can_act(agent.condition):
                if stress_delta:
                    agent.stress = max(0, min(1000, agent.stress + stress_delta))
                if stress_heal:
                    agent.stress = max(0, agent.stress - stress_heal)

        DungeonAchievementService.track_peak_stress(instance)

        # Apply archetype state changes from encounter effects
        get_archetype_strategy(instance.archetype).apply_encounter_effects(instance, effects)

        # Mark room cleared, return to exploring
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        await DungeonCheckpointService.log_event(
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

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        narrative_effects_en, narrative_effects_de = _narrate_effects(effects)
        return EncounterChoiceResponse(
            result=result_tier,
            check=check_result,
            effects=effects,
            narrative_effects_en=narrative_effects_en,
            narrative_effects_de=narrative_effects_de,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Scout ──────────────────────────────────────────────────────────────

    @classmethod
    async def scout(cls, admin_supabase: Client, run_id: UUID, agent_id: UUID, *, user_id: UUID) -> ScoutResponse:
        """Spy: reveal adjacent rooms and restore visibility."""
        async with _store.lock(run_id):
            return await cls._scout_locked(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def _scout_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ScoutResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent cannot act")

        spy_level = agent.aptitudes.get("spy", 0)
        if spy_level < 3:
            raise bad_request("Agent needs Spy 3+ to scout")

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

        get_archetype_strategy(instance.archetype).apply_restore(instance, "scout")

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return ScoutResponse(
            revealed_rooms=revealed_count,
            visibility=instance.archetype_state.get("visibility"),
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Seal Breach (Deluge) ─────────────────────────────────────────────

    @classmethod
    async def seal_breach(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Guardian: Seal Breach — reduce water level, gain stress (Deluge only)."""
        async with _store.lock(run_id):
            return await cls._seal_breach_locked(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def _seal_breach_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.archetype != "The Deluge":
            raise bad_request("Seal Breach only available in Deluge dungeons")

        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent cannot act")

        mc = ARCHETYPE_CONFIGS["The Deluge"]["mechanic_config"]
        guardian_level = agent.aptitudes.get("guardian", 0)
        if guardian_level < mc.get("seal_min_aptitude", 4):
            raise bad_request(f"Agent needs Guardian {mc.get('seal_min_aptitude', 4)}+ to Seal Breach")

        # Cooldown: once per N rooms (design doc §2.6)
        cooldown = mc.get("seal_cooldown_rooms", 3)
        last_seal_room = instance.archetype_state.get("_last_seal_room", -cooldown)
        rooms_entered = instance.archetype_state.get("rooms_entered", 0)
        if rooms_entered - last_seal_room < cooldown:
            rooms_remaining = cooldown - (rooms_entered - last_seal_room)
            raise bad_request(f"Seal Breach on cooldown ({rooms_remaining} rooms remaining)")

        strategy = get_archetype_strategy(instance.archetype)
        strategy.apply_restore(instance, "seal")
        instance.archetype_state["_last_seal_room"] = rooms_entered

        stress_cost = mc.get("seal_stress_cost", 15)
        agent.stress = min(1000, agent.stress + stress_cost)
        DungeonAchievementService.track_peak_stress(instance)

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return ArchetypeActionResponse(
            water_level=instance.archetype_state.get("water_level"),
            stress_cost=stress_cost,
            agent_stress=agent.stress,
            cooldown_until_room=rooms_entered + cooldown,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Ground (Awakening) ─────────────────────────────────────────────────

    @classmethod
    async def ground(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Spy: Ground — reduce awareness, gain stress (Awakening only)."""
        async with _store.lock(run_id):
            return await cls._ground_locked(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def _ground_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.archetype != "The Awakening":
            raise bad_request("Ground only available in Awakening dungeons")

        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent cannot act")

        mc = ARCHETYPE_CONFIGS["The Awakening"]["mechanic_config"]
        spy_level = agent.aptitudes.get("spy", 0)
        if spy_level < mc.get("ground_min_aptitude", 4):
            raise bad_request(f"Agent needs Spy {mc.get('ground_min_aptitude', 4)}+ to Ground")

        # Cooldown: once per N rooms
        cooldown = mc.get("ground_cooldown_rooms", 3)
        last_ground_room = instance.archetype_state.get("_last_ground_room", -cooldown)
        rooms_entered = instance.archetype_state.get("rooms_entered", 0)
        if rooms_entered - last_ground_room < cooldown:
            rooms_remaining = cooldown - (rooms_entered - last_ground_room)
            raise bad_request(f"Ground on cooldown ({rooms_remaining} rooms remaining)")

        strategy = get_archetype_strategy(instance.archetype)
        strategy.apply_restore(instance, "ground")
        instance.archetype_state["_last_ground_room"] = rooms_entered

        stress_cost = mc.get("ground_stress_cost", 15)
        agent.stress = min(1000, agent.stress + stress_cost)
        DungeonAchievementService.track_peak_stress(instance)

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return ArchetypeActionResponse(
            awareness=instance.archetype_state.get("awareness"),
            stress_cost=stress_cost,
            agent_stress=agent.stress,
            cooldown_until_room=rooms_entered + cooldown,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Rally (Overthrow) ───────────────────────────────────────────────────

    @classmethod
    async def rally(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        """Propagandist: Rally — reduce authority fracture, gain stress (Overthrow only)."""
        async with _store.lock(run_id):
            return await cls._rally_locked(admin_supabase, run_id, agent_id, user_id=user_id)

    @classmethod
    async def _rally_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        *,
        user_id: UUID,
    ) -> ArchetypeActionResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.archetype != "The Overthrow":
            raise bad_request("Rally only available in Overthrow dungeons")

        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent cannot act")

        mc = ARCHETYPE_CONFIGS["The Overthrow"]["mechanic_config"]
        propagandist_level = agent.aptitudes.get("propagandist", 0)
        if propagandist_level < mc.get("rally_min_aptitude", 4):
            raise bad_request(f"Agent needs Propagandist {mc.get('rally_min_aptitude', 4)}+ to Rally")

        # Cooldown: once per N rooms
        cooldown = mc.get("rally_cooldown_rooms", 3)
        last_rally_room = instance.archetype_state.get("_last_rally_room", -cooldown)
        rooms_entered = instance.archetype_state.get("rooms_entered", 0)
        if rooms_entered - last_rally_room < cooldown:
            rooms_remaining = cooldown - (rooms_entered - last_rally_room)
            raise bad_request(f"Rally on cooldown ({rooms_remaining} rooms remaining)")

        strategy = get_archetype_strategy(instance.archetype)
        strategy.apply_restore(instance, "rally")
        instance.archetype_state["_last_rally_room"] = rooms_entered

        stress_cost = mc.get("rally_stress_cost", 15)
        agent.stress = min(1000, agent.stress + stress_cost)
        DungeonAchievementService.track_peak_stress(instance)

        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return ArchetypeActionResponse(
            fracture=instance.archetype_state.get("fracture"),
            stress_cost=stress_cost,
            agent_stress=agent.stress,
            cooldown_until_room=rooms_entered + cooldown,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Salvage (Deluge) ────────────────────────────────────────────────────

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
        """Salvage submerged loot — Guardian aptitude check (Deluge only)."""
        async with _store.lock(run_id):
            return await cls._salvage_locked(admin_supabase, run_id, agent_id, room_index, user_id=user_id)

    @classmethod
    async def _salvage_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_id: UUID,
        room_index: int,
        *,
        user_id: UUID,
    ) -> SalvageResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.archetype != "The Deluge":
            raise bad_request("Salvage only available in Deluge dungeons")

        if instance.phase not in ("exploring", "room_clear", "exit"):
            raise bad_request(f"Cannot salvage in phase: {instance.phase}")

        # Validate agent
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent cannot act")

        # Validate room
        if room_index < 0 or room_index >= len(instance.rooms):
            raise bad_request("Invalid room index")
        target_room = instance.rooms[room_index]
        if not target_room.revealed or not target_room.cleared:
            raise bad_request("Room must be revealed and cleared")
        if room_index == instance.current_room:
            raise bad_request("Cannot salvage current room")

        # Check room is submerged (depth-based flooding)
        water_level = instance.archetype_state.get("water_level", 0)
        room_depth = target_room.depth
        submerged = (
            (water_level >= 75) or (water_level >= 50 and room_depth >= 2) or (water_level >= 25 and room_depth >= 4)
        )
        if not submerged:
            raise bad_request("Room is not submerged — water level too low")

        # Prevent double-diving
        salvaged = instance.archetype_state.get("_salvaged_rooms", [])
        if room_index in salvaged:
            raise bad_request("Room already salvaged")

        # Run aptitude check
        mc = ARCHETYPE_CONFIGS["The Deluge"]["mechanic_config"]
        check_aptitude = mc.get("submerged_loot_check_aptitude", "guardian")
        check_bonus = mc.get("submerged_loot_check_bonus", 10)
        aptitude_level = agent.aptitudes.get(check_aptitude, 0)

        # Apply debris check bonuses from The Current Carries
        debris_bonus = instance.archetype_state.get("_debris_check_bonuses", {}).get(
            check_aptitude,
            0,
        )
        ctx = SkillCheckContext(
            aptitude=check_aptitude,
            aptitude_level=aptitude_level,
            difficulty_modifier=-check_bonus - debris_bonus,
            condition=agent.condition,
            archetype_state=instance.archetype_state,
        )
        outcome = resolve_skill_check(ctx)

        # Mark room as salvaged (regardless of outcome — no retry)
        salvaged.append(room_index)
        instance.archetype_state["_salvaged_rooms"] = salvaged

        if outcome.result in ("success", "partial"):
            loot = roll_loot(
                tier=1,
                difficulty=instance.difficulty,
                depth=target_room.depth,
                archetype_state=instance.archetype_state,
                archetype=instance.archetype,
            )
            # Add loot to instance pending loot
            for item in loot:
                instance.loot.append(item)

            await DungeonCheckpointService.checkpoint(admin_supabase, instance)
            return SalvageResponse(
                success=True,
                loot=[item.model_dump(mode="json") for item in loot],
                check_result=outcome.result,
                check_value=outcome.check_value,
                state=DungeonCheckpointService.build_client_state(instance),
            )

        # Failure: +5 water
        instance.archetype_state["water_level"] = min(
            mc["max_water_level"],
            water_level + 5,
        )
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)
        return SalvageResponse(
            success=False,
            water_penalty=5,
            check_result=outcome.result,
            check_value=outcome.check_value,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Rest ───────────────────────────────────────────────────────────────

    @classmethod
    async def rest(cls, admin_supabase: Client, run_id: UUID, agent_ids: list[UUID], *, user_id: UUID) -> RestResponse:
        """Rest at a rest site."""
        async with _store.lock(run_id):
            return await cls._rest_locked(admin_supabase, run_id, agent_ids, user_id=user_id)

    @classmethod
    async def _rest_locked(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        agent_ids: list[UUID],
        *,
        user_id: UUID,
    ) -> RestResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)

        if instance.phase not in ("rest", "encounter"):
            raise bad_request("Not at a rest site")

        current_room = instance.rooms[instance.current_room]
        if current_room.room_type != "rest":
            raise bad_request("Current room is not a rest site")

        # Check for ambush
        is_ambushed = check_ambush(instance.archetype_state, instance.archetype)

        if is_ambushed:
            fallbacks = FALLBACK_SPAWNS.get(instance.archetype, FALLBACK_SPAWNS["The Shadow"])
            rest_spawn = fallbacks.get("rest_ambush", fallbacks["default"])
            enemies = spawn_enemies(rest_spawn, instance.difficulty, instance.depth, instance.archetype)
            instance.combat = CombatState(enemies=enemies, is_ambush=True)
            instance.phase = "combat_planning"
            await DungeonCombatService._start_combat_timer(admin_supabase, instance)
            await DungeonCheckpointService.checkpoint(admin_supabase, instance)
            return RestResponse(
                ambushed=True,
                state=DungeonCheckpointService.build_client_state(instance),
            )

        # Apply rest healing
        for agent in instance.party:
            if agent.agent_id in agent_ids and can_act(agent.condition):
                agent.stress = max(0, agent.stress - REST_STRESS_HEAL)
                if agent.condition == "wounded":
                    agent.condition = "stressed"

        get_archetype_strategy(instance.archetype).apply_restore(instance, "rest")

        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        await DungeonCheckpointService.log_event(
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
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return RestResponse(
            healed=True,
            ambushed=False,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Room Type Handlers ─────────────────────────────────────────────────

    @classmethod
    def _enter_interactive_room(cls, instance: DungeonInstance, room) -> dict:  # noqa: ANN001
        """Set up encounter / rest / treasure room."""
        room_type: str = room.room_type
        encounter = select_encounter(
            room_type, instance.depth, instance.difficulty, instance.archetype,
            used_ids=instance.used_encounter_ids,
        )

        if encounter:
            room.encounter_template_id = encounter.id
            instance.used_encounter_ids.append(encounter.id)
            instance.phase = "rest" if room_type == "rest" else "encounter"
            result: dict = {
                room_type: True,
                "description_en": encounter.description_en,
                "description_de": encounter.description_de,
                "choices": DungeonCheckpointService.format_encounter_choices(encounter.choices),
            }
            if room_type == "encounter":
                result["encounter_id"] = encounter.id
            return result

        if room_type == "encounter":
            logger.warning(
                "No encounter template — auto-clearing room",
                extra=log_extra(instance, room_type=room_type, depth=instance.depth),
            )
            instance.phase = "room_clear"
            room.cleared = True
            return {"encounter": False}

        if room_type == "rest":
            instance.phase = "rest"
            return {"rest": True}

        # Treasure: auto-loot
        loot = roll_loot(
            room.loot_tier,
            instance.difficulty,
            instance.depth,
            instance.archetype_state,
            instance.archetype,
        )
        room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        get_archetype_strategy(instance.archetype).apply_restore(instance, "treasure")

        return {
            "treasure": True,
            "auto_loot": True,
            "loot": [item.model_dump() for item in loot],
        }

    # ── Threshold Room ─────────────────────────────────────────────────────

    @classmethod
    def _enter_threshold_room(cls, instance: DungeonInstance) -> dict:
        """Enter the Threshold — liminal toll room before the boss.

        Sets phase to 'threshold' and returns the 3 irrevocable toll choices.
        Uses the same choice format as encounters for frontend compatibility.
        """
        from backend.services.dungeon.dungeon_threshold import (
            THRESHOLD_CHOICES,
            THRESHOLD_ENTRY_TEXT,
        )

        instance.phase = "threshold"
        entry_text = THRESHOLD_ENTRY_TEXT.get(instance.archetype, THRESHOLD_ENTRY_TEXT["The Shadow"])

        return {
            "threshold": True,
            "description_en": entry_text["en"],
            "description_de": entry_text["de"],
            "choices": DungeonCheckpointService.format_encounter_choices(THRESHOLD_CHOICES),
        }

    @classmethod
    async def _handle_threshold_choice(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        action: DungeonAction,
    ) -> dict:
        """Resolve a Threshold toll choice (blood / memory / defiance).

        Each toll is irrevocable and affects the rest of the run differently:
        - Blood:    one agent takes 1 condition step down (honest, calculable)
        - Memory:   a random positive archetype modifier is silently removed (unknown)
        - Defiance: boss encounter difficulty is silently increased (deferred)
        """
        from backend.services.combat.condition_tracks import apply_condition_damage
        from backend.services.dungeon.dungeon_threshold import THRESHOLD_RESOLUTION_TEXT

        choice_id = action.choice_id
        if choice_id not in ("threshold_blood", "threshold_memory", "threshold_defiance"):
            raise bad_request(f"Unknown threshold choice: {choice_id}")

        current_room = instance.rooms[instance.current_room]
        narrative_data: dict = {}

        if choice_id == "threshold_blood":
            # Auto-select the healthiest agent (highest condition = most to lose)
            from backend.services.combat.condition_tracks import CONDITION_SEVERITY

            candidates = sorted(
                [a for a in instance.party if a.condition != "captured"],
                key=lambda a: CONDITION_SEVERITY.get(a.condition, 0),
            )
            if candidates:
                agent = candidates[0]  # Healthiest agent
                old_condition = agent.condition
                new_condition, _ = apply_condition_damage(agent.condition, 1)
                agent.condition = new_condition
                narrative_data = {
                    "agent_name": agent.agent_name,
                    "old_condition": old_condition,
                    "new_condition": new_condition,
                }
            # All agents captured — Blood Toll waived (nothing left to take)
            # Falls through to room_clear with no penalty

        elif choice_id == "threshold_memory":
            # Silently remove a random positive modifier from archetype state.
            # Target keys that represent accumulated benefits, not structural flags.
            strategy = get_archetype_strategy(instance.archetype)
            strategy.apply_threshold_memory_toll(instance)

        elif choice_id == "threshold_defiance":
            # Flag for boss difficulty increase — checked in combat setup.
            instance.archetype_state["_threshold_defiance"] = True

        # Mark room cleared
        current_room.cleared = True
        instance.rooms_cleared += 1
        instance.phase = "room_clear"

        # Build narrative
        resolution = THRESHOLD_RESOLUTION_TEXT.get(choice_id, {})
        narrative_en = resolution.get("en", {}).get("narrative", "")
        narrative_de = resolution.get("de", {}).get("narrative", "")
        system_en = resolution.get("en", {}).get("system", "")
        system_de = resolution.get("de", {}).get("system", "")
        if system_en and narrative_data:
            narrative_en += "\n" + system_en.format(**narrative_data)
        if system_de and narrative_data:
            narrative_de += "\n" + system_de.format(**narrative_data)

        await DungeonCheckpointService.log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            current_room.index,
            "threshold_choice",
            {"choice_id": choice_id, **narrative_data},
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return EncounterChoiceResponse(
            result="success",
            threshold_toll=choice_id,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
            effects={"threshold_toll": choice_id, **narrative_data},
            state=DungeonCheckpointService.build_client_state(instance),
        )

    @classmethod
    def _enter_boss_deployment(
        cls,
        instance: DungeonInstance,
        room,  # noqa: ANN001
        choices: list[dict],
    ) -> dict:
        """Enter pre-combat deployment phase for a boss room."""
        encounter = select_encounter(
            "boss",
            instance.depth,
            instance.difficulty,
            instance.archetype,
            used_ids=instance.used_encounter_ids,
        )
        if encounter:
            instance.used_encounter_ids.append(encounter.id)
        room.encounter_template_id = encounter.id if encounter else None
        instance.phase = "encounter"
        instance.archetype_state["_boss_deployment_choices"] = choices
        return {
            "boss_deployment": True,
            "description_en": encounter.description_en if encounter else "",
            "description_de": encounter.description_de if encounter else "",
            "choices": DungeonCheckpointService.format_encounter_choices(choices),
        }

    @classmethod
    async def _handle_boss_deployment(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        action: DungeonAction,
    ) -> dict:
        """Handle a boss deployment choice: deploy item, aptitude check, or begin combat.

        Supports two deployment patterns:
        - Prometheus: inventory-based (deploy crafted items with diminishing returns)
        - Deluge: check-based (aptitude checks with success/partial/fail effects)
        """
        boss_choices = instance.archetype_state.get("_boss_deployment_choices", [])
        choice = next((c for c in boss_choices if c["id"] == action.choice_id), None)
        if not choice:
            raise bad_request(f"Unknown deployment choice: {action.choice_id}")

        current_room = instance.rooms[instance.current_room]
        strategy = get_archetype_strategy(instance.archetype)

        # ── "Begin combat" — transition to boss fight ──
        if action.choice_id == "begin_combat":
            instance.archetype_state.pop("_boss_deployment_choices", None)
            combat_result = await DungeonCombatService.enter_combat_room(
                admin_supabase,
                instance,
                current_room,
                is_boss=True,
            )
            await DungeonCheckpointService.checkpoint(admin_supabase, instance)

            # Archetype-specific narrative
            _boss_narratives = {
                "The Prometheus": (
                    "The Prototype activates. It has cataloged your preparations. "
                    "It does not care. It is, after all, unfinished \u2013 "
                    "and unfinished things do not fear revision.",
                    "Der Prototyp aktiviert sich. Er hat eure Vorbereitungen katalogisiert. "
                    "Es kümmert ihn nicht. Er ist, immerhin, unfertig \u2013 "
                    "und unfertige Dinge fürchten keine Überarbeitung.",
                ),
                "The Deluge": (
                    "The Current fills the room. Not like water entering \u2013 "
                    "like water remembering it was always here.",
                    "Die Strömung füllt den Raum. Nicht wie einströmendes Wasser \u2013 "
                    "wie Wasser, das sich erinnert, schon immer hier gewesen zu sein.",
                ),
            }
            narrative_en, narrative_de = _boss_narratives.get(
                instance.archetype,
                ("The boss emerges.", "Der Boss erscheint."),
            )

            await DungeonCheckpointService.log_event(
                admin_supabase,
                instance.run_id,
                instance.simulation_id,
                instance.depth,
                current_room.index,
                "encounter_choice",
                {"choice_id": "begin_combat", "boss_deployment": True},
                narrative_en=narrative_en,
                narrative_de=narrative_de,
            )
            return EncounterChoiceResponse.model_validate(
                {
                    "result": "success",
                    "narrative_en": narrative_en,
                    "narrative_de": narrative_de,
                    "effects": {},
                    "state": DungeonCheckpointService.build_client_state(instance),
                    **combat_result,
                }
            )

        # ── Check-based deployment (Deluge pattern) ──
        if choice.get("check_aptitude"):
            agent = (
                next(
                    (a for a in instance.party if a.agent_id == action.agent_id),
                    None,
                )
                if action.agent_id
                else (instance.party[0] if instance.party else None)
            )

            if not agent:
                raise bad_request("No agent for deployment check")

            check_ctx = SkillCheckContext(
                aptitude=choice["check_aptitude"],
                aptitude_level=agent.aptitudes.get(choice["check_aptitude"], 3),
                difficulty_modifier=choice.get("check_difficulty", 0),
                personality=agent.personality,
                condition=agent.condition,
                visibility=instance.archetype_state.get("visibility", 3),
                archetype_state=instance.archetype_state,
            )
            check_result = resolve_skill_check(check_ctx)

            if check_result.result == "success":
                effects = choice.get("effects_success", {})
            elif check_result.result == "partial":
                effects = choice.get("effects_partial", {})
            else:
                effects = choice.get("effects_fail", {})

            strategy.apply_encounter_effects(instance, effects)

            # Store deployment result for combat phase
            deployed = instance.archetype_state.setdefault("deployed_boss_effects", [])
            deployed.append(
                {
                    "choice_id": choice["id"],
                    "outcome": check_result.result,
                    **effects,
                }
            )

            # Regenerate remaining choices (remove used choice)
            remaining = [c for c in boss_choices if c["id"] != choice["id"]]
            instance.archetype_state["_boss_deployment_choices"] = remaining

            await DungeonCheckpointService.log_event(
                admin_supabase,
                instance.run_id,
                instance.simulation_id,
                instance.depth,
                current_room.index,
                "encounter_choice",
                {
                    "choice_id": action.choice_id,
                    "boss_deployment": True,
                    "check_aptitude": choice["check_aptitude"],
                    "outcome": check_result.result,
                },
            )
            await DungeonCheckpointService.checkpoint(admin_supabase, instance)

            return EncounterChoiceResponse(
                result=check_result.result,
                effects=effects,
                state=DungeonCheckpointService.build_client_state(instance),
            )

        # ── Item-based deployment (Prometheus pattern) ──
        item_id = action.choice_id.removeprefix("deploy_")
        crafted_items = instance.archetype_state.get("crafted_items", [])
        item = next((i for i in crafted_items if i["id"] == item_id), None)
        if not item or not item.get("boss_effect"):
            raise bad_request(f"Invalid deployment item: {item_id}")

        boss_effect = item["boss_effect"]

        # Apply effect to archetype state (stored for combat engine to read)
        deployed = instance.archetype_state.setdefault("deployed_boss_effects", [])
        deployed.append(
            {
                "item_id": item["id"],
                "item_name_en": item.get("name_en", item_id),
                "item_name_de": item.get("name_de", item_id),
                **boss_effect,
            }
        )

        # Track deployment count for diminishing returns
        deploy_counts = instance.archetype_state.setdefault("_deploy_counts", {})
        deploy_counts[item["id"]] = deploy_counts.get(item["id"], 0) + 1

        # Regenerate remaining choices (strategy handles diminishing returns)
        new_choices = strategy.get_boss_deployment_choices(instance)
        instance.archetype_state["_boss_deployment_choices"] = new_choices

        effects = {"deploy_crafted_item": {"name_en": item.get("name_en"), "name_de": item.get("name_de")}}
        narrative_effects_en, narrative_effects_de = _narrate_effects(effects)

        await DungeonCheckpointService.log_event(
            admin_supabase,
            instance.run_id,
            instance.simulation_id,
            instance.depth,
            current_room.index,
            "encounter_choice",
            {
                "choice_id": action.choice_id,
                "boss_deployment": True,
                "deployed_item": item["id"],
                "deploy_count": deploy_counts[item["id"]],
            },
        )
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return EncounterChoiceResponse(
            result="success",
            effects=effects,
            narrative_effects_en=narrative_effects_en,
            narrative_effects_de=narrative_effects_de,
            state=DungeonCheckpointService.build_client_state(instance),
        )
