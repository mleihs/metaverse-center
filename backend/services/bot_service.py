"""Bot cycle orchestrator — executes bot decisions during epoch cycle resolution.

Called from EpochService.resolve_cycle(). For each bot participant:
1. Builds fog-of-war compliant game state
2. Runs personality decision engine
3. Executes deployments via OperativeService (same path as humans)
4. Manages alliances via EpochService
5. Logs all decisions for transparency
6. Optionally generates chat messages (template or LLM)
7. Sets cycle_ready = TRUE
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.epoch import OperativeDeploy
from backend.services.bot_chat_service import BotChatService
from backend.services.bot_game_state import BotGameState
from backend.services.bot_personality import create_personality
from backend.services.epoch_service import EpochService
from backend.services.operative_service import OperativeService
from supabase import Client

logger = logging.getLogger(__name__)


class BotService:
    """Orchestrates bot decision-making during epoch cycle resolution."""

    @classmethod
    async def execute_bot_cycle(
        cls,
        supabase: Client,
        admin_supabase: Client,
        epoch_id: str,
        cycle_number: int,
        config: dict,
    ) -> list[dict]:
        """Execute all bot decisions for a cycle.

        Args:
            supabase: User-scoped client (for reads, RLS-enforced).
            admin_supabase: Admin client (for bot writes, bypasses RLS).
            epoch_id: The current epoch.
            cycle_number: Current cycle number.
            config: Epoch config dict.

        Returns:
            List of decision summaries per bot.
        """
        bot_participants = await cls._get_bot_participants(admin_supabase, epoch_id)
        if not bot_participants:
            return []

        results = []
        for bot_p in bot_participants:
            try:
                result = await cls._execute_single_bot(
                    supabase, admin_supabase, epoch_id, bot_p, cycle_number, config
                )
                results.append(result)
            except Exception:
                logger.exception(
                    "Bot execution failed for participant %s in epoch %s",
                    bot_p["id"], epoch_id,
                )
                results.append({
                    "participant_id": bot_p["id"],
                    "success": False,
                    "error": "Bot execution failed",
                })

        return results

    @classmethod
    async def _execute_single_bot(
        cls,
        supabase: Client,
        admin_supabase: Client,
        epoch_id: str,
        participant: dict,
        cycle_number: int,
        config: dict,
    ) -> dict:
        """Execute decisions for a single bot participant."""
        # Re-fetch participant to get fresh RP (after grant)
        fresh_p = (
            admin_supabase.table("epoch_participants")
            .select("*, bot_players(*)")
            .eq("id", participant["id"])
            .single()
            .execute()
        )
        if not fresh_p.data:
            return {"participant_id": participant["id"], "success": False, "error": "Not found"}

        participant = fresh_p.data
        bot_player = participant.get("bot_players") or participant.get("bot_player") or {}
        participant["bot_player"] = bot_player

        # Add epoch status to config for state builder
        epoch_resp = (
            admin_supabase.table("game_epochs")
            .select("status")
            .eq("id", epoch_id)
            .single()
            .execute()
        )
        epoch_status = epoch_resp.data.get("status", "competition") if epoch_resp.data else "competition"
        config_with_status = {**config, "_epoch_status": epoch_status}

        # 1. Build fog-of-war game state
        game_state = await BotGameState.build(
            admin_supabase, epoch_id, participant, cycle_number, config_with_status
        )

        # 2. Create personality and make decisions
        personality = create_personality(
            bot_player.get("personality", "sentinel"),
            bot_player.get("difficulty", "medium"),
            bot_player.get("config"),
        )
        decisions = personality.decide(game_state)

        # 3a. Execute fortifications (foundation phase only)
        fortified = []
        for fort_plan in decisions.fortifications:
            try:
                result = await OperativeService.fortify_zone(
                    admin_supabase,
                    UUID(epoch_id),
                    UUID(participant["simulation_id"]),
                    UUID(fort_plan.zone_id),
                )
                fortified.append(result)
            except Exception:
                logger.warning(
                    "Bot fortification failed: zone %s",
                    fort_plan.zone_id,
                    exc_info=True,
                )

        # 3b. Execute deployments (via same OperativeService humans use)
        deployed = []
        for plan in decisions.deployments:
            try:
                body = OperativeDeploy(
                    agent_id=UUID(plan.agent_id),
                    operative_type=plan.operative_type,
                    target_simulation_id=UUID(plan.target_simulation_id) if plan.target_simulation_id else None,
                    embassy_id=UUID(plan.embassy_id) if plan.embassy_id else None,
                )
                mission = await OperativeService.deploy(
                    admin_supabase,
                    UUID(epoch_id),
                    UUID(participant["simulation_id"]),
                    body,
                )
                deployed.append(mission)
            except Exception:
                logger.warning(
                    "Bot deployment failed: %s %s → %s",
                    plan.operative_type, plan.agent_id, plan.target_simulation_id,
                    exc_info=True,
                )

        # 4. Execute alliance actions
        alliance_results = await cls._execute_alliances(
            admin_supabase, epoch_id, participant, decisions.alliances
        )

        # 5. Log decisions for transparency
        await cls._log_decisions(
            admin_supabase, epoch_id, participant["id"], cycle_number, decisions, deployed, fortified
        )

        # 6. Generate chat message (template or LLM, best-effort)
        try:
            await BotChatService.maybe_send_message(
                admin_supabase, epoch_id, participant, game_state, config
            )
        except Exception:
            logger.debug("Bot chat generation failed for %s", participant["id"], exc_info=True)

        # 7. Set cycle_ready
        admin_supabase.table("epoch_participants").update(
            {"cycle_ready": True}
        ).eq("id", participant["id"]).execute()

        return {
            "participant_id": participant["id"],
            "success": True,
            "deployments": len(deployed),
            "fortifications": len(fortified),
            "alliances": len(alliance_results),
            "reasoning": decisions.reasoning,
        }

    @classmethod
    async def _get_bot_participants(cls, supabase: Client, epoch_id: str) -> list[dict]:
        """Get all bot participants in an epoch."""
        resp = (
            supabase.table("epoch_participants")
            .select("*, bot_players(*)")
            .eq("epoch_id", epoch_id)
            .eq("is_bot", True)
            .execute()
        )
        return resp.data or []

    @classmethod
    async def _execute_alliances(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        participant: dict,
        alliances: list,
    ) -> list[dict]:
        """Execute alliance actions for a bot."""
        results = []
        sim_id = participant["simulation_id"]

        for action in alliances:
            try:
                if action.action == "form" and action.team_name:
                    team = await EpochService.create_team(
                        admin_supabase, UUID(epoch_id), UUID(sim_id), action.team_name
                    )
                    results.append({"action": "form", "team_id": team.get("id")})

                elif action.action == "join" and action.team_name:
                    # Find team by name
                    teams = await EpochService.list_teams(admin_supabase, UUID(epoch_id))
                    for t in teams:
                        if t["name"] == action.team_name:
                            await EpochService.join_team(
                                admin_supabase, UUID(epoch_id), UUID(t["id"]), UUID(sim_id)
                            )
                            results.append({"action": "join", "team_id": t["id"]})
                            break

                elif action.action == "leave":
                    await EpochService.leave_team(admin_supabase, UUID(epoch_id), UUID(sim_id))
                    results.append({"action": "leave"})

            except Exception:
                logger.debug("Bot alliance action failed: %s", action.action, exc_info=True)

        return results

    @classmethod
    async def _log_decisions(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        participant_id: str,
        cycle_number: int,
        decisions,
        deployed: list[dict],
        fortified: list[dict] | None = None,
    ) -> None:
        """Log bot decisions for transparency and debugging."""
        log_entry = {
            "epoch_id": epoch_id,
            "participant_id": participant_id,
            "cycle_number": cycle_number,
            "phase": "deployment",
            "decision": {
                "reasoning": decisions.reasoning,
                "planned_deployments": [
                    {
                        "type": d.operative_type,
                        "target": d.target_simulation_id,
                        "cost": d.cost_rp,
                    }
                    for d in decisions.deployments
                ],
                "executed_deployments": len(deployed),
                "planned_fortifications": [
                    {"zone_id": f.zone_id, "cost": f.cost_rp}
                    for f in decisions.fortifications
                ],
                "executed_fortifications": len(fortified or []),
                "alliance_actions": [
                    {"action": a.action, "target": a.target_simulation_id}
                    for a in decisions.alliances
                ],
                "rp_spent": decisions.rp_spent,
            },
        }
        try:
            admin_supabase.table("bot_decision_log").insert(log_entry).execute()
        except Exception:
            logger.debug("Failed to log bot decision", exc_info=True)
