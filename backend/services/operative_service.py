"""Operative deployment, resolution, and recall logic."""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import OperativeDeploy
from backend.services.battle_log_service import BattleLogService
from backend.services.epoch_service import OPERATIVE_RP_COSTS, EpochService
from supabase import Client

logger = logging.getLogger(__name__)

# Security level → numeric value for success probability
SECURITY_LEVEL_MAP: dict[str, float] = {
    "fortress": 10.0,
    "maximum": 10.0,
    "high": 8.5,
    "guarded": 7.0,
    "moderate": 5.5,
    "low": 4.0,
    "lawless": 2.0,
    "contested": 3.0,
}

# Deploy time in cycles per operative type
DEPLOY_CYCLES: dict[str, int] = {
    "spy": 0,
    "saboteur": 1,
    "propagandist": 1,
    "assassin": 2,
    "guardian": 0,
    "infiltrator": 2,
}

# Mission duration in cycles per operative type
MISSION_DURATION_CYCLES: dict[str, int] = {
    "spy": 3,
    "saboteur": 1,
    "propagandist": 2,
    "assassin": 1,
    "guardian": 0,  # permanent while deployed
    "infiltrator": 3,
}

# Score value for successful missions
MISSION_SCORE_VALUES: dict[str, int] = {
    "spy": 2,
    "saboteur": 5,
    "propagandist": 3,
    "assassin": 8,
    "infiltrator": 4,
}

# Detection penalty for failed missions
DETECTION_PENALTY = 3


