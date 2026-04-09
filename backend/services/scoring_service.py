"""Epoch scoring — 5-dimension scoring, normalization, and compositing."""

import logging
from uuid import UUID

from backend.models.epoch import SCORING_DIMENSIONS
from backend.services.constants import DETECTION_PENALTY, MISSION_SCORE_VALUES
from backend.services.epoch_service import DEFAULT_CONFIG, EpochService
from backend.utils.errors import bad_request
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


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

        resp = await supabase.rpc(
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
                "Scoring RPC returned no data — no participants in epoch?",
                extra={"epoch_id": str(epoch_id), "cycle_number": cycle_number},
            )

        return scores

    @classmethod
    async def _compute_raw_scores(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: str,
        epoch: dict,
    ) -> dict:
        """Compute raw (un-normalized) scores for a simulation."""
        stability = await cls._compute_stability(supabase, epoch_id, simulation_id)
        influence = await cls._compute_influence(supabase, epoch_id, simulation_id)
        sovereignty = await cls._compute_sovereignty(supabase, epoch_id, simulation_id)
        diplomatic = await cls._compute_diplomatic(supabase, epoch_id, simulation_id)
        military = await cls._compute_military(supabase, epoch_id, simulation_id)

        return {
            "stability": stability,
            "influence": influence,
            "sovereignty": sovereignty,
            "diplomatic": diplomatic,
            "military": military,
        }

    @classmethod
    async def _compute_stability(cls, supabase: Client, epoch_id: UUID, simulation_id: str) -> float:
        """Stability = avg(zone_stability) × 100 - propaganda×3 - saboteur×6 - assassin×5.

        Uses ``mv_zone_stability`` (migration 031). Rewards keeping infrastructure healthy.
        Penalized by inbound propaganda events, sabotage, and assassinations.
        """
        resp = await (
            supabase.table("mv_zone_stability").select("stability").eq("simulation_id", simulation_id).execute()
        )
        if not resp.data:
            base_stability = 50.0
        else:
            stabilities = [float(row["stability"]) for row in resp.data]
            base_stability = (sum(stabilities) / len(stabilities)) * 100

        # Count inbound propaganda events (created by propagandist operatives)
        propaganda_resp = await (
            supabase.table("events")
            .select("id", count="exact")
            .eq("simulation_id", simulation_id)
            .eq("data_source", "propagandist")
            .execute()
        )
        propaganda_count = propaganda_resp.count or 0

        # Count successful inbound saboteur and assassin missions
        inbound_resp = await (
            supabase.table("operative_missions")
            .select("operative_type")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", simulation_id)
            .eq("status", "success")
            .in_("operative_type", ["saboteur", "assassin"])
            .execute()
        )
        saboteur_count = sum(1 for m in (extract_list(inbound_resp)) if m["operative_type"] == "saboteur")
        assassin_count = sum(1 for m in (extract_list(inbound_resp)) if m["operative_type"] == "assassin")

        return max(0.0, base_stability - (propaganda_count * 3) - (saboteur_count * 6) - (assassin_count * 5))

    @classmethod
    async def _compute_influence(cls, supabase: Client, epoch_id: UUID, simulation_id: str) -> float:
        """Influence = (propagandist × 5) + (spy × 2) + (infiltrator × 3) + echo_strength_sum.

        Rewards projecting cultural and intelligence power.
        """
        # Successful outbound propaganda, spy, and infiltrator missions
        missions_resp = await (
            supabase.table("operative_missions")
            .select("operative_type")
            .eq("epoch_id", str(epoch_id))
            .eq("source_simulation_id", simulation_id)
            .eq("status", "success")
            .in_("operative_type", ["propagandist", "spy", "infiltrator"])
            .execute()
        )
        propagandist_wins = sum(1 for m in (extract_list(missions_resp)) if m["operative_type"] == "propagandist")
        spy_wins = sum(1 for m in (extract_list(missions_resp)) if m["operative_type"] == "spy")
        infiltrator_wins = sum(1 for m in (extract_list(missions_resp)) if m["operative_type"] == "infiltrator")

        # Echo strength (bleed system — may be 0 in competitive play)
        echo_resp = await (
            supabase.table("event_echoes")
            .select("echo_strength")
            .eq("source_simulation_id", simulation_id)
            .eq("status", "completed")
            .execute()
        )
        echo_sum = sum(e.get("echo_strength", 0) for e in extract_list(echo_resp))

        return (propagandist_wins * 5) + (spy_wins * 2) + (infiltrator_wins * 3) + echo_sum

    @classmethod
    async def _compute_sovereignty(cls, supabase: Client, epoch_id: UUID, simulation_id: str) -> float:
        """Sovereignty = 100 - type_penalties + detected_bonus + guardian_bonus.

        Penalties per successful inbound mission type:
          spy: -2, propagandist: -6, infiltrator: -8, saboteur: -8, assassin: -12
        Bonuses:
          +3 per detected inbound mission
          +4 per active guardian

        Rewards defending your simulation from foreign operatives.
        Clamped to [0, 100].
        """
        type_penalties = {
            "spy": 2,
            "propagandist": 6,
            "infiltrator": 8,
            "saboteur": 8,
            "assassin": 12,
        }

        # Successful inbound missions (attacks against this sim)
        inbound_resp = await (
            supabase.table("operative_missions")
            .select("operative_type, status")
            .eq("epoch_id", str(epoch_id))
            .eq("target_simulation_id", simulation_id)
            .in_("status", ["success", "detected", "captured"])
            .execute()
        )

        penalty_total = 0.0
        detected_count = 0
        for m in extract_list(inbound_resp):
            if m["status"] == "success":
                penalty_total += type_penalties.get(m["operative_type"], 5)
            elif m["status"] in ("detected", "captured"):
                detected_count += 1

        # Active guardians defending this sim
        guardian_resp = await (
            supabase.table("operative_missions")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("operative_type", "guardian")
            .eq("source_simulation_id", simulation_id)
            .eq("status", "active")
            .execute()
        )
        guardian_count = len(extract_list(guardian_resp))

        return max(0.0, min(100.0, 100.0 - penalty_total + (detected_count * 3) + (guardian_count * 4)))

    @classmethod
    async def _compute_diplomatic(cls, supabase: Client, epoch_id: UUID, simulation_id: str) -> float:
        """Diplomatic = (sum(embassy_eff) × 10 + spy_bonus) × (1 + 0.15 × allies) × (1 - betrayal_penalty).

        Rewards building and maintaining diplomatic networks.
        Alliance bonus (+15% per ally) rewards cooperation; betrayal penalty (-25%) punishes treachery.
        Spy intel bonus (+1 per successful spy mission) adds diplomatic leverage.
        """
        # Embassy effectiveness from mv_embassy_effectiveness (migration 031)
        # MV has simulation_a_id and simulation_b_id, not simulation_id
        resp = await (
            supabase.table("mv_embassy_effectiveness")
            .select("effectiveness")
            .or_(f"simulation_a_id.eq.{simulation_id},simulation_b_id.eq.{simulation_id}")
            .execute()
        )
        total_effectiveness = sum(float(e.get("effectiveness", 0)) for e in extract_list(resp))

        # Count active embassies as base diplomatic score
        embassy_resp = await (
            supabase.table("embassies")
            .select("id")
            .eq("status", "active")
            .or_(f"simulation_a_id.eq.{simulation_id},simulation_b_id.eq.{simulation_id}")
            .execute()
        )
        embassy_count = len(extract_list(embassy_resp))

        # Fallback: if no materialized view data, use embassy count
        if total_effectiveness == 0:
            total_effectiveness = embassy_count * 0.5

        base_score = total_effectiveness * 10  # scale up for scoring

        # A4: Alliance bonus — +15% per active ally
        active_alliance_count = 0
        participant_resp = await (
            supabase.table("epoch_participants")
            .select("team_id, betrayal_penalty")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", simulation_id)
            .maybe_single()
            .execute()
        )
        betrayal_penalty = 0.0
        if participant_resp.data:
            team_id = participant_resp.data.get("team_id")
            betrayal_penalty = float(participant_resp.data.get("betrayal_penalty") or 0)
            if team_id:
                allies_resp = await supabase.table("epoch_participants").select("id").eq("team_id", team_id).execute()
                active_alliance_count = max(0, len(extract_list(allies_resp)) - 1)

        alliance_multiplier = 1.0 + (0.15 * active_alliance_count)

        # A5: Betrayal penalty — -25% diplomatic on detected betrayal
        betrayal_multiplier = 1.0 - betrayal_penalty

        # Spy diplomatic bonus: +1 per successful outbound spy mission
        spy_resp = await (
            supabase.table("operative_missions")
            .select("id", count="exact")
            .eq("epoch_id", str(epoch_id))
            .eq("source_simulation_id", simulation_id)
            .eq("operative_type", "spy")
            .eq("status", "success")
            .execute()
        )
        spy_bonus = spy_resp.count or 0

        return (base_score + spy_bonus) * alliance_multiplier * betrayal_multiplier

    @classmethod
    async def _compute_military(cls, supabase: Client, epoch_id: UUID, simulation_id: str) -> float:
        """Military = sum(mission_value) - sum(failure_penalty).

        Rewards successful covert operations.
        """
        resp = await (
            supabase.table("operative_missions")
            .select("operative_type, status")
            .eq("epoch_id", str(epoch_id))
            .eq("source_simulation_id", simulation_id)
            .in_("status", ["success", "failed", "detected", "captured"])
            .execute()
        )

        score = 0.0
        for mission in extract_list(resp):
            if mission["status"] == "success":
                score += MISSION_SCORE_VALUES.get(mission["operative_type"], 2)
            elif mission["status"] in ("detected", "captured"):
                score -= DETECTION_PENALTY

        # Floor at 0 — military is an achievement score, not a debt score.
        # Without this floor, a player who attempts many failed missions
        # ends up with unbounded negative composite that dominates all other
        # dimensions (e.g., -6000 normalized from 20 detections).
        return max(score, 0.0)

    # ── Normalization ─────────────────────────────────────

    @classmethod
    async def _normalize_and_composite(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        epoch: dict,
    ) -> list[dict]:
        """Normalize raw scores across participants and compute weighted composites.

        Normalization algorithm (two-pass):

        Pass 1 — Max-normalize per dimension:
            For each of the 5 scoring dimensions (stability, influence,
            sovereignty, diplomatic, military), find the maximum raw value
            among all participants in this cycle. Each participant's raw
            score is then scaled to 0-100 relative to that maximum:
                normalized[dim] = (raw / max_raw) * 100
            This ensures fair comparison regardless of absolute magnitude
            differences between dimensions (e.g. stability ~0-100 vs
            military ~0-20). If a dimension's max is 0, all values stay 0.

        Pass 2 — Weighted composite:
            The 5 normalized scores are combined into a single composite
            using configurable weights (from epoch.config.score_weights,
            defaulting to stability=25, influence=20, sovereignty=20,
            diplomatic=15, military=20, summing to 100):
                composite = sum(normalized[dim] * weight[dim] / 100)
            Result is rounded to 2 decimal places and persisted.

        Each participant's composite_score is upserted back to the
        epoch_scores table.
        """
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        weights = config.get("score_weights", {})

        # Fetch raw scores for this cycle
        resp = await (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("cycle_number", cycle_number)
            .execute()
        )
        scores = extract_list(resp)
        if not scores:
            return []

        # Pass 1: Find max in each dimension for normalization.
        # Each dimension is independently scaled so that the best performer
        # scores 100 and others are proportional. A floor of 1.0 prevents
        # division by zero when all participants score 0 in a dimension.
        dimensions = SCORING_DIMENSIONS
        maxes = {}
        for dim in dimensions:
            col = f"{dim}_score"
            values = [s[col] for s in scores]
            maxes[dim] = max(values) if values and max(values) > 0 else 1.0

        # Default weights (sum to 100 for percentage-based composition)
        w = {
            "stability": weights.get("stability", 25),
            "influence": weights.get("influence", 20),
            "sovereignty": weights.get("sovereignty", 20),
            "diplomatic": weights.get("diplomatic", 15),
            "military": weights.get("military", 20),
        }

        # Pass 2: Normalize each participant and compute weighted composite
        updated = []
        for s in scores:
            normalized = {}
            for dim in dimensions:
                col = f"{dim}_score"
                raw = s[col]
                normalized[dim] = (raw / maxes[dim]) * 100 if maxes[dim] > 0 else 0

            composite = sum(normalized[dim] * w[dim] / 100 for dim in dimensions)

            await (
                supabase.table("epoch_scores")
                .update({"composite_score": round(composite, 2)})
                .eq("id", s["id"])
                .execute()
            )

            s["composite_score"] = round(composite, 2)
            updated.append(s)

        return updated

    # ── Leaderboard ───────────────────────────────────────

    @classmethod
    async def get_leaderboard(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int | None = None,
    ) -> list[dict]:
        """Get the leaderboard for an epoch (optionally at a specific cycle).

        Returns entries sorted by composite_score descending, with rank and
        simulation details. Uses a single query to fetch scores + simulation
        info, and a batch query for team assignments (avoids N+1).
        """
        epoch = await EpochService.get(supabase, epoch_id)

        # Use the latest *scored* cycle if not specified. current_cycle
        # points one past the last resolved cycle, so querying it directly
        # returns empty for completed epochs.
        if cycle_number is None:
            max_resp = await (
                supabase.table("epoch_scores")
                .select("cycle_number")
                .eq("epoch_id", str(epoch_id))
                .order("cycle_number", desc=True)
                .limit(1)
                .execute()
            )
            if max_resp.data:
                cycle_number = max_resp.data[0]["cycle_number"]
            else:
                # No scores exist — fall back to last resolved cycle.
                # current_cycle points one past the last resolved, so use -1.
                cycle_number = max(1, epoch.get("current_cycle", 1) - 1)
                logger.warning(
                    "No epoch_scores found — falling back to cycle %d",
                    cycle_number,
                    extra={"epoch_id": str(epoch_id)},
                )

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

        # Batch-fetch simulation names (separate query avoids PostgREST
        # join coercion failures when FK cardinality is ambiguous)
        score_sim_ids = [s["simulation_id"] for s in scores]
        sims_resp = await supabase.table("simulations").select("id, name, slug").in_("id", score_sim_ids).execute()
        sim_map: dict[str, dict] = {s["id"]: s for s in extract_list(sims_resp)}

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

        entries = []
        for rank, score in enumerate(scores, start=1):
            sim_id = score["simulation_id"]
            sim = sim_map.get(sim_id, {})
            ac = ally_counts.get(sim_id, 0)
            entries.append(
                {
                    "rank": rank,
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

        dossiers = []
        for target_sim_id, target_reports in by_target.items():
            latest = target_reports[0]  # already sorted desc
            meta = latest.get("metadata") or {}
            sim_info = latest.get("simulations") or {}

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
    ) -> dict:
        """Get comprehensive results summary for a completed epoch.

        Returns declassified data: standings, per-participant operation
        statistics, MVP awards, and score history. Only available for
        completed epochs (fog of war lifted).
        """
        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "completed":
            raise bad_request("Results summary only available for completed epochs.")

        standings = await cls.get_final_standings(supabase, epoch_id)

        # Per-participant operation statistics — batch query (no N+1)
        participants = await EpochService.list_participants(supabase, epoch_id)
        sim_ids = [p["simulation_id"] for p in participants]

        # Single batch query for all mission stats
        all_missions_resp = await (
            supabase.table("operative_missions")
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
                    "description": "Highest military score — supreme covert operations.",
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
                    "description": "Highest sovereignty — impenetrable defenses.",
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
                    "description": "Highest diplomatic score — master of alliances.",
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
                    "description": "Highest success rate — surgical precision.",
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
                    "description": "Highest influence — reshaping the narrative.",
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
    ) -> list[dict]:
        """Get final standings for a completed epoch.

        Returns the last cycle's leaderboard plus dimension titles.
        """
        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] not in ("completed", "cancelled"):
            raise bad_request("Final standings only available for completed or cancelled epochs.")

        leaderboard = await cls.get_leaderboard(supabase, epoch_id)

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
