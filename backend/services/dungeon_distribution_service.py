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
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.combat import AgentCombatState
from backend.models.resonance_dungeon import (
    BIG_FIVE_DIMENSIONS,
    DistributeConfirmResponse,
    DungeonInstance,
    LootAssignResponse,
)
from backend.services.combat.condition_tracks import can_act
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_instance_store import store as _store
from backend.services.dungeon_shared import (
    AUTO_APPLY_EFFECT_TYPES,
    DISTRIBUTION_TIMEOUT_MS,
    log_extra,
    rpc_with_retry,
)
from backend.services.journal.hooks import enqueue_dungeon_imprint
from backend.utils.errors import bad_request, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class DungeonDistributionService:
    """Loot distribution, assignment, and run finalization."""

    # ── Pipe-Separated Aptitude Resolution ─────────────────────────────────

    @staticmethod
    def _resolve_pipe_aptitude(
        party: list[AgentCombatState],
        agent_id: str,
        raw_aptitude: str,
    ) -> str:
        """Resolve pipe-separated aptitude choices to the agent's lowest-level option.

        Game design decision: pick the aptitude with the lowest current level
        for maximum impact. Falls back to first choice if the agent has none
        of the listed aptitudes.

        Called before passing loot_items to the SQL RPC so the function
        receives a clean single string (R1 refactor: business logic in Python,
        not SQL).
        """
        if "|" not in raw_aptitude:
            return raw_aptitude
        choices = raw_aptitude.split("|")
        # Find agent's aptitudes from the party
        agent_aptitudes: dict[str, int] = {}
        for agent in party:
            if str(agent.agent_id) == agent_id:
                agent_aptitudes = agent.aptitudes
                break
        # Pick the choice with the lowest current level
        best: str | None = None
        best_level = float("inf")
        for choice in choices:
            level = agent_aptitudes.get(choice)
            if level is not None and level < best_level:
                best = choice
                best_level = level
        return best if best is not None else choices[0]

    # ── Run Completion (no distribution) ───────────────────────────────────

    @classmethod
    async def complete_run(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        loot: list[dict],
    ) -> None:
        """Complete a dungeon run atomically via fn_complete_dungeon_run RPC.

        Single transaction: status update + agent outcomes + loot effects + event.
        """
        outcome = {
            "loot": list(loot),
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

        # Journal: Imprint fragment on boss victory (no-distribution path).
        # Fire-and-forget; enqueue_request catches its own errors. Runs AFTER
        # the run is fully persisted + removed from the in-memory store so a
        # journal-queue hiccup cannot block downstream state.
        await enqueue_dungeon_imprint(admin_supabase, instance, outcome="victory")

    # ── Distribution Phase ─────────────────────────────────────────────────

    @classmethod
    async def begin_distribution(
        cls,
        admin_supabase: Client,
        instance: DungeonInstance,
        loot: list[dict],
    ) -> None:
        """Enter loot distribution phase after boss victory.

        Applies agent outcomes (mood, stress, moodlets) immediately,
        but holds loot for player assignment via the debrief terminal.

        ``loot`` carries the boss drop *and* everything the run collected on the
        way in (``instance.run_loot``); the caller merges the two.
        """
        instance.phase = "distributing"
        instance.pending_loot = list(loot)
        instance.loot_assignments = {}

        # Pre-build auto-apply items (stress_heal → all agents, sim-wide → first agent)
        operational_agents = [a for a in instance.party if can_act(a.condition)]
        if not operational_agents:
            operational_agents = instance.party[:1]
        first_agent_id = str(operational_agents[0].agent_id) if operational_agents else None

        auto_items: list[dict] = []
        for item in loot:
            effect_type = item.get("effect_type")
            if effect_type == "dungeon_buff":
                continue
            if effect_type == "stress_heal":
                for agent in operational_agents:
                    auto_items.append(
                        {
                            "loot_id": item["id"],
                            "agent_id": str(agent.agent_id),
                            "effect_type": effect_type,
                            "effect_params": item.get("effect_params", {}),
                        }
                    )
            elif effect_type in ("event_modifier", "arc_modifier") and first_agent_id:
                auto_items.append(
                    {
                        "loot_id": item["id"],
                        "agent_id": first_agent_id,
                        "effect_type": effect_type,
                        "effect_params": item.get("effect_params", {}),
                    }
                )
        instance.auto_apply_loot = auto_items

        # Build agent outcomes (same as complete_run)
        outcome = {
            "loot": list(loot),
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
    ) -> LootAssignResponse:
        """Assign one distributable loot item to an agent."""
        async with _store.lock(run_id):
            return await cls._assign_loot_locked(
                admin_supabase,
                run_id,
                loot_id,
                agent_id,
                dimension=dimension,
                user_id=user_id,
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
    ) -> LootAssignResponse:
        instance = await DungeonCheckpointService.get_instance(run_id, admin_supabase, require_player=user_id)
        if instance.phase != "distributing":
            raise bad_request("Not in distribution phase")

        # Validate loot_id exists and is distributable
        loot_item = next((i for i in instance.pending_loot if i["id"] == loot_id), None)
        if not loot_item:
            raise bad_request(f"Loot item '{loot_id}' not found")
        if loot_item.get("effect_type") in AUTO_APPLY_EFFECT_TYPES:
            raise bad_request("This item is auto-applied")

        # Personality modifier: require valid Big Five dimension.
        # Fixed-trait items (e.g. Overthrow Mirror Shard) have trait pre-baked in
        # effect_params — auto-extract so the frontend doesn't need to prompt.
        if loot_item.get("effect_type") == "personality_modifier":
            effective_dimension = dimension or loot_item.get("effect_params", {}).get("trait")
            if not effective_dimension or effective_dimension not in BIG_FIVE_DIMENSIONS:
                raise bad_request(f"personality_modifier requires dimension: {', '.join(sorted(BIG_FIVE_DIMENSIONS))}")
            dimension = effective_dimension

        # Validate agent is in party and operational
        agent = next((a for a in instance.party if a.agent_id == agent_id), None)
        if not agent:
            raise bad_request("Agent not in party")
        if not can_act(agent.condition):
            raise bad_request("Agent is captured and cannot receive loot")

        instance.loot_assignments[loot_id] = str(agent_id)
        # Store extra params for items that need player choices (personality dimension)
        if dimension:
            instance.loot_extra_params[loot_id] = {"dimension": dimension}
        await DungeonCheckpointService.checkpoint(admin_supabase, instance)

        return LootAssignResponse(
            assignments=instance.loot_assignments,
            remaining=cls._count_unassigned(instance),
            all_assigned=cls._count_unassigned(instance) == 0,
            state=DungeonCheckpointService.build_client_state(instance),
        )

    # ── Distribution Confirmation ──────────────────────────────────────────

    @classmethod
    async def confirm_distribution(
        cls,
        admin_supabase: Client,
        run_id: UUID,
        *,
        user_id: UUID | None = None,
    ) -> DistributeConfirmResponse:
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
    ) -> DistributeConfirmResponse:
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
            raise bad_request("Not in distribution phase")
        if cls._count_unassigned(instance) > 0:
            raise bad_request("Not all items assigned")

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
                # Resolve pipe-separated aptitude to single value (R1)
                raw_apt = params.get("aptitude", "")
                if "|" in raw_apt:
                    params["aptitude"] = cls._resolve_pipe_aptitude(
                        instance.party,
                        assigned_agent,
                        raw_apt,
                    )
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
            raise server_error("Failed to finalize") from None

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

        # Journal: Imprint fragment on boss victory (distribution path).
        await enqueue_dungeon_imprint(admin_supabase, instance, outcome="victory")

        return DistributeConfirmResponse(
            loot_result=loot_result,
            state=DungeonCheckpointService.build_client_state(instance),
            auto_assigned=instance.auto_assigned,
        )

    # ── Distribution Timer ─────────────────────────────────────────────────

    @classmethod
    def _weise_offene_beute_zu(cls, inst: DungeonInstance) -> list[dict]:
        """Verteilt, was beim Ablauf der Frist noch offen ist.

        Bis 2026-09-02 ging JEDES offene Stueck an ``party[0]`` — an dieselbe
        Person, gleichgueltig wem es genutzt haette, und selbst dann, wenn sie
        gefangen war und die Wirkung deshalb verfiel.

        Der Server hatte die bessere Antwort die ganze Zeit dabei:
        ``_compute_loot_suggestions`` waehlt fuer eine Eignungs-Verstaerkung den
        Agenten mit dem NIEDRIGSTEN Stand in dieser Eignung und verteilt
        Erinnerungen reihum — und genau diesen Vorschlag zeigt die Oberflaeche
        dem Spieler an, waehrend die Uhr laeuft. Nur beim Ablauf wurde er
        verworfen. Wer die Frist verstreichen laesst, bekommt jetzt das, was ihm
        die ganze Zeit vorgeschlagen wurde.

        Steht die Methode hier statt im Rueckruf des Zeitgebers, weil sie sonst
        nur zu pruefen waere, indem ein Test fuenf Minuten wartet — und ein
        solcher Test wird abgeschaltet statt gelesen.

        Gibt zurueck, was zugewiesen wurde und warum:
        ``[{"item_id", "agent_id", "reason": "suggestion" | "fallback"}]``.
        """
        vorschlaege = DungeonCheckpointService._compute_loot_suggestions(inst)

        # Auffanglinie nur, wenn es keinen Vorschlag gibt: der erste
        # HANDLUNGSFAEHIGE Agent. `party[0]` kann gefangen sein, und eine
        # Zuweisung an eine gefangene Person ist eine stille Vernichtung.
        handlungsfaehig = [a for a in inst.party if can_act(a.condition)]
        auffang = str((handlungsfaehig or inst.party)[0].agent_id) if inst.party else None

        zugewiesen: list[dict] = []
        for item in inst.pending_loot:
            if item.get("effect_type") in AUTO_APPLY_EFFECT_TYPES:
                continue
            if item["id"] in inst.loot_assignments:
                continue
            vorschlag = vorschlaege.get(item["id"])
            ziel = vorschlag or auffang
            if not ziel:
                continue
            inst.loot_assignments[item["id"]] = ziel
            zugewiesen.append(
                {
                    "item_id": item["id"],
                    "agent_id": ziel,
                    "reason": "suggestion" if vorschlag else "fallback",
                }
            )
        return zugewiesen

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

                inst.auto_assigned = cls._weise_offene_beute_zu(inst)

                logger.info(
                    "Distribution timer expired – auto-assigned loot",
                    extra=log_extra(
                        inst,
                        assigned=len(inst.loot_assignments),
                        auto_assigned=len(inst.auto_assigned),
                        by_suggestion=sum(1 for a in inst.auto_assigned if a["reason"] == "suggestion"),
                    ),
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
    def _build_agent_outcomes(
        cls,
        instance: DungeonInstance,
        *,
        outcome: str = "completed",
    ) -> list[dict]:
        """Build agent outcomes for the RPCs (mood, stress, moodlets, activities).

        ``outcome="retreat"`` is the same shape with a different verdict. Until
        the Systemprüfung there was no retreat branch at all, because
        `fn_abandon_dungeon_run` never applied outcomes: the stress a party
        accumulated over a whole run lived only in memory and evaporated when
        the player withdrew (Befund D5). With free loot on top (D3), the
        dominant strategy was to explore until it got dangerous and restart.
        """
        retreating = outcome == "retreat"
        outcomes = []
        for agent in instance.party:
            afflicted = agent.condition == "afflicted"
            outcomes.append(
                {
                    "agent_id": str(agent.agent_id),
                    # A withdrawal is neither a triumph nor a disaster: the mood
                    # cost is small, but the stress the run inflicted stays.
                    "mood_delta": (-5 if retreating else (-10 if agent.stress > 500 else 10)),
                    "stress_delta": agent.stress,
                    "moodlets": [
                        {
                            "moodlet_type": "dungeon_retreat" if retreating else "dungeon_survivor",
                            "emotion": ("unease" if retreating else ("dread" if afflicted else "pride")),
                            "strength": -5 if retreating else (-10 if afflicted else 10),
                            "source_description": (
                                f"Withdrew from {instance.archetype} dungeon"
                                if retreating
                                else f"Survived {instance.archetype} dungeon"
                            ),
                            "decay_type": "timed",
                        }
                    ],
                    "activity_narrative_en": (
                        f"Withdrew from {instance.archetype} resonance dungeon."
                        if retreating
                        else f"Explored {instance.archetype} resonance dungeon and prevailed."
                    ),
                    "activity_narrative_de": (
                        f"Zog sich aus dem {instance.archetype}-Resonanz-Dungeon zurück."
                        if retreating
                        else f"Erkundete {instance.archetype} Resonanz-Dungeon und bestand."
                    ),
                    "significance": 5 if retreating else 8,
                }
            )
        return outcomes

    @classmethod
    def _build_loot_items_for_rpc(cls, instance: DungeonInstance, loot: list[dict]) -> list[dict]:
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
            effect_type = loot_item.get("effect_type", "")

            # Skip runtime-only effects (no DB persistence needed)
            if effect_type == "dungeon_buff":
                continue

            if effect_type == "stress_heal":
                # Apply to all operational agents
                for agent in operational_agents:
                    items.append(
                        {
                            "loot_id": loot_item["id"],
                            "agent_id": str(agent.agent_id),
                            "effect_type": effect_type,
                            "effect_params": loot_item.get("effect_params", {}),
                        }
                    )
            else:
                # Assign to first operational agent
                params = dict(loot_item.get("effect_params", {}))
                # Resolve pipe-separated aptitude to single value (R1)
                raw_apt = params.get("aptitude", "")
                if "|" in raw_apt:
                    params["aptitude"] = cls._resolve_pipe_aptitude(
                        instance.party,
                        first_agent_id,
                        raw_apt,
                    )
                items.append(
                    {
                        "loot_id": loot_item["id"],
                        "agent_id": first_agent_id,
                        "effect_type": effect_type,
                        "effect_params": params,
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