class OperativeService:
    """Service for deploying, resolving, and recalling operatives."""

    # ── Deploy ─────────────────────────────────────────────

    @classmethod
    async def deploy(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        body: OperativeDeploy,
    ) -> dict:
        """Deploy an operative agent on a mission."""
        epoch = await EpochService.get(supabase, epoch_id)

        # Phase restrictions
        if epoch["status"] not in ("foundation", "competition", "reckoning"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Operatives can only be deployed during active epoch phases.",
            )

        # Foundation phase: only guardians allowed
        if epoch["status"] == "foundation" and body.operative_type != "guardian":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Only guardian operatives can be deployed during foundation phase.",
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
        )

        # Calculate resolve time
        config = epoch.get("config", {})
        cycle_hours = config.get("cycle_hours", 8)
        deploy_cycles = DEPLOY_CYCLES.get(body.operative_type, 1)
        mission_cycles = MISSION_DURATION_CYCLES.get(body.operative_type, 1)
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
        }

        resp = supabase.table("operative_missions").insert(mission_data).execute()
        if not resp.data:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Failed to create operative mission.",
            )
        return resp.data[0]

    # ── Success Probability ───────────────────────────────

    @classmethod
    async def _calculate_success_probability(
        cls,
        supabase: Client,
        body: OperativeDeploy,
        source_simulation_id: UUID,
    ) -> float:
        """Calculate mission success probability.

        Formula:
          base = 0.5
          + operative_qualification × 0.05
          - target_zone_security × 0.05
          - guardian_count × 0.20
          + embassy_effectiveness × 0.15
          Clamped to [0.05, 0.95]
        """
        base = 0.5

        # Agent qualification (check professions for matching skill)
        qualification = 0.0
        professions_resp = (
            supabase.table("agent_professions")
            .select("qualification_level")
            .eq("agent_id", str(body.agent_id))
            .execute()
        )
        if professions_resp.data:
            qualification = max(
                p.get("qualification_level", 0) for p in professions_resp.data
            )

        # Target zone security
        zone_security = 5.0  # default moderate
        if body.target_zone_id:
            zone_resp = (
                supabase.table("zones")
                .select("security_level")
                .eq("id", str(body.target_zone_id))
                .single()
                .execute()
            )
            if zone_resp.data:
                sec_level = zone_resp.data.get("security_level", "moderate")
                zone_security = SECURITY_LEVEL_MAP.get(sec_level, 5.0)

        # Guardian count in target zone
        guardian_count = 0
        if body.target_zone_id and body.target_simulation_id:
            guardians_resp = (
                supabase.table("operative_missions")
                .select("id")
                .eq("operative_type", "guardian")
                .eq("source_simulation_id", str(body.target_simulation_id))
                .eq("target_zone_id", str(body.target_zone_id))
                .in_("status", ["active"])
                .execute()
            )
            guardian_count = len(guardians_resp.data or [])

        # Embassy effectiveness — check for active infiltration penalty
        embassy_eff = 0.5
        if body.embassy_id:
            emb_resp = (
                supabase.table("embassies")
                .select("id, infiltration_penalty, infiltration_penalty_expires_at")
                .eq("id", str(body.embassy_id))
                .single()
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
                        # Penalty expired — clear it lazily
                        supabase.table("embassies").update({
                            "infiltration_penalty": 0,
                            "infiltration_penalty_expires_at": None,
                        }).eq("id", str(body.embassy_id)).execute()
                embassy_eff = base_eff

        probability = (
            base
            + qualification * 0.05
            - zone_security * 0.05
            - guardian_count * 0.20
            + embassy_eff * 0.15
        )

        return max(0.05, min(0.95, probability))

    # ── List / Get ────────────────────────────────────────

    @classmethod
    async def list_missions(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        simulation_id: UUID | None = None,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List operative missions with optional filters."""
        query = (
            supabase.table("operative_missions")
            .select("*, agents(name, portrait_image_url)", count="exact")
            .eq("epoch_id", str(epoch_id))
        )
        if simulation_id:
            query = query.eq("source_simulation_id", str(simulation_id))
        if status_filter:
            query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = query.execute()
        return resp.data or [], resp.count or 0

    @classmethod
    async def get_mission(cls, supabase: Client, mission_id: UUID) -> dict:
        """Get a single mission by ID."""
        resp = (
            supabase.table("operative_missions")
            .select("*, agents(name, portrait_image_url)")
            .eq("id", str(mission_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mission not found.")
        return resp.data

    @classmethod
    async def list_threats(
        cls,
        supabase: Client,
        epoch_id: UUID,
        target_simulation_id: UUID,
    ) -> list[dict]:
        """List detected incoming operative threats for a simulation."""
        resp = (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", str(target_simulation_id))
            .in_("status", ["detected", "captured"])
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []

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

            # Advance deploying → active
            if mission["status"] == "deploying":
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
        """Resolve a single mission — roll for success/failure."""
        success_prob = float(mission.get("success_probability", 0.5))
        roll = secrets.SystemRandom().random()

        if roll <= success_prob:
            # Success
            outcome = "success"
            final_status = "success"
            mission_result = await cls._apply_success_effect(supabase, mission)
        else:
            # Failure — check for detection
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
        dissolve the alliance and apply a -20% diplomatic penalty."""
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
            .single()
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
            # Dissolve alliance — remove all members from team
            supabase.table("epoch_participants").update(
                {"team_id": None}
            ).eq("team_id", source_team).execute()

            # Apply -20% diplomatic penalty to betrayer
            supabase.table("epoch_participants").update(
                {"betrayal_penalty": 0.2}
            ).eq("epoch_id", mission["epoch_id"]).eq(
                "simulation_id", mission["source_simulation_id"]
            ).execute()

            logger.info(
                "Betrayal detected: sim %s attacked ally %s — alliance dissolved, penalty applied",
                mission["source_simulation_id"],
                mission["target_simulation_id"],
            )

    @classmethod
    async def _apply_success_effect(cls, supabase: Client, mission: dict) -> dict:
        """Apply the mechanical effect of a successful mission."""
        op_type = mission["operative_type"]

        if op_type == "spy":
            return {
                "outcome": "success",
                "narrative": "Intelligence gathered successfully.",
                "intel_gathered": True,
            }

        if op_type == "saboteur" and mission.get("target_entity_id"):
            # Degrade building condition
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
                return {
                    "outcome": "success",
                    "narrative": f"Building sabotaged: {old_cond} → {new_cond}.",
                    "damage_dealt": {
                        "building_id": mission["target_entity_id"],
                        "old_condition": old_cond,
                        "new_condition": new_cond,
                    },
                }

        if op_type == "propagandist":
            # A1: Create a destabilizing event in the target simulation
            from backend.dependencies import get_admin_supabase

            admin = await get_admin_supabase()
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
            admin.table("events").insert(event_data).execute()

            return {
                "outcome": "success",
                "narrative": "Propaganda campaign succeeded. Target population's morale undermined.",
                "score_awarded": True,
                "event_created": True,
            }

        if op_type == "assassin" and mission.get("target_entity_id"):
            # Weaken target agent's relationships (-2 intensity)
            rel_resp = (
                supabase.table("agent_relationships")
                .select("id, intensity")
                .or_(
                    f"source_agent_id.eq.{mission['target_entity_id']},"
                    f"target_agent_id.eq.{mission['target_entity_id']}"
                )
                .execute()
            )
            for rel in rel_resp.data or []:
                new_intensity = max(1, rel["intensity"] - 2)
                supabase.table("agent_relationships").update(
                    {"intensity": new_intensity}
                ).eq("id", rel["id"]).execute()

            # A2: Block ambassador status for 3 cycles
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
                "relationships_weakened": len(rel_resp.data or []),
                "ambassador_blocked_until": blocked_until.isoformat(),
            }

        if op_type == "infiltrator" and mission.get("target_entity_id"):
            # A3: Reduce embassy effectiveness by 50% for 3 cycles
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
                "infiltration_penalty": 0.5,
                "infiltration_penalty_expires_at": expires_at.isoformat(),
            }).eq("id", mission["target_entity_id"]).execute()

            return {
                "outcome": "success",
                "narrative": "Embassy infiltrated. Diplomatic effectiveness severely compromised.",
                "intel_gathered": True,
                "target_embassy_id": mission["target_entity_id"],
                "effectiveness_reduced": True,
            }

        return {"outcome": "success", "narrative": "Mission completed."}

    # ── Recall ────────────────────────────────────────────

    @classmethod
    async def recall(cls, supabase: Client, mission_id: UUID) -> dict:
        """Recall an active operative (returns next cycle)."""
        mission = await cls.get_mission(supabase, mission_id)
        if mission["status"] not in ("deploying", "active"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot recall mission with status '{mission['status']}'.",
            )

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
        """Reveal active enemy operatives in your simulation (costs 3 RP).

        Returns list of detected missions.
        """
        # Spend 3 RP
        await EpochService.spend_rp(supabase, epoch_id, simulation_id, 3)

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
