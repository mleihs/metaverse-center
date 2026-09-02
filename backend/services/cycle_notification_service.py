"""Cycle notification service — email notifications for epoch events.

Sends tactical briefing emails to human players when cycles resolve,
phases change, or epochs complete. Respects fog-of-war and notification
preferences. Uses SMTP for delivery. Supports single-language rendering
via email_locale and per-simulation accent colors.
"""

import asyncio
import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.models.epoch import SCORING_DIMENSIONS
from backend.models.notification import NOTIFICATION_PREFERENCE_COLUMNS
from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import (
    cycle_briefing_subject,
    epoch_completed_subject,
    get_sim_accent,
    phase_change_subject,
    render_cycle_briefing,
    render_epoch_completed,
    render_phase_change,
)
from backend.services.scoring_service import ScoringService
from backend.utils.db import maybe_single_data
from backend.utils.locale_fields import localized_field
from backend.utils.responses import extract_list
from backend.utils.unsubscribe_tokens import unsubscribe_url
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Sequential send delay between emails (ms)
_SEND_DELAY_MS = 200


class CycleNotificationService:
    """Sends email notifications for epoch lifecycle events."""

    # ── Recipient Resolution ───────────────────────────────

    @classmethod
    async def recipients_for(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        *,
        notification_type: str,
    ) -> list[dict]:
        """Public entry to the recipient chain, for senders outside this service.

        `_resolve_recipients` is the internal name and stays private; the epoch
        scheduler needs the same chain for the deadline reminder, and a
        scheduler reaching into another service's underscore is the kind of
        coupling that breaks quietly on the next rename.
        """
        return await cls._resolve_recipients(admin_supabase, epoch_id, notification_type=notification_type)

    @classmethod
    async def _resolve_recipients(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        *,
        notification_type: str = "cycle_resolved",
    ) -> list[dict]:
        """Resolve the human players of an epoch to email addresses.

        Chain: ``epoch_participants.user_id`` → ``auth.users`` → preferences.

        The recipient is **the player**, not whoever owns the world they play.
        The old chain went ``epoch_participants → simulations.source_template_id
        → simulation_members(editor+)``, i.e. it mailed the template's owners and
        never read ``epoch_participants.user_id`` (migration 049) at all. Since
        any signed-in user may enter any public template into an epoch
        (migration 214, no membership test), a stranger could play your world
        while *you* received the fog-of-war briefings including their spy intel —
        and they received nothing (E7).

        Measured on production before the change: of six epochs, one lost a
        single non-playing owner, while in three academy runs the actual player
        had not been on the list at all — two bystanders got the post instead.

        ``user_id`` is safe to rely on: migration 049 backfills it and pins it
        with ``CHECK (is_bot = true OR user_id IS NOT NULL)`` plus a unique index
        on ``(epoch_id, user_id)``, so every human participant has exactly one.

        Returns list of dicts: {user_id, email, simulation_id, simulation_name, simulation_slug, email_locale}
        """
        participants_resp = await (
            admin_supabase.table("epoch_participants")
            .select("user_id, simulation_id, simulations(name, name_de, slug, source_template_id)")
            .eq("epoch_id", epoch_id)
            .eq("is_bot", False)
            .execute()
        )
        participants = [p for p in extract_list(participants_resp) if p.get("user_id")]
        if not participants:
            return []

        user_ids = list({p["user_id"] for p in participants})

        # Email addresses via SECURITY DEFINER RPC (get_user_emails_batch, migration 044)
        email_resp = await admin_supabase.rpc("get_user_emails_batch", {"user_ids": user_ids}).execute()
        email_map: dict[str, str] = {row["id"]: row["email"] for row in (extract_list(email_resp))}

        prefs_resp = await (
            admin_supabase.table("notification_preferences")
            # Derived, not typed out: this list had drifted from the model and
            # was missing `deadline_reminder`, which the gate below would then
            # have read as its default `True` — a preference silently ignored
            # exactly where it decides whether a mail goes out.
            .select("user_id, " + ", ".join(NOTIFICATION_PREFERENCE_COLUMNS))
            .in_("user_id", user_ids)
            .execute()
        )
        prefs_map: dict[str, dict] = {row["user_id"]: row for row in (extract_list(prefs_resp))}

        # Template name + slug: the accent colour is keyed on the template slug,
        # and the player knows their world by its template name — the game
        # instance is called "Conventional Memory (Epoch 15)".
        template_ids = list(
            {
                (p.get("simulations") or {}).get("source_template_id")
                for p in participants
                if (p.get("simulations") or {}).get("source_template_id")
            }
        )
        templates: dict[str, dict] = {}
        if template_ids:
            tpl_resp = await (
                admin_supabase.table("simulations").select("id, slug, name, name_de").in_("id", template_ids).execute()
            )
            templates = {s["id"]: s for s in extract_list(tpl_resp)}

        recipients = []
        for p in participants:
            user_id = p["user_id"]
            email = email_map.get(user_id)
            if not email:
                logger.info(
                    "Epoch participant has no email address — skipped",
                    extra={"epoch_id": epoch_id, "user_id": user_id},
                )
                continue

            prefs = prefs_map.get(user_id, {})
            # Default: all notifications enabled
            if not prefs.get(notification_type, True):
                continue

            sim_info = p.get("simulations") or {}
            template = templates.get(sim_info.get("source_template_id") or "", {})
            # Die Sprache der Empfaengerin steht zwei Zeilen weiter unten im
            # selben Wörterbuch — der Weltname folgt ihr.
            mail_locale = prefs.get("email_locale", "en")
            recipients.append(
                {
                    "user_id": user_id,
                    "email": email,
                    "simulation_id": p["simulation_id"],
                    "simulation_name": (
                        localized_field(template, "name", mail_locale)
                        or localized_field(sim_info, "name", mail_locale)
                        or "Unknown"
                    ),
                    "simulation_slug": template.get("slug") or sim_info.get("slug", ""),
                    "email_locale": mail_locale,
                }
            )

        return recipients

    # ── Delivery policy ────────────────────────────────────

    # Academy runs are a training mode: three simulated days at four-hour
    # cycles resolve in one click, i.e. 18 cycles in an afternoon. Mailing each
    # one buries the player under 18 briefings about a practice match (E8). The
    # decision (B8) is: academy epochs are silent except for their closing
    # report, which is the one mail that carries a result worth keeping.
    #
    # The gate lives HERE, in the one service that sends the post, not at the
    # four call sites. It used to sit at exactly one of them
    # (``EpochLifecycleService.start_epoch``) and every later call site was
    # written without it — a policy that only holds where someone remembered it.
    _SILENT_FOR_ACADEMY = frozenset({"cycle_resolved", "phase_changed"})

    @classmethod
    def _suppressed_for_epoch(cls, epoch: dict, notification_type: str) -> bool:
        """Whether this epoch type stays silent for this kind of notification."""
        return epoch.get("epoch_type") == "academy" and notification_type in cls._SILENT_FOR_ACADEMY

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
        command_center_url: str = "",
        simulation_slug: str = "",
        participation: dict | None = None,
    ) -> dict:
        """Gather fog-of-war compliant briefing data for a single player.

        ``cycle_number`` is the **resolved** cycle — the one whose actions just
        played out. Every query below (scores, spy intel, public events, AFK
        events, auto-resolve check) is filed under that number by
        ``resolve_cycle_full``; passing the freshly incremented cycle instead
        returns empty sets across the board (E1).

        ``participation`` is the acted/total count captured before the cycle
        advanced. Without it the live ``has_acted_this_cycle`` flags are read —
        and those are reset by ``fn_advance_epoch_cycle``, so the briefing would
        always claim "0 of N acted".

        Returns dict with: rank, composite, delta, dimensions, operatives, rp, public_events,
        threats, spy_intel, missions, rank_gap, alliance info, next cycle preview
        """
        if not command_center_url:
            command_center_url = f"{settings.site_url}/epoch"
        config = epoch_config or {}
        accent = get_sim_accent(simulation_slug)

        # ── Parallel Batch 1: Scores (current + previous) + RP balance ──
        # These 3 queries are independent and can run concurrently.
        prev_cycle = cycle_number - 1

        async def _scores_current():
            resp = await (
                admin_supabase.table("epoch_scores")
                .select(
                    "simulation_id, composite_score,"
                    " stability_score, influence_score, sovereignty_score,"
                    " diplomatic_score, military_score"
                )
                .eq("epoch_id", epoch_id)
                .eq("cycle_number", cycle_number)
                .order("composite_score", desc=True)
                .execute()
            )
            return extract_list(resp)

        async def _scores_prev():
            if prev_cycle < 1:
                return {}
            resp = await (
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
            return {s["simulation_id"]: s for s in extract_list(resp)}

        async def _participant_data():
            return await maybe_single_data(
                admin_supabase.table("epoch_participants")
                .select("current_rp, team_id")
                .eq("epoch_id", epoch_id)
                .eq("simulation_id", simulation_id)
                .maybe_single()
            )

        current_scores, prev_scores_map, rp_data = await asyncio.gather(
            _scores_current(),
            _scores_prev(),
            _participant_data(),
        )

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
                dim_data.append(
                    {
                        "name": dim,
                        "value": round(current_val, 1),
                        "delta": round(current_val - prev_val, 1),
                    }
                )

        composite = float(player_score["composite_score"]) if player_score else 0
        prev_composite = float(prev_score.get("composite_score", 0)) if prev_score else 0

        # ── Parallel Batch 2: Outbound ops + Inbound threats ─────
        async def _outbound_ops():
            resp = await (
                admin_supabase.table("operative_missions")
                .select("operative_type, status, target_simulation_id, resolves_at")
                .eq("epoch_id", epoch_id)
                .eq("source_simulation_id", simulation_id)
                .execute()
            )
            return extract_list(resp)

        async def _inbound_threats():
            resp = await (
                admin_supabase.table("operative_missions")
                .select("operative_type, status, source_simulation_id")
                .eq("epoch_id", epoch_id)
                .eq("target_simulation_id", simulation_id)
                .in_("status", ["detected", "captured"])
                .execute()
            )
            return extract_list(resp)

        ops, threats_raw = await asyncio.gather(_outbound_ops(), _inbound_threats())

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
            names_resp = await (
                admin_supabase.table("simulations").select("id, name").in_("id", target_sim_ids).execute()
            )
            sim_name_map = {s["id"]: s["name"] for s in (extract_list(names_resp))}

        # Per-mission detail list
        mission_details = []
        for o in ops:
            if o["operative_type"] in ("guardian", "counter_intel"):
                continue
            target_name = sim_name_map.get(o.get("target_simulation_id", ""), "?")
            mission_details.append({"type": o["operative_type"], "target_name": target_name, "status": o["status"]})

        # RP balance (already fetched in Batch 1)
        rp_balance = rp_data.get("current_rp", 0) if rp_data else 0
        player_team_id = rp_data.get("team_id") if rp_data else None
        # Resolve source names
        threat_source_ids = list({t["source_simulation_id"] for t in threats_raw})
        if threat_source_ids:
            threat_names_resp = await (
                admin_supabase.table("simulations").select("id, name").in_("id", threat_source_ids).execute()
            )
            threat_name_map = {s["id"]: s["name"] for s in (extract_list(threat_names_resp))}
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
        intel_resp = await (
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
        intel_target_ids = list(
            {e["target_simulation_id"] for e in (extract_list(intel_resp)) if e.get("target_simulation_id")}
        )
        if intel_target_ids:
            intel_names_resp = await (
                admin_supabase.table("simulations").select("id, name").in_("id", intel_target_ids).execute()
            )
            intel_name_map = {s["id"]: s["name"] for s in (extract_list(intel_names_resp))}
        else:
            intel_name_map = {}
        spy_intel = [
            {
                "narrative": e["narrative"],
                "metadata": e.get("metadata") or {},
                "target_name": intel_name_map.get(e.get("target_simulation_id", ""), ""),
            }
            for e in (extract_list(intel_resp))
        ]

        # ── Alliance status (B6) ──
        alliance_name = None
        ally_names: list[str] = []
        alliance_bonus_active = False
        dissolved_alliance_name = None
        if player_team_id:
            # Fetch team — check dissolved_at to distinguish active vs dissolved
            team_data = await maybe_single_data(
                admin_supabase.table("epoch_teams")
                .select("name, dissolved_at, dissolved_reason")
                .eq("id", player_team_id)
                .maybe_single()
            )
            if team_data:
                if team_data.get("dissolved_at"):
                    # Team was dissolved this cycle — team_id still set
                    dissolved_alliance_name = team_data["name"]
                else:
                    alliance_name = team_data["name"]
                    alliance_bonus_active = True
                    # Get ally names
                    ally_resp = await (
                        admin_supabase.table("epoch_participants")
                        .select("simulation_id, simulations(name, name_de)")
                        .eq("epoch_id", epoch_id)
                        .eq("team_id", player_team_id)
                        .execute()
                    )
                    ally_names = [
                        (p.get("simulations") or {}).get("name", "?")
                        for p in (extract_list(ally_resp))
                        if p["simulation_id"] != simulation_id
                    ]

        # ── Alliance proposals & tension (B6b) ──
        pending_proposals_count = 0
        alliance_tension = 0
        alliance_upkeep_cost = 0
        if player_team_id and alliance_bonus_active:
            try:
                # Count pending proposals for this player's team
                team_proposals = await (
                    admin_supabase.table("epoch_alliance_proposals")
                    .select("id", count="exact")
                    .eq("epoch_id", epoch_id)
                    .eq("team_id", player_team_id)
                    .eq("status", "pending")
                    .execute()
                )
                pending_proposals_count = team_proposals.count or 0
                # Get tension from team
                tension_data = await maybe_single_data(
                    admin_supabase.table("epoch_teams").select("tension").eq("id", player_team_id).maybe_single()
                )
                if tension_data:
                    alliance_tension = tension_data.get("tension", 0)
                # Compute upkeep cost
                member_count = len(ally_names) + 1  # +1 for self
                alliance_upkeep_cost = member_count
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
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
        log_resp = await (
            admin_supabase.table("battle_log")
            .select("narrative, event_type")
            .eq("epoch_id", epoch_id)
            .eq("cycle_number", cycle_number)
            .eq("is_public", True)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        public_events = [{"narrative": e["narrative"], "event_type": e["event_type"]} for e in (extract_list(log_resp))]

        # ── Auto-resolve & AFK data (Phase 7) ────────────────
        # Query AFK events + auto-resolve event for this player + cycle
        async def _afk_events():
            resp = await (
                admin_supabase.table("battle_log")
                .select("event_type, metadata")
                .eq("epoch_id", epoch_id)
                .eq("cycle_number", cycle_number)
                .in_("event_type", ["player_afk", "player_afk_penalty", "player_afk_ai_takeover"])
                .or_(f"source_simulation_id.eq.{simulation_id},target_simulation_id.eq.{simulation_id}")
                .execute()
            )
            return extract_list(resp)

        async def _auto_resolve_check():
            resp = await (
                admin_supabase.table("battle_log")
                .select("metadata")
                .eq("epoch_id", epoch_id)
                .eq("cycle_number", cycle_number)
                .eq("event_type", "cycle_auto_resolved")
                .limit(1)
                .execute()
            )
            return bool(extract_list(resp))

        async def _participation_counts():
            resp = await (
                admin_supabase.table("epoch_participants")
                .select("has_acted_this_cycle, is_bot, consecutive_afk_cycles, afk_replaced_by_ai")
                .eq("epoch_id", epoch_id)
                .execute()
            )
            participants = extract_list(resp)
            humans = [p for p in participants if not p.get("is_bot")]
            acted = sum(1 for p in humans if p.get("has_acted_this_cycle"))
            return {"acted": acted, "total": len(humans)}

        if participation is None:
            afk_events, auto_resolved, participation = await asyncio.gather(
                _afk_events(),
                _auto_resolve_check(),
                _participation_counts(),
            )
        else:
            afk_events, auto_resolved = await asyncio.gather(_afk_events(), _auto_resolve_check())

        player_was_afk = any(e["event_type"] == "player_afk" for e in afk_events)
        afk_penalty_rp = sum(
            (e.get("metadata") or {}).get("rp_loss", 0) for e in afk_events if e["event_type"] == "player_afk_penalty"
        )
        replaced_by_ai = any(e["event_type"] == "player_afk_ai_takeover" for e in afk_events)
        afk_ai_personality = config.get("afk_ai_personality", "sentinel")
        # Read, never assumed: `afk_penalty_enabled` defaults to FALSE and the
        # penalty to 2 RP, so a mail that states a cost without checking would
        # threaten most readers with a punishment their epoch does not apply.
        afk_penalty_enabled = bool(config.get("afk_penalty_enabled", False))
        afk_rp_penalty = int(config.get("afk_rp_penalty", 2))
        consecutive_afk = sum(
            1 for e in afk_events if e["event_type"] in ("player_afk", "player_afk_penalty", "player_afk_ai_takeover")
        )
        deadline_minutes = config.get("cycle_deadline_minutes")

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
            # Auto-resolve & AFK (Phase 7)
            "auto_resolved": auto_resolved,
            "player_was_afk": player_was_afk,
            "afk_penalty_rp": afk_penalty_rp,
            "replaced_by_ai": replaced_by_ai,
            "afk_ai_personality": afk_ai_personality,
            "consecutive_afk": consecutive_afk,
            "participation_summary": participation,
            "cycle_deadline_minutes": deadline_minutes,
            "afk_penalty_enabled": afk_penalty_enabled,
            "afk_rp_penalty": afk_rp_penalty,
        }

    # ── Standing snapshot for phase change (C1) ───────────

    @classmethod
    async def _build_standing_snapshot(
        cls,
        admin_supabase: Client,
        epoch_id: str,
        simulation_id: str,
        *,
        scored_cycle: int | None = None,
    ) -> dict | None:
        """Build a lightweight standing snapshot for phase change emails.

        Scoped to a single cycle. Without the filter the query returned one row
        per player PER CYCLE — four players over five cycles ranked as
        "rank 7 of 20", and the `LIMIT 50` silently truncated longer epochs (E5).
        """
        if scored_cycle is None:
            scored_cycle = await ScoringService.resolve_latest_scored_cycle(admin_supabase, UUID(epoch_id))

        scores_resp = await (
            admin_supabase.table("epoch_scores")
            .select("simulation_id, composite_score")
            .eq("epoch_id", epoch_id)
            .eq("cycle_number", scored_cycle)
            .order("composite_score", desc=True)
            .execute()
        )
        scores = extract_list(scores_resp)
        if not scores:
            return None

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
        ops_resp = await (
            admin_supabase.table("operative_missions")
            .select("operative_type, status")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", simulation_id)
            .execute()
        )
        ops = extract_list(ops_resp)

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
        *,
        participation: dict | None = None,
    ) -> int:
        """Send cycle-resolved briefing emails to all human participants.

        ``cycle_number`` is the resolved cycle (see ``_build_player_briefing``).
        ``participation`` is the acted/total snapshot taken before the advance.

        Returns the number of emails successfully sent.
        """
        # Fetch epoch info
        epoch = await maybe_single_data(
            admin_supabase.table("game_epochs")
            .select("name, status, config, epoch_type")
            .eq("id", epoch_id)
            .maybe_single()
        )
        if not epoch:
            logger.warning("Epoch %s not found for cycle notifications", epoch_id)
            return 0
        if cls._suppressed_for_epoch(epoch, "cycle_resolved"):
            logger.info(
                "Academy epoch — cycle briefing suppressed",
                extra={"epoch_id": epoch_id, "cycle_number": cycle_number},
            )
            return 0

        epoch_name = epoch.get("name", "Unknown Operation")
        epoch_status = epoch.get("status", "competition")
        epoch_config = epoch.get("config") or {}

        recipients = await cls._resolve_recipients(admin_supabase, epoch_id, notification_type="cycle_resolved")
        if not recipients:
            logger.info("No recipients for cycle %d notifications (epoch %s)", cycle_number, epoch_id)
            return 0

        sent_count = 0
        for recipient in recipients:
            try:
                cta_url = f"{settings.site_url}/epoch/{epoch_id}"
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
                    participation=participation,
                )
                briefing["simulation_name"] = recipient["simulation_name"]

                email_locale = recipient.get("email_locale")
                opt_out = unsubscribe_url(recipient["user_id"], "cycle_resolved")
                html_body = render_cycle_briefing(briefing, email_locale=email_locale, unsubscribe_url=opt_out)
                # The change goes first. The old line spent its first 25
                # characters on "CLASSIFIED // SITREP", a word identical in
                # every message the platform has ever sent, and a phone shows
                # roughly 35 (handoff P1.8).
                subject = cycle_briefing_subject(briefing, email_locale)

                if await EmailService.send(
                    recipient["email"],
                    subject,
                    html_body,
                    unsubscribe_url=opt_out,
                    record=MailRecord(
                        template="cycle_briefing",
                        user_id=recipient["user_id"],
                        epoch_id=epoch_id,
                        simulation_id=recipient["simulation_id"],
                        cycle_number=cycle_number,
                    ),
                ):
                    sent_count += 1

                # Rate limit: 200ms between sends
                await asyncio.sleep(_SEND_DELAY_MS / 1000)

            except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Failed to send cycle notification",
                    extra={"recipient": recipient["email"]},
                    exc_info=True,
                )

        logger.info(
            "Cycle notifications sent",
            extra={
                "sent_count": sent_count,
                "total_recipients": len(recipients),
                "cycle_number": cycle_number,
                "epoch_id": epoch_id,
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
        epoch = await maybe_single_data(
            admin_supabase.table("game_epochs")
            .select("name, current_cycle, epoch_type")
            .eq("id", epoch_id)
            .maybe_single()
        )
        if not epoch:
            return 0

        if cls._suppressed_for_epoch(epoch, "phase_changed"):
            logger.info(
                "Academy epoch — phase change mail suppressed",
                extra={"epoch_id": epoch_id, "old_status": old_phase, "new_status": new_phase},
            )
            return 0

        epoch_name = epoch.get("name", "Unknown Operation")
        cycle_count = epoch.get("current_cycle", 0)

        recipients = await cls._resolve_recipients(admin_supabase, epoch_id, notification_type="phase_changed")
        if not recipients:
            return 0

        cta_url = f"{settings.site_url}/epoch/{epoch_id}"

        # Resolve the ranked cycle ONCE, not per recipient — every player in an
        # epoch is ranked against the same cycle.
        scored_cycle = await ScoringService.resolve_latest_scored_cycle(admin_supabase, UUID(epoch_id))

        sent_count = 0
        for recipient in recipients:
            try:
                # Per-player standing data (C1)
                standing = await cls._build_standing_snapshot(
                    admin_supabase,
                    epoch_id,
                    recipient["simulation_id"],
                    scored_cycle=scored_cycle,
                )
                accent = get_sim_accent(recipient.get("simulation_slug"))
                email_locale = recipient.get("email_locale")
                # Localized per recipient. The subject used to be built once,
                # in English, for everyone — the body followed the reader's
                # language and the subject did not (E15).
                subject = phase_change_subject(epoch_name, old_phase, new_phase, email_locale)

                opt_out = unsubscribe_url(recipient["user_id"], "phase_changed")
                html_body = render_phase_change(
                    epoch_name=epoch_name,
                    old_phase=old_phase,
                    new_phase=new_phase,
                    cycle_count=cycle_count,
                    command_center_url=cta_url,
                    email_locale=email_locale,
                    accent_color=accent,
                    standing_data=standing,
                    unsubscribe_url=opt_out,
                )

                if await EmailService.send(
                    recipient["email"],
                    subject,
                    html_body,
                    unsubscribe_url=opt_out,
                    record=MailRecord(
                        template="phase_change",
                        user_id=recipient["user_id"],
                        epoch_id=epoch_id,
                        simulation_id=recipient["simulation_id"],
                        cycle_number=cycle_count,
                    ),
                ):
                    sent_count += 1
                await asyncio.sleep(_SEND_DELAY_MS / 1000)
            except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Failed to send phase change notification",
                    extra={"recipient": recipient["email"]},
                    exc_info=True,
                )

        logger.info(
            "Phase change notifications sent",
            extra={
                "sent_count": sent_count,
                "total_recipients": len(recipients),
                "old_status": old_phase,
                "new_status": new_phase,
                "epoch_id": epoch_id,
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
        epoch = await maybe_single_data(
            admin_supabase.table("game_epochs").select("name, current_cycle").eq("id", epoch_id).maybe_single()
        )
        if not epoch:
            return 0

        epoch_name = epoch.get("name", "Unknown Operation")
        cycle_count = epoch.get("current_cycle", 0)

        recipients = await cls._resolve_recipients(admin_supabase, epoch_id, notification_type="epoch_completed")
        if not recipients:
            return 0

        # Get final leaderboard
        leaderboard = await ScoringService.get_final_standings(admin_supabase, epoch_id, admin_supabase=admin_supabase)

        cta_url = f"{settings.site_url}/epoch/{epoch_id}"

        sent_count = 0
        for recipient in recipients:
            try:
                # Per-player campaign statistics (D1)
                campaign_stats = await cls._build_campaign_stats(
                    admin_supabase,
                    epoch_id,
                    recipient["simulation_id"],
                )
                accent = get_sim_accent(recipient.get("simulation_slug"))
                email_locale = recipient.get("email_locale")

                opt_out = unsubscribe_url(recipient["user_id"], "epoch_completed")
                html_body = render_epoch_completed(
                    epoch_name=epoch_name,
                    leaderboard=leaderboard,
                    player_simulation_id=recipient["simulation_id"],
                    cycle_count=cycle_count,
                    command_center_url=cta_url,
                    email_locale=email_locale,
                    accent_color=accent,
                    campaign_stats=campaign_stats,
                    unsubscribe_url=opt_out,
                )
                subject = epoch_completed_subject(epoch_name, leaderboard, recipient["simulation_id"], email_locale)

                if await EmailService.send(
                    recipient["email"],
                    subject,
                    html_body,
                    unsubscribe_url=opt_out,
                    record=MailRecord(
                        template="epoch_completed",
                        user_id=recipient["user_id"],
                        epoch_id=epoch_id,
                        simulation_id=recipient["simulation_id"],
                        cycle_number=cycle_count,
                    ),
                ):
                    sent_count += 1
                await asyncio.sleep(_SEND_DELAY_MS / 1000)
            except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
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
