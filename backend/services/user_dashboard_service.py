"""Service layer for the authenticated user dashboard aggregation."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.user import ActiveEpochParticipation, DashboardData, MembershipInfo
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class UserDashboardService:
    """Aggregates dashboard data for a single authenticated user."""

    @classmethod
    async def get_dashboard(
        cls,
        supabase: Client,
        admin_supabase: Client,
        user_id: UUID,
    ) -> DashboardData:
        """Fetch consolidated dashboard data.

        Queries memberships, active epoch participations, academy count,
        and active resonance count.  All queries use the user JWT (RLS enforced)
        except user_profiles which requires admin access.
        """
        user_id_str = str(user_id)

        # ── Memberships ──
        mem_resp = await (
            supabase.table("simulation_members")
            .select("simulation_id, member_role, joined_at, simulations(name, slug)")
            .eq("user_id", user_id_str)
            .execute()
        )
        memberships = []
        for row in mem_resp.data or []:
            sim = row.get("simulations") or {}
            memberships.append(
                MembershipInfo(
                    simulation_id=row["simulation_id"],
                    simulation_name=sim.get("name", ""),
                    simulation_slug=sim.get("slug", ""),
                    member_role=row["member_role"],
                )
            )

        # ── Active epoch participations ──
        active_statuses = ["lobby", "foundation", "competition", "reckoning"]
        ep_resp = await (
            supabase.table("epoch_participants")
            .select(
                "epoch_id, current_rp, "
                "game_epochs(id, name, status, epoch_type, current_cycle, config), "
                "simulations(name)"
            )
            .eq("user_id", user_id_str)
            .eq("is_bot", False)
            .in_("game_epochs.status", active_statuses)
            .execute()
        )
        participations: list[ActiveEpochParticipation] = []
        for row in ep_resp.data or []:
            epoch = row.get("game_epochs")
            if not epoch or epoch.get("status") not in active_statuses:
                continue
            sim = row.get("simulations") or {}
            config = epoch.get("config") or {}
            duration_days = config.get("duration_days", 14)
            cycle_hours = config.get("cycle_hours", 8)
            total_cycles = (duration_days * 24) // cycle_hours if cycle_hours else 0
            rp_cap = config.get("rp_cap", 30)

            participations.append(
                ActiveEpochParticipation(
                    epoch_id=epoch["id"],
                    epoch_name=epoch.get("name", ""),
                    epoch_status=epoch["status"],
                    epoch_type=epoch.get("epoch_type", "competitive"),
                    current_cycle=epoch.get("current_cycle", 0),
                    total_cycles=total_cycles,
                    current_rp=row.get("current_rp", 0),
                    rp_cap=rp_cap,
                    simulation_name=sim.get("name", ""),
                )
            )

        # ── Academy epochs played ──
        profile_resp = await (
            admin_supabase.table("user_profiles")
            .select("academy_epochs_played")
            .eq("id", user_id_str)
            .maybe_single()
            .execute()
        )
        academy_count = 0
        if profile_resp.data:
            academy_count = profile_resp.data.get("academy_epochs_played", 0)

        # ── Active resonance count ──
        res_resp = await (
            supabase.table("substrate_resonances")
            .select("id", count="exact")
            .in_("status", ["detected", "impacting", "subsiding"])
            .is_("deleted_at", "null")
            .execute()
        )
        resonance_count = res_resp.count if res_resp.count is not None else 0

        logger.info(
            "Dashboard data fetched",
            extra={
                "user_id": user_id_str,
                "memberships": len(memberships),
                "active_epochs": len(participations),
            },
        )

        return DashboardData(
            memberships=memberships,
            active_epoch_participations=participations,
            academy_epochs_played=academy_count,
            active_resonance_count=resonance_count,
        )
