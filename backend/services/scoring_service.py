"""Epoch scoring — 5-dimension scoring, normalization, and compositing."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.epoch_service import DEFAULT_CONFIG, EpochService
from supabase import Client

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
        """Compute and store scores for all participants in the current cycle."""
        # Refresh materialized views so freshly cloned game instances have data
        try:
            supabase.rpc("refresh_all_game_metrics").execute()
        except Exception:
            logger.warning("Failed to refresh materialized views before scoring")

        epoch = await EpochService.get(supabase, epoch_id)
        participants = await EpochService.list_participants(supabase, epoch_id)

        scores = []
        for p in participants:
            sim_id = p["simulation_id"]
            raw = await cls._compute_raw_scores(supabase, epoch_id, sim_id, epoch)

            score_data = {
                "epoch_id": str(epoch_id),
                "simulation_id": sim_id,
                "cycle_number": cycle_number,
                "stability_score": raw["stability"],
                "influence_score": raw["influence"],
                "sovereignty_score": raw["sovereignty"],
                "diplomatic_score": raw["diplomatic"],
                "military_score": raw["military"],
                "composite_score": 0,  # computed after normalization
            }

            resp = (
                supabase.table("epoch_scores")
                .upsert(score_data, on_conflict="epoch_id,simulation_id,cycle_number")
                .execute()
            )
            if resp.data:
                scores.append(resp.data[0])

        # Normalize and compute composites
        if scores:
            scores = await cls._normalize_and_composite(supabase, epoch_id, cycle_number, epoch)

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
        stability = await cls._compute_stability(supabase, simulation_id)
        influence = await cls._compute_influence(supabase, epoch_id, simulation_id)
        sovereignty = await cls._compute_sovereignty(supabase, simulation_id)
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
    async def _compute_stability(cls, supabase: Client, simulation_id: str) -> float:
        """Stability = avg zone stability × 100.

        Rewards keeping infrastructure healthy.
        """
        resp = (
            supabase.table("mv_zone_stability")
            .select("stability")
            .eq("simulation_id", simulation_id)
            .execute()
        )
        if not resp.data:
            return 50.0  # default mid-range

        stabilities = [float(row["stability"]) for row in resp.data]
        return (sum(stabilities) / len(stabilities)) * 100

    @classmethod
    async def _compute_influence(
        cls, supabase: Client, epoch_id: UUID, simulation_id: str
    ) -> float:
        """Influence = sum of completed outbound echo strength during epoch.

        Rewards projecting cultural power through bleed.
        """
        resp = (
            supabase.table("event_echoes")
            .select("echo_strength")
            .eq("source_simulation_id", simulation_id)
            .eq("status", "completed")
            .execute()
        )
        return sum(e.get("echo_strength", 0) for e in resp.data or [])

    @classmethod
    async def _compute_sovereignty(cls, supabase: Client, simulation_id: str) -> float:
        """Sovereignty = 100 × (1 - inbound_echo_impact / total_event_impact).

        Rewards resisting foreign influence.
        """
        # Total event impact
        all_events = (
            supabase.table("events")
            .select("impact_level")
            .eq("simulation_id", simulation_id)
            .execute()
        )
        total_impact = sum(e.get("impact_level", 0) for e in all_events.data or [])
        if total_impact == 0:
            return 100.0

        # Inbound echo impact (events with data_source = 'bleed')
        bleed_events = (
            supabase.table("events")
            .select("impact_level")
            .eq("simulation_id", simulation_id)
            .eq("data_source", "bleed")
            .execute()
        )
        bleed_impact = sum(e.get("impact_level", 0) for e in bleed_events.data or [])

        return max(0, 100 * (1 - bleed_impact / total_impact))

    @classmethod
    async def _compute_diplomatic(
        cls, supabase: Client, epoch_id: UUID, simulation_id: str
    ) -> float:
        """Diplomatic = sum(embassy_effectiveness) × 10 × (1 + 0.1 × alliance_count) × (1 - betrayal_penalty).

        Rewards building and maintaining diplomatic networks.
        Alliance bonus rewards cooperation; betrayal penalty punishes treachery.
        """
        # Embassy effectiveness from materialized view
        # MV has simulation_a_id and simulation_b_id, not simulation_id
        resp = (
            supabase.table("mv_embassy_effectiveness")
            .select("effectiveness")
            .or_(
                f"simulation_a_id.eq.{simulation_id},"
                f"simulation_b_id.eq.{simulation_id}"
            )
            .execute()
        )
        total_effectiveness = sum(float(e.get("effectiveness", 0)) for e in resp.data or [])

        # Count active embassies as base diplomatic score
        embassy_resp = (
            supabase.table("embassies")
            .select("id")
            .eq("status", "active")
            .or_(
                f"simulation_a_id.eq.{simulation_id},"
                f"simulation_b_id.eq.{simulation_id}"
            )
            .execute()
        )
        embassy_count = len(embassy_resp.data or [])

        # Fallback: if no materialized view data, use embassy count
        if total_effectiveness == 0:
            total_effectiveness = embassy_count * 0.5

        base_score = total_effectiveness * 10  # scale up for scoring

        # A4: Alliance bonus — +10% per active ally
        active_alliance_count = 0
        participant_resp = (
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
                allies_resp = (
                    supabase.table("epoch_participants")
                    .select("id")
                    .eq("team_id", team_id)
                    .execute()
                )
                active_alliance_count = max(0, len(allies_resp.data or []) - 1)

        alliance_multiplier = 1.0 + (0.1 * active_alliance_count)

        # A5: Betrayal penalty — -20% diplomatic on detected betrayal
        betrayal_multiplier = 1.0 - betrayal_penalty

        return base_score * alliance_multiplier * betrayal_multiplier

    @classmethod
    async def _compute_military(
        cls, supabase: Client, epoch_id: UUID, simulation_id: str
    ) -> float:
        """Military = sum(mission_value) - sum(failure_penalty).

        Rewards successful covert operations.
        """
        from backend.services.operative_service import DETECTION_PENALTY, MISSION_SCORE_VALUES

        resp = (
            supabase.table("operative_missions")
            .select("operative_type, status")
            .eq("epoch_id", str(epoch_id))
            .eq("source_simulation_id", simulation_id)
            .in_("status", ["success", "failed", "detected", "captured"])
            .execute()
        )

        score = 0.0
        for mission in resp.data or []:
            if mission["status"] == "success":
                score += MISSION_SCORE_VALUES.get(mission["operative_type"], 2)
            elif mission["status"] in ("detected", "captured"):
                score -= DETECTION_PENALTY

        return score

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
        resp = (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("cycle_number", cycle_number)
            .execute()
        )
        scores = resp.data or []
        if not scores:
            return []

        # Pass 1: Find max in each dimension for normalization.
        # Each dimension is independently scaled so that the best performer
        # scores 100 and others are proportional. A floor of 1.0 prevents
        # division by zero when all participants score 0 in a dimension.
        dimensions = ["stability", "influence", "sovereignty", "diplomatic", "military"]
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

            composite = sum(
                normalized[dim] * w[dim] / 100 for dim in dimensions
            )

            supabase.table("epoch_scores").update(
                {"composite_score": round(composite, 2)}
            ).eq("id", s["id"]).execute()

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

        # Use latest cycle if not specified
        if cycle_number is None:
            cycle_number = epoch.get("current_cycle", 1)

        resp = (
            supabase.table("epoch_scores")
            .select("*, simulations(name, slug)")
            .eq("epoch_id", str(epoch_id))
            .eq("cycle_number", cycle_number)
            .order("composite_score", desc=True)
            .execute()
        )

        scores = resp.data or []
        if not scores:
            return []

        # Batch-fetch all participant team assignments for this epoch
        participants_resp = (
            supabase.table("epoch_participants")
            .select("simulation_id, team_id, epoch_teams(name)")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        team_by_sim: dict[str, str | None] = {}
        for p in participants_resp.data or []:
            team = p.get("epoch_teams")
            team_by_sim[p["simulation_id"]] = team.get("name") if team else None

        entries = []
        for rank, score in enumerate(scores, start=1):
            sim = score.get("simulations") or {}
            entries.append({
                "rank": rank,
                "simulation_id": score["simulation_id"],
                "simulation_name": sim.get("name", "Unknown"),
                "simulation_slug": sim.get("slug"),
                "team_name": team_by_sim.get(score["simulation_id"]),
                "stability": float(score["stability_score"]),
                "influence": float(score["influence_score"]),
                "sovereignty": float(score["sovereignty_score"]),
                "diplomatic": float(score["diplomatic_score"]),
                "military": float(score["military_score"]),
                "composite": float(score["composite_score"]),
            })

        return entries

    @classmethod
    async def get_score_history(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """Get all cycle scores for a simulation in an epoch."""
        resp = (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .order("cycle_number")
            .execute()
        )
        return resp.data or []

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
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Final standings only available for completed or cancelled epochs.",
            )

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
