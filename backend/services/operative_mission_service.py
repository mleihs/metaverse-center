"""Operative mission execution: deploy, resolve, recall, and fortification logic."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import OperativeDeploy
from backend.services.aptitude_service import AptitudeService
from backend.services.battle_log_service import BattleLogService
from backend.services.constants import (
    FORTIFICATION_DURATION_CYCLES,
    FORTIFICATION_RP_COST,
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    SECURITY_LEVEL_MAP,
    _downgrade_security,
    _upgrade_security,
)
from backend.services.epoch_service import EpochService
from backend.services.platform_config_service import PlatformConfigService
from supabase import Client

logger = logging.getLogger(__name__)


class OperativeMissionService:
    """Service for deploying, resolving, recalling operatives, and zone fortification."""

    # ── Deploy ─────────────────────────────────────────────

    @classmethod
    async def deploy(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        body: OperativeDeploy,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Deploy an operative agent on a mission.

        Sets ``deployed_cycle`` (migration 090) for cycle-based tension
        computation in ``fn_compute_alliance_tension``.
        """
        epoch = await EpochService.get(supabase, epoch_id)

        # Phase restrictions
        if epoch["status"] not in ("foundation", "competition", "reckoning"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Operatives can only be deployed during active epoch phases.",
            )

        # Foundation phase: only guardians and spies allowed
        if epoch["status"] == "foundation" and body.operative_type not in ("guardian", "spy"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Only guardian and spy operatives can be deployed during foundation phase.",
            )

        # Guardians are self-deploy only
        if body.operative_type == "guardian" and body.target_simulation_id is not None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Guardians can only be deployed to your own simulation.",
            )

        # Non-guardians require embassy + target
        if body.operative_type != "guardian":
            if not body.target_simulation_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Offensive operatives require a target simulation.",
                )
            if not body.embassy_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Operatives must deploy through an embassy.",
                )
            # Validate embassy exists and is active
            embassy = (
                supabase.table("embassies")
                .select("id, status")
                .eq("id", str(body.embassy_id))
                .single()
                .execute()
            )
            if not embassy.data or embassy.data.get("status") != "active":
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Embassy must be active to deploy operatives.",
                )

        # Check for betrayal (attacking an ally)
        if body.operative_type != "guardian" and body.target_simulation_id:
            source_p = (
                supabase.table("epoch_participants")
                .select("team_id")
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(simulation_id))
                .maybe_single()
                .execute()
            )
            target_p = (
                supabase.table("epoch_participants")
                .select("team_id")
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(body.target_simulation_id))
                .maybe_single()
                .execute()
            )
            source_team = source_p.data.get("team_id") if source_p.data else None
            target_team = target_p.data.get("team_id") if target_p.data else None

            if source_team and target_team and source_team == target_team:
                config = epoch.get("config", {})
                if not config.get("allow_betrayal", True):
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST,
                        "Betrayal is disabled in this epoch.",
                    )

        # Validate agent belongs to simulation
        agent = (
            supabase.table("agents")
            .select("id, simulation_id, name")
            .eq("id", str(body.agent_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not agent.data:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Agent not found in this simulation.",
            )

        # Check agent isn't already deployed
        existing = (
            supabase.table("operative_missions")
            .select("id")
            .eq("agent_id", str(body.agent_id))
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active", "returning"])
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This agent is already on an active mission.",
            )

        # Check RP cost
        cost = OPERATIVE_RP_COSTS.get(body.operative_type, 5)
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, cost)

        # Calculate success probability
        success_prob = await cls._calculate_success_probability(
            supabase,
            body,
            simulation_id,
            admin_supabase=admin_supabase,
        )

        # Calculate resolve time
        config = epoch.get("config", {})
        cycle_hours = config.get("cycle_hours", 8)
        deploy_cycles = OPERATIVE_DEPLOY_CYCLES.get(body.operative_type, 1)
        mission_cycles = OPERATIVE_MISSION_CYCLES.get(body.operative_type, 1)
        total_hours = (deploy_cycles + mission_cycles) * cycle_hours
        resolves_at = datetime.now(UTC) + timedelta(hours=total_hours)

        # Guardian resolves_at is far future (permanent)
        if body.operative_type == "guardian":
            resolves_at = datetime.now(UTC) + timedelta(days=365)

        mission_data = {
            "epoch_id": str(epoch_id),
            "agent_id": str(body.agent_id),
            "operative_type": body.operative_type,
            "source_simulation_id": str(simulation_id),
            "target_simulation_id": str(body.target_simulation_id) if body.target_simulation_id else None,
            "embassy_id": str(body.embassy_id) if body.embassy_id else None,
            "target_entity_id": str(body.target_entity_id) if body.target_entity_id else None,
            "target_entity_type": body.target_entity_type,
            "target_zone_id": str(body.target_zone_id) if body.target_zone_id else None,
            "status": "active" if deploy_cycles == 0 else "deploying",
            "cost_rp": cost,
            "success_probability": float(success_prob),
            "resolves_at": resolves_at.isoformat(),
            "deployed_cycle": epoch.get("current_cycle", 1),
        }

        resp = supabase.table("operative_missions").insert(mission_data).execute()
        if not resp.data:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Failed to create operative mission.",
            )

        mission = resp.data[0]

        # Build context from data already available in this method
        # Agent name already fetched at line 172 (validation query)
        context = {
            "agent_name": agent.data.get("name"),
            "target_sim_name": None,
            "target_zone_name": None,
        }
        try:
            if body.target_simulation_id:
                sim_resp = (
                    supabase.table("simulations")
                    .select("name")
                    .eq("id", str(body.target_simulation_id))
                    .maybe_single()
                    .execute()
                )
                if sim_resp.data:
                    context["target_sim_name"] = sim_resp.data["name"]
            if body.target_zone_id:
                zone_resp = (
                    supabase.table("zones")
                    .select("name")
                    .eq("id", str(body.target_zone_id))
                    .maybe_single()
                    .execute()
                )
                if zone_resp.data:
                    context["target_zone_name"] = zone_resp.data["name"]
        except Exception:
            logger.debug("Context lookup failed", exc_info=True)

        # Log deployment to battle log with pre-fetched context
        try:
            await BattleLogService.log_operative_deployed(
                supabase, epoch_id, epoch.get("current_cycle", 1),
                mission, context=context,
            )
        except Exception:
            logger.debug("Battle log write failed for deployment", exc_info=True)

        # Attach context to response for frontend toast (no re-query needed)
        mission["agents"] = {"name": context["agent_name"]}
        if context["target_sim_name"]:
            mission["target_sim"] = {"name": context["target_sim_name"]}
        if context["target_zone_name"]:
            mission["target_zone"] = {"name": context["target_zone_name"]}
        return mission

    # ── Success Probability ───────────────────────────────

    @classmethod
    async def _calculate_success_probability(
        cls,
        supabase: Client,
        body: OperativeDeploy,
        source_simulation_id: UUID,
        admin_supabase: Client | None = None,
    ) -> float:
        """Calculate mission success probability.

        Formula:
          base = 0.55
          + agent_aptitude x 0.03
          - target_zone_security x 0.05
          - min(0.15, guardian_count x 0.06)
          + embassy_effectiveness x 0.15
          + resonance_pressure (0.00 to +0.04)
          + resonance_operative_mod (-0.04 to +0.04)
          + attacker_pressure_penalty (-0.04 to 0.00)
          Clamped to [0.05, 0.95]

        Aptitude range 3-9 -> contribution +0.09 to +0.27 (18pp swing).
        """
        base = 0.55

        # Agent aptitude for this operative type (replaces qualification)
        aptitude = await AptitudeService.get_aptitude_for_operative(
            supabase, body.agent_id, body.operative_type
        )

        # Admin client for cross-sim reads (target zones/guardians/embassies
        # may be in a game instance the user's JWT can't access via RLS)
        admin = admin_supabase or supabase

        # Target zone security
        zone_security = 5.0  # default moderate
        if body.target_zone_id:
            zone_resp = (
                admin.table("zones")
                .select("security_level")
                .eq("id", str(body.target_zone_id))
                .maybe_single()
                .execute()
            )
            if zone_resp.data:
                sec_level = zone_resp.data.get("security_level", "moderate")
                zone_security = SECURITY_LEVEL_MAP.get(sec_level, 5.0)

        # Guardian count in target simulation (guardians defend their own sim)
        guardian_count = 0
        if body.target_simulation_id:
            guardians_resp = (
                admin.table("operative_missions")
                .select("id")
                .eq("operative_type", "guardian")
                .eq("source_simulation_id", str(body.target_simulation_id))
                .in_("status", ["active"])
                .execute()
            )
            guardian_count = len(guardians_resp.data or [])

        # Embassy effectiveness -- check for active infiltration penalty
        embassy_eff = 0.5
        if body.embassy_id:
            emb_resp = (
                admin.table("embassies")
                .select("id, infiltration_penalty, infiltration_penalty_expires_at")
                .eq("id", str(body.embassy_id))
                .maybe_single()
                .execute()
            )
            if emb_resp.data:
                base_eff = 0.6
                penalty = float(emb_resp.data.get("infiltration_penalty") or 0)
                expires_at = emb_resp.data.get("infiltration_penalty_expires_at")
                if penalty > 0 and expires_at:
                    if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) > datetime.now(UTC):
                        base_eff *= (1.0 - penalty)
                    else:
                        # Penalty expired -- clear it lazily
                        admin.table("embassies").update({
                            "infiltration_penalty": 0,
                            "infiltration_penalty_expires_at": None,
                        }).eq("id", str(body.embassy_id)).execute()
                embassy_eff = base_eff

        # Guardian penalty: -0.06 per guardian, capped at -0.15
        guardian_penalty = min(0.15, guardian_count * 0.06)

        # Resonance modifiers: zone pressure + archetype alignment + attacker penalty
        resonance_pressure = 0.0
        resonance_operative_mod = 0.0
        attacker_pressure_penalty = 0.0
        if body.target_simulation_id:
            resonance_pressure = await cls._get_target_zone_pressure(
                admin, str(body.target_simulation_id), body.target_zone_id
            )
            resonance_operative_mod = await cls._get_resonance_operative_modifier(
                admin, str(body.target_simulation_id), body.operative_type
            )
            # Attacker's own instability reduces mission effectiveness
            attacker_pressure_penalty = await cls._get_attacker_pressure_penalty(
                admin, str(source_simulation_id)
            )

        # ── Heartbeat integration: convergence operative modifiers ──
        convergence_mod = 0.0
        try:
            if body.target_simulation_id:
                convergences = (
                    admin.table("narrative_arcs")
                    .select("id, primary_archetype, secondary_archetype")
                    .eq("simulation_id", str(body.target_simulation_id))
                    .eq("arc_type", "convergence")
                    .in_("status", ["active", "climax"])
                    .execute()
                ).data or []

                if convergences:
                    # Load convergence pairs config
                    pairs_row = (
                        admin.table("platform_settings")
                        .select("setting_value")
                        .eq("setting_key", "heartbeat_convergence_pairs")
                        .limit(1)
                        .execute()
                    ).data
                    if pairs_row:
                        import json
                        pairs = pairs_row[0]["setting_value"]
                        if isinstance(pairs, str):
                            pairs = json.loads(pairs)

                        for conv in convergences:
                            a = conv.get("primary_archetype", "")
                            b = conv.get("secondary_archetype", "")
                            pair_key = f"{a}+{b}"
                            pair_data = pairs.get(pair_key) or pairs.get(f"{b}+{a}")
                            if pair_data:
                                effects = pair_data.get("effects", {})
                                op_type = body.operative_type
                                if op_type in effects:
                                    convergence_mod += float(effects[op_type])
        except Exception:
            logger.debug("Convergence modifiers unavailable (tables may not exist yet)")

        # ── Agent autonomy: mood affects operative effectiveness ──
        mood_modifier = 0.0
        try:
            mood_resp = (
                supabase.table("agent_mood")
                .select("mood_score, stress_level")
                .eq("agent_id", str(body.agent_id))
                .maybe_single()
                .execute()
            )
            if mood_resp.data:
                mood_score = mood_resp.data.get("mood_score", 0)
                stress_level = mood_resp.data.get("stress_level", 0)
                # High mood: +0.03 (confident operative)
                if mood_score > 50:
                    mood_modifier = 0.03
                # Low mood: -0.03 (distracted operative)
                elif mood_score < -50:
                    mood_modifier = -0.03
                # High stress: additional -0.03 (near breakdown)
                if stress_level > 500:
                    mood_modifier -= 0.03
        except Exception:
            logger.debug("Agent mood data unavailable for operative calculation")

        probability = (
            base
            + aptitude * 0.03
            - zone_security * 0.05
            - guardian_penalty
            + embassy_eff * 0.15
            + resonance_pressure
            + resonance_operative_mod
            + attacker_pressure_penalty
            + convergence_mod
            + mood_modifier
        )

        return max(0.05, min(0.95, probability))

    # ── Resonance Helpers ─────────────────────────────────

    @staticmethod
    async def _get_target_zone_pressure(
        admin: Client, target_sim_id: str, target_zone_id: UUID | None = None
    ) -> float:
        """Get zone pressure modifier: pressured zones are easier to infiltrate.

        Uses Postgres ``fn_target_zone_pressure`` (migration 078).
        Returns +0.00 to +0.04 (pressure * cap).
        """
        try:
            result = admin.rpc(
                "fn_target_zone_pressure",
                {"p_simulation_id": target_sim_id, "p_zone_id": str(target_zone_id) if target_zone_id else None},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except Exception:
            logger.debug("Zone pressure lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    @staticmethod
    async def _get_resonance_operative_modifier(
        admin: Client, target_sim_id: str, operative_type: str
    ) -> float:
        """Get net resonance archetype modifier for an operative type.

        Uses Postgres ``fn_resonance_operative_modifier`` (migration 078).
        Returns clamped [-0.04, +0.04] based on active resonances.
        Subsiding resonances apply at 50% strength.
        """
        try:
            result = admin.rpc(
                "fn_resonance_operative_modifier",
                {"p_simulation_id": target_sim_id, "p_operative_type": operative_type},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except Exception:
            logger.debug("Resonance operative modifier lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    @staticmethod
    async def _get_attacker_pressure_penalty(
        admin: Client, source_sim_id: str
    ) -> float:
        """Get attacker's own pressure penalty: own instability hurts outbound ops.

        Uses Postgres ``fn_attacker_pressure_penalty`` (migration 078).
        Returns -0.04 to 0.00 (defender compensation).
        """
        try:
            result = admin.rpc(
                "fn_attacker_pressure_penalty",
                {"p_simulation_id": source_sim_id},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except Exception:
            logger.debug("Attacker pressure penalty lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    # ── Resolve ───────────────────────────────────────────

    @classmethod
    async def resolve_pending_missions(
        cls,
        supabase: Client,
        epoch_id: UUID,
    ) -> list[dict]:
        """Resolve all missions that have passed their resolves_at time."""
        now = datetime.now(UTC).isoformat()

        # Find missions ready to resolve
        resp = (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active"])
            .lte("resolves_at", now)
            .execute()
        )

        results = []
        for mission in resp.data or []:
            # Skip guardians (permanent)
            if mission["operative_type"] == "guardian":
                continue

            # Advance deploying -> active (migration 148: atomic compare-and-swap)
            if mission["status"] == "deploying":
                use_rpc = PlatformConfigService.get(supabase, "use_atomic_game_rpcs", False)
                if use_rpc:
                    supabase.rpc("fn_transition_mission_status", {
                        "p_mission_id": mission["id"],
                        "p_from_status": "deploying",
                        "p_to_status": "active",
                    }).execute()
                else:
                    supabase.table("operative_missions").update(
                        {"status": "active"}
                    ).eq("id", mission["id"]).execute()
                continue

            # Resolve active missions
            result = await cls._resolve_mission(supabase, mission)
            results.append(result)

        return results

    @classmethod
    async def _resolve_mission(cls, supabase: Client, mission: dict) -> dict:
        """Resolve a single mission -- roll for success/failure."""
        success_prob = float(mission.get("success_probability") or 0.5)
        roll = secrets.SystemRandom().random()

        if roll <= success_prob:
            # Success
            outcome = "success"
            final_status = "success"
            mission_result = await cls._apply_success_effect(supabase, mission)
        else:
            # Failure -- check for detection
            detection_roll = secrets.SystemRandom().random()
            if detection_roll > success_prob:
                outcome = "detected"
                final_status = "detected"
                mission_result = {"outcome": "detected", "narrative": "The operative was detected."}
            else:
                outcome = "failed"
                final_status = "failed"
                mission_result = {"outcome": "failed", "narrative": "The mission failed quietly."}

        # Update mission
        update_data = {
            "status": final_status,
            "resolved_at": datetime.now(UTC).isoformat(),
            "mission_result": {**mission_result, "outcome": outcome},
        }
        resp = (
            supabase.table("operative_missions")
            .update(update_data)
            .eq("id", mission["id"])
            .execute()
        )

        # Check for betrayal (same-team attack)
        await cls._check_betrayal(supabase, mission, outcome)

        return resp.data[0] if resp.data else {**mission, **update_data}

    @classmethod
    async def _check_betrayal(
        cls, supabase: Client, mission: dict, outcome: str
    ) -> None:
        """Detect betrayal when a mission targets an ally. On detection,
        dissolve the alliance and apply a -25% diplomatic penalty."""
        if not mission.get("target_simulation_id"):
            return

        source_p = (
            supabase.table("epoch_participants")
            .select("team_id")
            .eq("epoch_id", mission["epoch_id"])
            .eq("simulation_id", mission["source_simulation_id"])
            .maybe_single()
            .execute()
        )
        target_p = (
            supabase.table("epoch_participants")
            .select("team_id")
            .eq("epoch_id", mission["epoch_id"])
            .eq("simulation_id", mission["target_simulation_id"])
            .maybe_single()
            .execute()
        )

        source_team = source_p.data.get("team_id") if source_p.data else None
        target_team = target_p.data.get("team_id") if target_p.data else None

        if not (source_team and target_team and source_team == target_team):
            return

        is_detected = outcome in ("detected", "captured")

        # Fetch epoch for cycle number
        epoch_resp = (
            supabase.table("game_epochs")
            .select("current_cycle")
            .eq("id", mission["epoch_id"])
            .maybe_single()
            .execute()
        )
        cycle = epoch_resp.data.get("current_cycle", 1) if epoch_resp.data else 1

        await BattleLogService.log_betrayal(
            supabase,
            UUID(mission["epoch_id"]),
            cycle,
            UUID(mission["source_simulation_id"]),
            UUID(mission["target_simulation_id"]),
            is_detected,
        )

        if is_detected:
            # Dissolve alliance -- remove all members from team
            supabase.table("epoch_participants").update(
                {"team_id": None}
            ).eq("epoch_id", mission["epoch_id"]).eq(
                "team_id", source_team
            ).execute()

            # Apply -25% diplomatic penalty to betrayer
            supabase.table("epoch_participants").update(
                {"betrayal_penalty": 0.25}
            ).eq("epoch_id", mission["epoch_id"]).eq(
                "simulation_id", mission["source_simulation_id"]
            ).execute()

            logger.info(
                "Betrayal detected — alliance dissolved, penalty applied",
                extra={
                    "source_simulation_id": mission["source_simulation_id"],
                    "target_simulation_id": mission["target_simulation_id"],
                },
            )

    # ── Per-type success effect handlers ─────────────────

    _EFFECT_DISPATCH: dict[str, str] = {
        "spy": "_apply_spy_effect",
        "saboteur": "_apply_saboteur_effect",
        "propagandist": "_apply_propagandist_effect",
        "assassin": "_apply_assassin_effect",
        "infiltrator": "_apply_infiltrator_effect",
    }

    @classmethod
    async def _apply_success_effect(cls, supabase: Client, mission: dict) -> dict:
        """Apply the mechanical effect of a successful mission.

        Dispatches to per-operative-type handler methods.
        """
        handler_name = cls._EFFECT_DISPATCH.get(mission["operative_type"])
        if handler_name:
            handler = getattr(cls, handler_name)
            return await handler(supabase, mission)
        return {"outcome": "success", "narrative": "Mission completed."}

    @classmethod
    async def _apply_spy_effect(cls, supabase: Client, mission: dict) -> dict:
        """Spy: gather intel on target simulation (zone security + guardian count)."""
        target_sim_id = mission.get("target_simulation_id")
        intel = {}
        if target_sim_id:
            zones_resp = (
                supabase.table("zones")
                .select("name, security_level")
                .eq("simulation_id", target_sim_id)
                .execute()
            )
            guardian_resp = (
                supabase.table("operative_missions")
                .select("id", count="exact")
                .eq("operative_type", "guardian")
                .eq("source_simulation_id", target_sim_id)
                .eq("status", "active")
                .execute()
            )
            zones_data = zones_resp.data or []
            zone_levels = [z["security_level"] for z in zones_data]
            zone_details = [
                {"name": z["name"], "security_level": z["security_level"]}
                for z in zones_data
            ]
            guardian_count = guardian_resp.count or 0
            intel: dict = {
                "zone_security": zone_levels,
                "zone_details": zone_details,
                "guardian_count": guardian_count,
            }

            # Check for zone fortifications in target simulation
            fort_resp = (
                supabase.table("zone_fortifications")
                .select("zone_id, security_bonus, expires_at_cycle")
                .eq("epoch_id", mission["epoch_id"])
                .eq("source_simulation_id", target_sim_id)
                .execute()
            )
            if fort_resp.data:
                # Enrich with zone names
                fort_zone_ids = [f["zone_id"] for f in fort_resp.data]
                zone_names_resp = (
                    supabase.table("zones")
                    .select("id, name")
                    .in_("id", fort_zone_ids)
                    .execute()
                )
                zone_name_map = {z["id"]: z["name"] for z in (zone_names_resp.data or [])}
                intel["fortifications"] = [
                    {
                        "zone_id": f["zone_id"],
                        "zone_name": zone_name_map.get(f["zone_id"], "Unknown"),
                        "security_bonus": f["security_bonus"],
                        "expires_at_cycle": f["expires_at_cycle"],
                    }
                    for f in fort_resp.data
                ]

            epoch_resp = (
                supabase.table("game_epochs")
                .select("current_cycle")
                .eq("id", mission["epoch_id"])
                .maybe_single()
                .execute()
            )
            cycle = epoch_resp.data.get("current_cycle", 1) if epoch_resp.data else 1

            await BattleLogService.log_event(
                supabase,
                UUID(mission["epoch_id"]),
                cycle,
                "intel_report",
                f"Spy intel: {guardian_count} guardians, "
                f"zones: {', '.join(f'{z['name']}: {z['security_level']}' for z in zone_details)}",
                source_simulation_id=UUID(mission["source_simulation_id"]),
                target_simulation_id=UUID(target_sim_id),
                mission_id=UUID(mission["id"]),
                is_public=False,
                metadata=intel,
            )

        return {
            "outcome": "success",
            "narrative": "Intelligence gathered successfully.",
            "intel_gathered": True,
            "intel": intel,
        }

    @classmethod
    async def _apply_saboteur_effect(cls, supabase: Client, mission: dict) -> dict:
        """Saboteur: degrade building condition + downgrade random zone security."""
        result: dict = {"outcome": "success"}

        if mission.get("target_entity_id"):
            use_rpc = PlatformConfigService.get(supabase, "use_atomic_game_rpcs", False)
            if use_rpc:
                # Atomic building degradation (migration 148)
                rpc_result = supabase.rpc("fn_degrade_building", {
                    "p_building_id": mission["target_entity_id"],
                }).execute()
                rpc_data = rpc_result.data or {}
                if rpc_data.get("changed"):
                    result["damage_dealt"] = {
                        "building_id": mission["target_entity_id"],
                        "old_condition": rpc_data["old_condition"],
                        "new_condition": rpc_data["new_condition"],
                    }
                elif rpc_data.get("old_condition"):
                    result["damage_dealt"] = {
                        "building_id": mission["target_entity_id"],
                        "old_condition": rpc_data["old_condition"],
                        "new_condition": rpc_data["old_condition"],
                    }
            else:
                building_resp = (
                    supabase.table("buildings")
                    .select("id, building_condition")
                    .eq("id", mission["target_entity_id"])
                    .single()
                    .execute()
                )
                if building_resp.data:
                    condition_map = {"good": "moderate", "moderate": "poor", "poor": "ruined"}
                    old_cond = building_resp.data["building_condition"]
                    new_cond = condition_map.get(old_cond, old_cond)
                    if old_cond != new_cond:
                        supabase.table("buildings").update(
                            {"building_condition": new_cond}
                        ).eq("id", mission["target_entity_id"]).execute()
                    result["damage_dealt"] = {
                        "building_id": mission["target_entity_id"],
                        "old_condition": old_cond,
                        "new_condition": new_cond,
                    }

        target_sim_id = mission.get("target_simulation_id")
        if target_sim_id:
            # Always fetch zones (needed for zone selection + crisis event labeling)
            zones_resp = (
                supabase.table("zones")
                .select("id, name, security_level")
                .eq("simulation_id", target_sim_id)
                .execute()
            )
            if zones_resp.data:
                target_zone = secrets.SystemRandom().choice(zones_resp.data)
                use_rpc = PlatformConfigService.get(supabase, "use_atomic_game_rpcs", False)
                if use_rpc:
                    # Atomic zone security downgrade (migration 148)
                    rpc_result = supabase.rpc("fn_downgrade_zone_security", {
                        "p_zone_id": target_zone["id"],
                        "p_tiers_down": 1,
                    }).execute()
                    rpc_data = rpc_result.data or {}
                    result["zone_downgraded"] = {
                        "zone_id": target_zone["id"],
                        "old_level": rpc_data.get("old_level", target_zone["security_level"]),
                        "new_level": rpc_data.get("new_level", target_zone["security_level"]),
                    }
                else:
                    old_level = target_zone["security_level"]
                    new_level = _downgrade_security(old_level)
                    if old_level != new_level:
                        supabase.table("zones").update(
                            {"security_level": new_level}
                        ).eq("id", target_zone["id"]).execute()
                    result["zone_downgraded"] = {
                        "zone_id": target_zone["id"],
                        "old_level": old_level,
                        "new_level": new_level,
                    }

        # Generate crisis event from sabotage (feeds event->pressure->cascade pipeline)
        # Diminishing returns: impact decreases with existing active sabotage events
        if target_sim_id:
            try:
                # supabase is already admin client (from resolve_pending_missions)

                # Check existing active sabotage crisis events for this simulation
                existing_resp = (
                    supabase.table("events")
                    .select("id", count="exact")
                    .eq("simulation_id", target_sim_id)
                    .eq("data_source", "sabotage")
                    .eq("event_status", "active")
                    .execute()
                )
                existing_count = existing_resp.count or 0

                # Skip event creation if 3+ active sabotage events (saturation)
                if existing_count < 3:
                    zone_name_label = "Unknown District"
                    sabotaged_zone = result.get("zone_downgraded", {})
                    if sabotaged_zone.get("zone_id") and zones_resp.data:
                        for z in zones_resp.data:
                            if z["id"] == sabotaged_zone["zone_id"]:
                                zone_name_label = z.get("name", zone_name_label)
                                break

                    # Diminishing impact: 3 -> 2 -> 1 as more events stack
                    impact_level = max(1, 3 - existing_count)

                    event_data = {
                        "simulation_id": target_sim_id,
                        "title": f"Infrastructure Sabotage — {zone_name_label}",
                        "event_type": "crisis",
                        "impact_level": impact_level,
                        "event_status": "active",
                        "data_source": "sabotage",
                        "metadata": {
                            "mission_id": str(mission["id"]),
                            "source_simulation_id": str(mission["source_simulation_id"]),
                        },
                    }
                    supabase.table("events").insert(event_data).execute()
                    result["event_created"] = True
                else:
                    result["event_saturated"] = True
            except Exception:
                logger.debug("Sabotage crisis event creation failed", exc_info=True)

        narrative_parts = ["Sabotage successful."]
        if "damage_dealt" in result:
            d = result["damage_dealt"]
            narrative_parts.append(f"Building degraded: {d['old_condition']} → {d['new_condition']}.")
        if "zone_downgraded" in result:
            z = result["zone_downgraded"]
            narrative_parts.append(f"Zone security compromised: {z['old_level']} → {z['new_level']}.")
        result["narrative"] = " ".join(narrative_parts)
        return result

    @classmethod
    async def _apply_propagandist_effect(cls, supabase: Client, mission: dict) -> dict:
        """Propagandist: create destabilizing event in target simulation."""
        # supabase is already admin client (from resolve_pending_missions)
        target_sim = mission["target_simulation_id"]
        event_data = {
            "simulation_id": target_sim,
            "title": "Propaganda Campaign — Foreign Influence Detected",
            "description": "Morale undermined by external propaganda operations.",
            "event_type": "social",
            "impact_level": secrets.SystemRandom().randint(3, 5),
            "data_source": "propagandist",
            "metadata": {
                "mission_id": str(mission["id"]),
                "source_simulation_id": str(mission["source_simulation_id"]),
                "operative_type": "propagandist",
            },
        }
        supabase.table("events").insert(event_data).execute()

        return {
            "outcome": "success",
            "narrative": "Propaganda campaign succeeded. Target population's morale undermined.",
            "score_awarded": True,
            "event_created": True,
        }

    @classmethod
    async def _apply_assassin_effect(cls, supabase: Client, mission: dict) -> dict:
        """Assassin: weaken agent relationships + block ambassador status for 3 cycles."""
        if not mission.get("target_entity_id"):
            return {"outcome": "success", "narrative": "Mission completed."}

        use_rpc = PlatformConfigService.get(supabase, "use_atomic_game_rpcs", False)
        if use_rpc:
            # Atomic batch relationship weakening (migration 148)
            rpc_result = supabase.rpc("fn_weaken_relationships", {
                "p_agent_id": mission["target_entity_id"],
                "p_delta": 2,
            }).execute()
            relationships_affected = rpc_result.data or 0
        else:
            rel_resp = (
                supabase.table("agent_relationships")
                .select("id, intensity")
                .or_(
                    f"source_agent_id.eq.{mission['target_entity_id']},"
                    f"target_agent_id.eq.{mission['target_entity_id']}"
                )
                .execute()
            )
            relationships_affected = len(rel_resp.data or [])
            for rel in rel_resp.data or []:
                new_intensity = max(1, rel["intensity"] - 2)
                supabase.table("agent_relationships").update(
                    {"intensity": new_intensity}
                ).eq("id", rel["id"]).execute()

        epoch_resp = (
            supabase.table("game_epochs")
            .select("config")
            .eq("id", mission["epoch_id"])
            .single()
            .execute()
        )
        config = (epoch_resp.data or {}).get("config", {})
        cycle_hours = config.get("cycle_hours", 8)
        blocked_until = datetime.now(UTC) + timedelta(hours=3 * cycle_hours)
        supabase.table("agents").update(
            {"ambassador_blocked_until": blocked_until.isoformat()}
        ).eq("id", mission["target_entity_id"]).execute()

        return {
            "outcome": "success",
            "narrative": (
                "Assassination successful. Target agent's influence "
                "diminished and ambassador status suspended."
            ),
            "relationships_weakened": relationships_affected,
            "ambassador_blocked_until": blocked_until.isoformat(),
        }

    @classmethod
    async def _apply_infiltrator_effect(cls, supabase: Client, mission: dict) -> dict:
        """Infiltrator: reduce embassy effectiveness by 65% for 3 cycles."""
        if not mission.get("target_entity_id"):
            return {"outcome": "success", "narrative": "Mission completed."}

        epoch_resp = (
            supabase.table("game_epochs")
            .select("config")
            .eq("id", mission["epoch_id"])
            .single()
            .execute()
        )
        config = (epoch_resp.data or {}).get("config", {})
        cycle_hours = config.get("cycle_hours", 8)
        expires_at = datetime.now(UTC) + timedelta(hours=3 * cycle_hours)

        supabase.table("embassies").update({
            "infiltration_penalty": 0.65,
            "infiltration_penalty_expires_at": expires_at.isoformat(),
        }).eq("id", mission["target_entity_id"]).execute()

        return {
            "outcome": "success",
            "narrative": "Embassy infiltrated. Diplomatic effectiveness severely compromised.",
            "intel_gathered": True,
            "target_embassy_id": mission["target_entity_id"],
            "effectiveness_reduced": True,
        }

    # ── Recall ────────────────────────────────────────────

    @classmethod
    async def recall(cls, supabase: Client, mission_id: UUID, simulation_id: UUID | None = None) -> dict:
        """Recall an active operative (returns next cycle, 50% RP refund).

        If simulation_id is provided, verifies the caller owns the source simulation.
        Refunds 50% of the operative's deployment cost (rounded down).
        """
        from backend.services.operative_service import OperativeService

        mission = await OperativeService.get_mission(supabase, mission_id)
        if simulation_id and mission["source_simulation_id"] != str(simulation_id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You can only recall operatives from your own simulation.",
            )

        # Guard: prevent recall on completed/cancelled epochs
        epoch = await EpochService.get(supabase, UUID(mission["epoch_id"]))
        if epoch["status"] in ("completed", "cancelled"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot recall operatives from a completed or cancelled epoch.",
            )

        if mission["status"] not in ("deploying", "active"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot recall mission with status '{mission['status']}'.",
            )

        # Refund 50% of deployment cost (rounded down)
        op_type = mission.get("operative_type", "")
        cost = OPERATIVE_RP_COSTS.get(op_type, 5)
        refund = cost // 2
        if refund > 0:
            epoch_id = UUID(mission["epoch_id"])
            source_sim_id = UUID(mission["source_simulation_id"])
            await EpochService.grant_rp(supabase, epoch_id, source_sim_id, refund)

        resp = (
            supabase.table("operative_missions")
            .update({
                "status": "returning",
                "resolved_at": datetime.now(UTC).isoformat(),
            })
            .eq("id", str(mission_id))
            .execute()
        )
        return resp.data[0] if resp.data else mission

    # ── Counter-Intelligence ──────────────────────────────

    @classmethod
    async def counter_intel_sweep(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """Reveal active enemy operatives in your simulation (costs 4 RP).

        Returns list of detected missions.
        """
        epoch = await EpochService.get(supabase, epoch_id)

        if epoch["status"] not in ("foundation", "competition", "reckoning"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Counter-intel sweep is only available during active phases.",
            )

        if epoch.get("current_cycle", 1) < 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Counter-intel sweep is not available in the first cycle.",
            )

        # Spend 4 RP
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, 4)

        # Find active enemy missions targeting this simulation
        resp = (
            supabase.table("operative_missions")
            .select("*, agents(name)")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", str(simulation_id))
            .in_("status", ["deploying", "active"])
            .execute()
        )

        detected = []
        for mission in resp.data or []:
            # Each detected mission updates to 'detected' status
            supabase.table("operative_missions").update(
                {"status": "detected"}
            ).eq("id", mission["id"]).execute()
            detected.append(mission)

        return detected

    # ── Zone Fortification ─────────────────────────────────

    @classmethod
    async def fortify_zone(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        zone_id: UUID,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Fortify a zone during foundation phase (+1 security tier, hidden, 2 RP).

        - Foundation only
        - Zone must belong to the caller's simulation
        - Max 1 fortification per zone (UNIQUE constraint)
        - Hidden (is_public=False) -- only revealed by enemy spy intel
        """
        epoch = await EpochService.get(supabase, epoch_id)

        if epoch["status"] != "foundation":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Zone fortification is only available during foundation phase.",
            )

        # Verify zone belongs to this simulation
        zone_resp = (
            supabase.table("zones")
            .select("id, name, security_level, simulation_id")
            .eq("id", str(zone_id))
            .single()
            .execute()
        )
        if not zone_resp.data or zone_resp.data["simulation_id"] != str(simulation_id):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Zone does not belong to your simulation.",
            )

        # Duplicate check (UNIQUE constraint would also catch this)
        existing = (
            supabase.table("zone_fortifications")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("zone_id", str(zone_id))
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "This zone is already fortified.",
            )

        # Spend RP
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, FORTIFICATION_RP_COST)

        # Compute expiry cycle
        config = {**epoch.get("config", {})}
        if "foundation_cycles" in config:
            foundation_cycles = config["foundation_cycles"]
        else:
            total_cycles = (config.get("duration_days", 14) * 24) // config.get("cycle_hours", 8)
            foundation_cycles = round(total_cycles * config.get("foundation_pct", 10) / 100)
        expires_at_cycle = foundation_cycles + FORTIFICATION_DURATION_CYCLES

        # Upgrade zone security by 1 tier (admin client — zones RLS requires admin role)
        db = admin_supabase or supabase
        old_level = zone_resp.data["security_level"]
        new_level = _upgrade_security(old_level)
        if old_level != new_level:
            db.table("zones").update(
                {"security_level": new_level}
            ).eq("id", str(zone_id)).execute()

        # Insert fortification record (admin client — game state mutation)
        fort_data = {
            "epoch_id": str(epoch_id),
            "zone_id": str(zone_id),
            "source_simulation_id": str(simulation_id),
            "security_bonus": 1,
            "expires_at_cycle": expires_at_cycle,
        }
        fort_resp = db.table("zone_fortifications").insert(fort_data).execute()

        # Log hidden battle_log event
        cycle = epoch.get("current_cycle", 1)
        try:
            await BattleLogService.log_event(
                supabase,
                epoch_id,
                cycle,
                "zone_fortified",
                f"Zone '{zone_resp.data['name']}' has been fortified.",
                source_simulation_id=simulation_id,
                is_public=False,
                metadata={
                    "zone_id": str(zone_id),
                    "zone_name": zone_resp.data["name"],
                    "old_level": old_level,
                    "new_level": new_level,
                    "expires_at_cycle": expires_at_cycle,
                },
            )
        except Exception:
            logger.debug("Battle log write failed for zone fortification", exc_info=True)

        return fort_resp.data[0] if fort_resp.data else fort_data
