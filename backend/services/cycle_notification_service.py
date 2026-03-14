"""Cycle notification service — email notifications for epoch events.

Sends tactical briefing emails to human players when cycles resolve,
phases change, or epochs complete. Respects fog-of-war and notification
preferences. Uses SMTP for delivery. Supports single-language rendering
via email_locale and per-simulation accent colors.
"""

import asyncio
import logging

from backend.models.epoch import SCORING_DIMENSIONS
from backend.services.email_service import EmailService
from backend.services.email_templates import (
    get_sim_accent,
    render_cycle_briefing,
    render_epoch_completed,
    render_phase_change,
)
from backend.services.scoring_service import ScoringService
from supabase import Client

logger = logging.getLogger(__name__)

# Sequential send delay between emails (ms)
_SEND_DELAY_MS = 200


class CycleNotificationService:
    """Sends email notifications for epoch lifecycle events."""

    # ── Recipient Resolution ───────────────────────────────

    @classmethod
    async def _resolve_recipients(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        *,
        notification_type: str = "cycle_resolved",
    ) -> list[dict]:
        """Resolve human participants to email addresses with preference checks.

        Chain: epoch_participants → source_template_id → simulation_members → auth.users → preferences

        Returns list of dicts: {user_id, email, simulation_id, simulation_name, simulation_slug, email_locale}
        """
        # 1. Get human participants (not bots) with simulation info
        participants_resp = (
            admin_supabase.table("epoch_participants")
            .select("simulation_id, is_bot, simulations(name, slug, source_template_id)")
            .eq("epoch_id", epoch_id)
            .eq("is_bot", False)
            .execute()
        )
        participants = participants_resp.data or []
        if not participants:
            return []

        # 2. Resolve template simulation IDs → user_ids via simulation_members
        # Game instances point to their template via source_template_id
        template_to_participant: dict[str, dict] = {}
        for p in participants:
            sim_info = p.get("simulations") or {}
            template_id = sim_info.get("source_template_id") or p["simulation_id"]
            template_to_participant[template_id] = {
                "simulation_id": p["simulation_id"],
                "simulation_name": sim_info.get("name", "Unknown"),
                "simulation_slug": sim_info.get("slug", ""),
            }

        template_ids = list(template_to_participant.keys())

        # Batch fetch members (editors+) for all template simulations
        members_resp = (
            admin_supabase.table("simulation_members")
            .select("user_id, simulation_id")
            .in_("simulation_id", template_ids)
            .in_("member_role", ["editor", "admin", "owner"])
            .execute()
        )
        members = members_resp.data or []
        if not members:
            return []

        # 3. Get email addresses via SECURITY DEFINER RPC (get_user_emails_batch, migration 044)
        user_ids = list({m["user_id"] for m in members})
        email_resp = admin_supabase.rpc(
            "get_user_emails_batch", {"user_ids": user_ids}
        ).execute()
        email_map: dict[str, str] = {
            row["id"]: row["email"] for row in (email_resp.data or [])
        }

        # 4. Get notification preferences (batch)
        prefs_resp = (
            admin_supabase.table("notification_preferences")
            .select("user_id, cycle_resolved, phase_changed, epoch_completed, email_locale")
            .in_("user_id", user_ids)
            .execute()
        )
        prefs_map: dict[str, dict] = {
            row["user_id"]: row for row in (prefs_resp.data or [])
        }

        # 5. Resolve template simulation slugs for accent colors
        # The game instance slug may not be the right one — get the template slug
        template_slugs: dict[str, str] = {}
        if template_ids:
            slug_resp = (
                admin_supabase.table("simulations")
                .select("id, slug")
                .in_("id", template_ids)
                .execute()
            )
            template_slugs = {s["id"]: s.get("slug", "") for s in (slug_resp.data or [])}

        # 6. Build recipient list with preference filtering
        recipients = []
        for m in members:
            user_id = m["user_id"]
            email = email_map.get(user_id)
            if not email:
                continue

            prefs = prefs_map.get(user_id, {})
            # Default: all notifications enabled
            if not prefs.get(notification_type, True):
                continue

            participant_info = template_to_participant.get(m["simulation_id"], {})
            # Get template slug for accent color
            template_slug = template_slugs.get(m["simulation_id"], "")
            recipients.append({
                "user_id": user_id,
                "email": email,
                "simulation_id": participant_info.get("simulation_id", m["simulation_id"]),
                "simulation_name": participant_info.get("simulation_name", "Unknown"),
                "simulation_slug": template_slug or participant_info.get("simulation_slug", ""),
                "email_locale": prefs.get("email_locale", "en"),
            })

        return recipients

    # ── Player Briefing Data ───────────────────────────────

    @classmethod
    async def _build_player_briefing(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        simulation_id: str,
        cycle_number: int,
        epoch_name: str,
        epoch_status: str,
        *,
        epoch_config: dict | None = None,
        command_center_url: str = "https://metaverse.center/epoch",
        simulation_slug: str = "",
    ) -> dict:
        """Gather fog-of-war compliant briefing data for a single player.

        Returns dict with: rank, composite, delta, dimensions, operatives, rp, public_events,
        threats, spy_intel, missions, rank_gap, alliance info, next cycle preview
        """
        config = epoch_config or {}
        accent = get_sim_accent(simulation_slug)

        # Current cycle scores
        current_resp = (
            admin_supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", epoch_id)
            .eq("cycle_number", cycle_number)
            .order("composite_score", desc=True)
            .execute()
        )
        current_scores = current_resp.data or []

        # Previous cycle scores (for deltas)
        prev_cycle = cycle_number - 1
        prev_scores_map: dict[str, dict] = {}
        if prev_cycle >= 1:
            prev_resp = (
                admin_supabase.table("epoch_scores")
                .select(
                "simulation_id, composite_score,"
                " stability_score, influence_score, sovereignty_score,"
                " diplomatic_score, military_score"
            )
                .eq("epoch_id", epoch_id)
                .eq("cycle_number", prev_cycle)
                .execute()
            )
            prev_scores_map = {s["simulation_id"]: s for s in (prev_resp.data or [])}

        # Find this player's score and rank
        player_score = None
        player_rank = 0
        total_players = len(current_scores)
        prev_rank = 0

        for idx, s in enumerate(current_scores, start=1):
            if s["simulation_id"] == simulation_id:
                player_score = s
                player_rank = idx

        # Compute previous rank from already-fetched prev_scores_map
        if prev_cycle >= 1 and prev_scores_map:
            prev_sorted = sorted(
                prev_scores_map.values(),
                key=lambda s: float(s.get("composite_score", 0)),
                reverse=True,
            )
            for idx, s in enumerate(prev_sorted, start=1):
                if s["simulation_id"] == simulation_id:
                    prev_rank = idx

        prev_score = prev_scores_map.get(simulation_id, {})
        dimensions = SCORING_DIMENSIONS

        dim_data = []
        if player_score:
            for dim in dimensions:
                col = f"{dim}_score"
                current_val = float(player_score.get(col, 0))
                prev_val = float(prev_score.get(col, 0)) if prev_score else 0
                dim_data.append({
                    "name": dim,
                    "value": round(current_val, 1),
                    "delta": round(current_val - prev_val, 1),
                })

        composite = float(player_score["composite_score"]) if player_score else 0
        prev_composite = float(prev_score.get("composite_score", 0)) if prev_score else 0

        # ── Operative missions with per-mission detail (B7) ──
        ops_resp = (
            admin_supabase.table("operative_missions")
            .select("operative_type, status, target_simulation_id, resolves_at")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", simulation_id)
            .execute()
        )
        ops = ops_resp.data or []
        active_ops = sum(1 for o in ops if o["status"] == "active")
        resolved_ops = [o for o in ops if o["status"] in ("success", "failed", "detected", "captured")]
        success_ops = sum(1 for o in resolved_ops if o["status"] == "success")
        detected_ops = sum(1 for o in resolved_ops if o["status"] in ("detected", "captured"))
        guardians = sum(1 for o in ops if o["operative_type"] == "guardian" and o["status"] == "active")
        counter_intel = sum(1 for o in ops if o["operative_type"] == "counter_intel" and o["status"] == "active")

        # Build sim name lookup for missions
        target_sim_ids = list({o.get("target_simulation_id") for o in ops if o.get("target_simulation_id")})
        sim_name_map: dict[str, str] = {}
        if target_sim_ids:
            names_resp = (
                admin_supabase.table("simulations")
                .select("id, name")
                .in_("id", target_sim_ids)
                .execute()
            )
            sim_name_map = {s["id"]: s["name"] for s in (names_resp.data or [])}

        # Per-mission detail list
        mission_details = []
        for o in ops:
            if o["operative_type"] in ("guardian", "counter_intel"):
                continue  # Defensive ops shown in summary, not mission log
            target_name = sim_name_map.get(o.get("target_simulation_id", ""), "?")
            mission_details.append({
                "type": o["operative_type"],
                "target_name": target_name,
                "status": o["status"],
            })

        # ── RP balance ──
        rp_resp = (
            admin_supabase.table("epoch_participants")
            .select("current_rp, team_id")
            .eq("epoch_id", epoch_id)
            .eq("simulation_id", simulation_id)
            .maybe_single()
            .execute()
        )
        rp_balance = rp_resp.data.get("current_rp", 0) if rp_resp.data else 0
        player_team_id = rp_resp.data.get("team_id") if rp_resp.data else None

        # ── Threat assessment (B1) — detected inbound ops ──
        threat_resp = (
            admin_supabase.table("operative_missions")
            .select("operative_type, status, source_simulation_id")
            .eq("epoch_id", epoch_id)
            .eq("target_simulation_id", simulation_id)
            .in_("status", ["detected", "captured"])
            .execute()
        )
        threats_raw = threat_resp.data or []
        # Resolve source names
        threat_source_ids = list({t["source_simulation_id"] for t in threats_raw})
        if threat_source_ids:
            threat_names_resp = (
                admin_supabase.table("simulations")
                .select("id, name")
                .in_("id", threat_source_ids)
                .execute()
            )
            threat_name_map = {s["id"]: s["name"] for s in (threat_names_resp.data or [])}
        else:
            threat_name_map = {}

        threats = [
            {
                "type": t["operative_type"],
                "status": t["status"],
                "source_name": threat_name_map.get(t["source_simulation_id"], "Unknown"),
            }
            for t in threats_raw
        ]

        # ── Spy intel digest (B2) — earned intelligence this cycle ──
        intel_resp = (
            admin_supabase.table("battle_log")
            .select("narrative, event_type, metadata, target_simulation_id")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", simulation_id)
            .eq("event_type", "intel_report")
            .eq("cycle_number", cycle_number)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        # Resolve target sim names for intel reports
        intel_target_ids = list({
            e["target_simulation_id"]
            for e in (intel_resp.data or [])
            if e.get("target_simulation_id")
        })
        if intel_target_ids:
            intel_names_resp = (
                admin_supabase.table("simulations")
                .select("id, name")
                .in_("id", intel_target_ids)
                .execute()
            )
            intel_name_map = {s["id"]: s["name"] for s in (intel_names_resp.data or [])}
        else:
            intel_name_map = {}
        spy_intel = [
            {
                "narrative": e["narrative"],
                "metadata": e.get("metadata") or {},
                "target_name": intel_name_map.get(e.get("target_simulation_id", ""), ""),
            }
            for e in (intel_resp.data or [])
        ]

        # ── Alliance status (B6) ──
        alliance_name = None
        ally_names: list[str] = []
        alliance_bonus_active = False
        dissolved_alliance_name = None
        if player_team_id:
            # Fetch team — check dissolved_at to distinguish active vs dissolved
            team_resp = (
                admin_supabase.table("epoch_teams")
                .select("name, dissolved_at, dissolved_reason")
                .eq("id", player_team_id)
                .maybe_single()
                .execute()
            )
            if team_resp.data:
                if team_resp.data.get("dissolved_at"):
                    # Team was dissolved this cycle — team_id still set
                    dissolved_alliance_name = team_resp.data["name"]
                else:
                    alliance_name = team_resp.data["name"]
                    alliance_bonus_active = True
                    # Get ally names
                    ally_resp = (
                        admin_supabase.table("epoch_participants")
                        .select("simulation_id, simulations(name)")
                        .eq("epoch_id", epoch_id)
                        .eq("team_id", player_team_id)
                        .execute()
                    )
                    ally_names = [
                        (p.get("simulations") or {}).get("name", "?")
                        for p in (ally_resp.data or [])
                        if p["simulation_id"] != simulation_id
                    ]

        # ── Alliance proposals & tension (B6b) ──
        pending_proposals_count = 0
        alliance_tension = 0
        alliance_upkeep_cost = 0
        if player_team_id and alliance_bonus_active:
            try:
                # Count pending proposals for this player's team
                team_proposals = (
                    admin_supabase.table("epoch_alliance_proposals")
                    .select("id", count="exact")
                    .eq("epoch_id", epoch_id)
                    .eq("team_id", player_team_id)
                    .eq("status", "pending")
                    .execute()
                )
                pending_proposals_count = team_proposals.count or 0
                # Get tension from team
                tension_resp = (
                    admin_supabase.table("epoch_teams")
                    .select("tension")
                    .eq("id", player_team_id)
                    .maybe_single()
                    .execute()
                )
                if tension_resp.data:
                    alliance_tension = tension_resp.data.get("tension", 0)
                # Compute upkeep cost
                member_count = len(ally_names) + 1  # +1 for self
                alliance_upkeep_cost = member_count
            except Exception:
                logger.debug("Best-effort alliance data retrieval failed", exc_info=True)

        # ── Rank gap (B3) — pass raw data, template handles i18n ──
        rank_gap = None
        if player_rank == 1 and len(current_scores) > 1:
            gap = round(composite - float(current_scores[1]["composite_score"]), 1)
            rank_gap = {"type": "leading", "gap": gap}
        elif player_rank > 1 and current_scores:
            gap = round(float(current_scores[player_rank - 2]["composite_score"]) - composite, 1)
            ahead_rank = player_rank - 1
            rank_gap = {"type": "trailing", "gap": gap, "pos": ahead_rank}

        # ── Next cycle preview (B4) ──
        pending_missions = sum(1 for o in ops if o["status"] == "active")
        rp_per_cycle = config.get("rp_per_cycle", 12)
        rp_cap = config.get("rp_cap", 40)
        projected_rp = min(rp_balance + rp_per_cycle, rp_cap)
        rp_projection = f"+{rp_per_cycle} \u2192 {projected_rp} / {rp_cap}"

        # Public battle log events from this cycle
        log_resp = (
            admin_supabase.table("battle_log")
            .select("narrative, event_type")
            .eq("epoch_id", epoch_id)
            .eq("cycle_number", cycle_number)
            .eq("is_public", True)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        public_events = [
            {"narrative": e["narrative"], "event_type": e["event_type"]}
            for e in (log_resp.data or [])
        ]

        return {
            "epoch_name": epoch_name,
            "epoch_status": epoch_status,
            "cycle_number": cycle_number,
            "rank": player_rank,
            "prev_rank": prev_rank,
            "total_players": total_players,
            "composite": round(composite, 1),
            "composite_delta": round(composite - prev_composite, 1),
            "dimensions": dim_data,
            "rp_balance": rp_balance,
            "rp_cap": rp_cap,
            "active_ops": active_ops,
            "resolved_ops": len(resolved_ops),
            "success_ops": success_ops,
            "detected_ops": detected_ops,
            "guardians": guardians,
            "counter_intel": counter_intel,
            "public_events": public_events,
            "command_center_url": command_center_url,
            # New enrichment data
            "accent_color": accent,
            "simulation_slug": simulation_slug,
            "missions": mission_details,
            "threats": threats,
            "has_threat_data": True,
            "spy_intel": spy_intel,
            "rank_gap": rank_gap,
            "alliance_name": alliance_name,
            "ally_names": ally_names,
            "alliance_bonus_active": alliance_bonus_active,
            "pending_proposals_count": pending_proposals_count,
            "alliance_tension": alliance_tension,
            "alliance_upkeep_cost": alliance_upkeep_cost,
            "dissolved_alliance_name": dissolved_alliance_name,
            "next_cycle_missions": pending_missions,
            "next_cycle_rp_projection": rp_projection,
        }

    # ── Standing snapshot for phase change (C1) ───────────

    @classmethod
    async def _build_standing_snapshot(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        simulation_id: str,
    ) -> dict | None:
        """Build a lightweight standing snapshot for phase change emails."""
        scores_resp = (
            admin_supabase.table("epoch_scores")
            .select("simulation_id, composite_score")
            .eq("epoch_id", epoch_id)
            .order("composite_score", desc=True)
            .limit(50)
            .execute()
        )
        scores = scores_resp.data or []
        if not scores:
            return None

        # Find latest cycle scores (they're already sorted by composite desc)
        rank = 0
        composite = 0.0
        for idx, s in enumerate(scores, start=1):
            if s["simulation_id"] == simulation_id:
                rank = idx
                composite = float(s["composite_score"])
                break

        if rank == 0:
            return None

        return {
            "rank": rank,
            "total_players": len(scores),
            "composite": round(composite, 1),
        }

    # ── Campaign statistics for completed email (D1) ──────

    @classmethod
    async def _build_campaign_stats(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        simulation_id: str,
    ) -> dict:
        """Build campaign statistics for epoch completed email."""
        ops_resp = (
            admin_supabase.table("operative_missions")
            .select("operative_type, status")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", simulation_id)
            .execute()
        )
        ops = ops_resp.data or []

        total = len(ops)
        resolved = [o for o in ops if o["status"] in ("success", "failed", "detected", "captured")]
        successes = sum(1 for o in resolved if o["status"] == "success")
        success_rate = (successes / len(resolved) * 100) if resolved else 0

        by_type: dict[str, int] = {}
        for o in ops:
            t = o["operative_type"]
            by_type[t] = by_type.get(t, 0) + 1

        return {
            "total_ops": total,
            "success_rate": success_rate,
            "by_type": by_type,
        }

    # ── Send Methods ───────────────────────────────────────

    @classmethod
    async def send_cycle_notifications(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        cycle_number: int,
    ) -> int:
        """Send cycle-resolved briefing emails to all human participants.

        Returns the number of emails successfully sent.
        """
        # Fetch epoch info
        epoch_resp = (
            admin_supabase.table("game_epochs")
            .select("name, status, config")
            .eq("id", epoch_id)
            .single()
            .execute()
        )
        if not epoch_resp.data:
            logger.warning("Epoch %s not found for cycle notifications", epoch_id)
            return 0

        epoch = epoch_resp.data
        epoch_name = epoch.get("name", "Unknown Operation")
        epoch_status = epoch.get("status", "competition")
        epoch_config = epoch.get("config") or {}

        recipients = await cls._resolve_recipients(
            admin_supabase, epoch_id, notification_type="cycle_resolved"
        )
        if not recipients:
            logger.info("No recipients for cycle %d notifications (epoch %s)", cycle_number, epoch_id)
            return 0

        sent_count = 0
        for recipient in recipients:
            try:
                cta_url = f"https://metaverse.center/epoch/{epoch_id}"
                briefing = await cls._build_player_briefing(
                    admin_supabase,
                    epoch_id,
                    recipient["simulation_id"],
                    cycle_number,
                    epoch_name,
                    epoch_status,
                    epoch_config=epoch_config,
                    command_center_url=cta_url,
                    simulation_slug=recipient.get("simulation_slug", ""),
                )
                briefing["simulation_name"] = recipient["simulation_name"]

                email_locale = recipient.get("email_locale")
                html_body = render_cycle_briefing(briefing, email_locale=email_locale)
                subject = f"CLASSIFIED // SITREP \u2014 {epoch_name} \u2014 Cycle {cycle_number}"

                if await EmailService.send(recipient["email"], subject, html_body):
                    sent_count += 1

                # Rate limit: 200ms between sends
                await asyncio.sleep(_SEND_DELAY_MS / 1000)

            except Exception:
                logger.warning(
                    "Failed to send cycle notification",
                    extra={"recipient": recipient["email"]},
                    exc_info=True,
                )

        logger.info(
            "Cycle notifications sent",
            extra={
                "sent_count": sent_count, "total_recipients": len(recipients),
                "cycle_number": cycle_number, "epoch_id": epoch_id,
            },
        )
        return sent_count

    @classmethod
    async def send_phase_change_notifications(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        old_phase: str,
        new_phase: str,
    ) -> int:
        """Send phase-change emails to all human participants (per-player with standing)."""
        epoch_resp = (
            admin_supabase.table("game_epochs")
            .select("name, current_cycle")
            .eq("id", epoch_id)
            .single()
            .execute()
        )
        if not epoch_resp.data:
            return 0

        epoch_name = epoch_resp.data.get("name", "Unknown Operation")
        cycle_count = epoch_resp.data.get("current_cycle", 0)

        recipients = await cls._resolve_recipients(
            admin_supabase, epoch_id, notification_type="phase_changed"
        )
        if not recipients:
            return 0

        cta_url = f"https://metaverse.center/epoch/{epoch_id}"

        # Phase-scaled subject urgency (C2)
        if new_phase == "reckoning":
            subject = f"URGENT // FINAL PHASE \u2014 {epoch_name}"
        elif old_phase == "lobby":
            subject = f"CLASSIFIED // OPERATIONS COMMENCE \u2014 {epoch_name}"
        else:
            subject = f"CLASSIFIED // PHASE TRANSITION \u2014 {epoch_name}"

        sent_count = 0
        for recipient in recipients:
            try:
                # Per-player standing data (C1)
                standing = await cls._build_standing_snapshot(
                    admin_supabase, epoch_id, recipient["simulation_id"],
                )
                accent = get_sim_accent(recipient.get("simulation_slug"))
                email_locale = recipient.get("email_locale")

                html_body = render_phase_change(
                    epoch_name=epoch_name,
                    old_phase=old_phase,
                    new_phase=new_phase,
                    cycle_count=cycle_count,
                    command_center_url=cta_url,
                    email_locale=email_locale,
                    accent_color=accent,
                    standing_data=standing,
                )

                if await EmailService.send(recipient["email"], subject, html_body):
                    sent_count += 1
                await asyncio.sleep(_SEND_DELAY_MS / 1000)
            except Exception:
                logger.warning(
                    "Failed to send phase change notification",
                    extra={"recipient": recipient["email"]},
                    exc_info=True,
                )

        logger.info(
            "Phase change notifications sent",
            extra={
                "sent_count": sent_count, "total_recipients": len(recipients),
                "old_status": old_phase, "new_status": new_phase, "epoch_id": epoch_id,
            },
        )
        return sent_count

    @classmethod
    async def send_epoch_completed_notifications(
        cls,
        admin_supabase: Client,
        epoch_id: str,
    ) -> int:
        """Send epoch-completed emails with final leaderboard + campaign stats."""
        epoch_resp = (
            admin_supabase.table("game_epochs")
            .select("name, current_cycle")
            .eq("id", epoch_id)
            .single()
            .execute()
        )
        if not epoch_resp.data:
            return 0

        epoch_name = epoch_resp.data.get("name", "Unknown Operation")
        cycle_count = epoch_resp.data.get("current_cycle", 0)

        recipients = await cls._resolve_recipients(
            admin_supabase, epoch_id, notification_type="epoch_completed"
        )
        if not recipients:
            return 0

        # Get final leaderboard
        leaderboard = await ScoringService.get_final_standings(admin_supabase, epoch_id)

        cta_url = f"https://metaverse.center/epoch/{epoch_id}"

        sent_count = 0
        for recipient in recipients:
            try:
                # Per-player campaign statistics (D1)
                campaign_stats = await cls._build_campaign_stats(
                    admin_supabase, epoch_id, recipient["simulation_id"],
                )
                accent = get_sim_accent(recipient.get("simulation_slug"))
                email_locale = recipient.get("email_locale")

                html_body = render_epoch_completed(
                    epoch_name=epoch_name,
                    leaderboard=leaderboard,
                    player_simulation_id=recipient["simulation_id"],
                    cycle_count=cycle_count,
                    command_center_url=cta_url,
                    email_locale=email_locale,
                    accent_color=accent,
                    campaign_stats=campaign_stats,
                )
                subject = f"CLASSIFIED // OPERATION COMPLETE \u2014 {epoch_name}"

                if await EmailService.send(recipient["email"], subject, html_body):
                    sent_count += 1
                await asyncio.sleep(_SEND_DELAY_MS / 1000)
            except Exception:
                logger.warning(
                    "Failed to send epoch completed notification",
                    extra={"recipient": recipient["email"]},
                    exc_info=True,
                )

        logger.info(
            "Epoch completed notifications sent",
            extra={"sent_count": sent_count, "total_recipients": len(recipients), "epoch_id": epoch_id},
        )
        return sent_count
