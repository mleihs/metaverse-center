"""Operative mission execution: deploy, resolve, recall, and fortification logic."""

import asyncio
import json
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.epoch import DEFAULT_EPOCH_CONFIG, OperativeDeploy, ResonanceOpType
from backend.services.aptitude_service import AptitudeService
from backend.services.battle_log_service import BattleLogService
from backend.services.constants import (
    FORTIFICATION_DURATION_CYCLES,
    FORTIFICATION_RP_COST,
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    SECURITY_LEVEL_MAP,
)
from backend.services.epoch_service import EpochService
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, conflict, forbidden, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

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
            raise bad_request("Operatives can only be deployed during active epoch phases.")

        # Foundation phase: only guardians and spies allowed
        if epoch["status"] == "foundation" and body.operative_type not in ("guardian", "spy"):
            raise bad_request("Only guardian and spy operatives can be deployed during foundation phase.")

        # Guardians are self-deploy only
        if body.operative_type == "guardian" and body.target_simulation_id is not None:
            raise bad_request("Guardians can only be deployed to your own simulation.")

        # Non-guardians require embassy + target
        if body.operative_type != "guardian":
            if not body.target_simulation_id:
                raise bad_request("Offensive operatives require a target simulation.")
            if not body.embassy_id:
                raise bad_request("Operatives must deploy through an embassy.")
            # Validate embassy exists and is active
            embassy = await (
                supabase.table("embassies").select("id, status").eq("id", str(body.embassy_id)).single().execute()
            )
            if not embassy.data or embassy.data.get("status") != "active":
                raise bad_request("Embassy must be active to deploy operatives.")

        # Check for betrayal (attacking an ally)
        if body.operative_type != "guardian" and body.target_simulation_id:
            source_p = await maybe_single_data(
                supabase.table("epoch_participants")
                .select("team_id")
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(simulation_id))
                .maybe_single()
            )
            target_p = await maybe_single_data(
                supabase.table("epoch_participants")
                .select("team_id")
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(body.target_simulation_id))
                .maybe_single()
            )
            source_team = source_p.get("team_id") if source_p else None
            target_team = target_p.get("team_id") if target_p else None

            if source_team and target_team and source_team == target_team:
                config = epoch.get("config", {})
                if not config.get("allow_betrayal", True):
                    raise bad_request("Betrayal is disabled in this epoch.")

        # Validate agent belongs to simulation
        agent = await (
            supabase.table("agents")
            .select("id, simulation_id, name")
            .eq("id", str(body.agent_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not agent.data:
            raise not_found(detail="Agent not found in this simulation.")

        # Check agent isn't already deployed
        existing = await (
            supabase.table("operative_missions")
            .select("id")
            .eq("agent_id", str(body.agent_id))
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active", "returning"])
            .execute()
        )
        if existing.data:
            raise conflict("This agent is already on an active mission.")

        config = {**DEFAULT_EPOCH_CONFIG, **epoch.get("config", {})}

        # Check RP cost (resonance ops add extra RP cost)
        cost = OPERATIVE_RP_COSTS.get(body.operative_type, 5)
        if body.resonance_op and body.resonance_op.value == "substrate_tap":
            cost += 2  # Substrate Tap costs +2 RP on top of base
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, cost)

        # Validate resonance op eligibility
        resonance_surge_bonus = 0.0
        if body.resonance_op and body.target_simulation_id and admin_supabase:
            if body.resonance_op == ResonanceOpType.SURGE_RIDING:
                try:
                    elig_resp = await admin_supabase.rpc(
                        "fn_resonance_surge_eligible",
                        {"p_simulation_id": str(body.target_simulation_id), "p_operative_type": body.operative_type},
                    ).execute()
                    if elig_resp.data:
                        resonance_surge_bonus = 0.08
                    else:
                        logger.warning(
                            "Surge Riding denied: %s not aligned with active resonance in %s",
                            body.operative_type,
                            body.target_simulation_id,
                        )
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning("Surge eligibility check failed, proceeding without bonus")

        # Calculate success probability (uses configurable balance params)
        success_prob = await cls._calculate_success_probability(
            supabase,
            body,
            simulation_id,
            admin_supabase=admin_supabase,
            epoch_config=config,
            resonance_surge_bonus=resonance_surge_bonus,
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
            "resonance_op": body.resonance_op.value if body.resonance_op else None,
        }

        resp = await supabase.table("operative_missions").insert(mission_data).execute()
        if not resp.data:
            raise server_error("Failed to create operative mission.")

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
                sim_data = await maybe_single_data(
                    supabase.table("simulations")
                    .select("name")
                    .eq("id", str(body.target_simulation_id))
                    .maybe_single()
                )
                if sim_data:
                    context["target_sim_name"] = sim_data["name"]
            if body.target_zone_id:
                zone_data = await maybe_single_data(
                    supabase.table("zones").select("name").eq("id", str(body.target_zone_id)).maybe_single()
                )
                if zone_data:
                    context["target_zone_name"] = zone_data["name"]
        except (PostgrestAPIError, httpx.HTTPError):
            logger.debug("Context lookup failed", exc_info=True)

        # Log deployment to battle log with pre-fetched context
        try:
            await BattleLogService.log_operative_deployed(
                supabase,
                epoch_id,
                epoch.get("current_cycle", 1),
                mission,
                context=context,
            )
        except (PostgrestAPIError, httpx.HTTPError):
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
        *,
        epoch_config: dict | None = None,
        resonance_surge_bonus: float = 0.0,
    ) -> float:
        """Calculate mission success probability using configurable parameters.

        All balance values read from epoch_config (EpochConfig fields) with
        sensible fallbacks matching the canonical defaults.

        Formula:
          base_success_probability
          + agent_aptitude x aptitude_modifier_pp
          - target_zone_security x 0.05
          - min(guardian_defense_cap_pp, guardian_count x guardian_per_unit_pp)
          + embassy_effectiveness x embassy_bonus_pp
          + resonance_pressure (0.00 to +0.04)
          + resonance_operative_mod (-0.04 to +0.04)
          + attacker_pressure_penalty (-0.04 to 0.00)
          + convergence_mod + mood_modifier
          Clamped to [probability_floor, probability_ceiling]
        """
        cfg = epoch_config or {}
        base = cfg.get("base_success_probability", 0.55)

        # Admin client for cross-sim reads (target zones/guardians/embassies
        # may be in a game instance the user's JWT can't access via RLS)
        admin = admin_supabase or supabase

        # ── Batch 1: Independent data lookups (parallel) ─────────
        # Aptitude, zone security, guardian count, embassy — all independent.
        # Running concurrently cuts latency from ~4 sequential queries to ~1.

        async def _fetch_aptitude() -> int:
            return await AptitudeService.get_aptitude_for_operative(supabase, body.agent_id, body.operative_type)

        async def _fetch_zone_security() -> float:
            if not body.target_zone_id:
                return 5.0  # default moderate
            zone_data = await maybe_single_data(
                admin.table("zones").select("security_level").eq("id", str(body.target_zone_id)).maybe_single()
            )
            if zone_data:
                return SECURITY_LEVEL_MAP.get(zone_data.get("security_level", "moderate"), 5.0)
            return 5.0

        async def _fetch_guardian_count() -> int:
            if not body.target_simulation_id:
                return 0
            guardians_resp = await (
                admin.table("operative_missions")
                .select("id", count="exact")
                .eq("operative_type", "guardian")
                .eq("source_simulation_id", str(body.target_simulation_id))
                .in_("status", ["active"])
                .execute()
            )
            return guardians_resp.count or 0

        async def _fetch_embassy_eff() -> float:
            if not body.embassy_id:
                return 0.5
            emb_data = await maybe_single_data(
                admin.table("embassies")
                .select("id, infiltration_penalty, infiltration_penalty_expires_at")
                .eq("id", str(body.embassy_id))
                .maybe_single()
            )
            if not emb_data:
                return 0.5
            base_eff = 0.6
            penalty = float(emb_data.get("infiltration_penalty") or 0)
            expires_at = emb_data.get("infiltration_penalty_expires_at")
            if penalty > 0 and expires_at:
                if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) > datetime.now(UTC):
                    base_eff *= 1.0 - penalty
                else:
                    # Penalty expired — clear it lazily (fire-and-forget)
                    await admin.table("embassies").update(
                        {"infiltration_penalty": 0, "infiltration_penalty_expires_at": None}
                    ).eq("id", str(body.embassy_id)).execute()
            return base_eff

        aptitude, zone_security, guardian_count, embassy_eff = await asyncio.gather(
            _fetch_aptitude(), _fetch_zone_security(), _fetch_guardian_count(), _fetch_embassy_eff(),
        )

        # Guardian penalty: configurable per-unit and cap
        guardian_cap = cfg.get("guardian_defense_cap_pp", 0.15)
        guardian_per = cfg.get("guardian_per_unit_pp", 0.06)
        guardian_penalty = min(guardian_cap, guardian_count * guardian_per)

        # ── Batch 2: Resonance modifiers (parallel, target-sim dependent) ──
        resonance_pressure = 0.0
        resonance_operative_mod = 0.0
        attacker_pressure_penalty = 0.0
        if body.target_simulation_id:
            resonance_pressure, resonance_operative_mod, attacker_pressure_penalty = await asyncio.gather(
                cls._get_target_zone_pressure(admin, str(body.target_simulation_id), body.target_zone_id),
                cls._get_resonance_operative_modifier(admin, str(body.target_simulation_id), body.operative_type),
                cls._get_attacker_pressure_penalty(admin, str(source_simulation_id)),
            )

        # ── Heartbeat integration: convergence operative modifiers ──
        convergence_mod = 0.0
        try:
            if body.target_simulation_id:
                _resp = await (
                    admin.table("narrative_arcs")
                    .select("id, primary_archetype, secondary_archetype")
                    .eq("simulation_id", str(body.target_simulation_id))
                    .eq("arc_type", "convergence")
                    .in_("status", ["active", "climax"])
                    .execute()
                )
                convergences = extract_list(_resp)

                if convergences:
                    # Load convergence pairs config
                    _resp = await (
                        admin.table("platform_settings")
                        .select("setting_value")
                        .eq("setting_key", "heartbeat_convergence_pairs")
                        .limit(1)
                        .execute()
                    )
                    pairs_row = _resp.data
                    if pairs_row:
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
        except (PostgrestAPIError, httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.debug("Convergence modifiers unavailable (tables may not exist yet)")

        # ── Agent autonomy: mood affects operative effectiveness ──
        mood_modifier = 0.0
        try:
            mood_data = await maybe_single_data(
                supabase.table("agent_mood")
                .select("mood_score, stress_level")
                .eq("agent_id", str(body.agent_id))
                .maybe_single()
            )
            if mood_data:
                mood_score = mood_data.get("mood_score", 0)
                stress_level = mood_data.get("stress_level", 0)
                # High mood: +0.03 (confident operative)
                if mood_score > 50:
                    mood_modifier = 0.03
                # Low mood: -0.03 (distracted operative)
                elif mood_score < -50:
                    mood_modifier = -0.03
                # High stress: additional -0.03 (near breakdown)
                if stress_level > 500:
                    mood_modifier -= 0.03
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.debug("Agent mood data unavailable for operative calculation")

        apt_mod = cfg.get("aptitude_modifier_pp", 0.03)
        emb_bonus = cfg.get("embassy_bonus_pp", 0.15)
        prob_floor = cfg.get("probability_floor", 0.05)
        prob_ceiling = cfg.get("probability_ceiling", 0.95)

        probability = (
            base
            + aptitude * apt_mod
            - zone_security * 0.05
            - guardian_penalty
            + embassy_eff * emb_bonus
            + resonance_pressure
            + resonance_operative_mod
            + attacker_pressure_penalty
            + convergence_mod
            + mood_modifier
            + resonance_surge_bonus  # Surge Riding: +0.08 when exploiting aligned resonance
        )

        return max(prob_floor, min(prob_ceiling, probability))

    # ── Resonance Helpers ─────────────────────────────────

    @staticmethod
    async def _get_target_zone_pressure(admin: Client, target_sim_id: str, target_zone_id: UUID | None = None) -> float:
        """Get zone pressure modifier: pressured zones are easier to infiltrate.

        Uses Postgres ``fn_target_zone_pressure`` (migration 078).
        Returns +0.00 to +0.04 (pressure * cap).
        """
        try:
            result = await admin.rpc(
                "fn_target_zone_pressure",
                {"p_simulation_id": target_sim_id, "p_zone_id": str(target_zone_id) if target_zone_id else None},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except (PostgrestAPIError, httpx.HTTPError, TypeError, ValueError):
            logger.debug("Zone pressure lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    @staticmethod
    async def _get_resonance_operative_modifier(admin: Client, target_sim_id: str, operative_type: str) -> float:
        """Get net resonance archetype modifier for an operative type.

        Uses Postgres ``fn_resonance_operative_modifier`` (migration 078).
        Returns clamped [-0.04, +0.04] based on active resonances.
        Subsiding resonances apply at 50% strength.
        """
        try:
            result = await admin.rpc(
                "fn_resonance_operative_modifier",
                {"p_simulation_id": target_sim_id, "p_operative_type": operative_type},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except (PostgrestAPIError, httpx.HTTPError, TypeError, ValueError):
            logger.debug("Resonance operative modifier lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    @staticmethod
    async def _get_attacker_pressure_penalty(admin: Client, source_sim_id: str) -> float:
        """Get attacker's own pressure penalty: own instability hurts outbound ops.

        Uses Postgres ``fn_attacker_pressure_penalty`` (migration 078).
        Returns -0.04 to 0.00 (defender compensation).
        """
        try:
            result = await admin.rpc(
                "fn_attacker_pressure_penalty",
                {"p_simulation_id": source_sim_id},
            ).execute()
            return float(result.data) if result.data is not None else 0.0
        except (PostgrestAPIError, httpx.HTTPError, TypeError, ValueError):
            logger.debug("Attacker pressure penalty lookup failed, defaulting to 0.0", exc_info=True)
            return 0.0

    # ── Resolve ───────────────────────────────────────────

    @classmethod
    async def resolve_pending_missions(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        epoch_config: dict | None = None,
    ) -> list[dict]:
        """Resolve all missions that have passed their resolves_at time."""
        now = datetime.now(UTC).isoformat()

        # Find missions ready to resolve
        resp = await (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active"])
            .lte("resolves_at", now)
            .execute()
        )

        results = []
        for mission in extract_list(resp):
            # Skip guardians (permanent)
            if mission["operative_type"] == "guardian":
                continue

            # Advance deploying -> active (atomic compare-and-swap, migration 148)
            if mission["status"] == "deploying":
                await supabase.rpc(
                    "fn_transition_mission_status",
                    {
                        "p_mission_id": mission["id"],
                        "p_from_status": "deploying",
                        "p_to_status": "active",
                    },
                ).execute()
                continue

            # Resolve active missions
            result = await cls._resolve_mission(supabase, mission, epoch_config=epoch_config)
            results.append(result)

        return results

    @classmethod
    async def _resolve_mission(
        cls, supabase: Client, mission: dict, *, epoch_config: dict | None = None
    ) -> dict:
        """Resolve a single mission -- roll for success/failure.

        Detection uses a SEPARATE probability from success (configurable via
        ``detection_on_failure`` in EpochConfig). This avoids the old bug where
        a highly skilled operative (high success_prob) was paradoxically MORE
        detectable when failing.
        """
        cfg = epoch_config or {}
        success_prob = float(mission.get("success_probability") or 0.5)
        detection_threshold = cfg.get("detection_on_failure", 0.45)

        roll = secrets.SystemRandom().random()

        res_op = mission.get("resonance_op")

        if roll <= success_prob:
            # Success
            outcome = "success"
            final_status = "success"
            mission_result = await cls._apply_success_effect(supabase, mission)

            # Substrate Tap: atomically steal 1 RP from target on success
            if res_op == "substrate_tap" and mission.get("target_simulation_id"):
                try:
                    transfer_resp = await supabase.rpc(
                        "fn_transfer_rp_atomic",
                        {
                            "p_epoch_id": mission["epoch_id"],
                            "p_from_simulation_id": mission["target_simulation_id"],
                            "p_to_simulation_id": mission["source_simulation_id"],
                            "p_amount": 1,
                        },
                    ).execute()
                    if transfer_resp.data:
                        mission_result["substrate_tap"] = "1 RP stolen from target"
                    else:
                        mission_result["substrate_tap"] = "Target had insufficient RP"
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning("Substrate Tap RP transfer failed (non-fatal)")
        else:
            # Failure — independent detection roll against configurable threshold
            detection_roll = secrets.SystemRandom().random()
            if detection_roll < detection_threshold:
                outcome = "detected"
                final_status = "detected"
                mission_result = {"outcome": "detected", "narrative": "The operative was detected."}
            else:
                outcome = "failed"
                final_status = "failed"
                mission_result = {"outcome": "failed", "narrative": "The mission failed quietly."}

            # Surge Riding failure penalty: double resonance pressure on own zones
            if res_op == "surge_riding" and mission.get("source_simulation_id"):
                mission_result["surge_riding_penalty"] = "Resonance pressure doubled on source zones"
                # The actual pressure doubling is handled by the heartbeat — we flag
                # it here via a tag that the heartbeat Phase 3 can detect.
                try:
                    await supabase.table("resonance_memory").insert({
                        "simulation_id": mission["source_simulation_id"],
                        "resonance_signature": "surge_riding_penalty",
                        "effective_magnitude": 0.5,
                        "was_mitigated": False,
                    }).execute()
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning("Surge Riding penalty recording failed (non-fatal)")

        # Update mission
        update_data = {
            "status": final_status,
            "resolved_at": datetime.now(UTC).isoformat(),
            "mission_result": {**mission_result, "outcome": outcome},
        }
        resp = await supabase.table("operative_missions").update(update_data).eq("id", mission["id"]).execute()
        if not resp.data:
            logger.error("Mission %s update returned empty response", mission["id"])

        # Check for betrayal (same-team attack)
        await cls._check_betrayal(supabase, mission, outcome)

        return resp.data[0] if resp.data else {**mission, **update_data}

    @classmethod
    async def _check_betrayal(cls, supabase: Client, mission: dict, outcome: str) -> None:
        """Detect betrayal when a mission targets an ally. On detection,
        dissolve the alliance and apply a -25% diplomatic penalty."""
        if not mission.get("target_simulation_id"):
            return

        source_p = await maybe_single_data(
            supabase.table("epoch_participants")
            .select("team_id")
            .eq("epoch_id", mission["epoch_id"])
            .eq("simulation_id", mission["source_simulation_id"])
            .maybe_single()
        )
        target_p = await maybe_single_data(
            supabase.table("epoch_participants")
            .select("team_id")
            .eq("epoch_id", mission["epoch_id"])
            .eq("simulation_id", mission["target_simulation_id"])
            .maybe_single()
        )

        source_team = source_p.get("team_id") if source_p else None
        target_team = target_p.get("team_id") if target_p else None

        if not (source_team and target_team and source_team == target_team):
            return

        is_detected = outcome in ("detected", "captured")

        # Fetch epoch for cycle number
        epoch_data = await maybe_single_data(
            supabase.table("game_epochs").select("current_cycle").eq("id", mission["epoch_id"]).maybe_single()
        )
        cycle = epoch_data.get("current_cycle", 1) if epoch_data else 1

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
            await (
                supabase.table("epoch_participants")
                .update({"team_id": None})
                .eq("epoch_id", mission["epoch_id"])
                .eq("team_id", source_team)
                .execute()
            )

            # Apply -25% diplomatic penalty to betrayer
            await (
                supabase.table("epoch_participants")
                .update({"betrayal_penalty": 0.25})
                .eq("epoch_id", mission["epoch_id"])
                .eq("simulation_id", mission["source_simulation_id"])
                .execute()
            )

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
        """Spy: gather intel on target simulation.

        Returns zone security, guardian count, building inventory, and agent
        roster.  The building/agent data enables targeted saboteur and
        assassin follow-up missions (reconnaissance → strike chain).
        """
        target_sim_id = mission.get("target_simulation_id")
        intel = {}
        if target_sim_id:
            zones_resp = await (
                supabase.table("zones").select("id, name, security_level").eq("simulation_id", target_sim_id).execute()
            )
            guardian_resp = await (
                supabase.table("operative_missions")
                .select("id", count="exact")
                .eq("operative_type", "guardian")
                .eq("source_simulation_id", target_sim_id)
                .eq("status", "active")
                .execute()
            )
            buildings_resp = await (
                supabase.table("buildings")
                .select("id, name, building_condition")
                .eq("simulation_id", target_sim_id)
                .execute()
            )
            agents_resp = await supabase.table("agents").select("id, name").eq("simulation_id", target_sim_id).execute()
            zones_data = extract_list(zones_resp)
            zone_levels = [z["security_level"] for z in zones_data]
            zone_details = [
                {"id": z["id"], "name": z["name"], "security_level": z["security_level"]}
                for z in zones_data
            ]
            guardian_count = guardian_resp.count or 0
            buildings_data = extract_list(buildings_resp)
            agents_data = extract_list(agents_resp)
            intel: dict = {
                "zone_security": zone_levels,
                "zone_details": zone_details,
                "guardian_count": guardian_count,
                "building_ids": [b["id"] for b in buildings_data],
                "building_count": len(buildings_data),
                "buildings": [
                    {"id": b["id"], "name": b["name"], "condition": b["building_condition"]} for b in buildings_data
                ],
                "agent_ids": [a["id"] for a in agents_data],
                "agent_count": len(agents_data),
            }

            # Check for zone fortifications in target simulation
            fort_resp = await (
                supabase.table("zone_fortifications")
                .select("zone_id, security_bonus, expires_at_cycle")
                .eq("epoch_id", mission["epoch_id"])
                .eq("source_simulation_id", target_sim_id)
                .execute()
            )
            if fort_resp.data:
                # Enrich with zone names
                fort_zone_ids = [f["zone_id"] for f in fort_resp.data]
                zone_names_resp = await supabase.table("zones").select("id, name").in_("id", fort_zone_ids).execute()
                zone_name_map = {z["id"]: z["name"] for z in (extract_list(zone_names_resp))}
                intel["fortifications"] = [
                    {
                        "zone_id": f["zone_id"],
                        "zone_name": zone_name_map.get(f["zone_id"], "Unknown"),
                        "security_bonus": f["security_bonus"],
                        "expires_at_cycle": f["expires_at_cycle"],
                    }
                    for f in fort_resp.data
                ]

            epoch_data = await maybe_single_data(
                supabase.table("game_epochs")
                .select("current_cycle")
                .eq("id", mission["epoch_id"])
                .maybe_single()
            )
            cycle = epoch_data.get("current_cycle", 1) if epoch_data else 1

            await BattleLogService.log_event(
                supabase,
                UUID(mission["epoch_id"]),
                cycle,
                "intel_report",
                f"Spy intel: {guardian_count} guardians, "
                f"{len(buildings_data)} buildings, {len(agents_data)} agents, "
                f"zones: {', '.join(f'{z["name"]}: {z["security_level"]}' for z in zone_details)}",
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
            # Atomic building degradation (migration 148)
            rpc_result = await supabase.rpc(
                "fn_degrade_building",
                {
                    "p_building_id": mission["target_entity_id"],
                },
            ).execute()
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

        target_sim_id = mission.get("target_simulation_id")
        if target_sim_id:
            # Always fetch zones (needed for zone selection + crisis event labeling)
            zones_resp = await (
                supabase.table("zones").select("id, name, security_level").eq("simulation_id", target_sim_id).execute()
            )
            if zones_resp.data:
                target_zone = secrets.SystemRandom().choice(zones_resp.data)
                # Atomic zone security downgrade (migration 148)
                rpc_result = await supabase.rpc(
                    "fn_downgrade_zone_security",
                    {
                        "p_zone_id": target_zone["id"],
                        "p_tiers_down": 1,
                    },
                ).execute()
                rpc_data = rpc_result.data or {}
                result["zone_downgraded"] = {
                    "zone_id": target_zone["id"],
                    "old_level": rpc_data.get("old_level", target_zone["security_level"]),
                    "new_level": rpc_data.get("new_level", target_zone["security_level"]),
                }

        # Generate crisis event from sabotage (feeds event->pressure->cascade pipeline)
        # Diminishing returns: impact decreases with existing active sabotage events
        if target_sim_id:
            try:
                # supabase is already admin client (from resolve_pending_missions)

                # Check existing active sabotage crisis events for this simulation
                existing_resp = await (
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
                    await supabase.table("events").insert(event_data).execute()
                    result["event_created"] = True
                else:
                    result["event_saturated"] = True
            except Exception:  # noqa: BLE001 — crisis event is supplemental, sabotage effect already applied
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
        event_created = False
        try:
            event_resp = await supabase.table("events").insert(event_data).execute()
            event_created = bool(event_resp.data)
        except (PostgrestAPIError, httpx.HTTPError):
            logger.warning("Propaganda event insert failed", exc_info=True)

        return {
            "outcome": "success",
            "narrative": "Propaganda campaign succeeded. Target population's morale undermined.",
            "score_awarded": True,
            "event_created": event_created,
        }

    @classmethod
    async def _apply_assassin_effect(cls, supabase: Client, mission: dict) -> dict:
        """Assassin: weaken agent relationships + block ambassador status for 3 cycles."""
        if not mission.get("target_entity_id"):
            return {"outcome": "success", "narrative": "Mission completed."}

        # Atomic batch relationship weakening (migration 148)
        rpc_result = await supabase.rpc(
            "fn_weaken_relationships",
            {
                "p_agent_id": mission["target_entity_id"],
                "p_delta": 2,
            },
        ).execute()
        relationships_affected = rpc_result.data or 0

        epoch_resp = await (
            supabase.table("game_epochs").select("config").eq("id", mission["epoch_id"]).single().execute()
        )
        config = (epoch_resp.data or {}).get("config", {})
        cycle_hours = config.get("cycle_hours", 8)
        blocked_until = datetime.now(UTC) + timedelta(hours=3 * cycle_hours)
        await (
            supabase.table("agents")
            .update({"ambassador_blocked_until": blocked_until.isoformat()})
            .eq("id", mission["target_entity_id"])
            .execute()
        )

        return {
            "outcome": "success",
            "narrative": (
                "Assassination successful. Target agent's influence diminished and ambassador status suspended."
            ),
            "relationships_weakened": relationships_affected,
            "ambassador_blocked_until": blocked_until.isoformat(),
        }

    @classmethod
    async def _apply_infiltrator_effect(cls, supabase: Client, mission: dict) -> dict:
        """Infiltrator: reduce embassy effectiveness for 3 cycles.

        Penalty fraction is configurable via ``infiltrator_embassy_penalty``
        in EpochConfig (default 0.65 = 65% effectiveness blocked).
        """
        if not mission.get("target_entity_id"):
            return {"outcome": "success", "narrative": "Mission completed."}

        epoch_resp = await (
            supabase.table("game_epochs").select("config").eq("id", mission["epoch_id"]).single().execute()
        )
        raw_config = (epoch_resp.data or {}).get("config", {})
        config = {**DEFAULT_EPOCH_CONFIG, **raw_config}
        cycle_hours = config.get("cycle_hours", 8)
        penalty = config.get("infiltrator_embassy_penalty", 0.65)
        expires_at = datetime.now(UTC) + timedelta(hours=3 * cycle_hours)

        await (
            supabase.table("embassies")
            .update(
                {
                    "infiltration_penalty": penalty,
                    "infiltration_penalty_expires_at": expires_at.isoformat(),
                }
            )
            .eq("id", mission["target_entity_id"])
            .execute()
        )

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
            raise forbidden("You can only recall operatives from your own simulation.")

        # Guard: prevent recall on completed/cancelled epochs
        epoch = await EpochService.get(supabase, UUID(mission["epoch_id"]))
        if epoch["status"] in ("completed", "cancelled"):
            raise bad_request("Cannot recall operatives from a completed or cancelled epoch.")

        if mission["status"] not in ("deploying", "active"):
            raise bad_request(f"Cannot recall mission with status '{mission['status']}'.")

        # Refund 50% of deployment cost (rounded down)
        op_type = mission.get("operative_type", "")
        cost = OPERATIVE_RP_COSTS.get(op_type, 5)
        refund = cost // 2
        if refund > 0:
            epoch_id = UUID(mission["epoch_id"])
            source_sim_id = UUID(mission["source_simulation_id"])
            await EpochService.grant_rp(supabase, epoch_id, source_sim_id, refund)

        resp = await (
            supabase.table("operative_missions")
            .update(
                {
                    "status": "returning",
                    "resolved_at": datetime.now(UTC).isoformat(),
                }
            )
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
            raise bad_request("Counter-intel sweep is only available during active phases.")

        if epoch.get("current_cycle", 1) < 2:
            raise bad_request("Counter-intel sweep is not available in the first cycle.")

        # Spend 4 RP
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, 4)

        # Find active enemy missions targeting this simulation
        resp = await (
            supabase.table("operative_missions")
            .select("*, agents(name)")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", str(simulation_id))
            .in_("status", ["deploying", "active"])
            .execute()
        )

        cycle_number = epoch.get("current_cycle", 1)
        detected = []
        for mission in extract_list(resp):
            try:
                update_resp = await (
                    supabase.table("operative_missions")
                    .update({"status": "detected"})
                    .eq("id", mission["id"])
                    .execute()
                )
                if update_resp.data:
                    detected.append(mission)
                else:
                    logger.warning("Failed to mark mission %s as detected", mission["id"])
            except (PostgrestAPIError, httpx.HTTPError):
                logger.warning("DB error marking mission %s as detected", mission["id"], exc_info=True)

        # Log counter_intel events to battle_log for each detected mission.
        # source = sweeping player (sees results), target = attacker origin sim.
        for mission in detected:
            op_type = mission.get("operative_type", "unknown")
            agent_name = (
                mission.get("agents", {}).get("name")
                if isinstance(mission.get("agents"), dict)
                else None
            )
            try:
                await BattleLogService.log_event(
                    supabase,
                    epoch_id,
                    cycle_number,
                    "counter_intel",
                    f"Counter-intel sweep detected a {op_type}.",
                    source_simulation_id=simulation_id,
                    target_simulation_id=(
                        UUID(mission["source_simulation_id"])
                        if mission.get("source_simulation_id")
                        else None
                    ),
                    mission_id=UUID(mission["id"]),
                    is_public=False,
                    metadata={
                        "operative_type": op_type,
                        "agent_name": agent_name,
                    },
                )
            except (PostgrestAPIError, httpx.HTTPError):
                logger.debug("Battle log write failed for counter_intel event", exc_info=True)

        # If no threats found, still log the sweep attempt
        if not detected:
            try:
                await BattleLogService.log_event(
                    supabase,
                    epoch_id,
                    cycle_number,
                    "counter_intel",
                    "Counter-intel sweep complete. No threats detected.",
                    source_simulation_id=simulation_id,
                    is_public=False,
                    metadata={"detected_count": 0},
                )
            except (PostgrestAPIError, httpx.HTTPError):
                logger.debug("Battle log write failed for empty counter_intel", exc_info=True)

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

        Atomic via Postgres ``fn_fortify_zone_atomic`` (migration 221). The RPC
        locks the zone row, validates ownership, checks no existing fortification,
        deducts RP (compare-and-swap), upgrades ``security_level`` one tier, and
        inserts the ``zone_fortifications`` row in one transaction — closing the
        two TOCTOU windows the prior Python sequence had (duplicate-check +
        read-upgrade-write).

        - Foundation only
        - Zone must belong to the caller's simulation
        - Max 1 fortification per zone (enforced atomically inside the RPC)
        - Hidden (is_public=False in battle_log) — only revealed by enemy spy intel
        """
        epoch = await EpochService.get(supabase, epoch_id)

        if epoch["status"] != "foundation":
            raise bad_request("Zone fortification is only available during foundation phase.")

        # Expiry cycle computation stays in the application layer — config
        # interpretation depends on epoch.config shape which lives in Python.
        config = {**epoch.get("config", {})}
        if "foundation_cycles" in config:
            foundation_cycles = config["foundation_cycles"]
        else:
            total_cycles = (config.get("duration_days", 14) * 24) // config.get("cycle_hours", 8)
            foundation_cycles = round(total_cycles * config.get("foundation_pct", 10) / 100)
        expires_at_cycle = foundation_cycles + FORTIFICATION_DURATION_CYCLES

        # Atomic fortification — zone-admin mutations require admin client
        # (zones RLS requires admin role for security_level writes).
        db = admin_supabase or supabase
        rpc_resp = await db.rpc(
            "fn_fortify_zone_atomic",
            {
                "p_epoch_id": str(epoch_id),
                "p_simulation_id": str(simulation_id),
                "p_zone_id": str(zone_id),
                "p_rp_cost": FORTIFICATION_RP_COST,
                "p_expires_at_cycle": expires_at_cycle,
            },
        ).execute()

        result = rpc_resp.data or {}
        error = result.get("error")
        if error == "zone_not_found":
            raise not_found(detail="Zone not found.")
        if error == "zone_wrong_simulation":
            raise bad_request("Zone does not belong to your simulation.")
        if error == "already_fortified":
            raise bad_request("This zone is already fortified.")
        if error == "participant_not_found":
            raise forbidden("You are not a participant in this epoch.")
        if error == "insufficient_rp":
            raise bad_request(f"Not enough RP to fortify (need {FORTIFICATION_RP_COST}).")

        fortification_id = result.get("fortification_id")
        if not fortification_id:
            raise server_error("Zone fortification failed: unexpected RPC response.")

        # Hidden battle_log event — side-effect outside atomicity boundary.
        # Fetch zone name for the narrative; best-effort logging (a failed
        # log must not roll back the already-committed fortification state).
        zone_resp = await (
            supabase.table("zones").select("name").eq("id", str(zone_id)).single().execute()
        )
        zone_name = zone_resp.data.get("name") if zone_resp.data else ""

        cycle = epoch.get("current_cycle", 1)
        try:
            await BattleLogService.log_event(
                supabase,
                epoch_id,
                cycle,
                "zone_fortified",
                f"Zone '{zone_name}' has been fortified.",
                source_simulation_id=simulation_id,
                is_public=False,
                metadata={
                    "zone_id": str(zone_id),
                    "zone_name": zone_name,
                    "old_level": result.get("old_security_level"),
                    "new_level": result.get("new_security_level"),
                    "expires_at_cycle": expires_at_cycle,
                },
            )
        except (PostgrestAPIError, httpx.HTTPError):
            logger.debug("Battle log write failed for zone fortification", exc_info=True)

        return {
            "id": fortification_id,
            "epoch_id": str(epoch_id),
            "zone_id": str(zone_id),
            "source_simulation_id": str(simulation_id),
            "security_bonus": 1,
            "expires_at_cycle": expires_at_cycle,
            "cost_rp": FORTIFICATION_RP_COST,
        }
