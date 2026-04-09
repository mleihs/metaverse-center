"""Alliance proposals, voting, shared intel tagging, upkeep, and tension.

Follows the existing @classmethod service pattern. Postgres-native functions
handle upkeep deduction, tension computation, and proposal expiry — this
service layer orchestrates calls and handles battle log integration.
"""

import logging
from uuid import UUID

from backend.models.epoch import EpochConfig
from backend.services.battle_log_service import BattleLogService
from backend.utils.errors import bad_request, conflict, forbidden, not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = EpochConfig().model_dump()


class AllianceService:
    """Alliance proposals, voting, shared intel tagging, upkeep, tension."""

    # ── Proposal: Create ─────────────────────────────────

    @classmethod
    async def create_proposal(
        cls,
        supabase: Client,
        epoch_id: UUID,
        team_id: UUID,
        proposer_simulation_id: UUID,
    ) -> dict:
        """Create a join proposal.

        Validates:
        - Epoch in lobby/foundation/competition (not reckoning/completed)
        - Proposer is unaligned (no team_id)
        - Team is active (not dissolved) and not full (max_team_size)
        - No existing pending proposal for this proposer+team
        - Solo teams (1 member): auto-accept immediately (skip voting)
        Sets expires_at_cycle = current_cycle + 2.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] in ("reckoning", "completed", "cancelled"):
            raise bad_request("Alliance proposals are not accepted during reckoning or after completion.")

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        current_cycle = epoch.get("current_cycle", 0)

        # Verify proposer is a participant and unaligned
        proposer = await (
            supabase.table("epoch_participants")
            .select("id, team_id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(proposer_simulation_id))
            .maybe_single()
            .execute()
        )
        if not proposer.data:
            raise not_found(detail="Proposer is not a participant.")
        if proposer.data.get("team_id"):
            raise bad_request("You must leave your current alliance before requesting to join another.")

        # Verify team exists and is active
        team = await (
            supabase.table("epoch_teams")
            .select("id, name, epoch_id")
            .eq("id", str(team_id))
            .eq("epoch_id", str(epoch_id))
            .is_("dissolved_at", "null")
            .maybe_single()
            .execute()
        )
        if not team.data:
            raise not_found(detail="Team not found or dissolved.")

        # Check team size limit
        members = await (
            supabase.table("epoch_participants")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("team_id", str(team_id))
            .execute()
        )
        member_count = len(extract_list(members))
        if member_count >= config["max_team_size"]:
            raise bad_request(f"Team is full (max {config['max_team_size']} members).")

        # Solo team: auto-accept immediately (skip voting)
        if member_count == 1:
            logger.info(
                "Alliance proposal auto-accepted (solo team)",
                extra={"epoch_id": str(epoch_id), "team_id": str(team_id), "proposer_id": str(proposer_simulation_id)},
            )
            # Directly join the proposer to the team
            await (
                supabase.table("epoch_participants")
                .update({"team_id": str(team_id)})
                .eq("epoch_id", str(epoch_id))
                .eq("simulation_id", str(proposer_simulation_id))
                .execute()
            )

            # Create proposal record as accepted
            resp = await (
                supabase.table("epoch_alliance_proposals")
                .insert(
                    {
                        "epoch_id": str(epoch_id),
                        "team_id": str(team_id),
                        "proposer_simulation_id": str(proposer_simulation_id),
                        "expires_at_cycle": current_cycle + 2,
                        "status": "accepted",
                        "resolved_at": "now()",
                    }
                )
                .execute()
            )

            # Log acceptance
            await BattleLogService.log_alliance_proposal_resolved(
                supabase,
                epoch_id,
                current_cycle,
                proposer_simulation_id,
                team.data["name"],
                "accepted",
            )

            return resp.data[0] if resp.data else {}

        logger.info(
            "Alliance proposal created",
            extra={
                "epoch_id": str(epoch_id),
                "team_id": str(team_id),
                "proposer_id": str(proposer_simulation_id),
                "expires_at_cycle": current_cycle + 2,
            },
        )

        # Create pending proposal
        resp = await (
            supabase.table("epoch_alliance_proposals")
            .insert(
                {
                    "epoch_id": str(epoch_id),
                    "team_id": str(team_id),
                    "proposer_simulation_id": str(proposer_simulation_id),
                    "expires_at_cycle": current_cycle + 2,
                }
            )
            .execute()
        )
        if not resp.data:
            raise conflict("A pending proposal already exists for this team.")

        # Log proposal
        await BattleLogService.log_alliance_proposal(
            supabase,
            epoch_id,
            current_cycle,
            proposer_simulation_id,
            team.data["name"],
        )

        return resp.data[0]

    # ── Invite: Team member invites an outsider ──────────

    @classmethod
    async def invite_to_team(
        cls,
        supabase: Client,
        epoch_id: UUID,
        team_id: UUID,
        inviter_simulation_id: UUID,
        target_simulation_id: UUID,
    ) -> dict:
        """Invite a player to your team.

        The inviter must be on the team. The target must be unaligned.
        Delegates to create_proposal using the target as the proposer,
        which auto-accepts for solo teams.
        """
        # Verify inviter is on this team
        inviter = await (
            supabase.table("epoch_participants")
            .select("id, team_id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(inviter_simulation_id))
            .maybe_single()
            .execute()
        )
        if not inviter.data or inviter.data.get("team_id") != str(team_id):
            raise forbidden("You must be a member of this team to invite players.")

        # Delegate to create_proposal with target as proposer
        return await cls.create_proposal(
            supabase,
            epoch_id,
            team_id,
            target_simulation_id,
        )

    # ── Proposal: Vote ────────────────────────────────────

    @classmethod
    async def vote_on_proposal(
        cls,
        supabase: Client,
        proposal_id: UUID,
        voter_simulation_id: UUID,
        vote: str,
    ) -> dict:
        """Cast accept/reject vote. DB trigger handles resolution.

        Validates voter is a member of the proposal's target team.
        """
        # Fetch proposal
        proposal = await (
            supabase.table("epoch_alliance_proposals")
            .select("*, epoch_teams(name)")
            .eq("id", str(proposal_id))
            .maybe_single()
            .execute()
        )
        if not proposal.data:
            raise not_found(detail="Proposal not found.")
        if proposal.data["status"] != "pending":
            raise bad_request(f"Proposal is already {proposal.data['status']}.")

        # Verify voter is a team member
        voter = await (
            supabase.table("epoch_participants")
            .select("id, team_id")
            .eq("epoch_id", proposal.data["epoch_id"])
            .eq("simulation_id", str(voter_simulation_id))
            .maybe_single()
            .execute()
        )
        if not voter.data or voter.data.get("team_id") != proposal.data["team_id"]:
            raise forbidden("Only team members can vote on proposals.")

        logger.info(
            "Alliance vote cast",
            extra={"proposal_id": str(proposal_id), "vote": vote, "voter_id": str(voter_simulation_id)},
        )

        # Insert vote — DB trigger resolves the proposal
        resp = await (
            supabase.table("epoch_alliance_votes")
            .insert(
                {
                    "proposal_id": str(proposal_id),
                    "voter_simulation_id": str(voter_simulation_id),
                    "vote": vote,
                }
            )
            .execute()
        )
        if not resp.data:
            raise conflict("You have already voted on this proposal.")

        # Check if proposal was resolved by the trigger
        updated_proposal = await (
            supabase.table("epoch_alliance_proposals").select("status").eq("id", str(proposal_id)).single().execute()
        )
        resolved_status = updated_proposal.data.get("status") if updated_proposal.data else "pending"

        # Log resolution if it happened
        if resolved_status in ("accepted", "rejected"):
            from backend.services.epoch_service import EpochService

            epoch = await EpochService.get(supabase, UUID(proposal.data["epoch_id"]))
            team_name = (proposal.data.get("epoch_teams") or {}).get("name", "")
            await BattleLogService.log_alliance_proposal_resolved(
                supabase,
                UUID(proposal.data["epoch_id"]),
                epoch.get("current_cycle", 0),
                UUID(proposal.data["proposer_simulation_id"]),
                team_name,
                resolved_status,
            )

        return resp.data[0]

    # ── Proposal: List ────────────────────────────────────

    @classmethod
    async def list_proposals(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        team_id: UUID | None = None,
        status_filter: str | None = None,
    ) -> list[dict]:
        """List proposals with joined votes and proposer sim name."""
        query = (
            supabase.table("epoch_alliance_proposals")
            .select(
                "*, epoch_alliance_votes(*), simulations!epoch_alliance_proposals_proposer_simulation_id_fkey(name)"
            )
            .eq("epoch_id", str(epoch_id))
            .order("proposed_at", desc=True)
        )

        if team_id:
            query = query.eq("team_id", str(team_id))
        if status_filter:
            query = query.eq("status", status_filter)

        resp = await query.execute()
        proposals = extract_list(resp)

        # Enrich with proposer_name from joined simulations
        for p in proposals:
            sim_data = p.pop("simulations", None)
            p["proposer_name"] = (sim_data or {}).get("name")
            p["votes"] = p.pop("epoch_alliance_votes", [])

        return proposals

    # ── Proposal: Expire ──────────────────────────────────

    @classmethod
    async def expire_proposals(
        cls,
        supabase: Client,
        epoch_id: UUID,
        current_cycle: int,
    ) -> int:
        """Expire pending proposals past expires_at_cycle.

        Calls Postgres ``fn_expire_alliance_proposals`` (migration 090).
        Called during resolve_cycle pipeline.
        """
        resp = await supabase.rpc(
            "fn_expire_alliance_proposals",
            {"p_epoch_id": str(epoch_id), "p_current_cycle": current_cycle},
        ).execute()
        count = resp.data if isinstance(resp.data, int) else 0
        if count:
            logger.info(
                "Alliance proposals expired",
                extra={"epoch_id": str(epoch_id), "cycle": current_cycle, "count": count},
            )
        return count

    # ── Upkeep: Deduct RP ────────────────────────────────

    @classmethod
    async def deduct_upkeep(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
    ) -> list[dict]:
        """Deduct alliance upkeep via Postgres ``fn_deduct_alliance_upkeep`` (migration 090).

        Returns summary per team. Logs upkeep to battle log.
        """
        resp = await admin_supabase.rpc(
            "fn_deduct_alliance_upkeep",
            {"p_epoch_id": str(epoch_id)},
        ).execute()
        teams = resp.data if isinstance(resp.data, list) else []

        if teams:
            logger.info(
                "Alliance upkeep deducted",
                extra={
                    "epoch_id": str(epoch_id),
                    "cycle": cycle_number,
                    "teams": len(teams),
                    "total_rp": sum(t.get("cost_per_member", 0) * t.get("member_count", 0) for t in teams),
                },
            )

        # Log upkeep per team
        for team_info in teams:
            await BattleLogService.log_alliance_upkeep(
                admin_supabase,
                epoch_id,
                cycle_number,
                team_info.get("team_name", ""),
                team_info.get("cost_per_member", 0),
                team_info.get("member_count", 0),
            )

        return teams

    # ── Tension: Compute ──────────────────────────────────

    @classmethod
    async def compute_tension(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
    ) -> list[dict]:
        """Compute tension via Postgres ``fn_compute_alliance_tension`` (migration 090).

        The DB trigger sets dissolved_at/dissolved_reason but does NOT clear
        team_ids. This method logs tension changes and dissolutions. The caller
        must call clear_dissolved_team_ids() afterward (after notifications
        have had a chance to read team membership).
        """
        resp = await admin_supabase.rpc(
            "fn_compute_alliance_tension",
            {"p_epoch_id": str(epoch_id), "p_cycle_number": cycle_number},
        ).execute()
        results = resp.data if isinstance(resp.data, list) else []

        for r in results:
            old_t = r.get("old_tension", 0)
            new_t = r.get("new_tension", 0)
            team_name = r.get("team_name", "")
            team_id = r.get("team_id", "")

            if new_t > old_t:
                logger.info(
                    "Alliance tension increased",
                    extra={
                        "epoch_id": str(epoch_id),
                        "team_id": team_id,
                        "team_name": team_name,
                        "old": old_t,
                        "new": new_t,
                    },
                )
                await BattleLogService.log_tension_change(
                    admin_supabase,
                    epoch_id,
                    cycle_number,
                    team_name,
                    old_t,
                    new_t,
                )

            if r.get("dissolved"):
                logger.warning(
                    "Alliance dissolved due to tension",
                    extra={
                        "epoch_id": str(epoch_id),
                        "team_id": team_id,
                        "team_name": team_name,
                        "final_tension": new_t,
                    },
                )
                # team_ids still set — read current members for logging
                members_resp = await (
                    admin_supabase.table("epoch_participants")
                    .select("simulation_id")
                    .eq("epoch_id", str(epoch_id))
                    .eq("team_id", team_id)
                    .execute()
                )
                affected_sims = [m["simulation_id"] for m in (extract_list(members_resp))]

                await BattleLogService.log_tension_dissolution(
                    admin_supabase,
                    epoch_id,
                    cycle_number,
                    team_name,
                    affected_sims,
                )

        return results

    @classmethod
    async def clear_dissolved_team_ids(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
    ) -> None:
        """Clear team_id on participants whose team has been dissolved.

        Called after notifications so they can still detect the dissolution
        via the team's dissolved_at field.
        """
        dissolved_resp = await (
            admin_supabase.table("epoch_teams")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .not_.is_("dissolved_at", "null")
            .execute()
        )
        dissolved_teams = extract_list(dissolved_resp)
        if dissolved_teams:
            logger.info(
                "Clearing dissolved team memberships",
                extra={"epoch_id": str(epoch_id), "dissolved_teams": len(dissolved_teams)},
            )
        for team in dissolved_teams:
            await (
                admin_supabase.table("epoch_participants")
                .update({"team_id": None})
                .eq("epoch_id", str(epoch_id))
                .eq("team_id", team["id"])
                .execute()
            )

    # ── Dissolve Team ─────────────────────────────────────

    @classmethod
    async def dissolve_team(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        team_id: UUID,
        reason: str,
    ) -> None:
        """Set dissolved_at/reason, clear all members' team_id, log to battle_log."""
        from datetime import UTC, datetime

        # Get team name for logging
        team_resp = await (
            admin_supabase.table("epoch_teams").select("name").eq("id", str(team_id)).maybe_single().execute()
        )
        team_name = (team_resp.data or {}).get("name", "Unknown")

        logger.info(
            "Alliance dissolved manually",
            extra={"epoch_id": str(epoch_id), "team_id": str(team_id), "team_name": team_name, "reason": reason},
        )

        # Dissolve
        await (
            admin_supabase.table("epoch_teams")
            .update(
                {
                    "dissolved_at": datetime.now(UTC).isoformat(),
                    "dissolved_reason": reason,
                }
            )
            .eq("id", str(team_id))
            .execute()
        )

        # Clear members
        await (
            admin_supabase.table("epoch_participants")
            .update({"team_id": None})
            .eq("epoch_id", str(epoch_id))
            .eq("team_id", str(team_id))
            .execute()
        )

        # Get cycle for logging
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(admin_supabase, epoch_id)
        cycle = epoch.get("current_cycle", 0)

        await BattleLogService.log_event(
            admin_supabase,
            epoch_id,
            cycle,
            "alliance_dissolved",
            f"Alliance '{team_name}' has been dissolved ({reason}).",
            is_public=True,
            metadata={"team_name": team_name, "reason": reason},
        )
