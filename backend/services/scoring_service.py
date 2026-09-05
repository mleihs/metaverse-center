"""Epoch scoring — 5-dimension scoring, normalization, and compositing."""

import logging
from uuid import UUID

from backend.models.epoch import DEFAULT_EPOCH_CONFIG
from backend.services.epoch_service import EpochService
from backend.utils.db import resolve_epoch_sim_names
from backend.utils.errors import bad_request
from backend.utils.responses import extract_list
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = DEFAULT_EPOCH_CONFIG


class ScoringService:
    """Service for computing and querying epoch scores."""

    # ── Score Computation ─────────────────────────────────

    @classmethod
    async def compute_cycle_scores(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
    ) -> list[dict]:
        """Compute and store scores for all participants in the current cycle.

        Uses ``fn_compute_cycle_scores`` RPC (migration 127, updated 187) which:
        1. Atomically refreshes all materialized views within the function
           (CONCURRENTLY with non-concurrent fallback — eliminates the 6%
           staleness failure rate from the previous two-call pattern)
        2. Computes raw scores across 5 dimensions via CTEs
        3. Normalises per-dimension (max-scaling to 0-100)
        4. Applies weighted composite and upserts into epoch_scores

        Guardian overcome bonus (migration 187): attackers earn +2 military
        per active guardian at the target (capped at +4).
        """
        logger.info("Computing cycle scores", extra={"epoch_id": str(epoch_id), "cycle_number": cycle_number})

        epoch = await EpochService.get(supabase, epoch_id)
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        weights = config.get("score_weights", {})
        score_weights = {
            "stability": weights.get("stability", 25),
            "influence": weights.get("influence", 20),
            "sovereignty": weights.get("sovereignty", 20),
            "diplomatic": weights.get("diplomatic", 15),
            "military": weights.get("military", 20),
        }

        # SECDEF privileged write: service_role only (ADR-006 / migration 258).
        admin = await get_admin_supabase_client()
        resp = await admin.rpc(
            "fn_compute_cycle_scores",
            {
                "p_epoch_id": str(epoch_id),
                "p_cycle_number": cycle_number,
                "p_score_weights": score_weights,
            },
        ).execute()

        scores = extract_list(resp)
        if not scores:
            logger.error(
                "Scoring RPC returned no data – no participants in epoch?",
                extra={"epoch_id": str(epoch_id), "cycle_number": cycle_number},
            )

        return scores

    # Per-dimension scoring lives in SQL: fn_compute_cycle_scores
    # (migration 127, refreshed in 187) computes all five raw dimensions,
    # normalises them and applies the weighted composite in one statement.
    # A parallel Python implementation of the same rules used to live here
    # (_compute_raw_scores + five _compute_* helpers + _normalize_and_composite,
    # ~330 lines). Nothing called it after the RPC landed — only its own unit
    # tests did. Two sources of truth for the scoring rules, one of them
    # unreachable and green: tuning the Python changed nothing in production
    # while the tests kept passing. Deleted; the SQL function is the rules.

    # ── Leaderboard ───────────────────────────────────────

    @classmethod
    async def resolve_latest_scored_cycle(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        epoch: dict | None = None,
    ) -> int:
        """Return the highest cycle that actually carries score rows.

        ``epoch_scores`` is the only honest source: ``game_epochs.current_cycle``
        points one past the last resolved cycle, so reading it directly yields an
        empty set for a completed epoch. Any surface that ranks players without
        naming a cycle must go through here — a query across ALL cycles returns
        one row per player per cycle and produces "rank 7 of 20" in a four-player
        epoch (E5).

        ``epoch`` may be passed by callers that already fetched the row.
        """
        max_resp = await (
            supabase.table("epoch_scores")
            .select("cycle_number")
            .eq("epoch_id", str(epoch_id))
            .order("cycle_number", desc=True)
            .limit(1)
            .execute()
        )
        if max_resp.data:
            return int(max_resp.data[0]["cycle_number"])

        # No scores exist — fall back to the last resolved cycle.
        if epoch is None:
            epoch = await EpochService.get(supabase, epoch_id)
        cycle_number = max(1, epoch.get("current_cycle", 1) - 1)
        logger.warning(
            "No epoch_scores found – falling back to cycle %d",
            cycle_number,
            extra={"epoch_id": str(epoch_id)},
        )
        return cycle_number

    @classmethod
    async def get_leaderboard(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int | None = None,
        *,
        admin_supabase: Client | None = None,
    ) -> list[dict]:
        """Get the leaderboard for an epoch (optionally at a specific cycle).

        Returns entries sorted by composite_score descending, with rank and
        simulation details. Uses a single query to fetch scores + simulation
        info, and a batch query for team assignments (avoids N+1).

        ``admin_supabase`` bypasses RLS for cross-player sim name resolution.
        Game instance names are mapped back to their template names so the
        leaderboard shows "Conventional Memory" instead of
        "Conventional Memory (Epoch 15)".
        """
        epoch = await EpochService.get(supabase, epoch_id)

        if cycle_number is None:
            cycle_number = await cls.resolve_latest_scored_cycle(supabase, epoch_id, epoch=epoch)

        resp = await (
            supabase.table("epoch_scores")
            .select(
                "id, epoch_id, simulation_id, cycle_number,"
                " stability_score, influence_score, sovereignty_score,"
                " diplomatic_score, military_score, composite_score"
            )
            .eq("epoch_id", str(epoch_id))
            .eq("cycle_number", cycle_number)
            .order("composite_score", desc=True)
            .execute()
        )

        scores = extract_list(resp)
        if not scores:
            return []

        # Batch-fetch simulation display names. Uses admin client to bypass
        # RLS (cross-player sims) and resolves game-instance names back to
        # their template names via source_template_id.
        score_sim_ids = [s["simulation_id"] for s in scores]
        sim_map = await resolve_epoch_sim_names(admin_supabase or supabase, score_sim_ids)

        # Batch-fetch all participant team assignments + betrayal data for this epoch
        participants_resp = await (
            supabase.table("epoch_participants")
            .select("simulation_id, team_id, betrayal_penalty, epoch_teams(name)")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        team_by_sim: dict[str, str | None] = {}
        betrayal_by_sim: dict[str, float] = {}
        team_id_by_sim: dict[str, str | None] = {}
        for p in extract_list(participants_resp):
            team = p.get("epoch_teams")
            sim_id = p["simulation_id"]
            team_by_sim[sim_id] = team.get("name") if team else None
            team_id_by_sim[sim_id] = p.get("team_id")
            betrayal_by_sim[sim_id] = float(p.get("betrayal_penalty") or 0)

        # Compute ally counts per team
        ally_counts: dict[str, int] = {}
        for sim_id, tid in team_id_by_sim.items():
            if tid:
                count = sum(1 for s, t in team_id_by_sim.items() if t == tid and s != sim_id)
                ally_counts[sim_id] = count
            else:
                ally_counts[sim_id] = 0

        # Dense ranking: tied composite scores share the same rank
        entries = []
        current_rank = 1
        for idx, score in enumerate(scores):
            if idx > 0 and float(score["composite_score"]) < float(scores[idx - 1]["composite_score"]):
                current_rank = idx + 1
            sim_id = score["simulation_id"]
            sim = sim_map.get(sim_id, {})
            ac = ally_counts.get(sim_id, 0)
            entries.append(
                {
                    "rank": current_rank,
                    "simulation_id": sim_id,
                    "simulation_name": sim.get("name", "Unknown"),
                    "simulation_slug": sim.get("slug"),
                    "team_name": team_by_sim.get(sim_id),
                    "stability": float(score["stability_score"]),
                    "influence": float(score["influence_score"]),
                    "sovereignty": float(score["sovereignty_score"]),
                    "diplomatic": float(score["diplomatic_score"]),
                    "military": float(score["military_score"]),
                    "composite": float(score["composite_score"]),
                    "ally_count": ac,
                    "ally_bonus_pct": round(ac * 15, 1),
                    "betrayal_penalty": betrayal_by_sim.get(sim_id, 0.0),
                }
            )

        return entries

    @classmethod
    async def get_intel_dossiers(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        *,
        admin_supabase: Client | None = None,
    ) -> list[dict]:
        """Get pre-aggregated intel dossiers for a simulation's spy reports.

        Groups intel_report battle_log entries by target_simulation_id,
        uses the latest report per target, and computes a staleness flag.
        """
        staleness_threshold = 5

        epoch = await EpochService.get(supabase, epoch_id)
        current_cycle = epoch.get("current_cycle", 1)

        # Fetch intel reports from this simulation
        intel_resp = await (
            supabase.table("battle_log")
            .select("*, simulations:target_simulation_id(name, slug)")
            .eq("epoch_id", str(epoch_id))
            .eq("source_simulation_id", str(simulation_id))
            .eq("event_type", "intel_report")
            .order("cycle_number", desc=True)
            .execute()
        )
        reports = extract_list(intel_resp)

        # Group by target, use latest report per target
        by_target: dict[str, list[dict]] = {}
        for r in reports:
            target = r.get("target_simulation_id")
            if target:
                by_target.setdefault(target, []).append(r)

        # Resolve target sim names via admin client (bypasses RLS, uses template names)
        target_sim_ids = list(by_target.keys())
        target_sim_map = await resolve_epoch_sim_names(admin_supabase or supabase, target_sim_ids)

        dossiers = []
        for target_sim_id, target_reports in by_target.items():
            latest = target_reports[0]  # already sorted desc
            meta = latest.get("metadata") or {}
            sim_info = target_sim_map.get(target_sim_id, {})

            last_intel_cycle = latest.get("cycle_number", 0)
            dossiers.append(
                {
                    "simulation_id": target_sim_id,
                    "simulation_name": sim_info.get("name", target_sim_id[:8]),
                    "simulation_slug": sim_info.get("slug"),
                    "zone_security_levels": meta.get("zone_security", []),
                    "zone_details": meta.get("zone_details", []),
                    "guardian_count": meta.get("guardian_count", 0),
                    "fortifications": meta.get("fortifications", []),
                    "last_intel_cycle": last_intel_cycle,
                    "report_count": len(target_reports),
                    "is_stale": (current_cycle - last_intel_cycle) > staleness_threshold,
                }
            )

        # Sort by most recently gathered first
        dossiers.sort(key=lambda d: d["last_intel_cycle"], reverse=True)
        return dossiers

    @classmethod
    async def get_score_history(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """Get all cycle scores for a simulation in an epoch."""
        resp = await (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .order("cycle_number")
            .execute()
        )
        return extract_list(resp)

    @classmethod
    async def get_results_summary(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Get comprehensive results summary for a completed epoch.

        Returns declassified data: standings, per-participant operation
        statistics, MVP awards, and score history. Only available for
        completed epochs (fog of war lifted).
        """
        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "completed":
            raise bad_request("Results summary only available for completed epochs.")

        standings = await cls.get_final_standings(supabase, epoch_id, admin_supabase=admin_supabase)

        # Per-participant operation statistics — batch query (no N+1)
        # Use admin client: epoch is completed so fog-of-war is lifted.
        # User-scoped client cannot read other players' outbound missions
        # (RLS restricts to own source/target), causing missing awards (BUG-013).
        db = admin_supabase or supabase
        participants = await EpochService.list_participants(db, epoch_id)
        sim_ids = [p["simulation_id"] for p in participants]

        # Single batch query for all mission stats
        all_missions_resp = await (
            db.table("operative_missions")
            .select("source_simulation_id, operative_type, status")
            .eq("epoch_id", str(epoch_id))
            .in_("source_simulation_id", sim_ids)
            .execute()
        )
        # Group by source_simulation_id in Python
        missions_by_sim: dict[str, list[dict]] = {sid: [] for sid in sim_ids}
        for m in extract_list(all_missions_resp):
            sid = m["source_simulation_id"]
            if sid in missions_by_sim:
                missions_by_sim[sid].append(m)

        # Defensive action counts from battle_log (CI sweeps + fortifications).
        # These are instant actions not tracked in operative_missions.
        # Include cycle_number to deduplicate CI sweeps: one sweep can log
        # N events (one per detected threat). Count distinct (sim, cycle) pairs.
        defensive_resp = await (
            db.table("battle_log")
            .select("source_simulation_id, event_type, cycle_number")
            .eq("epoch_id", str(epoch_id))
            .in_("event_type", ["counter_intel", "zone_fortified"])
            .in_("source_simulation_id", sim_ids)
            .execute()
        )
        ci_sweeps_seen: set[tuple[str, int]] = set()
        ci_by_sim: dict[str, int] = dict.fromkeys(sim_ids, 0)
        fort_by_sim: dict[str, int] = dict.fromkeys(sim_ids, 0)
        for entry in extract_list(defensive_resp):
            sid = entry["source_simulation_id"]
            if entry["event_type"] == "counter_intel":
                # Deduplicate: one sweep per (sim, cycle), not per detection
                sweep_key = (sid, entry["cycle_number"])
                if sweep_key not in ci_sweeps_seen:
                    ci_sweeps_seen.add(sweep_key)
                    ci_by_sim[sid] = ci_by_sim.get(sid, 0) + 1
            elif entry["event_type"] == "zone_fortified":
                fort_by_sim[sid] = fort_by_sim.get(sid, 0) + 1

        participant_stats = []
        for sid in sim_ids:
            missions = missions_by_sim.get(sid, [])
            total_ops = len(missions)
            successes = sum(1 for m in missions if m["status"] == "success")
            failures = sum(1 for m in missions if m["status"] in ("failed", "detected", "captured"))
            detections = sum(1 for m in missions if m["status"] in ("detected", "captured"))
            captured = sum(1 for m in missions if m["status"] == "captured")
            success_rate = round(successes / total_ops, 2) if total_ops > 0 else 0.0

            participant_stats.append(
                {
                    "simulation_id": sid,
                    "total_operations": total_ops,
                    "successes": successes,
                    "failures": failures,
                    "detections": detections,
                    "captured": captured,
                    "success_rate": success_rate,
                    "counter_intel_sweeps": ci_by_sim.get(sid, 0),
                    "fortifications": fort_by_sim.get(sid, 0),
                }
            )

        # MVP Awards
        mvp_awards = cls._compute_mvp_awards(standings, participant_stats)

        # Score history — batch query for all participants (no N+1)
        all_scores_resp = await (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .in_("simulation_id", sim_ids)
            .order("cycle_number")
            .execute()
        )
        score_history: dict[str, list[dict]] = {sid: [] for sid in sim_ids}
        for s in extract_list(all_scores_resp):
            sid = s["simulation_id"]
            if sid in score_history:
                score_history[sid].append(s)

        return {
            "epoch": {
                "id": str(epoch_id),
                "name": epoch.get("name", ""),
                "epoch_type": epoch.get("epoch_type", "competitive"),
                "status": epoch["status"],
                "current_cycle": epoch.get("current_cycle", 1),
            },
            "standings": standings,
            "participant_stats": participant_stats,
            "mvp_awards": mvp_awards,
            "score_history": score_history,
        }

    @staticmethod
    def _compute_mvp_awards(
        standings: list[dict],
        participant_stats: list[dict],
    ) -> list[dict]:
        """Compute MVP awards based on final standings and operation stats."""
        awards: list[dict] = []
        if not standings:
            return awards

        # Master Spy — highest military score
        best_military = max(standings, key=lambda e: e.get("military", 0))
        if best_military.get("military", 0) > 0:
            awards.append(
                {
                    "title": "Master Spy",
                    "description": "Highest military score – supreme covert operations.",
                    "simulation_id": best_military["simulation_id"],
                    "simulation_name": best_military.get("simulation_name", ""),
                    "value": best_military["military"],
                }
            )

        # Iron Guardian — highest sovereignty score
        best_sovereignty = max(standings, key=lambda e: e.get("sovereignty", 0))
        if best_sovereignty.get("sovereignty", 0) > 0:
            awards.append(
                {
                    "title": "Iron Guardian",
                    "description": "Highest sovereignty – impenetrable defenses.",
                    "simulation_id": best_sovereignty["simulation_id"],
                    "simulation_name": best_sovereignty.get("simulation_name", ""),
                    "value": best_sovereignty["sovereignty"],
                }
            )

        # The Diplomat — highest diplomatic score
        best_diplomatic = max(standings, key=lambda e: e.get("diplomatic", 0))
        if best_diplomatic.get("diplomatic", 0) > 0:
            awards.append(
                {
                    "title": "The Diplomat",
                    "description": "Highest diplomatic score – master of alliances.",
                    "simulation_id": best_diplomatic["simulation_id"],
                    "simulation_name": best_diplomatic.get("simulation_name", ""),
                    "value": best_diplomatic["diplomatic"],
                }
            )

        # Most Lethal — highest success rate with minimum operations
        best_rate = None
        best_rate_val = 0.0
        for stat in participant_stats:
            if stat["total_operations"] >= 3 and stat["success_rate"] > best_rate_val:
                best_rate_val = stat["success_rate"]
                best_rate = stat
        if best_rate:
            sim_name = next(
                (s.get("simulation_name", "") for s in standings if s["simulation_id"] == best_rate["simulation_id"]),
                "",
            )
            awards.append(
                {
                    "title": "Most Lethal",
                    "description": "Highest success rate – surgical precision.",
                    "simulation_id": best_rate["simulation_id"],
                    "simulation_name": sim_name,
                    "value": round(best_rate_val * 100),
                }
            )

        # Cultural Domination — highest influence score
        best_influence = max(standings, key=lambda e: e.get("influence", 0))
        if best_influence.get("influence", 0) > 0:
            awards.append(
                {
                    "title": "Cultural Domination",
                    "description": "Highest influence – reshaping the narrative.",
                    "simulation_id": best_influence["simulation_id"],
                    "simulation_name": best_influence.get("simulation_name", ""),
                    "value": best_influence["influence"],
                }
            )

        return awards

    @classmethod
    async def get_final_standings(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        admin_supabase: Client | None = None,
    ) -> list[dict]:
        """Get final standings for a completed epoch.

        Returns the last cycle's leaderboard plus dimension titles.
        """
        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] not in ("completed", "cancelled"):
            raise bad_request("Final standings only available for completed or cancelled epochs.")

        leaderboard = await cls.get_leaderboard(supabase, epoch_id, admin_supabase=admin_supabase)

        # Award dimension titles
        titles = {
            "stability": "The Unshaken",
            "influence": "The Resonant",
            "sovereignty": "The Sovereign",
            "diplomatic": "The Architect",
            "military": "The Shadow",
        }

        for dim, title in titles.items():
            if leaderboard:
                best = max(leaderboard, key=lambda e: e[dim])
                best[f"{dim}_title"] = title

        return leaderboard
